/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GE-SIGNAL-QUEUE v4.1 ALPHA - Q7 D-RAM COMPREHENSIVE SIGNALS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * COMPREHENSIVE TELEGRAM NOTIFICATIONS:
 * - Full Q7 engine breakdown with educational signals
 * - Collateral growth tracking from inception
 * - Complete trade execution details
 * - Alpha-level market analysis
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

  TELEGRAM_BOT: process.env.TELEGRAM_BOT || '8215882567:AAHB4csgKNELTI9mpMNFsN4SwCN9Xvzz-vg',
  TELEGRAM_CHAT: process.env.TELEGRAM_CHAT || '-1003691135718',

  // Q7 Wallet - MetalPerps main wallet
  Q7_WALLET: '0x978c5786CDB46b1519A9c1C4814e06d5956f6c64',

  // Starting collateral tracking (inception date)
  INCEPTION_DATE: '2025-01-28',
  INCEPTION_COLLATERAL: 5.38,

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

  BASE_LEVERAGE: { BTC: 25, ETH: 25, GOLD: 10, SILVER: 10 },
  MAX_LEVERAGE: { BTC: 50, ETH: 50, GOLD: 20, SILVER: 20 },

  MIN_SIGNAL_SCORE: 20,
  MIN_CONFLUENCE: 50,
  MIN_COLLATERAL: 5,
  MAX_POSITIONS: 4,

  TP_PERCENT: { BTC: 3.0, ETH: 4.2, GOLD: 5.0, SILVER: 5.0 },
  SL_PERCENT: { BTC: 2.0, ETH: 2.8, GOLD: 4.0, SILVER: 4.0 },
  SLIPPAGE: { crypto: 0.3, commodity: 1.0 },

  // Q7 Engine Weights (Priority Order)
  ENGINE_WEIGHTS: { SWP: 30, BRK: 25, MR: 25, TRND: 15, MTUM: 5 },

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
// Q7 ENGINE EDUCATIONAL DESCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════

const ENGINE_EDUCATION = {
  SWP: {
    name: 'SWEEP',
    emoji: '🧹',
    priority: 1,
    weight: '30%',
    description: 'Liquidity hunt reversal. Price sweeps previous day high/low, traps traders, then reverses.',
    trigger: 'Wick > 40% of range OR Volume spike 1.5x after sweep',
    bestFor: 'Counter-trend entries at key levels',
  },
  BRK: {
    name: 'BREAKOUT',
    emoji: '💥',
    priority: 2,
    weight: '25%',
    description: 'Bollinger Band squeeze breakout with volume confirmation.',
    trigger: 'BB compressed + Close outside band + Vol > 1.5x + ADX > 18',
    bestFor: 'Catching momentum expansions',
  },
  MR: {
    name: 'MEAN REVERSION',
    emoji: '🔄',
    priority: 3,
    weight: '25%',
    description: 'RSI extremes with pin bar or divergence in ranging markets.',
    trigger: 'ADX < 27 + RSI extreme + Pin bar OR Divergence',
    bestFor: 'Range-bound markets, quick scalps',
  },
  TRND: {
    name: 'TREND',
    emoji: '📈',
    priority: 4,
    weight: '15%',
    description: 'Pullback entry in established trend. EMA aligned + ADX confirms strength.',
    trigger: 'Trend confirmed + Pullback > 0.8 ATR + Continuation',
    bestFor: 'Riding momentum with trend',
  },
  MTUM: {
    name: 'MOMENTUM',
    emoji: '⚡',
    priority: 5,
    weight: '5%',
    description: 'Pure price momentum based on hourly/4h moves.',
    trigger: '1h move > 0.5% + 4h move > 1% aligned',
    bestFor: 'Backup signal, volatile markets',
  },
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
// CANDLE & PRICE FETCHING
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

    return data.slice(0, limit).reverse().map(c => ({
      timestamp: c[0] * 1000, open: parseFloat(c[3]), high: parseFloat(c[2]),
      low: parseFloat(c[1]), close: parseFloat(c[4]), volume: parseFloat(c[5])
    }));
  } catch (e) { return null; }
}

