// Q7 COPY TRADE SERVER v2.0 - TRUE AUTO-EXECUTION
// Hetzner server that monitors Q7 wallet and executes trades for delegated users
// Single-click activation: User delegates once, bot trades forever

const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ==================== CONFIGURATION ====================
const CONFIG = {
  PORT: process.env.PORT || 3001,

  // Q7 Master Wallet (wallet we're copying)
  Q7_DEV_WALLET: '0x978c5786CDB46b1519A9c1C4814e06d5956f6c64',

  // Bot Executor Wallet - This wallet executes trades on behalf of delegated users
  // Users delegate to this address, bot uses private key to sign
  BOT_EXECUTOR_ADDRESS: process.env.BOT_EXECUTOR_ADDRESS || '0x0000000000000000000000000000000000000000',
  BOT_EXECUTOR_PRIVATE_KEY: process.env.BOT_EXECUTOR_PRIVATE_KEY || '',

  // Arbitrum RPC
  ARBITRUM_RPC: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',

  // gTrade Contract Addresses (Arbitrum) - v8
  GTRADE_DIAMOND: '0xFF162c694eAA571f685030649814282eA457f169',
  GTRADE_TRADING: '0x298a695906e16aeA0a184A2815a76eAd1a0b7522',

  // USDC on Arbitrum
  USDC_ADDRESS: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',

  // Copy Trade Settings
  MIN_DTGC_VALUE_USD: 50,
  MIN_ARB_BALANCE_USD: 40,
  SCAN_INTERVAL_MS: 30000, // 30 seconds

  // 5% Growth Engine Flywheel
  FLYWHEEL_PERCENTAGE: 0.05,
  GROWTH_ENGINE_WALLET: '0x1449a7d9973e6215534d785e3e306261156eb610',

  // API
  GTRADE_OPEN_TRADES_API: 'https://backend-arbitrum.gains.trade/open-trades',

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
};

// ==================== GTRADE ABI ====================
const GTRADE_DELEGATION_ABI = [
  // Check if user has delegated to an address
  'function delegations(address trader, address delegate) view returns (bool)',
  // User calls this to delegate/undelegate
  'function setTradingDelegate(address delegate, bool enable)',
];

const GTRADE_TRADING_ABI = [
  // Open trade (delegated)
  'function openTrade((address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeUsd, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl, uint256 timestamp) t, uint16 maxSlippageP, address referrer)',
  // Close trade (delegated)
  'function closeTradeMarket(uint256 orderType, uint256 index)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// ==================== STATE ====================
const DATA_FILE = './copy-traders.json';

// Load registered copy traders from disk
function loadCopyTraders() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading copy traders:', e);
  }
  return {};
}

// Save copy traders to disk
function saveCopyTraders(traders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(traders, null, 2));
}

let copyTraders = loadCopyTraders();
let lastKnownQ7Positions = [];
let isScanning = false;

// ==================== PROVIDER & WALLET ====================
// Using ethers v5 syntax for compatibility
const provider = new ethers.providers.JsonRpcProvider(CONFIG.ARBITRUM_RPC);
let executorWallet = null;

if (CONFIG.BOT_EXECUTOR_PRIVATE_KEY) {
  executorWallet = new ethers.Wallet(CONFIG.BOT_EXECUTOR_PRIVATE_KEY, provider);
  console.log(`🤖 Bot Executor Wallet: ${executorWallet.address}`);
}

// ==================== HELPER FUNCTIONS ====================

const PAIR_INDICES = { BTC: 0, ETH: 1, GOLD: 90, SILVER: 91 };
const PAIR_NAMES = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };

