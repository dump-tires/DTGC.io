# Metals Flywheel Smart Contracts

## 🎯 Overview

The **Metals 5% Win Flywheel** is an automated profit reallocation protocol that captures 5% of every winning trade from the Q7 Auto-Perp Engine and bridges it to PulseChain for PLS accumulation.

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ARBITRUM ONE                                │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  gTrade     │───▶│ MetalsFlywheel   │───▶│ ZapperX       │  │
│  │  (Wins)     │    │ (5% Capture)     │    │ Bridge        │  │
│  └─────────────┘    └──────────────────┘    └───────┬───────┘  │
│                              │                       │          │
│                              │ USDC                  │          │
└──────────────────────────────│───────────────────────│──────────┘
                               │                       │
                               ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PULSECHAIN                                 │
│                                          ┌───────────────────┐  │
│                                          │ Growth Engine     │  │
│                                          │ 0x1449a...eb610   │  │
│                                          │ (PLS Accumulation)│  │
│                                          └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📁 Contracts

| Contract | Description |
|----------|-------------|
| `MetalsFlywheel.sol` | Core flywheel logic - processes wins, calculates 5%, bridges |
| `interfaces/IZapperXBridge.sol` | ZapperX bridge interface |

## ⚙️ Configuration

| Parameter | Value | Description |
|-----------|-------|-------------|
| `FLYWHEEL_PERCENTAGE` | 500 (5%) | Percentage of profit captured |
| `MIN_PROFIT_THRESHOLD` | $1 USDC | Minimum profit to trigger flywheel |
| `growthEngineWallet` | `0x1449a7d9973e6215534d785e3e306261156eb610` | PulseChain destination |

## 🔐 Key Addresses

### Arbitrum One
- **USDC**: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- **gTrade**: Official gTrade contracts
- **ZapperX Bridge**: TBD

### PulseChain
- **Growth Engine Wallet**: `0x1449a7d9973e6215534d785e3e306261156eb610`

## 📦 Installation

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Arbitrum
npx hardhat run scripts/deploy-flywheel.js --network arbitrum
```

## 🔄 Flywheel Flow

1. **Trade Closes** - Q7 Bot closes a profitable position on gTrade
2. **Profit Calculated** - System calculates gross profit
3. **5% Captured** - MetalsFlywheel receives 5% of profit in USDC
4. **Bridge Initiated** - Owner triggers `bridgeToPulseChain()`
5. **Atomic Swap** - ZapperX converts USDC → PLS
6. **PLS Delivered** - Growth Engine wallet receives PLS

## 📊 Stats Tracking

The contract tracks:
- `totalProfitProcessed` - Total profit seen by flywheel
- `totalFlywheelAllocated` - Total USDC sent to PLS
- `totalWinningTrades` - Count of winning trades processed
- `userProfitContributed` - Per-user flywheel contributions

## 🛡️ Security Features

- **ReentrancyGuard** - Prevents reentrancy attacks
- **Pausable** - Emergency stop functionality
- **SafeERC20** - Safe token transfers
- **Access Control** - Only authorized bot can process trades
- **Emergency Withdraw** - Owner can recover tokens if needed

## 📜 License

MIT License - DTGC.io

## 🔗 Links

- **Website**: [dtgc.io/gold](https://dtgc.io/gold)
- **Whitepaper**: [Metals Arbitrum × PulseChain](https://dtgc.io/Metals_Arbitrum_PulseChain_Whitepaper.pdf)
- **Telegram**: [t.me/urmomPulse](https://t.me/urmomPulse)

---

*Built by the Q7 Quant Team - New York • London • Singapore*
