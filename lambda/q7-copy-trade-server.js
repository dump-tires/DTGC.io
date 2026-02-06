// Q7 COPY TRADE SERVER v2.2 - SMART FILTERING FOR LOW COLLATERAL WALLETS
// Hetzner server that monitors Q7 wallet and executes trades for delegated users
// Single-click activation: User delegates once, bot trades forever
//
// v2.2 NEW:
// - Smart trade filtering based on wallet collateral
// - Quality scoring for trades (leverage, asset risk, TP/SL ratio)
// - Proportional position sizing for low-collateral wallets
// - Skip high-risk trades for small accounts

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

  // v2.2: SMART FILTERING FOR LOW COLLATERAL WALLETS
  LOW_COLLATERAL_THRESHOLD: 100,     // Wallets with <$100 USDC are "low collateral"
  MIN_TRADE_QUALITY_SCORE: 60,       // Only copy trades scoring 60+ for low-collateral
  SMART_SIZING_ENABLED: true,        // Enable proportional position sizing
  MAX_POSITION_PCT_OF_BALANCE: 0.25, // Max 25% of balance per trade for low-collateral
  SKIP_HIGH_LEVERAGE_FOR_SMALL: true,// Skip >50x trades for low-collateral wallets
  HIGH_LEVERAGE_THRESHOLD: 50,       // What counts as "high leverage"

  // Risk tiers by asset (used for quality scoring)
  ASSET_RISK_SCORES: {
    BTC: 90,    // Most stable - high quality
    ETH: 85,    // Very stable
    GOLD: 80,   // Stable commodity
    SILVER: 70, // More volatile commodity
    DEFAULT: 50 // Unknown pairs
  },

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

// ==================== v2.2: SMART TRADE QUALITY SCORING ====================
function calculateTradeQualityScore(trade) {
  let score = 0;

  // 1. Asset stability score (0-30 points)
  const assetName = trade.asset?.toUpperCase() || '';
  const assetScore = CONFIG.ASSET_RISK_SCORES[assetName] || CONFIG.ASSET_RISK_SCORES.DEFAULT;
  score += (assetScore / 100) * 30;

  // 2. Leverage risk (0-25 points) - lower leverage = higher quality
  const leverage = trade.leverage || 10;
  if (leverage <= 10) score += 25;
  else if (leverage <= 25) score += 20;
  else if (leverage <= 50) score += 15;
  else if (leverage <= 75) score += 10;
  else score += 5;

  // 3. TP/SL ratio (0-25 points) - good risk/reward
  if (trade.tp && trade.sl && trade.openPrice) {
    const tpDistance = Math.abs(trade.tp - trade.openPrice);
    const slDistance = Math.abs(trade.sl - trade.openPrice);
    if (slDistance > 0) {
      const riskReward = tpDistance / slDistance;
      if (riskReward >= 2.0) score += 25;
      else if (riskReward >= 1.5) score += 20;
      else if (riskReward >= 1.0) score += 15;
      else score += 10;
    } else {
      score += 10; // No SL set
    }
  } else {
    score += 10; // Missing TP/SL data
  }

  // 4. Collateral size (0-20 points) - Q7 confidence indicator
  const collateral = trade.collateral || 0;
  if (collateral >= 50) score += 20;
  else if (collateral >= 25) score += 15;
  else if (collateral >= 10) score += 10;
  else score += 5;

  return Math.round(score);
}

function shouldCopyTradeForWallet(trade, trader) {
  const walletBalance = trader.usdcBalance || trader.arbBalance || 100;
  const isLowCollateral = walletBalance < CONFIG.LOW_COLLATERAL_THRESHOLD;
  const qualityScore = calculateTradeQualityScore(trade);

  console.log(`   📊 Trade Quality: ${qualityScore}/100 | Wallet: $${walletBalance.toFixed(2)} | Low-Collateral: ${isLowCollateral}`);

  // For low-collateral wallets, apply strict filtering
  if (isLowCollateral) {
    // Skip high leverage trades for small accounts
    if (CONFIG.SKIP_HIGH_LEVERAGE_FOR_SMALL && trade.leverage > CONFIG.HIGH_LEVERAGE_THRESHOLD) {
      console.log(`   ⏭️ SKIP: ${trade.leverage}x leverage too high for low-collateral wallet`);
      return { copy: false, reason: 'leverage_too_high', qualityScore };
    }

    // Only copy high-quality trades
    if (qualityScore < CONFIG.MIN_TRADE_QUALITY_SCORE) {
      console.log(`   ⏭️ SKIP: Quality score ${qualityScore} below threshold ${CONFIG.MIN_TRADE_QUALITY_SCORE}`);
      return { copy: false, reason: 'quality_below_threshold', qualityScore };
    }
  }

  return { copy: true, reason: 'approved', qualityScore };
}

