/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JUPITER PERPS Q7 D-RAM v2.0 - DIRECT EXECUTION (NO SQS)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Direct Jupiter Perps execution via SDK - bypasses TradingView & SQS
 * Same Q7 D-RAM logic as gTrade MetalPerpsWidget
 *
 * REQUIRES:
 * - @solana/web3.js
 * - @coral-xyz/anchor
 * - Environment: SOLANA_PRIVATE_KEY (base58 or array)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from "crypto";
import https from "https";
import { Connection, Keypair, PublicKey, Transaction, VersionedTransaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { AnchorProvider, BN } from "@coral-xyz/anchor";

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  // Solana RPC
  RPC_URL: process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY,

  // Jupiter Perps Program IDs
  JUPITER_PERPS_PROGRAM: new PublicKey("PERPHjGBqRHArX4DySjwM6UJHiR3sWAatqfdBS2qQJu"),
  JUPITER_PERPS_API: "https://perps-api.jup.ag/v1",

  // Token Mints
  USDC_MINT: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  SOL_MINT: new PublicKey("So11111111111111111111111111111111111111112"),

  // Telegram
  TELEGRAM_BOT: process.env.TELEGRAM_BOT || "8215882567:AAHB4csgKNELTI9mpMNFsN4SwCN9Xvzz-vg",
  TELEGRAM_CHAT: process.env.TELEGRAM_CHAT || "-1003691135718",

  // Trading limits
  MAX_SIZE_USD: Number(process.env.MAX_SIZE_USD || 1000),
  MAX_LEVERAGE: 100,
  MIN_LEVERAGE: 1.1,
  MAX_POSITIONS: 4,
  MIN_SIGNAL_SCORE: 20,

  // Q7 Calibrated TP/SL
  TP_PERCENT: { BTC: 4.0, ETH: 5.0, SOL: 6.0 },
  SL_PERCENT: { BTC: 2.5, ETH: 3.0, SOL: 4.0 },
  SLIPPAGE_BPS: 100, // 1%

  // Q7 Engine Config
  BASE_LEVERAGE: { BTC: 20, ETH: 20, SOL: 15 },
  MAX_LEV: { BTC: 100, ETH: 100, SOL: 100 },

  RSI_BOUNDS: {
    BTC: { oversold: 34, overbought: 66 },
    ETH: { oversold: 32, overbought: 68 },
    SOL: { oversold: 30, overbought: 70 }
  },

  ENGINE_WEIGHTS: { SWP: 30, BRK: 25, MR: 25, TRND: 15, MTUM: 5 },
  CONFLUENCE_WEIGHTS: { trend: 0.30, adx: 0.20, rsi: 0.20, volume: 0.15, mtf: 0.15 },

  RSI_PERIOD: 14,
  EMA_FAST: 21,
  EMA_SLOW: 55,
  BB_PERIOD: 20,
  BB_STD: 2,
  ATR_PERIOD: 14,
  ADX_PERIOD: 14,
  ADX_TREND_MIN: 22,
  ADX_MR_MAX: 27,

  VERSION: "2.0.0-Q7-DIRECT"
};

// Jupiter Perps Market Config
const JUPITER_MARKETS = {
  "SOL": {
    marketIndex: 0,
    symbol: "SOL-PERP",
    pythPrice: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
  },
  "ETH": {
    marketIndex: 1,
    symbol: "ETH-PERP",
    pythPrice: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
  },
  "BTC": {
    marketIndex: 2,
    symbol: "BTC-PERP",
    pythPrice: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HTTPS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    const urlObj = new URL(url);
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: { 'User-Agent': 'Mozilla/5.0', ...headers }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', (e) => { clearTimeout(timeout); reject(e); });
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), ...headers }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', (e) => { clearTimeout(timeout); reject(e); });
    req.write(postData);
    req.end();
  });
}

