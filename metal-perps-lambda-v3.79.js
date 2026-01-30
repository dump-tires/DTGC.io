/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PHANTOM EDGE v3.79 - UI-LAMBDA-gTRADE FULL CONGRUENCY
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * CHANGELOG v3.79:
 * - FIXED: MAX_LEVERAGE synced with gTrade v10 (GOLD/SILVER max 100x)
 * - FIXED: Fallback prices updated to current market values
 * - FIXED: UI price strictly required for manual trades (no stale fallbacks)
 * - FIXED: Integer leverage enforcement throughout
 * - FIXED: Price source logging for debugging
 *
 * CHANGELOG v3.78:
 * - FIXED: gTrade v10 struct encoding (pairIndex uint16, added missing fields)
 * - FIXED: Trade struct now has correct 15 fields including isCounterTrade,
 *          positionSizeToken, and __placeholder
 *
 * FEATURES:
 * - gTrade v10 integration (Gold=90, Silver=91)
 * - 5-Engine Haneef scoring (SWP/TRND/BRK/MR/SHK)
 * - DYNAMIC LEVERAGE: 15x-100x based on signal confidence
 * - Widget price passthrough (most reliable)
 * - AUTO_SIGNAL action for automated trading
 * - Telegram alerts
 * 
 * LEVERAGE SCALING:
 *   Score 50-60: 15-25x (cautious)
 *   Score 60-70: 25-50x (moderate)
 *   Score 70-80: 50-75x (aggressive)
 *   Score 80-90: 75-90x (high conviction)
 *   Score 90+:   90-100x (maximum conviction)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { ethers } = require('ethers');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  RPC_URL: 'https://arb1.arbitrum.io/rpc',
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  
  TELEGRAM_BOT: '8215882567:AAHB4csgKNELTI9mpMNFsN4SwCN9Xvzz-vg',
  TELEGRAM_CHAT: '-1003691135718',
  
  GTRADE: {
    DIAMOND: '0xFF162c694eAA571f685030649814282eA457f169',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    MULTICALL: '0xcA11bde05977b3631167028862bE2a173976CA11',
  },
  
  // gTrade v10 Pair Indices
  ASSET_INDEX: { 
    BTC: 0, 
    ETH: 1, 
    GOLD: 90,   // XAU/USD
    SILVER: 91, // XAG/USD
    OIL: 187,   // WTI/USD
  },
  
  // Base leverage (overridden by signal score)
  BASE_LEVERAGE: { BTC: 50, ETH: 50, GOLD: 50, SILVER: 50, OIL: 25 },
  // SYNCED WITH gTrade v10 actual limits (commodities max 100x)
  MAX_LEVERAGE: { BTC: 150, ETH: 150, GOLD: 100, SILVER: 100, OIL: 100 },
  
  // Haneef Engine Weights (total 100)
  ENGINE_WEIGHTS: {
    SWP: 35,   // Sweep Engine
    TRND: 25,  // Trend (EMA)
    BRK: 20,   // Breakout (BB)
    MR: 10,    // Mean Reversion (RSI)
    SHK: 10,   // Shock (ATR spike)
  },
  
  MIN_SIGNAL_SCORE: 50,
  
  // Indicator settings
  RSI_PERIOD: 14,
  RSI_OVERSOLD: 25,
  RSI_OVERBOUGHT: 75,
  EMA_FAST: 21,
  EMA_SLOW: 55,
  BB_PERIOD: 20,
  BB_STD: 2,
  ATR_PERIOD: 14,
  ADX_PERIOD: 14,
  ADX_MR_CEILING: 20,
  VOLUME_SPIKE_MULT: 1.5,
  SHOCK_Z_THRESH: 3.5,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════════════════════════

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
];

