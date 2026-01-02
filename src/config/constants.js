// ═══════════════════════════════════════════════════════════════
//                    DTGC MAINNET CONFIGURATION V19
//                         PulseChain (Chain ID: 369)
//                              dtgc.io
// ═══════════════════════════════════════════════════════════════

export const CHAIN_ID = 369;
export const CHAIN_NAME = 'PulseChain';
export const EXPLORER = 'https://scan.pulsechain.com';
export const RPC_URL = 'https://rpc.pulsechain.com';

// ═══════════════════════════════════════════════════════════════
//                    CONTRACT ADDRESSES - MAINNET V3
// ═══════════════════════════════════════════════════════════════

export const CONTRACTS = {
  // Tokens
  DTGC: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
  URMOM: '0xe43b3cEE3554e120213b8B69Caf690B6C04A7ec0',
  
  // LP Tokens
  LP_DTGC_PLS: '0xc33944a6020FB5620001A202Eaa67214A1AB9193',
  LP_DTGC_URMOM: '0x670c972Bb5388E087a2934a063064d97278e01F3',
  LP_TOKEN: '0x670c972Bb5388E087a2934a063064d97278e01F3', // Default LP (DTGC/URMOM)
  
  // V3 Staking Contracts (LIVE)
  STAKING_V3: '0x0ba3d882f21b935412608d181501d59e99a8D0f9',
  LP_STAKING_V3: '0x7C328FFF32AD66a03218D8A953435283782Bc84F',
  DAO_VOTING_V3: '0x4828A40bEd10c373718cA10B53A34208636CD8C4',
  
  // Treasury & Wallets
  DAO_TREASURY: '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC',
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
};

export const BURN_ADDRESS = '0x0000000000000000000000000000000000000369';

// ═══════════════════════════════════════════════════════════════
//                         TOKEN METADATA
// ═══════════════════════════════════════════════════════════════

export const TOKENS = {
  dtgc: { 
    address: CONTRACTS.DTGC, 
    symbol: 'DTGC', 
    decimals: 18, 
    name: 'DT Gold Coin' 
  },
  urmom: { 
    address: CONTRACTS.URMOM, 
    symbol: 'URMOM', 
    decimals: 18, 
    name: 'URMOM' 
  },
  lpDtgcPls: { 
    address: CONTRACTS.LP_DTGC_PLS, 
    symbol: 'DTGC-PLS LP', 
    decimals: 18, 
    name: 'DTGC/PLS LP Token' 
  },
  lpDtgcUrmom: { 
    address: CONTRACTS.LP_DTGC_URMOM, 
    symbol: 'DTGC-URMOM LP', 
    decimals: 18, 
    name: 'DTGC/URMOM LP Token' 
  },
};

// ═══════════════════════════════════════════════════════════════
//                    V19 STAKING TIERS (DTGC)
// ═══════════════════════════════════════════════════════════════

export const STAKING_TIERS = [
  { 
    id: 0, 
    name: 'SILVER', 
    icon: '🥈',
    minInvest: 200, 
    lockDays: 60, 
    apr: 15.4, 
    bonus: 10,
    boost: 1,
    asset: 'DTGC',
    color: '#C0C0C0'
  },
  { 
    id: 1, 
    name: 'GOLD', 
    icon: '🥇',
    minInvest: 500, 
    lockDays: 90, 
    apr: 16.8, 
    bonus: 15,
    boost: 1,
    asset: 'DTGC',
    color: '#D4AF37'
  },
  { 
    id: 2, 
    name: 'WHALE', 
    icon: '🐋',
    minInvest: 10000, 
    lockDays: 180, 
    apr: 18.2, 
    bonus: 20,
    boost: 1,
    asset: 'DTGC',
    color: '#1E90FF'
  },
];

// ═══════════════════════════════════════════════════════════════
//                    V19 LP STAKING TIERS (DIAMOND)
// ═══════════════════════════════════════════════════════════════

export const DIAMOND_TIER = { 
  id: 3, 
  name: 'DIAMOND', 
  icon: '💎',
  minInvest: 1000, 
  lockDays: 90, 
  apr: 28, 
  boost: 1.5, 
  effectiveApr: 42,
  asset: 'DTGC/PLS LP',
  lpAddress: '0xc33944a6020FB5620001A202Eaa67214A1AB9193',
  color: '#00BFFF'
};

