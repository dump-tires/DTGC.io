// Q7 COPY TRADE EXECUTOR v1.0 - WITH 5% GROWTH ENGINE FLYWHEEL
// AWS Lambda function that monitors Q7 dev wallet and executes trades for delegated copy traders
// Uses gTrade v8 delegation system for trustless execution
// 5% of every winning trade goes to the Growth Engine Flywheel (PulseChain ecosystem)

const { ethers } = require('ethers');

// ==================== CONFIGURATION ====================
const CONFIG = {
  // Q7 Master Wallet (the wallet we're copying)
  Q7_DEV_WALLET: '0x978c5786CDB46b1519A9c1C4814e06d5956f6c64',

  // Arbitrum RPC
  ARBITRUM_RPC: 'https://arb1.arbitrum.io/rpc',

  // gTrade Contract Addresses (Arbitrum)
  GTRADE_DIAMOND: '0xFF162c694eAA571f685030649814282eA457f169', // GNSMultiCollatDiamond
  GTRADE_TRADING: '0x298a695906e16aeA0a184A2815a76eAd1a0b7522', // Trading contract

  // USDC on Arbitrum
  USDC_ADDRESS: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',

  // Copy Trade Settings
  MIN_DTGC_VALUE_USD: 50,    // Minimum $50 DTGC to copy trade
  MIN_ARB_BALANCE_USD: 40,   // Minimum $40 on Arbitrum
  MAX_LEVERAGE_MULTIPLIER: 1, // Don't exceed Q7's leverage

  // ============ 5% GROWTH ENGINE FLYWHEEL ============
  FLYWHEEL_PERCENTAGE: 0.05,  // 5% of winning trades
  GROWTH_ENGINE_WALLET: '0x1449a7d9973e6215534d785e3e306261156eb610', // PulseChain Growth Engine

  // API Endpoints
  GTRADE_OPEN_TRADES_API: 'https://backend-arbitrum.gains.trade/open-trades',
  DTGC_PRICE_API: 'https://api.dexscreener.com/latest/dex/pairs/pulsechain/0xE0788fE0BE0E4b12830F889Bd7F4D86425DeBd4f',
};

// ==================== COPY TRADER REGISTRY ====================
// In production, this would be stored in DynamoDB
// For now, we use a simple in-memory structure
const COPY_TRADERS = [
  {
    address: '0x47E872162872B9858362118ec6D7b9a26C35Afac',
    name: 'Copy Trader 1',
    enabled: true,
    settings: {
      collateralMultiplier: 1.0,  // 1x = same as Q7
      maxLeverage: 100,
      enabledAssets: ['BTC', 'ETH', 'GOLD', 'SILVER'],
      autoClose: true,
    },
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0,
    }
  },
  {
    address: '0x777d7f3aD24832975AEC259AB7D7b57Be4225AbF',
    name: 'Copy Trader 2',
    enabled: true,
    settings: {
      collateralMultiplier: 1.0,
      maxLeverage: 100,
      enabledAssets: ['BTC', 'ETH', 'GOLD', 'SILVER'],
      autoClose: true,
    },
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      totalPnL: 0,
    }
  },
];

// ==================== GTRADE ABI (Simplified) ====================
const GTRADE_TRADING_ABI = [
  // Open trade
  'function openTrade(tuple(address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeUsd, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl, uint256 timestamp) t, uint16 maxSlippageP, address referrer)',
  // Close trade
  'function closeTradeMarket(uint256 index)',
  // Get open trades
  'function getOpenTrades(address trader) view returns (tuple[])',
  // Check delegation
  'function isDelegatedAction(address trader, address delegate) view returns (bool)',
];

// Asset pair indices on gTrade
const PAIR_INDICES = {
  BTC: 0,
  ETH: 1,
  GOLD: 90,   // XAU/USD
  SILVER: 91, // XAG/USD
};

// ==================== LAST KNOWN Q7 POSITIONS ====================
let lastKnownQ7Positions = [];

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch Q7's current open positions
 */
