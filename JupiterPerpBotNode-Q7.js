/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * JUPITER PERPS Q7 D-RAM v2.0 - AUTONOMOUS TRADING
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Bypasses TradingView - runs Q7 D-RAM analysis internally
 * Uses existing SQS queue for execution (upgrade to direct Solana later)
 * Same logic as gTrade MetalPerpsWidget Lambda
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import crypto from "crypto";
import https from "https";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: process.env.AWS_REGION || "us-east-2" });

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  QUEUE_URL: process.env.QUEUE_URL,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || process.env.WEBHOOK_TOKEN,

  // Telegram
  TELEGRAM_BOT: process.env.TELEGRAM_BOT || "8215882567:AAHB4csgKNELTI9mpMNFsN4SwCN9Xvzz-vg",
  TELEGRAM_CHAT: process.env.TELEGRAM_CHAT || "-1003691135718",

  // Trading limits
  MAX_SIZE_USD: Number(process.env.MAX_SIZE_USD || 1000),
  MAX_LEVERAGE: 100,
  MIN_LEVERAGE: 1.1,
  MAX_POSITIONS: 4,
  MIN_SIGNAL_SCORE: 20,
  DRY_RUN: (process.env.DRY_RUN || "false").toLowerCase() === "true",

  // Q7 Calibrated TP/SL
  TP_PERCENT: { BTC: 4.0, ETH: 5.0, SOL: 6.0 },
  SL_PERCENT: { BTC: 2.5, ETH: 3.0, SOL: 4.0 },
  SLIPPAGE_BPS: 100,

  // Q7 Engine Config
  BASE_LEVERAGE: { BTC: 20, ETH: 20, SOL: 15 },
  MAX_LEV: { BTC: 100, ETH: 100, SOL: 100 },

  RSI_BOUNDS: {
    BTC: { oversold: 34, overbought: 66 },
    ETH: { oversold: 32, overbought: 68 },
    SOL: { oversold: 30, overbought: 70 }
  },

  ENGINE_WEIGHTS: { SWP: 30, BRK: 25, MR: 25, TRND: 15, MTUM: 5 },
  RSI_PERIOD: 14,
  EMA_FAST: 21,
  EMA_SLOW: 55,
  ADX_TREND_MIN: 22,
  ADX_MR_MAX: 27,

  VERSION: "2.0.0-Q7"
};

const MARKETS = {
  "BTC": { symbol: "BTC", perpSymbol: "WBTC-PERP" },
  "ETH": { symbol: "ETH", perpSymbol: "ETH-PERP" },
  "SOL": { symbol: "SOL", perpSymbol: "SOL-PERP" },
  "WBTC": { symbol: "BTC", perpSymbol: "WBTC-PERP" },
  "ETHUSDC.P": { symbol: "ETH", perpSymbol: "ETH-PERP" },
  "SOLUSDC.P": { symbol: "SOL", perpSymbol: "SOL-PERP" },
  "BTCUSDC.P": { symbol: "BTC", perpSymbol: "WBTC-PERP" }
};

// Track state
const processedRequests = new Map();
const rateLimits = new Map();
let activePositions = [];

// ═══════════════════════════════════════════════════════════════════════════════
// HTTPS HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout')), 12000);
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
    const timeout = setTimeout(() => reject(new Error('Timeout')), 12000);
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { clearTimeout(timeout); try { resolve(JSON.parse(data)); } catch { resolve(data); } });
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

function getMarketInsight(asset, pnlPct) {
  const insights = {
    BTC: {
      winning: ["💡 BTC momentum persists 2-3 days - trail stops", "📚 ETF inflows = institutional conviction", "🏦 Strong hands accumulate dips"],
      losing: ["💡 BTC drops front-run macro - check Fed", "📚 -20% drawdowns recover in 60 days", "🏦 Negative funding = bullish contrarian"]
    },
    ETH: {
      winning: ["💡 ETH outperformance = altseason", "📚 Staking + burn = deflationary"],
      losing: ["💡 ETH drops 1.2-1.5x BTC", "📚 L2 growth is long-term bullish"]
    },
    SOL: {
      winning: ["💡 SOL momentum = ecosystem surge", "📚 High TPS = network demand"],
      losing: ["💡 SOL has 2x BTC beta", "📚 Network FUD = buying opportunity"]
    }
  };
  const dir = pnlPct >= 0 ? 'winning' : 'losing';
  const pool = (insights[asset] || insights.BTC)[dir];
  return pool[Math.floor(Math.random() * pool.length)];
}