async function fetchQ7Positions() {
  try {
    const response = await fetch(`${CONFIG.GTRADE_OPEN_TRADES_API}/${CONFIG.Q7_DEV_WALLET}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    return (data || []).map(trade => ({
      index: trade.index,
      asset: PAIR_NAMES[trade.pairIndex] || `PAIR_${trade.pairIndex}`,
      pairIndex: trade.pairIndex,
      direction: trade.buy ? 'LONG' : 'SHORT',
      buy: trade.buy,
      openPrice: parseFloat(trade.openPrice) / 1e10,
      collateral: parseFloat(trade.initialPosToken) / 1e6,
      leverage: parseFloat(trade.leverage),
      tp: parseFloat(trade.tp) / 1e10,
      sl: parseFloat(trade.sl) / 1e10,
      positionSizeUsd: parseFloat(trade.positionSizeUsd || 0) / 1e18,
      timestamp: trade.timestamp,
    }));
  } catch (error) {
    console.error('Error fetching Q7 positions:', error.message);
    return [];
  }
}

async function checkDelegation(userAddress) {
  try {
    const contract = new ethers.Contract(CONFIG.GTRADE_DIAMOND, GTRADE_DELEGATION_ABI, provider);
    const isDelegated = await contract.delegations(userAddress, CONFIG.BOT_EXECUTOR_ADDRESS);
    return isDelegated;
  } catch (error) {
    console.error(`Delegation check failed for ${userAddress}:`, error.message);
    return false;
  }
}

async function executeCopyTrade(trader, q7Trade) {
  if (!executorWallet) {
    console.error('❌ No executor wallet configured');
    return { success: false, error: 'No executor wallet' };
  }

  const { address, settings } = trader;

  // Check if asset is enabled
  if (settings.enabledAssets && !settings.enabledAssets.includes(q7Trade.asset)) {
    console.log(`⏭️ Skipping ${q7Trade.asset} - not enabled for ${address.slice(0, 8)}`);
    return { success: false, reason: 'asset_disabled' };
  }

  // Calculate collateral based on user's multiplier
  const userCollateral = q7Trade.collateral * (settings.collateralMultiplier || 1.0);
  const userLeverage = Math.min(q7Trade.leverage, settings.maxLeverage || 100);

  console.log(`\n📋 EXECUTING COPY TRADE`);
  console.log(`   User: ${address.slice(0, 8)}...${address.slice(-4)}`);
  console.log(`   Trade: ${q7Trade.direction} ${q7Trade.asset}`);
  console.log(`   Collateral: $${userCollateral.toFixed(2)}`);
  console.log(`   Leverage: ${userLeverage}x`);

  try {
    const tradingContract = new ethers.Contract(CONFIG.GTRADE_TRADING, GTRADE_TRADING_ABI, executorWallet);

    // Build trade params for delegated execution (ethers v5 syntax)
    const tradeParams = {
      trader: address, // User's address (we're executing on their behalf)
      pairIndex: q7Trade.pairIndex,
      index: 0,
      initialPosToken: ethers.utils.parseUnits(userCollateral.toFixed(6), 6),
      positionSizeUsd: ethers.utils.parseUnits((userCollateral * userLeverage).toFixed(18), 18),
      openPrice: 0, // Market order
      buy: q7Trade.direction === 'LONG',
      leverage: userLeverage,
      tp: ethers.utils.parseUnits(q7Trade.tp.toFixed(10), 10),
      sl: ethers.utils.parseUnits(q7Trade.sl.toFixed(10), 10),
      timestamp: Math.floor(Date.now() / 1000),
    };

    const tx = await tradingContract.openTrade(
      tradeParams,
      200, // 2% max slippage
      ethers.constants.AddressZero
    );

    console.log(`   ⏳ Tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`   ✅ SUCCESS! Block: ${receipt.blockNumber}`);

    // Update trader stats
    trader.stats = trader.stats || { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 };
    trader.stats.totalTrades++;
    trader.lastTrade = { asset: q7Trade.asset, direction: q7Trade.direction, time: Date.now() };
    saveCopyTraders(copyTraders);

    return { success: true, txHash: tx.hash, trade: { asset: q7Trade.asset, direction: q7Trade.direction, collateral: userCollateral, leverage: userLeverage } };

  } catch (error) {
    console.error(`   ❌ FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function closeCopyTrade(trader, tradeIndex, pnlUsd = 0) {
  if (!executorWallet) {
    return { success: false, error: 'No executor wallet' };
  }

  try {
    const tradingContract = new ethers.Contract(CONFIG.GTRADE_TRADING, GTRADE_TRADING_ABI, executorWallet);

    console.log(`📋 CLOSING TRADE for ${trader.address.slice(0, 8)}... (index: ${tradeIndex})`);

    const tx = await tradingContract.closeTradeMarket(0, tradeIndex); // orderType 0 = market
    const receipt = await tx.wait();

    console.log(`   ✅ CLOSED! Block: ${receipt.blockNumber}`);

    // Calculate 5% flywheel fee on wins
    let flywheelFee = 0;
    if (pnlUsd > 0) {
      flywheelFee = pnlUsd * CONFIG.FLYWHEEL_PERCENTAGE;
      console.log(`   🔄 FLYWHEEL: $${flywheelFee.toFixed(2)} (5% of $${pnlUsd.toFixed(2)} profit)`);

      // Update stats
      trader.stats = trader.stats || { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 };
      trader.stats.wins++;
      trader.stats.totalPnL += (pnlUsd - flywheelFee);
    } else {
      trader.stats = trader.stats || { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 };
      trader.stats.losses++;
      trader.stats.totalPnL += pnlUsd;
    }

    saveCopyTraders(copyTraders);

    return { success: true, txHash: tx.hash, pnl: pnlUsd, flywheelFee, isWin: pnlUsd > 0 };

  } catch (error) {
    console.error(`   ❌ CLOSE FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function detectPositionChanges(current, previous) {
  const newPositions = current.filter(pos =>
    !previous.find(p => p.index === pos.index && p.pairIndex === pos.pairIndex)
  );

  const closedPositions = previous.filter(pos =>
    !current.find(p => p.index === pos.index && p.pairIndex === pos.pairIndex)
  );

  return { newPositions, closedPositions };
}

async function sendTelegramNotification(message) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) return;

  try {
    await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Telegram failed:', error.message);
  }
}

// ==================== MAIN SCAN LOOP ====================
async function scanAndExecute() {
  if (isScanning) return;
  isScanning = true;

  try {
    const timestamp = new Date().toISOString();
    console.log(`\n🔍 [${timestamp}] Scanning Q7 positions...`);

    // 1. Fetch current Q7 positions
    const currentPositions = await fetchQ7Positions();
    console.log(`   Found ${currentPositions.length} Q7 positions`);

    // 2. Detect changes
    const { newPositions, closedPositions } = detectPositionChanges(currentPositions, lastKnownQ7Positions);

    // 3. Get active copy traders (enabled + delegated)
    const activeTradersArray = Object.values(copyTraders).filter(t => t.enabled && t.delegated);
    console.log(`   Active copy traders: ${activeTradersArray.length}`);

    // 4. Process NEW trades
    if (newPositions.length > 0) {
      console.log(`\n🆕 ${newPositions.length} NEW TRADE(S) DETECTED!`);

      for (const trade of newPositions) {
        console.log(`   ${trade.direction} ${trade.asset} @ $${trade.openPrice.toFixed(2)} (${trade.leverage}x)`);

        await sendTelegramNotification(`
🔔 <b>Q7 COPY TRADE SIGNAL</b>

${trade.direction === 'LONG' ? '📈' : '📉'} <b>${trade.direction} ${trade.asset}</b>
💰 Entry: $${trade.openPrice.toFixed(2)}
⚡ Leverage: ${trade.leverage}x
💵 Collateral: $${trade.collateral.toFixed(2)}

Executing for ${activeTradersArray.length} copy traders...
        `);

        // Execute for each delegated copy trader
        for (const trader of activeTradersArray) {
          const result = await executeCopyTrade(trader, trade);

          if (result.success) {
            await sendTelegramNotification(`✅ Copied for ${trader.address.slice(0,8)}...\nTx: ${result.txHash?.slice(0,20)}...`);
          }
        }
      }
    }

    // 5. Process CLOSED trades
    if (closedPositions.length > 0) {
      console.log(`\n🔴 ${closedPositions.length} TRADE(S) CLOSED!`);

      for (const trade of closedPositions) {
        await sendTelegramNotification(`
✅ <b>Q7 TRADE CLOSED</b>

${trade.direction === 'LONG' ? '📈' : '📉'} ${trade.direction} ${trade.asset}
💰 Entry: $${trade.openPrice.toFixed(2)}

Closing for ${activeTradersArray.length} copy traders...
        `);

        // Close for each copy trader
        // Note: In production, you'd need to track which trades each user has open
      }
    }

    // 6. Update last known positions
    lastKnownQ7Positions = currentPositions;

  } catch (error) {
    console.error('Scan error:', error.message);
  } finally {
    isScanning = false;
  }
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'live',
    version: '2.0',
    botExecutor: CONFIG.BOT_EXECUTOR_ADDRESS,
    activeCopyTraders: Object.values(copyTraders).filter(t => t.enabled && t.delegated).length,
    totalRegistered: Object.keys(copyTraders).length,
    lastScan: lastKnownQ7Positions.length > 0 ? 'Active' : 'Pending',
    q7Positions: lastKnownQ7Positions.length,
  });
});