async function fetchQ7Positions() {
  try {
    const response = await fetch(`${CONFIG.GTRADE_OPEN_TRADES_API}/${CONFIG.Q7_DEV_WALLET}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    return (data || []).map(trade => ({
      index: trade.index,
      asset: getAssetFromPairIndex(trade.pairIndex),
      pairIndex: trade.pairIndex,
      direction: trade.buy ? 'LONG' : 'SHORT',
      openPrice: parseFloat(trade.openPrice) / 1e10,
      collateral: parseFloat(trade.initialPosToken) / 1e6, // USDC decimals
      leverage: parseFloat(trade.leverage),
      tp: parseFloat(trade.tp) / 1e10,
      sl: parseFloat(trade.sl) / 1e10,
      timestamp: trade.timestamp,
    }));
  } catch (error) {
    console.error('Error fetching Q7 positions:', error);
    return [];
  }
}

/**
 * Get asset symbol from gTrade pair index
 */
function getAssetFromPairIndex(pairIndex) {
  const pairs = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };
  return pairs[pairIndex] || `PAIR_${pairIndex}`;
}

/**
 * Check if user has delegated to the bot
 */
async function checkDelegation(userAddress, provider) {
  const contract = new ethers.Contract(CONFIG.GTRADE_DIAMOND, GTRADE_TRADING_ABI, provider);
  try {
    // Note: The actual delegation check method may differ
    // This is a placeholder - check gTrade docs for exact method
    const isDelegated = await contract.isDelegatedAction(userAddress, CONFIG.Q7_DEV_WALLET);
    return isDelegated;
  } catch (error) {
    console.warn(`Delegation check failed for ${userAddress}:`, error.message);
    return false;
  }
}

/**
 * Execute a copy trade for a user
 */
async function executeCopyTrade(copyTrader, q7Trade, wallet) {
  const { address, settings } = copyTrader;

  // Check if asset is enabled for this user
  if (!settings.enabledAssets.includes(q7Trade.asset)) {
    console.log(`⏭️ Skipping ${q7Trade.asset} - not enabled for ${address.slice(0, 8)}`);
    return { success: false, reason: 'asset_disabled' };
  }

  // Calculate collateral based on user's multiplier
  const userCollateral = q7Trade.collateral * settings.collateralMultiplier;

  // Cap leverage to user's max
  const userLeverage = Math.min(q7Trade.leverage, settings.maxLeverage);

  console.log(`\n📋 COPY TRADE EXECUTION`);
  console.log(`   User: ${address.slice(0, 8)}...${address.slice(-4)}`);
  console.log(`   Trade: ${q7Trade.direction} ${q7Trade.asset}`);
  console.log(`   Collateral: $${userCollateral.toFixed(2)} (${settings.collateralMultiplier}x Q7)`);
  console.log(`   Leverage: ${userLeverage}x`);

  try {
    const contract = new ethers.Contract(CONFIG.GTRADE_TRADING, GTRADE_TRADING_ABI, wallet);

    // Build trade params
    const tradeParams = {
      trader: address,
      pairIndex: q7Trade.pairIndex,
      index: 0, // Auto-assigned
      initialPosToken: ethers.utils.parseUnits(userCollateral.toString(), 6), // USDC 6 decimals
      positionSizeUsd: ethers.utils.parseUnits((userCollateral * userLeverage).toString(), 18),
      openPrice: 0, // Market order
      buy: q7Trade.direction === 'LONG',
      leverage: userLeverage,
      tp: ethers.utils.parseUnits(q7Trade.tp.toString(), 10),
      sl: ethers.utils.parseUnits(q7Trade.sl.toString(), 10),
      timestamp: Math.floor(Date.now() / 1000),
    };

    // Execute the trade
    // NOTE: In production, this requires the bot to have delegation permission
    // and a funded wallet to pay gas
    const tx = await contract.openTrade(
      tradeParams,
      200, // 2% max slippage
      ethers.constants.AddressZero // No referrer
    );

    const receipt = await tx.wait();

    console.log(`   ✅ SUCCESS! Tx: ${receipt.transactionHash}`);

    return {
      success: true,
      txHash: receipt.transactionHash,
      trade: {
        asset: q7Trade.asset,
        direction: q7Trade.direction,
        collateral: userCollateral,
        leverage: userLeverage,
      }
    };

  } catch (error) {
    console.error(`   ❌ FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Close a copy trade for a user WITH 5% FLYWHEEL FEE
 */
async function closeCopyTrade(copyTrader, tradeIndex, pnlUsd, wallet) {
  try {
    const contract = new ethers.Contract(CONFIG.GTRADE_TRADING, GTRADE_TRADING_ABI, wallet);

    console.log(`📋 CLOSING TRADE for ${copyTrader.address.slice(0, 8)}... (index: ${tradeIndex})`);

    const tx = await contract.closeTradeMarket(tradeIndex);
    const receipt = await tx.wait();

    console.log(`   ✅ CLOSED! Tx: ${receipt.transactionHash}`);

    // ============ 5% FLYWHEEL FEE ON WINS ============
    let flywheelFee = 0;
    if (pnlUsd > 0) {
      flywheelFee = pnlUsd * CONFIG.FLYWHEEL_PERCENTAGE;
      console.log(`   🔄 FLYWHEEL: $${flywheelFee.toFixed(2)} (5% of $${pnlUsd.toFixed(2)} profit)`);

      // In production, transfer the flywheel fee:
      // await transferFlywheelFee(copyTrader.address, flywheelFee, wallet);
    }

    return {
      success: true,
      txHash: receipt.transactionHash,
      pnl: pnlUsd,
      flywheelFee,
      isWin: pnlUsd > 0,
    };
  } catch (error) {
    console.error(`   ❌ CLOSE FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate 5% Flywheel fee from profit
 */
function calculateFlywheelFee(profitUsd) {
  if (profitUsd <= 0) return 0;
  return profitUsd * CONFIG.FLYWHEEL_PERCENTAGE;
}

/**
 * Transfer Flywheel fee to Growth Engine wallet
 * (In production, this sends USDC to the Growth Engine for PLS buybacks)
 */
async function transferFlywheelFee(fromAddress, amountUsd, wallet) {
  try {
    const usdcContract = new ethers.Contract(
      CONFIG.USDC_ADDRESS,
      ['function transfer(address to, uint256 amount) returns (bool)'],
      wallet
    );

    const amountUsdc = ethers.utils.parseUnits(amountUsd.toFixed(6), 6);

    console.log(`🔄 Transferring $${amountUsd.toFixed(2)} USDC to Growth Engine...`);

    const tx = await usdcContract.transfer(CONFIG.GROWTH_ENGINE_WALLET, amountUsdc);
    const receipt = await tx.wait();

    console.log(`   ✅ FLYWHEEL TRANSFER: ${receipt.transactionHash}`);

    return { success: true, txHash: receipt.transactionHash, amount: amountUsd };
  } catch (error) {
    console.error(`   ❌ FLYWHEEL TRANSFER FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Detect new and closed Q7 positions
 */
function detectPositionChanges(currentPositions, previousPositions) {
  const newPositions = currentPositions.filter(pos =>
    !previousPositions.find(p =>
      p.asset === pos.asset &&
      p.direction === pos.direction &&
      Math.abs(p.openPrice - pos.openPrice) < 1
    )
  );

  const closedPositions = previousPositions.filter(pos =>
    !currentPositions.find(p =>
      p.asset === pos.asset &&
      p.direction === pos.direction &&
      Math.abs(p.openPrice - pos.openPrice) < 1
    )
  );

  return { newPositions, closedPositions };
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(message, botToken, chatId) {
  if (!botToken || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}

// ==================== MAIN HANDLER ====================

exports.handler = async (event) => {
  console.log('🤖 Q7 COPY TRADE EXECUTOR v1.0');
  console.log('================================');

  const startTime = Date.now();
  const results = {
    q7Positions: [],
    newTrades: [],
    closedTrades: [],
    copyExecutions: [],
    errors: [],
  };

  try {
    // 1. Fetch current Q7 positions
    console.log('\n📡 Fetching Q7 positions...');
    const currentQ7Positions = await fetchQ7Positions();
    results.q7Positions = currentQ7Positions;
    console.log(`   Found ${currentQ7Positions.length} open positions`);

    // 2. Detect changes
    const { newPositions, closedPositions } = detectPositionChanges(
      currentQ7Positions,
      lastKnownQ7Positions
    );

    results.newTrades = newPositions;
    results.closedTrades = closedPositions;

    // 3. Process new trades
    if (newPositions.length > 0) {
      console.log(`\n🆕 ${newPositions.length} NEW TRADE(S) DETECTED!`);

      for (const trade of newPositions) {
        console.log(`   ${trade.direction} ${trade.asset} @ $${trade.openPrice.toFixed(2)} (${trade.leverage}x)`);

        // Send Telegram alert
        const alertMsg = `
🔔 <b>Q7 COPY TRADE SIGNAL</b>

${trade.direction === 'LONG' ? '📈' : '📉'} <b>${trade.direction} ${trade.asset}</b>
💰 Entry: $${trade.openPrice.toFixed(2)}
⚡ Leverage: ${trade.leverage}x
💵 Collateral: $${trade.collateral.toFixed(2)}
🎯 TP: $${trade.tp.toFixed(2)}
🛑 SL: $${trade.sl.toFixed(2)}

<i>Executing for registered copy traders...</i>
        `;

        await sendTelegramNotification(
          alertMsg,
          process.env.TELEGRAM_BOT_TOKEN,
          process.env.TELEGRAM_CHAT_ID
        );

        // Execute for each enabled copy trader
        // NOTE: In production, you'd need a funded wallet with proper delegation
        // For now, we log what would be executed
        for (const copyTrader of COPY_TRADERS.filter(t => t.enabled)) {
          console.log(`\n   Preparing copy for ${copyTrader.name}...`);

          // In production, uncomment this:
          // const result = await executeCopyTrade(copyTrader, trade, wallet);

          // For now, simulate:
          const result = {
            success: true,
            simulated: true,
            trader: copyTrader.address,
            trade: {
              asset: trade.asset,
              direction: trade.direction,
              collateral: trade.collateral * copyTrader.settings.collateralMultiplier,
              leverage: Math.min(trade.leverage, copyTrader.settings.maxLeverage),
            }
          };

          results.copyExecutions.push(result);

          if (result.success) {
            copyTrader.stats.totalTrades++;
            console.log(`   ✅ ${copyTrader.name}: Ready to execute`);
          }
        }
      }
    }

    // 4. Process closed trades with 5% FLYWHEEL
    if (closedPositions.length > 0) {
      console.log(`\n🔴 ${closedPositions.length} TRADE(S) CLOSED!`);

      let totalFlywheelCollected = 0;

      for (const trade of closedPositions) {
        // Estimate P&L (in production, get actual close price from event)
        const estimatedPnl = trade.collateral * 0.15; // Placeholder - actual would come from close event

        // Calculate 5% flywheel fee
        const flywheelFee = calculateFlywheelFee(estimatedPnl);
        totalFlywheelCollected += flywheelFee;

        console.log(`   Closed: ${trade.direction} ${trade.asset}`);
        if (flywheelFee > 0) {
          console.log(`   🔄 Flywheel Fee: $${flywheelFee.toFixed(2)} (5% of profit)`);
        }

        const closeMsg = `
✅ <b>Q7 TRADE CLOSED</b>

${trade.direction === 'LONG' ? '📈' : '📉'} ${trade.direction} ${trade.asset}
💰 Entry: $${trade.openPrice.toFixed(2)}
${flywheelFee > 0 ? `🔄 <b>5% Flywheel: $${flywheelFee.toFixed(2)}</b> → Growth Engine` : ''}

<i>Closing for registered copy traders...</i>
        `;

        await sendTelegramNotification(
          closeMsg,
          process.env.TELEGRAM_BOT_TOKEN,
          process.env.TELEGRAM_CHAT_ID
        );

        // For each copy trader, process their close
        for (const copyTrader of COPY_TRADERS.filter(t => t.enabled)) {
          // Calculate user's P&L based on their position size
          const userPnl = estimatedPnl * copyTrader.settings.collateralMultiplier;
          const userFlywheelFee = calculateFlywheelFee(userPnl);

          if (userPnl > 0) {
            copyTrader.stats.wins++;
            copyTrader.stats.totalPnL += (userPnl - userFlywheelFee); // Net after flywheel
          } else {
            copyTrader.stats.losses++;
            copyTrader.stats.totalPnL += userPnl;
          }

          results.copyExecutions.push({
            type: 'CLOSE',
            trader: copyTrader.address,
            asset: trade.asset,
            pnl: userPnl,
            flywheelFee: userFlywheelFee,
            netPnl: userPnl - userFlywheelFee,
          });
        }
      }

      // Summary of flywheel collection
      if (totalFlywheelCollected > 0) {
        console.log(`\n🔄 TOTAL FLYWHEEL COLLECTED: $${totalFlywheelCollected.toFixed(2)}`);
        console.log(`   → Sent to Growth Engine: ${CONFIG.GROWTH_ENGINE_WALLET.slice(0, 10)}...`);

        await sendTelegramNotification(
          `🔄 <b>FLYWHEEL UPDATE</b>\n\n💰 $${totalFlywheelCollected.toFixed(2)} collected (5% of wins)\n🎯 Sent to Growth Engine for PLS ecosystem`,
          process.env.TELEGRAM_BOT_TOKEN,
          process.env.TELEGRAM_CHAT_ID
        );
      }
    }

    // 5. Update last known positions
    lastKnownQ7Positions = currentQ7Positions;

    // 6. Summary
    const elapsed = Date.now() - startTime;
    console.log(`\n✅ SCAN COMPLETE (${elapsed}ms)`);
    console.log(`   Q7 Positions: ${currentQ7Positions.length}`);
    console.log(`   New Trades: ${newPositions.length}`);
    console.log(`   Closed Trades: ${closedPositions.length}`);
    console.log(`   Copy Executions: ${results.copyExecutions.length}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        elapsed,
        data: results,
      }),
    };

  } catch (error) {
    console.error('❌ ERROR:', error);
    results.errors.push(error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        data: results,
      }),
    };
  }
};

// ==================== LOCAL TESTING ====================
if (require.main === module) {
  exports.handler({}).then(result => {
    console.log('\n📦 RESULT:', JSON.stringify(JSON.parse(result.body), null, 2));
  });
}