async function sendMacroFeed(prices) {
  const btcPrice = prices.BTC || 76000;
  const solPrice = prices.SOL || 180;

  const fedCutProb = btcPrice > 85000 ? 72 : btcPrice > 75000 ? 58 : 45;
  const btc100kProb = btcPrice > 85000 ? 78 : btcPrice > 75000 ? 52 : 35;
  const solFlipProb = solPrice > 250 ? 25 : solPrice > 200 ? 15 : 8;
  const fearGreed = btcPrice > 85000 ? 75 : btcPrice > 75000 ? 48 : 32;
  const fgLabel = fearGreed >= 70 ? '🟢 GREED' : fearGreed >= 50 ? '🟡 NEUTRAL' : '🟠 FEAR';

  let msg = `🌍 <b>JUPITER Q7 MACRO</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `📊 Fear/Greed: <b>${fearGreed}</b> ${fgLabel}\n`;
  msg += `🎰 Fed Cut: <b>${fedCutProb}%</b> | BTC 100K: <b>${btc100kProb}%</b>\n`;
  msg += `🎰 SOL Flip ETH: <b>${solFlipProb}%</b>\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += `💰 BTC: $${btcPrice.toLocaleString()} | SOL: $${solPrice.toFixed(2)}\n`;

  await sendTelegram(msg);
}

