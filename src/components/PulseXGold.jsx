/* eslint-disable no-undef */
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚜️ PULSEX GOLD - DTRADER EDITION ⚜️
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The most advanced PulseChain DeFi interface
 * Powered by DTGC.io
 *
 * Features:
 * - ⚡ Token Swap (V1 & V2 routing)
 * - 📊 Live P&L Cards
 * - 🎯 Sniper Integration
 * - 📈 Limit Orders
 * - 💼 Portfolio Scanner
 * - 💎 LP Creation
 * - 🔐 Token Gate ($50 DTGC)
 *
 * @version 3.0.0 - DTRADER Edition
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  RPC_URL: 'https://pulsechain.publicnode.com',
  CHAIN_ID: 369,

  // PulseX Routers
  ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  ROUTER_V2: '0x636f6407B90661b73b1C0F7e24F4C79f624d0738',
  FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  FACTORY_V2: '0x29eA7545DEf87022BAdc76323F373EA1e707C523',
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',

  // Token Gate
  DTGC_ADDRESS: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
  DTGC_MIN_USD: 50, // $50 minimum

  // Fees
  FEES: {
    BUY_BURN_BPS: 50, // 0.5% buy & burn
    DEV_BPS: 50,      // 0.5% to dev
    TOTAL_BPS: 100,   // 1% total
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',

  // APIs
  PULSESCAN_API: 'https://api.scan.pulsechain.com/api/v2',
  DEXSCREENER_API: 'https://api.dexscreener.com/latest/dex',

  // Links
  DTGC_WEBSITE: 'https://dtgc.io',
  PULSEX_GOLD_URL: 'https://dtgc.io/pulsexgold',
  TELEGRAM_BOT: 'https://t.me/dtrader_bot',

  // Trading defaults
  SLIPPAGE_BPS: 300, // 3%
  DEADLINE_MINUTES: 20,

  EXPLORER: 'https://scan.pulsechain.com',
};

// ═══════════════════════════════════════════════════════════════════════════
// FEE PROCESSOR - 0.5% Buy & Burn DTGC + 0.5% Dev Wallet
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Process trading fees: 1% total (0.5% buy & burn DTGC + 0.5% to dev in PLS)
 * @param {object} params - { amountPLS, signer, router, showToast }
 * @returns {Promise<{success: boolean, buyBurnTx?: string, devTx?: string}>}
 */
const processTradingFees = async ({ amountPLS, signer, router, showToast }) => {
  const result = { success: false };

  try {
    const totalFee = amountPLS * BigInt(CONFIG.FEES.TOTAL_BPS) / 10000n;
    const buyBurnFee = totalFee / 2n;  // 0.5%
    const devFee = totalFee - buyBurnFee; // 0.5%

    if (totalFee <= 0n) return { success: true };

    const deadline = Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

    // 1. Buy & Burn DTGC (0.5%)
    showToast?.('🔥 Buying & burning DTGC (0.5%)...', 'info');
    try {
      const dtgcPath = [CONFIG.WPLS, CONFIG.DTGC_ADDRESS];
      const burnTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0n, // Accept any amount
        dtgcPath,
        CONFIG.BURN_ADDRESS, // Send to burn address
        deadline,
        { value: buyBurnFee }
      );
      await burnTx.wait();
      result.buyBurnTx = burnTx.hash;
      showToast?.('🔥 DTGC bought & burned!', 'success');
    } catch (burnErr) {
      console.error('Buy & burn failed:', burnErr);
      // Continue with dev fee even if burn fails
    }

    // 2. Send to Dev Wallet (0.5% in PLS)
    showToast?.('💰 Sending 0.5% to dev wallet...', 'info');
    const devTx = await signer.sendTransaction({
      to: CONFIG.DEV_WALLET,
      value: devFee,
    });
    await devTx.wait();
    result.devTx = devTx.hash;

    result.success = true;
    return result;
  } catch (error) {
    console.error('Fee processing error:', error);
    return result;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// GIB.SHOW TOKEN LOGO API
// ═══════════════════════════════════════════════════════════════════════════

const GIB_SHOW_BASE = 'https://gib.show/image/369'; // PulseChain chainId = 369

// Get token logo - DTGC uses our custom favicon, everything else uses gib.show
const getTokenLogo = (address, symbol) => {
  const addr = address?.toLowerCase();
  // DTGC - Use our custom gold coin favicon
  if (addr === '0xd0676b28a457371d58d47e5247b439114e40eb0f' || symbol === 'DTGC') {
    return '/Favicon.png';
  }
  // All other tokens - use gib.show API
  return `${GIB_SHOW_BASE}/${address}`;
};

// TokenIcon component - renders image with emoji fallback
const TokenIcon = ({ address, symbol, emoji, size = 24, style = {} }) => {
  const [imgError, setImgError] = React.useState(false);
  const logoUrl = getTokenLogo(address, symbol);

  if (!imgError) {
    return (
      <img
        src={logoUrl}
        alt={symbol}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          ...style
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback to emoji
  return <span style={{ fontSize: size * 0.8, ...style }}>{emoji || '🔸'}</span>;
};

// ═══════════════════════════════════════════════════════════════════════════
// TOKENS DATABASE - ALL MAJOR PULSECHAIN TOKENS
// ═══════════════════════════════════════════════════════════════════════════

const TOKENS = {
  // ═══════════════════════════════════════════════════════════════
  // NATIVE & WRAPPED
  // ═══════════════════════════════════════════════════════════════
  PLS: {
    address: CONFIG.WPLS,
    symbol: 'PLS',
    name: 'PulseChain',
    decimals: 18,
    emoji: '💜',
    isNative: true,
  },
  WPLS: {
    address: CONFIG.WPLS,
    symbol: 'WPLS',
    name: 'Wrapped PLS',
    decimals: 18,
    emoji: '💜',
  },

  // ═══════════════════════════════════════════════════════════════
  // DTGC ECOSYSTEM
  // ═══════════════════════════════════════════════════════════════
  DTGC: {
    address: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
    symbol: 'DTGC',
    name: 'DT Gold Coin',
    decimals: 18,
    emoji: '🏆',
    isGold: true,
    useCustomLogo: true, // Uses /Favicon.png
  },
  URMOM: {
    address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0',
    symbol: 'URMOM',
    name: 'URMOM',
    decimals: 18,
    emoji: '🔥',
  },

  // ═══════════════════════════════════════════════════════════════
  // CORE PULSECHAIN TOKENS
  // ═══════════════════════════════════════════════════════════════
  PLSX: {
    address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab',
    symbol: 'PLSX',
    name: 'PulseX',
    decimals: 18,
    emoji: '🔷',
  },
  HEX: {
    address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
    symbol: 'HEX',
    name: 'HEX',
    decimals: 8,
    emoji: '⬡',
  },
  INC: {
    address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d',
    symbol: 'INC',
    name: 'Incentive',
    decimals: 18,
    emoji: '💎',
  },
  eHEX: {
    address: '0x57fde0a71132198bbec939b98976993d8d89d225',
    symbol: 'eHEX',
    name: 'HEX from ETH',
    decimals: 8,
    emoji: '⬡',
  },

  // ═══════════════════════════════════════════════════════════════
  // STABLECOINS (BRIDGED FROM ETH)
  // ═══════════════════════════════════════════════════════════════
  DAI: {
    address: '0xefd766ccb38eaf1dfd701853bfce31359239f305',
    symbol: 'DAI',
    name: 'DAI from ETH',
    decimals: 18,
    emoji: '📀',
  },
  USDC: {
    address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07',
    symbol: 'USDC',
    name: 'USDC from ETH',
    decimals: 6,
    emoji: '💵',
  },
  USDT: {
    address: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f',
    symbol: 'USDT',
    name: 'USDT from ETH',
    decimals: 6,
    emoji: '💵',
  },

  // ═══════════════════════════════════════════════════════════════
  // BRIDGED ETH ASSETS
  // ═══════════════════════════════════════════════════════════════
  WETH: {
    address: '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c',
    symbol: 'WETH',
    name: 'WETH from ETH',
    decimals: 18,
    emoji: '🔹',
  },
  WBTC: {
    address: '0xb17d901469b9208b17d916112988a3fed19b5ca1',
    symbol: 'WBTC',
    name: 'WBTC from ETH',
    decimals: 8,
    emoji: '🟠',
  },

  // ═══════════════════════════════════════════════════════════════
  // POPULAR PULSECHAIN NATIVE TOKENS
  // ═══════════════════════════════════════════════════════════════
  LOAN: {
    address: '0x9159f1d2a9f51998fc9ab03fbd8f265ab14a1b3b',
    symbol: 'LOAN',
    name: 'Liquid Loan',
    decimals: 18,
    emoji: '🏦',
  },
  MINT: {
    address: '0xedcc867bc8b5febd0459af17a6f134f41f422f0c',
    symbol: 'MINT',
    name: 'Mintra',
    decimals: 18,
    emoji: '🌿',
  },
  SPARK: {
    address: '0x6386704cd6f7a584ea9d23ccca66af7eba5a727e',
    symbol: 'SPARK',
    name: 'SparkSwap',
    decimals: 18,
    emoji: '⚡',
  },
  '9MM': {
    address: '0x2b84017752d0b3d5b08808212e46d1ac9dd3ab6c',
    symbol: '9MM',
    name: '9mm Pro',
    decimals: 18,
    emoji: '🔫',
  },
  HDRN: {
    address: '0x3819f64f282bf135d62168c1e513280daf905e06',
    symbol: 'HDRN',
    name: 'Hedron',
    decimals: 9,
    emoji: '🔮',
  },
  ICSA: {
    address: '0xfc4913214444af5c715cc9f7b52655e788a569ed',
    symbol: 'ICSA',
    name: 'Icosa',
    decimals: 18,
    emoji: '🧊',
  },
  PLSB: {
    address: '0x5ee84583f67d5ecea5420dbb42b462896e7f8d06',
    symbol: 'PLSB',
    name: 'PulseBitcoin',
    decimals: 12,
    emoji: '₿',
  },
  ASIC: {
    address: '0x11aedd0087d95dd07468c4b10d57a4090aba4d2c',
    symbol: 'ASIC',
    name: 'ASIC',
    decimals: 12,
    emoji: '⛏️',
  },
  MAXI: {
    address: '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b',
    symbol: 'MAXI',
    name: 'Maximus',
    decimals: 8,
    emoji: '👑',
  },
  TEDDY: {
    address: '0x5dd0d493ea59d512efc13d5c1528f92989623e8c',
    symbol: 'TEDDY',
    name: 'TeddySwap',
    decimals: 18,
    emoji: '🧸',
  },
  TSFi: {
    address: '0x3af33bef05c2dcb3c7288b77fe1c8d2aeba4d789',
    symbol: 'TSFi',
    name: 'TSFi',
    decimals: 18,
    emoji: '🔷',
  },
  BEAR: {
    address: '0x1707a16a2d7d40f4e27ae4ea1a88a8e00e7ab236',
    symbol: 'BEAR',
    name: 'Bear',
    decimals: 18,
    emoji: '🐻',
  },
  BBC: {
    address: '0xdb2d70d29ad27db92c6c7d1c4ef27f14dcd0b42d',
    symbol: 'BBC',
    name: 'Big Bonus Coin',
    decimals: 18,
    emoji: '🎁',
  },
  PHIAT: {
    address: '0x886cf7d08e93a30c2dbf553b022823e6c1f3b4fb',
    symbol: 'PHIAT',
    name: 'Phiat',
    decimals: 18,
    emoji: '💰',
  },

  // ═══════════════════════════════════════════════════════════════
  // BRIDGED DEFI TOKENS (FROM ETH)
  // ═══════════════════════════════════════════════════════════════
  LINK: {
    address: '0x514910771af9ca656af840dff83e8264ecf986ca',
    symbol: 'LINK',
    name: 'Chainlink from ETH',
    decimals: 18,
    emoji: '🔗',
  },
  UNI: {
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    symbol: 'UNI',
    name: 'Uniswap from ETH',
    decimals: 18,
    emoji: '🦄',
  },
  AAVE: {
    address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    symbol: 'AAVE',
    name: 'Aave from ETH',
    decimals: 18,
    emoji: '👻',
  },
  MKR: {
    address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    symbol: 'MKR',
    name: 'Maker from ETH',
    decimals: 18,
    emoji: '🏛️',
  },
  SHIB: {
    address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    symbol: 'SHIB',
    name: 'Shiba from ETH',
    decimals: 18,
    emoji: '🐕',
  },
  PEPE: {
    address: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
    symbol: 'PEPE',
    name: 'Pepe from ETH',
    decimals: 18,
    emoji: '🐸',
  },

  // ═══════════════════════════════════════════════════════════════
  // MORE POPULAR TOKENS
  // ═══════════════════════════════════════════════════════════════
  CST: {
    address: '0x5ee3e912a45fbbc42a2ef24e1ed72bd37dd55043',
    symbol: 'CST',
    name: 'CryptoStar',
    decimals: 18,
    emoji: '⭐',
  },
  TONI: {
    address: '0x69e4c08bd7a5dce1d55c41c3ecb73c5c4bad5f2a',
    symbol: 'TONI',
    name: 'Toni',
    decimals: 18,
    emoji: '🎵',
  },
  TRIO: {
    address: '0x0d7eb9f43c57f6ff3bc9e23d8f9d82503f0e84c',
    symbol: 'TRIO',
    name: 'Maximus TRIO',
    decimals: 8,
    emoji: '3️⃣',
  },
  DECI: {
    address: '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6',
    symbol: 'DECI',
    name: 'Maximus DECI',
    decimals: 8,
    emoji: '🔟',
  },
};

// ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const ROUTER_ABI = [
  'function getAmountsOut(uint, address[]) view returns (uint[])',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint, address[], address, uint) payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint, uint, address[], address, uint)',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint, uint, address[], address, uint)',
];

