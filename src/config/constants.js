// ═══════════════════════════════════════════════════════════════
//                    DTGC MAINNET CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// PulseChain Mainnet
export const CHAIN_ID = 369;
export const EXPLORER = 'https://scan.pulsechain.com';

// Contract Addresses - MAINNET
export const CONTRACTS = {
  dtgc: '0x146a6F852D2B9a24e1078e6D2f86486D1C09165e',
  urmom: '0x91dfC220a58bC484D2684F8723Cf50A62eA39B0C',
  lp: '0xC02FFbE5d5f9E0A1b8947D7C234A8318FAE3DAD3',
  lpDtgcPls: '0xc33944a6020FB5620001A202Eaa67214A1AB9193',      // DTGC/PLS V2 LP
  lpDtgcUrmom: '0x670c972Bb5388E087a2934a063064d97278e01F3',   // DTGC/URMOM V2 LP
  stakingV2: '0x0c1984e3804Bd74DAaB66c4540bBeac751efB643',
  lpStakingV2: '0x0b07eD8929884E9bBDEAD6B42465F2A265044f18',
  daoVoting: '0x91DFFcC31C68Ef0C1F2ad49554E85bB7536fA470',
  daoTreasury: '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC',
};

export const BURN_ADDRESS = '0x0000000000000000000000000000000000000369';

export const TOKENS = {
  dtgc: { address: CONTRACTS.dtgc, symbol: 'DTGC', decimals: 18, name: 'DT Gold Coin' },
  urmom: { address: CONTRACTS.urmom, symbol: 'URMOM', decimals: 18, name: 'URMOM' },
  lp: { address: CONTRACTS.lp, symbol: 'DTGC-URMOM LP', decimals: 18, name: 'DTGC/URMOM LP Token' },
};

export const STAKING_TIERS = [
  { id: 0, name: 'SILVER', minInvest: 200, lockDays: 60, apr: 22, boost: 1 },
  { id: 1, name: 'GOLD', minInvest: 500, lockDays: 90, apr: 24, boost: 1 },
  { id: 2, name: 'WHALE', minInvest: 10000, lockDays: 180, apr: 26, boost: 1 },
];

export const DIAMOND_TIER = { id: 3, name: 'DIAMOND', minInvest: 1000, lockDays: 90, apr: 60, boost: 1.5, asset: 'DTGC/PLS LP' };
export const DIAMOND_PLUS_TIER = { id: 4, name: 'DIAMOND+', minInvest: 1000, lockDays: 90, apr: 100, boost: 2, asset: 'DTGC/URMOM LP' };

export const FEES = { entry: 1.5, exit: 1.5, ees: 12 };
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
];

export const DAO_VOTING_ABI = [
  'function createProposal(string memory description, uint256 duration) external returns (uint256)',
  'function vote(uint256 proposalId, uint8 option) external',
  'function getProposal(uint256 proposalId) view returns (string memory description, uint256 startTime, uint256 endTime, uint256[] memory votes, bool executed)',
  'function getActiveProposals() view returns (uint256[] memory)',
  'function hasVoted(uint256 proposalId, address voter) view returns (bool)',
  'function getVotingPower(address voter) view returns (uint256)',
];