async function fetchGoldCandles(limit = 100) {
  try {
    const url = `https://min-api.cryptocompare.com/data/v2/histohour?fsym=PAXG&tsym=USD&limit=${limit}`;
    const data = await httpsGet(url);
    if (!data?.Data?.Data) return null;
    return data.Data.Data.map(c => ({
      timestamp: c.time * 1000, open: c.open, high: c.high,
      low: c.low, close: c.close, volume: c.volumefrom || 1
    }));
  } catch (e) { return null; }
}

async function fetchGTradePrices() {
  const prices = { BTC: null, ETH: null, GOLD: null, SILVER: null };
  const sources = { BTC: null, ETH: null, GOLD: null, SILVER: null };

  try {
    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const oracle = new ethers.Contract(CONFIG.CHAINLINK_ORACLES.GOLD, CHAINLINK_ABI, provider);
    const [decimals, roundData] = await Promise.all([oracle.decimals(), oracle.latestRoundData()]);
    const price = Number(roundData[1]) / Math.pow(10, Number(decimals));
    if (price > 2000 && price < 5000) { prices.GOLD = price; sources.GOLD = 'chainlink'; }
  } catch (e) { }

  try {
    const cgRes = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
    if (cgRes?.bitcoin?.usd) { prices.BTC = cgRes.bitcoin.usd; sources.BTC = 'coingecko'; }
    if (cgRes?.ethereum?.usd) { prices.ETH = cgRes.ethereum.usd; sources.ETH = 'coingecko'; }
  } catch (e) { }

  prices.SILVER = 32.5; sources.SILVER = 'fallback';
  if (!prices.BTC) { prices.BTC = 105000; sources.BTC = 'fallback'; }
  if (!prices.ETH) { prices.ETH = 3300; sources.ETH = 'fallback'; }
  if (!prices.GOLD) { prices.GOLD = 2750; sources.GOLD = 'fallback'; }

  return { prices, sources };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICAL INDICATORS (Same as before)
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
  if (closes.length < lookback + 2 || rsiValues.length < lookback + 2) return { bullish: false, bearish: false };
  const currentClose = closes[closes.length - 1];
  const currentRSI = rsiValues[rsiValues.length - 1];
  const prevClose = closes[closes.length - lookback];
  const prevRSI = rsiValues[rsiValues.length - lookback];
  return {
    bullish: currentClose < prevClose && currentRSI > prevRSI && currentRSI < 40,
    bearish: currentClose > prevClose && currentRSI < prevRSI && currentRSI > 60
  };
}

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
// Q7 6-ENGINE ANALYSIS
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
    SWP: { score: 0, direction: null, reason: '', active: false },
    BRK: { score: 0, direction: null, reason: '', active: false },
    MR: { score: 0, direction: null, reason: '', active: false },
    TRND: { score: 0, direction: null, reason: '', active: false },
    MTUM: { score: 0, direction: null, reason: '', active: false },
  };

  // SWP
  const swpSweepLong = current.low < pdl && current.close > pdl;
  const swpWickLong = wickRatioLow > CONFIG.SWP_WICK_RATIO;
  const swpVolLong = volRatio > CONFIG.SWP_VOL_MULT;
  const swpSweepShort = current.high > pdh && current.close < pdh;
  const swpWickShort = wickRatioHigh > CONFIG.SWP_WICK_RATIO;
  const swpVolShort = volRatio > CONFIG.SWP_VOL_MULT;

  if (swpSweepLong && (swpWickLong || swpVolLong)) {
    let s = swpWickLong && swpVolLong ? 90 : 70;
    if (volumeSpike) s += 10;
    signals.SWP = { score: Math.min(100, s), direction: 'LONG', reason: `Sweep PDL + ${swpWickLong ? 'Wick' : 'Vol'}`, active: true };
  } else if (swpSweepShort && (swpWickShort || swpVolShort)) {
    let s = swpWickShort && swpVolShort ? 90 : 70;
    if (volumeSpike) s += 10;
    signals.SWP = { score: Math.min(100, s), direction: 'SHORT', reason: `Sweep PDH + ${swpWickShort ? 'Wick' : 'Vol'}`, active: true };
  }

  // BRK
  if (bbCompressed && current.close > bb.upper && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'BB breakout UP + Vol', active: true };
  } else if (bbCompressed && current.close < bb.lower && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'BB breakout DOWN + Vol', active: true };
  }

  // MR
  const rangingForMR = adx < CONFIG.ADX_MR_MAX;
  if (rangingForMR && rsi < rsiBounds.oversold && (pinBar.bullish || divergence.bullish)) {
    let s = pinBar.bullish && divergence.bullish ? 95 : 75;
    signals.MR = { score: s, direction: 'LONG', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bullish ? 'PinBar' : 'Div'}`, active: true };
  } else if (rangingForMR && rsi > rsiBounds.overbought && (pinBar.bearish || divergence.bearish)) {
    let s = pinBar.bearish && divergence.bearish ? 95 : 75;
    signals.MR = { score: s, direction: 'SHORT', reason: `RSI ${rsi.toFixed(0)} + ${pinBar.bearish ? 'PinBar' : 'Div'}`, active: true };
  }

  // TRND
  const prevClose = closes[closes.length - 2];
  const pullbackLong = (highs[highs.length - 2] - prevClose) > atr * CONFIG.TRND_PULLBACK_ATR;
  const pullbackShort = (prevClose - lows[lows.length - 2]) > atr * CONFIG.TRND_PULLBACK_ATR;

  if (bullTrend && current.close > emaFast && pullbackLong && current.close > prevClose) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'LONG', reason: 'Trend + Pullback', active: true };
  } else if (bearTrend && current.close < emaFast && pullbackShort && current.close < prevClose) {
    signals.TRND = { score: volumeSpike ? 85 : 70, direction: 'SHORT', reason: 'Trend + Pullback', active: true };
  }

  // MTUM
  if (priceChange1h > 0.5 && priceChange4h > 1.0) {
    let s = priceChange1h > 1.0 ? 75 : 60;
    if (volumeSpike) s += 15;
    signals.MTUM = { score: Math.min(100, s), direction: 'LONG', reason: `+${priceChange1h.toFixed(2)}% 1h`, active: true };
  } else if (priceChange1h < -0.5 && priceChange4h < -1.0) {
    let s = priceChange1h < -1.0 ? 75 : 60;
    if (volumeSpike) s += 15;
    signals.MTUM = { score: Math.min(100, s), direction: 'SHORT', reason: `${priceChange1h.toFixed(2)}% 1h`, active: true };
  }

  // Engine selection
  let selectedEngine = null, selectedSignal = null;
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
      indicators: { rsi: rsi.toFixed(1), emaFast: emaFast.toFixed(2), emaSlow: emaSlow.toFixed(2), adx: adx.toFixed(1), priceChange1h: priceChange1h.toFixed(2), volumeSpike, currentPrice: current.close },
      allSignals: signals
    };
  }

  const indicators = { rsi, emaFast, emaSlow, adx, volumeSpike, currentPrice: current.close, priceChange1h, priceChange4h };
  const confluence = calculateConfluence(indicators, selectedSignal.direction);
  const weightedScore = (selectedSignal.score * (CONFIG.ENGINE_WEIGHTS[selectedEngine] / 100)) + (confluence * 0.5);

  return {
    direction: selectedSignal.direction,
    score: weightedScore,
    reasons: [`${selectedEngine}: ${selectedSignal.reason}`, `Confluence: ${confluence}`],
    engine: selectedEngine,
    indicators: {
      rsi: rsi.toFixed(1), emaFast: emaFast.toFixed(2), emaSlow: emaSlow.toFixed(2),
      adx: adx.toFixed(1), priceChange1h: priceChange1h.toFixed(2), priceChange4h: priceChange4h.toFixed(2),
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
// HISTORICAL TRADES FETCHING
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchHistoricalTrades(walletAddr) {
  try {
    const url = `https://backend-global.gains.trade/api/personal-trading-history/${walletAddr}?chainId=42161&limit=500`;
    const data = await httpsGet(url);
    if (!data || !Array.isArray(data)) return [];

    const closedTrades = data.filter(t =>
      t.action === 'TradeClosedMarket' ||
      t.action === 'TradeClosed' ||
      t.action?.includes('Close') ||
      t.closePrice
    );

    return closedTrades.map(t => ({
      timestamp: t.timestamp || t.date || Date.now(),
      pnlUsd: parseFloat(t.pnl || t.pnlNet || 0),
      collateral: parseFloat(t.collateral || t.positionSizeCollateral || 5),
      leverage: parseInt(t.leverage || 25),
      asset: t.pair || t.market || 'UNKNOWN',
      direction: t.buy ? 'LONG' : 'SHORT',
    }));
  } catch (e) {
    console.log('Historical trades fetch failed:', e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE TELEGRAM NOTIFICATIONS - ALPHA FORMAT
// ═══════════════════════════════════════════════════════════════════════════════

async function sendTelegram(message) {
  try {
    await httpsPost(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT, text: message, parse_mode: 'HTML', disable_web_page_preview: true
    });
  } catch (e) { console.log('Telegram failed:', e.message); }
}

// Generate collateral growth bar chart (ASCII)
function generateCollateralBar(current, inception, max) {
  const pct = ((current - inception) / inception) * 100;
  const barLength = Math.min(Math.max(Math.round((current / max) * 10), 1), 10);
  const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
  return { bar, pct };
}

// COMPREHENSIVE SCAN NOTIFICATION
async function sendComprehensiveScanNotification(scanResults, status, historicalStats) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const daysSinceInception = Math.floor((Date.now() - new Date(CONFIG.INCEPTION_DATE).getTime()) / (1000 * 60 * 60 * 24));

  // Calculate totals
  const totalCollateralDeployed = status.positions.reduce((sum, p) => sum + p.collateral, 0);
  const currentCapital = status.balance + totalCollateralDeployed + status.totalPnlUsd;
  const collateralGrowth = generateCollateralBar(currentCapital, CONFIG.INCEPTION_COLLATERAL, Math.max(currentCapital * 1.5, 500));

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔮 <b>Q7 D-RAM v5.2.6 ALPHA SCAN</b>\n`;
  msg += `⏰ ${timestamp} UTC\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // PORTFOLIO OVERVIEW
  msg += `📊 <b>PORTFOLIO OVERVIEW</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ 💰 Available: $${status.balance.toFixed(2)}\n`;
  msg += `│ 🔒 Deployed: $${totalCollateralDeployed.toFixed(2)}\n`;
  msg += `│ 📈 Unrealized: ${status.totalPnlUsd >= 0 ? '+' : ''}$${status.totalPnlUsd.toFixed(2)}\n`;
  msg += `│ 💎 Total Capital: $${currentCapital.toFixed(2)}\n`;
  msg += `└─────────────────────────────\n\n`;

  // COLLATERAL GROWTH CHART
  msg += `📈 <b>COLLATERAL GROWTH</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ 🚀 Inception: $${CONFIG.INCEPTION_COLLATERAL.toFixed(2)}\n`;
  msg += `│ 💎 Current: $${currentCapital.toFixed(2)}\n`;
  msg += `│ ${collateralGrowth.bar} ${collateralGrowth.pct >= 0 ? '+' : ''}${collateralGrowth.pct.toFixed(1)}%\n`;
  msg += `│ 📅 Day ${daysSinceInception} of operation\n`;
  msg += `└─────────────────────────────\n\n`;

  // OPEN POSITIONS
  msg += `💼 <b>OPEN POSITIONS (${status.positions.length}/${CONFIG.MAX_POSITIONS})</b>\n`;
  if (status.positions.length === 0) {
    msg += `│ 📭 No open positions\n`;
  } else {
    for (const pos of status.positions) {
      const emoji = pos.long ? '📈' : '📉';
      const pnlEmoji = pos.pnlUsd >= 0 ? '✅' : '❌';
      msg += `┌─────────────────────────────\n`;
      msg += `│ ${emoji} <b>${pos.long ? 'LONG' : 'SHORT'} ${pos.asset}</b> ${pos.leverage}x\n`;
      msg += `│ 💵 Collateral: $${pos.collateral.toFixed(2)}\n`;
      msg += `│ 📍 Entry: $${pos.openPrice.toFixed(2)} → $${pos.currentPrice.toFixed(2)}\n`;
      msg += `│ ${pnlEmoji} P&L: ${pos.pnlUsd >= 0 ? '+' : ''}$${pos.pnlUsd.toFixed(2)} (${pos.pnlPct >= 0 ? '+' : ''}${pos.pnlPct.toFixed(1)}%)\n`;
      msg += `│ 🎯 TP: $${pos.tp.toFixed(2)} | 🛑 SL: $${pos.sl.toFixed(2)}\n`;
      msg += `└─────────────────────────────\n`;
    }
  }
  msg += `\n`;

  // Q7 ENGINE SIGNALS
  msg += `🔧 <b>Q7 ENGINE ANALYSIS</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (const r of scanResults) {
    const asset = r.asset;
    msg += `\n<b>▸ ${asset}</b>\n`;

    if (r.status === 'positioned') {
      msg += `   ⏸️ Already positioned\n`;
      continue;
    }

    // Show all engine signals with education
    if (r.allSignals) {
      for (const [eng, sig] of Object.entries(r.allSignals)) {
        const edu = ENGINE_EDUCATION[eng];
        const icon = sig.active ? (sig.direction === 'LONG' ? '📈' : '📉') : '⬜';
        const scoreBar = sig.score > 0 ? '█'.repeat(Math.round(sig.score / 20)) + '░'.repeat(5 - Math.round(sig.score / 20)) : '░░░░░';

        msg += `   ${edu.emoji} <b>${edu.name}</b> (${edu.weight})\n`;
        msg += `   ${icon} ${scoreBar} ${sig.score.toFixed(0)}/100\n`;
        if (sig.active && sig.direction) {
          msg += `   └ 🎯 ${sig.direction}: ${sig.reason}\n`;
        }
      }
    }

    // Show indicators
    if (r.indicators) {
      msg += `   ┌ RSI: ${r.indicators.rsi} | ADX: ${r.indicators.adx}\n`;
      msg += `   │ EMA21: ${r.indicators.emaFast} | EMA55: ${r.indicators.emaSlow}\n`;
      msg += `   └ 1h: ${r.indicators.priceChange1h}% | Vol: ${r.indicators.volumeSpike ? '🔥' : '—'}\n`;
    }
  }

  // EXECUTION DECISION
  msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  const best = scanResults.find(r => r.direction && r.score >= CONFIG.MIN_SIGNAL_SCORE);
  if (best) {
    const edu = ENGINE_EDUCATION[best.engine];
    msg += `🎯 <b>EXECUTING: ${best.direction} ${best.asset}</b>\n`;
    msg += `┌─────────────────────────────\n`;
    msg += `│ ${edu.emoji} Engine: ${edu.name}\n`;
    msg += `│ 📊 Score: ${best.score.toFixed(1)} (min: ${CONFIG.MIN_SIGNAL_SCORE})\n`;
    msg += `│ 🎯 Confluence: ${best.indicators?.confluence || 'N/A'}\n`;
    msg += `│ 💪 Leverage: ${calculateDynamicLeverage(best.score, best.asset)}x\n`;
    msg += `└─────────────────────────────\n`;
    msg += `\n💡 <i>${edu.description}</i>\n`;
  } else {
    msg += `⏳ <b>NO EXECUTION</b>\n`;
    msg += `│ All signals below threshold (${CONFIG.MIN_SIGNAL_SCORE})\n`;
    msg += `│ Waiting for higher conviction setup...\n`;
  }

  // HISTORICAL STATS
  if (historicalStats && historicalStats.totalTrades > 0) {
    msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📜 <b>HISTORICAL PERFORMANCE</b>\n`;
    msg += `┌─────────────────────────────\n`;
    msg += `│ 📊 Total Trades: ${historicalStats.totalTrades}\n`;
    msg += `│ ✅ Wins: ${historicalStats.wins} | ❌ Losses: ${historicalStats.losses}\n`;
    msg += `│ 🎯 Win Rate: ${historicalStats.winRate}%\n`;
    msg += `│ 💰 Realized P&L: ${historicalStats.totalPnl >= 0 ? '+' : ''}$${historicalStats.totalPnl.toFixed(2)}\n`;
    msg += `└─────────────────────────────\n`;
  }

  // FOOTER
  msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔗 <a href="https://dtgc.io/perps">dtgc.io/perps</a>\n`;
  msg += `📱 MetalPerps • Q7 D-RAM • Arbitrum\n`;

  return sendTelegram(msg);
}

// TRADE OPENED NOTIFICATION
async function sendTradeOpenNotification(p) {
  const posSize = p.collateral * p.leverage;
  const tpPct = p.direction === 'LONG' ? ((p.tpPrice - p.entryPrice) / p.entryPrice * 100) : ((p.entryPrice - p.tpPrice) / p.entryPrice * 100);
  const slPct = p.direction === 'LONG' ? ((p.entryPrice - p.slPrice) / p.entryPrice * 100) : ((p.slPrice - p.entryPrice) / p.entryPrice * 100);
  const edu = ENGINE_EDUCATION[p.signal?.engine] || ENGINE_EDUCATION.MTUM;

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚡ <b>Q7 TRADE OPENED</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n\n`;

  msg += `🔧 <b>ENGINE</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ ${edu.emoji} ${edu.name} (${edu.weight})\n`;
  msg += `│ 📊 Score: ${p.signal?.score?.toFixed(0) || 'N/A'}\n`;
  msg += `│ 🎯 Confluence: ${p.signal?.indicators?.confluence || 'N/A'}\n`;
  msg += `└─────────────────────────────\n\n`;

  msg += `💵 <b>POSITION</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ 💰 Collateral: $${p.collateral.toFixed(2)}\n`;
  msg += `│ 💪 Leverage: ${p.leverage}x\n`;
  msg += `│ 📐 Size: $${posSize.toFixed(2)}\n`;
  msg += `└─────────────────────────────\n\n`;

  msg += `📍 <b>LEVELS</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ 📍 Entry: $${p.entryPrice.toFixed(2)}\n`;
  msg += `│ 🎯 TP: $${p.tpPrice.toFixed(2)} (+${tpPct.toFixed(1)}%)\n`;
  msg += `│ 🛑 SL: $${p.slPrice.toFixed(2)} (-${slPct.toFixed(1)}%)\n`;
  msg += `│ ⚖️ R:R: 1:${(tpPct / slPct).toFixed(1)}\n`;
  msg += `└─────────────────────────────\n\n`;

  msg += `💡 <i>${edu.trigger}</i>\n\n`;

  msg += `🔗 <a href="https://arbiscan.io/tx/${p.txHash}">View Transaction</a>\n`;

  return sendTelegram(msg);
}

