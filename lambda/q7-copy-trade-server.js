// Q7 COPY TRADE SERVER v2.1 - TRUE AUTO-EXECUTION
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

  // Bot Executor Wallet
  BOT_EXECUTOR_ADDRESS: process.env.BOT_EXECUTOR_ADDRESS || '0x0000000000000000000000000000000000000000',
  BOT_EXECUTOR_PRIVATE_KEY: process.env.BOT_EXECUTOR_PRIVATE_KEY || '',

  // Arbitrum RPC
  ARBITRUM_RPC: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',

  // gTrade Contract Addresses (Arbitrum)
  GTRADE_DIAMOND: '0xFF162c694eAA571f685030649814282eA457f169',
  GTRADE_TRADING: '0x298a695906e16aeA0a184A2815a76eAd1a0b7522',

  // USDC on Arbitrum
  USDC_ADDRESS: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',

  // Copy Trade Settings
  MIN_DTGC_VALUE_USD: 50,
  MIN_ARB_BALANCE_USD: 40,
  SCAN_INTERVAL_MS: 30000,

  // 5% Growth Engine Flywheel
  FLYWHEEL_PERCENTAGE: 0.05,
  GROWTH_ENGINE_WALLET: '0x1449a7d9973e6215534d785e3e306261156eb610',

  // API - gTrade v9/v10 endpoint
  GTRADE_OPEN_TRADES_API: 'https://backend-arbitrum.gains.trade/trading-variables',

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',
};

// ==================== GTRADE ABI ====================
const GTRADE_DELEGATION_ABI = [
  'function delegations(address trader, address delegate) view returns (bool)',
  'function setTradingDelegate(address delegate, bool enable)',
];

const GTRADE_TRADING_ABI = [
  'function openTrade((address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeUsd, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl, uint256 timestamp) t, uint16 maxSlippageP, address referrer)',
  'function closeTradeMarket(uint256 orderType, uint256 index)',
];

// ==================== STATE ====================
const DATA_FILE = './copy-traders.json';

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

function saveCopyTraders(traders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(traders, null, 2));
}

let copyTraders = loadCopyTraders();
let lastKnownQ7Positions = [];
let isScanning = false;

// ==================== PROVIDER & WALLET ====================
const provider = new ethers.providers.JsonRpcProvider(CONFIG.ARBITRUM_RPC);
let executorWallet = null;

if (CONFIG.BOT_EXECUTOR_PRIVATE_KEY) {
  executorWallet = new ethers.Wallet(CONFIG.BOT_EXECUTOR_PRIVATE_KEY, provider);
  console.log(`🤖 Bot Executor Wallet: ${executorWallet.address}`);
}

// ==================== PAIR MAPPINGS ====================
// gTrade v9/v10 pair indices (Arbitrum)
const PAIR_NAMES = {
  0: 'BTC/USD', 1: 'ETH/USD', 2: 'LINK/USD', 3: 'DOGE/USD',
  4: 'MATIC/USD', 5: 'ADA/USD', 6: 'SUSHI/USD', 7: 'AAVE/USD',
  8: 'ALGO/USD', 9: 'BAL/USD', 10: 'COMP/USD', 11: 'ATOM/USD',
  21: 'EUR/USD', 22: 'GBP/USD', 23: 'AUD/USD', 24: 'NZD/USD',
  31: 'XAU/USD', 32: 'XAG/USD',
  // Commodities (newer indices)
  90: 'XAU/USD', // Gold
  91: 'XAG/USD', // Silver
};

function getPairName(pairIndex) {
  const name = PAIR_NAMES[pairIndex];
  if (name) return name.replace('/USD', '');
  return `PAIR_${pairIndex}`;
}

