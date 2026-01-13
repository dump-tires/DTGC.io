# 💎 WHITE DIAMOND PAPER
## NFT-Based Staking Protocol - Technical Documentation

**Contract Address:** `0x326F86e7d594B55B7BA08DFE5195b10b159033fD`  
**Network:** PulseChain (Chain ID: 369)  
**Launch Date:** January 12, 2026  
**Protocol Type:** ERC721 NFT Staking with Fixed-Term Lock

---

## 📋 EXECUTIVE SUMMARY

White Diamond is a revolutionary NFT-based staking protocol on PulseChain that transforms liquidity provision into tradeable, collectable NFT assets. Each stake is represented as a unique ERC721 token featuring Darth Vader helmet iconography, combining DeFi utility with digital collectability.

### Key Innovation
Unlike traditional staking where your position is locked in a contract, White Diamond mints an NFT that represents your stake. This NFT can be:
- **Traded** on secondary markets
- **Used as collateral** (future integrations)
- **Gifted or transferred** to other wallets
- **Displayed in galleries** as proof of early adoption

---

## 🎯 PROTOCOL PARAMETERS

| Parameter | Value | Description |
|-----------|-------|-------------|
| **Staked Asset** | URMOM/DTGC LP | PulseX V2 liquidity pool tokens |
| **Reward Token** | DTGC | DT Gold Coin |
| **APR** | 70% | Fixed annual percentage rate |
| **Lock Period** | 90 days | Minimum holding period |
| **Minimum Stake** | 1,000 LP | Entry threshold |
| **Entry Fee** | 3.75% | One-time fee on deposit |
| **Exit Fee** | 3.75% | One-time fee on withdrawal |
| **Early Exit Penalty** | 20% | Additional penalty before lock expires |

---

## 🔧 HOW IT WORKS

### 1. STAKING PROCESS

```
User Stakes LP → Fees Deducted → NFT Minted → Position Active
     ↓               ↓                 ↓              ↓
  2M LP          75K fees         Token #2      1.925M active
```

**Fee Distribution:**
- **50% Burned** → Sent to `0x000...dead` (deflationary)
- **50% Treasury** → Development & operations fund

**Example Calculation:**
```
Stake: 2,000,000 LP
Entry Fee: 2,000,000 × 3.75% = 75,000 LP
  └─ Burned: 37,500 LP
  └─ Treasury: 37,500 LP
Active Position: 1,925,000 LP
```

### 2. NFT STRUCTURE

Each White Diamond NFT stores:
```solidity
struct Stake {
    uint256 amount;        // LP tokens staked (after fees)
    uint256 startTime;     // Unix timestamp of stake
    uint256 lastClaim;     // Last reward claim timestamp
}
```

**On-Chain Metadata:**
- Token ID (sequential counter)
- Stake amount
- Timestamp data
- Active/inactive status

**Visual Representation:**
- Darth Vader helmet icon ⚔️
- Gold gradient background
- Stake details displayed
- Time remaining countdown

### 3. REWARDS CALCULATION

```
Annual Rewards = Staked Amount × 70%
Daily Rewards = Annual Rewards ÷ 365
Pending Rewards = (Current Time - Last Claim) × Daily Rate
```

**Example:**
```
Stake: 1,925,000 LP
Annual: 1,925,000 × 70% = 1,347,500 DTGC
Daily: 1,347,500 ÷ 365 = 3,691.78 DTGC/day
After 30 days: 3,691.78 × 30 = 110,753 DTGC
```

Rewards accrue **continuously** and can be claimed **any time** without affecting the principal stake.

### 4. WITHDRAWAL OPTIONS

#### OPTION A: Normal Withdrawal (After Lock)
**Conditions:** 90+ days have passed  
**Process:**
1. Claim all pending rewards
2. Deduct 3.75% exit fee
3. Return LP to user
4. Burn NFT

**Fee Distribution:**
```
Withdrawal: 1,925,000 LP
Exit Fee: 1,925,000 × 3.75% = 72,187.5 LP
  └─ Burned: 36,093.75 LP
  └─ Treasury: 36,093.75 LP
Received: 1,852,812.5 LP
```

#### OPTION B: Emergency Withdrawal (Before Lock)
**Conditions:** Anytime, but with penalties  
**Process:**
1. **Forfeit 20% of rewards**
2. Pay 3.75% exit fee
3. Return remaining LP
4. Burn NFT

**Calculation:**
```
Pending Rewards: 110,753 DTGC
Penalty (20%): 22,150.6 DTGC (forfeited)
Received Rewards: 88,602.4 DTGC

Principal: 1,925,000 LP
Exit Fee (3.75%): 72,187.5 LP
Received LP: 1,852,812.5 LP
```