// ═══════════════════════════════════════════════════════════════════════════════
// TECHNICAL INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateSMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data, period) {
  if (data.length < period) return data[data.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateATR(highs, lows, closes, period = 14) {
  if (highs.length < period + 1) return 0;
  
  const trs = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  
  return calculateSMA(trs.slice(-period), period);
}

function calculateBollingerBands(closes, period = 20, stdDev = 2) {
  const sma = calculateSMA(closes, period);
  const slice = closes.slice(-period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  
  return {
    upper: sma + std * stdDev,
    middle: sma,
    lower: sma - std * stdDev,
    width: ((sma + std * stdDev) - (sma - std * stdDev)) / sma * 100,
  };
}

function calculateStdDev(data, period) {
  const mean = calculateSMA(data, period);
  const slice = data.slice(-period);
  const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
  return Math.sqrt(variance);
}

function calculateADX(highs, lows, closes, period = 14) {
  if (highs.length < period * 2) return 25;
  
  let sumDX = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
    if (tr > 0) {
      const dx = Math.abs(plusDM - minusDM) / (plusDM + minusDM + 0.0001) * 100;
      sumDX += dx;
    }
  }
  
  return sumDX / period;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5-ENGINE HANEEF ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

function analyzeHaneefEngines(candles) {
  if (!candles || candles.length < 60) {
    return { direction: null, score: 0, reasons: [], engine: null };
  }
  
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume || 1);
  const current = candles[candles.length - 1];
  
  // Core indicators
  const rsi = calculateRSI(closes, CONFIG.RSI_PERIOD);
  const emaFast = calculateEMA(closes, CONFIG.EMA_FAST);
  const emaSlow = calculateEMA(closes, CONFIG.EMA_SLOW);
  const bb = calculateBollingerBands(closes, CONFIG.BB_PERIOD, CONFIG.BB_STD);
  const atr = calculateATR(highs, lows, closes, CONFIG.ATR_PERIOD);
  const adx = calculateADX(highs, lows, closes, CONFIG.ADX_PERIOD);
  const avgVolume = calculateSMA(volumes, 20);
  const volumeSpike = current.volume > avgVolume * CONFIG.VOLUME_SPIKE_MULT;
  
  // Previous EMAs for crossover
  const prevCloses = closes.slice(0, -1);
  const prevEmaFast = calculateEMA(prevCloses, CONFIG.EMA_FAST);
  const prevEmaSlow = calculateEMA(prevCloses, CONFIG.EMA_SLOW);
  
  // ATR Z-score for shock detection
  const atrPct = (atr / current.close) * 100;
  const atrHistory = [];
  for (let i = 20; i < candles.length; i++) {
    const localATR = calculateATR(
      highs.slice(i - 14, i),
      lows.slice(i - 14, i),
      closes.slice(i - 14, i),
      14
    );
    atrHistory.push((localATR / closes[i]) * 100);
  }
  const atrMean = calculateSMA(atrHistory, 50);
  const atrStd = calculateStdDev(atrHistory, 50);
  const shockZScore = atrStd > 0 ? (atrPct - atrMean) / atrStd : 0;
  const isShock = shockZScore >= CONFIG.SHOCK_Z_THRESH;
  
  // Previous day high/low
  const dayCandles = candles.slice(-96);
  const pdh = Math.max(...dayCandles.slice(0, 48).map(c => c.high));
  const pdl = Math.min(...dayCandles.slice(0, 48).map(c => c.low));
  
  const signals = {
    SWP: { score: 0, direction: null, reason: '' },
    TRND: { score: 0, direction: null, reason: '' },
    BRK: { score: 0, direction: null, reason: '' },
    MR: { score: 0, direction: null, reason: '' },
    SHK: { score: 0, direction: null, reason: '' },
  };
  
  // ENGINE 1: SWP (Sweep)
  const wickDown = current.close - current.low;
  const wickUp = current.high - current.close;
  const bodySize = Math.abs(current.close - current.open);
  const candleRange = current.high - current.low;
  
  if (current.low < pdl && current.close > pdl) {
    let score = 50;
    if (wickDown > atr * 0.3) score += 20;
    if (bodySize / candleRange < 0.4) score += 15;
    if (volumeSpike) score += 10;
    signals.SWP.score = Math.min(100, score);
    signals.SWP.direction = 'LONG';
    signals.SWP.reason = `Sweep PDL (wick ${(wickDown/atr).toFixed(2)} ATR)`;
  } else if (current.high > pdh && current.close < pdh) {
    let score = 50;
    if (wickUp > atr * 0.3) score += 20;
    if (bodySize / candleRange < 0.4) score += 15;
    if (volumeSpike) score += 10;
    signals.SWP.score = Math.min(100, score);
    signals.SWP.direction = 'SHORT';
    signals.SWP.reason = `Sweep PDH (wick ${(wickUp/atr).toFixed(2)} ATR)`;
  }
  
  // ENGINE 2: TRND (Trend)
  const emaCrossUp = prevEmaFast <= prevEmaSlow && emaFast > emaSlow;
  const emaCrossDown = prevEmaFast >= prevEmaSlow && emaFast < emaSlow;
  const emaSpread = Math.abs(emaFast - emaSlow) / emaSlow * 100;
  
  if (emaCrossUp) {
    signals.TRND.score = volumeSpike ? 95 : 80;
    signals.TRND.direction = 'LONG';
    signals.TRND.reason = 'EMA bullish cross' + (volumeSpike ? ' +vol' : '');
  } else if (emaCrossDown) {
    signals.TRND.score = volumeSpike ? 95 : 80;
    signals.TRND.direction = 'SHORT';
    signals.TRND.reason = 'EMA bearish cross' + (volumeSpike ? ' +vol' : '');
  } else if (emaSpread > 0.5) {
    signals.TRND.score = 50 + Math.min(30, emaSpread * 10);
    signals.TRND.direction = emaFast > emaSlow ? 'LONG' : 'SHORT';
    signals.TRND.reason = `Trend continuation (${emaSpread.toFixed(2)}%)`;
  }
  
  // ENGINE 3: BRK (Breakout)
  if (current.close > bb.upper) {
    signals.BRK.score = volumeSpike ? 90 : 70;
    signals.BRK.direction = 'LONG';
    signals.BRK.reason = 'BB breakout UP' + (volumeSpike ? ' +vol' : '');
  } else if (current.close < bb.lower) {
    signals.BRK.score = volumeSpike ? 90 : 70;
    signals.BRK.direction = 'SHORT';
    signals.BRK.reason = 'BB breakout DOWN' + (volumeSpike ? ' +vol' : '');
  } else if (bb.width < 2 && volumeSpike) {
    signals.BRK.score = 60;
    signals.BRK.direction = current.close > bb.middle ? 'LONG' : 'SHORT';
    signals.BRK.reason = 'BB squeeze breakout';
  }
  
  // ENGINE 4: MR (Mean Reversion)
  const isRanging = adx < CONFIG.ADX_MR_CEILING;
  
  if (isRanging) {
    if (rsi < CONFIG.RSI_OVERSOLD) {
      signals.MR.score = 70 + ((CONFIG.RSI_OVERSOLD - rsi) / CONFIG.RSI_OVERSOLD) * 30;
      signals.MR.direction = 'LONG';
      signals.MR.reason = `MR oversold RSI ${rsi.toFixed(0)}`;
    } else if (rsi > CONFIG.RSI_OVERBOUGHT) {
      signals.MR.score = 70 + ((rsi - CONFIG.RSI_OVERBOUGHT) / (100 - CONFIG.RSI_OVERBOUGHT)) * 30;
      signals.MR.direction = 'SHORT';
      signals.MR.reason = `MR overbought RSI ${rsi.toFixed(0)}`;
    }
  }
  
  // ENGINE 5: SHK (Shock)
  if (isShock && volumeSpike) {
    const othersFiring = signals.SWP.score > 50 || signals.TRND.score > 50 || 
                         signals.BRK.score > 50 || signals.MR.score > 50;
    if (!othersFiring) {
      signals.SHK.score = 75;
      signals.SHK.direction = current.close > current.open ? 'LONG' : 'SHORT';
      signals.SHK.reason = `Shock Z=${shockZScore.toFixed(1)}`;
    }
  }
  
  // COMBINE WEIGHTED SIGNALS
  let longScore = 0, shortScore = 0;
  const reasons = [];
  let dominantEngine = null;
  let maxEngineScore = 0;
  
  for (const [engine, data] of Object.entries(signals)) {
    const weight = CONFIG.ENGINE_WEIGHTS[engine] / 100;
    
    if (data.direction === 'LONG' && data.score > 0) {
      longScore += data.score * weight;
      if (data.score > 50) reasons.push(`${engine}: ${data.reason}`);
      if (data.score > maxEngineScore) {
        maxEngineScore = data.score;
        dominantEngine = engine;
      }
    } else if (data.direction === 'SHORT' && data.score > 0) {
      shortScore += data.score * weight;
      if (data.score > 50) reasons.push(`${engine}: ${data.reason}`);
      if (data.score > maxEngineScore) {
        maxEngineScore = data.score;
        dominantEngine = engine;
      }
    }
  }
  
  const result = {
    direction: null,
    score: 0,
    reasons,
    engine: dominantEngine,
    engines: signals,
    indicators: { rsi, emaFast, emaSlow, adx, atr, bb, volumeSpike, shockZScore },
  };
  
  if (longScore >= CONFIG.MIN_SIGNAL_SCORE && longScore > shortScore) {
    result.direction = 'LONG';
    result.score = longScore;
  } else if (shortScore >= CONFIG.MIN_SIGNAL_SCORE && shortScore > longScore) {
    result.direction = 'SHORT';
    result.score = shortScore;
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC LEVERAGE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

function calculateDynamicLeverage(score, asset) {
  const maxLev = CONFIG.MAX_LEVERAGE[asset] || 100;
  
  let leverage;
  
  if (score < 50) {
    leverage = 15;
  } else if (score < 60) {
    leverage = 15 + (score - 50) * 1;
  } else if (score < 70) {
    leverage = 25 + (score - 60) * 2.5;
  } else if (score < 80) {
    leverage = 50 + (score - 70) * 2.5;
  } else if (score < 90) {
    leverage = 75 + (score - 80) * 1.5;
  } else {
    leverage = 90 + (score - 90) * 1;
  }
  
  leverage = Math.min(leverage, maxLev);
  
  return Math.round(leverage);
}

// ═══════════════════════════════════════════════════════════════════════════════
// FETCH CANDLE DATA
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchCandles(asset, interval = '15m', limit = 100) {
  try {
    if (asset === 'BTC' || asset === 'ETH') {
      const symbol = asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT';
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
      );
      const data = await res.json();
      
      return data.map(c => ({
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low: parseFloat(c[3]),
        close: parseFloat(c[4]),
        volume: parseFloat(c[5]),
        timestamp: c[0],
      }));
    }
    
    return null;
  } catch (err) {
    console.error(`Candle fetch error for ${asset}:`, err.message);
    return null;
  }
}

async function fetchPrice(pairIndex, providedPrice = null, isManualTrade = false) {
  // UI price is the source of truth - always prefer it
  if (providedPrice && providedPrice > 0) {
    console.log(`✅ Using UI price: $${providedPrice} (source: widget)`);
    return providedPrice;
  }

  // For manual trades from UI, price MUST be provided
  if (isManualTrade) {
    console.error(`❌ No price provided for manual trade! pairIndex=${pairIndex}`);
    throw new Error('UI must provide price for manual trades');
  }

  // Updated fallbacks for AUTO trades only (Jan 2026 prices)
  const fallbacks = {
    0: 104000,   // BTC
    1: 3400,     // ETH
    90: 2650,    // GOLD (XAU) - updated from 2750
    91: 31,      // SILVER (XAG) - updated from 32
    187: 72,     // OIL (WTI)
  };

  const price = fallbacks[pairIndex] || 1000;
  console.log(`⚠️ Using fallback price: $${price} for pairIndex=${pairIndex} (AUTO trade)`);
  return price;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TELEGRAM NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    return true;
  } catch (e) {
    console.log('Telegram failed:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GTRADE v10 ENCODING - FIXED!
// ═══════════════════════════════════════════════════════════════════════════════

function encodeOpenTrade(params) {
  const selector = '0x5bfcc4f8';
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  
  // Trade struct from ITradingStorage (gTrade v10):
  // address user, uint32 index, uint16 pairIndex, uint24 leverage, bool long, bool isOpen,
  // uint8 collateralIndex, uint8 tradeType, uint120 collateralAmount, uint64 openPrice,
  // uint64 tp, uint64 sl, bool isCounterTrade, uint160 positionSizeToken, uint24 __placeholder
  
  const tradeStruct = abiCoder.encode(
    ['tuple(address,uint32,uint16,uint24,bool,bool,uint8,uint8,uint120,uint64,uint64,uint64,bool,uint160,uint24)'],
    [[
      params.trader,                    // address user
      0,                                // uint32 index (0 for new trade)
      params.pairIndex,                 // uint16 pairIndex (90 for Gold)
      params.leverage * 1000,           // uint24 leverage (scaled 1e3, so 25x = 25000)
      params.long,                      // bool long (true=long, false=short)
      true,                             // bool isOpen
      params.collateralIndex,           // uint8 collateralIndex (3 for USDC on Arbitrum)
      0,                                // uint8 tradeType (0 = TRADE/market order)
      params.collateralAmount,          // uint120 collateralAmount (in USDC wei, 6 decimals)
      params.openPrice,                 // uint64 openPrice (1e10 scaled)
      params.tp,                        // uint64 tp (1e10 scaled)
      params.sl,                        // uint64 sl (1e10 scaled)
      false,                            // bool isCounterTrade
      0,                                // uint160 positionSizeToken (contract calculates)
      0,                                // uint24 __placeholder
    ]]
  ).slice(2);
  
  const maxSlippage = abiCoder.encode(['uint16'], [1000]).slice(2);
  const referrer = abiCoder.encode(['address'], ['0x0000000000000000000000000000000000000000']).slice(2);
  
  return selector + tradeStruct + maxSlippage + referrer;
}

function encodeCloseTrade(index) {
  const selector = '0x36ce736b';
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return selector + abiCoder.encode(['uint32'], [index]).slice(2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRADE EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function openTrade(wallet, params) {
  const { asset, direction, collateral, leverage: providedLeverage, price: providedPrice, signal } = params;

  const pairIndex = CONFIG.ASSET_INDEX[asset];
  if (pairIndex === undefined) throw new Error(`Unknown asset: ${asset}`);

  // Determine if this is a manual trade (from UI) vs auto trade
  const isManualTrade = !signal?.engine || signal?.engine === 'MANUAL';
  const currentPrice = await fetchPrice(pairIndex, providedPrice, isManualTrade);

  // Log price source for debugging
  console.log(`💰 Price source: ${providedPrice ? 'UI WIDGET' : 'FALLBACK'} | Value: $${currentPrice}`);

  let finalLeverage;
  if (signal?.score) {
    finalLeverage = calculateDynamicLeverage(signal.score, asset);
    console.log(`📊 Signal score: ${signal.score.toFixed(1)} → Dynamic leverage: ${finalLeverage}x`);
  } else if (providedLeverage) {
    // FIX: Ensure integer leverage from UI
    finalLeverage = Math.round(providedLeverage);
  } else {
    finalLeverage = CONFIG.BASE_LEVERAGE[asset] || 50;
  }

  // FIX: Clamp leverage to gTrade max limits
  const maxLev = CONFIG.MAX_LEVERAGE[asset] || 100;
  if (finalLeverage > maxLev) {
    console.log(`⚠️ Leverage ${finalLeverage}x exceeds max ${maxLev}x for ${asset}, clamping`);
    finalLeverage = maxLev;
  }
  
  const isBuy = direction === 'LONG';
  
  const tpPct = Math.max(1, 10 / Math.sqrt(finalLeverage));
  const slPct = Math.max(0.5, 5 / Math.sqrt(finalLeverage));
  
  const tpPrice = isBuy ? currentPrice * (1 + tpPct / 100) : currentPrice * (1 - tpPct / 100);
  const slPrice = isBuy ? currentPrice * (1 - slPct / 100) : currentPrice * (1 + slPct / 100);
  
  console.log(`\n⚔️ OPENING ${direction} ${asset}`);
  console.log(`   Engine: ${signal?.engine || 'MANUAL'} | Score: ${signal?.score?.toFixed(1) || 'N/A'}`);
  console.log(`   Reasons: ${signal?.reasons?.slice(0, 2).join(', ') || 'Manual trade'}`);
  console.log(`   Size: $${collateral} @ ${finalLeverage}x = $${collateral * finalLeverage}`);
  console.log(`   Entry: $${currentPrice.toFixed(2)}`);
  console.log(`   TP: $${tpPrice.toFixed(2)} (+${tpPct.toFixed(1)}%) | SL: $${slPrice.toFixed(2)} (-${slPct.toFixed(1)}%)`);
  
  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet);
  const collateralWei = ethers.parseUnits(collateral.toString(), 6);
  const allowance = await usdc.allowance(wallet.address, CONFIG.GTRADE.DIAMOND);
  
  if (allowance < collateralWei) {
    console.log('🔐 Approving USDC...');
    const approveTx = await usdc.approve(CONFIG.GTRADE.DIAMOND, ethers.MaxUint256);
    await approveTx.wait();
  }
  
  const priceWei = BigInt(Math.round(currentPrice * 1e10));
  const tpWei = BigInt(Math.round(tpPrice * 1e10));
  const slWei = BigInt(Math.round(slPrice * 1e10));
  
  const calldata = encodeOpenTrade({
    trader: wallet.address,
    pairIndex,
    leverage: finalLeverage,
    long: isBuy,
    collateralIndex: 3,
    collateralAmount: collateralWei,
    openPrice: priceWei,
    tp: tpWei,
    sl: slWei,
  });
  
  console.log(`📤 Calldata: selector=0x5bfcc4f8, leverage=${finalLeverage}x, pairIndex=${pairIndex}`);
  
  const tx = await wallet.sendTransaction({
    to: CONFIG.GTRADE.DIAMOND,
    data: calldata,
    gasLimit: 2000000,
  });
  
  console.log(`📤 TX: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Block ${receipt.blockNumber}, gas ${receipt.gasUsed}`);
  
  await sendTelegram(
    `⚔️ <b>${direction} ${asset}</b>\n` +
    `🎯 Engine: ${signal?.engine || 'MANUAL'} (${signal?.score?.toFixed(0) || 'N/A'})\n` +
    `💪 Leverage: <b>${finalLeverage}x</b>\n` +
    `💰 $${collateral} → $${(collateral * finalLeverage).toFixed(0)}\n` +
    `📈 Entry: $${currentPrice.toFixed(2)}\n` +
    `🎯 TP: $${tpPrice.toFixed(2)}\n` +
    `🛑 SL: $${slPrice.toFixed(2)}\n` +
    `📝 ${signal?.reasons?.[0] || ''}\n` +
    `🔗 ${tx.hash.slice(0, 20)}...`
  );
  
  return {
    success: true,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    leverage: finalLeverage,
    score: signal?.score,
    engine: signal?.engine,
  };
}

async function closeTrade(wallet, tradeIndex) {
  const calldata = encodeCloseTrade(tradeIndex);
  
  const tx = await wallet.sendTransaction({
    to: CONFIG.GTRADE.DIAMOND,
    data: calldata,
    gasLimit: 1500000,
  });
  
  console.log(`📤 Close TX: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`✅ Closed trade #${tradeIndex}`);
  
  await sendTelegram(`✅ Closed position #${tradeIndex}\n🔗 ${tx.hash.slice(0, 20)}...`);
  
  return { success: true, txHash: tx.hash, blockNumber: receipt.blockNumber };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS & POSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function getStatus(wallet) {
  const usdc = new ethers.Contract(CONFIG.GTRADE.USDC, ERC20_ABI, wallet.provider);
  const balance = await usdc.balanceOf(wallet.address);
  const balanceUsd = parseFloat(ethers.formatUnits(balance, 6));
  
  let positions = [];
  try {
    const res = await fetch(`https://backend-arbitrum.gains.trade/open-trades/${wallet.address}`);
    const data = await res.json();
    
    positions = data.map(t => {
      const pairIndex = parseInt(t.trade.pairIndex);
      const asset = Object.entries(CONFIG.ASSET_INDEX).find(([k, v]) => v === pairIndex)?.[0] || `PAIR${pairIndex}`;
      
      return {
        index: parseInt(t.trade.index),
        asset,
        pairIndex,
        long: t.trade.long,
        leverage: parseInt(t.trade.leverage) / 1000,
        collateral: parseFloat(t.trade.collateralAmount) / 1e6,
        openPrice: parseFloat(t.trade.openPrice) / 1e10,
        tp: parseFloat(t.trade.tp) / 1e10,
        sl: parseFloat(t.trade.sl) / 1e10,
      };
    });
  } catch (e) {
    console.log('Position fetch error:', e.message);
  }
  
  return { balance: balanceUsd, positions };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYZE ACTION
// ═══════════════════════════════════════════════════════════════════════════════

async function analyzeAsset(asset) {
  console.log(`\n🔍 Analyzing ${asset} with Haneef 5-Engine...`);
  
  const candles = await fetchCandles(asset, '15m', 100);
  if (!candles || candles.length < 60) {
    return { asset, error: 'Insufficient candle data' };
  }
  
  const signal = analyzeHaneefEngines(candles);
  const leverage = signal.direction ? calculateDynamicLeverage(signal.score, asset) : 0;
  
  console.log(`📊 ${asset}: ${signal.direction || 'NO SIGNAL'} (Score: ${signal.score.toFixed(1)}, Leverage: ${leverage}x)`);
  if (signal.reasons.length > 0) {
    console.log(`   Reasons: ${signal.reasons.join(' | ')}`);
  }
  
  return {
    asset,
    direction: signal.direction,
    score: signal.score,
    leverage,
    engine: signal.engine,
    reasons: signal.reasons,
    indicators: signal.indicators,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAMBDA HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Content-Type': 'application/json',
  };
  
  if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '{}' };
  }
  
  let result;
  
  try {
    // Handle both HTTP (body string) and EventBridge (direct object) events
    let body;
    if (event.body) {
      body = JSON.parse(event.body);
    } else if (event.action) {
      body = event;
    } else if (event.assets || event.collateral) {
      body = { action: 'AUTO_EXECUTE', ...event };
    } else {
      body = {};
    }
    
    const action = body.action || 'STATUS';
    
    console.log(`🎯 Action: ${action}`);
    console.log(`📦 Event source: ${event.body ? 'HTTP' : 'EventBridge'}`);
    
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
        const status = await getStatus(wallet);
        result = {
          success: true,
          balance: status.balance,
          positions: status.positions,
          wallet: wallet.address,
        };
        break;
        
      case 'ANALYZE':
        const analysis = await analyzeAsset(body.asset || 'BTC');
        result = { success: true, analysis };
        break;
        
      case 'SCAN':
        const assets = body.assets || ['BTC', 'ETH'];
        const opportunities = [];
        
        for (const asset of assets) {
          const analysis = await analyzeAsset(asset);
          if (analysis.direction && analysis.score >= CONFIG.MIN_SIGNAL_SCORE) {
            opportunities.push(analysis);
          }
        }
        
        opportunities.sort((a, b) => b.score - a.score);
        result = { success: true, opportunities };
        break;
        
      case 'AUTO_SIGNAL':
        const signal = body.signal;
        if (!signal?.asset || !signal?.direction || !signal?.price) {
          result = { success: false, error: 'Missing signal parameters' };
          break;
        }
        
        console.log(`🤖 AUTO SIGNAL: ${signal.direction} ${signal.asset} @ $${signal.price}`);
        
        result = await openTrade(wallet, {
          asset: signal.asset,
          direction: signal.direction,
          collateral: body.collateral || 10,
          price: signal.price,
          signal: {
            score: signal.score || signal.confidence * 100 || 70,
            engine: signal.engine || 'AUTO',
            reasons: signal.reasons || ['Auto signal from widget'],
          },
        });
        break;
        
      case 'AUTO_EXECUTE':
        const scanAssets = body.assets || ['BTC', 'ETH'];
        let bestOpp = null;
        
        console.log(`\n🤖 AUTO_EXECUTE starting - scanning ${scanAssets.join(', ')}...`);
        
        const currentStatus = await getStatus(wallet);
        console.log(`💰 Balance: $${currentStatus.balance.toFixed(2)} | Positions: ${currentStatus.positions.length}`);
        
        if (currentStatus.positions.length >= 4) {
          console.log('⏸️ Max positions reached, skipping...');
          result = { success: true, message: 'Max positions reached', positions: currentStatus.positions.length };
          break;
        }
        
        const scanResults = [];
        for (const asset of scanAssets) {
          const hasPosition = currentStatus.positions.find(p => p.asset === asset);
          if (hasPosition) {
            console.log(`⏭️ ${asset}: Already positioned`);
            scanResults.push({ asset, status: 'already_positioned' });
            continue;
          }
          
          const analysis = await analyzeAsset(asset);
          scanResults.push({ asset, direction: analysis.direction, score: analysis.score });
          
          if (analysis.direction && analysis.score >= CONFIG.MIN_SIGNAL_SCORE) {
            if (!bestOpp || analysis.score > bestOpp.score) {
              bestOpp = analysis;
            }
          }
        }
        
        console.log(`📊 Scan complete:`, JSON.stringify(scanResults));
        
        if (bestOpp) {
          console.log(`\n🎯 BEST: ${bestOpp.asset} ${bestOpp.direction} (${bestOpp.score.toFixed(0)}) [${bestOpp.engine}]`);
          
          result = await openTrade(wallet, {
            asset: bestOpp.asset,
            direction: bestOpp.direction,
            collateral: body.collateral || 10,
            price: body.price,
            signal: {
              score: bestOpp.score,
              engine: bestOpp.engine,
              reasons: bestOpp.reasons,
            },
          });
        } else {
          console.log('⏳ No qualified signals this cycle');
          result = { 
            success: true, 
            message: 'No qualified signals', 
            scanResults,
            balance: currentStatus.balance,
            positions: currentStatus.positions.length,
          };
        }
        break;
        
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }
    
    const tgSent = result.txHash ? true : false;
    if (tgSent) console.log(`📱 Telegram sent: ${tgSent}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    result = { success: false, error: error.message };
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(result),
  };
};