function calculateSmartPositionSize(trade, trader) {
  const walletBalance = trader.usdcBalance || trader.arbBalance || 100;
  const isLowCollateral = walletBalance < CONFIG.LOW_COLLATERAL_THRESHOLD;

  if (!CONFIG.SMART_SIZING_ENABLED || !isLowCollateral) {
    // Use normal sizing for well-funded wallets
    return trade.collateral * (trader.settings?.collateralMultiplier || 1.0);
  }

  // Smart sizing for low-collateral wallets:
  // 1. Cap at MAX_POSITION_PCT_OF_BALANCE
  const maxPosition = walletBalance * CONFIG.MAX_POSITION_PCT_OF_BALANCE;

  // 2. Scale down Q7's position proportionally to wallet size
  // Q7 typically trades with $10-50, scale based on ratio
  const q7BaseSize = 25; // Assume Q7's typical trade size
  const scaleFactor = Math.min(walletBalance / 100, 1); // Scale down for small wallets
  const scaledPosition = trade.collateral * scaleFactor;

  // 3. Take the smaller of max allowed or scaled position
  const finalSize = Math.min(maxPosition, scaledPosition, trade.collateral);

  // 4. Ensure minimum viable trade size ($5 minimum for gTrade)
  const minimumSize = 5;
  if (finalSize < minimumSize) {
    console.log(`   ⚠️ Position too small ($${finalSize.toFixed(2)}), using minimum $${minimumSize}`);
    return minimumSize;
  }

  console.log(`   💡 Smart Sizing: Q7=$${trade.collateral} → User=$${finalSize.toFixed(2)} (${(finalSize/walletBalance*100).toFixed(1)}% of balance)`);
  return finalSize;
}