// ==================== FETCH Q7 POSITIONS ====================
async function fetchQ7Positions() {
  try {
    // Try the direct open-trades endpoint first
    const url = `https://backend-arbitrum.gains.trade/open-trades/${CONFIG.Q7_DEV_WALLET}`;
    console.log(`   Fetching: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Q7-Copy-Trade-Bot/2.1'
      }
    });

    if (!response.ok) {
      console.error(`   API returned ${response.status}`);
      return [];
    }

    const rawData = await response.json();

    // Log raw structure once for debugging
    if (rawData && rawData.length > 0 && !fetchQ7Positions.debugged) {
      console.log('\n📊 RAW API RESPONSE (first item):');
      console.log(JSON.stringify(rawData[0], null, 2));
      fetchQ7Positions.debugged = true;
    }

    if (!rawData || !Array.isArray(rawData)) {
      console.log('   No positions array returned');
      return [];
    }

    // Parse positions - gTrade v9/v10 format
    const positions = rawData.map((item, idx) => {
      try {
        // gTrade returns: { trade: {...}, tradeInfo: {...} }
        const t = item.trade || item;

        const pairIndex = parseInt(t.pairIndex || 0);
        // Direction: gTrade uses "long" field (true/false)
        const isLong = t.long === true;

        // Parse numeric values
        // openPrice: stored with 1e10 precision (e.g., 49204714489732 = $4920.47)
        const openPrice = parseFloat(t.openPrice || '0') / 1e10;
        // leverage: stored as leverage * 1000 (e.g., 10000 = 10x, 100000 = 100x)
        const leverage = parseFloat(t.leverage || '1000') / 1000;
        // collateral: collateralAmount in USDC (6 decimals)
        const collateral = parseFloat(t.collateralAmount || '0') / 1e6;
        // TP/SL: stored with 1e10 precision
        const tp = parseFloat(t.tp || '0') / 1e10;
        const sl = parseFloat(t.sl || '0') / 1e10;

        return {
          index: parseInt(t.index || idx),
          pairIndex: pairIndex,
          asset: getPairName(pairIndex),
          direction: isLong ? 'LONG' : 'SHORT',
          buy: isLong,
          openPrice: openPrice,
          collateral: collateral,
          leverage: leverage,
          tp: tp,
          sl: sl,
          timestamp: parseInt(t.createdBlock || Date.now() / 1000),
        };
      } catch (parseErr) {
        console.error(`   Error parsing position ${idx}:`, parseErr.message);
        return null;
      }
    }).filter(p => p !== null);

    return positions;

  } catch (error) {
    console.error('Error fetching Q7 positions:', error.message);
    return [];
  }
}

// ==================== DELEGATION CHECK ====================
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

// ==================== EXECUTE COPY TRADE ====================
async function executeCopyTrade(trader, q7Trade) {
  if (!executorWallet) {
    console.error('❌ No executor wallet configured');
    return { success: false, error: 'No executor wallet' };
  }

  const { address, settings } = trader;
  const userCollateral = q7Trade.collateral * (settings?.collateralMultiplier || 1.0);
  const userLeverage = Math.min(q7Trade.leverage, settings?.maxLeverage || 100);

  console.log(`\n📋 EXECUTING COPY TRADE`);
  console.log(`   User: ${address.slice(0, 8)}...${address.slice(-4)}`);
  console.log(`   Trade: ${q7Trade.direction} ${q7Trade.asset}`);
  console.log(`   Collateral: $${userCollateral.toFixed(2)}`);
  console.log(`   Leverage: ${userLeverage}x`);

  try {
    const tradingContract = new ethers.Contract(CONFIG.GTRADE_TRADING, GTRADE_TRADING_ABI, executorWallet);

    const tradeParams = {
      trader: address,
      pairIndex: q7Trade.pairIndex,
      index: 0,
      initialPosToken: ethers.utils.parseUnits(userCollateral.toFixed(6), 6),
      positionSizeUsd: ethers.utils.parseUnits((userCollateral * userLeverage).toFixed(18), 18),
      openPrice: 0,
      buy: q7Trade.direction === 'LONG',
      leverage: userLeverage,
      tp: ethers.utils.parseUnits((q7Trade.tp || 0).toFixed(10), 10),
      sl: ethers.utils.parseUnits((q7Trade.sl || 0).toFixed(10), 10),
      timestamp: Math.floor(Date.now() / 1000),
    };

    const tx = await tradingContract.openTrade(tradeParams, 200, ethers.constants.AddressZero);
    console.log(`   ⏳ Tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`   ✅ SUCCESS! Block: ${receipt.blockNumber}`);

    trader.stats = trader.stats || { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 };
    trader.stats.totalTrades++;
    trader.lastTrade = { asset: q7Trade.asset, direction: q7Trade.direction, time: Date.now() };
    saveCopyTraders(copyTraders);

    return { success: true, txHash: tx.hash };
  } catch (error) {
    console.error(`   ❌ FAILED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// ==================== POSITION CHANGE DETECTION ====================
function detectPositionChanges(current, previous) {
  const currentIds = new Set(current.map(p => `${p.pairIndex}-${p.index}-${p.direction}`));
  const previousIds = new Set(previous.map(p => `${p.pairIndex}-${p.index}-${p.direction}`));

  const newPositions = current.filter(p => !previousIds.has(`${p.pairIndex}-${p.index}-${p.direction}`));
  const closedPositions = previous.filter(p => !currentIds.has(`${p.pairIndex}-${p.index}-${p.direction}`));

  return { newPositions, closedPositions };
}

// ==================== TELEGRAM NOTIFICATION ====================
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

    const currentPositions = await fetchQ7Positions();
    console.log(`   Found ${currentPositions.length} Q7 positions`);

    // Show first few positions for verification
    if (currentPositions.length > 0) {
      console.log(`   Sample: ${currentPositions.slice(0, 3).map(p =>
        `${p.direction} ${p.asset} @$${p.openPrice?.toFixed(2) || 'N/A'} ${p.leverage}x`
      ).join(', ')}`);
    }

    const { newPositions, closedPositions } = detectPositionChanges(currentPositions, lastKnownQ7Positions);

    const activeTradersArray = Object.values(copyTraders).filter(t => t.enabled && t.delegated);
    console.log(`   Active copy traders: ${activeTradersArray.length}`);

    // Process NEW trades
    if (newPositions.length > 0 && newPositions.length < 10) { // Ignore if too many (likely initial load)
      console.log(`\n🆕 ${newPositions.length} NEW TRADE(S) DETECTED!`);

      for (const trade of newPositions) {
        console.log(`   ${trade.direction} ${trade.asset} @ $${trade.openPrice?.toFixed(2)} (${trade.leverage}x)`);

        await sendTelegramNotification(`
🔔 <b>Q7 COPY TRADE SIGNAL</b>

${trade.direction === 'LONG' ? '📈' : '📉'} <b>${trade.direction} ${trade.asset}</b>
💰 Entry: $${trade.openPrice?.toFixed(2)}
⚡ Leverage: ${trade.leverage}x
💵 Collateral: $${trade.collateral?.toFixed(2)}

Executing for ${activeTradersArray.length} copy traders...
        `);

        for (const trader of activeTradersArray) {
          const result = await executeCopyTrade(trader, trade);
          if (result.success) {
            await sendTelegramNotification(`✅ Copied for ${trader.address.slice(0,8)}...`);
          }
        }
      }
    }

    // Process CLOSED trades
    if (closedPositions.length > 0 && closedPositions.length < 10) {
      console.log(`\n🔴 ${closedPositions.length} TRADE(S) CLOSED!`);

      for (const trade of closedPositions) {
        await sendTelegramNotification(`
✅ <b>Q7 TRADE CLOSED</b>
${trade.direction === 'LONG' ? '📈' : '📉'} ${trade.direction} ${trade.asset}
        `);
      }
    }

    lastKnownQ7Positions = currentPositions;

  } catch (error) {
    console.error('Scan error:', error.message);
  } finally {
    isScanning = false;
  }
}

// ==================== API ENDPOINTS ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'live',
    version: '2.1',
    botExecutor: CONFIG.BOT_EXECUTOR_ADDRESS,
    activeCopyTraders: Object.values(copyTraders).filter(t => t.enabled && t.delegated).length,
    totalRegistered: Object.keys(copyTraders).length,
    q7Positions: lastKnownQ7Positions.length,
  });
});

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

app.post('/api/register-copy-trader', async (req, res) => {
  try {
    const { address, dtgcBalance, arbBalance } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const normalizedAddress = address.toLowerCase();
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
      },
      stats: copyTraders[normalizedAddress]?.stats || {
        totalTrades: 0, wins: 0, losses: 0, totalPnL: 0,
      },
    };

    saveCopyTraders(copyTraders);
    console.log(`📝 Registered: ${address.slice(0, 8)}... (delegated: ${isDelegated})`);

    res.json({
      success: true,
      message: isDelegated ? 'AUTO TRADING ACTIVE' : 'Registered - delegation required',
      trader: { address, enabled: true, delegated: isDelegated },
      botExecutorAddress: CONFIG.BOT_EXECUTOR_ADDRESS,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/check-delegation/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const isDelegated = await checkDelegation(address);

    const normalizedAddress = address.toLowerCase();
    if (copyTraders[normalizedAddress]) {
      copyTraders[normalizedAddress].delegated = isDelegated;
      saveCopyTraders(copyTraders);
    }

    res.json({ address, delegated: isDelegated, botExecutorAddress: CONFIG.BOT_EXECUTOR_ADDRESS });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/copy-trader/:address', (req, res) => {
  const trader = copyTraders[req.params.address.toLowerCase()];
  if (!trader) return res.json({ registered: false });
  res.json({ registered: true, ...trader });
});

app.post('/api/disable-copy-trader', (req, res) => {
  try {
    const { address } = req.body;
    const normalizedAddress = address.toLowerCase();
    if (copyTraders[normalizedAddress]) {
      copyTraders[normalizedAddress].enabled = false;
      saveCopyTraders(copyTraders);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/q7-positions', (req, res) => {
  res.json({ positions: lastKnownQ7Positions, count: lastKnownQ7Positions.length });
});

app.get('/api/copy-traders', (req, res) => {
  const traders = Object.values(copyTraders).map(t => ({
    address: t.address,
    enabled: t.enabled,
    delegated: t.delegated,
    status: t.enabled && t.delegated ? 'ACTIVE' : t.enabled ? 'PENDING' : 'DISABLED',
    stats: t.stats,
  }));
  res.json({ total: traders.length, active: traders.filter(t => t.status === 'ACTIVE').length, traders });
});

// ==================== START SERVER ====================
app.listen(CONFIG.PORT, () => {
  console.log(`\n🚀 Q7 COPY TRADE SERVER v2.1`);
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

  scanAndExecute();
  setInterval(scanAndExecute, CONFIG.SCAN_INTERVAL_MS);
});