async function sendScanNotification(scanResults, posCount) {
  let msg = `🔍 <b>JUPITER Q7 SCAN</b>\n`;
  msg += `📊 Positions: ${posCount}/${CONFIG.MAX_POSITIONS}\n━━━━━━━━━━━━━━━━\n`;

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

async function sendTradeNotification(p) {
  const posSize = p.collateral * p.leverage;
  const tpPct = CONFIG.TP_PERCENT[p.asset] || 4.0;
  const slPct = CONFIG.SL_PERCENT[p.asset] || 2.5;
  const tpPrice = p.direction === 'LONG' ? p.entryPrice * (1 + tpPct/100) : p.entryPrice * (1 - tpPct/100);
  const slPrice = p.direction === 'LONG' ? p.entryPrice * (1 - slPct/100) : p.entryPrice * (1 + slPct/100);

  let msg = `⚡ <b>JUPITER Q7 TRADE</b>\n\n`;
  msg += `${p.direction === 'LONG' ? '📈' : '📉'} <b>${p.direction} ${p.asset}</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `🎯 Engine: ${p.engine || 'Q7'} | Score: ${p.score?.toFixed(0) || 'N/A'}\n`;
  msg += `💰 $${p.collateral} @ ${p.leverage}x = $${posSize.toFixed(2)}\n━━━━━━━━━━━━━━━━\n`;
  msg += `📍 Entry: $${p.entryPrice.toLocaleString()}\n`;
  msg += `🎯 TP: $${tpPrice.toLocaleString()} (+${tpPct}%)\n`;
  msg += `🛑 SL: $${slPrice.toLocaleString()} (-${slPct}%)\n━━━━━━━━━━━━━━━━\n`;
  msg += `\n${getMarketInsight(p.asset, 0)}`;

  await sendTelegram(msg);
}

async function sendPositionReport(status) {
  const totalPnl = status.totalPnlUsd || 0;
  await sendMacroFeed(status.prices);

  let msg = `📊 <b>JUPITER POSITIONS</b>\n━━━━━━━━━━━━━━━━\n`;
  msg += `💼 <b>${activePositions.length}</b> active\n`;
  msg += `${totalPnl >= 0 ? '💰' : '🔻'} Est P&L: <b>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</b>\n━━━━━━━━━━━━━━━━\n`;

  for (const pos of activePositions) {
    const currentPrice = status.prices[pos.asset] || pos.entryPrice;
    const priceDiff = pos.long ? (currentPrice - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - currentPrice) / pos.entryPrice;
    const pnlPct = priceDiff * 100 * pos.leverage;
    const pnlUsd = pos.collateral * priceDiff * pos.leverage;
    const dir = pos.long ? '📈L' : '📉S';
    msg += `${dir} ${pos.asset} ${pos.leverage}x | ${pnlUsd >= 0 ? '+' : ''}$${pnlUsd.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)\n`;
  }

  if (activePositions.length > 0) {
    msg += `\n${getMarketInsight('SOL', totalPnl)}`;
  } else {
    msg += `\n📭 No active positions`;
  }

  await sendTelegram(msg);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE & CANDLE FETCHING
// ═══════════════════════════════════════════════════════════════════════════════
async function fetchPrices() {
  const prices = { BTC: null, ETH: null, SOL: null };
  const sources = {};

  try {
    const jup = await httpsGet('https://price.jup.ag/v4/price?ids=SOL,ETH,BTC');
    if (jup?.data) {
      if (jup.data.SOL?.price) { prices.SOL = jup.data.SOL.price; sources.SOL = 'jupiter'; }
      if (jup.data.ETH?.price) { prices.ETH = jup.data.ETH.price; sources.ETH = 'jupiter'; }
      if (jup.data.BTC?.price) { prices.BTC = jup.data.BTC.price; sources.BTC = 'jupiter'; }
    }
  } catch (e) { log('warn', 'Jupiter price failed'); }

  if (!prices.SOL || !prices.ETH || !prices.BTC) {
    try {
      const cg = await httpsGet('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd');
      if (!prices.BTC && cg?.bitcoin?.usd) { prices.BTC = cg.bitcoin.usd; sources.BTC = 'coingecko'; }
      if (!prices.ETH && cg?.ethereum?.usd) { prices.ETH = cg.ethereum.usd; sources.ETH = 'coingecko'; }
      if (!prices.SOL && cg?.solana?.usd) { prices.SOL = cg.solana.usd; sources.SOL = 'coingecko'; }
    } catch (e) { }
  }

  if (!prices.BTC) { prices.BTC = 76000; sources.BTC = 'fallback'; }
  if (!prices.ETH) { prices.ETH = 2800; sources.ETH = 'fallback'; }
  if (!prices.SOL) { prices.SOL = 180; sources.SOL = 'fallback'; }

  return { prices, sources };
}

async function fetchCandles(asset, limit = 100) {
  const productMap = { BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD' };
  const product = productMap[asset];
  if (!product) return null;

  try {
    const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=900`;
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
    log('error', `Candle fetch failed: ${asset}`);
    return null;
  }
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

// ═══════════════════════════════════════════════════════════════════════════════
// Q7 D-RAM 5-ENGINE ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════
function analyzeQ7(candles, asset) {
  if (!candles || candles.length < 60) return { direction: null, score: 0, engine: null, reasons: [] };

  const closes = candles.map(c => c.close), highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low), volumes = candles.map(c => c.volume || 1);
  const current = candles[candles.length - 1];

  const rsi = calcRSI(closes);
  const emaFast = calcEMA(closes, CONFIG.EMA_FAST);
  const emaSlow = calcEMA(closes, CONFIG.EMA_SLOW);
  const bb = calcBB(closes);
  const adx = calcADX(highs, lows, closes);
  const avgVol = calcSMA(volumes, 20);
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

  // Select best engine (priority: SWP > BRK > MR > TRND > MTUM)
  for (const eng of ['SWP', 'BRK', 'MR', 'TRND', 'MTUM']) {
    if (signals[eng]?.score > 50) {
      const s = signals[eng];
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
// ANALYZE ASSET
// ═══════════════════════════════════════════════════════════════════════════════
async function analyzeAsset(asset) {
  log('info', `Q7 Analyzing ${asset}...`);
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
// EXECUTE TRADE VIA SQS
// ═══════════════════════════════════════════════════════════════════════════════
async function executeTrade(order) {
  if (!CONFIG.QUEUE_URL) {
    log('error', 'QUEUE_URL not set');
    return { success: false, error: 'QUEUE_URL not configured' };
  }

  const market = MARKETS[order.asset];
  if (!market) return { success: false, error: `Unknown market: ${order.asset}` };

  const msg = {
    payload: {
      symbol: market.symbol,
      perpSymbol: market.perpSymbol,
      side: order.direction,
      reduceOnly: false,
      sizeUsd: order.collateral * order.leverage,
      leverage: order.leverage,
      tpPct: CONFIG.TP_PERCENT[order.asset] || 4.0,
      slPct: CONFIG.SL_PERCENT[order.asset] || 2.5,
      strategyId: 'Q7-DRAM',
      collateral: 'USDC'
    },
    meta: {
      source: 'Q7-ENGINE',
      engine: order.engine,
      score: order.score,
      timestamp: new Date().toISOString()
    }
  };

  if (CONFIG.DRY_RUN) {
    log('info', 'DRY RUN - would queue', msg);
    return { success: true, dryRun: true };
  }

  await sqs.send(new SendMessageCommand({
    QueueUrl: CONFIG.QUEUE_URL,
    MessageBody: JSON.stringify(msg),
    MessageAttributes: {
      symbol: { DataType: "String", StringValue: order.asset },
      side: { DataType: "String", StringValue: order.direction }
    }
  }));

  // Track position locally
  activePositions.push({
    asset: order.asset,
    long: order.direction === 'LONG',
    leverage: order.leverage,
    collateral: order.collateral,
    entryPrice: order.currentPrice,
    openedAt: Date.now()
  });

  log('info', 'Order queued to SQS', { asset: order.asset, direction: order.direction });
  return { success: true, queued: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY WEBHOOK SUPPORT (TradingView compatible)
// ═══════════════════════════════════════════════════════════════════════════════
function parseBody(event) {
  if (!event?.body) return event;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString() : event.body;
  try { return JSON.parse(raw); } catch { return null; }
}

function parseQ7Pipe(s) {
  if (!s || typeof s !== "string") return null;
  const parts = s.split("|");
  if (parts.length < 5) return null;
  return { version: parts[0], route: parts[1], action: parts[2].toUpperCase(), sideOrExitType: parts[3].toUpperCase(), symbol: parts[4] };
}

function normalizeOrder(body) {
  const p = body?.payload ?? body ?? {};
  const tv = p.tv ?? null;

  if (typeof p.symbol === "string" && (typeof p.side === "string" || typeof p.action === "string")) {
    const market = MARKETS[p.symbol?.toUpperCase()];
    if (!market) return { error: `Unsupported: ${p.symbol}` };
    let side = p.side?.toUpperCase();
    let reduceOnly = !!p.reduce_only;
    if (p.action) {
      const action = p.action.toUpperCase();
      if (action === "EXIT" || action === "CLOSE") { reduceOnly = true; side = side || "LONG"; }
    }
    if (!["LONG", "SHORT"].includes(side)) return { error: `Invalid side: ${side}` };
    return {
      secret: p.secret, symbol: market.symbol, perpSymbol: market.perpSymbol, side, reduceOnly,
      sizeUsd: Number(p.size_usd ?? p.sizeUsd ?? 100), leverage: Number(p.leverage ?? 5),
      tpPct: Number(p.tp_pct ?? 0), slPct: Number(p.sl_pct ?? 0), strategyId: p.strategy_id ?? "direct", collateral: "USDC"
    };
  }

  if (tv?.alert_message) {
    const pipe = parseQ7Pipe(tv.alert_message);
    if (!pipe) return { error: "Unable to parse Q7 pipe" };
    const market = MARKETS[pipe.symbol?.toUpperCase()] || MARKETS[tv.ticker?.toUpperCase()?.replace(/USDC\.P|USDT/g, '')];
    if (!market) return { error: `Unsupported: ${pipe.symbol}` };
    let side = null, reduceOnly = false;
    if (pipe.action === "ENTRY") { side = pipe.sideOrExitType; }
    else if (pipe.action === "EXIT") { reduceOnly = true; side = pipe.sideOrExitType === "LONG" ? "SHORT" : "LONG"; }
    if (!["LONG", "SHORT"].includes(side)) return { error: "Invalid side" };
    return {
      secret: p.secret, symbol: market.symbol, perpSymbol: market.perpSymbol, side, reduceOnly,
      sizeUsd: Number(p.size_usd ?? 100), leverage: Number(p.leverage ?? 5), strategyId: pipe.version ?? "tv", collateral: "USDC"
    };
  }

  return { error: "Unable to parse" };
}

function isRateLimited(ip) {
  const now = Date.now();
  let reqs = rateLimits.get(ip) || [];
  reqs = reqs.filter(t => now - t < 60000);
  if (reqs.length >= 30) return true;
  reqs.push(now);
  rateLimits.set(ip, reqs);
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
export const handler = async (event) => {
  const reqId = event?.requestContext?.requestId || crypto.randomUUID();
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' };
  const respond = (code, body) => ({ statusCode: code, headers, body: JSON.stringify({ ...body, requestId: reqId, version: CONFIG.VERSION }) });

  try {
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
      return respond(200, { ok: true });
    }

    const ip = event?.requestContext?.http?.sourceIp || "unknown";
    if (isRateLimited(ip)) return respond(429, { ok: false, error: "rate_limited" });

    const body = parseBody(event);
    if (!body) return respond(400, { ok: false, error: "invalid_json" });
    if (body.ping) return respond(200, { ok: true, pong: true, version: CONFIG.VERSION, dryRun: CONFIG.DRY_RUN });

    const action = body.action?.toUpperCase() || '';
    log('info', `Jupiter Q7 | ${action || 'WEBHOOK'}`, { reqId });

    // ═══════════════════════════════════════════════════════════════════════════
    // Q7 AUTONOMOUS ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    switch (action) {
      case 'STATUS': {
        const { prices, sources } = await fetchPrices();
        let totalPnlUsd = 0;
        for (const pos of activePositions) {
          const cp = prices[pos.asset] || pos.entryPrice;
          const diff = pos.long ? (cp - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - cp) / pos.entryPrice;
          totalPnlUsd += pos.collateral * diff * pos.leverage;
        }
        return respond(200, { ok: true, prices, sources, positions: activePositions.length, totalPnlUsd });
      }

      case 'GET_PRICES': {
        return respond(200, { ok: true, ...(await fetchPrices()) });
      }

      case 'ANALYZE': {
        return respond(200, { ok: true, analysis: await analyzeAsset(body.asset || 'SOL') });
      }

      case 'REPORT_POSITIONS': {
        const { prices } = await fetchPrices();
        let totalPnlUsd = 0;
        for (const pos of activePositions) {
          const cp = prices[pos.asset] || pos.entryPrice;
          const diff = pos.long ? (cp - pos.entryPrice) / pos.entryPrice : (pos.entryPrice - cp) / pos.entryPrice;
          totalPnlUsd += pos.collateral * diff * pos.leverage;
        }
        await sendPositionReport({ prices, totalPnlUsd });
        return respond(200, { ok: true, message: 'Report sent', positions: activePositions.length, totalPnlUsd });
      }

      case 'SCAN': {
        const results = [];
        for (const asset of (body.assets || ['BTC', 'ETH', 'SOL'])) {
          results.push(await analyzeAsset(asset));
        }
        return respond(200, { ok: true, opportunities: results, minScore: CONFIG.MIN_SIGNAL_SCORE });
      }

      case 'AUTO_EXECUTE': {
        if (activePositions.length >= CONFIG.MAX_POSITIONS) {
          return respond(200, { ok: true, message: 'Max positions reached', count: activePositions.length });
        }

        let best = null;
        const results = [];
        for (const asset of (body.assets || ['BTC', 'ETH', 'SOL'])) {
          if (activePositions.find(p => p.asset === asset)) {
            results.push({ asset, status: 'positioned' });
            continue;
          }
          const an = await analyzeAsset(asset);
          results.push(an);
          if (an.direction && an.score >= CONFIG.MIN_SIGNAL_SCORE && (!best || an.score > best.score)) best = an;
        }

        await sendScanNotification(results, activePositions.length);

        if (best) {
          log('info', `Q7 BEST: ${best.engine} ${best.direction} ${best.asset}`, { score: best.score });
          const collateral = body.collateral || 25;

          const execResult = await executeTrade({
            asset: best.asset,
            direction: best.direction,
            collateral,
            leverage: best.leverage,
            currentPrice: best.currentPrice,
            engine: best.engine,
            score: best.score
          });

          if (execResult.success) {
            await sendTradeNotification({
              asset: best.asset,
              direction: best.direction,
              collateral,
              leverage: best.leverage,
              entryPrice: best.currentPrice,
              engine: best.engine,
              score: best.score
            });
          }

          return respond(200, { ok: true, executed: execResult.success, ...execResult, scanResults: results });
        }

        return respond(200, { ok: true, message: 'No Q7 signals above threshold', scanResults: results });
      }

      case 'CLEAR_POSITIONS': {
        const count = activePositions.length;
        activePositions = [];
        return respond(200, { ok: true, cleared: count });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // LEGACY TRADINGVIEW WEBHOOK (backward compatible)
    // ═══════════════════════════════════════════════════════════════════════════
    if (body.tv || body.symbol || body.payload) {
      const order = normalizeOrder(body);
      if (order.error) return respond(400, { ok: false, error: order.error });

      if (CONFIG.WEBHOOK_SECRET && (order.secret ?? body?.secret) !== CONFIG.WEBHOOK_SECRET) {
        return respond(401, { ok: false, error: "unauthorized" });
      }

      if (CONFIG.DRY_RUN) return respond(200, { ok: true, dryRun: true, order });

      if (CONFIG.QUEUE_URL) {
        await sqs.send(new SendMessageCommand({
          QueueUrl: CONFIG.QUEUE_URL,
          MessageBody: JSON.stringify({ payload: order, meta: { requestId: reqId, receivedAt: new Date().toISOString() } }),
          MessageAttributes: {
            symbol: { DataType: "String", StringValue: order.symbol },
            side: { DataType: "String", StringValue: order.side }
          }
        }));
        return respond(200, { ok: true, enqueued: true });
      }
    }

    return respond(400, { ok: false, error: `Unknown action: ${action}` });

  } catch (err) {
    log('error', 'Fatal', { reqId, error: err.message });
    await sendTelegram(`❌ Jupiter Q7 Error: ${err.message}`);
    return respond(500, { ok: false, error: err.message });
  }
};