---

## 🏗️ TECHNICAL ARCHITECTURE

### Smart Contract Components

#### ERC721 Base
```solidity
contract WhiteDiamondNFT is ERC721Enumerable {
    mapping(uint256 => Stake) public stakes;
    uint256 private _nextId = 1;
    // Standard ERC721 functions
    // + Enumerable extension
}
```

**Inheritance:**
- `ERC721` - Base NFT functionality
- `ERC721Enumerable` - Token enumeration (limited functionality)
- Custom staking logic

#### Core Functions

**stake(uint256 amount)**
```solidity
function stake(uint256 amount) external returns (uint256) {
    require(amount >= MIN_STAKE, "Below minimum");
    
    // Calculate fees
    uint256 fee = amount * ENTRY_FEE / 10000;
    uint256 toBurn = fee / 2;
    uint256 stakeAmt = amount - fee;
    
    // Transfer tokens
    lpToken.transferFrom(msg.sender, address(0xdead), toBurn);
    lpToken.transferFrom(msg.sender, feeCollector, fee - toBurn);
    lpToken.transferFrom(msg.sender, address(this), stakeAmt);
    
    // Mint NFT
    uint256 tokenId = _nextId++;
    _mint(msg.sender, tokenId);
    
    // Store stake
    stakes[tokenId] = Stake({
        amount: stakeAmt,
        startTime: block.timestamp,
        lastClaim: block.timestamp
    });
    
    return tokenId;
}
```

**getPosition(uint256 tokenId)**
```solidity
function getPosition(uint256 tokenId) external view returns (
    uint256 amount,
    uint256 startTime,
    uint256 unlockTime,
    uint256 lastClaimTime,
    uint256 pending,
    bool isActive,
    uint256 timeRemaining
)
```

Returns all position data in one call for efficient frontend queries.

---

## 🎨 USER INTERFACE

### Components Created

**1. WhiteDiamondStaking.jsx**
- Main staking interface
- NFT gallery view
- Claim/Withdraw controls
- Live stats dashboard

**2. WhiteDiamondIcon.jsx**
- Navigation element
- Live NFT count badge
- Visual indicator

**3. NFTCard.jsx**
- Individual NFT display
- Darth Vader helmet graphics
- Stake details
- Action buttons

**4. WhiteDiamondNFTViewer.jsx**
- PulseX Gold integration
- Thumbnail grid
- Quick view modal

### Features

✅ **Dark/Light Mode Support**  
✅ **Mobile Responsive**  
✅ **Real-time Updates**  
✅ **Price Integration**  
✅ **Transaction Confirmations**

---

## 🔐 SECURITY FEATURES

### Smart Contract Security

**Reentrancy Protection**
```solidity
uint256 private _lock = 1;
modifier lock() {
    require(_lock == 1, "Reentrancy");
    _lock = 2;
    _;
    _lock = 1;
}
```

**Owner Restrictions**
- Only owner can set fee collector
- Cannot withdraw staked LP tokens
- Cannot modify core parameters

**Access Controls**
- Users can only interact with their own NFTs
- Standard ERC721 permission model
- Transfer restrictions during lock period

### Economic Security

**Fee Distribution:**
- 50% burned reduces circulating supply
- 50% treasury ensures sustainability
- No admin mint function

**Lock Mechanism:**
- Enforced at contract level
- Cannot be bypassed
- Emergency exit always available (with penalty)

---

## 📊 PROTOCOL METRICS

### Current Stats (Live)
```javascript
const stats = await contract.getStats();
// Returns:
// - Total LP Staked
// - Total NFTs Minted  
// - Total Rewards Paid
// - Current APR
// - Lock Duration
```

### Key Metrics to Track

| Metric | Description |
|--------|-------------|
| **TVL** | Total Value Locked in LP |
| **NFTs Minted** | Total supply of stake NFTs |
| **Active Stakes** | Currently earning rewards |
| **Total Burned** | LP burned through fees |
| **Rewards Distributed** | DTGC paid to stakers |

---

## 🛠️ TECHNICAL CHALLENGES & SOLUTIONS

### Challenge 1: Contract Enumeration Issue

**Problem:** `tokenOfOwnerByIndex()` returning incorrect token IDs  

**Root Cause:** ERC721Enumerable implementation conflict  

**Solution:** Direct token ID checking
```javascript
// Instead of enumeration:
for (let i = 0; i < balance; i++) {
    tokenId = tokenOfOwnerByIndex(user, i); // ❌ Broken
}

// Use direct ownership check:
for (let tokenId = 0; tokenId <= totalSupply; tokenId++) {
    if (ownerOf(tokenId) === user) { // ✅ Works
        // Process token
    }
}
```