// ==================== EXECUTE COPY TRADE ====================
async function executeCopyTrade(trader, q7Trade) {
  if (!executorWallet) {
    console.error('❌ No executor wallet configured');
    return { success: false, error: 'No executor wallet' };
  }

  const { address, settings } = trader;

  // v2.2: Smart filtering check
  const filterResult = shouldCopyTradeForWallet(q7Trade, trader);
  if (!filterResult.copy) {
    console.log(`   ⏭️ Skipping trade for ${address.slice(0, 8)}... (${filterResult.reason})`);
    return { success: false, skipped: true, reason: filterResult.reason, qualityScore: filterResult.qualityScore };
  }

  // v2.2: Smart position sizing
  const userCollateral = calculateSmartPositionSize(q7Trade, trader);
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

        // v2.2: Track execution results
        let copied = 0, skipped = 0;

        for (const trader of activeTradersArray) {
          const result = await executeCopyTrade(trader, trade);
          if (result.success) {
            copied++;
            await sendTelegramNotification(`✅ Copied for ${trader.address.slice(0,8)}...`);
          } else if (result.skipped) {
            skipped++;
            // Update trader stats
            if (copyTraders[trader.address.toLowerCase()]) {
              copyTraders[trader.address.toLowerCase()].stats.skippedTrades++;
              saveCopyTraders(copyTraders);
            }
          }
        }

        // v2.2: Summary notification
        if (skipped > 0) {
          await sendTelegramNotification(`📊 Trade Summary: ${copied} copied, ${skipped} skipped (low-collateral filter)`);
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
  const traders = Object.values(copyTraders);
  const activeTraders = traders.filter(t => t.enabled && t.delegated);
  const lowCollateralTraders = activeTraders.filter(t => t.isLowCollateral);

  res.json({
    status: 'live',
    version: '2.2',
    features: ['smart-filtering', 'quality-scoring', 'proportional-sizing'],
    botExecutor: CONFIG.BOT_EXECUTOR_ADDRESS,
    activeCopyTraders: activeTraders.length,
    lowCollateralTraders: lowCollateralTraders.length,
    totalRegistered: traders.length,
    q7Positions: lastKnownQ7Positions.length,
    smartFiltering: {
      enabled: CONFIG.SMART_SIZING_ENABLED,
      lowCollateralThreshold: CONFIG.LOW_COLLATERAL_THRESHOLD,
      minQualityScore: CONFIG.MIN_TRADE_QUALITY_SCORE,
      maxPositionPct: CONFIG.MAX_POSITION_PCT_OF_BALANCE * 100,
    },
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

// ==================== v2.2: FETCH USDC BALANCE ====================
const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

async function fetchUsdcBalance(address) {
  try {
    const usdc = new ethers.Contract(CONFIG.USDC_ADDRESS, ERC20_ABI, provider);
    const balance = await usdc.balanceOf(address);
    return parseFloat(ethers.utils.formatUnits(balance, 6));
  } catch (e) {
    console.error(`Failed to fetch USDC balance for ${address}:`, e.message);
    return 0;
  }
}

app.post('/api/register-copy-trader', async (req, res) => {
  try {
    const { address, dtgcBalance, arbBalance } = req.body;
    if (!address) return res.status(400).json({ error: 'Address required' });

    const normalizedAddress = address.toLowerCase();
    const isDelegated = await checkDelegation(address);

    // v2.2: Fetch USDC balance for smart sizing
    const usdcBalance = await fetchUsdcBalance(address);
    const isLowCollateral = usdcBalance < CONFIG.LOW_COLLATERAL_THRESHOLD;

    console.log(`📝 Register: ${address.slice(0, 8)}... | USDC: $${usdcBalance.toFixed(2)} | Low-Collateral: ${isLowCollateral}`);

    copyTraders[normalizedAddress] = {
      address: address,
      enabled: true,
      delegated: isDelegated,
      registeredAt: copyTraders[normalizedAddress]?.registeredAt || Date.now(),
      lastUpdate: Date.now(),
      dtgcBalance: dtgcBalance || 0,
      arbBalance: arbBalance || 0,
      usdcBalance: usdcBalance,
      isLowCollateral: isLowCollateral,
      settings: copyTraders[normalizedAddress]?.settings || {
        collateralMultiplier: 1.0,
        maxLeverage: 100,
      },
      stats: copyTraders[normalizedAddress]?.stats || {
        totalTrades: 0, wins: 0, losses: 0, totalPnL: 0,
        skippedTrades: 0, // v2.2: Track skipped trades
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
  console.log(`\n🚀 Q7 COPY TRADE SERVER v2.2 - SMART FILTERING`);
  console.log(`   Port: ${CONFIG.PORT}`);
  console.log(`   Bot Executor: ${CONFIG.BOT_EXECUTOR_ADDRESS}`);
  console.log(`   Q7 Dev Wallet: ${CONFIG.Q7_DEV_WALLET}`);
  console.log(`   Scan Interval: ${CONFIG.SCAN_INTERVAL_MS / 1000}s`);
  console.log(`   Flywheel: ${CONFIG.FLYWHEEL_PERCENTAGE * 100}% to Growth Engine`);
  console.log(`\n🎯 SMART FILTERING (v2.2):`);
  console.log(`   Low-Collateral Threshold: $${CONFIG.LOW_COLLATERAL_THRESHOLD}`);
  console.log(`   Min Quality Score: ${CONFIG.MIN_TRADE_QUALITY_SCORE}/100`);
  console.log(`   Max Position %: ${CONFIG.MAX_POSITION_PCT_OF_BALANCE * 100}% of balance`);
  console.log(`   Skip High Leverage (>${CONFIG.HIGH_LEVERAGE_THRESHOLD}x): ${CONFIG.SKIP_HIGH_LEVERAGE_FOR_SMALL}`);
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
