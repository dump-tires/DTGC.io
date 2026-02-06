/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INSTITUTIONAL AUTOTRADE v4.2 - Q7 D-RAM v5.2.6 + CLUSTER GUARD
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * NEW IN v4.2:
 * - Portfolio Cluster Guard - manages position clusters by asset+direction
 * - Auto-closes losing clusters when Q7 contradicts
 * - Emergency close at hard loss threshold
 * - Batch closing with delays to avoid gas spikes
 * - Telegram alerts for cluster actions
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
// Q7 D-RAM CALIBRATED CONFIGURATION - v4.2 WITH CLUSTER GUARD
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  RPC_URL: 'https://arb1.arbitrum.io/rpc',
  PRIVATE_KEY: process.env.PRIVATE_KEY,

  // ⚡ EU endpoint for gTrade API
  GTRADE_API: 'https://backend-arbitrum.eu.gains.trade',
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
  MIN_SIGNAL_SCORE: 20,
  MIN_CONFLUENCE: 50,
  MIN_COLLATERAL: 5,
  MAX_POSITIONS: 4,

  // ⚡ v4.1 FIX: WIDER TP/SL to avoid quick stops
  TP_PERCENT: { BTC: 4.0, ETH: 5.0, GOLD: 6.0, SILVER: 6.0 },
  SL_PERCENT: { BTC: 2.5, ETH: 3.0, GOLD: 4.5, SILVER: 4.5 },

  // ⚡ v4.1 FIX: INCREASED SLIPPAGE
  SLIPPAGE: { crypto: 1.5, commodity: 2.5 },

  // ⚡ v4.1: Retry settings
  MAX_RETRIES: 3,
  RETRY_SLIPPAGE_MULTIPLIER: 1.5,

  // ═══════════════════════════════════════════════════════════════════════
  // v4.2 NEW: PORTFOLIO RISK MANAGEMENT - Q7 CLUSTER GUARD
  // ═══════════════════════════════════════════════════════════════════════
  MAX_CLUSTER_SIZE: 10,           // alert if >10 same-direction trades on one asset
  CLUSTER_LOSS_SOFT_PCT: -20,     // start closing if cluster PnL < -20%
  CLUSTER_LOSS_HARD_PCT: -40,     // emergency close all if cluster PnL < -40%
  CLOSE_BATCH_SIZE: 10,           // max positions to close per cycle
  CLOSE_DELAY_MS: 3000,           // delay between close TXs
  CONTRADICT_CLOSE: true,         // close losing cluster if Q7 signals opposite direction
  DRY_RUN: false,                 // set true to test without closing

  // Q7 Engine Weights
  ENGINE_WEIGHTS: { SWP: 30, BRK: 25, MR: 25, TRND: 15, MTUM: 5 },

  // Q7 Per-Asset RSI Thresholds
  RSI_BOUNDS: {
    BTC: { oversold: 34, overbought: 66 },
    ETH: { oversold: 32, overbought: 68 },
    GOLD: { oversold: 30, overbought: 70 },
    SILVER: { oversold: 30, overbought: 70 }
  },

  RSI_PERIOD: 14,
  EMA_FAST: 21,
  EMA_SLOW: 55,
  BB_PERIOD: 20,
  BB_STD: 2,
  ATR_PERIOD: 14,
  ADX_PERIOD: 14,
  ADX_TREND_MIN: 22,
  ADX_MR_MAX: 27,
  BRK_ADX_MIN: 18,
  BRK_VOL_MULT: 1.5,
  SWP_WICK_RATIO: 0.40,
  SWP_VOL_MULT: 1.5,
  MR_PIN_BAR_RATIO: 0.50,
  TRND_PULLBACK_ATR: 0.8,
  CONFLUENCE_WEIGHTS: { trend: 0.30, adx: 0.20, rsi: 0.20, volume: 0.15, mtf: 0.15 },
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
// CANDLE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchCandles(asset, interval = '15m', limit = 100) {
  const productMap = { BTC: 'BTC-USD', ETH: 'ETH-USD' };
  const product = productMap[asset];
  if (asset === 'GOLD') return fetchGoldCandles(limit);
  if (!product) return null;

  try {
    const granularity = 900;
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
// PRICE FETCHING - v4.1 IMPROVED WITH MULTIPLE SOURCES
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchGTradePrices() {
  const prices = { BTC: null, ETH: null, GOLD: null, SILVER: null };
  const sources = { BTC: null, ETH: null, GOLD: null, SILVER: null };

  // Try gTrade pricing API FIRST (most accurate for execution)
  try {
    const gtradeData = await httpsGet('https://backend-pricing.eu.gains.trade/charts/prices?from=gTrade&pairs=0,1,90,91');
    if (gtradeData) {
      if (gtradeData['0']) { prices.BTC = parseFloat(gtradeData['0']); sources.BTC = 'gTrade-direct'; }
      if (gtradeData['1']) { prices.ETH = parseFloat(gtradeData['1']); sources.ETH = 'gTrade-direct'; }
      if (gtradeData['90']) { prices.GOLD = parseFloat(gtradeData['90']); sources.GOLD = 'gTrade-direct'; }
      if (gtradeData['91']) { prices.SILVER = parseFloat(gtradeData['91']); sources.SILVER = 'gTrade-direct'; }
    }
  } catch (e) {
    console.log('gTrade pricing API failed, using fallbacks...');
  }

  // Chainlink for GOLD (fallback)
  if (!prices.GOLD) {
    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const oracle = new ethers.Contract(CONFIG.CHAINLINK_ORACLES.GOLD, CHAINLINK_ABI, provider);
      const [decimals, roundData] = await Promise.all([oracle.decimals(), oracle.latestRoundData()]);
      const [, answer] = roundData;
      const price = Number(answer) / Math.pow(10, Number(decimals));
      if (price > 2000 && price < 6000) {
        prices.GOLD = price;
        sources.GOLD = 'chainlink';
      }
    } catch (e) { }
  }

  // CoinGecko fallback for BTC/ETH
  if (!prices.BTC || !prices.ETH) {
    try {
      const cgRes = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
      if (!prices.BTC && cgRes?.bitcoin?.usd) { prices.BTC = cgRes.bitcoin.usd; sources.BTC = 'coingecko'; }
      if (!prices.ETH && cgRes?.ethereum?.usd) { prices.ETH = cgRes.ethereum.usd; sources.ETH = 'coingecko'; }
    } catch (e) { }
  }

  // Final fallbacks
  if (!prices.SILVER) { prices.SILVER = 32.5; sources.SILVER = 'fallback'; }
  if (!prices.BTC) { prices.BTC = 73000; sources.BTC = 'fallback'; }
  if (!prices.ETH) { prices.ETH = 2100; sources.ETH = 'fallback'; }
  if (!prices.GOLD) { prices.GOLD = 4900; sources.GOLD = 'fallback'; }

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

function detectDivergence(closes, rsiValues, lookback = 14) {
  if (closes.length < lookback + 2 || rsiValues.length < lookback + 2) {
    return { bullish: false, bearish: false };
  }
  const currentClose = closes[closes.length - 1];
  const currentRSI = rsiValues[rsiValues.length - 1];
  const prevClose = closes[closes.length - lookback];
  const prevRSI = rsiValues[rsiValues.length - lookback];
  const bullish = currentClose < prevClose && currentRSI > prevRSI && currentRSI < 40;
  const bearish = currentClose > prevClose && currentRSI < prevRSI && currentRSI > 60;
  return { bullish, bearish };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 5-FACTOR CONFLUENCE SCORING
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

  const volScore = indicators.volumeSpike ? 100 : 50;
  score += volScore * weights.volume;

  const mtfScore = direction === 'LONG'
    ? (indicators.currentPrice > indicators.emaFast ? 100 : 50)
    : (indicators.currentPrice < indicators.emaFast ? 100 : 50);
  score += mtfScore * weights.mtf;

  return Math.round(score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM 6-ENGINE ANALYSIS
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

  const pinBar = isPinBar(current, atr, CONFIG.MR_PIN_BAR_RATIO);
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

  // ENGINE 2: BRK (Breakout)
  const brkLongCond = bbCompressed && current.close > bb.upper && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN;
  const brkShortCond = bbCompressed && current.close < bb.lower && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN;

  if (brkLongCond) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'BB breakout UP + Vol' };
  } else if (brkShortCond) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'BB breakout DOWN + Vol' };
  }

  // ENGINE 3: MR (Mean Reversion)
  const rangingForMR = adx < CONFIG.ADX_MR_MAX;
  const mrLongCond = rangingForMR && rsi < rsiBounds.oversold && (pinBar.bullish || divergence.bullish);
  const mrShortCond = rangingForMR && rsi > rsiBounds.overbought && (pinBar.bearish || divergence.bearish);

  if (mrLongCond) {
    let s = 75;
    if (pinBar.bullish && divergence.bullish) s = 95;
    signals.MR = { score: s, direction: 'LONG', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bullish ? 'PinBar' : 'Div'}` };
  } else if (mrShortCond) {
    let s = 75;
    if (pinBar.bearish && divergence.bearish) s = 95;
    signals.MR = { score: s, direction: 'SHORT', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bearish ? 'PinBar' : 'Div'}` };
  }

  // ENGINE 4: TRND (Trend)
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

  // ENGINE SELECTION
  let selectedEngine = null;
  let selectedSignal = null;
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
      direction: null, score: 0, reasons: [], engine: null,
      indicators: { rsi: rsi.toFixed(1), emaFast: emaFast.toFixed(2), emaSlow: emaSlow.toFixed(2), adx: adx.toFixed(1), priceChange1h: priceChange1h.toFixed(2), volumeSpike, currentPrice: current.close }
    };
  }

  const indicators = { rsi, emaFast, emaSlow, adx, volumeSpike, currentPrice: current.close, priceChange1h, priceChange4h };
  const confluence = calculateConfluence(indicators, selectedSignal.direction);
  const weightedScore = (selectedSignal.score * (CONFIG.ENGINE_WEIGHTS[selectedEngine] / 100)) + (confluence * 0.5);

  console.log(`🔧 Q7 Engine: ${selectedEngine} ${selectedSignal.direction} (Score: ${selectedSignal.score}, Confluence: ${confluence}, Weighted: ${weightedScore.toFixed(1)})`);

  return {
    direction: selectedSignal.direction,
    score: weightedScore,
    reasons: [`${selectedEngine}: ${selectedSignal.reason}`, `Confluence: ${confluence}`],
    engine: selectedEngine,
    indicators: {
      rsi: rsi.toFixed(1), emaFast: emaFast.toFixed(2), emaSlow: emaSlow.toFixed(2), adx: adx.toFixed(1),
      priceChange1h: priceChange1h.toFixed(2), priceChange4h: priceChange4h.toFixed(2),
      volumeSpike, currentPrice: current.close, confluence
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
  msg += best ? `🎯 <b>EXECUTING: ${best.direction} ${best.asset} via ${best.engine}</b>` : `⏳ No Q7 signals (need ≥${CONFIG.MIN_SIGNAL_SCORE})`;

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

    for (let i = 0; i < 10; i++) {
      try {
        const order = await trading.pendingMarketOpenOrders(wallet.address, i);
        if (order && order.trade && order.trade.trader !== '0x0000000000000000000000000000000000000000') {
          pendingOrders.push({
            orderId: i, type: 'market',
            asset: Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === Number(order.trade.pairIndex))?.[0] || 'UNKNOWN',
            collateral: parseFloat(ethers.formatUnits(order.trade.collateralAmount, 6)),
            isLong: order.trade.buy, timestamp: Number(order.timestamp),
          });
        }
      } catch (e) { }
    }

    for (let i = 0; i < 10; i++) {
      try {
        const order = await trading.pendingLimitOpenOrders(wallet.address, i);
        if (order && order.trade && order.trade.trader !== '0x0000000000000000000000000000000000000000') {
          pendingOrders.push({
            orderId: i, type: 'limit',
            asset: Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === Number(order.trade.pairIndex))?.[0] || 'UNKNOWN',
            collateral: parseFloat(ethers.formatUnits(order.trade.collateralAmount, 6)),
            isLong: order.trade.buy, timestamp: Number(order.timestamp),
          });
        }
      } catch (e) { }
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
    const gasLimit = 500000n;
    const tx = isLimitOrder
      ? await trading.cancelOpenLimitOrder(orderId, { gasLimit })
      : await trading.cancelOpenMarketOrder(orderId, { gasLimit });
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
  if (pending.length === 0) return { success: true, claimed: 0, totalClaimed: 0, results: [] };

  console.log(`💰 Auto-claiming ${pending.length} pending orders...`);
  const results = [];
  let totalClaimed = 0;

  for (const order of pending) {
    const result = await claimCollateral(wallet, order.orderId, order.type === 'limit');
    if (result.success) totalClaimed += order.collateral;
    results.push({ ...result, collateral: order.collateral, asset: order.asset });
    await new Promise(r => setTimeout(r, 2000));
  }

  return { success: true, claimed: results.filter(r => r.success).length, totalClaimed, results };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GTRADE ENCODING & EXECUTION - v4.1 WITH RETRY LOGIC
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

// ⚡ v4.1 NEW: Open trade with automatic retry on slippage failure
async function openTrade(wallet, params, retryCount = 0) {
  const { asset, direction, collateral, leverage: providedLev, price: providedPrice, signal, takeProfit, stopLoss } = params;
  const pairIndex = CONFIG.ASSET_INDEX[asset];
  if (pairIndex === undefined) throw new Error(`Unknown asset: ${asset}`);

  const currentPrice = await fetchPrice(pairIndex, providedPrice);
  const isCommodity = ['GOLD', 'SILVER'].includes(asset);

  let finalLev = signal?.score ? calculateDynamicLeverage(signal.score, asset) : providedLev ? Math.round(providedLev) : CONFIG.BASE_LEVERAGE[asset];
  finalLev = Math.min(finalLev, CONFIG.MAX_LEVERAGE[asset]);

  const isBuy = direction === 'LONG';
  const tpPct = takeProfit || CONFIG.TP_PERCENT[asset] || (isCommodity ? 6.0 : 4.0);
  const slPct = stopLoss || CONFIG.SL_PERCENT[asset] || (isCommodity ? 4.5 : 2.5);
  const tpPrice = isBuy ? currentPrice * (1 + tpPct/100) : currentPrice * (1 - tpPct/100);
  const slPrice = isBuy ? currentPrice * (1 - slPct/100) : currentPrice * (1 + slPct/100);

  // ⚡ v4.1: Calculate slippage with retry multiplier
  const baseSlippage = isCommodity ? CONFIG.SLIPPAGE.commodity : CONFIG.SLIPPAGE.crypto;
  const slippagePct = baseSlippage * Math.pow(CONFIG.RETRY_SLIPPAGE_MULTIPLIER, retryCount);

  console.log(`\n⚔️ Q7 OPENING ${direction} ${asset} @ $${currentPrice.toFixed(2)} | ${finalLev}x | $${collateral} | Slippage: ${slippagePct.toFixed(2)}% (attempt ${retryCount + 1})`);

  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet);
  const collateralWei = ethers.parseUnits(collateral.toString(), 6);

  if ((await usdc.allowance(wallet.address, CONFIG.GTRADE.DIAMOND)) < collateralWei) {
    console.log('🔐 Approving USDC...');
    await (await usdc.approve(CONFIG.GTRADE.DIAMOND, ethers.MaxUint256)).wait();
  }

  const priceWithSlippage = currentPrice * (isBuy ? 1 + slippagePct/100 : 1 - slippagePct/100);

  try {
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

    // Wait a bit and check if order actually filled
    await new Promise(r => setTimeout(r, 3000));
    const status = await getStatus(wallet);
    const positionOpened = status.positions.some(p => p.asset === asset);

    if (!positionOpened && retryCount < CONFIG.MAX_RETRIES) {
      console.log(`⚠️ Order may not have filled, retrying with wider slippage...`);
      await sendTelegram(`⚠️ ${asset} order didn't fill, retrying (${retryCount + 1}/${CONFIG.MAX_RETRIES})...`);
      return openTrade(wallet, params, retryCount + 1);
    }

    await sendTradeOpenNotification({ asset, direction, collateral, leverage: finalLev, entryPrice: currentPrice, tpPrice, slPrice, signal, txHash: tx.hash });
    return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber, leverage: finalLev, entryPrice: currentPrice, tpPrice, slPrice, slippageUsed: slippagePct, retryCount };

  } catch (error) {
    console.error(`❌ Trade failed: ${error.message}`);

    // ⚡ v4.1: Retry on failure
    if (retryCount < CONFIG.MAX_RETRIES && (error.message.includes('slippage') || error.message.includes('SLIPPAGE') || error.message.includes('price'))) {
      console.log(`🔄 Retrying with wider slippage (attempt ${retryCount + 2}/${CONFIG.MAX_RETRIES + 1})...`);
      await sendTelegram(`🔄 ${asset} slippage fail, retrying wider...`);
      await new Promise(r => setTimeout(r, 2000));
      return openTrade(wallet, params, retryCount + 1);
    }

    throw error;
  }
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
    const data = await httpsGet(`${CONFIG.GTRADE_API}/open-trades/${wallet.address}`);
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
  } catch (e) {
    console.log(`⚠️ gTrade API error: ${e.message}`);
  }

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