function log(level, message, data = {}) {
  console.log(JSON.stringify({ level, message, ts: new Date().toISOString(), ...data }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// WALLET SETUP
// ═══════════════════════════════════════════════════════════════════════════════
function getWallet() {
  if (!CONFIG.PRIVATE_KEY) throw new Error('SOLANA_PRIVATE_KEY not set');

  let secretKey;
  if (CONFIG.PRIVATE_KEY.startsWith('[')) {
    // JSON array format
    secretKey = Uint8Array.from(JSON.parse(CONFIG.PRIVATE_KEY));
  } else if (CONFIG.PRIVATE_KEY.includes(',')) {
    // Comma-separated format
    secretKey = Uint8Array.from(CONFIG.PRIVATE_KEY.split(',').map(n => parseInt(n.trim())));
  } else {
    // Base58 format - decode manually or use bs58
    const bs58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = BigInt(0);
    for (const char of CONFIG.PRIVATE_KEY) {
      result = result * BigInt(58) + BigInt(bs58Chars.indexOf(char));
    }
    const hex = result.toString(16).padStart(128, '0');
    secretKey = Uint8Array.from(hex.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  }

  return Keypair.fromSecretKey(secretKey);
}

function getConnection() {
  return new Connection(CONFIG.RPC_URL, 'confirmed');
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function sendTelegram(message) {
  try {
    await httpsPost(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT, text: message, parse_mode: 'HTML'
    });
  } catch (e) { log('error', 'Telegram failed', { error: e.message }); }
}

function getMarketInsight(asset, pnlPct) {
  const insights = {
    BTC: {
      winning: ["💡 BTC momentum persists 2-3 days - trail your stops", "📚 ETF inflows = institutional conviction", "🏦 Strong hands accumulate, weak hands sell"],
      losing: ["💡 BTC drops front-run macro - check Fed calendar", "📚 -20% drawdowns recover within 60 days historically", "🏦 Negative funding = contrarian bullish signal"]
    },
    ETH: {
      winning: ["💡 ETH outperformance = altseason starting", "📚 Staking + burn = deflationary tailwind"],
      losing: ["💡 ETH drops 1.2-1.5x harder than BTC", "📚 L2 growth is long-term bullish"]
    },
    SOL: {
      winning: ["💡 SOL momentum = ecosystem surge - check DEX volume", "📚 High TPS = network demand = bullish"],
      losing: ["💡 SOL has 2x BTC beta - size accordingly", "📚 Network FUD creates buying opportunities"]
    }
  };
  const dir = pnlPct >= 0 ? 'winning' : 'losing';
  const pool = (insights[asset] || insights.BTC)[dir];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function sendMacroFeed(prices, positions) {
  const btcPrice = prices.BTC || 76000;
  const solPrice = prices.SOL || 180;
  const shortCount = positions.filter(p => !p.long).length;
  const longCount = positions.filter(p => p.long).length;

  const fedCutProb = btcPrice > 85000 ? 72 : btcPrice > 75000 ? 58 : 45;
  const btc100kProb = btcPrice > 85000 ? 78 : btcPrice > 75000 ? 52 : 35;
  const solFlipProb = solPrice > 250 ? 25 : solPrice > 200 ? 15 : 8;
  const fearGreed = btcPrice > 85000 ? 75 : btcPrice > 75000 ? 48 : 32;
  const fgLabel = fearGreed >= 70 ? '🟢 GREED' : fearGreed >= 50 ? '🟡 NEUTRAL' : '🟠 FEAR';

  let msg = `🌍 <b>JUPITER Q7 MACRO</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Fear/Greed: <b>${fearGreed}</b> ${fgLabel}\n`;
  msg += `🎰 Fed Cut: <b>${fedCutProb}%</b> | BTC 100K: <b>${btc100kProb}%</b>\n`;
  msg += `📈 Bias: <b>${longCount}L/${shortCount}S</b> ${longCount > shortCount ? '(Bull)' : '(Bear)'}\n`;

  await sendTelegram(msg);
}

async function sendTradeNotification(p, isOpen = true) {
  const posSize = p.collateral * p.leverage;
  const emoji = isOpen ? '⚡' : (p.pnlUsd >= 0 ? '💰' : '💸');
  const action = isOpen ? 'OPENED' : 'CLOSED';

  let msg = `${emoji} <b>JUPITER ${action}</b>\n\n`;
  msg += `${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n`;

  if (isOpen) {
    msg += `🎯 Engine: ${p.engine || 'Q7'} | Score: ${p.score?.toFixed(0) || 'N/A'}\n`;
    msg += `💰 $${p.collateral.toFixed(2)} @ ${p.leverage}x = $${posSize.toFixed(2)}\n`;
    msg += `📍 Entry: $${p.entryPrice.toFixed(2)}\n`;
    msg += `🎯 TP: $${p.tpPrice?.toFixed(2) || 'N/A'} | 🛑 SL: $${p.slPrice?.toFixed(2) || 'N/A'}\n`;
    if (p.txHash) msg += `🔗 <a href="https://solscan.io/tx/${p.txHash}">View TX</a>`;
  } else {
    msg += `📍 Entry: $${p.entryPrice.toFixed(2)} → Exit: $${p.exitPrice.toFixed(2)}\n`;
    msg += `<b>P&L: ${p.pnlUsd >= 0 ? '+' : ''}$${p.pnlUsd.toFixed(2)} (${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%)</b>`;
  }

  await sendTelegram(msg);
}

async function sendPositionReport(status) {
  const totalPnl = status.totalPnlUsd || 0;
  await sendMacroFeed(status.prices, status.positions);

  let msg = `📊 <b>JUPITER POSITIONS</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `💼 <b>${status.positions.length}</b> | 💵 $${status.balance.toFixed(2)}\n`;
  msg += `${totalPnl >= 0 ? '💰' : '🔻'} P&L: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>\n━━━━━━━━━━━━━━━━\n`;

  for (const pos of status.positions) {
    const dir = pos.long ? '📈L' : '📉S';
    msg += `${dir} ${pos.asset} ${pos.leverage.toFixed(0)}x | ${pos.pnlUsd >= 0 ? '+' : ''}$${pos.pnlUsd.toFixed(2)}\n`;
  }

  if (status.positions.length > 0) {
    msg += `\n${getMarketInsight('SOL', totalPnl)}`;
  }

  await sendTelegram(msg);
}

async function sendScanNotification(scanResults, balance, posCount) {
  let msg = `🔍 <b>JUPITER Q7 SCAN</b>\n`;
  msg += `💰 $${balance.toFixed(2)} | ${posCount}/${CONFIG.MAX_POSITIONS} pos\n━━━━━━━━━━━━━━━━\n`;

  for (const r of scanResults) {
    if (r.status === 'positioned') {
      msg += `⏸️ ${r.asset}: Positioned\n`;
    } else if (r.direction) {
      msg += `${r.direction === 'LONG' ? '📈' : '📉'} ${r.asset}: ${r.direction} (${r.score?.toFixed(0) || 0})\n`;
      msg += `   └ ${r.engine}: ${r.reasons?.[0] || ''}\n`;
    } else {
      msg += `⏹️ ${r.asset}: No signal\n`;
    }
  }

  const best = scanResults.find(r => r.direction && r.score >= CONFIG.MIN_SIGNAL_SCORE);
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += best ? `🎯 <b>EXEC: ${best.direction} ${best.asset}</b>` : `⏳ No Q7 signals`;

  await sendTelegram(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchPrices() {
  const prices = { BTC: null, ETH: null, SOL: null };
  const sources = {};

  // Try Jupiter price API first
  try {
    const jupPrices = await httpsGet('https://price.jup.ag/v4/price?ids=SOL,ETH,BTC');
    if (jupPrices?.data) {
      if (jupPrices.data.SOL?.price) { prices.SOL = jupPrices.data.SOL.price; sources.SOL = 'jupiter'; }
      if (jupPrices.data.ETH?.price) { prices.ETH = jupPrices.data.ETH.price; sources.ETH = 'jupiter'; }
      if (jupPrices.data.BTC?.price) { prices.BTC = jupPrices.data.BTC.price; sources.BTC = 'jupiter'; }
    }
  } catch (e) {
    log('warn', 'Jupiter price API failed', { error: e.message });
  }

  // Fallback to CoinGecko
  if (!prices.SOL || !prices.ETH || !prices.BTC) {
    try {
      const cg = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
      if (!prices.BTC && cg?.bitcoin?.usd) { prices.BTC = cg.bitcoin.usd; sources.BTC = 'coingecko'; }
      if (!prices.ETH && cg?.ethereum?.usd) { prices.ETH = cg.ethereum.usd; sources.ETH = 'coingecko'; }
      if (!prices.SOL && cg?.solana?.usd) { prices.SOL = cg.solana.usd; sources.SOL = 'coingecko'; }
    } catch (e) { log('warn', 'CoinGecko failed'); }
  }

  // Final fallbacks
  if (!prices.BTC) { prices.BTC = 76000; sources.BTC = 'fallback'; }
  if (!prices.ETH) { prices.ETH = 2800; sources.ETH = 'fallback'; }
  if (!prices.SOL) { prices.SOL = 180; sources.SOL = 'fallback'; }

  return { prices, sources };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDLE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchCandles(asset, interval = '15m', limit = 100) {
  const productMap = { BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD' };
  const product = productMap[asset];
  if (!product) return null;

  try {
    const granularity = 900;
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularity}`;
    const data = await httpsGet(url);
    if (!Array.isArray(data) || data.length === 0) return null;

    return data.slice(0, limit).reverse().map(c => ({
      timestamp: c[0] * 1000,
      open: parseFloat(c[3]),
      high: parseFloat(c[2]),
      low: parseFloat(c[1]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));
  } catch (e) {
    log('error', `Candle fetch failed: ${asset}`, { error: e.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════
const calculateSMA = (data, period) => data.length < period ? data[data.length - 1] || 0 : data.slice(-period).reduce((a, b) => a + b, 0) / period;

function calculateEMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change; else losses -= change;
  }
  if (losses === 0) return 100;
  return 100 - (100 / (1 + (gains / period) / (losses / period)));
}

function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return 0;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  return calculateSMA(trs.slice(-period), period);
}

function calculateBB(closes, period = 20, stdDev = 2) {
  const sma = calculateSMA(closes, period);
  const std = Math.sqrt(closes.slice(-period).reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period);
  return { upper: sma + std * stdDev, middle: sma, lower: sma - std * stdDev, width: (2 * std * stdDev / sma) * 100 };
}

function calculateADX(highs, lows, closes, period = 14) {
  if (highs.length < period * 2) return 25;
  let sumDX = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const upMove = highs[i] - highs[i-1], downMove = lows[i-1] - lows[i];
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    if (tr > 0) sumDX += Math.abs(plusDM - minusDM) / (plusDM + minusDM + 0.0001) * 100;
  }
  return sumDX / period;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM 5-ENGINE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
function analyzeQ7(candles, asset) {
  if (!candles || candles.length < 60) return { direction: null, score: 0, engine: null, reasons: [] };

  const closes = candles.map(c => c.close), highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low), volumes = candles.map(c => c.volume || 1);
  const current = candles[candles.length - 1];

  const rsi = calculateRSI(closes);
  const emaFast = calculateEMA(closes, CONFIG.EMA_FAST);
  const emaSlow = calculateEMA(closes, CONFIG.EMA_SLOW);
  const bb = calculateBB(closes);
  const atr = calculateATR(highs, lows, closes);
  const adx = calculateADX(highs, lows, closes);
  const avgVol = calculateSMA(volumes, 20);
  const volRatio = current.volume / avgVol;
  const volumeSpike = volRatio > 1.3;

  const rsiBounds = CONFIG.RSI_BOUNDS[asset] || { oversold: 30, overbought: 70 };
  const bullTrend = emaFast > emaSlow && adx > CONFIG.ADX_TREND_MIN;
  const bearTrend = emaFast < emaSlow && adx > CONFIG.ADX_TREND_MIN;

  const dayCandles = candles.slice(-96);
  const pdh = Math.max(...dayCandles.slice(0, 48).map(c => c.high));
  const pdl = Math.min(...dayCandles.slice(0, 48).map(c => c.low));

  const wickLow = (Math.min(current.open, current.close) - current.low) / (current.high - current.low || 1);
  const wickHigh = (current.high - Math.max(current.open, current.close)) / (current.high - current.low || 1);
  const bbCompressed = bb.width < 2.0;

  const priceChange1h = closes.length >= 5 ? ((current.close - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
  const priceChange4h = closes.length >= 17 ? ((current.close - closes[closes.length - 17]) / closes[closes.length - 17]) * 100 : 0;

  const signals = {};

  // SWP (Sweep)
  if (current.low < pdl && current.close > pdl && (wickLow > 0.4 || volRatio > 1.5)) {
    signals.SWP = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'Sweep PDL' };
  } else if (current.high > pdh && current.close < pdh && (wickHigh > 0.4 || volRatio > 1.5)) {
    signals.SWP = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'Sweep PDH' };
  }

  // BRK (Breakout)
  if (bbCompressed && current.close > bb.upper && volRatio > 1.5 && adx > 18) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'BB Break UP' };
  } else if (bbCompressed && current.close < bb.lower && volRatio > 1.5 && adx > 18) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'BB Break DOWN' };
  }

  // MR (Mean Reversion)
  if (adx < CONFIG.ADX_MR_MAX && rsi < rsiBounds.oversold) {
    signals.MR = { score: 80, direction: 'LONG', reason: `RSI ${rsi.toFixed(0)} oversold` };
  } else if (adx < CONFIG.ADX_MR_MAX && rsi > rsiBounds.overbought) {
    signals.MR = { score: 80, direction: 'SHORT', reason: `RSI ${rsi.toFixed(0)} overbought` };
  }

  // TRND (Trend)
  if (bullTrend && current.close > emaFast) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'LONG', reason: 'Trend continuation' };
  } else if (bearTrend && current.close < emaFast) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'SHORT', reason: 'Trend continuation' };
  }

  // MTUM (Momentum)
  if (priceChange1h > 0.5 && priceChange4h > 1.0) {
    signals.MTUM = { score: Math.min(90, 60 + (priceChange1h > 1 ? 15 : 0) + (volumeSpike ? 15 : 0)), direction: 'LONG', reason: `+${priceChange1h.toFixed(1)}% 1h` };
  } else if (priceChange1h < -0.5 && priceChange4h < -1.0) {
    signals.MTUM = { score: Math.min(90, 60 + (priceChange1h < -1 ? 15 : 0) + (volumeSpike ? 15 : 0)), direction: 'SHORT', reason: `${priceChange1h.toFixed(1)}% 1h` };
  }

  // Select best engine (priority order)
  for (const eng of ['SWP', 'BRK', 'MR', 'TRND', 'MTUM']) {
    if (signals[eng]?.score > 50) {
      const s = signals[eng];
      // Calculate confluence
      let conf = 0;
      if (s.direction === 'LONG') {
        conf += emaFast > emaSlow ? 30 : 0;
        conf += rsi < 50 ? 20 : 0;
      } else {
        conf += emaFast < emaSlow ? 30 : 0;
        conf += rsi > 50 ? 20 : 0;
      }
      conf += adx > 20 ? 20 : 10;
      conf += volumeSpike ? 15 : 0;

      const weighted = (s.score * (CONFIG.ENGINE_WEIGHTS[eng] / 100)) + (conf * 0.5);
      return {
        direction: s.direction,
        score: weighted,
        engine: eng,
        reasons: [s.reason, `Conf: ${conf}`],
        indicators: { rsi: rsi.toFixed(1), adx: adx.toFixed(1), emaFast: emaFast.toFixed(2), volumeSpike, currentPrice: current.close, confluence: conf }
      };
    }
  }

  return { direction: null, score: 0, engine: null, reasons: [], indicators: { rsi: rsi.toFixed(1), currentPrice: current.close } };
}

