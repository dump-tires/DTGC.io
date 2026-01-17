import DapperComponent from './components/DapperComponent';
import DapperFlexV6 from './components/DapperFlexV6';
import PricingPage from './pages/PricingPage';
import V4DeFiGoldSuite from './components/V4DeFiGoldSuite';
import WhiteDiamondStaking from './components/WhiteDiamondStaking';
import React, { useState, useEffect, useCallback, useMemo, createContext, useContext, useRef } from 'react';
import { ethers } from 'ethers';
// SaaS Config System - enables white-label customization
import { useSaaSConfig, useBranding, useTiers, useContracts, useFeatures, DEFAULT_CONFIG } from './SaaSApp';
// WalletConnect v2 - Install: npm install @walletconnect/ethereum-provider @walletconnect/modal
// import { EthereumProvider } from '@walletconnect/ethereum-provider';
import {
  CONTRACTS,
  TOKENS,
  STAKING_TIERS,
  DIAMOND_TIER,
  DAO_VOTING_V3_ABI,
  ERC20_ABI,
  CHAIN_ID,
  EXPLORER,
  FEES,
  VOTING_OPTIONS,
  BURN_ADDRESS,
} from './config/constants';

// ═══════════════════════════════════════════════════════════════
// V3 ABIs (for backwards compatibility / migration)
// ═══════════════════════════════════════════════════════════════
const STAKING_V3_ABI = [
  'function stake(uint256 amount, uint8 tier) external',
  'function withdraw() external',
  'function emergencyWithdraw() external',
  'function claimRewards() external',
  'function getPosition(address user) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonusBps, uint8 tier, bool isActive, uint256 timeRemaining)',
  'function calculateRewards(address user) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
];

const LP_STAKING_V3_ABI = [
  'function stake(uint256 amount, uint8 lpType) external',
  'function withdraw() external',
  'function emergencyWithdraw() external',
  'function claimRewards() external',
  'function getPosition(address user) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 boostBps, uint8 lpType, bool isActive, uint256 timeRemaining)',
  'function calculateRewards(address user) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
];

const FALLBACK_STAKING_V3_ABI = STAKING_V3_ABI;
const FALLBACK_LP_STAKING_V3_ABI = LP_STAKING_V3_ABI;

// ═══════════════════════════════════════════════════════════════
// V4 MULTI-STAKE ABIs - UNLIMITED STAKES PER USER
// ═══════════════════════════════════════════════════════════════
const STAKING_V4_ABI = [
  // Staking functions
  'function stake(uint256 amount, uint8 tier) external',
  'function withdraw(uint256 stakeIndex) external',
  'function claimRewards(uint256 stakeIndex) external',
  'function emergencyWithdraw(uint256 stakeIndex) external',
  // View functions - Individual stake
  'function getStake(address user, uint256 stakeIndex) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonusBps, uint8 tier, bool isActive, uint256 timeRemaining, uint256 pendingRewards)',
  'function calculateRewards(address user, uint256 stakeIndex) external view returns (uint256)',
  // View functions - All stakes
  'function getStakeCount(address user) external view returns (uint256)',
  'function getActiveStakeCount(address user) external view returns (uint256)',
  'function getAllStakes(address user) external view returns (tuple(uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonusBps, uint8 tier, bool isActive, uint256 lastClaimTime)[])',
  'function getActiveStakes(address user) external view returns (tuple(uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonusBps, uint8 tier, bool isActive, uint256 lastClaimTime)[])',
  // View functions - Totals
  'function getTotalStakedByUser(address user) external view returns (uint256)',
  'function getTotalPendingRewards(address user) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
  'function totalStakers() external view returns (uint256)',
  // V3 compatibility
  'function getPosition(address user) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 bonusBps, uint8 tier, bool isActive, uint256 timeRemaining)',
  // Config
  'function tierConfigs(uint8 tier) external view returns (uint256 lockDays, uint256 aprBps, uint256 minAmount, bool isActive)',
  'function earlyWithdrawFeeBps() external view returns (uint256)',
];

const LP_STAKING_V4_ABI = [
  // Staking functions
  'function stake(uint256 amount, uint8 lpType) external',
  'function withdraw(uint256 stakeIndex) external',
  'function claimRewards(uint256 stakeIndex) external',
  'function emergencyWithdraw(uint256 stakeIndex) external',
  // View functions - Individual stake
  'function getStake(address user, uint256 stakeIndex) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 boostBps, uint8 lpType, bool isActive, uint256 timeRemaining, uint256 pendingRewards)',
  'function calculateRewards(address user, uint256 stakeIndex) external view returns (uint256)',
  // View functions - All stakes
  'function getStakeCount(address user) external view returns (uint256)',
  'function getActiveStakeCount(address user) external view returns (uint256)',
  'function getAllStakes(address user) external view returns (tuple(uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 boostBps, uint8 lpType, bool isActive, uint256 lastClaimTime)[])',
  'function getActiveStakes(address user) external view returns (tuple(uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 boostBps, uint8 lpType, bool isActive, uint256 lastClaimTime)[])',
  // View functions - Totals
  'function getTotalStakedByUser(address user) external view returns (uint256)',
  'function getTotalPendingRewards(address user) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
  'function totalStakedByType(uint8 lpType) external view returns (uint256)',
  'function totalStakers() external view returns (uint256)',
  // V3 compatibility
  'function getPosition(address user) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lockPeriod, uint256 aprBps, uint256 boostBps, uint8 lpType, bool isActive, uint256 timeRemaining)',
  // Config
  'function lpConfigs(uint8 lpType) external view returns (address lpToken, uint256 lockDays, uint256 baseAprBps, uint256 boostBps, uint256 minAmount, bool isActive)',
  'function earlyWithdrawFeeBps() external view returns (uint256)',
];

// Flex LP Staking V4 ABI - 10% APR, No Lock, Any LP Token
const LP_STAKING_FLEX_V4_ABI = [
  'function stake(uint256 amount) external',
  'function withdraw(uint256 stakeIndex) external',
  'function claimRewards(uint256 stakeIndex) external',
  'function getStake(address user, uint256 stakeIndex) external view returns (uint256 amount, uint256 startTime, uint256 pendingRewards, bool isActive)',
  'function getStakeCount(address user) external view returns (uint256)',
  'function getActiveStakeCount(address user) external view returns (uint256)',
  'function getActiveStakes(address user) external view returns (tuple(uint256 amount, uint256 startTime, uint256 lastClaimTime, bool isActive)[])',
  'function getTotalStakedByUser(address user) external view returns (uint256)',
  'function getTotalPendingRewards(address user) external view returns (uint256)',
  'function calculateRewards(address user, uint256 stakeIndex) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
  'function aprBps() external view returns (uint256)',
];

// V4 Mode toggle - ENABLED for multi-stake support
const USE_V4_CONTRACTS = true;

// Log which ABIs we're using
console.log('📝 Staking V3 ABI:', STAKING_V3_ABI?.length ? `${STAKING_V3_ABI.length} functions` : 'MISSING!');
console.log('📝 LP Staking V3 ABI:', LP_STAKING_V3_ABI?.length ? `${LP_STAKING_V3_ABI.length} functions` : 'MISSING!');

// WalletConnect Project ID - Get yours free at https://cloud.walletconnect.com/
const WALLETCONNECT_PROJECT_ID = '10281b2ce43a6f7240ee415515ddb27a';

// Fallback BURN_ADDRESS in case import fails
const DTGC_BURN_ADDRESS = BURN_ADDRESS || '0x0000000000000000000000000000000000000369';
const DTGC_TOKEN_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';

/*
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║     🏆 DTGC V4 STAKING PLATFORM - MAINNET LIVE 🏆            ║
    ║                                                               ║
    ║     ✦ V4 UNLIMITED MULTI-STAKE - FIRST ON PULSECHAIN!        ║
    ║     ✦ Stack Multiple Positions Across All Tiers              ║
    ║     ✦ Claim Rewards Without Unstaking                        ║
    ║     ✦ Diamond+ LP: Up to 70% APR                             ║
    ║     ✦ Gold Paper V4 Tokenomics                               ║
    ║     ✦ Deployed: January 5, 2026                              ║
    ║                                                               ║
    ║     DTGCStakingV4: 0xEbC6802e6a2054FbF2Cb450aEc5E2916965b1718║
    ║     LPStakingV4:   0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231║
    ║     LPFlexV4:      0x5ccea11cab6a17659ce1860f5b0b6e4a8cea54d6║
    ║     Dapper:        0xc7fe28708ba913d6bdf1e7eac2c75f2158d978de║
    ║                                                               ║
    ║                    dtgc.io                                    ║
    ╚═══════════════════════════════════════════════════════════════╝
*/

// ═══════════════════════════════════════════════════════════════
//                    DTGC TOKENOMICS (1 BILLION SUPPLY)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//                    V4 GOLD PAPER TOKENOMICS (91% CONTROLLED)
// ═══════════════════════════════════════════════════════════════

const DTGC_TOKENOMICS = {
  totalSupply: 1000000000,
  daoPool: 500000000,        // 50% - DAO Rewards Pool (staking)
  devWallet: 323000000,      // 32.3% - Dev Wallet
  circulating: 90000000,     // 9% - Circulating (ULTRA LOW FLOAT!)
  lpLocked: 87000000,        // 8.7% - LP Locked
};

// V19 SUSTAINABLE FEE STRUCTURE (7.5% total for long-term sustainability)
const V5_FEES = {
  // Entry Tax: 3.75% total
  entry: {
    total: 3.75,
    daoTreasury: 1.875,      // 1.875% DAO Treasury (rewards)
    dev: 0.625,              // 0.625% Dev
    autoLP_DTGC_URMOM: 0.5,  // 0.5% Auto LP DTGC/URMOM
    autoLP_DTGC_PLS: 0.5,    // 0.5% DTGC/PLS
    burn: 0.25,              // 0.25% DTGC Burn
  },
  // Exit Tax: 3.75% total (same breakdown)
  exit: {
    total: 3.75,
    daoTreasury: 1.875,
    dev: 0.625,
    autoLP_DTGC_URMOM: 0.5,
    autoLP_DTGC_PLS: 0.5,
    burn: 0.25,
  },
  // EES (Emergency End Stake): 20% total
  ees: {
    total: 20,
    dev: 5,              // 5% Dev
    dao: 12,             // 12% DAO
    autoLP: 3,           // 3% Auto LP
  },
};

// V19 SUSTAINABLE STAKING TIERS (APRs reduced 30% for sustainability with 7.5% fees)
const V5_STAKING_TIERS = [
  {
    id: 0,
    name: 'SILVER',
    icon: '🥈',
    minInvest: 5,
    lockDays: 60,
    holdDays: 60,
    apr: 15.4,     // Reduced 30% from 22%
    bonus: 10,
    boost: 1,
    asset: 'DTGC',
    color: '#C0C0C0',
    gradient: 'linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 50%, #A8A8A8 100%)'
  },
  {
    id: 1,
    name: 'GOLD',
    icon: '🥇',
    minInvest: 5,
    lockDays: 90,
    holdDays: 90,
    apr: 16.8,     // Reduced 30% from 24%
    bonus: 10,
    boost: 1,
    asset: 'DTGC',
    color: '#D4AF37',
    gradient: 'linear-gradient(135deg, #FFF1A8 0%, #D4AF37 50%, #B8860B 100%)'
  },
  {
    id: 2,
    name: 'WHALE',
    icon: '🐋',
    minInvest: 2500,
    maxInvest: 50000,  // Max $50,000 worth - exclusive tier
    lockDays: 180,
    holdDays: 180,
    apr: 18.2,     // Reduced 30% from 26%
    bonus: 10,
    boost: 1,
    asset: 'DTGC',
    color: '#4169E1',
    gradient: 'linear-gradient(135deg, #6B8DD6 0%, #4169E1 50%, #2E4FA3 100%)'
  },
];

// Diamond Tier (DTGC/PLS LP - 1.5x boost!)
const V5_DIAMOND_TIER = {
  id: 3,
  name: 'DIAMOND',
  icon: '💎',
  minInvest: 5,               // Minimum $5
  maxInvest: 25000,           // Maximum $25,000
  lockDays: 90,
  holdDays: 90,
  apr: 28,                   // Reduced 30% from 40%
  effectiveApr: 28 * 1.5,    // 42% effective
  bonus: 12,
  boost: 1.5,
  isLP: true,
  lpPair: 'DTGC/PLS',
  color: '#00BCD4',
  gradient: 'linear-gradient(135deg, #B9F2FF 0%, #00BCD4 50%, #008BA3 100%)'
};

// Diamond+ Tier (DTGC/URMOM LP - 2x boost!)
const V5_DIAMOND_PLUS_TIER = {
  id: 4,
  name: 'DIAMOND+',
  icon: '💜💎',
  minInvest: 5,               // Minimum $5
  maxInvest: 25000,           // Maximum $25,000
  lockDays: 90,
  holdDays: 90,
  apr: 35,                   // Reduced 30% from 50%
  effectiveApr: 35 * 2,      // 70% effective!
  bonus: 15,
  boost: 2,
  isLP: true,
  lpPair: 'DTGC/URMOM',
  color: '#9C27B0',
  gradient: 'linear-gradient(135deg, #E1BEE7 0%, #9C27B0 50%, #7B1FA2 100%)'
};

// V19 Dynamic APR (reduces as Market Cap grows - sustainable scaling)
const MARKET_CAP_PHASES = [
  { maxMarketCap: 10000000, multiplier: 1.0, name: "Genesis", description: "Full APR - Early adopters" },
  { maxMarketCap: 25000000, multiplier: 0.85, name: "Growth", description: "85% APR - Building momentum" },
  { maxMarketCap: 50000000, multiplier: 0.70, name: "Expansion", description: "70% APR - Scaling up" },
  { maxMarketCap: 100000000, multiplier: 0.50, name: "Mature", description: "50% APR - Sustainable growth" },
  { maxMarketCap: Infinity, multiplier: 0.35, name: "Scaled", description: "35% APR - Long-term stability" },
];

// Legacy TVL_PHASES for backwards compatibility
const TVL_PHASES = MARKET_CAP_PHASES;

// Helper function to get current phase based on market cap
const getCurrentPhase = (marketCap) => {
  for (const phase of MARKET_CAP_PHASES) {
    if (marketCap < phase.maxMarketCap) {
      return phase;
    }
  }
  return MARKET_CAP_PHASES[MARKET_CAP_PHASES.length - 1];
};

// Calculate effective APR based on market cap phase
const getEffectiveAPR = (baseAPR, marketCap) => {
  const phase = getCurrentPhase(marketCap);
  return baseAPR * phase.multiplier;
};

// V19 APR CORRECTION - Override old contract APRs with correct values
// Old contracts stored crazy APRs like 7000%. This corrects them.
const getV19CorrectedAPR = (contractApr, tierName, isLP = false) => {
  const V19_CORRECT_APRS = {
    'SILVER': 15.4,
    'GOLD': 16.8,
    'WHALE': 18.2,
    'DIAMOND': 42,      // 28% × 1.5x
    'DIAMOND+': 70,     // 35% × 2.0x
    '0': 15.4,          // Numeric fallbacks
    '1': 16.8,
    '2': 18.2,
  };
  
  // If contract APR is absurdly high (>100%), use V19 corrected value
  if (contractApr > 100) {
    let tier;
    if (typeof tierName === 'number') {
      const TIER_NAMES = ['SILVER', 'GOLD', 'WHALE'];
      tier = TIER_NAMES[tierName] || 'GOLD';
    } else {
      tier = (tierName || 'GOLD').toString().toUpperCase();
    }
    const correctedApr = V19_CORRECT_APRS[tier] || (isLP ? 42 : 16.8);
    console.log(`🔧 V19 APR Correction: ${contractApr}% → ${correctedApr}% for ${tier}`);
    return correctedApr;
  }
  
  return contractApr;
};

// Format market cap for display
const formatMarketCap = (value) => {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
};

// ═══════════════════════════════════════════════════════════════
//                    LIVE BURN DATA (ACCURATE FROM DEXSCREENER)
// ═══════════════════════════════════════════════════════════════

// DexScreener API endpoints for live prices
const DEXSCREENER_API = {
  urmom: 'https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0',
  dtgc: 'https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
};

// Default/fallback prices (updated when API fails)
const DEFAULT_PRICES = {
  urmomPrice: 0.0003515,
  dtgcPrice: 0.0001851,
};

const BURN_STATS = {
  // URMOM Token Stats - ACCURATE FROM DEXSCREENER
  // https://dexscreener.com/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0
  urmomPrice: 0.0003515,  // $0.0003515 - LIVE PRICE
  // DTGC - https://dexscreener.com/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7
  dtgcPrice: 0.0001851,   // $0.0001851 - LIVE PRICE
  urmomMarketCap: 159727, // Based on circulating supply * price
  urmomTotalSupply: 1000000000,
  
  // Dead Wallet Burns
  deadWallets: {
    '0x0000000000000000000000000000000000000000': 0,
    '0x000000000000000000000000000000000000dEaD': 0,
    '0x0000000000000000000000000000000000000369': 545616403.14,
  },
  totalDeadWallet: 545616403.14,
  burnedUSD: 576170.92,
  burnPercentage: 54.5616,

  // LP Burn Percentages
  lpBurnPercentages: [
    { pair: 'URMOM/HEX', percentage: 99.2237 },
    { pair: 'URMOM/INC', percentage: 99.5773 },
    { pair: 'URMOM/eHEX', percentage: 99.6719 },
    { pair: 'URMOM/PLS', percentage: 99.0 },
    { pair: 'URMOM/PLSX', percentage: 98.5 },
    { pair: 'URMOM/PTGC', percentage: 99.8 },
  ],

  // LP URMOM Token Breakdown
  lpUrmomBreakdown: [
    { pool: 'PTGC Pool', tokens: 31232571, color: '#FFD700' },
    { pool: 'PLS Pool', tokens: 26643051, color: '#00D4AA' },
    { pool: 'HEX Pool', tokens: 11919546, color: '#FF6B6B' },
    { pool: 'PLSX Pool', tokens: 11093073, color: '#9B59B6' },
    { pool: 'PLS Pool 2', tokens: 6117908, color: '#3498DB' },
    { pool: 'INC Pool', tokens: 10068493, color: '#E74C3C' },
    { pool: 'pHEX Pool', tokens: 5975013, color: '#F39C12' },
  ],

  // LP Pool Addresses
  lpPools: [
    { name: 'URMOM/DTGC', address: '0x1891bD6A959B32977c438f3022678a8659364A72' },
    { name: 'URMOM/PLS', address: '0x682B82baAC38dDb185D77deAF98D9D246EF9c9E5' },
    { name: 'URMOM/HEX', address: '0x0548656e272fec9534e180d3174cfc57ab6e10c0' },
    { name: 'URMOM/pHEX', address: '0x6Bd31Cdc8c87F3bE93bEaC2E4F58DAeEf1f7905e' },
    { name: 'URMOM/INC', address: '0xc8EC3c754B259fB7503072058A71d00cc20121DF' },
  ],
};

// ═══════════════════════════════════════════════════════════════
//                    DTGC SUPPLY DYNAMICS
// ═══════════════════════════════════════════════════════════════
const DTGC_TOTAL_SUPPLY = 1000000000; // 1 Billion

const SUPPLY_WALLETS = {
  dao: {
    name: 'DAO Treasury',
    address: '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC',
    icon: '🏛️',
    description: 'Staking rewards & governance',
    expected: 0, // Currently 0 DTGC
    color: '#4CAF50',
  },
  dev: {
    name: 'Dev Wallet',
    address: '0x777d7f3ad24832975aec259ab7d7b57be4225abf',
    icon: '👨‍💻',
    description: 'Development & operations',
    expected: 820829080.34, // ~820.8M DTGC (live from chain)
    color: '#2196F3',
  },
  lpLocked: {
    name: 'LP Locked',
    address: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7', // DTGC/PLS LP
    icon: '🔒',
    description: 'Liquidity pool locked',
    expected: 87000000, // 87M (8.7%)
    color: '#9C27B0',
  },
  burn: {
    name: 'Burned Forever',
    address: '0x0000000000000000000000000000000000000369',
    icon: '🔥',
    description: 'Permanently destroyed',
    expected: 0, // Dynamic
    color: '#F44336',
  },
  circulating: {
    name: 'Circulating Supply',
    address: null, // Calculated
    icon: '💱',
    description: 'Available for trading',
    expected: 90000000, // 90M (9%)
    color: '#FF9800',
  },
};

// ═══════════════════════════════════════════════════════════════
//                    DTGC HOLDER WALLETS TICKER (LIVE API)
// ═══════════════════════════════════════════════════════════════
// Fetches live holder data from PulseChain Explorer API

// PulseChain Explorer API (via Vercel serverless proxy to avoid CORS)
const PULSECHAIN_API = {
  // Use local API route to proxy requests (avoids CORS issues)
  holders: '/api/holders',
  tokenInfo: '/api/token-info',
  // Direct RPC for contract calls (doesn't have CORS issues)
  rpc: 'https://rpc.pulsechain.com',
};

// Wallets to EXCLUDE from ticker (DAO, Dev, LP, Burn, Staking Rewards)
const EXCLUDED_WALLETS = [
  '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC', // DAO Treasury
  '0x777d7f3ad24832975aec259ab7d7b57be4225abf', // Dev Wallet (main)
  '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c', // Dev Wallet (secondary)
  '0x0000000000000000000000000000000000000369', // Burn address
  '0x000000000000000000000000000000000000dEaD', // Dead address
  '0x0000000000000000000000000000000000000000', // Zero address
  '0x1891bD6A959B32977c438f3022678a8659364A72', // LP Pool DTGC/URMOM
  '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7', // LP Pool DTGC/PLS
  '0x670c972Bb5388E087a2934a063064d97278e01F3', // LP DTGC/URMOM (PulseX)
  '0xc33944a6020FB5620001A202Eaa67214A1AB9193', // LP DTGC/PLS (PulseX)
  '0x0ba3d882f21b935412608d181501d59e99a8D0f9', // DTGCStakingV3 Rewards
  '0x7C328FFF32AD66a03218D8A953435283782Bc84F', // LPStakingV3 Rewards
  '0x4828A40bEd10c373718cA10B53A34208636CD8C4', // DAOVotingV3
  '0xEbC6802e6a2054FbF2Cb450aEc5E2916965b1718', // DTGCStakingV4 Rewards (NEW)
  '0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231', // LPStakingV4 Rewards (NEW)
].map(addr => addr.toLowerCase());

// Fallback data if API fails (placeholder)
const HOLDER_WALLETS = [
  { address: '0x7a3B...9F2e', balance: 2500000, label: 'Loading...' },
  { address: '0x4cD1...8A3b', balance: 1800000, label: 'Loading...' },
  { address: '0x9eF2...3C4d', balance: 1200000, label: 'Loading...' },
  { address: '0x2aB5...7E8f', balance: 950000, label: 'Loading...' },
  { address: '0x6cD9...1A2b', balance: 750000, label: 'Loading...' },
];

// Helper to shorten address for display
const shortenAddress = (addr) => {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// Calculate with accurate price
const totalLPUrmom = BURN_STATS.lpUrmomBreakdown.reduce((sum, p) => sum + p.tokens, 0);
const plsPrice = 0.00003;

// ═══════════════════════════════════════════════════════════════
//                    SOCIAL & CONTRACT LINKS
// ═══════════════════════════════════════════════════════════════

const SOCIAL_LINKS = {
  xUrmom: 'https://x.com/UrmomPulse',
  xDTGC: 'https://x.com/DTGCio4',
  telegram: 'https://t.me/urmomPulse',
  website: 'https://dtgc.io',
  dexscreener: 'https://dexscreener.com/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0',
  dexscreenerDTGC: 'https://dexscreener.com/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
  coingecko: 'https://www.coingecko.com/en/coins/urmom-3',
};

const CONTRACT_ADDRESSES = {
  dtgc: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
  urmom: '0xe43b3cEE3554e120213b8B69Caf690B6C04A7ec0',
  lpDtgcUrmom: '0x670c972Bb5388E087a2934a063064d97278e01F3',   // DTGC/URMOM LP (Diamond+)
  lpDtgcPls: '0xc33944a6020FB5620001A202Eaa67214A1AB9193',    // DTGC/PLS LP (Diamond)
  daoTreasury: '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC',
  // V3 Contracts (legacy)
  stakingV3: '0x0ba3d882f21b935412608d181501d59e99a8D0f9',
  lpStakingV3: '0x7C328FFF32AD66a03218D8A953435283782Bc84F',
  daoVotingV3: '0x4828A40bEd10c373718cA10B53A34208636CD8C4',
  // V4 Contracts (UNLIMITED MULTI-STAKE) - DEPLOYED VIA REMIX 01/05/2026!
  stakingV4: '0xEbC6802e6a2054FbF2Cb450aEc5E2916965b1718',
  lpStakingV4: '0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231',
  // Flex V4 - 10% APR No Lock LP Staking
  lpStakingFlexV4: '0x5ccea11cab6a17659ce1860f5b0b6e4a8cea54d6', // Flex LP Staking - 10% APR No Lock
  // White Diamond V5 - NFT LP Staking (70% APR, 90 day lock, tradeable NFT)
  whiteDiamondV5: '0x326F86e7d594B55B7BA08DFE5195b10b159033fD',
  // DapperFlex V6 - Pink Gold Cross-Chain Zapper with Referrals
  dapperFlexV6: '0x0b11799Ef41A01fB9399dCbA161076d7aed20b3e',
  burn: '0x0000000000000000000000000000000000000369',
  devWallet: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
};

// ═══════════════════════════════════════════════════════════════
//                    VIDEO PATHS (ENABLED)
// ═══════════════════════════════════════════════════════════════

const VIDEOS_ENABLED = true; // Videos are enabled!

const VIDEOS = {
  stake: '/videos/stake-video.mp4',
  popup: '/videos/popup-video.mp4',
  whitepaper: '/videos/whitepaper-video.mp4',
};

// ═══════════════════════════════════════════════════════════════
//                    🧪 TESTNET MODE - PUBLIC TESTING
// ═══════════════════════════════════════════════════════════════

const TESTNET_MODE = false; // MAINNET PRODUCTION

// Password Protection
const SITE_PASSWORD = 'GOLD$tack91!';
const PASSWORD_ENABLED = false;

// IP Logging Configuration
const LOG_ACCESS_ATTEMPTS = true;
const LOG_ENDPOINT = 'https://api.ipify.org?format=json'; // Get visitor IP

const TESTNET_CONFIG = {
  startingPLS: 100000000,      // 100M PLS
  startingDTGC: 50000000,      // 50M DTGC  
  startingURMOM: 25000000,     // 25M URMOM
  startingLP: 1000000,         // 1M LP tokens
  simulatedAPR: true,          // Show simulated rewards
  faucetCooldown: 0,           // No cooldown for testing
};

// ═══════════════════════════════════════════════════════════════
//                    THEME CONTEXT
// ═══════════════════════════════════════════════════════════════

const ThemeContext = createContext();
const useTheme = () => useContext(ThemeContext);

// ═══════════════════════════════════════════════════════════════
//                         STYLES
// ═══════════════════════════════════════════════════════════════

const getStyles = (isDark) => `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Cormorant+Garamond:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  :root {
    --gold-bright: #FFF1A8;
    --gold-light: #FFE55C;
    --gold: #D4AF37;
    --gold-dark: #B8860B;
    --gold-deep: #8B6914;
    --platinum: #E5E4E2;
    --platinum-shine: #F8F8F8;
    --diamond: #B9F2FF;
    --diamond-dark: #00BCD4;
    
    --bg-primary: ${isDark ? '#0D0D0D' : '#E8E4E0'};
    --bg-secondary: ${isDark ? '#1A1A1A' : '#D5D0CB'};
    --bg-card: ${isDark ? '#1E1E1E' : '#F0EDE9'};
    --text-primary: ${isDark ? '#FFFFFF' : '#2A2520'};
    --text-secondary: ${isDark ? '#B0B0B0' : '#5A5550'};
    --text-muted: ${isDark ? '#707070' : '#8A8580'};
    --border-color: ${isDark ? '#333333' : '#C0B8B0'};
    
    --glow-gold: 0 0 40px rgba(212, 175, 55, ${isDark ? '0.5' : '0.4'});
    --glow-diamond: 0 0 40px rgba(0, 188, 212, ${isDark ? '0.5' : '0.3'});
    --shadow-luxury: 0 25px 50px -12px rgba(0, 0, 0, ${isDark ? '0.4' : '0.2'});
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: 'Montserrat', sans-serif;
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
    overflow-x: hidden;
    transition: background 0.3s ease, color 0.3s ease;
  }

  /* Marble Background */
  .marble-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    pointer-events: none;
    background: var(--bg-primary);
  }

  .marble-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      ${isDark ? `
        radial-gradient(ellipse at 20% 30%, rgba(212, 175, 55, 0.08) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 70%, rgba(212, 175, 55, 0.05) 0%, transparent 40%),
        radial-gradient(ellipse at 50% 50%, rgba(100, 100, 100, 0.1) 0%, transparent 60%)
      ` : `
        radial-gradient(ellipse at 15% 25%, rgba(212, 175, 55, 0.15) 0%, transparent 35%),
        radial-gradient(ellipse at 85% 75%, rgba(212, 175, 55, 0.12) 0%, transparent 40%),
        radial-gradient(ellipse at 60% 40%, rgba(184, 134, 11, 0.08) 0%, transparent 30%),
        radial-gradient(ellipse at 30% 80%, rgba(212, 175, 55, 0.1) 0%, transparent 35%),
        radial-gradient(ellipse at 50% 50%, rgba(140, 130, 120, 0.2) 0%, transparent 60%)
      `};
  }

  .marble-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 1000 1000' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: ${isDark ? '0.03' : '0.06'};
    mix-blend-mode: overlay;
  }

  .marble-veins {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }

  .vein {
    position: absolute;
    background: linear-gradient(90deg, transparent 0%, ${isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(212, 175, 55, 0.25)'} 50%, transparent 100%);
    transform-origin: center;
  }

  .vein-1 { top: 10%; left: -10%; width: 60%; height: ${isDark ? '1px' : '2px'}; transform: rotate(25deg); }
  .vein-2 { top: 30%; right: -10%; width: 50%; height: ${isDark ? '1px' : '2px'}; transform: rotate(-15deg); }
  .vein-3 { top: 50%; left: -5%; width: 40%; height: ${isDark ? '1px' : '1.5px'}; transform: rotate(35deg); }
  .vein-4 { top: 70%; right: -5%; width: 55%; height: ${isDark ? '1px' : '2px'}; transform: rotate(-25deg); }
  .vein-5 { top: 85%; left: 20%; width: 45%; height: 1px; transform: rotate(10deg); }

  /* Animations */
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes pulse-gold {
    0%, 100% { box-shadow: 0 0 20px rgba(212, 175, 55, 0.3); }
    50% { box-shadow: 0 0 40px rgba(212, 175, 55, 0.6); }
  }

  @keyframes goldGlow {
    0%, 100% { 
      filter: drop-shadow(0 0 10px rgba(212,175,55,0.5)) drop-shadow(0 0 20px rgba(212,175,55,0.3)) drop-shadow(0 0 30px rgba(212,175,55,0.2));
    }
    50% { 
      filter: drop-shadow(0 0 15px rgba(212,175,55,0.8)) drop-shadow(0 0 30px rgba(212,175,55,0.5)) drop-shadow(0 0 45px rgba(212,175,55,0.3));
    }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.05); }
  }

  @keyframes goldFlash {
    0% { opacity: 0; }
    30% { opacity: 1; }
    100% { opacity: 0; }
  }

  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes particle-rise {
    0% { transform: translateY(100vh) scale(0); opacity: 0; }
    10% { opacity: 1; }
    90% { opacity: 1; }
    100% { transform: translateY(-100vh) scale(1); opacity: 0; }
  }

  @keyframes slide-in-up {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fire-flicker {
    0%, 100% { transform: scale(1) rotate(-1deg); filter: brightness(1); }
    25% { transform: scale(1.02) rotate(1deg); filter: brightness(1.1); }
    50% { transform: scale(0.98) rotate(-1deg); filter: brightness(0.95); }
    75% { transform: scale(1.01) rotate(0deg); filter: brightness(1.05); }
  }

  @keyframes glow-pulse {
    0%, 100% { filter: drop-shadow(0 0 10px currentColor); }
    50% { filter: drop-shadow(0 0 25px currentColor); }
  }

  @keyframes modal-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes modal-out {
    from { opacity: 1; transform: scale(1); }
    to { opacity: 0; transform: scale(0.9); }
  }

  @keyframes backdrop-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Holder Wallet Ticker Animation */
  @keyframes ticker-scroll {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  .ticker-container {
    overflow: hidden;
    background: rgba(0,0,0,0.4);
    border-radius: 8px;
    padding: 8px 0;
    margin-top: 16px;
    position: relative;
  }

  .ticker-container::before,
  .ticker-container::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 60px;
    z-index: 2;
    pointer-events: none;
  }

  .ticker-container::before {
    left: 0;
    background: linear-gradient(90deg, rgba(26,35,39,1) 0%, transparent 100%);
  }

  .ticker-container::after {
    right: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(26,35,39,1) 100%);
  }

  .ticker-track {
    display: flex;
    animation: ticker-scroll 41s linear infinite;
    width: fit-content;
  }

  .ticker-track:hover {
    animation-play-state: paused;
  }

  .ticker-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 20px;
    border-right: 1px solid rgba(212,175,55,0.2);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ticker-address {
    font-family: 'Consolas', monospace;
    font-size: 0.75rem;
    color: #888;
    background: rgba(255,255,255,0.05);
    padding: 2px 8px;
    border-radius: 4px;
  }

  .ticker-balance {
    font-size: 0.85rem;
    font-weight: 700;
    color: #D4AF37;
  }

  .ticker-label {
    font-size: 0.65rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  /* Particles */
  .particles-container {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 1;
    overflow: hidden;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--gold);
    border-radius: 50%;
    animation: particle-rise linear infinite;
    opacity: 0;
  }

  .particle:nth-child(odd) { background: var(--diamond); }

  /* Gold Text */
  .gold-text {
    background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold-light) 25%, var(--gold) 50%, var(--gold-dark) 75%, var(--gold-deep) 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 3s linear infinite;
  }

  /* App Container */
  .app-container {
    min-height: 100vh;
    position: relative;
    z-index: 2;
  }

  /* Navigation */
  .nav-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: ${isDark ? 'rgba(13, 13, 13, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border-color);
    transition: all 0.3s ease;
  }

  .nav-header.scrolled {
    box-shadow: 0 4px 30px rgba(0, 0, 0, ${isDark ? '0.3' : '0.1'});
  }

  .nav-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 14px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .logo-mark {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 50%, var(--gold-dark) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-weight: 900;
    font-size: 1.1rem;
    color: #1A1A1A;
    box-shadow: var(--glow-gold);
    /* Removed bounce animation per user request */
  }

  .logo-text-group { display: flex; flex-direction: column; }

  .logo-text {
    font-family: 'Cinzel', serif;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 3px;
  }

  .logo-tagline {
    font-family: 'Cormorant Garamond', serif;
    font-size: 0.7rem;
    color: var(--text-muted);
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  .nav-links {
    display: flex;
    gap: 6px;
  }

  .nav-link {
    padding: 10px 16px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    background: transparent;
    border: none;
    border-radius: 30px;
    cursor: pointer;
    transition: all 0.3s ease;
    letter-spacing: 1px;
    text-transform: uppercase;
    position: relative;
  }

  .nav-link::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--gold-light), var(--gold));
    transition: all 0.3s ease;
    transform: translateX(-50%);
  }

  .nav-link:hover::before, .nav-link.active::before { width: 80%; }
  .nav-link:hover, .nav-link.active { color: var(--gold); }

  .nav-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .theme-toggle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.1rem;
    transition: all 0.3s ease;
  }

  .theme-toggle:hover {
    background: var(--gold);
    border-color: var(--gold);
    transform: rotate(180deg);
  }

  .connect-btn {
    padding: 10px 24px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.75rem;
    font-weight: 700;
    color: #1A1A1A;
    background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 50%, var(--gold-dark) 100%);
    background-size: 200% auto;
    border: none;
    border-radius: 50px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
  }

  .connect-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
    background-position: right center;
  }

  .connect-btn.connected {
    background: ${isDark ? 'rgba(212, 175, 55, 0.2)' : 'var(--platinum)'};
    border: 2px solid var(--gold);
    color: var(--text-primary);
  }

  /* Hero Section */
  .hero-section {
    padding: 140px 40px 80px;
    text-align: center;
    position: relative;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    background: ${isDark ? 'rgba(212, 175, 55, 0.15)' : 'rgba(212, 175, 55, 0.1)'};
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 50px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--gold);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 20px;
    animation: slide-in-up 0.6s ease;
  }

  .hero-title {
    font-family: 'Cinzel', serif;
    font-size: 3.5rem;
    font-weight: 900;
    letter-spacing: 6px;
    margin-bottom: 16px;
    line-height: 1.1;
    animation: slide-in-up 0.6s ease 0.1s both;
  }

  .hero-subtitle {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.4rem;
    color: var(--text-secondary);
    letter-spacing: 3px;
    margin-bottom: 40px;
    font-weight: 400;
    animation: slide-in-up 0.6s ease 0.2s both;
  }

  .hero-stats {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
    animation: slide-in-up 0.6s ease 0.3s both;
  }

  .hero-stat {
    text-align: center;
    padding: 24px 30px;
    background: var(--bg-card);
    border-radius: 18px;
    border: 1px solid var(--border-color);
    min-width: 150px;
    transition: all 0.3s ease;
  }

  .hero-stat:hover {
    transform: translateY(-5px);
    box-shadow: var(--shadow-luxury);
    border-color: var(--gold);
  }

  .hero-stat-value {
    font-family: 'Cinzel', serif;
    font-size: 1.8rem;
    font-weight: 800;
    margin-bottom: 6px;
  }

  .hero-stat-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  /* Main Content */
  .main-content {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 40px 80px;
  }

  .section {
    margin-bottom: 60px;
    animation: slide-in-up 0.6s ease both;
  }

  .section-header {
    text-align: center;
    margin-bottom: 40px;
  }

  .section-title {
    font-family: 'Cinzel', serif;
    font-size: 1.8rem;
    font-weight: 700;
    letter-spacing: 4px;
    margin-bottom: 14px;
  }

  .section-divider {
    width: 100px;
    height: 3px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    margin: 0 auto;
  }

  .section-description {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1rem;
    color: var(--text-secondary);
    margin-top: 14px;
    letter-spacing: 1px;
  }

  /* Tier Cards */
  .tiers-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }

  /* Responsive tier rows */
  .tier-row-top {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    margin-bottom: 16px;
  }
  
  .tier-row-diamonds {
    display: flex;
    justify-content: center;
    gap: 20px;
    flex-wrap: wrap;
  }

  @media (max-width: 1200px) { 
    .tiers-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) { 
    .tiers-grid { grid-template-columns: 1fr; }
    .tier-row-top { grid-template-columns: 1fr; }
    .hero-title { font-size: 1.8rem !important; letter-spacing: 2px !important; }
    .hero-subtitle { font-size: 1rem !important; letter-spacing: 1px !important; margin-bottom: 20px !important; }
    .hero-section { padding: 100px 15px 40px !important; }
    .hero-stats { gap: 12px !important; }
    .hero-stat { padding: 14px 18px !important; min-width: 130px !important; }
    .hero-stat-value { font-size: 1.3rem !important; }
    .hero-stat-label { font-size: 0.6rem !important; }
    .nav-content { flex-direction: column; gap: 14px; }
    .nav-links { display: none; }
    .main-content { padding: 0 10px 50px; }
    .mobile-menu-toggle { display: flex !important; }
    .section-title { font-size: 1.3rem !important; letter-spacing: 1px !important; }
    
    /* Mobile Header - Compact DTGC logo */
    .logo-section { gap: 8px !important; }
    .logo-mark { 
      width: 32px !important; 
      height: 32px !important; 
      font-size: 0.85rem !important; 
    }
    .logo-text { 
      font-size: 1rem !important; 
      letter-spacing: 1px !important; 
    }
    .logo-tagline { 
      font-size: 0.5rem !important; 
      letter-spacing: 2px !important; 
      display: none !important; 
    }
    
    /* Compact nav tabs on mobile */
    .nav-tabs-container { 
      padding: 0 8px !important; 
      gap: 4px !important;
    }
    .nav-tab-btn { 
      padding: 6px 10px !important; 
      font-size: 0.65rem !important;
    }
    
    /* Reduce tier card sizes */
    .tier-card { padding: 16px !important; }
    .tier-header { padding: 12px !important; }
    .tier-name { font-size: 1rem !important; }
    .tier-apr { font-size: 1.8rem !important; }
    
    /* Mobile Position Card Optimizations */
    .position-card-mobile {
      padding: 12px !important;
    }
    .position-card-mobile .tier-name {
      font-size: 0.95rem !important;
    }
    .position-card-mobile .staked-amount {
      font-size: 0.75rem !important;
    }
    .position-card-mobile .apr-display {
      font-size: 0.7rem !important;
    }
    .position-card-mobile .rewards-value {
      font-size: 1rem !important;
    }
    .position-card-mobile .action-btn-small {
      padding: 6px 10px !important;
      font-size: 0.6rem !important;
    }
    .position-card-mobile .date-display {
      font-size: 0.65rem !important;
    }
  }

  .mobile-menu-toggle {
    display: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: rgba(212,175,55,0.1);
    border: 1px solid rgba(212,175,55,0.3);
    border-radius: 12px;
    cursor: pointer;
    font-size: 1.5rem;
    transition: all 0.3s ease;
  }

  .mobile-menu-toggle:hover {
    background: rgba(212,175,55,0.2);
    border-color: var(--gold);
  }

  .mobile-nav-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--bg-primary);
    border-bottom: 2px solid var(--gold);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 1000;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  }

  .mobile-nav-dropdown button {
    width: 100%;
    padding: 14px 20px;
    font-size: 0.9rem;
    font-weight: 600;
    background: rgba(212,175,55,0.1);
    border: 1px solid rgba(212,175,55,0.2);
    border-radius: 10px;
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
  }

  .mobile-nav-dropdown button:hover,
  .mobile-nav-dropdown button.active {
    background: rgba(212,175,55,0.2);
    border-color: var(--gold);
    color: var(--gold);
  }

  .tier-card {
    background: var(--bg-card);
    border-radius: 20px;
    padding: 28px 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    border: 2px solid transparent;
    cursor: pointer;
  }

  .tier-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--tier-gradient);
  }

  .tier-card:hover {
    transform: translateY(-8px);
    box-shadow: var(--shadow-luxury);
    border-color: var(--gold);
  }

  .tier-card.selected {
    border-color: var(--gold);
    box-shadow: var(--glow-gold);
  }

  .tier-card.diamond {
    background: ${isDark ? 'linear-gradient(180deg, #0A1A1F 0%, #0D2530 100%)' : 'linear-gradient(180deg, #F0FFFF 0%, #E0F7FA 100%)'};
  }

  .tier-card.diamond::before {
    background: linear-gradient(90deg, var(--diamond), var(--diamond-dark), var(--diamond));
    background-size: 200% auto;
    animation: shimmer 2s linear infinite;
  }

  .tier-card.diamond.selected {
    border-color: var(--diamond-dark);
    box-shadow: var(--glow-diamond);
  }

  /* ⭐ WHITE DIAMOND NFT TIER */
  .tier-card.white-diamond {
    background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(200,200,200,0.05) 100%);
    border: 2px solid rgba(255,255,255,0.5);
  }

  .tier-card.white-diamond::before {
    background: linear-gradient(90deg, #FFFFFF, #E8E8E8, #FFFFFF);
    background-size: 200% auto;
    animation: shimmer 2s linear infinite;
  }

  .tier-card.white-diamond:hover {
    border-color: #FFFFFF;
    box-shadow: 0 0 30px rgba(255,255,255,0.4), 0 0 60px rgba(255,215,0,0.2);
    transform: translateY(-8px) scale(1.02);
  }

  .tier-icon {
    font-size: 3rem;
    margin-bottom: 12px;
    animation: float 3s ease-in-out infinite;
  }

  .tier-name {
    font-family: 'Cinzel', serif;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 3px;
    margin-bottom: 6px;
    text-transform: uppercase;
  }

  .tier-subtitle {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--diamond-dark);
    margin-top: 6px;
    letter-spacing: 1px;
  }

  .tier-apr-container { margin: 14px 0; }

  .tier-apr {
    font-family: 'Cinzel', serif;
    font-size: 2.5rem;
    font-weight: 900;
    line-height: 1;
  }

  .tier-apr-label {
    font-size: 0.85rem;
    color: var(--text-muted);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .tier-features {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
    text-align: left;
  }

  .tier-feature {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 0.8rem;
  }

  .tier-feature-label { color: var(--text-muted); }
  .tier-feature-value { font-weight: 600; color: var(--text-primary); }

  .tier-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    padding: 4px 8px;
    font-size: 0.55rem;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    border-radius: 20px;
    background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 100%);
    color: #1A1A1A;
  }

  .tier-badge.lp {
    background: linear-gradient(135deg, var(--diamond) 0%, var(--diamond-dark) 100%);
  }

  /* Staking Panel */
  .staking-panel {
    max-width: 550px;
    margin: 40px auto 0;
    background: var(--bg-card);
    border-radius: 24px;
    padding: 36px;
    box-shadow: var(--shadow-luxury);
    border: 1px solid var(--border-color);
    position: relative;
    overflow: hidden;
  }

  .staking-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(90deg, var(--gold-light), var(--gold), var(--diamond), var(--gold), var(--gold-light));
    background-size: 200% auto;
    animation: shimmer 3s linear infinite;
  }

  .panel-title {
    font-family: 'Cinzel', serif;
    font-size: 1.3rem;
    font-weight: 700;
    letter-spacing: 3px;
    text-align: center;
    margin-bottom: 28px;
  }

  .input-group { margin-bottom: 20px; }

  .input-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .input-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 1px;
  }

  .balance-display {
    font-size: 0.8rem;
    color: var(--gold);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .balance-display:hover { text-decoration: underline; }

  .input-container { position: relative; }

  .stake-input {
    width: 100%;
    padding: 16px 100px 16px 18px;
    font-family: 'Montserrat', sans-serif;
    font-size: 1.2rem;
    font-weight: 600;
    border: 2px solid var(--border-color);
    border-radius: 12px;
    background: var(--bg-secondary);
    transition: all 0.3s ease;
    color: var(--text-primary);
  }

  .stake-input:focus {
    outline: none;
    border-color: var(--gold);
    box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.1);
  }

  .stake-input::placeholder { color: var(--text-muted); }

  .input-suffix {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .token-badge {
    padding: 4px 8px;
    background: var(--bg-primary);
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .max-btn {
    padding: 6px 12px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.65rem;
    font-weight: 700;
    color: #1A1A1A;
    background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 100%);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    letter-spacing: 1px;
  }

  .max-btn:hover { transform: scale(1.05); }

  .action-btn {
    width: 100%;
    padding: 16px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .action-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    transition: left 0.5s ease;
  }

  .action-btn:hover::before { left: 100%; }

  .action-btn.primary {
    background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 50%, var(--gold-dark) 100%);
    color: #1A1A1A;
    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.35);
  }

  .action-btn.primary:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 35px rgba(212, 175, 55, 0.45);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
  }

  .fee-breakdown {
    margin-top: 20px;
    padding: 18px;
    background: ${isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(212, 175, 55, 0.05)'};
    border: 1px solid rgba(212, 175, 55, 0.2);
    border-radius: 12px;
  }

  .fee-title {
    font-family: 'Cinzel', serif;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 2px;
    margin-bottom: 12px;
    color: var(--gold);
  }

  .fee-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .fee-row span:last-child { font-weight: 600; }

  /* ═══════════════════════════════════════════════════════════════
                        VIDEO SECTION
     ═══════════════════════════════════════════════════════════════ */

  .video-showcase {
    margin-top: 60px;
    text-align: center;
  }

  .video-container {
    max-width: 600px;
    margin: 0 auto;
    border-radius: 24px;
    overflow: hidden;
    box-shadow: var(--shadow-luxury);
    border: 3px solid var(--gold);
    animation: pulse-gold 3s infinite;
  }

  .video-container video {
    width: 100%;
    height: auto;
    display: block;
  }

  .video-label {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    letter-spacing: 3px;
    margin-bottom: 20px;
    color: var(--gold);
  }

  /* Whitepaper Video Background */
  .wp-video-section {
    margin-top: 40px;
    position: relative;
    border-radius: 24px;
    overflow: hidden;
    min-height: 300px;
  }

  .wp-video-bg {
    width: 100%;
    height: 300px;
    object-fit: cover;
    border-radius: 24px;
  }

  .wp-video-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, ${isDark ? 'rgba(13,13,13,0.9)' : 'rgba(255,255,255,0.85)'} 0%, transparent 100%);
    display: flex;
    align-items: flex-end;
    padding: 40px;
    border-radius: 24px;
  }

  .wp-video-text {
    font-family: 'Cinzel', serif;
    font-size: 1.5rem;
    letter-spacing: 4px;
  }

  /* ═══════════════════════════════════════════════════════════════
                        MODAL / POPUP
     ═══════════════════════════════════════════════════════════════ */

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(10px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: backdrop-in 0.3s ease;
  }

  .modal-content {
    background: var(--bg-card);
    border-radius: 28px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    overflow: hidden;
    box-shadow: 0 50px 100px rgba(0, 0, 0, 0.5);
    border: 3px solid var(--gold);
    animation: modal-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  .modal-video {
    width: 100%;
    height: auto;
    display: block;
  }

  .modal-body {
    padding: 30px;
    text-align: center;
  }

  .modal-title {
    font-family: 'Cinzel', serif;
    font-size: 1.5rem;
    font-weight: 800;
    letter-spacing: 3px;
    margin-bottom: 12px;
  }

  .modal-subtitle {
    font-size: 0.9rem;
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  .modal-close-btn {
    width: 100%;
    padding: 16px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.9rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    background: linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 100%);
    color: #1A1A1A;
    transition: all 0.3s ease;
  }

  .modal-close-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(212, 175, 55, 0.4);
  }

  /* ═══════════════════════════════════════════════════════════════
                        BURN STATS SECTION
     ═══════════════════════════════════════════════════════════════ */

  .burn-section {
    background: ${isDark ? 'linear-gradient(180deg, #1A0808 0%, #0D0505 100%)' : 'linear-gradient(180deg, #2D1B10 0%, #1A0A00 100%)'};
    border-radius: 24px;
    padding: 45px;
    color: #FFFFFF;
    position: relative;
    overflow: hidden;
  }

  .burn-section::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse at top left, rgba(255, 87, 34, 0.15) 0%, transparent 50%),
      radial-gradient(ellipse at bottom right, rgba(255, 152, 0, 0.1) 0%, transparent 50%);
    pointer-events: none;
  }

  .burn-header {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 35px;
    position: relative;
    flex-wrap: wrap;
  }

  .burn-icon {
    font-size: 3rem;
    animation: fire-flicker 1s ease-in-out infinite;
  }

  .burn-header-text h2 {
    font-family: 'Cinzel', serif;
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: 4px;
    background: linear-gradient(135deg, #FF9800 0%, #FF5722 50%, #F44336 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 4px;
  }

  .burn-header-text p {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 2px;
  }

  .burn-links {
    display: flex;
    gap: 10px;
    margin-left: auto;
  }

  .burn-link-btn {
    padding: 8px 16px;
    background: rgba(255, 152, 0, 0.2);
    border: 1px solid rgba(255, 152, 0, 0.4);
    border-radius: 20px;
    font-size: 0.7rem;
    font-weight: 600;
    color: #FF9800;
    text-decoration: none;
    transition: all 0.3s ease;
  }

  .burn-link-btn:hover {
    background: rgba(255, 152, 0, 0.3);
    transform: translateY(-2px);
  }

  .burn-main-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 35px;
  }

  @media (max-width: 1000px) { .burn-main-stats { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .burn-main-stats { grid-template-columns: 1fr; } }

  .burn-stat-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 152, 0, 0.25);
    border-radius: 16px;
    padding: 22px;
    text-align: center;
    transition: all 0.3s ease;
  }

  .burn-stat-card:hover {
    background: rgba(255, 152, 0, 0.1);
    border-color: #FF9800;
    transform: translateY(-4px);
  }

  .burn-stat-emoji { font-size: 1.8rem; margin-bottom: 10px; }

  .burn-stat-value {
    font-family: 'Cinzel', serif;
    font-size: 1.5rem;
    font-weight: 800;
    margin-bottom: 4px;
    background: linear-gradient(135deg, #FFE082 0%, #FF9800 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .burn-stat-subvalue {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 6px;
  }

  .burn-stat-label {
    font-size: 0.6rem;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .burn-progress-section { margin-bottom: 35px; position: relative; }

  .burn-progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .burn-progress-title {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    letter-spacing: 2px;
    color: rgba(255, 255, 255, 0.8);
  }

  .burn-progress-percent {
    font-family: 'Cinzel', serif;
    font-size: 1.2rem;
    font-weight: 800;
    color: #FF9800;
  }

  .burn-progress-bar {
    height: 24px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
  }

  .burn-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #FF5722, #FF9800, #FFC107);
    border-radius: 12px;
    transition: width 1s ease;
    position: relative;
  }

  .burn-progress-fill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    animation: shimmer 2s linear infinite;
  }

  .burn-progress-blocks {
    display: flex;
    gap: 2px;
    margin-top: 8px;
  }

  .burn-block {
    flex: 1;
    height: 6px;
    background: rgba(255, 152, 0, 0.3);
    border-radius: 3px;
  }

  .burn-block.filled { background: #FF9800; }

  .dead-wallet-section, .lp-burn-section, .lp-urmom-section { margin-bottom: 35px; position: relative; }

  .dead-wallet-title, .lp-burn-title, .lp-urmom-title {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    letter-spacing: 3px;
    margin-bottom: 18px;
    color: rgba(255, 255, 255, 0.8);
  }

  .dead-wallet-grid { display: grid; gap: 10px; }

  .dead-wallet-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    font-family: monospace;
    font-size: 0.8rem;
  }

  .dead-wallet-address { color: rgba(255, 255, 255, 0.6); }
  .dead-wallet-amount { color: #FF9800; font-weight: 600; }
  .dead-wallet-amount.zero { color: rgba(255, 255, 255, 0.3); }

  .lp-burn-grid, .lp-urmom-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  @media (max-width: 700px) { .lp-burn-grid, .lp-urmom-grid { grid-template-columns: 1fr; } }

  .lp-burn-item {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 152, 0, 0.2);
    border-radius: 12px;
    padding: 16px;
    transition: all 0.3s ease;
  }

  .lp-burn-item:hover {
    background: rgba(255, 152, 0, 0.08);
    border-color: #FF9800;
  }

  .lp-burn-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .lp-burn-name { font-weight: 600; font-size: 0.85rem; }
  .lp-burn-percent { font-family: 'Cinzel', serif; font-weight: 700; color: #FF9800; }

  .lp-burn-bar {
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    overflow: hidden;
  }

  .lp-burn-fill {
    height: 100%;
    background: linear-gradient(90deg, #FF5722, #FF9800);
    border-radius: 4px;
    transition: width 0.5s ease;
  }

  .lp-urmom-grid { grid-template-columns: repeat(3, 1fr); }
  @media (max-width: 900px) { .lp-urmom-grid { grid-template-columns: repeat(2, 1fr); } }

  .lp-urmom-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 152, 0, 0.2);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .lp-urmom-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--card-color);
  }

  .lp-urmom-card:hover {
    background: rgba(255, 152, 0, 0.08);
    transform: translateY(-3px);
  }

  .lp-urmom-pool {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .lp-urmom-tokens {
    font-family: 'Cinzel', serif;
    font-size: 1.3rem;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 4px;
  }

  .lp-urmom-usd { font-size: 0.75rem; color: #FF9800; }

  .burn-address-box {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 152, 0, 0.3);
    border-radius: 14px;
    padding: 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    position: relative;
  }

  .burn-address-info { display: flex; flex-direction: column; gap: 4px; }

  .burn-address-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .burn-address-value {
    font-family: monospace;
    font-size: 0.85rem;
    color: #FF9800;
  }

  .burn-view-btn {
    padding: 10px 20px;
    background: linear-gradient(135deg, #FF9800 0%, #FF5722 100%);
    border: none;
    border-radius: 30px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.7rem;
    font-weight: 700;
    color: #FFFFFF;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .burn-view-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(255, 152, 0, 0.4);
  }

  /* ═══════════════════════════════════════════════════════════════
                        DAO VOTING + OTHER SECTIONS
     ═══════════════════════════════════════════════════════════════ */

  .voting-section {
    background: ${isDark ? 'linear-gradient(180deg, #0A1015 0%, #050A0D 100%)' : 'linear-gradient(180deg, #0D1421 0%, #0A0E14 100%)'};
    border-radius: 24px;
    padding: 45px;
    color: #FFFFFF;
    position: relative;
    overflow: hidden;
  }

  .voting-section::before {
    content: '';
    position: absolute;
    inset: 0;
    background: 
      radial-gradient(ellipse at top, rgba(0, 188, 212, 0.1) 0%, transparent 50%),
      radial-gradient(ellipse at bottom right, rgba(212, 175, 55, 0.05) 0%, transparent 50%);
    pointer-events: none;
  }

  .voting-header {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 35px;
    position: relative;
  }

  .voting-icon {
    font-size: 3rem;
    animation: glow-pulse 2s ease-in-out infinite;
    color: var(--diamond);
  }

  .voting-header-text h2 {
    font-family: 'Cinzel', serif;
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: 4px;
    background: linear-gradient(135deg, var(--diamond) 0%, var(--diamond-dark) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .voting-header-text p {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 2px;
    margin-top: 4px;
  }

  .voting-eligibility {
    background: rgba(0, 188, 212, 0.1);
    border: 1px solid rgba(0, 188, 212, 0.3);
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 35px;
  }

  .eligibility-title {
    font-family: 'Cinzel', serif;
    font-size: 0.85rem;
    letter-spacing: 2px;
    margin-bottom: 12px;
    color: var(--diamond);
  }

  .eligibility-items { display: flex; gap: 24px; flex-wrap: wrap; }

  .eligibility-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .eligibility-check {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
  }

  .eligibility-check.active { background: var(--diamond-dark); color: #FFFFFF; }
  .eligibility-check.inactive { background: rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.4); }

  .voting-options-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
    margin-bottom: 35px;
  }

  @media (max-width: 768px) { .voting-options-grid { grid-template-columns: 1fr; } }

  .voting-option {
    background: rgba(255, 255, 255, 0.03);
    border: 2px solid rgba(0, 188, 212, 0.2);
    border-radius: 16px;
    padding: 22px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  .voting-option:hover {
    background: rgba(0, 188, 212, 0.1);
    border-color: var(--diamond);
  }

  .voting-option.selected {
    background: rgba(0, 188, 212, 0.15);
    border-color: var(--diamond);
    box-shadow: 0 0 30px rgba(0, 188, 212, 0.3);
  }

  .voting-option-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }

  .voting-option-letter {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--diamond) 0%, var(--diamond-dark) 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Cinzel', serif;
    font-weight: 800;
    font-size: 1rem;
    color: #1A1A1A;
  }

  .voting-option-name {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: #FFFFFF;
  }

  .voting-option-desc {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    line-height: 1.5;
  }

  .voting-option-votes {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .votes-bar {
    height: 5px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 5px;
  }

  .votes-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--diamond), var(--diamond-dark));
    border-radius: 3px;
  }

  .votes-count { font-size: 0.7rem; color: var(--diamond); }

  .vote-btn {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, var(--diamond) 0%, var(--diamond-dark) 100%);
    border: none;
    border-radius: 12px;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.85rem;
    font-weight: 700;
    color: #1A1A1A;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 2px;
  }

  .vote-btn:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: var(--glow-diamond);
  }

  .vote-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Links & Whitepaper */
  .links-section { text-align: center; }

  .links-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    max-width: 700px;
    margin: 0 auto 40px;
  }

  @media (max-width: 600px) { .links-grid { grid-template-columns: 1fr; } }

  .link-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 24px;
    text-decoration: none;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .link-card:hover {
    transform: translateY(-4px);
    box-shadow: var(--shadow-luxury);
    border-color: var(--gold);
  }

  .link-icon { font-size: 2.2rem; }
  .link-info { text-align: left; }

  .link-name {
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 1px;
    margin-bottom: 3px;
  }

  .link-url { font-size: 0.7rem; color: var(--gold); }

  .contracts-section {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 28px;
    max-width: 700px;
    margin: 0 auto;
  }

  .contracts-title {
    font-family: 'Cinzel', serif;
    font-size: 1.1rem;
    letter-spacing: 2px;
    margin-bottom: 20px;
    text-align: center;
  }

  .contract-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-color);
    flex-wrap: wrap;
    gap: 8px;
  }

  .contract-row:last-child { border-bottom: none; }

  .contract-label {
    font-weight: 600;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.85rem;
  }

  .contract-address {
    font-family: monospace;
    font-size: 0.75rem;
    color: var(--gold);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .contract-address:hover { text-decoration: underline; }

  /* Whitepaper */
  .whitepaper-section { max-width: 800px; margin: 0 auto; }

  .wp-card {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    padding: 30px;
    margin-bottom: 20px;
  }

  .wp-card-title {
    font-family: 'Cinzel', serif;
    font-size: 1.2rem;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .wp-card-content {
    font-size: 0.9rem;
    line-height: 1.8;
    color: var(--text-secondary);
  }

  .wp-card-content p { margin-bottom: 12px; }
  .wp-card-content ul { margin: 12px 0; padding-left: 22px; }
  .wp-card-content li { margin-bottom: 6px; }

  .wp-highlight {
    background: ${isDark ? 'rgba(212, 175, 55, 0.12)' : 'rgba(212, 175, 55, 0.08)'};
    border-left: 4px solid var(--gold);
    padding: 14px 18px;
    border-radius: 0 10px 10px 0;
    margin: 14px 0;
  }

  .tokenomics-table {
    width: 100%;
    border-collapse: collapse;
    margin: 14px 0;
  }

  .tokenomics-table th,
  .tokenomics-table td {
    padding: 10px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
    font-size: 0.85rem;
  }

  .tokenomics-table th {
    font-family: 'Cinzel', serif;
    font-weight: 600;
    color: var(--gold);
  }

  /* Footer */
  .footer {
    text-align: center;
    padding: 45px 40px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border-color);
  }

  .footer-logo {
    font-family: 'Cinzel', serif;
    font-size: 1.6rem;
    font-weight: 800;
    letter-spacing: 4px;
    margin-bottom: 18px;
  }

  .footer-links {
    display: flex;
    justify-content: center;
    gap: 28px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .footer-link {
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.2s ease;
    letter-spacing: 1px;
  }

  .footer-link:hover { color: var(--gold); }

  .footer-divider {
    width: 160px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--gold), transparent);
    margin: 0 auto 18px;
  }

  .footer-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 0.8rem;
    color: var(--text-muted);
    letter-spacing: 2px;
  }

  /* Toast & Utilities */
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 14px 22px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
    animation: slide-in-up 0.4s ease;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: var(--shadow-luxury);
  }

  .toast.success {
    background: linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%);
    border: 1px solid #81C784;
    color: #2E7D32;
  }

  .toast.error {
    background: linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%);
    border: 1px solid #E57373;
    color: #C62828;
  }

  .toast.info {
    background: linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%);
    border: 1px solid #64B5F6;
    color: #1565C0;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid transparent;
    border-top-color: currentColor;
    border-radius: 50%;
    animation: rotate-slow 0.8s linear infinite;
  }

  .connect-prompt {
    text-align: center;
    padding: 60px 40px;
    background: ${isDark ? 'rgba(212, 175, 55, 0.05)' : 'rgba(212, 175, 55, 0.03)'};
    border-radius: 24px;
    border: 2px dashed var(--gold);
  }

  .connect-prompt-icon {
    font-size: 3rem;
    margin-bottom: 18px;
    animation: float 3s ease-in-out infinite;
  }

  .connect-prompt-text {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.2rem;
    color: var(--text-secondary);
    margin-bottom: 24px;
    letter-spacing: 1px;
  }

  /* Mobile Wallet Modal Styles */
  .wallet-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(8px);
  }

  .wallet-modal-content {
    background: linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%);
    border: 2px solid #D4AF37;
    border-radius: 20px;
    padding: 32px;
    max-width: 420px;
    width: 90%;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(212,175,55,0.2);
  }

  .wallet-modal-title {
    color: #D4AF37;
    font-family: 'Cinzel', serif;
    font-size: 1.5rem;
    text-align: center;
    margin-bottom: 24px;
    letter-spacing: 2px;
  }

  @media (max-width: 768px) {
    .wallet-modal-overlay {
      align-items: flex-start;
      padding-top: 40px;
    }
    .wallet-modal-content {
      max-width: 300px;
      width: 85%;
      padding: 20px;
      border-radius: 16px;
      max-height: 60vh;
    }
    .wallet-modal-title {
      font-size: 1.1rem;
      margin-bottom: 16px;
    }
    .wallet-option-btn {
      padding: 12px 16px !important;
      font-size: 0.85rem !important;
    }
  }
`;

// ═══════════════════════════════════════════════════════════════
//                         UTILITIES
// ═══════════════════════════════════════════════════════════════

const formatNumber = (num, decimals = 2) => {
  if (!num || isNaN(num)) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(num);
};

const formatFullNumber = (num) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(num);
const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';
const formatUSD = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const formatPLS = (value) => formatNumber(value) + ' PLS';

// ═══════════════════════════════════════════════════════════════
//                    COMPONENTS
// ═══════════════════════════════════════════════════════════════

// Intro Video Overlay (plays on site entry)
const IntroVideoOverlay = ({ onComplete, isDark }) => {
  const [hiding, setHiding] = React.useState(false);
  
  const handleSkip = () => {
    setHiding(true);
    setTimeout(onComplete, 500);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.97)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: hiding ? 'modal-out 0.5s ease forwards' : 'backdrop-in 0.5s ease',
    }}>
      <div style={{
        position: 'relative',
        maxWidth: '850px',
        width: '92%',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '3px solid var(--gold)',
        boxShadow: '0 0 80px rgba(212, 175, 55, 0.6), 0 0 120px rgba(212, 175, 55, 0.3)',
      }}>
        <video
          autoPlay
          muted
          playsInline
          onEnded={handleSkip}
          style={{ width: '100%', display: 'block' }}
        >
          <source src={VIDEOS.popup} type="video/quicktime" />
          <source src={VIDEOS.popup.replace('.mov', '.mp4')} type="video/mp4" />
        </video>
        <button
          onClick={handleSkip}
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            background: 'linear-gradient(135deg, var(--gold-light) 0%, var(--gold) 50%, var(--gold-dark) 100%)',
            border: 'none',
            color: '#1A1A1A',
            padding: '14px 32px',
            borderRadius: '50px',
            fontFamily: 'Cinzel, serif',
            fontWeight: '700',
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
          }}
          onMouseEnter={(e) => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 8px 30px rgba(212, 175, 55, 0.6)'; }}
          onMouseLeave={(e) => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.4)'; }}
        >
          Enter Site →
        </button>
      </div>
    </div>
  );
};

// Stake Video Modal (plays when staking)
const StakeVideoModal = ({ onComplete, tierName, isDark }) => {
  React.useEffect(() => {
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.97)',
      zIndex: 99998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'backdrop-in 0.3s ease',
    }} onClick={onComplete}>
      <div style={{
        position: 'relative',
        maxWidth: '850px',
        width: '92%',
        borderRadius: '24px',
        overflow: 'hidden',
        border: '3px solid #4CAF50',
        boxShadow: '0 0 80px rgba(76, 175, 80, 0.6), 0 0 120px rgba(76, 175, 80, 0.3)',
      }}>
        <video autoPlay muted playsInline style={{ width: '100%', display: 'block' }}>
          <source src={VIDEOS.stake} type="video/mp4" />
          <source src={VIDEOS.stake.replace('.mp4', '.mov')} type="video/quicktime" />
        </video>
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.95))',
          padding: '40px 24px 24px',
          textAlign: 'center',
        }}>
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#4CAF50', fontSize: '1.5rem', marginBottom: '6px', letterSpacing: '3px' }}>
            🎉 STAKING {tierName}!
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>Diamond hands activated 💎</p>
          <button
            onClick={onComplete}
            style={{
              marginTop: '16px',
              background: 'linear-gradient(135deg, #66BB6A 0%, #4CAF50 50%, #388E3C 100%)',
              border: 'none',
              color: '#fff',
              padding: '12px 28px',
              borderRadius: '50px',
              fontFamily: 'Cinzel, serif',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              boxShadow: '0 4px 20px rgba(76, 175, 80, 0.4)',
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    </div>
  );
};

// Floating DexScreener Widget (bottom-left corner) - Miniature & Expandable
const DexScreenerWidget = () => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(true); // START MINIMIZED
  const [activeChart, setActiveChart] = React.useState('dtgc');
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  // Detect mobile viewport
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartUrls = {
    dtgc: 'https://dexscreener.com/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7?embed=1&theme=dark&trades=0&info=0',
    urmom: 'https://dexscreener.com/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0?embed=1&theme=dark&trades=0&info=0'
  };

  const directUrls = {
    dtgc: 'https://dexscreener.com/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
    urmom: 'https://dexscreener.com/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0'
  };

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '12px' : '20px',
          left: isMobile ? '12px' : '20px',
          width: isMobile ? '40px' : '50px',
          height: isMobile ? '40px' : '50px',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
          border: '2px solid #D4AF37',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 9998,
          boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Open DexScreener Chart"
      >
        <span style={{ fontSize: isMobile ? '1.1rem' : '1.5rem' }}>📊</span>
      </div>
    );
  }

  // Mobile: smaller sizes, Desktop: normal sizes
  const widgetWidth = isMobile ? (isExpanded ? '90vw' : '160px') : (isExpanded ? '500px' : '280px');
  const widgetHeight = isMobile ? (isExpanded ? '300px' : '120px') : (isExpanded ? '400px' : '220px');

  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? '10px' : '20px',
      left: isMobile ? '10px' : '20px',
      width: widgetWidth,
      height: widgetHeight,
      background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
      border: '2px solid #D4AF37',
      borderRadius: isMobile ? '12px' : '16px',
      overflow: 'hidden',
      zIndex: 9998,
      boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(212,175,55,0.2)',
      transition: 'all 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        background: 'rgba(212,175,55,0.1)',
        borderBottom: '1px solid rgba(212,175,55,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.9rem' }}>📊</span>
          <span style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '0.75rem' }}>LIVE</span>
        </div>
        
        {/* Token Toggle */}
        <div style={{ display: 'flex', gap: '3px' }}>
          <button
            onClick={() => setActiveChart('dtgc')}
            style={{
              padding: '3px 8px',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              background: activeChart === 'dtgc' ? 'linear-gradient(135deg, #D4AF37, #F4D03F)' : 'rgba(255,255,255,0.1)',
              color: activeChart === 'dtgc' ? '#000' : '#888',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            DTGC
          </button>
          <button
            onClick={() => setActiveChart('urmom')}
            style={{
              padding: '3px 8px',
              fontSize: '0.65rem',
              fontWeight: 'bold',
              background: activeChart === 'urmom' ? 'linear-gradient(135deg, #D4AF37, #F4D03F)' : 'rgba(255,255,255,0.1)',
              color: activeChart === 'urmom' ? '#000' : '#888',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            URMOM
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => window.open(directUrls[activeChart], '_blank')}
            style={{
              width: '22px',
              height: '22px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Open in DexScreener"
          >
            ↗
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              width: '22px',
              height: '22px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isExpanded ? 'Shrink' : 'Expand'}
          >
            {isExpanded ? '⊖' : '⊕'}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              width: '22px',
              height: '22px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '4px',
              color: '#888',
              cursor: 'pointer',
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Minimize"
          >
            _
          </button>
        </div>
      </div>

      {/* Chart iframe */}
      <iframe
        src={chartUrls[activeChart]}
        style={{
          width: '100%',
          height: 'calc(100% - 34px)',
          border: 'none',
        }}
        title={`${activeChart.toUpperCase()} DexScreener Chart`}
      />
    </div>
  );
};

// Floating LP Stakes Widget (top-left corner) - Shows staked LP positions
const FloatingLPWidget = ({ account, stakedPositions, livePrices, formatNumber, getCurrencySymbol, convertToCurrency, whiteDiamondNFTs = [] }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  
  // Remember last valid positions to prevent flicker during RPC delays
  const lastValidPositions = React.useRef([]);
  
  React.useEffect(() => {
    // Only update ref if we have actual positions
    if (stakedPositions && stakedPositions.length > 0) {
      lastValidPositions.current = stakedPositions;
    }
  }, [stakedPositions]);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use current positions if available, otherwise use last known good positions
  const displayPositions = (stakedPositions && stakedPositions.length > 0) 
    ? stakedPositions 
    : lastValidPositions.current;
  
  // Only hide if no account OR we've never had positions
  if (!account || (displayPositions.length === 0 && lastValidPositions.current.length === 0)) return null;

  // Categorize stakes by tier
  const diamondLP = displayPositions.filter(p => p.isLP && p.lpType !== 1 && p.tierName !== 'FLEX');
  const diamondPlusLP = displayPositions.filter(p => p.isLP && p.lpType === 1 && p.tierName !== 'FLEX');
  const flexStakes = displayPositions.filter(p => p.isFlex || p.tierName === 'FLEX');
  const dtgcStakes = displayPositions.filter(p => !p.isLP && !p.isFlex && p.tierName !== 'FLEX');
  
  // Further categorize DTGC stakes by tier name
  const silverStakes = dtgcStakes.filter(p => p.tierName === 'SILVER' || p.tier === 0);
  const goldStakes = dtgcStakes.filter(p => p.tierName === 'GOLD' || p.tier === 1);
  const whaleStakes = dtgcStakes.filter(p => p.tierName === 'WHALE' || p.tier === 2);
  
  // White Diamond NFT stakes (tracked separately)
  const totalWhiteDiamondLP = whiteDiamondNFTs.reduce((sum, nft) => sum + (parseFloat(nft.amount) || 0), 0);
  
  const totalDiamondLP = diamondLP.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalDiamondPlusLP = diamondPlusLP.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalFlexLP = flexStakes.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalDTGCStaked = dtgcStakes.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSilver = silverStakes.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalGold = goldStakes.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalWhale = whaleStakes.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // Calculate USD values
  const dtgcPrice = livePrices?.dtgc || 0;
  const plsPrice = livePrices?.pls || 0;
  const diamondLPValue = totalDiamondLP * dtgcPrice * 2;
  const diamondPlusLPValue = totalDiamondPlusLP * dtgcPrice * 2;
  const flexLPValue = totalFlexLP * dtgcPrice * 2;
  const whiteDiamondLPValue = totalWhiteDiamondLP * dtgcPrice * 2;
  const dtgcValueUsd = totalDTGCStaked * dtgcPrice;
  const totalValueUsd = diamondLPValue + diamondPlusLPValue + flexLPValue + whiteDiamondLPValue + dtgcValueUsd;
  const totalValuePls = plsPrice > 0 ? (totalValueUsd / plsPrice) : 0;

  // Minimized view - just show icon with total value
  if (!isExpanded) {
    const totalStakes = displayPositions.length + whiteDiamondNFTs.length;
    const hasWhiteDiamond = whiteDiamondNFTs.length > 0;
    const hasDiamondPlus = totalDiamondPlusLP > 0;
    const hasDiamond = totalDiamondLP > 0;
    const hasFlex = totalFlexLP > 0;
    const hasSilver = totalSilver > 0;
    const hasGold = totalGold > 0;
    const hasWhale = totalWhale > 0;
    const hasDTGC = totalDTGCStaked > 0;
    
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'fixed',
          top: isMobile ? '70px' : '80px',
          left: isMobile ? '10px' : '20px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.95) 0%, rgba(184,150,12,0.95) 100%)',
          borderRadius: '12px',
          padding: isMobile ? '6px 10px' : '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          zIndex: 9997,
          boxShadow: hasWhiteDiamond 
            ? '0 4px 15px rgba(0,0,0,0.3), 0 0 25px rgba(255,255,255,0.4)'
            : '0 4px 15px rgba(0,0,0,0.3), 0 0 20px rgba(212,175,55,0.3)',
          border: hasWhiteDiamond ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.2)',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Stake type icons - show all active tiers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1px', flexWrap: 'wrap', maxWidth: '80px' }}>
          {/* White Diamond NFTs - crossed swords */}
          {hasWhiteDiamond && whiteDiamondNFTs.slice(0, 2).map((_, i) => (
            <span key={`wd-${i}`} style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }}>⚔️</span>
          ))}
          {whiteDiamondNFTs.length > 2 && <span style={{ fontSize: '0.45rem', color: '#000' }}>+{whiteDiamondNFTs.length - 2}</span>}
          {/* Diamond+ - purple heart */}
          {hasDiamondPlus && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="Diamond+">💜</span>}
          {/* Diamond - blue diamond */}
          {hasDiamond && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="Diamond">💎</span>}
          {/* Whale */}
          {hasWhale && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="Whale">🐋</span>}
          {/* Gold */}
          {hasGold && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="Gold">🥇</span>}
          {/* Silver */}
          {hasSilver && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="Silver">🥈</span>}
          {/* Flex - pink heart */}
          {hasFlex && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="Flex">💗</span>}
          {/* DTGC (if not categorized into tiers) */}
          {hasDTGC && !hasSilver && !hasGold && !hasWhale && <span style={{ fontSize: isMobile ? '0.6rem' : '0.7rem' }} title="DTGC">🪙</span>}
          {/* Fallback if none */}
          {!hasWhiteDiamond && !hasDiamondPlus && !hasDiamond && !hasFlex && !hasDTGC && (
            <span style={{ fontSize: isMobile ? '0.8rem' : '0.9rem' }}>💎</span>
          )}
        </div>
        <div>
          <div style={{ color: '#000', fontWeight: 700, fontSize: isMobile ? '0.65rem' : '0.75rem' }}>
            {getCurrencySymbol()}{formatNumber(convertToCurrency(totalValueUsd).value)}
          </div>
          <div style={{ color: 'rgba(0,0,0,0.6)', fontSize: '0.45rem', fontWeight: 600 }}>
            {totalStakes} STAKE{totalStakes !== 1 ? 'S' : ''}
          </div>
        </div>
      </div>
    );
  }

  // Expanded view - show breakdown by tier
  return (
    <div style={{
      position: 'fixed',
      top: isMobile ? '70px' : '80px',
      left: isMobile ? '10px' : '20px',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
      borderRadius: '12px',
      padding: '12px',
      minWidth: isMobile ? '165px' : '185px',
      zIndex: 9997,
      boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 20px rgba(212,175,55,0.2)',
      border: '2px solid #D4AF37',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '0.75rem' }}>💎 MY STAKES</span>
        <button
          onClick={() => setIsExpanded(false)}
          style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 6px' }}
        >✕</button>
      </div>
      
      {/* Diamond LP (DTGC/PLS) */}
      {totalDiamondLP > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(0,188,212,0.15)', borderRadius: '6px', border: '1px solid rgba(0,188,212,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#00BCD4', fontSize: '0.65rem', fontWeight: 600 }}>💎 Diamond</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalDiamondLP)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>DTGC/PLS LP</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(diamondLPValue).value)}</span>
          </div>
        </div>
      )}
      
      {/* Diamond+ LP (DTGC/URMOM) */}
      {totalDiamondPlusLP > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(156,39,176,0.15)', borderRadius: '6px', border: '1px solid rgba(156,39,176,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#CE93D8', fontSize: '0.65rem', fontWeight: 600 }}>💜💎 Diamond+</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalDiamondPlusLP)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>DTGC/URMOM LP</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(diamondPlusLPValue).value)}</span>
          </div>
        </div>
      )}
      
      {/* FLEX LP */}
      {totalFlexLP > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(255,20,147,0.15)', borderRadius: '6px', border: '1px solid rgba(255,20,147,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#FF69B4', fontSize: '0.65rem', fontWeight: 600 }}>💗 FLEX</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalFlexLP)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>No Lock LP</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(flexLPValue).value)}</span>
          </div>
        </div>
      )}
      
      {/* White Diamond NFTs */}
      {totalWhiteDiamondLP > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(212,175,55,0.15)', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#D4AF37', fontSize: '0.65rem', fontWeight: 600 }}>⚔️ White Diamond</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalWhiteDiamondLP)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>{whiteDiamondNFTs.length} NFT{whiteDiamondNFTs.length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(whiteDiamondLPValue).value)}</span>
          </div>
        </div>
      )}
      
      {/* Whale Stakes */}
      {totalWhale > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(33,150,243,0.15)', borderRadius: '6px', border: '1px solid rgba(33,150,243,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#2196F3', fontSize: '0.65rem', fontWeight: 600 }}>🐋 Whale</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalWhale)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>{whaleStakes.length} stake{whaleStakes.length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(totalWhale * dtgcPrice).value)}</span>
          </div>
        </div>
      )}
      
      {/* Gold Stakes */}
      {totalGold > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(255,215,0,0.15)', borderRadius: '6px', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#FFD700', fontSize: '0.65rem', fontWeight: 600 }}>🥇 Gold</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalGold)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>{goldStakes.length} stake{goldStakes.length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(totalGold * dtgcPrice).value)}</span>
          </div>
        </div>
      )}
      
      {/* Silver Stakes */}
      {totalSilver > 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(192,192,192,0.15)', borderRadius: '6px', border: '1px solid rgba(192,192,192,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#C0C0C0', fontSize: '0.65rem', fontWeight: 600 }}>🥈 Silver</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalSilver)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>{silverStakes.length} stake{silverStakes.length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(totalSilver * dtgcPrice).value)}</span>
          </div>
        </div>
      )}
      
      {/* Legacy DTGC Stakes (uncategorized) */}
      {totalDTGCStaked > 0 && totalSilver === 0 && totalGold === 0 && totalWhale === 0 && (
        <div style={{ marginBottom: '6px', padding: '6px 8px', background: 'rgba(255,215,0,0.1)', borderRadius: '6px', border: '1px solid rgba(255,215,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#FFD700', fontSize: '0.65rem', fontWeight: 600 }}>🪙 DTGC</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>{formatNumber(totalDTGCStaked)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#666', fontSize: '0.5rem' }}>{dtgcStakes.length} stake{dtgcStakes.length !== 1 ? 's' : ''}</span>
            <span style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{getCurrencySymbol()}{formatNumber(convertToCurrency(dtgcValueUsd).value)}</span>
          </div>
        </div>
      )}
      
      {/* Total */}
      <div style={{ borderTop: '1px solid rgba(212,175,55,0.3)', paddingTop: '8px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#D4AF37', fontSize: '0.7rem', fontWeight: 700 }}>TOTAL</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#4CAF50', fontSize: '0.85rem', fontWeight: 800 }}>
              {getCurrencySymbol()}{formatNumber(convertToCurrency(totalValueUsd).value)}
            </div>
            <div style={{ color: '#9C27B0', fontSize: '0.55rem' }}>
              ≈ {formatNumber(totalValuePls, 0)} PLS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Particles = () => {
  const particles = useMemo(() => 
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 20,
      duration: 18 + Math.random() * 20,
      size: 2 + Math.random() * 4,
    })), []
  );

  return (
    <div className="particles-container">
      {particles.map(p => (
        <div key={p.id} className="particle" style={{
          left: `${p.left}%`,
          width: p.size,
          height: p.size,
          animationDelay: `${p.delay}s`,
          animationDuration: `${p.duration}s`,
        }} />
      ))}
    </div>
  );
};

const MarbleBackground = () => (
  <>
    <div className="marble-bg" />
    <div className="marble-veins">
      <div className="vein vein-1" />
      <div className="vein vein-2" />
      <div className="vein vein-3" />
      <div className="vein vein-4" />
      <div className="vein vein-5" />
    </div>
  </>
);

// Stake Confirmation Modal
const StakeModal = ({ isOpen, onClose, type, amount, tier }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {VIDEOS_ENABLED && (
        <video className="modal-video" autoPlay loop playsInline>
          <source src={VIDEOS.popup} type="video/quicktime" />
          <source src={VIDEOS.popup.replace('.mov', '.mp4')} type="video/mp4" />
        </video>
        )}
        <div className="modal-body">
          <h3 className="modal-title gold-text">
            {type === 'start' ? '🎉 STAKE INITIATED!' : '✅ STAKE COMPLETE!'}
          </h3>
          <p className="modal-subtitle">
            {type === 'start' 
              ? `Staking ${amount} tokens in ${tier} tier...`
              : `Successfully staked ${amount} tokens!`
            }
          </p>
          <button className="modal-close-btn" onClick={onClose}>
            {type === 'start' ? 'Confirm' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
//                         MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function App() {
  // ═══════════════════════════════════════════════════════════════
  // SAAS CONFIG - White-label customization
  // ═══════════════════════════════════════════════════════════════
  const saasConfig = useSaaSConfig();
  const branding = useBranding();
  const configTiers = useTiers();
  const configContracts = useContracts();
  const features = useFeatures();
  
  // Use config values (with fallbacks for safety)
  const PLATFORM_NAME = branding?.name || 'DTGC';
  const PRIMARY_COLOR = branding?.colors?.primary || '#FFD700';
  
  // Password gate state (mainnet only)
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== 'undefined' && PASSWORD_ENABLED) {
      return sessionStorage.getItem('dtgc-mainnet-auth') === 'true';
    }
    return !PASSWORD_ENABLED;
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [accessLogs, setAccessLogs] = useState([]);

  // IP Logging Function
  const logAccessAttempt = async (success, attemptedPassword = '') => {
    if (!LOG_ACCESS_ATTEMPTS) return;
    
    try {
      // Get visitor IP
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        ip: ipData.ip,
        userAgent: navigator.userAgent,
        success: success,
        attemptedPassword: success ? '[REDACTED]' : attemptedPassword.substring(0, 3) + '***',
        screenSize: `${window.screen.width}x${window.screen.height}`,
        language: navigator.language,
        platform: navigator.platform,
        referrer: document.referrer || 'direct',
      };
      
      // Store in localStorage for admin review
      const existingLogs = JSON.parse(localStorage.getItem('dtgc-access-logs') || '[]');
      existingLogs.push(logEntry);
      // Keep last 100 entries
      if (existingLogs.length > 100) existingLogs.shift();
      localStorage.setItem('dtgc-access-logs', JSON.stringify(existingLogs));
      
      // Console log for monitoring
      console.log(`🔒 Access ${success ? '✅ GRANTED' : '❌ DENIED'} | IP: ${ipData.ip} | ${new Date().toLocaleString()}`);
      
      // Optional: Send to external logging service (webhook)
      // Uncomment and add your webhook URL to enable:
      /*
      await fetch('YOUR_WEBHOOK_URL', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry),
      });
      */
      
    } catch (err) {
      console.warn('⚠️ Failed to log access attempt:', err.message);
    }
  };

  // Log page visit on mount (even before password attempt)
  useEffect(() => {
    if (PASSWORD_ENABLED && !isAuthenticated && LOG_ACCESS_ATTEMPTS) {
      const logPageVisit = async () => {
        try {
          const ipResponse = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipResponse.json();
          console.log(`👁️ Page Visit | IP: ${ipData.ip} | ${new Date().toLocaleString()}`);
        } catch (err) {
          // Silent fail
        }
      };
      logPageVisit();
    }
  }, []);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === SITE_PASSWORD) {
      logAccessAttempt(true);
      setIsAuthenticated(true);
      sessionStorage.setItem('dtgc-mainnet-auth', 'true');
      setPasswordError(false);
      // Scroll to top after authentication
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    } else {
      logAccessAttempt(false, passwordInput);
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dtgc-theme');
      // Default to dark mode if no preference saved
      return saved !== 'light';
    }
    return true; // Default to dark mode
  });

  // Admin Access Logs Panel (Ctrl+Shift+L to toggle)
  const [showAdminLogs, setShowAdminLogs] = useState(false);
  const [adminLogs, setAdminLogs] = useState([]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+L to toggle admin logs panel
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        const logs = JSON.parse(localStorage.getItem('dtgc-access-logs') || '[]');
        setAdminLogs(logs.reverse()); // Most recent first
        setShowAdminLogs(prev => !prev);
      }
      // Ctrl+Shift+C to clear logs
      if (e.ctrlKey && e.shiftKey && e.key === 'C' && showAdminLogs) {
        e.preventDefault();
        localStorage.removeItem('dtgc-access-logs');
        setAdminLogs([]);
        console.log('🗑️ Access logs cleared');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminLogs]);

  // Intro video overlay (shows once per session)
  const [showIntro, setShowIntro] = useState(false); // Intro video disabled

  const handleIntroComplete = () => {
    setShowIntro(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('dtgc-intro-seen', 'true');
    }
  };

  // Force proper rendering after authentication
  useEffect(() => {
    if (isAuthenticated) {
      // Force scroll to top and trigger re-paint
      window.scrollTo(0, 0);
      document.body.style.overflow = 'auto';
      document.body.style.visibility = 'visible';
      document.documentElement.style.overflow = 'auto';

      // Force layout recalculation
      const forceRepaint = () => {
        void document.body.offsetHeight; // Trigger reflow
      };
      requestAnimationFrame(forceRepaint);
    }
  }, [isAuthenticated]);

  // Stake video modal
  const [showStakeVideo, setShowStakeVideo] = useState(false);
  const [stakingTierName, setStakingTierName] = useState('');

  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  
  // URL-based tab routing - supports /saas, /stake, /burn, /vote, /whitepaper, /links, /analytics
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase().replace(/^\//, '').replace(/\/$/, '');
      const hash = window.location.hash.toLowerCase().replace('#', '');
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      
      const validTabs = ['stake', 'burn', 'vote', 'whitepaper', 'links', 'analytics', 'saas'];
      
      // Check URL param first: ?tab=saas
      if (tabParam && validTabs.includes(tabParam)) return tabParam;
      // Check path: /saas
      if (path && validTabs.includes(path)) return path;
      // Check hash: #saas
      if (hash && validTabs.includes(hash)) return hash;
    }
    return 'stake';
  });
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPricesDropdown, setShowPricesDropdown] = useState(false);

  // Testnet balances (stored in localStorage for persistence)
  const [testnetBalances, setTestnetBalances] = useState(() => {
    if (TESTNET_MODE && typeof window !== 'undefined') {
      const saved = localStorage.getItem('dtgc-testnet-balances');
      if (saved) return JSON.parse(saved);
    }
    return null;
  });

  const [dtgcBalance, setDtgcBalance] = useState('0');
  const [lpBalance, setLpBalance] = useState('0');
  const [lpDtgcPlsBalance, setLpDtgcPlsBalance] = useState('0');   // Diamond tier LP
  const [lpDtgcUrmomBalance, setLpDtgcUrmomBalance] = useState('0'); // Diamond+ tier LP
  const [plsBalance, setPlsBalance] = useState('0');
  const [urmomBalance, setUrmomBalance] = useState('0');
  const [selectedTier, setSelectedTier] = useState(null);
  const [stakeAmount, setStakeAmount] = useState('');
  const [stakeInputMode, setStakeInputMode] = useState('tokens'); // 'tokens' or 'currency'
  const [isLP, setIsLP] = useState(false);
  // Flex Tier State - Wallet Scanner Multi-Token Selector
  const [isFlexTier, setIsFlexTier] = useState(false);
  const [selectedFlexTokens, setSelectedFlexTokens] = useState({});
  const [flexLoading, setFlexLoading] = useState(false);
  const [flexOutputMode, setFlexOutputMode] = useState('stake'); // 'stake' or 'wallet'
  const [flexStakePercent, setFlexStakePercent] = useState(100);
  const [flexFilter, setFlexFilter] = useState('');
  const [walletTokens, setWalletTokens] = useState([]); // Scanned tokens from wallet
  const [scanningWallet, setScanningWallet] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [flexSuccess, setFlexSuccess] = useState(null); // {lpAmount, plsReturned, totalValue}
  const [flexConversionReceipt, setFlexConversionReceipt] = useState(null); // {converted: [], failed: []}
  const [showFlexCalculator, setShowFlexCalculator] = useState(false);
  const [flexStakes, setFlexStakes] = useState([]); // Track Flex stakes
  const [flexHistory, setFlexHistory] = useState([]); // Track completed Flex stakes for Treasury
  const [whiteDiamondNFTs, setWhiteDiamondNFTs] = useState([]); // White Diamond NFT stakes
  const DAPPER_ADDRESS = "0xc7fe28708ba913d6bdf1e7eac2c75f2158d978de";
  const DAPPER_ABI = ["function zapPLS() external payable", "function zapToken(address token, uint256 amount) external"];
  
  // Pump.tires V1 Bonding Curve Contract
  const PUMP_TIRES_ADDRESS = "0x6538A83a81d855B965983161AF6a83e616D16fD5";
  const PUMP_TIRES_ABI = [
    "function sellToken(address tokenAddress, uint256 tokenAmount, uint256 minAmountOut) external",
    "function buyTokenExactIn(address tokenAddress, uint256 minAmountOut) external payable"
  ];
  
  // Known tokens (always show these + any found in wallet)
  const KNOWN_TOKENS = [
    { symbol: 'PLS', name: 'PulseChain', address: null, decimals: 18, icon: '💜', color: '#E1BEE7' },
    { symbol: 'WPLS', name: 'Wrapped PLS', address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', decimals: 18, icon: '💜', color: '#E1BEE7' },
    { symbol: 'DTGC', name: 'DT Gold Coin', address: '0xd0676b28a457371d58d47e5247b439114e40eb0f', decimals: 18, icon: '🪙', color: '#FFD700' },
    { symbol: 'URMOM', name: 'URMOM', address: '0x636cc7d7c76298cde00025370461c59c0b2ef896', decimals: 18, icon: '🔥', color: '#FF9800' },
    { symbol: 'PLSX', name: 'PulseX', address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', decimals: 18, icon: '🔷', color: '#00BCD4' },
    { symbol: 'HEX', name: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', decimals: 8, icon: '⬡', color: '#FF00FF' },
    { symbol: 'INC', name: 'Incentive', address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', decimals: 18, icon: '💎', color: '#9C27B0' },
    { symbol: 'DAI', name: 'Dai from ETH', address: '0xefd766ccb38eaf1dfd701853bfce31359239f305', decimals: 18, icon: '📀', color: '#F5AC37' },
    { symbol: 'USDC', name: 'USDC from ETH', address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', decimals: 6, icon: '💵', color: '#2775CA' },
    { symbol: 'USDT', name: 'USDT from ETH', address: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', decimals: 6, icon: '💵', color: '#26A17B' },
    { symbol: 'WETH', name: 'WETH from ETH', address: '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c', decimals: 18, icon: '🔹', color: '#627EEA' },
    { symbol: 'WBTC', name: 'WBTC from ETH', address: '0xb17d901469b9208b17d916112988a3fed19b5ca1', decimals: 8, icon: '🟠', color: '#F7931A' },
  ];
  
  // Tokens that are ALWAYS liquid - override any DEX check failures
  const LIQUID_TOKENS = new Set([
    'URMOM', 'DTGC', 'PLS', 'WPLS', 'PLSX', 'HEX', 'INC', 'DAI', 'USDC', 'USDT', 'WETH', 'WBTC',
    '0x636cc7d7c76298cde00025370461c59c0b2ef896', // URMOM
    '0xd0676b28a457371d58d47e5247b439114e40eb0f', // DTGC
    '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab', // PLSX
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', // HEX
  ]);

  // Live prices - must be defined before functions that use it
  const [livePrices, setLivePrices] = useState({
    urmom: 0.0000001,
    dtgc: 0.0002,
    pls: 0.00003,
    plsx: 0.00008,
    hex: 0.005,
    inc: 0.0001,
    dtgcMarketCap: 0,
    lastUpdated: null,
    loading: true,
    error: null,
  });

  
  // WPLS address for price lookups
  const WPLS_ADDRESS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';
  const PULSEX_FACTORY = '0x1715a3E4A142d8b698131108995174F37aEBA10D';
  const PUMP_TIRES_FACTORY = '0x'; // pump.tires factory if available
  
  // Get token price from DEX liquidity
  const getTokenPriceFromDex = async (tokenAddress, decimals) => {
    if (!provider || !tokenAddress) return 0;
    try {
      // Try to find WPLS pair and calculate price
      const pairAbi = [
        'function getReserves() view returns (uint112, uint112, uint32)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
      ];
      
      // Calculate pair address (PulseX V2 style)
      const factoryAbi = ['function getPair(address, address) view returns (address)'];
      const factory = new ethers.Contract(PULSEX_FACTORY, factoryAbi, provider);
      const pairAddress = await factory.getPair(tokenAddress, WPLS_ADDRESS);
      
      if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
        const pair = new ethers.Contract(pairAddress, pairAbi, provider);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0 = await pair.token0();
        
        const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
        const tokenReserve = isToken0 ? reserve0 : reserve1;
        const wplsReserve = isToken0 ? reserve1 : reserve0;
        
        if (tokenReserve > 0n) {
          const plsPrice = livePrices.pls || 0.00003;
          const wplsAmount = parseFloat(ethers.formatEther(wplsReserve));
          const tokenAmount = parseFloat(ethers.formatUnits(tokenReserve, decimals));
          const priceInPls = wplsAmount / tokenAmount;
          return priceInPls * plsPrice;
        }
      }
    } catch (e) {
      // Pair doesn't exist or error
    }
    return 0;
  };
  
  // Scan wallet for ALL tokens - AGGRESSIVE SCANNER
  const scanWalletTokens = useCallback(async () => {
    if (!account || !provider) return;
    
    setScanningWallet(true);
    showToast('🔍 Fast scanning wallet...', 'info');
    
    try {
      const foundTokens = [];
      const seenAddresses = new Set();
      const addr = account.toLowerCase();
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: Get PLS balance (instant)
      // ═══════════════════════════════════════════════════════════════
      const plsBal = await provider.getBalance(account);
      const plsBalFormatted = ethers.formatEther(plsBal);
      if (parseFloat(plsBalFormatted) > 0) {
        foundTokens.push({
          symbol: 'PLS',
          name: 'PulseChain',
          address: null,
          decimals: 18,
          balance: plsBalFormatted,
          icon: '💜',
          color: '#E1BEE7',
          valueUsd: parseFloat(plsBalFormatted) * (livePrices.pls || 0.00003),
          hasLiquidity: true,
          isNative: true,
        });
        seenAddresses.add('native');
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: PARALLEL fetch from multiple sources (V4 GOLD SUITE SPEED)
      // ═══════════════════════════════════════════════════════════════
      const [pulseScanV2, pulseScanV1, knownTokenBalances] = await Promise.all([
        // PulseScan API v2 (primary)
        fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${addr}/token-balances`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => []),
        // PulseScan API v1 (backup - catches tokens v2 misses)
        fetch(`https://api.scan.pulsechain.com/api?module=account&action=tokenlist&address=${addr}`)
          .then(r => r.ok ? r.json() : { result: [] })
          .then(d => d.result || [])
          .catch(() => []),
        // Direct RPC for known tokens (fastest, most reliable)
        Promise.all(KNOWN_TOKENS.filter(t => t.address).map(async (token) => {
          try {
            const contract = new ethers.Contract(token.address, ['function balanceOf(address) view returns (uint256)'], provider);
            const bal = await contract.balanceOf(account);
            if (bal > 0n) {
              const balFormatted = ethers.formatUnits(bal, token.decimals);
              return { ...token, balance: balFormatted };
            }
          } catch {}
          return null;
        }))
      ]);
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: Process known tokens first (highest priority)
      // ═══════════════════════════════════════════════════════════════
      for (const token of knownTokenBalances.filter(Boolean)) {
        const tokenAddr = token.address?.toLowerCase();
        if (tokenAddr && !seenAddresses.has(tokenAddr)) {
          seenAddresses.add(tokenAddr);
          
          let price = 0;
          if (token.symbol === 'DTGC') price = livePrices.dtgc || 0;
          else if (token.symbol === 'URMOM') price = livePrices.urmom || 0;
          else if (token.symbol === 'PLSX') price = livePrices.plsx || 0;
          else if (token.symbol === 'HEX') price = livePrices.hex || 0;
          else if (token.symbol === 'WPLS') price = livePrices.pls || 0.00003;
          else if (['USDC', 'USDT', 'DAI'].includes(token.symbol)) price = 1;
          else if (token.symbol === 'WETH') price = 3500;
          else if (token.symbol === 'WBTC') price = 100000;
          else if (token.symbol === 'INC') price = livePrices.inc || 0.0001;
          
          foundTokens.push({
            ...token,
            valueUsd: parseFloat(token.balance) * price,
            price: price,
            hasLiquidity: true,
            icon: token.icon || '💰',
            color: '#4CAF50',
          });
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 4: Process PulseScan V2 results
      // ═══════════════════════════════════════════════════════════════
      if (Array.isArray(pulseScanV2)) {
        for (const item of pulseScanV2) {
          const tokenAddr = item.token?.address?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);
          
          const decimals = parseInt(item.token?.decimals) || 18;
          const bal = parseFloat(item.value || '0') / Math.pow(10, decimals);
          if (bal <= 0.000001) continue;
          
          const tokenSymbol = (item.token?.symbol || '').toUpperCase();
          const isKnownLiquid = LIQUID_TOKENS.has(tokenSymbol) || LIQUID_TOKENS.has(tokenAddr);
          
          // Quick price lookup for known tokens
          let price = 0;
          if (tokenSymbol === 'DTGC') price = livePrices.dtgc || 0;
          else if (tokenSymbol === 'URMOM') price = livePrices.urmom || 0;
          else if (tokenSymbol === 'PLSX') price = livePrices.plsx || 0;
          else if (tokenSymbol === 'HEX') price = livePrices.hex || 0;
          else if (tokenSymbol === 'WPLS') price = livePrices.pls || 0.00003;
          
          foundTokens.push({
            symbol: item.token?.symbol || 'UNKNOWN',
            name: item.token?.name || 'Unknown Token',
            address: item.token?.address,
            decimals: decimals,
            balance: bal.toString(),
            icon: isKnownLiquid || price > 0 ? '💰' : '🔸',
            color: isKnownLiquid || price > 0 ? '#4CAF50' : '#888',
            valueUsd: bal * price,
            price: price,
            hasLiquidity: isKnownLiquid || price > 0,
            v1PlsAvailable: 0,
            dustCleanStatus: 'unknown',
          });
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 5: Process PulseScan V1 results (catches missed tokens)
      // ═══════════════════════════════════════════════════════════════
      if (Array.isArray(pulseScanV1)) {
        for (const item of pulseScanV1) {
          const tokenAddr = item.contractAddress?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);
          
          const decimals = parseInt(item.decimals) || 18;
          const bal = parseFloat(item.balance || '0') / Math.pow(10, decimals);
          if (bal <= 0.000001) continue;
          
          const tokenSymbol = (item.symbol || '').toUpperCase();
          const isKnownLiquid = LIQUID_TOKENS.has(tokenSymbol) || LIQUID_TOKENS.has(tokenAddr);
          
          foundTokens.push({
            symbol: item.symbol || 'UNKNOWN',
            name: item.name || 'Unknown Token',
            address: item.contractAddress,
            decimals: decimals,
            balance: bal.toString(),
            icon: isKnownLiquid ? '💰' : '🔸',
            color: isKnownLiquid ? '#4CAF50' : '#888',
            valueUsd: 0,
            price: 0,
            hasLiquidity: isKnownLiquid,
            v1PlsAvailable: 0,
            dustCleanStatus: 'unknown',
          });
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 6: Batch price lookup via DexScreener (background, non-blocking)
      // ═══════════════════════════════════════════════════════════════
      const tokensNeedingPrices = foundTokens.filter(t => t.address && t.price === 0 && parseFloat(t.balance) > 0);
      if (tokensNeedingPrices.length > 0) {
        // Process in batches of 30 (DexScreener limit)
        const batches = [];
        for (let i = 0; i < tokensNeedingPrices.length; i += 30) {
          batches.push(tokensNeedingPrices.slice(i, i + 30));
        }
        
        await Promise.all(batches.map(async (batch) => {
          try {
            const addresses = batch.map(t => t.address).join(',');
            const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
            if (response.ok) {
              const data = await response.json();
              if (data?.pairs) {
                for (const pair of data.pairs) {
                  const tokenAddr = pair.baseToken?.address?.toLowerCase();
                  const token = foundTokens.find(t => t.address?.toLowerCase() === tokenAddr);
                  if (token && pair.priceUsd) {
                    token.price = parseFloat(pair.priceUsd);
                    token.valueUsd = parseFloat(token.balance) * token.price;
                    token.hasLiquidity = true;
                    token.liquidityUsd = parseFloat(pair.liquidity?.usd || 0);
                    token.icon = '💰';
                    token.color = '#4CAF50';
                    // Mark low liquidity tokens
                    if (token.liquidityUsd < 50) {
                      token.hasLiquidity = false;
                      token.dustCleanStatus = 'low_liq';
                      token.icon = '⚠️';
                      token.color = '#FF9800';
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.log('DexScreener batch lookup:', e.message);
          }
        }));
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 7: Check V1 PLS liquidity for low-liq tokens (for dust clean)
      // ═══════════════════════════════════════════════════════════════
      const lowLiqTokens = foundTokens.filter(t => 
        t.address && 
        !t.isNative && 
        (t.hasLiquidity === false || t.dustCleanStatus === 'low_liq')
      );
      
      if (lowLiqTokens.length > 0) {
        const factoryV1Address = '0x1715a3E4A142d8b698131108995174F37aEBA10D';
        const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27';
        
        try {
          const factoryV1 = new ethers.Contract(
            factoryV1Address,
            ['function getPair(address,address) view returns (address)'],
            provider
          );
          
          // Check V1 pairs in parallel (limit to 15 for speed)
          await Promise.all(lowLiqTokens.slice(0, 15).map(async (token) => {
            try {
              const pairAddress = await factoryV1.getPair(token.address, WPLS);
              if (pairAddress && pairAddress !== ethers.ZeroAddress) {
                const pair = new ethers.Contract(pairAddress, [
                  'function getReserves() view returns (uint112,uint112,uint32)',
                  'function token0() view returns (address)',
                ], provider);
                
                const [reserves, token0] = await Promise.all([
                  pair.getReserves(),
                  pair.token0(),
                ]);
                
                const isToken0 = token0.toLowerCase() === token.address.toLowerCase();
                const plsReserve = isToken0 ? reserves[1] : reserves[0];
                const plsAmount = parseFloat(ethers.formatEther(plsReserve));
                
                if (plsAmount > 0) {
                  token.v1PlsAvailable = plsAmount;
                  token.liquiditySource = 'v1';
                  token.hasLiquidity = plsAmount > 100;
                  token.dustCleanStatus = plsAmount > 100 ? 'v1_available' : 'very_low_liq';
                  if (plsAmount > 100) {
                    token.icon = '🔄';
                    token.color = '#2196F3';
                  }
                }
              }
            } catch {}
          }));
        } catch (e) {
          console.log('V1 liquidity check error:', e.message);
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 8: Sort by value and liquidity
      // ═══════════════════════════════════════════════════════════════
      foundTokens.sort((a, b) => {
        // Tokens with liquidity first
        if (a.hasLiquidity && !b.hasLiquidity) return -1;
        if (!a.hasLiquidity && b.hasLiquidity) return 1;
        // Then by USD value
        if ((b.valueUsd || 0) !== (a.valueUsd || 0)) return (b.valueUsd || 0) - (a.valueUsd || 0);
        // Then by raw balance
        return parseFloat(b.balance || 0) - parseFloat(a.balance || 0);
      });
      
      setWalletTokens(foundTokens);
      setLastScanTime(Date.now());
      
      const withValue = foundTokens.filter(t => t.valueUsd > 0).length;
      const withV1 = foundTokens.filter(t => t.v1PlsAvailable > 0).length;
      const totalValue = foundTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);
      
      showToast(`✅ Found ${foundTokens.length} tokens ($${totalValue.toFixed(2)})${withV1 > 0 ? ` • ${withV1} with V1 liquidity` : ''}`, 'success');
      
    } catch (err) {
      console.error('Wallet scan error:', err);
      showToast('Scan failed: ' + err.message, 'error');
    } finally {
      setScanningWallet(false);
    }
  }, [account, provider, livePrices]);
  
  // Auto-scan when Flex panel opens
  useEffect(() => {
    if (isFlexTier && account && walletTokens.length === 0 && !scanningWallet) {
      scanWalletTokens();
    }
  }, [isFlexTier, account, walletTokens.length, scanningWallet, scanWalletTokens]);
  const [gasSpeed, setGasSpeed] = useState('fast'); // 'normal', 'fast', 'urgent'
  
  // LP Staking Contract Rewards Remaining
  const [stakingRewardsRemaining, setStakingRewardsRemaining] = useState('0');
  const [lpStakingRewardsRemaining, setLpStakingRewardsRemaining] = useState('0');

  // Analytics Calculator State
  const [calcInvestment, setCalcInvestment] = useState('1000');
  const [calcTier, setCalcTier] = useState('gold');
  const [calcBuyPrice, setCalcBuyPrice] = useState('0.0002');
  const [calcExitPrice, setCalcExitPrice] = useState('0.0003');
  const [calcTimeframe, setCalcTimeframe] = useState('12'); // months
  const [calcPriceDrop, setCalcPriceDrop] = useState('50'); // VaR price drop %

  // Dynamic Stake Hedging Forecaster State
  const [forecastInvestment, setForecastInvestment] = useState('10000');
  const [forecastPriceChange, setForecastPriceChange] = useState('0'); // % change
  const [forecastMonths, setForecastMonths] = useState('12');
  const [forecastSilverPct, setForecastSilverPct] = useState('0');
  const [forecastGoldPct, setForecastGoldPct] = useState('25');
  const [forecastWhalePct, setForecastWhalePct] = useState('25');
  const [forecastDiamondPct, setForecastDiamondPct] = useState('25');
  const [forecastDiamondPlusPct, setForecastDiamondPlusPct] = useState('25');
  
  // V4 Multi-Stake Calculator State (up to 6 individual stakes)
  const [multiStakes, setMultiStakes] = useState([
    { id: 1, tier: 'gold', amount: '', lockDays: 90, enabled: true },
  ]);
  
  const addMultiStake = () => {
    if (multiStakes.length < 6) {
      setMultiStakes([...multiStakes, { 
        id: Date.now(), 
        tier: 'gold', 
        amount: '', 
        lockDays: 90, 
        enabled: true 
      }]);
    }
  };
  
  const removeMultiStake = (id) => {
    if (multiStakes.length > 1) {
      setMultiStakes(multiStakes.filter(s => s.id !== id));
    }
  };
  
  const updateMultiStake = (id, field, value) => {
    setMultiStakes(multiStakes.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  // Live crypto prices state
  const [cryptoPrices, setCryptoPrices] = useState({
    btc: 42000,
    eth: 2200,
    pls: 0.00003,
    plsx: 0.00002,
    loading: true,
    lastUpdated: null,
  });

  // Wallet selector modal
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState([]);
  const [selectedWalletType, setSelectedWalletType] = useState(null);
  const [walletStep, setWalletStep] = useState('select'); // 'select' or 'accounts'

  // Currency display preference (units, usd, eur, gbp, jpy)
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dtgc-display-currency') || 'units';
    }
    return 'units';
  });

  // Exchange rates (approximate - USD base)
  const CURRENCY_RATES = {
    EUR: 0.92,
    GBP: 0.79,
    JPY: 149.50,
    SAR: 3.75,    // Saudi Riyal
    CNY: 7.24,    // Chinese Yuan
    CZK: 23.50,   // Czech Koruna
    AUD: 1.55,    // Australian Dollar
    NGN: 1550,    // Nigerian Naira
    COP: 4100,    // Colombian Peso
    CAD: 1.36,    // Canadian Dollar
  };

  // Metal prices state (per troy ounce in USD)
  const [metalPrices, setMetalPrices] = useState({
    gold: 2650.00,
    silver: 31.50,
    copper: 4.25,
    loading: false,
    lastUpdated: null,
  });

  // Fetch live metal prices from free API
  const fetchMetalPrices = useCallback(async () => {
    setMetalPrices(prev => ({ ...prev, loading: true }));
    
    try {
      // Use MetalPriceAPI free tier (or fallback to multiple sources)
      // Primary: Fetch from metals.live (free, no API key needed)
      const response = await fetch('https://api.metals.live/v1/spot');
      const data = await response.json();
      
      // metals.live returns array: [{gold: price}, {silver: price}, {platinum: price}, {palladium: price}]
      // Or object with metal prices
      let goldPrice = 2650, silverPrice = 31.50, copperPrice = 4.25;
      
      if (Array.isArray(data)) {
        // Format: [{gold: 2650.00}, {silver: 31.50}, ...]
        data.forEach(item => {
          if (item.gold) goldPrice = parseFloat(item.gold);
          if (item.silver) silverPrice = parseFloat(item.silver);
          if (item.copper) copperPrice = parseFloat(item.copper);
        });
      } else if (data.gold || data.silver) {
        // Format: {gold: 2650.00, silver: 31.50, ...}
        goldPrice = parseFloat(data.gold) || goldPrice;
        silverPrice = parseFloat(data.silver) || silverPrice;
        copperPrice = parseFloat(data.copper) || copperPrice;
      }
      
      setMetalPrices({
        gold: goldPrice,
        silver: silverPrice,
        copper: copperPrice,
        loading: false,
        lastUpdated: new Date(),
      });
      
      console.log('🥇 Metal prices updated:', { gold: goldPrice, silver: silverPrice, copper: copperPrice });
    } catch (err) {
      console.warn('Primary metals API failed, trying backup...', err.message);
      
      // Backup: Try alternative free API
      try {
        const backupRes = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
        const backupData = await backupRes.json();
        
        // goldprice.org format: {items: [{xauPrice: gold, xagPrice: silver}]}
        if (backupData?.items?.[0]) {
          const item = backupData.items[0];
          setMetalPrices({
            gold: parseFloat(item.xauPrice) || 2650,
            silver: parseFloat(item.xagPrice) || 31.50,
            copper: 4.25, // goldprice.org doesn't have copper
            loading: false,
            lastUpdated: new Date(),
          });
          console.log('🥇 Metal prices updated (backup):', { gold: item.xauPrice, silver: item.xagPrice });
        }
      } catch (backupErr) {
        console.warn('Backup metals API also failed:', backupErr.message);
        setMetalPrices(prev => ({ ...prev, loading: false }));
      }
    }
  }, []);

  // Fetch metal prices on mount and every 5 minutes
  useEffect(() => {
    fetchMetalPrices();
    const interval = setInterval(fetchMetalPrices, 300000); // Refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchMetalPrices]);

  const [position, setPosition] = useState(null);
  const [lpPosition, setLpPosition] = useState(null);
  const [stakedPositions, setStakedPositions] = useState([]);
  const [sidebarKey, setSidebarKey] = useState(0); // Key to force sidebar re-render
  const [positionsLoading, setPositionsLoading] = useState(false); // Track stake fetch state
  
  // Persist last known good positions - survives RPC failures
  const lastKnownPositionsRef = useRef([]);
  const hasEverLoadedPositions = useRef(false); // Track if we ever successfully loaded
  
  // 💗 CONSOLIDATED FLEX CONTROLS
  const [flexClaimPercent, setFlexClaimPercent] = useState(100); // % of rewards to claim
  const [flexUnstakePercent, setFlexUnstakePercent] = useState(100); // % of LP to unstake
  
  // ═══════════════════════════════════════════════════════════════
  // BLACKLIST: Track withdrawn stakes - survives RPC refresh!
  // Uses useRef so it persists across re-renders without causing re-renders
  // ═══════════════════════════════════════════════════════════════
  const withdrawnStakesRef = useRef(new Set());
  const withdrawnFlexRef = useRef(false); // Track if ALL flex were withdrawn
  
  // Add stake to blacklist (called on successful withdrawal)
  const blacklistStake = useCallback((stakeId) => {
    console.log('🚫 BLACKLISTING stake:', stakeId);
    withdrawnStakesRef.current.add(stakeId);
    // Also add by stakeIndex pattern for flex stakes
    if (stakeId.includes('flex')) {
      withdrawnStakesRef.current.add(stakeId);
    }
  }, []);
  
  // Check if stake is blacklisted
  const isBlacklisted = useCallback((stakeId) => {
    return withdrawnStakesRef.current.has(stakeId);
  }, []);
  
  // Clear blacklist (called after 2 minutes or manual refresh)
  const clearBlacklist = useCallback(() => {
    console.log('🧹 Clearing withdrawal blacklist');
    withdrawnStakesRef.current.clear();
    withdrawnFlexRef.current = false;
  }, []);
  
  // Auto-clear blacklist after 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (withdrawnStakesRef.current.size > 0 || withdrawnFlexRef.current) {
        console.log('⏰ Auto-clearing blacklist after 2 minutes');
        clearBlacklist();
      }
    }, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [clearBlacklist]);
  
  // BULLETPROOF: Remove stake + blacklist it
  const removeStakeFromUI = useCallback((stakeId) => {
    console.log('🗑️ REMOVING + BLACKLISTING stake:', stakeId);
    
    // Add to blacklist first
    blacklistStake(stakeId);
    
    // Remove from stakedPositions
    setStakedPositions(prev => {
      const filtered = prev.filter(p => p.id !== stakeId);
      console.log('📊 stakedPositions after removal:', filtered.length);
      return filtered;
    });
    
    // Remove from flexStakes
    setFlexStakes(prev => {
      const filtered = prev.filter(s => s.id !== stakeId);
      console.log('📊 flexStakes after removal:', filtered.length);
      return filtered;
    });
    
    // Force sidebar to re-render
    setSidebarKey(prev => prev + 1);
  }, [blacklistStake]);
  
  // BULLETPROOF: Remove ALL flex stakes + blacklist them
  const removeAllFlexFromUI = useCallback(() => {
    console.log('🗑️ REMOVING + BLACKLISTING ALL FLEX');
    
    // Mark that all flex are withdrawn
    withdrawnFlexRef.current = true;
    
    // Blacklist each flex stake
    stakedPositions.filter(p => p.isFlex || p.tierName === 'FLEX').forEach(p => {
      blacklistStake(p.id);
    });
    flexStakes.forEach(s => {
      blacklistStake(s.id);
    });
    
    setStakedPositions(prev => {
      const filtered = prev.filter(p => !p.isFlex && p.tierName !== 'FLEX');
      console.log('📊 stakedPositions after flex removal:', filtered.length);
      return filtered;
    });
    
    setFlexStakes([]);
    setSidebarKey(prev => prev + 1);
  }, [stakedPositions, flexStakes, blacklistStake]);
  
  // FILTERED GETTERS - these filter out blacklisted stakes
  // Uses lastKnownPositionsRef as fallback to prevent flicker
  const getVisiblePositions = useCallback(() => {
    const positions = stakedPositions.length > 0 ? stakedPositions : lastKnownPositionsRef.current;
    return positions.filter(p => !isBlacklisted(p.id) && !(withdrawnFlexRef.current && (p.isFlex || p.tierName === 'FLEX')));
  }, [stakedPositions, isBlacklisted]);
  
  const getVisibleFlexPositions = useCallback(() => {
    if (withdrawnFlexRef.current) return [];
    const positions = stakedPositions.length > 0 ? stakedPositions : lastKnownPositionsRef.current;
    return positions.filter(p => (p.isFlex || p.tierName === 'FLEX') && !isBlacklisted(p.id));
  }, [stakedPositions, isBlacklisted]);
  
  const getVisibleNonFlexPositions = useCallback(() => {
    const positions = stakedPositions.length > 0 ? stakedPositions : lastKnownPositionsRef.current;
    return positions.filter(p => !p.isFlex && p.tierName !== 'FLEX' && !isBlacklisted(p.id));
  }, [stakedPositions, isBlacklisted]);
  
  const getVisibleFlexStakes = useCallback(() => {
    if (withdrawnFlexRef.current) return [];
    return flexStakes.filter(s => !isBlacklisted(s.id));
  }, [flexStakes, isBlacklisted]);
  
  // ═══════════════════════════════════════════════════════════════
  // DEBUG: Expose contract inspection to browser console
  // Call: window.dtgcDebug.checkLPStake('0xYourAddress') from console
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    window.dtgcDebug = {
      contracts: CONTRACT_ADDRESSES,
      
      // Direct LP contract check
      checkLPStake: async (userAddress) => {
        const addr = userAddress || account;
        if (!addr) {
          console.log('❌ No address provided. Usage: window.dtgcDebug.checkLPStake("0xYourAddress")');
          return;
        }
        
        console.log('🔍 Checking LP stake for:', addr);
        const rpc = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
        const lpContract = new ethers.Contract(
          CONTRACT_ADDRESSES.lpStakingV3,
          FALLBACK_LP_STAKING_V3_ABI,
          rpc
        );
        
        try {
          const position = await lpContract.getPosition(addr);
          console.log('📋 LP Position raw result:');
          console.log('  [0] Amount:', ethers.formatEther(position[0]), 'LP');
          console.log('  [1] StartTime:', new Date(Number(position[1]) * 1000).toLocaleString());
          console.log('  [2] UnlockTime:', new Date(Number(position[2]) * 1000).toLocaleString());
          console.log('  [3] LockPeriod:', Number(position[3]), 'seconds');
          console.log('  [4] APR bps:', Number(position[4]));
          console.log('  [5] Boost bps:', Number(position[5]));
          console.log('  [6] LP Type:', Number(position[6]), Number(position[6]) === 1 ? '(Diamond+)' : '(Diamond)');
          console.log('  [7] isActive:', position[7]);
          console.log('  [8] TimeRemaining:', Number(position[8]), 'seconds');
          return position;
        } catch (err) {
          console.error('❌ getPosition Error:', err.message);
          
          // Try alternative methods
          console.log('🔄 Trying alternative contract methods...');
          try {
            const balance = await lpContract.totalStaked();
            console.log('📊 Contract total staked:', ethers.formatEther(balance), 'LP');
          } catch (e) {
            console.log('  totalStaked() not available');
          }
        }
      },
      
      // Check DTGC stake
      checkDTGCStake: async (userAddress) => {
        const addr = userAddress || account;
        if (!addr) {
          console.log('❌ No address provided. Usage: window.dtgcDebug.checkDTGCStake("0xYourAddress")');
          return;
        }
        
        console.log('🔍 Checking DTGC stake for:', addr);
        const rpc = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
        const contract = new ethers.Contract(
          CONTRACT_ADDRESSES.stakingV3,
          FALLBACK_STAKING_V3_ABI,
          rpc
        );
        
        try {
          const position = await contract.getPosition(addr);
          console.log('📋 DTGC Position:');
          console.log('  [0] Amount:', ethers.formatEther(position[0]), 'DTGC');
          console.log('  [6] Tier:', Number(position[6]), ['SILVER', 'GOLD', 'WHALE'][Number(position[6])]);
          console.log('  [7] isActive:', position[7]);
          return position;
        } catch (err) {
          console.error('❌ Error:', err.message);
        }
      },
      
      // Get current app state
      getState: () => ({
        account,
        stakedPositions,
        lpDtgcPlsBalance,
        lpDtgcUrmomBalance,
      }),
    };
    
    console.log('🛠️ Debug tools ready! Try: window.dtgcDebug.checkLPStake("0xC1CD5a70815E2874D2db038F398f2D8939d8E87C")');
  }, [account, stakedPositions, lpDtgcPlsBalance, lpDtgcUrmomBalance]);
  
  // Gold Records - Stake History
  const [stakeHistory, setStakeHistory] = useState([]);
  const [showGoldRecords, setShowGoldRecords] = useState(false);
  
  // My Stakes Calculator Modal
  const [showStakeCalculator, setShowStakeCalculator] = useState(false);
  const [calcFuturePrice, setCalcFuturePrice] = useState('');
  const [calcFutureMonths, setCalcFutureMonths] = useState('6');
  
  // Load stake history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('dtgc-stake-history');
    if (savedHistory) {
      try {
        setStakeHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.warn('Failed to load stake history:', e);
      }
    }
  }, []);
  const [contractStats, setContractStats] = useState({ totalStaked: '0', stakers: '0' });

  // Live holder wallets for ticker (fetched from PulseChain API)
  const [liveHolders, setLiveHolders] = useState({
    holders: HOLDER_WALLETS.map((w, i) => ({
      ...w,
      label: i < 3 ? `🐋 Whale ${i + 1}` : i < 8 ? `💎 Diamond ${i - 2}` : `🥇 Gold ${i - 7}`,
    })),
    totalHolders: 50,
    trackedBalance: HOLDER_WALLETS.reduce((sum, h) => sum + h.balance, 0), // ~7.2M from fallback
    trackedPctOfFloat: 8.0, // Approximate
    trackedPctOfTotal: 0.72, // 7.2M / 1B
    publicFloat: DTGC_TOTAL_SUPPLY * 0.09, // ~90M (9%)
    controlledSupply: DTGC_TOTAL_SUPPLY * 0.91, // ~910M (91%)
    loading: true,
    lastUpdated: null,
    error: null,
  });

  const [canVote, setCanVote] = useState(false);
  const [selectedVote, setSelectedVote] = useState(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [stakeWidgetMinimized, setStakeWidgetMinimized] = useState(true);
  const [selectedStakeIndex, setSelectedStakeIndex] = useState(0); // For multi-stake toggle in hero
  const [modalType, setModalType] = useState('start');

  // DTGC Burn tracking state (live from blockchain)
  const [dtgcBurnData, setDtgcBurnData] = useState({
    burned: 0,
    lastUpdated: null,
    loading: true,
    recentBurns: [], // Array of recent burn events
  });

  // Live prices state (fetched from DexScreener)


  // DTGC Supply Dynamics state
  const [supplyDynamics, setSupplyDynamics] = useState({
    dao: SUPPLY_WALLETS.dao.expected,
    dev: SUPPLY_WALLETS.dev.expected,
    lpLocked: SUPPLY_WALLETS.lpLocked.expected,
    burned: 0,
    staked: 0,
    circulating: SUPPLY_WALLETS.circulating.expected,
    rewardsPool: 0,
    lastUpdated: null,
  });

  // Toast notification helper - defined early so all callbacks can use it
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Gold flash state for nav clicks
  const [showGoldFlash, setShowGoldFlash] = useState(false);

  // Handle navigation click with gold flash, scroll, and URL update
  const handleNavClick = (tab) => {
    setActiveTab(tab);
    setShowGoldFlash(true);
    setTimeout(() => setShowGoldFlash(false), 300);
    
    // Update URL without page reload (enables direct linking)
    if (typeof window !== 'undefined') {
      const newUrl = tab === 'stake' ? '/' : `/${tab}`;
      window.history.pushState({ tab }, '', newUrl);
    }
    
    // Scroll to content section after a brief delay
    setTimeout(() => {
      const contentSection = document.getElementById('main-content');
      if (contentSection) {
        contentSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };
  
  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state?.tab) {
        setActiveTab(event.state.tab);
      } else {
        // Parse URL on popstate
        const path = window.location.pathname.toLowerCase().replace(/^\//, '').replace(/\/$/, '');
        const validTabs = ['stake', 'burn', 'vote', 'whitepaper', 'links', 'analytics', 'saas'];
        if (path && validTabs.includes(path)) {
          setActiveTab(path);
        } else {
          setActiveTab('stake');
        }
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch live supply dynamics (wallet balances) from PulseChain API
  const fetchSupplyDynamics = useCallback(async () => {
    try {
      // Fetch DAO Treasury balance
      const daoRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${SUPPLY_WALLETS.dao.address}/token-balances`);
      const daoData = await daoRes.json();
      const daoBalance = daoData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
      const daoDtgc = daoBalance ? parseFloat(daoBalance.value) / 1e18 : 0;

      // Fetch Dev Wallet balance (kept for internal tracking, not shown in UI)
      const devRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${SUPPLY_WALLETS.dev.address}/token-balances`);
      const devData = await devRes.json();
      const devBalance = devData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
      const devDtgc = devBalance ? parseFloat(devBalance.value) / 1e18 : SUPPLY_WALLETS.dev.expected;

      // Fetch Burn address balance
      const burnRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${SUPPLY_WALLETS.burn.address}/token-balances`);
      const burnData = await burnRes.json();
      const burnBalance = burnData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
      const burnedDtgc = burnBalance ? parseFloat(burnBalance.value) / 1e18 : 0;

      // Fetch Rewards Pool (V4 Staking Contract DTGC balance)
      let rewardsPoolDtgc = 0;
      try {
        const stakingRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${CONTRACT_ADDRESSES.stakingV4}/token-balances`);
        const stakingData = await stakingRes.json();
        const stakingBalance = stakingData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
        rewardsPoolDtgc = stakingBalance ? parseFloat(stakingBalance.value) / 1e18 : 0;
      } catch (e) {
        console.warn('Failed to fetch rewards pool:', e);
      }

      // Calculate circulating = Total - DAO - Dev - LP - Burned - Staked
      const totalSupply = DTGC_TOTAL_SUPPLY;
      const circulating = totalSupply - daoDtgc - devDtgc - SUPPLY_WALLETS.lpLocked.expected - burnedDtgc;

      setSupplyDynamics({
        dao: daoDtgc,
        dev: devDtgc,
        lpLocked: SUPPLY_WALLETS.lpLocked.expected,
        burned: burnedDtgc,
        staked: 0, // Will be updated from contract
        circulating: Math.max(0, circulating),
        rewardsPool: rewardsPoolDtgc,
        lastUpdated: new Date(),
      });

      console.log('📊 Supply dynamics updated:', { dao: daoDtgc, dev: devDtgc, burned: burnedDtgc, rewardsPool: rewardsPoolDtgc });
    } catch (err) {
      console.warn('⚠️ Failed to fetch supply dynamics:', err.message);
    }
  }, []);

  // Fetch total staked from V4 contract
  const fetchTotalStaked = useCallback(async () => {
    try {
      // Use public RPC to query contract
      const provider = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
      const stakingContract = new ethers.Contract(
        CONTRACT_ADDRESSES.stakingV4,
        ['function totalStaked() external view returns (uint256)'],
        provider
      );
      
      const totalStakedRaw = await stakingContract.totalStaked();
      const totalStakedFormatted = ethers.formatUnits(totalStakedRaw, 18);
      
      setContractStats(prev => ({
        ...prev,
        totalStaked: totalStakedFormatted,
      }));
      
      console.log('📊 Total staked updated:', totalStakedFormatted);
    } catch (err) {
      console.warn('⚠️ Failed to fetch total staked:', err.message);
    }
  }, []);

  // Fetch supply dynamics on mount and every 5 minutes
  useEffect(() => {
    fetchSupplyDynamics();
    fetchTotalStaked();
    const interval = setInterval(() => {
      fetchSupplyDynamics();
      fetchTotalStaked();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSupplyDynamics, fetchTotalStaked]);

  // Fetch live holder data from our Vercel API route (proxies PulseChain API)
  const fetchLiveHolders = useCallback(async () => {
    try {
      // FIRST: Get accurate holder count from token-counters API
      let accurateHolderCount = 0;
      try {
        const countersResponse = await fetch(`https://api.scan.pulsechain.com/api/v2/tokens/${CONTRACT_ADDRESSES.dtgc}/counters`);
        if (countersResponse.ok) {
          const countersData = await countersResponse.json();
          accurateHolderCount = parseInt(countersData.token_holders_count) || 0;
          console.log('✅ Accurate holder count from counters API:', accurateHolderCount);
        }
      } catch (e) {
        console.log('Counters API fallback:', e.message);
      }
      
      const response = await fetch(PULSECHAIN_API.holders);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle Vercel API response format
      if (!data.success && data.error) {
        throw new Error(data.error);
      }
      
      // Get items from either format (direct API or Vercel proxy)
      const allItems = data.holders || data.items || [];
      // Use accurate count from counters API, fallback to response data
      const totalHolders = accurateHolderCount || data.totalHolders || data.token_holders_count || allItems.length;
      
      if (allItems.length === 0) {
        throw new Error('No items in API response');
      }
      
      // Calculate ACTUAL controlled supply by summing excluded wallet balances from API
      let controlledSupply = 0;
      const excludedBalances = {};
      
      allItems.forEach(item => {
        const addr = (item.address?.hash || item.address)?.toLowerCase();
        if (addr && EXCLUDED_WALLETS.includes(addr)) {
          const balance = parseFloat(item.value) / 1e18;
          controlledSupply += balance;
          excludedBalances[addr] = balance;
        }
      });
      
      // If no excluded wallets found in first page, use known values
      if (controlledSupply === 0) {
        controlledSupply = 820000000 + 87000000; // ~907M (Dev + LP)
      }
      
      // Calculate actual public float
      const actualPublicFloat = DTGC_TOTAL_SUPPLY - controlledSupply;
      
      // Process ALL public holders - filter out excluded wallets
      const holders = allItems
        .filter(item => {
          const addr = (item.address?.hash || item.address)?.toLowerCase();
          return addr && !EXCLUDED_WALLETS.includes(addr);
        })
        .map((item) => {
          const addr = item.address?.hash || item.address;
          return {
            address: `${addr?.slice(0, 6)}...${addr?.slice(-4)}`,
            fullAddress: addr,
            balance: parseFloat(item.value) / 1e18,
          };
        })
        .slice(0, 50) // Top 50 public holders
        .map((item, index) => ({
          ...item,
          label: index < 3 ? `🐋 Whale ${index + 1}` : 
                 index < 8 ? `💎 Diamond ${index - 2}` : 
                 index < 15 ? `🥇 Gold ${index - 7}` :
                 `🥈 Holder ${index - 14}`,
        }));

      if (holders.length === 0) {
        throw new Error('All holders filtered out');
      }

      // Calculate tracked supply as % of PUBLIC FLOAT
      const trackedBalance = holders.reduce((sum, h) => sum + h.balance, 0);
      const trackedPctOfFloat = actualPublicFloat > 0 ? (trackedBalance / actualPublicFloat * 100) : 0;
      const trackedPctOfTotal = (trackedBalance / DTGC_TOTAL_SUPPLY * 100);

      setLiveHolders({
        holders,
        totalHolders: totalHolders,
        trackedBalance,
        trackedPctOfFloat,
        trackedPctOfTotal,
        publicFloat: actualPublicFloat,
        controlledSupply,
        loading: false,
        lastUpdated: new Date(),
        error: null,
      });
      console.log('📊 Live holders:', holders.length, 'wallets |', 
        'Tracked:', (trackedBalance/1e6).toFixed(2), 'M |',
        'Float:', (actualPublicFloat/1e6).toFixed(2), 'M |',
        '% of float:', trackedPctOfFloat.toFixed(1), '%');
    } catch (err) {
      console.warn('⚠️ Holder API error, using fallback:', err.message);
      
      // Calculate stats from fallback data
      const fallbackHolders = HOLDER_WALLETS.map((w, i) => ({
        ...w,
        label: i < 3 ? `🐋 Whale ${i + 1}` : i < 8 ? `💎 Diamond ${i - 2}` : `🥇 Gold ${i - 7}`,
      }));
      const fallbackTracked = fallbackHolders.reduce((sum, h) => sum + h.balance, 0);
      const fallbackFloat = DTGC_TOTAL_SUPPLY * 0.09; // ~9% float estimate
      
      setLiveHolders(prev => ({
        ...prev,
        holders: fallbackHolders,
        totalHolders: prev.totalHolders || 50,
        trackedBalance: fallbackTracked,
        trackedPctOfFloat: (fallbackTracked / fallbackFloat * 100),
        trackedPctOfTotal: (fallbackTracked / DTGC_TOTAL_SUPPLY * 100),
        publicFloat: fallbackFloat,
        controlledSupply: DTGC_TOTAL_SUPPLY * 0.91,
        loading: false,
        error: err.message,
      }));
    }
  }, []);

  // Fetch holders on mount and every 2 minutes
  useEffect(() => {
    fetchLiveHolders();
    const interval = setInterval(fetchLiveHolders, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [fetchLiveHolders]);

  // Fetch live prices from DexScreener
  const fetchLivePrices = useCallback(async () => {
    setLivePrices(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      // URMOM price
      const urmomRes = await fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0');
      const urmomData = await urmomRes.json();
      
      // DTGC price + market cap
      const dtgcRes = await fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7');
      const dtgcData = await dtgcRes.json();
      
      // PLS price from WPLS pairs
      let plsPrice = 0.00003;
      try {
        const plsRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27');
        const plsData = await plsRes.json();
        if (plsData?.pairs?.length > 0) {
          const bestPair = plsData.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          plsPrice = parseFloat(bestPair?.priceUsd) || plsPrice;
        }
      } catch (e) {
        console.warn('PLS price fetch failed:', e.message);
      }
      
      // DexScreener returns { pairs: [...] } or { pair: {...} }
      const urmomPair = urmomData?.pair || urmomData?.pairs?.[0];
      const dtgcPair = dtgcData?.pair || dtgcData?.pairs?.[0];
      
      const urmomPrice = parseFloat(urmomPair?.priceUsd || BURN_STATS.urmomPrice);
      const dtgcPrice = parseFloat(dtgcPair?.priceUsd || BURN_STATS.dtgcPrice);
      
      // Get market cap directly from DexScreener (fdv = fully diluted valuation)
      const dtgcMarketCap = parseFloat(dtgcPair?.fdv || dtgcPair?.marketCap || 0);
      
      if (isNaN(urmomPrice) || isNaN(dtgcPrice)) {
        throw new Error('Invalid price data');
      }
      
      setLivePrices(prev => ({
        ...prev,
        urmom: urmomPrice,
        dtgc: dtgcPrice,
        pls: plsPrice,
        dtgcMarketCap: dtgcMarketCap,
        lastUpdated: new Date(),
        loading: false,
        error: null,
      }));
      
      console.log('📊 Live prices updated:', { urmom: urmomPrice, dtgc: dtgcPrice, pls: plsPrice, marketCap: dtgcMarketCap });
      // Toast only shown on manual refresh, not auto-refresh
    } catch (err) {
      console.error('Failed to fetch live prices:', err);
      setLivePrices(prev => ({ 
        ...prev, 
        loading: false, 
        error: 'Failed to fetch prices - using cached values'
      }));
      // Toast shown only on manual refresh to avoid hoisting issues
    }
  }, []);

  // Fetch prices on mount and every 60 seconds
  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  // Fetch crypto prices (BTC, ETH, PLS, PLSX)
  const fetchCryptoPrices = useCallback(async () => {
    try {
      // Fetch from CoinGecko for BTC/ETH
      const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pulsechain&vs_currencies=usd');
      const cgData = await cgRes.json();

      // Fetch PLS from DexScreener - use WPLS/DAI pair (most liquid)
      // Primary: WPLS/DAI pair
      let plsPrice = 0.00003;
      try {
        const plsRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xA1077a294dDE1B09bB078844df40758a5D0f9a27');
        const plsData = await plsRes.json();
        // Get best pair by liquidity
        if (plsData?.pairs?.length > 0) {
          const bestPair = plsData.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          plsPrice = parseFloat(bestPair?.priceUsd) || plsPrice;
        }
      } catch (e) {
        console.warn('PLS price fetch failed:', e.message);
      }

      // Fetch PLSX from DexScreener - search by token address
      let plsxPrice = 0.00002;
      try {
        const plsxRes = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x95B303987A60C71504D99Aa1b13B4DA07b0790ab');
        const plsxData = await plsxRes.json();
        // Get best pair by liquidity
        if (plsxData?.pairs?.length > 0) {
          const bestPair = plsxData.pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
          plsxPrice = parseFloat(bestPair?.priceUsd) || plsxPrice;
        }
      } catch (e) {
        console.warn('PLSX price fetch failed:', e.message);
      }

      // Use CoinGecko PLS price as fallback/primary if available
      if (cgData?.pulsechain?.usd) {
        plsPrice = cgData.pulsechain.usd;
      }

      setCryptoPrices({
        btc: cgData?.bitcoin?.usd || 42000,
        eth: cgData?.ethereum?.usd || 2200,
        pls: plsPrice,
        plsx: plsxPrice,
        loading: false,
        lastUpdated: new Date(),
      });
      
      // Also update livePrices with PLS/PLSX for reward calculations
      setLivePrices(prev => ({
        ...prev,
        pls: plsPrice,
        plsx: plsxPrice,
      }));
      
      console.log('💰 Crypto prices updated:', { 
        btc: cgData?.bitcoin?.usd, 
        eth: cgData?.ethereum?.usd, 
        pls: plsPrice, 
        plsx: plsxPrice 
      });
    } catch (err) {
      console.warn('Failed to fetch crypto prices:', err.message);
      setCryptoPrices(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Fetch crypto prices on mount and every 2 minutes
  useEffect(() => {
    fetchCryptoPrices();
    const interval = setInterval(fetchCryptoPrices, 120000);
    return () => clearInterval(interval);
  }, [fetchCryptoPrices]);

  // Manual refresh with toast notification
  const manualRefreshPrices = async () => {
    setLivePrices(prev => ({ ...prev, loading: true }));
    try {
      const [urmomRes, dtgcRes] = await Promise.all([
        fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0'),
        fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7'),
      ]);
      
      const urmomData = await urmomRes.json();
      const dtgcData = await dtgcRes.json();
      
      const urmomPrice = parseFloat(urmomData?.pair?.priceUsd || urmomData?.pairs?.[0]?.priceUsd || BURN_STATS.urmomPrice);
      const dtgcPrice = parseFloat(dtgcData?.pair?.priceUsd || dtgcData?.pairs?.[0]?.priceUsd || BURN_STATS.dtgcPrice);
      
      setLivePrices(prev => ({
        ...prev,
        urmom: urmomPrice,
        dtgc: dtgcPrice,
        lastUpdated: new Date(),
        loading: false,
        error: null,
      }));
      
      showToast(`🟢 Prices updated: URMOM $${urmomPrice.toFixed(7)} | DTGC $${dtgcPrice.toFixed(7)}`, 'success');
    } catch (err) {
      setLivePrices(prev => ({ ...prev, loading: false, error: 'Failed' }));
      showToast('⚠️ Price fetch failed', 'error');
    }
  };

  // Calculate live burn value
  const liveBurnedUSD = (BURN_STATS.totalDeadWallet * livePrices.urmom).toFixed(2);
  const liveLPBurnedUSD = (totalLPUrmom * livePrices.urmom).toFixed(2);

  // Fetch DTGC burns from blockchain
  const fetchDtgcBurns = useCallback(async () => {
    try {
      const rpcProvider = new ethers.JsonRpcProvider('https://rpc.pulsechain.com');
      const dtgcContract = new ethers.Contract(
        DTGC_TOKEN_ADDRESS,
        ['function balanceOf(address) view returns (uint256)'],
        rpcProvider
      );

      // Fetch balance of burn address (0x...369)
      const burnBalance = await dtgcContract.balanceOf(DTGC_BURN_ADDRESS);
      const burnedAmount = parseFloat(ethers.formatEther(burnBalance));

      // Update state
      setDtgcBurnData(prev => ({
        ...prev,
        burned: burnedAmount,
        lastUpdated: new Date(),
        loading: false,
      }));

      console.log(`🔥 DTGC Burned: ${formatNumber(burnedAmount)} (from ${DTGC_BURN_ADDRESS})`);
    } catch (err) {
      console.error('Failed to fetch DTGC burns:', err);
      // Set a fallback value if fetch fails
      setDtgcBurnData(prev => ({ 
        ...prev, 
        burned: prev.burned || 22240000, // Fallback to ~22.24M
        loading: false 
      }));
    }
  }, []);

  // Fetch DTGC burns on mount and every 30 seconds
  useEffect(() => {
    fetchDtgcBurns();
    const interval = setInterval(fetchDtgcBurns, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [fetchDtgcBurns]);

  // Initialize testnet balances
  const initTestnetBalances = useCallback(() => {
    if (!TESTNET_MODE) return;
    
    const balances = {
      pls: TESTNET_CONFIG.startingPLS,
      dtgc: TESTNET_CONFIG.startingDTGC,
      urmom: TESTNET_CONFIG.startingURMOM,
      lp: TESTNET_CONFIG.startingLP,
      stakedDTGC: 0,
      stakedLP: 0,
      rewards: 0,
      positions: [],
    };
    
    setTestnetBalances(balances);
    localStorage.setItem('dtgc-testnet-balances', JSON.stringify(balances));
    
    setPlsBalance(balances.pls.toString());
    setDtgcBalance(balances.dtgc.toString());
    setUrmomBalance(balances.urmom.toString());
    setLpBalance(balances.lp.toString());
    
    return balances;
  }, []);

  // Update balances from testnet state
  useEffect(() => {
    if (TESTNET_MODE && testnetBalances) {
      setPlsBalance((testnetBalances.pls ?? 0).toString());
      setDtgcBalance((testnetBalances.dtgc ?? 0).toString());
      setUrmomBalance((testnetBalances.urmom ?? 0).toString());
      setLpBalance((testnetBalances.lp ?? 0).toString());
      setStakedPositions(testnetBalances.positions || []);
    }
  }, [testnetBalances]);

  // Faucet function - get test tokens
  const claimTestTokens = useCallback(() => {
    if (!TESTNET_MODE) return;
    
    const newBalances = {
      ...testnetBalances,
      pls: (testnetBalances?.pls || 0) + TESTNET_CONFIG.startingPLS,
      dtgc: (testnetBalances?.dtgc || 0) + TESTNET_CONFIG.startingDTGC,
      urmom: (testnetBalances?.urmom || 0) + TESTNET_CONFIG.startingURMOM,
      lp: (testnetBalances?.lp || 0) + TESTNET_CONFIG.startingLP,
    };
    
    setTestnetBalances(newBalances);
    localStorage.setItem('dtgc-testnet-balances', JSON.stringify(newBalances));
    showToast(`🎉 Received ${formatNumber(TESTNET_CONFIG.startingPLS)} PLS + ${formatNumber(TESTNET_CONFIG.startingDTGC)} DTGC + ${formatNumber(TESTNET_CONFIG.startingLP)} LP!`, 'success');
  }, [testnetBalances]);

  // Reset testnet
  const resetTestnet = useCallback(() => {
    if (!TESTNET_MODE) return;
    localStorage.removeItem('dtgc-testnet-balances');
    initTestnetBalances();
    showToast('🔄 Testnet reset! Fresh 100M PLS added.', 'info');
  }, [initTestnetBalances]);

  // V19 Migration: Fix old stakes with incorrect APRs and lock periods
  useEffect(() => {
    if (!TESTNET_MODE || !testnetBalances?.positions?.length) return;

    const V19_TIER_CONFIG = {
      'SILVER': { apr: 15.4, lockDays: 60 },
      'GOLD': { apr: 16.8, lockDays: 90 },
      'WHALE': { apr: 18.2, lockDays: 180 },
      'DIAMOND': { apr: 28, lockDays: 90, boost: 1.5 },
      'DIAMOND+': { apr: 35, lockDays: 90, boost: 2 },
    };

    let needsMigration = false;
    const migratedPositions = testnetBalances.positions.map(pos => {
      // Handle tier as either string or number
      const TIER_NAMES_MAP = ['SILVER', 'GOLD', 'WHALE'];
      let tierName;
      if (typeof pos.tier === 'string') {
        tierName = pos.tier.toUpperCase();
      } else if (typeof pos.tier === 'number') {
        tierName = TIER_NAMES_MAP[pos.tier] || 'GOLD';
      } else if (pos.isLP) {
        tierName = pos.lpType === 1 ? 'DIAMOND+' : 'DIAMOND';
      } else {
        tierName = 'GOLD';
      }
      const tierConfig = V19_TIER_CONFIG[tierName];

      if (!tierConfig) return pos;

      // Check if this position has old/incorrect values
      const correctApr = pos.isLP ? tierConfig.apr * (tierConfig.boost || 1) : tierConfig.apr;
      const correctLockDays = tierConfig.lockDays;

      if (pos.apr !== correctApr || pos.lockDays !== correctLockDays) {
        needsMigration = true;
        const newEndTime = pos.startTime + (correctLockDays * 24 * 60 * 60 * 1000);
        return {
          ...pos,
          apr: correctApr,
          lockDays: correctLockDays,
          endTime: newEndTime,
        };
      }
      return pos;
    });

    if (needsMigration) {
      const newBalances = { ...testnetBalances, positions: migratedPositions };
      setTestnetBalances(newBalances);
      localStorage.setItem('dtgc-testnet-balances', JSON.stringify(newBalances));
      console.log('✅ V19 Migration: Updated stakes to correct APRs and lock periods');
    }
  }, [testnetBalances?.positions?.length]);

  const toggleTheme = () => {
    setIsDark(!isDark);
    localStorage.setItem('dtgc-theme', !isDark ? 'dark' : 'light');
  };

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const connectWallet = async () => {
    // TESTNET MODE - No real wallet needed
    if (TESTNET_MODE) {
      const testAddress = '0xTEST' + Math.random().toString(16).slice(2, 10).toUpperCase() + '...TEST';
      setAccount(testAddress);
      
      // Initialize or load testnet balances
      if (!testnetBalances) {
        initTestnetBalances();
      }
      
      // Close wallet modal after testnet connection
      setShowWalletModal(false);
      
      showToast('🧪 TESTNET: Wallet connected with 100M PLS!', 'success');
      return;
    }

    // MAINNET MODE
    if (!window.ethereum) {
      showToast('Please install MetaMask', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('🔗 Connecting wallet...');
      
      // Request accounts directly first
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (reqErr) {
        if (reqErr.code === 4001) {
          showToast('Connection cancelled', 'info');
          return;
        }
        if (reqErr.code === -32002) {
          showToast('⏳ Please check your wallet - a connection request is pending', 'info');
          return;
        }
        throw reqErr;
      }

      if (!accounts || accounts.length === 0) {
        showToast('No accounts found', 'error');
        return;
      }

      // Check/switch network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainId, 16);

      if (currentChainId !== CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x171' }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x171',
                  chainName: 'PulseChain',
                  nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
                  rpcUrls: ['https://rpc.pulsechain.com'],
                  blockExplorerUrls: ['https://otter.pulsechain.com'],
                }],
              });
            } catch (addErr) {
              console.warn('Could not add PulseChain:', addErr);
            }
          } else if (switchErr.code === 4001) {
            showToast('Please switch to PulseChain to continue', 'info');
            return;
          }
        }
      }

      // Create provider AFTER chain switch
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      console.log(`✅ Connected: ${address}`);

      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setShowWalletModal(false);
      showToast('✅ Wallet connected', 'success');
    } catch (err) {
      console.error('Connection error:', err);
      if (err.code === 4001) {
        showToast('Connection cancelled', 'info');
      } else if (err.code === -32002) {
        showToast('⏳ Check your wallet - request pending', 'info');
      } else {
        showToast('Connection failed', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Connect specific wallet type
  const connectWalletType = async (walletType) => {
    if (TESTNET_MODE) {
      connectWallet();
      return;
    }

    // Check if any wallet provider exists
    if (!window.ethereum) {
      // Only redirect to download if NO wallet is installed at all
      const downloadUrls = {
        internetmoney: 'https://internetmoney.io/',
        metamask: 'https://metamask.io/download/',
        rabby: 'https://rabby.io/',
        okx: 'https://www.okx.com/web3',
        coinbase: 'https://www.coinbase.com/wallet',
      };
      window.open(downloadUrls[walletType] || 'https://metamask.io/download/', '_blank');
      showToast('No wallet detected. Please install a Web3 wallet.', 'info');
      return;
    }

    try {
      setLoading(true);
      
      // Use the appropriate provider
      let ethProvider = window.ethereum;
      
      // Check for specific wallet providers (but don't fail if not found)
      if (walletType === 'okx' && window.okxwallet) {
        ethProvider = window.okxwallet;
      } else if (walletType === 'coinbase' && window.coinbaseWalletExtension) {
        ethProvider = window.coinbaseWalletExtension;
      }
      
      // For wallets like Rabby that can have multiple providers
      if (window.ethereum.providers?.length) {
        // Try to find the specific wallet provider
        const specificProvider = window.ethereum.providers.find(p => {
          if (walletType === 'metamask') return p.isMetaMask && !p.isRabby;
          if (walletType === 'coinbase') return p.isCoinbaseWallet;
          if (walletType === 'rabby') return p.isRabby;
          return false;
        });
        if (specificProvider) {
          ethProvider = specificProvider;
        }
      }

      console.log(`🔗 Connecting ${walletType}...`);
      
      // Request accounts directly from the provider first
      let accounts;
      try {
        accounts = await ethProvider.request({ method: 'eth_requestAccounts' });
      } catch (reqErr) {
        // Check for actual user rejection
        if (reqErr.code === 4001) {
          showToast('Connection cancelled', 'info');
          return;
        }
        // Check for pending request
        if (reqErr.code === -32002) {
          showToast('⏳ Please check your wallet - a connection request is pending', 'info');
          return;
        }
        throw reqErr;
      }
      
      if (!accounts || accounts.length === 0) {
        showToast('No accounts found. Please unlock your wallet.', 'error');
        return;
      }

      console.log(`✅ Got accounts: ${accounts[0]}`);

      // Check network and switch if needed
      const chainId = await ethProvider.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainId, 16);
      
      if (currentChainId !== CHAIN_ID) {
        console.log(`🔄 Switching to PulseChain (current: ${currentChainId})...`);
        try {
          await ethProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x171' }], // PulseChain
          });
        } catch (switchError) {
          // If chain doesn't exist, add it
          if (switchError.code === 4902) {
            try {
              await ethProvider.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x171',
                  chainName: 'PulseChain',
                  nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
                  rpcUrls: ['https://rpc.pulsechain.com'],
                  blockExplorerUrls: ['https://otter.pulsechain.com'],
                }],
              });
            } catch (addErr) {
              console.warn('Could not add PulseChain:', addErr);
            }
          } else if (switchError.code === 4001) {
            showToast('Please switch to PulseChain to continue', 'info');
            return;
          } else {
            console.warn('Could not switch chain:', switchError);
          }
        }
      }

      // Create provider and signer AFTER chain switch
      const provider = new ethers.BrowserProvider(ethProvider);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      console.log(`✅ Connected: ${address}`);

      // Update state
      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setShowWalletModal(false);
      
      showToast(`✅ ${walletType.charAt(0).toUpperCase() + walletType.slice(1)} connected!`, 'success');

    } catch (err) {
      console.error('Wallet connection error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      
      // Only show "rejected" if it's actually a user rejection (code 4001)
      if (err.code === 4001) {
        showToast('Connection cancelled', 'info');
      } else if (err.code === -32002) {
        showToast('⏳ Check your wallet - connection request pending', 'info');
      } else if (err.code === -32603) {
        showToast('Wallet error. Please try again.', 'error');
      } else {
        showToast('Connection failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Select a specific account from available accounts
  const selectAccount = async (selectedAddress) => {
    try {
      setLoading(true);
      const ethProvider = window.okxwallet || window.ethereum;

      // Switch chain if needed
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== CHAIN_ID) {
        await ethProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x171' }],
        });
      }

      const signer = await provider.getSigner(selectedAddress);

      setProvider(provider);
      setSigner(signer);
      setAccount(selectedAddress);
      setShowWalletModal(false);
      setWalletStep('select');
      setAvailableAccounts([]);
      showToast(`Connected to ${selectedAddress.slice(0, 6)}...${selectedAddress.slice(-4)}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to connect account', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect wallet function
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setDtgcBalance('0');
    setUrmomBalance('0');
    setLpBalance('0');
    setPlsBalance('0');
    setStakedPositions([]);
    lastKnownPositionsRef.current = []; // Clear cached positions
    setAvailableAccounts([]);
    setWalletStep('select');
    setSelectedWalletType(null);
    showToast('Wallet disconnected', 'info');
  };

  // Switch wallet - prompts user to select a different account
  const switchWallet = async () => {
    if (!window.ethereum) {
      showToast('No wallet detected', 'error');
      return;
    }

    try {
      setLoading(true);
      showToast('🔄 Select account in your wallet...', 'info');

      // Request permission to access accounts - this opens the account picker
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });

      // Get the newly selected accounts
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts && accounts.length > 0) {
        const newAccount = accounts[0];
        
        // Update provider and signer for new account
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await newProvider.getSigner();
        
        setAccount(newAccount);
        setProvider(newProvider);
        setSigner(newSigner);
        
        // Clear old positions so they refresh for new account
        setStakedPositions([]);
        lastKnownPositionsRef.current = []; // Clear cached positions for old account
        
        showToast(`✅ Switched to ${newAccount.slice(0,6)}...${newAccount.slice(-4)}`, 'success');
      }
    } catch (err) {
      console.error('Switch wallet error:', err);
      if (err.code === 4001) {
        showToast('Account switch cancelled', 'info');
      } else {
        showToast('Could not switch accounts', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // WalletConnect v2 connection (requires @walletconnect/ethereum-provider package)
  const connectWalletConnect = async () => {
    if (TESTNET_MODE) {
      connectWallet();
      return;
    }

    try {
      setLoading(true);
      
      // If on mobile browser without wallet injection, show wallet selector with deep links
      if (needsDeepLink) {
        setLoading(false);
        showToast('📱 Select a wallet to open this site in its dApp browser', 'info');
        
        // Create a better mobile wallet selection UI
        const walletChoice = window.confirm(
          '🦊 MetaMask\n\nTap OK to open in MetaMask\'s browser.\nTap Cancel to see more wallet options.'
        );
        
        if (walletChoice) {
          openInWalletBrowser('metamask');
        } else {
          const otherWallet = window.prompt(
            'Enter wallet number:\n\n' +
            '1 = Trust Wallet\n' +
            '2 = Coinbase Wallet\n' +
            '3 = Rainbow\n' +
            '4 = OKX Wallet\n' +
            '5 = TokenPocket'
          );
          
          const walletMap = {
            '1': 'trust',
            '2': 'coinbase', 
            '3': 'rainbow',
            '4': 'okx',
            '5': 'tokenpocket'
          };
          
          if (walletMap[otherWallet]) {
            openInWalletBrowser(walletMap[otherWallet]);
          }
        }
        return;
      }

      showToast('Initializing WalletConnect...', 'info');

      // Check if package is available
      let EthereumProvider;
      try {
        const module = await import('@walletconnect/ethereum-provider');
        EthereumProvider = module.EthereumProvider;
      } catch (importErr) {
        // Package not installed - fallback to basic connection
        console.log('WalletConnect package not installed, using basic connection');
        setLoading(false);
        showToast('💡 Use Quick Connect or select a specific wallet below.', 'info');
        return;
      }

      const wcProvider = await EthereumProvider.init({
        projectId: WALLETCONNECT_PROJECT_ID,
        chains: [CHAIN_ID], // PulseChain
        showQrModal: true,
        qrModalOptions: {
          themeMode: 'dark',
        },
        metadata: {
          name: 'DTGC Premium Staking',
          description: 'Premium DeFi Staking on PulseChain',
          url: window.location.origin,
          icons: [`${window.location.origin}/favicon1.png`],
        },
        rpcMap: {
          [CHAIN_ID]: 'https://rpc.pulsechain.com',
        },
      });

      // Connect and open QR modal
      await wcProvider.connect();

      const ethersProvider = new ethers.BrowserProvider(wcProvider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();

      setProvider(ethersProvider);
      setSigner(signer);
      setAccount(address);
      setShowWalletModal(false);
      showToast('✅ Connected via WalletConnect!', 'success');

      // Handle disconnect
      wcProvider.on('disconnect', () => {
        disconnectWallet();
        showToast('WalletConnect disconnected', 'info');
      });

    } catch (err) {
      console.error('WalletConnect error:', err);
      if (err.message?.includes('User rejected') || err.code === 4001) {
        showToast('Connection cancelled', 'info');
      } else {
        showToast('WalletConnect failed. Use browser wallet or mobile links.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick connect - uses any available provider
  const connectAnyWallet = async () => {
    if (TESTNET_MODE) {
      connectWallet();
      return;
    }

    if (!window.ethereum) {
      showToast('No wallet detected. Please install MetaMask or another Web3 wallet.', 'error');
      return;
    }

    try {
      setLoading(true);
      console.log('🔗 Quick Connect starting...');
      
      // Request accounts directly from provider first
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (reqErr) {
        if (reqErr.code === 4001) {
          showToast('Connection cancelled', 'info');
          return;
        }
        if (reqErr.code === -32002) {
          showToast('⏳ Please check your wallet - a connection request is pending', 'info');
          return;
        }
        throw reqErr;
      }
      
      if (!accounts || accounts.length === 0) {
        showToast('No accounts found. Please unlock your wallet.', 'error');
        return;
      }

      console.log(`✅ Got accounts: ${accounts[0]}`);

      // Check/switch network
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(chainId, 16);
      
      if (currentChainId !== CHAIN_ID) {
        console.log(`🔄 Switching to PulseChain...`);
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x171' }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x171',
                  chainName: 'PulseChain',
                  nativeCurrency: { name: 'PLS', symbol: 'PLS', decimals: 18 },
                  rpcUrls: ['https://rpc.pulsechain.com'],
                  blockExplorerUrls: ['https://otter.pulsechain.com'],
                }],
              });
            } catch (addErr) {
              console.warn('Could not add PulseChain:', addErr);
            }
          } else if (switchErr.code === 4001) {
            showToast('Please switch to PulseChain to continue', 'info');
            return;
          }
        }
      }

      // Create provider AFTER chain operations
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      console.log(`✅ Connected: ${address}`);

      setProvider(provider);
      setSigner(signer);
      setAccount(address);
      setShowWalletModal(false);
      showToast('✅ Wallet connected!', 'success');

    } catch (err) {
      console.error('Connection error:', err);
      console.error('Error code:', err.code);
      
      if (err.code === 4001) {
        showToast('Connection cancelled', 'info');
      } else if (err.code === -32002) {
        showToast('⏳ Check your wallet - connection request pending', 'info');
      } else {
        showToast('Connection failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mobile wallet deep links - improved for better dApp browser detection
  const openInWalletBrowser = (walletType) => {
    const currentUrl = window.location.href;
    const host = window.location.host;
    const path = window.location.pathname;
    
    // Deep links that open the current site in wallet's dApp browser
    const deepLinks = {
      metamask: `https://metamask.app.link/dapp/${host}${path}`,
      trust: `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(currentUrl)}`,
      rainbow: `https://rnbwapp.com/dapp?url=${encodeURIComponent(currentUrl)}`,
      imtoken: `imtokenv2://navigate/DappView?url=${encodeURIComponent(currentUrl)}`,
      coinbase: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(currentUrl)}`,
      tokenpocket: `tpoutside://open?url=${encodeURIComponent(currentUrl)}`,
      okx: `okx://wallet/dapp/details?dappUrl=${encodeURIComponent(currentUrl)}`,
      rabby: `https://rabby.io/dapp?url=${encodeURIComponent(currentUrl)}`, // Rabby uses standard injection
      internetmoney: `https://internetmoney.io/open?url=${encodeURIComponent(currentUrl)}`,
    };

    const link = deepLinks[walletType];
    if (link) {
      console.log(`📱 Opening ${walletType} with deep link:`, link);
      window.location.href = link;
    }
  };

  // Enhanced mobile browser detection - check if we're in a wallet's dApp browser
  const isMobileBrowser = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isInDappBrowser = !!window.ethereum; // If ethereum is injected, we're in a dApp browser
  const needsDeepLink = isMobileBrowser && !isInDappBrowser; // Mobile browser without wallet injection

  // Format balance with currency conversion
  const formatBalanceWithCurrency = (balance, tokenType = 'dtgc') => {
    const numBalance = parseFloat(balance) || 0;

    if (displayCurrency === 'units') {
      return `${formatNumber(numBalance)} ${tokenType.toUpperCase()}`;
    }

    let priceUsd = 0;
    switch (tokenType.toLowerCase()) {
      case 'dtgc':
        priceUsd = livePrices.dtgc || 0;
        break;
      case 'urmom':
        priceUsd = livePrices.urmom || 0;
        break;
      case 'pls':
        priceUsd = 0.00003; // Approximate PLS price
        break;
      case 'lp':
        priceUsd = livePrices.dtgc * 2 || 0; // LP token approximate value
        break;
      default:
        priceUsd = 0;
    }

    const valueUsd = numBalance * priceUsd;

    switch (displayCurrency) {
      case 'usd':
        return `$${valueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'eur':
        return `€${(valueUsd * CURRENCY_RATES.EUR).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'gbp':
        return `£${(valueUsd * CURRENCY_RATES.GBP).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'jpy':
        return `¥${(valueUsd * CURRENCY_RATES.JPY).toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'sar':
        return `﷼${(valueUsd * CURRENCY_RATES.SAR).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'cny':
        return `¥${(valueUsd * CURRENCY_RATES.CNY).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'czk':
        return `Kč${(valueUsd * CURRENCY_RATES.CZK).toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'aud':
        return `A$${(valueUsd * CURRENCY_RATES.AUD).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case 'ngn':
        return `₦${(valueUsd * CURRENCY_RATES.NGN).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'cop':
        return `$${(valueUsd * CURRENCY_RATES.COP).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      case 'cad':
        return `C$${(valueUsd * CURRENCY_RATES.CAD).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      default:
        return `${formatNumber(numBalance)} ${tokenType.toUpperCase()}`;
    }
  };

  // Helper function to convert USD to selected currency
  const convertToCurrency = (valueUsd) => {
    switch (displayCurrency) {
      case 'usd': return { value: valueUsd, symbol: '$', code: 'USD' };
      case 'eur': return { value: valueUsd * CURRENCY_RATES.EUR, symbol: '€', code: 'EUR' };
      case 'gbp': return { value: valueUsd * CURRENCY_RATES.GBP, symbol: '£', code: 'GBP' };
      case 'jpy': return { value: valueUsd * CURRENCY_RATES.JPY, symbol: '¥', code: 'JPY' };
      case 'sar': return { value: valueUsd * CURRENCY_RATES.SAR, symbol: '﷼', code: 'SAR' };
      case 'cny': return { value: valueUsd * CURRENCY_RATES.CNY, symbol: '¥', code: 'CNY' };
      case 'czk': return { value: valueUsd * CURRENCY_RATES.CZK, symbol: 'Kč', code: 'CZK' };
      case 'aud': return { value: valueUsd * CURRENCY_RATES.AUD, symbol: 'A$', code: 'AUD' };
      case 'ngn': return { value: valueUsd * CURRENCY_RATES.NGN, symbol: '₦', code: 'NGN' };
      case 'cop': return { value: valueUsd * CURRENCY_RATES.COP, symbol: '$', code: 'COP' };
      case 'cad': return { value: valueUsd * CURRENCY_RATES.CAD, symbol: 'C$', code: 'CAD' };
      default: return { value: valueUsd, symbol: '$', code: 'USD' };
    }
  };

  // Helper function to convert from selected currency to USD
  const convertFromCurrency = (value) => {
    switch (displayCurrency) {
      case 'eur': return value / CURRENCY_RATES.EUR;
      case 'gbp': return value / CURRENCY_RATES.GBP;
      case 'jpy': return value / CURRENCY_RATES.JPY;
      case 'sar': return value / CURRENCY_RATES.SAR;
      case 'cny': return value / CURRENCY_RATES.CNY;
      case 'czk': return value / CURRENCY_RATES.CZK;
      case 'aud': return value / CURRENCY_RATES.AUD;
      case 'ngn': return value / CURRENCY_RATES.NGN;
      case 'cop': return value / CURRENCY_RATES.COP;
      case 'cad': return value / CURRENCY_RATES.CAD;
      default: return value;
    }
  };

  // Get currency symbol
  const getCurrencySymbol = () => {
    switch (displayCurrency) {
      case 'usd': return '$';
      case 'eur': return '€';
      case 'gbp': return '£';
      case 'jpy': return '¥';
      case 'sar': return '﷼';
      case 'cny': return '¥';
      case 'czk': return 'Kč';
      case 'aud': return 'A$';
      case 'ngn': return '₦';
      case 'cop': return '$';
      case 'cad': return 'C$';
      default: return '$';
    }
  };

  // Toggle currency display
  const toggleCurrencyDisplay = () => {
    const currencies = ['units', 'usd', 'eur', 'gbp', 'jpy', 'sar', 'cny', 'czk', 'aud', 'ngn', 'cop', 'cad'];
    const currentIndex = currencies.indexOf(displayCurrency);
    const nextCurrency = currencies[(currentIndex + 1) % currencies.length];
    setDisplayCurrency(nextCurrency);
    localStorage.setItem('dtgc-display-currency', nextCurrency);
  };

  // Fetch mainnet balances when account connects
  useEffect(() => {
    const fetchMainnetBalances = async () => {
      if (TESTNET_MODE || !account || !provider) return;

      try {
        // Get PLS balance
        const plsBal = await provider.getBalance(account);
        setPlsBalance(ethers.formatEther(plsBal));

        // Get DTGC balance
        const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
        const dtgcBal = await dtgcContract.balanceOf(account);
        setDtgcBalance(ethers.formatEther(dtgcBal));

        // Get URMOM balance
        const urmomContract = new ethers.Contract(CONTRACTS.URMOM, ERC20_ABI, provider);
        const urmomBal = await urmomContract.balanceOf(account);
        setUrmomBalance(ethers.formatEther(urmomBal));

        // Get DTGC/PLS LP balance (Diamond tier)
        let lpPlsBal = 0n;
        try {
          const lpPlsContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcPls, ERC20_ABI, provider);
          lpPlsBal = await lpPlsContract.balanceOf(account);
          setLpDtgcPlsBalance(ethers.formatEther(lpPlsBal));
        } catch (e) {
          console.warn('Could not fetch DTGC/PLS LP balance:', e);
          setLpDtgcPlsBalance('0');
        }

        // Get DTGC/URMOM LP balance (Diamond+ tier)
        let lpUrmomBal = 0n;
        try {
          const lpUrmomContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcUrmom, ERC20_ABI, provider);
          lpUrmomBal = await lpUrmomContract.balanceOf(account);
          setLpDtgcUrmomBalance(ethers.formatEther(lpUrmomBal));
          setLpBalance(ethers.formatEther(lpUrmomBal)); // Keep legacy for compatibility
        } catch (e) {
          console.warn('Could not fetch DTGC/URMOM LP balance:', e);
          setLpDtgcUrmomBalance('0');
        }

        // Get Staking Contract Rewards Remaining (DTGC balance in V4 staking contract)
        try {
          const stakingRewards = await dtgcContract.balanceOf(CONTRACT_ADDRESSES.stakingV4);
          setStakingRewardsRemaining(ethers.formatEther(stakingRewards));
        } catch (e) {
          console.warn('Could not fetch staking rewards:', e);
          setStakingRewardsRemaining('0');
        }

        // Get LP Staking Contract Rewards Remaining (DTGC balance in V4 LP staking contract)
        try {
          const lpStakingRewards = await dtgcContract.balanceOf(CONTRACT_ADDRESSES.lpStakingV4);
          setLpStakingRewardsRemaining(ethers.formatEther(lpStakingRewards));
        } catch (e) {
          console.warn('Could not fetch LP staking rewards:', e);
          setLpStakingRewardsRemaining('0');
        }

        console.log('📊 Mainnet balances loaded:', {
          pls: ethers.formatEther(plsBal),
          dtgc: ethers.formatEther(dtgcBal),
          urmom: ethers.formatEther(urmomBal),
          lpDtgcPls: ethers.formatEther(lpPlsBal || 0n),
          lpDtgcUrmom: ethers.formatEther(lpUrmomBal || 0n)
        });
      } catch (err) {
        console.error('Failed to fetch balances:', err);
      }
    };

    fetchMainnetBalances();

    // Refresh balances every 30 seconds
    const interval = setInterval(fetchMainnetBalances, 30000);
    return () => clearInterval(interval);
  }, [account, provider]);

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) <= 0) return;

    // Convert currency to tokens if in currency mode
    let amount = parseFloat(stakeAmount);
    if (stakeInputMode === 'currency') {
      const priceUsd = livePrices.dtgc || 0;
      if (priceUsd <= 0) {
        showToast('Unable to get token price. Please try again.', 'error');
        return;
      }
      // Convert currency to USD first, then to tokens
      const valueUsd = convertFromCurrency(amount);
      amount = valueUsd / priceUsd;
    }

    const tierData = selectedTier === 4 ? V5_DIAMOND_PLUS_TIER : (selectedTier === 3 ? V5_DIAMOND_TIER : V5_STAKING_TIERS[selectedTier]);
    
    // Calculate USD value for min/max checks
    const priceUsd = livePrices.dtgc || 0;
    const valueUsd = amount * priceUsd;
    
    // Check minimum stake requirement
    if (valueUsd < tierData.minInvest) {
      showToast(`Minimum stake for ${tierData.name} is $${tierData.minInvest.toLocaleString()}`, 'error');
      return;
    }
    
    // Check maximum stake requirement (Whale tier only)
    if (tierData.maxInvest && valueUsd > tierData.maxInvest) {
      showToast(`Maximum stake for ${tierData.name} is $${tierData.maxInvest.toLocaleString()}`, 'error');
      return;
    }

    // TESTNET MODE - Simulate staking
    if (TESTNET_MODE) {
      const getBalance = () => {
        if (!isLP) return parseFloat(dtgcBalance);
        return selectedTier === 4 ? parseFloat(lpDtgcUrmomBalance) : parseFloat(lpDtgcPlsBalance);
      };
      const getLpName = () => {
        if (!isLP) return 'DTGC';
        return selectedTier === 4 ? 'DTGC/URMOM LP' : 'DTGC/PLS LP';
      };
      const balance = getBalance();

      if (amount > balance) {
        showToast(`Insufficient ${getLpName()} balance!`, 'error');
        return;
      }
      
      // Show stake video if enabled
      if (VIDEOS_ENABLED) {
        setStakingTierName(tierData.name);
        setShowStakeVideo(true);
      }
      
      // Show start modal
      setModalType('start');
      setModalOpen(true);
      setLoading(true);
      
      // Simulate transaction delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Calculate fee (5% entry fee - V5)
      const fee = amount * (V5_FEES.entryFee / 100);
      const stakedAmount = amount - fee;
      
      // Create position
      const newPosition = {
        id: Date.now(),
        tier: tierData.name,
        amount: stakedAmount,
        isLP: isLP,
        apr: tierData.apr,
        lockDays: tierData.lockDays,
        startTime: Date.now(),
        endTime: Date.now() + (tierData.lockDays * 24 * 60 * 60 * 1000),
        rewards: 0,
      };
      
      // Update balances
      const newBalances = {
        ...testnetBalances,
        dtgc: isLP ? testnetBalances.dtgc : testnetBalances.dtgc - amount,
        lp: isLP ? testnetBalances.lp - amount : testnetBalances.lp,
        stakedDTGC: isLP ? testnetBalances.stakedDTGC : testnetBalances.stakedDTGC + stakedAmount,
        stakedLP: isLP ? testnetBalances.stakedLP + stakedAmount : testnetBalances.stakedLP,
        positions: [...(testnetBalances.positions || []), newPosition],
      };
      
      setTestnetBalances(newBalances);
      localStorage.setItem('dtgc-testnet-balances', JSON.stringify(newBalances));
      
      setLoading(false);
      setModalType('end');
      setStakeAmount('');
      setStakeInputMode('tokens');
      showToast(`✅ Staked ${formatNumber(stakedAmount)} ${isLP ? 'LP' : 'DTGC'} in ${tierData.name} tier!`, 'success');
      return;
    }

    // MAINNET - Real staking
    if (!signer || !account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    // Check balance before proceeding
    const walletBalance = isLP 
      ? (selectedTier === 4 ? parseFloat(lpDtgcUrmomBalance) : parseFloat(lpDtgcPlsBalance))
      : parseFloat(dtgcBalance);
    
    if (walletBalance <= 0) {
      showToast(`❌ You have no ${isLP ? (selectedTier === 4 ? 'DTGC/URMOM LP' : 'DTGC/PLS LP') : 'DTGC'} tokens to stake!`, 'error');
      return;
    }
    
    if (amount > walletBalance) {
      showToast(`❌ Insufficient balance! You have ${formatNumber(walletBalance)} ${isLP ? 'LP' : 'DTGC'}`, 'error');
      return;
    }

    // NOTE: Multiple stakes allowed - contract will handle if there are restrictions
    // Previously blocked LP stakes if existing - now letting contract decide
    if (isLP) {
      const existingLpStake = stakedPositions.find(p => p.isLP);
      if (existingLpStake) {
        console.log('ℹ️ User has existing LP stake, attempting to add another:', existingLpStake);
        // Don't block - let contract handle it
      }
    }

    console.log('💰 Pre-flight checks passed:', { 
      walletBalance, 
      stakingAmount: amount, 
      isLP, 
      selectedTier,
      tokenType: isLP ? (selectedTier === 4 ? 'DTGC/URMOM LP' : 'DTGC/PLS LP') : 'DTGC',
      existingPositions: stakedPositions.length
    });

    try {
      setLoading(true);
      setModalType('start');
      setModalOpen(true);

      const amountWei = ethers.parseEther(amount.toString());

      // Determine which token and contract to use
      let tokenAddress;
      if (isLP) {
        // Use correct LP token based on tier
        tokenAddress = selectedTier === 4 ? CONTRACT_ADDRESSES.lpDtgcUrmom : CONTRACT_ADDRESSES.lpDtgcPls;
      } else {
        tokenAddress = CONTRACTS.DTGC;
      }
      
      // ═══════════════════════════════════════════════════════════════
      // V4 vs V3 CONTRACT SELECTION
      // ═══════════════════════════════════════════════════════════════
      let stakingAddress;
      let stakingABI;
      const useV4 = USE_V4_CONTRACTS && (isLP 
        ? CONTRACT_ADDRESSES.lpStakingV4 !== '0x0000000000000000000000000000000000000000'
        : CONTRACT_ADDRESSES.stakingV4 !== '0x0000000000000000000000000000000000000000');
      
      if (useV4) {
        console.log('🚀 Using V4 contracts (unlimited multi-stake)');
        stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV4 : CONTRACT_ADDRESSES.stakingV4;
        stakingABI = isLP ? LP_STAKING_V4_ABI : STAKING_V4_ABI;
      } else {
        console.log('📦 Using V3 contracts (single stake per type)');
        stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
        stakingABI = isLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;
      }

      console.log('🔄 Starting stake process...', { 
        tokenAddress, 
        stakingAddress, 
        amount, 
        amountWei: amountWei.toString(),
        isLP: isLP,
        selectedTier: selectedTier,
        tierName: tierData.name
      });

      // Step 1: Check and approve token spending
      showToast('Step 1/2: Checking approval...', 'info');
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const currentAllowance = await tokenContract.allowance(account, stakingAddress);
      console.log('📋 Current allowance:', currentAllowance.toString());
      
      if (currentAllowance < amountWei) {
        console.log('🔓 Requesting token approval...');
        showToast('Step 1/2: Approve tokens in wallet...', 'info');
        const approveTx = await tokenContract.approve(stakingAddress, ethers.MaxUint256);
        console.log('⏳ Approval tx sent:', approveTx.hash);
        await approveTx.wait();
        console.log('✅ Approval confirmed!');
        showToast('Token approval confirmed!', 'success');
      } else {
        console.log('✅ Already approved, skipping approval step');
      }

      // Step 2: Stake tokens
      console.log('🔄 Sending stake transaction...');
      showToast('Step 2/2: Confirm stake in wallet...', 'info');
      const stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
      console.log('📜 Contract address:', stakingAddress);

      // Get current gas price and apply speed multiplier
      const gasSpeedMultipliers = { normal: 100n, fast: 150n, urgent: 200n };
      const multiplier = gasSpeedMultipliers[gasSpeed] || 150n;
      let gasPrice;
      try {
        const feeData = await provider.getFeeData();
        const baseGasPrice = feeData.gasPrice || 0n;
        gasPrice = (baseGasPrice * multiplier) / 100n;
        console.log(`⛽ Gas price: ${ethers.formatUnits(baseGasPrice, 'gwei')} gwei → ${gasSpeed} (${multiplier}%) → ${ethers.formatUnits(gasPrice, 'gwei')} gwei`);
      } catch (e) {
        console.warn('Could not get gas price, using default');
        gasPrice = undefined; // Let wallet decide
      }

      let stakeTx;
      try {
        if (isLP) {
          // LP Staking - amount and lpType (0=Diamond/PLS, 1=Diamond+/URMOM)
          const lpType = selectedTier === 4 ? 1 : 0; // Diamond+ = 1, Diamond = 0
          console.log('📤 LP Stake params:', { amount: amountWei.toString(), lpType, contract: stakingAddress, gasSpeed });
          
          // Estimate gas and add 50% buffer for safety
          let gasLimit = 300000n; // Default fallback
          try {
            const gasEstimate = await stakingContract.stake.estimateGas(amountWei, lpType);
            gasLimit = (gasEstimate * 150n) / 100n; // Add 50% buffer
            console.log('⛽ Gas estimate:', gasEstimate.toString(), '→ Using limit:', gasLimit.toString());
          } catch (gasErr) {
            console.error('⛽ Gas estimation failed - transaction will likely revert!');
            console.error('⛽ Error:', gasErr.message || gasErr);
            console.error('⛽ Reason:', gasErr.reason || 'unknown');
            
            // Try to extract revert reason
            let revertReason = 'Unknown contract error';
            if (gasErr.reason) revertReason = gasErr.reason;
            else if (gasErr.data?.message) revertReason = gasErr.data.message;
            else if (gasErr.error?.message) revertReason = gasErr.error.message;
            else if (gasErr.message?.includes('execution reverted')) {
              const match = gasErr.message.match(/reason="([^"]+)"/);
              if (match) revertReason = match[1];
            }
            
            showToast(`❌ Contract rejected: ${revertReason}`, 'error');
            setLoading(false);
            return;
          }
          
          console.log('📤 Calling stake function with explicit gas... (waiting for wallet response)');
          
          // Build transaction options with gas price for speed
          const txOptions = { gasLimit };
          if (gasPrice) txOptions.gasPrice = gasPrice;
          
          // Wrap in timeout to handle wallets that don't return properly
          const stakePromise = stakingContract.stake(amountWei, lpType, txOptions);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT_CHECK_CHAIN')), 120000) // 2 min timeout
          );
          
          try {
            stakeTx = await Promise.race([stakePromise, timeoutPromise]);
            console.log('✅ Stake call returned successfully');
          } catch (raceErr) {
            if (raceErr.message === 'TIMEOUT_CHECK_CHAIN') {
              console.warn('⚠️ Wallet response timeout - transaction may have succeeded!');
              showToast('⚠️ Wallet timeout - check your wallet/blockchain for tx status', 'warning');
              setLoading(false);
              setModalOpen(false);
              // Refresh balances to check if stake went through
              setTimeout(async () => {
                try {
                  if (selectedTier === 4) {
                    const lpUrmomContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcUrmom, ERC20_ABI, provider);
                    const lpBal = await lpUrmomContract.balanceOf(account);
                    setLpDtgcUrmomBalance(ethers.formatEther(lpBal));
                  } else {
                    const lpPlsContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcPls, ERC20_ABI, provider);
                    const lpBal = await lpPlsContract.balanceOf(account);
                    setLpDtgcPlsBalance(ethers.formatEther(lpBal));
                  }
                } catch (e) { console.warn('Balance refresh error:', e); }
              }, 3000);
              return;
            }
            throw raceErr;
          }
        } else {
          // Regular Staking - amount and tier
          console.log('📤 Stake params:', { amount: amountWei.toString(), tier: selectedTier, contract: stakingAddress, gasSpeed });
          
          // Estimate gas and add 50% buffer for safety
          let gasLimit = 250000n; // Default fallback
          try {
            const gasEstimate = await stakingContract.stake.estimateGas(amountWei, selectedTier);
            gasLimit = (gasEstimate * 150n) / 100n; // Add 50% buffer
            console.log('⛽ Gas estimate:', gasEstimate.toString(), '→ Using limit:', gasLimit.toString());
          } catch (gasErr) {
            console.error('⛽ Gas estimation failed - transaction will likely revert!');
            console.error('⛽ Error:', gasErr.message || gasErr);
            
            // Try to extract revert reason
            let revertReason = 'Unknown contract error';
            if (gasErr.reason) revertReason = gasErr.reason;
            else if (gasErr.data?.message) revertReason = gasErr.data.message;
            else if (gasErr.error?.message) revertReason = gasErr.error.message;
            else if (gasErr.message?.includes('execution reverted')) {
              const match = gasErr.message.match(/reason="([^"]+)"/);
              if (match) revertReason = match[1];
            }
            
            showToast(`❌ Contract rejected: ${revertReason}`, 'error');
            setLoading(false);
            return;
          }
          
          // Build transaction options with gas price for speed
          const txOptions = { gasLimit };
          if (gasPrice) txOptions.gasPrice = gasPrice;
          
          console.log('📤 Calling stake function with explicit gas... (waiting for wallet response)');
          stakeTx = await stakingContract.stake(amountWei, selectedTier, txOptions);
          console.log('✅ Stake call returned successfully');
        }
      } catch (stakeCallErr) {
        console.error('❌ Stake call failed:', stakeCallErr);
        console.error('❌ Error code:', stakeCallErr.code);
        console.error('❌ Error reason:', stakeCallErr.reason);
        throw stakeCallErr;
      }

      console.log('⏳ Stake tx sent:', stakeTx.hash);
      showToast(`Transaction sent! Hash: ${stakeTx.hash.slice(0,10)}...`, 'info');
      
      await stakeTx.wait();
      console.log('✅ Stake confirmed!');

      // Show stake video if enabled
      if (VIDEOS_ENABLED) {
        setStakingTierName(tierData.name);
        setShowStakeVideo(true);
      }

      setLoading(false);
      setModalType('end');
      setStakeAmount('');
      setStakeInputMode('tokens');
      showToast(`✅ Successfully staked ${formatNumber(amount)} ${isLP ? 'LP' : 'DTGC'} in ${tierData.name} tier!`, 'success');

      // Refresh balances
      try {
        const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
        const dtgcBal = await dtgcContract.balanceOf(account);
        setDtgcBalance(ethers.formatEther(dtgcBal));

        // Refresh correct LP balance based on tier
        if (isLP) {
          if (selectedTier === 4) {
            // Diamond+ (DTGC/URMOM LP)
            const lpUrmomContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcUrmom, ERC20_ABI, provider);
            const lpBal = await lpUrmomContract.balanceOf(account);
            setLpDtgcUrmomBalance(ethers.formatEther(lpBal));
          } else {
            // Diamond (DTGC/PLS LP)
            const lpPlsContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcPls, ERC20_ABI, provider);
            const lpBal = await lpPlsContract.balanceOf(account);
            setLpDtgcPlsBalance(ethers.formatEther(lpBal));
          }
        }
      } catch (refreshErr) {
        console.warn('Balance refresh error:', refreshErr);
      }

      // Close modal after short delay to show success
      setTimeout(() => {
        setModalOpen(false);
      }, 1500);

    } catch (err) {
      console.error('❌ Staking error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      setLoading(false);
      setModalOpen(false);

      // Parse error for user-friendly message
      console.error('❌ Full stake error:', err);
      
      let errorMessage = 'Unknown error';
      
      // Check for common error patterns
      if (err.code === 'ACTION_REJECTED' || err.code === 4001) {
        showToast('Transaction rejected by user', 'info');
        return;
      } else if (err.message?.includes('user rejected')) {
        showToast('Transaction cancelled', 'info');
        return;
      } else if (err.code === -32002) {
        showToast('Please check your wallet for pending request', 'info');
        return;
      }
      
      // Try to extract revert reason
      if (err.reason) {
        errorMessage = err.reason;
      } else if (err.data?.message) {
        errorMessage = err.data.message;
      } else if (err.error?.message) {
        errorMessage = err.error.message;
      } else if (err.message) {
        // Parse common contract revert messages
        const msg = err.message.toLowerCase();
        if (msg.includes('already staked') || msg.includes('active stake')) {
          errorMessage = 'You already have an active stake in this tier';
        } else if (msg.includes('insufficient') || msg.includes('exceeds balance')) {
          errorMessage = 'Insufficient token balance';
        } else if (msg.includes('not enough') || msg.includes('empty')) {
          errorMessage = 'Reward pool may be empty - contact admin';
        } else if (msg.includes('paused')) {
          errorMessage = 'Contract is currently paused';
        } else if (msg.includes('minimum')) {
          errorMessage = 'Amount below minimum stake requirement';
        } else if (msg.includes('transfer failed')) {
          errorMessage = 'Token transfer failed - check approval';
        } else {
          errorMessage = err.message.slice(0, 80);
        }
      }
      
      showToast(`❌ Staking failed: ${errorMessage}`, 'error');
    }
  };

  // Unstake function
  const handleUnstake = async (positionId) => {
    // TESTNET MODE
    if (TESTNET_MODE) {
      const position = testnetBalances.positions.find(p => p.id === positionId);
      if (!position) return;

      const now = Date.now();
      const isEarly = now < position.endTime;

      // Calculate penalty if early
      const penalty = isEarly ? position.amount * 0.20 : position.amount * 0.05;
      const returnAmount = position.amount - penalty;

      // Calculate rewards (simplified: APR / 365 * days staked)
      const daysStaked = (now - position.startTime) / (24 * 60 * 60 * 1000);
      const rewards = (position.amount * (position.apr / 100) / 365) * daysStaked;

      // Save to stake history before removing
      const historyEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        tier: position.tier || 'GOLD',
        amount: position.amount,
        startTime: position.startTime,
        endTime: now,
        apr: position.apr,
        rewards: rewards,
        penalty: isEarly ? penalty : 0,
        returnAmount: returnAmount + rewards,
        isLP: position.isLP,
        exitType: isEarly ? 'early' : 'normal',
        wallet: account,
      };
      
      const existingHistory = JSON.parse(localStorage.getItem('dtgc-stake-history') || '[]');
      existingHistory.unshift(historyEntry);
      localStorage.setItem('dtgc-stake-history', JSON.stringify(existingHistory.slice(0, 50))); // Keep last 50
      setStakeHistory(existingHistory.slice(0, 50));

      const newBalances = {
        ...testnetBalances,
        dtgc: position.isLP ? testnetBalances.dtgc + rewards : testnetBalances.dtgc + returnAmount + rewards,
        lp: position.isLP ? testnetBalances.lp + returnAmount : testnetBalances.lp,
        stakedDTGC: position.isLP ? testnetBalances.stakedDTGC : testnetBalances.stakedDTGC - position.amount,
        stakedLP: position.isLP ? testnetBalances.stakedLP - position.amount : testnetBalances.stakedLP,
        positions: testnetBalances.positions.filter(p => p.id !== positionId),
      };

      setTestnetBalances(newBalances);
      localStorage.setItem('dtgc-testnet-balances', JSON.stringify(newBalances));

      showToast(`✅ Unstaked! Received ${formatNumber(returnAmount)} + ${formatNumber(rewards)} rewards${isEarly ? ' (20% early exit fee)' : ''}`, 'success');
      return;
    }

    // MAINNET - Real unstaking
    if (!signer || !account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      // Save current position to history before unstaking
      const currentPosition = stakedPositions.find(p => p.id === positionId) || stakedPositions[0];
      
      setLoading(true);
      showToast('Processing withdrawal...', 'info');

      // Determine if this is LP or regular staking based on positionId
      const isLP = positionId?.includes('lp-stake') || currentPosition?.isLP;
      const isV4 = currentPosition?.isV4 || false;
      const stakeIndex = currentPosition?.stakeIndex ?? 0;
      
      let stakingContract;
      let tx;
      
      // ═══════════════════════════════════════════════════════════════
      // V4 WITHDRAW (with stakeIndex)
      // ═══════════════════════════════════════════════════════════════
      if (isV4 && USE_V4_CONTRACTS) {
        console.log('🚀 V4 Withdraw - stakeIndex:', stakeIndex, 'isLP:', isLP);
        const stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV4 : CONTRACT_ADDRESSES.stakingV4;
        const stakingABI = isLP ? LP_STAKING_V4_ABI : STAKING_V4_ABI;
        stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
        tx = await stakingContract.withdraw(stakeIndex);
      } else {
        // ═══════════════════════════════════════════════════════════════
        // V3 WITHDRAW (no index)
        // ═══════════════════════════════════════════════════════════════
        console.log('📦 V3 Withdraw - isLP:', isLP);
        const stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
        const stakingABI = isLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;
        stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
        tx = await stakingContract.withdraw();
      }
      
      await tx.wait();

      // Save to stake history
      if (currentPosition) {
        const now = Date.now();
        const daysStaked = Math.max(0, (now - currentPosition.startTime) / (24 * 60 * 60 * 1000));
        const rewards = (currentPosition.amount * (currentPosition.apr / 100) / 365) * daysStaked;
        
        const historyEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tier: currentPosition.tierName || currentPosition.tier || 'GOLD',
          amount: currentPosition.amount,
          startTime: currentPosition.startTime,
          endTime: now,
          apr: currentPosition.apr,
          rewards: rewards,
          penalty: 0,
          returnAmount: currentPosition.amount + rewards,
          isLP: currentPosition.isLP,
          exitType: 'normal',
          wallet: account,
          txHash: tx.hash,
        };
        
        const existingHistory = JSON.parse(localStorage.getItem('dtgc-stake-history') || '[]');
        existingHistory.unshift(historyEntry);
        localStorage.setItem('dtgc-stake-history', JSON.stringify(existingHistory.slice(0, 50)));
        setStakeHistory(existingHistory.slice(0, 50));
      }

      // Clear the position immediately from UI
      removeStakeFromUI(positionId);
      
      setLoading(false);
      showToast('✅ Successfully withdrawn! Check Gold Records for history.', 'success');

      // Refresh balances
      const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(account);
      setDtgcBalance(ethers.formatEther(dtgcBal));

    } catch (err) {
      console.error('Unstake error:', err);
      setLoading(false);

      if (err.code === 'ACTION_REJECTED') {
        showToast('Transaction rejected by user', 'error');
      } else if (err.message?.includes('locked')) {
        showToast('Position is still locked! Use Emergency Withdraw (20% fee)', 'error');
      } else {
        // Generic error - don't clear positions, just show error
        const errorMsg = err.message?.toLowerCase() || '';
        if (errorMsg.includes('revert') || errorMsg.includes('estimategas') || errorMsg.includes('no position')) {
          showToast('⚠️ Stake not found on contract. It may have already been withdrawn.', 'info');
          // Only remove THIS specific position, not all
          if (positionId) {
            setStakedPositions(prev => prev.filter(p => p.id !== positionId));
          }
        } else {
          showToast(`Withdrawal failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
        }
      }
    }
  };

  // Emergency withdraw (early exit with penalty)
  const handleEmergencyWithdraw = async (isLP = false, positionId = null) => {
    if (!signer || !account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      // Find current position - support both old isLP method and new positionId method
      const currentPosition = positionId 
        ? stakedPositions.find(p => p.id === positionId)
        : stakedPositions.find(p => p.isLP === isLP);
      
      setLoading(true);
      showToast('Processing emergency withdrawal (20% fee)...', 'info');

      const isV4 = currentPosition?.isV4 || false;
      const stakeIndex = currentPosition?.stakeIndex ?? 0;
      const actualIsLP = currentPosition?.isLP ?? isLP;
      
      let stakingContract;
      let tx;
      
      // ═══════════════════════════════════════════════════════════════
      // V4 EMERGENCY WITHDRAW (with stakeIndex)
      // ═══════════════════════════════════════════════════════════════
      if (isV4 && USE_V4_CONTRACTS) {
        console.log('🚀 V4 Emergency Withdraw - stakeIndex:', stakeIndex, 'isLP:', actualIsLP);
        const stakingAddress = actualIsLP ? CONTRACT_ADDRESSES.lpStakingV4 : CONTRACT_ADDRESSES.stakingV4;
        const stakingABI = actualIsLP ? LP_STAKING_V4_ABI : STAKING_V4_ABI;
        stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
        tx = await stakingContract.emergencyWithdraw(stakeIndex);
      } else {
        // ═══════════════════════════════════════════════════════════════
        // V3 EMERGENCY WITHDRAW (no index)
        // ═══════════════════════════════════════════════════════════════
        console.log('📦 V3 Emergency Withdraw - isLP:', actualIsLP);
        const stakingAddress = actualIsLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
        const stakingABI = actualIsLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;
        stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
        tx = await stakingContract.emergencyWithdraw();
      }
      
      await tx.wait();

      // Save to stake history with penalty
      if (currentPosition) {
        const now = Date.now();
        const daysStaked = Math.max(0, (now - currentPosition.startTime) / (24 * 60 * 60 * 1000));
        const rewards = (currentPosition.amount * (currentPosition.apr / 100) / 365) * daysStaked;
        const penalty = currentPosition.amount * 0.20; // 20% EES fee
        
        const historyEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tier: currentPosition.tierName || currentPosition.tier || (isLP ? 'DIAMOND' : 'GOLD'),
          amount: currentPosition.amount,
          startTime: currentPosition.startTime,
          endTime: now,
          apr: currentPosition.apr,
          rewards: rewards,
          penalty: penalty,
          returnAmount: currentPosition.amount - penalty + rewards,
          isLP: isLP,
          exitType: 'emergency',
          wallet: account,
          txHash: tx.hash,
        };
        
        const existingHistory = JSON.parse(localStorage.getItem('dtgc-stake-history') || '[]');
        existingHistory.unshift(historyEntry);
        localStorage.setItem('dtgc-stake-history', JSON.stringify(existingHistory.slice(0, 50)));
        setStakeHistory(existingHistory.slice(0, 50));
      }

      // Clear position from state and mark as withdrawn
      // Clear position from UI
      const stakeIdToRemove = currentPosition?.id || positionId;
      if (stakeIdToRemove) {
        removeStakeFromUI(stakeIdToRemove);
      }

      setLoading(false);
      showToast('✅ Emergency withdrawal complete (20% fee applied). Check Gold Records.', 'success');

      // Refresh balances
      const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(account);
      setDtgcBalance(ethers.formatEther(dtgcBal));

    } catch (err) {
      console.error('Emergency withdraw error:', err);
      setLoading(false);
      
      // Detect "no position" or "nothing to withdraw" errors - means stale UI data
      const errorMsg = (err.message || '').toLowerCase();
      const errorData = (err.data || '').toLowerCase();
      const isNoPositionError = errorMsg.includes('revert') || 
                                errorMsg.includes('estimategas') || 
                                errorMsg.includes('no position') || 
                                errorMsg.includes('nothing') ||
                                errorMsg.includes('missing') ||
                                errorData.includes('revert') ||
                                err.code === 'CALL_EXCEPTION' ||
                                err.code === 'UNPREDICTABLE_GAS_LIMIT';
      
      if (isNoPositionError && positionId) {
        showToast('⚠️ No active stake found. Removing stale entry from UI...', 'info');
        // Only remove THIS specific position, not all of them
        setStakedPositions(prev => prev.filter(p => p.id !== positionId));
        setTimeout(() => {
          showToast('✅ Stale entry removed. Stake may have already been withdrawn.', 'success');
        }, 1500);
      } else if (isNoPositionError) {
        showToast('⚠️ Stake not found on contract. Please refresh the page.', 'info');
        // Don't clear all positions - user should refresh
      } else {
        showToast(`Emergency withdrawal failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
      }
    }
  };

  // Claim rewards function (V4: claim without unstaking!)
  const handleClaimRewards = async (isLP = false, positionId = null) => {
    if (!signer || !account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      // Find current position
      const currentPosition = positionId 
        ? stakedPositions.find(p => p.id === positionId)
        : stakedPositions.find(p => p.isLP === isLP);
      
      const isV4 = currentPosition?.isV4 || false;
      const stakeIndex = currentPosition?.stakeIndex ?? 0;
      const actualIsLP = currentPosition?.isLP ?? isLP;
      
      setLoading(true);
      showToast('Claiming rewards...', 'info');

      let stakingContract;
      let tx;
      
      // ═══════════════════════════════════════════════════════════════
      // V4 CLAIM REWARDS (with stakeIndex - keeps stake active!)
      // ═══════════════════════════════════════════════════════════════
      if (isV4 && USE_V4_CONTRACTS) {
        console.log('🚀 V4 Claim Rewards - stakeIndex:', stakeIndex, 'isLP:', actualIsLP);
        const stakingAddress = actualIsLP ? CONTRACT_ADDRESSES.lpStakingV4 : CONTRACT_ADDRESSES.stakingV4;
        const stakingABI = actualIsLP ? LP_STAKING_V4_ABI : STAKING_V4_ABI;
        stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
        tx = await stakingContract.claimRewards(stakeIndex);
      } else {
        // ═══════════════════════════════════════════════════════════════
        // V3 CLAIM REWARDS (no index)
        // ═══════════════════════════════════════════════════════════════
        console.log('📦 V3 Claim Rewards - isLP:', actualIsLP);
        const stakingAddress = actualIsLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
        const stakingABI = actualIsLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;
        stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);
        tx = await stakingContract.claimRewards();
      }
      
      await tx.wait();

      setLoading(false);
      showToast('✅ Rewards claimed successfully!', 'success');

      // Refresh DTGC balance
      const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(account);
      setDtgcBalance(ethers.formatEther(dtgcBal));
      
      // Re-fetch positions to update rewards display
      setTimeout(() => fetchStakedPosition(), 2000);

    } catch (err) {
      console.error('Claim rewards error:', err);
      setLoading(false);

      if (err.code === 'ACTION_REJECTED') {
        showToast('Transaction rejected by user', 'error');
      } else if (err.message?.includes('no rewards')) {
        showToast('No rewards to claim yet', 'info');
      } else {
        showToast(`Claim failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
      }
    }
  };

  // Force clear ALL stale stake data
  const forceClearStaleData = () => {
    console.log('🧹 Force clearing all stale stake data...');
    setStakedPositions([]);
    setFlexStakes([]);
    setSidebarKey(prev => prev + 1);
    localStorage.removeItem('dtgc-testnet-balances');
    localStorage.removeItem('dtgc-stake-history');
    
    // Also clear testnet positions if in testnet mode
    if (TESTNET_MODE) {
      setTestnetBalances(prev => ({
        ...prev,
        positions: [],
        stakedDTGC: 0,
        stakedLP: 0,
      }));
    }
    
    showToast('✅ All stake data cleared! Refreshing...', 'success');
    
    // Re-fetch from blockchain after a delay
    if (!TESTNET_MODE && account && provider) {
      setTimeout(() => fetchStakedPosition(), 1500);
    }
  };

  // Fetch user's staked position from contract (V4 multi-stake support)
  const fetchStakedPosition = useCallback(async () => {
    if (TESTNET_MODE || !account || !provider) return;

    // RPC endpoints to try (primary + backups)
    const RPC_ENDPOINTS = [
      null, // null = use connected wallet provider first
      'https://rpc.pulsechain.com',
      'https://pulsechain-rpc.publicnode.com',
      'https://rpc-pulsechain.g4mm4.io',
    ];

    let lastError = null;
    
    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        console.log('🔍 Fetching staked positions for:', account, rpcUrl ? `(using ${rpcUrl})` : '(using wallet provider)');
        
        // Use either wallet provider or fallback RPC
        const activeProvider = rpcUrl ? new ethers.JsonRpcProvider(rpcUrl) : provider;
        
        const positions = [];
        
        // ═══════════════════════════════════════════════════════════════
        // V4 MULTI-STAKE MODE - UNLIMITED STAKES PER USER
        // ═══════════════════════════════════════════════════════════════
        if (USE_V4_CONTRACTS && CONTRACT_ADDRESSES.stakingV4 !== '0x0000000000000000000000000000000000000000') {
          console.log('🚀 V4 MULTI-STAKE ACTIVE');
          console.log('📍 DTGCStakingV4:', CONTRACT_ADDRESSES.stakingV4);
          console.log('📍 LPStakingV4:', CONTRACT_ADDRESSES.lpStakingV4);
          
          try {
            // Fetch DTGC stakes from V4
            const stakingV4 = new ethers.Contract(CONTRACT_ADDRESSES.stakingV4, STAKING_V4_ABI, activeProvider);
            const dtgcStakeCount = await stakingV4.getActiveStakeCount(account);
            console.log('📊 V4 DTGC active stake count:', dtgcStakeCount.toString());
            
            if (dtgcStakeCount > 0) {
              // Fetch all stakes at once
              const dtgcStakes = await stakingV4.getActiveStakes(account);
              console.log('📋 V4 DTGC stakes:', dtgcStakes);
              
              // Find original indices by iterating all stakes
              const allDtgcStakes = await stakingV4.getAllStakes(account);
              
              dtgcStakes.forEach((stake, activeIdx) => {
                // Find original index in allStakes
                let originalIndex = 0;
                for (let i = 0; i < allDtgcStakes.length; i++) {
                  if (allDtgcStakes[i].isActive && 
                      allDtgcStakes[i].amount.toString() === stake.amount.toString() &&
                      allDtgcStakes[i].startTime.toString() === stake.startTime.toString()) {
                    originalIndex = i;
                    break;
                  }
                }
                
                const amount = parseFloat(ethers.formatEther(stake.amount));
                const tierNum = Number(stake.tier);
                const tierNames = ['SILVER', 'GOLD', 'WHALE'];
                const tierName = tierNames[tierNum] || 'GOLD';
                const rawApr = Number(stake.aprBps) / 100;
                
                positions.push({
                  id: `dtgc-stake-${originalIndex}`,
                  stakeIndex: originalIndex, // V4: needed for withdraw
                  type: 'DTGC',
                  isLP: false,
                  amount: amount,
                  startTime: Number(stake.startTime) * 1000,
                  endTime: Number(stake.unlockTime) * 1000,
                  lockPeriod: Number(stake.lockPeriod),
                  apr: getV19CorrectedAPR(rawApr, tierName, false),
                  bonus: Number(stake.bonusBps) / 100,
                  tier: tierNum,
                  tierName: tierName,
                  isActive: stake.isActive,
                  timeRemaining: Math.max(0, Number(stake.unlockTime) - Math.floor(Date.now() / 1000)),
                  isV4: true,
                });
                console.log(`✅ Added V4 DTGC stake #${originalIndex}:`, tierName, amount);
              });
            }
            
            // Fetch LP stakes from V4
            const lpStakingV4 = new ethers.Contract(CONTRACT_ADDRESSES.lpStakingV4, LP_STAKING_V4_ABI, activeProvider);
            const lpStakeCount = await lpStakingV4.getActiveStakeCount(account);
            console.log('📊 V4 LP active stake count:', lpStakeCount.toString());
            
            if (lpStakeCount > 0) {
              const lpStakes = await lpStakingV4.getActiveStakes(account);
              console.log('📋 V4 LP stakes:', lpStakes);
              
              // Find original indices
              const allLpStakes = await lpStakingV4.getAllStakes(account);
              
              lpStakes.forEach((stake, activeIdx) => {
                // Find original index
                let originalIndex = 0;
                for (let i = 0; i < allLpStakes.length; i++) {
                  if (allLpStakes[i].isActive && 
                      allLpStakes[i].amount.toString() === stake.amount.toString() &&
                      allLpStakes[i].startTime.toString() === stake.startTime.toString()) {
                    originalIndex = i;
                    break;
                  }
                }
                
                const lpAmount = parseFloat(ethers.formatEther(stake.amount));
                const lpTypeNum = Number(stake.lpType);
                const rawLpApr = Number(stake.aprBps) / 100;
                const lockPeriodDays = Number(stake.lockPeriod) / 86400; // Convert seconds to days
                
                // Check if this is a Flex stake:
                // - APR is around 10% (9-12%)
                // - OR lock period is 0 or very short (< 1 day)
                // - OR lpType is 2 (Flex type)
                const isFlexStake = (rawLpApr >= 9 && rawLpApr <= 12) || lockPeriodDays < 1 || lpTypeNum === 2;
                
                console.log(`📊 LP Stake analysis: APR=${rawLpApr}%, lockDays=${lockPeriodDays}, lpType=${lpTypeNum}, isFlex=${isFlexStake}`);
                
                if (isFlexStake) {
                  // This is a Flex stake - add to Flex category
                  positions.push({
                    id: `v4-flex-stake-${originalIndex}`,
                    stakeIndex: originalIndex,
                    type: 'FLEX LP',
                    isLP: true,
                    isFlex: true,
                    amount: lpAmount,
                    startTime: Number(stake.startTime) * 1000,
                    endTime: 0, // No lock
                    lockPeriod: 0,
                    apr: 10,
                    bonus: 0,
                    tier: 5,
                    tierName: 'FLEX',
                    lpType: 2,
                    isActive: stake.isActive,
                    timeRemaining: 0,
                    isV4: true,
                  });
                  console.log(`✅ Added V4 FLEX stake #${originalIndex}: ${lpAmount} LP @ 10% APR`);
                } else {
                  // Regular Diamond/Diamond+ stake
                  const lpTierName = lpTypeNum === 1 ? 'DIAMOND+' : 'DIAMOND';
                  
                  positions.push({
                    id: `lp-stake-${originalIndex}`,
                    stakeIndex: originalIndex,
                    type: 'LP',
                    isLP: true,
                    isFlex: false,
                    amount: lpAmount,
                    startTime: Number(stake.startTime) * 1000,
                    endTime: Number(stake.unlockTime) * 1000,
                    lockPeriod: Number(stake.lockPeriod),
                    apr: getV19CorrectedAPR(rawLpApr, lpTierName, true),
                    boostMultiplier: Number(stake.boostBps) / 10000,
                    lpType: lpTypeNum,
                    tier: lpTierName,
                    tierName: lpTierName,
                    isActive: stake.isActive,
                    timeRemaining: Math.max(0, Number(stake.unlockTime) - Math.floor(Date.now() / 1000)),
                    isV4: true,
                  });
                  console.log(`✅ Added V4 LP stake #${originalIndex}:`, lpTierName, lpAmount);
                }
              });
            }
            
            // ═══════════════════════════════════════════════════════════════
            // V4 FLEX LP STAKES - 10% APR No Lock
            // ═══════════════════════════════════════════════════════════════
            if (CONTRACT_ADDRESSES.lpStakingFlexV4 && CONTRACT_ADDRESSES.lpStakingFlexV4 !== '0x0000000000000000000000000000000000000000') {
              try {
                console.log('💗 Fetching Flex V4 LP stakes...');
                console.log('📍 LPStakingFlexV4:', CONTRACT_ADDRESSES.lpStakingFlexV4);
                
                const flexStakingV4 = new ethers.Contract(CONTRACT_ADDRESSES.lpStakingFlexV4, LP_STAKING_FLEX_V4_ABI, activeProvider);
                const flexStakeCount = await flexStakingV4.getActiveStakeCount(account);
                console.log('📊 V4 Flex active stake count:', Number(flexStakeCount));
                
                if (Number(flexStakeCount) > 0) {
                  const flexStakes = await flexStakingV4.getActiveStakes(account);
                  console.log('📋 V4 Flex stakes:', flexStakes);
                  
                  flexStakes.forEach((stake, idx) => {
                    if (!stake.isActive && stake[3] !== true) return;
                    
                    const flexAmount = parseFloat(ethers.formatEther(stake.amount || stake[0] || 0n));
                    if (flexAmount <= 0) return;
                    
                    const flexStartTime = Number(stake.startTime || stake[1] || 0) * 1000;
                    
                    positions.push({
                      id: `v4-flex-stake-${idx}`,
                      stakeIndex: idx,
                      type: 'FLEX LP',
                      isLP: true,
                      isFlex: true,
                      amount: flexAmount,
                      startTime: flexStartTime,
                      endTime: 0, // No lock
                      lockPeriod: 0,
                      apr: 10, // 10% APR
                      bonus: 0,
                      tier: 5, // Special Flex tier
                      tierName: 'FLEX',
                      lpType: 2, // Flex type
                      isActive: true,
                      timeRemaining: 0,
                      isV4: true,
                    });
                    console.log(`✅ Added V4 Flex stake #${idx}: ${flexAmount} LP @ 10% APR`);
                  });
                }
              } catch (flexErr) {
                console.warn('⚠️ Flex V4 fetch failed:', flexErr.message);
              }
            }
            
            // Don't set positions here - wait until V3 check completes
            console.log('📊 V4 positions found so far:', positions.length);
            
            // DON'T return - also fetch V3 legacy positions below!
            // return; // Success with V4!
            
          } catch (v4Err) {
            console.warn('⚠️ V4 fetch failed, falling back to V3:', v4Err.message);
            // Fall through to V3 logic
          }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // V3 LEGACY MODE - ALSO FETCH OLD POSITIONS
        // ═══════════════════════════════════════════════════════════════
        console.log('📦 Also checking V3 contracts for legacy positions...');
        
        try {
          // Fetch regular staking position from V3
          const stakingContract = new ethers.Contract(CONTRACT_ADDRESSES.stakingV3, STAKING_V3_ABI, activeProvider);
          const position = await stakingContract.getPosition(account);
          
          // Parse regular staking position
          const amount = position ? parseFloat(ethers.formatEther(position[0])) : 0;
          const dtgcIsActive = position ? position[7] : false;
          
          if (position && dtgcIsActive && amount > 0) {
            const rawApr = Number(position[4]) / 100;
            const tierNum = Number(position[6]);
            const tierNames = ['SILVER', 'GOLD', 'WHALE'];
            const tierName = tierNames[tierNum] || 'GOLD';
            
            // Check if we already have this position from V4 (avoid duplicates)
            const existingV4 = positions.find(p => !p.isLP && p.amount === amount && p.isV4);
            if (!existingV4) {
              positions.push({
                id: 'v3-dtgc-stake-0',
                stakeIndex: 0,
                type: 'DTGC',
                isLP: false,
                amount: amount,
                startTime: Number(position[1]) * 1000,
                endTime: Number(position[2]) * 1000,
                lockPeriod: Number(position[3]),
                apr: getV19CorrectedAPR(rawApr, tierName, false),
                bonus: Number(position[5]) / 100,
                tier: tierNum,
                tierName: tierName,
                isActive: dtgcIsActive,
                timeRemaining: Number(position[8]),
                isV4: false, // V3 Legacy
              });
              console.log('✅ Added V3 Legacy DTGC position');
            }
          }

          // Fetch LP staking position from V3
          const lpStakingContract = new ethers.Contract(CONTRACT_ADDRESSES.lpStakingV3, LP_STAKING_V3_ABI, activeProvider);
          let lpPosition;
          try {
            lpPosition = await lpStakingContract.getPosition(account);
          } catch (lpErr) {
            console.error('❌ V3 LP getPosition failed:', lpErr.message);
          }
          
          if (lpPosition) {
            const lpAmount = parseFloat(ethers.formatEther(lpPosition[0] || 0n));
            const possibleIsActive = lpPosition[7];
            let lpIsActive = false;
            if (typeof possibleIsActive === 'boolean') {
              lpIsActive = possibleIsActive;
            } else if (possibleIsActive !== undefined) {
              lpIsActive = possibleIsActive.toString() === 'true' || possibleIsActive === 1n || possibleIsActive === 1;
            }
            const lpTypeNum = Number(lpPosition[6] || 0);
            
            if (lpAmount > 0) {
              const rawLpApr = Number(lpPosition[4] || 0) / 100;
              const lpTierName = lpTypeNum === 1 ? 'DIAMOND+' : 'DIAMOND';
              
              // Check for duplicate from V4
              const existingV4LP = positions.find(p => p.isLP && p.amount === lpAmount && p.isV4);
              if (!existingV4LP) {
                positions.push({
                  id: 'v3-lp-stake-0',
                  stakeIndex: 0,
                  type: 'LP',
                  isLP: true,
                  amount: lpAmount,
                  startTime: Number(lpPosition[1] || 0) * 1000,
                  endTime: Number(lpPosition[2] || 0) * 1000,
                  lockPeriod: Number(lpPosition[3] || 0),
                  apr: getV19CorrectedAPR(rawLpApr, lpTierName, true),
                  boostMultiplier: Number(lpPosition[5] || 0) / 10000,
                  lpType: lpTypeNum,
                  tier: lpTierName,
                  tierName: lpTierName,
                  isActive: lpIsActive || lpAmount > 0,
                  timeRemaining: Number(lpPosition[8] || 0),
                  isV4: false, // V3 Legacy
                });
                console.log('✅ Added V3 Legacy LP position');
              }
            }
          }
        } catch (v3Err) {
          console.warn('⚠️ V3 fetch also had issues:', v3Err.message);
        }

        // Only update if we found positions - don't clear with empty array
        if (positions.length > 0) {
          setStakedPositions(positions);
          lastKnownPositionsRef.current = positions; // Save as last known good
          console.log('📊 Total positions (V3+V4):', positions.length);
        } else if (lastKnownPositionsRef.current.length > 0) {
          // No positions found but we had them before - keep the last known good
          console.log('⚠️ No positions from RPC - preserving last known:', lastKnownPositionsRef.current.length);
          setStakedPositions(lastKnownPositionsRef.current);
        } else {
          console.log('⚠️ No positions found and no cached positions');
        }
        return; // Success!

      } catch (err) {
        lastError = err;
        console.warn(`⚠️ RPC failed${rpcUrl ? ` (${rpcUrl})` : ' (wallet provider)'}: ${err.message}`);
        // Continue to next RPC endpoint
      }
    } // end for loop
    
    // All RPCs failed - keep existing positions
    console.error('❌ All RPC endpoints failed to fetch staked positions');
    console.error('❌ Last error:', lastError?.message);
    console.log('⚠️ Keeping existing positions due to RPC errors - will retry next interval');
  }, [account, provider]);

  // Fetch staked positions when account connects
  useEffect(() => {
    if (!TESTNET_MODE && account && provider) {
      // Don't clear positions immediately - let fetch update them
      // This prevents flicker when RPC is slow
      fetchStakedPosition();
      // Refresh every 60 seconds
      const interval = setInterval(fetchStakedPosition, 60000);
      return () => clearInterval(interval);
    }
  }, [account, provider, fetchStakedPosition]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showToast('Address copied!', 'success');
  };

  // Password Gate Screen (moved after all hooks to fix React rules violation)
  if (PASSWORD_ENABLED && !isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Arial, sans-serif',
      }}>
        <div style={{
          background: 'rgba(26,35,39,0.95)',
          border: '2px solid #D4AF37',
          borderRadius: '20px',
          padding: '40px',
          maxWidth: '400px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(212,175,55,0.2)',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔐</div>
          <h1 style={{ color: '#D4AF37', fontSize: '1.8rem', marginBottom: '10px', fontWeight: 800 }}>
            DT GOLD COIN
          </h1>
          <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '30px', letterSpacing: '1px' }}>
            MAINNET PREVIEW • RESTRICTED ACCESS
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '15px 20px',
                fontSize: '1rem',
                background: 'rgba(0,0,0,0.5)',
                border: passwordError ? '2px solid #F44336' : '2px solid rgba(212,175,55,0.3)',
                borderRadius: '10px',
                color: '#fff',
                marginBottom: '15px',
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '3px',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
            {passwordError && (
              <p style={{ color: '#F44336', fontSize: '0.85rem', marginBottom: '15px' }}>
                ❌ Incorrect password
              </p>
            )}
            <button type="submit" style={{
              width: '100%',
              padding: '15px 30px',
              fontSize: '1rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #D4AF37 0%, #F4D03F 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#000',
              cursor: 'pointer',
            }}>
              ENTER SITE
            </button>
          </form>
          <p style={{ color: '#555', fontSize: '0.7rem', marginTop: '30px', letterSpacing: '1px' }}>
            A dtgc.io contract on PulseChain
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      <style>{getStyles(isDark)}</style>
      
      {/* INTRO VIDEO OVERLAY */}
      {showIntro && VIDEOS_ENABLED && (
        <IntroVideoOverlay onComplete={handleIntroComplete} isDark={isDark} />
      )}
      
      {/* STAKE VIDEO MODAL */}
      {showStakeVideo && VIDEOS_ENABLED && (
        <StakeVideoModal 
          onComplete={() => setShowStakeVideo(false)} 
          tierName={stakingTierName}
          isDark={isDark}
        />
      )}

      {/* ADMIN ACCESS LOGS PANEL (Ctrl+Shift+L) */}
      {showAdminLogs && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          zIndex: 99999,
          overflow: 'auto',
          padding: '20px',
          fontFamily: 'monospace',
        }}>
          <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '2px solid #D4AF37',
              paddingBottom: '15px',
            }}>
              <h2 style={{ color: '#D4AF37', margin: 0 }}>🔒 ACCESS LOGS ({adminLogs.length})</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    localStorage.removeItem('dtgc-access-logs');
                    setAdminLogs([]);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#F44336',
                    border: 'none',
                    borderRadius: '5px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  🗑️ Clear Logs
                </button>
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(adminLogs, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `dtgc-access-logs-${new Date().toISOString().split('T')[0]}.json`;
                    a.click();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#4CAF50',
                    border: 'none',
                    borderRadius: '5px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  📥 Export JSON
                </button>
                <button
                  onClick={() => setShowAdminLogs(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#D4AF37',
                    border: 'none',
                    borderRadius: '5px',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                  }}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <p style={{ color: '#888', fontSize: '0.75rem', marginBottom: '15px' }}>
              Shortcuts: Ctrl+Shift+L (toggle) • Ctrl+Shift+C (clear)
            </p>
            {adminLogs.length === 0 ? (
              <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>No access logs recorded</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {adminLogs.map((log, i) => (
                  <div key={i} style={{
                    background: log.success ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
                    border: `1px solid ${log.success ? '#4CAF50' : '#F44336'}`,
                    borderRadius: '8px',
                    padding: '12px 15px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: log.success ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>
                        {log.success ? '✅ ACCESS GRANTED' : '❌ ACCESS DENIED'}
                      </span>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ color: '#fff', fontSize: '0.85rem', lineHeight: 1.6 }}>
                      <div><strong style={{ color: '#D4AF37' }}>IP:</strong> {log.ip}</div>
                      <div><strong style={{ color: '#D4AF37' }}>Attempt:</strong> {log.attemptedPassword}</div>
                      <div><strong style={{ color: '#D4AF37' }}>Platform:</strong> {log.platform}</div>
                      <div><strong style={{ color: '#D4AF37' }}>Screen:</strong> {log.screenSize}</div>
                      <div><strong style={{ color: '#D4AF37' }}>Referrer:</strong> {log.referrer}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '5px', wordBreak: 'break-all' }}>
                        {log.userAgent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      <MarbleBackground />
      <Particles />
      
      {/* Gold Flash Overlay for Nav Clicks */}
      {showGoldFlash && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at center, rgba(212,175,55,0.3) 0%, transparent 70%)',
          zIndex: 9998,
          pointerEvents: 'none',
          animation: 'goldFlash 0.3s ease-out forwards',
        }} />
      )}
      
      <div className="app-container">
        {/* TESTNET BANNER */}
        {TESTNET_MODE && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2000,
            background: 'linear-gradient(90deg, #FF6B6B, #FF8E53, #FF6B6B)',
            backgroundSize: '200% auto',
            animation: 'shimmer 3s linear infinite',
            padding: '8px 20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
          }}>
            <span style={{fontWeight: 700, color: '#FFF', fontSize: '0.85rem', letterSpacing: '1px'}}>
              🧪 TESTNET MODE - Not Real Money!
            </span>
            {account && (
              <>
                <button
                  onClick={claimTestTokens}
                  style={{
                    padding: '6px 16px',
                    background: '#FFF',
                    border: 'none',
                    borderRadius: '20px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: '#FF6B6B',
                    cursor: 'pointer',
                  }}
                >
                  🚰 Get More Test Tokens
                </button>
                <button
                  onClick={resetTestnet}
                  style={{
                    padding: '6px 16px',
                    background: 'rgba(255,255,255,0.2)',
                    border: '1px solid #FFF',
                    borderRadius: '20px',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    color: '#FFF',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reset
                </button>
              </>
            )}
          </div>
        )}

        {/* FLOATING ACTIVE STAKE BOX - Clean V4 Style */}
        {account && (TESTNET_MODE ? (testnetBalances.positions?.length > 0) : (getVisibleNonFlexPositions().length > 0 || getVisibleFlexPositions().length > 0 || getVisibleFlexStakes().length > 0)) && stakeWidgetMinimized && (
            <div
              key={`sidebar-${sidebarKey}`}
              style={{
                position: 'fixed',
                top: TESTNET_MODE ? '120px' : '100px',
                left: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 1500,
              }}
            >
              {/* Regular V4 Stakes (non-flex only) */}
              {(TESTNET_MODE ? testnetBalances.positions.filter(p => !p.isFlex && p.tierName !== 'FLEX') : getVisibleNonFlexPositions()).map((pos, idx) => {
                let tierColor = '#FFD700';
                let tierEmoji = '🥇';
                
                if (pos.isLP) {
                  if (pos.lpType === 1 || pos.tierName === 'DIAMOND+') {
                    tierColor = '#9C27B0';
                    tierEmoji = '💜';
                  } else {
                    tierColor = '#00BCD4';
                    tierEmoji = '💎';
                  }
                } else {
                  const tierName = (pos.tierName || 'GOLD').toUpperCase();
                  if (tierName === 'SILVER') {
                    tierColor = '#C0C0C0';
                    tierEmoji = '🥈';
                  } else if (tierName === 'WHALE') {
                    tierColor = '#2196F3';
                    tierEmoji = '🐋';
                  }
                }
                
                return (
                  <div
                    key={`stake-${pos.id || idx}`}
                    onClick={() => {
                      setSelectedStakeIndex(idx);
                      setStakeWidgetMinimized(false);
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      background: 'rgba(15,15,15,0.95)',
                      border: `2px solid ${tierColor}`,
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: `0 2px 10px ${tierColor}40`,
                    }}
                    title={`${pos.tierName || 'Stake'} • ${formatNumber(pos.amount)} ${pos.isLP ? 'LP' : 'DTGC'} @ ${pos.apr?.toFixed(1) || '?'}% APR`}
                  >
                    <span style={{ fontSize: '1.3rem' }}>{tierEmoji}</span>
                    <span style={{ fontSize: '0.4rem', fontWeight: 700, color: pos.isV4 ? '#4CAF50' : '#FF9800' }}>{pos.isV4 ? 'V4' : 'V3'}</span>
                  </div>
                );
              })}
              
              {/* CONSOLIDATED FLEX STAKE - Single Icon for ALL flex stakes */}
              {(() => {
                const allFlexPositions = TESTNET_MODE 
                  ? testnetBalances.positions.filter(p => p.isFlex || p.tierName === 'FLEX')
                  : [...getVisibleFlexPositions(), ...getVisibleFlexStakes()];
                const totalFlexLP = allFlexPositions.reduce((sum, s) => sum + (s.amount || s.lpAmount || 0), 0);
                const flexCount = allFlexPositions.length;
                
                if (flexCount === 0) {
                  // Show "+ FLEX" button when no flex stakes
                  return (
                    <div
                      onClick={() => {
                        setIsFlexTier(true);
                        setSelectedTier(null);
                        setIsLP(false);
                      }}
                      style={{
                        width: '44px',
                        height: '44px',
                        background: 'rgba(255,20,147,0.1)',
                        border: '2px dashed #FF1493',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 10px rgba(255,20,147,0.2)',
                        opacity: 0.7,
                      }}
                      title="Open Flex Staking Panel"
                    >
                      <span style={{ fontSize: '1.1rem' }}>💗</span>
                      <span style={{ fontSize: '0.35rem', fontWeight: 700, color: '#FF1493' }}>+ FLEX</span>
                    </div>
                  );
                }
                
                // Show consolidated Flex icon
                return (
                  <div
                    onClick={() => {
                      setIsFlexTier(true);
                      setSelectedTier(null);
                      setIsLP(false);
                    }}
                    style={{
                      width: '44px',
                      height: '44px',
                      background: 'linear-gradient(135deg, rgba(255,20,147,0.3) 0%, rgba(255,105,180,0.2) 100%)',
                      border: '2px solid #FF1493',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 12px rgba(255,20,147,0.5)',
                      position: 'relative',
                    }}
                    title={`Flex Pool • ${formatNumber(totalFlexLP, 2)} LP total • ${flexCount} stake(s) • 10% APR`}
                  >
                    <span style={{ fontSize: '1.3rem' }}>💗</span>
                    <span style={{ fontSize: '0.4rem', fontWeight: 700, color: '#FF1493' }}>FLEX</span>
                    {/* Stake count badge */}
                    {flexCount > 1 && (
                      <div style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#FF1493',
                        color: '#fff',
                        fontSize: '0.5rem',
                        fontWeight: 700,
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {flexCount}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
        )}
        
        {/* EXPANDED STAKE WIDGET */}
        {account && (TESTNET_MODE ? (testnetBalances.positions?.length > 0) : (stakedPositions.length > 0 || lastKnownPositionsRef.current.length > 0)) && !stakeWidgetMinimized && (
            // Expanded view - full widget with diamond selector
            <div style={{
              position: 'fixed',
              top: TESTNET_MODE ? '120px' : '100px',
              left: '15px',
              zIndex: 1500,
              background: isDark ? 'rgba(15,15,15,0.95)' : 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              borderRadius: '16px',
              border: '2px solid var(--gold)',
              padding: '12px 16px',
              minWidth: '280px',
              maxWidth: '320px',
              boxShadow: '0 8px 32px rgba(212,175,55,0.3)',
            }}>
              {/* Cumulative Totals Row */}
              {(() => {
                const positions = TESTNET_MODE ? testnetBalances.positions : stakedPositions;
                const now = Date.now();
                
                // Calculate cumulative totals
                const dtgcTotal = positions.filter(p => !p.isLP).reduce((sum, p) => sum + (p.amount || 0), 0);
                const lpTotal = positions.filter(p => p.isLP).reduce((sum, p) => sum + (p.amount || 0), 0);
                
                // Calculate total rewards across all positions
                const totalRewards = positions.reduce((sum, pos) => {
                  const V19_CORRECTIONS = {
                    'SILVER': { apr: 15.4 }, 'GOLD': { apr: 16.8 }, 'WHALE': { apr: 18.2 },
                    'DIAMOND': { apr: 42 }, 'DIAMOND+': { apr: 70 },
                  };
                  let tierName = pos.tierName?.toUpperCase() || (pos.isLP ? (pos.lpType === 1 ? 'DIAMOND+' : 'DIAMOND') : 'GOLD');
                  const apr = V19_CORRECTIONS[tierName]?.apr || 16.8;
                  const daysStaked = Math.max(0, (now - pos.startTime) / (24 * 60 * 60 * 1000));
                  const rewards = (pos.amount * (apr / 100) / 365) * daysStaked;
                  return sum + rewards;
                }, 0);
                const totalRewardsUsd = totalRewards * (livePrices.dtgc || 0);
                const totalRewardsPls = livePrices.pls > 0 ? (totalRewardsUsd / livePrices.pls) : 0;
                
                return (
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '10px',
                    paddingBottom: '10px',
                    borderBottom: '1px solid rgba(212,175,55,0.3)',
                  }}>
                    {/* DTGC Total - Blue */}
                    <div style={{
                      flex: 1,
                      background: 'rgba(33,150,243,0.15)',
                      border: '1px solid rgba(33,150,243,0.4)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#2196F3', fontWeight: 600, marginBottom: '2px' }}>DTGC</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{formatNumber(dtgcTotal)}</div>
                    </div>
                    
                    {/* LP Total - Purple */}
                    <div style={{
                      flex: 1,
                      background: 'rgba(156,39,176,0.15)',
                      border: '1px solid rgba(156,39,176,0.4)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#9C27B0', fontWeight: 600, marginBottom: '2px' }}>LP</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{formatNumber(lpTotal)}</div>
                    </div>
                    
                    {/* Rewards Total - Green */}
                    <div style={{
                      flex: 1,
                      background: 'rgba(76,175,80,0.15)',
                      border: '1px solid rgba(76,175,80,0.4)',
                      borderRadius: '8px',
                      padding: '6px 8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '0.65rem', color: '#4CAF50', fontWeight: 600, marginBottom: '2px' }}>REWARDS</div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>{formatNumber(totalRewards)} DTGC</div>
                      <div style={{ fontSize: '0.55rem', color: '#4CAF50' }}>${formatNumber(totalRewardsUsd, 2)} • <span style={{ color: '#9C27B0' }}>{formatNumber(totalRewardsPls, 0)} PLS</span></div>
                    </div>
                    
                    {/* Flex Total - Pink Heart */}
                    <div 
                      onClick={() => { setIsFlexTier(true); setSelectedTier(null); setIsLP(false); }}
                      style={{
                        flex: 1,
                        background: 'rgba(255,20,147,0.15)',
                        border: '1px solid rgba(255,20,147,0.4)',
                        borderRadius: '8px',
                        padding: '6px 8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ fontSize: '0.65rem', color: '#FF1493', fontWeight: 600, marginBottom: '2px' }}>💗 FLEX</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#FF69B4' }}>10% APR</div>
                    </div>
                  </div>
                );
              })()}
              
              {/* Diamond Selector Row */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '10px',
                paddingBottom: '10px',
                borderBottom: '1px solid rgba(212,175,55,0.3)',
              }}>
                {(TESTNET_MODE ? testnetBalances.positions : stakedPositions).map((pos, idx) => {
                  let diamondColor = '#FFD700';
                  let diamondIcon = '🥇';
                  
                  // Check for Flex first
                  if (pos.isFlex || pos.tierName === 'FLEX') {
                    diamondColor = '#FF1493';
                    diamondIcon = '💗';
                  } else if (pos.isLP) {
                    if (pos.lpType === 1 || pos.tierName === 'DIAMOND+') {
                      diamondColor = '#9C27B0';
                      diamondIcon = '💜';
                    } else {
                      diamondColor = '#00BCD4';
                      diamondIcon = '💎';
                    }
                  } else {
                    const tierName = (pos.tierName || 'GOLD').toUpperCase();
                    if (tierName === 'SILVER') {
                      diamondColor = '#C0C0C0';
                      diamondIcon = '🥈';
                    } else if (tierName === 'WHALE') {
                      diamondColor = '#2196F3';
                      diamondIcon = '🐋';
                    }
                  }
                  
                  const isSelected = idx === selectedStakeIndex;
                  return (
                    <div
                      key={`sel-${idx}`}
                      onClick={() => setSelectedStakeIndex(idx)}
                      style={{
                        width: '36px',
                        height: '36px',
                        background: isSelected ? `${diamondColor}30` : 'transparent',
                        border: `2px solid ${isSelected ? diamondColor : 'rgba(255,255,255,0.2)'}`,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                      title={`${pos.tierName || 'Stake'} #${idx + 1}`}
                    >
                      <span style={{ fontSize: '1rem' }}>{diamondIcon}</span>
                    </div>
                  );
                })}
                {/* Refresh button */}
                <div
                  onClick={() => {
                    showToast('🔄 Refreshing positions...', 'info');
                    fetchStakedPosition();
                  }}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'rgba(76,175,80,0.2)',
                    border: '1px solid rgba(76,175,80,0.4)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginLeft: '8px',
                  }}
                  title="Refresh Positions"
                >
                  <span style={{ fontSize: '0.9rem' }}>🔄</span>
                </div>
                {/* Minimize button */}
                <div
                  onClick={() => setStakeWidgetMinimized(true)}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginLeft: '4px',
                  }}
                  title="Minimize"
                >
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>─</span>
                </div>
              </div>

            {(() => {
              const positions = TESTNET_MODE ? testnetBalances.positions : stakedPositions;
              const activePos = positions[selectedStakeIndex] || positions[0];

              if (!activePos) return null;

              // V19 Tier Correction - includes FLEX
              const V19_CORRECTIONS = {
                'SILVER': { apr: 15.4, lockDays: 60 },
                'GOLD': { apr: 16.8, lockDays: 90 },
                'WHALE': { apr: 18.2, lockDays: 180 },
                'DIAMOND': { apr: 28, lockDays: 90, boost: 1.5 },
                'DIAMOND+': { apr: 35, lockDays: 90, boost: 2 },
                'FLEX': { apr: 10, lockDays: 0, boost: 1 }, // No lock!
              };

              const TIER_NAMES = ['SILVER', 'GOLD', 'WHALE'];
              let tierName;
              if (activePos.isFlex || activePos.tierName === 'FLEX') {
                tierName = 'FLEX';
              } else if (activePos.tierName) {
                tierName = activePos.tierName.toUpperCase();
              } else if (activePos.isLP) {
                tierName = activePos.lpType === 1 ? 'DIAMOND+' : 'DIAMOND';
              } else if (typeof activePos.tier === 'number') {
                tierName = TIER_NAMES[activePos.tier] || 'GOLD';
              } else {
                tierName = (activePos.tier || 'GOLD').toUpperCase();
              }
              
              const correction = V19_CORRECTIONS[tierName] || V19_CORRECTIONS['GOLD'];
              const isFlex = tierName === 'FLEX';
              const correctedApr = isFlex ? 10 : (activePos.isLP ? correction.apr * (correction.boost || 1) : correction.apr);
              const correctedLockDays = isFlex ? 0 : correction.lockDays;
              const correctedEndTime = isFlex ? 0 : activePos.startTime + (correctedLockDays * 24 * 60 * 60 * 1000);

              const now = Date.now();
              const isLocked = !isFlex && now < correctedEndTime;
              const daysLeft = isFlex ? 0 : Math.max(0, Math.ceil((correctedEndTime - now) / (24 * 60 * 60 * 1000)));
              const hoursLeft = isFlex ? 0 : Math.max(0, Math.ceil((correctedEndTime - now) / (1000 * 60 * 60)) % 24);
              const daysStaked = Math.max(0, (now - activePos.startTime) / (24 * 60 * 60 * 1000));
              const currentRewards = (activePos.amount * (correctedApr / 100) / 365) * daysStaked;

              const stakeValueUsd = activePos.amount * (livePrices.dtgc || 0);
              const rewardValueUsd = currentRewards * (livePrices.dtgc || 0);
              const rewardValuePls = livePrices.pls > 0 ? (rewardValueUsd / livePrices.pls) : 0;

              const getTierColor = (name) => {
                switch(name) {
                  case 'SILVER': return '#C0C0C0';
                  case 'GOLD': return '#D4AF37';
                  case 'WHALE': return '#2196F3';
                  case 'DIAMOND': return '#00BCD4';
                  case 'DIAMOND+': return '#9C27B0';
                  case 'FLEX': return '#FF1493';
                  default: return '#D4AF37';
                }
              };
              const tierColor = getTierColor(tierName);
              const tierIcon = tierName === 'SILVER' ? '🥈' : tierName === 'GOLD' ? '🥇' : tierName === 'WHALE' ? '🐋' : tierName === 'DIAMOND+' ? '💜' : tierName === 'DIAMOND' ? '💎' : tierName === 'FLEX' ? '💗' : '🥇';

              return (
                <>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tier</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tierColor }}>
                        {tierIcon} {tierName} {isFlex && <span style={{ fontSize: '0.6rem', color: '#4CAF50' }}>• NO LOCK</span>}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Staked</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {formatNumber(activePos.amount)} {activePos.isLP ? 'LP' : 'DTGC'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#4CAF50' }}>
                          {getCurrencySymbol()}{formatNumber(convertToCurrency(stakeValueUsd).value)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>APR</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: tierColor }}>
                        {correctedApr.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rewards</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4CAF50' }}>
                          +{formatNumber(currentRewards)} DTGC
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#4CAF50' }}>
                          ≈ {getCurrencySymbol()}{formatNumber(convertToCurrency(rewardValueUsd).value)}
                        </div>
                        <div style={{ fontSize: '0.55rem', color: '#9C27B0' }}>
                          ≈ {formatNumber(rewardValuePls, 0)} PLS
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    marginBottom: '10px',
                    padding: '8px',
                    background: isLocked ? 'rgba(255,107,107,0.1)' : 'rgba(76,175,80,0.1)',
                    borderRadius: '8px',
                    border: `1px solid ${isLocked ? 'rgba(255,107,107,0.3)' : 'rgba(76,175,80,0.3)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: isLocked ? '#FF6B6B' : '#4CAF50' }}>
                        {isLocked ? '🔒 Locked' : '✅ Unlocked'}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isLocked ? '#FF6B6B' : '#4CAF50' }}>
                        {isLocked ? `${daysLeft}d ${hoursLeft}h` : 'Ready!'}
                      </span>
                    </div>
                  </div>

                  {isLocked ? (
                    <button
                      onClick={() => handleEmergencyWithdraw(activePos.isLP, activePos.id)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        color: '#FFF',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      ⚠️ Early Exit (20% EES Fee)
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* V4: Claim Rewards without unstaking */}
                      {activePos.isV4 && (
                        <button
                          onClick={() => handleClaimRewards(activePos.isLP, activePos.id)}
                          disabled={loading}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            fontSize: '0.65rem',
                            color: '#000',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.7 : 1,
                          }}
                        >
                          🎁 Claim
                        </button>
                      )}
                      <button
                        onClick={() => handleUnstake(activePos.id)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.65rem',
                          color: '#FFF',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          opacity: loading ? 0.7 : 1,
                        }}
                      >
                        ✅ {activePos.isV4 ? 'Withdraw' : 'Claim All'}
                      </button>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Navigation */}
        <header className={`nav-header ${scrolled ? 'scrolled' : ''}`} style={TESTNET_MODE ? {top: '40px'} : {}}>
          <div className="nav-content">
            <div className="logo-section">
              <div className="logo-mark">DT</div>
              <div className="logo-text-group">
                <span className="logo-text gold-text">DTGC</span>
                <span className="logo-tagline">Gold DeFi Suite</span>
              </div>
              {/* Mobile Menu Toggle */}
              <button 
                className="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>

            {/* Mobile Nav Dropdown */}
            {mobileMenuOpen && (
              <div className="mobile-nav-dropdown">
                <button className={activeTab === 'stake' ? 'active' : ''} onClick={() => { handleNavClick('stake'); setMobileMenuOpen(false); }}>💰 Stake</button>
                <button className={activeTab === 'burn' ? 'active' : ''} onClick={() => { handleNavClick('burn'); setMobileMenuOpen(false); }}>🔥 Burn Stats</button>
                <button className={activeTab === 'vote' ? 'active' : ''} onClick={() => { handleNavClick('vote'); setMobileMenuOpen(false); }}>🗳️ DAO</button>
                <button className={activeTab === 'whitepaper' ? 'active' : ''} onClick={() => { handleNavClick('whitepaper'); setMobileMenuOpen(false); }}>📄 Whitepaper</button>
                <button className={activeTab === 'links' ? 'active' : ''} onClick={() => { handleNavClick('links'); setMobileMenuOpen(false); }}>🔗 Links</button>
                <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => { handleNavClick('analytics'); setMobileMenuOpen(false); }} style={{ background: activeTab === 'analytics' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : '' }}>📊 Analytics</button>
                <button className={activeTab === 'gold' ? 'active' : ''} onClick={() => { handleNavClick('gold'); setMobileMenuOpen(false); }} style={{ background: activeTab === 'gold' ? 'linear-gradient(135deg, #D4AF37, #B8860B)' : 'rgba(212,175,55,0.15)', color: activeTab === 'gold' ? '#000' : '#D4AF37' }}>🏆 PulseX Gold</button>
                <button className={activeTab === 'whitediamond' ? 'active' : ''} onClick={() => { handleNavClick('whitediamond'); setMobileMenuOpen(false); }} style={{ background: activeTab === 'whitediamond' ? 'linear-gradient(135deg, #FFFFFF, #B8B8B8)' : 'rgba(255,255,255,0.1)', color: activeTab === 'whitediamond' ? '#000' : '#FFF' }}>💎 White Diamond</button>
                <button className={activeTab === 'saas' ? 'active' : ''} onClick={() => { handleNavClick('saas'); setMobileMenuOpen(false); }} style={{ background: activeTab === 'saas' ? 'linear-gradient(135deg, #4CAF50, #388E3C)' : 'rgba(76,175,80,0.15)', color: activeTab === 'saas' ? '#fff' : '#4CAF50' }}>🏭 SaaS Platform</button>
                <button className={activeTab === 'dapperflex' ? 'active' : ''} onClick={() => { handleNavClick('dapperflex'); setMobileMenuOpen(false); }} style={{ background: activeTab === 'dapperflex' ? 'linear-gradient(135deg, #FF69B4, #FFD700)' : 'rgba(255,105,180,0.15)', color: activeTab === 'dapperflex' ? '#000' : '#FF69B4' }}>💗⭐ Flex V6</button>
              </div>
            )}

            <nav className="nav-links">
              <button className={`nav-link ${activeTab === 'stake' ? 'active' : ''}`} onClick={() => handleNavClick('stake')}>Stake</button>
              <button className={`nav-link ${activeTab === 'burn' ? 'active' : ''}`} onClick={() => handleNavClick('burn')}>Burn Stats</button>
              <button className={`nav-link ${activeTab === 'vote' ? 'active' : ''}`} onClick={() => handleNavClick('vote')}>DAO</button>
              <button className={`nav-link ${activeTab === 'whitepaper' ? 'active' : ''}`} onClick={() => handleNavClick('whitepaper')}>Whitepaper</button>
              <button className={`nav-link ${activeTab === 'links' ? 'active' : ''}`} onClick={() => handleNavClick('links')}>Links</button>
              <button className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => handleNavClick('analytics')} style={{ background: activeTab === 'analytics' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : 'transparent' }}>📊 Analytics</button>
              <button 
                className={`nav-link ${activeTab === 'gold' ? 'active' : ''}`} 
                onClick={() => handleNavClick('gold')} 
                style={{ 
                  background: activeTab === 'gold' 
                    ? 'linear-gradient(135deg, #D4AF37, #B8860B)' 
                    : 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))',
                  border: '1px solid rgba(212,175,55,0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: activeTab === 'gold' ? '#000' : '#D4AF37',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🏆 <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem' }}><span>PulseX</span><span>Gold</span></span>
              </button>
              <button 
                className={`nav-link ${activeTab === 'whitediamond' ? 'active' : ''}`} 
                onClick={() => handleNavClick('whitediamond')} 
                style={{ 
                  background: activeTab === 'whitediamond' 
                    ? 'linear-gradient(135deg, #FFFFFF, #B8B8B8)' 
                    : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: activeTab === 'whitediamond' ? '#000' : '#FFF',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                💎 <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem' }}><span>White</span><span>Diamond</span></span>
              </button>
              <button 
                className={`nav-link ${activeTab === 'saas' ? 'active' : ''}`} 
                onClick={() => handleNavClick('saas')} 
                style={{ 
                  background: activeTab === 'saas' 
                    ? 'linear-gradient(135deg, #4CAF50, #388E3C)' 
                    : 'linear-gradient(135deg, rgba(76,175,80,0.15), rgba(76,175,80,0.05))',
                  border: '1px solid rgba(76,175,80,0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: activeTab === 'saas' ? '#fff' : '#4CAF50',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                🏭 <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem' }}><span>SaaS</span><span>Platform</span></span>
              </button>
              <button 
                className={`nav-link ${activeTab === 'dapperflex' ? 'active' : ''}`} 
                onClick={() => handleNavClick('dapperflex')} 
                style={{ 
                  background: activeTab === 'dapperflex' 
                    ? 'linear-gradient(135deg, #FF69B4, #FFD700)' 
                    : 'linear-gradient(135deg, rgba(255,105,180,0.15), rgba(255,215,0,0.05))',
                  border: '1px solid rgba(255,105,180,0.4)',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: activeTab === 'dapperflex' ? '#000' : '#FF69B4',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                💗⭐ <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1, fontSize: '0.7rem' }}><span>Dapper</span><span>Flex V6</span></span>
              </button>
            </nav>

            <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Prices Dropdown - Clean & Compact */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowPricesDropdown(!showPricesDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: isDark ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.1)',
                    borderRadius: '20px',
                    border: '1px solid rgba(212,175,55,0.3)',
                    fontSize: '0.7rem',
                    color: '#D4AF37',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  💰 ${((cryptoPrices.btc/1000).toFixed(0))}K
                  <span style={{ fontSize: '0.5rem', opacity: 0.7 }}>▼</span>
                </button>
                
                {/* Prices Dropdown Panel */}
                {showPricesDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '8px',
                    background: isDark ? '#1a1a2e' : '#fff',
                    borderRadius: '12px',
                    border: '1px solid rgba(212,175,55,0.3)',
                    padding: '12px',
                    minWidth: '200px',
                    zIndex: 10000,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                  }}>
                    {/* Metals */}
                    <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
                      <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>METALS /oz</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#FFD700', fontSize: '0.7rem' }}>🥇 Gold</span>
                          <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '0.75rem' }}>${metalPrices.gold.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#C0C0C0', fontSize: '0.7rem' }}>🥈 Silver</span>
                          <span style={{ color: '#C0C0C0', fontWeight: 700, fontSize: '0.75rem' }}>${metalPrices.silver.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#CD7F32', fontSize: '0.7rem' }}>🥉 Copper</span>
                          <span style={{ color: '#CD7F32', fontWeight: 700, fontSize: '0.75rem' }}>${metalPrices.copper.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Crypto */}
                    <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid rgba(212,175,55,0.2)' }}>
                      <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>CRYPTO</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#F7931A', fontSize: '0.7rem' }}>₿ Bitcoin</span>
                          <span style={{ color: '#F7931A', fontWeight: 700, fontSize: '0.75rem' }}>${cryptoPrices.btc.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#627EEA', fontSize: '0.7rem' }}>Ξ Ethereum</span>
                          <span style={{ color: '#627EEA', fontWeight: 700, fontSize: '0.75rem' }}>${cryptoPrices.eth.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    {/* PulseChain */}
                    <div>
                      <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>PULSECHAIN</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#00D4AA', fontSize: '0.7rem' }}>💜 PLS</span>
                          <span style={{ color: '#00D4AA', fontWeight: 700, fontSize: '0.75rem' }}>${cryptoPrices.pls.toFixed(8)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#9B59B6', fontSize: '0.7rem' }}>💎 PLSX</span>
                          <span style={{ color: '#9B59B6', fontWeight: 700, fontSize: '0.75rem' }}>${cryptoPrices.plsx.toFixed(8)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#FFD700', fontSize: '0.7rem' }}>🪙 DTGC</span>
                          <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '0.75rem' }}>${(livePrices.dtgc || 0).toFixed(7)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Security & Audit Button */}
              <button
                onClick={() => setShowSecurityModal(true)}
                style={{
                  padding: '6px 10px',
                  background: 'transparent',
                  border: '1px solid rgba(76,175,80,0.5)',
                  borderRadius: '8px',
                  color: '#4CAF50',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  marginRight: '8px',
                }}
                title="Security & Audit Info"
              >
                🛡️
              </button>
              <button className="theme-toggle" onClick={toggleTheme}>
                {isDark ? '☀️' : '🌙'}
              </button>
              {/* Change Address Button - only show when connected */}
              {account && (
                <button
                  onClick={() => setShowWalletModal(true)}
                  style={{
                    padding: '6px 10px',
                    background: 'transparent',
                    border: '1px solid rgba(212,175,55,0.5)',
                    borderRadius: '8px',
                    color: '#D4AF37',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    marginRight: '8px',
                  }}
                  title="Change wallet address"
                >
                  🔄
                </button>
              )}
              {/* Wallet Connection Buttons */}
              {account ? (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {/* Switch Account Button */}
                  <button
                    onClick={switchWallet}
                    disabled={loading}
                    style={{
                      padding: '8px 10px',
                      background: 'rgba(76,175,80,0.2)',
                      border: '1px solid rgba(76,175,80,0.5)',
                      borderRadius: '8px 0 0 8px',
                      color: '#4CAF50',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: loading ? 'wait' : 'pointer',
                    }}
                    title="Switch to different wallet account"
                  >
                    🔀
                  </button>
                  {/* Connected Address & Disconnect */}
                  <button
                    className="connect-btn connected"
                    onClick={disconnectWallet}
                    disabled={loading}
                    style={{
                      borderRadius: '0 8px 8px 0',
                    }}
                    title="Click to disconnect"
                  >
                    {loading && <span className="spinner" />}
                    🔌 {formatAddress(account)}
                  </button>
                </div>
              ) : (
                <button
                  className="connect-btn"
                  onClick={() => setShowWalletModal(true)}
                  disabled={loading}
                  title="Connect your wallet"
                >
                  {loading && <span className="spinner" />}
                  🔗 Connect
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="hero-section" style={TESTNET_MODE ? {paddingTop: '180px'} : {}}>
          <div className="hero-badge">
            {TESTNET_MODE ? '🧪 TESTNET MODE • NOT REAL MONEY 🧪' : '🔴 LIVE • MAINNET'}
          </div>
          <h1 className="hero-title gold-text">DTGC STAKING</h1>
          <p style={{ fontSize: '0.75rem', color: '#4CAF50', marginTop: '-8px', marginBottom: '8px', letterSpacing: '2px', fontWeight: 700, textShadow: '0 0 10px rgba(76,175,80,0.5)' }}>✨ V4 CONTRACTS LIVE • UNLIMITED MULTI-STAKE ✨</p>
          <p className="hero-subtitle">Stake • Earn • Govern • Prosper</p>
          <p style={{
            fontSize: '0.7rem',
            color: '#888',
            letterSpacing: '1px',
            marginTop: '-10px',
            marginBottom: '20px',
            textTransform: 'uppercase'
          }}>
            A dtgc.io contract, unique decentralized staking mechanism, on PulseChain
          </p>
          
          {/* Testnet Balance Display */}
          {TESTNET_MODE && account && testnetBalances && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '15px',
              flexWrap: 'wrap',
              marginBottom: '30px',
              padding: '20px',
              background: isDark ? 'rgba(255,107,107,0.1)' : 'rgba(255,107,107,0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(255,107,107,0.3)',
            }}>
              <div style={{textAlign: 'center', padding: '10px 20px'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 800, color: '#FF6B6B'}}>{formatNumber(testnetBalances.pls)}</div>
                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px'}}>TEST PLS</div>
              </div>
              <div style={{textAlign: 'center', padding: '10px 20px'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 800, color: '#FFD700'}}>{formatNumber(testnetBalances.dtgc)}</div>
                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px'}}>TEST DTGC</div>
              </div>
              <div style={{textAlign: 'center', padding: '10px 20px'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 800, color: '#FF9800'}}>{formatNumber(testnetBalances.urmom || 0)}</div>
                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px'}}>TEST URMOM</div>
              </div>
              <div style={{textAlign: 'center', padding: '10px 20px'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 800, color: '#00BCD4'}}>{formatNumber(testnetBalances.lp)}</div>
                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px'}}>TEST LP</div>
              </div>
              <div style={{textAlign: 'center', padding: '10px 20px', borderLeft: '1px solid rgba(255,255,255,0.2)'}}>
                <div style={{fontSize: '1.5rem', fontWeight: 800, color: '#4CAF50'}}>{formatNumber((testnetBalances.stakedDTGC || 0) + (testnetBalances.stakedLP || 0))}</div>
                <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '1px'}}>STAKED</div>
              </div>
            </div>
          )}

          {/* Mainnet Balance Display */}
          {!TESTNET_MODE && account && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: '30px',
            }}>
              {/* Gold Bag Title */}
              <h3 style={{
                color: '#D4AF37',
                fontFamily: 'Cinzel, serif',
                fontSize: '1.2rem',
                letterSpacing: '3px',
                marginBottom: '12px',
                textShadow: '0 0 20px rgba(212,175,55,0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                💰 GOLD BAG
              </h3>
              
              {/* Currency Toggle Button */}
              <button
                onClick={toggleCurrencyDisplay}
                style={{
                  marginBottom: '12px',
                  padding: '8px 20px',
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.1) 100%)',
                  border: '1px solid #D4AF37',
                  borderRadius: '20px',
                  color: '#D4AF37',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: '1px',
                  transition: 'all 0.3s ease',
                }}
              >
                {displayCurrency === 'units' ? '💰 UNITS' : 
                 displayCurrency === 'usd' ? '💵 USD' : 
                 displayCurrency === 'eur' ? '💶 EUR' : 
                 displayCurrency === 'gbp' ? '💷 GBP' : 
                 displayCurrency === 'jpy' ? '💴 JPY' : 
                 displayCurrency === 'sar' ? '🇸🇦 SAR' : 
                 displayCurrency === 'cny' ? '🇨🇳 CNY' : 
                 displayCurrency === 'czk' ? '🇨🇿 CZK' :
                 displayCurrency === 'aud' ? '🇦🇺 AUD' :
                 displayCurrency === 'ngn' ? '🇳🇬 NGN' :
                 displayCurrency === 'cop' ? '🇨🇴 COP' :
                 displayCurrency === 'cad' ? '🇨🇦 CAD' : '💰 UNITS'} ▼
              </button>

              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '15px',
                flexWrap: 'wrap',
                padding: '20px',
                background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.05)',
                borderRadius: '16px',
                border: '1px solid rgba(212,175,55,0.3)',
              }}>
                <div style={{textAlign: 'center', padding: '10px 20px'}}>
                  <div style={{fontSize: '1.3rem', fontWeight: 800, color: '#E1BEE7'}}>{formatNumber(parseFloat(plsBalance))} PLS</div>
                  <div style={{fontSize: '0.7rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(plsBalance) * 0.00003).value)}</div>
                </div>
                <div style={{textAlign: 'center', padding: '10px 20px'}}>
                  <div style={{fontSize: '1.3rem', fontWeight: 800, color: '#FFD700'}}>{formatNumber(parseFloat(dtgcBalance))} DTGC</div>
                  <div style={{fontSize: '0.7rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(dtgcBalance) * (livePrices.dtgc || 0)).value)}</div>
                </div>
                <div style={{textAlign: 'center', padding: '10px 20px'}}>
                  <div style={{fontSize: '1.3rem', fontWeight: 800, color: '#FF9800'}}>{formatNumber(parseFloat(urmomBalance))} URMOM</div>
                  <div style={{fontSize: '0.7rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(urmomBalance) * (livePrices.urmom || 0)).value)}</div>
                </div>
                {/* Blue Diamond LP (DTGC/PLS) */}
                <div style={{textAlign: 'center', padding: '10px 15px', background: 'rgba(0,188,212,0.15)', borderRadius: '8px', border: '2px solid #00BCD4'}}>
                  <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#00BCD4'}}>{formatNumber(parseFloat(lpDtgcPlsBalance))} 💎</div>
                  <div style={{fontSize: '0.65rem', color: '#00BCD4', fontWeight: 600}}>DTGC/PLS LP</div>
                  <div style={{fontSize: '0.6rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(lpDtgcPlsBalance) * (livePrices.dtgc || 0) * 2).value)}</div>
                </div>
                {/* Purple Diamond+ LP (DTGC/URMOM) */}
                <div style={{textAlign: 'center', padding: '10px 15px', background: 'rgba(156,39,176,0.15)', borderRadius: '8px', border: '2px solid #9C27B0'}}>
                  <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#9C27B0'}}>{formatNumber(parseFloat(lpDtgcUrmomBalance))} 💜💎</div>
                  <div style={{fontSize: '0.65rem', color: '#9C27B0', fontWeight: 600}}>DTGC/URMOM LP</div>
                  <div style={{fontSize: '0.6rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(lpDtgcUrmomBalance) * (livePrices.dtgc || 0) * 2).value)}</div>
                </div>
                {/* Green Pending Rewards */}
                {(() => {
                  // Calculate total pending rewards from all staked positions
                  const totalPendingRewards = stakedPositions.reduce((total, pos) => {
                    const now = Date.now();
                    const daysStaked = Math.max(0, (now - pos.startTime) / (24 * 60 * 60 * 1000));
                    // Use V19 corrected APRs
                    const V19_APRS = { 'SILVER': 15.4, 'GOLD': 16.8, 'WHALE': 18.2, 'DIAMOND': 42, 'DIAMOND+': 70 };
                    // Handle tier as either string or number
                    const TIER_NAMES = ['SILVER', 'GOLD', 'WHALE'];
                    let tierName;
                    if (typeof pos.tier === 'string') {
                      tierName = pos.tier.toUpperCase();
                    } else if (typeof pos.tier === 'number') {
                      tierName = TIER_NAMES[pos.tier] || 'GOLD';
                    } else if (pos.isLP) {
                      tierName = pos.lpType === 1 ? 'DIAMOND+' : 'DIAMOND';
                    } else {
                      tierName = 'GOLD';
                    }
                    const apr = V19_APRS[tierName] || 16.8;
                    const rewards = (pos.amount * (apr / 100) / 365) * daysStaked;
                    return total + rewards;
                  }, 0);
                  const rewardsValueUsd = totalPendingRewards * (livePrices.dtgc || 0);
                  const rewardsValuePls = livePrices.pls > 0 ? (rewardsValueUsd / livePrices.pls) : 0;
                  return (
                    <div style={{textAlign: 'center', padding: '10px 15px', background: 'rgba(76,175,80,0.15)', borderRadius: '8px', border: '2px solid #4CAF50'}}>
                      <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#4CAF50'}}>+{formatNumber(totalPendingRewards)} 🎁</div>
                      <div style={{fontSize: '0.65rem', color: '#4CAF50', fontWeight: 600}}>PENDING REWARDS</div>
                      <div style={{fontSize: '0.6rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(rewardsValueUsd).value)}</div>
                      <div style={{fontSize: '0.55rem', color: '#9C27B0'}}>≈ {formatNumber(rewardsValuePls, 0)} PLS</div>
                    </div>
                  );
                })()}
                {/* Pink Flex Coin Clean Box */}
                <div 
                  onClick={() => { setIsFlexTier(true); setSelectedTier(null); setIsLP(false); }}
                  style={{
                    textAlign: 'center', 
                    padding: '10px 15px', 
                    background: 'linear-gradient(135deg, rgba(255,20,147,0.2) 0%, rgba(255,105,180,0.15) 100%)', 
                    borderRadius: '8px', 
                    border: '2px solid #FF1493',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '100px',
                  }}
                >
                  <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#FF1493'}}>💗 FLEX</div>
                  <div style={{fontSize: '0.6rem', color: '#FF69B4', fontWeight: 600}}>COIN CLEAN</div>
                  <div style={{fontSize: '0.5rem', color: '#FF1493', marginTop: '2px'}}>10% APR</div>
                </div>
                
                {/* White Diamond NFT Box */}
                <div 
                  onClick={() => handleNavClick('whitediamond')}
                  style={{
                    textAlign: 'center', 
                    padding: '10px 15px', 
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(212,175,55,0.15) 100%)', 
                    borderRadius: '8px', 
                    border: '2px solid rgba(255,255,255,0.8)',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    minWidth: '100px',
                    boxShadow: whiteDiamondNFTs.length > 0 ? '0 0 20px rgba(255,255,255,0.4)' : 'none',
                  }}
                >
                  <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#fff'}}>
                    {whiteDiamondNFTs.length > 0 ? '⚔️' : '💎'} WHITE
                  </div>
                  <div style={{fontSize: '0.6rem', color: '#D4AF37', fontWeight: 600}}>
                    {whiteDiamondNFTs.length > 0 ? `${whiteDiamondNFTs.length} NFT${whiteDiamondNFTs.length > 1 ? 'S' : ''}` : 'NFT STAKE'}
                  </div>
                  <div style={{fontSize: '0.5rem', color: '#4CAF50', marginTop: '2px'}}>70% APR</div>
                </div>
                
                {/* Calculator Icon - Stake Forecaster */}
                <div 
                  onClick={() => handleNavClick('analytics')}
                  style={{
                    textAlign: 'center',
                    padding: '8px 12px',
                    background: 'rgba(76,175,80,0.15)',
                    borderRadius: '8px',
                    border: '2px solid rgba(76,175,80,0.5)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  title="Stake Calculator & Forecaster"
                >
                  <div style={{fontSize: '1.3rem'}}>🧮</div>
                  <div style={{fontSize: '0.5rem', color: '#4CAF50', fontWeight: 600}}>CALC</div>
                </div>
              </div>
            </div>
          )}

          <div className="hero-stats">
            <div className="hero-stat">
              <div className="hero-stat-value gold-text">{formatNumber(parseFloat(contractStats.totalStaked))}</div>
              <div className="hero-stat-label">Total Staked</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value gold-text" style={{position: 'relative'}}>
                ${livePrices.urmom.toFixed(7)}
                {!livePrices.loading && <span style={{position: 'absolute', top: '-8px', right: '-20px', fontSize: '0.5rem', background: '#4CAF50', padding: '2px 6px', borderRadius: '10px', color: '#FFF', animation: 'pulse 2s infinite'}}>LIVE</span>}
              </div>
              <div className="hero-stat-label">URMOM {livePrices.loading ? '⏳ Loading...' : ''}</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value gold-text" style={{position: 'relative'}}>
                ${livePrices.dtgc.toFixed(7)}
                {!livePrices.loading && <span style={{position: 'absolute', top: '-8px', right: '-20px', fontSize: '0.5rem', background: '#4CAF50', padding: '2px 6px', borderRadius: '10px', color: '#FFF', animation: 'pulse 2s infinite'}}>LIVE</span>}
              </div>
              <div className="hero-stat-label">DTGC {livePrices.loading ? '⏳ Loading...' : ''}</div>
            </div>
            <div className="hero-stat" style={{background: 'rgba(255,152,0,0.1)', borderRadius: '12px', border: '1px solid rgba(255,152,0,0.3)'}}>
              <div className="hero-stat-value" style={{color: '#FF9800', position: 'relative'}}>
                ${formatNumber(parseFloat(liveBurnedUSD))}
                <span style={{position: 'absolute', top: '-8px', right: '-20px', fontSize: '0.5rem', background: '#4CAF50', padding: '2px 6px', borderRadius: '10px', color: '#FFF', animation: 'pulse 2s infinite'}}>LIVE</span>
              </div>
              <div className="hero-stat-label" style={{color: '#FF9800'}}>🔥 URMOM Burned</div>
            </div>
            <div className="hero-stat" style={{background: 'rgba(244,67,54,0.1)', borderRadius: '12px', border: '1px solid rgba(244,67,54,0.3)'}}>
              <div className="hero-stat-value" style={{color: '#F44336', position: 'relative'}}>
                ${formatNumber(dtgcBurnData.burned * livePrices.dtgc, 2)}
                {!dtgcBurnData.loading && <span style={{position: 'absolute', top: '-8px', right: '-20px', fontSize: '0.5rem', background: '#4CAF50', padding: '2px 6px', borderRadius: '10px', color: '#FFF', animation: 'pulse 2s infinite'}}>LIVE</span>}
              </div>
              <div className="hero-stat-label" style={{color: '#F44336'}}>🔥 DTGC Burned</div>
            </div>
          </div>
        </section>

        {/* CURRENCY SELECTOR */}
        <section style={{
          margin: '0 auto 12px',
          maxWidth: '1200px',
          padding: '0 20px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '8px 16px',
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '20px',
            border: '1px solid rgba(212,175,55,0.3)',
          }}>
            <span style={{ fontSize: '0.75rem', color: '#D4AF37', fontWeight: 600 }}>💱 Display Currency:</span>
            <select
              value={displayCurrency}
              onChange={(e) => {
                setDisplayCurrency(e.target.value);
                localStorage.setItem('dtgc-display-currency', e.target.value);
              }}
              style={{
                padding: '6px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(212,175,55,0.4)',
                borderRadius: '8px',
                color: '#D4AF37',
                fontSize: '0.8rem',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              <option value="units">🔢 Units (Tokens)</option>
              <option value="usd">🇺🇸 USD ($)</option>
              <option value="eur">🇪🇺 EUR (€)</option>
              <option value="gbp">🇬🇧 GBP (£)</option>
              <option value="jpy">🇯🇵 JPY (¥)</option>
              <option value="sar">🇸🇦 SAR (﷼)</option>
              <option value="cny">🇨🇳 CNY (¥)</option>
              <option value="czk">🇨🇿 CZK (Kč)</option>
              <option value="aud">🇦🇺 AUD (A$)</option>
              <option value="ngn">🇳🇬 NGN (₦)</option>
              <option value="cop">🇨🇴 COP ($)</option>
              <option value="cad">🇨🇦 CAD (C$)</option>
            </select>
          </div>
        </section>

        {/* DTGC BURN BAR - LIVE */}
        <section style={{
          margin: '0 auto 20px',
          maxWidth: '1200px',
          padding: '0 20px',
        }}>
          <a 
            href={`${EXPLORER}/address/${CONTRACT_ADDRESSES.burn}`} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              background: 'linear-gradient(135deg, rgba(244,67,54,0.15) 0%, rgba(255,152,0,0.15) 100%)',
              border: '1px solid rgba(244,67,54,0.4)',
              borderRadius: '12px',
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '2rem' }}>🔥</span>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    DTGC Burned Forever
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#F44336' }}>
                    {dtgcBurnData.loading ? '⏳ Loading...' : formatNumber(dtgcBurnData.burned)} DTGC
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#888' }}>Live USD Value</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4CAF50' }}>
                  ${formatNumber(dtgcBurnData.burned * livePrices.dtgc, 2)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: '#888' }}>% of Total Supply</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#FF9800' }}>
                  {((dtgcBurnData.burned / DTGC_TOTAL_SUPPLY) * 100).toFixed(4)}%
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(244,67,54,0.2)',
                borderRadius: '20px',
                border: '1px solid rgba(244,67,54,0.4)',
              }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  background: dtgcBurnData.loading ? '#FF9800' : '#4CAF50',
                  animation: 'pulse 2s infinite'
                }} />
                <span style={{ fontSize: '0.75rem', color: dtgcBurnData.loading ? '#FF9800' : '#4CAF50' }}>
                  {dtgcBurnData.loading ? 'LOADING' : 'LIVE'} • View on Explorer ↗
                </span>
              </div>
            </div>
          </a>
        </section>

        {/* GOLD SUPPLY DYNAMICS BOX */}
        <section className="supply-dynamics-section" style={{
          margin: '20px auto',
          maxWidth: '1200px',
          padding: '0 20px',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(26,35,39,0.95) 0%, rgba(18,24,28,0.98) 100%)',
            border: '2px solid #D4AF37',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 8px 32px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ 
                fontSize: '0.65rem', 
                color: '#888', 
                letterSpacing: '2px', 
                marginBottom: '8px',
                textTransform: 'uppercase'
              }}>
                A dtgc.io contract, unique decentralized staking mechanism, on PulseChain
              </div>
              <h3 style={{ 
                fontSize: '1.5rem', 
                fontWeight: 800, 
                color: '#D4AF37',
                margin: 0,
                textShadow: '0 2px 10px rgba(212,175,55,0.3)'
              }}>
                ⚡ GOLD SUPPLY DYNAMICS DTGC ⚡
              </h3>
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#666', 
                marginTop: '4px'
              }}>
                Total Supply: 1,000,000,000 DTGC • Live Transparency
              </div>
            </div>

            {/* Supply Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}>
              {/* DAO Rewards Pool */}
              <a 
                href={`https://scan.pulsechain.com/address/${SUPPLY_WALLETS.dao.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
              <div style={{
                background: 'linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(76,175,80,0.05) 100%)',
                border: '1px solid rgba(76,175,80,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(76,175,80,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🏛️</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>DAO TREASURY</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50' }}>
                  {formatNumber(supplyDynamics.dao)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4CAF50', fontWeight: 600 }}>
                  {((supplyDynamics.dao / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </div>
                <div style={{ 
                  fontSize: '0.6rem', 
                  color: '#666', 
                  marginTop: '4px',
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.max(0.5, (supplyDynamics.dao / DTGC_TOTAL_SUPPLY) * 100)}%`,
                    height: '100%',
                    background: '#4CAF50',
                    borderRadius: '2px',
                  }} />
                </div>
                <div style={{ fontSize: '0.5rem', color: '#666', marginTop: '6px' }}>🔗 View on PulseScan</div>
              </div>
              </a>

              {/* Rewards Pool (V4 Staking Contract Balance) */}
              <a 
                href={`https://scan.pulsechain.com/address/${CONTRACT_ADDRESSES.stakingV4}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
              <div style={{
                background: 'linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(76,175,80,0.05) 100%)',
                border: '1px solid rgba(76,175,80,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(76,175,80,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🏦</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>REWARDS POOL</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50' }}>
                  {formatNumber(supplyDynamics.rewardsPool || 0)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#4CAF50', fontWeight: 600 }}>
                  Available for Payouts
                </div>
                <div style={{ fontSize: '0.5rem', color: '#666', marginTop: '6px' }}>🔗 View Contract</div>
              </div>
              </a>

              {/* Active Stakes Count */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,152,0,0.1) 0%, rgba(255,152,0,0.05) 100%)',
                border: '1px solid rgba(255,152,0,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>📊</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>ACTIVE STAKES</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FF9800' }}>
                  {stakedPositions.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#FF9800', fontWeight: 600 }}>
                  V4 Positions
                </div>
              </div>

              {/* LP Locked */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(156,39,176,0.1) 0%, rgba(156,39,176,0.05) 100%)',
                border: '1px solid rgba(156,39,176,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🔒</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>LP LOCKED</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#9C27B0' }}>
                  {formatNumber(supplyDynamics.lpLocked)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9C27B0', fontWeight: 600 }}>
                  {((supplyDynamics.lpLocked / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: `${(supplyDynamics.lpLocked / DTGC_TOTAL_SUPPLY) * 100}%`,
                    height: '100%',
                    background: '#9C27B0',
                    borderRadius: '2px',
                  }} />
                </div>
              </div>

              {/* Staked */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(0,188,212,0.1) 0%, rgba(0,188,212,0.05) 100%)',
                border: '1px solid rgba(0,188,212,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>💎</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>STAKED</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#00BCD4' }}>
                  {formatNumber(parseFloat(contractStats.totalStaked) || supplyDynamics.staked)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#00BCD4', fontWeight: 600 }}>
                  {(((parseFloat(contractStats.totalStaked) || supplyDynamics.staked) / DTGC_TOTAL_SUPPLY) * 100).toFixed(2)}%
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: `${((parseFloat(contractStats.totalStaked) || supplyDynamics.staked) / DTGC_TOTAL_SUPPLY) * 100}%`,
                    height: '100%',
                    background: '#00BCD4',
                    borderRadius: '2px',
                  }} />
                </div>
              </div>

              {/* Burned */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(244,67,54,0.1) 0%, rgba(244,67,54,0.05) 100%)',
                border: '1px solid rgba(244,67,54,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🔥</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>BURNED FOREVER</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F44336' }}>
                  {formatNumber(supplyDynamics.burned)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#F44336', fontWeight: 600 }}>
                  {((supplyDynamics.burned / DTGC_TOTAL_SUPPLY) * 100).toFixed(2)}%
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: `${Math.min((supplyDynamics.burned / DTGC_TOTAL_SUPPLY) * 100, 100)}%`,
                    height: '100%',
                    background: '#F44336',
                    borderRadius: '2px',
                  }} />
                </div>
              </div>

              {/* DAO Ecosystem (Treasury + LP Locked) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,152,0,0.1) 0%, rgba(255,152,0,0.05) 100%)',
                border: '1px solid rgba(255,152,0,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🏦</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>DAO ECOSYSTEM</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FF9800' }}>
                  {formatNumber(supplyDynamics.dao + supplyDynamics.lpLocked)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#FF9800', fontWeight: 600 }}>
                  {(((supplyDynamics.dao + supplyDynamics.lpLocked) / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: `${((supplyDynamics.dao + supplyDynamics.lpLocked) / DTGC_TOTAL_SUPPLY) * 100}%`,
                    height: '100%',
                    background: '#FF9800',
                    borderRadius: '2px',
                  }} />
                </div>
                <div style={{ fontSize: '0.55rem', color: '#666', marginTop: '6px' }}>Treasury + LP</div>
              </div>

              {/* 💰 TOTAL VALUE LOCKED (TVL) - NEW */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(212,175,55,0.1) 100%)',
                border: '2px solid rgba(76,175,80,0.5)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Glow effect */}
                <div style={{
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  width: '200%',
                  height: '200%',
                  background: 'radial-gradient(circle, rgba(76,175,80,0.15) 0%, transparent 60%)',
                  pointerEvents: 'none',
                }} />
                <div style={{ fontSize: '1.8rem', marginBottom: '4px', position: 'relative' }}>💰</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px', position: 'relative' }}>TOTAL VALUE LOCKED</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50', position: 'relative' }}>
                  ${formatNumber(
                    ((supplyDynamics.dao + supplyDynamics.lpLocked + (parseFloat(contractStats.totalStaked) || supplyDynamics.staked) + (supplyDynamics.rewardsPool || 0)) * (livePrices.dtgc || 0.0006))
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#D4AF37', fontWeight: 600, position: 'relative' }}>
                  {livePrices.dtgcMarketCap > 0 
                    ? (((supplyDynamics.dao + supplyDynamics.lpLocked + (parseFloat(contractStats.totalStaked) || supplyDynamics.staked) + (supplyDynamics.rewardsPool || 0)) * (livePrices.dtgc || 0.0006) / livePrices.dtgcMarketCap) * 100).toFixed(1)
                    : '0'}% of MCap
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '8px',
                  position: 'relative',
                }}>
                  <div style={{
                    width: `${Math.min(livePrices.dtgcMarketCap > 0 
                      ? ((supplyDynamics.dao + supplyDynamics.lpLocked + (parseFloat(contractStats.totalStaked) || supplyDynamics.staked) + (supplyDynamics.rewardsPool || 0)) * (livePrices.dtgc || 0.0006) / livePrices.dtgcMarketCap) * 100
                      : 0, 100)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #4CAF50, #D4AF37)',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                <div style={{ fontSize: '0.5rem', color: '#666', marginTop: '6px', position: 'relative' }}>Treasury + LP + Stakes + Rewards</div>
              </div>
            </div>

            {/* Summary Bar */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>MARKET CAP:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#D4AF37' }}>
                  ${formatNumber(livePrices.dtgcMarketCap)}
                </span>
              </div>
              <div style={{ 
                fontSize: '0.6rem', 
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ 
                  display: 'inline-block', 
                  width: '6px', 
                  height: '6px', 
                  borderRadius: '50%', 
                  background: '#4CAF50',
                  animation: 'pulse 2s infinite'
                }} />
                LIVE DATA
              </div>
            </div>

            {/* Holder Wallet Ticker */}
            <div className="ticker-container">
              <div style={{ 
                fontSize: '0.6rem', 
                color: '#666', 
                marginBottom: '6px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                padding: '0 60px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📊 PUBLIC HOLDERS • Hover to Pause
                  {liveHolders.loading ? (
                    <span style={{ color: '#FF9800' }}>⏳ Loading...</span>
                  ) : (
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      color: '#4CAF50' 
                    }}>
                      <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: '#4CAF50',
                        animation: 'pulse 2s infinite'
                      }} />
                      LIVE
                    </span>
                  )}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  color: '#D4AF37',
                  fontWeight: 600
                }}>
                  <span>Total Holders: {liveHolders.totalHolders || '...'}</span>
                </div>
              </div>
              <div className="ticker-track">
                {/* First set of items */}
                {(liveHolders.holders || []).map((wallet, index) => (
                  <div key={`a-${index}`} className="ticker-item">
                    <span className="ticker-address">{wallet.address}</span>
                    <span className="ticker-balance">{formatNumber(wallet.balance)} DTGC</span>
                    <span className="ticker-label">{wallet.label}</span>
                  </div>
                ))}
                {/* Duplicate for seamless loop */}
                {(liveHolders.holders || []).map((wallet, index) => (
                  <div key={`b-${index}`} className="ticker-item">
                    <span className="ticker-address">{wallet.address}</span>
                    <span className="ticker-balance">{formatNumber(wallet.balance)} DTGC</span>
                    <span className="ticker-label">{wallet.label}</span>
                  </div>
                ))}
              </div>
              <div style={{ 
                fontSize: '0.55rem', 
                color: '#888', 
                textAlign: 'center', 
                marginTop: '8px',
                display: 'flex',
                justifyContent: 'center',
                gap: '30px',
                flexWrap: 'wrap',
                padding: '0 40px'
              }}>
                <span style={{ color: '#4CAF50' }}>
                  💰 Top 50 Hold: {(liveHolders.trackedPctOfTotal || 0).toFixed(2)}% of total
                </span>
                <span style={{ color: '#FF9800' }}>
                  📊 Public Float: {formatNumber(liveHolders.publicFloat || 0)} DTGC ({((liveHolders.publicFloat || 0) / DTGC_TOTAL_SUPPLY * 100).toFixed(1)}%)
                </span>
                <span style={{ color: '#D4AF37' }}>
                  🏆 Tracked: {formatNumber(liveHolders.trackedBalance || 0)} DTGC
                </span>
              </div>
            </div>
          </div>
        </section>

        <main className="main-content" id="main-content">
          {/* STAKE TAB */}
          {activeTab === 'stake' && (
            <section className="section">
              <div className="section-header">
                <h2 className="section-title gold-text">SELECT YOUR TIER</h2>
                <p style={{ fontSize: '0.65rem', color: 'rgba(212,175,55,0.7)', marginTop: '-4px', marginBottom: '12px' }}>*V4 contracts • Unlimited stakes per tier</p>
                <div className="section-divider" />
                <p className="section-description">V4 Unlimited Multi-Stake: Stack multiple positions across all tiers simultaneously!</p>
              </div>

              {/* Market Cap Phase Indicator */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.05) 100%)',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: '12px',
                padding: '16px 24px',
                marginBottom: '24px',
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>CURRENT PHASE</div>
                  <div style={{ color: '#D4AF37', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {getCurrentPhase(livePrices.dtgcMarketCap || 0).name.toUpperCase()}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                    {getCurrentPhase(livePrices.dtgcMarketCap || 0).description}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>MARKET CAP</div>
                  <div style={{ color: '#4CAF50', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {formatMarketCap(livePrices.dtgcMarketCap || 0)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>APR MULTIPLIER</div>
                  <div style={{ color: '#D4AF37', fontSize: '1.2rem', fontWeight: 'bold' }}>
                    {(getCurrentPhase(livePrices.dtgcMarketCap || 0).multiplier * 100).toFixed(0)}%
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>TOTAL FEES</div>
                  <div style={{ color: '#FF9800', fontSize: '1rem', fontWeight: 'bold' }}>
                    {V5_FEES.entry.total + V5_FEES.exit.total}% (IN/OUT)
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                    {V5_FEES.entry.total}% entry + {V5_FEES.exit.total}% exit
                  </div>
                </div>
              </div>

              {/* ROW 1: Silver, Gold, Whale (3 cards) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginBottom: '16px'
              }}>
                {V5_STAKING_TIERS.map((tier) => {
                  const effectiveAPR = getEffectiveAPR(tier.apr, livePrices.dtgcMarketCap || 0);
                  return (
                  <div
                    key={tier.id}
                    className={`tier-card ${selectedTier === tier.id && !isLP ? 'selected' : ''}`}
                    style={{ '--tier-gradient': tier.gradient }}
                    onClick={() => { setSelectedTier(tier.id); setIsLP(false); }}
                  >
                    <div className="tier-icon">{tier.icon}</div>
                    <div className="tier-name" style={{ color: tier.color }}>{tier.name}</div>
                    <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      Min: ${tier.minInvest.toLocaleString()}
                      {tier.maxInvest && <span style={{ marginLeft: '8px' }}>• Max: ${tier.maxInvest.toLocaleString()}</span>}
                    </div>
                    <div className="tier-apr-container">
                      <div className="tier-apr gold-text">{effectiveAPR.toFixed(1)}%</div>
                      <div className="tier-apr-label">APR</div>
                      {effectiveAPR < tier.apr && (
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>Base: {tier.apr}%</div>
                      )}
                    </div>
                    <div className="tier-features">
                      <div className="tier-feature">
                        <span className="tier-feature-label">Lock</span>
                        <span className="tier-feature-value">{tier.lockDays} Days</span>
                      </div>
                      <div className="tier-feature">
                        <span className="tier-feature-label">Bonus</span>
                        <span className="tier-feature-value">+{tier.bonus}%</span>
                      </div>
                    </div>
                    <span className="tier-badge">DTGC</span>
                  </div>
                  );
                })}
              </div>

              {/* ROW 2: Diamond & Diamond+ LP Tiers (centered) */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                flexWrap: 'wrap'
              }}>
                {/* Diamond Tier with Dynamic APR */}
                {(() => {
                  const diamondEffectiveAPR = getEffectiveAPR(V5_DIAMOND_TIER.apr * V5_DIAMOND_TIER.boost, livePrices.dtgcMarketCap || 0);
                  const diamondBaseAPR = V5_DIAMOND_TIER.apr * V5_DIAMOND_TIER.boost;
                  return (
                <div
                  className={`tier-card diamond ${isLP && selectedTier === 3 ? 'selected' : ''}`}
                  onClick={() => { setSelectedTier(3); setIsLP(true); }}
                  style={{ flex: '0 1 280px', maxWidth: '320px' }}
                >
                  <div className="tier-icon">{V5_DIAMOND_TIER.icon}</div>
                  <div className="tier-name" style={{ color: V5_DIAMOND_TIER.color }}>{V5_DIAMOND_TIER.name}</div>
                  <div className="tier-subtitle">{V5_DIAMOND_TIER.lpPair} LP • {V5_DIAMOND_TIER.boost}x BOOST!</div>
                  <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Max: ${V5_DIAMOND_TIER.maxInvest.toLocaleString()}</div>
                  <div className="tier-apr-container">
                    <div className="tier-apr" style={{ color: 'var(--diamond-dark)' }}>{diamondEffectiveAPR.toFixed(1)}%</div>
                    <div className="tier-apr-label">EFFECTIVE APR</div>
                    {diamondEffectiveAPR < diamondBaseAPR && (
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>Base: {diamondBaseAPR}%</div>
                    )}
                  </div>
                  <div className="tier-features">
                    <div className="tier-feature">
                      <span className="tier-feature-label">Lock</span>
                      <span className="tier-feature-value">{V5_DIAMOND_TIER.lockDays} Days</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Bonus</span>
                      <span className="tier-feature-value">+{V5_DIAMOND_TIER.bonus}%</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Boost</span>
                      <span className="tier-feature-value" style={{ color: '#4CAF50', fontWeight: '700' }}>{V5_DIAMOND_TIER.boost}x!</span>
                    </div>
                  </div>
                  <span className="tier-badge lp">LP</span>
                </div>
                  );
                })()}

                {/* Diamond+ Tier with Dynamic APR */}
                {(() => {
                  const diamondPlusEffectiveAPR = getEffectiveAPR(V5_DIAMOND_PLUS_TIER.apr * V5_DIAMOND_PLUS_TIER.boost, livePrices.dtgcMarketCap || 0);
                  const diamondPlusBaseAPR = V5_DIAMOND_PLUS_TIER.apr * V5_DIAMOND_PLUS_TIER.boost;
                  return (
                <div
                  className={`tier-card diamond-plus ${isLP && selectedTier === 4 ? 'selected' : ''}`}
                  onClick={() => { setSelectedTier(4); setIsLP(true); }}
                  style={{ flex: '0 1 280px', maxWidth: '320px', background: 'linear-gradient(135deg, rgba(156,39,176,0.1) 0%, rgba(123,31,162,0.15) 100%)', border: '2px solid #9C27B0' }}
                >
                  <div className="tier-icon" style={{ fontSize: '2.5rem' }}>{V5_DIAMOND_PLUS_TIER.icon}</div>
                  <div className="tier-name" style={{ color: V5_DIAMOND_PLUS_TIER.color }}>{V5_DIAMOND_PLUS_TIER.name}</div>
                  <div className="tier-subtitle" style={{ color: '#9C27B0' }}>{V5_DIAMOND_PLUS_TIER.lpPair} LP • {V5_DIAMOND_PLUS_TIER.boost}x BOOST!</div>
                  <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Max: ${V5_DIAMOND_PLUS_TIER.maxInvest.toLocaleString()}</div>
                  <div className="tier-apr-container">
                    <div className="tier-apr" style={{ color: '#9C27B0', fontSize: '2.2rem' }}>{diamondPlusEffectiveAPR.toFixed(1)}%</div>
                    <div className="tier-apr-label">EFFECTIVE APR</div>
                    {diamondPlusEffectiveAPR < diamondPlusBaseAPR && (
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>Base: {diamondPlusBaseAPR}%</div>
                    )}
                  </div>
                  <div className="tier-features">
                    <div className="tier-feature">
                      <span className="tier-feature-label">Lock</span>
                      <span className="tier-feature-value">{V5_DIAMOND_PLUS_TIER.lockDays} Days</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Bonus</span>
                      <span className="tier-feature-value">+{V5_DIAMOND_PLUS_TIER.bonus}%</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Boost</span>
                      <span className="tier-feature-value" style={{ color: '#9C27B0', fontWeight: '700' }}>{V5_DIAMOND_PLUS_TIER.boost}x!!</span>
                    </div>
                  </div>
                  {/* Multiplier Paper Link */}
                  <a 
                    href="/docs/DTGC_Multiplier_Paper.pdf" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'block',
                      marginTop: '12px',
                      padding: '8px 12px',
                      background: 'rgba(156,39,176,0.15)',
                      borderRadius: '8px',
                      border: '1px solid rgba(156,39,176,0.3)',
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      color: '#CE93D8',
                      fontWeight: '600',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    📄 Multiplier Paper
                  </a>
                  <span className="tier-badge lp" style={{ background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)' }}>LP+</span>
                </div>
                  );
                })()}

                {/* ⭐ WHITE DIAMOND NFT TIER - Transferable! */}
                <div
                  className="tier-card white-diamond"
                  onClick={() => handleNavClick('whitediamond')}
                  style={{ 
                    flex: '0 1 280px', 
                    maxWidth: '320px', 
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(200,200,200,0.1) 50%, rgba(150,150,150,0.05) 100%)', 
                    border: '2px solid #FFFFFF',
                    boxShadow: '0 8px 32px rgba(255,255,255,0.2), 0 0 60px rgba(255,255,255,0.1)',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                >
                  {/* Gold Star NFT Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    color: '#000',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    boxShadow: '0 2px 8px rgba(255,215,0,0.5)',
                    zIndex: 10,
                  }}>
                    ⭐ NFT
                  </div>
                  <div className="tier-icon" style={{ fontSize: '2.5rem' }}>💎</div>
                  <div className="tier-name" style={{ 
                    background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8E8 50%, #B8B8B8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    fontWeight: '800',
                  }}>WHITE DIAMOND</div>
                  <div className="tier-subtitle" style={{ color: '#CCC' }}>LP STAKING • TRADEABLE NFT!</div>
                  <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Min: 1,000 LP
                  </div>
                  <div className="tier-apr-container">
                    <div className="tier-apr" style={{ color: '#FFF', fontSize: '2.2rem' }}>70.0%</div>
                    <div className="tier-apr-label">APR</div>
                  </div>
                  <div className="tier-features">
                    <div className="tier-feature">
                      <span className="tier-feature-label">Lock</span>
                      <span className="tier-feature-value">90 Days</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Entry Fee</span>
                      <span className="tier-feature-value">3.75%</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label" style={{ color: '#FFD700' }}>⭐ NFT</span>
                      <span className="tier-feature-value" style={{ color: '#4CAF50', fontWeight: '700' }}>TRADEABLE!</span>
                    </div>
                  </div>
                  {/* NFT Info Banner */}
                  <div style={{
                    marginTop: '12px',
                    padding: '8px',
                    background: 'rgba(255,215,0,0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,215,0,0.3)',
                  }}>
                    <div style={{ fontSize: '0.65rem', color: '#FFD700', fontWeight: '600', textAlign: 'center' }}>
                      🔄 WRAP → TRADE → UNWRAP
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#888', textAlign: 'center', marginTop: '2px' }}>
                      Sell your stake on OpenSea!
                    </div>
                  </div>
                  <span className="tier-badge lp" style={{ background: 'linear-gradient(135deg, #FFFFFF 0%, #B8B8B8 100%)', color: '#000' }}>NFT</span>
                </div>

                {/* FLEX Tier Card */}
                <div
                  className={`tier-card flex ${isFlexTier ? 'selected' : ''}`}
                  onClick={() => { setIsFlexTier(true); setSelectedTier(null); setIsLP(false); }}
                  style={{ 
                    flex: '0 1 280px', 
                    maxWidth: '320px', 
                    background: 'linear-gradient(135deg, rgba(255,20,147,0.15) 0%, rgba(255,105,180,0.1) 50%, rgba(255,182,193,0.05) 100%)', 
                    border: isFlexTier ? '3px solid #FF1493' : '2px solid #FF1493',
                    boxShadow: isFlexTier ? '0 0 20px rgba(255,20,147,0.5)' : '0 8px 32px rgba(255,20,147,0.2)',
                    transform: isFlexTier ? 'scale(1.02)' : 'scale(1)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <div className="tier-icon" style={{ fontSize: '2.5rem' }}>💗⚡</div>
                  <div className="tier-name" style={{ color: '#FF1493' }}>FLEX</div>
                  <div className="tier-subtitle" style={{ color: '#FF69B4' }}>COIN CLEAN • NO LOCK!</div>
                  <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Requires $300+ Diamond/Diamond+
                  </div>
                  <div className="tier-apr-container">
                    <div className="tier-apr" style={{ color: '#FF1493', fontSize: '2.2rem' }}>10.0%</div>
                    <div className="tier-apr-label">APR</div>
                  </div>
                  <div className="tier-features">
                    <div className="tier-feature">
                      <span className="tier-feature-label">Lock</span>
                      <span className="tier-feature-value" style={{ color: '#4CAF50', fontWeight: '700' }}>NONE</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Tax</span>
                      <span className="tier-feature-value" style={{ color: '#FFD700', fontWeight: '700' }}>2%</span>
                    </div>
                    <div className="tier-feature">
                      <span className="tier-feature-label">Exit</span>
                      <span className="tier-feature-value" style={{ color: '#4CAF50', fontWeight: '700' }}>Anytime</span>
                    </div>
                  </div>
                  <span className="tier-badge" style={{ background: 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)' }}>FLEX</span>
                </div>
              </div>

              {/* LP Staking Rewards Remaining */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginTop: '16px',
                marginBottom: '16px'
              }}>
                {/* Diamond (DTGC Staking) Rewards */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0,191,255,0.1) 0%, rgba(0,191,255,0.05) 100%)',
                  border: '1px solid rgba(0,191,255,0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#00BCD4', letterSpacing: '1px', marginBottom: '4px' }}>💎 DTGC STAKING REWARDS</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50' }}>
                    ${formatNumber((parseFloat(stakingRewardsRemaining) || 0) * (livePrices.dtgc || 0), 2)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#00BCD4', marginTop: '4px' }}>
                    {formatNumber(parseFloat(stakingRewardsRemaining) || 0)} DTGC
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#888', marginTop: '2px' }}>Silver • Gold • Whale</div>
                </div>

                {/* Diamond+ (LP Staking) Rewards */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(156,39,176,0.1) 0%, rgba(156,39,176,0.05) 100%)',
                  border: '1px solid rgba(156,39,176,0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.65rem', color: '#9C27B0', letterSpacing: '1px', marginBottom: '4px' }}>💜💎 LP STAKING REWARDS</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50' }}>
                    ${formatNumber((parseFloat(lpStakingRewardsRemaining) || 0) * (livePrices.dtgc || 0), 2)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#9C27B0', marginTop: '4px' }}>
                    {formatNumber(parseFloat(lpStakingRewardsRemaining) || 0)} DTGC
                  </div>
                  <div style={{ fontSize: '0.55rem', color: '#888', marginTop: '2px' }}>Diamond • Diamond+</div>
                </div>
              </div>

              {/* Staking Form */}
              {selectedTier !== null && account && (
                <div className="staking-panel">
                  <h3 className="panel-title gold-text">
                    {isLP ? '💎 STAKE LP TOKENS' : `${V5_STAKING_TIERS[selectedTier]?.icon} STAKE DTGC`}
                  </h3>

                  <div className="input-group">
                    <div className="input-header">
                      <span className="input-label">Amount</span>
                      <span className="balance-display" onClick={() => {
                        // Get the correct balance based on tier
                        const getBalance = () => {
                          if (!isLP) return dtgcBalance;
                          return selectedTier === 4 ? lpDtgcUrmomBalance : lpDtgcPlsBalance;
                        };
                        const getLpName = () => {
                          if (!isLP) return 'DTGC';
                          return selectedTier === 4 ? 'DTGC/URMOM LP' : 'DTGC/PLS LP';
                        };
                        if (stakeInputMode === 'tokens') {
                          setStakeAmount(getBalance());
                        } else {
                          // Set max in currency value
                          const maxTokens = parseFloat(getBalance()) || 0;
                          const priceUsd = livePrices.dtgc || 0;
                          const valueUsd = maxTokens * priceUsd;
                          const currencyValue = convertToCurrency(valueUsd).value;
                          setStakeAmount(currencyValue.toFixed(2));
                        }
                      }} style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px'}}>
                        <span>Balance: {formatNumber(parseFloat(isLP ? (selectedTier === 4 ? lpDtgcUrmomBalance : lpDtgcPlsBalance) : dtgcBalance))} {isLP ? (selectedTier === 4 ? 'DTGC/URMOM LP' : 'DTGC/PLS LP') : 'DTGC'}</span>
                        <span style={{fontSize: '0.75rem', color: '#4CAF50'}}>≈ {getCurrencySymbol()}{formatNumber(convertToCurrency((parseFloat(isLP ? (selectedTier === 4 ? lpDtgcUrmomBalance : lpDtgcPlsBalance) : dtgcBalance) || 0) * (livePrices.dtgc || 0)).value)}</span>
                      </span>
                    </div>
                    <div className="input-container">
                      <div style={{position: 'relative', flex: 1, display: 'flex', alignItems: 'center'}}>
                        {stakeInputMode === 'currency' && (
                          <span style={{position: 'absolute', left: '12px', color: 'var(--gold)', fontWeight: 700, fontSize: '1.1rem'}}>
                            {getCurrencySymbol()}
                          </span>
                        )}
                        <input
                          type="number"
                          className="stake-input"
                          placeholder="0.00"
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          style={stakeInputMode === 'currency' ? {paddingLeft: '32px'} : {}}
                        />
                      </div>
                      <div className="input-suffix">
                        <button
                          onClick={() => {
                            const newMode = stakeInputMode === 'tokens' ? 'currency' : 'tokens';
                            // Convert current value when switching
                            if (stakeAmount && parseFloat(stakeAmount) > 0) {
                              const priceUsd = livePrices.dtgc || 0;
                              if (newMode === 'currency' && priceUsd > 0) {
                                // Converting from tokens to currency
                                const tokens = parseFloat(stakeAmount);
                                const valueUsd = tokens * priceUsd;
                                const currencyValue = convertToCurrency(valueUsd).value;
                                setStakeAmount(currencyValue.toFixed(2));
                              } else if (newMode === 'tokens' && priceUsd > 0) {
                                // Converting from currency to tokens
                                const currencyVal = parseFloat(stakeAmount);
                                const valueUsd = convertFromCurrency(currencyVal);
                                const tokens = valueUsd / priceUsd;
                                setStakeAmount(tokens.toFixed(2));
                              }
                            }
                            setStakeInputMode(newMode);
                          }}
                          style={{
                            padding: '6px 10px',
                            background: stakeInputMode === 'currency' ? 'linear-gradient(135deg, #4CAF50, #8BC34A)' : 'rgba(212,175,55,0.3)',
                            border: '1px solid var(--gold)',
                            borderRadius: '8px',
                            color: '#FFF',
                            fontWeight: 700,
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            marginRight: '6px',
                            transition: 'all 0.2s ease',
                          }}
                          title={stakeInputMode === 'tokens' ? 'Switch to currency input' : 'Switch to token input'}
                        >
                          {stakeInputMode === 'tokens' ? (isLP ? 'LP' : 'DTGC') : displayCurrency.toUpperCase()}
                        </button>
                        <button className="max-btn" onClick={() => {
                          const getBalance = () => {
                            if (!isLP) return dtgcBalance;
                            return selectedTier === 4 ? lpDtgcUrmomBalance : lpDtgcPlsBalance;
                          };
                          if (stakeInputMode === 'tokens') {
                            // Use 99.8% to leave room for gas/rounding
                            const maxBalance = parseFloat(getBalance()) || 0;
                            const safeMax = (maxBalance * 0.998).toFixed(6);
                            setStakeAmount(safeMax);
                          } else {
                            const maxTokens = parseFloat(getBalance()) || 0;
                            // Use 99.8% to leave room for gas/rounding
                            const safeMaxTokens = maxTokens * 0.998;
                            const priceUsd = livePrices.dtgc || 0;
                            const valueUsd = safeMaxTokens * priceUsd;
                            const currencyValue = convertToCurrency(valueUsd).value;
                            setStakeAmount(currencyValue.toFixed(2));
                          }
                        }}>MAX</button>
                      </div>
                    </div>
                    {/* Show conversion when in currency mode */}
                    {stakeInputMode === 'currency' && stakeAmount && parseFloat(stakeAmount) > 0 && (
                      <div style={{fontSize: '0.8rem', color: 'var(--gold)', marginTop: '8px', textAlign: 'right'}}>
                        ≈ {formatNumber((() => {
                          const currencyVal = parseFloat(stakeAmount) || 0;
                          const priceUsd = livePrices.dtgc || 0;
                          if (priceUsd <= 0) return 0;
                          const valueUsd = convertFromCurrency(currencyVal);
                          return valueUsd / priceUsd;
                        })())} {isLP ? 'LP' : 'DTGC'} tokens
                      </div>
                    )}
                    {/* Show selected currency value when in token mode */}
                    {stakeInputMode === 'tokens' && stakeAmount && parseFloat(stakeAmount) > 0 && (
                      <div style={{fontSize: '0.8rem', color: '#4CAF50', marginTop: '8px', textAlign: 'right'}}>
                        ≈ {getCurrencySymbol()}{formatNumber(convertToCurrency((parseFloat(stakeAmount) || 0) * (livePrices.dtgc || 0)).value)}
                      </div>
                    )}
                  </div>

                  {/* Gas Speed Selector */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                      ⛽ Speed:
                    </div>
                    {[
                      { id: 'normal', label: '🐢 Normal', multiplier: '1x' },
                      { id: 'fast', label: '🚀 Fast', multiplier: '1.5x' },
                      { id: 'urgent', label: '⚡ Urgent', multiplier: '2x' },
                    ].map(speed => (
                      <button
                        key={speed.id}
                        onClick={() => setGasSpeed(speed.id)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          background: gasSpeed === speed.id 
                            ? speed.id === 'urgent' ? 'rgba(255,87,34,0.3)' : speed.id === 'fast' ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.1)'
                            : 'transparent',
                          border: `1px solid ${gasSpeed === speed.id 
                            ? speed.id === 'urgent' ? '#FF5722' : speed.id === 'fast' ? '#4CAF50' : 'rgba(255,255,255,0.3)'
                            : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '8px',
                          color: gasSpeed === speed.id ? '#fff' : 'var(--text-muted)',
                          fontSize: '0.7rem',
                          fontWeight: gasSpeed === speed.id ? 600 : 400,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        <div>{speed.label}</div>
                        <div style={{ fontSize: '0.6rem', opacity: 0.7 }}>{speed.multiplier} gas</div>
                      </button>
                    ))}
                  </div>

                  <button
                    className="action-btn primary"
                    onClick={handleStake}
                    disabled={loading || !stakeAmount || parseFloat(stakeAmount) <= 0}
                  >
                    {loading && <span className="spinner" />}
                    {isLP ? 'Stake LP Tokens' : 'Stake DTGC'}
                  </button>

                  <div className="fee-breakdown">
                    <div className="fee-title">TAX STRUCTURE <span style={{ fontSize: '0.7rem', color: 'var(--gold)', cursor: 'pointer' }} onClick={() => setActiveTab('whitepaper')}>📄 Details</span></div>
                    <div className="fee-row"><span>Entry Tax</span><span style={{color: '#4CAF50'}}>3.75%</span></div>
                    <div className="fee-row"><span>Exit Tax</span><span style={{color: '#4CAF50'}}>3.75%</span></div>
                    <div className="fee-row"><span>EES (Emergency End Stake)</span><span style={{color: '#FF5722'}}>20%</span></div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                      Entry/Exit: 1.875% DAO • 0.625% Dev • 1% Auto LP • 0.25% Burn
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#4CAF50', marginTop: '4px', textAlign: 'center' }}>
                      ✓ Sustainable tokenomics • 7.5% total fees
                    </div>
                  </div>
                </div>
              )}

              {/* FLEX STAKING PANEL - COMPREHENSIVE MULTI-TOKEN */}
              {isFlexTier && account && (
                <div className="staking-panel" style={{
                  background: 'linear-gradient(135deg, rgba(255,20,147,0.1) 0%, rgba(255,105,180,0.05) 100%)',
                  border: '2px solid #FF1493',
                  boxShadow: '0 8px 32px rgba(255, 20, 147, 0.2)',
                  maxWidth: '500px',
                }}>
                  <h3 className="panel-title" style={{ color: '#FF1493' }}>
                    ⚡💎 FLEX COIN CLEAN
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#FF69B4', marginBottom: '8px', textAlign: 'center' }}>
                    Select tokens to zap → DTGC/PLS LP • 10% APR • No Lock
                  </p>
                  <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginBottom: '16px', textAlign: 'center' }}>
                    🔍 Scanner finds ALL tokens including pump.tires & PulseX pairs
                  </p>

                  {/* Search/Filter */}
                  <div style={{ marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="🔍 Filter tokens..."
                      value={flexFilter}
                      onChange={(e) => setFlexFilter(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255,20,147,0.3)',
                        background: 'rgba(0,0,0,0.2)',
                        color: '#fff',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  {/* Scan Button */}
                  <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={scanWalletTokens}
                      disabled={scanningWallet}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: scanningWallet ? 'rgba(255,20,147,0.1)' : 'linear-gradient(135deg, rgba(255,20,147,0.2) 0%, rgba(255,105,180,0.1) 100%)',
                        border: '1px solid #FF1493',
                        borderRadius: '8px',
                        color: '#FF1493',
                        cursor: scanningWallet ? 'wait' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {scanningWallet ? (
                        <>🔄 Scanning Wallet...</>
                      ) : (
                        <>🔍 Deep Scan Wallet</>
                      )}
                    </button>
                    {lastScanTime && (
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', alignSelf: 'center' }}>
                        {walletTokens.length} found
                      </div>
                    )}
                  </div>

                  {/* Token List with Checkboxes */}
                  <div style={{
                    maxHeight: '320px',
                    overflowY: 'auto',
                    marginBottom: '16px',
                    border: '1px solid rgba(255,20,147,0.2)',
                    borderRadius: '12px',
                    background: 'rgba(0,0,0,0.2)',
                  }}>
                    {walletTokens.length === 0 && !scanningWallet && (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                        Click "Scan All Tokens" to find tokens in your wallet
                      </div>
                    )}
                    {scanningWallet && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#FF69B4' }}>
                        <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
                        Scanning wallet for all tokens...
                      </div>
                    )}
                    {walletTokens
                      .filter(token => 
                        flexFilter === '' || 
                        token.symbol.toLowerCase().includes(flexFilter.toLowerCase()) ||
                        token.name.toLowerCase().includes(flexFilter.toLowerCase())
                      )
                      .map((token) => {
                        const balanceNum = parseFloat(token.balance) || 0;
                        const valueUsd = token.valueUsd || 0;
                        const isSelected = selectedFlexTokens[token.address || 'pls'];
                        
                        const tokenKey = token.address || 'pls';
                        return (
                          <div
                            key={tokenKey}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '12px 14px',
                              borderBottom: '1px solid rgba(255,255,255,0.05)',
                              background: isSelected ? 'rgba(255,20,147,0.15)' : 'transparent',
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={!!isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFlexTokens(prev => ({
                                    ...prev,
                                    [tokenKey]: { ...token, amount: token.balance }
                                  }));
                                } else {
                                  setSelectedFlexTokens(prev => {
                                    const newState = { ...prev };
                                    delete newState[tokenKey];
                                    return newState;
                                  });
                                }
                              }}
                              style={{
                                width: '18px',
                                height: '18px',
                                marginRight: '12px',
                                accentColor: '#FF1493',
                                cursor: 'pointer',
                              }}
                            />
                            
                            {/* Token Icon & Name */}
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.2rem' }}>{token.icon}</span>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: token.color, fontWeight: 600, fontSize: '0.9rem' }}>{token.symbol}</span>
                                    {token.hasLiquidity && (
                                      <span style={{ 
                                        fontSize: '0.5rem', 
                                        background: 'rgba(76,175,80,0.3)', 
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        color: '#4CAF50'
                                      }}>💧 LIQ</span>
                                    )}
                                    {token.isUnknown && (
                                      <span style={{ 
                                        fontSize: '0.5rem', 
                                        background: 'rgba(255,152,0,0.3)', 
                                        padding: '2px 6px', 
                                        borderRadius: '4px',
                                        color: '#FF9800'
                                      }}>⚠️ NO LIQ</span>
                                    )}
                                    {/* Contract Address Copy Button */}
                                    {token.address && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(token.address);
                                          showToast(`📋 ${token.symbol} address copied!`, 'success');
                                        }}
                                        title={token.address}
                                        style={{
                                          padding: '2px 4px',
                                          background: 'rgba(255,255,255,0.1)',
                                          border: '1px solid rgba(255,255,255,0.2)',
                                          borderRadius: '3px',
                                          color: 'rgba(255,255,255,0.6)',
                                          fontSize: '0.5rem',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '2px',
                                        }}
                                      >
                                        📋 {token.address.slice(0,6)}...
                                      </button>
                                    )}
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem' }}>{token.name}</div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Balance & Amount Input */}
                            <div style={{ textAlign: 'right', minWidth: '140px' }}>
                              {isSelected ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="number"
                                    value={selectedFlexTokens[tokenKey]?.amount || ''}
                                    onChange={(e) => setSelectedFlexTokens(prev => ({
                                      ...prev,
                                      [tokenKey]: { ...prev[tokenKey], amount: e.target.value }
                                    }))}
                                    style={{
                                      width: '90px',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #FF1493',
                                      background: 'rgba(0,0,0,0.4)',
                                      color: '#fff',
                                      fontSize: '0.8rem',
                                      textAlign: 'right',
                                    }}
                                  />
                                  <button
                                    onClick={() => setSelectedFlexTokens(prev => ({
                                      ...prev,
                                      [tokenKey]: { ...prev[tokenKey], amount: (parseFloat(token.balance) * 0.998).toFixed(6) }
                                    }))}
                                    style={{
                                      padding: '6px 8px',
                                      background: 'rgba(255,20,147,0.3)',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: '#FF1493',
                                      fontSize: '0.65rem',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    MAX
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                                    {formatNumber(balanceNum)}
                                  </div>
                                  <div style={{ color: '#4CAF50', fontSize: '0.7rem' }}>
                                    ${formatNumber(valueUsd)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Output Mode Toggle */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginBottom: '12px',
                  }}>
                    <button
                      onClick={() => setFlexOutputMode('stake')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: flexOutputMode === 'stake' ? '2px solid #FF1493' : '1px solid rgba(255,255,255,0.2)',
                        background: flexOutputMode === 'stake' ? 'rgba(255,20,147,0.2)' : 'transparent',
                        color: flexOutputMode === 'stake' ? '#FF1493' : 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}
                    >
                      ⚡ Stake LP (10% APR)
                    </button>
                    <button
                      onClick={() => setFlexOutputMode('wallet')}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: flexOutputMode === 'wallet' ? '2px solid #4CAF50' : '1px solid rgba(255,255,255,0.2)',
                        background: flexOutputMode === 'wallet' ? 'rgba(76,175,80,0.2)' : 'transparent',
                        color: flexOutputMode === 'wallet' ? '#4CAF50' : 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}
                    >
                      💰 Keep in Wallet
                    </button>
                  </div>

                  {/* Stake Percentage Slider */}
                  {flexOutputMode === 'stake' && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#FF69B4' }}>Stake Percentage</span>
                        <span style={{ fontSize: '0.85rem', color: '#FF1493', fontWeight: 700 }}>{flexStakePercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={flexStakePercent}
                        onChange={(e) => setFlexStakePercent(parseInt(e.target.value))}
                        style={{
                          width: '100%',
                          accentColor: '#FF1493',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>
                        <span>10%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}

                  {/* Summary Box */}
                  {(() => {
                    const totalValueUsd = Object.entries(selectedFlexTokens).reduce((sum, [key, tokenData]) => {
                      const amountNum = parseFloat(tokenData?.amount) || 0;
                      const price = tokenData?.price || 0;
                      return sum + (amountNum * price);
                    }, 0);
                    const selectedCount = Object.keys(selectedFlexTokens).length;
                    const entryFee = totalValueUsd * 0.01;
                    const netValue = totalValueUsd * 0.99;
                    const stakeValue = flexOutputMode === 'stake' ? netValue * (flexStakePercent / 100) : 0;
                    const walletValue = flexOutputMode === 'stake' ? netValue * ((100 - flexStakePercent) / 100) : netValue;
                    const estLpTokens = stakeValue / ((livePrices.dtgc || 0.0005) * 2);

                    return (
                      <div style={{
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '12px',
                        padding: '16px',
                        marginBottom: '16px',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#FF69B4', marginBottom: '10px', letterSpacing: '1px' }}>
                          📊 SUMMARY ({selectedCount} token{selectedCount !== 1 ? 's' : ''} selected)
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>Total Value:</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>${formatNumber(totalValueUsd)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem' }}>Entry Fee (1%):</span>
                          <span style={{ color: '#FFD700' }}>-${formatNumber(entryFee)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px', marginTop: '8px' }}>
                          {flexOutputMode === 'stake' ? (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#FF1493', fontWeight: 600 }}>To Stake ({flexStakePercent}%):</span>
                                <span style={{ color: '#FF1493', fontWeight: 700 }}>${formatNumber(stakeValue)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ color: '#FF1493', fontSize: '0.8rem' }}>Est. LP Tokens:</span>
                                <span style={{ color: '#FF1493', fontWeight: 700 }}>~{formatNumber(estLpTokens)} LP</span>
                              </div>
                              {flexStakePercent < 100 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ color: '#4CAF50', fontWeight: 600 }}>To Wallet ({100 - flexStakePercent}%):</span>
                                  <span style={{ color: '#4CAF50', fontWeight: 700 }}>${formatNumber(walletValue)} PLS</span>
                                </div>
                              )}
                            </>
                          ) : (
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#4CAF50', fontWeight: 600 }}>To Wallet (PLS):</span>
                              <span style={{ color: '#4CAF50', fontWeight: 700 }}>${formatNumber(walletValue)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Liquidity Notice */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(255,152,0,0.1) 100%)',
                    border: '1px solid rgba(76,175,80,0.3)',
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '16px',
                    fontSize: '0.7rem',
                    color: '#8BC34A',
                    textAlign: 'center',
                  }}>
                    ✅ Smart Routing: PulseX + pump.tires fallback • Converts what's possible, skips the rest
                  </div>

                  {/* Action Button */}
                  <button
                    className="action-btn primary"
                    onClick={async () => {
                      const selectedCount = Object.keys(selectedFlexTokens).length;
                      if (!provider || selectedCount === 0) return;
                      
                      try {
                        setFlexLoading(true);
                        const signer = await provider.getSigner();
                        const dapper = new ethers.Contract(DAPPER_ADDRESS, DAPPER_ABI, signer);
                        
                        let successCount = 0;
                        let failedTokens = [];
                        let convertedTokens = [];
                        
                        // Process each selected token
                        for (const [key, tokenData] of Object.entries(selectedFlexTokens)) {
                          const amount = parseFloat(tokenData?.amount) || 0;
                          if (amount <= 0) continue;
                          
                          try {
                            if (key === 'pls' || !tokenData?.address) {
                              // Native PLS
                              const amountWei = ethers.parseEther(amount.toString());
                              const tx = await dapper.zapPLS({ value: amountWei });
                              showToast(`⚡ Zapping ${amount.toFixed(2)} PLS...`, 'info');
                              await tx.wait();
                              successCount++;
                              convertedTokens.push({ symbol: 'PLS', amount, valueUsd: amount * (livePrices.pls || 0.00003) });
                            } else {
                              // ERC20 Token - validate balance first
                              const tokenContract = new ethers.Contract(tokenData.address, [
                                'function approve(address spender, uint256 amount) returns (bool)',
                                'function allowance(address owner, address spender) view returns (uint256)',
                                'function balanceOf(address account) view returns (uint256)',
                              ], signer);
                              
                              const decimals = parseInt(tokenData.decimals) || 18;
                              const amountWei = ethers.parseUnits(amount.toString(), decimals);
                              
                              // Validate on-chain balance before zapping
                              let actualBalance;
                              try {
                                actualBalance = await tokenContract.balanceOf(account);
                              } catch (balErr) {
                                console.warn(`⚠️ Cannot read balance for ${tokenData.symbol}:`, balErr.message);
                                failedTokens.push(`${tokenData.symbol} (invalid contract)`);
                                continue;
                              }
                              
                              if (actualBalance < amountWei) {
                                console.warn(`⚠️ ${tokenData.symbol}: Insufficient balance`);
                                failedTokens.push(`${tokenData.symbol} (insufficient balance)`);
                                continue;
                              }
                              
                              // Try PulseX first, then pump.tires V1 as fallback
                              let swapMethod = null; // 'pulsex' or 'pumptires'
                              
                              // Simulate PulseX zap first
                              try {
                                await dapper.zapToken.staticCall(tokenData.address, amountWei);
                                swapMethod = 'pulsex';
                              } catch (pulseXErr) {
                                console.log(`📊 ${tokenData.symbol}: No PulseX liquidity, trying pump.tires V1...`);
                                
                                // Try pump.tires V1 bonding curve as fallback
                                try {
                                  const pumpTires = new ethers.Contract(PUMP_TIRES_ADDRESS, PUMP_TIRES_ABI, signer);
                                  // Simulate sell with 5% slippage (minAmountOut = 0 for simulation)
                                  await pumpTires.sellToken.staticCall(tokenData.address, amountWei, 0);
                                  swapMethod = 'pumptires';
                                  console.log(`✅ ${tokenData.symbol}: Found pump.tires V1 liquidity!`);
                                } catch (pumpErr) {
                                  console.warn(`⚠️ ${tokenData.symbol}: No liquidity on PulseX or pump.tires`);
                                  failedTokens.push(`${tokenData.symbol} (no liquidity)`);
                                  continue;
                                }
                              }
                              
                              // Execute the swap based on which method has liquidity
                              if (swapMethod === 'pulsex') {
                                // PulseX path - approve Dapper and zap
                                const allowance = await tokenContract.allowance(account, DAPPER_ADDRESS);
                                if (allowance < amountWei) {
                                  showToast(`🔓 Approving ${tokenData.symbol} for PulseX...`, 'info');
                                  const approveTx = await tokenContract.approve(DAPPER_ADDRESS, ethers.MaxUint256);
                                  await approveTx.wait();
                                }
                                
                                showToast(`⚡ Zapping ${amount.toFixed(4)} ${tokenData.symbol} via PulseX...`, 'info');
                                const tx = await dapper.zapToken(tokenData.address, amountWei);
                                await tx.wait();
                                successCount++;
                                convertedTokens.push({ 
                                  symbol: tokenData.symbol, 
                                  amount, 
                                  valueUsd: tokenData.valueUsd || (amount * (tokenData.price || 0)),
                                  address: tokenData.address,
                                  source: 'PulseX'
                                });
                              } else if (swapMethod === 'pumptires') {
                                // Pump.tires V1 path - approve pump.tires and sell
                                const allowance = await tokenContract.allowance(account, PUMP_TIRES_ADDRESS);
                                if (allowance < amountWei) {
                                  showToast(`🔓 Approving ${tokenData.symbol} for pump.tires...`, 'info');
                                  const approveTx = await tokenContract.approve(PUMP_TIRES_ADDRESS, ethers.MaxUint256);
                                  await approveTx.wait();
                                }
                                
                                // Get PLS balance before sell
                                const plsBeforeSell = await provider.getBalance(account);
                                
                                showToast(`🛞 Selling ${amount.toFixed(4)} ${tokenData.symbol} via pump.tires...`, 'info');
                                const pumpTires = new ethers.Contract(PUMP_TIRES_ADDRESS, PUMP_TIRES_ABI, signer);
                                // Use 5% slippage protection (minAmountOut = 0 for now, can be improved)
                                const tx = await pumpTires.sellToken(tokenData.address, amountWei, 0);
                                const receipt = await tx.wait();
                                
                                // Calculate PLS received
                                const plsAfterSell = await provider.getBalance(account);
                                const gasUsed = receipt.gasUsed * receipt.gasPrice;
                                const plsReceived = Number(ethers.formatEther(plsAfterSell - plsBeforeSell + gasUsed));
                                
                                successCount++;
                                convertedTokens.push({ 
                                  symbol: tokenData.symbol, 
                                  amount, 
                                  valueUsd: tokenData.valueUsd || (amount * (tokenData.price || 0)),
                                  address: tokenData.address,
                                  source: 'pump.tires',
                                  plsReceived: plsReceived
                                });
                              }
                            }
                          } catch (tokenErr) {
                            console.error(`❌ Failed to zap ${tokenData?.symbol || key}:`, tokenErr.message);
                            failedTokens.push(`${tokenData?.symbol || key} (swap failed)`);
                          }
                        }
                        
                        // Show conversion receipt
                        if (convertedTokens.length > 0 || failedTokens.length > 0) {
                          setFlexConversionReceipt({
                            converted: convertedTokens,
                            failed: failedTokens,
                            timestamp: Date.now()
                          });
                        }
                        
                        if (successCount === 0) {
                          showToast('❌ No tokens could be zapped. Check PLS liquidity on PulseX.', 'error');
                          return;
                        }
                        
                        // Calculate totals for celebration
                        const totalValueUsd = convertedTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);
                        
                        const netValue = totalValueUsd * 0.99; // After 1% fee
                        const stakeValue = netValue * (flexStakePercent / 100);
                        const walletValue = netValue - stakeValue;
                        const estLpTokens = stakeValue / ((livePrices.dtgc || 0.0002) * 2);
                        
                        if (flexOutputMode === 'stake') {
                          const newFlexStake = {
                            id: Date.now(),
                            lpAmount: estLpTokens,
                            plsReturned: walletValue / (livePrices.pls || 0.00003),
                            totalValue: totalValueUsd,
                            stakeValue: stakeValue,
                            stakePercent: flexStakePercent,
                            timestamp: Date.now(),
                            apr: 10,
                          };
                          // Add to flex stakes
                          setFlexStakes(prev => [...prev, newFlexStake]);
                          // Show pink celebration popup
                          setFlexSuccess(newFlexStake);
                          showToast(`🎉 Flex LP Created! ${flexStakePercent}% staked at 10% APR!`, 'success');
                        } else {
                          showToast('✅ Converted to PLS in wallet!', 'success');
                        }
                        setSelectedFlexTokens({});
                        scanWalletTokens(); // Refresh balances
                      } catch (err) {
                        console.error('Flex zap error:', err);
                        showToast('Zap failed: ' + err.message, 'error');
                      } finally {
                        setFlexLoading(false);
                      }
                    }}
                    disabled={flexLoading || Object.keys(selectedFlexTokens).length === 0}
                    style={{
                      background: flexOutputMode === 'stake' 
                        ? 'linear-gradient(135deg, #FF1493 0%, #FF69B4 100%)'
                        : 'linear-gradient(135deg, #4CAF50 0%, #8BC34A 100%)',
                      border: 'none',
                    }}
                  >
                    {flexLoading ? 'Processing...' : 
                     flexOutputMode === 'stake' ? `⚡ Zap & Stake ${flexStakePercent}%` : '💰 Convert to PLS'}
                  </button>

                  {/* Success Notice */}
                  {flexOutputMode === 'stake' && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'linear-gradient(135deg, rgba(255,20,147,0.1) 0%, rgba(255,105,180,0.05) 100%)',
                      border: '1px solid #FF1493',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}>
                      <div style={{ color: '#FF1493', fontSize: '0.8rem', fontWeight: 600 }}>
                        🎯 After Zap: {flexStakePercent}% staked • 10% APR • No Time Lock
                      </div>
                    </div>
                  )}

                  {/* Flex Success Celebration Popup */}
                  {flexSuccess && (
                    <div style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'linear-gradient(135deg, rgba(255,20,147,0.98) 0%, rgba(255,105,180,0.98) 100%)',
                      border: '3px solid #FFD700',
                      borderRadius: '20px',
                      padding: '32px',
                      textAlign: 'center',
                      zIndex: 10000,
                      boxShadow: '0 0 60px rgba(255,20,147,0.8), 0 0 100px rgba(255,215,0,0.4)',
                      animation: 'pulse 0.5s ease-in-out',
                      minWidth: '320px',
                    }}>
                      <div style={{ fontSize: '4rem', marginBottom: '16px' }}>🎉💗⚡</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                        CONGRATULATIONS!
                      </div>
                      <div style={{ fontSize: '1.2rem', color: '#FFD700', marginBottom: '16px', fontWeight: 700 }}>
                        Flex LP Created Successfully!
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '12px' }}>
                        ~${formatNumber(flexSuccess.stakeValue || (flexSuccess.totalValue * 0.99 * (flexSuccess.stakePercent / 100)), 2)} LP Staked
                      </div>
                      <div style={{ 
                        background: 'rgba(0,0,0,0.3)', 
                        borderRadius: '12px', 
                        padding: '16px', 
                        marginBottom: '16px' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#fff' }}>LP Staked:</span>
                          <span style={{ color: '#FFD700', fontWeight: 700 }}>~{formatNumber(flexSuccess.lpAmount, 4)} LP</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#fff' }}>PLS to Wallet:</span>
                          <span style={{ color: '#4CAF50', fontWeight: 700 }}>~{formatNumber(flexSuccess.plsReturned, 2)} PLS</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#fff' }}>Total Value:</span>
                          <span style={{ color: '#fff', fontWeight: 700 }}>${formatNumber(flexSuccess.totalValue, 2)}</span>
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '16px' }}>
                        ⚡ {flexSuccess.stakePercent}% Staked • 10% APR • No Lock
                      </div>
                      <button
                        onClick={() => setFlexSuccess(null)}
                        style={{
                          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                          border: 'none',
                          padding: '12px 32px',
                          borderRadius: '25px',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#000',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Awesome!
                      </button>
                    </div>
                  )}
                  {flexSuccess && (
                    <div 
                      onClick={() => setFlexSuccess(null)}
                      style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        zIndex: 9999,
                      }}
                    />
                  )}

                  {/* Conversion Receipt Popup */}
                  {flexConversionReceipt && (
                    <div style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'linear-gradient(135deg, rgba(30,30,40,0.98) 0%, rgba(20,20,30,0.98) 100%)',
                      border: '2px solid #D4AF37',
                      borderRadius: '16px',
                      padding: '24px',
                      zIndex: 10001,
                      boxShadow: '0 0 40px rgba(212,175,55,0.3)',
                      minWidth: '340px',
                      maxWidth: '420px',
                      maxHeight: '80vh',
                      overflowY: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#D4AF37' }}>
                          📋 Conversion Receipt
                        </div>
                        <button
                          onClick={() => setFlexConversionReceipt(null)}
                          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', fontSize: '1.2rem', cursor: 'pointer' }}
                        >×</button>
                      </div>
                      
                      {/* Converted Tokens */}
                      {flexConversionReceipt.converted.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '0.8rem', color: '#4CAF50', fontWeight: 600, marginBottom: '8px' }}>
                            ✅ Successfully Converted ({flexConversionReceipt.converted.length})
                          </div>
                          {flexConversionReceipt.converted.map((token, i) => (
                            <div key={i} style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              padding: '8px 10px', 
                              background: token.source === 'pump.tires' 
                                ? 'linear-gradient(135deg, rgba(255,152,0,0.15) 0%, rgba(76,175,80,0.1) 100%)'
                                : 'rgba(76,175,80,0.1)', 
                              borderRadius: '6px',
                              marginBottom: '4px',
                              border: token.source === 'pump.tires'
                                ? '1px solid rgba(255,152,0,0.3)'
                                : '1px solid rgba(76,175,80,0.2)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#4CAF50', fontWeight: 600 }}>{token.symbol}</span>
                                {token.source && (
                                  <span style={{
                                    fontSize: '0.55rem',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: token.source === 'pump.tires' 
                                      ? 'rgba(255,152,0,0.3)' 
                                      : 'rgba(76,175,80,0.3)',
                                    color: token.source === 'pump.tires' ? '#FF9800' : '#4CAF50',
                                    fontWeight: 600
                                  }}>
                                    {token.source === 'pump.tires' ? '🛞 pump.tires' : '💚 PulseX'}
                                  </span>
                                )}
                                {token.address && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(token.address);
                                      showToast('📋 Address copied!', 'success');
                                    }}
                                    style={{
                                      padding: '2px 4px',
                                      background: 'rgba(255,255,255,0.1)',
                                      border: '1px solid rgba(255,255,255,0.2)',
                                      borderRadius: '3px',
                                      color: 'rgba(255,255,255,0.5)',
                                      fontSize: '0.5rem',
                                      cursor: 'pointer',
                                    }}
                                  >📋</button>
                                )}
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ color: '#fff', fontSize: '0.8rem' }}>{formatNumber(token.amount, 4)}</div>
                                {token.plsReceived > 0 && (
                                  <div style={{ color: '#4CAF50', fontSize: '0.65rem' }}>→ {formatNumber(token.plsReceived, 2)} PLS</div>
                                )}
                                {!token.plsReceived && token.valueUsd > 0 && (
                                  <div style={{ color: '#4CAF50', fontSize: '0.65rem' }}>${formatNumber(token.valueUsd, 2)}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Failed Tokens */}
                      {flexConversionReceipt.failed.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '0.8rem', color: '#FF9800', fontWeight: 600, marginBottom: '8px' }}>
                            ⚠️ Could Not Convert ({flexConversionReceipt.failed.length})
                          </div>
                          {flexConversionReceipt.failed.map((reason, i) => (
                            <div key={i} style={{ 
                              padding: '6px 10px', 
                              background: 'rgba(255,152,0,0.1)', 
                              borderRadius: '6px',
                              marginBottom: '4px',
                              border: '1px solid rgba(255,152,0,0.2)',
                              fontSize: '0.75rem',
                              color: '#FF9800'
                            }}>
                              {reason}
                            </div>
                          ))}
                          <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px' }}>
                            💡 These tokens likely lack PLS liquidity on PulseX. They may be PRC20 copies without trading pairs.
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={() => setFlexConversionReceipt(null)}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #D4AF37 0%, #B8860B 100%)',
                          border: 'none',
                          padding: '10px',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          color: '#000',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Got It
                      </button>
                    </div>
                  )}
                  {flexConversionReceipt && (
                    <div 
                      onClick={() => setFlexConversionReceipt(null)}
                      style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)',
                        zIndex: 10000,
                      }}
                    />
                  )}

                  {/* Fee Info */}
                  <div className="fee-breakdown" style={{ marginTop: '16px' }}>
                    <div className="fee-title" style={{ color: '#FF1493' }}>
                      FLEX FEES 
                      <a href="/docs/DapperFlexPinkPaper.docx" download style={{ fontSize: '0.7rem', color: '#FF69B4', marginLeft: '8px' }}>
                        📄 Pink Paper
                      </a>
                    </div>
                    <div className="fee-row"><span>Entry Fee</span><span style={{color: '#FFD700'}}>1%</span></div>
                    <div className="fee-row"><span>Exit Fee</span><span style={{color: '#FFD700'}}>1%</span></div>
                    <div className="fee-row"><span>APR</span><span style={{color: '#4CAF50'}}>10%</span></div>
                    <div className="fee-row"><span>Lock Period</span><span style={{color: '#4CAF50'}}>None</span></div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center' }}>
                      All fees → Growth Engine for DTGC buybacks
                    </div>
                  </div>
                </div>
              )}

              {/* Active Positions (Mainnet) */}
              {!TESTNET_MODE && account && getVisibleNonFlexPositions().length > 0 && (
                <div style={{
                  maxWidth: '700px',
                  margin: '40px auto 0',
                  background: 'var(--bg-card)',
                  borderRadius: '24px',
                  padding: '30px',
                  border: '1px solid var(--border-color)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{
                      fontFamily: 'Cinzel, serif',
                      fontSize: '1.2rem',
                      letterSpacing: '3px',
                      textAlign: 'center',
                      color: 'var(--gold)',
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                    }}>
                      📊 YOUR STAKED POSITIONS
                      {USE_V4_CONTRACTS && (
                        <span style={{
                          background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: '#FFF',
                          letterSpacing: '1px',
                        }}>V4 • {getVisibleNonFlexPositions().length} ACTIVE</span>
                      )}
                    </h3>
                    <button
                      onClick={() => {
                        if (window.confirm('Clear stale position data? Use this if you see ghost stakes that no longer exist.')) {
                          forceClearStaleData();
                        }
                      }}
                      style={{
                        background: 'rgba(255,107,107,0.1)',
                        border: '1px solid rgba(255,107,107,0.3)',
                        color: '#FF6B6B',
                        fontSize: '0.7rem',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑️ Clear Stale
                    </button>
                  </div>

                  {getVisibleNonFlexPositions().map((pos) => {
                    const now = Date.now();
                    const isLocked = now < pos.endTime;
                    const daysLeft = Math.max(0, Math.ceil((pos.endTime - now) / (24 * 60 * 60 * 1000)));
                    const daysStaked = Math.max(0, (now - pos.startTime) / (24 * 60 * 60 * 1000));
                    // V19 APR Correction - Fix old contract's crazy APRs (use tierName string, not tier number)
                    // NOTE: getV19CorrectedAPR already returns the boosted APR (42% for Diamond, 70% for Diamond+)
                    // Do NOT multiply by boostMultiplier again - that would double-apply the boost!
                    const correctedApr = getV19CorrectedAPR(pos.apr, pos.tierName || pos.tier, pos.isLP);
                    const effectiveApr = correctedApr; // APR is already boosted, don't multiply again
                    const currentRewards = (pos.amount * (effectiveApr / 100) / 365) * daysStaked;
                    const rewardValue = currentRewards * (livePrices.dtgc || 0);

                    // Determine tier display info
                    let displayTierName, displayTierIcon, displayTierColor, displayBorderColor;
                    if (pos.isLP) {
                      if (pos.lpType === 1 || pos.tierName === 'DIAMOND+') {
                        displayTierName = 'DIAMOND+ LP';
                        displayTierIcon = '💜💎';
                        displayTierColor = '#9C27B0';
                        displayBorderColor = 'rgba(156,39,176,0.5)';
                      } else {
                        displayTierName = 'DIAMOND LP';
                        displayTierIcon = '💎';
                        displayTierColor = '#00BCD4';
                        displayBorderColor = 'rgba(0,188,212,0.5)';
                      }
                    } else {
                      // Regular DTGC stakes
                      const tierNum = typeof pos.tier === 'number' ? pos.tier : (['SILVER', 'GOLD', 'WHALE'].indexOf((pos.tierName || pos.tier || 'GOLD').toUpperCase()));
                      if (tierNum === 0 || pos.tierName === 'SILVER') {
                        displayTierName = 'SILVER';
                        displayTierIcon = '🥈';
                        displayTierColor = '#C0C0C0';
                        displayBorderColor = 'rgba(192,192,192,0.5)';
                      } else if (tierNum === 2 || pos.tierName === 'WHALE') {
                        displayTierName = 'WHALE';
                        displayTierIcon = '🐋';
                        displayTierColor = '#2196F3';
                        displayBorderColor = 'rgba(33,150,243,0.5)';
                      } else {
                        displayTierName = 'GOLD';
                        displayTierIcon = '🥇';
                        displayTierColor = '#FFD700';
                        displayBorderColor = 'rgba(255,215,0,0.5)';
                      }
                    }

                    return (
                      <div key={pos.id} className={window.innerWidth < 768 ? 'position-card-mobile' : ''} style={{
                        background: isDark ? `linear-gradient(135deg, rgba(${displayTierColor === '#9C27B0' ? '156,39,176' : displayTierColor === '#00BCD4' ? '0,188,212' : displayTierColor === '#C0C0C0' ? '192,192,192' : displayTierColor === '#2196F3' ? '33,150,243' : '255,215,0'},0.1) 0%, rgba(0,0,0,0.2) 100%)` : `rgba(${displayTierColor === '#9C27B0' ? '156,39,176' : displayTierColor === '#00BCD4' ? '0,188,212' : displayTierColor === '#C0C0C0' ? '192,192,192' : displayTierColor === '#2196F3' ? '33,150,243' : '255,215,0'},0.05)`,
                        border: `2px solid ${displayBorderColor}`,
                        borderLeft: `4px solid ${displayTierColor}`,
                        borderRadius: '12px',
                        padding: window.innerWidth < 768 ? '12px' : '20px',
                        marginBottom: '12px',
                        position: 'relative',
                      }}>
                        {/* V4/V3 Badge */}
                        <div style={{
                          position: 'absolute',
                          top: '6px',
                          right: '6px',
                          background: pos.isV4 ? 'linear-gradient(135deg, #4CAF50, #2E7D32)' : 'linear-gradient(135deg, #FF9800, #F57C00)',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          color: '#FFF',
                          letterSpacing: '0.5px',
                        }}>{pos.isV4 ? 'V4' : 'V3 Legacy'}</div>
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: window.innerWidth < 768 ? '8px' : '15px'}}>
                          {/* Left side - Position info */}
                          <div style={{flex: '1', minWidth: '140px'}}>
                            <div className="tier-name" style={{fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: window.innerWidth < 768 ? '0.9rem' : '1.1rem', color: displayTierColor}}>
                              {displayTierIcon} {displayTierName}
                            </div>
                            <div className="staked-amount" style={{fontSize: window.innerWidth < 768 ? '0.72rem' : '0.85rem', color: 'var(--text-secondary)', marginTop: '3px'}}>
                              Staked: <strong>{formatNumber(pos.amount)} {pos.isLP ? 'LP' : 'DTGC'}</strong>
                              <span style={{fontSize: window.innerWidth < 768 ? '0.65rem' : '0.75rem', color: '#4CAF50', marginLeft: '4px'}}>
                                ({getCurrencySymbol()}{formatNumber(convertToCurrency(pos.amount * (livePrices.dtgc || 0) * (pos.isLP ? 2 : 1)).value)})
                              </span>
                            </div>
                            <div className="apr-display" style={{fontSize: window.innerWidth < 768 ? '0.68rem' : '0.8rem', color: 'var(--text-muted)', marginTop: '2px'}}>
                              APR: <strong style={{color: displayTierColor}}>{effectiveApr.toFixed(1)}%</strong> {pos.isLP && pos.boostMultiplier > 1 && <span style={{fontSize: '0.6rem', color: '#4CAF50'}}>({pos.boostMultiplier}x LP)</span>}
                            </div>
                            <div style={{fontSize: window.innerWidth < 768 ? '0.68rem' : '0.8rem', color: isLocked ? '#FF6B6B' : '#4CAF50', marginTop: '3px'}}>
                              {isLocked ? `🔒 ${daysLeft}d left` : '✅ Unlocked'}
                            </div>
                            <div className="date-display" style={{fontSize: window.innerWidth < 768 ? '0.6rem' : '0.75rem', color: 'var(--text-muted)', marginTop: '2px'}}>
                              📅 Unlock: <strong style={{color: isLocked ? '#FFB74D' : '#4CAF50'}}>{new Date(pos.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                            </div>
                          </div>
                          
                          {/* Right side - Rewards & Actions */}
                          <div style={{textAlign: 'right', minWidth: window.innerWidth < 768 ? '100px' : '130px'}}>
                            <div style={{fontSize: window.innerWidth < 768 ? '0.6rem' : '0.75rem', color: 'var(--text-muted)'}}>Rewards Accrued</div>
                            <div className="rewards-value" style={{fontSize: window.innerWidth < 768 ? '1rem' : '1.3rem', fontWeight: 800, color: '#4CAF50'}}>
                              +{formatNumber(currentRewards, window.innerWidth < 768 ? 1 : 2)} DTGC
                            </div>
                            <div style={{fontSize: window.innerWidth < 768 ? '0.55rem' : '0.7rem', color: '#4CAF50', opacity: 0.9}}>
                              ≈ {getCurrencySymbol()}{formatNumber(convertToCurrency(rewardValue).value, 2)}
                            </div>
                            <div style={{fontSize: window.innerWidth < 768 ? '0.55rem' : '0.7rem', color: '#9C27B0', opacity: 0.9}}>
                              ≈ {formatNumber(livePrices.pls > 0 ? (rewardValue / livePrices.pls) : 0, 0)} PLS
                            </div>
                            <div style={{display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end', flexWrap: 'wrap'}}>
                              {isLocked ? (
                                <button
                                  className="action-btn-small"
                                  onClick={() => handleEmergencyWithdraw(pos.isLP, pos.id)}
                                  style={{
                                    padding: window.innerWidth < 768 ? '5px 8px' : '8px 16px',
                                    background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                                    border: 'none',
                                    borderRadius: '16px',
                                    fontWeight: 700,
                                    fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem',
                                    color: '#FFF',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ⚠️ Emergency (20%)
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="action-btn-small"
                                    onClick={() => handleClaimRewards(pos.isLP, pos.id)}
                                    style={{
                                      padding: window.innerWidth < 768 ? '5px 8px' : '8px 16px',
                                      background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                                      border: 'none',
                                      borderRadius: '16px',
                                      fontWeight: 700,
                                      fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem',
                                      color: '#FFF',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🎁 Claim Rewards
                                  </button>
                                  <button
                                    className="action-btn-small"
                                    onClick={() => handleUnstake(pos.id)}
                                    style={{
                                      padding: window.innerWidth < 768 ? '5px 8px' : '8px 16px',
                                      background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
                                      border: 'none',
                                      borderRadius: '16px',
                                      fontWeight: 700,
                                      fontSize: window.innerWidth < 768 ? '0.6rem' : '0.7rem',
                                      color: '#FFF',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🔓 Withdraw
                                  </button>
                                </>
                              )}
                              {/* Ghost Clear Button */}
                              <button
                                onClick={() => {
                                  if (window.confirm('Clear this position from UI? Use if this stake no longer exists.')) {
                                    setStakedPositions(prev => prev.filter(p => p.id !== pos.id));
                                    showToast('🧹 Position cleared from UI', 'success');
                                  }
                                }}
                                style={{
                                  padding: '6px 12px',
                                  background: 'transparent',
                                  border: '1px dashed rgba(255,255,255,0.3)',
                                  borderRadius: '20px',
                                  fontWeight: 500,
                                  fontSize: '0.6rem',
                                  color: 'rgba(255,255,255,0.5)',
                                  cursor: 'pointer',
                                }}
                              >
                                🧹 Clear Ghost
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 💗 CONSOLIDATED FLEX POOL - Single Box for ALL Flex Stakes */}
              {!TESTNET_MODE && account && (getVisibleFlexStakes().length > 0 || getVisibleFlexPositions().length > 0) && (() => {
                // Calculate totals across ALL flex stakes
                const allFlexStakes = [...getVisibleFlexPositions(), ...getVisibleFlexStakes()];
                const totalFlexLP = allFlexStakes.reduce((sum, s) => sum + (s.amount || s.lpAmount || 0), 0);
                const totalFlexValue = totalFlexLP * (livePrices.dtgc || 0.0005) * 2;
                
                // Calculate total pending rewards
                const totalPendingRewards = allFlexStakes.reduce((sum, s) => {
                  const stakeTime = s.startTime || s.timestamp || Date.now();
                  const daysStaked = Math.max(0, (Date.now() - stakeTime) / (24 * 60 * 60 * 1000));
                  const lpAmount = s.amount || s.lpAmount || 0;
                  const rewards = (lpAmount * 0.10 / 365) * daysStaked;
                  return sum + rewards;
                }, 0);
                const rewardsValue = totalPendingRewards * (livePrices.dtgc || 0.0005) * 2;
                const rewardsValuePls = livePrices.pls > 0 ? (rewardsValue / livePrices.pls) : 0;
                
                // Calculate averages
                const avgDaysStaked = allFlexStakes.length > 0 
                  ? allFlexStakes.reduce((sum, s) => {
                      const stakeTime = s.startTime || s.timestamp || Date.now();
                      return sum + Math.max(0, (Date.now() - stakeTime) / (24 * 60 * 60 * 1000));
                    }, 0) / allFlexStakes.length
                  : 0;
                
                // Amounts based on sliders
                const claimAmount = totalPendingRewards * (flexClaimPercent / 100);
                const claimValue = claimAmount * (livePrices.dtgc || 0.0005) * 2;
                const unstakeAmount = totalFlexLP * (flexUnstakePercent / 100);
                const unstakeValue = unstakeAmount * (livePrices.dtgc || 0.0005) * 2;
                
                return (
                  <div style={{
                    maxWidth: '700px',
                    margin: '20px auto 0',
                    background: 'linear-gradient(135deg, rgba(255,20,147,0.15) 0%, rgba(255,105,180,0.05) 100%)',
                    borderRadius: '24px',
                    padding: '28px',
                    border: '2px solid #FF1493',
                    boxShadow: '0 8px 32px rgba(255,20,147,0.25)',
                  }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '24px',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}>
                      <h3 style={{
                        fontFamily: 'Cinzel, serif',
                        fontSize: '1.2rem',
                        letterSpacing: '2px',
                        color: '#FF1493',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        margin: 0,
                      }}>
                        💗 FLEX POOL
                        {allFlexStakes.length > 1 && (
                          <span style={{
                            background: '#FF1493',
                            color: '#fff',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                          }}>
                            {allFlexStakes.length} STAKES
                          </span>
                        )}
                      </h3>
                      <span style={{
                        background: 'linear-gradient(135deg, #FF1493, #FF69B4)',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#FFF',
                      }}>10% APR • NO LOCK</span>
                    </div>
                    
                    {/* Stats Grid */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: '16px',
                      marginBottom: '24px',
                    }}>
                      {/* Total LP Staked */}
                      <div style={{
                        background: 'rgba(255,20,147,0.1)',
                        borderRadius: '16px',
                        padding: '16px',
                        textAlign: 'center',
                        border: '1px solid rgba(255,20,147,0.3)',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#FF69B4', marginBottom: '6px', fontWeight: 600 }}>TOTAL LP STAKED</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FF1493' }}>{formatNumber(totalFlexLP, 2)}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>≈ ${formatNumber(totalFlexValue, 2)}</div>
                      </div>
                      
                      {/* Pending Rewards */}
                      <div style={{
                        background: 'rgba(76,175,80,0.1)',
                        borderRadius: '16px',
                        padding: '16px',
                        textAlign: 'center',
                        border: '1px solid rgba(76,175,80,0.3)',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#4CAF50', marginBottom: '6px', fontWeight: 600 }}>PENDING REWARDS</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#4CAF50' }}>+{formatNumber(totalPendingRewards, 4)}</div>
                        <div style={{ fontSize: '0.7rem', color: '#888' }}>≈ ${formatNumber(rewardsValue, 4)}</div>
                        <div style={{ fontSize: '0.65rem', color: '#9C27B0' }}>≈ {formatNumber(rewardsValuePls, 0)} PLS</div>
                      </div>
                      
                      {/* Avg Time Staked */}
                      <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '16px',
                        padding: '16px',
                        textAlign: 'center',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '6px', fontWeight: 600 }}>AVG TIME STAKED</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatNumber(avgDaysStaked, 1)}d</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{allFlexStakes.length} position(s)</div>
                      </div>
                    </div>
                    
                    {/* Claim Rewards Slider */}
                    <div style={{
                      background: 'rgba(76,175,80,0.08)',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '16px',
                      border: '1px solid rgba(76,175,80,0.2)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4CAF50' }}>🎁 Claim Rewards</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4CAF50' }}>
                          {flexClaimPercent}% = {formatNumber(claimAmount, 4)} LP (${formatNumber(claimValue, 4)})
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={flexClaimPercent}
                        onChange={(e) => setFlexClaimPercent(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '8px',
                          borderRadius: '4px',
                          background: `linear-gradient(to right, #4CAF50 0%, #4CAF50 ${flexClaimPercent}%, rgba(255,255,255,0.2) ${flexClaimPercent}%, rgba(255,255,255,0.2) 100%)`,
                          appearance: 'none',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        {[25, 50, 75, 100].map(pct => (
                          <button
                            key={pct}
                            onClick={() => setFlexClaimPercent(pct)}
                            style={{
                              padding: '4px 12px',
                              background: flexClaimPercent === pct ? '#4CAF50' : 'rgba(76,175,80,0.2)',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: flexClaimPercent === pct ? '#fff' : '#4CAF50',
                              cursor: 'pointer',
                            }}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={async () => {
                          if (claimAmount <= 0) {
                            showToast('No rewards to claim', 'info');
                            return;
                          }
                          showToast(`🎁 Claiming ${flexClaimPercent}% of rewards (${formatNumber(claimAmount, 4)} LP)...`, 'info');
                          // For now, claim means full exit of proportional stakes
                          // TODO: Implement partial claim if contract supports it
                          showToast('Partial claims coming soon! Use Exit below for now.', 'info');
                        }}
                        disabled={loading || claimAmount <= 0}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '12px',
                          background: claimAmount > 0 ? 'linear-gradient(135deg, #4CAF50, #45a049)' : 'rgba(76,175,80,0.3)',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          color: '#fff',
                          cursor: claimAmount > 0 ? 'pointer' : 'not-allowed',
                          opacity: claimAmount > 0 ? 1 : 0.5,
                        }}
                      >
                        🎁 CLAIM {flexClaimPercent}% REWARDS
                      </button>
                    </div>
                    
                    {/* Unstake LP Slider */}
                    <div style={{
                      background: 'rgba(255,20,147,0.08)',
                      borderRadius: '16px',
                      padding: '20px',
                      marginBottom: '16px',
                      border: '1px solid rgba(255,20,147,0.2)',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#FF1493' }}>💗 Unstake LP</span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FF1493' }}>
                          {flexUnstakePercent}% = {formatNumber(unstakeAmount, 2)} LP (${formatNumber(unstakeValue, 2)})
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={flexUnstakePercent}
                        onChange={(e) => setFlexUnstakePercent(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '8px',
                          borderRadius: '4px',
                          background: `linear-gradient(to right, #FF1493 0%, #FF1493 ${flexUnstakePercent}%, rgba(255,255,255,0.2) ${flexUnstakePercent}%, rgba(255,255,255,0.2) 100%)`,
                          appearance: 'none',
                          cursor: 'pointer',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                        {[25, 50, 75, 100].map(pct => (
                          <button
                            key={pct}
                            onClick={() => setFlexUnstakePercent(pct)}
                            style={{
                              padding: '4px 12px',
                              background: flexUnstakePercent === pct ? '#FF1493' : 'rgba(255,20,147,0.2)',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: flexUnstakePercent === pct ? '#fff' : '#FF1493',
                              cursor: 'pointer',
                            }}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={async () => {
                          if (unstakeAmount <= 0) {
                            showToast('Nothing to unstake', 'info');
                            return;
                          }
                          
                          const isFullExit = flexUnstakePercent === 100;
                          const confirmMsg = isFullExit 
                            ? `Exit ALL Flex stakes? This will return ${formatNumber(totalFlexLP, 2)} LP + ${formatNumber(totalPendingRewards, 4)} LP rewards to your wallet.`
                            : `Unstake ${flexUnstakePercent}% (${formatNumber(unstakeAmount, 2)} LP)? Note: Partial unstakes exit full positions proportionally.`;
                          
                          if (!window.confirm(confirmMsg)) return;
                          
                          try {
                            setLoading(true);
                            const signer = await provider.getSigner();
                            const flexContract = new ethers.Contract(
                              CONTRACT_ADDRESSES.lpStakingFlexV4,
                              LP_STAKING_FLEX_V4_ABI,
                              signer
                            );
                            
                            let totalLpWithdrawn = 0;
                            let totalRewardsWithdrawn = 0;
                            let successCount = 0;
                            
                            // Sort stakes by amount (smallest first for partial exits)
                            const sortedStakes = [...getVisibleFlexPositions()].sort((a, b) => (a.amount || 0) - (b.amount || 0));
                            let remainingToUnstake = unstakeAmount;
                            
                            for (const stake of sortedStakes) {
                              if (remainingToUnstake <= 0) break;
                              
                              const stakeAmount = stake.amount || 0;
                              if (stakeAmount <= 0 || stake.stakeIndex === undefined) continue;
                              
                              // Check if we should withdraw this stake
                              if (isFullExit || remainingToUnstake >= stakeAmount * 0.9) {
                                try {
                                  showToast(`💗 Withdrawing stake #${stake.stakeIndex + 1}...`, 'info');
                                  const tx = await flexContract.withdraw(stake.stakeIndex);
                                  await tx.wait();
                                  
                                  const daysStaked = Math.max(0, (Date.now() - (stake.startTime || Date.now())) / (24 * 60 * 60 * 1000));
                                  const rewards = (stakeAmount * 0.10 / 365) * daysStaked;
                                  
                                  totalLpWithdrawn += stakeAmount;
                                  totalRewardsWithdrawn += rewards;
                                  remainingToUnstake -= stakeAmount;
                                  successCount++;
                                  
                                  // Record to history
                                  setFlexHistory(prev => [{
                                    id: `flex-history-${Date.now()}-${stake.stakeIndex}`,
                                    lpAmount: stakeAmount,
                                    lpValueUsd: stakeAmount * (livePrices.dtgc || 0.0005) * 2,
                                    rewardsLp: rewards,
                                    rewardsUsd: rewards * (livePrices.dtgc || 0.0005) * 2,
                                    daysStaked,
                                    startDate: stake.startTime,
                                    endDate: Date.now(),
                                    profitLoss: rewards * (livePrices.dtgc || 0.0005) * 2,
                                  }, ...prev]);
                                  
                                  // Blacklist this stake
                                  blacklistStake(stake.id);
                                } catch (err) {
                                  console.error(`Failed to withdraw stake #${stake.stakeIndex}:`, err);
                                }
                              }
                            }
                            
                            // Handle in-memory stakes
                            if (isFullExit && flexStakes.length > 0) {
                              flexStakes.forEach(stake => {
                                const daysStaked = (Date.now() - (stake.timestamp || Date.now())) / (24 * 60 * 60 * 1000);
                                const rewards = ((stake.stakeValue || 0) * 0.10 / 365) * daysStaked;
                                totalRewardsWithdrawn += rewards;
                                successCount++;
                                
                                setFlexHistory(prev => [{
                                  id: `flex-history-${Date.now()}-mem-${stake.id}`,
                                  lpAmount: stake.lpAmount || 0,
                                  lpValueUsd: stake.stakeValue || 0,
                                  rewardsLp: rewards / (livePrices.dtgc || 0.0005) / 2,
                                  rewardsUsd: rewards,
                                  daysStaked,
                                  startDate: stake.timestamp,
                                  endDate: Date.now(),
                                  profitLoss: rewards,
                                }, ...prev]);
                              });
                              setFlexStakes([]);
                            }
                            
                            // Remove from UI
                            if (isFullExit) {
                              removeAllFlexFromUI();
                            } else {
                              setSidebarKey(prev => prev + 1);
                            }
                            
                            const totalValue = (totalLpWithdrawn * (livePrices.dtgc || 0.0005) * 2) + (totalRewardsWithdrawn * (livePrices.dtgc || 0.0005) * 2);
                            showToast(`✅ Exited ${successCount} stake(s)! ${formatNumber(totalLpWithdrawn, 2)} LP + ${formatNumber(totalRewardsWithdrawn, 4)} rewards (≈ $${formatNumber(totalValue, 2)})`, 'success');
                            
                            // Reset sliders
                            setFlexUnstakePercent(100);
                            setFlexClaimPercent(100);
                            
                          } catch (err) {
                            if (err.code === 'ACTION_REJECTED' || err.message?.includes('rejected')) {
                              showToast('Transaction cancelled', 'info');
                            } else {
                              showToast(`❌ Exit failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
                            }
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || unstakeAmount <= 0}
                        style={{
                          width: '100%',
                          marginTop: '12px',
                          padding: '14px',
                          background: unstakeAmount > 0 ? 'linear-gradient(135deg, #FF1493, #C71585)' : 'rgba(255,20,147,0.3)',
                          border: 'none',
                          borderRadius: '12px',
                          fontWeight: 700,
                          fontSize: '0.95rem',
                          color: '#fff',
                          cursor: unstakeAmount > 0 ? 'pointer' : 'not-allowed',
                          opacity: loading ? 0.7 : (unstakeAmount > 0 ? 1 : 0.5),
                          boxShadow: unstakeAmount > 0 ? '0 4px 20px rgba(255,20,147,0.4)' : 'none',
                        }}
                      >
                        💗 {flexUnstakePercent === 100 ? 'EXIT ALL & CLAIM REWARDS' : `UNSTAKE ${flexUnstakePercent}%`}
                      </button>
                    </div>
                    
                    {/* Individual Stakes Breakdown (collapsible) */}
                    {allFlexStakes.length > 1 && (
                      <details style={{ marginTop: '16px' }}>
                        <summary style={{
                          cursor: 'pointer',
                          padding: '12px 16px',
                          background: 'rgba(255,255,255,0.05)',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          color: '#888',
                          fontWeight: 600,
                        }}>
                          📊 View Individual Stakes ({allFlexStakes.length})
                        </summary>
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {allFlexStakes.map((stake, idx) => {
                            const stakeTime = stake.startTime || stake.timestamp || Date.now();
                            const daysStaked = Math.max(0, (Date.now() - stakeTime) / (24 * 60 * 60 * 1000));
                            const lpAmount = stake.amount || stake.lpAmount || 0;
                            const rewards = (lpAmount * 0.10 / 365) * daysStaked;
                            const rewardUsd = rewards * (livePrices.dtgc || 0.0005) * 2;
                            const rewardPls = livePrices.pls > 0 ? (rewardUsd / livePrices.pls) : 0;
                            return (
                              <div key={stake.id || idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                background: 'rgba(255,20,147,0.05)',
                                borderRadius: '10px',
                                border: '1px solid rgba(255,20,147,0.1)',
                              }}>
                                <span style={{ fontSize: '0.8rem', color: '#FF69B4' }}>
                                  #{idx + 1} • {formatNumber(lpAmount, 2)} LP • {formatNumber(daysStaked, 1)}d
                                </span>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.8rem', color: '#4CAF50', fontWeight: 600 }}>
                                    +{formatNumber(rewards, 4)} LP
                                  </div>
                                  <div style={{ fontSize: '0.6rem', color: '#4CAF50' }}>
                                    ${formatNumber(rewardUsd, 2)} • <span style={{ color: '#9C27B0' }}>{formatNumber(rewardPls, 0)} PLS</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })()}


              {/* Active Positions (Testnet) */}
              {TESTNET_MODE && account && testnetBalances?.positions?.length > 0 && (
                <div style={{
                  maxWidth: '700px',
                  margin: '40px auto 0',
                  background: 'var(--bg-card)',
                  borderRadius: '24px',
                  padding: '30px',
                  border: '1px solid var(--border-color)',
                }}>
                  <h3 style={{
                    fontFamily: 'Cinzel, serif',
                    fontSize: '1.2rem',
                    letterSpacing: '3px',
                    marginBottom: '20px',
                    textAlign: 'center',
                    color: 'var(--gold)',
                  }}>📊 YOUR STAKED POSITIONS</h3>
                  
                  {testnetBalances.positions.map((pos) => {
                    const now = Date.now();
                    const isLocked = now < pos.endTime;
                    const daysLeft = Math.max(0, Math.ceil((pos.endTime - now) / (24 * 60 * 60 * 1000)));
                    const daysStaked = (now - pos.startTime) / (24 * 60 * 60 * 1000);
                    const currentRewards = (pos.amount * (pos.apr / 100) / 365) * daysStaked;
                    
                    return (
                      <div key={pos.id} style={{
                        background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.05)',
                        border: `1px solid ${isLocked ? 'rgba(255,107,107,0.3)' : 'rgba(76,175,80,0.3)'}`,
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '15px',
                      }}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px'}}>
                          <div>
                            <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1.1rem', color: pos.isLP ? 'var(--diamond)' : 'var(--gold)'}}>
                              {pos.tier} {pos.isLP ? '(LP)' : '(DTGC)'}
                            </div>
                            <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                              Staked: <strong>{formatNumber(pos.amount)} {pos.isLP ? 'LP' : 'DTGC'}</strong>
                              <span style={{fontSize: '0.75rem', color: '#4CAF50', marginLeft: '6px'}}>
                                ({getCurrencySymbol()}{formatNumber(convertToCurrency(pos.amount * (livePrices.dtgc || 0) * (pos.isLP ? 2 : 1)).value)})
                              </span>
                            </div>
                            <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px'}}>
                              APR: <strong>{pos.apr}%</strong>
                            </div>
                            <div style={{fontSize: '0.8rem', color: isLocked ? '#FF6B6B' : '#4CAF50', marginTop: '4px'}}>
                              {isLocked ? `🔒 ${daysLeft} days remaining` : '✅ Unlocked - Ready to claim!'}
                            </div>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic'}}>
                              📅 EES Penalty Removed: <strong style={{color: isLocked ? '#FFB74D' : '#4CAF50'}}>{new Date(pos.endTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                            </div>
                          </div>
                          <div style={{textAlign: 'right'}}>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Rewards Earned</div>
                            <div style={{fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50'}}>+{formatNumber(currentRewards)} {pos.isLP ? 'LP' : 'DTGC'}</div>
                            <div style={{fontSize: '0.75rem', color: '#4CAF50', opacity: 0.8}}>≈ {getCurrencySymbol()}{formatNumber(convertToCurrency(currentRewards * (livePrices.dtgc || 0)).value)}</div>
                            <div style={{fontSize: '0.7rem', color: '#9C27B0', opacity: 0.8}}>≈ {formatNumber(livePrices.pls > 0 ? ((currentRewards * (livePrices.dtgc || 0)) / livePrices.pls) : 0, 0)} PLS</div>
                            <button
                              onClick={() => handleUnstake(pos.id)}
                              style={{
                                marginTop: '10px',
                                padding: '8px 20px',
                                background: isLocked ? 'linear-gradient(135deg, #FF6B6B, #FF8E53)' : 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                                border: 'none',
                                borderRadius: '20px',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                color: '#FFF',
                                cursor: 'pointer',
                              }}
                            >
                              {isLocked ? '⚠️ Early Unstake (20% Fee)' : '✅ Claim All'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!account && (
                <div className="connect-prompt">
                  <div className="connect-prompt-icon">🔐</div>
                  <p className="connect-prompt-text">Connect your wallet to start staking DTGC</p>
                  <button className="action-btn primary" style={{ maxWidth: '260px', margin: '0 auto' }} onClick={connectWallet}>
                    Connect Wallet
                  </button>
                </div>
              )}
            </section>
          )}

          {/* BURN STATS TAB */}
          {activeTab === 'burn' && (
            <section className="section">
              <div className="burn-section">
                <div className="burn-header">
                  <span className="burn-icon">🔥</span>
                  <div className="burn-header-text">
                    <h2>🎊 $URMOM SUPER STATS 🎊</h2>
                    <p>Live Price: ${livePrices.urmom.toFixed(7)} {livePrices.loading ? '⏳' : '🟢'} • <a href={SOCIAL_LINKS.dexscreener} target="_blank" rel="noopener noreferrer" style={{color: '#FF9800'}}>DexScreener →</a></p>
                  </div>
                  <div className="burn-links">
                    <a href={SOCIAL_LINKS.dexscreener} target="_blank" rel="noopener noreferrer" className="burn-link-btn">📊 DexScreener</a>
                    <a href={SOCIAL_LINKS.coingecko} target="_blank" rel="noopener noreferrer" className="burn-link-btn">🦎 CoinGecko</a>
                    <button 
                      onClick={manualRefreshPrices} 
                      className="burn-link-btn" 
                      style={{cursor: 'pointer', border: 'none', background: 'rgba(76,175,80,0.2)'}}
                      disabled={livePrices.loading}
                    >
                      {livePrices.loading ? '⏳ Loading...' : '🔄 Refresh Prices'}
                    </button>
                  </div>
                  {livePrices.lastUpdated && (
                    <div style={{fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '8px'}}>
                      Last updated: {livePrices.lastUpdated.toLocaleTimeString()} • Auto-refreshes every 60s
                    </div>
                  )}
                </div>

                <div className="burn-main-stats">
                  <div className="burn-stat-card">
                    <div className="burn-stat-emoji">💵</div>
                    <div className="burn-stat-value">${livePrices.urmom.toFixed(7)}</div>
                    <a href={SOCIAL_LINKS.dexscreener} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.6rem', color: '#FF9800', textDecoration: 'none'}}>📊 {livePrices.loading ? 'Loading...' : '🟢 Live'}</a>
                    <div className="burn-stat-label">URMOM Price</div>
                  </div>
                  <div className="burn-stat-card">
                    <div className="burn-stat-emoji">🪙</div>
                    <div className="burn-stat-value">${livePrices.dtgc.toFixed(7)}</div>
                    <a href={SOCIAL_LINKS.dexscreenerDTGC} target="_blank" rel="noopener noreferrer" style={{fontSize: '0.6rem', color: '#FFD700', textDecoration: 'none'}}>📊 {livePrices.loading ? 'Loading...' : '🟢 Live'}</a>
                    <div className="burn-stat-label">DTGC Price</div>
                  </div>
                  <div className="burn-stat-card">
                    <div className="burn-stat-emoji">🔥</div>
                    <div className="burn-stat-value">{formatNumber(BURN_STATS.totalDeadWallet)}</div>
                    <div className="burn-stat-subvalue" style={{color: '#FF9800'}}>545,616,403 URMOM</div>
                    <div className="burn-stat-label">Burnt Tokens</div>
                  </div>
                  <div className="burn-stat-card" style={{background: 'linear-gradient(135deg, rgba(255,152,0,0.15) 0%, rgba(255,87,34,0.1) 100%)'}}>
                    <div className="burn-stat-emoji">💎</div>
                    <div className="burn-stat-value">{formatUSD(BURN_STATS.totalDeadWallet * livePrices.urmom)}</div>
                    <div className="burn-stat-subvalue" style={{fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)'}}>
                      {formatNumber(BURN_STATS.totalDeadWallet)} × ${livePrices.urmom.toFixed(7)}
                    </div>
                    <div className="burn-stat-label">LIVE BURNED VALUE</div>
                  </div>
                </div>

                {/* Calculation Breakdown Box */}
                <div style={{
                  background: 'rgba(255, 152, 0, 0.1)',
                  border: '1px solid rgba(255, 152, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  marginBottom: '35px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <span style={{fontSize: '1.5rem'}}>🧮</span>
                    <span style={{fontFamily: 'Cinzel, serif', fontSize: '0.85rem', letterSpacing: '1px', color: 'rgba(255,255,255,0.8)'}}>LIVE CALCULATION {livePrices.loading ? '⏳' : '🟢'}</span>
                  </div>
                  <div style={{fontFamily: 'monospace', fontSize: '0.9rem', color: '#FF9800'}}>
                    {formatFullNumber(BURN_STATS.totalDeadWallet)} URMOM × ${livePrices.urmom.toFixed(7)} = <strong style={{color: '#FFD700', fontSize: '1.1rem'}}>{formatUSD(BURN_STATS.totalDeadWallet * livePrices.urmom)}</strong>
                  </div>
                </div>

                <div className="burn-progress-section">
                  <div className="burn-progress-header">
                    <span className="burn-progress-title">🏁 URMOM TOTAL BURNED / REMOVED</span>
                    <span className="burn-progress-percent">{BURN_STATS.burnPercentage}%</span>
                  </div>
                  <div className="burn-progress-bar">
                    <div className="burn-progress-fill" style={{ width: `${BURN_STATS.burnPercentage}%` }} />
                  </div>
                  <div className="burn-progress-blocks">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div key={i} className={`burn-block ${i < Math.floor(BURN_STATS.burnPercentage / 5) ? 'filled' : ''}`} />
                    ))}
                  </div>
                </div>

                {/* DTGC BURN TRACKER - SEPARATE SECTION */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(184,134,11,0.15) 100%)',
                  border: '2px solid rgba(212,175,55,0.4)',
                  borderRadius: '16px',
                  padding: '24px',
                  marginBottom: '35px',
                }}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px'}}>
                    <span style={{fontSize: '2rem'}}>🪙🔥</span>
                    <div>
                      <h3 style={{fontFamily: 'Cinzel, serif', color: '#D4AF37', margin: 0, letterSpacing: '2px'}}>DTGC BURN TRACKER</h3>
                      <p style={{fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', margin: '4px 0 0'}}>0.25% of every Entry/Exit tax is burned forever</p>
                    </div>
                  </div>
                  
                  <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px'}}>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      border: '1px solid rgba(212,175,55,0.3)'
                    }}>
                      <div style={{fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', marginBottom: '8px'}}>DTGC BURNED</div>
                      <div style={{fontSize: '1.8rem', fontWeight: '800', color: '#D4AF37'}}>
                        {dtgcBurnData.loading ? '⏳' : formatNumber(dtgcBurnData.burned)}
                      </div>
                      <div style={{fontSize: '0.65rem', color: dtgcBurnData.loading ? 'rgba(255,255,255,0.4)' : '#4CAF50'}}>
                        {dtgcBurnData.loading ? 'Loading...' : '🟢 Live from chain'}
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      border: '1px solid rgba(212,175,55,0.3)'
                    }}>
                      <div style={{fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', marginBottom: '8px'}}>USD VALUE</div>
                      <div style={{fontSize: '1.8rem', fontWeight: '800', color: '#4CAF50'}}>
                        ${formatNumber(dtgcBurnData.burned * livePrices.dtgc, 2)}
                      </div>
                      <div style={{fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)'}}>@ ${livePrices.dtgc.toFixed(7)}</div>
                    </div>
                    <div style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '12px',
                      padding: '16px',
                      textAlign: 'center',
                      border: '1px solid rgba(212,175,55,0.3)'
                    }}>
                      <div style={{fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px', marginBottom: '8px'}}>% OF SUPPLY</div>
                      <div style={{fontSize: '1.8rem', fontWeight: '800', color: '#FF9800'}}>
                        {((dtgcBurnData.burned / DTGC_TOTAL_SUPPLY) * 100).toFixed(4)}%
                      </div>
                      <div style={{fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)'}}>of 1B total</div>
                    </div>
                  </div>

                  {/* Live burn calculation */}
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    background: 'rgba(76,175,80,0.1)',
                    border: '1px solid rgba(76,175,80,0.3)',
                    borderRadius: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span style={{fontSize: '1.2rem'}}>🧮</span>
                      <span style={{fontFamily: 'Cinzel, serif', fontSize: '0.75rem', letterSpacing: '1px', color: 'rgba(255,255,255,0.8)'}}>
                        LIVE CALCULATION {dtgcBurnData.loading ? '⏳' : '🟢'}
                      </span>
                    </div>
                    <div style={{fontFamily: 'monospace', fontSize: '0.8rem', color: '#D4AF37'}}>
                      {formatNumber(dtgcBurnData.burned)} × ${livePrices.dtgc.toFixed(7)} = <strong style={{color: '#4CAF50', fontSize: '1rem'}}>${formatNumber(dtgcBurnData.burned * livePrices.dtgc, 2)}</strong>
                    </div>
                  </div>

                  <div style={{marginTop: '16px', padding: '12px', background: 'rgba(212,175,55,0.1)', borderRadius: '8px', textAlign: 'center'}}>
                    <span style={{fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)'}}>
                      Burn Address: <code style={{color: '#D4AF37'}}>{CONTRACT_ADDRESSES.burn}</code>
                    </span>
                    {dtgcBurnData.lastUpdated && (
                      <div style={{fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px'}}>
                        Last updated: {dtgcBurnData.lastUpdated.toLocaleTimeString()} • Refreshes every 30s
                      </div>
                    )}
                  </div>
                </div>

                <div className="dead-wallet-section">
                  <h3 className="dead-wallet-title">🕳️ DEAD WALLET BREAKDOWN</h3>
                  <div className="dead-wallet-grid">
                    {Object.entries(BURN_STATS.deadWallets).map(([addr, amount], i) => (
                      <div key={i} className="dead-wallet-row">
                        <span className="dead-wallet-address">{addr.slice(0, 10)}...{addr.slice(-4)}</span>
                        <span className={`dead-wallet-amount ${amount === 0 ? 'zero' : ''}`}>
                          {amount === 0 ? '0.00' : formatFullNumber(amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lp-burn-section">
                  <h3 className="lp-burn-title">🧺 LP TOKENS BURNED</h3>
                  <div className="lp-burn-grid">
                    {BURN_STATS.lpBurnPercentages.map((lp, i) => (
                      <div key={i} className="lp-burn-item">
                        <div className="lp-burn-header">
                          <span className="lp-burn-name">{lp.pair}</span>
                          <span className="lp-burn-percent">{lp.percentage.toFixed(4)}%</span>
                        </div>
                        <div className="lp-burn-bar">
                          <div className="lp-burn-fill" style={{ width: `${lp.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lp-urmom-section">
                  <h3 className="lp-urmom-title">📊 LP BURNED BREAKDOWN (URMOM × LIVE PRICE)</h3>
                  <div className="lp-urmom-grid">
                    {BURN_STATS.lpUrmomBreakdown.map((pool, i) => (
                      <div key={i} className="lp-urmom-card" style={{ '--card-color': pool.color }}>
                        <div className="lp-urmom-pool">{pool.pool}</div>
                        <div className="lp-urmom-tokens">{formatNumber(pool.tokens)}</div>
                        <div className="lp-urmom-usd">{formatUSD(pool.tokens * livePrices.urmom)}</div>
                        <div style={{fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px'}}>
                          {formatNumber(pool.tokens)} × ${livePrices.urmom.toFixed(7)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '20px', padding: '12px', background: 'rgba(255,152,0,0.1)', borderRadius: '10px' }}>
                    <span style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem'}}>
                      <strong>Total LP URMOM:</strong> {formatNumber(totalLPUrmom)} = <strong style={{color: '#FF9800'}}>{formatUSD(totalLPUrmom * livePrices.urmom)}</strong>
                    </span>
                  </div>
                </div>

                <div className="burn-address-box">
                  <div className="burn-address-info">
                    <span className="burn-address-label">PulseChain Burn Address (0x...369)</span>
                    <span className="burn-address-value">{CONTRACT_ADDRESSES.burn}</span>
                  </div>
                  <a href={`${EXPLORER}/address/${CONTRACT_ADDRESSES.burn}`} target="_blank" rel="noopener noreferrer" className="burn-view-btn">
                    View on PulseScan →
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* DAO VOTE TAB */}
          {activeTab === 'vote' && (
            <section className="section">
              <div className="voting-section">
                <div className="voting-header">
                  <span className="voting-icon">🗳️</span>
                  <div className="voting-header-text">
                    <h2>DAO GOVERNANCE</h2>
                    <p>Vote on EES penalty fund allocation</p>
                  </div>
                </div>

                <div className="voting-eligibility">
                  <div className="eligibility-title">VOTING ELIGIBILITY</div>
                  <div className="eligibility-items">
                    <div className="eligibility-item">
                      <span className={`eligibility-check ${(position || lpPosition) ? 'active' : 'inactive'}`}>
                        {(position || lpPosition) ? '✓' : '○'}
                      </span>
                      <span>Verified Staker</span>
                    </div>
                    <div className="eligibility-item">
                      <span className={`eligibility-check ${parseFloat(dtgcBalance) >= 1000000 ? 'active' : 'inactive'}`}>
                        {parseFloat(dtgcBalance) >= 1000000 ? '✓' : '○'}
                      </span>
                      <span>Hold 1M+ DTGC</span>
                    </div>
                    <div className="eligibility-item">
                      <span className={`eligibility-check ${canVote ? 'active' : 'inactive'}`}>
                        {canVote ? '✓' : '○'}
                      </span>
                      <span>{canVote ? 'You Can Vote!' : 'Not Eligible'}</span>
                    </div>
                  </div>
                </div>

                <div className="voting-options-grid">
                  {VOTING_OPTIONS.map((option) => (
                    <div
                      key={option.id}
                      className={`voting-option ${selectedVote === option.id ? 'selected' : ''}`}
                      onClick={() => setSelectedVote(option.id)}
                    >
                      <div className="voting-option-header">
                        <span className="voting-option-letter">{['A', 'B', 'C', 'D'][option.id]}</span>
                        <span className="voting-option-name">{option.name}</span>
                      </div>
                      <p className="voting-option-desc">{option.description}</p>
                      <div className="voting-option-votes">
                        <div className="votes-bar">
                          <div className="votes-fill" style={{ width: `${(option.id + 1) * 15}%` }} />
                        </div>
                        <span className="votes-count">{(option.id + 1) * 3} votes</span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="vote-btn"
                  disabled={!canVote || selectedVote === null}
                  onClick={() => showToast('Voting coming soon!', 'info')}
                >
                  {!account ? 'Connect Wallet' : !canVote ? 'Not Eligible' : 'Cast Your Vote'}
                </button>
              </div>
            </section>
          )}

          {/* WHITEPAPER TAB */}
          {activeTab === 'whitepaper' && (
            <section className="section whitepaper-section">
              <div className="section-header">
                <h2 className="section-title gold-text">WHITEPAPER</h2>
                <p style={{ fontSize: '0.75rem', color: '#4CAF50', marginBottom: '8px', fontWeight: 600 }}>📋 V4 Contract Documentation</p>
                <div className="section-divider" />
                <p className="section-description">DT Gold Coin • V4 Unlimited Multi-Stake Protocol on PulseChain</p>
              </div>

              {/* DOCUMENT DOWNLOADS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '40px',
              }}>
                <a href="/docs/DTGC-V4-White-Paper.docx" download style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(184,134,11,0.15) 100%)',
                  border: '2px solid rgba(212,175,55,0.4)',
                  borderRadius: '16px',
                  padding: '24px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.3s ease',
                }}>
                  <span style={{fontSize: '2.5rem'}}>📄</span>
                  <div>
                    <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--gold)', fontSize: '1.1rem'}}>WHITE PAPER V4</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Public Overview • Unlimited Stakes</div>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px'}}>📥 Download .docx</div>
                  </div>
                </a>
                
                <a href="/docs/DTGC-V4-Gold-Paper.docx" download style={{
                  background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(184,134,11,0.2) 100%)',
                  border: '2px solid rgba(212,175,55,0.5)',
                  borderRadius: '16px',
                  padding: '24px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.3s ease',
                }}>
                  <span style={{fontSize: '2.5rem'}}>📜</span>
                  <div>
                    <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--gold)', fontSize: '1.1rem'}}>GOLD PAPER V4</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Full Tokenomics • Diamond+ Edition</div>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px'}}>📥 Download .docx</div>
                  </div>
                </a>
                
                <a href="/docs/DTGC-V4-Gold-Paper-Quant.docx" download style={{
                  background: 'linear-gradient(135deg, rgba(26,35,126,0.1) 0%, rgba(48,63,159,0.15) 100%)',
                  border: '2px solid rgba(26,35,126,0.4)',
                  borderRadius: '16px',
                  padding: '24px',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.3s ease',
                }}>
                  <span style={{fontSize: '2.5rem'}}>📊</span>
                  <div>
                    <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#5C6BC0', fontSize: '1.1rem'}}>GOLD QUANT V4</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Risk Analysis • Multi-Stake ROI</div>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px'}}>📥 Download .docx</div>
                  </div>
                </a>
                <a href="/docs/DapperFlexPinkPaper.docx" download style={{
                  display: "flex", alignItems: "center", gap: "12px", padding: "16px",
                  background: "var(--card-bg)", borderRadius: "12px",
                  textDecoration: "none", color: "inherit",
                  border: "1px solid rgba(255,20,147,0.3)",
                  transition: "all 0.3s ease",
                }}>
                  <span style={{fontSize: "2.5rem"}}>💎⚡</span>
                  <div>
                    <div style={{fontFamily: "Cinzel, serif", fontWeight: 700, color: "#FF1493", fontSize: "1.1rem"}}>DAPPER PINK PAPER</div>
                    <div style={{fontSize: "0.8rem", color: "var(--text-secondary)"}}>Flex Protocol • One-Click LP Zapper</div>
                    <div style={{fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px"}}>📥 Download .docx</div>
                  </div>
                </a>
              </div>

              <div className="wp-card">
                <h3 className="wp-card-title gold-text">📜 Introduction</h3>
                <div className="wp-card-content">
                  <p>DT Gold Coin (DTGC) is a premium V4 staking protocol built on PulseChain, featuring <strong>unlimited multi-stake positions</strong> — the first of its kind on PulseChain! Stack multiple stakes across all tiers simultaneously while earning rewards on each position.</p>
                  <p>Paired with URMOM token, DTGC creates a dual-token ecosystem with Diamond+ LP staking offering up to 70% APR. The V4 contracts enable claim-without-unstaking, allowing rewards harvesting while positions continue growing.</p>
                </div>
              </div>

              <div className="wp-card">
                <h3 className="wp-card-title gold-text">💰 V4 GOLD PAPER TOKENOMICS</h3>
                <div className="wp-card-content">
                  <p><strong>Total Supply: 1,000,000,000 DTGC</strong></p>
                  <p style={{color: 'var(--gold)', fontWeight: '600', marginBottom: '16px'}}>DTGC Tokenomics</p>
                  <table className="tokenomics-table">
                    <thead>
                      <tr><th>Allocation</th><th>Amount</th><th>Percentage</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>🏛️ DAO Pool</td><td>500,000,000</td><td style={{color: '#4CAF50', fontWeight: '700'}}>50%</td></tr>
                      <tr><td>👨‍💻 Dev Wallet</td><td>323,000,000</td><td>32.3%</td></tr>
                      <tr><td>💱 Circulating</td><td>90,000,000</td><td style={{color: '#FF9800'}}>9%</td></tr>
                      <tr><td>🔒 LP Locked</td><td>87,000,000</td><td>8.7%</td></tr>
                    </tbody>
                  </table>
                  <div className="wp-highlight">
                    <strong>V19 Tax Structure (Sustainable Long-Term Tokenomics):</strong><br/>
                    <div style={{marginTop: '8px'}}>
                      <strong style={{color: '#4CAF50'}}>Entry Tax (3.75%):</strong> 1.875% DAO • 0.625% Dev • 1% Auto LP • 0.25% Burn<br/><br/>
                      <strong style={{color: '#4CAF50'}}>Exit Tax (3.75%):</strong> Same breakdown • <strong>7.5% total fees for sustainability!</strong><br/><br/>
                      <strong style={{color: '#FF5722'}}>EES - Emergency End Stake (20%):</strong> 12% DAO • 5% Dev • 3% Auto LP
                    </div>
                  </div>
                </div>
              </div>

              <div className="wp-card">
                <h3 className="wp-card-title gold-text">⭐ V19 Staking Tiers (Sustainable APRs)</h3>
                <div className="wp-card-content">
                  <table className="tokenomics-table">
                    <thead>
                      <tr><th>Tier</th><th>Min $</th><th>Lock</th><th>Base APR</th><th>Boost</th><th>Asset</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>🥈 Silver</td><td>$200</td><td>60 days</td><td>15.4%</td><td>1x</td><td>DTGC</td></tr>
                      <tr><td>🥇 Gold</td><td>$500</td><td>90 days</td><td>16.8%</td><td>1x</td><td>DTGC</td></tr>
                      <tr><td>🐋 Whale</td><td>$2.5k</td><td>180 days</td><td>18.2%</td><td>1x</td><td>DTGC</td></tr>
                      <tr style={{background: 'rgba(0, 188, 212, 0.1)'}}><td>💎 Diamond</td><td>$1,000</td><td>90 days</td><td style={{color: '#00BCD4', fontWeight: '700'}}>28%</td><td style={{color: '#4CAF50', fontWeight: '700'}}>1.5x (42%)</td><td>DTGC/PLS LP</td></tr>
                      <tr style={{background: 'rgba(156, 39, 176, 0.15)'}}><td>💜💎 Diamond+</td><td>$1,000</td><td>90 days</td><td style={{color: '#9C27B0', fontWeight: '700'}}>35%</td><td style={{color: '#9C27B0', fontWeight: '700'}}>2x (70%)</td><td>DTGC/URMOM LP</td></tr>
                    </tbody>
                  </table>
                  <div className="wp-highlight">
                    <strong>✅ Sustainable Tokenomics!</strong> With 7.5% total fees and dynamic APR:<br/>
                    <div style={{marginTop: '8px'}}>
                      Silver (60d): <span style={{color: '#4CAF50'}}>+7.9% net/yr</span> • Gold (90d): <span style={{color: '#4CAF50'}}>+9.3% net/yr</span> • Whale (180d): <span style={{color: '#4CAF50'}}>+10.7% net/yr</span><br/>
                      Diamond: <span style={{color: '#00BCD4'}}>+34.5% net/yr (42% eff)</span> • Diamond+: <span style={{color: '#9C27B0'}}>+62.5% net/yr (70% eff)</span>
                    </div>
                    <div style={{marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                      *APRs adjust dynamically based on market cap milestones for long-term sustainability
                    </div>
                  </div>
                </div>
              </div>


              {/* Dapper One-Click LP Zapper */}
              <DapperComponent provider={provider} account={account} />
              <div className="wp-card">
                <h3 className="wp-card-title gold-text">📈 Dynamic APR System</h3>
                <div className="wp-card-content">
                  <p>APR reduces as TVL grows to ensure DAO sustainability:</p>
                  <table className="tokenomics-table">
                    <thead>
                      <tr><th>TVL Phase</th><th>Multiplier</th><th>Gold APR</th><th>Diamond APR</th><th>Diamond+ APR</th></tr>
                    </thead>
                    <tbody>
                      <tr><td style={{color: '#4CAF50'}}>Genesis (0-50M)</td><td>100%</td><td>24%</td><td style={{fontWeight: '700'}}>60%</td><td style={{fontWeight: '700', color: '#9C27B0'}}>100%</td></tr>
                      <tr><td>Early (50-100M)</td><td>85%</td><td>20.4%</td><td>51%</td><td style={{color: '#9C27B0'}}>85%</td></tr>
                      <tr><td style={{color: '#FFC107'}}>Growth (100-200M)</td><td>70%</td><td>16.8%</td><td>42%</td><td style={{color: '#9C27B0'}}>70%</td></tr>
                      <tr><td>Mature (200-350M)</td><td>50%</td><td>12%</td><td>30%</td><td style={{color: '#9C27B0'}}>50%</td></tr>
                      <tr><td style={{color: '#FF5722'}}>Saturated (350-500M)</td><td>35%</td><td>8.4%</td><td>21%</td><td style={{color: '#9C27B0'}}>35%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="wp-card">
                <h3 className="wp-card-title gold-text">🔥 Burn History (Live)</h3>
                <div className="wp-card-content">
                  <p><strong>{formatFullNumber(BURN_STATS.totalDeadWallet)} URMOM</strong> ({BURN_STATS.burnPercentage}% of supply) permanently burned.</p>
                  <div className="wp-highlight">
                    <strong>🧮 Live Value Calculation {livePrices.loading ? '⏳' : '🟢'}:</strong><br/>
                    {formatFullNumber(BURN_STATS.totalDeadWallet)} URMOM × ${livePrices.urmom.toFixed(7)} = <strong style={{color: 'var(--gold)'}}>{formatUSD(BURN_STATS.totalDeadWallet * livePrices.urmom)}</strong>
                  </div>
                  <p>Burn Address: <code style={{ color: 'var(--gold)' }}>{CONTRACT_ADDRESSES.burn}</code></p>
                </div>
              </div>

              {/* Video Background at Bottom */}
              {VIDEOS_ENABLED && (
              <div className="wp-video-section">
                <video className="wp-video-bg" autoPlay loop playsInline>
                  <source src={VIDEOS.whitepaper} type="video/quicktime" />
                  <source src={VIDEOS.whitepaper.replace('.mov', '.mp4')} type="video/mp4" />
                </video>
                <div className="wp-video-overlay">
                  <h3 className="wp-video-text gold-text">DTGC • PREMIUM STAKING</h3>
                </div>
              </div>
              )}
            </section>
          )}

          {/* LINKS TAB */}
          {activeTab === 'links' && (
            <section className="section links-section">
              <div className="section-header">
                <h2 className="section-title gold-text">DT & URMOM: GOLD COIN MARBLE</h2>
                <div className="section-divider" />
              </div>

              <div className="links-grid">
                <a href={SOCIAL_LINKS.xUrmom} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">𝕏</span>
                  <div className="link-info">
                    <div className="link-name">URMOM Twitter</div>
                    <div className="link-url">@UrmomPulse</div>
                  </div>
                </a>
                <a href={SOCIAL_LINKS.xDTGC} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">𝕏</span>
                  <div className="link-info">
                    <div className="link-name">DTGoldCoin</div>
                    <div className="link-url">@DTGCio4</div>
                  </div>
                </a>
                <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">📱</span>
                  <div className="link-info">
                    <div className="link-name">Telegram</div>
                    <div className="link-url">t.me/urmomPulse</div>
                  </div>
                </a>
                <a href={SOCIAL_LINKS.website} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">🌐</span>
                  <div className="link-info">
                    <div className="link-name">Website</div>
                    <div className="link-url">dtgc.io</div>
                  </div>
                </a>
                <a href={SOCIAL_LINKS.dexscreener} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">📊</span>
                  <div className="link-info">
                    <div className="link-name">URMOM DexScreener</div>
                    <div className="link-url">URMOM/PLS Chart</div>
                  </div>
                </a>
                <a href={SOCIAL_LINKS.dexscreenerDTGC} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">📊</span>
                  <div className="link-info">
                    <div className="link-name">DTGC DexScreener</div>
                    <div className="link-url">DTGC/URMOM Chart</div>
                  </div>
                </a>
                <a href={SOCIAL_LINKS.coingecko} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">🦎</span>
                  <div className="link-info">
                    <div className="link-name">CoinGecko</div>
                    <div className="link-url">URMOM Listing</div>
                  </div>
                </a>
              </div>

              <div className="contracts-section">
                <h3 className="contracts-title gold-text">CONTRACT ADDRESSES</h3>
                {[
                  { label: '🪙 DTGC Token', addr: CONTRACT_ADDRESSES.dtgc },
                  { label: '👩 URMOM Token', addr: CONTRACT_ADDRESSES.urmom },
                  { label: '💎 DTGC/PLS LP', addr: CONTRACT_ADDRESSES.lpDtgcPls },
                  { label: '💜💎 DTGC/URMOM LP', addr: CONTRACT_ADDRESSES.lpDtgcUrmom },
                  { label: '🚀 DTGC Staking V4', addr: CONTRACT_ADDRESSES.stakingV4 },
                  { label: '🚀 LP Staking V4', addr: CONTRACT_ADDRESSES.lpStakingV4 },
                  { label: '✖️ White Diamond V5', addr: CONTRACT_ADDRESSES.whiteDiamondV5 },
                  { label: '🗳️ DAO Voting V3', addr: CONTRACT_ADDRESSES.daoVotingV3 },
                  { label: '🏛️ DAO Treasury', addr: CONTRACT_ADDRESSES.daoTreasury },
                  { label: '👨‍💻 Dev Wallet', addr: CONTRACT_ADDRESSES.devWallet },
                  { label: '🔥 Burn Address', addr: CONTRACT_ADDRESSES.burn },
                ].map((item, i) => (
                  <div key={i} className="contract-row">
                    <span className="contract-label">{item.label}</span>
                    <span className="contract-address" onClick={() => copyToClipboard(item.addr)}>{item.addr}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <section className="section analytics-section">
              <div className="section-header">
                <h2 className="section-title" style={{ color: '#2196F3' }}>📊 DYNAMIC PORTFOLIO ANALYTICS</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>Institutional-Grade Hedging & Rebalancing Insights</p>
                <div className="section-divider" style={{ background: 'linear-gradient(90deg, transparent, #2196F3, transparent)' }} />
              </div>

              {/* V4 MULTI-STAKE EXPLANATION */}
              <div style={{ 
                background: 'linear-gradient(135deg, rgba(76,175,80,0.1) 0%, rgba(33,150,243,0.1) 100%)', 
                border: '2px solid #4CAF50', 
                borderRadius: '16px', 
                padding: '24px', 
                marginBottom: '24px' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '2rem' }}>🚀</span>
                  <div>
                    <h3 style={{ color: '#4CAF50', fontSize: '1.3rem', margin: 0, fontFamily: 'Cinzel, serif' }}>V4 UNLIMITED MULTI-STAKE</h3>
                    <p style={{ color: '#888', fontSize: '0.8rem', margin: '4px 0 0' }}>PulseChain's first official V4 contract stake utility</p>
                  </div>
                  <span style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, #4CAF50, #2E7D32)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, color: '#fff' }}>LIVE</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ color: '#4CAF50', fontWeight: 700, marginBottom: '8px' }}>✨ Stack Multiple Positions</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Create unlimited stakes across all tiers. Diversify your portfolio with multiple lock periods and APRs.</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ color: '#2196F3', fontWeight: 700, marginBottom: '8px' }}>🎁 Claim Without Unstaking</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Harvest rewards anytime while keeping your principal staked. Compound or withdraw rewards as you wish.</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ color: '#D4AF37', fontWeight: 700, marginBottom: '8px' }}>🔐 Per-Position Management</div>
                    <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Each stake is independent. Withdraw individual positions without affecting others.</div>
                  </div>
                </div>

                {/* V4 Tier APRs */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>V4 Staking Tiers & APRs</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                    <div style={{ padding: '8px 16px', background: 'rgba(192,192,192,0.15)', borderRadius: '20px', border: '1px solid #C0C0C0' }}>
                      <span style={{ color: '#C0C0C0', fontWeight: 700 }}>🥈 Silver</span>
                      <span style={{ color: '#fff', marginLeft: '8px' }}>15.4% • 60d</span>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'rgba(212,175,55,0.15)', borderRadius: '20px', border: '1px solid #D4AF37' }}>
                      <span style={{ color: '#D4AF37', fontWeight: 700 }}>🥇 Gold</span>
                      <span style={{ color: '#fff', marginLeft: '8px' }}>16.8% • 90d</span>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'rgba(33,150,243,0.15)', borderRadius: '20px', border: '1px solid #2196F3' }}>
                      <span style={{ color: '#2196F3', fontWeight: 700 }}>🐋 Whale</span>
                      <span style={{ color: '#fff', marginLeft: '8px' }}>18.2% • 180d</span>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'rgba(0,188,212,0.15)', borderRadius: '20px', border: '1px solid #00BCD4' }}>
                      <span style={{ color: '#00BCD4', fontWeight: 700 }}>💎 Diamond LP</span>
                      <span style={{ color: '#fff', marginLeft: '8px' }}>42% • 90d</span>
                    </div>
                    <div style={{ padding: '8px 16px', background: 'rgba(156,39,176,0.15)', borderRadius: '20px', border: '1px solid #9C27B0' }}>
                      <span style={{ color: '#9C27B0', fontWeight: 700 }}>💜💎 Diamond+</span>
                      <span style={{ color: '#fff', marginLeft: '8px' }}>70% • 90d</span>
                    </div>
                  </div>
                </div>

                {/* Contract Addresses */}
                <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', fontSize: '0.7rem' }}>
                  <span style={{ color: '#888' }}>DTGCStakingV4: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{CONTRACT_ADDRESSES.stakingV4?.slice(0,10)}...</span></span>
                  <span style={{ color: '#888' }}>LPStakingV4: <span style={{ color: '#4CAF50', fontFamily: 'monospace' }}>{CONTRACT_ADDRESSES.lpStakingV4?.slice(0,10)}...</span></span>
                </div>
              </div>

              {/* Currency Selector for Analytics */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Display Currency:</span>
                <select
                  value={displayCurrency}
                  onChange={(e) => setDisplayCurrency(e.target.value)}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(33,150,243,0.1)',
                    border: '1px solid rgba(33,150,243,0.4)',
                    borderRadius: '8px',
                    color: '#2196F3',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  <option value="usd">🇺🇸 USD ($)</option>
                  <option value="eur">🇪🇺 EUR (€)</option>
                  <option value="gbp">🇬🇧 GBP (£)</option>
                  <option value="jpy">🇯🇵 JPY (¥)</option>
                  <option value="sar">🇸🇦 SAR (﷼)</option>
                  <option value="cny">🇨🇳 CNY (¥)</option>
                  <option value="czk">🇨🇿 CZK (Kč)</option>
                  <option value="aud">🇦🇺 AUD (A$)</option>
                  <option value="ngn">🇳🇬 NGN (₦)</option>
                  <option value="cop">🇨🇴 COP ($)</option>
                  <option value="cad">🇨🇦 CAD (C$)</option>
                </select>
              </div>

              {/* Portfolio Allocation Calculator */}
              <div style={{ 
                background: 'rgba(33,150,243,0.05)', 
                border: '2px solid rgba(33,150,243,0.3)', 
                borderRadius: '16px', 
                padding: '24px', 
                marginBottom: '24px' 
              }}>
                <h3 style={{ color: '#2196F3', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎯 OPTIMAL ALLOCATION STRATEGIES
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Conservative Strategy */}
                  <div style={{
                    background: 'rgba(76,175,80,0.1)',
                    border: '1px solid rgba(76,175,80,0.3)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>🛡️ Conservative</span>
                      <span style={{ color: '#4CAF50', fontSize: '0.8rem' }}>Low Risk</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      <div>• 70% Single-Stake (Silver 15.4% / Gold 16.8%)</div>
                      <div>• 30% Diamond LP (42% eff)</div>
                      <div>• 0% Diamond+ LP</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(76,175,80,0.2)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Expected APR:</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>~24%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>After 7.5% Fees:</span>
                      <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>~16.5% Net</span>
                    </div>
                  </div>

                  {/* Balanced Strategy */}
                  <div style={{
                    background: 'rgba(33,150,243,0.1)',
                    border: '2px solid rgba(33,150,243,0.5)',
                    borderRadius: '12px',
                    padding: '16px',
                    position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: '-10px', right: '12px', background: '#2196F3', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>RECOMMENDED</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#2196F3', fontWeight: 'bold' }}>⚖️ Balanced</span>
                      <span style={{ color: '#2196F3', fontSize: '0.8rem' }}>Optimal Risk/Reward</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      <div>• 40% Single-Stake (Gold 16.8% / Whale 18.2%)</div>
                      <div>• 30% Diamond LP (42% eff)</div>
                      <div>• 30% Diamond+ LP (70% eff)</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(33,150,243,0.2)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Expected APR:</span>
                      <span style={{ color: '#2196F3', fontWeight: 'bold' }}>~40%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>After 7.5% Fees:</span>
                      <span style={{ color: '#2196F3', fontWeight: 'bold' }}>~32.5% Net</span>
                    </div>
                  </div>

                  {/* Aggressive Strategy */}
                  <div style={{
                    background: 'rgba(156,39,176,0.1)',
                    border: '1px solid rgba(156,39,176,0.3)',
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#9C27B0', fontWeight: 'bold' }}>🚀 Aggressive</span>
                      <span style={{ color: '#9C27B0', fontSize: '0.8rem' }}>High APR</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                      <div>• 0% Single-Stake</div>
                      <div>• 50% Diamond LP (42% eff)</div>
                      <div>• 50% Diamond+ LP (70% eff)</div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(156,39,176,0.2)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Expected APR:</span>
                      <span style={{ color: '#9C27B0', fontWeight: 'bold' }}>~56%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>After 7.5% Fees:</span>
                      <span style={{ color: '#9C27B0', fontWeight: 'bold' }}>~48.5% Net</span>
                    </div>
                  </div>
                </div>

                {/* V19 Fee Structure Info */}
                <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(212,175,55,0.1)', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Entry Fee:</span> <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>3.75%</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Exit Fee:</span> <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>3.75%</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Total:</span> <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>7.5%</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>EES Penalty:</span> <span style={{ color: '#F44336', fontWeight: 'bold' }}>20%</span></div>
                  </div>
                </div>
              </div>

              {/* Dynamic Hedging Matrix */}
              <div style={{ 
                background: 'rgba(255,152,0,0.05)', 
                border: '2px solid rgba(255,152,0,0.3)', 
                borderRadius: '16px', 
                padding: '24px', 
                marginBottom: '24px' 
              }}>
                <h3 style={{ color: '#FF9800', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🛡️ DYNAMIC HEDGING ANALYSIS
                </h3>
                
                {/* Correlation Matrix */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '12px' }}>Asset Correlation Matrix (ρ)</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255,152,0,0.2)' }}>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(255,152,0,0.3)' }}>Asset Pair</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,152,0,0.3)' }}>Correlation</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,152,0,0.3)' }}>Hedge Quality</th>
                          <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,152,0,0.3)' }}>Variance Reduction</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>DTGC / PLS</td>
                          <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>0.72</td>
                          <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#FF9800' }}>Moderate</td>
                          <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>28%</td>
                        </tr>
                        <tr>
                          <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>DTGC / URMOM</td>
                          <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>0.45</td>
                          <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#4CAF50' }}>Good</td>
                          <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#4CAF50', fontWeight: 'bold' }}>55%</td>
                        </tr>
                        <tr style={{ background: 'rgba(76,175,80,0.1)' }}>
                          <td style={{ padding: '10px', fontWeight: 'bold' }}>Diamond LP vs Diamond+ LP</td>
                          <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>0.38</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: '#4CAF50', fontWeight: 'bold' }}>Excellent</td>
                          <td style={{ padding: '10px', textAlign: 'center', color: '#4CAF50', fontWeight: 'bold' }}>62%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px', fontStyle: 'italic' }}>
                    💡 Lower correlation = Better hedge. Diamond + Diamond+ combination provides optimal cross-asset hedging.
                  </p>
                </div>

                {/* Hedge Effectiveness */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sharpe Ratio (Unhedged)</div>
                    <div style={{ color: '#F44336', fontSize: '1.4rem', fontWeight: 'bold' }}>0.11</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sharpe Ratio (Hedged)</div>
                    <div style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: 'bold' }}>0.76</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Sortino Ratio</div>
                    <div style={{ color: '#2196F3', fontSize: '1.4rem', fontWeight: 'bold' }}>2.18</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Max Drawdown Reduction</div>
                    <div style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: 'bold' }}>-52%</div>
                  </div>
                </div>
              </div>

              {/* Dynamic Rebalancing */}
              <div style={{ 
                background: 'rgba(156,39,176,0.05)', 
                border: '2px solid rgba(156,39,176,0.3)', 
                borderRadius: '16px', 
                padding: '24px', 
                marginBottom: '24px' 
              }}>
                <h3 style={{ color: '#9C27B0', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🔄 DYNAMIC REBALANCING TRIGGERS
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(156,39,176,0.2)' }}>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(156,39,176,0.3)' }}>Signal</th>
                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(156,39,176,0.3)' }}>Threshold</th>
                        <th style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(156,39,176,0.3)' }}>Action</th>
                        <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid rgba(156,39,176,0.3)' }}>Rationale</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>📈 RSI Overbought</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#F44336' }}>&gt; 70</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Reduce LP → Single</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>Lock gains, reduce IL exposure</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>📉 RSI Oversold</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#4CAF50' }}>&lt; 30</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Increase LP allocation</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>Accumulate at discount via LP</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>⚡ Volatility Spike</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#FF9800' }}>&gt; 2σ daily</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Pause rebalancing 48h</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>Avoid panic trades</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>📅 Time-Based</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Every 30 days</td>
                        <td style={{ padding: '10px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Rebalance to target</td>
                        <td style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>Maintain optimal allocation</td>
                      </tr>
                      <tr style={{ background: 'rgba(76,175,80,0.1)' }}>
                        <td style={{ padding: '10px', fontWeight: 'bold' }}>🎯 Drift Threshold</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>±10% from target</td>
                        <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#4CAF50' }}>Immediate rebalance</td>
                        <td style={{ padding: '10px', color: 'var(--text-muted)' }}>Control risk exposure</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Rebalancing Cost Analysis */}
                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  <h4 style={{ color: 'var(--text-primary)', fontSize: '0.95rem', marginBottom: '12px' }}>💰 Rebalancing Cost Analysis</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#F44336', fontSize: '0.75rem' }}>Weekly</div>
                      <div style={{ color: '#F44336', fontWeight: 'bold' }}>~156%/yr</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>❌ Too costly</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px', background: 'rgba(76,175,80,0.2)', borderRadius: '8px' }}>
                      <div style={{ color: '#4CAF50', fontSize: '0.75rem' }}>Monthly ✓</div>
                      <div style={{ color: '#4CAF50', fontWeight: 'bold' }}>~36%/yr</div>
                      <div style={{ color: '#4CAF50', fontSize: '0.7rem' }}>✅ Optimal</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#FF9800', fontSize: '0.75rem' }}>Quarterly</div>
                      <div style={{ color: '#FF9800', fontWeight: 'bold' }}>~12%/yr</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>⚠️ Drift risk</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Lock Expiry</div>
                      <div style={{ fontWeight: 'bold' }}>~6%/yr</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>⚠️ High drift</div>
                    </div>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                    💡 Recommendation: Rebalance monthly OR when drift exceeds ±10%, whichever comes first
                  </p>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════════════════════ */}
              {/*     🎲 DYNAMIC STAKE HEDGING FORECASTER - "IT'S GAMBLING IF YOU CAN'T FORECAST FIRST" */}
              {/* ═══════════════════════════════════════════════════════════════ */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(156,39,176,0.15), rgba(0,188,212,0.1))',
                border: '3px solid #D4AF37',
                borderRadius: '20px',
                padding: '28px',
                marginBottom: '24px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Decorative corner */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: 'linear-gradient(135deg, transparent 50%, rgba(212,175,55,0.1) 50%)', pointerEvents: 'none' }} />
                
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <h3 style={{ color: '#D4AF37', fontSize: '1.5rem', marginBottom: '8px', fontFamily: "'Cinzel', serif", letterSpacing: '2px' }}>
                    🎯 DYNAMIC STAKE HEDGING FORECASTER
                  </h3>
                  <p style={{ color: '#9C27B0', fontSize: '1rem', fontWeight: 'bold', fontStyle: 'italic' }}>
                    "It's gambling if you can't forecast first"
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '8px' }}>
                    Allocate your portfolio across tiers and simulate price scenarios before staking
                  </p>
                </div>

                {/* Investment & Price Change Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ color: '#D4AF37', fontSize: '0.85rem', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>💰 Total Investment ($)</label>
                    <input
                      type="number"
                      value={forecastInvestment}
                      onChange={(e) => setForecastInvestment(e.target.value)}
                      style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.4)', border: '2px solid #D4AF37', borderRadius: '10px', color: '#D4AF37', fontSize: '1.2rem', fontWeight: 'bold', boxSizing: 'border-box' }}
                      placeholder="10000"
                    />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>📅 Staking Period (Months)</label>
                    <select
                      value={forecastMonths}
                      onChange={(e) => setForecastMonths(e.target.value)}
                      style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.4)', border: '2px solid rgba(255,255,255,0.3)', borderRadius: '10px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }}
                    >
                      <option value="3">3 Months</option>
                      <option value="6">6 Months</option>
                      <option value="12">12 Months</option>
                      <option value="24">24 Months</option>
                      <option value="36">36 Months</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: parseFloat(forecastPriceChange) >= 0 ? '#4CAF50' : '#F44336', fontSize: '0.85rem', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      {parseFloat(forecastPriceChange) >= 0 ? '📈' : '📉'} Price Change at Exit (%)
                    </label>
                    <input
                      type="number"
                      value={forecastPriceChange}
                      onChange={(e) => setForecastPriceChange(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '14px', 
                        background: parseFloat(forecastPriceChange) >= 0 ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)', 
                        border: `2px solid ${parseFloat(forecastPriceChange) >= 0 ? '#4CAF50' : '#F44336'}`, 
                        borderRadius: '10px', 
                        color: parseFloat(forecastPriceChange) >= 0 ? '#4CAF50' : '#F44336', 
                        fontSize: '1.2rem', 
                        fontWeight: 'bold', 
                        boxSizing: 'border-box' 
                      }}
                      placeholder="0"
                    />
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'center' }}>
                      Use negative for price drop (e.g. -50)
                    </div>
                  </div>
                </div>

                {/* Tier Allocation Sliders */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ color: '#fff', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📊 Portfolio Allocation
                      <span style={{ background: 'linear-gradient(135deg, #4CAF50, #2E7D32)', padding: '2px 8px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700 }}>V4</span>
                    </h4>
                    <span style={{ 
                      color: (parseFloat(forecastSilverPct) + parseFloat(forecastGoldPct) + parseFloat(forecastWhalePct) + parseFloat(forecastDiamondPct) + parseFloat(forecastDiamondPlusPct)) === 100 ? '#4CAF50' : '#F44336',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      Total: {parseFloat(forecastSilverPct || 0) + parseFloat(forecastGoldPct || 0) + parseFloat(forecastWhalePct || 0) + parseFloat(forecastDiamondPct || 0) + parseFloat(forecastDiamondPlusPct || 0)}%
                      {(parseFloat(forecastSilverPct) + parseFloat(forecastGoldPct) + parseFloat(forecastWhalePct) + parseFloat(forecastDiamondPct) + parseFloat(forecastDiamondPlusPct)) !== 100 && ' ⚠️ Must = 100%'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    {/* Silver Allocation */}
                    <div style={{ background: 'rgba(192,192,192,0.15)', borderRadius: '12px', padding: '14px', border: '2px solid #C0C0C0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#C0C0C0', fontWeight: 'bold', fontSize: '0.9rem' }}>🥈 Silver</span>
                        <span style={{ color: '#C0C0C0', fontWeight: 'bold' }}>{forecastSilverPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={forecastSilverPct}
                        onChange={(e) => setForecastSilverPct(e.target.value)}
                        style={{ width: '100%', accentColor: '#C0C0C0' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>15.4% APR</span>
                        <span>60d Lock</span>
                      </div>
                    </div>

                    {/* Gold Allocation */}
                    <div style={{ background: 'rgba(212,175,55,0.15)', borderRadius: '12px', padding: '14px', border: '2px solid #D4AF37' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '0.9rem' }}>🥇 Gold</span>
                        <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>{forecastGoldPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={forecastGoldPct}
                        onChange={(e) => setForecastGoldPct(e.target.value)}
                        style={{ width: '100%', accentColor: '#D4AF37' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>16.8% APR</span>
                        <span>90d Lock</span>
                      </div>
                    </div>

                    {/* Whale Allocation */}
                    <div style={{ background: 'rgba(33,150,243,0.15)', borderRadius: '12px', padding: '14px', border: '2px solid #2196F3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#2196F3', fontWeight: 'bold', fontSize: '0.9rem' }}>🐋 Whale</span>
                        <span style={{ color: '#2196F3', fontWeight: 'bold' }}>{forecastWhalePct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={forecastWhalePct}
                        onChange={(e) => setForecastWhalePct(e.target.value)}
                        style={{ width: '100%', accentColor: '#2196F3' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>18.2% APR</span>
                        <span>180d Lock</span>
                      </div>
                    </div>

                    {/* Diamond Allocation */}
                    <div style={{ background: 'rgba(0,188,212,0.15)', borderRadius: '12px', padding: '14px', border: '2px solid #00BCD4' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: '#00BCD4', fontWeight: 'bold', fontSize: '0.9rem' }}>💎 Diamond LP</span>
                        <span style={{ color: '#00BCD4', fontWeight: 'bold' }}>{forecastDiamondPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={forecastDiamondPct}
                        onChange={(e) => setForecastDiamondPct(e.target.value)}
                        style={{ width: '100%', accentColor: '#00BCD4' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <span>42% APR (1.5x)</span>
                        <span>DTGC/PLS LP</span>
                      </div>
                    </div>

                    {/* Diamond+ Allocation */}
                    <div style={{ background: 'rgba(156,39,176,0.15)', borderRadius: '12px', padding: '16px', border: '2px solid #9C27B0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ color: '#9C27B0', fontWeight: 'bold' }}>💜💎 Diamond+ LP</span>
                        <span style={{ color: '#9C27B0', fontWeight: 'bold' }}>{forecastDiamondPlusPct}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={forecastDiamondPlusPct}
                        onChange={(e) => setForecastDiamondPlusPct(e.target.value)}
                        style={{ width: '100%', accentColor: '#9C27B0' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>70% APR (2x)</span>
                        <span>DTGC/URMOM LP</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Forecast Results */}
                {(() => {
                  const investment = parseFloat(forecastInvestment) || 0;
                  const priceChange = parseFloat(forecastPriceChange) || 0;
                  const months = parseFloat(forecastMonths) || 12;
                  const silverPct = parseFloat(forecastSilverPct) || 0;
                  const goldPct = parseFloat(forecastGoldPct) || 0;
                  const whalePct = parseFloat(forecastWhalePct) || 0;
                  const diamondPct = parseFloat(forecastDiamondPct) || 0;
                  const diamondPlusPct = parseFloat(forecastDiamondPlusPct) || 0;
                  const totalPct = silverPct + goldPct + whalePct + diamondPct + diamondPlusPct;

                  if (totalPct !== 100 || investment <= 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                        {investment <= 0 ? 'Enter an investment amount' : 'Adjust allocations to total 100%'}
                      </div>
                    );
                  }

                  // Calculate allocations
                  const silverAmt = investment * (silverPct / 100);
                  const goldAmt = investment * (goldPct / 100);
                  const whaleAmt = investment * (whalePct / 100);
                  const diamondAmt = investment * (diamondPct / 100);
                  const diamondPlusAmt = investment * (diamondPlusPct / 100);

                  // APRs and fees
                  const APRS = { silver: 15.4, gold: 16.8, whale: 18.2, diamond: 42, diamondPlus: 70 };
                  const ENTRY_FEE = 3.75 / 100;
                  const EXIT_FEE = 3.75 / 100;

                  // Calculate rewards for each tier (NO FEES - pure APR)
                  const calcTierResult = (amt, apr) => {
                    const rewards = amt * (apr / 100) * (months / 12);
                    const grossValue = amt + rewards;
                    // Apply price change
                    const finalValue = grossValue * (1 + priceChange / 100);
                    return { invested: amt, rewards, grossValue, finalValue };
                  };

                  const silverResult = calcTierResult(silverAmt, APRS.silver);
                  const goldResult = calcTierResult(goldAmt, APRS.gold);
                  const whaleResult = calcTierResult(whaleAmt, APRS.whale);
                  const diamondResult = calcTierResult(diamondAmt, APRS.diamond);
                  const diamondPlusResult = calcTierResult(diamondPlusAmt, APRS.diamondPlus);

                  const totalRewards = silverResult.rewards + goldResult.rewards + whaleResult.rewards + diamondResult.rewards + diamondPlusResult.rewards;
                  const totalGrossValue = silverResult.grossValue + goldResult.grossValue + whaleResult.grossValue + diamondResult.grossValue + diamondPlusResult.grossValue;
                  const totalFinalValue = silverResult.finalValue + goldResult.finalValue + whaleResult.finalValue + diamondResult.finalValue + diamondPlusResult.finalValue;
                  
                  // Calculate with fees for comparison
                  const entryFeePaid = investment * ENTRY_FEE;
                  const exitFeePaid = totalGrossValue * EXIT_FEE;
                  const totalFees = entryFeePaid + exitFeePaid;
                  const valueAfterFees = (investment - entryFeePaid + totalRewards) * (1 - EXIT_FEE) * (1 + priceChange / 100);
                  
                  const netGainLoss = totalFinalValue - investment;
                  const netPercent = (netGainLoss / investment) * 100;
                  const blendedAPR = ((silverPct/100)*APRS.silver + (goldPct/100)*APRS.gold + (whalePct/100)*APRS.whale + (diamondPct/100)*APRS.diamond + (diamondPlusPct/100)*APRS.diamondPlus);

                  // Calculate breakeven price drop (what % price can drop before you lose money)
                  const breakeven = (totalRewards / investment) * 100;

                  return (
                    <>
                      {/* Results Header */}
                      <div style={{ 
                        background: netGainLoss >= 0 ? 'linear-gradient(135deg, rgba(76,175,80,0.2), rgba(76,175,80,0.1))' : 'linear-gradient(135deg, rgba(244,67,54,0.2), rgba(244,67,54,0.1))',
                        borderRadius: '16px',
                        padding: '20px',
                        marginBottom: '20px',
                        border: `2px solid ${netGainLoss >= 0 ? '#4CAF50' : '#F44336'}`,
                        textAlign: 'center'
                      }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
                          📊 Projected Portfolio Value After {months} Months
                        </div>
                        <div style={{ color: netGainLoss >= 0 ? '#4CAF50' : '#F44336', fontSize: '2.5rem', fontWeight: 'bold' }}>
                          ${totalFinalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ color: netGainLoss >= 0 ? '#4CAF50' : '#F44336', fontSize: '1.2rem', fontWeight: 'bold', marginTop: '8px' }}>
                          {netGainLoss >= 0 ? '📈' : '📉'} {netGainLoss >= 0 ? '+' : ''}${netGainLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({netPercent >= 0 ? '+' : ''}{netPercent.toFixed(1)}%)
                        </div>
                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                          <span style={{ color: '#D4AF37' }}>Blended APR: <b>{blendedAPR.toFixed(1)}%</b></span>
                          <span style={{ color: '#4CAF50' }}>Total Rewards: <b>${totalRewards.toLocaleString(undefined, { maximumFractionDigits: 0 })}</b></span>
                          <span style={{ color: '#2196F3' }}>Breakeven Drop: <b>{breakeven.toFixed(1)}%</b></span>
                        </div>
                        
                        {/* After Fees Box */}
                        <div style={{ 
                          marginTop: '16px', 
                          padding: '12px', 
                          background: 'rgba(255,152,0,0.15)', 
                          borderRadius: '10px',
                          border: '1px solid rgba(255,152,0,0.4)'
                        }}>
                          <div style={{ fontSize: '0.75rem', color: '#FF9800', marginBottom: '6px' }}>
                            💰 After 3.75% Entry + 3.75% Exit Fees (~${totalFees.toLocaleString(undefined, { maximumFractionDigits: 0 })} total)
                          </div>
                          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: valueAfterFees >= investment ? '#4CAF50' : '#F44336' }}>
                            ${valueAfterFees.toLocaleString(undefined, { maximumFractionDigits: 0 })} 
                            <span style={{ fontSize: '0.85rem', marginLeft: '8px' }}>
                              ({valueAfterFees >= investment ? '+' : ''}${(valueAfterFees - investment).toLocaleString(undefined, { maximumFractionDigits: 0 })})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tier Breakdown */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                        {silverPct > 0 && (
                          <div style={{ background: 'rgba(192,192,192,0.1)', borderRadius: '12px', padding: '12px', border: '1px solid #C0C0C0' }}>
                            <div style={{ color: '#C0C0C0', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem' }}>🥈 Silver ({silverPct}%)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invested: ${silverAmt.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: '#4CAF50' }}>Rewards: +${silverResult.rewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                            <div style={{ fontSize: '0.85rem', color: silverResult.finalValue >= silverAmt ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>Final: ${silverResult.finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          </div>
                        )}
                        {goldPct > 0 && (
                          <div style={{ background: 'rgba(212,175,55,0.1)', borderRadius: '12px', padding: '12px', border: '1px solid #D4AF37' }}>
                            <div style={{ color: '#D4AF37', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem' }}>🥇 Gold ({goldPct}%)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invested: ${goldAmt.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: '#4CAF50' }}>Rewards: +${goldResult.rewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                            <div style={{ fontSize: '0.85rem', color: goldResult.finalValue >= goldAmt ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>Final: ${goldResult.finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          </div>
                        )}
                        {whalePct > 0 && (
                          <div style={{ background: 'rgba(33,150,243,0.1)', borderRadius: '12px', padding: '12px', border: '1px solid #2196F3' }}>
                            <div style={{ color: '#2196F3', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem' }}>🐋 Whale ({whalePct}%)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invested: ${whaleAmt.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: '#4CAF50' }}>Rewards: +${whaleResult.rewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                            <div style={{ fontSize: '0.85rem', color: whaleResult.finalValue >= whaleAmt ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>Final: ${whaleResult.finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          </div>
                        )}
                        {diamondPct > 0 && (
                          <div style={{ background: 'rgba(0,188,212,0.1)', borderRadius: '12px', padding: '12px', border: '1px solid #00BCD4' }}>
                            <div style={{ color: '#00BCD4', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem' }}>💎 Diamond ({diamondPct}%)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invested: ${diamondAmt.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: '#4CAF50' }}>Rewards: +${diamondResult.rewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                            <div style={{ fontSize: '0.85rem', color: diamondResult.finalValue >= diamondAmt ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>Final: ${diamondResult.finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          </div>
                        )}
                        {diamondPlusPct > 0 && (
                          <div style={{ background: 'rgba(156,39,176,0.1)', borderRadius: '12px', padding: '12px', border: '1px solid #9C27B0' }}>
                            <div style={{ color: '#9C27B0', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem' }}>💜💎 Diamond+ ({diamondPlusPct}%)</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Invested: ${diamondPlusAmt.toLocaleString()}</div>
                            <div style={{ fontSize: '0.75rem', color: '#4CAF50' }}>Rewards: +${diamondPlusResult.rewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                            <div style={{ fontSize: '0.85rem', color: diamondPlusResult.finalValue >= diamondPlusAmt ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>Final: ${diamondPlusResult.finalValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                          </div>
                        )}
                      </div>

                      {/* Scenario Quick Buttons */}
                      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => setForecastPriceChange('-50')} style={{ padding: '8px 16px', background: 'rgba(244,67,54,0.2)', border: '1px solid #F44336', borderRadius: '20px', color: '#F44336', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>📉 -50% Crash</button>
                        <button onClick={() => setForecastPriceChange('-25')} style={{ padding: '8px 16px', background: 'rgba(255,152,0,0.2)', border: '1px solid #FF9800', borderRadius: '20px', color: '#FF9800', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>📉 -25% Dip</button>
                        <button onClick={() => setForecastPriceChange('0')} style={{ padding: '8px 16px', background: 'rgba(158,158,158,0.2)', border: '1px solid #9E9E9E', borderRadius: '20px', color: '#9E9E9E', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>➡️ Flat</button>
                        <button onClick={() => setForecastPriceChange('50')} style={{ padding: '8px 16px', background: 'rgba(76,175,80,0.2)', border: '1px solid #4CAF50', borderRadius: '20px', color: '#4CAF50', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>📈 +50% Pump</button>
                        <button onClick={() => setForecastPriceChange('100')} style={{ padding: '8px 16px', background: 'rgba(33,150,243,0.2)', border: '1px solid #2196F3', borderRadius: '20px', color: '#2196F3', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>🚀 +100% Moon</button>
                      </div>

                      {/* Strategy Insight */}
                      <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(212,175,55,0.1)', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.3)' }}>
                        <div style={{ color: '#D4AF37', fontWeight: 'bold', marginBottom: '8px' }}>💡 Strategy Insight</div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                          {priceChange < -30 
                            ? `⚠️ In a ${Math.abs(priceChange)}% crash, your ${blendedAPR.toFixed(1)}% blended APR helps offset losses. Higher LP allocation (Diamond/Diamond+) provides more protection through higher yields.`
                            : priceChange < 0
                            ? `📊 With a ${Math.abs(priceChange)}% dip, your staking rewards can help recover losses. Your breakeven is at ${breakeven.toFixed(1)}% price drop.`
                            : priceChange === 0
                            ? `✨ With flat prices, you earn pure ${blendedAPR.toFixed(1)}% APR returns. Consider increasing Diamond+ for maximum yield.`
                            : `🚀 In a ${priceChange}% pump, your ${totalRewards.toLocaleString(undefined, {maximumFractionDigits: 0})} rewards compound with price gains for ${netPercent.toFixed(1)}% total return!`
                          }
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* V4 MULTI-STAKE CALCULATOR - UP TO 6 POSITIONS */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(76,175,80,0.1), rgba(33,150,243,0.1))',
                border: '2px solid #4CAF50',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <h3 style={{ color: '#4CAF50', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    📦 V4 MULTI-STAKE SIMULATOR
                    <span style={{ background: 'linear-gradient(135deg, #4CAF50, #2E7D32)', padding: '3px 10px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700 }}>UP TO 6 STAKES</span>
                  </h3>
                  <button
                    onClick={addMultiStake}
                    disabled={multiStakes.length >= 6}
                    style={{
                      padding: '8px 16px',
                      background: multiStakes.length >= 6 ? 'rgba(128,128,128,0.2)' : 'linear-gradient(135deg, #4CAF50, #2E7D32)',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: multiStakes.length >= 6 ? 'not-allowed' : 'pointer',
                      opacity: multiStakes.length >= 6 ? 0.5 : 1,
                    }}
                  >
                    + Add Stake ({multiStakes.length}/6)
                  </button>
                </div>
                
                <p style={{ color: '#888', fontSize: '0.8rem', marginBottom: '20px' }}>
                  Simulate stacking multiple V4 positions across different tiers to analyze diversified strategies
                </p>

                {/* Multi-Stake Input Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                  {multiStakes.map((stake, idx) => {
                    const tierConfig = {
                      silver: { color: '#C0C0C0', icon: '🥈', apr: 15.4, lock: 60 },
                      gold: { color: '#D4AF37', icon: '🥇', apr: 16.8, lock: 90 },
                      whale: { color: '#2196F3', icon: '🐋', apr: 18.2, lock: 180 },
                      diamond: { color: '#00BCD4', icon: '💎', apr: 42, lock: 90 },
                      diamondPlus: { color: '#9C27B0', icon: '💜💎', apr: 70, lock: 90 },
                    };
                    const config = tierConfig[stake.tier] || tierConfig.gold;
                    
                    return (
                      <div key={stake.id} style={{
                        background: `rgba(${stake.tier === 'silver' ? '192,192,192' : stake.tier === 'gold' ? '212,175,55' : stake.tier === 'whale' ? '33,150,243' : stake.tier === 'diamond' ? '0,188,212' : '156,39,176'},0.1)`,
                        border: `2px solid ${config.color}`,
                        borderRadius: '12px',
                        padding: '16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.2rem', color: config.color, fontWeight: 700 }}>#{idx + 1}</span>
                          
                          <select
                            value={stake.tier}
                            onChange={(e) => updateMultiStake(stake.id, 'tier', e.target.value)}
                            style={{
                              padding: '10px 14px',
                              background: 'rgba(0,0,0,0.3)',
                              border: `1px solid ${config.color}`,
                              borderRadius: '8px',
                              color: config.color,
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="silver">🥈 Silver (15.4% • 60d)</option>
                            <option value="gold">🥇 Gold (16.8% • 90d)</option>
                            <option value="whale">🐋 Whale (18.2% • 180d)</option>
                            <option value="diamond">💎 Diamond LP (42% • 90d)</option>
                            <option value="diamondPlus">💜💎 Diamond+ LP (70% • 90d)</option>
                          </select>
                          
                          <div style={{ flex: 1, minWidth: '120px' }}>
                            <input
                              type="number"
                              value={stake.amount}
                              onChange={(e) => updateMultiStake(stake.id, 'amount', e.target.value)}
                              placeholder="Amount ($)"
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '1rem',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                          
                          {multiStakes.length > 1 && (
                            <button
                              onClick={() => removeMultiStake(stake.id)}
                              style={{
                                padding: '8px 12px',
                                background: 'rgba(244,67,54,0.2)',
                                border: '1px solid #F44336',
                                borderRadius: '8px',
                                color: '#F44336',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Multi-Stake Results */}
                {(() => {
                  const APRS = { silver: 15.4, gold: 16.8, whale: 18.2, diamond: 42, diamondPlus: 70 };
                  const ENTRY_FEE = 3.75 / 100;
                  const EXIT_FEE = 3.75 / 100;
                  
                  const results = multiStakes.map(stake => {
                    const amount = parseFloat(stake.amount) || 0;
                    const apr = APRS[stake.tier] || 16.8;
                    const months = stake.tier === 'silver' ? 2 : stake.tier === 'whale' ? 6 : 3;
                    
                    // Pure APR calculation (no fees)
                    const rewards = amount * (apr / 100) * (months / 12);
                    const grossValue = amount + rewards;
                    
                    // With fees calculation
                    const afterEntry = amount * (1 - ENTRY_FEE);
                    const rewardsAfterFees = afterEntry * (apr / 100) * (months / 12);
                    const afterExit = (afterEntry + rewardsAfterFees) * (1 - EXIT_FEE);
                    
                    return { ...stake, amount, apr, months, rewards, grossValue, afterExit };
                  });
                  
                  const totalInvested = results.reduce((sum, r) => sum + r.amount, 0);
                  const totalRewards = results.reduce((sum, r) => sum + r.rewards, 0);
                  const totalGrossValue = results.reduce((sum, r) => sum + r.grossValue, 0);
                  const totalAfterFees = results.reduce((sum, r) => sum + r.afterExit, 0);
                  const avgApr = totalInvested > 0 ? results.reduce((sum, r) => sum + (r.amount / totalInvested) * r.apr, 0) : 0;
                  
                  if (totalInvested <= 0) {
                    return (
                      <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
                        Enter amounts for your stakes above to see projections
                      </div>
                    );
                  }
                  
                  return (
                    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '20px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', textAlign: 'center', marginBottom: '16px' }}>
                        <div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>Total Invested</div>
                          <div style={{ color: '#D4AF37', fontSize: '1.4rem', fontWeight: 700 }}>${totalInvested.toLocaleString()}</div>
                        </div>
                        <div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>Total Rewards</div>
                          <div style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: 700 }}>+${totalRewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        </div>
                        <div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>Gross Return</div>
                          <div style={{ color: '#2196F3', fontSize: '1.4rem', fontWeight: 700 }}>${totalGrossValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        </div>
                        <div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>After 7.5% Fees</div>
                          <div style={{ color: '#FF9800', fontSize: '1.4rem', fontWeight: 700 }}>${totalAfterFees.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                        <span style={{ color: '#9C27B0', fontSize: '0.9rem' }}>Blended APR: <b>{avgApr.toFixed(1)}%</b></span>
                      </div>
                      
                      {/* Per-Position Breakdown */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                        <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>Position Breakdown:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {results.filter(r => r.amount > 0).map((r, i) => (
                            <div key={i} style={{
                              padding: '8px 12px',
                              background: 'rgba(255,255,255,0.05)',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                            }}>
                              <span style={{ color: r.tier === 'silver' ? '#C0C0C0' : r.tier === 'gold' ? '#D4AF37' : r.tier === 'whale' ? '#2196F3' : r.tier === 'diamond' ? '#00BCD4' : '#9C27B0' }}>
                                #{i+1} {r.tier.charAt(0).toUpperCase() + r.tier.slice(1)}
                              </span>
                              <span style={{ color: '#888' }}> ${r.amount.toLocaleString()} →</span>
                              <span style={{ color: '#4CAF50' }}> +${r.rewards.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                              <span style={{ color: '#888' }}> ({r.months}mo)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* DYNAMIC PERSONAL FORECASTING CALCULATOR */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(156,39,176,0.1))',
                border: '2px solid rgba(212,175,55,0.5)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h3 style={{ color: '#D4AF37', fontSize: '1.3rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🧮 PERSONAL STAKING CALCULATOR
                </h3>
                <p style={{ fontSize: '0.65rem', color: 'rgba(212,175,55,0.7)', marginBottom: '20px' }}>*V4 contracts • Stake multiple times, earn rewards on each position</p>

                {/* Input Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Investment ($)</label>
                    <input
                      type="number"
                      value={calcInvestment}
                      onChange={(e) => setCalcInvestment(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }}
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <label style={{ color: '#4CAF50', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>📈 Price at BUY ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={calcBuyPrice}
                      onChange={(e) => setCalcBuyPrice(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(76,175,80,0.1)', border: '1px solid rgba(76,175,80,0.4)', borderRadius: '8px', color: '#4CAF50', fontSize: '1rem', boxSizing: 'border-box' }}
                      placeholder="0.0002"
                    />
                  </div>
                  <div>
                    <label style={{ color: '#2196F3', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>📉 Price at EXIT ($)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={calcExitPrice}
                      onChange={(e) => setCalcExitPrice(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(33,150,243,0.1)', border: '1px solid rgba(33,150,243,0.4)', borderRadius: '8px', color: '#2196F3', fontSize: '1rem', boxSizing: 'border-box' }}
                      placeholder="0.0003"
                    />
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Staking Tier</label>
                    <select
                      value={calcTier}
                      onChange={(e) => setCalcTier(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    >
                      <option value="silver">🥈 Silver (15.4% APR, 60d)</option>
                      <option value="gold">🥇 Gold (16.8% APR, 90d)</option>
                      <option value="whale">🐋 Whale (18.2% APR, 180d)</option>
                      <option value="diamond">💎 Diamond LP (42% eff)</option>
                      <option value="diamondplus">💜💎 Diamond+ LP (70% eff)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Timeframe</label>
                    <select
                      value={calcTimeframe}
                      onChange={(e) => setCalcTimeframe(e.target.value)}
                      style={{ width: '100%', padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', color: '#fff', fontSize: '1rem', boxSizing: 'border-box' }}
                    >
                      <option value="3">3 Months</option>
                      <option value="6">6 Months</option>
                      <option value="12">12 Months</option>
                      <option value="24">24 Months</option>
                      <option value="36">36 Months</option>
                    </select>
                  </div>
                </div>

                {/* Price Change Indicator */}
                {(() => {
                  const buyP = parseFloat(calcBuyPrice) || 0.0002;
                  const exitP = parseFloat(calcExitPrice) || 0.0003;
                  const priceChange = ((exitP - buyP) / buyP * 100);
                  return (
                    <div style={{ marginBottom: '16px', padding: '10px 16px', background: priceChange >= 0 ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Price Change:</span>
                      <span style={{ color: priceChange >= 0 ? '#4CAF50' : '#F44336', fontWeight: 'bold', fontSize: '1.1rem' }}>
                        {priceChange >= 0 ? '📈' : '📉'} {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        (${buyP.toFixed(6)} → ${exitP.toFixed(6)})
                      </span>
                    </div>
                  );
                })()}

                {/* Results */}
                {(() => {
                  const investment = parseFloat(calcInvestment) || 0;
                  const buyPrice = parseFloat(calcBuyPrice) || 0.0002;
                  const exitPrice = parseFloat(calcExitPrice) || 0.0003;
                  const months = parseInt(calcTimeframe) || 12;
                  const tierData = {
                    silver: { apr: 15.4, lock: 60, name: 'Silver', icon: '🥈' },
                    gold: { apr: 16.8, lock: 90, name: 'Gold', icon: '🥇' },
                    whale: { apr: 18.2, lock: 180, name: 'Whale', icon: '🐋' },
                    diamond: { apr: 42, lock: 90, name: 'Diamond LP', icon: '💎' },
                    diamondplus: { apr: 70, lock: 90, name: 'Diamond+ LP', icon: '💜💎' },
                  }[calcTier];

                  const entryFee = 0.0375;
                  const exitFee = 0.0375;
                  const afterEntry = investment * (1 - entryFee);
                  const tokens = afterEntry / buyPrice;
                  const monthlyRate = tierData.apr / 100 / 12;
                  const rewardTokens = tokens * (Math.pow(1 + monthlyRate, months) - 1);
                  const totalTokens = tokens + rewardTokens;
                  const grossValueAtExit = totalTokens * exitPrice;
                  const afterExitFee = grossValueAtExit * (1 - exitFee);
                  const netProfit = afterExitFee - investment;
                  const priceGain = (exitPrice - buyPrice) / buyPrice * 100;
                  const rewardValue = rewardTokens * exitPrice; // $ value of rewards
                  const netAPR = ((afterExitFee / investment) ** (12 / months) - 1) * 100;
                  const lockPeriods = Math.ceil(months * 30 / tierData.lock);
                  const totalFees = investment * entryFee + grossValueAtExit * exitFee;

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Tokens Acquired</div>
                        <div style={{ color: '#D4AF37', fontSize: '1.4rem', fontWeight: 'bold' }}>{tokens.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>DTGC</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Gross Rewards</div>
                        <div style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: 'bold' }}>${rewardValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Before exit fee</div>
                      </div>
                      <div style={{ background: 'rgba(76,175,80,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '2px solid rgba(76,175,80,0.5)' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Final Value</div>
                        <div style={{ color: '#4CAF50', fontSize: '1.4rem', fontWeight: 'bold' }}>${afterExitFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div style={{ color: '#4CAF50', fontSize: '0.7rem' }}>+${netProfit.toLocaleString(undefined, { maximumFractionDigits: 2 })} profit</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Effective Net APR</div>
                        <div style={{ color: '#2196F3', fontSize: '1.4rem', fontWeight: 'bold' }}>{netAPR.toFixed(1)}%</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>After 7.5% fees</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Lock Periods</div>
                        <div style={{ color: '#FF9800', fontSize: '1.4rem', fontWeight: 'bold' }}>{lockPeriods}x</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{tierData.lock} days each</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '4px' }}>Total Fees Paid</div>
                        <div style={{ color: '#F44336', fontSize: '1.4rem', fontWeight: 'bold' }}>${totalFees.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Entry + Exit</div>
                      </div>
                    </div>
                  );
                })()}

                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '16px', textAlign: 'center', fontStyle: 'italic' }}>
                  * Calculations assume continuous compounding and price stability. Actual results may vary.
                </p>
              </div>

              {/* V19 Tier Reference Table */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(33,150,243,0.1))',
                border: '2px solid rgba(212,175,55,0.3)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h3 style={{ color: '#D4AF37', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📈 V19 STAKING TIERS REFERENCE
                </h3>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(212,175,55,0.2)' }}>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid rgba(212,175,55,0.5)' }}>Tier</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(212,175,55,0.5)' }}>Min Invest</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(212,175,55,0.5)' }}>Lock Period</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(212,175,55,0.5)' }}>Base APR</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(212,175,55,0.5)' }}>Boost</th>
                        <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid rgba(212,175,55,0.5)' }}>Effective APR</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>🥈 Silver</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>$200</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>60 days</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#C0C0C0' }}>15.4%</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>1x</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#C0C0C0', fontWeight: 'bold' }}>15.4%</td>
                      </tr>
                      <tr style={{ background: 'rgba(212,175,55,0.1)' }}>
                        <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontWeight: 'bold' }}>🥇 Gold</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>$500</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>90 days</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#D4AF37' }}>16.8%</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>1x</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#D4AF37', fontWeight: 'bold' }}>16.8%</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>🐋 Whale</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>$2,500</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>180 days</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#4169E1' }}>18.2%</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>1x</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#4169E1', fontWeight: 'bold' }}>18.2%</td>
                      </tr>
                      <tr style={{ background: 'rgba(0,188,212,0.1)' }}>
                        <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>💎 Diamond LP</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>$1,000</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>90 days</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#00BCD4' }}>28%</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#00BCD4' }}>1.5x</td>
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#00BCD4', fontWeight: 'bold' }}>42%</td>
                      </tr>
                      <tr style={{ background: 'rgba(156,39,176,0.15)' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>💜💎 Diamond+ LP</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>$1,000</td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>90 days</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#9C27B0' }}>35%</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#9C27B0' }}>2x</td>
                        <td style={{ padding: '12px', textAlign: 'center', color: '#9C27B0', fontWeight: 'bold' }}>70%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                  * V19 Sustainable Tokenomics: 7.5% total fees (3.75% entry + 3.75% exit). EES penalty: 20% if withdrawn before lock period ends.
                </p>
              </div>

              {/* VaR Analysis - Enhanced with Education */}
              <div style={{
                background: 'rgba(244,67,54,0.05)',
                border: '2px solid rgba(244,67,54,0.3)',
                borderRadius: '16px',
                padding: '24px'
              }}>
                <h3 style={{ color: '#F44336', fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ⚠️ VALUE AT RISK (VaR) ANALYSIS
                </h3>

                {/* VaR Education Box */}
                <div style={{ background: 'rgba(33,150,243,0.1)', border: '1px solid rgba(33,150,243,0.3)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <h4 style={{ color: '#2196F3', fontSize: '0.95rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📚 What is Value at Risk (VaR)?
                  </h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.6', marginBottom: '10px' }}>
                    <strong style={{ color: '#fff' }}>VaR measures your potential maximum loss</strong> over a specific time period at a given confidence level.
                    It answers: "What's the most I could lose in a worst-case scenario?"
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ color: '#F44336', fontWeight: 'bold', fontSize: '0.85rem' }}>Price Drop Risk</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>If DTGC price falls, your token value decreases</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ color: '#FF9800', fontWeight: 'bold', fontSize: '0.85rem' }}>Fee Impact</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>7.5% total fees (entry + exit) reduce net returns</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                      <div style={{ color: '#4CAF50', fontWeight: 'bold', fontSize: '0.85rem' }}>APR Buffer</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Staking rewards help offset price drops</div>
                    </div>
                  </div>
                </div>

                {/* Manual Price Drop Entry */}
                <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    If DTGC price drops by:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      step="5"
                      value={calcPriceDrop}
                      onChange={(e) => setCalcPriceDrop(e.target.value)}
                      style={{ width: '120px', accentColor: '#F44336' }}
                    />
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={calcPriceDrop}
                      onChange={(e) => setCalcPriceDrop(e.target.value)}
                      style={{ width: '60px', padding: '8px', background: 'rgba(244,67,54,0.2)', border: '1px solid rgba(244,67,54,0.5)', borderRadius: '6px', color: '#F44336', fontSize: '1rem', textAlign: 'center', fontWeight: 'bold' }}
                    />
                    <span style={{ color: '#F44336', fontWeight: 'bold', fontSize: '1.1rem' }}>%</span>
                  </div>
                </div>

                {/* Dynamic VaR Calculations */}
                {(() => {
                  const investment = parseFloat(calcInvestment) || 1000;
                  const priceDrop = parseFloat(calcPriceDrop) || 50;
                  const entryFee = 0.0375;
                  const exitFee = 0.0375;
                  const months = parseInt(calcTimeframe) || 12;
                  const tierAPR = {
                    silver: 15.4, gold: 16.8, whale: 18.2, diamond: 42, diamondplus: 70
                  }[calcTier] || 16.8;

                  // After entry fee
                  const afterEntry = investment * (1 - entryFee);

                  // Rewards earned (as % of principal)
                  const rewardsEarned = afterEntry * (tierAPR / 100) * (months / 12);

                  // Total value before price drop (principal + rewards)
                  const totalBeforeDrop = afterEntry + rewardsEarned;

                  // Value after price drop
                  const valueAfterDrop = totalBeforeDrop * (1 - priceDrop / 100);

                  // After exit fee
                  const finalValue = valueAfterDrop * (1 - exitFee);

                  // Net loss
                  const netLoss = finalValue - investment;
                  const lossPercent = (netLoss / investment * 100);

                  // Breakeven price drop (where you get back your initial investment)
                  const breakeven = ((1 - investment / (totalBeforeDrop * (1 - exitFee))) * 100);

                  return (
                    <>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px', textAlign: 'center' }}>
                        With <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>${investment.toLocaleString()}</span> invested at <span style={{ color: '#2196F3', fontWeight: 'bold' }}>{tierAPR}% APR</span> for <span style={{ color: '#9C27B0', fontWeight: 'bold' }}>{months} months</span>:
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                        <div style={{ background: 'rgba(244,67,54,0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>Value After {priceDrop}% Drop</div>
                          <div style={{ color: '#F44336', fontSize: '1.8rem', fontWeight: 'bold' }}>${finalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ color: '#F44336', fontSize: '0.85rem' }}>{lossPercent >= 0 ? '+' : ''}{lossPercent.toFixed(1)}% net</div>
                        </div>
                        <div style={{ background: 'rgba(255,152,0,0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>Net Gain/Loss</div>
                          <div style={{ color: netLoss >= 0 ? '#4CAF50' : '#F44336', fontSize: '1.8rem', fontWeight: 'bold' }}>{netLoss >= 0 ? '+' : ''}{netLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>After all fees</div>
                        </div>
                        <div style={{ background: 'rgba(76,175,80,0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: '2px solid rgba(76,175,80,0.5)' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>Breakeven Price Drop</div>
                          <div style={{ color: '#4CAF50', fontSize: '1.8rem', fontWeight: 'bold' }}>{breakeven > 0 ? breakeven.toFixed(1) : '0'}%</div>
                          <div style={{ color: '#4CAF50', fontSize: '0.85rem' }}>APR offsets this much drop</div>
                        </div>
                      </div>

                      <div style={{ marginTop: '20px', padding: '12px', background: netLoss >= 0 ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)', borderRadius: '8px', textAlign: 'center' }}>
                        <span style={{ color: netLoss >= 0 ? '#4CAF50' : '#F44336', fontWeight: 'bold' }}>
                          {netLoss >= 0
                            ? `✅ At ${priceDrop}% price drop, you still profit $${netLoss.toFixed(0)} thanks to ${tierAPR}% APR!`
                            : `⚠️ At ${priceDrop}% price drop, you lose $${Math.abs(netLoss).toFixed(0)} even with ${tierAPR}% APR rewards`
                          }
                        </span>
                      </div>
                    </>
                  );
                })()}

                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '16px', textAlign: 'center', fontStyle: 'italic' }}>
                  * VaR calculations assume all rewards are reinvested. Actual results depend on market conditions and when you exit.
                </p>
              </div>

            </section>
          )}

          {/* PULSEX GOLD TAB - PulseX Tools */}
          {activeTab === 'gold' && (
            <section className="section-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <V4DeFiGoldSuite 
                provider={provider}
                signer={signer}
                userAddress={account}
                onClose={() => setActiveTab('stake')}
              />
            </section>
          )}

          {/* WHITE DIAMOND TAB - NFT Staking */}
          {activeTab === 'whitediamond' && (
            <section className="section-container" style={{ maxWidth: '1200px', margin: '0 auto' }}>
              <WhiteDiamondStaking 
                provider={provider}
                signer={signer}
                userAddress={account}
                livePrices={livePrices}
                onStakesUpdate={setWhiteDiamondNFTs}
                onClose={() => setActiveTab('stake')}
              />
            </section>
          )}

          {/* SAAS TAB - White-Label Staking Platform */}
          {activeTab === 'saas' && (
            <PricingPage />
          )}

          {/* DAPPER FLEX V6 TAB - Pink Gold Cross-Chain */}
          {activeTab === 'dapperflex' && (
            <section className="section-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
              <DapperFlexV6 
                provider={provider}
                account={account}
              />
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="footer">
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <div style={{
              position: 'relative',
              width: '80px',
              height: '80px',
              marginBottom: '12px'
            }}>
              <img 
                src="/favicon1.png"
                alt="DTGC"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 10px rgba(212,175,55,0.6)) drop-shadow(0 0 20px rgba(212,175,55,0.4)) drop-shadow(0 0 30px rgba(212,175,55,0.2))',
                  animation: 'goldGlow 3s ease-in-out infinite'
                }}
              />
              <div style={{
                position: 'absolute',
                inset: '-10px',
                background: 'radial-gradient(circle, rgba(212,175,55,0.3) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: 'pulse 2s ease-in-out infinite',
                zIndex: -1
              }} />
            </div>
            <div style={{ fontSize: '0.9rem', color: '#D4AF37', fontWeight: 600, letterSpacing: '2px' }}>
              Gold DeFi Suite • V4 Multi-Stake
            </div>
            <div style={{ fontSize: '0.65rem', color: '#4CAF50', marginTop: '4px', letterSpacing: '1px' }}>
              ✨ PulseChain's first official V4 contract stake utility
            </div>
          </div>
          <div className="footer-links">
            <button onClick={() => handleNavClick('stake')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>🚀 Staking V4</button>
            <button onClick={() => handleNavClick('stake')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>💎 LP Staking V4</button>
            <button onClick={() => handleNavClick('vote')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>DAO Voting</button>
            <button onClick={() => handleNavClick('whitepaper')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}>📄 Whitepaper</button>
            <button onClick={() => handleNavClick('gold')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: '#D4AF37' }}>🏆 PulseX Gold</button>
            <button onClick={() => handleNavClick('saas')} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', color: '#4CAF50' }}>🏭 SaaS Platform</button>
            <a href="https://t.me/dtgoldcoin" target="_blank" rel="noopener noreferrer" className="footer-link">Telegram</a>
          </div>
          <div className="footer-divider" />
          <p className="footer-text">© 2026 dtgc.io • Gold DeFi Suite on PulseChain</p>
        </footer>

        {/* DexScreener Widget */}
        <DexScreenerWidget />
        
        {/* Floating LP Stakes Widget (top-left) */}
        <FloatingLPWidget 
          account={account}
          stakedPositions={stakedPositions}
          livePrices={livePrices}
          formatNumber={formatNumber}
          getCurrencySymbol={getCurrencySymbol}
          convertToCurrency={convertToCurrency}
          whiteDiamondNFTs={whiteDiamondNFTs}
        />

        {/* Gold Records - Stake History (Above Calculator) */}
        <div
          onClick={() => setShowGoldRecords(true)}
          style={{
            position: 'fixed',
            bottom: '94px',
            right: '24px',
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #B8860B 0%, #DAA520 50%, #FFD700 100%)',
            border: '3px solid #D4AF37',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 1500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            boxShadow: '0 4px 20px rgba(212,175,55,0.5), inset 0 2px 10px rgba(255,255,255,0.2)',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 30px rgba(212,175,55,0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,175,55,0.5)';
          }}
          title="🏆 Treasure Vault - Stake History"
        >
          🏆
        </div>

        {/* Gold Records Modal - TREASURE VAULT */}
        {showGoldRecords && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.95)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(10px)',
          }} onClick={() => setShowGoldRecords(false)}>
            <div style={{
              background: 'linear-gradient(135deg, #1a1505 0%, #0d0d1a 100%)',
              border: '3px solid #D4AF37',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '800px',
              width: '95%',
              maxHeight: '85vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(212,175,55,0.4), inset 0 0 60px rgba(212,175,55,0.05)',
            }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{
                  color: '#D4AF37',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '1.8rem',
                  letterSpacing: '3px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  textShadow: '0 0 20px rgba(212,175,55,0.5)',
                }}>
                  🏆 TREASURE VAULT
                </h2>
                <button
                  onClick={() => setShowGoldRecords(false)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(212,175,55,0.3)',
                    color: '#D4AF37',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ×
                </button>
              </div>
              
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '24px', textAlign: 'center' }}>
                Your completed stakes displayed as gold bars • {stakeHistory.length + flexHistory.length} total records
              </p>

              {/* 💗 FLEX HISTORY SECTION */}
              {flexHistory.length > 0 && (
                <div style={{
                  marginBottom: '24px',
                  padding: '20px',
                  background: 'linear-gradient(135deg, rgba(255,20,147,0.15) 0%, rgba(255,105,180,0.05) 100%)',
                  borderRadius: '16px',
                  border: '2px solid #FF1493',
                }}>
                  <h3 style={{
                    color: '#FF1493',
                    fontFamily: 'Cinzel, serif',
                    fontSize: '1rem',
                    letterSpacing: '2px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    💗 FLEX STAKE HISTORY
                    <span style={{
                      background: '#FF1493',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.6rem',
                      color: '#fff',
                    }}>{flexHistory.length}</span>
                  </h3>
                  
                  {/* Flex Summary */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem' }}>TOTAL LP</div>
                      <div style={{ color: '#FF1493', fontWeight: 700 }}>{formatNumber(flexHistory.reduce((sum, r) => sum + (r.lpAmount || 0), 0), 2)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem' }}>REWARDS EARNED</div>
                      <div style={{ color: '#4CAF50', fontWeight: 700 }}>+${formatNumber(flexHistory.reduce((sum, r) => sum + (r.rewardsUsd || 0), 0), 2)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#888', fontSize: '0.65rem' }}>NET P&L</div>
                      <div style={{ 
                        color: flexHistory.reduce((sum, r) => sum + (r.profitLoss || 0), 0) >= 0 ? '#4CAF50' : '#FF6B6B', 
                        fontWeight: 700 
                      }}>
                        {flexHistory.reduce((sum, r) => sum + (r.profitLoss || 0), 0) >= 0 ? '+' : ''}
                        ${formatNumber(flexHistory.reduce((sum, r) => sum + (r.profitLoss || 0), 0), 2)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Flex Records */}
                  {flexHistory.map((record, idx) => (
                    <div key={record.id || idx} style={{
                      background: 'rgba(0,0,0,0.4)',
                      borderRadius: '10px',
                      padding: '14px',
                      marginBottom: idx < flexHistory.length - 1 ? '10px' : 0,
                      border: `1px solid ${record.profitLoss >= 0 ? 'rgba(76,175,80,0.3)' : 'rgba(255,107,107,0.3)'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <div style={{ color: '#FF1493', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            💗 Flex Stake #{idx + 1}
                            <span style={{
                              background: record.profitLoss >= 0 ? '#4CAF50' : '#FF6B6B',
                              color: '#fff',
                              fontSize: '0.5rem',
                              padding: '2px 6px',
                              borderRadius: '6px',
                            }}>{record.profitLoss >= 0 ? 'PROFIT' : 'LOSS'}</span>
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7rem', marginTop: '4px' }}>
                            {record.daysStaked?.toFixed(1) || 0} days • Ended {record.endDate ? new Date(record.endDate).toLocaleDateString() : 'N/A'}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#FFD700', fontWeight: 700 }}>{formatNumber(record.lpAmount || 0, 2)} LP</div>
                          <div style={{ color: '#FF69B4', fontSize: '0.7rem' }}>≈ ${formatNumber(record.lpValueUsd || 0, 2)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: record.profitLoss >= 0 ? '#4CAF50' : '#FF6B6B', fontWeight: 700, fontSize: '1.1rem' }}>
                            {record.profitLoss >= 0 ? '+' : ''}${formatNumber(record.profitLoss || 0, 2)}
                          </div>
                          <div style={{ color: '#81C784', fontSize: '0.65rem' }}>
                            +{formatNumber(record.rewardsLp || 0, 4)} LP rewards
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary Stats */}
              {stakeHistory.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: '12px',
                  marginBottom: '24px',
                  padding: '16px',
                  background: 'rgba(212,175,55,0.1)',
                  borderRadius: '12px',
                  border: '1px solid rgba(212,175,55,0.3)',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>TOTAL STAKED</div>
                    <div style={{ color: '#D4AF37', fontWeight: 700 }}>{formatNumber(stakeHistory.reduce((sum, r) => sum + (r.amount || 0), 0))}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>TOTAL REWARDS</div>
                    <div style={{ color: '#4CAF50', fontWeight: 700 }}>+{formatNumber(stakeHistory.reduce((sum, r) => sum + (r.rewards || 0), 0))}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>PENALTIES</div>
                    <div style={{ color: '#FF6B6B', fontWeight: 700 }}>-{formatNumber(stakeHistory.reduce((sum, r) => sum + (r.penalty || 0), 0))}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>NET P&L</div>
                    <div style={{ color: stakeHistory.reduce((sum, r) => sum + (r.rewards || 0) - (r.penalty || 0), 0) >= 0 ? '#4CAF50' : '#FF6B6B', fontWeight: 700 }}>
                      {stakeHistory.reduce((sum, r) => sum + (r.rewards || 0) - (r.penalty || 0), 0) >= 0 ? '+' : ''}
                      {formatNumber(stakeHistory.reduce((sum, r) => sum + (r.rewards || 0) - (r.penalty || 0), 0))}
                    </div>
                  </div>
                </div>
              )}

              {stakeHistory.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '60px 20px',
                  color: '#666',
                }}>
                  <div style={{ fontSize: '4rem', marginBottom: '16px', opacity: 0.5 }}>🪙</div>
                  <p style={{ fontSize: '1.1rem', color: '#D4AF37' }}>No gold bars yet</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '8px' }}>Complete stakes to mint gold bars in your vault</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {stakeHistory.map((record, idx) => {
                    const netGain = (record.rewards || 0) - (record.penalty || 0);
                    const isProfit = netGain >= 0;
                    const barWidth = Math.min(100, Math.max(20, (record.amount / Math.max(...stakeHistory.map(r => r.amount || 1))) * 100));
                    
                    return (
                      <div key={record.id} style={{
                        background: `linear-gradient(135deg, ${isProfit ? 'rgba(212,175,55,0.2)' : 'rgba(255,107,107,0.15)'} 0%, rgba(0,0,0,0.3) 100%)`,
                        border: `2px solid ${isProfit ? '#D4AF37' : '#FF6B6B'}`,
                        borderRadius: '8px',
                        padding: '0',
                        overflow: 'hidden',
                        position: 'relative',
                      }}>
                        {/* Gold Bar Visual */}
                        <div style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${barWidth}%`,
                          background: isProfit 
                            ? 'linear-gradient(135deg, rgba(212,175,55,0.3) 0%, rgba(184,134,11,0.2) 100%)'
                            : 'linear-gradient(135deg, rgba(255,107,107,0.2) 0%, rgba(200,50,50,0.1) 100%)',
                          borderRight: `2px solid ${isProfit ? 'rgba(212,175,55,0.5)' : 'rgba(255,107,107,0.5)'}`,
                          zIndex: 0,
                        }} />
                        
                        <div style={{ position: 'relative', zIndex: 1, padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                          {/* Left: Bar number and tier */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              background: isProfit ? 'linear-gradient(135deg, #D4AF37, #B8860B)' : 'linear-gradient(135deg, #FF6B6B, #CC4444)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '1rem',
                              color: isProfit ? '#000' : '#fff',
                              boxShadow: isProfit ? '0 4px 12px rgba(212,175,55,0.4)' : '0 4px 12px rgba(255,107,107,0.3)',
                            }}>
                              {record.isLP ? '💎' : '🪙'}
                            </div>
                            <div>
                              <div style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '1rem', color: record.isLP ? '#9C27B0' : '#D4AF37' }}>
                                {record.tier} {record.isLP ? 'LP' : ''}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#888' }}>
                                {formatNumber(record.amount)} {record.isLP ? 'LP' : 'DTGC'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Center: Dates */}
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.7rem', color: '#666' }}>
                              {new Date(record.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} → {new Date(record.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </div>
                            <div style={{ 
                              fontSize: '0.65rem', 
                              marginTop: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: record.exitType === 'emergency' ? 'rgba(255,107,107,0.2)' : 'rgba(76,175,80,0.2)',
                              color: record.exitType === 'emergency' ? '#FF6B6B' : '#4CAF50',
                              display: 'inline-block',
                            }}>
                              {record.exitType === 'emergency' ? '⚠️ Early' : '✅ Complete'}
                            </div>
                          </div>
                          
                          {/* Right: Net P&L */}
                          <div style={{ textAlign: 'right', minWidth: '100px' }}>
                            <div style={{ fontSize: '0.7rem', color: '#888' }}>NET P&L</div>
                            <div style={{ 
                              fontSize: '1.2rem', 
                              fontWeight: 800, 
                              color: isProfit ? '#4CAF50' : '#FF6B6B',
                              textShadow: isProfit ? '0 0 10px rgba(76,175,80,0.3)' : '0 0 10px rgba(255,107,107,0.3)',
                            }}>
                              {isProfit ? '+' : ''}{formatNumber(netGain)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#888' }}>
                              {record.apr?.toFixed(1)}% APR
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {stakeHistory.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Clear all stake history? This cannot be undone.')) {
                      localStorage.removeItem('dtgc-stake-history');
                      setStakeHistory([]);
                      showToast('Stake history cleared', 'success');
                    }
                  }}
                  style={{
                    marginTop: '24px',
                    padding: '10px 20px',
                    background: 'transparent',
                    border: '1px solid rgba(255,107,107,0.3)',
                    borderRadius: '8px',
                    color: '#FF6B6B',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'block',
                    margin: '24px auto 0',
                  }}
                >
                  🗑️ Clear History
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CALCULATOR FAB - BOTTOM RIGHT (Below Treasure Vault) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {!TESTNET_MODE && account && (stakedPositions.length > 0 || lastKnownPositionsRef.current.length > 0) && (
        <button
          onClick={() => setShowStakeCalculator(true)}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 1500,
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)',
            border: '3px solid #81C784',
            color: '#fff',
            fontSize: '1.4rem',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(76,175,80,0.5), 0 0 30px rgba(76,175,80,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(76,175,80,0.6), 0 0 40px rgba(76,175,80,0.4)'; }}
          onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(76,175,80,0.5), 0 0 30px rgba(76,175,80,0.3)'; }}
          title="🧮 Calculate My Stakes Value"
        >
          🧮
        </button>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MY STAKES CALCULATOR MODAL */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showStakeCalculator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(10px)',
        }} onClick={() => setShowStakeCalculator(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #0d1a0d 0%, #0d0d1a 100%)',
            border: '3px solid #4CAF50',
            borderRadius: '24px',
            padding: '32px',
            maxWidth: '700px',
            width: '95%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(76,175,80,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{
                color: '#4CAF50',
                fontFamily: 'Cinzel, serif',
                fontSize: '1.6rem',
                letterSpacing: '2px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textShadow: '0 0 20px rgba(76,175,80,0.5)',
              }}>
                🧮 MY STAKES CALCULATOR
              </h2>
              <button
                onClick={() => setShowStakeCalculator(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(76,175,80,0.3)',
                  color: '#4CAF50',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            {/* Current Stakes Summary */}
            <div style={{
              background: 'rgba(76,175,80,0.1)',
              border: '1px solid rgba(76,175,80,0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '12px' }}>YOUR CURRENT POSITIONS ({stakedPositions.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {stakedPositions.map((pos, idx) => (
                  <div key={pos.id} style={{
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    border: `1px solid ${pos.isLP ? '#9C27B0' : '#D4AF37'}`,
                  }}>
                    <div style={{ color: pos.isLP ? '#9C27B0' : '#D4AF37', fontWeight: 700, fontSize: '0.85rem' }}>
                      {pos.tierName || pos.tier} {pos.isLP ? 'LP' : ''}
                    </div>
                    <div style={{ color: '#fff', fontSize: '0.9rem' }}>{formatNumber(pos.amount)} {pos.isLP ? 'LP' : 'DTGC'}</div>
                    <div style={{ color: '#4CAF50', fontSize: '0.7rem' }}>{pos.apr?.toFixed(1)}% APR</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forecast Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ color: '#4CAF50', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
                  📈 Future DTGC Price ($)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={calcFuturePrice}
                  onChange={(e) => setCalcFuturePrice(e.target.value)}
                  placeholder={livePrices.dtgc?.toFixed(6) || '0.000001'}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '2px solid #4CAF50',
                    borderRadius: '8px',
                    color: '#4CAF50',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                  Current: ${livePrices.dtgc?.toFixed(8) || '0.00000001'}
                </div>
              </div>
              <div>
                <label style={{ color: '#888', fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
                  📅 Months from Now
                </label>
                <select
                  value={calcFutureMonths}
                  onChange={(e) => setCalcFutureMonths(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="1">1 Month</option>
                  <option value="3">3 Months</option>
                  <option value="6">6 Months</option>
                  <option value="12">12 Months</option>
                  <option value="24">24 Months</option>
                </select>
              </div>
            </div>

            {/* Calculation Results */}
            {(() => {
              const futurePrice = parseFloat(calcFuturePrice) || livePrices.dtgc || 0.00000001;
              const months = parseInt(calcFutureMonths) || 6;
              const currentPrice = livePrices.dtgc || 0.00000001;
              
              let totalCurrentValue = 0;
              let totalFutureValue = 0;
              let totalRewards = 0;
              
              const stakeResults = stakedPositions.map(pos => {
                const amount = pos.amount || 0;
                const apr = pos.apr || 16.8;
                const isLP = pos.isLP;
                
                // Current value (LP tokens = 2x DTGC value approx)
                const currentVal = isLP ? amount * currentPrice * 2 : amount * currentPrice;
                
                // Rewards earned over the period
                const rewardsEarned = amount * (apr / 100) * (months / 12);
                
                // Future value at new price (principal + rewards)
                const futureVal = isLP 
                  ? (amount * futurePrice * 2) + (rewardsEarned * futurePrice)
                  : ((amount + rewardsEarned) * futurePrice);
                
                totalCurrentValue += currentVal;
                totalFutureValue += futureVal;
                totalRewards += rewardsEarned;
                
                return { ...pos, currentVal, futureVal, rewardsEarned };
              });
              
              const valueChange = totalFutureValue - totalCurrentValue;
              const percentChange = totalCurrentValue > 0 ? (valueChange / totalCurrentValue) * 100 : 0;
              const priceChangePercent = currentPrice > 0 ? ((futurePrice - currentPrice) / currentPrice) * 100 : 0;
              
              return (
                <>
                  {/* Price Change Indicator */}
                  <div style={{
                    textAlign: 'center',
                    padding: '12px',
                    background: priceChangePercent >= 0 ? 'rgba(76,175,80,0.1)' : 'rgba(244,67,54,0.1)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}>
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>Price Change: </span>
                    <span style={{ color: priceChangePercent >= 0 ? '#4CAF50' : '#F44336', fontWeight: 700, fontSize: '1.1rem' }}>
                      {priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(1)}%
                    </span>
                    <span style={{ color: '#888', fontSize: '0.8rem', marginLeft: '8px' }}>
                      (${currentPrice.toFixed(8)} → ${futurePrice.toFixed(8)})
                    </span>
                  </div>

                  {/* Results Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px',
                  }}>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>CURRENT VALUE</div>
                      <div style={{ color: '#D4AF37', fontSize: '1.3rem', fontWeight: 700 }}>${totalCurrentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                      <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>REWARDS ({months}mo)</div>
                      <div style={{ color: '#4CAF50', fontSize: '1.3rem', fontWeight: 700 }}>+{formatNumber(totalRewards)}</div>
                      <div style={{ color: '#888', fontSize: '0.65rem' }}>DTGC</div>
                    </div>
                    <div style={{ background: valueChange >= 0 ? 'rgba(76,175,80,0.2)' : 'rgba(244,67,54,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center', border: `2px solid ${valueChange >= 0 ? '#4CAF50' : '#F44336'}` }}>
                      <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '4px' }}>FUTURE VALUE</div>
                      <div style={{ color: valueChange >= 0 ? '#4CAF50' : '#F44336', fontSize: '1.5rem', fontWeight: 800 }}>${totalFutureValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                      <div style={{ color: valueChange >= 0 ? '#4CAF50' : '#F44336', fontSize: '0.8rem' }}>
                        {valueChange >= 0 ? '+' : ''}${valueChange.toLocaleString(undefined, { maximumFractionDigits: 2 })} ({percentChange >= 0 ? '+' : ''}{percentChange.toFixed(1)}%)
                      </div>
                    </div>
                  </div>

                  {/* Per-Stake Breakdown */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                    <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '12px' }}>Per-Position Breakdown:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {stakeResults.map((r, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                        }}>
                          <div>
                            <span style={{ color: r.isLP ? '#9C27B0' : '#D4AF37', fontWeight: 600 }}>
                              {r.tierName || r.tier} {r.isLP ? 'LP' : ''}
                            </span>
                            <span style={{ color: '#888', marginLeft: '8px' }}>
                              {formatNumber(r.amount)} {r.isLP ? 'LP' : 'DTGC'}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ color: '#888' }}>${r.currentVal.toFixed(2)} → </span>
                            <span style={{ color: r.futureVal >= r.currentVal ? '#4CAF50' : '#F44336', fontWeight: 700 }}>
                              ${r.futureVal.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Price Scenarios */}
                  <div style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => setCalcFuturePrice((currentPrice * 0.5).toFixed(8))} style={{ padding: '6px 12px', background: 'rgba(244,67,54,0.2)', border: '1px solid #F44336', borderRadius: '16px', color: '#F44336', cursor: 'pointer', fontSize: '0.75rem' }}>-50%</button>
                    <button onClick={() => setCalcFuturePrice((currentPrice * 2).toFixed(8))} style={{ padding: '6px 12px', background: 'rgba(76,175,80,0.2)', border: '1px solid #4CAF50', borderRadius: '16px', color: '#4CAF50', cursor: 'pointer', fontSize: '0.75rem' }}>2x</button>
                    <button onClick={() => setCalcFuturePrice((currentPrice * 5).toFixed(8))} style={{ padding: '6px 12px', background: 'rgba(76,175,80,0.2)', border: '1px solid #4CAF50', borderRadius: '16px', color: '#4CAF50', cursor: 'pointer', fontSize: '0.75rem' }}>5x</button>
                    <button onClick={() => setCalcFuturePrice((currentPrice * 10).toFixed(8))} style={{ padding: '6px 12px', background: 'rgba(33,150,243,0.2)', border: '1px solid #2196F3', borderRadius: '16px', color: '#2196F3', cursor: 'pointer', fontSize: '0.75rem' }}>10x</button>
                    <button onClick={() => setCalcFuturePrice((currentPrice * 100).toFixed(8))} style={{ padding: '6px 12px', background: 'rgba(156,39,176,0.2)', border: '1px solid #9C27B0', borderRadius: '16px', color: '#9C27B0', cursor: 'pointer', fontSize: '0.75rem' }}>100x 🚀</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Stake Modal */}
      <StakeModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        type={modalType}
        amount={stakeAmount}
        tier={isLP ? 'Diamond' : V5_STAKING_TIERS[selectedTier]?.name}
      />

      {/* Wallet Selector Modal */}
      {showWalletModal && (
        <div className="wallet-modal-overlay" onClick={() => setShowWalletModal(false)}>
          <div className="wallet-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="wallet-modal-title">
              {walletStep === 'accounts' ? 'Select Account' : 'Select Wallet'}
            </h2>

            {/* Account Selector Step */}
            {walletStep === 'accounts' && availableAccounts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', marginBottom: '8px' }}>
                  Choose which address to connect:
                </p>
                {availableAccounts.map((addr, index) => (
                  <button
                    key={addr}
                    onClick={() => selectAccount(addr)}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '16px 20px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = 'rgba(212,175,55,0.2)';
                      e.target.style.borderColor = '#D4AF37';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'rgba(255,255,255,0.05)';
                      e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                    }}
                  >
                    <span style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: `linear-gradient(135deg, hsl(${index * 60}, 70%, 50%), hsl(${index * 60 + 30}, 70%, 40%))`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}>
                      {index + 1}
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                      {addr.slice(0, 8)}...{addr.slice(-6)}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    setWalletStep('select');
                    setAvailableAccounts([]);
                  }}
                  style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  ← Back to Wallets
                </button>
              </div>
            )}

            {/* Wallet Selector Step */}
            {walletStep === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* MOBILE DEEP LINKS - Show first on mobile */}
              {needsDeepLink && (
                <>
                  <div style={{ 
                    background: 'rgba(76,175,80,0.1)', 
                    border: '1px solid rgba(76,175,80,0.3)', 
                    borderRadius: '12px', 
                    padding: '12px', 
                    marginBottom: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: '#4CAF50', fontWeight: 600, marginBottom: '4px' }}>
                      📱 Mobile Detected
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>
                      Tap your wallet below to open this site in its dApp browser
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                    <button
                      onClick={() => openInWalletBrowser('metamask')}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        padding: '14px 10px', background: 'rgba(245,133,50,0.15)',
                        border: '2px solid #F5851A', borderRadius: '12px',
                        color: '#F5851A', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      🦊 MetaMask
                    </button>
                    <button
                      onClick={() => openInWalletBrowser('coinbase')}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        padding: '14px 10px', background: 'rgba(0,82,255,0.15)',
                        border: '2px solid #0052FF', borderRadius: '12px',
                        color: '#0052FF', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      🔵 Coinbase
                    </button>
                    <button
                      onClick={() => openInWalletBrowser('okx')}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        padding: '14px 10px', background: 'rgba(255,255,255,0.1)',
                        border: '2px solid #fff', borderRadius: '12px',
                        color: '#fff', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      ⬜ OKX
                    </button>
                    <button
                      onClick={() => openInWalletBrowser('trust')}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        padding: '14px 10px', background: 'rgba(51,117,187,0.15)',
                        border: '2px solid #3375BB', borderRadius: '12px',
                        color: '#3375BB', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      🛡️ Trust
                    </button>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', margin: '12px 0 4px',
                    color: '#555', fontSize: '0.75rem',
                  }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span>already in dApp browser?</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  </div>
                </>
              )}
              
              {/* QUICK CONNECT - Primary CTA */}
              <button
                onClick={connectAnyWallet}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: needsDeepLink ? '14px 18px' : '20px 24px',
                  background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
                  border: '2px solid #FFD700',
                  borderRadius: '14px',
                  color: '#000',
                  fontSize: needsDeepLink ? '0.95rem' : '1.1rem',
                  cursor: loading ? 'wait' : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 6px 20px rgba(212,175,55,0.4)',
                  fontWeight: 700,
                }}
              >
                <span style={{ fontSize: needsDeepLink ? '1.3rem' : '1.8rem' }}>⚡</span>
                <div style={{ textAlign: 'left', flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: needsDeepLink ? '0.95rem' : '1.1rem' }}>Quick Connect</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.8, fontWeight: 500 }}>
                    {needsDeepLink ? 'If already in wallet browser' : 'Auto-detect your browser wallet'}
                  </div>
                </div>
                {!needsDeepLink && <span style={{ fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '8px' }}>RECOMMENDED</span>}
              </button>

              {!needsDeepLink && (
                <>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    margin: '8px 0',
                    color: '#666',
                    fontSize: '0.8rem',
                  }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    <span>or choose specific wallet</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                  </div>

                  {/* WalletConnect - Mobile Option */}
                  <button
                    onClick={connectWalletConnect}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '14px 18px',
                      background: 'linear-gradient(135deg, #3B99FC, #2D7DD2)',
                      border: '1px solid #3B99FC',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.3rem' }}>🔗</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600 }}>WalletConnect</div>
                      <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>Scan QR with mobile wallet</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: '0.65rem', background: 'rgba(255,255,255,0.2)', padding: '3px 6px', borderRadius: '4px' }}>📱</span>
                  </button>
                </>
              )}

              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                margin: '4px 0',
                color: '#555',
                fontSize: '0.75rem',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
                <span>browser extensions</span>
                <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              </div>

              <button
                onClick={() => connectWalletType('internetmoney')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 18px',
                  background: 'rgba(212,175,55,0.1)',
                  border: '1px solid rgba(212,175,55,0.5)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.25)';
                  e.target.style.borderColor = '#D4AF37';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.1)';
                  e.target.style.borderColor = 'rgba(212,175,55,0.5)';
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>💰</span>
                <span style={{ fontWeight: 600 }}>Internet Money</span>
              </button>

              <button
                onClick={() => connectWalletType('metamask')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(76,175,80,0.15)',
                  border: '2px solid #4CAF50',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(76,175,80,0.3)';
                  e.target.style.borderColor = '#66BB6A';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(76,175,80,0.15)';
                  e.target.style.borderColor = '#4CAF50';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🦊</span>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
                  <span style={{ fontWeight: 600 }}>MetaMask</span>
                  <span style={{ fontSize: '0.7rem', color: '#4CAF50', fontWeight: 500 }}>✓ Recommended for Diamond LP Stakes</span>
                </div>
              </button>

              <button
                onClick={() => connectWalletType('rabby')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.2)';
                  e.target.style.borderColor = '#D4AF37';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🐰</span>
                <span style={{ fontWeight: 600 }}>Rabby Wallet</span>
              </button>

              <button
                onClick={() => connectWalletType('okx')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.2)';
                  e.target.style.borderColor = '#D4AF37';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>⚫</span>
                <span style={{ fontWeight: 600 }}>OKX Wallet</span>
              </button>

              <button
                onClick={() => connectWalletType('coinbase')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.2)';
                  e.target.style.borderColor = '#D4AF37';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🔵</span>
                <span style={{ fontWeight: 600 }}>Coinbase Wallet</span>
              </button>

              <button
                onClick={() => connectWalletType('generic')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.2)';
                  e.target.style.borderColor = '#D4AF37';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255,255,255,0.05)';
                  e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>🔗</span>
                <span style={{ fontWeight: 600 }}>Other Wallet</span>
              </button>

              {/* Mobile Wallet Section */}
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(212,175,55,0.3)',
              }}>
                <p style={{
                  color: '#D4AF37',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  marginBottom: '12px',
                }}>
                  📱 On Mobile? Open in Wallet Browser
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={() => openInWalletBrowser('metamask')}
                    style={{
                      flex: '1',
                      minWidth: '100px',
                      padding: '12px 12px',
                      background: 'linear-gradient(135deg, #E27625, #CD6116)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    🦊 MetaMask
                  </button>
                  <button
                    onClick={() => openInWalletBrowser('trust')}
                    style={{
                      flex: '1',
                      minWidth: '100px',
                      padding: '12px 12px',
                      background: 'linear-gradient(135deg, #3375BB, #0500FF)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    🛡️ Trust
                  </button>
                  <button
                    onClick={() => openInWalletBrowser('coinbase')}
                    style={{
                      flex: '1',
                      minWidth: '100px',
                      padding: '12px 12px',
                      background: 'linear-gradient(135deg, #0052FF, #0033CC)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    🔵 Coinbase
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button
                    onClick={() => openInWalletBrowser('okx')}
                    style={{
                      flex: '1',
                      minWidth: '100px',
                      padding: '12px 12px',
                      background: 'linear-gradient(135deg, #121212, #333)',
                      border: '1px solid #666',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    ⬛ OKX
                  </button>
                  <button
                    onClick={() => openInWalletBrowser('rainbow')}
                    style={{
                      flex: '1',
                      minWidth: '100px',
                      padding: '12px 12px',
                      background: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    🌈 Rainbow
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      showToast('URL copied! Paste in your wallet browser', 'success');
                    }}
                    style={{
                      flex: '1',
                      minWidth: '100px',
                      padding: '12px 12px',
                      background: 'rgba(212,175,55,0.2)',
                      border: '1px solid #D4AF37',
                      borderRadius: '10px',
                      color: '#D4AF37',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    📋 Copy URL
                  </button>
                </div>
                <p style={{
                  color: '#666',
                  fontSize: '0.7rem',
                  textAlign: 'center',
                  marginTop: '12px',
                  lineHeight: 1.4,
                }}>
                  Tap a button to open this dApp in your wallet's browser
                </p>
              </div>
            </div>
            )}

            {walletStep === 'select' && (
            <button
              onClick={() => setShowWalletModal(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#888',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Cancel
            </button>
            )}
          </div>
        </div>
      )}

      {/* Security & Audit Modal */}
      {showSecurityModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(8px)',
        }} onClick={() => setShowSecurityModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
            border: '2px solid #4CAF50',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '520px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(76,175,80,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              color: '#4CAF50',
              fontFamily: 'Cinzel, serif',
              fontSize: '1.5rem',
              textAlign: 'center',
              marginBottom: '24px',
              letterSpacing: '2px',
            }}>
              🛡️ Security & Audit
            </h2>

            {/* Security Features */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#D4AF37', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '8px' }}>
                Security Features
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px' }}>
                  <span style={{ color: '#4CAF50' }}>✓</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>Non-custodial staking - You control your keys</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px' }}>
                  <span style={{ color: '#4CAF50' }}>✓</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>Smart contract on PulseChain (EVM compatible)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px' }}>
                  <span style={{ color: '#4CAF50' }}>✓</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>Time-locked positions with transparent unlock</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px' }}>
                  <span style={{ color: '#4CAF50' }}>✓</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>Emergency withdraw function available</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px' }}>
                  <span style={{ color: '#4CAF50' }}>✓</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>DAO Treasury governance controls</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px' }}>
                  <span style={{ color: '#4CAF50' }}>✓</span>
                  <span style={{ color: '#fff', fontSize: '0.85rem' }}>Dynamic APR scaling for sustainability</span>
                </div>
              </div>
            </div>

            {/* Contract Addresses */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#D4AF37', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '8px' }}>
                Verified Contracts
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'rgba(212,175,55,0.05)', borderRadius: '6px' }}>
                  <div><span style={{ color: '#D4AF37' }}>DTGC Token:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>0xd0676B28a457371d58d47e5247b439114e40eb0f</span></div>
                  <button onClick={() => { navigator.clipboard.writeText('0xd0676B28a457371d58d47e5247b439114e40eb0f'); showToast('DTGC Token address copied!', 'success'); }} style={{ background: 'rgba(212,175,55,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: '#D4AF37', fontSize: '0.7rem' }}>📋 Copy</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'rgba(76,175,80,0.05)', borderRadius: '6px' }}>
                  <div><span style={{ color: '#4CAF50' }}>Staking V4:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>0xEbC6802e6a2054FbF2Cb450aEc5E2916965b1718</span></div>
                  <button onClick={() => { navigator.clipboard.writeText('0xEbC6802e6a2054FbF2Cb450aEc5E2916965b1718'); showToast('Staking V4 address copied!', 'success'); }} style={{ background: 'rgba(76,175,80,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: '#4CAF50', fontSize: '0.7rem' }}>📋 Copy</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'rgba(0,188,212,0.05)', borderRadius: '6px' }}>
                  <div><span style={{ color: '#00BCD4' }}>LP Staking V4:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231</span></div>
                  <button onClick={() => { navigator.clipboard.writeText('0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231'); showToast('LP Staking V4 address copied!', 'success'); }} style={{ background: 'rgba(0,188,212,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: '#00BCD4', fontSize: '0.7rem' }}>📋 Copy</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', background: 'rgba(156,39,176,0.05)', borderRadius: '6px' }}>
                  <div><span style={{ color: '#9C27B0' }}>DAO Voting:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>0x2228f8E52E14A87C9c2228c86F9DD25f3c07bFC</span></div>
                  <button onClick={() => { navigator.clipboard.writeText('0x2228f8E52E14A87C9c2228c86F9DD25f3c07bFC'); showToast('DAO Voting address copied!', 'success'); }} style={{ background: 'rgba(156,39,176,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', color: '#9C27B0', fontSize: '0.7rem' }}>📋 Copy</button>
                </div>
              </div>
            </div>

            {/* Audit Status */}
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ color: '#D4AF37', fontSize: '1rem', marginBottom: '12px', borderBottom: '1px solid rgba(212,175,55,0.3)', paddingBottom: '8px' }}>
                Audit Status
              </h3>
              <div style={{
                padding: '16px',
                background: 'rgba(255,152,0,0.1)',
                border: '1px solid rgba(255,152,0,0.3)',
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>🔍</div>
                <div style={{ color: '#FF9800', fontWeight: 600, marginBottom: '4px' }}>Audit In Progress</div>
                <div style={{ color: '#888', fontSize: '0.8rem' }}>
                  Smart contract audit pending. Results will be published here upon completion.
                </div>
              </div>
            </div>

            {/* Risk Disclaimer */}
            <div style={{
              padding: '12px',
              background: 'rgba(244,67,54,0.1)',
              border: '1px solid rgba(244,67,54,0.3)',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <div style={{ color: '#F44336', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                ⚠️ Risk Disclaimer
              </div>
              <div style={{ color: '#888', fontSize: '0.7rem', lineHeight: 1.4 }}>
                DeFi protocols carry inherent risks including smart contract vulnerabilities, market volatility, and impermanent loss for LP positions. Only stake what you can afford to lose. DYOR.
              </div>
            </div>

            <button
              onClick={() => setShowSecurityModal(false)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✕ '}
          {toast.type === 'info' && 'ℹ '}
          {toast.message}
        </div>
      )}
    </ThemeContext.Provider>
  );
}
