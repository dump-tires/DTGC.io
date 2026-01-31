/**
 * LAMBDA HANDLER v4.0 - AUTO-CLAIM COLLATERAL SUPPORT
 *
 * New features:
 * - GET_PENDING_ORDERS: Fetch orders that timed out
 * - CLAIM_COLLATERAL: Claim collateral from timed out orders
 * - AUTO_CLAIM_ALL: Claim all pending collateral in one call
 * - Better gas estimation with fallbacks
 *
 * Deploy this to your AWS Lambda function
 */

const { ethers } = require('ethers');

// ==============================================================================
// CONFIGURATION - Update these with your settings
// ==============================================================================

const CONFIG = {
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  RPC_URL: process.env.RPC_URL || 'https://arb1.arbitrum.io/rpc',

  // gTrade v10 Contract Addresses (Arbitrum)
  GTRADE: {
    TRADING: '0xFF162c694eAA571f685030649814282eA457f169',       // GNSTradingV10
    STORAGE: '0xcFa6eFD4E0B5E00E87b5c2aD7B8F8C16c8dABd41',       // GNSBorrowingFees / Storage
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',          // USDC on Arbitrum
    CALLBACKS: '0x298a695906e16aeA0a184A2815A76eAd1a0b7522',     // Callbacks contract
    PRICE_AGGREGATOR: '0x2E59D81cCf22B3c0D3060f9B8e0c9e24aC41b22e', // For pending orders
  },

  ASSET_INDEX: {
    'BTC': 0,
    'ETH': 1,
    'GOLD': 90,
    'SILVER': 91,
  },

  // Telegram alerts (optional)
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
};

// ==============================================================================
// ABIs - Minimal ABIs for the functions we need
// ==============================================================================

const TRADING_ABI = [
  'function openTrade((address trader, uint32 pairIndex, uint32 index, uint128 initialPosToken, uint128 positionSizeUsd, uint64 openPrice, bool buy, uint128 leverage, uint64 tp, uint64 sl, uint32 timestamp) trade, uint16 maxSlippage, uint64 expectedPrice) external',
  'function closeTradeMarket(uint32 index) external',
  'function cancelOpenLimitOrder(uint32 orderIndex) external',
  'function updateOpenLimitOrder(uint32 orderIndex, uint64 price, uint64 tp, uint64 sl) external',
  'function getOpenLimitOrders(address trader) external view returns (tuple(address trader, uint32 pairIndex, uint32 index, uint128 positionSize, bool buy, uint128 leverage, uint64 tp, uint64 sl, uint64 minPrice, uint64 maxPrice, uint32 block, uint8 tokenId)[] memory)',
  'function getPendingMarketOrders(address trader) external view returns (tuple(address trader, uint32 pairIndex, uint32 index, uint128 positionSize, uint128 initialPosToken, bool buy, uint128 leverage, uint64 tp, uint64 sl, uint32 block)[] memory)',
];

const STORAGE_ABI = [
  'function openTrades(address trader, uint256 index) external view returns (address trader, uint32 pairIndex, uint32 index, uint128 initialPosToken, uint128 positionSizeUsd, uint64 openPrice, bool buy, uint128 leverage, uint64 tp, uint64 sl, uint32 timestamp)',
  'function pendingMarketOpenCount(address trader, uint256 pairIndex) external view returns (uint256)',
  'function pendingMarketCloseCount(address trader, uint256 pairIndex) external view returns (uint256)',
  'function openTradesCount(address trader, uint256 pairIndex) external view returns (uint256)',
  'function getPendingOrder(address trader, uint256 orderId) external view returns (tuple(address trader, uint32 pairIndex, uint32 index, uint128 positionSize, uint128 initialPosToken, bool buy, uint128 leverage, uint64 tp, uint64 sl, uint32 block))',
];

const ERC20_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

// gTrade v10 Pending Order Manager ABI (for claiming timed out orders)
const PENDING_ORDER_ABI = [
  'function cancelPendingMarketOrder(uint256 orderId) external',
  'function getPendingMarketOrder(address trader, uint256 orderId) external view returns (tuple(address trader, uint32 pairIndex, uint32 index, uint128 positionSize, uint128 initialPosToken, bool buy, uint128 leverage, uint64 tp, uint64 sl, uint32 block, uint8 orderType))',
  'function pendingMarketOrdersCount(address trader) external view returns (uint256)',
];

// ==============================================================================
// HELPER FUNCTIONS
// ==============================================================================

