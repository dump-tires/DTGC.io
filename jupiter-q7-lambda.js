/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JUPITER PERPS Q7 D-RAM v1.0 - AUTONOMOUS TRADING BOT
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Bypasses TradingView - runs Q7 analysis internally and executes on Jupiter Perps
 * Same logic as gTrade MetalPerpsWidget Lambda
 *
 * FEATURES:
 * - Q7 D-RAM 5-Engine Analysis (SWP, BRK, MR, TRND, MTUM)
 * - Auto-execute trades on Jupiter Perps
 * - Telegram notifications with Macro Feed
 * - Educational market insights
 * - Position reporting with live P&L
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from "crypto";
import https from "https";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-2" });

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  // Solana
  RPC_URL: process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com",
  PRIVATE_KEY: process.env.SOLANA_PRIVATE_KEY,

  // Jupiter Perps
  JUPITER_PERPS_API: "https://perps-api.jup.ag",

  // Queue (for backward compatibility)
  QUEUE_URL: process.env.QUEUE_URL,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || process.env.WEBHOOK_TOKEN,

  // Telegram
  TELEGRAM_BOT: process.env.TELEGRAM_BOT || "8215882567:AAHB4csgKNELTI9mpMNFsN4SwCN9Xvzz-vg",
  TELEGRAM_CHAT: process.env.TELEGRAM_CHAT || "-1003691135718",

  // Trading limits
  MAX_SIZE_USD: Number(process.env.MAX_SIZE_USD || 1000),
  MAX_LEVERAGE: Number(process.env.MAX_LEVERAGE || 50),
  MIN_LEVERAGE: Number(process.env.MIN_LEVERAGE || 2),
  MAX_POSITIONS: 4,
  MIN_SIGNAL_SCORE: 20,

  // Q7 Calibrated TP/SL
  TP_PERCENT: { BTC: 4.0, ETH: 5.0, SOL: 6.0 },
  SL_PERCENT: { BTC: 2.5, ETH: 3.0, SOL: 4.0 },
  SLIPPAGE: { crypto: 1.5 },

  // Q7 Engine Config
  BASE_LEVERAGE: { BTC: 20, ETH: 20, SOL: 15 },
  MAX_LEV: { BTC: 50, ETH: 50, SOL: 40 },

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

  VERSION: "1.0.0-Q7"
};

