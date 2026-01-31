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
// TOKENS DATABASE
// ═══════════════════════════════════════════════════════════════════════════

const TOKENS = {
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
  DTGC: {
    address: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
    symbol: 'DTGC',
    name: 'DT Gold Coin',
    decimals: 18,
    emoji: '🏆',
    isGold: true,
  },
  URMOM: {
    address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0',
    symbol: 'URMOM',
    name: 'URMOM',
    decimals: 18,
    emoji: '🔥',
  },
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

const SniperPanel = ({ isUnlocked, onSnipe }) => {
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('10');
  const [sniperType, setSniperType] = useState('instabond'); // instabond, newpair

  if (!isUnlocked) {
    return (
      <div style={styles.card}>
        <div style={styles.cardTitle}>🎯 Sniper</div>
        <div style={{ textAlign: 'center', padding: '40px 20px', color: THEME.text.secondary }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <div>Hold $50 DTGC to unlock Sniper features</div>
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
        gap: '8px',
        marginBottom: '16px',
        background: 'rgba(0,0,0,0.3)',
        padding: '4px',
        borderRadius: '10px',
      }}>
        <button
          onClick={() => setSniperType('instabond')}
          style={{
            ...styles.navTab,
            flex: 1,
            padding: '10px',
            ...(sniperType === 'instabond' ? styles.navTabActive : styles.navTabInactive),
          }}
        >
          ⚡ Instabond
        </button>
        <button
          onClick={() => setSniperType('newpair')}
          style={{
            ...styles.navTab,
            flex: 1,
            padding: '10px',
            ...(sniperType === 'newpair' ? styles.navTabActive : styles.navTabInactive),
          }}
        >
          🆕 New Pair
        </button>
      </div>

      <div style={{
        padding: '12px',
        background: 'rgba(212,175,55,0.1)',
        borderRadius: '10px',
        marginBottom: '16px',
        fontSize: '0.8rem',
      }}>
        {sniperType === 'instabond'
          ? '🎯 Snipe pump.tires tokens when they graduate (200M PLS bonding curve)'
          : '🆕 Snipe new PulseX listings as soon as liquidity is added'
        }
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
        <div style={{ ...styles.inputGroup, flex: 2 }}>
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

      <button
        style={styles.button}
        onClick={() => onSnipe({ tokenAddress, amount, slippage, type: sniperType })}
      >
        🎯 Arm Sniper
      </button>

      <div style={{
        marginTop: '16px',
        fontSize: '0.75rem',
        color: THEME.text.muted,
        textAlign: 'center',
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

  // Token gate
  const isUnlocked = (dtgcBalance * dtgcPrice) >= CONFIG.DTGC_MIN_USD;

  // P&L state
  const [positions, setPositions] = useState([]);
  const [selectedPosition, setSelectedPosition] = useState(null);

  // Orders state
  const [limitOrders, setLimitOrders] = useState([]);

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

      // Calculate 1% fee
      const fee = amountIn * BigInt(CONFIG.FEES.TOTAL_BPS) / 10000n;
      const swapAmount = amountIn - fee;

      if (fromToken === 'PLS' || fromData.isNative) {
        // Send fee first
        showToastMsg('🌱 Processing 1% fee...', 'info');
        const feeTx = await signer.sendTransaction({
          to: CONFIG.DEV_WALLET,
          value: fee,
        });
        await feeTx.wait();

        // Execute swap
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
        // Approve first
        const tokenContract = new ethers.Contract(fromData.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amountIn) {
          showToastMsg(`Approving ${fromToken}...`, 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }

        showToastMsg('Swapping via PulseX...', 'info');
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
          amountIn,
          amountOutMin,
          path,
          userAddress,
          deadline
        );
        await tx.wait();
      } else {
        // Token to token
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

  // Render tabs
  const tabs = [
    { id: 'swap', label: '⚡ Swap', emoji: '⚡' },
    { id: 'pnl', label: '📊 P&L', emoji: '📊' },
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
              <button style={styles.tokenSelect}>
                <span>{TOKENS[fromToken]?.emoji}</span>
                <span>{fromToken}</span>
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
              <button style={styles.tokenSelect}>
                <span>{TOKENS[toToken]?.emoji}</span>
                <span>{toToken}</span>
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
          onSnipe={(data) => showToastMsg(`🎯 Sniper armed for ${data.tokenAddress.slice(0, 10)}...`, 'success')}
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