async function sendSignal(message, type = 'INFO') {
  if (CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID) {
    try {
      const emoji = type === 'ERROR' ? '❌' : type === 'SUCCESS' ? '✅' : type === 'CLAIM' ? '💰' : '📊';
      await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CONFIG.TELEGRAM_CHAT_ID,
          text: `${emoji} ${message}`,
          parse_mode: 'HTML',
        }),
      });
    } catch (e) {
      console.log('Telegram send failed:', e.message);
    }
  }
}

// Safe gas estimation with fallback
async function estimateGasWithFallback(contract, method, args, fallbackGas = 500000n) {
  try {
    const estimated = await contract[method].estimateGas(...args);
    // Add 30% buffer
    return estimated * 130n / 100n;
  } catch (e) {
    console.warn(`Gas estimation failed for ${method}, using fallback:`, e.message);
    return fallbackGas;
  }
}

// ==============================================================================
// CORE FUNCTIONS
// ==============================================================================

// Get all open positions
async function getPositions(provider, wallet) {
  const storage = new ethers.Contract(CONFIG.GTRADE.STORAGE, STORAGE_ABI, provider);
  const positions = [];

  // Check up to 10 position indices (gTrade allows multiple per pair)
  for (let i = 0; i < 10; i++) {
    try {
      const trade = await storage.openTrades(wallet.address, i);
      if (trade.trader && trade.trader !== ethers.ZeroAddress && trade.trader.toLowerCase() === wallet.address.toLowerCase()) {
        const pairIndex = Number(trade.pairIndex);
        const assetName = Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === pairIndex)?.[0] || `PAIR_${pairIndex}`;

        positions.push({
          index: i,
          tradeIndex: i,
          asset: assetName,
          pairIndex,
          collateral: parseFloat(ethers.formatUnits(trade.initialPosToken, 6)),
          positionSize: parseFloat(ethers.formatUnits(trade.positionSizeUsd, 18)),
          openPrice: parseFloat(ethers.formatUnits(trade.openPrice, 10)),
          leverage: Number(trade.leverage) / 1e10,
          long: trade.buy,
          buy: trade.buy,
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

// ==============================================================================
// NEW: PENDING ORDER / COLLATERAL CLAIM FUNCTIONS
// ==============================================================================

// Get pending orders (timed out market orders that need collateral claimed)
async function getPendingOrders(trading, wallet) {
  const pendingOrders = [];

  try {
    // Try to get pending market orders directly
    const orders = await trading.getPendingMarketOrders(wallet.address);

    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      if (order.trader && order.trader !== ethers.ZeroAddress) {
        const pairIndex = Number(order.pairIndex);
        const assetName = Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === pairIndex)?.[0] || `PAIR_${pairIndex}`;

        pendingOrders.push({
          orderId: i,
          index: Number(order.index),
          asset: assetName,
          pairIndex,
          collateral: parseFloat(ethers.formatUnits(order.initialPosToken || order.positionSize, 6)),
          positionSize: parseFloat(ethers.formatUnits(order.positionSize, 18)),
          long: order.buy,
          leverage: Number(order.leverage) / 1e10,
          block: Number(order.block),
          canClaim: true, // These orders can be claimed
        });
      }
    }
  } catch (e) {
    console.log('getPendingMarketOrders not available, trying alternative method:', e.message);

    // Alternative: Check open limit orders that might be pending
    try {
      const limitOrders = await trading.getOpenLimitOrders(wallet.address);
      for (let i = 0; i < limitOrders.length; i++) {
        const order = limitOrders[i];
        if (order.trader && order.trader !== ethers.ZeroAddress) {
          const pairIndex = Number(order.pairIndex);
          const assetName = Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === pairIndex)?.[0] || `PAIR_${pairIndex}`;

          pendingOrders.push({
            orderId: i,
            index: Number(order.index),
            asset: assetName,
            pairIndex,
            collateral: parseFloat(ethers.formatUnits(order.positionSize, 6)),
            long: order.buy,
            leverage: Number(order.leverage) / 1e10,
            block: Number(order.block),
            isLimitOrder: true,
            canClaim: true,
          });
        }
      }
    } catch (e2) {
      console.log('getOpenLimitOrders also failed:', e2.message);
    }
  }

  return pendingOrders;
}

// Claim collateral from a single timed out order
async function claimCollateral(trading, wallet, orderId, isLimitOrder = false) {
  console.log(`💰 Claiming collateral from order #${orderId} (limit: ${isLimitOrder})`);

  try {
    let tx;

    if (isLimitOrder) {
      // Cancel limit order to get collateral back
      const gasLimit = await estimateGasWithFallback(trading, 'cancelOpenLimitOrder', [orderId], 300000n);
      tx = await trading.cancelOpenLimitOrder(orderId, { gasLimit });
    } else {
      // Cancel pending market order to get collateral back
      const gasLimit = await estimateGasWithFallback(trading, 'cancelPendingMarketOrder', [orderId], 300000n);
      tx = await trading.cancelPendingMarketOrder(orderId, { gasLimit });
    }

    const receipt = await tx.wait();

    await sendSignal(`💰 Claimed collateral from order #${orderId}\nTx: ${receipt.hash}`, 'CLAIM');

    return {
      success: true,
      txHash: receipt.hash,
      orderId,
    };
  } catch (e) {
    console.error(`Failed to claim order #${orderId}:`, e.message);

    // Try alternative method - sometimes the function name differs
    try {
      const gasLimit = 400000n;
      const tx = await trading.cancelOpenLimitOrder(orderId, { gasLimit });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        orderId,
        method: 'cancelOpenLimitOrder',
      };
    } catch (e2) {
      return {
        success: false,
        error: e.message,
        orderId,
      };
    }
  }
}

// AUTO-CLAIM ALL: Claim all pending collateral in batch
async function autoClaimAll(trading, wallet) {
  const results = [];
  let totalClaimed = 0;

  console.log('🔄 Starting auto-claim of all pending collateral...');

  // Get all pending orders
  const pendingOrders = await getPendingOrders(trading, wallet);

  if (pendingOrders.length === 0) {
    return {
      success: true,
      message: 'No pending orders to claim',
      claimed: 0,
      results: [],
    };
  }

  console.log(`📋 Found ${pendingOrders.length} pending orders to claim`);
  await sendSignal(`🔄 Auto-claiming ${pendingOrders.length} pending orders...`, 'INFO');

  // Claim each order
  for (const order of pendingOrders) {
    try {
      const result = await claimCollateral(trading, wallet, order.orderId, order.isLimitOrder);
      results.push({
        ...result,
        asset: order.asset,
        collateral: order.collateral,
      });

      if (result.success) {
        totalClaimed += order.collateral;
        console.log(`✅ Claimed $${order.collateral} from ${order.asset} order #${order.orderId}`);
      }

      // Small delay between claims to avoid nonce issues
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      results.push({
        success: false,
        orderId: order.orderId,
        error: e.message,
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  await sendSignal(`💰 Auto-claim complete!\nClaimed: ${successCount}/${pendingOrders.length}\nTotal: $${totalClaimed.toFixed(2)}`, 'SUCCESS');

  return {
    success: true,
    message: `Claimed ${successCount}/${pendingOrders.length} orders`,
    totalClaimed,
    claimed: successCount,
    results,
  };
}

// ==============================================================================
// TRADE FUNCTIONS (with improved gas handling)
// ==============================================================================

// Get live prices from gTrade
async function getPrices() {
  try {
    const response = await fetch('https://backend-pricing.eu.gains.trade/charts/prices?from=gTrade&pairs=0,1,90,91');
    const data = await response.json();

    return {
      BTC: parseFloat(data[0]),
      ETH: parseFloat(data[1]),
      GOLD: parseFloat(data[90]),
      SILVER: parseFloat(data[91]),
    };
  } catch (e) {
    console.error('Price fetch failed:', e);
    return null;
  }
}

// Open a manual trade from widget - with better gas handling
async function openManualTrade(trading, wallet, params) {
  const { asset, direction, collateral, leverage, takeProfit, stopLoss, price, slippage = 1 } = params;

  const pairIndex = CONFIG.ASSET_INDEX[asset];
  if (pairIndex === undefined) {
    throw new Error(`Unknown asset: ${asset}`);
  }

  const isBuy = direction === 'LONG';
  const positionSize = collateral * leverage;

  // Get current price
  let currentPrice = price;
  if (!currentPrice) {
    const prices = await getPrices();
    currentPrice = prices[asset];
  }

  if (!currentPrice || currentPrice <= 0) {
    throw new Error(`Invalid price for ${asset}`);
  }

  // Calculate TP/SL prices from percentages
  const leveragedMove = 1 / leverage;
  const tpPercent = takeProfit || 1.5;
  const slPercent = stopLoss || 1.0;

  const tpPrice = isBuy
    ? currentPrice * (1 + (tpPercent / 100) / leverage)
    : currentPrice * (1 - (tpPercent / 100) / leverage);
  const slPrice = isBuy
    ? currentPrice * (1 - (slPercent / 100) / leverage)
    : currentPrice * (1 + (slPercent / 100) / leverage);

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

  console.log(`📊 Opening ${direction} ${asset} - $${collateral} @ ${leverage}x (TP: ${tpPercent}%, SL: ${slPercent}%)`);

  // Use higher slippage for volatile markets
  const maxSlippage = Math.max(slippage, 2) * 100; // Convert to basis points
  const expectedPrice = ethers.parseUnits(currentPrice.toFixed(10), 10);

  // Estimate gas with fallback
  const gasLimit = await estimateGasWithFallback(
    trading,
    'openTrade',
    [tradeParams, maxSlippage, expectedPrice],
    800000n  // Higher fallback for trade opens
  );

  try {
    const tx = await trading.openTrade(tradeParams, maxSlippage, expectedPrice, { gasLimit });
    const receipt = await tx.wait();

    await sendSignal(`✅ ${direction} ${asset} opened!\n$${collateral} @ ${leverage}x\nPrice: $${currentPrice.toFixed(2)}`, 'SUCCESS');

    return {
      success: true,
      txHash: receipt.hash,
      asset,
      direction,
      collateral,
      leverage,
      openPrice: currentPrice,
      tp: tpPrice,
      sl: slPrice,
    };
  } catch (e) {
    console.error('Trade open failed:', e);

    // Check if it's a gas estimation error
    if (e.message.includes('UNPREDICTABLE_GAS_LIMIT') || e.message.includes('cannot estimate gas')) {
      // Retry with fixed high gas
      try {
        const tx = await trading.openTrade(tradeParams, maxSlippage, expectedPrice, { gasLimit: 1000000n });
        const receipt = await tx.wait();

        return {
          success: true,
          txHash: receipt.hash,
          asset,
          direction,
          collateral,
          leverage,
          openPrice: currentPrice,
          retried: true,
        };
      } catch (e2) {
        throw new Error(`Trade failed after retry: ${e2.message}`);
      }
    }

    throw e;
  }
}

// Close a position by index
async function closePosition(trading, wallet, tradeIndex) {
  console.log(`🔴 Closing position at index ${tradeIndex}`);

  const gasLimit = await estimateGasWithFallback(trading, 'closeTradeMarket', [tradeIndex], 500000n);

  try {
    const tx = await trading.closeTradeMarket(tradeIndex, { gasLimit });
    const receipt = await tx.wait();

    await sendSignal(`🔴 Position #${tradeIndex} closed\nTx: ${receipt.hash}`, 'INFO');

    return {
      success: true,
      txHash: receipt.hash,
      tradeIndex,
    };
  } catch (e) {
    // Retry with higher gas
    try {
      const tx = await trading.closeTradeMarket(tradeIndex, { gasLimit: 800000n });
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        tradeIndex,
        retried: true,
      };
    } catch (e2) {
      throw new Error(`Close failed: ${e2.message}`);
    }
  }
}

// ==============================================================================
// MAIN HANDLER
// ==============================================================================

exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if (!CONFIG.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY not set');
    }

    let body = {};
    if (event.body) {
      try {
        body = JSON.parse(event.body);
      } catch (e) {}
    }

    const action = body.action;

    if (!action) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, message: 'gTrade Bot v4.0 - Auto-Claim Ready' }),
      };
    }

    console.log(`🌐 API call: ${action}`);

    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
    const trading = new ethers.Contract(CONFIG.GTRADE.TRADING, TRADING_ABI, wallet);

    let result;

    switch (action) {
      case 'STATUS':
        const [positions, balance] = await Promise.all([
          getPositions(provider, wallet),
          getBalance(wallet),
        ]);
        const pendingOrders = await getPendingOrders(trading, wallet);
        result = {
          success: true,
          positions,
          balance,
          pendingOrders,
          pendingCount: pendingOrders.length,
          wallet: wallet.address,
        };
        break;

      case 'POSITIONS':
        result = { success: true, positions: await getPositions(provider, wallet) };
        break;

      case 'BALANCE':
        result = { success: true, balance: await getBalance(wallet) };
        break;

      case 'GET_PRICES':
        const prices = await getPrices();
        result = { success: true, prices, source: 'gtrade-api' };
        break;

      case 'OPEN_TRADE':
        result = await openManualTrade(trading, wallet, body);
        break;

      case 'CLOSE_TRADE':
        result = await closePosition(trading, wallet, body.tradeIndex);
        break;

      // NEW: Pending order / collateral claim actions
      case 'GET_PENDING':
        result = { success: true, pendingOrders: await getPendingOrders(trading, wallet) };
        break;

      case 'CLAIM_COLLATERAL':
        result = await claimCollateral(trading, wallet, body.orderId, body.isLimitOrder);
        break;

      case 'AUTO_CLAIM_ALL':
        result = await autoClaimAll(trading, wallet);
        break;

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
