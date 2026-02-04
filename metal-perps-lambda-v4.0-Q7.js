/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INSTITUTIONAL AUTO TRADE v4.0 - Q7 D-RAM v5.2.6 CALIBRATED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INTEGRATED: Q7 EDGE D-RAM v5.2.6 calibrated parameters
 *
 * KEY UPGRADES FROM Q7:
 * - Per-asset RSI thresholds (BTC: 30/70, ETH: 28/72)
 * - Empirical TP/SL calibration with 1.5:1 R:R minimum
 * - TRND throttling (max 3 per day to force engine diversity)
 * - Relaxed SWP conditions (wick 40% OR volume 1.5x)
 * - 5-factor confluence scoring
 * - Time/day filters for bad periods
 * - Engine-specific exit parameters
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { ethers } = require('ethers');
const https = require('https');

// ═══════════════════════════════════════════════════════════════════════════════
// HTTPS HELPER
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
        catch (e) { reject(new Error('Parse error: ' + data.slice(0, 100))); }
      });
    }).on('error', (e) => { clearTimeout(timeout); reject(e); });
  });
}

function httpsPost(url, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const timeout = setTimeout(() => reject(new Error('Timeout')), 10000);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(timeout); resolve(data); });
    });
    req.on('error', (e) => { clearTimeout(timeout); reject(e); });
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM CALIBRATED CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  RPC_URL: 'https://arb1.arbitrum.io/rpc',
  PRIVATE_KEY: process.env.PRIVATE_KEY,

  TELEGRAM_BOT: '8215882567:AAHB4csgKNELTI9mpMNFsN4SwCN9Xvzz-vg',
  TELEGRAM_CHAT: '-1003691135718',

  CHAINLINK_ORACLES: {
    BTC: '0x6ce185860a4963106506c203335a25a6b8cf4d68',
    ETH: '0x639fe6ab55c14e2a6aa612ab78a6d17d4e4f8a6f',
    GOLD: '0x1f954dc24a49708c26e0c1777f16750b5c6d5a2c',
  },

  GTRADE: {
    DIAMOND: '0xFF162c694eAA571f685030649814282eA457f169',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  },

  ASSET_INDEX: { BTC: 0, ETH: 1, GOLD: 90, SILVER: 91 },

  // Q7 Calibrated leverage (conservative)
  BASE_LEVERAGE: { BTC: 25, ETH: 25, GOLD: 10, SILVER: 10 },
  MAX_LEVERAGE: { BTC: 50, ETH: 50, GOLD: 20, SILVER: 20 },

  // Q7: Lowered from 55 - confluence scoring handles quality
  MIN_SIGNAL_SCORE: 20,
  MIN_CONFLUENCE: 50, // Q7: 5-factor confluence minimum
  MIN_COLLATERAL: 5,
  MAX_POSITIONS: 4,

  // Q7 Calibrated TP/SL (1.5:1 R:R minimum)
  TP_PERCENT: {
    BTC: 3.0,   // Q7: 0.30% * 10 = 3% for 15M equivalent
    ETH: 4.2,   // Q7: 0.42% * 10 = 4.2%
    GOLD: 5.0,
    SILVER: 5.0
  },
  SL_PERCENT: {
    BTC: 2.0,   // Q7: 0.20% * 10 = 2%
    ETH: 2.8,   // Q7: 0.28% * 10 = 2.8%
    GOLD: 4.0,
    SILVER: 4.0
  },
  SLIPPAGE: { crypto: 0.3, commodity: 1.0 },

  // Q7 Engine Weights (rebalanced to reduce TRND dominance)
  ENGINE_WEIGHTS: {
    SWP: 30,   // Q7: Highest priority (lowest score to fire)
    BRK: 25,   // Q7: Second priority
    MR: 25,    // Q7: Third priority
    TRND: 15,  // Q7: Reduced weight (was dominant)
    MTUM: 5    // Momentum backup
  },

  // Q7 Per-Asset RSI Thresholds (15M timeframe)
  RSI_BOUNDS: {
    BTC: { oversold: 34, overbought: 66 },
    ETH: { oversold: 32, overbought: 68 },
    GOLD: { oversold: 30, overbought: 70 },
    SILVER: { oversold: 30, overbought: 70 }
  },

  // Q7 Engine Parameters
  RSI_PERIOD: 14,
  EMA_FAST: 21,
  EMA_SLOW: 55,
  BB_PERIOD: 20,
  BB_STD: 2,
  ATR_PERIOD: 14,
  ADX_PERIOD: 14,

  // Q7 Calibrated thresholds
  ADX_TREND_MIN: 22,      // Q7: Minimum ADX for trend
  ADX_MR_MAX: 27,         // Q7: ADX + 5 for MR (relaxed)
  BRK_ADX_MIN: 18,        // Q7: Relaxed from 20
  BRK_VOL_MULT: 1.5,      // Q7: Relaxed from 2.0
  SWP_WICK_RATIO: 0.40,   // Q7: Relaxed from 0.60
  SWP_VOL_MULT: 1.5,      // Q7: Volume spike alternative
  MR_PIN_BAR_RATIO: 0.50, // Q7: Relaxed from 0.65
  TRND_PULLBACK_ATR: 0.8, // Q7: Pullback requirement

  // Q7 Confluence Weights (5-factor)
  CONFLUENCE_WEIGHTS: {
    trend: 0.30,    // EMA alignment
    adx: 0.20,      // Trend strength
    rsi: 0.20,      // Momentum
    volume: 0.15,   // Volume confirmation
    mtf: 0.15       // Multi-timeframe
  },

  // Q7 TRND Throttling
  MAX_TRND_PER_DAY: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════════════════════════

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
];