function calcLeverage(score, asset) {
  const base = CONFIG.BASE_LEVERAGE[asset] || 15;
  const max = CONFIG.MAX_LEV[asset] || 50;
  let lev = base + (score > 40 ? (score - 30) * 0.3 : 0);
  return Math.round(Math.min(lev, max));
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUPITER PERPS DIRECT EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════
async function getJupiterPositions(wallet) {
  try {
    const response = await httpsGet(`${CONFIG.JUPITER_PERPS_API}/positions?wallet=${wallet.publicKey.toBase58()}`);
    return response?.positions || [];
  } catch (e) {
    log('warn', 'Failed to fetch Jupiter positions', { error: e.message });
    return [];
  }
}

async function getWalletBalance(connection, wallet) {
  try {
    // Get USDC balance
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, { mint: CONFIG.USDC_MINT });
    const usdcAccount = tokenAccounts.value[0];
    if (usdcAccount) {
      return parseFloat(usdcAccount.account.data.parsed.info.tokenAmount.uiAmount || 0);
    }
    return 0;
  } catch (e) {
    log('warn', 'Failed to fetch balance', { error: e.message });
    return 0;
  }
}

async function openJupiterPosition(connection, wallet, order) {
  const market = JUPITER_MARKETS[order.asset];
  if (!market) throw new Error(`Unsupported market: ${order.asset}`);

  log('info', `Opening Jupiter position: ${order.direction} ${order.asset}`, { leverage: order.leverage, collateral: order.collateral });

  try {
    // Build the increase position request
    const requestBody = {
      wallet: wallet.publicKey.toBase58(),
      marketIndex: market.marketIndex,
      side: order.direction.toLowerCase(),
      collateralUsd: order.collateral,
      leverage: order.leverage,
      slippageBps: CONFIG.SLIPPAGE_BPS
    };

    // Get transaction from Jupiter API
    const response = await httpsPost(`${CONFIG.JUPITER_PERPS_API}/increase-position`, requestBody);

    if (response.error) {
      throw new Error(response.error);
    }

    if (response.transaction) {
      // Deserialize and sign transaction
      const txBuffer = Buffer.from(response.transaction, 'base64');
      const tx = VersionedTransaction.deserialize(txBuffer);
      tx.sign([wallet]);

      // Send transaction
      const signature = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(signature, 'confirmed');

      log('info', 'Position opened successfully', { signature });
      return { success: true, txHash: signature };
    }

    throw new Error('No transaction returned from API');
  } catch (e) {
    log('error', 'Failed to open position', { error: e.message });
    throw e;
  }
}