### Challenge 2: ABI Compatibility

**Problem:** Contract functions didn't match initial ABI expectations  

**Solution:** Reverse engineered deployed contract via PulseScan transaction logs

**Correct Function Signatures:**
```solidity
getPosition() returns (amount, startTime, unlockTime, lastClaimTime, pending, isActive, timeRemaining)
getStats() returns (totalStaked, totalSupply, totalRewardsPaid, apr, lockTime)
```

### Challenge 3: Frontend State Management

**Problem:** NFT data not persisting across page reloads  

**Solution:** 
- Local state with 30-second refresh intervals
- Contract event listening for real-time updates
- Optimistic UI updates on transactions

---

## 📱 NFT TRADING & MARKETPLACE STATUS

### OpenSea Integration Status

**Current Status:** ⏳ Waiting on OpenSea to approve PulseChain NFTs

White Diamond NFTs are fully ERC721 compliant and ready for OpenSea integration. We are currently waiting for OpenSea to add official PulseChain network support. Once approved, all White Diamond NFTs will automatically appear on OpenSea with full trading functionality.

### How to Trade Your NFT Today (P2P)

Until OpenSea support is live, White Diamond NFTs can be traded peer-to-peer using the built-in transfer functionality:

1. **Find a Buyer** - Connect with potential buyers through Telegram, Discord, Twitter, or other community channels
2. **Agree on Price** - Negotiate the sale price for your NFT (includes the staked LP position and accrued rewards)
3. **Receive Payment** - Have the buyer send payment (PLS, DTGC, or other agreed token) to your wallet
4. **Transfer NFT** - Use the Transfer button on your NFT card to send it to the buyer's wallet address
5. **Verify** - Buyer verifies ownership on PulseScan

### Verifying NFT Ownership on PulseScan

PulseScan provides complete transparency for White Diamond NFT ownership and history:

