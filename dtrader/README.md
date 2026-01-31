# ⚜️ DTRADER MANDALORIAN

**PulseChain's Premier Sniper Bot** - Powered by DTGC.io

![DTGC Logo](../public/dtgc-coin.png)

## 🎯 Features

- **Token Sniping** - Snipe new launches instantly
- **pump.tires Integration** - Track bonds approaching graduation
- **Limit Orders** - Set buy/sell at target prices
- **Multi-Wallet Support** - Up to 6 wallets
- **Portfolio Scanner** - View all holdings with USD values
- **Token Gate** - $50 DTGC for PRO features

## 💰 Fee Structure

| Fee | Amount | Destination |
|-----|--------|-------------|
| Buy & Burn | 0.5% | DTGC → Burn Address 🔥 |
| Dev Fee | 0.5% | Dev Wallet (PLS) |
| **Total** | **1%** | |

## 🌐 Web Interface

Full trading suite available at: **[dtgc.io/pulsexgold](https://dtgc.io/pulsexgold)**

The Telegram bot and web interface are fully congruent - same features, same fees!

## 🚀 Quick Start

### 1. Create Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Copy your bot token

### 2. Configure

```bash
cd dtrader
cp .env.example .env
# Edit .env with your bot token
```

### 3. Install & Run

```bash
npm install
npm start
```

## 📱 Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Main menu |
| `/pulsexgold` | Web interface link |
| `/dtgc` | DTGC token info |
| `/fees` | Fee structure |
| `/bonds` | pump.tires tracker |
| `/help` | Help message |

## 🔐 DTGC Token Gate

Hold **$50+ DTGC** to unlock PRO features:
- Advanced sniping
- Priority execution
- Custom alerts

**DTGC Contract:** `0xD0676B28a457371D58d47E5247b439114e40Eb0F`

## 🖥️ Deployment

### Railway / Heroku

1. Push to GitHub
2. Connect to Railway/Heroku
3. Set `BOT_TOKEN` environment variable
4. Deploy!

### VPS

```bash
# Install PM2
npm install -g pm2

# Start bot
pm2 start src/index.js --name dtrader

# Auto-restart on reboot
pm2 startup
pm2 save
```

## 📊 Links

- **Website:** [dtgc.io](https://dtgc.io)
- **PulseX Gold:** [dtgc.io/pulsexgold](https://dtgc.io/pulsexgold)
- **DTGC Token:** [DexScreener](https://dexscreener.com/pulsechain/0xd0676b28a457371d58d47e5247b439114e40eb0f)
- **pump.tires:** [pump.tires](https://pump.tires)

---

⚜️ **This is the way.** ⚜️