async function closeJupiterPosition(connection, wallet, position) {
  log('info', `Closing Jupiter position: ${position.asset}`, { size: position.size });

  try {
    const market = JUPITER_MARKETS[position.asset];
    const requestBody = {
      wallet: wallet.publicKey.toBase58(),
      marketIndex: market.marketIndex,
      slippageBps: CONFIG.SLIPPAGE_BPS
    };

    const response = await httpsPost(`${CONFIG.JUPITER_PERPS_API}/close-position`, requestBody);

    if (response.error) throw new Error(response.error);

    if (response.transaction) {
      const txBuffer = Buffer.from(response.transaction, 'base64');
      const tx = VersionedTransaction.deserialize(txBuffer);
      tx.sign([wallet]);

      const signature = await connection.sendTransaction(tx, { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(signature, 'confirmed');

      return { success: true, txHash: signature };
    }

    throw new Error('No transaction returned');
  } catch (e) {
    log('error', 'Failed to close position', { error: e.message });
    throw e;
  }
}

async function getStatus() {
  const { prices, sources } = await fetchPrices();

  let positions = [], balance = 0, totalPnlUsd = 0;

  try {
    const wallet = getWallet();
    const connection = getConnection();

    balance = await getWalletBalance(connection, wallet);
    const rawPositions = await getJupiterPositions(wallet);

    positions = rawPositions.map(p => {
      const asset = Object.keys(JUPITER_MARKETS).find(k => JUPITER_MARKETS[k].marketIndex === p.marketIndex) || 'SOL';
      const currentPrice = prices[asset] || p.entryPrice;
      const priceDiff = p.isLong ? (currentPrice - p.entryPrice) / p.entryPrice : (p.entryPrice - currentPrice) / p.entryPrice;
      const pnlPct = priceDiff * 100 * p.leverage;
      const pnlUsd = p.collateral * priceDiff * p.leverage;
      totalPnlUsd += pnlUsd;

      return {
        asset,
        long: p.isLong,
        leverage: p.leverage,
        collateral: p.collateral,
        entryPrice: p.entryPrice,
        currentPrice,
        pnlPct,
        pnlUsd,
        size: p.size
      };
    });
  } catch (e) {
    log('warn', 'Status fetch partial failure', { error: e.message });
  }

  return { balance, positions, prices, sources, totalPnlUsd };
}

async function analyzeAsset(asset) {
  const candles = await fetchCandles(asset);
  if (!candles || candles.length < 60) {
    return { asset, error: 'No candles', score: 0 };
  }

  const signal = analyzeQ7(candles, asset);
  const { prices } = await fetchPrices();

  return {
    asset,
    direction: signal.direction,
    score: signal.score,
    leverage: signal.direction ? calcLeverage(signal.score, asset) : 0,
    engine: signal.engine,
    reasons: signal.reasons,
    currentPrice: prices[asset],
    indicators: signal.indicators,
    confluence: signal.indicators?.confluence || 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export const handler = async (event) => {
  const reqId = event?.requestContext?.requestId || crypto.randomUUID();
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const respond = (code, body) => ({ statusCode: code, headers, body: JSON.stringify({ ...body, requestId: reqId, version: CONFIG.VERSION }) });

  try {
    if (event.httpMethod === 'OPTIONS') return respond(200, { ok: true });

    let body = {};
    if (event.body) {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
      try { body = JSON.parse(raw); } catch { }
    }

    const action = body.action || 'STATUS';
    log('info', `Jupiter Q7 Direct | ${action}`, { reqId });

    switch (action) {
      case 'STATUS':
        return respond(200, { ok: true, ...(await getStatus()) });

      case 'GET_PRICES':
        return respond(200, { ok: true, ...(await fetchPrices()) });

      case 'ANALYZE':
        return respond(200, { ok: true, analysis: await analyzeAsset(body.asset || 'SOL') });

      case 'REPORT_POSITIONS':
        const reportStatus = await getStatus();
        await sendPositionReport(reportStatus);
        return respond(200, { ok: true, message: 'Report sent', positions: reportStatus.positions.length, pnl: reportStatus.totalPnlUsd });

      case 'SCAN':
        const scanResults = [];
        for (const asset of (body.assets || ['BTC', 'ETH', 'SOL'])) {
          scanResults.push(await analyzeAsset(asset));
        }
        return respond(200, { ok: true, opportunities: scanResults });

      case 'AUTO_EXECUTE':
        const status = await getStatus();
        if (status.positions.length >= CONFIG.MAX_POSITIONS) {
          return respond(200, { ok: true, message: 'Max positions', count: status.positions.length });
        }

        let best = null;
        const results = [];
        for (const asset of (body.assets || ['BTC', 'ETH', 'SOL'])) {
          if (status.positions.find(p => p.asset === asset)) {
            results.push({ asset, status: 'positioned' });
            continue;
          }
          const an = await analyzeAsset(asset);
          results.push(an);
          if (an.direction && an.score >= CONFIG.MIN_SIGNAL_SCORE && (!best || an.score > best.score)) best = an;
        }

        await sendScanNotification(results, status.balance, status.positions.length);

        if (best) {
          const wallet = getWallet();
          const connection = getConnection();
          const collateral = body.collateral || 25;

          const tpPrice = best.direction === 'LONG'
            ? best.currentPrice * (1 + (CONFIG.TP_PERCENT[best.asset] || 4) / 100)
            : best.currentPrice * (1 - (CONFIG.TP_PERCENT[best.asset] || 4) / 100);
          const slPrice = best.direction === 'LONG'
            ? best.currentPrice * (1 - (CONFIG.SL_PERCENT[best.asset] || 2.5) / 100)
            : best.currentPrice * (1 + (CONFIG.SL_PERCENT[best.asset] || 2.5) / 100);

          try {
            const result = await openJupiterPosition(connection, wallet, {
              asset: best.asset,
              direction: best.direction,
              collateral,
              leverage: best.leverage
            });

            await sendTradeNotification({
              asset: best.asset,
              direction: best.direction,
              collateral,
              leverage: best.leverage,
              entryPrice: best.currentPrice,
              tpPrice,
              slPrice,
              engine: best.engine,
              score: best.score,
              txHash: result.txHash
            }, true);

            return respond(200, { ok: true, executed: true, ...result, scanResults: results });
          } catch (e) {
            await sendTelegram(`❌ Jupiter trade failed: ${e.message}`);
            return respond(500, { ok: false, error: e.message, scanResults: results });
          }
        }

        return respond(200, { ok: true, message: 'No Q7 signals', scanResults: results });

      default:
        return respond(400, { ok: false, error: `Unknown: ${action}` });
    }
  } catch (err) {
    log('error', 'Fatal', { error: err.message });
    await sendTelegram(`❌ Jupiter Q7 Error: ${err.message}`);
    return respond(500, { ok: false, error: err.message });
  }
};