- **Contract Address:** `0x326F86e7d594B55B7BA08DFE5195b10b159033fD`
- **PulseScan URL:** https://scan.pulsechain.com/token/0x326F86e7d594B55B7BA08DFE5195b10b159033fD
- **Individual NFT:** Add `?a=[tokenId]` to view specific NFT (e.g., `?a=1` for NFT #1)

#### What You Can Verify
- Current owner wallet address
- Complete ownership history and transfer records
- Original mint timestamp
- Token ID and contract verification
- All transaction history related to the NFT

### NFT Value Proposition

When you purchase a White Diamond NFT, you're acquiring:

- **Staked LP Position** - The full LP amount staked in the contract
- **Accrued Rewards** - All DTGC rewards earned since stake began
- **Future Rewards** - Continued 70% APR until unlock
- **Lock Time** - Remaining lock period (or unlocked status)
- **Collectible Value** - Early adopter status and Darth Vader-themed NFT

### Smart Contract Security for Trading

The White Diamond smart contract ensures secure NFT transfers:

- Standard ERC721 transfer function - battle-tested and audited by thousands of implementations
- Staked position automatically transfers with the NFT
- Accrued rewards transfer to new owner
- No middleman or escrow needed - direct wallet-to-wallet transfer
- Immutable blockchain record of ownership

### Future Marketplace Integrations

Beyond OpenSea, White Diamond NFTs will be compatible with:

- **PulseChain-Native Marketplaces** - Any ERC721-compatible marketplace launching on PulseChain
- **Aggregators** - Multi-chain NFT aggregation platforms
- **Custom DTGC Marketplace** - Potential future dtgc.io NFT trading interface
- **DeFi Lending** - Use NFTs as collateral for loans

**Important:** All future integrations will work automatically due to ERC721 standard compliance. No updates or migrations required.

---

## 🔮 FUTURE ENHANCEMENTS

### Phase 2: Secondary Markets
- OpenSea integration
- Custom marketplace UI
- NFT rarity system based on stake amount

### Phase 3: Collateralization
- Use NFTs as loan collateral
- Integration with lending protocols
- Flash loan compatibility

### Phase 4: Governance
- Vote weight based on stake size
- NFT holder proposals
- Treasury management voting

### Phase 5: Gamification
- Achievement badges
- Stake milestones
- Leaderboards
- Special edition NFTs

---

## 📞 INTEGRATION GUIDE

### For Developers

**Adding White Diamond to Your DApp:**

```javascript
import WhiteDiamondStaking from './components/WhiteDiamondStaking';

<WhiteDiamondStaking
  provider={provider}
  signer={signer}
  userAddress={account}
  livePrices={{
    dtgc: 0.0008154,
    // ... other prices
  }}
/>
```

**Contract Integration:**
```javascript
const contract = new ethers.Contract(
  '0x326F86e7d594B55B7BA08DFE5195b10b159033fD',
  WHITE_DIAMOND_ABI,
  signer
);

// Stake
const tx = await contract.stake(amount);
await tx.wait();

// Get user's NFTs (workaround for broken enumeration)
const totalSupply = await contract.totalSupply();
const userNFTs = [];
for (let i = 0; i <= totalSupply; i++) {
  try {
    const owner = await contract.ownerOf(i);
    if (owner === userAddress) {
      userNFTs.push(i);
    }
  } catch {}
}
```

---

## 📚 APPENDIX

### A. Token Addresses

| Token | Address | Purpose |
|-------|---------|---------|
| White Diamond | `0x326F86e7d594B55B7BA08DFE5195b10b159033fD` | Stake NFT Contract |
| URMOM/DTGC LP | `0x670c972Bb5388E087a2934a063064d97278e01F3` | Staked Asset |
| DTGC | `0xD0676B28a457371D58d47E5247b439114e40Eb0F` | Reward Token |

### B. Network Details

**PulseChain Mainnet**
- Chain ID: 369
- RPC: https://rpc.pulsechain.com
- Explorer: https://scan.pulsechain.com
- Symbol: PLS

### C. Transaction Examples

**Successful Stake:**
- TX: `0x8b7a3ee347ffd24d1c9130592216cd44e6ec6536e202276db6e84fad4ae13633`
- Token Minted: #2
- Amount: 1,925,000 LP (after fees)
- Timestamp: Jan 12 2026, 17:57:25 PM

### D. UI Screenshots

**Main Interface:**
- Gold-themed gradient backgrounds
- Darth Vader helmet NFT cards
- Real-time countdown timers
- Interactive claim/withdraw buttons

**NFT Cards Display:**
- Token ID prominence
- LP amount in large font
- APR badge (70%)
- Lock/Unlock status indicator
- Rewards counter

---

## ⚠️ DISCLAIMERS

**Investment Risk:** 
Staking cryptocurrency carries inherent risks. Understand the lock period and fees before staking.

**Smart Contract Risk:**
While audited for basic security, no contract is 100% risk-free. Use at your own discretion.

**Regulatory Risk:**
DeFi regulations vary by jurisdiction. Ensure compliance with local laws.

**Market Risk:**
Token prices fluctuate. LP value and reward value may decrease.

---

## 🎖️ CREDITS

**Development:** DTGC Team  
**Smart Contract:** WhiteDiamondNFT.sol  
**Frontend:** React + ethers.js  
**Design:** Imperial/Darth Vader Theme  
**Network:** PulseChain  

---

## 📝 VERSION HISTORY

**v1.0.0** - January 12, 2026
- Initial deployment
- Core staking functionality
- NFT minting system
- Basic UI components

**v1.0.1** - January 12, 2026
- Fixed enumeration workaround
- Enhanced error handling
- Improved console logging
- Better mobile support

**v1.1.0** - January 12, 2026
- Added P2P NFT trading controls
- PulseScan verification integration
- OpenSea pending status documentation
- NFT transfer functionality
- Trading guide and best practices

---

## 📧 CONTACT & SUPPORT

**Website:** https://dtgc.io  
**Twitter:** @DTGCgold  
**Telegram:** t.me/dtgcgold  
**Discord:** discord.gg/dtgc  

**Contract Verification:**  
View on PulseScan: https://scan.pulsechain.com/address/0x326F86e7d594B55B7BA08DFE5195b10b159033fD

---

## 🏆 CONCLUSION

White Diamond represents the evolution of DeFi staking from simple contract locks to tradeable, collectible NFT assets. By combining strong tokenomics (70% APR, deflationary fees) with NFT utility (P2P trading, future OpenSea listing, collateral potential), White Diamond creates a new category of DeFi primitive.

The Darth Vader theme isn't just aesthetic—it represents power, rarity, and the dark side of DeFi yields. Early adopters become part of an exclusive club of White Diamond holders, with their NFTs serving as permanent proof of participation in this innovative protocol.

While we await OpenSea's PulseChain integration, the built-in P2P trading functionality ensures White Diamond NFTs remain liquid and transferable today. Every NFT represents real value: staked LP, accrued rewards, and future yield potential—all verifiable on-chain via PulseScan.

**Join the Dark Side. Stake for 70% APR. Collect Your Diamond. Trade Your Position.** 💎⚔️

---

*This document is for informational purposes only and does not constitute financial advice. Always DYOR (Do Your Own Research).*

**Document Version:** 1.1.0  
**Last Updated:** January 12, 2026  
**Status:** ✅ LIVE ON PULSECHAIN | 📱 P2P TRADING ACTIVE