// ═══════════════════════════════════════════════════════════════════════════
// GOLD MANDALORIAN THEME
// ═══════════════════════════════════════════════════════════════════════════

const GOLD = {
  primary: '#D4AF37',
  secondary: '#B8960C',
  dark: '#8B7500',
  light: '#FFD700',
  glow: 'rgba(212, 175, 55, 0.4)',
};

const THEME = {
  bg: {
    primary: '#0a0a0f',
    secondary: '#12121a',
    card: 'rgba(18, 18, 26, 0.95)',
    input: 'rgba(0, 0, 0, 0.4)',
  },
  text: {
    primary: '#ffffff',
    secondary: '#888888',
    muted: '#666666',
  },
  profit: '#4CAF50',
  loss: '#FF4444',
  border: `1px solid ${GOLD.glow}`,
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
  // Container
  container: {
    background: `linear-gradient(180deg, ${THEME.bg.primary} 0%, ${THEME.bg.secondary} 100%)`,
    minHeight: '100vh',
    fontFamily: "'Orbitron', -apple-system, sans-serif",
    color: THEME.text.primary,
    padding: '20px',
  },

  // Header
  header: {
    textAlign: 'center',
    marginBottom: '32px',
    position: 'relative',
  },
  logo: {
    fontSize: '2rem',
    fontWeight: 900,
    background: `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.light})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '3px',
    textShadow: `0 0 30px ${GOLD.glow}`,
    marginBottom: '8px',
  },
  subtitle: {
    color: THEME.text.secondary,
    fontSize: '0.85rem',
    letterSpacing: '2px',
  },

  // Navigation tabs
  nav: {
    display: 'flex',
    gap: '8px',
    background: 'rgba(0,0,0,0.4)',
    padding: '8px',
    borderRadius: '16px',
    marginBottom: '24px',
    maxWidth: '600px',
    margin: '0 auto 24px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  navTab: {
    padding: '12px 20px',
    borderRadius: '12px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  },
  navTabActive: {
    background: `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.secondary})`,
    color: '#000',
  },
  navTabInactive: {
    background: 'transparent',
    color: THEME.text.secondary,
  },

  // Cards
  card: {
    background: THEME.bg.card,
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '16px',
    border: THEME.border,
    maxWidth: '500px',
    margin: '0 auto 16px',
    backdropFilter: 'blur(10px)',
  },
  cardTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: GOLD.primary,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  // Inputs
  inputGroup: {
    background: THEME.bg.input,
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  inputLabel: {
    color: THEME.text.secondary,
    fontSize: '0.75rem',
    marginBottom: '8px',
    display: 'block',
  },
  input: {
    background: 'transparent',
    border: 'none',
    color: THEME.text.primary,
    fontSize: '1.5rem',
    fontWeight: 600,
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
  },

  // Buttons
  button: {
    width: '100%',
    padding: '16px',
    background: `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.secondary})`,
    border: 'none',
    borderRadius: '12px',
    color: '#000',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    marginTop: '16px',
  },
  buttonDisabled: {
    background: 'rgba(255,255,255,0.1)',
    color: '#666',
    cursor: 'not-allowed',
  },
  buttonSecondary: {
    background: 'rgba(212, 175, 55, 0.2)',
    color: GOLD.primary,
    border: `1px solid ${GOLD.glow}`,
  },

  // Token selector
  tokenSelect: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(212, 175, 55, 0.2)',
    padding: '10px 14px',
    borderRadius: '10px',
    cursor: 'pointer',
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9rem',
  },

  // P&L Card
  pnlCard: {
    background: `linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(18,18,26,0.95) 100%)`,
    borderRadius: '20px',
    padding: '24px',
    border: `2px solid ${GOLD.glow}`,
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  pnlProfit: {
    color: GOLD.primary,
    textShadow: `0 0 20px ${GOLD.primary}`,
  },
  pnlLoss: {
    color: THEME.loss,
    textShadow: `0 0 20px ${THEME.loss}`,
  },

  // Token Gate
  gateCard: {
    background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(212,175,55,0.05))',
    border: `2px solid ${GOLD.glow}`,
    borderRadius: '20px',
    padding: '24px',
    textAlign: 'center',
    maxWidth: '400px',
    margin: '0 auto',
  },
  gateProgress: {
    height: '8px',
    background: 'rgba(0,0,0,0.4)',
    borderRadius: '4px',
    overflow: 'hidden',
    margin: '16px 0',
  },
  gateProgressBar: {
    height: '100%',
    background: `linear-gradient(90deg, ${GOLD.primary}, ${GOLD.light})`,
    borderRadius: '4px',
    transition: 'width 0.5s ease',
  },

  // Stats row
  statsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: '0.85rem',
  },

  // Toast
  toast: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: 500,
    zIndex: 10000,
    maxWidth: '90%',
    textAlign: 'center',
  },
  toastSuccess: { background: 'rgba(76, 175, 80, 0.95)' },
  toastError: { background: 'rgba(244, 67, 54, 0.95)' },
  toastInfo: { background: `rgba(33, 150, 243, 0.95)` },
};

// ═══════════════════════════════════════════════════════════════════════════
// P&L CALCULATION UTILS
// ═══════════════════════════════════════════════════════════════════════════

const calculatePnL = (buyPrice, currentPrice, amount) => {
  const invested = buyPrice * amount;
  const currentValue = currentPrice * amount;
  const pnlAmount = currentValue - invested;
  const pnlPercent = invested > 0 ? ((pnlAmount / invested) * 100) : 0;

  return {
    isProfit: pnlAmount >= 0,
    pnlPercent,
    pnlAmount,
    invested,
    currentValue,
  };
};

const formatNumber = (num, decimals = 4) => {
  if (!num || isNaN(num)) return '0';
  const n = parseFloat(num);
  if (n === 0) return '0';
  if (Math.abs(n) < 0.000001) return '<0.000001';
  if (Math.abs(n) >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2) + 'K';
  return n.toFixed(decimals);
};

const formatUSD = (num) => {
  if (!num || isNaN(num) || num === 0) return '$0.00';
  if (num < 0.01) return '$' + num.toFixed(4);
  return '$' + formatNumber(num, 2);
};

// ═══════════════════════════════════════════════════════════════════════════
// P&L CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const PnLCard = ({ position, currentPrice }) => {
  if (!position) return null;

  const pnl = calculatePnL(position.buyPrice, currentPrice, position.amount);
  const sign = pnl.isProfit ? '+' : '';

  // Starlight animation
  const stars = Array.from({ length: 20 }, (_, i) => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 50}%`,
    delay: `${Math.random() * 2}s`,
    opacity: Math.random() * 0.5 + 0.3,
  }));

  return (
    <div style={styles.pnlCard}>
      {/* Stars background */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '60%', overflow: 'hidden' }}>
        {stars.map((star, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: star.left,
              top: star.top,
              width: '2px',
              height: '2px',
              background: '#fff',
              borderRadius: '50%',
              opacity: star.opacity,
              animation: `twinkle 2s ease-in-out infinite ${star.delay}`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: GOLD.primary, fontSize: '0.9rem', fontWeight: 700, letterSpacing: '2px' }}>
            ⚜️ DTRADER P&L
          </span>
          <span style={{
            fontSize: '0.7rem',
            color: THEME.text.secondary,
            background: 'rgba(0,0,0,0.5)',
            padding: '4px 10px',
            borderRadius: '10px',
            border: `1px solid ${GOLD.glow}`,
          }}>
            PulseChain
          </span>
        </div>
      </div>

      {/* Token info */}
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '4px' }}>
          ${position.tokenName}
        </div>
        <div style={{ fontSize: '0.8rem', color: THEME.text.muted, fontFamily: 'monospace' }}>
          CA: ...{position.contractAddress?.slice(-4).toUpperCase()}
        </div>
      </div>

      {/* P&L Display */}
      <div style={{
        margin: '24px 0',
        padding: '20px',
        background: 'rgba(0,0,0,0.5)',
        borderRadius: '16px',
        border: `2px solid ${pnl.isProfit ? GOLD.primary : THEME.loss}80`,
      }}>
        <div style={{ fontSize: '0.75rem', color: THEME.text.secondary, letterSpacing: '2px', marginBottom: '8px' }}>
          {pnl.isProfit ? '🏆 PROFIT' : '📉 LOSS'}
        </div>
        <div style={{
          fontSize: '3rem',
          fontWeight: 900,
          ...(pnl.isProfit ? styles.pnlProfit : styles.pnlLoss),
        }}>
          {sign}{pnl.pnlPercent.toFixed(1)}%
        </div>
        <div style={{
          fontSize: '1.2rem',
          color: pnl.isProfit ? GOLD.primary : THEME.loss,
        }}>
          {sign}{formatNumber(pnl.pnlAmount)} PLS
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '12px',
        fontSize: '0.8rem',
      }}>
        <div>
          <div style={{ color: THEME.text.muted }}>Entry</div>
          <div style={{ fontWeight: 600 }}>{formatNumber(position.buyPrice, 6)}</div>
        </div>
        <div>
          <div style={{ color: THEME.text.muted }}>Current</div>
          <div style={{ fontWeight: 600 }}>{formatNumber(currentPrice, 6)}</div>
        </div>
        <div>
          <div style={{ color: THEME.text.muted }}>Amount</div>
          <div style={{ fontWeight: 600 }}>{formatNumber(position.amount)}</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '20px', fontSize: '0.7rem', color: THEME.text.muted }}>
        Powered by <span style={{ color: GOLD.primary, fontWeight: 700 }}>DTGC.io</span>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// TOKEN GATE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const TokenGate = ({ balance, requiredUsd, dtgcPrice, onBuy }) => {
  const valueUsd = balance * dtgcPrice;
  const progress = Math.min((valueUsd / requiredUsd) * 100, 100);
  const isUnlocked = valueUsd >= requiredUsd;

  return (
    <div style={styles.gateCard}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
        {isUnlocked ? '🔓' : '🔐'}
      </div>

      <div style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color: GOLD.primary,
        marginBottom: '8px',
      }}>
        {isUnlocked ? 'Access Granted!' : 'Token Gate'}
      </div>

      <div style={{ color: THEME.text.secondary, marginBottom: '16px' }}>
        {isUnlocked
          ? 'Welcome to DTRADER Premium Features'
          : `Hold $${requiredUsd} DTGC to unlock all features`
        }
      </div>

      <div style={styles.gateProgress}>
        <div style={{ ...styles.gateProgressBar, width: `${progress}%` }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '16px' }}>
        <span style={{ color: THEME.text.secondary }}>Your DTGC</span>
        <span style={{ fontWeight: 600 }}>
          {formatNumber(balance)} <span style={{ color: THEME.text.muted }}>({formatUSD(valueUsd)})</span>
        </span>
      </div>

      {!isUnlocked && (
        <>
          <div style={{
            padding: '12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '12px',
            marginBottom: '16px',
            fontSize: '0.85rem',
          }}>
            <span style={{ color: THEME.text.muted }}>Need:</span>{' '}
            <span style={{ color: GOLD.primary, fontWeight: 600 }}>
              {formatUSD(requiredUsd - valueUsd)} more DTGC
            </span>
          </div>

          <button
            onClick={onBuy}
            style={{ ...styles.button, marginTop: 0 }}
          >
            ⚜️ Buy DTGC on PulseX Gold
          </button>

          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: THEME.text.muted }}>
            Get DTGC at{' '}
            <a
              href={CONFIG.PULSEX_GOLD_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: GOLD.primary }}
            >
              dtgc.io/pulsexgold
            </a>
          </div>
        </>
      )}

      {isUnlocked && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginTop: '16px',
        }}>
          <div style={{
            padding: '16px',
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem' }}>🎯</div>
            <div style={{ fontSize: '0.8rem', color: THEME.text.secondary }}>Sniper</div>
          </div>
          <div style={{
            padding: '16px',
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem' }}>📈</div>
            <div style={{ fontSize: '0.8rem', color: THEME.text.secondary }}>Limit Orders</div>
          </div>
          <div style={{
            padding: '16px',
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem' }}>🤖</div>
            <div style={{ fontSize: '0.8rem', color: THEME.text.secondary }}>Copy Trade</div>
          </div>
          <div style={{
            padding: '16px',
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '12px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.5rem' }}>🛡️</div>
            <div style={{ fontSize: '0.8rem', color: THEME.text.secondary }}>Anti-Rug</div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// SNIPER PANEL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const SniperPanel = ({
  isUnlocked,
  onSnipe,
  showToast,
  sniperWallets,
  selectedWallets,
  generateWallets,
  toggleWallet,
  selectAllWallets,
  deselectAllWallets
}) => {
  // Sniper state
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('10');
  const [sniperType, setSniperType] = useState('instant'); // instant, limit, instabond
  const [limitPrice, setLimitPrice] = useState('');
  const [loading, setLoading] = useState(false);

  // Local UI state
  const [showWallets, setShowWallets] = useState(false);
  const [showPrivateKeys, setShowPrivateKeys] = useState(false);
  const [amountPerWallet, setAmountPerWallet] = useState('');

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast?.(`📋 ${label} copied!`, 'success');
  };

  // Export all wallets
  const exportAllWallets = () => {
    const exportData = sniperWallets.map((w, i) => (
      `Wallet ${i + 1}:\nAddress: ${w.address}\nPrivate Key: ${w.privateKey}\nMnemonic: ${w.mnemonic}\n`
    )).join('\n---\n\n');
    copyToClipboard(exportData, 'All wallet data');
  };

  // Lookup token info
  const lookupToken = async () => {
    if (!tokenAddress || tokenAddress.length !== 42) return;
    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const contract = new ethers.Contract(tokenAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)',
      ], provider);

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().catch(() => 'Unknown'),
        contract.symbol().catch(() => '???'),
        contract.decimals().catch(() => 18),
        contract.totalSupply().catch(() => 0n),
      ]);

      setTokenInfo({
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: ethers.formatUnits(totalSupply, decimals),
        logo: getTokenLogo(tokenAddress, symbol),
      });
    } catch (err) {
      console.error('Token lookup error:', err);
      setTokenInfo(null);
    }
    setLoading(false);
  };

  // Lookup on address change
  React.useEffect(() => {
    if (tokenAddress?.length === 42) {
      lookupToken();
    } else {
      setTokenInfo(null);
    }
  }, [tokenAddress]);

  if (!isUnlocked) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>🎯 Sniper</div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.text.secondary }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <div>Hold $50 DTGC to unlock Sniper + Multi-Wallet</div>
          <a
            href={CONFIG.PULSEX_GOLD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...styles.button,
              display: 'inline-block',
              marginTop: '16px',
              padding: '12px 24px',
              width: 'auto',
              textDecoration: 'none',
            }}
          >
            Get DTGC →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto' }}>
      {/* Main Sniper Card */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          🎯 DTRADER Sniper
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            background: GOLD.glow,
            padding: '4px 8px',
            borderRadius: '6px',
            color: GOLD.primary,
          }}>
            PRO
          </span>
        </div>

        {/* Sniper Type Toggle */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
          background: 'rgba(0,0,0,0.3)',
          padding: '4px',
          borderRadius: '10px',
        }}>
          {['instant', 'limit', 'instabond'].map(type => (
            <button
              key={type}
              onClick={() => setSniperType(type)}
              style={{
                flex: 1,
                padding: '10px 8px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.75rem',
                fontFamily: 'inherit',
                background: sniperType === type
                  ? `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.secondary})`
                  : 'transparent',
                color: sniperType === type ? '#000' : THEME.text.secondary,
              }}
            >
              {type === 'instant' && '⚡ Instant'}
              {type === 'limit' && '📈 Limit'}
              {type === 'instabond' && '🎯 Instabond'}
            </button>
          ))}
        </div>

        {/* Type description */}
        <div style={{
          padding: '10px 12px',
          background: 'rgba(212,175,55,0.1)',
          borderRadius: '10px',
          marginBottom: '16px',
          fontSize: '0.75rem',
          color: THEME.text.secondary,
        }}>
          {sniperType === 'instant' && '⚡ Buy immediately when you click snipe'}
          {sniperType === 'limit' && '📈 Set a target price - auto-buy when price drops to your level'}
          {sniperType === 'instabond' && '🎯 Auto-snipe pump.tires tokens at graduation (200M PLS)'}
        </div>

        {/* Token Address Input */}
        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Token Contract Address</label>
          <input
            style={{ ...styles.input, fontSize: '0.9rem' }}
            placeholder="0x... (paste token CA)"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
          />
        </div>

        {/* Token Info Display */}
        {tokenInfo && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            background: 'rgba(76,175,80,0.1)',
            borderRadius: '12px',
            marginBottom: '12px',
            border: '1px solid rgba(76,175,80,0.3)',
          }}>
            <TokenIcon
              address={tokenAddress}
              symbol={tokenInfo.symbol}
              emoji="🔸"
              size={40}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{tokenInfo.symbol}</div>
              <div style={{ fontSize: '0.75rem', color: THEME.text.muted }}>{tokenInfo.name}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.7rem', color: THEME.text.muted }}>
              <div>Supply: {parseFloat(tokenInfo.totalSupply).toLocaleString()}</div>
              <div>Decimals: {tokenInfo.decimals}</div>
            </div>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '12px', color: THEME.text.muted }}>
            Looking up token...
          </div>
        )}

        {/* Limit Price (for limit orders) */}
        {sniperType === 'limit' && (
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>Target Price (PLS per token)</label>
            <input
              style={styles.input}
              placeholder="0.0000001"
              type="number"
              value={limitPrice}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          </div>
        )}

        {/* Amount & Slippage */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ ...styles.inputGroup, flex: 2 }}>
            <label style={styles.inputLabel}>
              {selectedWallets.length > 1 ? 'Amount Per Wallet (PLS)' : 'Amount (PLS)'}
            </label>
            <input
              style={styles.input}
              placeholder="0.0"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div style={{ ...styles.inputGroup, flex: 1 }}>
            <label style={styles.inputLabel}>Slippage %</label>
            <input
              style={styles.input}
              placeholder="10"
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
            />
          </div>
        </div>

        {/* Wallet Selection Summary */}
        {sniperWallets.length > 0 && (
          <div
            onClick={() => setShowWallets(!showWallets)}
            style={{
              padding: '12px',
              background: 'rgba(212,175,55,0.1)',
              borderRadius: '10px',
              marginBottom: '12px',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.85rem' }}>
              👛 Using {selectedWallets.length} of {sniperWallets.length} wallets
            </span>
            <span style={{ color: GOLD.primary }}>{showWallets ? '▲' : '▼'}</span>
          </div>
        )}

        {/* Snipe Button */}
        <button
          style={{
            ...styles.button,
            background: sniperType === 'instant'
              ? 'linear-gradient(135deg, #4CAF50, #2E7D32)'
              : `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.secondary})`,
          }}
          onClick={() => onSnipe?.({
            tokenAddress,
            tokenInfo,
            amount,
            slippage,
            type: sniperType,
            limitPrice,
            wallets: selectedWallets,
          })}
        >
          {sniperType === 'instant' ? '⚡ SNIPE NOW' : sniperType === 'limit' ? '📈 Set Limit Order' : '🎯 Arm Instabond Sniper'}
        </button>
      </div>

      {/* Multi-Wallet Management Card */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          👛 Multi-Wallet System
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.65rem',
            background: 'rgba(76,175,80,0.2)',
            padding: '4px 8px',
            borderRadius: '6px',
            color: THEME.profit,
          }}>
            6 WALLETS
          </span>
        </div>

        {sniperWallets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔐</div>
            <div style={{ color: THEME.text.secondary, marginBottom: '16px', fontSize: '0.85rem' }}>
              Generate 6 fresh wallets for sniping
            </div>
            <button
              onClick={generateWallets}
              style={styles.button}
            >
              🎲 Generate 6 Wallets
            </button>
          </div>
        ) : (
          <>
            {/* Wallet List */}
            <div style={{ marginBottom: '12px' }}>
              {sniperWallets.map((wallet, i) => (
                <div
                  key={wallet.address}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: selectedWallets.includes(wallet.address)
                      ? 'rgba(212,175,55,0.15)'
                      : 'rgba(0,0,0,0.2)',
                    borderRadius: '10px',
                    marginBottom: '6px',
                    border: selectedWallets.includes(wallet.address)
                      ? `1px solid ${GOLD.glow}`
                      : '1px solid transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleWallet(wallet.address)}
                >
                  <input
                    type="checkbox"
                    checked={selectedWallets.includes(wallet.address)}
                    onChange={() => {}}
                    style={{ accentColor: GOLD.primary }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Wallet {i + 1}</div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: THEME.text.muted,
                      fontFamily: 'monospace',
                    }}>
                      {wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyToClipboard(wallet.address, 'Address'); }}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: THEME.text.secondary,
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                    }}
                  >
                    📋
                  </button>
                </div>
              ))}
            </div>

            {/* Wallet Actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={selectAllWallets}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: THEME.text.primary,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                }}
              >
                ✅ Select All
              </button>
              <button
                onClick={deselectAllWallets}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  color: THEME.text.primary,
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                }}
              >
                ❌ Deselect All
              </button>
            </div>

            {/* Private Key Section */}
            <div style={{
              background: 'rgba(255,68,68,0.1)',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid rgba(255,68,68,0.3)',
            }}>
              <div
                onClick={() => setShowPrivateKeys(!showPrivateKeys)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: '0.85rem', color: THEME.loss }}>
                  🔐 Private Keys {showPrivateKeys ? '(Click to hide)' : '(Click to reveal)'}
                </span>
                <span>{showPrivateKeys ? '🙈' : '👁️'}</span>
              </div>

              {showPrivateKeys && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{
                    padding: '10px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    fontSize: '0.7rem',
                    color: THEME.loss,
                  }}>
                    ⚠️ NEVER share your private keys! Store them safely offline.
                  </div>

                  {sniperWallets.map((wallet, i) => (
                    <div
                      key={`pk-${wallet.address}`}
                      style={{
                        padding: '8px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Wallet {i + 1}</span>
                        <button
                          onClick={() => copyToClipboard(wallet.privateKey, `Wallet ${i + 1} Private Key`)}
                          style={{
                            background: GOLD.glow,
                            border: 'none',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            color: GOLD.primary,
                            cursor: 'pointer',
                            fontSize: '0.65rem',
                          }}
                        >
                          Copy Key
                        </button>
                      </div>
                      <div style={{
                        fontSize: '0.6rem',
                        fontFamily: 'monospace',
                        color: THEME.text.muted,
                        wordBreak: 'break-all',
                      }}>
                        {wallet.privateKey}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={exportAllWallets}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(212,175,55,0.2)',
                      border: `1px solid ${GOLD.glow}`,
                      borderRadius: '8px',
                      color: GOLD.primary,
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                      marginTop: '8px',
                    }}
                  >
                    📥 Export All Wallets (Copy All)
                  </button>
                </div>
              )}
            </div>

            {/* Regenerate Button */}
            <button
              onClick={() => {
                if (window.confirm('⚠️ This will DELETE all current wallets and generate new ones. Make sure you\'ve saved your private keys!')) {
                  generateWallets();
                }
              }}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                background: 'transparent',
                border: `1px solid ${THEME.loss}`,
                borderRadius: '8px',
                color: THEME.loss,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontFamily: 'inherit',
              }}
            >
              🔄 Generate New Wallets (Warning: Deletes Current)
            </button>
          </>
        )}
      </div>

      {/* Telegram Link */}
      <div style={{
        textAlign: 'center',
        padding: '16px',
        fontSize: '0.75rem',
        color: THEME.text.muted,
      }}>
        Also available on{' '}
        <a href={CONFIG.TELEGRAM_BOT} target="_blank" rel="noopener noreferrer" style={{ color: GOLD.primary }}>
          Telegram Bot
        </a>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// LIMIT ORDERS PANEL