// Get bot info (for frontend to display)
app.get('/api/bot-info', (req, res) => {
  res.json({
    botExecutorAddress: CONFIG.BOT_EXECUTOR_ADDRESS,
    delegationContract: CONFIG.GTRADE_DIAMOND,
    network: 'arbitrum',
    chainId: 42161,
    minDtgcUsd: CONFIG.MIN_DTGC_VALUE_USD,
    minArbUsd: CONFIG.MIN_ARB_BALANCE_USD,
    flywheelPercentage: CONFIG.FLYWHEEL_PERCENTAGE * 100,
    growthEngineWallet: CONFIG.GROWTH_ENGINE_WALLET,
    q7DevWallet: CONFIG.Q7_DEV_WALLET,
  });
});

// Register as copy trader
app.post('/api/register-copy-trader', async (req, res) => {
  try {
    const { address, dtgcBalance, arbBalance, signature } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const normalizedAddress = address.toLowerCase();

    // Check if already registered
    if (copyTraders[normalizedAddress]) {
      console.log(`📝 Updating registration for ${address.slice(0, 8)}...`);
    } else {
      console.log(`🆕 New registration: ${address.slice(0, 8)}...`);
    }

    // Check delegation status
    const isDelegated = await checkDelegation(address);

    copyTraders[normalizedAddress] = {
      address: address,
      enabled: true,
      delegated: isDelegated,
      registeredAt: copyTraders[normalizedAddress]?.registeredAt || Date.now(),
      lastUpdate: Date.now(),
      dtgcBalance: dtgcBalance || 0,
      arbBalance: arbBalance || 0,
      settings: copyTraders[normalizedAddress]?.settings || {
        collateralMultiplier: 1.0,
        maxLeverage: 100,
        enabledAssets: ['BTC', 'ETH', 'GOLD', 'SILVER'],
      },
      stats: copyTraders[normalizedAddress]?.stats || {
        totalTrades: 0,
        wins: 0,
        losses: 0,
        totalPnL: 0,
      },
    };

    saveCopyTraders(copyTraders);

    res.json({
      success: true,
      message: isDelegated ? 'Registered and delegated - AUTO TRADING ACTIVE' : 'Registered - delegation required',
      trader: {
        address,
        enabled: true,
        delegated: isDelegated,
        status: isDelegated ? 'ACTIVE' : 'PENDING_DELEGATION',
      },
      botExecutorAddress: CONFIG.BOT_EXECUTOR_ADDRESS,
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check delegation status
app.get('/api/check-delegation/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const isDelegated = await checkDelegation(address);

    // Update stored status
    const normalizedAddress = address.toLowerCase();
    if (copyTraders[normalizedAddress]) {
      copyTraders[normalizedAddress].delegated = isDelegated;
      copyTraders[normalizedAddress].lastUpdate = Date.now();
      saveCopyTraders(copyTraders);
    }

    res.json({
      address,
      delegated: isDelegated,
      status: isDelegated ? 'ACTIVE' : 'PENDING_DELEGATION',
      botExecutorAddress: CONFIG.BOT_EXECUTOR_ADDRESS,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get copy trader status
app.get('/api/copy-trader/:address', (req, res) => {
  const { address } = req.params;
  const trader = copyTraders[address.toLowerCase()];

  if (!trader) {
    return res.json({ registered: false, status: 'NOT_REGISTERED' });
  }

  res.json({
    registered: true,
    ...trader,
    status: trader.delegated ? 'ACTIVE' : 'PENDING_DELEGATION',
  });
});

// Disable copy trading
app.post('/api/disable-copy-trader', (req, res) => {
  try {
    const { address } = req.body;
    const normalizedAddress = address.toLowerCase();

    if (copyTraders[normalizedAddress]) {
      copyTraders[normalizedAddress].enabled = false;
      copyTraders[normalizedAddress].lastUpdate = Date.now();
      saveCopyTraders(copyTraders);
    }

    res.json({ success: true, message: 'Copy trading disabled' });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Q7 positions
app.get('/api/q7-positions', (req, res) => {
  res.json({
    positions: lastKnownQ7Positions,
    count: lastKnownQ7Positions.length,
    lastUpdate: new Date().toISOString(),
  });
});

// Get all copy traders (admin)
app.get('/api/copy-traders', (req, res) => {
  const traders = Object.values(copyTraders).map(t => ({
    address: t.address,
    enabled: t.enabled,
    delegated: t.delegated,
    status: t.enabled && t.delegated ? 'ACTIVE' : t.enabled ? 'PENDING' : 'DISABLED',
    stats: t.stats,
    lastTrade: t.lastTrade,
  }));

  res.json({
    total: traders.length,
    active: traders.filter(t => t.status === 'ACTIVE').length,
    pending: traders.filter(t => t.status === 'PENDING').length,
    traders,
  });
});

// ==================== START SERVER ====================
app.listen(CONFIG.PORT, () => {
  console.log(`\n🚀 Q7 COPY TRADE SERVER v2.0`);
  console.log(`   Port: ${CONFIG.PORT}`);
  console.log(`   Bot Executor: ${CONFIG.BOT_EXECUTOR_ADDRESS}`);
  console.log(`   Q7 Dev Wallet: ${CONFIG.Q7_DEV_WALLET}`);
  console.log(`   Scan Interval: ${CONFIG.SCAN_INTERVAL_MS / 1000}s`);
  console.log(`   Flywheel: ${CONFIG.FLYWHEEL_PERCENTAGE * 100}% to Growth Engine`);
  console.log(`\n📡 API Endpoints:`);
  console.log(`   GET  /health`);
  console.log(`   GET  /api/bot-info`);
  console.log(`   POST /api/register-copy-trader`);
  console.log(`   GET  /api/check-delegation/:address`);
  console.log(`   GET  /api/copy-trader/:address`);
  console.log(`   POST /api/disable-copy-trader`);
  console.log(`   GET  /api/q7-positions`);
  console.log(`   GET  /api/copy-traders`);
  console.log(`\n🔍 Starting position scanner...`);

  // Initial scan
  scanAndExecute();

  // Start periodic scanning
  setInterval(scanAndExecute, CONFIG.SCAN_INTERVAL_MS);
});
