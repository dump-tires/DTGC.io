import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { ethers } from 'ethers';
import {
  CONTRACTS,
  TOKENS,
  STAKING_TIERS,
  DIAMOND_TIER,
  STAKING_V3_ABI,
  LP_STAKING_V3_ABI,
  DAO_VOTING_V3_ABI,
  ERC20_ABI,
  CHAIN_ID,
  EXPLORER,
  FEES,
  VOTING_OPTIONS,
  BURN_ADDRESS,
} from './config/constants';

/*
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║     🏆 DTGC PREMIUM STAKING PLATFORM V19 - MAINNET 🏆        ║
    ║                                                               ║
    ║     ✦ V19 Gold Paper Tokenomics (91% Controlled!)            ║
    ║     ✦ V3 Contracts Deployed & Live                           ║
    ║     ✦ Diamond (DTGC/PLS) + Diamond+ (DTGC/URMOM) LP Tiers    ║
    ║     ✦ 7.5% Total Fees • Sustainable APRs                     ║
    ║     ✦ Live Prices from DexScreener                           ║
    ║                                                               ║
    ║                    dtgc.io                                    ║
    ╚═══════════════════════════════════════════════════════════════╝
*/

// ═══════════════════════════════════════════════════════════════
//                    DTGC TOKENOMICS (1 BILLION SUPPLY)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//                    V5 GOLD PAPER TOKENOMICS (91% CONTROLLED)
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
    minInvest: 200,
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
    minInvest: 500,
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
    minInvest: 10000,
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
  minInvest: 1000,
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
  icon: '💎✨',
  minInvest: 1000,
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

const DTGC_TOKEN_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';

// PulseChain Explorer API (Blockscout-compatible)
const PULSECHAIN_API = {
  // Primary: scan.pulsechain.com API
  holders: `https://scan.pulsechain.com/api/v2/tokens/${DTGC_TOKEN_ADDRESS}/holders`,
  // Alternative: direct RPC for balance checks
  rpc: 'https://rpc.pulsechain.com',
};