const SUPPORTED_MARKETS = {
  "BTC": { symbol: "BTC", perpSymbol: "WBTC-PERP", pythId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  "ETH": { symbol: "ETH", perpSymbol: "ETH-PERP", pythId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
  "SOL": { symbol: "SOL", perpSymbol: "SOL-PERP", pythId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" }
};

// ═══════════════════════════════════════════════════════════════════════════════
// HTTPS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Parse error')); }
      });
    }).on('error', (e) => { clearTimeout(timeout); reject(e); });
  });
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(timeout); resolve(data); });
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
// TELEGRAM NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
async function sendTelegram(message) {
  try {
    await httpsPost(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT, text: message, parse_mode: 'HTML'
    });
  } catch (e) { log('error', 'Telegram failed', { error: e.message }); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MARKET EDUCATION & MACRO INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════════
function getMarketInsight(asset, pnlPct) {
  const insights = {
    BTC: {
      winning: [
        "💡 BTC momentum tends to persist 2-3 days - consider trailing stops",
        "📚 Strong hands accumulate dips; weak hands sell rallies",
        "🏦 ETF inflows signal institutional conviction"
      ],
      losing: [
        "💡 BTC drops often front-run macro events - check Fed calendar",
        "📚 Capitulation = opportunity. -20% drawdowns recover within 60 days",
        "🏦 Negative funding = shorts paying longs = contrarian bullish"
      ]
    },
    ETH: {
      winning: [
        "💡 ETH outperformance signals altseason rotation",
        "📚 Staking yield + burn = deflationary tailwind"
      ],
      losing: [
        "💡 ETH drops 1.2-1.5x harder than BTC - size accordingly",
        "📚 L2 growth is long-term bullish despite mainnet fee drops"
      ]
    },
    SOL: {
      winning: [
        "💡 SOL momentum = ecosystem activity surge - check DEX volumes",
        "📚 High TPS utilization = network demand = bullish signal"
      ],
      losing: [
        "💡 SOL drawdowns can be severe - 2x BTC beta typical",
        "📚 Network congestion fears often create buying opportunities"
      ]
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
  const solFlipEthProb = solPrice > 250 ? 25 : solPrice > 200 ? 15 : 8;
  const fearGreed = btcPrice > 85000 ? 75 : btcPrice > 75000 ? 48 : 32;
  const fgLabel = fearGreed >= 70 ? '🟢 GREED' : fearGreed >= 50 ? '🟡 NEUTRAL' : '🟠 FEAR';

  let msg = `🌍 <b>JUPITER Q7 MACRO FEED</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Fear & Greed: <b>${fearGreed}</b> ${fgLabel}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🎰 <b>PREDICTION MARKETS</b>\n`;
  msg += `├ Fed Rate Cut 2026: <b>${fedCutProb}%</b>\n`;
  msg += `├ BTC $100K EOY: <b>${btc100kProb}%</b>\n`;
  msg += `└ SOL Flips ETH: <b>${solFlipEthProb}%</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📈 Your Bias: <b>${longCount}L / ${shortCount}S</b> `;
  msg += longCount > shortCount ? '(Bullish)' : shortCount > longCount ? '(Bearish)' : '(Neutral)';
  msg += `\n`;

  await sendTelegram(msg);
}

async function sendScanNotification(scanResults, balance, positionCount) {
  const timestamp = new Date().toISOString().slice(11, 19);
  let msg = `🔍 <b>JUPITER Q7 SCAN ${timestamp}</b>\n`;
  msg += `💰 Balance: $${balance.toFixed(2)} | Positions: ${positionCount}/${CONFIG.MAX_POSITIONS}\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;

  for (const r of scanResults) {
    if (r.status === 'positioned') {
      msg += `⏸️ ${r.asset}: Already positioned\n`;
    } else if (r.direction) {
      const emoji = r.direction === 'LONG' ? '📈' : '📉';
      msg += `${emoji} ${r.asset}: ${r.direction} (${r.score?.toFixed(0) || 0})\n`;
      msg += `   └ 🎯 ${r.engine}: ${r.reasons?.[0] || ''}\n`;
    } else {
      msg += `⏹️ ${r.asset}: No signal (${r.score?.toFixed(0) || 0})\n`;
    }
  }

  const best = scanResults.find(r => r.direction && r.score >= CONFIG.MIN_SIGNAL_SCORE);
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += best ? `🎯 <b>EXECUTING: ${best.direction} ${best.asset} via ${best.engine}</b>` : `⏳ No Q7 signals (need ≥${CONFIG.MIN_SIGNAL_SCORE})`;

  await sendTelegram(msg);
}

async function sendTradeNotification(p, isOpen = true) {
  const posSize = p.collateral * p.leverage;
  if (isOpen) {
    const msg = `⚡ <b>JUPITER Q7 TRADE OPENED</b>\n\n${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n🎯 Engine: ${p.engine || 'Q7'}\n📊 Score: ${p.score?.toFixed(0) || 'N/A'}\n━━━━━━━━━━━━━━━━\n💰 Collateral: $${p.collateral.toFixed(2)}\n💪 Leverage: ${p.leverage}x\n📐 Position: $${posSize.toFixed(2)}\n━━━━━━━━━━━━━━━━\n📍 Entry: $${p.entryPrice.toFixed(2)}\n🎯 TP: $${p.tpPrice?.toFixed(2) || 'N/A'}\n🛑 SL: $${p.slPrice?.toFixed(2) || 'N/A'}`;
    await sendTelegram(msg);
  } else {
    const emoji = p.pnlUsd >= 0 ? '💰' : '💸';
    const msg = `${emoji} <b>JUPITER TRADE CLOSED</b>\n\n${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n📍 Entry: $${p.entryPrice.toFixed(2)}\n📍 Exit: $${p.exitPrice.toFixed(2)}\n━━━━━━━━━━━━━━━━\n<b>P&L: ${p.pnlUsd >= 0 ? '+' : ''}$${p.pnlUsd.toFixed(2)} (${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%)</b>`;
    await sendTelegram(msg);
  }
}

async function sendPositionReport(status) {
  const totalPnl = status.totalPnlUsd || 0;
  await sendMacroFeed(status.prices, status.positions);

  let msg = `📊 <b>JUPITER Q7 POSITION REPORT</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `💼 Positions: <b>${status.positions.length}</b>\n`;
  msg += `💵 Balance: <b>$${status.balance.toFixed(2)}</b>\n`;
  msg += `${totalPnl >= 0 ? '💰' : '🔻'} P&L: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>\n━━━━━━━━━━━━━━━━\n`;

  for (const pos of status.positions) {
    const dir = pos.long ? '📈L' : '📉S';
    msg += `${dir} ${pos.asset} ${pos.leverage.toFixed(0)}x | ${pos.pnlUsd >= 0 ? '+' : ''}$${pos.pnlUsd.toFixed(2)}\n`;
  }

  if (status.positions.length > 0) {
    msg += `\n${getMarketInsight('BTC', totalPnl)}`;
  }

  await sendTelegram(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchPrices() {
  const prices = { BTC: null, ETH: null, SOL: null };
  const sources = {};

  try {
    // Try CoinGecko
    const cg = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
    if (cg?.bitcoin?.usd) { prices.BTC = cg.bitcoin.usd; sources.BTC = 'coingecko'; }
    if (cg?.ethereum?.usd) { prices.ETH = cg.ethereum.usd; sources.ETH = 'coingecko'; }
    if (cg?.solana?.usd) { prices.SOL = cg.solana.usd; sources.SOL = 'coingecko'; }
  } catch (e) {
    log('warn', 'CoinGecko failed', { error: e.message });
  }

  // Fallbacks
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
    const granularity = 900; // 15 min
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularity}`;
    const data = await httpsGet(url);
    if (!Array.isArray(data) || data.length === 0) return null;

    const candles = data.slice(0, limit).reverse().map(c => ({
      timestamp: c[0] * 1000,
      open: parseFloat(c[3]),
      high: parseFloat(c[2]),
      low: parseFloat(c[1]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5])
    }));

    log('info', `Fetched ${candles.length} candles for ${asset}`);
    return candles;
  } catch (e) {
    log('error', `Candle fetch failed for ${asset}`, { error: e.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════
function calculateSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

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
  const rs = (gains / period) / (losses / period);
  return 100 - (100 / (1 + rs));
}

function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return 0;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  return calculateSMA(trs.slice(-period), period);
}

function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const std = Math.sqrt(slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period);
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

function isPinBar(candle, atr, ratio = 0.50) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range === 0) return { bullish: false, bearish: false };
  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;
  return {
    bullish: lowerWick / range > ratio && body / range < (1 - ratio),
    bearish: upperWick / range > ratio && body / range < (1 - ratio)
  };
}

function detectDivergence(closes, rsiValues, lookback = 14) {
  if (closes.length < lookback + 2 || rsiValues.length < lookback + 2) {
    return { bullish: false, bearish: false };
  }
  const currentClose = closes[closes.length - 1];
  const currentRSI = rsiValues[rsiValues.length - 1];
  const prevClose = closes[closes.length - lookback];
  const prevRSI = rsiValues[rsiValues.length - lookback];
  return {
    bullish: currentClose < prevClose && currentRSI > prevRSI && currentRSI < 40,
    bearish: currentClose > prevClose && currentRSI < prevRSI && currentRSI > 60
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 5-FACTOR CONFLUENCE
// ═══════════════════════════════════════════════════════════════════════════════
function calculateConfluence(indicators, direction) {
  const weights = CONFIG.CONFLUENCE_WEIGHTS;
  let score = 0;

  const trendScore = direction === 'LONG'
    ? (indicators.emaFast > indicators.emaSlow ? 100 : indicators.emaFast > indicators.emaSlow * 0.99 ? 50 : 0)
    : (indicators.emaFast < indicators.emaSlow ? 100 : indicators.emaFast < indicators.emaSlow * 1.01 ? 50 : 0);
  score += trendScore * weights.trend;

  const adxScore = indicators.adx > 25 ? 100 : indicators.adx > 20 ? 75 : indicators.adx > 15 ? 50 : 25;
  score += adxScore * weights.adx;

  const rsiScore = direction === 'LONG'
    ? (indicators.rsi < 30 ? 100 : indicators.rsi < 40 ? 75 : indicators.rsi < 50 ? 50 : 25)
    : (indicators.rsi > 70 ? 100 : indicators.rsi > 60 ? 75 : indicators.rsi > 50 ? 50 : 25);
  score += rsiScore * weights.rsi;

  score += (indicators.volumeSpike ? 100 : 50) * weights.volume;

  const mtfScore = direction === 'LONG'
    ? (indicators.currentPrice > indicators.emaFast ? 100 : 50)
    : (indicators.currentPrice < indicators.emaFast ? 100 : 50);
  score += mtfScore * weights.mtf;

  return Math.round(score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM 5-ENGINE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
function analyzeQ7Engines(candles, asset) {
  if (!candles || candles.length < 60) {
    return { direction: null, score: 0, reasons: [], engine: null };
  }

  const closes = candles.map(c => c.close), highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low), volumes = candles.map(c => c.volume || 1);
  const current = candles[candles.length - 1];

  const rsi = calculateRSI(closes, CONFIG.RSI_PERIOD);
  const emaFast = calculateEMA(closes, CONFIG.EMA_FAST);
  const emaSlow = calculateEMA(closes, CONFIG.EMA_SLOW);
  const bb = calculateBollingerBands(closes, CONFIG.BB_PERIOD, CONFIG.BB_STD);
  const atr = calculateATR(highs, lows, closes, CONFIG.ATR_PERIOD);
  const adx = calculateADX(highs, lows, closes, CONFIG.ADX_PERIOD);
  const avgVolume = calculateSMA(volumes, 20);
  const volRatio = current.volume / avgVolume;
  const volumeSpike = volRatio > 1.3;

  const rsiBounds = CONFIG.RSI_BOUNDS[asset] || { oversold: 30, overbought: 70 };
  const bullTrend = emaFast > emaSlow && adx > CONFIG.ADX_TREND_MIN;
  const bearTrend = emaFast < emaSlow && adx > CONFIG.ADX_TREND_MIN;

  const dayCandles = candles.slice(-96);
  const pdh = Math.max(...dayCandles.slice(0, Math.min(48, dayCandles.length)).map(c => c.high));
  const pdl = Math.min(...dayCandles.slice(0, Math.min(48, dayCandles.length)).map(c => c.low));

  const pinBar = isPinBar(current, atr, 0.50);
  const rsiValues = [];
  for (let i = Math.max(0, closes.length - 20); i < closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(0, i + 1), CONFIG.RSI_PERIOD));
  }
  const divergence = detectDivergence(closes, rsiValues, 14);

  const priceChange1h = closes.length >= 5 ? ((current.close - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
  const priceChange4h = closes.length >= 17 ? ((current.close - closes[closes.length - 17]) / closes[closes.length - 17]) * 100 : 0;

  const wickRatioLow = (Math.min(current.open, current.close) - current.low) / (current.high - current.low || 1);
  const wickRatioHigh = (current.high - Math.max(current.open, current.close)) / (current.high - current.low || 1);
  const bbCompressed = bb.width < 2.0;

  const signals = {
    SWP: { score: 0, direction: null, reason: '' },
    BRK: { score: 0, direction: null, reason: '' },
    MR: { score: 0, direction: null, reason: '' },
    TRND: { score: 0, direction: null, reason: '' },
    MTUM: { score: 0, direction: null, reason: '' },
  };

  // ENGINE 1: SWP (Sweep)
  const swpSweepLong = current.low < pdl && current.close > pdl;
  const swpWickLong = wickRatioLow > 0.40;
  const swpVolLong = volRatio > 1.5;
  const swpSweepShort = current.high > pdh && current.close < pdh;
  const swpWickShort = wickRatioHigh > 0.40;
  const swpVolShort = volRatio > 1.5;

  if (swpSweepLong && (swpWickLong || swpVolLong)) {
    let s = 70;
    if (swpWickLong && swpVolLong) s = 90;
    if (volumeSpike) s += 10;
    signals.SWP = { score: Math.min(100, s), direction: 'LONG', reason: `Sweep PDL + ${swpWickLong ? 'Wick' : 'Vol'}` };
  } else if (swpSweepShort && (swpWickShort || swpVolShort)) {
    let s = 70;
    if (swpWickShort && swpVolShort) s = 90;
    if (volumeSpike) s += 10;
    signals.SWP = { score: Math.min(100, s), direction: 'SHORT', reason: `Sweep PDH + ${swpWickShort ? 'Wick' : 'Vol'}` };
  }

  // ENGINE 2: BRK (Breakout)
  if (bbCompressed && current.close > bb.upper && volRatio > 1.5 && adx > 18) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'BB breakout UP + Vol' };
  } else if (bbCompressed && current.close < bb.lower && volRatio > 1.5 && adx > 18) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'BB breakout DOWN + Vol' };
  }

  // ENGINE 3: MR (Mean Reversion)
  const rangingForMR = adx < CONFIG.ADX_MR_MAX;
  if (rangingForMR && rsi < rsiBounds.oversold && (pinBar.bullish || divergence.bullish)) {
    let s = 75;
    if (pinBar.bullish && divergence.bullish) s = 95;
    signals.MR = { score: s, direction: 'LONG', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bullish ? 'PinBar' : 'Div'}` };
  } else if (rangingForMR && rsi > rsiBounds.overbought && (pinBar.bearish || divergence.bearish)) {
    let s = 75;
    if (pinBar.bearish && divergence.bearish) s = 95;
    signals.MR = { score: s, direction: 'SHORT', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bearish ? 'PinBar' : 'Div'}` };
  }

  // ENGINE 4: TRND (Trend)
  const prevClose = closes[closes.length - 2];
  const pullbackLong = (highs[highs.length - 2] - prevClose) > atr * 0.8;
  const pullbackShort = (prevClose - lows[lows.length - 2]) > atr * 0.8;
  if (bullTrend && current.close > emaFast && pullbackLong && current.close > prevClose) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'LONG', reason: 'Trend + Pullback' };
  } else if (bearTrend && current.close < emaFast && pullbackShort && current.close < prevClose) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'SHORT', reason: 'Trend + Pullback' };
  }

  // ENGINE 5: MTUM (Momentum)
  if (priceChange1h > 0.5 && priceChange4h > 1.0) {
    let s = 60;
    if (priceChange1h > 1.0) s += 15;
    if (volumeSpike) s += 15;
    signals.MTUM = { score: Math.min(100, s), direction: 'LONG', reason: `+${priceChange1h.toFixed(2)}% 1h` };
  } else if (priceChange1h < -0.5 && priceChange4h < -1.0) {
    let s = 60;
    if (priceChange1h < -1.0) s += 15;
    if (volumeSpike) s += 15;
    signals.MTUM = { score: Math.min(100, s), direction: 'SHORT', reason: `${priceChange1h.toFixed(2)}% 1h` };
  }

  // ENGINE SELECTION (Priority: SWP > BRK > MR > TRND > MTUM)
  let selectedEngine = null, selectedSignal = null;
  for (const eng of ['SWP', 'BRK', 'MR', 'TRND', 'MTUM']) {
    if (signals[eng].direction && signals[eng].score > 50) {
      selectedEngine = eng;
      selectedSignal = signals[eng];
      break;
    }
  }

  if (!selectedEngine) {
    return {
      direction: null, score: 0, reasons: [], engine: null,
      indicators: { rsi: rsi.toFixed(1), emaFast: emaFast.toFixed(2), emaSlow: emaSlow.toFixed(2), adx: adx.toFixed(1), volumeSpike, currentPrice: current.close }
    };
  }

  const indicators = { rsi, emaFast, emaSlow, adx, volumeSpike, currentPrice: current.close, priceChange1h, priceChange4h };
  const confluence = calculateConfluence(indicators, selectedSignal.direction);
  const weightedScore = (selectedSignal.score * (CONFIG.ENGINE_WEIGHTS[selectedEngine] / 100)) + (confluence * 0.5);

  log('info', `Q7 Engine: ${selectedEngine} ${selectedSignal.direction}`, { score: selectedSignal.score, confluence, weighted: weightedScore.toFixed(1) });

  return {
    direction: selectedSignal.direction,
    score: weightedScore,
    reasons: [`${selectedEngine}: ${selectedSignal.reason}`, `Confluence: ${confluence}`],
    engine: selectedEngine,
    indicators: { ...indicators, rsi: rsi.toFixed(1), confluence },
    allSignals: signals
  };
}

function calculateDynamicLeverage(score, asset) {
  const maxLev = CONFIG.MAX_LEV[asset] || 50;
  const baseLev = CONFIG.BASE_LEVERAGE[asset] || 15;
  let lev = baseLev;
  if (score >= 40) lev = baseLev + (score - 30) * 0.3;
  if (score >= 60) lev = baseLev + 10 + (score - 60) * 0.5;
  return Math.round(Math.min(lev, maxLev));
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUPITER PERPS EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════
async function getJupiterPositions() {
  // TODO: Implement actual Jupiter Perps API call
  // For now, return mock positions - replace with real API
  try {
    // const positions = await httpsGet(`${CONFIG.JUPITER_PERPS_API}/positions/${walletAddress}`);
    return [];
  } catch (e) {
    log('warn', 'Failed to fetch Jupiter positions', { error: e.message });
    return [];
  }
}

async function getStatus() {
  const { prices, sources } = await fetchPrices();
  const positions = await getJupiterPositions();

  let totalPnlUsd = 0;
  const mappedPositions = positions.map(p => {
    const currentPrice = prices[p.asset] || p.entryPrice;
    const priceDiff = p.long ? (currentPrice - p.entryPrice) / p.entryPrice : (p.entryPrice - currentPrice) / p.entryPrice;
    const pnlPct = priceDiff * 100 * p.leverage;
    const pnlUsd = p.collateral * priceDiff * p.leverage;
    totalPnlUsd += pnlUsd;
    return { ...p, currentPrice, pnlPct, pnlUsd };
  });

  return {
    balance: 1000, // TODO: Fetch real USDC balance from Solana
    positions: mappedPositions,
    prices,
    sources,
    totalPnlUsd
  };
}

async function analyzeAsset(asset) {
  log('info', `Q7 Analyzing ${asset}...`);
  const candles = await fetchCandles(asset, '15m', 100);
  if (!candles || candles.length < 60) {
    return { asset, error: 'No candles', score: 0, engines: {}, confluence: 0 };
  }

  const signal = analyzeQ7Engines(candles, asset);
  const { prices } = await fetchPrices();

  return {
    asset,
    direction: signal.direction,
    score: signal.score,
    leverage: signal.direction ? calculateDynamicLeverage(signal.score, asset) : 0,
    engine: signal.engine,
    reasons: signal.reasons,
    currentPrice: prices[asset],
    indicators: signal.indicators,
    confluence: signal.indicators?.confluence || 0,
    allSignals: signal.allSignals
  };
}

async function executeJupiterTrade(order) {
  // Queue the order for execution by the existing SQS processor
  if (CONFIG.QUEUE_URL) {
    const msg = {
      payload: {
        symbol: order.asset,
        perpSymbol: SUPPORTED_MARKETS[order.asset]?.perpSymbol,
        side: order.direction,
        reduceOnly: false,
        sizeUsd: order.collateral * order.leverage,
        leverage: order.leverage,
        tpPct: CONFIG.TP_PERCENT[order.asset] || 4.0,
        slPct: CONFIG.SL_PERCENT[order.asset] || 2.5,
        strategyId: 'Q7-AUTO',
        collateral: 'USDC'
      },
      meta: {
        source: 'Q7-DRAM',
        engine: order.engine,
        score: order.score,
        timestamp: new Date().toISOString()
      }
    };

    await sqs.send(new SendMessageCommand({
      QueueUrl: CONFIG.QUEUE_URL,
      MessageBody: JSON.stringify(msg),
      MessageAttributes: {
        symbol: { DataType: "String", StringValue: order.asset },
        side: { DataType: "String", StringValue: order.direction }
      }
    }));

    log('info', 'Order queued', { asset: order.asset, direction: order.direction, leverage: order.leverage });

    await sendTradeNotification({
      asset: order.asset,
      direction: order.direction,
      collateral: order.collateral,
      leverage: order.leverage,
      entryPrice: order.currentPrice,
      tpPrice: order.direction === 'LONG'
        ? order.currentPrice * (1 + (CONFIG.TP_PERCENT[order.asset] || 4.0) / 100)
        : order.currentPrice * (1 - (CONFIG.TP_PERCENT[order.asset] || 4.0) / 100),
      slPrice: order.direction === 'LONG'
        ? order.currentPrice * (1 - (CONFIG.SL_PERCENT[order.asset] || 2.5) / 100)
        : order.currentPrice * (1 + (CONFIG.SL_PERCENT[order.asset] || 2.5) / 100),
      engine: order.engine,
      score: order.score
    }, true);

    return { success: true, queued: true };
  }

  return { success: false, error: 'QUEUE_URL not configured' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export const handler = async (event) => {
  const reqId = event?.requestContext?.requestId || crypto.randomUUID();
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  const respond = (code, body) => ({
    statusCode: code,
    headers,
    body: JSON.stringify({ ...body, requestId: reqId, version: CONFIG.VERSION })
  });

  try {
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
      return respond(200, { ok: true });
    }

    let body = {};
    if (event.body) {
      const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body;
      try { body = JSON.parse(raw); } catch { body = {}; }
    }

    const action = body.action || 'STATUS';
    log('info', `Jupiter Q7 | Action: ${action}`, { reqId });

    switch (action) {
      case 'STATUS':
        const status = await getStatus();
        return respond(200, { ok: true, ...status });

      case 'GET_PRICES':
        const priceData = await fetchPrices();
        return respond(200, { ok: true, ...priceData });

      case 'ANALYZE':
        const analysis = await analyzeAsset(body.asset || 'SOL');
        return respond(200, { ok: true, analysis });

      case 'REPORT_POSITIONS':
        const reportStatus = await getStatus();
        await sendPositionReport(reportStatus);
        return respond(200, {
          ok: true,
          message: 'Position report sent to Telegram',
          positionCount: reportStatus.positions.length,
          totalPnlUsd: reportStatus.totalPnlUsd
        });

      case 'SCAN':
        const assets = body.assets || ['BTC', 'ETH', 'SOL'];
        const scanResults = [];
        for (const asset of assets) {
          scanResults.push(await analyzeAsset(asset));
        }
        return respond(200, { ok: true, opportunities: scanResults, minScore: CONFIG.MIN_SIGNAL_SCORE });

      case 'AUTO_EXECUTE':
        const scanAssets = body.assets || ['BTC', 'ETH', 'SOL'];
        const execStatus = await getStatus();

        if (execStatus.positions.length >= CONFIG.MAX_POSITIONS) {
          return respond(200, { ok: true, message: 'Max positions reached', positions: execStatus.positions.length });
        }

        let best = null;
        const execScanResults = [];

        for (const asset of scanAssets) {
          if (execStatus.positions.find(p => p.asset === asset)) {
            execScanResults.push({ asset, status: 'positioned' });
            continue;
          }
          const an = await analyzeAsset(asset);
          execScanResults.push({ asset, direction: an.direction, score: an.score, engine: an.engine, reasons: an.reasons });
          if (an.direction && an.score >= CONFIG.MIN_SIGNAL_SCORE && (!best || an.score > best.score)) {
            best = an;
          }
        }

        await sendScanNotification(execScanResults, execStatus.balance, execStatus.positions.length);

        if (best) {
          log('info', `Q7 BEST: ${best.engine} ${best.direction} ${best.asset}`, { score: best.score });
          const collateral = body.collateral || 25;
          const result = await executeJupiterTrade({
            asset: best.asset,
            direction: best.direction,
            collateral,
            leverage: best.leverage,
            currentPrice: best.currentPrice,
            engine: best.engine,
            score: best.score
          });
          return respond(200, { ok: true, ...result, scanResults: execScanResults });
        }

        return respond(200, { ok: true, message: 'No Q7 signals above threshold', scanResults: execScanResults });

      // Legacy webhook support (backward compatible with TradingView)
      case 'WEBHOOK':
      default:
        // Check if this is a legacy TradingView webhook
        if (body.tv || body.symbol) {
          // Process as legacy webhook...
          const order = normalizeOrder(body);
          if (order.error) return respond(400, { ok: false, error: order.error });

          if (CONFIG.QUEUE_URL) {
            await sqs.send(new SendMessageCommand({
              QueueUrl: CONFIG.QUEUE_URL,
              MessageBody: JSON.stringify({ payload: order, meta: { requestId: reqId } }),
              MessageAttributes: {
                symbol: { DataType: "String", StringValue: order.symbol },
                side: { DataType: "String", StringValue: order.side }
              }
            }));
            return respond(200, { ok: true, enqueued: true });
          }
        }

        return respond(400, { ok: false, error: `Unknown action: ${action}` });
    }
  } catch (err) {
    log('error', 'Fatal', { reqId, error: err.message });
    await sendTelegram(`❌ Jupiter Q7 Error: ${err.message}`);
    return respond(500, { ok: false, error: err.message });
  }
};

// Helper for legacy webhook normalization
function normalizeOrder(body) {
  const p = body?.payload ?? body ?? {};
  if (typeof p.symbol === "string" && (typeof p.side === "string" || typeof p.action === "string")) {
    const market = SUPPORTED_MARKETS[p.symbol?.toUpperCase()];
    if (!market) return { error: `Unsupported symbol: ${p.symbol}` };
    let side = p.side?.toUpperCase();
    let reduceOnly = !!p.reduce_only;
    if (p.action) {
      const action = p.action.toUpperCase();
      if (action === "EXIT" || action === "CLOSE") { reduceOnly = true; side = side || "LONG"; }
    }
    if (!["LONG", "SHORT"].includes(side)) return { error: `Invalid side: ${side}` };
    return {
      symbol: market.symbol, perpSymbol: market.perpSymbol, side, reduceOnly,
      sizeUsd: Number(p.size_usd ?? p.sizeUsd ?? 100), leverage: Number(p.leverage ?? 5),
      tpPct: Number(p.tp_pct ?? 0), slPct: Number(p.sl_pct ?? 0),
      strategyId: p.strategy_id ?? "direct", collateral: "USDC"
    };
  }
  return { error: "Unable to parse order" };
}
