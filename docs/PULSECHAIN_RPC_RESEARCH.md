# PulseChain RPC Research for V4 Staking Contracts

## Executive Summary

Your current setup uses **free public RPCs** which have inherent limitations for contract deployment and heavy operations. For reliable V4 contract execution, you have **three options**:

1. **Premium RPC Provider** (~$299-$1,230/month) - Easiest, fastest
2. **Run Your Own Node** (~$875-1,500/month cloud or one-time hardware) - Most control
3. **Hybrid Approach** - Public RPCs for reads, premium for writes

---

## Current DTGC.io RPC Configuration

**File:** `src/App.jsx` (lines 5445-5450)

```javascript
const RPC_ENDPOINTS = [
  null, // wallet provider first
  'https://rpc.pulsechain.com',      // Official - no SLA, no rate limit published
  'https://pulsechain-rpc.publicnode.com',  // PublicNode/Allnodes
  'https://rpc-pulsechain.g4mm4.io',        // G4mm4
];
```

**Current Issues with Public RPCs:**
- No guaranteed uptime SLA
- Rate limiting (undisclosed limits)
- No archive node access
- No debug/trace APIs (needed for complex deployments)
- Potential timeout on large contract deployments
- No dedicated support when things break

---

## Option 1: Premium RPC Providers

### Dwellir (Recommended for Your Use Case)

| Plan | Price | RPS | Monthly Responses | Features |
|------|-------|-----|-------------------|----------|
| **Starter** | $5 one-time | 20 sustained / 100 burst | 500K/day | Good for testing |
| **Growth** | $299/month | 500 sustained / 2,500 burst | 150M | Production ready |
| **Dedicated** | $1,230/month | Unlimited | Unlimited | Full isolation |

**Why Dwellir for V4 Contracts:**
- ✅ 1:1 credit system (no compute unit complexity)
- ✅ Full archive access from genesis
- ✅ Trace & Debug APIs included
- ✅ HTTP + WebSocket support
- ✅ Pay with crypto option
- ✅ 3-second block time optimized

**Setup:**
1. Create account at https://www.dwellir.com/networks/pulsechain
2. Get API endpoint (format: `https://pulsechain-rpc.dwellir.com/<API_KEY>`)
3. Add to your RPC_ENDPOINTS array as primary

### Moralis

| Plan | Price | Compute Units | RPS | Features |
|------|-------|---------------|-----|----------|
| **Free** | $0 | 40K CU/day | Limited | Testing only |
| **Pro** | $199/month | 100M CU | 50 | 5 dedicated nodes |

**Special Features:**
- `eth_getTokenBalances` - All token holdings in one call
- `eth_getTokenPrice` - Real-time pricing
- Added PulseChain support January 2025

**Setup:** https://moralis.com/chains/pulsechain/

### Performance Benchmarks (2025 Testing)

| Provider | Avg Latency | Failure Rate | Best For |
|----------|-------------|--------------|----------|
| PublicNode | 28-177ms | 0% | Americas, Europe |
| rpc.pulsechain.com | 28-177ms | 0% | Europe, Asia, Australia |
| Dwellir | 30-150ms | 0% | Global (dedicated) |
| G4mm4 | 50-200ms | <1% | Backup |

---

## Option 2: Run Your Own Node

### Hardware Requirements

**Minimum Specs:**
- CPU: 8 cores
- RAM: 32 GB
- Storage: 3 TB NVMe SSD (chain grows ~1-2 TB/year)
- Network: 100 Mbps up/down

**AWS Equivalent:**
- Instance: `m5a.2xlarge` (~$350/month)
- Storage: 3000 GiB gp3 (~$300/month)
- **Total:** ~$650/month

**Self-Hosted Hardware:**
- One-time: ~$2,000-3,000
- Electricity: ~$50/month
- Internet: Existing

### Software Stack

```
Execution Layer (EL): go-pulse (PulseChain's Geth fork)
Consensus Layer (CL): lighthouse-pulse
```

### Quick Setup (Docker)

```bash
# Clone official setup
git clone https://gitlab.com/pulsechaincom/pulsechain-mainnet.git
cd pulsechain-mainnet

# Generate JWT secret
openssl rand -hex 32 | tr -d "\n" > jwt.hex

# Run with Docker Compose
docker-compose up -d
```

### Port Requirements

