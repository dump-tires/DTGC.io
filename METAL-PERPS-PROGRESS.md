# Metal Perps Auto-Trader - Progress Summary
**Date:** January 30, 2026
**Status:** ✅ LIVE & RUNNING

---

## 🎯 Current Setup

### Lambda Function
- **Name:** `metal-perps-auto-trader`
- **Version:** v3.96
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

## ⚙️ Algorithm Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| MIN_SIGNAL_SCORE | 25 | Need 2+ engines agreeing |
| MAX_POSITIONS | 4 | Max concurrent trades |
| TP_PERCENT (crypto) | 3.0% | Take profit target |
| SL_PERCENT (crypto) | 2.0% | Stop loss |
| TP_PERCENT (commodity) | 5.0% | Take profit for GOLD |
| SL_PERCENT (commodity) | 4.0% | Stop loss for GOLD |

### 6-Engine Haneef System

| Engine | Weight | Triggers On |
|--------|--------|-------------|
| SWP | 25% | Liquidity sweep (PDH/PDL) |
| TRND | 20% | EMA 12/26 crossover or trend |
| BRK | 15% | Bollinger Band breakout |
| MR | 10% | RSI oversold/overbought (ADX<25) |
| SHK | 5% | Volatility shock (Z>3) |
| MTUM | 25% | Price momentum (+0.5% 1hr) |

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
  - 🔍 Every scan (5 min) with scores
  - ⚡ Trade opened (entry, TP, SL)
  - 💰 Trade closed (P&L)
  - ❌ Errors

---

## 🧪 Test Commands

```bash
# Check status
curl -s "https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/?action=STATUS" | jq .

# Analyze single asset
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
| `metal-perps-lambda-v3.96.js` | Current production Lambda code |
| `metal-perps-lambda-v3.91.js` | Previous stable version |
| `src/components/MetalPerpsWidget.jsx` | React widget for dashboard |

---

## 🔧 Issues Solved

1. **Binance API blocked** → Switched to Coinbase
2. **Native fetch() not available** → Used https module
3. **Chainlink address checksums** → Lowercase addresses
4. **Signal threshold too strict** → Lowered to 25
5. **No scan visibility** → Added Telegram notifications

---

## 📈 When Trades Will Trigger

The bot needs a combined score ≥25 from multiple engines agreeing:

- **Strong momentum:** +0.5% in 1hr + +1.0% in 4hr → MTUM fires
- **Trend change:** EMA 12 crosses EMA 26 → TRND fires at 80+
- **Breakout:** Price breaks Bollinger Band → BRK fires at 70+
- **Oversold bounce:** RSI < 30 in ranging market → MR fires

Current market is flat. When volatility picks up, trades will execute automatically.

---

## 🚀 Next Steps (Optional)

- [ ] Add more pairs (DOGE, SOL, etc.)
- [ ] Build PulseChain version when perps DEX available
- [ ] Add trailing stop loss
- [ ] Dashboard for trade history

---

*Last updated: January 30, 2026*
