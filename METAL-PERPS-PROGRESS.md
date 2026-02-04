# Metal Perps Auto-Trader - Progress Summary
**Date:** February 3, 2026
**Status:** ✅ Q7 D-RAM v5.2.6 INTEGRATED

---

## 🎯 Current Setup

### Lambda Function
- **Name:** `metal-perps-auto-trader`
- **Version:** v4.0-Q7 (Q7 D-RAM v5.2.6 Calibrated)
- **Region:** us-east-2
- **URL:** `https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/`

### EventBridge Schedule
- **Rule:** `metal-perps-auto-trader-schedule`
- **Frequency:** Every 5 minutes
- **Payload:** `{"action":"AUTO_EXECUTE","assets":["BTC","ETH","GOLD"],"collateral":10}`

### Wallet
- **Balance:** ~$165 USDC
- **Network:** Arbitrum One
- **Platform:** gTrade (gains.trade)

---

## 🧠 Q7 D-RAM v5.2.6 Algorithm

### Per-Asset RSI Calibration (15M Timeframe)
| Asset | Oversold | Overbought | Notes |
|-------|----------|------------|-------|
| BTC | 34 | 66 | Tighter bands for high liquidity |
| ETH | 32 | 68 | Slightly wider than BTC |
| GOLD | 30 | 70 | Standard commodity bounds |
| SILVER | 30 | 70 | Standard commodity bounds |

### Engine Weights (Q7 Priority: SWP > BRK > MR > TRND)
| Engine | Weight | Description |
|--------|--------|-------------|
| SWP | 30% | Liquidity sweep (PDH/PDL) - HIGHEST priority |
| BRK | 25% | Bollinger Band breakout with ADX>18 |
| MR | 25% | Mean Reversion (RSI + Pin Bar + Divergence) |
| TRND | 15% | EMA crossover - THROTTLED (max 3/day) |
| MTUM | 5% | Momentum confirmation only |

### 5-Factor Confluence Scoring
| Factor | Weight | What It Measures |
|--------|--------|------------------|
| Trend | 30% | EMA 12/26 alignment |
| ADX | 20% | Trend strength |
| RSI | 20% | Position within Q7 bounds |
| Volume | 15% | Volume vs 20-period SMA |
| MTF | 15% | Multi-timeframe alignment |

### Q7 Relaxed Conditions
- **SWP:** Wick 40% OR Volume 1.5x (not AND)
- **BRK:** ADX minimum lowered to 18
- **MR:** ADX max raised to 27, includes pin bar + divergence detection
- **TRND:** Throttled to max 3 entries per day

### TP/SL Ratios (1.5:1 R:R Minimum)
| Asset Type | Take Profit | Stop Loss |
|------------|-------------|-----------|
| Crypto (BTC/ETH) | 2.25% | 1.5% |
| Commodity (GOLD) | 3.75% | 2.5% |

---

## ⚙️ Configuration Summary

| Setting | Value | Description |
|---------|-------|-------------|
| MIN_SIGNAL_SCORE | 20 | Q7 calibrated threshold |
| MIN_CONFLUENCE | 50 | Minimum confluence % |
| MAX_POSITIONS | 4 | Max concurrent trades |
| TRND_MAX_PER_DAY | 3 | Trend throttle limit |

### Leverage Scaling
- **BTC/ETH:** 25x base, up to 100x max
- **GOLD:** 10x base, up to 20x max

---

## 📡 Data Sources

| Asset | Candles | Price |
|-------|---------|-------|
| BTC | Coinbase (15m) | CoinGecko |
| ETH | Coinbase (15m) | CoinGecko |
| GOLD | CryptoCompare PAXG (1hr) | Chainlink RPC |

**Why Coinbase?** Binance blocks AWS US IPs. Coinbase works perfectly.

---

## 📱 Telegram Notifications

- **Bot:** Connected to your group
- **Alerts:**
  - 🔍 Every scan (5 min) with Q7 scores + confluence
  - ⚡ Trade opened (entry, TP, SL, engine that triggered)
  - 💰 Trade closed (P&L)
  - ❌ Errors

---

## 🧪 Test Commands

```bash
# Check status
curl -s "https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/?action=STATUS" | jq .

# Analyze single asset (Q7 analysis)
curl -s -X POST "https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{"action":"ANALYZE","asset":"BTC"}' | jq .

# Manual scan (no trade)
curl -s -X POST "https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{"action":"SCAN","assets":["BTC","ETH","GOLD"]}' | jq .

# Trigger auto-execute
curl -s -X POST "https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{"action":"AUTO_EXECUTE","assets":["BTC","ETH","GOLD"],"collateral":10}' | jq .

# Get prices
curl -s -X POST "https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{"action":"GET_PRICES"}' | jq .
```

---

## 📁 Files Created

| File | Description |
|------|-------------|
| `metal-perps-lambda-v4.0-Q7.js` | **NEW** Q7 D-RAM v5.2.6 calibrated Lambda |
| `metal-perps-lambda-v3.96.js` | Previous stable version (pre-Q7) |
| `src/components/MetalPerpsWidget.jsx` | React widget v5.0-Q7 |

---

## 🔧 Issues Solved

1. **Binance API blocked** → Switched to Coinbase
2. **Native fetch() not available** → Used https module
3. **Chainlink address checksums** → Lowercase addresses
4. **Signal threshold too strict** → Q7 calibrated to 20
5. **No scan visibility** → Added Telegram notifications
6. **RSI too generic** → Q7 per-asset calibration
7. **TRND dominance** → Throttled to 3/day max
8. **SWP too strict** → Relaxed to OR conditions

---

## 📈 Q7 Trade Triggers

The Q7 system uses 5-factor confluence with calibrated thresholds:

- **SWP Signal:** Price sweeps PDH/PDL with 40% wick OR 1.5x volume
- **BRK Signal:** Price breaks Bollinger Band with ADX > 18 and 1.5x volume
- **MR Signal:** RSI at Q7 bounds + Pin bar OR RSI divergence + ADX < 27
- **TRND Signal:** EMA 12/26 crossover with ADX > 22 (max 3/day)
- **MTUM Signal:** Momentum confirmation (+0.5% 1hr)

Trades execute when: `score >= 20 AND confluence >= 50%`

---

## 🚀 Deployment Instructions

### To deploy v4.0-Q7:
1. Go to AWS Lambda console
2. Open `metal-perps-auto-trader` function
3. Replace code with contents of `metal-perps-lambda-v4.0-Q7.js`
4. Click **Deploy**
5. Test with: `{"action":"ANALYZE","asset":"BTC"}`

---

## 🚀 Next Steps (Optional)

- [x] Integrate Q7 D-RAM v5.2.6 calibration
- [x] Update widget with Q7 signal display
- [ ] Add more pairs (DOGE, SOL, etc.)
- [ ] Build PulseChain version when perps DEX available
- [ ] Add trailing stop loss
- [ ] Dashboard for trade history

---

*Last updated: February 3, 2026*