| Port | Protocol | Purpose |
|------|----------|---------|
| 30303 | TCP/UDP | Geth P2P |
| 9000 | TCP/UDP | Lighthouse P2P |
| 8545 | TCP | HTTP RPC (local only!) |
| 8546 | TCP | WebSocket RPC (local only!) |

### Sync Time
- Full sync: 2-5 days
- Archive sync: 5-10 days

### Resources
- [Official PulseChain Node Guide](https://gitlab.com/pulsechaincom/pulsechain-mainnet)
- [Community Setup Guide](https://gitlab.com/Gamesys10/pulsechain-node-guide)
- [HexPulse Docs](https://www.hexpulse.info/docs/node-setup.html)

---

## Option 3: Hybrid Approach (Recommended for Cost-Efficiency)

**Strategy:** Use free RPCs for read operations, premium for writes/deployments

### Implementation

```javascript
// config/rpc.js
const RPC_CONFIG = {
  // For reading data (balance checks, stake fetching)
  read: [
    'https://rpc.pulsechain.com',
    'https://pulsechain-rpc.publicnode.com',
  ],

  // For writing data (staking, withdrawing, deployments)
  write: [
    'https://pulsechain-rpc.dwellir.com/YOUR_API_KEY', // Premium
    'https://rpc.pulsechain.com', // Fallback
  ],

  // For contract deployment (needs archive + trace)
  deploy: 'https://pulsechain-rpc.dwellir.com/YOUR_API_KEY',
};
```

### Cost Estimate
- Dwellir Starter ($5 one-time) for deployments
- Free public RPCs for 95% of operations
- Upgrade to Growth ($299/month) if rate limited

---

## Specific V4 Contract Deployment Considerations

### Why Deployments Fail on Public RPCs

1. **Timeout:** Large contracts exceed default 30s timeout
2. **Rate Limiting:** Multiple deployment calls hit limits
3. **No Trace API:** Constructor debugging impossible
4. **Gas Estimation:** Public nodes may return inaccurate estimates

### Deployment Checklist

```javascript
// hardhat.config.js for PulseChain deployment
module.exports = {
  networks: {
    pulsechain: {
      url: "https://pulsechain-rpc.dwellir.com/YOUR_KEY", // Premium RPC
      chainId: 369,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      gasPrice: 50000000000, // 50 gwei (adjust based on network)
      timeout: 120000, // 2 minutes
    },
  },
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};
```

### Contract Verification on PulseScan

⚠️ **Critical:** Use Windows line endings (CRLF) in .sol files for verification

```javascript
// hardhat.config.js
etherscan: {
  apiKey: {
    pulsechain: "YOUR_PULSESCAN_KEY"
  },
  customChains: [{
    network: "pulsechain",
    chainId: 369,
    urls: {
      apiURL: "https://api.scan.pulsechain.com/api",
      browserURL: "https://scan.pulsechain.com"
    }
  }]
}
```

---

## Recommendation for DTGC.io

### Immediate (Deploy V4)
1. Sign up for **Dwellir Starter** ($5 one-time)
2. Use premium endpoint for deployment only
3. Keep free RPCs for user-facing operations

### If V4 Works Well
1. Upgrade to **Dwellir Growth** ($299/month)
2. Add as primary in RPC_ENDPOINTS array
3. Keep free RPCs as fallback

### If High Volume/Critical
1. Consider **Dedicated Node** ($1,230/month) OR
2. Run your own node (more effort, similar cost)

---

## Updated RPC Configuration (Suggested)

```javascript
// src/App.jsx - Updated RPC fallback
const RPC_ENDPOINTS = [
  null, // wallet provider first
  process.env.REACT_APP_PREMIUM_RPC, // Dwellir or similar
  'https://rpc.pulsechain.com',
  'https://pulsechain-rpc.publicnode.com',
  'https://rpc-pulsechain.g4mm4.io',
];
```

```bash
# .env
REACT_APP_PREMIUM_RPC=https://pulsechain-rpc.dwellir.com/YOUR_API_KEY
```

---

## Quick Links

| Resource | URL |
|----------|-----|
| Dwellir PulseChain | https://www.dwellir.com/networks/pulsechain |
| Moralis PulseChain | https://moralis.com/chains/pulsechain/ |
| ChainList | https://chainlist.org/chain/369 |
| CompareNodes | https://www.comparenodes.com/protocols/pulsechain/ |
| PulseScan API | https://api.scan.pulsechain.com |
| Node Setup Guide | https://gitlab.com/pulsechaincom/pulsechain-mainnet |

---

*Research compiled: January 5, 2026*