// TRADE CLOSED NOTIFICATION
async function sendTradeCloseNotification(p) {
  const emoji = p.pnlUsd >= 0 ? '💰' : '💸';
  const status = p.reason === 'PROFIT_TARGET' ? '🎯 TARGET HIT' : p.reason === 'STOP_LOSS' ? '🛑 STOPPED OUT' : '✅ CLOSED';

  let msg = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `${emoji} <b>${status}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n\n`;

  msg += `📍 <b>EXECUTION</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ 📍 Entry: $${p.entryPrice.toFixed(2)}\n`;
  msg += `│ 📍 Exit: $${p.exitPrice.toFixed(2)}\n`;
  msg += `│ 💪 Leverage: ${p.leverage}x\n`;
  msg += `└─────────────────────────────\n\n`;

  msg += `💵 <b>RESULT</b>\n`;
  msg += `┌─────────────────────────────\n`;
  msg += `│ ${p.pnlUsd >= 0 ? '✅' : '❌'} P&L: ${p.pnlUsd >= 0 ? '+' : ''}$${p.pnlUsd.toFixed(2)}\n`;
  msg += `│ 📊 ROI: ${p.pnlPct >= 0 ? '+' : ''}${p.pnlPct.toFixed(2)}%\n`;
  if (p.pnlUsd >= 0) {
    msg += `│ 🔄 5% Flywheel: $${(p.pnlUsd * 0.05).toFixed(2)} → PLS\n`;
  }
  msg += `└─────────────────────────────\n\n`;

  msg += `🔗 <a href="https://arbiscan.io/tx/${p.txHash}">View Transaction</a>\n`;

  return sendTelegram(msg);
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
    const data = await httpsGet(`https://backend-arbitrum.eu.gains.trade/open-trades/${wallet.address}`);
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

async function analyzeAsset(asset) {
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
    engines: signal.allSignals || {},
    confluence: signal.indicators?.confluence || 0,
    allSignals: signal.allSignals
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE ENCODING & EXECUTION
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

  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet);
  const collateralWei = ethers.parseUnits(collateral.toString(), 6);
  if ((await usdc.allowance(wallet.address, CONFIG.GTRADE.DIAMOND)) < collateralWei) {
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

  const receipt = await tx.wait();

  await sendTradeOpenNotification({ asset, direction, collateral, leverage: finalLev, entryPrice: currentPrice, tpPrice, slPrice, signal, txHash: tx.hash });

  return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber, leverage: finalLev, entryPrice: currentPrice, tpPrice, slPrice };
}

