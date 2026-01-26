/**
 * UPDATED HANDLER - Add this to replace the existing exports.handler in index.js
 * 
 * This handler supports both:
 * 1. Scheduled EventBridge triggers → runs automated trading cycle
 * 2. HTTP API calls via Function URL → manual trading actions from widget
 */

// ==============================================================================
// HTTP API ACTION HANDLERS - Add these functions before exports.handler
// ==============================================================================

// Get all open positions
async function getPositions(provider, wallet) {
  const storage = new ethers.Contract(CONFIG.GTRADE.STORAGE, STORAGE_ABI, provider);
  const positions = [];
  
  for (let i = 0; i < 4; i++) {
    try {
      const trade = await storage.openTrades(wallet.address, i);
      if (trade.trader && trade.trader !== ethers.ZeroAddress) {
        const pairIndex = Number(trade.pairIndex);
        const assetName = Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === pairIndex)?.[0] || `PAIR_${pairIndex}`;
        
        positions.push({
          index: i,
          asset: assetName,
          pairIndex,
          collateral: parseFloat(ethers.formatUnits(trade.initialPosToken, 6)),
          positionSize: parseFloat(ethers.formatUnits(trade.positionSizeUsd, 18)),
          openPrice: parseFloat(ethers.formatUnits(trade.openPrice, 10)),
          leverage: Number(trade.leverage) / 1e10,
          isLong: trade.buy,
          tp: parseFloat(ethers.formatUnits(trade.tp, 10)),
          sl: parseFloat(ethers.formatUnits(trade.sl, 10)),
        });
      }
    } catch (e) {
      // Position doesn't exist at this index
    }
  }
  
  return positions;
}

// Get USDC balance
async function getBalance(wallet) {
  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet);
  const balance = await usdc.balanceOf(wallet.address);
  return parseFloat(ethers.formatUnits(balance, 6));
}

// Open a manual trade from widget
async function openManualTrade(trading, wallet, params) {
  const { asset, direction, collateral, leverage, orderType, limitPrice, takeProfit, stopLoss } = params;
  
  const pairIndex = CONFIG.ASSET_INDEX[asset];
  if (pairIndex === undefined) {
    throw new Error(`Unknown asset: ${asset}`);
  }
  
  const isBuy = direction === 'LONG';
  const positionSize = collateral * leverage;
  
  // Get current price for market orders
  let currentPrice;
  if (orderType === 'MARKET') {
    const priceResponse = await fetch(`https://backend-pricing.eu.gains.trade/charts/prices?from=gTrade&pairs=${pairIndex}`);
    const priceData = await priceResponse.json();
    currentPrice = parseFloat(priceData[pairIndex].price);
  } else {
    currentPrice = limitPrice;
  }
  
  // Calculate TP/SL prices
  const tpPrice = takeProfit ? takeProfit : (isBuy ? currentPrice * 5 : currentPrice * 0.2);
  const slPrice = stopLoss ? stopLoss : (isBuy ? currentPrice * 0.2 : currentPrice * 5);
  
  const tradeParams = {
    trader: wallet.address,
    pairIndex,
    index: 0,
    initialPosToken: ethers.parseUnits(collateral.toString(), 6),
    positionSizeUsd: ethers.parseUnits(positionSize.toString(), 18),
    openPrice: ethers.parseUnits(currentPrice.toFixed(10), 10),
    buy: isBuy,
    leverage: BigInt(Math.floor(leverage * 1e10)),
    tp: ethers.parseUnits(tpPrice.toFixed(10), 10),
    sl: ethers.parseUnits(slPrice.toFixed(10), 10),
    timestamp: Math.floor(Date.now() / 1000),
  };
  
  console.log(`📊 Opening ${direction} ${asset} - $${collateral} @ ${leverage}x`);
  
  const tx = await trading.openTrade(tradeParams, 0, ethers.parseUnits('1', 10));
  const receipt = await tx.wait();
  
  return {
    success: true,
    txHash: receipt.hash,
    asset,
    direction,
    collateral,
    leverage,
    openPrice: currentPrice,
  };
}

// Close a position by index
async function closePosition(trading, wallet, tradeIndex) {
  console.log(`🔴 Closing position at index ${tradeIndex}`);
  
  const tx = await trading.closeTradeMarket(tradeIndex);
  const receipt = await tx.wait();
  
  return {
    success: true,
    txHash: receipt.hash,
    tradeIndex,
  };
}

// ==============================================================================
// UPDATED HANDLER - Replace the existing exports.handler with this
// ==============================================================================

exports.handler = async (event) => {
  // Add CORS headers for browser requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  
  // Handle preflight OPTIONS request
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  
  try {
    if (!CONFIG.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not set');
    }
    
    // Check if this is an HTTP API call with an action
    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (e) {
        // Not JSON body, treat as scheduled event
      }
    }
    
    const action = body.action;
    
    // If no action specified, run the automated trading cycle (scheduled event)
    if (!action) {
      console.log('📅 Scheduled trigger - running trading cycle');
      return await runTradingCycle();
    }
    
    console.log(`🌐 HTTP API call - action: ${action}`);
    
    // Setup provider and wallet for API calls
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
    const trading = new ethers.Contract(CONFIG.GTRADE.TRADING, TRADING_ABI, wallet);
    
    let result;
    
    switch (action) {
      case 'POSITIONS':
        const positions = await getPositions(provider, wallet);
        result = { success: true, positions };
        break;
        
      case 'BALANCE':
        const balance = await getBalance(wallet);
        result = { success: true, balance };
        break;
        
      case 'OPEN_TRADE':
        result = await openManualTrade(trading, wallet, body);
        break;
        
      case 'CLOSE_TRADE':
        result = await closePosition(trading, wallet, body.tradeIndex);
        break;
        
      case 'AUTO':
        // Force run automated trading cycle
        return await runTradingCycle();
        
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
    
  } catch (err) {
    console.error('❌ Error:', err);
    await sendSignal(`❌ API ERROR: ${err.message}`, 'ERROR');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
