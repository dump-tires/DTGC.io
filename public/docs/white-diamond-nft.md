# 💎 White Diamond NFT Staking

## ⭐ The Future of Transferable Staking Positions

---

## Executive Summary

White Diamond is DTGC's revolutionary NFT-based staking system where **each stake position IS an NFT**. This enables a secondary market for staking positions - you can sell your stake without withdrawing, or buy someone else's mature stake at a discount.

**Contract Address:** `0x4424922Ee372268de9615b6e38E20cFD5e4b9D2D`  
**Token Standard:** ERC-721 (NFT)  
**Network:** PulseChain (369)

### 🔗 Quick Links

| Resource | Link |
|----------|------|
| **Contract** | [View on PulseScan](https://scan.pulsechain.com/address/0x4424922Ee372268de9615b6e38E20cFD5e4b9D2D) |
| **OpenSea** | [Trade NFTs](https://opensea.io/assets/pulsechain/0x4424922Ee372268de9615b6e38E20cFD5e4b9D2D) |
| **Deploy TX** | [View Transaction](https://scan.pulsechain.com/tx/0x9a8eb3afdf8aa209b5a1ea4da309c35e6c2b6ba9882baa2a94164932dfa7be85) |

---

## ⭐ How NFT Staking Works (Simple Version)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   🔄 WRAP: Stake LP → Get NFT (your stake is now tradeable) │
│                                                             │
│   💰 TRADE: Sell NFT on OpenSea = Sell your entire stake    │
│                                                             │
│   📤 UNWRAP: Withdraw after 90 days → Burns NFT, get LP back│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Think of it like a gift card:**
- WRAP = Load money onto gift card
- TRADE = Give/sell gift card to someone
- UNWRAP = Redeem gift card for cash  

---

## 🎯 Key Innovation

Traditional staking locks your funds. With White Diamond, your stake becomes a **tradeable asset**:

| Traditional Staking | White Diamond NFT |
|---------------------|-------------------|
| Funds locked in contract | Funds locked BUT position is tradeable |
| Must wait full lock period | Can sell NFT anytime on marketplace |
| No secondary market | OpenSea, Blur, any NFT marketplace |
| Lose rewards if emergency exit | Sell NFT = keep ALL accrued value |

---

## 📊 Tier Specifications

| Parameter | Value |
|-----------|-------|
| **APR** | 70% |
| **Lock Period** | 90 days |
| **Minimum Stake** | 1,000 LP tokens |
| **Entry Fee** | 3.75% (50% burned, 50% to treasury) |
| **Exit Fee** | 3.75% (50% burned, 50% to treasury) |
| **Early Exit Penalty** | 20% (50% burned, 50% to treasury) |

---

## 🔄 How It Works

### Staking Flow
```
1. STAKE LP TOKENS
   └─▶ Contract deducts 3.75% entry fee
   └─▶ Mints NFT to your wallet
   └─▶ NFT displays live stake data

2. WHILE STAKED
   └─▶ Rewards accrue at 70% APR
   └─▶ Claim rewards anytime (owner only)
   └─▶ Transfer/sell NFT = transfer stake

3. AFTER 90 DAYS
   └─▶ Withdraw: Burns NFT, returns LP + rewards
   └─▶ 3.75% exit fee deducted
```

### NFT Ownership = Stake Ownership

The NFT holder controls:
- ✅ Claiming accumulated rewards
- ✅ Withdrawing after lock period
- ✅ Emergency withdrawal (with penalty)
- ✅ Transferring to another wallet

---

## 🖼️ On-Chain NFT Art

Each NFT generates its artwork **on-chain** using SVG. The image displays:

- 💎 White Diamond icon with glow effect
- 📊 Staked LP amount
- 📈 70% APR indicator
- 💰 Pending rewards (updates live)
- ⏱️ Days remaining until unlock
- 🟢 Status (ACTIVE / UNLOCKED / WITHDRAWN)

**No external servers required.** The NFT image is generated directly from blockchain data.

---

## 💹 Secondary Market Dynamics

### Why Would Someone Buy an NFT Stake?

1. **Mature Stakes at Discount**
   - Seller needs liquidity, willing to sell at 5-10% below NAV
   - Buyer gets a stake with only 20 days left vs starting fresh at 90

2. **Reward Accumulation**
   - Accumulated rewards transfer with the NFT
   - Buyer may get significant unclaimed rewards

3. **Speculation**
   - LP value may increase during lock period
   - APR already locked in at 70%

### Example Trade

| Scenario | Seller | Buyer |
|----------|--------|-------|
| Original stake | 10,000 LP | - |
| Days remaining | 30 | - |
| Accrued rewards | 1,150 DTGC | - |
| Sale price | 9,500 LP equivalent | 9,500 LP |
| Seller gets | Immediate liquidity | - |
| Buyer gets | 10,000 LP + 1,150 DTGC (after 30 days) | +2,650 LP value |

---

## 🔐 Security Features

### Smart Contract Security

- ✅ **ReentrancyGuard** - Prevents reentrancy attacks
- ✅ **SafeERC20** - Safe token transfers
- ✅ **Ownable** - Admin functions protected
- ✅ **Immutable tokens** - LP and reward token addresses cannot change
- ✅ **No proxy** - Contract is not upgradeable (immutable logic)

### Audit Status

Contract follows OpenZeppelin standards. Community audit recommended before significant TVL.

---

## 📋 Contract Functions

### User Functions

| Function | Description |
|----------|-------------|
| `stake(amount)` | Stake LP tokens, receive NFT |
| `claimRewards(tokenId)` | Claim pending DTGC rewards |
| `withdraw(tokenId)` | Withdraw after lock (burns NFT) |
| `emergencyWithdraw(tokenId)` | Early exit with 20% penalty |
| `transferFrom(from, to, tokenId)` | Transfer NFT (and stake) |

### View Functions

| Function | Returns |
|----------|---------|
| `pendingRewards(tokenId)` | Unclaimed DTGC rewards |
| `getPosition(tokenId)` | Full stake details |
| `getStakesByOwner(address)` | All NFTs owned by address |
| `getStats()` | Protocol statistics |
| `tokenURI(tokenId)` | On-chain metadata + SVG |

### Admin Functions

| Function | Description |
|----------|-------------|
| `setFeeCollector(address)` | Update fee recipient |
| `fundRewards(amount)` | Add DTGC for rewards |
| `rescueTokens(token, amount)` | Rescue stuck tokens (not LP) |

---

## 🌐 Marketplace Integration

### OpenSea

NFTs will appear automatically on OpenSea (PulseChain) with:
- On-chain SVG image
- Trait filters (Tier, APR, Status)
- Unlock date attribute

### Direct Transfers

Use any wallet (MetaMask, Rabby) to transfer NFTs directly:
```
NFT Contract → Send → Enter recipient address
```

---

## 📈 Tokenomics Impact

### Fee Distribution

Every stake/unstake transaction:
- **50% of fees → BURNED** (deflationary)
- **50% of fees → Treasury** (sustainability)

### Burn Calculation Example

If 1,000,000 LP staked total:
- Entry fees: 37,500 LP collected → 18,750 LP burned
- Exit fees: 37,500 LP collected → 18,750 LP burned
- **Total burned per cycle: 37,500 LP**

---

## 🚀 Roadmap

### Phase 1: Launch ✅
- Deploy WhiteDiamondNFT contract
- Frontend integration
- Documentation

### Phase 2: Marketplace
- OpenSea listing
- Trading analytics dashboard
- Price floor tracking

### Phase 3: Expansion
- Additional NFT tiers (Platinum, Obsidian)
- Cross-chain bridging
- Lending against NFT collateral

---

## 📜 Contract Verification

**Network:** PulseChain Mainnet (369)  
**Contract:** `0x4424922Ee372268de9615b6e38E20cFD5e4b9D2D`  
**Explorer:** https://scan.pulsechain.com/address/0x4424922Ee372268de9615b6e38E20cFD5e4b9D2D  
**Verified Source:** Yes (Solidity 0.8.20)

---

## ⚠️ Risk Disclosure

1. **Smart Contract Risk** - Bugs may exist despite testing
2. **Impermanent Loss** - LP tokens exposed to IL
3. **Lock Period** - 90-day commitment (or 20% penalty)
4. **Market Risk** - DTGC/LP values may decrease
5. **Liquidity Risk** - NFT secondary market liquidity not guaranteed

---

## 📞 Support

- **Website:** https://dtgc.io
- **Telegram:** [DTGC Community]
- **Twitter/X:** [@DTGC_io]

---

*White Diamond NFT Staking - Where Your Stake Becomes Tradeable™*

**© 2025 DTGC.io - All Rights Reserved**
