# ⚜️ DTRADER Mandalorian - Complete Integration Guide

## Overview

DTRADER is a complete PulseChain trading ecosystem with:
- **Telegram Bot** - Token sniping, limit orders, P&L tracking
- **PulseX Gold Web UI** - Swap, sniper, limit orders with Gold Mando theme
- **Token Gate** - $50 DTGC requirement for premium features

---

## 📁 File Structure

```
dtrader/
├── src/
│   ├── bot/
│   │   └── index.ts          # Main Telegram bot
│   ├── utils/
│   │   └── pnlCard.ts        # P&L card generation
│   ├── gate/
│   │   └── tokenGate.ts      # Token gate verification
│   └── components/
│       └── PulseXGold.jsx    # React web component
│
├── data/                      # JSON storage for positions/orders
│
└── outputs/
    ├── pulsexgold/
    │   └── index.html        # Standalone web app for dtgc.io/pulsexgold
    └── dtrader-update/
        ├── bot-additions.ts  # Code snippets to add to bot
        └── src/components/
            └── PulseXGold.jsx # React component

```

---

## 🤖 Telegram Bot Features

### Commands
- `/start` - Initialize wallet & show main menu
- `/buy <token>` - Buy a token
- `/sell <token>` - Sell a token
- `/snipe <token>` - Set up snipe
- `/check <token>` - Safety check
- `/balance` - View balance
- `/pnl [token]` - Show P&L card
- `/share <token>` - Share P&L to group

### Token Gate
Users must hold $50+ worth of DTGC to access:
- 🎯 Instabond Sniper (pump.tires)
- ⚡ New Pair Sniper (PulseX)
- 📈 Limit Orders & DCA
- 🛡️ Anti-Rug Protection
- 👛 6-Wallet System
- 🐋 Copy Trading

### Fee Structure
- **1% total fee** on all trades
  - 0.5% Buy & Burn DTGC
  - 0.5% to Dev Wallet

---

## 🌐 Web UI (PulseX Gold)

### Deployment to dtgc.io/pulsexgold

1. Upload `/outputs/pulsexgold/index.html` to your web server
2. Ensure `/Favicon.png` (DTGC gold logo) is in the root
3. Point DNS to dtgc.io/pulsexgold

### Features
- ⚡ **Swap** - Any token to any token via PulseX V1/V2
- 🎯 **Sniper** - Instabond & New Pair sniping (PRO only)
- 📈 **Limit Orders** - Buy/Sell/Stop Loss/Take Profit (PRO only)
- 📊 **P&L Cards** - Shareable profit/loss tracking
- 🔐 **Token Gate** - Visual verification of DTGC holdings

### React Component Usage

```jsx
import PulseXGold from './components/PulseXGold';

// In your app
<PulseXGold
  provider={web3Provider}
  signer={signer}
  userAddress={address}
  onClose={() => setShowPanel(false)}
/>
```

---

## 🔐 Token Gate Integration

### How It Works
1. User connects wallet
2. System checks DTGC balance
3. Balance × DTGC price = USD value
4. If USD value ≥ $50, unlock premium features

### Configuration
```javascript
const CONFIG = {
  DTGC_ADDRESS: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
  DTGC_MIN_USD: 50,
};
```

### Buy Link
Users who don't have enough DTGC are directed to:
**https://dtgc.io/pulsexgold**

---

## 📊 P&L Card System

### Tracking Positions
Positions are automatically tracked after successful buys:

```typescript
positionStore.addPosition(userId, {
  tokenAddress: contractAddress,
  tokenName: symbol,
  buyPrice: price,
  amount: tokenAmount,
  timestamp: Date.now(),
});
```

### Generating Cards
```typescript
import { generatePnLMessage, calculatePnL } from './utils/pnlCard';

const pnl = calculatePnL({
  tokenName: 'URMOM',
  contractAddress: '0x...',
  buyPrice: 0.0001,
  currentPrice: 0.0002,
  amount: 1000000,
});

const message = generatePnLMessage(data);
// Returns formatted Telegram message
```

### P&L Card Design
- Gold Mandalorian theme
- Starlight animation
- Token name + last 4 of CA
- **Gold** for profits, **Red** for losses
- Powered by DTGC.io footer

---

## 🎨 Gold Mandalorian Theme

### Color Palette
```css
--gold-primary: #D4AF37;
--gold-secondary: #B8960C;
--gold-light: #FFD700;
--gold-dark: #8B7500;
--gold-glow: rgba(212, 175, 55, 0.4);
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--profit: #4CAF50;
--loss: #FF4444;
```

### Font
```css
font-family: 'Orbitron', sans-serif;
```

---

## 🚀 Quick Start

### 1. Set Up Telegram Bot
```bash
cd dtrader
cp .env.example .env
# Add your TELEGRAM_BOT_TOKEN
npm install
npm run build
npm start
```

### 2. Deploy Web UI
Upload `pulsexgold/index.html` to dtgc.io/pulsexgold

### 3. Configure Token Gate
Ensure DTGC contract address and minimum USD are correct in config

---

## 📋 Key Addresses

| Asset | Address |
|-------|---------|
| DTGC | `0xd0676b28a457371d58d47e5247b439114e40eb0f` |
| URMOM | `0xe43b3cee3554e120213b8b69caf690b6c04a7ec0` |
| WPLS | `0xa1077a294dde1b09bb078844df40758a5d0f9a27` |
| PulseX Router V1 | `0x165C3410fC91EF562C50559f7d2289fEbed552d9` |
| PulseX Router V2 | `0x636f6407B90661b73b1C0F7e24F4C79f624d0738` |
| Dev Wallet | `0xc1cd5a70815e2874d2db038f398f2d8939d8e87c` |

---

## 🔗 Links

- **Website:** https://dtgc.io
- **PulseX Gold:** https://dtgc.io/pulsexgold
- **Telegram Bot:** https://t.me/dtrader_bot
- **PulseChain Explorer:** https://scan.pulsechain.com

---

⚜️ **DTRADER Mandalorian Edition** - Powered by DTGC.io
