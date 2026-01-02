// ═══════════════════════════════════════════════════════════════
//                    DTGC MAINNET CONFIGURATION V19
// ═══════════════════════════════════════════════════════════════

// PulseChain Mainnet
export const CHAIN_ID = 369;
export const EXPLORER = 'https://scan.pulsechain.com';

// Contract Addresses - MAINNET V19
export const CONTRACTS = {
  DTGC: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
  URMOM: '0xe43b3cEE3554e120213b8B69Caf690B6C04A7ec0',
  LP_TOKEN: '0x670c972Bb5388E087a2934a063064d97278e01F3',        // DTGC/URMOM LP (Diamond+)
  LP_DTGC_PLS: '0xc33944a6020FB5620001A202Eaa67214A1AB9193',     // DTGC/PLS LP (Diamond)
  LP_DTGC_URMOM: '0x670c972Bb5388E087a2934a063064d97278e01F3',   // DTGC/URMOM LP (Diamond+)
  STAKING_V2: '0x0c1984e3804Bd74DAaB66c4540bBeac751efB643',
  LP_STAKING_V2: '0x0b07eD8929884E9bBDEAD6B42465F2A265044f18',
  DAO_VOTING: '0x91DFFcC31C68Ef0C1F2ad49554E85bB7536fA470',
  DAO_TREASURY: '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC',
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
};

export const BURN_ADDRESS = '0x0000000000000000000000000000000000000369';

export const TOKENS = {
  dtgc: { address: CONTRACTS.DTGC, symbol: 'DTGC', decimals: 18, name: 'DT Gold Coin' },
  urmom: { address: CONTRACTS.URMOM, symbol: 'URMOM', decimals: 18, name: 'URMOM' },
  lpDtgcPls: { address: CONTRACTS.LP_DTGC_PLS, symbol: 'DTGC-PLS LP', decimals: 18, name: 'DTGC/PLS LP Token' },
  lpDtgcUrmom: { address: CONTRACTS.LP_DTGC_URMOM, symbol: 'DTGC-URMOM LP', decimals: 18, name: 'DTGC/URMOM LP Token' },
};

// V19 Staking Tiers
export const STAKING_TIERS = [
  { id: 0, name: 'SILVER', minInvest: 200, lockDays: 60, apr: 15.4, boost: 1 },
  { id: 1, name: 'GOLD', minInvest: 500, lockDays: 90, apr: 16.8, boost: 1 },
  { id: 2, name: 'WHALE', minInvest: 10000, lockDays: 180, apr: 18.2, boost: 1 },
];

export const DIAMOND_TIER = { 
  id: 3, 
  name: 'DIAMOND', 
  minInvest: 1000, 
  lockDays: 90, 
  apr: 28, 
  boost: 1.5, 
  effectiveApr: 42,
  asset: 'DTGC/PLS LP',
  lpAddress: '0xc33944a6020FB5620001A202Eaa67214A1AB9193'
};

export const DIAMOND_PLUS_TIER = { 
  id: 4, 
  name: 'DIAMOND+', 
  minInvest: 1000, 
  lockDays: 90, 
  apr: 35, 
  boost: 2, 
  effectiveApr: 70,
  asset: 'DTGC/URMOM LP',
  lpAddress: '0x670c972Bb5388E087a2934a063064d97278e01F3'
};

// V19 Fee Structure (7.5% Total)
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

export const VOTING_OPTIONS = ['Yes', 'No', 'Abstain'];

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

export const STAKING_V2_ABI = [
  'function stake(uint256 amount, uint8 tier) external',
  'function unstake(uint256 stakeId) external',
  'function emergencyUnstake(uint256 stakeId) external',
  'function claimRewards(uint256 stakeId) external',
  'function getStake(address user, uint256 stakeId) view returns (uint256 amount, uint256 startTime, uint256 endTime, uint8 tier, uint256 rewards, bool active)',
  'function getUserStakes(address user) view returns (uint256[] memory)',
  'function calculateRewards(address user, uint256 stakeId) view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function paused() view returns (bool)',
];

export const LP_STAKING_V2_ABI = [
  'function stake(uint256 amount) external',
  'function unstake(uint256 stakeId) external',
  'function emergencyUnstake(uint256 stakeId) external',
  'function claimRewards(uint256 stakeId) external',
  'function getStake(address user, uint256 stakeId) view returns (uint256 amount, uint256 startTime, uint256 endTime, uint256 rewards, bool active)',
  'function getUserStakes(address user) view returns (uint256[] memory)',
  'function calculateRewards(address user, uint256 stakeId) view returns (uint256)',
  'function totalStaked() view returns (uint256)',
  'function paused() view returns (bool)',
];

export const DAO_VOTING_ABI = [
  'function createProposal(string memory description, uint256 duration) external returns (uint256)',
  'function vote(uint256 proposalId, uint8 option) external',
  'function getProposal(uint256 proposalId) view returns (string memory description, uint256 startTime, uint256 endTime, uint256[] memory votes, bool executed)',
  'function getActiveProposals() view returns (uint256[] memory)',
  'function hasVoted(uint256 proposalId, address voter) view returns (bool)',
  'function getVotingPower(address voter) view returns (uint256)',
];