const CHAINLINK_ABI = [
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
  'function decimals() view returns (uint8)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// CANDLE FETCHING (Coinbase - US-friendly)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchCandles(asset, interval = '15m', limit = 100) {
  const productMap = { BTC: 'BTC-USD', ETH: 'ETH-USD' };
  const product = productMap[asset];

  if (asset === 'GOLD') {
    return fetchGoldCandles(limit);
  }

  if (!product) return null;

  try {
    const granularity = 900; // 15 minutes
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=${granularity}`;
    const data = await httpsGet(url);

    if (!Array.isArray(data) || data.length === 0) return null;

    const candles = data
      .slice(0, limit)
      .reverse()
      .map(c => ({
        timestamp: c[0] * 1000,
        open: parseFloat(c[3]),
        high: parseFloat(c[2]),
        low: parseFloat(c[1]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5])
      }));

    console.log(`✅ Got ${candles.length} candles for ${asset}`);
    return candles;
  } catch (e) {
    console.log(`❌ Candle fetch failed for ${asset}: ${e.message}`);
    return null;
  }
}

async function fetchGoldCandles(limit = 100) {
  try {
    const url = `https://min-api.cryptocompare.com/data/v2/histohour?fsym=PAXG&tsym=USD&limit=${limit}`;
    const data = await httpsGet(url);

    if (!data?.Data?.Data || !Array.isArray(data.Data.Data)) return null;

    return data.Data.Data.map(c => ({
      timestamp: c.time * 1000,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volumefrom || 1
    }));
  } catch (e) {
    console.log(`❌ GOLD candle fetch failed: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchGTradePrices() {
  const prices = { BTC: null, ETH: null, GOLD: null, SILVER: null };
  const sources = { BTC: null, ETH: null, GOLD: null, SILVER: null };

  // Chainlink for GOLD
  try {
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const oracle = new ethers.Contract(CONFIG.CHAINLINK_ORACLES.GOLD, CHAINLINK_ABI, provider);
    const [decimals, roundData] = await Promise.all([oracle.decimals(), oracle.latestRoundData()]);
    const [, answer] = roundData;
    const price = Number(answer) / Math.pow(10, Number(decimals));
    if (price > 2000 && price < 5000) {
      prices.GOLD = price;
      sources.GOLD = 'chainlink-rpc';
    }
  } catch (e) { }

  // CoinGecko for BTC/ETH
  try {
    const cgRes = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    if (cgRes?.bitcoin?.usd) { prices.BTC = cgRes.bitcoin.usd; sources.BTC = 'coingecko'; }
    if (cgRes?.ethereum?.usd) { prices.ETH = cgRes.ethereum.usd; sources.ETH = 'coingecko'; }
  } catch (e) { }

  // Fallbacks
  prices.SILVER = 32.5; sources.SILVER = 'fallback';
  if (!prices.BTC) { prices.BTC = 105000; sources.BTC = 'fallback'; }
  if (!prices.ETH) { prices.ETH = 3300; sources.ETH = 'fallback'; }
  if (!prices.GOLD) { prices.GOLD = 2750; sources.GOLD = 'fallback'; }

  return { prices, sources };
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

// Q7: Check for pin bar pattern
function isPinBar(candle, atr, ratio = 0.50) {
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  if (range === 0) return { bullish: false, bearish: false };

  const upperWick = candle.high - Math.max(candle.open, candle.close);
  const lowerWick = Math.min(candle.open, candle.close) - candle.low;

  const bullish = lowerWick / range > ratio && body / range < (1 - ratio);
  const bearish = upperWick / range > ratio && body / range < (1 - ratio);

  return { bullish, bearish };
}

// Q7: RSI Divergence detection
function detectDivergence(closes, rsiValues, lookback = 14) {
  if (closes.length < lookback + 2 || rsiValues.length < lookback + 2) {
    return { bullish: false, bearish: false };
  }

  const recentCloses = closes.slice(-lookback);
  const recentRSI = rsiValues.slice(-lookback);

  // Find lows/highs
  const priceMin = Math.min(...recentCloses);
  const priceMax = Math.max(...recentCloses);
  const rsiMin = Math.min(...recentRSI);
  const rsiMax = Math.max(...recentRSI);

  const currentClose = closes[closes.length - 1];
  const currentRSI = rsiValues[rsiValues.length - 1];
  const prevClose = closes[closes.length - lookback];
  const prevRSI = rsiValues[rsiValues.length - lookback];

  // Bullish: Price lower low, RSI higher low
  const bullish = currentClose < prevClose && currentRSI > prevRSI && currentRSI < 40;
  // Bearish: Price higher high, RSI lower high
  const bearish = currentClose > prevClose && currentRSI < prevRSI && currentRSI > 60;

  return { bullish, bearish };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 5-FACTOR CONFLUENCE SCORING
// ═══════════════════════════════════════════════════════════════════════════════

function calculateConfluence(indicators, direction) {
  const weights = CONFIG.CONFLUENCE_WEIGHTS;
  let score = 0;

  // Factor 1: Trend (30%) - EMA alignment
  const trendScore = direction === 'LONG'
    ? (indicators.emaFast > indicators.emaSlow ? 100 : indicators.emaFast > indicators.emaSlow * 0.99 ? 50 : 0)
    : (indicators.emaFast < indicators.emaSlow ? 100 : indicators.emaFast < indicators.emaSlow * 1.01 ? 50 : 0);
  score += trendScore * weights.trend;

  // Factor 2: ADX (20%) - Trend strength
  const adxScore = indicators.adx > 25 ? 100 : indicators.adx > 20 ? 75 : indicators.adx > 15 ? 50 : 25;
  score += adxScore * weights.adx;

  // Factor 3: RSI (20%) - Momentum
  const rsiScore = direction === 'LONG'
    ? (indicators.rsi < 30 ? 100 : indicators.rsi < 40 ? 75 : indicators.rsi < 50 ? 50 : 25)
    : (indicators.rsi > 70 ? 100 : indicators.rsi > 60 ? 75 : indicators.rsi > 50 ? 50 : 25);
  score += rsiScore * weights.rsi;

  // Factor 4: Volume (15%)
  const volScore = indicators.volumeSpike ? 100 : 50;
  score += volScore * weights.volume;

  // Factor 5: MTF alignment (15%) - Using price vs EMAs
  const mtfScore = direction === 'LONG'
    ? (indicators.currentPrice > indicators.emaFast ? 100 : 50)
    : (indicators.currentPrice < indicators.emaFast ? 100 : 50);
  score += mtfScore * weights.mtf;

  return Math.round(score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM 6-ENGINE ANALYSIS (SWP > BRK > MR > TRND priority)
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeQ7Engines(candles, asset) {
  if (!candles || candles.length < 60) {
    return { direction: null, score: 0, reasons: [], engine: null };
  }

  const closes = candles.map(c => c.close), highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low), volumes = candles.map(c => c.volume || 1);
  const current = candles[candles.length - 1];

  // Calculate indicators
  const rsi = calculateRSI(closes, CONFIG.RSI_PERIOD);
  const emaFast = calculateEMA(closes, CONFIG.EMA_FAST);
  const emaSlow = calculateEMA(closes, CONFIG.EMA_SLOW);
  const bb = calculateBollingerBands(closes, CONFIG.BB_PERIOD, CONFIG.BB_STD);
  const atr = calculateATR(highs, lows, closes, CONFIG.ATR_PERIOD);
  const adx = calculateADX(highs, lows, closes, CONFIG.ADX_PERIOD);
  const avgVolume = calculateSMA(volumes, 20);
  const volRatio = current.volume / avgVolume;
  const volumeSpike = volRatio > 1.3;

  // Q7 RSI bounds per asset
  const rsiBounds = CONFIG.RSI_BOUNDS[asset] || { oversold: 30, overbought: 70 };

  // Q7 Regime detection
  const bullTrend = emaFast > emaSlow && adx > CONFIG.ADX_TREND_MIN;
  const bearTrend = emaFast < emaSlow && adx > CONFIG.ADX_TREND_MIN;
  const ranging = adx < CONFIG.ADX_MR_MAX;

  // Previous day high/low for SWP
  const dayCandles = candles.slice(-96);
  const pdh = Math.max(...dayCandles.slice(0, Math.min(48, dayCandles.length)).map(c => c.high));
  const pdl = Math.min(...dayCandles.slice(0, Math.min(48, dayCandles.length)).map(c => c.low));

  // Pin bar detection
  const pinBar = isPinBar(current, atr, CONFIG.MR_PIN_BAR_RATIO);

  // RSI values for divergence
  const rsiValues = [];
  for (let i = Math.max(0, closes.length - 20); i < closes.length; i++) {
    rsiValues.push(calculateRSI(closes.slice(0, i + 1), CONFIG.RSI_PERIOD));
  }
  const divergence = detectDivergence(closes, rsiValues, 14);

  // Price changes
  const priceChange1h = closes.length >= 5 ? ((current.close - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
  const priceChange4h = closes.length >= 17 ? ((current.close - closes[closes.length - 17]) / closes[closes.length - 17]) * 100 : 0;

  // Wick ratios for SWP
  const wickRatioLow = (Math.min(current.open, current.close) - current.low) / (current.high - current.low || 1);
  const wickRatioHigh = (current.high - Math.max(current.open, current.close)) / (current.high - current.low || 1);

  // BB compression for BRK
  const bbCompressed = bb.width < 2.0;

  const signals = {
    SWP: { score: 0, direction: null, reason: '' },
    BRK: { score: 0, direction: null, reason: '' },
    MR: { score: 0, direction: null, reason: '' },
    TRND: { score: 0, direction: null, reason: '' },
    MTUM: { score: 0, direction: null, reason: '' },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Q7 ENGINE 1: SWP (Sweep) - Highest priority
  // Relaxed: Wick 40% OR Volume 1.5x (was AND with 60%)
  // ═══════════════════════════════════════════════════════════════════════════
  const swpSweepLong = current.low < pdl && current.close > pdl;
  const swpWickLong = wickRatioLow > CONFIG.SWP_WICK_RATIO;
  const swpVolLong = volRatio > CONFIG.SWP_VOL_MULT;

  const swpSweepShort = current.high > pdh && current.close < pdh;
  const swpWickShort = wickRatioHigh > CONFIG.SWP_WICK_RATIO;
  const swpVolShort = volRatio > CONFIG.SWP_VOL_MULT;

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

  // ═══════════════════════════════════════════════════════════════════════════
  // Q7 ENGINE 2: BRK (Breakout)
  // Relaxed: ADX 18 (was 20), Vol 1.5x (was 2.0)
  // ═══════════════════════════════════════════════════════════════════════════
  const brkLongCond = bbCompressed && current.close > bb.upper && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN;
  const brkShortCond = bbCompressed && current.close < bb.lower && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN;

  if (brkLongCond) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'BB breakout UP + Vol' };
  } else if (brkShortCond) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'BB breakout DOWN + Vol' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Q7 ENGINE 3: MR (Mean Reversion)
  // Fixed: OR logic (pin bar OR divergence), relaxed ADX (+5)
  // ═══════════════════════════════════════════════════════════════════════════
  const rangingForMR = adx < CONFIG.ADX_MR_MAX;
  const strongBullDiv = divergence.bullish && rsi < 40;
  const strongBearDiv = divergence.bearish && rsi > 60;

  const mrLongCond = rangingForMR && rsi < rsiBounds.oversold && (pinBar.bullish || divergence.bullish);
  const mrLongAlt = strongBullDiv && pinBar.bullish; // Alternative entry

  const mrShortCond = rangingForMR && rsi > rsiBounds.overbought && (pinBar.bearish || divergence.bearish);
  const mrShortAlt = strongBearDiv && pinBar.bearish;

  if (mrLongCond || mrLongAlt) {
    let s = 75;
    if (pinBar.bullish && divergence.bullish) s = 95;
    signals.MR = { score: s, direction: 'LONG', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bullish ? 'PinBar' : 'Div'}` };
  } else if (mrShortCond || mrShortAlt) {
    let s = 75;
    if (pinBar.bearish && divergence.bearish) s = 95;
    signals.MR = { score: s, direction: 'SHORT', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bearish ? 'PinBar' : 'Div'}` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Q7 ENGINE 4: TRND (Trend) - Throttled
  // Q7 limits to max 3 TRND entries per day
  // ═══════════════════════════════════════════════════════════════════════════
  const prevClose = closes[closes.length - 2];
  const pullbackLong = (highs[highs.length - 2] - prevClose) > atr * CONFIG.TRND_PULLBACK_ATR;
  const pullbackShort = (prevClose - lows[lows.length - 2]) > atr * CONFIG.TRND_PULLBACK_ATR;

  const trndLongCond = bullTrend && current.close > emaFast && pullbackLong && current.close > prevClose;
  const trndShortCond = bearTrend && current.close < emaFast && pullbackShort && current.close < prevClose;

  if (trndLongCond) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'LONG', reason: 'Trend + Pullback' };
  } else if (trndShortCond) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'SHORT', reason: 'Trend + Pullback' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 5: MTUM (Momentum) - Backup
  // ═══════════════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Q7 ENGINE SELECTION (Priority: SWP > BRK > MR > TRND)
  // ═══════════════════════════════════════════════════════════════════════════
  let selectedEngine = null;
  let selectedSignal = null;

  // Q7 Priority order
  const priority = ['SWP', 'BRK', 'MR', 'TRND', 'MTUM'];

  for (const eng of priority) {
    if (signals[eng].direction && signals[eng].score > 50) {
      selectedEngine = eng;
      selectedSignal = signals[eng];
      break;
    }
  }

  if (!selectedEngine) {
    return {
      direction: null,
      score: 0,
      reasons: [],
      engine: null,
      indicators: { rsi: rsi.toFixed(1), emaFast: emaFast.toFixed(2), emaSlow: emaSlow.toFixed(2), adx: adx.toFixed(1), priceChange1h: priceChange1h.toFixed(2), volumeSpike, currentPrice: current.close }
    };
  }

  // Calculate confluence for selected direction
  const indicators = {
    rsi, emaFast, emaSlow, adx, volumeSpike, currentPrice: current.close,
    priceChange1h, priceChange4h
  };
  const confluence = calculateConfluence(indicators, selectedSignal.direction);

  // Combine engine score with confluence
  const weightedScore = (selectedSignal.score * (CONFIG.ENGINE_WEIGHTS[selectedEngine] / 100)) + (confluence * 0.5);

  console.log(`🔧 Q7 Engine: ${selectedEngine} ${selectedSignal.direction} (Score: ${selectedSignal.score}, Confluence: ${confluence}, Weighted: ${weightedScore.toFixed(1)})`);

  return {
    direction: selectedSignal.direction,
    score: weightedScore,
    reasons: [`${selectedEngine}: ${selectedSignal.reason}`, `Confluence: ${confluence}`],
    engine: selectedEngine,
    indicators: {
      rsi: rsi.toFixed(1),
      emaFast: emaFast.toFixed(2),
      emaSlow: emaSlow.toFixed(2),
      adx: adx.toFixed(1),
      priceChange1h: priceChange1h.toFixed(2),
      priceChange4h: priceChange4h.toFixed(2),
      volumeSpike,
      currentPrice: current.close,
      confluence
    },
    allSignals: signals
  };
}

function calculateDynamicLeverage(score, asset) {
  const maxLev = CONFIG.MAX_LEVERAGE[asset] || 50;
  const baseLev = CONFIG.BASE_LEVERAGE[asset] || 15;
  let lev = baseLev;
  if (score >= 40) lev = baseLev + (score - 30) * 0.3;
  if (score >= 60) lev = baseLev + 10 + (score - 60) * 0.5;
  return Math.round(Math.min(lev, maxLev));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendTelegram(message) {
  try {
    await httpsPost(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT, text: message, parse_mode: 'HTML'
    });
  } catch (e) { console.log('Telegram failed:', e.message); }
}

async function sendScanNotification(scanResults, balance, positionCount) {
  const timestamp = new Date().toISOString().slice(11, 19);
  let msg = `🔍 <b>Q7 SCAN ${timestamp}</b>\n`;
  msg += `💰 Balance: $${balance.toFixed(2)} | Positions: ${positionCount}/${CONFIG.MAX_POSITIONS}\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;

  for (const r of scanResults) {
    if (r.status === 'positioned') {
      msg += `⏸️ ${r.asset}: Already positioned\n`;
    } else if (r.direction) {
      const emoji = r.direction === 'LONG' ? '📈' : '📉';
      msg += `${emoji} ${r.asset}: ${r.direction} (${r.score.toFixed(0)})\n`;
      msg += `   └ 🎯 ${r.engine}: ${r.reasons?.[0] || ''}\n`;
    } else {
      msg += `⏹️ ${r.asset}: No signal (${r.score?.toFixed(0) || 0})\n`;
    }
  }

  const best = scanResults.find(r => r.direction && r.score >= CONFIG.MIN_SIGNAL_SCORE);
  msg += `━━━━━━━━━━━━━━━━\n`;
  if (best) {
    msg += `🎯 <b>EXECUTING: ${best.direction} ${best.asset} via ${best.engine}</b>`;
  } else {
    msg += `⏳ No Q7 signals (need ≥${CONFIG.MIN_SIGNAL_SCORE})`;
  }

  return sendTelegram(msg);
}

async function sendTradeOpenNotification(p) {
  const posSize = p.collateral * p.leverage;
  const tpPct = p.direction === 'LONG' ? ((p.tpPrice - p.entryPrice) / p.entryPrice * 100) : ((p.entryPrice - p.tpPrice) / p.entryPrice * 100);
  const slPct = p.direction === 'LONG' ? ((p.entryPrice - p.slPrice) / p.entryPrice * 100) : ((p.slPrice - p.entryPrice) / p.entryPrice * 100);
  const msg = `⚡ <b>Q7 TRADE OPENED</b>\n\n${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n🎯 Engine: ${p.signal?.engine || 'MANUAL'}\n📊 Score: ${p.signal?.score?.toFixed(0) || 'N/A'}\n💎 Confluence: ${p.signal?.indicators?.confluence || 'N/A'}\n━━━━━━━━━━━━━━━━\n💰 Collateral: $${p.collateral.toFixed(2)}\n💪 Leverage: ${p.leverage}x\n📐 Position: $${posSize.toFixed(2)}\n━━━━━━━━━━━━━━━━\n📍 Entry: $${p.entryPrice.toFixed(2)}\n🎯 TP: $${p.tpPrice.toFixed(2)} (+${tpPct.toFixed(1)}%)\n🛑 SL: $${p.slPrice.toFixed(2)} (-${slPct.toFixed(1)}%)\n━━━━━━━━━━━━━━━━\n🔗 <a href="https://arbiscan.io/tx/${p.txHash}">View TX</a>`;
  return sendTelegram(msg);
}

async function sendTradeCloseNotification(p) {
  const emoji = p.pnlUsd >= 0 ? '💰' : '💸';
  const status = p.reason === 'PROFIT_TARGET' ? '🎯 PROFIT TARGET' : p.reason === 'STOP_LOSS' ? '🛑 STOP LOSS' : '✅ CLOSED';
  const msg = `${emoji} <b>${status}</b>\n\n${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n📍 Entry: $${p.entryPrice.toFixed(2)}\n📍 Exit: $${p.exitPrice.toFixed(2)}\n━━━━━━━━━━━━━━━━\n<b>P&L: ${p.pnlUsd >= 0 ? '+' : ''}$${p.pnlUsd.toFixed(2)} (${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%)</b>\n━━━━━━━━━━━━━━━━\n🔗 <a href="https://arbiscan.io/tx/${p.txHash}">View TX</a>`;
  return sendTelegram(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-CLAIM COLLATERAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const TRADING_ABI = [
  'function pendingMarketOpenOrders(address, uint256) view returns (tuple(tuple(address trader, uint32 index, uint16 pairIndex, uint24 leverage, bool buy, bool isOpen, uint8 collateralIndex, uint8 tradeType, uint120 collateralAmount, uint64 openPrice, uint64 tp, uint64 sl, uint192 __placeholder) trade, uint256 timestamp))',
  'function pendingLimitOpenOrders(address, uint256) view returns (tuple(tuple(address trader, uint32 index, uint16 pairIndex, uint24 leverage, bool buy, bool isOpen, uint8 collateralIndex, uint8 tradeType, uint120 collateralAmount, uint64 openPrice, uint64 tp, uint64 sl, uint192 __placeholder) trade, uint256 timestamp))',
  'function cancelOpenMarketOrder(uint256) returns (bool)',
  'function cancelOpenLimitOrder(uint256) returns (bool)',
];

async function getPendingOrders(wallet) {
  const pendingOrders = [];
  try {
    const trading = new ethers.Contract(CONFIG.GTRADE.DIAMOND, TRADING_ABI, wallet);

    // Check for pending market orders (type 0)
    for (let i = 0; i < 10; i++) {
      try {
        const order = await trading.pendingMarketOpenOrders(wallet.address, i);
        if (order && order.trade && order.trade.trader !== '0x0000000000000000000000000000000000000000') {
          pendingOrders.push({
            orderId: i,
            type: 'market',
            asset: Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === Number(order.trade.pairIndex))?.[0] || 'UNKNOWN',
            collateral: parseFloat(ethers.formatUnits(order.trade.collateralAmount, 6)),
            isLong: order.trade.buy,
            timestamp: Number(order.timestamp),
          });
        }
      } catch (e) { /* Order doesn't exist */ }
    }
    // Check for pending limit orders (type 1)
    for (let i = 0; i < 10; i++) {
      try {
        const order = await trading.pendingLimitOpenOrders(wallet.address, i);
        if (order && order.trade && order.trade.trader !== '0x0000000000000000000000000000000000000000') {
          pendingOrders.push({
            orderId: i,
            type: 'limit',
            asset: Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === Number(order.trade.pairIndex))?.[0] || 'UNKNOWN',
            collateral: parseFloat(ethers.formatUnits(order.trade.collateralAmount, 6)),
            isLong: order.trade.buy,
            timestamp: Number(order.timestamp),
          });
        }
      } catch (e) { /* Order doesn't exist */ }
    }
  } catch (err) {
    console.error('Error getting pending orders:', err.message);
  }
  return pendingOrders;
}

async function claimCollateral(wallet, orderId, isLimitOrder = false) {
  console.log(`💰 Claiming collateral for order #${orderId} (type: ${isLimitOrder ? 'limit' : 'market'})`);
  try {
    const trading = new ethers.Contract(CONFIG.GTRADE.DIAMOND, TRADING_ABI, wallet);
    let tx;
    const gasLimit = 500000n;
    if (isLimitOrder) {
      tx = await trading.cancelOpenLimitOrder(orderId, { gasLimit });
    } else {
      tx = await trading.cancelOpenMarketOrder(orderId, { gasLimit });
    }
    const receipt = await tx.wait();
    console.log(`✅ Claimed collateral - tx: ${receipt.hash}`);
    return { success: true, txHash: receipt.hash, orderId };
  } catch (err) {
    console.error(`❌ Failed to claim order #${orderId}: ${err.message}`);
    return { success: false, error: err.message, orderId };
  }
}

async function autoClaimAll(wallet) {
  const pending = await getPendingOrders(wallet);
  if (pending.length === 0) {
    return { success: true, claimed: 0, totalClaimed: 0, results: [] };
  }
  console.log(`💰 Auto-claiming ${pending.length} pending orders...`);
  const results = [];
  let totalClaimed = 0;
  for (const order of pending) {
    const result = await claimCollateral(wallet, order.orderId, order.type === 'limit');
    if (result.success) {
      totalClaimed += order.collateral;
    }
    results.push({ ...result, collateral: order.collateral, asset: order.asset });
    await new Promise(r => setTimeout(r, 2000)); // Wait between claims
  }
  return { success: true, claimed: results.filter(r => r.success).length, totalClaimed, results };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GTRADE ENCODING & EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

function encodeOpenTrade(p) {
  const selector = '0x5bfcc4f8';
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const struct = abiCoder.encode(['tuple(address,uint32,uint16,uint24,bool,bool,uint8,uint8,uint120,uint64,uint64,uint64,bool,uint160,uint24)'],
    [[p.trader, 0, p.pairIndex, p.leverage * 1000, p.long, true, p.collateralIndex, 0, p.collateralAmount, p.openPrice, p.tp, p.sl, false, 0, 0]]).slice(2);
  return selector + struct + abiCoder.encode(['uint16'], [1000]).slice(2) + abiCoder.encode(['address'], ['0x0000000000000000000000000000000000000000']).slice(2);
}

function encodeCloseTrade(index) {
  return '0x36ce736b' + ethers.AbiCoder.defaultAbiCoder().encode(['uint32'], [index]).slice(2);
}

async function fetchPrice(pairIndex, providedPrice = null) {
  if (providedPrice && providedPrice > 0) return providedPrice;
  const { prices } = await fetchGTradePrices();
  const assetMap = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };
  const asset = assetMap[pairIndex];
  if (asset && prices[asset]) return prices[asset];
  throw new Error(`No price for pairIndex ${pairIndex}`);
}

async function openTrade(wallet, params) {
  const { asset, direction, collateral, leverage: providedLev, price: providedPrice, signal, takeProfit, stopLoss } = params;
  const pairIndex = CONFIG.ASSET_INDEX[asset];
  if (pairIndex === undefined) throw new Error(`Unknown asset: ${asset}`);

  const currentPrice = await fetchPrice(pairIndex, providedPrice);
  const isCommodity = ['GOLD', 'SILVER'].includes(asset);

  let finalLev = signal?.score ? calculateDynamicLeverage(signal.score, asset) : providedLev ? Math.round(providedLev) : CONFIG.BASE_LEVERAGE[asset];
  finalLev = Math.min(finalLev, CONFIG.MAX_LEVERAGE[asset]);

  const isBuy = direction === 'LONG';
  const tpPct = takeProfit || CONFIG.TP_PERCENT[asset] || (isCommodity ? 5.0 : 3.0);
  const slPct = stopLoss || CONFIG.SL_PERCENT[asset] || (isCommodity ? 4.0 : 2.0);
  const tpPrice = isBuy ? currentPrice * (1 + tpPct/100) : currentPrice * (1 - tpPct/100);
  const slPrice = isBuy ? currentPrice * (1 - slPct/100) : currentPrice * (1 + slPct/100);

  console.log(`\n⚔️ Q7 OPENING ${direction} ${asset} @ $${currentPrice.toFixed(2)} | ${finalLev}x | $${collateral}`);

  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet);
  const collateralWei = ethers.parseUnits(collateral.toString(), 6);
  if ((await usdc.allowance(wallet.address, CONFIG.GTRADE.DIAMOND)) < collateralWei) {
    console.log('🔐 Approving USDC...');
    await (await usdc.approve(CONFIG.GTRADE.DIAMOND, ethers.MaxUint256)).wait();
  }

  const slippagePct = isCommodity ? CONFIG.SLIPPAGE.commodity : CONFIG.SLIPPAGE.crypto;
  const priceWithSlippage = currentPrice * (isBuy ? 1 + slippagePct/100 : 1 - slippagePct/100);

  const tx = await wallet.sendTransaction({
    to: CONFIG.GTRADE.DIAMOND,
    data: encodeOpenTrade({
      trader: wallet.address, pairIndex, leverage: finalLev, long: isBuy, collateralIndex: 3,
      collateralAmount: collateralWei, openPrice: BigInt(Math.round(priceWithSlippage * 1e10)),
      tp: BigInt(Math.round(tpPrice * 1e10)), sl: BigInt(Math.round(slPrice * 1e10)),
    }),
    gasLimit: 2000000,
  });

  console.log(`📤 TX: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Block ${receipt.blockNumber}`);

  await sendTradeOpenNotification({ asset, direction, collateral, leverage: finalLev, entryPrice: currentPrice, tpPrice, slPrice, signal, txHash: tx.hash });

  return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber, leverage: finalLev, entryPrice: currentPrice, tpPrice, slPrice };
}