export const DIAMOND_PLUS_TIER = { 
  id: 4, 
  name: 'DIAMOND+', 
  icon: '💎✨',
  minInvest: 1000, 
  lockDays: 90, 
  apr: 35, 
  boost: 2, 
  effectiveApr: 70,
  asset: 'DTGC/URMOM LP',
  lpAddress: '0x670c972Bb5388E087a2934a063064d97278e01F3',
  color: '#9933FF'
};

// ═══════════════════════════════════════════════════════════════
//                    V19 FEE STRUCTURE (7.5% Total)
// ═══════════════════════════════════════════════════════════════

export const FEES = { 
  entry: 3.75, 
  exit: 3.75, 
  ees: 20,
  // Entry/Exit breakdown
  daoFee: 1.875,
  devFee: 0.625,
  lpUrmomFee: 0.5,
  lpPlsFee: 0.5,
  burnFee: 0.25,
};

// ═══════════════════════════════════════════════════════════════
//                         DAO GOVERNANCE
// ═══════════════════════════════════════════════════════════════

export const VOTING_OPTIONS = ['For', 'Against', 'Abstain'];

export const DAO_CONFIG = {
  proposalThreshold: 1000000,  // 1M DTGC to create proposal
  quorumBps: 500,              // 5% of circulating
  votingPeriod: 7 * 24 * 60 * 60, // 7 days in seconds
  executionDelay: 2 * 24 * 60 * 60, // 2 days in seconds
};

// ═══════════════════════════════════════════════════════════════
//                         CONTRACT ABIs
// ═══════════════════════════════════════════════════════════════

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function totalSupply() view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

export const STAKING_V3_ABI = [
  'function stake(uint256 amount, uint8 tier) external',
  'function withdraw() external',
  'function emergencyWithdraw() external',
  'function claimRewards() external',
  'function getPosition(address user) view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonusBps, uint8 tier, bool isActive, uint256 timeRemaining)',
  'function calculateRewards(address user) view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function totalStakers() view returns (uint256)',
  'function paused() view returns (bool)',
  'function getTiers() view returns (string[3] memory names, uint256[3] memory minUsd, uint256[3] memory locks, uint256[3] memory aprs, uint256[3] memory bonuses)',
];

export const LP_STAKING_V3_ABI = [
  'function stake(uint256 amount, uint8 lpType) external',
  'function withdraw() external',
  'function emergencyWithdraw() external',
  'function claimRewards() external',
  'function getPosition(address user) view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 boostBps, uint8 lpType, bool isActive, uint256 timeRemaining)',
  'function calculateRewards(address user) view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function totalStakers() view returns (uint256)',
  'function paused() view returns (bool)',
];

export const DAO_VOTING_V3_ABI = [
  'function createProposal(string calldata title, string calldata description) external returns (uint256)',
  'function castVote(uint256 proposalId, uint8 voteType) external',
  'function executeProposal(uint256 proposalId) external',
  'function cancelProposal(uint256 proposalId) external',
  'function delegate(address delegatee) external',
  'function getProposalBasic(uint256 proposalId) view returns (uint256 id, address proposer, string memory title, uint256 forVotes, uint256 againstVotes)',
  'function getProposalTiming(uint256 proposalId) view returns (uint256 startTime, uint256 endTime, uint256 abstainVotes, bool executed, bool cancelled)',
  'function getProposalState(uint256 proposalId) view returns (uint8)',
  'function getVotingPower(address account) view returns (uint256)',
  'function getQuorum() view returns (uint256)',
  'function hasVoted(uint256 proposalId, address voter) view returns (bool)',
  'function proposalCount() view returns (uint256)',
];

// ═══════════════════════════════════════════════════════════════
//                         NETWORK CONFIG
// ═══════════════════════════════════════════════════════════════

export const NETWORK_CONFIG = {
  chainId: CHAIN_ID,
  chainName: CHAIN_NAME,
  nativeCurrency: {
    name: 'Pulse',
    symbol: 'PLS',
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [EXPLORER],
};

// ═══════════════════════════════════════════════════════════════
//                         MODE FLAGS
// ═══════════════════════════════════════════════════════════════

export const TESTNET_MODE = false;  // MAINNET - Real transactions!
export const VIDEOS_ENABLED = true;
export const PASSWORD_PROTECTED = true;
export const SITE_PASSWORD = 'GOLD$tack91!';