// ═══════════════════════════════════════════════════════════════════════════════
// v4.2 NEW: Q7 PORTFOLIO CLUSTER GUARD
// ═══════════════════════════════════════════════════════════════════════════════
async function managePortfolio(wallet, config = {}) {
  const {
    softPct = CONFIG.CLUSTER_LOSS_SOFT_PCT,
    hardPct = CONFIG.CLUSTER_LOSS_HARD_PCT,
    batchSize = CONFIG.CLOSE_BATCH_SIZE,
    dryRun = CONFIG.DRY_RUN,
  } = config;

  console.log('\n' + '═'.repeat(50));
  console.log('🛡️  Q7 CLUSTER GUARD — Portfolio Scan');
  console.log('═'.repeat(50));

  const status = await getStatus(wallet);
  const { positions, prices } = status;

  if (positions.length === 0) {
    console.log('📭 No open positions.');
    return { success: true, clusters: [], closed: [], message: 'No positions' };
  }

  // ── Group into clusters by asset + direction ──
  const clusterMap = {};
  for (const pos of positions) {
    const key = `${pos.asset}-${pos.long ? 'LONG' : 'SHORT'}`;
    if (!clusterMap[key]) {
      clusterMap[key] = {
        asset: pos.asset,
        direction: pos.long ? 'LONG' : 'SHORT',
        positions: [],
        totalCollateral: 0,
        totalPnlUsd: 0,
      };
    }
    clusterMap[key].positions.push(pos);
    clusterMap[key].totalCollateral += pos.collateral;
    clusterMap[key].totalPnlUsd += pos.pnlUsd;
  }

  const clusters = Object.values(clusterMap).map(c => ({
    ...c,
    count: c.positions.length,
    avgPnlPct: c.totalCollateral > 0
      ? (c.totalPnlUsd / c.totalCollateral) * 100
      : 0,
    avgEntry: c.positions.reduce((s, p) => s + p.openPrice, 0) / c.positions.length,
    // Sort worst-first (most negative PnL)
    positions: c.positions.sort((a, b) => a.pnlPct - b.pnlPct),
  }));

  console.log(`📊 Found ${clusters.length} cluster(s) across ${positions.length} positions:`);
  for (const c of clusters) {
    console.log(`   ${c.direction} ${c.asset}: ${c.count} pos | $${c.totalCollateral.toFixed(2)} collateral | PnL: $${c.totalPnlUsd.toFixed(2)} (${c.avgPnlPct.toFixed(1)}%)`);
  }

  const allClosed = [];
  const clusterReports = [];

  for (const cluster of clusters) {
    const report = {
      asset: cluster.asset,
      direction: cluster.direction,
      count: cluster.count,
      totalCollateral: cluster.totalCollateral,
      totalPnlUsd: cluster.totalPnlUsd,
      avgPnlPct: cluster.avgPnlPct,
      action: 'HOLD',
      reason: '',
      closed: 0,
    };

    // ── Check 1: Hard stop — emergency close entire cluster ──
    if (cluster.avgPnlPct <= hardPct) {
      report.action = 'EMERGENCY_CLOSE_ALL';
      report.reason = `Cluster PnL ${cluster.avgPnlPct.toFixed(1)}% breached hard limit (${hardPct}%)`;
      console.log(`\n🚨 EMERGENCY: ${cluster.direction} ${cluster.asset} at ${cluster.avgPnlPct.toFixed(1)}% — closing ALL ${cluster.count} positions`);

      if (!dryRun) {
        const closed = await closeClusterBatch(wallet, cluster.positions, cluster.positions.length);
        allClosed.push(...closed);
        report.closed = closed.length;
      } else {
        console.log('   ⏸️  DRY RUN — no positions closed');
      }

      await sendPortfolioAlert(cluster, report);
      clusterReports.push(report);
      continue;
    }

    // ── Check 2: Soft threshold — needs Q7 contradiction to act ──
    const needsReview = cluster.avgPnlPct <= softPct || cluster.count > CONFIG.MAX_CLUSTER_SIZE;

    if (!needsReview) {
      report.action = 'HOLD';
      report.reason = 'Within risk limits';
      clusterReports.push(report);
      continue;
    }

    console.log(`\n⚠️  ${cluster.direction} ${cluster.asset} flagged: ${cluster.count} positions, PnL ${cluster.avgPnlPct.toFixed(1)}%`);

    // ── Check 3: Q7 signal contradiction ──
    if (CONFIG.CONTRADICT_CLOSE) {
      const candles = await fetchCandles(cluster.asset, '15m', 100);
      const signal = analyzeQ7Engines(candles, cluster.asset);

      console.log(`   🔧 Q7 says: ${signal.direction || 'NO SIGNAL'} (score: ${signal.score?.toFixed(1) || 0}, engine: ${signal.engine || 'none'})`);

      const contradicts = signal.direction && signal.direction !== cluster.direction;
      const noSignalForDirection = !signal.direction && cluster.avgPnlPct <= softPct;

      if (contradicts) {
        report.action = 'CONTRADICT_CLOSE';
        report.reason = `Q7 ${signal.engine} signals ${signal.direction} (score ${signal.score?.toFixed(1)}) — contradicts ${cluster.direction} cluster`;
        console.log(`   ❌ CONTRADICTION: Q7 wants ${signal.direction}, cluster is ${cluster.direction} — closing worst ${batchSize}`);

        if (!dryRun) {
          const toClose = cluster.positions.slice(0, batchSize);
          const closed = await closeClusterBatch(wallet, toClose, batchSize);
          allClosed.push(...closed);
          report.closed = closed.length;
        } else {
          console.log('   ⏸️  DRY RUN — no positions closed');
        }

        await sendPortfolioAlert(cluster, report);

      } else if (noSignalForDirection) {
        // Q7 has no signal at all and cluster is losing — close smallest batch
        const smallBatch = Math.min(Math.ceil(batchSize / 2), cluster.count);
        report.action = 'NO_SIGNAL_TRIM';
        report.reason = `No Q7 signal + cluster at ${cluster.avgPnlPct.toFixed(1)}% — trimming worst ${smallBatch}`;
        console.log(`   ⏹️  No Q7 signal, trimming ${smallBatch} worst positions`);

        if (!dryRun) {
          const toClose = cluster.positions.slice(0, smallBatch);
          const closed = await closeClusterBatch(wallet, toClose, smallBatch);
          allClosed.push(...closed);
          report.closed = closed.length;
        }

        await sendPortfolioAlert(cluster, report);

      } else {
        // Q7 agrees with cluster direction — hold but warn if oversized
        report.action = 'HOLD_ALIGNED';
        report.reason = `Q7 agrees (${signal.direction || 'neutral'}) — holding despite ${cluster.avgPnlPct.toFixed(1)}% PnL`;
        console.log(`   ✅ Q7 aligned with cluster — holding`);

        if (cluster.count > CONFIG.MAX_CLUSTER_SIZE) {
          report.reason += ` (⚠️ oversized: ${cluster.count} > ${CONFIG.MAX_CLUSTER_SIZE})`;
          await sendPortfolioAlert(cluster, report);
        }
      }
    }

    clusterReports.push(report);
  }

  const summary = {
    success: true,
    totalPositions: positions.length,
    totalClusters: clusters.length,
    totalClosed: allClosed.length,
    clusters: clusterReports,
    closed: allClosed,
    balance: status.balance,
    dryRun,
  };

  console.log(`\n🛡️  Cluster Guard complete: ${allClosed.length} closed out of ${positions.length} total`);
  return summary;
}