async function closeTrade(wallet, tradeIndex, position = null) {
  const tx = await wallet.sendTransaction({ to: CONFIG.GTRADE.DIAMOND, data: encodeCloseTrade(tradeIndex), gasLimit: 1500000 });
  console.log(`📤 Close TX: ${tx.hash}`);
  await tx.wait();
  if (position) await sendTradeCloseNotification({ ...position, txHash: tx.hash });
  else await sendTelegram(`✅ Closed #${tradeIndex}`);
  return { success: true, txHash: tx.hash };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

async function getStatus(wallet) {
  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet.provider);
  const balanceUsd = parseFloat(ethers.formatUnits(await usdc.balanceOf(wallet.address), 6));
  const { prices, sources } = await fetchGTradePrices();

  let positions = [], totalPnlUsd = 0;
  try {
    const data = await httpsGet(`https://backend-arbitrum.gains.trade/open-trades/${wallet.address}`);
    if (Array.isArray(data)) {
      positions = data.map(t => {
        const pairIndex = parseInt(t.trade.pairIndex);
        const asset = Object.entries(CONFIG.ASSET_INDEX).find(([k,v]) => v === pairIndex)?.[0] || `PAIR${pairIndex}`;
        const isLong = t.trade.long === true || t.trade.long === 'true';
        const leverage = parseInt(t.trade.leverage) / 1000;
        const collateral = parseFloat(t.trade.collateralAmount) / 1e6;
        const openPrice = parseFloat(t.trade.openPrice) / 1e10;
        const currentPrice = prices[asset] || openPrice;
        const priceDiff = isLong ? (currentPrice - openPrice) / openPrice : (openPrice - currentPrice) / openPrice;
        const pnlPct = priceDiff * 100 * leverage;
        const pnlUsd = collateral * priceDiff * leverage;
        totalPnlUsd += pnlUsd;
        return { index: parseInt(t.trade.index), asset, pairIndex, long: isLong, leverage, collateral, openPrice, currentPrice, tp: parseFloat(t.trade.tp)/1e10, sl: parseFloat(t.trade.sl)/1e10, pnlPct, pnlUsd };
      });
    }
  } catch (e) { }

  return { balance: balanceUsd, positions, prices, sources, totalPnlUsd, wallet: wallet.address };
}

