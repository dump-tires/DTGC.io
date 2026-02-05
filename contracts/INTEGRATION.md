# Metals Flywheel Integration Guide

## 🔗 ZapperX Bridge Setup

### Your Addresses
| Component | Address |
|-----------|---------|
| **ZapperX Bridge** | `0x978c5786cdb46b1519a9c1c4814e06d5956f6c64` |
| **Growth Engine (PulseChain)** | `0x1449a7d9973e6215534d785e3e306261156eb610` |

---

## 📋 Setup Options

### Option 1: Direct ZapperX Integration (Recommended)

If ZapperX has a public bridge function, the MetalsFlywheel can call it directly:

```solidity
// In MetalsFlywheel.bridgeToPulseChain()
IZapperXBridge(zapperXBridge).bridgeAndSwap(
    address(usdc),      // USDC on Arbitrum
    balance,            // Amount to bridge
    growthEngineWallet, // Your PulseChain wallet
    369                 // PulseChain chain ID
);
```

**Steps:**
1. Deploy MetalsFlywheel with ZapperX address
2. Approve USDC spending by MetalsFlywheel
3. Trading bot calls `processWinningTrade()` after wins
4. Owner periodically calls `bridgeToPulseChain()` to sweep accumulated USDC

---

### Option 2: Manual Bridge with EOA

If ZapperX requires EOA interaction (like most bridges):

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ MetalsFlywheel  │────▶│  Owner EOA      │────▶│  ZapperX UI     │
│ (Accumulates)   │     │  (Withdraws)    │     │  (Bridges)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Steps:**
1. Deploy MetalsFlywheel (set owner = your EOA)
2. Trading bot sends 5% to MetalsFlywheel
3. Periodically call `emergencyWithdraw()` to your EOA
4. Manually use ZapperX UI to bridge USDC → PLS
5. PLS arrives at growth engine wallet

---

### Option 3: Keeper Automation (Advanced)

Use Chainlink Keepers or Gelato to automate bridging:

```javascript
// Gelato task
const task = {
  execAddress: flywheelAddress,
  execSelector: "bridgeToPulseChain()",
  interval: 86400, // Daily
  condition: "balance > 100 USDC"
};
```

---

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Arbitrum RPC
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Deployment wallet private key
PRIVATE_KEY=your_private_key_here

# Arbiscan API for verification
ARBISCAN_API_KEY=your_api_key

# Contract addresses (after deployment)
FLYWHEEL_ADDRESS=
TRADING_BOT_ADDRESS=
```

### Trading Bot Integration

Your Q7 bot should call after each winning trade:

```javascript
// After profitable trade closes
async function onProfitableTrade(trader, profitUSDC) {
  const flywheel = new ethers.Contract(FLYWHEEL_ADDRESS, ABI, signer);

  // Calculate 5%
  const flywheelAmount = profitUSDC.mul(5).div(100);

  // Approve USDC
  await usdc.approve(FLYWHEEL_ADDRESS, flywheelAmount);

  // Process the win
  await flywheel.processWinningTrade(trader, profitUSDC);

  console.log(`✅ Flywheel captured: $${ethers.utils.formatUnits(flywheelAmount, 6)}`);
}
```

---

## 📊 Monitoring Dashboard

Track flywheel stats:

```javascript
const stats = await flywheel.getFlywheelStats();
console.log({
  totalProfit: formatUnits(stats._totalProfitProcessed, 6),
  totalAllocated: formatUnits(stats._totalFlywheelAllocated, 6),
  tradesProcessed: stats._totalTradesProcessed.toString(),
  pendingBridge: formatUnits(stats._pendingBridge, 6)
});
```

---

## 🔐 Security Checklist

- [ ] Verify ZapperX bridge address on Arbiscan
- [ ] Test with small amounts first ($10-50)
- [ ] Set up monitoring for bridge transactions
- [ ] Keep trading bot private key secure
- [ ] Use hardware wallet for owner functions
- [ ] Set up alerts for large accumulations

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd contracts
npm install

# 2. Configure .env
cp .env.example .env
# Edit with your values

# 3. Deploy to testnet first
npx hardhat run scripts/deploy-flywheel.js --network arbitrumSepolia

# 4. Test the flow
npx hardhat test

# 5. Deploy to mainnet
npx hardhat run scripts/deploy-flywheel.js --network arbitrum

# 6. Verify on Arbiscan
npx hardhat verify --network arbitrum DEPLOYED_ADDRESS "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" "0x978c5786cdb46b1519a9c1c4814e06d5956f6c64" "0x1449a7d9973e6215534d785e3e306261156eb610" "YOUR_BOT_ADDRESS"
```

---

## 💡 Recommended Approach

For your setup, I recommend **Option 2 (Manual Bridge)** initially:

1. **Why**: ZapperX likely requires wallet signature for cross-chain swaps
2. **Workflow**:
   - Flywheel accumulates 5% of wins in USDC
   - Weekly/monthly, you withdraw to your EOA
   - Use ZapperX dApp to bridge USDC → PLS
   - PLS lands in `0x1449a7d9973e6215534d785e3e306261156eb610`

3. **Upgrade Path**: Once volume justifies it, work with ZapperX team for programmatic API access

---

*Questions? Telegram: t.me/urmomPulse*
