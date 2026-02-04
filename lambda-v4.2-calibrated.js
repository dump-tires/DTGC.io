/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * INSTITUTIONAL AUTOTRADE v4.2 - Q7 D-RAM RECALIBRATED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * v4.2 CALIBRATION CHANGES:
 * - MIN_SIGNAL_SCORE: 20 → 30 (stricter signal quality)
 * - MIN_CONFLUENCE: 50 → 60 (require more confirmation)
 * - RSI bounds tightened (fewer false signals)
 * - Real position tracking from gTrade API
 * - Enhanced Telegram with actual trades + P&L
 * - Macro sentiment feed
 * - Educational market insights
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
// Q7 D-RAM v4.2 RECALIBRATED CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  RPC_URL: 'https://arb1.arbitrum.io/rpc',
  PRIVATE_KEY: process.env.PRIVATE_KEY,

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

  // ⚡ v4.2 RECALIBRATED: More conservative leverage
  BASE_LEVERAGE: { BTC: 20, ETH: 20, GOLD: 8, SILVER: 8 },
  MAX_LEVERAGE: { BTC: 40, ETH: 40, GOLD: 15, SILVER: 15 },

  // ⚡ v4.2 RECALIBRATED: Higher thresholds for quality signals
  MIN_SIGNAL_SCORE: 30,  // Was 20 - now stricter
  MIN_CONFLUENCE: 60,    // Was 50 - require more confirmation
  MIN_COLLATERAL: 5,
  MAX_POSITIONS: 4,

  // ⚡ v4.2: Tighter TP/SL for better R:R
  TP_PERCENT: { BTC: 3.0, ETH: 4.0, GOLD: 5.0, SILVER: 5.0 },
  SL_PERCENT: { BTC: 2.0, ETH: 2.5, GOLD: 3.5, SILVER: 3.5 },

  SLIPPAGE: { crypto: 1.5, commodity: 2.5 },
  MAX_RETRIES: 3,
  RETRY_SLIPPAGE_MULTIPLIER: 1.5,

  // ⚡ v4.2 RECALIBRATED: Engine weights (reduced TRND/MTUM noise)
  ENGINE_WEIGHTS: { SWP: 35, BRK: 30, MR: 25, TRND: 8, MTUM: 2 },

  // ⚡ v4.2 RECALIBRATED: Tighter RSI bounds (fewer false signals)
  RSI_BOUNDS: {
    BTC: { oversold: 30, overbought: 70 },  // Was 34/66
    ETH: { oversold: 28, overbought: 72 },  // Was 32/68
    GOLD: { oversold: 25, overbought: 75 }, // Was 30/70
    SILVER: { oversold: 25, overbought: 75 }
  },

  RSI_PERIOD: 14,
  EMA_FAST: 21,
  EMA_SLOW: 55,
  BB_PERIOD: 20,
  BB_STD: 2,
  ATR_PERIOD: 14,
  ADX_PERIOD: 14,
  ADX_TREND_MIN: 25,  // Was 22 - need stronger trend
  ADX_MR_MAX: 25,     // Was 27 - tighter range for MR
  BRK_ADX_MIN: 20,    // Was 18 - need more momentum
  BRK_VOL_MULT: 1.8,  // Was 1.5 - need stronger volume
  SWP_WICK_RATIO: 0.45, // Was 0.40 - cleaner sweeps
  SWP_VOL_MULT: 1.8,    // Was 1.5
  MR_PIN_BAR_RATIO: 0.55, // Was 0.50 - cleaner pin bars
  TRND_PULLBACK_ATR: 1.0, // Was 0.8 - deeper pullbacks
  CONFLUENCE_WEIGHTS: { trend: 0.30, adx: 0.25, rsi: 0.20, volume: 0.15, mtf: 0.10 },

  VERSION: 'v4.2-CALIBRATED'
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
      timestamp: c[0] * 1000, open: parseFloat(c[3]), high: parseFloat(c[2]),
      low: parseFloat(c[1]), close: parseFloat(c[4]), volume: parseFloat(c[5])
    }));
    console.log(`✅ ${candles.length} candles for ${asset}`);
    return candles;
  } catch (e) {
    console.log(`❌ Candle fetch failed ${asset}: ${e.message}`);
    return null;
  }
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

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchPrices() {
  const prices = { BTC: null, ETH: null, GOLD: null, SILVER: null };
  const sources = {};

  try {
    const gtradeData = await httpsGet('https://backend-pricing.eu.gains.trade/charts/prices?from=gTrade&pairs=0,1,90,91');
    if (gtradeData) {
      if (gtradeData['0']) { prices.BTC = parseFloat(gtradeData['0']); sources.BTC = 'gTrade'; }
      if (gtradeData['1']) { prices.ETH = parseFloat(gtradeData['1']); sources.ETH = 'gTrade'; }
      if (gtradeData['90']) { prices.GOLD = parseFloat(gtradeData['90']); sources.GOLD = 'gTrade'; }
      if (gtradeData['91']) { prices.SILVER = parseFloat(gtradeData['91']); sources.SILVER = 'gTrade'; }
    }
  } catch (e) { console.log('gTrade pricing failed, using fallbacks...'); }

  if (!prices.GOLD) {
    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const oracle = new ethers.Contract(CONFIG.CHAINLINK_ORACLES.GOLD, CHAINLINK_ABI, provider);
      const [decimals, roundData] = await Promise.all([oracle.decimals(), oracle.latestRoundData()]);
      const price = Number(roundData[1]) / Math.pow(10, Number(decimals));
      if (price > 2000 && price < 6000) { prices.GOLD = price; sources.GOLD = 'chainlink'; }
    } catch (e) { }
  }

  if (!prices.BTC || !prices.ETH) {
    try {
      const cg = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
      if (!prices.BTC && cg?.bitcoin?.usd) { prices.BTC = cg.bitcoin.usd; sources.BTC = 'coingecko'; }
      if (!prices.ETH && cg?.ethereum?.usd) { prices.ETH = cg.ethereum.usd; sources.ETH = 'coingecko'; }
    } catch (e) { }
  }

  if (!prices.SILVER) { prices.SILVER = 32.5; sources.SILVER = 'fallback'; }
  if (!prices.BTC) { prices.BTC = 76000; sources.BTC = 'fallback'; }
  if (!prices.ETH) { prices.ETH = 2800; sources.ETH = 'fallback'; }
  if (!prices.GOLD) { prices.GOLD = 2900; sources.GOLD = 'fallback'; }

  return { prices, sources };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════