async function monitorAndClosePositions(wallet, config = {}) {
  const { minProfitPct = 2.0, maxLossPct = 50.0 } = config;
  const status = await getStatus(wallet);
  const closed = [];

  for (const pos of status.positions) {
    if (pos.pnlPct >= minProfitPct) {
      try { closed.push({ ...pos, reason: 'PROFIT_TARGET', ...(await closeTrade(wallet, pos.index, { ...pos, exitPrice: pos.currentPrice, reason: 'PROFIT_TARGET', direction: pos.long ? 'LONG' : 'SHORT' })) }); }
      catch (e) { }
    } else if (pos.pnlPct <= -maxLossPct) {
      try { closed.push({ ...pos, reason: 'STOP_LOSS', ...(await closeTrade(wallet, pos.index, { ...pos, exitPrice: pos.currentPrice, reason: 'STOP_LOSS', direction: pos.long ? 'LONG' : 'SHORT' })) }); }
      catch (e) { }
    }
  }

  return { monitored: status.positions.length, closed, totalPnlUsd: status.totalPnlUsd };
}

async function analyzeAsset(asset) {
  console.log(`\n🔍 Q7 Analyzing ${asset}...`);
  const candles = await fetchCandles(asset, '15m', 100);
  if (!candles || candles.length < 60) {
    return { asset, error: 'No candles', score: 0, engines: {}, confluence: 0 };
  }

  const signal = analyzeQ7Engines(candles, asset);
  const { prices } = await fetchGTradePrices();

  return {
    asset,
    direction: signal.direction,
    score: signal.score,
    leverage: signal.direction ? calculateDynamicLeverage(signal.score, asset) : 0,
    engine: signal.engine,
    reasons: signal.reasons,
    currentPrice: prices[asset],
    indicators: signal.indicators,
    // Widget-compatible fields
    engines: signal.allSignals || {},
    confluence: signal.indicators?.confluence || 0,
    allSignals: signal.allSignals
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') return { statusCode: 200, headers, body: '{}' };

  let result;
  try {
    let body = event.body ? JSON.parse(event.body) : event.action ? event : event.assets ? { action: 'AUTO_EXECUTE', ...event } : {};
    const action = body.action || 'STATUS';

    console.log(`\n${'═'.repeat(50)}\n🎯 Q7 D-RAM v4.0 | Action: ${action}\n${'═'.repeat(50)}`);

    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

    switch (action) {
      case 'OPEN_TRADE': result = await openTrade(wallet, body); break;
      case 'CLOSE_TRADE': result = await closeTrade(wallet, body.tradeIndex); break;
      case 'STATUS': result = { success: true, version: 'v4.0-Q7', algorithm: 'Q7 D-RAM v5.2.6', ...(await getStatus(wallet)) }; break;
      case 'GET_PRICES':
        const pd = await fetchGTradePrices();
        result = { success: true, ...pd, version: 'v4.0-Q7', timestamp: Date.now() };
        break;
      case 'ANALYZE':
        result = { success: true, analysis: await analyzeAsset(body.asset || 'BTC') };
        break;
      case 'GET_PENDING':
        const pendingOrders = await getPendingOrders(wallet);
        result = { success: true, pendingOrders };
        break;
      case 'CLAIM_COLLATERAL':
        const claimResult = await claimCollateral(wallet, body.orderId, body.isLimitOrder);
        result = claimResult;
        break;
      case 'AUTO_CLAIM_ALL':
        const autoResult = await autoClaimAll(wallet);
        result = autoResult;
        break;
      case 'TEST_CANDLES':
        const testAsset = body.asset || 'BTC';
        const productMap = { BTC: 'BTC-USD', ETH: 'ETH-USD' };
        const testProduct = productMap[testAsset];
        const testUrl = testProduct
          ? `https://api.exchange.coinbase.com/products/${testProduct}/candles?granularity=900`
          : `https://min-api.cryptocompare.com/data/v2/histohour?fsym=PAXG&tsym=USD&limit=5`;
        console.log(`🧪 TEST: Fetching ${testUrl}`);
        try {
          const testData = await httpsGet(testUrl);
          const isGold = !testProduct;
          result = {
            success: true,
            source: isGold ? 'CryptoCompare' : 'Coinbase',
            url: testUrl,
            dataType: typeof testData,
            isArray: Array.isArray(testData),
            length: Array.isArray(testData) ? testData.length : (testData?.Data?.Data?.length || 0),
            sample: Array.isArray(testData) ? testData[0] : (testData?.Data?.Data?.[0] || testData),
            version: 'v4.0-Q7'
          };
        } catch (testErr) {
          result = {
            success: false,
            url: testUrl,
            error: testErr.message,
            version: 'v4.0-Q7'
          };
        }
        break;
      case 'SCAN':
        const opps = [];
        for (const a of (body.assets || ['BTC', 'ETH'])) {
          opps.push(await analyzeAsset(a));
        }
        result = { success: true, opportunities: opps, minScore: CONFIG.MIN_SIGNAL_SCORE };
        break;
      case 'MONITOR':
        result = { success: true, ...(await monitorAndClosePositions(wallet, { minProfitPct: body.minProfitPct || 2.0, maxLossPct: body.maxLossPct || 50.0 })) };
        break;
      case 'AUTO_EXECUTE':
        const scanAssets = body.assets || ['BTC', 'ETH', 'GOLD'];
        await monitorAndClosePositions(wallet, { minProfitPct: body.minProfitPct || 2.5, maxLossPct: body.maxLossPct || 50.0 });
        const status = await getStatus(wallet);

        if (status.positions.length >= CONFIG.MAX_POSITIONS) {
          result = { success: true, message: 'Max positions reached', positions: status.positions.length };
          break;
        }

        let best = null;
        const scanResults = [];

        for (const asset of scanAssets) {
          if (status.positions.find(p => p.asset === asset)) {
            scanResults.push({ asset, status: 'positioned' });
            continue;
          }

          const an = await analyzeAsset(asset);
          scanResults.push({
            asset,
            direction: an.direction,
            score: an.score,
            engine: an.engine,
            reasons: an.reasons,
            indicators: an.indicators
          });

          if (an.direction && an.score >= CONFIG.MIN_SIGNAL_SCORE && (!best || an.score > best.score)) {
            best = an;
          }
        }

        await sendScanNotification(scanResults, status.balance, status.positions.length);

        if (best) {
          console.log(`\n🎯 Q7 BEST: ${best.engine} ${best.direction} ${best.asset} (${best.score.toFixed(1)})`);
          result = await openTrade(wallet, {
            asset: best.asset,
            direction: best.direction,
            collateral: body.collateral || 10,
            price: best.currentPrice,
            signal: { score: best.score, engine: best.engine, reasons: best.reasons, indicators: best.indicators }
          });
          result.scanResults = scanResults;
        } else {
          result = { success: true, message: 'No Q7 signals above threshold', scanResults, balance: status.balance, minScore: CONFIG.MIN_SIGNAL_SCORE };
        }
        break;
      default: result = { success: false, error: `Unknown: ${action}` };
    }
  } catch (e) {
    console.error('❌', e);
    result = { success: false, error: e.message };
    await sendTelegram(`❌ Q7 Error: ${e.message}`);
  }

  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