// ═══════════════════════════════════════════════════════════════════════════

const LimitOrdersPanel = ({ isUnlocked, orders, onCreateOrder }) => {
  const [orderType, setOrderType] = useState('buy'); // buy, sell, stopLoss, takeProfit
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [targetPrice, setTargetPrice] = useState('');

  if (!isUnlocked) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>📈 Limit Orders</div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.text.secondary }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <div>Hold $50 DTGC to unlock Limit Orders</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>
        📈 Limit Orders
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.7rem',
          background: GOLD.glow,
          padding: '4px 8px',
          borderRadius: '6px',
          color: GOLD.primary,
        }}>
          PRO
        </span>
      </div>

      {/* Order Type Toggle */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '4px',
        marginBottom: '16px',
        background: 'rgba(0,0,0,0.3)',
        padding: '4px',
        borderRadius: '10px',
      }}>
        {['buy', 'sell', 'stopLoss', 'takeProfit'].map((type) => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            style={{
              padding: '8px 4px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.7rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              background: orderType === type
                ? `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.secondary})`
                : 'transparent',
              color: orderType === type ? '#000' : THEME.text.secondary,
            }}
          >
            {type === 'buy' && '💰 Buy'}
            {type === 'sell' && '💸 Sell'}
            {type === 'stopLoss' && '🛑 SL'}
            {type === 'takeProfit' && '🎯 TP'}
          </button>
        ))}
      </div>

      <div style={styles.inputGroup}>
        <label style={styles.inputLabel}>Token Address</label>
        <input
          style={styles.input}
          placeholder="0x..."
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ ...styles.inputGroup, flex: 1 }}>
          <label style={styles.inputLabel}>Amount (PLS)</label>
          <input
            style={styles.input}
            placeholder="0.0"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div style={{ ...styles.inputGroup, flex: 1 }}>
          <label style={styles.inputLabel}>Target Price</label>
          <input
            style={styles.input}
            placeholder="0.0"
            type="number"
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
          />
        </div>
      </div>

      <button
        style={styles.button}
        onClick={() => onCreateOrder({ type: orderType, tokenAddress, amount, targetPrice })}
      >
        Create {orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order
      </button>

      {/* Active Orders */}
      {orders && orders.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '0.85rem', color: THEME.text.secondary, marginBottom: '12px' }}>
            Active Orders ({orders.length})
          </div>
          {orders.map((order, i) => (
            <div key={i} style={styles.statsRow}>
              <span>{order.type} {order.tokenSymbol}</span>
              <span style={{ color: GOLD.primary }}>{order.targetPrice}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// BOND SNIPER PANEL - pump.tires Integration
// ═══════════════════════════════════════════════════════════════════════════

// Filter options for pump.tires feed (matching their UI)
const PUMP_FILTER_OPTIONS = [
  { value: 'activity', label: '🔥 Recent Activity' },
  { value: 'latest_timestamp', label: '⏰ Latest Updates' },
  { value: 'created_timestamp', label: '✨ Recently Created' },
  { value: 'market_value', label: '💰 Market Value' },
  { value: 'latest_burn_timestamp', label: '🔥 Recent Burns' },
];

const BondSniperPanel = ({ isUnlocked, showToast, sniperWallets, selectedWallets }) => {
  // Bond sniper state
  const [preBondedTokens, setPreBondedTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState(null);
  const [snipeAmount, setSnipeAmount] = useState('');
  const [gasPrice, setGasPrice] = useState('0.01'); // in gwei
  const [maxGas, setMaxGas] = useState('500000');
  const [feedFilter, setFeedFilter] = useState('activity');
  const [armedSnipes, setArmedSnipes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dtrader-armed-snipes') || '[]');
    } catch { return []; }
  });

  // pump.tires API endpoints - use our proxy to handle CORS
  const PUMP_TIRES_PROXY = '/api/pump-tokens'; // Our Vercel proxy
  const PUMP_TIRES_DIRECT = 'https://pump.tires/api'; // Fallback
  const PUMP_TIRES_IPFS = 'https://ipfs-pump-tires.b-cdn.net/ipfs';
  const TARGET_TOKENS_SOLD = 800_000_000; // 800M tokens = graduation

  // Fetch pre-bonded tokens from pump.tires (via our CORS proxy)
  const fetchPreBondedTokens = async (filterType = feedFilter) => {
    setLoading(true);
    try {
      // Try our proxy first (handles CORS), fallback to direct
      let response;
      try {
        response = await fetch(`${PUMP_TIRES_PROXY}?filter=${filterType}&page=1`);
      } catch {
        // Fallback to direct if proxy unavailable (dev mode)
        response = await fetch(`${PUMP_TIRES_DIRECT}/tokens?filter=${filterType}&page=1`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Filter for pre-bonded tokens only (is_launched === false)
      // Transform to our internal format
      const preBonded = (data.tokens || [])
        .filter(t => !t.is_launched)
        .map(t => ({
          address: t.address,
          name: t.name,
          symbol: t.symbol,
          creator: t.creator?.address || 'Unknown',
          creatorName: t.creator?.username || 'Anonymous',
          progress: (parseFloat(t.tokens_sold || 0) / TARGET_TOKENS_SOLD) * 100,
          tokensSold: t.tokens_sold,
          currentLiquidity: t.tokens_sold, // tokens sold represents progress
          targetLiquidity: TARGET_TOKENS_SOLD.toString(),
          price: t.price || '0',
          marketValue: t.market_value || '0',
          logo: t.image_cid ? `${PUMP_TIRES_IPFS}/${t.image_cid}` : null,
          description: t.description || '',
          createdAt: parseInt(t.created_timestamp || 0) * 1000,
          lastActivity: parseInt(t.latest_timestamp || 0) * 1000,
          trades: {
            buys: t.latest_trade_batch?.total_buys || 0,
            sells: t.latest_trade_batch?.total_sells || 0,
          },
          web: t.web,
          telegram: t.telegram,
          twitter: t.twitter,
        }));

      setPreBondedTokens(preBonded);

      if (preBonded.length === 0) {
        console.log('No pre-bonded tokens found - all may have graduated');
      }
    } catch (err) {
      console.error('Failed to fetch pre-bonded tokens:', err);

      // Fallback: Try direct connection or show helpful message
      if (err.message.includes('Failed to fetch') || err.message.includes('CORS')) {
        showToast?.('pump.tires API unavailable - open pump.tires in new tab', 'info');
      } else {
        showToast?.(`API Error: ${err.message}`, 'error');
      }

      // Keep existing tokens if any
      if (preBondedTokens.length === 0) {
        setPreBondedTokens([]);
      }
    }
    setLoading(false);
  };

  // Arm a bond snipe
  const armBondSnipe = (token) => {
    const snipe = {
      id: Date.now(),
      token,
      amount: snipeAmount,
      gasPrice,
      maxGas,
      wallets: selectedWallets || [],
      armedAt: Date.now(),
      status: 'armed',
    };

    const updated = [...armedSnipes, snipe];
    setArmedSnipes(updated);
    localStorage.setItem('dtrader-armed-snipes', JSON.stringify(updated));
    setSelectedToken(null);
    setSnipeAmount('');
    showToast?.(`🎯 Bond snipe armed for ${token.symbol}!`, 'success');
  };

  // Remove armed snipe
  const removeSnipe = (id) => {
    const updated = armedSnipes.filter(s => s.id !== id);
    setArmedSnipes(updated);
    localStorage.setItem('dtrader-armed-snipes', JSON.stringify(updated));
    showToast?.('Snipe removed', 'info');
  };

  // Format number
  const formatNum = (num) => {
    const n = parseFloat(num);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(2);
  };

  // Load tokens on mount and when filter changes
  React.useEffect(() => {
    fetchPreBondedTokens(feedFilter);
    // Refresh every 5 seconds (matching pump.tires)
    const interval = setInterval(() => fetchPreBondedTokens(feedFilter), 5000);
    return () => clearInterval(interval);
  }, [feedFilter]);

  if (!isUnlocked) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>🔥 Bond Sniper</div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.text.secondary }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <div>Hold $50 DTGC to unlock Bond Sniper</div>
          <a
            href={CONFIG.PULSEX_GOLD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...styles.button,
              display: 'inline-block',
              marginTop: '16px',
              padding: '12px 24px',
              width: 'auto',
              textDecoration: 'none',
            }}
          >
            Get DTGC →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '550px', margin: '0 auto' }}>
      {/* Header */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          🔥 pump.tires Bond Sniper
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.65rem',
            background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
            padding: '4px 8px',
            borderRadius: '6px',
            color: '#fff',
          }}>
            LIVE
          </span>
        </div>

        <div style={{
          padding: '12px',
          background: 'rgba(255,107,107,0.1)',
          borderRadius: '12px',
          marginBottom: '16px',
          fontSize: '0.8rem',
          color: THEME.text.secondary,
        }}>
          <div style={{ marginBottom: '8px' }}>
            ⚡ <strong>How it works:</strong>
          </div>
          <div style={{ lineHeight: 1.6 }}>
            1. Browse pre-bonded tokens from pump.tires<br/>
            2. Click a token to set up your snipe<br/>
            3. Set gas & amount → Arm snipe<br/>
            4. Auto-buys when token graduates to PulseX (200M PLS)
          </div>
        </div>

        {/* Filter Dropdown + Refresh */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={feedFilter}
            onChange={(e) => setFeedFilter(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: 'rgba(0,0,0,0.4)',
              border: `1px solid ${GOLD.glow}`,
              borderRadius: '10px',
              color: THEME.text.primary,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23D4AF37' d='M6 8L2 4h8z'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '32px',
            }}
          >
            {PUMP_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} style={{ background: '#1a1a1a' }}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchPreBondedTokens(feedFilter)}
            disabled={loading}
            style={{
              padding: '10px 16px',
              background: 'rgba(255,255,255,0.1)',
              border: `1px solid ${GOLD.glow}`,
              borderRadius: '10px',
              color: GOLD.primary,
              cursor: loading ? 'wait' : 'pointer',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* Armed Snipes */}
      {armedSnipes.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            🎯 Armed Snipes
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.7rem',
              background: 'rgba(76,175,80,0.2)',
              padding: '4px 8px',
              borderRadius: '6px',
              color: THEME.profit,
            }}>
              {armedSnipes.length} Active
            </span>
          </div>

          {armedSnipes.map((snipe) => (
            <div
              key={snipe.id}
              style={{
                padding: '12px',
                background: 'rgba(76,175,80,0.1)',
                borderRadius: '12px',
                marginBottom: '8px',
                border: '1px solid rgba(76,175,80,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{snipe.token.symbol}</div>
                  <div style={{ fontSize: '0.75rem', color: THEME.text.muted }}>
                    {snipe.amount} PLS × {snipe.wallets?.length || 1} wallet(s)
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: '0.7rem',
                    background: 'rgba(255,193,7,0.2)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    color: '#FFC107',
                    marginBottom: '4px',
                  }}>
                    {snipe.token.progress}% to bond
                  </div>
                  <button
                    onClick={() => removeSnipe(snipe.id)}
                    style={{
                      background: 'rgba(255,68,68,0.2)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      color: THEME.loss,
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pre-Bonded Tokens List */}
      <div style={styles.card}>
        <div style={styles.cardTitle}>
          📊 Pre-Bonded Tokens
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.7rem',
            color: THEME.text.muted,
          }}>
            {preBondedTokens.length} tokens
          </span>
        </div>

        {loading && preBondedTokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: THEME.text.muted }}>
            Loading tokens from pump.tires...
          </div>
        ) : preBondedTokens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: THEME.text.muted }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>
            No pre-bonded tokens found.<br/>
            <a
              href="https://pump.tires"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: GOLD.primary }}
            >
              Visit pump.tires →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {preBondedTokens.map((token) => (
              <div
                key={token.address}
                onClick={() => setSelectedToken(token)}
                style={{
                  padding: '14px',
                  background: selectedToken?.address === token.address
                    ? 'rgba(212,175,55,0.15)'
                    : 'rgba(0,0,0,0.3)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: selectedToken?.address === token.address
                    ? `1px solid ${GOLD.primary}`
                    : '1px solid rgba(255,255,255,0.05)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Token Logo */}
                  {token.logo ? (
                    <img
                      src={token.logo}
                      alt={token.symbol}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(255,255,255,0.1)',
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                    display: token.logo ? 'none' : 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem',
                    fontWeight: 700,
                  }}>
                    {token.symbol?.slice(0, 2)}
                  </div>

                  {/* Token Info */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{token.symbol}</span>
                      <span style={{
                        fontSize: '0.65rem',
                        background: token.progress >= 80 ? 'rgba(76,175,80,0.3)' : 'rgba(255,193,7,0.2)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        color: token.progress >= 80 ? '#4CAF50' : '#FFC107',
                      }}>
                        {token.progress.toFixed(1)}%
                      </span>
                      {token.trades && (token.trades.buys > 0 || token.trades.sells > 0) && (
                        <span style={{
                          fontSize: '0.6rem',
                          color: THEME.text.muted,
                        }}>
                          <span style={{ color: '#4CAF50' }}>↑{token.trades.buys}</span>
                          {' / '}
                          <span style={{ color: '#f44336' }}>↓{token.trades.sells}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: THEME.text.muted }}>
                      {token.name}
                    </div>
                    {token.marketValue && parseFloat(token.marketValue) > 0 && (
                      <div style={{ fontSize: '0.65rem', color: GOLD.primary }}>
                        ${formatNum(token.marketValue)} mcap
                      </div>
                    )}
                  </div>

                  {/* Progress to Bond */}
                  <div style={{ textAlign: 'right', minWidth: '90px' }}>
                    <div style={{ fontSize: '0.65rem', color: THEME.text.muted }}>
                      {formatNum(token.tokensSold || token.currentLiquidity)} / {formatNum(TARGET_TOKENS_SOLD)}
                    </div>
                    {/* Progress bar */}
                    <div style={{
                      width: '90px',
                      height: '6px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      marginTop: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${Math.min(token.progress, 100)}%`,
                        height: '100%',
                        background: token.progress >= 80
                          ? 'linear-gradient(90deg, #4CAF50, #8BC34A)'
                          : token.progress >= 50
                            ? `linear-gradient(90deg, ${GOLD.primary}, ${GOLD.light})`
                            : 'linear-gradient(90deg, #FF6B6B, #FF8E53)',
                        borderRadius: '3px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    {token.progress >= 80 && (
                      <div style={{ fontSize: '0.6rem', color: '#4CAF50', marginTop: '2px' }}>
                        🚀 Near Graduation!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Snipe Setup Modal */}
      {selectedToken && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>
            ⚡ Set Up Bond Snipe
            <button
              onClick={() => setSelectedToken(null)}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: THEME.text.muted,
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
            >
              ×
            </button>
          </div>

          {/* Selected Token */}
          <div style={{
            padding: '14px',
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              fontWeight: 700,
            }}>
              {selectedToken.symbol?.slice(0, 2)}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{selectedToken.symbol}</div>
              <div style={{ fontSize: '0.75rem', color: THEME.text.muted }}>{selectedToken.name}</div>
              <div style={{ fontSize: '0.7rem', color: GOLD.primary, marginTop: '2px' }}>
                {selectedToken.progress}% to graduation
              </div>
            </div>
          </div>

          {/* Amount */}
          <div style={styles.inputGroup}>
            <label style={styles.inputLabel}>
              Amount per Wallet (PLS)
              {selectedWallets?.length > 1 && (
                <span style={{ color: THEME.text.muted }}>
                  {' '}× {selectedWallets.length} wallets = {parseFloat(snipeAmount || 0) * selectedWallets.length} PLS total
                </span>
              )}
            </label>
            <input
              style={styles.input}
              placeholder="1000"
              type="number"
              value={snipeAmount}
              onChange={(e) => setSnipeAmount(e.target.value)}
            />
          </div>

          {/* Gas Settings */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.inputLabel}>Gas Price (Gwei)</label>
              <input
                style={styles.input}
                placeholder="0.01"
                type="number"
                step="0.001"
                value={gasPrice}
                onChange={(e) => setGasPrice(e.target.value)}
              />
            </div>
            <div style={{ ...styles.inputGroup, flex: 1 }}>
              <label style={styles.inputLabel}>Max Gas</label>
              <input
                style={styles.input}
                placeholder="500000"
                type="number"
                value={maxGas}
                onChange={(e) => setMaxGas(e.target.value)}
              />
            </div>
          </div>

          {/* Gas Presets */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {[
              { label: '🐢 Low', gwei: '0.005' },
              { label: '🚶 Med', gwei: '0.01' },
              { label: '🚀 High', gwei: '0.05' },
              { label: '⚡ Turbo', gwei: '0.1' },
            ].map((preset) => (
              <button
                key={preset.gwei}
                onClick={() => setGasPrice(preset.gwei)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: gasPrice === preset.gwei ? `1px solid ${GOLD.primary}` : '1px solid rgba(255,255,255,0.1)',
                  background: gasPrice === preset.gwei ? 'rgba(212,175,55,0.2)' : 'rgba(0,0,0,0.2)',
                  color: gasPrice === preset.gwei ? GOLD.primary : THEME.text.secondary,
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontFamily: 'inherit',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Wallet Info */}
          {sniperWallets?.length > 0 && (
            <div style={{
              padding: '10px 12px',
              background: 'rgba(76,175,80,0.1)',
              borderRadius: '10px',
              marginBottom: '16px',
              fontSize: '0.8rem',
              color: THEME.profit,
            }}>
              👛 Using {selectedWallets?.length || 0} of {sniperWallets.length} sniper wallets
            </div>
          )}

          {/* Arm Button */}
          <button
            onClick={() => armBondSnipe(selectedToken)}
            disabled={!snipeAmount}
            style={{
              ...styles.button,
              background: snipeAmount
                ? 'linear-gradient(135deg, #FF6B6B, #FF8E53)'
                : 'rgba(255,255,255,0.1)',
              color: snipeAmount ? '#fff' : '#666',
              cursor: snipeAmount ? 'pointer' : 'not-allowed',
            }}
          >
            🎯 ARM BOND SNIPE
          </button>

          <div style={{
            marginTop: '12px',
            fontSize: '0.7rem',
            color: THEME.text.muted,
            textAlign: 'center',
          }}>
            Will auto-execute when {selectedToken.symbol} graduates to PulseX
          </div>
        </div>
      )}

      {/* Link to pump.tires */}
      <div style={{
        textAlign: 'center',
        padding: '16px',
        fontSize: '0.8rem',
      }}>
        <a
          href="https://pump.tires"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: GOLD.primary,
            textDecoration: 'none',
          }}
        >
          Open pump.tires →
        </a>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function PulseXGold({ provider, signer, userAddress, onClose }) {
  const [activeTab, setActiveTab] = useState('swap');
  const [toast, setToast] = useState(null);

  // Wallet state
  const [balances, setBalances] = useState({});
  const [dtgcBalance, setDtgcBalance] = useState(0);
  const [dtgcPrice, setDtgcPrice] = useState(0.0007);

  // Swap state
  const [fromToken, setFromToken] = useState('PLS');
  const [toToken, setToToken] = useState('DTGC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);

  // Token gate
  const isUnlocked = (dtgcBalance * dtgcPrice) >= CONFIG.DTGC_MIN_USD;

  // P&L state
  const [positions, setPositions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);

  // Orders state
  const [limitOrders, setLimitOrders] = useState([]);

  // Shared sniper wallets state (used by SniperPanel and BondSniperPanel)
  const [sniperWallets, setSniperWallets] = useState(() => {
    try {
      const saved = localStorage.getItem('dtrader-sniper-wallets');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selectedWallets, setSelectedWallets] = useState([]);

  // Wallet management functions (shared between panels)
  const generateWallets = useCallback(() => {
    const newWallets = [];
    for (let i = 0; i < 6; i++) {
      const wallet = ethers.Wallet.createRandom();
      newWallets.push({
        id: i + 1,
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase || '',
        balance: '0',
        selected: true,
      });
    }
    setSniperWallets(newWallets);
    setSelectedWallets(newWallets.map(w => w.address));
    localStorage.setItem('dtrader-sniper-wallets', JSON.stringify(newWallets));
    showToastMsg('✅ Generated 6 new sniper wallets!', 'success');
  }, []);

  const toggleWallet = useCallback((address) => {
    setSelectedWallets(prev =>
      prev.includes(address)
        ? prev.filter(a => a !== address)
        : [...prev, address]
    );
  }, []);

  const selectAllWallets = useCallback(() => {
    setSelectedWallets(sniperWallets.map(w => w.address));
  }, [sniperWallets]);

  const deselectAllWallets = useCallback(() => {
    setSelectedWallets([]);
  }, []);

  const showToastMsg = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // Fetch balances
  const fetchBalances = useCallback(async () => {
    if (!provider || !userAddress) return;

    try {
      const newBalances = {};

      // Get PLS balance
      const plsBalance = await provider.getBalance(userAddress);
      newBalances.PLS = parseFloat(ethers.formatEther(plsBalance));

      // Get DTGC balance
      const dtgcContract = new ethers.Contract(CONFIG.DTGC_ADDRESS, ERC20_ABI, provider);
      const dtgcBal = await dtgcContract.balanceOf(userAddress);
      newBalances.DTGC = parseFloat(ethers.formatEther(dtgcBal));
      setDtgcBalance(newBalances.DTGC);

      setBalances(newBalances);
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  }, [provider, userAddress]);

  // Fetch DTGC price
  const fetchDtgcPrice = useCallback(async () => {
    try {
      const res = await fetch(`${CONFIG.DEXSCREENER_API}/pairs/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7`);
      if (res.ok) {
        const data = await res.json();
        if (data?.pair?.priceUsd) {
          setDtgcPrice(parseFloat(data.pair.priceUsd));
        }
      }
    } catch (err) {
      console.log('DTGC price fetch failed:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchBalances();
    fetchDtgcPrice();
    const interval = setInterval(() => {
      fetchBalances();
      fetchDtgcPrice();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchBalances, fetchDtgcPrice]);

  // Get quote for swap
  const getQuote = useCallback(async (amount, from, to) => {
    if (!amount || parseFloat(amount) <= 0 || !provider) {
      setToAmount('');
      return;
    }

    try {
      const fromData = TOKENS[from];
      const toData = TOKENS[to];
      if (!fromData || !toData) return;

      const rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, rpcProvider);

      const amountIn = ethers.parseUnits(amount, fromData.decimals);
      const path = from === 'PLS' || fromData.isNative
        ? [CONFIG.WPLS, toData.address]
        : to === 'PLS' || toData.isNative
          ? [fromData.address, CONFIG.WPLS]
          : [fromData.address, CONFIG.WPLS, toData.address];

      const amounts = await router.getAmountsOut(amountIn, path);
      setToAmount(parseFloat(ethers.formatUnits(amounts[amounts.length - 1], toData.decimals)).toFixed(6));
    } catch (err) {
      console.error('Quote error:', err);
      setToAmount('');
    }
  }, [provider]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount && fromToken && toToken) {
        getQuote(fromAmount, fromToken, toToken);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, getQuote]);

  // Execute swap
  const executeSwap = async () => {
    if (!signer || !fromAmount || !toAmount) return;
    setSwapLoading(true);
    showToastMsg('Preparing swap...', 'info');

    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
      const fromData = TOKENS[fromToken];
      const toData = TOKENS[toToken];

      const amountIn = ethers.parseUnits(fromAmount, fromData.decimals);
      const amountOutMin = ethers.parseUnits(toAmount, toData.decimals) * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      const deadline = Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

      const path = fromToken === 'PLS' || fromData.isNative
        ? [CONFIG.WPLS, toData.address]
        : toToken === 'PLS' || toData.isNative
          ? [fromData.address, CONFIG.WPLS]
          : [fromData.address, CONFIG.WPLS, toData.address];

      // Calculate 1% fee split: 0.5% buy & burn DTGC + 0.5% dev wallet
      const totalFee = amountIn * BigInt(CONFIG.FEES.TOTAL_BPS) / 10000n;
      const buyBurnFee = totalFee / 2n;  // 0.5% for buy & burn DTGC
      const devFee = totalFee - buyBurnFee; // 0.5% to dev wallet
      const swapAmount = amountIn - totalFee;

      if (fromToken === 'PLS' || fromData.isNative) {
        // Process fees first
        showToastMsg('🔥 Processing 0.5% buy & burn DTGC...', 'info');

        // 1. Buy DTGC with 0.5% and send to burn address
        const dtgcPath = [CONFIG.WPLS, CONFIG.DTGC_ADDRESS];
        try {
          const burnTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
            0n, // Accept any amount of DTGC (it's going to burn anyway)
            dtgcPath,
            CONFIG.BURN_ADDRESS, // Send directly to burn address
            deadline,
            { value: buyBurnFee }
          );
          await burnTx.wait();
          showToastMsg('🔥 DTGC bought & burned!', 'success');
        } catch (burnErr) {
          console.error('Buy & burn failed, sending to dev:', burnErr);
          // Fallback: if buy & burn fails, add to dev fee
        }

        // 2. Send 0.5% to dev wallet in PLS
        showToastMsg('💰 Sending 0.5% to dev...', 'info');
        const devTx = await signer.sendTransaction({
          to: CONFIG.DEV_WALLET,
          value: devFee,
        });
        await devTx.wait();

        // Execute main swap
        showToastMsg('Swapping via PulseX...', 'info');
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          amountOutMin,
          path,
          userAddress,
          deadline,
          { value: swapAmount }
        );
        await tx.wait();
      } else if (toToken === 'PLS' || toData.isNative) {
        // Token to PLS - approve and swap, then take fees from output
        const tokenContract = new ethers.Contract(fromData.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amountIn) {
          showToastMsg(`Approving ${fromToken}...`, 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }

        // Get PLS balance before swap
        const plsBalanceBefore = await provider.getBalance(userAddress);

        showToastMsg('Swapping via PulseX...', 'info');
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn,
          amountOutMin,
          path,
          userAddress,
          deadline
        );
        await tx.wait();

        // Calculate fees from received PLS
        const plsBalanceAfter = await provider.getBalance(userAddress);
        const plsReceived = plsBalanceAfter - plsBalanceBefore;
        const outputFee = plsReceived * BigInt(CONFIG.FEES.TOTAL_BPS) / 10000n;
        const outputBuyBurn = outputFee / 2n;
        const outputDevFee = outputFee - outputBuyBurn;

        if (outputFee > 0n) {
          showToastMsg('🔥 Processing 1% fee from output...', 'info');

          // Buy & burn DTGC with 0.5%
          try {
            const dtgcPath = [CONFIG.WPLS, CONFIG.DTGC_ADDRESS];
            const burnTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
              0n,
              dtgcPath,
              CONFIG.BURN_ADDRESS,
              deadline,
              { value: outputBuyBurn }
            );
            await burnTx.wait();
          } catch (e) { console.error('Buy burn failed:', e); }

          // Send 0.5% to dev
          const devTx = await signer.sendTransaction({
            to: CONFIG.DEV_WALLET,
            value: outputDevFee,
          });
          await devTx.wait();
        }
      } else {
        // Token to token - swap via PLS path, take fees in PLS
        const tokenContract = new ethers.Contract(fromData.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amountIn) {
          showToastMsg(`Approving ${fromToken}...`, 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }

        showToastMsg('Swapping via PulseX...', 'info');
        const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
          amountIn,
          amountOutMin,
          path,
          userAddress,
          deadline
        );
        await tx.wait();

        // Note: For token-to-token, fees are harder to collect in PLS
        // Could implement later with an intermediate swap step
        showToastMsg('ℹ️ Token-to-token: fees applied on next PLS swap', 'info');
      }

      showToastMsg(`✅ Swapped ${fromAmount} ${fromToken} for ${toToken}!`, 'success');
      setFromAmount('');
      setToAmount('');
      fetchBalances();
    } catch (err) {
      console.error('Swap error:', err);
      showToastMsg(err.reason || err.message || 'Swap failed', 'error');
    }
    setSwapLoading(false);
  };

  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // Token Selector Modal
  const TokenSelectorModal = ({ show, onSelect, excludeToken, onClose }) => {
    if (!show) return null;

    return (
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: THEME.bg.secondary,
            border: `1px solid ${GOLD.glow}`,
            borderRadius: '20px',
            padding: '20px',
            maxHeight: '70vh',
            overflow: 'auto',
            width: '100%',
            maxWidth: '400px',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <span style={{ fontWeight: 700, color: GOLD.primary, fontSize: '1.1rem' }}>
              Select Token
            </span>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: THEME.text.muted,
                fontSize: '1.5rem',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(TOKENS)
              .filter(([symbol]) => symbol !== excludeToken)
              .map(([symbol, token]) => (
                <div
                  key={symbol}
                  onClick={() => { onSelect(symbol); onClose(); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(212,175,55,0.1)';
                    e.currentTarget.style.borderColor = GOLD.glow;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.3)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                  }}
                >
                  <TokenIcon
                    address={token.address}
                    symbol={symbol}
                    emoji={token.emoji}
                    size={36}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '1rem' }}>{symbol}</div>
                    <div style={{ fontSize: '0.75rem', color: THEME.text.muted }}>
                      {token.name}
                    </div>
                  </div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: THEME.text.muted,
                    fontFamily: 'monospace',
                  }}>
                    {token.address?.slice(0, 6)}...{token.address?.slice(-4)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  };

  // Render tabs
  const tabs = [
    { id: 'swap', label: '⚡ Swap', emoji: '⚡' },
    { id: 'bonds', label: '🔥 Bonds', emoji: '🔥' },
    { id: 'sniper', label: '🎯 Sniper', emoji: '🎯' },
    { id: 'orders', label: '📈 Orders', emoji: '📈' },
    { id: 'gate', label: '🔐 Gate', emoji: '🔐' },
  ];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>⚜️ PULSEX GOLD</div>
        <div style={styles.subtitle}>DTRADER EDITION • POWERED BY DTGC.IO</div>

        {/* Wallet info */}
        {userAddress && (
          <div style={{
            marginTop: '16px',
            fontSize: '0.8rem',
            color: THEME.text.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}>
            <span style={{
              background: 'rgba(0,0,0,0.4)',
              padding: '6px 12px',
              borderRadius: '8px',
              fontFamily: 'monospace',
            }}>
              {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </span>
            <span style={{ color: GOLD.primary }}>
              {formatNumber(balances.PLS || 0)} PLS
            </span>
            <span style={{
              background: isUnlocked ? 'rgba(76,175,80,0.2)' : 'rgba(255,68,68,0.2)',
              padding: '4px 8px',
              borderRadius: '6px',
              color: isUnlocked ? THEME.profit : THEME.loss,
            }}>
              {isUnlocked ? '🔓 PRO' : '🔒 BASIC'}
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={styles.nav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.navTab,
              ...(activeTab === tab.id ? styles.navTabActive : styles.navTabInactive),
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'swap' && (
        <div style={styles.card}>
          <div style={styles.cardTitle}>⚡ Swap</div>

          {/* From */}
          <div style={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={styles.inputLabel}>From</label>
              <span style={{ fontSize: '0.75rem', color: THEME.text.muted }}>
                Balance: {formatNumber(balances[fromToken] || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                style={styles.input}
                placeholder="0.0"
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
              />
              <button
                onClick={() => setShowFromSelect(true)}
                style={styles.tokenSelect}
              >
                <TokenIcon
                  address={TOKENS[fromToken]?.address}
                  symbol={fromToken}
                  emoji={TOKENS[fromToken]?.emoji}
                  size={24}
                />
                <span>{fromToken}</span>
                <span style={{ marginLeft: '4px', fontSize: '0.7rem' }}>▼</span>
              </button>
            </div>
          </div>

          {/* Flip */}
          <div style={{ textAlign: 'center', margin: '-8px 0' }}>
            <button
              onClick={flipTokens}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${GOLD.primary}, ${GOLD.secondary})`,
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
              }}
            >
              ⇅
            </button>
          </div>

          {/* To */}
          <div style={styles.inputGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={styles.inputLabel}>To</label>
              <span style={{ fontSize: '0.75rem', color: THEME.text.muted }}>
                Balance: {formatNumber(balances[toToken] || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                style={{ ...styles.input, color: THEME.text.secondary }}
                placeholder="0.0"
                value={toAmount}
                readOnly
              />
              <button
                onClick={() => setShowToSelect(true)}
                style={styles.tokenSelect}
              >
                <TokenIcon
                  address={TOKENS[toToken]?.address}
                  symbol={toToken}
                  emoji={TOKENS[toToken]?.emoji}
                  size={24}
                />
                <span>{toToken}</span>
                <span style={{ marginLeft: '4px', fontSize: '0.7rem' }}>▼</span>
              </button>
            </div>
          </div>

          {/* Fee info */}
          <div style={{
            fontSize: '0.75rem',
            color: THEME.text.muted,
            padding: '8px 0',
            textAlign: 'center',
          }}>
            1% fee (0.5% buy & burn DTGC + 0.5% to dev)
          </div>

          <button
            onClick={executeSwap}
            disabled={!fromAmount || !toAmount || swapLoading}
            style={{
              ...styles.button,
              ...((!fromAmount || !toAmount || swapLoading) && styles.buttonDisabled),
            }}
          >
            {swapLoading ? '⏳ Swapping...' : '⚡ Swap'}
          </button>
        </div>
      )}

      {activeTab === 'pnl' && (
        <div>
          {selectedPosition ? (
            <PnLCard position={selectedPosition} currentPrice={0.00001} />
          ) : (
            <div style={styles.card}>
              <div style={styles.cardTitle}>📊 P&L Cards</div>
              <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.text.secondary }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📈</div>
                <div>Track your positions and generate shareable P&L cards</div>
                <div style={{ marginTop: '16px', fontSize: '0.85rem' }}>
                  Use the{' '}
                  <a href={CONFIG.TELEGRAM_BOT} target="_blank" rel="noopener noreferrer" style={{ color: GOLD.primary }}>
                    Telegram Bot
                  </a>
                  {' '}to track positions automatically
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'sniper' && (
        <SniperPanel
          isUnlocked={isUnlocked}
          showToast={showToastMsg}
          sniperWallets={sniperWallets}
          selectedWallets={selectedWallets}
          generateWallets={generateWallets}
          toggleWallet={toggleWallet}
          selectAllWallets={selectAllWallets}
          deselectAllWallets={deselectAllWallets}
          onSnipe={async (data) => {
            const walletCount = data.wallets?.length || 1;
            const totalAmount = parseFloat(data.amount || 0) * walletCount;

            if (data.type === 'instant' && signer) {
              // Execute instant snipe with fees
              try {
                showToastMsg(`🎯 Sniping ${data.tokenInfo?.symbol || 'token'}...`, 'info');

                const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
                const amountIn = ethers.parseEther(data.amount.toString());
                const deadline = Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

                // Calculate fees: 0.5% buy & burn + 0.5% dev
                const totalFee = amountIn * BigInt(CONFIG.FEES.TOTAL_BPS) / 10000n;
                const buyBurnFee = totalFee / 2n;
                const devFee = totalFee - buyBurnFee;
                const swapAmount = amountIn - totalFee;

                // 1. Buy & burn DTGC (0.5%)
                showToastMsg('🔥 Processing 0.5% buy & burn DTGC...', 'info');
                try {
                  const dtgcPath = [CONFIG.WPLS, CONFIG.DTGC_ADDRESS];
                  const burnTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
                    0n, dtgcPath, CONFIG.BURN_ADDRESS, deadline, { value: buyBurnFee }
                  );
                  await burnTx.wait();
                } catch (e) { console.error('Burn failed:', e); }

                // 2. Send 0.5% to dev
                const devTx = await signer.sendTransaction({ to: CONFIG.DEV_WALLET, value: devFee });
                await devTx.wait();

                // 3. Execute snipe
                showToastMsg('⚡ Executing snipe...', 'info');
                const path = [CONFIG.WPLS, data.tokenAddress];
                const slippage = parseInt(data.slippage) || 10;
                const minOut = 0n; // Accept any amount for snipe speed

                const snipeTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
                  minOut, path, userAddress, deadline, { value: swapAmount }
                );
                await snipeTx.wait();

                showToastMsg(`✅ Sniped ${data.tokenInfo?.symbol || 'token'}! (${data.amount} PLS)`, 'success');
                fetchBalances();
              } catch (err) {
                console.error('Snipe error:', err);
                showToastMsg(err.reason || err.message || 'Snipe failed', 'error');
              }
            } else {
              // Limit/Instabond - just arm it
              showToastMsg(
                `🎯 Armed ${data.tokenInfo?.symbol || data.tokenAddress?.slice(0, 10)} with ${walletCount} wallet${walletCount > 1 ? 's' : ''} (${totalAmount} PLS total)`,
                'success'
              );
            }
          }}
        />
      )}

      {activeTab === 'bonds' && (
        <BondSniperPanel
          isUnlocked={isUnlocked}
          showToast={showToastMsg}
          sniperWallets={sniperWallets}
          selectedWallets={selectedWallets}
        />
      )}

      {activeTab === 'orders' && (
        <LimitOrdersPanel
          isUnlocked={isUnlocked}
          orders={limitOrders}
          onCreateOrder={(order) => {
            setLimitOrders([...limitOrders, order]);
            showToastMsg(`📈 ${order.type} order created!`, 'success');
          }}
        />
      )}

      {activeTab === 'gate' && (
        <TokenGate
          balance={dtgcBalance}
          requiredUsd={CONFIG.DTGC_MIN_USD}
          dtgcPrice={dtgcPrice}
          onBuy={() => {
            setActiveTab('swap');
            setFromToken('PLS');
            setToToken('DTGC');
          }}
        />
      )}

      {/* Telegram Bot Link */}
      <div style={{
        textAlign: 'center',
        marginTop: '24px',
        padding: '16px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '16px',
        maxWidth: '500px',
        margin: '24px auto 0',
      }}>
        <div style={{ fontSize: '0.85rem', color: THEME.text.secondary, marginBottom: '8px' }}>
          Use DTRADER on Telegram for more features
        </div>
        <a
          href={CONFIG.TELEGRAM_BOT}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            display: 'inline-block',
            padding: '12px 24px',
            width: 'auto',
            textDecoration: 'none',
            marginTop: 0,
          }}
        >
          🤖 Open Telegram Bot
        </a>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        marginTop: '24px',
        fontSize: '0.75rem',
        color: THEME.text.muted,
      }}>
        <div style={{ marginBottom: '8px' }}>
          Powered by{' '}
          <a href={CONFIG.DTGC_WEBSITE} target="_blank" rel="noopener noreferrer" style={{ color: GOLD.primary }}>
            DTGC.io
          </a>
          {' '}•{' '}
          <a href={CONFIG.PULSEX_GOLD_URL} target="_blank" rel="noopener noreferrer" style={{ color: GOLD.primary }}>
            dtgc.io/pulsexgold
          </a>
        </div>
        <div>
          ⚜️ DTRADER Mandalorian Edition
        </div>
      </div>

      {/* Token Selector Modals */}
      <TokenSelectorModal
        show={showFromSelect}
        onSelect={setFromToken}
        excludeToken={toToken}
        onClose={() => setShowFromSelect(false)}
      />
      <TokenSelectorModal
        show={showToSelect}
        onSelect={setToToken}
        excludeToken={fromToken}
        onClose={() => setShowToSelect(false)}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          ...(toast.type === 'success' && styles.toastSuccess),
          ...(toast.type === 'error' && styles.toastError),
          ...(toast.type === 'info' && styles.toastInfo),
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
