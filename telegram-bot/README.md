# ⚜️ DTRADER Mandalorian - Telegram Bot

PulseChain Sniper & Trading Bot with integrated fee system.

## Features

- 🎯 **Token Sniping** - Instant buy with slippage protection
- 👛 **Multi-Wallet System** - 6 auto-generated sniper wallets
- 🔐 **Token Gate** - $50 DTGC for PRO features
- 💰 **1% Fee** - 0.5% buy & burn DTGC + 0.5% dev wallet
- 🌐 **PulseX Gold Integration** - Links back to web UI

## Quick Start

1. **Get Bot Token** from [@BotFather](https://t.me/BotFather)

2. **Configure**
   ```bash
   cp .env.example .env
   # Edit .env with your bot token
   ```

3. **Install & Run**
   ```bash
   npm install
   npm run build
   npm start
   ```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Show main menu |
| `/snipe <token>` | Set up snipe for token |
| `/buy <token> <amount>` | Quick buy |
| `/balance` | View wallet balances |
| `/generate` | Create 6 sniper wallets |
| `/export` | Export private keys (DM only) |
| `/pulsexgold` | Open web interface |

## Fee Structure

All trades include 1% fee:
- **0.5%** - Buys DTGC and burns it
- **0.5%** - Sent to dev wallet in PLS

## Deployment

### Railway / Render
1. Connect GitHub repo
2. Set `TELEGRAM_BOT_TOKEN` env var
3. Deploy

### VPS
```bash
npm install
npm run build
pm2 start dist/index.js --name dtrader-bot
```

## Links

- **Website:** https://dtgc.io
- **PulseX Gold:** https://dtgc.io/pulsexgold
- **Bot:** https://t.me/dtrader_bot

---

⚜️ **DTRADER Mandalorian Edition** - Powered by DTGC.io