async function closeTrade(wallet, tradeIndex, position = null) {
  const tx = await wallet.sendTransaction({ to: CONFIG.GTRADE.DIAMOND, data: encodeCloseTrade(tradeIndex), gasLimit: 1500000 });
  await tx.wait();
  if (position) await sendTradeCloseNotification({ ...position, txHash: tx.hash });
  else await sendTelegram(`✅ Closed trade #${tradeIndex}`);
  return { success: true, txHash: tx.hash };
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
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') return { statusCode: 200, headers, body: '{}' };

  let result;
  try {
    let body = event.body ? JSON.parse(event.body) : event.action ? event : event.assets ? { action: 'AUTO_EXECUTE', ...event } : {};
    const action = body.action || 'STATUS';

    console.log(`\n${'═'.repeat(50)}\n🎯 Q7 D-RAM v4.1 ALPHA | Action: ${action}\n${'═'.repeat(50)}`);

    const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);

    switch (action) {
      case 'OPEN_TRADE': result = await openTrade(wallet, body); break;
      case 'CLOSE_TRADE': result = await closeTrade(wallet, body.tradeIndex); break;
      case 'STATUS': result = { success: true, version: 'v4.1-ALPHA', algorithm: 'Q7 D-RAM v5.2.6', ...(await getStatus(wallet)) }; break;
      case 'GET_PRICES':
        const pd = await fetchGTradePrices();
        result = { success: true, ...pd, version: 'v4.1-ALPHA', timestamp: Date.now() };
        break;
      case 'ANALYZE':
        result = { success: true, analysis: await analyzeAsset(body.asset || 'BTC') };
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
            indicators: an.indicators,
            allSignals: an.allSignals
          });

          if (an.direction && an.score >= CONFIG.MIN_SIGNAL_SCORE && (!best || an.score > best.score)) {
            best = an;
          }
        }

        // Fetch historical stats for comprehensive notification
        const historicalTrades = await fetchHistoricalTrades(wallet.address);
        const historicalStats = {
          totalTrades: historicalTrades.length,
          wins: historicalTrades.filter(t => t.pnlUsd > 0).length,
          losses: historicalTrades.filter(t => t.pnlUsd < 0).length,
          winRate: historicalTrades.length > 0 ? Math.round((historicalTrades.filter(t => t.pnlUsd > 0).length / historicalTrades.length) * 100) : 0,
          totalPnl: historicalTrades.reduce((sum, t) => sum + t.pnlUsd, 0),
        };

        await sendComprehensiveScanNotification(scanResults, status, historicalStats);

        if (best) {
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