async function closeClusterBatch(wallet, positions, maxClose) {
  const closed = [];
  const toClose = positions.slice(0, maxClose);

  for (const pos of toClose) {
    try {
      console.log(`   🔻 Closing #${pos.index} ${pos.long ? 'LONG' : 'SHORT'} ${pos.asset} | PnL: ${pos.pnlPct.toFixed(1)}% ($${pos.pnlUsd.toFixed(2)})`);
      const result = await closeTrade(wallet, pos.index, {
        ...pos,
        exitPrice: pos.currentPrice,
        reason: 'CLUSTER_GUARD',
        direction: pos.long ? 'LONG' : 'SHORT',
      });
      closed.push({ index: pos.index, asset: pos.asset, pnlUsd: pos.pnlUsd, pnlPct: pos.pnlPct, ...result });
    } catch (e) {
      console.log(`   ❌ Failed to close #${pos.index}: ${e.message}`);
    }
    // Delay between TXs to avoid nonce collisions
    await new Promise(r => setTimeout(r, CONFIG.CLOSE_DELAY_MS));
  }

  return closed;
}

async function sendPortfolioAlert(cluster, report) {
  const emoji = report.action === 'EMERGENCY_CLOSE_ALL' ? '🚨'
    : report.action === 'CONTRADICT_CLOSE' ? '❌'
    : report.action === 'NO_SIGNAL_TRIM' ? '✂️' : '⚠️';

  const msg = `${emoji} <b>Q7 CLUSTER GUARD</b>\n\n`
    + `${cluster.direction === 'LONG' ? '📈' : '📉'} <b>${cluster.direction} ${cluster.asset}</b>\n`
    + `━━━━━━━━━━━━━━━━\n`
    + `📊 Positions: ${cluster.count}\n`
    + `💰 Collateral: $${cluster.totalCollateral.toFixed(2)}\n`
    + `📉 PnL: $${cluster.totalPnlUsd.toFixed(2)} (${cluster.avgPnlPct.toFixed(1)}%)\n`
    + `━━━━━━━━━━━━━━━━\n`
    + `🎬 Action: <b>${report.action}</b>\n`
    + `📝 ${report.reason}\n`
    + `🔻 Closed: ${report.closed} positions\n`
    + `━━━━━━━━━━━━━━━━`;

  return sendTelegram(msg);
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
    asset, direction: signal.direction, score: signal.score,
    leverage: signal.direction ? calculateDynamicLeverage(signal.score, asset) : 0,
    engine: signal.engine, reasons: signal.reasons, currentPrice: prices[asset],
    indicators: signal.indicators, engines: signal.allSignals || {},
    confluence: signal.indicators?.confluence || 0, allSignals: signal.allSignals
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '{}' };
  }

  let result;
  try {
    let body = event.body ? JSON.parse(event.body) : event.action ? event : event.assets ? { action: 'AUTO_EXECUTE', ...event } : {};
    const action = body.action || 'STATUS';

    console.log(`\n${'═'.repeat(50)}\n🎯 Q7 D-RAM v4.2 + CLUSTER GUARD | Action: ${action}\n${'═'.repeat(50)}`);

    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

    switch (action) {
      case 'OPEN_TRADE':
        result = await openTrade(wallet, body);
        break;

      case 'CLOSE_TRADE':
        result = await closeTrade(wallet, body.tradeIndex);
        break;

      case 'STATUS':
        result = { success: true, version: 'v4.2-Q7-ClusterGuard', algorithm: 'Q7 D-RAM v5.2.6', apiEndpoint: CONFIG.GTRADE_API, slippage: CONFIG.SLIPPAGE, clusterGuard: { softPct: CONFIG.CLUSTER_LOSS_SOFT_PCT, hardPct: CONFIG.CLUSTER_LOSS_HARD_PCT, batchSize: CONFIG.CLOSE_BATCH_SIZE }, ...(await getStatus(wallet)) };
        break;

      case 'GET_PRICES':
        const pd = await fetchGTradePrices();
        result = { success: true, ...pd, version: 'v4.2-Q7', timestamp: Date.now() };
        break;

      case 'ANALYZE':
        result = { success: true, analysis: await analyzeAsset(body.asset || 'BTC') };
        break;

      case 'GET_PENDING':
        result = { success: true, pendingOrders: await getPendingOrders(wallet) };
        break;

      case 'CLAIM_COLLATERAL':
        result = await claimCollateral(wallet, body.orderId, body.isLimitOrder);
        break;

      case 'AUTO_CLAIM_ALL':
        result = await autoClaimAll(wallet);
        break;

      case 'SCAN':
        const opps = [];
        for (const a of (body.assets || ['BTC', 'ETH'])) opps.push(await analyzeAsset(a));
        result = { success: true, opportunities: opps, minScore: CONFIG.MIN_SIGNAL_SCORE };
        break;

      case 'MONITOR':
        result = { success: true, ...(await monitorAndClosePositions(wallet, { minProfitPct: body.minProfitPct || 2.0, maxLossPct: body.maxLossPct || 50.0 })) };
        break;

      // ═══════════════════════════════════════════════════════════════════════
      // v4.2 NEW: MANAGE_PORTFOLIO - Cluster Guard
      // ═══════════════════════════════════════════════════════════════════════
      case 'MANAGE_PORTFOLIO':
        result = await managePortfolio(wallet, {
          softPct: body.softPct || CONFIG.CLUSTER_LOSS_SOFT_PCT,
          hardPct: body.hardPct || CONFIG.CLUSTER_LOSS_HARD_PCT,
          batchSize: body.batchSize || CONFIG.CLOSE_BATCH_SIZE,
          dryRun: body.dryRun !== undefined ? body.dryRun : CONFIG.DRY_RUN,
        });
        break;

      case 'AUTO_EXECUTE':
        const scanAssets = body.assets || ['BTC', 'ETH', 'GOLD'];

        // ⚡ v4.2: Run Cluster Guard BEFORE scanning for new trades
        await managePortfolio(wallet);

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
          scanResults.push({ asset, direction: an.direction, score: an.score, engine: an.engine, reasons: an.reasons, indicators: an.indicators });
          if (an.direction && an.score >= CONFIG.MIN_SIGNAL_SCORE && (!best || an.score > best.score)) best = an;
        }

        await sendScanNotification(scanResults, status.balance, status.positions.length);

        if (best) {
          console.log(`\n🎯 Q7 BEST: ${best.engine} ${best.direction} ${best.asset} (${best.score.toFixed(1)})`);
          result = await openTrade(wallet, {
            asset: best.asset, direction: best.direction, collateral: body.collateral || 10,
            price: best.currentPrice, signal: { score: best.score, engine: best.engine, reasons: best.reasons, indicators: best.indicators }
          });
          result.scanResults = scanResults;
        } else {
          result = { success: true, message: 'No Q7 signals above threshold', scanResults, balance: status.balance, minScore: CONFIG.MIN_SIGNAL_SCORE };
        }
        break;

      default:
        result = { success: false, error: `Unknown: ${action}` };
    }
  } catch (e) {
    console.error('❌', e);
    result = { success: false, error: e.message };
    await sendTelegram(`❌ Q7 Error: ${e.message}`);
  }

  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