// Wallets to EXCLUDE from ticker (DAO, Dev, LP, Burn addresses)
const EXCLUDED_WALLETS = [
  '0x22289ce7d7B962e804E9C8C6C57D2eD4Ffe0AbFC', // DAO Treasury
  '0x777d7f3ad24832975aec259ab7d7b57be4225abf', // Dev Wallet
  '0x0000000000000000000000000000000000000369', // Burn address
  '0x000000000000000000000000000000000000dEaD', // Dead address
  '0x0000000000000000000000000000000000000000', // Zero address
  '0x1891bD6A959B32977c438f3022678a8659364A72', // LP Pool DTGC/URMOM
  '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7', // LP Pool DTGC/PLS
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
  xDumpTires: 'https://x.com/Dump_Tires',
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
  stakingV3: '0x0ba3d882f21b935412608d181501d59e99a8D0f9',    // NEW V3
  lpStakingV3: '0x7C328FFF32AD66a03218D8A953435283782Bc84F',  // NEW V3
  daoVotingV3: '0x4828A40bEd10c373718cA10B53A34208636CD8C4',  // NEW V3
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
const PASSWORD_ENABLED = true;

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
    
    --bg-primary: ${isDark ? '#0D0D0D' : '#FEFEFE'};
    --bg-secondary: ${isDark ? '#1A1A1A' : '#F5F5F5'};
    --bg-card: ${isDark ? '#1E1E1E' : '#FFFFFF'};
    --text-primary: ${isDark ? '#FFFFFF' : '#1A1A1A'};
    --text-secondary: ${isDark ? '#B0B0B0' : '#4A4A4A'};
    --text-muted: ${isDark ? '#707070' : '#7A7A7A'};
    --border-color: ${isDark ? '#333333' : '#E8E8E8'};
    
    --glow-gold: 0 0 40px rgba(212, 175, 55, ${isDark ? '0.5' : '0.3'});
    --glow-diamond: 0 0 40px rgba(0, 188, 212, ${isDark ? '0.5' : '0.3'});
    --shadow-luxury: 0 25px 50px -12px rgba(0, 0, 0, ${isDark ? '0.4' : '0.15'});
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
        radial-gradient(ellipse at 20% 30%, rgba(212, 175, 55, 0.06) 0%, transparent 40%),
        radial-gradient(ellipse at 80% 70%, rgba(212, 175, 55, 0.04) 0%, transparent 40%),
        radial-gradient(ellipse at 50% 50%, rgba(200, 200, 200, 0.3) 0%, transparent 60%)
      `};
  }

  .marble-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 1000 1000' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    opacity: ${isDark ? '0.03' : '0.04'};
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
    background: linear-gradient(90deg, transparent 0%, ${isDark ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 180, 180, 0.15)'} 50%, transparent 100%);
    transform-origin: center;
  }

  .vein-1 { top: 10%; left: -10%; width: 60%; height: 1px; transform: rotate(25deg); }
  .vein-2 { top: 30%; right: -10%; width: 50%; height: 1px; transform: rotate(-15deg); }
  .vein-3 { top: 50%; left: -5%; width: 40%; height: 1px; transform: rotate(35deg); }
  .vein-4 { top: 70%; right: -5%; width: 55%; height: 1px; transform: rotate(-25deg); }
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

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.05); }
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
    animation: ticker-scroll 30s linear infinite;
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
    animation: float 3s ease-in-out infinite;
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

  @media (max-width: 1200px) { .tiers-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 768px) { 
    .tiers-grid { grid-template-columns: 1fr; }
    .hero-title { font-size: 2.2rem; }
    .nav-content { flex-direction: column; gap: 14px; }
    .nav-links { display: none; }
    .main-content { padding: 0 20px 50px; }
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
      background: 'rgba(0,0,0,0.92)',
      zIndex: 99998,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'backdrop-in 0.3s ease',
    }} onClick={onComplete}>
      <div style={{
        position: 'relative',
        maxWidth: '600px',
        width: '90%',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '2px solid var(--diamond)',
        boxShadow: 'var(--glow-diamond)',
      }}>
        <video autoPlay playsInline style={{ width: '100%', display: 'block' }}>
          <source src={VIDEOS.stake} type="video/quicktime" />
          <source src={VIDEOS.stake.replace('.mov', '.mp4')} type="video/mp4" />
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
          <h3 style={{ fontFamily: 'Cinzel, serif', color: '#4CAF50', fontSize: '1.3rem', marginBottom: '6px', letterSpacing: '3px' }}>
            🎉 STAKING {tierName}!
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>Diamond hands activated 💎</p>
        </div>
      </div>
    </div>
  );
};

// Floating DexScreener Widget (bottom-left corner) - Miniature & Expandable
const DexScreenerWidget = () => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
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
          bottom: '20px',
          left: '20px',
          width: '50px',
          height: '50px',
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
        <span style={{ fontSize: '1.5rem' }}>📊</span>
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
      return localStorage.getItem('dtgc-theme') === 'dark';
    }
    return false;
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
        document.body.offsetHeight; // Trigger reflow
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
  const [activeTab, setActiveTab] = useState('stake');
  const [scrolled, setScrolled] = useState(false);

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

  // Analytics Calculator State
  const [calcInvestment, setCalcInvestment] = useState('1000');
  const [calcTier, setCalcTier] = useState('gold');
  const [calcBuyPrice, setCalcBuyPrice] = useState('0.0002');
  const [calcExitPrice, setCalcExitPrice] = useState('0.0003');
  const [calcTimeframe, setCalcTimeframe] = useState('12'); // months
  const [calcPriceDrop, setCalcPriceDrop] = useState('50'); // VaR price drop %

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
  };

  // Metal prices state (per troy ounce in USD)
  const [metalPrices, setMetalPrices] = useState({
    gold: 2650.00,
    silver: 31.50,
    copper: 4.25,
    loading: false,
    lastUpdated: null,
  });

  const [position, setPosition] = useState(null);
  const [lpPosition, setLpPosition] = useState(null);
  const [stakedPositions, setStakedPositions] = useState([]);
  const [contractStats, setContractStats] = useState({ totalStaked: '0', stakers: '0' });

  // Live holder wallets for ticker (fetched from PulseChain API)
  const [liveHolders, setLiveHolders] = useState({
    holders: HOLDER_WALLETS,
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
  const [modalType, setModalType] = useState('start');

  // DTGC Burn tracking state (live from blockchain)
  const [dtgcBurnData, setDtgcBurnData] = useState({
    burned: 0,
    lastUpdated: null,
    loading: true,
    recentBurns: [], // Array of recent burn events
  });

  // Live prices state (fetched from DexScreener)
  const [livePrices, setLivePrices] = useState({
    urmom: BURN_STATS.urmomPrice,
    dtgc: BURN_STATS.dtgcPrice,
    dtgcMarketCap: 0,
    lastUpdated: null,
    loading: true,
    error: null,
  });

  // DTGC Supply Dynamics state
  const [supplyDynamics, setSupplyDynamics] = useState({
    dao: SUPPLY_WALLETS.dao.expected,
    dev: SUPPLY_WALLETS.dev.expected,
    lpLocked: SUPPLY_WALLETS.lpLocked.expected,
    burned: 0,
    staked: 0,
    circulating: SUPPLY_WALLETS.circulating.expected,
    lastUpdated: null,
  });

  // Toast notification helper - defined early so all callbacks can use it
  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch live supply dynamics (wallet balances) from PulseChain API
  const fetchSupplyDynamics = useCallback(async () => {
    try {
      // Fetch DAO Treasury balance
      const daoRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${SUPPLY_WALLETS.dao.address}/token-balances`);
      const daoData = await daoRes.json();
      const daoBalance = daoData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
      const daoDtgc = daoBalance ? parseFloat(daoBalance.value) / 1e18 : 0;

      // Fetch Dev Wallet balance
      const devRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${SUPPLY_WALLETS.dev.address}/token-balances`);
      const devData = await devRes.json();
      const devBalance = devData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
      const devDtgc = devBalance ? parseFloat(devBalance.value) / 1e18 : SUPPLY_WALLETS.dev.expected;

      // Fetch Burn address balance
      const burnRes = await fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${SUPPLY_WALLETS.burn.address}/token-balances`);
      const burnData = await burnRes.json();
      const burnBalance = burnData?.find?.(t => t.token?.address?.toLowerCase() === DTGC_TOKEN_ADDRESS.toLowerCase());
      const burnedDtgc = burnBalance ? parseFloat(burnBalance.value) / 1e18 : 0;

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
        lastUpdated: new Date(),
      });

      console.log('📊 Supply dynamics updated:', { dao: daoDtgc, dev: devDtgc, burned: burnedDtgc });
    } catch (err) {
      console.warn('⚠️ Failed to fetch supply dynamics:', err.message);
    }
  }, []);

  // Fetch supply dynamics on mount and every 5 minutes
  useEffect(() => {
    fetchSupplyDynamics();
    const interval = setInterval(fetchSupplyDynamics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSupplyDynamics]);

  // Fetch live holder data from PulseChain Explorer API
  const fetchLiveHolders = useCallback(async () => {
    try {
      const response = await fetch(PULSECHAIN_API.holders);
      
      if (!response.ok) {
        throw new Error('API request failed');
      }
      
      const data = await response.json();
      
      // Process holders - filter out excluded wallets (DAO, Dev, LP, Burn)
      const holders = (data.items || [])
        .filter(item => !EXCLUDED_WALLETS.includes(item.address?.hash?.toLowerCase()))
        .slice(0, 30) // Top 30 holders (~30% of active holders)
        .map((item, index) => ({
          address: `${item.address?.hash?.slice(0, 6)}...${item.address?.hash?.slice(-4)}`,
          fullAddress: item.address?.hash,
          balance: parseFloat(item.value) / 1e18, // Convert from wei
          label: index < 3 ? `🐋 Whale ${index + 1}` : 
                 index < 8 ? `💎 Diamond ${index - 2}` : 
                 index < 15 ? `🥇 Gold ${index - 7}` :
                 `🥈 Holder ${index - 14}`,
        }));

      if (holders.length > 0) {
        setLiveHolders({
          holders,
          loading: false,
          lastUpdated: new Date(),
          error: null,
        });
        console.log('📊 Live holders updated:', holders.length, 'wallets');
      } else {
        throw new Error('No holder data received');
      }
    } catch (err) {
      console.warn('⚠️ Holder API error, using fallback:', err.message);
      setLiveHolders(prev => ({
        ...prev,
        holders: prev.holders.length > 0 ? prev.holders : HOLDER_WALLETS,
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
      
      setLivePrices({
        urmom: urmomPrice,
        dtgc: dtgcPrice,
        dtgcMarketCap: dtgcMarketCap,
        lastUpdated: new Date(),
        loading: false,
        error: null,
      });
      
      console.log('📊 Live prices updated:', { urmom: urmomPrice, dtgc: dtgcPrice, marketCap: dtgcMarketCap });
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
      const cgRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd');
      const cgData = await cgRes.json();

      // Fetch PLS from DexScreener (PLS/DAI pair)
      const plsRes = await fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x6753560538eca67617a9ce605b2a2c5b3494b666');
      const plsData = await plsRes.json();
      const plsPair = plsData?.pair || plsData?.pairs?.[0];

      // Fetch PLSX from DexScreener
      const plsxRes = await fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9');
      const plsxData = await plsxRes.json();
      const plsxPair = plsxData?.pair || plsxData?.pairs?.[0];

      setCryptoPrices({
        btc: cgData?.bitcoin?.usd || 42000,
        eth: cgData?.ethereum?.usd || 2200,
        pls: parseFloat(plsPair?.priceUsd) || 0.00003,
        plsx: parseFloat(plsxPair?.priceUsd) || 0.00002,
        loading: false,
        lastUpdated: new Date(),
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
      
      setLivePrices({
        urmom: urmomPrice,
        dtgc: dtgcPrice,
        lastUpdated: new Date(),
        loading: false,
        error: null,
      });
      
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
        CONTRACTS.DTGC,
        ['function balanceOf(address) view returns (uint256)'],
        rpcProvider
      );

      // Fetch balance of burn address (0x...369)
      const burnBalance = await dtgcContract.balanceOf(BURN_ADDRESS);
      const burnedAmount = parseFloat(ethers.formatEther(burnBalance));

      // Update state
      setDtgcBurnData(prev => ({
        ...prev,
        burned: burnedAmount,
        lastUpdated: new Date(),
        loading: false,
      }));

      console.log(`🔥 DTGC Burned: ${formatNumber(burnedAmount)}`);
    } catch (err) {
      console.error('Failed to fetch DTGC burns:', err);
      setDtgcBurnData(prev => ({ ...prev, loading: false }));
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
      const tierName = pos.tier?.toUpperCase() || (pos.isLP ? 'DIAMOND' : 'GOLD');
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
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== CHAIN_ID) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x171' }],
        });
      }

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setShowWalletModal(false);
      showToast('Wallet connected', 'success');
    } catch (err) {
      console.error(err);
      showToast('Connection failed', 'error');
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

    try {
      setLoading(true);
      let provider;

      switch (walletType) {
        case 'internetmoney':
          if (!window.ethereum) {
            window.open('https://internetmoney.io/', '_blank');
            showToast('Please install Internet Money Wallet', 'info');
            setLoading(false);
            return;
          }
          provider = new ethers.BrowserProvider(window.ethereum);
          break;

        case 'metamask':
          if (!window.ethereum?.isMetaMask) {
            window.open('https://metamask.io/download/', '_blank');
            showToast('Please install MetaMask', 'info');
            setLoading(false);
            return;
          }
          provider = new ethers.BrowserProvider(window.ethereum);
          break;

        case 'rabby':
          if (!window.ethereum) {
            window.open('https://rabby.io/', '_blank');
            showToast('Please install Rabby Wallet', 'info');
            setLoading(false);
            return;
          }
          provider = new ethers.BrowserProvider(window.ethereum);
          break;

        case 'okx':
          if (!window.okxwallet && !window.ethereum) {
            window.open('https://www.okx.com/web3', '_blank');
            showToast('Please install OKX Wallet', 'info');
            setLoading(false);
            return;
          }
          provider = new ethers.BrowserProvider(window.okxwallet || window.ethereum);
          break;

        case 'coinbase':
          if (!window.ethereum?.isCoinbaseWallet && !window.coinbaseWalletExtension) {
            window.open('https://www.coinbase.com/wallet', '_blank');
            showToast('Please install Coinbase Wallet', 'info');
            setLoading(false);
            return;
          }
          provider = new ethers.BrowserProvider(window.coinbaseWalletExtension || window.ethereum);
          break;

        default:
          // Generic - try any available provider
          if (!window.ethereum) {
            showToast('No wallet detected', 'error');
            setLoading(false);
            return;
          }
          provider = new ethers.BrowserProvider(window.ethereum);
      }

      // Request accounts from the wallet
      const ethProvider = window.okxwallet || window.ethereum;

      // Request permission to see all accounts
      await ethProvider.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }],
      });

      const accounts = await provider.send('eth_requestAccounts', []);

      // If multiple accounts, show account selector
      if (accounts.length > 1) {
        setAvailableAccounts(accounts);
        setSelectedWalletType(walletType);
        setWalletStep('accounts');
        setProvider(provider);
        setLoading(false);
        return;
      }

      // Single account - connect directly
      const signer = await provider.getSigner();
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== CHAIN_ID) {
        await ethProvider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x171' }],
        });
      }

      setProvider(provider);
      setSigner(signer);
      setAccount(accounts[0]);
      setShowWalletModal(false);
      setWalletStep('select');
      showToast(`${walletType.charAt(0).toUpperCase() + walletType.slice(1)} connected!`, 'success');
    } catch (err) {
      console.error(err);
      if (err.code === 4001) {
        showToast('Connection rejected by user', 'error');
      } else {
        showToast('Connection failed', 'error');
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
    setAvailableAccounts([]);
    setWalletStep('select');
    setSelectedWalletType(null);
    showToast('Wallet disconnected', 'info');
  };

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
      default: return '$';
    }
  };

  // Toggle currency display
  const toggleCurrencyDisplay = () => {
    const currencies = ['units', 'usd', 'eur', 'gbp', 'jpy', 'sar', 'cny', 'czk'];
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
        try {
          const lpPlsContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcPls, ERC20_ABI, provider);
          const lpPlsBal = await lpPlsContract.balanceOf(account);
          setLpDtgcPlsBalance(ethers.formatEther(lpPlsBal));
        } catch (e) {
          console.warn('Could not fetch DTGC/PLS LP balance:', e);
          setLpDtgcPlsBalance('0');
        }

        // Get DTGC/URMOM LP balance (Diamond+ tier)
        try {
          const lpUrmomContract = new ethers.Contract(CONTRACT_ADDRESSES.lpDtgcUrmom, ERC20_ABI, provider);
          const lpUrmomBal = await lpUrmomContract.balanceOf(account);
          setLpDtgcUrmomBalance(ethers.formatEther(lpUrmomBal));
          setLpBalance(ethers.formatEther(lpUrmomBal)); // Keep legacy for compatibility
        } catch (e) {
          console.warn('Could not fetch DTGC/URMOM LP balance:', e);
          setLpDtgcUrmomBalance('0');
        }

        console.log('📊 Mainnet balances loaded:', {
          pls: ethers.formatEther(plsBal),
          dtgc: ethers.formatEther(dtgcBal),
          urmom: ethers.formatEther(urmomBal),
          lpDtgcPls: lpDtgcPlsBalance,
          lpDtgcUrmom: lpDtgcUrmomBalance
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
      const stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
      const stakingABI = isLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;

      // Step 1: Check and approve token spending
      showToast('Step 1/2: Approving tokens...', 'info');
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

      const currentAllowance = await tokenContract.allowance(account, stakingAddress);
      if (currentAllowance < amountWei) {
        const approveTx = await tokenContract.approve(stakingAddress, ethers.MaxUint256);
        await approveTx.wait();
        showToast('Token approval confirmed!', 'success');
      }

      // Step 2: Stake tokens
      showToast('Step 2/2: Staking tokens...', 'info');
      const stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);

      let stakeTx;
      if (isLP) {
        // LP Staking - amount and lpType (0=Diamond/PLS, 1=Diamond+/URMOM)
        const lpType = selectedTier === 4 ? 1 : 0; // Diamond+ = 1, Diamond = 0
        stakeTx = await stakingContract.stake(amountWei, lpType);
      } else {
        // Regular Staking - amount and tier
        stakeTx = await stakingContract.stake(amountWei, selectedTier);
      }

      await stakeTx.wait();

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
      const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(account);
      setDtgcBalance(ethers.formatEther(dtgcBal));

      if (isLP) {
        const lpContract = new ethers.Contract(CONTRACTS.LP_TOKEN, ERC20_ABI, provider);
        const lpBal = await lpContract.balanceOf(account);
        setLpBalance(ethers.formatEther(lpBal));
      }

    } catch (err) {
      console.error('Staking error:', err);
      setLoading(false);
      setModalOpen(false);

      if (err.code === 'ACTION_REJECTED') {
        showToast('Transaction rejected by user', 'error');
      } else if (err.message?.includes('insufficient')) {
        showToast('Insufficient balance for transaction', 'error');
      } else {
        showToast(`Staking failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
      }
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
      setLoading(true);
      showToast('Processing withdrawal...', 'info');

      // Determine if this is LP or regular staking based on positionId
      // For now, use regular staking contract - can be enhanced with position tracking
      const stakingContract = new ethers.Contract(CONTRACT_ADDRESSES.stakingV3, STAKING_V3_ABI, signer);

      const tx = await stakingContract.withdraw();
      await tx.wait();

      setLoading(false);
      showToast('✅ Successfully withdrawn!', 'success');

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
        showToast(`Withdrawal failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
      }
    }
  };

  // Emergency withdraw (early exit with penalty)
  const handleEmergencyWithdraw = async (isLP = false) => {
    if (!signer || !account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      setLoading(true);
      showToast('Processing emergency withdrawal (20% fee)...', 'info');

      const stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
      const stakingABI = isLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;
      const stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);

      const tx = await stakingContract.emergencyWithdraw();
      await tx.wait();

      setLoading(false);
      showToast('✅ Emergency withdrawal complete (20% fee applied)', 'success');

      // Refresh balances
      const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(account);
      setDtgcBalance(ethers.formatEther(dtgcBal));

    } catch (err) {
      console.error('Emergency withdraw error:', err);
      setLoading(false);
      showToast(`Emergency withdrawal failed: ${err.message?.slice(0, 50) || 'Unknown error'}`, 'error');
    }
  };

  // Claim rewards function
  const handleClaimRewards = async (isLP = false) => {
    if (!signer || !account) {
      showToast('Please connect your wallet first', 'error');
      return;
    }

    try {
      setLoading(true);
      showToast('Claiming rewards...', 'info');

      const stakingAddress = isLP ? CONTRACT_ADDRESSES.lpStakingV3 : CONTRACT_ADDRESSES.stakingV3;
      const stakingABI = isLP ? LP_STAKING_V3_ABI : STAKING_V3_ABI;
      const stakingContract = new ethers.Contract(stakingAddress, stakingABI, signer);

      const tx = await stakingContract.claimRewards();
      await tx.wait();

      setLoading(false);
      showToast('✅ Rewards claimed successfully!', 'success');

      // Refresh DTGC balance
      const dtgcContract = new ethers.Contract(CONTRACTS.DTGC, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(account);
      setDtgcBalance(ethers.formatEther(dtgcBal));

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

  // Fetch user's staked position from contract
  const fetchStakedPosition = useCallback(async () => {
    if (TESTNET_MODE || !account || !provider) return;

    try {
      // Fetch regular staking position
      const stakingContract = new ethers.Contract(CONTRACT_ADDRESSES.stakingV3, STAKING_V3_ABI, provider);
      const position = await stakingContract.getPosition(account);

      // Fetch LP staking position
      const lpStakingContract = new ethers.Contract(CONTRACT_ADDRESSES.lpStakingV3, LP_STAKING_V3_ABI, provider);
      const lpPosition = await lpStakingContract.getPosition(account);

      const positions = [];

      // Parse regular staking position
      // getPosition returns: (amount, startTime, unlockTime, lockPeriod, aprBps, bonusBps, tier, isActive, timeRemaining)
      if (position && position[7]) { // isActive is at index 7
        positions.push({
          id: 'dtgc-stake',
          type: 'DTGC',
          isLP: false,
          amount: parseFloat(ethers.formatEther(position[0])),
          startTime: Number(position[1]) * 1000,
          endTime: Number(position[2]) * 1000,
          lockPeriod: Number(position[3]),
          apr: Number(position[4]) / 100, // Convert from bps
          bonus: Number(position[5]) / 100, // bonusBps
          tier: Number(position[6]),
          isActive: position[7],
          timeRemaining: Number(position[8]),
        });
      }

      // Parse LP staking position
      // getPosition returns: (amount, startTime, unlockTime, lockPeriod, aprBps, boostBps, lpType, isActive, timeRemaining)
      if (lpPosition && lpPosition[7]) { // isActive is at index 7
        positions.push({
          id: 'lp-stake',
          type: 'LP',
          isLP: true,
          amount: parseFloat(ethers.formatEther(lpPosition[0])),
          startTime: Number(lpPosition[1]) * 1000,
          endTime: Number(lpPosition[2]) * 1000,
          lockPeriod: Number(lpPosition[3]),
          apr: Number(lpPosition[4]) / 100, // aprBps
          boostMultiplier: Number(lpPosition[5]) / 100, // boostBps
          lpType: Number(lpPosition[6]), // 0=Diamond, 1=Diamond+
          isActive: lpPosition[7],
          timeRemaining: Number(lpPosition[8]),
        });
      }

      setStakedPositions(positions);
      console.log('📊 Staked positions loaded:', positions);

    } catch (err) {
      console.warn('Failed to fetch staked positions:', err.message);
    }
  }, [account, provider]);

  // Fetch staked positions when account connects
  useEffect(() => {
    if (!TESTNET_MODE && account && provider) {
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

        {/* FLOATING ACTIVE STAKE BOX - Top Left */}
        {account && (TESTNET_MODE ? (testnetBalances.positions?.length > 0) : (stakedPositions.length > 0)) && (
          <div style={{
            position: 'fixed',
            top: TESTNET_MODE ? '55px' : '15px',
            left: '15px',
            zIndex: 1500,
            background: isDark ? 'rgba(15,15,15,0.95)' : 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '2px solid var(--gold)',
            padding: '12px 16px',
            minWidth: '220px',
            maxWidth: '280px',
            boxShadow: '0 8px 32px rgba(212,175,55,0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
              borderBottom: '1px solid rgba(212,175,55,0.3)',
              paddingBottom: '8px',
            }}>
              <span style={{ fontFamily: 'Cinzel, serif', fontWeight: 700, fontSize: '0.75rem', color: 'var(--gold)', letterSpacing: '1px' }}>
                💎 ACTIVE STAKE
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>LIVE</span>
            </div>

            {(() => {
              const activePos = TESTNET_MODE
                ? testnetBalances.positions?.[0]
                : stakedPositions[0];

              if (!activePos) return null;

              // V19 Tier Correction - Override old APRs and lock periods with correct values
              const V19_CORRECTIONS = {
                'SILVER': { apr: 15.4, lockDays: 60 },
                'GOLD': { apr: 16.8, lockDays: 90 },
                'WHALE': { apr: 18.2, lockDays: 180 },
                'DIAMOND': { apr: 28, lockDays: 90, boost: 1.5 },
                'DIAMOND+': { apr: 35, lockDays: 90, boost: 2 },
              };

              const tierName = (activePos.tier || (activePos.isLP ? 'DIAMOND' : 'GOLD')).toUpperCase();
              const correction = V19_CORRECTIONS[tierName] || V19_CORRECTIONS['GOLD'];

              // Use corrected V19 values
              const correctedApr = activePos.isLP ? correction.apr * (correction.boost || 1) : correction.apr;
              const correctedLockDays = correction.lockDays;
              const correctedEndTime = activePos.startTime + (correctedLockDays * 24 * 60 * 60 * 1000);

              const now = Date.now();
              const isLocked = now < correctedEndTime;
              const daysLeft = Math.max(0, Math.ceil((correctedEndTime - now) / (24 * 60 * 60 * 1000)));
              const hoursLeft = Math.max(0, Math.ceil((correctedEndTime - now) / (1000 * 60 * 60)) % 24);
              const daysStaked = Math.max(0, (now - activePos.startTime) / (24 * 60 * 60 * 1000));
              const currentRewards = (activePos.amount * (correctedApr / 100) / 365) * daysStaked;

              const stakeValueUsd = activePos.amount * (livePrices.dtgc || 0);
              const rewardValueUsd = currentRewards * (livePrices.dtgc || 0);

              return (
                <>
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tier</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: activePos.isLP ? 'var(--diamond)' : 'var(--gold)' }}>
                        {activePos.isLP ? '💎' : '🥇'} {tierName}
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
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#4CAF50' }}>
                        {correctedApr.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rewards</span>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4CAF50' }}>
                          +{formatNumber(currentRewards)} DTGC
                        </div>
                        <div style={{ fontSize: '0.6rem', color: '#4CAF50', opacity: 0.8 }}>
                          ≈ {getCurrencySymbol()}{formatNumber(convertToCurrency(rewardValueUsd).value)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    background: isLocked ? 'rgba(255,107,107,0.1)' : 'rgba(76,175,80,0.1)',
                    borderRadius: '8px',
                    padding: '8px',
                    marginBottom: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>EES Penalty Removed</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isLocked ? '#FF6B6B' : '#4CAF50' }}>
                      {isLocked ? (
                        <>⏳ {daysLeft}d {hoursLeft}h remaining</>
                      ) : (
                        <>✅ Unlocked!</>
                      )}
                    </div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📅 {new Date(correctedEndTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  {isLocked ? (
                    <button
                      onClick={() => handleEmergencyWithdraw(activePos.isLP)}
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
                    <button
                      onClick={() => handleUnstake(activePos.id)}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        color: '#FFF',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1,
                      }}
                    >
                      ✅ Claim All
                    </button>
                  )}
                </>
              );
            })()}

            {/* Show count if multiple stakes */}
            {(TESTNET_MODE ? testnetBalances.positions?.length : stakedPositions.length) > 1 && (
              <div style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid rgba(212,175,55,0.2)',
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}>
                +{(TESTNET_MODE ? testnetBalances.positions?.length : stakedPositions.length) - 1} more stake(s) • View in Stake tab
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <header className={`nav-header ${scrolled ? 'scrolled' : ''}`} style={TESTNET_MODE ? {top: '40px'} : {}}>
          <div className="nav-content">
            <div className="logo-section">
              <div className="logo-mark">DT</div>
              <div className="logo-text-group">
                <span className="logo-text gold-text">DTGC</span>
                <span className="logo-tagline">dtgc.io</span>
              </div>
            </div>

            <nav className="nav-links">
              <button className={`nav-link ${activeTab === 'stake' ? 'active' : ''}`} onClick={() => setActiveTab('stake')}>Stake</button>
              <button className={`nav-link ${activeTab === 'burn' ? 'active' : ''}`} onClick={() => setActiveTab('burn')}>Burn Stats</button>
              <button className={`nav-link ${activeTab === 'vote' ? 'active' : ''}`} onClick={() => setActiveTab('vote')}>DAO</button>
              <button className={`nav-link ${activeTab === 'whitepaper' ? 'active' : ''}`} onClick={() => setActiveTab('whitepaper')}>Whitepaper</button>
              <button className={`nav-link ${activeTab === 'links' ? 'active' : ''}`} onClick={() => setActiveTab('links')}>Links</button>
              <button className={`nav-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')} style={{ background: activeTab === 'analytics' ? 'linear-gradient(135deg, #2196F3, #1976D2)' : 'transparent' }}>📊 Analytics</button>
            </nav>

            <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {/* Metal & Crypto Prices - Compact Single Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.05)',
                borderRadius: '16px',
                border: '1px solid rgba(212,175,55,0.2)',
                fontSize: '0.6rem',
              }}>
                <span title="Gold /oz" style={{ color: '#FFD700', fontWeight: 600 }}>🥇 ${metalPrices.gold.toLocaleString()}</span>
                <span title="Silver /oz" style={{ color: '#C0C0C0', fontWeight: 600 }}>🥈 ${metalPrices.silver.toFixed(0)}</span>
                <span title="Copper /lb" style={{ color: '#CD7F32', fontWeight: 600 }}>🥉 ${metalPrices.copper.toFixed(2)}</span>
              </div>
              {/* Crypto Prices - Compact */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                background: 'rgba(33,150,243,0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(33,150,243,0.15)',
                fontSize: '0.55rem',
              }}>
                <span title="Bitcoin" style={{ color: '#F7931A', fontWeight: 600 }}>₿{(cryptoPrices.btc/1000).toFixed(1)}K</span>
                <span title="Ethereum" style={{ color: '#627EEA', fontWeight: 600 }}>Ξ{cryptoPrices.eth.toLocaleString()}</span>
              </div>
              {/* PLS/PLSX Prices */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                background: 'rgba(0,212,170,0.08)',
                borderRadius: '16px',
                border: '1px solid rgba(0,212,170,0.15)',
                fontSize: '0.55rem',
              }}>
                <span title="PulseChain" style={{ color: '#00D4AA', fontWeight: 600 }}>PLS ${cryptoPrices.pls.toFixed(6)}</span>
                <span title="PulseX" style={{ color: '#9B59B6', fontWeight: 600 }}>PLSX ${cryptoPrices.plsx.toFixed(6)}</span>
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
              <button
                className={`connect-btn ${account ? 'connected' : ''}`}
                onClick={account ? disconnectWallet : () => setShowWalletModal(true)}
                disabled={loading}
                title={account ? 'Click to disconnect' : 'Connect your wallet'}
              >
                {loading && <span className="spinner" />}
                {account ? `🔌 ${formatAddress(account)}` : '🔗 Connect'}
              </button>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="hero-section" style={TESTNET_MODE ? {paddingTop: '180px'} : {}}>
          <div className="hero-badge">
            {TESTNET_MODE ? '🧪 V18 DIAMOND+ EDITION • TESTNET 🧪' : '🔴 LIVE • DT GOLD COIN • MAINNET'}
          </div>
          <h1 className="hero-title gold-text">DTGC STAKING</h1>
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
                {displayCurrency === 'units' ? '💰 UNITS' : displayCurrency === 'usd' ? '💵 USD' : displayCurrency === 'eur' ? '💶 EUR' : displayCurrency === 'gbp' ? '💷 GBP' : displayCurrency === 'jpy' ? '💴 JPY' : displayCurrency === 'sar' ? '🇸🇦 SAR' : displayCurrency === 'cny' ? '🇨🇳 CNY' : '🇨🇿 CZK'} ▼
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
                <div style={{textAlign: 'center', padding: '10px 15px', background: 'rgba(0,188,212,0.1)', borderRadius: '8px', border: '1px solid rgba(0,188,212,0.3)'}}>
                  <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#00BCD4'}}>{formatNumber(parseFloat(lpDtgcPlsBalance))} 💎</div>
                  <div style={{fontSize: '0.65rem', color: '#00BCD4'}}>DTGC/PLS LP</div>
                  <div style={{fontSize: '0.6rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(lpDtgcPlsBalance) * (livePrices.dtgc || 0) * 2).value)}</div>
                </div>
                <div style={{textAlign: 'center', padding: '10px 15px', background: 'rgba(156,39,176,0.1)', borderRadius: '8px', border: '1px solid rgba(156,39,176,0.3)'}}>
                  <div style={{fontSize: '1.1rem', fontWeight: 800, color: '#9C27B0'}}>{formatNumber(parseFloat(lpDtgcUrmomBalance))} 💎✨</div>
                  <div style={{fontSize: '0.65rem', color: '#9C27B0'}}>DTGC/URMOM LP</div>
                  <div style={{fontSize: '0.6rem', color: '#4CAF50'}}>{getCurrencySymbol()}{formatNumber(convertToCurrency(parseFloat(lpDtgcUrmomBalance) * (livePrices.dtgc || 0) * 2).value)}</div>
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
            <div className="hero-stat">
              <div className="hero-stat-value gold-text">${formatNumber(parseFloat(liveBurnedUSD))}</div>
              <div className="hero-stat-label">Burned Value</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-value" style={{color: '#4CAF50'}}>91%</div>
              <div className="hero-stat-label">Project Supply</div>
            </div>
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

              {/* Dev Wallet */}
              <a 
                href={`https://scan.pulsechain.com/address/${SUPPLY_WALLETS.dev.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
              <div style={{
                background: 'linear-gradient(135deg, rgba(33,150,243,0.1) 0%, rgba(33,150,243,0.05) 100%)',
                border: '1px solid rgba(33,150,243,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(33,150,243,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>👨‍💻</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>DEV WALLET</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2196F3' }}>
                  {formatNumber(supplyDynamics.dev)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#2196F3', fontWeight: 600 }}>
                  {((supplyDynamics.dev / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: `${(supplyDynamics.dev / DTGC_TOTAL_SUPPLY) * 100}%`,
                    height: '100%',
                    background: '#2196F3',
                    borderRadius: '2px',
                  }} />
                </div>
                <div style={{ fontSize: '0.5rem', color: '#666', marginTop: '6px' }}>🔗 View on PulseScan</div>
              </div>
              </a>

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

              {/* Circulating */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,152,0,0.1) 0%, rgba(255,152,0,0.05) 100%)',
                border: '1px solid rgba(255,152,0,0.3)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>💱</div>
                <div style={{ fontSize: '0.7rem', color: '#888', letterSpacing: '1px', marginBottom: '4px' }}>CIRCULATING</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#FF9800' }}>
                  {formatNumber(supplyDynamics.circulating)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#FF9800', fontWeight: 600 }}>
                  {((supplyDynamics.circulating / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </div>
                <div style={{ 
                  height: '4px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  marginTop: '4px'
                }}>
                  <div style={{
                    width: `${(supplyDynamics.circulating / DTGC_TOTAL_SUPPLY) * 100}%`,
                    height: '100%',
                    background: '#FF9800',
                    borderRadius: '2px',
                  }} />
                </div>
              </div>
            </div>

            {/* Summary Bar */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>PROJECT SUPPLY:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4CAF50' }}>
                  {(((supplyDynamics.dao + supplyDynamics.dev + supplyDynamics.lpLocked) / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>PUBLIC FLOAT:</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#FF9800' }}>
                  {((supplyDynamics.circulating / DTGC_TOTAL_SUPPLY) * 100).toFixed(1)}%
                </span>
              </div>
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
                textAlign: 'center', 
                marginBottom: '6px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}>
                📊 Top 30% Holder Wallets (Excluding DAO/Dev) • Hover to Pause
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
                color: '#555', 
                textAlign: 'center', 
                marginTop: '6px'
              }}>
                Total Tracked: {formatNumber((liveHolders.holders || []).reduce((sum, w) => sum + w.balance, 0))} DTGC • {(liveHolders.holders || []).length} Wallets
              </div>
            </div>
          </div>
        </section>

        <main className="main-content">
          {/* STAKE TAB */}
          {activeTab === 'stake' && (
            <section className="section">
              <div className="section-header">
                <h2 className="section-title gold-text">SELECT YOUR TIER</h2>
                <div className="section-divider" />
                <p className="section-description">Choose your staking tier based on lock duration and desired APR</p>
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

              <div className="tiers-grid">
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
                    <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Min: ${tier.minInvest.toLocaleString()}</div>
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

                {/* Diamond Tier with Dynamic APR */}
                {(() => {
                  const diamondEffectiveAPR = getEffectiveAPR(V5_DIAMOND_TIER.apr * V5_DIAMOND_TIER.boost, livePrices.dtgcMarketCap || 0);
                  const diamondBaseAPR = V5_DIAMOND_TIER.apr * V5_DIAMOND_TIER.boost;
                  return (
                <div
                  className={`tier-card diamond ${isLP && selectedTier === 3 ? 'selected' : ''}`}
                  onClick={() => { setSelectedTier(3); setIsLP(true); }}
                >
                  <div className="tier-icon">{V5_DIAMOND_TIER.icon}</div>
                  <div className="tier-name" style={{ color: V5_DIAMOND_TIER.color }}>{V5_DIAMOND_TIER.name}</div>
                  <div className="tier-subtitle">{V5_DIAMOND_TIER.lpPair} LP • {V5_DIAMOND_TIER.boost}x BOOST!</div>
                  <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Min: ${V5_DIAMOND_TIER.minInvest}</div>
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
                  style={{ background: 'linear-gradient(135deg, rgba(156,39,176,0.1) 0%, rgba(123,31,162,0.15) 100%)', border: '2px solid #9C27B0' }}
                >
                  <div className="tier-icon" style={{ fontSize: '2.5rem' }}>{V5_DIAMOND_PLUS_TIER.icon}</div>
                  <div className="tier-name" style={{ color: V5_DIAMOND_PLUS_TIER.color }}>{V5_DIAMOND_PLUS_TIER.name}</div>
                  <div className="tier-subtitle" style={{ color: '#9C27B0' }}>{V5_DIAMOND_PLUS_TIER.lpPair} LP • {V5_DIAMOND_PLUS_TIER.boost}x BOOST!</div>
                  <div className="tier-min-invest" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Min: ${V5_DIAMOND_PLUS_TIER.minInvest}</div>
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
                  <span className="tier-badge lp" style={{ background: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)' }}>LP+</span>
                </div>
                  );
                })()}
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
                            setStakeAmount(getBalance());
                          } else {
                            const maxTokens = parseFloat(getBalance()) || 0;
                            const priceUsd = livePrices.dtgc || 0;
                            const valueUsd = maxTokens * priceUsd;
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

              {/* Active Positions (Mainnet) */}
              {!TESTNET_MODE && account && stakedPositions.length > 0 && (
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

                  {stakedPositions.map((pos) => {
                    const now = Date.now();
                    const isLocked = now < pos.endTime;
                    const daysLeft = Math.max(0, Math.ceil((pos.endTime - now) / (24 * 60 * 60 * 1000)));
                    const daysStaked = Math.max(0, (now - pos.startTime) / (24 * 60 * 60 * 1000));
                    const effectiveApr = pos.apr * (pos.boostMultiplier || 1);
                    const currentRewards = (pos.amount * (effectiveApr / 100) / 365) * daysStaked;
                    const rewardValue = currentRewards * (livePrices.dtgc || 0);

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
                              {pos.isLP ? '💎 DIAMOND LP' : '🥇 DTGC STAKE'}
                            </div>
                            <div style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                              Staked: <strong>{formatNumber(pos.amount)} {pos.isLP ? 'LP' : 'DTGC'}</strong>
                              <span style={{fontSize: '0.75rem', color: '#4CAF50', marginLeft: '6px'}}>
                                ({getCurrencySymbol()}{formatNumber(convertToCurrency(pos.amount * (livePrices.dtgc || 0) * (pos.isLP ? 2 : 1)).value)})
                              </span>
                            </div>
                            <div style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px'}}>
                              APR: <strong>{effectiveApr.toFixed(1)}%</strong> {pos.boostMultiplier > 1 && `(${pos.boostMultiplier}x boost)`}
                            </div>
                            <div style={{fontSize: '0.8rem', color: isLocked ? '#FF6B6B' : '#4CAF50', marginTop: '4px'}}>
                              {isLocked ? `🔒 ${daysLeft} days remaining` : '✅ Unlocked - Ready to claim!'}
                            </div>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic'}}>
                              📅 EES Penalty Removed: <strong style={{color: isLocked ? '#FFB74D' : '#4CAF50'}}>{new Date(pos.endTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                            </div>
                          </div>
                          <div style={{textAlign: 'right'}}>
                            <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>Rewards Accrued</div>
                            <div style={{fontSize: '1.3rem', fontWeight: 800, color: '#4CAF50'}}>
                              +{formatNumber(currentRewards)} DTGC
                            </div>
                            <div style={{fontSize: '0.75rem', color: '#4CAF50', opacity: 0.9}}>
                              ≈ {getCurrencySymbol()}{formatNumber(convertToCurrency(rewardValue).value)}
                            </div>
                            <div style={{display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end'}}>
                              {isLocked ? (
                                <button
                                  onClick={() => handleEmergencyWithdraw(pos.isLP)}
                                  style={{
                                    padding: '8px 16px',
                                    background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                                    border: 'none',
                                    borderRadius: '20px',
                                    fontWeight: 700,
                                    fontSize: '0.7rem',
                                    color: '#FFF',
                                    cursor: 'pointer',
                                  }}
                                >
                                  ⚠️ Emergency (20%)
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleClaimRewards(pos.isLP)}
                                    style={{
                                      padding: '8px 16px',
                                      background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
                                      border: 'none',
                                      borderRadius: '20px',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                      color: '#FFF',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    💰 Claim Rewards
                                  </button>
                                  <button
                                    onClick={() => handleUnstake(null, pos.isLP)}
                                    style={{
                                      padding: '8px 16px',
                                      background: 'linear-gradient(135deg, #D4AF37, #B8860B)',
                                      border: 'none',
                                      borderRadius: '20px',
                                      fontWeight: 700,
                                      fontSize: '0.7rem',
                                      color: '#FFF',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🔓 Unstake All
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
                            <div style={{fontSize: '0.85rem', color: '#4CAF50', opacity: 0.8}}>≈ {getCurrencySymbol()}{formatNumber(convertToCurrency(currentRewards * (livePrices.dtgc || 0)).value)}</div>
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

              {/* DTGC Logo/Favicon at Bottom of Stake Page */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 20px',
                marginTop: '20px',
              }}>
                <img 
                  src="/favicon.png" 
                  alt="DTGC Logo" 
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    border: '3px solid var(--gold)',
                    boxShadow: '0 0 30px rgba(212,175,55,0.4), 0 0 60px rgba(212,175,55,0.2)',
                    animation: 'float 3s ease-in-out infinite',
                  }}
                />
                <p style={{
                  color: 'var(--gold)',
                  fontFamily: 'Cinzel, serif',
                  fontSize: '1.1rem',
                  letterSpacing: '4px',
                  marginTop: '16px',
                  textTransform: 'uppercase',
                }}>
                  DT GOLD COIN
                </p>
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  marginTop: '8px',
                }}>
                  Premium Staking on PulseChain
                </p>
              </div>
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
                <div className="section-divider" />
                <p className="section-description">DT Gold Coin • Premium Staking Protocol</p>
              </div>

              {/* DOCUMENT DOWNLOADS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '20px',
                marginBottom: '40px',
              }}>
                <a href="/docs/DTGC-V18-White-Paper.docx" download style={{
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
                    <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--gold)', fontSize: '1.1rem'}}>WHITE PAPER</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Public Overview • V18</div>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px'}}>📥 Download .docx</div>
                  </div>
                </a>
                
                <a href="/docs/DTGC-V18-Gold-Paper-DiamondPlus.docx" download style={{
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
                    <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, color: 'var(--gold)', fontSize: '1.1rem'}}>GOLD PAPER</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Full Tokenomics • Diamond+ Edition</div>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px'}}>📥 Download .docx</div>
                  </div>
                </a>
                
                <a href="/docs/DTGC-V18-Gold-Paper-Quant.docx" download style={{
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
                    <div style={{fontFamily: 'Cinzel, serif', fontWeight: 700, color: '#5C6BC0', fontSize: '1.1rem'}}>GOLD PAPER QUANT</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>Risk Analysis • ROI Modeling</div>
                    <div style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px'}}>📥 Download .docx</div>
                  </div>
                </a>
              </div>

              <div className="wp-card">
                <h3 className="wp-card-title gold-text">📜 Introduction</h3>
                <div className="wp-card-content">
                  <p>DT Gold Coin (DTGC) is a premium staking protocol built on PulseChain, designed to reward long-term holders while creating sustainable tokenomics through strategic burns and DAO governance.</p>
                  <p>Paired with URMOM token, DTGC creates a dual-token ecosystem that benefits both communities through liquidity provision, staking rewards, and deflationary mechanisms.</p>
                </div>
              </div>

              <div className="wp-card">
                <h3 className="wp-card-title gold-text">💰 V5 GOLD PAPER TOKENOMICS</h3>
                <div className="wp-card-content">
                  <p><strong>Total Supply: 1,000,000,000 DTGC</strong></p>
                  <p style={{color: 'var(--gold)', fontWeight: '600', marginBottom: '16px'}}>⚠️ 91% CONTROLLED • ONLY 9% FLOAT!</p>
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
                      <tr><td>🐋 Whale</td><td>$10k</td><td>180 days</td><td>18.2%</td><td>1x</td><td>DTGC</td></tr>
                      <tr style={{background: 'rgba(0, 188, 212, 0.1)'}}><td>💎 Diamond</td><td>$1,000</td><td>90 days</td><td style={{color: '#00BCD4', fontWeight: '700'}}>28%</td><td style={{color: '#4CAF50', fontWeight: '700'}}>1.5x (42%)</td><td>DTGC/PLS LP</td></tr>
                      <tr style={{background: 'rgba(156, 39, 176, 0.15)'}}><td>💎✨ Diamond+</td><td>$1,000</td><td>90 days</td><td style={{color: '#9C27B0', fontWeight: '700'}}>35%</td><td style={{color: '#9C27B0', fontWeight: '700'}}>2x (70%)</td><td>DTGC/URMOM LP</td></tr>
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
                <a href={SOCIAL_LINKS.xDumpTires} target="_blank" rel="noopener noreferrer" className="link-card">
                  <span className="link-icon">𝕏</span>
                  <div className="link-info">
                    <div className="link-name">Dump Tires Twitter</div>
                    <div className="link-url">@Dump_Tires</div>
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
                  { label: '💎✨ DTGC/URMOM LP', addr: CONTRACT_ADDRESSES.lpDtgcUrmom },
                  { label: '✅ DTGC Staking V2', addr: CONTRACT_ADDRESSES.stakingV2 },
                  { label: '✅ LP Staking V2', addr: CONTRACT_ADDRESSES.lpStakingV2 },
                  { label: '🗳️ DAO Voting', addr: CONTRACT_ADDRESSES.daoVoting },
                  { label: '🏛️ DAO Treasury', addr: CONTRACT_ADDRESSES.daoTreasury },
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
                {/* Currency Selector for Analytics */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Display Currency:</span>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
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
                  </select>
                </div>
                <div className="section-divider" style={{ background: 'linear-gradient(90deg, transparent, #2196F3, transparent)' }} />
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

              {/* DYNAMIC PERSONAL FORECASTING CALCULATOR */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(156,39,176,0.1))',
                border: '2px solid rgba(212,175,55,0.5)',
                borderRadius: '16px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <h3 style={{ color: '#D4AF37', fontSize: '1.3rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🧮 PERSONAL STAKING CALCULATOR (V19)
                </h3>

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
                      <option value="diamondplus">💎✨ Diamond+ LP (70% eff)</option>
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
                    diamondplus: { apr: 70, lock: 90, name: 'Diamond+ LP', icon: '💎✨' },
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
                        <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>$10,000</td>
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
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>💎✨ Diamond+ LP</td>
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
        </main>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-logo gold-text">DTGC</div>
          <div className="footer-links">
            <a href={`${EXPLORER}/address/${CONTRACT_ADDRESSES.stakingV2}`} target="_blank" rel="noopener noreferrer" className="footer-link">Staking Contract</a>
            <a href={`${EXPLORER}/address/${CONTRACT_ADDRESSES.lpStakingV2}`} target="_blank" rel="noopener noreferrer" className="footer-link">LP Staking</a>
            <a href={`${EXPLORER}/address/${CONTRACT_ADDRESSES.daoVoting}`} target="_blank" rel="noopener noreferrer" className="footer-link">DAO Voting</a>
            <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer" className="footer-link">Telegram</a>
          </div>
          <div className="footer-divider" />
          <p className="footer-text">© 2025 DT GOLD COIN • dtgc.io • Premium Staking on PulseChain • Diamond & Diamond+ LP Tiers 💎✨</p>
        </footer>

        {/* DexScreener Widget */}
        <DexScreenerWidget />
      </div>

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
        }} onClick={() => setShowWalletModal(false)}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
            border: '2px solid #D4AF37',
            borderRadius: '20px',
            padding: '32px',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(212,175,55,0.2)',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{
              color: '#D4AF37',
              fontFamily: 'Cinzel, serif',
              fontSize: '1.5rem',
              textAlign: 'center',
              marginBottom: '24px',
              letterSpacing: '2px',
            }}>
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
              <button
                onClick={() => connectWalletType('internetmoney')}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(212,175,55,0.15)',
                  border: '1px solid #D4AF37',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.3)';
                  e.target.style.borderColor = '#FFD700';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(212,175,55,0.15)';
                  e.target.style.borderColor = '#D4AF37';
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>💰</span>
                <span style={{ fontWeight: 600 }}>Internet Money</span>
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#D4AF37' }}>RECOMMENDED</span>
              </button>

              <button
                onClick={() => connectWalletType('metamask')}
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
                <span style={{ fontSize: '1.5rem' }}>🦊</span>
                <span style={{ fontWeight: 600 }}>MetaMask</span>
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
              <div style={{ fontSize: '0.75rem', color: '#888', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div><span style={{ color: '#D4AF37' }}>DTGC Token:</span> <span style={{ fontFamily: 'monospace' }}>0x146a...9165e</span></div>
                <div><span style={{ color: '#D4AF37' }}>Staking V2:</span> <span style={{ fontFamily: 'monospace' }}>0x6cD0...55432</span></div>
                <div><span style={{ color: '#D4AF37' }}>LP Staking V2:</span> <span style={{ fontFamily: 'monospace' }}>0xFcFa...d4332</span></div>
                <div><span style={{ color: '#D4AF37' }}>DAO Treasury:</span> <span style={{ fontFamily: 'monospace' }}>0x2228...bFC</span></div>
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
