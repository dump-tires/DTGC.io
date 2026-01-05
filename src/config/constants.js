// ═══════════════════════════════════════════════════════════════
//                    DTGC STAKING - CONSTANTS
//                         dump.tires
// ═══════════════════════════════════════════════════════════════

// Network
export const CHAIN_ID = 369;
export const CHAIN_NAME = 'PulseChain';
export const RPC_URL = 'https://rpc.pulsechain.com';
export const EXPLORER = 'https://scan.pulsechain.com';

// Contracts
export const CONTRACTS = {
  DTGC: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
  URMOM: '0xe43b3cEE3554e120213b8B69Caf690B6C04A7ec0',
  LP_TOKEN: '0x1891bD6A959B32977c438f3022678a8659364A72',
  STAKING_V2: '0x0c1984e3804Bd74DAaB66c4540bBeac751efB643',
  LP_STAKING_V2: '0x0b07eD8929884E9bBDEAD6B42465F2A265044f18',
  DAO_VOTING: '0x91DFFcC31C68Ef0C1F2ad49554E85bB7536fA470',
  DAO_TREASURY: '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC',
};

// Tokens
export const TOKENS = {
  DTGC: {
    address: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
    decimals: 18,
    symbol: 'DTGC',
    name: 'DT Gold Coin',
  },
  URMOM: {
    address: '0xe43b3cEE3554e120213b8B69Caf690B6C04A7ec0',
    decimals: 18,
    symbol: 'URMOM',
    name: 'URMOM',
  },
  LP: {
    address: '0x1891bD6A959B32977c438f3022678a8659364A72',
    decimals: 18,
    symbol: 'PLP',
    name: 'DTGC/URMOM LP',
  },
};

// V19 Staking Tiers (Sustainable APRs - reduced 30%)
export const STAKING_TIERS = [
  {
    id: 0,
    name: 'Silver',
    icon: '🥈',
    minInvest: 200,
    lockDays: 60,
    apr: 15.4,    // Reduced 30% from 22%
    bonus: 10,
    boost: 1,
    color: '#C0C0C0',
  },
  {
    id: 1,
    name: 'Gold',
    icon: '🥇',
    minInvest: 500,
    lockDays: 90,
    apr: 16.8,    // Reduced 30% from 24%
    bonus: 10,
    boost: 1,
    color: '#FFD700',
  },
  {
    id: 2,
    name: 'Whale',
    icon: '🐋',
    minInvest: 10000,
    lockDays: 180,
    apr: 18.2,    // Reduced 30% from 26%
    bonus: 10,
    boost: 1,
    color: '#4169E1',
  },
];

export const DIAMOND_TIER = {
  id: 3,
  name: 'Diamond',
  icon: '💎',
  minInvest: 1000,
  lockDays: 90,
  apr: 28,        // Reduced 30% from 40%
  effectiveApr: 42, // 28% × 1.5x boost
  bonus: 12,
  boost: 1.5,
  color: '#00BCD4',
  isLP: true,
  lpPair: 'DTGC/PLS',
};

export const DIAMOND_PLUS_TIER = {
  id: 4,
  name: 'Diamond+',
  icon: '💎✨',
  minInvest: 1000,
  lockDays: 90,
  apr: 35,        // Reduced 30% from 50%
  effectiveApr: 70, // 35% × 2x boost
  bonus: 15,
  boost: 2,
  color: '#9C27B0',
  isLP: true,
  lpPair: 'DTGC/URMOM',
};

// V19 Fee Structure (7.5% total for sustainability)
export const FEES = {
  ENTRY: 3.75,
  EXIT: 3.75,
  ENTRY_DAO: 1.875,
  ENTRY_DEV: 0.625,
  ENTRY_LP: 1.0,
  ENTRY_BURN: 0.25,
  EES_TOTAL: 20,
  EES_DEV: 5,
  EES_DAO: 12,
  EES_LP: 3,
};

// DAO Voting Options
export const VOTING_OPTIONS = [
  { id: 0, name: 'Buy and Burn', description: 'Purchase DTGC and send to burn address' },
  { id: 1, name: 'Liquidity', description: 'Add to DTGC/URMOM liquidity pool' },
  { id: 2, name: 'Treasury', description: 'Send to DAO Treasury for development' },
  { id: 3, name: 'All of Above', description: 'Split equally between all options' },
];

// Burn Address
export const BURN_ADDRESS = '0x0000000000000000000000000000000000000369';

// ABIs
export const STAKING_V2_ABI = [
  "function stake(uint256 amount, uint8 tier) external",
  "function withdraw() external",
  "function emergencyWithdraw() external",
  "function claimRewards() external",
  "function getPosition(address user) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonus, bool isActive, uint256 timeRemaining)",
  "function calculateAllRewards(address user) external view returns (uint256 base, uint256 feeShare, uint256 bonus)",
  "function getContractStats() external view returns (uint256 totalStaked, uint256 totalRewards, uint256 feePool, uint256 eesPool, uint256 stakers)",
  "function canVote(address user) external view returns (bool)",
];

export const LP_STAKING_V2_ABI = [
  "function stake(uint256 amount) external",
  "function withdraw() external",
  "function emergencyWithdraw() external",
  "function claimRewards() external",
  "function getPosition(address user) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 pendingReward, uint256 pendingBonus, uint256 boostMultiplier, bool isActive, uint256 timeRemaining)",
  "function getContractStats() external view returns (uint256 totalStaked, uint256 totalRewards, uint256 eesPool, uint256 apr, uint256 stakers)",
  "function getBoostMultiplier(address user) external view returns (uint256)",
  "function canVote(address user) external view returns (bool)",
];

export const DAO_VOTING_ABI = [
  "function vote(uint256 proposalId, uint8 option) external",
  "function createProposal(uint256 amount) external",
  "function executeProposal(uint256 proposalId) external",
  "function getProposal(uint256 id) external view returns (uint256 amount, uint256 endTime, uint256[4] votes, uint256 totalVoters, bool executed, uint8 winner)",
  "function getActiveProposal() external view returns (uint256)",
  "function canVote(address user) external view returns (bool)",
];

export const ERC20_ABI = [
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
];