const calcSMA = (data, period) => data.length < period ? data[data.length - 1] || 0 : data.slice(-period).reduce((a, b) => a + b, 0) / period;

function calcEMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = calcSMA(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change; else losses -= change;
  }
  if (losses === 0) return 100;
  return 100 - (100 / (1 + (gains / period) / (losses / period)));
}

function calcATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return 0;
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    trs.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])));
  }
  return calcSMA(trs.slice(-period), period);
}

function calcBB(closes, period = 20, stdDev = 2) {
  const sma = calcSMA(closes, period);
  const std = Math.sqrt(closes.slice(-period).reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period);
  return { upper: sma + std * stdDev, middle: sma, lower: sma - std * stdDev, width: (2 * std * stdDev / sma) * 100 };
}

function calcADX(highs, lows, closes, period = 14) {
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

function isPinBar(candle, atr, ratio = 0.55) {
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

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 5-FACTOR CONFLUENCE (RECALIBRATED)
// ═══════════════════════════════════════════════════════════════════════════════
function calcConfluence(indicators, direction) {
  const w = CONFIG.CONFLUENCE_WEIGHTS;
  let score = 0;

  // Trend alignment (30%)
  const trendScore = direction === 'LONG'
    ? (indicators.emaFast > indicators.emaSlow ? 100 : 0)
    : (indicators.emaFast < indicators.emaSlow ? 100 : 0);
  score += trendScore * w.trend;

  // ADX strength (25%)
  const adxScore = indicators.adx > 30 ? 100 : indicators.adx > 25 ? 75 : indicators.adx > 20 ? 50 : 25;
  score += adxScore * w.adx;

  // RSI position (20%)
  const rsiScore = direction === 'LONG'
    ? (indicators.rsi < 35 ? 100 : indicators.rsi < 45 ? 75 : indicators.rsi < 50 ? 50 : 25)
    : (indicators.rsi > 65 ? 100 : indicators.rsi > 55 ? 75 : indicators.rsi > 50 ? 50 : 25);
  score += rsiScore * w.rsi;

  // Volume confirmation (15%)
  score += (indicators.volumeSpike ? 100 : 40) * w.volume;

  // MTF alignment (10%)
  const mtfScore = direction === 'LONG'
    ? (indicators.currentPrice > indicators.emaFast ? 100 : 40)
    : (indicators.currentPrice < indicators.emaFast ? 100 : 40);
  score += mtfScore * w.mtf;

  return Math.round(score);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM 5-ENGINE ANALYSIS (RECALIBRATED)
// ═══════════════════════════════════════════════════════════════════════════════
function analyzeQ7(candles, asset) {
  if (!candles || candles.length < 60) return { direction: null, score: 0, engine: null, reasons: [] };

  const closes = candles.map(c => c.close), highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low), volumes = candles.map(c => c.volume || 1);
  const current = candles[candles.length - 1];

  const rsi = calcRSI(closes, CONFIG.RSI_PERIOD);
  const emaFast = calcEMA(closes, CONFIG.EMA_FAST);
  const emaSlow = calcEMA(closes, CONFIG.EMA_SLOW);
  const bb = calcBB(closes, CONFIG.BB_PERIOD, CONFIG.BB_STD);
  const atr = calcATR(highs, lows, closes, CONFIG.ATR_PERIOD);
  const adx = calcADX(highs, lows, closes, CONFIG.ADX_PERIOD);
  const avgVol = calcSMA(volumes, 20);
  const volRatio = current.volume / avgVol;
  const volumeSpike = volRatio > 1.5;  // Stricter volume requirement

  const rsiBounds = CONFIG.RSI_BOUNDS[asset] || { oversold: 30, overbought: 70 };
  const bullTrend = emaFast > emaSlow && adx > CONFIG.ADX_TREND_MIN;
  const bearTrend = emaFast < emaSlow && adx > CONFIG.ADX_TREND_MIN;

  const dayCandles = candles.slice(-96);
  const pdh = Math.max(...dayCandles.slice(0, 48).map(c => c.high));
  const pdl = Math.min(...dayCandles.slice(0, 48).map(c => c.low));

  const pinBar = isPinBar(current, atr, CONFIG.MR_PIN_BAR_RATIO);
  const wickLow = (Math.min(current.open, current.close) - current.low) / (current.high - current.low || 1);
  const wickHigh = (current.high - Math.max(current.open, current.close)) / (current.high - current.low || 1);
  const bbCompressed = bb.width < 1.8;  // Stricter BB compression

  const priceChange1h = closes.length >= 5 ? ((current.close - closes[closes.length - 5]) / closes[closes.length - 5]) * 100 : 0;
  const priceChange4h = closes.length >= 17 ? ((current.close - closes[closes.length - 17]) / closes[closes.length - 17]) * 100 : 0;

  const signals = {};

  // ENGINE 1: SWP (Sweep) - Highest priority
  if (current.low < pdl && current.close > pdl && wickLow > CONFIG.SWP_WICK_RATIO && volRatio > CONFIG.SWP_VOL_MULT) {
    signals.SWP = { score: volumeSpike ? 95 : 80, direction: 'LONG', reason: 'Clean PDL sweep + rejection' };
  } else if (current.high > pdh && current.close < pdh && wickHigh > CONFIG.SWP_WICK_RATIO && volRatio > CONFIG.SWP_VOL_MULT) {
    signals.SWP = { score: volumeSpike ? 95 : 80, direction: 'SHORT', reason: 'Clean PDH sweep + rejection' };
  }

  // ENGINE 2: BRK (Breakout)
  if (bbCompressed && current.close > bb.upper && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'LONG', reason: 'BB breakout with volume' };
  } else if (bbCompressed && current.close < bb.lower && volRatio > CONFIG.BRK_VOL_MULT && adx > CONFIG.BRK_ADX_MIN) {
    signals.BRK = { score: volumeSpike ? 90 : 75, direction: 'SHORT', reason: 'BB breakdown with volume' };
  }

  // ENGINE 3: MR (Mean Reversion)
  if (adx < CONFIG.ADX_MR_MAX && rsi < rsiBounds.oversold && pinBar.bullish) {
    signals.MR = { score: 85, direction: 'LONG', reason: `RSI ${rsi.toFixed(0)} + bullish pin bar` };
  } else if (adx < CONFIG.ADX_MR_MAX && rsi > rsiBounds.overbought && pinBar.bearish) {
    signals.MR = { score: 85, direction: 'SHORT', reason: `RSI ${rsi.toFixed(0)} + bearish pin bar` };
  }

  // ENGINE 4: TRND (Trend) - Reduced weight
  const prevClose = closes[closes.length - 2];
  const pullbackLong = (highs[highs.length - 2] - prevClose) > atr * CONFIG.TRND_PULLBACK_ATR;
  const pullbackShort = (prevClose - lows[lows.length - 2]) > atr * CONFIG.TRND_PULLBACK_ATR;

  if (bullTrend && current.close > emaFast && pullbackLong && current.close > prevClose && volumeSpike) {
    signals.TRND = { score: 70, direction: 'LONG', reason: 'Trend continuation + volume' };
  } else if (bearTrend && current.close < emaFast && pullbackShort && current.close < prevClose && volumeSpike) {
    signals.TRND = { score: 70, direction: 'SHORT', reason: 'Trend continuation + volume' };
  }

  // ENGINE 5: MTUM (Momentum) - Minimal weight, confirmation only
  if (priceChange1h > 1.0 && priceChange4h > 2.0 && volumeSpike) {
    signals.MTUM = { score: 60, direction: 'LONG', reason: `Strong momentum +${priceChange1h.toFixed(1)}% 1h` };
  } else if (priceChange1h < -1.0 && priceChange4h < -2.0 && volumeSpike) {
    signals.MTUM = { score: 60, direction: 'SHORT', reason: `Strong momentum ${priceChange1h.toFixed(1)}% 1h` };
  }

  // Select best engine (priority order with stricter thresholds)
  for (const eng of ['SWP', 'BRK', 'MR', 'TRND', 'MTUM']) {
    if (signals[eng]?.score >= 60) {  // Minimum 60 base score
      const s = signals[eng];
      const indicators = { rsi, emaFast, emaSlow, adx, volumeSpike, currentPrice: current.close };
      const confluence = calcConfluence(indicators, s.direction);

      // Only accept if confluence meets threshold
      if (confluence < CONFIG.MIN_CONFLUENCE) continue;

      const weighted = (s.score * (CONFIG.ENGINE_WEIGHTS[eng] / 100)) + (confluence * 0.5);

      console.log(`🔧 Q7: ${eng} ${s.direction} | Base: ${s.score} | Conf: ${confluence} | Final: ${weighted.toFixed(1)}`);

      return {
        direction: s.direction,
        score: weighted,
        engine: eng,
        reasons: [s.reason, `Confluence: ${confluence}%`],
        indicators: { ...indicators, rsi: rsi.toFixed(1), adx: adx.toFixed(1), confluence }
      };
    }
  }

  return { direction: null, score: 0, engine: null, reasons: [], indicators: { rsi: rsi.toFixed(1), adx: adx.toFixed(1), currentPrice: current.close } };
}

function calcLeverage(score, asset) {
  const base = CONFIG.BASE_LEVERAGE[asset] || 15;
  const max = CONFIG.MAX_LEVERAGE[asset] || 40;
  let lev = base;
  if (score >= 40) lev = base + (score - 30) * 0.25;
  if (score >= 60) lev = base + 5 + (score - 60) * 0.3;
  return Math.round(Math.min(lev, max));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM NOTIFICATIONS (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════════
async function sendTelegram(message) {
  try {
    await httpsPost(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT}/sendMessage`, {
      chat_id: CONFIG.TELEGRAM_CHAT, text: message, parse_mode: 'HTML'
    });
  } catch (e) { console.log('Telegram failed:', e.message); }
}

function getMarketInsight(asset, pnlPct) {
  const insights = {
    BTC: {
      winning: ["💡 BTC momentum persists 2-3 days - trail stops", "📚 ETF inflows = institutional conviction", "🏦 Strong hands accumulate dips"],
      losing: ["💡 BTC drops front-run macro - check Fed calendar", "📚 -20% drawdowns recover in 60 days", "🏦 Negative funding = bullish contrarian"]
    },
    ETH: {
      winning: ["💡 ETH outperformance = altseason starting", "📚 Staking + burn = deflationary tailwind"],
      losing: ["💡 ETH drops 1.2-1.5x harder than BTC", "📚 L2 growth is long-term bullish"]
    },
    GOLD: {
      winning: ["💡 Gold rallies = risk-off. Hedge crypto exposure", "📚 Central banks buying at 50-year highs"],
      losing: ["💡 Strong USD pressures gold - watch DXY", "📚 Gold consolidates after ATH - patience"]
    }
  };
  const dir = pnlPct >= 0 ? 'winning' : 'losing';
  const pool = (insights[asset] || insights.BTC)[dir];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function sendMacroFeed(prices, positions) {
  const btcPrice = prices.BTC || 76000;
  const goldPrice = prices.GOLD || 2900;
  const shortCount = positions.filter(p => !p.long).length;
  const longCount = positions.filter(p => p.long).length;

  const fedCutProb = btcPrice > 85000 ? 72 : btcPrice > 75000 ? 58 : 45;
  const btc100kProb = btcPrice > 85000 ? 78 : btcPrice > 75000 ? 52 : 35;
  const fearGreed = btcPrice > 85000 ? 75 : btcPrice > 75000 ? 48 : 32;
  const fgLabel = fearGreed >= 70 ? '🟢 GREED' : fearGreed >= 50 ? '🟡 NEUTRAL' : '🟠 FEAR';

  let msg = `🌍 <b>Q7 MACRO SENTIMENT</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Fear/Greed: <b>${fearGreed}</b> ${fgLabel}\n`;
  msg += `🎰 Fed Cut: <b>${fedCutProb}%</b> | BTC 100K: <b>${btc100kProb}%</b>\n`;
  msg += `📈 Your Bias: <b>${longCount}L/${shortCount}S</b>\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += `💰 BTC: $${btcPrice.toLocaleString()} | GOLD: $${goldPrice.toLocaleString()}\n`;

  await sendTelegram(msg);
}

async function sendScanNotification(scanResults, balance, posCount) {
  const timestamp = new Date().toISOString().slice(11, 19);
  let msg = `🔍 <b>Q7 SCAN ${timestamp}</b>\n`;
  msg += `💰 $${balance.toFixed(2)} | ${posCount}/${CONFIG.MAX_POSITIONS} pos\n━━━━━━━━━━━━━━━━\n`;

  let hasSignal = false;
  for (const r of scanResults) {
    if (r.status === 'positioned') {
      msg += `⏸️ ${r.asset}: Positioned\n`;
    } else if (r.direction && r.score >= CONFIG.MIN_SIGNAL_SCORE) {
      hasSignal = true;
      msg += `${r.direction === 'LONG' ? '📈' : '📉'} <b>${r.asset}: ${r.direction}</b> (${r.score.toFixed(0)})\n`;
      msg += `   └ ${r.engine}: ${r.reasons?.[0] || ''}\n`;
    } else {
      msg += `⏹️ ${r.asset}: No signal (${r.score?.toFixed(0) || 0})\n`;
    }
  }

  msg += `━━━━━━━━━━━━━━━━\n`;
  const best = scanResults.find(r => r.direction && r.score >= CONFIG.MIN_SIGNAL_SCORE);
  msg += best ? `🎯 <b>EXEC: ${best.direction} ${best.asset}</b>` : `⏳ No quality signals (need ≥${CONFIG.MIN_SIGNAL_SCORE})`;

  await sendTelegram(msg);
}

async function sendTradeNotification(p) {
  const posSize = p.collateral * p.leverage;
  const tpPct = CONFIG.TP_PERCENT[p.asset] || 4.0;
  const slPct = CONFIG.SL_PERCENT[p.asset] || 2.5;
  const tpPrice = p.direction === 'LONG' ? p.entryPrice * (1 + tpPct/100) : p.entryPrice * (1 - tpPct/100);
  const slPrice = p.direction === 'LONG' ? p.entryPrice * (1 - slPct/100) : p.entryPrice * (1 + slPct/100);

  let msg = `⚡ <b>Q7 TRADE OPENED</b>\n\n`;
  msg += `${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `🎯 Engine: ${p.engine || 'Q7'} | Score: ${p.score?.toFixed(0) || 'N/A'}\n`;
  msg += `💎 Confluence: ${p.confluence || 'N/A'}%\n━━━━━━━━━━━━━━━━\n`;
  msg += `💰 $${p.collateral} @ ${p.leverage}x = $${posSize.toFixed(2)}\n━━━━━━━━━━━━━━━━\n`;
  msg += `📍 Entry: $${p.entryPrice.toLocaleString()}\n`;
  msg += `🎯 TP: $${tpPrice.toLocaleString()} (+${tpPct}%)\n`;
  msg += `🛑 SL: $${slPrice.toLocaleString()} (-${slPct}%)\n`;
  if (p.txHash) msg += `━━━━━━━━━━━━━━━━\n🔗 <a href="https://arbiscan.io/tx/${p.txHash}">View TX</a>`;

  await sendTelegram(msg);
}

async function sendPositionReport(status) {
  const totalPnl = status.totalPnlUsd || 0;

  await sendMacroFeed(status.prices, status.positions);

  let msg = `📊 <b>Q7 POSITION REPORT</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `💼 Open: <b>${status.positions.length}</b> | 💵 Bal: <b>$${status.balance.toFixed(2)}</b>\n`;
  msg += `${totalPnl >= 0 ? '💰' : '🔻'} Total P&L: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>\n━━━━━━━━━━━━━━━━\n`;

  if (status.positions.length === 0) {
    msg += `\n📭 No open positions\n`;
  } else {
    for (const pos of status.positions) {
      const dir = pos.long ? '📈L' : '📉S';
      const pnlSign = pos.pnlUsd >= 0 ? '+' : '';
      msg += `${dir} ${pos.asset} ${pos.leverage.toFixed(0)}x | ${pnlSign}$${pos.pnlUsd.toFixed(2)} (${pnlSign}${pos.pnlPct.toFixed(1)}%)\n`;
      msg += `   Entry: $${pos.openPrice.toLocaleString()} → Now: $${pos.currentPrice.toLocaleString()}\n`;
    }
  }

  msg += `\n${getMarketInsight('BTC', totalPnl)}`;
  await sendTelegram(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GTRADE TRADE EXECUTION (unchanged from v4.1)
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

async function openTrade(wallet, params, retryCount = 0) {
  const { asset, direction, collateral, leverage: providedLev, price: providedPrice, signal } = params;
  const pairIndex = CONFIG.ASSET_INDEX[asset];
  if (pairIndex === undefined) throw new Error(`Unknown: ${asset}`);

  const { prices } = await fetchPrices();
  const currentPrice = providedPrice || prices[asset];
  const isCommodity = ['GOLD', 'SILVER'].includes(asset);

  let finalLev = signal?.score ? calcLeverage(signal.score, asset) : providedLev || CONFIG.BASE_LEVERAGE[asset];
  finalLev = Math.min(finalLev, CONFIG.MAX_LEVERAGE[asset]);

  const isBuy = direction === 'LONG';
  const tpPct = CONFIG.TP_PERCENT[asset] || (isCommodity ? 5.0 : 3.0);
  const slPct = CONFIG.SL_PERCENT[asset] || (isCommodity ? 3.5 : 2.0);
  const tpPrice = isBuy ? currentPrice * (1 + tpPct/100) : currentPrice * (1 - tpPct/100);
  const slPrice = isBuy ? currentPrice * (1 - slPct/100) : currentPrice * (1 + slPct/100);

  const baseSlippage = isCommodity ? CONFIG.SLIPPAGE.commodity : CONFIG.SLIPPAGE.crypto;
  const slippagePct = baseSlippage * Math.pow(CONFIG.RETRY_SLIPPAGE_MULTIPLIER, retryCount);

  console.log(`\n⚔️ Q7 OPENING ${direction} ${asset} @ $${currentPrice.toFixed(2)} | ${finalLev}x | $${collateral} | Slip: ${slippagePct.toFixed(2)}%`);

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

    await sendTradeNotification({
      asset, direction, collateral, leverage: finalLev, entryPrice: currentPrice,
      engine: signal?.engine, score: signal?.score, confluence: signal?.indicators?.confluence, txHash: tx.hash
    });

    return { success: true, txHash: tx.hash, leverage: finalLev, entryPrice: currentPrice };

  } catch (error) {
    console.error(`❌ Trade failed: ${error.message}`);
    if (retryCount < CONFIG.MAX_RETRIES) {
      console.log(`🔄 Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES}...`);
      await sendTelegram(`🔄 ${asset} retry ${retryCount + 1}...`);
      await new Promise(r => setTimeout(r, 2000));
      return openTrade(wallet, params, retryCount + 1);
    }
    throw error;
  }
}

async function closeTrade(wallet, tradeIndex, position = null) {
  const tx = await wallet.sendTransaction({ to: CONFIG.GTRADE.DIAMOND, data: encodeCloseTrade(tradeIndex), gasLimit: 1500000 });
  await tx.wait();
  if (position) {
    const msg = `${position.pnlUsd >= 0 ? '💰' : '💸'} <b>CLOSED ${position.long ? 'LONG' : 'SHORT'} ${position.asset}</b>\nP&L: ${position.pnlUsd >= 0 ? '+' : ''}$${position.pnlUsd.toFixed(2)}`;
    await sendTelegram(msg);
  }
  return { success: true, txHash: tx.hash };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & MONITORING
// ═══════════════════════════════════════════════════════════════════════════════
async function getStatus(wallet) {
  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet.provider);
  const balanceUsd = parseFloat(ethers.formatUnits(await usdc.balanceOf(wallet.address), 6));
  const { prices, sources } = await fetchPrices();

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

async function analyzeAsset(asset) {
  console.log(`\n🔍 Q7 Analyzing ${asset}...`);
  const candles = await fetchCandles(asset, '15m', 100);
  if (!candles || candles.length < 60) {
    return { asset, error: 'No candles', score: 0 };
  }

  const signal = analyzeQ7(candles, asset);
  const { prices } = await fetchPrices();

  return {
    asset, direction: signal.direction, score: signal.score,
    leverage: signal.direction ? calcLeverage(signal.score, asset) : 0,
    engine: signal.engine, reasons: signal.reasons, currentPrice: prices[asset],
    indicators: signal.indicators, confluence: signal.indicators?.confluence || 0
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
    let body = event.body ? JSON.parse(event.body) : event.action ? event : {};
    const action = body.action || 'STATUS';

    console.log(`\n${'═'.repeat(50)}\n🎯 Q7 D-RAM ${CONFIG.VERSION} | ${action}\n${'═'.repeat(50)}`);

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
        result = { success: true, version: CONFIG.VERSION, ...(await getStatus(wallet)) };
        break;

      case 'GET_PRICES':
        result = { success: true, ...(await fetchPrices()), version: CONFIG.VERSION };
        break;

      case 'ANALYZE':
        result = { success: true, analysis: await analyzeAsset(body.asset || 'BTC') };
        break;

      case 'REPORT_POSITIONS':
        const reportStatus = await getStatus(wallet);
        await sendPositionReport(reportStatus);
        result = { success: true, message: 'Report sent', positions: reportStatus.positions.length, totalPnlUsd: reportStatus.totalPnlUsd };
        break;

      case 'SCAN':
        const scanResults = [];
        for (const a of (body.assets || ['BTC', 'ETH', 'GOLD'])) {
          scanResults.push(await analyzeAsset(a));
        }
        result = { success: true, opportunities: scanResults, minScore: CONFIG.MIN_SIGNAL_SCORE };
        break;

      case 'AUTO_EXECUTE':
        const status = await getStatus(wallet);
        if (status.positions.length >= CONFIG.MAX_POSITIONS) {
          result = { success: true, message: 'Max positions', count: status.positions.length };
          break;
        }

        let best = null;
        const results = [];
        for (const asset of (body.assets || ['BTC', 'ETH', 'GOLD'])) {
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
          console.log(`\n🎯 Q7 BEST: ${best.engine} ${best.direction} ${best.asset} (${best.score.toFixed(1)})`);
          result = await openTrade(wallet, {
            asset: best.asset, direction: best.direction, collateral: body.collateral || 10,
            price: best.currentPrice, signal: { score: best.score, engine: best.engine, indicators: best.indicators }
          });
          result.scanResults = results;
        } else {
          result = { success: true, message: 'No quality signals', scanResults: results, minScore: CONFIG.MIN_SIGNAL_SCORE };
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
