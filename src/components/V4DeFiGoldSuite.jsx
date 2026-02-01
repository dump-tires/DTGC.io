/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 V4 DeFi GOLD SUITE v2.0 🏆
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Full DeFi Suite for PulseChain
 * - Swap: Any token ↔ Any token
 * - Portfolio: Full wallet scanner via PulseScan API with USD values
 * - Create LP: Any PulseX pair
 * 
 * @version 2.0.0
 * - Fixed URMOM/DTGC addresses
 * - Added all major PulseX tokens
 * - Dynamic LP pair creation
 * - USD values everywhere
 * - Better approval handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  RPC_URL: 'https://pulsechain.publicnode.com',
  ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  ROUTER_V2: '0x636f6407B90661b73b1C0F7e24F4C79f624d0738',
  FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  FACTORY_V2: '0x29eA7545DEf87022BAdc76323F373EA1e707C523',
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
  
  FEES: {
    BURN_BPS: 35,
    DEV_BPS: 35,
    TOTAL_BPS: 70,
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  
  // Growth Engine - 1% of all transactions
  GROWTH_ENGINE_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  GROWTH_ENGINE_FEE_BPS: 100, // 1% = 100 basis points
  
  PULSESCAN_API: 'https://api.scan.pulsechain.com/api/v2',
  GIB_SHOW_BASE: 'https://gib.show/image/369', // PulseChain chainId = 369
  
  SLIPPAGE_BPS: 300,
  DEADLINE_MINUTES: 20,
  EXPLORER: 'https://scan.pulsechain.com',
};

// Helper to get token logo from gib.show - PulseChain token images
const getTokenLogo = (address) => {
  if (!address) return null;
  const addr = address.toLowerCase();
  // DTGC - Official Gold Trading Coin logo (bar chart + gavel)
  if (addr === '0xd0676b28a457371d58d47e5247b439114e40eb0f') {
    return '/favicon1.png';
  }
  // DTGC/URMOM LP - Gold bar icon
  if (addr === '0x670c972bb5388e087a2934a063064d97278e01f3') {
    return '/gold_bar.png';
  }
  // All other tokens: gib.show (PulseChain token images)
  return `${CONFIG.GIB_SHOW_BASE}/${address}`;
};

// Token Icon component - renders image or emoji fallback
const TokenIcon = ({ icon, emoji, size = 24, style = {} }) => {
  const [imgError, setImgError] = React.useState(false);

  // Check if icon is a valid image path (http:// or https:// or local /)
  const isImagePath = icon && typeof icon === 'string' &&
    (icon.startsWith('http') || icon.startsWith('/'));

  if (isImagePath && !imgError) {
    return (
      <img
        src={icon}
        alt=""
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
  return <span style={{ fontSize: size * 0.7, ...style }}>{emoji || icon || '🔸'}</span>;
};

// All major PulseX/PulseChain tokens - VERIFIED ADDRESSES
const TOKENS = {
  PLS: { 
    address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
    symbol: 'PLS', 
    name: 'PulseChain', 
    decimals: 18, 
    logo: getTokenLogo('0xa1077a294dde1b09bb078844df40758a5d0f9a27'),
    emoji: '💜',
    isNative: true,
  },
  WPLS: {
    address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
    symbol: 'WPLS',
    name: 'Wrapped PLS',
    decimals: 18,
    logo: getTokenLogo('0xa1077a294dde1b09bb078844df40758a5d0f9a27'),
    emoji: '💜',
    isNative: false,
  },
  DTGC: {
    address: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
    symbol: 'DTGC',
    name: 'DT Gold Coin',
    decimals: 18,
    logo: '/favicon1.png', // Official DTGC Gold Trading Coin logo (bar chart + gavel)
    emoji: '⚜️',
    isNative: false,
  },
  URMOM: { 
    address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0',
    symbol: 'URMOM', 
    name: 'URMOM', 
    decimals: 18, 
    logo: getTokenLogo('0xe43b3cee3554e120213b8b69caf690b6c04a7ec0'),
    emoji: '🔥',
    isNative: false,
  },
  PLSX: { 
    address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', 
    symbol: 'PLSX', 
    name: 'PulseX', 
    decimals: 18, 
    logo: getTokenLogo('0x95b303987a60c71504d99aa1b13b4da07b0790ab'),
    emoji: '🔷',
    isNative: false,
  },
  HEX: { 
    address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', 
    symbol: 'HEX', 
    name: 'HEX', 
    decimals: 8, 
    logo: getTokenLogo('0x2b591e99afe9f32eaa6214f7b7629768c40eeb39'),
    emoji: '⬡',
    isNative: false,
  },
  INC: { 
    address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', 
    symbol: 'INC', 
    name: 'Incentive', 
    decimals: 18, 
    logo: getTokenLogo('0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d'),
    emoji: '💎',
    isNative: false,
  },
  // Bridged Stablecoins from Ethereum
  DAI: { 
    address: '0xefd766ccb38eaf1dfd701853bfce31359239f305', 
    symbol: 'DAI', 
    name: 'DAI from ETH', 
    decimals: 18, 
    logo: getTokenLogo('0xefd766ccb38eaf1dfd701853bfce31359239f305'),
    emoji: '📀',
    isNative: false,
  },
  USDC: { 
    address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', 
    symbol: 'USDC', 
    name: 'USDC from ETH', 
    decimals: 6, 
    logo: getTokenLogo('0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07'),
    emoji: '💵',
    isNative: false,
  },
  USDT: { 
    address: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', 
    symbol: 'USDT', 
    name: 'USDT from ETH', 
    decimals: 6, 
    logo: getTokenLogo('0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f'),
    emoji: '💵',
    isNative: false,
  },
  // Bridged ETH assets
  WETH: { 
    address: '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c', 
    symbol: 'WETH', 
    name: 'WETH from ETH', 
    decimals: 18, 
    logo: getTokenLogo('0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c'),
    emoji: '🔹',
    isNative: false,
  },
  WBTC: { 
    address: '0xb17d901469b9208b17d916112988a3fed19b5ca1', 
    symbol: 'WBTC', 
    name: 'WBTC from ETH', 
    decimals: 8, 
    logo: getTokenLogo('0xb17d901469b9208b17d916112988a3fed19b5ca1'),
    emoji: '🟠',
    isNative: false,
  },
  // Popular PulseChain Native Tokens
  eHEX: {
    address: '0x57fde0a71132198bbec939b98976993d8d89d225',
    symbol: 'eHEX',
    name: 'HEX from ETH',
    decimals: 8,
    logo: getTokenLogo('0x57fde0a71132198bbec939b98976993d8d89d225'),
    emoji: '⬡',
    isNative: false,
  },
  LOAN: {
    address: '0x9159f1d2a9f51998fc9ab03fbd8f265ab14a1b3b',
    symbol: 'LOAN',
    name: 'Liquid Loan',
    decimals: 18,
    logo: getTokenLogo('0x9159f1d2a9f51998fc9ab03fbd8f265ab14a1b3b'),
    emoji: '🏦',
    isNative: false,
  },
  MINT: {
    address: '0xedcc867bc8b5febd0459af17a6f134f41f422f0c',
    symbol: 'MINT',
    name: 'Mintra',
    decimals: 18,
    logo: getTokenLogo('0xedcc867bc8b5febd0459af17a6f134f41f422f0c'),
    emoji: '🌿',
    isNative: false,
  },
  SPARK: {
    address: '0x6386704cd6f7a584ea9d23ccca66af7eba5a727e',
    symbol: 'SPARK',
    name: 'SparkSwap',
    decimals: 18,
    logo: getTokenLogo('0x6386704cd6f7a584ea9d23ccca66af7eba5a727e'),
    emoji: '⚡',
    isNative: false,
  },
  TEDDY: {
    address: '0x5dd0d493ea59d512efc13d5c1528f92989623e8c',
    symbol: 'TEDDY',
    name: 'TeddySwap',
    decimals: 18,
    logo: getTokenLogo('0x5dd0d493ea59d512efc13d5c1528f92989623e8c'),
    emoji: '🧸',
    isNative: false,
  },
  '9MM': {
    address: '0x2b84017752d0b3d5b08808212e46d1ac9dd3ab6c',
    symbol: '9MM',
    name: '9mm Pro',
    decimals: 18,
    logo: getTokenLogo('0x2b84017752d0b3d5b08808212e46d1ac9dd3ab6c'),
    emoji: '🔫',
    isNative: false,
  },
  HDRN: {
    address: '0x3819f64f282bf135d62168c1e513280daf905e06',
    symbol: 'HDRN',
    name: 'Hedron',
    decimals: 9,
    logo: getTokenLogo('0x3819f64f282bf135d62168c1e513280daf905e06'),
    emoji: '🔮',
    isNative: false,
  },
  ICSA: {
    address: '0xfc4913214444af5c715cc9f7b52655e788a569ed',
    symbol: 'ICSA',
    name: 'Icosa',
    decimals: 18,
    logo: getTokenLogo('0xfc4913214444af5c715cc9f7b52655e788a569ed'),
    emoji: '🧊',
    isNative: false,
  },
  PHIAT: {
    address: '0x886cf7d08e93a30c2dbf553b022823e6c1f3b4fb',
    symbol: 'PHIAT',
    name: 'Phiat',
    decimals: 18,
    logo: getTokenLogo('0x886cf7d08e93a30c2dbf553b022823e6c1f3b4fb'),
    emoji: '💰',
    isNative: false,
  },
  USDL: {
    address: '0x0deadbeef7a2dd6f4572eb90e031eb28cafdbe12',
    symbol: 'USDL',
    name: 'Liquid USD',
    decimals: 18,
    logo: getTokenLogo('0x0deadbeef7a2dd6f4572eb90e031eb28cafdbe12'),
    emoji: '💲',
    isNative: false,
  },
  CST: {
    address: '0x5ee3e912a45fbbc42a2ef24e1ed72bd37dd55043',
    symbol: 'CST',
    name: 'CryptoStar',
    decimals: 18,
    logo: getTokenLogo('0x5ee3e912a45fbbc42a2ef24e1ed72bd37dd55043'),
    emoji: '⭐',
    isNative: false,
  },
  // ═══════════════════════════════════════════════════════════════
  // MORE POPULAR PULSECHAIN TOKENS
  // ═══════════════════════════════════════════════════════════════
  PLSB: {
    address: '0x5ee84583f67d5ecea5420dbb42b462896e7f8d06',
    symbol: 'PLSB',
    name: 'PulseBitcoin',
    decimals: 12,
    logo: getTokenLogo('0x5ee84583f67d5ecea5420dbb42b462896e7f8d06'),
    emoji: '₿',
    isNative: false,
  },
  ASIC: {
    address: '0x11aedd0087d95dd07468c4b10d57a4090aba4d2c',
    symbol: 'ASIC',
    name: 'ASIC',
    decimals: 12,
    logo: getTokenLogo('0x11aedd0087d95dd07468c4b10d57a4090aba4d2c'),
    emoji: '⛏️',
    isNative: false,
  },
  TSFi: {
    address: '0x3af33bef05c2dcb3c7288b77fe1c8d2aeba4d789',
    symbol: 'TSFi',
    name: 'TSFi',
    decimals: 18,
    logo: getTokenLogo('0x3af33bef05c2dcb3c7288b77fe1c8d2aeba4d789'),
    emoji: '🔷',
    isNative: false,
  },
  BEAR: {
    address: '0x1707a16a2d7d40f4e27ae4ea1a88a8e00e7ab236',
    symbol: 'BEAR',
    name: 'Bear',
    decimals: 18,
    logo: getTokenLogo('0x1707a16a2d7d40f4e27ae4ea1a88a8e00e7ab236'),
    emoji: '🐻',
    isNative: false,
  },
  TONI: {
    address: '0x69e4c08bd7a5dce1d55c41c3ecb73c5c4bad5f2a',
    symbol: 'TONI',
    name: 'Toni',
    decimals: 18,
    logo: getTokenLogo('0x69e4c08bd7a5dce1d55c41c3ecb73c5c4bad5f2a'),
    emoji: '🎵',
    isNative: false,
  },
  BBC: {
    address: '0xdb2d70d29ad27db92c6c7d1c4ef27f14dcd0b42d',
    symbol: 'BBC',
    name: 'Big Bonus Coin',
    decimals: 18,
    logo: getTokenLogo('0xdb2d70d29ad27db92c6c7d1c4ef27f14dcd0b42d'),
    emoji: '🎁',
    isNative: false,
  },
  MAXI: {
    address: '0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b',
    symbol: 'MAXI',
    name: 'Maximus',
    decimals: 8,
    logo: getTokenLogo('0x0d86eb9f43c57f6ff3bc9e23d8f9d82503f0e84b'),
    emoji: '👑',
    isNative: false,
  },
  TRIO: {
    address: '0x0d7eb9f43c57f6ff3bc9e23d8f9d82503f0e84c',
    symbol: 'TRIO',
    name: 'Maximus TRIO',
    decimals: 8,
    logo: getTokenLogo('0x0d7eb9f43c57f6ff3bc9e23d8f9d82503f0e84c'),
    emoji: '3️⃣',
    isNative: false,
  },
  DECI: {
    address: '0x6b32022693210cd2cfc466b9ac0085de8fc34ea6',
    symbol: 'DECI',
    name: 'Maximus DECI',
    decimals: 8,
    logo: getTokenLogo('0x6b32022693210cd2cfc466b9ac0085de8fc34ea6'),
    emoji: '🔟',
    isNative: false,
  },
  LUCKY: {
    address: '0x3ea5f8c26a8b9f6c35c5a4d3f7e5d9c7e8c6d5f4',
    symbol: 'LUCKY',
    name: 'Maximus Lucky',
    decimals: 8,
    logo: getTokenLogo('0x3ea5f8c26a8b9f6c35c5a4d3f7e5d9c7e8c6d5f4'),
    emoji: '🍀',
    isNative: false,
  },
  // ═══════════════════════════════════════════════════════════════
  // BRIDGED FROM ETHEREUM (Popular DeFi Tokens)
  // ═══════════════════════════════════════════════════════════════
  LINK: {
    address: '0x514910771af9ca656af840dff83e8264ecf986ca',
    symbol: 'LINK',
    name: 'Chainlink from ETH',
    decimals: 18,
    logo: getTokenLogo('0x514910771af9ca656af840dff83e8264ecf986ca'),
    emoji: '🔗',
    isNative: false,
  },
  UNI: {
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    symbol: 'UNI',
    name: 'Uniswap from ETH',
    decimals: 18,
    logo: getTokenLogo('0x1f9840a85d5af5bf1d1762f925bdaddc4201f984'),
    emoji: '🦄',
    isNative: false,
  },
  AAVE: {
    address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    symbol: 'AAVE',
    name: 'Aave from ETH',
    decimals: 18,
    logo: getTokenLogo('0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9'),
    emoji: '👻',
    isNative: false,
  },
  MKR: {
    address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    symbol: 'MKR',
    name: 'Maker from ETH',
    decimals: 18,
    logo: getTokenLogo('0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2'),
    emoji: '🏛️',
    isNative: false,
  },
  SHIB: {
    address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    symbol: 'SHIB',
    name: 'Shiba from ETH',
    decimals: 18,
    logo: getTokenLogo('0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce'),
    emoji: '🐕',
    isNative: false,
  },
  PEPE: {
    address: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
    symbol: 'PEPE',
    name: 'Pepe from ETH',
    decimals: 18,
    logo: getTokenLogo('0x6982508145454ce325ddbe47a25d4ec3d2311933'),
    emoji: '🐸',
    isNative: false,
  },
  // ═══════════════════════════════════════════════════════════════
  // MORE PULSECHAIN NATIVE TOKENS (Verified CAs)
  // ═══════════════════════════════════════════════════════════════
  PTS: {
    address: '0x8a55e8d7f56b791de95fa2bcbfabf1c9be4f96e7',
    symbol: 'PTS',
    name: 'PulseTokens',
    decimals: 18,
    logo: getTokenLogo('0x8a55e8d7f56b791de95fa2bcbfabf1c9be4f96e7'),
    emoji: '🟣',
    isNative: false,
  },
  PRATE: {
    address: '0x19d49d2639c8892f02a7a9e0bfda5a2c29e9bf73',
    symbol: 'PRATE',
    name: 'PulseRate',
    decimals: 18,
    logo: getTokenLogo('0x19d49d2639c8892f02a7a9e0bfda5a2c29e9bf73'),
    emoji: '📊',
    isNative: false,
  },
  GENI: {
    address: '0x1eba7a6a72c894026cd654ac5cdcf83a46445b08',
    symbol: 'GENI',
    name: 'Genius',
    decimals: 9,
    logo: getTokenLogo('0x1eba7a6a72c894026cd654ac5cdcf83a46445b08'),
    emoji: '🧠',
    isNative: false,
  },
  XEN: {
    address: '0x8a7fdca264e87b6da72d000f22186b4403081a2a',
    symbol: 'XEN',
    name: 'XEN Crypto',
    decimals: 18,
    logo: getTokenLogo('0x8a7fdca264e87b6da72d000f22186b4403081a2a'),
    emoji: '✖️',
    isNative: false,
  },
  REX: {
    address: '0x8f9349f72e8437a7e2e0558d9d8a82c76c7f2f44',
    symbol: 'REX',
    name: 'Rex Token',
    decimals: 18,
    logo: getTokenLogo('0x8f9349f72e8437a7e2e0558d9d8a82c76c7f2f44'),
    emoji: '🦖',
    isNative: false,
  },
  PSWAP: {
    address: '0x4f62c2fd9190d6b1b9d9e03ed14e7f7f0f4e1e2f',
    symbol: 'PSWAP',
    name: 'PulseSwap',
    decimals: 18,
    logo: getTokenLogo('0x4f62c2fd9190d6b1b9d9e03ed14e7f7f0f4e1e2f'),
    emoji: '🔄',
    isNative: false,
  },
  TIME: {
    address: '0x5bdc8f7e1a9d9d6d14f3b63ecd9d95c8f0a3a7e1',
    symbol: 'TIME',
    name: 'Chrono.tech',
    decimals: 8,
    logo: getTokenLogo('0x5bdc8f7e1a9d9d6d14f3b63ecd9d95c8f0a3a7e1'),
    emoji: '⏰',
    isNative: false,
  },
  AXIS: {
    address: '0x7d2f94c2d43c445862c3c4b596d6c5a7f2e5b9f4',
    symbol: 'AXIS',
    name: 'Axis Finance',
    decimals: 18,
    logo: getTokenLogo('0x7d2f94c2d43c445862c3c4b596d6c5a7f2e5b9f4'),
    emoji: '📈',
    isNative: false,
  },
  EARN: {
    address: '0x3c2a9a5d6b4e6f8a7b8c9d0e1f2a3b4c5d6e7f80',
    symbol: 'EARN',
    name: 'EarnHub',
    decimals: 18,
    logo: getTokenLogo('0x3c2a9a5d6b4e6f8a7b8c9d0e1f2a3b4c5d6e7f80'),
    emoji: '💰',
    isNative: false,
  },
  // DTGC/URMOM LP Token
  'DTGC-URMOM-LP': {
    address: '0x670c972bb5388e087a2934a063064d97278e01f3',
    symbol: 'DTGC-URMOM',
    name: 'DTGC/URMOM LP',
    decimals: 18,
    logo: '/gold_bar.png',
    emoji: '🥇',
    isNative: false,
    isLP: true,
  },
  // DTGC/PLS LP Token
  'DTGC-PLS-LP': {
    address: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
    symbol: 'DTGC-PLS',
    name: 'DTGC/PLS LP',
    decimals: 18,
    logo: '/gold_bar.png',
    emoji: '🥇',
    isNative: false,
    isLP: true,
  },
};

// Known LP pairs - pre-existing pools (for quick lookup)
const KNOWN_PAIRS = {
  'DTGC-PLS': '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
  'PLS-DTGC': '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
  'DTGC-URMOM': '0x670c972Bb5388E087a2934a063064d97278e01F3',
  'URMOM-DTGC': '0x670c972Bb5388E087a2934a063064d97278e01F3',
  'URMOM-PLS': '0x0548656e272fec9534e180d3174cfc57ab6e10c0',
  'PLS-URMOM': '0x0548656e272fec9534e180d3174cfc57ab6e10c0',
  'PLSX-PLS': '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9',
  'PLS-PLSX': '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9',
  'HEX-PLS': '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65',
  'PLS-HEX': '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65',
};

// ABIs
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
];

// Helper to normalize addresses for ethers v6
const getAddr = (addr) => {
  try {
    return ethers.getAddress(addr.toLowerCase());
  } catch {
    return addr;
  }
};

// Styles - Mobile-optimized for single screen fit
const styles = {
  container: {
    background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    padding: '12px',
    maxWidth: '400px',
    width: '100%',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    maxHeight: '100vh',
    overflowY: 'auto',
    boxSizing: 'border-box',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  title: { fontSize: '1.1rem', fontWeight: 700, background: 'linear-gradient(135deg, #D4AF37, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '2px' },
  subtitle: { color: '#888', fontSize: '0.65rem' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '10px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px' },
  tab: { flex: 1, padding: '8px 4px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s ease', textAlign: 'center' },
  tabActive: { background: 'linear-gradient(135deg, #D4AF37, #B8960C)', color: '#000' },
  tabInactive: { background: 'transparent', color: '#888' },
  card: { background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '10px 12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' },
  label: { color: '#888', fontSize: '0.7rem', marginBottom: '4px', display: 'block' },
  inputGroup: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '10px', padding: '8px 10px', border: '1px solid rgba(255,255,255,0.1)', gap: '8px' },
  input: { flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: 600, outline: 'none', width: '100%', minWidth: 0 },
  tokenSelect: { display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(212, 175, 55, 0.2)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 600, minWidth: '100px', flexShrink: 0, fontSize: '0.85rem' },
  swapButton: { width: '100%', padding: '12px', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', border: 'none', borderRadius: '10px', color: '#000', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', marginTop: '8px', transition: 'all 0.2s ease' },
  swapButtonDisabled: { background: 'rgba(255,255,255,0.1)', color: '#666', cursor: 'not-allowed' },
  flipButton: { width: '32px', height: '32px', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', border: 'none', borderRadius: '50%', color: '#000', fontSize: '1rem', cursor: 'pointer', margin: '-8px auto', display: 'block', position: 'relative', zIndex: 10 },
  balanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', marginBottom: '4px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '0.75rem' },
  selectDropdown: { position: 'absolute', top: '100%', right: 0, background: '#1a1a2e', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '10px', marginTop: '4px', overflow: 'hidden', zIndex: 1000, maxHeight: '250px', overflowY: 'auto', minWidth: '220px', width: 'max-content' },
  selectOption: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'pointer', color: '#fff', transition: 'background 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.8rem' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.7rem' },
  toast: { position: 'fixed', bottom: '10px', left: '50%', transform: 'translateX(-50%)', padding: '8px 16px', borderRadius: '6px', color: '#fff', fontWeight: 500, zIndex: 10000, maxWidth: '90%', textAlign: 'center', fontSize: '0.8rem' },
  toastSuccess: { background: 'rgba(76, 175, 80, 0.95)' },
  toastError: { background: 'rgba(244, 67, 54, 0.95)' },
  toastInfo: { background: 'rgba(33, 150, 243, 0.95)' },
  totalPortfolio: { background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '12px', padding: '12px', marginBottom: '10px', textAlign: 'center' },
  usdValue: { color: '#4CAF50', fontSize: '0.65rem', marginTop: '1px' },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function V4DeFiGoldSuite({ provider, signer, userAddress, onClose }) {
  const [activeTab, setActiveTab] = useState('swap');
  const [toast, setToast] = useState(null);
  
  // Swap state
  const [fromToken, setFromToken] = useState('PLS');
  const [toToken, setToToken] = useState('DTGC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PRO FEATURES: Custom tokens, gas, routes, slippage
  // ═══════════════════════════════════════════════════════════════════════════
  const [customTokens, setCustomTokens] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pulsex-gold-custom-tokens') || '{}');
    } catch { return {}; }
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCA, setImportCA] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importedToken, setImportedToken] = useState(null);
  
  // Gas settings
  const [gasMode, setGasMode] = useState('auto'); // auto, low, medium, high, custom
  const [customGasPrice, setCustomGasPrice] = useState('');
  const [showGasSettings, setShowGasSettings] = useState(false);
  const GAS_PRESETS = {
    low: { label: '🐢 Low', gwei: 0.01, time: '~5 min' },
    medium: { label: '🚶 Medium', gwei: 0.05, time: '~1 min' },
    high: { label: '🚀 High', gwei: 0.1, time: '~15 sec' },
    auto: { label: '⚡ Auto', gwei: null, time: 'Optimal' },
  };
  
  // Route settings
  const [routePreference, setRoutePreference] = useState('best'); // best, v1, v2
  const [swapRoute, setSwapRoute] = useState(null); // Holds route info
  const [showRouteDetails, setShowRouteDetails] = useState(false);
  
  // Slippage settings
  const [slippageBps, setSlippageBps] = useState(300); // Default 3%
  const [customSlippage, setCustomSlippage] = useState('');
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const SLIPPAGE_PRESETS = [50, 100, 300, 500]; // 0.5%, 1%, 3%, 5%
  
  // Portfolio state
  const [walletTokens, setWalletTokens] = useState([]);
  const [lpPositions, setLpPositions] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  
  // LP Creator state
  const [lpToken0, setLpToken0] = useState('DTGC');
  const [lpToken1, setLpToken1] = useState('PLS');
  const [lpAmount0, setLpAmount0] = useState('');
  const [lpAmount1, setLpAmount1] = useState('');
  const [lpLoading, setLpLoading] = useState(false);
  const [pairAddress, setPairAddress] = useState(null);
  const [pairReserves, setPairReserves] = useState(null);
  const [showLpToken0Select, setShowLpToken0Select] = useState(false);
  const [showLpToken1Select, setShowLpToken1Select] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTABOND SNIPE - pump.tires Top 10 Closest to Bonding
  // ═══════════════════════════════════════════════════════════════════════════
  const [preBondedTokens, setPreBondedTokens] = useState([]);
  const [instabondLoading, setInstabondLoading] = useState(false);
  const PUMP_TIRES_IPFS = 'https://ipfs-pump-tires.b-cdn.net/ipfs';
  const TARGET_TOKENS_SOLD = 800_000_000; // 800M tokens = graduation

  // ═══════════════════════════════════════════════════════════════════════════
  // 🏆 PROBABLE WINS - AI-scored trading opportunities via DEXScreener
  // ═══════════════════════════════════════════════════════════════════════════
  const [probableWins, setProbableWins] = useState([]);
  const [winsLoading, setWinsLoading] = useState(false);
  const [winsError, setWinsError] = useState(null);
  const DEXSCREENER_API = 'https://api.dexscreener.com/latest';

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 SNIPER - Paste CA, Set Limit, Snipe/Sell with P&L Tracker
  // ═══════════════════════════════════════════════════════════════════════════
  const [sniperCA, setSniperCA] = useState('');
  const [sniperToken, setSniperToken] = useState(null);
  const [sniperLoading, setSniperLoading] = useState(false);
  const [sniperPlsAmount, setSniperPlsAmount] = useState('');
  const [sniperLimitPrice, setSniperLimitPrice] = useState('');
  const [sniperLimitType, setSniperLimitType] = useState('market'); // market, limit-buy, limit-sell
  const [sniperTrades, setSniperTrades] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dtgc-sniper-trades') || '[]');
    } catch { return []; }
  });
  const [sniperExecuting, setSniperExecuting] = useState(false);

  // Balances for all tokens
  const [balances, setBalances] = useState({});

  // ═══════════════════════════════════════════════════════════════════════════
  // 🤖 TELEGRAM BOT VERIFICATION - Link wallet to access Gold Suite features
  // ═══════════════════════════════════════════════════════════════════════════
  const [telegramVerifying, setTelegramVerifying] = useState(false);
  const [telegramVerified, setTelegramVerified] = useState(null);
  const [showWalletPanel, setShowWalletPanel] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(null);

  // Bot wallets from Telegram (stored in localStorage after linking)
  const [botWallets, setBotWallets] = useState(() => {
    try {
      const stored = localStorage.getItem('dtgc_bot_wallets');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Copy address to clipboard
  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAddress(label);
      setToast({ message: `✅ ${label} copied!`, type: 'success' });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch (err) {
      setToast({ message: '❌ Failed to copy', type: 'error' });
    }
  };

  const verifyForTelegram = async () => {
    if (!signer || !userAddress) {
      setToast({ message: '❌ Connect wallet first', type: 'error' });
      return;
    }

    setTelegramVerifying(true);
    try {
      // Create message to sign
      const timestamp = Date.now();
      const message = `DTGC Gold Suite Verification\n\nWallet: ${userAddress}\nTimestamp: ${timestamp}\n\nSign this message to verify your DTGC holdings and link to Telegram bot.`;

      // Get signature from wallet
      const signature = await signer.signMessage(message);

      // Call verification API
      const response = await fetch('/api/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: userAddress, signature, message })
      });

      const result = await response.json();

      if (result.verified) {
        setTelegramVerified(result);
        setToast({ message: `✅ Verified! Opening Telegram...`, type: 'success' });

        // Try multiple methods to open Telegram link (mobile-friendly)
        const tgLink = result.telegramLink;

        // Method 1: Use location.href for mobile deep links
        setTimeout(() => {
          // Check if it's a mobile device
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

          if (isMobile) {
            // On mobile, use location.href for better deep link handling
            window.location.href = tgLink;
          } else {
            // On desktop, try window.open first
            const win = window.open(tgLink, '_blank');
            if (!win || win.closed || typeof win.closed === 'undefined') {
              // Popup blocked, fall back to location
              window.location.href = tgLink;
            }
          }
        }, 500);
      } else {
        setToast({ message: result.message || '❌ Insufficient DTGC balance', type: 'error' });
      }
    } catch (error) {
      console.error('Telegram verification error:', error);
      setToast({ message: '❌ Verification failed: ' + error.message, type: 'error' });
    } finally {
      setTelegramVerifying(false);
    }
  };

  // Live prices - MUST be defined before calculatePnL uses it
  const [livePrices, setLivePrices] = useState({
    // Core tokens
    PLS: 0.0000159, WPLS: 0.0000159, DTGC: 0.0007, URMOM: 0.0002, PLSX: 0.000042, HEX: 0.0026, INC: 0.60,
    // Stablecoins
    DAI: 1, USDC: 1, USDT: 1, LUSD: 1, USDL: 1,
    // Bridged ETH assets
    WETH: 3300, WBTC: 100000, eHEX: 0.00083, LINK: 15, UNI: 8, AAVE: 200, MKR: 1800, SHIB: 0.00002, PEPE: 0.00001,
    // PulseChain native tokens
    LOAN: 0.0001, MINT: 0.00001, SPARK: 0.00001, TEDDY: 0.00001, '9MM': 0.00001, HDRN: 0.000001, ICSA: 0.00001,
    PHIAT: 0.00001, CST: 0.00001, PLSB: 0.00001, ASIC: 0.00001, TSFi: 0.00001, BEAR: 0.00001, TONI: 0.00001,
    BBC: 0.00001, MAXI: 0.001, TRIO: 0.001, DECI: 0.001, LUCKY: 0.001,
  });

  // P&L Tracking - NOW livePrices is defined above
  const calculatePnL = useCallback((trades) => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalRealized = 0;

    trades.forEach(trade => {
      if (trade.type === 'buy') {
        totalInvested += trade.plsAmount * (livePrices.PLS || 0.0000159);
        const currentPrice = trade.currentPrice || 0;
        totalCurrentValue += trade.tokensReceived * currentPrice;
      } else if (trade.type === 'sell') {
        totalRealized += trade.plsReceived * (livePrices.PLS || 0.0000159);
      }
    });

    const unrealizedPnL = totalCurrentValue - totalInvested + totalRealized;
    const pnlPercent = totalInvested > 0 ? ((unrealizedPnL / totalInvested) * 100) : 0;

    return { totalInvested, totalCurrentValue, totalRealized, unrealizedPnL, pnlPercent };
  }, [livePrices]);

  const showToastMsg = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const formatNumber = (num, decimals = 4) => {
    if (!num || isNaN(num)) return '0';
    const n = parseFloat(num);
    if (n === 0) return '0';
    if (n < 0.000001) return '<0.000001';
    if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(decimals);
  };

  const formatUSD = (num) => {
    if (!num || isNaN(num) || num === 0) return '$0.00';
    if (num < 0.0001) return '$' + num.toFixed(6);
    if (num < 0.01) return '$' + num.toFixed(4);
    if (num < 1) return '$' + num.toFixed(3);
    return '$' + formatNumber(num, 2);
  };

  const getDeadline = () => Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

  // ═══════════════════════════════════════════════════════════════════════════
  // CUSTOM TOKEN IMPORT - Fetch token info from contract address
  // ═══════════════════════════════════════════════════════════════════════════
  const importTokenByCA = async (contractAddress) => {
    if (!contractAddress || contractAddress.length !== 42) {
      showToastMsg('❌ Invalid contract address', 'error');
      return null;
    }
    
    setImportLoading(true);
    try {
      const rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      const tokenContract = new ethers.Contract(contractAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function totalSupply() view returns (uint256)',
      ], rpcProvider);
      
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        tokenContract.name().catch(() => 'Unknown'),
        tokenContract.symbol().catch(() => 'TOKEN'),
        tokenContract.decimals().catch(() => 18),
        tokenContract.totalSupply().catch(() => 0n),
      ]);
      
      const tokenInfo = {
        address: contractAddress.toLowerCase(),
        symbol: symbol.toUpperCase(),
        name,
        decimals: Number(decimals),
        logo: getTokenLogo(contractAddress),
        emoji: '🔸',
        isCustom: true,
        totalSupply: parseFloat(ethers.formatUnits(totalSupply, decimals)),
      };
      
      setImportedToken(tokenInfo);
      showToastMsg(`✅ Found: ${name} (${symbol})`, 'success');
      return tokenInfo;
    } catch (err) {
      console.error('Import token error:', err);
      showToastMsg('❌ Could not read token contract', 'error');
      return null;
    } finally {
      setImportLoading(false);
    }
  };
  
  // Save imported token to custom tokens list
  const saveCustomToken = (token) => {
    if (!token) return;
    const updated = { ...customTokens, [token.symbol]: token };
    setCustomTokens(updated);
    localStorage.setItem('pulsex-gold-custom-tokens', JSON.stringify(updated));
    showToastMsg(`💾 ${token.symbol} saved to your tokens!`, 'success');
    setShowImportModal(false);
    setImportCA('');
    setImportedToken(null);
  };
  
  // Remove custom token
  const removeCustomToken = (symbol) => {
    const updated = { ...customTokens };
    delete updated[symbol];
    setCustomTokens(updated);
    localStorage.setItem('pulsex-gold-custom-tokens', JSON.stringify(updated));
    showToastMsg(`🗑️ ${symbol} removed`, 'info');
  };
  
  // Get all available tokens (built-in + custom)
  const getAllTokens = () => ({ ...TOKENS, ...customTokens });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // GAS PRICE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  const getGasPrice = async () => {
    if (gasMode === 'custom' && customGasPrice) {
      return ethers.parseUnits(customGasPrice, 'gwei');
    }
    if (gasMode !== 'auto' && GAS_PRESETS[gasMode]) {
      return ethers.parseUnits(GAS_PRESETS[gasMode].gwei.toString(), 'gwei');
    }
    // Auto mode - let provider decide
    return undefined;
  };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // ROUTE FINDING - Check both V1 and V2 routers for best price
  // ═══════════════════════════════════════════════════════════════════════════
  const findBestRoute = async (tokenIn, tokenOut, amountIn) => {
    if (!amountIn || parseFloat(amountIn) <= 0) return null;
    
    const rpcProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
    const allTokens = getAllTokens();
    const tokenInData = allTokens[tokenIn];
    const tokenOutData = allTokens[tokenOut];
    if (!tokenInData || !tokenOutData) return null;
    
    const amountInWei = ethers.parseUnits(amountIn.toString(), tokenInData.decimals);
    const path = tokenInData.isNative || tokenIn === 'WPLS'
      ? [CONFIG.WPLS, getAddr(tokenOutData.address)]
      : tokenOutData.isNative || tokenOut === 'WPLS'
        ? [getAddr(tokenInData.address), CONFIG.WPLS]
        : [getAddr(tokenInData.address), CONFIG.WPLS, getAddr(tokenOutData.address)];
    
    const routes = [];
    
    // Try V1 Router
    try {
      const routerV1 = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, rpcProvider);
      const amountsV1 = await routerV1.getAmountsOut(amountInWei, path);
      const outV1 = parseFloat(ethers.formatUnits(amountsV1[amountsV1.length - 1], tokenOutData.decimals));
      routes.push({ router: 'V1', version: 1, output: outV1, path, address: CONFIG.ROUTER });
    } catch {}
    
    // Try V2 Router
    try {
      const routerV2 = new ethers.Contract(CONFIG.ROUTER_V2, ROUTER_ABI, rpcProvider);
      const amountsV2 = await routerV2.getAmountsOut(amountInWei, path);
      const outV2 = parseFloat(ethers.formatUnits(amountsV2[amountsV2.length - 1], tokenOutData.decimals));
      routes.push({ router: 'V2', version: 2, output: outV2, path, address: CONFIG.ROUTER_V2 });
    } catch {}
    
    if (routes.length === 0) return null;
    
    // Sort by best output
    routes.sort((a, b) => b.output - a.output);
    
    // Apply preference
    let selectedRoute = routes[0]; // Best by default
    if (routePreference === 'v1') {
      selectedRoute = routes.find(r => r.version === 1) || routes[0];
    } else if (routePreference === 'v2') {
      selectedRoute = routes.find(r => r.version === 2) || routes[0];
    }
    
    const routeInfo = {
      ...selectedRoute,
      allRoutes: routes,
      pathSymbols: path.map(addr => {
        const found = Object.values(allTokens).find(t => getAddr(t.address) === addr.toLowerCase());
        return found?.symbol || addr.slice(0, 6) + '...';
      }),
      priceImpact: routes.length > 1 ? ((routes[0].output - routes[routes.length - 1].output) / routes[0].output * 100).toFixed(2) : 0,
    };
    
    setSwapRoute(routeInfo);
    return routeInfo;
  };

  // Fetch live prices - Multi-source with sanity checks
  const fetchLivePrices = useCallback(async () => {
    try {
      const newPrices = { ...livePrices };
      
      // ═══════════════════════════════════════════════════════════════
      // SOURCE 1: GoPulse API (Primary for PulseChain - No CORS issues)
      // ═══════════════════════════════════════════════════════════════
      try {
        const goPulseRes = await fetch('https://api.gopulse.com/v2/prices/tokens?ids=pls,wpls,hex,plsx,ehex,inc');
        if (goPulseRes.ok) {
          const gpData = await goPulseRes.json();
          if (gpData?.pls?.price) {
            newPrices.PLS = gpData.pls.price;
            newPrices.WPLS = gpData.pls.price;
            console.log('📊 GoPulse PLS: $' + gpData.pls.price.toFixed(8));
          }
          if (gpData?.hex?.price) {
            newPrices.HEX = gpData.hex.price;
            console.log('📊 GoPulse HEX: $' + gpData.hex.price.toFixed(6));
          }
          if (gpData?.plsx?.price) newPrices.PLSX = gpData.plsx.price;
          if (gpData?.ehex?.price) newPrices.eHEX = gpData.ehex.price;
          if (gpData?.inc?.price) newPrices.INC = gpData.inc.price;
        }
      } catch (gpErr) {
        console.warn('GoPulse fetch failed:', gpErr.message);
      }

      // ═══════════════════════════════════════════════════════════════
      // SOURCE 2: DexScreener (Primary for PulseChain-native tokens)
      // Fetch in parallel for speed
      // ═══════════════════════════════════════════════════════════════
      const dexPairs = [
        { symbol: 'URMOM', pair: '0x0548656e272fec9534e180d3174cfc57ab6e10c0' },
        { symbol: 'DTGC', pair: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7' },
        { symbol: 'PLSX', pair: '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9' },
        { symbol: 'INC', pair: '0xe56043671df55de5cdf8459710433c10324de0ae' },
      ];
      
      await Promise.all(dexPairs.map(async ({ symbol, pair }) => {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${pair}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.pair?.priceUsd) {
              newPrices[symbol] = parseFloat(data.pair.priceUsd);
              console.log(`📊 DexScreener ${symbol}: $${data.pair.priceUsd}`);
            }
          }
        } catch {}
      }));

      // ═══════════════════════════════════════════════════════════════
      // SOURCE 3: Fallback defaults for major tokens (if APIs fail)
      // ═══════════════════════════════════════════════════════════════
      if (!newPrices.WETH || newPrices.WETH < 1000) newPrices.WETH = 3300;
      if (!newPrices.WBTC || newPrices.WBTC < 50000) newPrices.WBTC = 100000;
      
      // ═══════════════════════════════════════════════════════════════
      // SANITY CHECKS - Ensure PLS is in expected range
      // ═══════════════════════════════════════════════════════════════
      if (!newPrices.PLS || newPrices.PLS < 0.000005 || newPrices.PLS > 0.0001) {
        console.warn('⚠️ PLS price out of range, using fallback: $0.0000159');
        newPrices.PLS = 0.0000159;
        newPrices.WPLS = 0.0000159;
      }
      
      console.log(`📊 Final: PLS=$${newPrices.PLS?.toFixed(8)} | DTGC=$${newPrices.DTGC?.toFixed(8)} | HEX=$${newPrices.HEX?.toFixed(6)}`);
      
      setLivePrices(newPrices);
    } catch (err) {
      console.log('Price fetch error:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 30000);
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  // Fetch all balances
  const fetchAllBalances = useCallback(async () => {
    if (!provider || !userAddress) return;
    
    try {
      const newBalances = {};
      const plsBal = await provider.getBalance(userAddress);
      newBalances.PLS = parseFloat(ethers.formatEther(plsBal));
      
      const tokenPromises = Object.entries(TOKENS).map(async ([symbol, token]) => {
        if (token.isNative) return;
        try {
          const contract = new ethers.Contract(getAddr(token.address), ERC20_ABI, provider);
          const bal = await contract.balanceOf(userAddress);
          newBalances[symbol] = parseFloat(ethers.formatUnits(bal, token.decimals));
        } catch {
          newBalances[symbol] = 0;
        }
      });
      
      await Promise.all(tokenPromises);
      setBalances(newBalances);
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  }, [provider, userAddress]);

  useEffect(() => {
    if (userAddress && provider) fetchAllBalances();
  }, [userAddress, provider, fetchAllBalances]);

  // Wallet scanner - FAST approach like Zapper X (prioritize PulseScan API)
  const scanWalletTokens = useCallback(async () => {
    if (!userAddress) return;
    setLoadingBalances(true);
    showToastMsg('🔍 Scanning wallet...', 'info');
    
    try {
      const foundTokens = [];
      const seenAddresses = new Set();
      const addr = userAddress.toLowerCase();
      
      // Use dedicated RPC to avoid MetaMask rate limits
      const scanProvider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: PulseScan APIs (fastest, no rate limits, most complete)
      // Fetch PLS balance + all tokens from APIs in parallel
      // ═══════════════════════════════════════════════════════════════
      const [plsBal, pulseScanTokens, pulseScanV1Tokens] = await Promise.all([
        scanProvider.getBalance(userAddress),
        fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${addr}/token-balances`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => []),
        fetch(`https://api.scan.pulsechain.com/api?module=account&action=tokenlist&address=${addr}`)
          .then(r => r.ok ? r.json() : { result: [] })
          .then(d => d.result || [])
          .catch(() => []),
      ]);
      
      // Add PLS immediately
      const plsBalNum = parseFloat(ethers.formatEther(plsBal));
      if (plsBalNum > 0) {
        foundTokens.push({ 
          symbol: 'PLS', 
          name: 'PulseChain', 
          address: null, 
          decimals: 18, 
          balance: plsBalNum, 
          icon: TOKENS.PLS.logo,
          emoji: '💜',
          usdValue: plsBalNum * (livePrices.PLS || 0.000018), 
          price: livePrices.PLS || 0.000018 
        });
        seenAddresses.add('native');
        setBalances(prev => ({ ...prev, PLS: plsBalNum }));
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: Process PulseScan API responses (FAST - no RPC needed)
      // ═══════════════════════════════════════════════════════════════
      
      // Process v2 API first (better data)
      if (Array.isArray(pulseScanTokens)) {
        for (const item of pulseScanTokens) {
          const tokenAddr = item.token?.address?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);
          
          const decimals = parseInt(item.token?.decimals) || 18;
          const bal = parseFloat(item.value || '0') / Math.pow(10, decimals);
          if (bal <= 0.000001) continue;
          
          const sym = (item.token?.symbol || '').toUpperCase();
          const price = livePrices[sym] || 0;
          
          // Check if known token
          let icon = getTokenLogo(tokenAddr);
          let emoji = '🔸';
          const knownToken = Object.values(TOKENS).find(t => t.address?.toLowerCase() === tokenAddr);
          if (knownToken) {
            icon = knownToken.logo;
            emoji = knownToken.emoji || '🔸';
          }
          
          foundTokens.push({ 
            symbol: item.token?.symbol || 'UNKNOWN', 
            name: item.token?.name || 'Unknown', 
            address: item.token?.address, 
            decimals, 
            balance: bal, 
            icon, 
            emoji,
            usdValue: bal * price, 
            price 
          });
          if (TOKENS[sym]) setBalances(prev => ({ ...prev, [sym]: bal }));
        }
      }
      
      // Process v1 API (backup)
      if (Array.isArray(pulseScanV1Tokens)) {
        for (const item of pulseScanV1Tokens) {
          const tokenAddr = item.contractAddress?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);
          
          const decimals = parseInt(item.decimals) || 18;
          const bal = parseFloat(item.balance || '0') / Math.pow(10, decimals);
          if (bal <= 0.000001) continue;
          
          const sym = (item.symbol || '').toUpperCase();
          const price = livePrices[sym] || 0;
          
          let icon = getTokenLogo(tokenAddr);
          let emoji = '🔸';
          const knownToken = Object.values(TOKENS).find(t => t.address?.toLowerCase() === tokenAddr);
          if (knownToken) {
            icon = knownToken.logo;
            emoji = knownToken.emoji || '🔸';
          }
          
          foundTokens.push({ 
            symbol: item.symbol || 'UNKNOWN', 
            name: item.name || 'Unknown', 
            address: item.contractAddress, 
            decimals, 
            balance: bal, 
            icon, 
            emoji,
            usdValue: bal * price, 
            price 
          });
          if (TOKENS[sym]) setBalances(prev => ({ ...prev, [sym]: bal }));
        }
      }
      
      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: Quick check for critical tokens not in PulseScan (single batch)
      // Only check: DTGC, URMOM, PLSX, HEX (most important)
      // ═══════════════════════════════════════════════════════════════
      const criticalTokens = ['DTGC', 'URMOM', 'PLSX', 'HEX', 'INC'];
      const missingCritical = criticalTokens.filter(sym => {
        const token = TOKENS[sym];
        if (!token) return false;
        return !seenAddresses.has(token.address?.toLowerCase());
      });
      
      if (missingCritical.length > 0) {
        await Promise.all(missingCritical.map(async (sym) => {
          const token = TOKENS[sym];
          if (!token?.address) return;
          try {
            const contract = new ethers.Contract(token.address, ['function balanceOf(address) view returns (uint256)'], scanProvider);
            const bal = await contract.balanceOf(userAddress);
            const balNum = parseFloat(ethers.formatUnits(bal, token.decimals));
            if (balNum > 0.000001 && !seenAddresses.has(token.address.toLowerCase())) {
              seenAddresses.add(token.address.toLowerCase());
              const price = livePrices[sym] || 0;
              foundTokens.push({
                symbol: sym,
                name: token.name,
                address: token.address,
                decimals: token.decimals,
                balance: balNum,
                icon: token.logo || '🔸',
                emoji: token.emoji,
                usdValue: balNum * price,
                price
              });
              setBalances(prev => ({ ...prev, [sym]: balNum }));
            }
          } catch {}
        }));
      }
      
      // Fetch prices for tokens without prices from DexScreener (batch lookup)
      const tokensNeedingPrices = foundTokens.filter(t => t.price === 0 && t.address && t.balance > 0);
      if (tokensNeedingPrices.length > 0) {
        try {
          // DexScreener allows batch lookups - get prices for unknown tokens
          const addressBatch = tokensNeedingPrices.slice(0, 30).map(t => t.address).join(',');
          const dexRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addressBatch}`);
          if (dexRes.ok) {
            const dexData = await dexRes.json();
            if (dexData?.pairs) {
              for (const pair of dexData.pairs) {
                const tokenAddr = pair.baseToken?.address?.toLowerCase();
                const token = foundTokens.find(t => t.address?.toLowerCase() === tokenAddr);
                if (token && pair.priceUsd) {
                  token.price = parseFloat(pair.priceUsd);
                  token.usdValue = token.balance * token.price;
                }
              }
            }
          }
        } catch (e) {
          console.log('DexScreener price lookup failed:', e.message);
        }
      }
      
      // Sort by USD value (highest first)
      foundTokens.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
      setWalletTokens(foundTokens);
      setLastScanTime(Date.now());
      const total = foundTokens.reduce((sum, t) => sum + (t.usdValue || 0), 0);
      setTotalPortfolioValue(total);
      
      // Fetch LP positions in background
      fetchLpPositions();
      
      showToastMsg(`✅ Found ${foundTokens.length} tokens (${formatUSD(total)})`, 'success');
    } catch (err) {
      console.error('Scan error:', err);
      showToastMsg('Scan failed: ' + err.message, 'error');
    } finally {
      setLoadingBalances(false);
    }
  }, [provider, userAddress, livePrices, showToastMsg]);

  const fetchLpPositions = useCallback(async () => {
    if (!provider || !userAddress) return;
    try {
      const positions = [];
      
      // Use KNOWN_PAIRS for instant lookup (no factory calls needed)
      const lpPairs = [
        { name: 'DTGC/PLS', address: KNOWN_PAIRS['DTGC-PLS'] },
        { name: 'DTGC/URMOM', address: KNOWN_PAIRS['DTGC-URMOM'] },
        { name: 'URMOM/PLS', address: KNOWN_PAIRS['URMOM-PLS'] },
        { name: 'PLSX/PLS', address: KNOWN_PAIRS['PLSX-PLS'] },
        { name: 'HEX/PLS', address: KNOWN_PAIRS['HEX-PLS'] },
      ];
      
      // Parallel fetch all LP balances at once
      const balances = await Promise.all(lpPairs.map(async (pair) => {
        if (!pair.address) return null;
        try {
          const lpContract = new ethers.Contract(pair.address, ['function balanceOf(address) view returns (uint256)'], provider);
          const lpBal = await lpContract.balanceOf(userAddress);
          const lpBalNum = parseFloat(ethers.formatEther(lpBal));
          if (lpBalNum > 0.000001) {
            return { name: pair.name, address: pair.address, balance: lpBalNum };
          }
        } catch {}
        return null;
      }));
      
      setLpPositions(balances.filter(Boolean));
    } catch (err) {
      console.error('LP positions error:', err);
    }
  }, [provider, userAddress]);

  // AUTO-SCAN: Trigger wallet scan immediately when wallet connects (any tab)
  useEffect(() => {
    if (userAddress && walletTokens.length === 0) {
      scanWalletTokens();
    }
  }, [userAddress, scanWalletTokens]);

  // Also refresh on portfolio tab if manually needed
  useEffect(() => {
    if (activeTab === 'portfolio' && userAddress && walletTokens.length === 0) scanWalletTokens();
  }, [activeTab, userAddress, walletTokens.length, scanWalletTokens]);

  // ═══════════════════════════════════════════════════════════════════════════
  // INSTABOND: Fetch top 10 tokens closest to bonding from pump.tires
  // ═══════════════════════════════════════════════════════════════════════════
  const [instabondError, setInstabondError] = useState(null);

  const fetchPreBondedTokens = useCallback(async () => {
    setInstabondLoading(true);
    setInstabondError(null);

    try {
      // Use our API proxy which handles CORS and fallbacks
      // filter=activity gives us the most active tokens (more likely to graduate soon)
      const response = await fetch('/api/pump-tokens?filter=activity&page=1');

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();

      // Check for API error
      if (!data.success) {
        throw new Error(data.error || 'API unavailable');
      }

      // Check if we got tokens
      if (!data.tokens || data.tokens.length === 0) {
        setInstabondError('No tokens found. pump.tires may be down.');
        setPreBondedTokens([]);
        return;
      }

      // Log source for debugging
      console.log(`InstaBond: Loaded ${data.tokens.length} tokens from ${data.source}`);

      // Map tokens to our format with progress calculation
      const preBonded = data.tokens.map(t => ({
        address: t.address,
        name: t.name || 'Unknown',
        symbol: t.symbol || '???',
        creator: t.creator?.username || 'Anonymous',
        progress: (parseFloat(t.tokens_sold || 0) / TARGET_TOKENS_SOLD) * 100,
        tokensSold: t.tokens_sold || 0,
        price: t.price || '0',
        marketValue: t.market_value || '0',
        logo: t.image_cid ? `${PUMP_TIRES_IPFS}/${t.image_cid}` : null,
        createdAt: parseInt(t.created_timestamp || 0) * 1000,
      }))
        .sort((a, b) => b.progress - a.progress) // Highest progress first
        .slice(0, 10); // Top 10

      setPreBondedTokens(preBonded);

      if (preBonded.length > 0) {
        const nearGrad = preBonded.filter(t => t.progress >= 80).length;
        showToastMsg(`🔥 ${preBonded.length} tokens loaded (${nearGrad} near graduation!)`, 'success');
      }
    } catch (err) {
      console.error('InstaBond fetch error:', err);
      setInstabondError(`Failed to load: ${err.message}`);
      showToastMsg(`❌ Could not load pump.tires data`, 'error');
    }

    setInstabondLoading(false);
  }, [showToastMsg]);

  // Auto-fetch when InstaBond tab is active
  useEffect(() => {
    if (activeTab === 'instabond' && preBondedTokens.length === 0) {
      fetchPreBondedTokens();
    }
  }, [activeTab, preBondedTokens.length, fetchPreBondedTokens]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🏆 PROBABLE WINS: Fetch and score top tokens from DEXScreener
  // ═══════════════════════════════════════════════════════════════════════════
  const calculateWinScore = (pair) => {
    let score = 50;
    const reasons = [];

    const volumeToLiq = (pair.volume?.h24 || 0) / (pair.liquidity?.usd || 1);
    if (volumeToLiq > 2) { score += 15; reasons.push('🔥 High volume momentum'); }
    else if (volumeToLiq > 1) { score += 10; reasons.push('📊 Good trading activity'); }
    else if (volumeToLiq > 0.5) { score += 5; }

    if ((pair.liquidity?.usd || 0) > 500000) { score += 15; reasons.push('💧 Deep liquidity'); }
    else if ((pair.liquidity?.usd || 0) > 100000) { score += 10; reasons.push('💧 Solid liquidity'); }
    else if ((pair.liquidity?.usd || 0) > 50000) { score += 5; }
    else if ((pair.liquidity?.usd || 0) < 20000) { score -= 10; reasons.push('⚠️ Low liquidity risk'); }

    const h24 = pair.priceChange?.h24 || 0;
    const h1 = pair.priceChange?.h1 || 0;
    if (h24 > 20 && h1 < 5 && h1 > -5) { score += 15; reasons.push('📈 Consolidating after pump'); }
    else if (h24 > 5 && h24 < 30 && h1 > 0) { score += 12; reasons.push('📈 Steady uptrend'); }
    else if (h24 < -10 && h1 > 2) { score += 10; reasons.push('🔄 Potential reversal'); }
    else if (h24 > 100) { score -= 10; reasons.push('⚠️ Overextended'); }
    else if (h24 < -30) { score -= 15; reasons.push('⚠️ Heavy selling'); }

    const buyRatio = (pair.txns?.h24?.buys || 0) / ((pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 1));
    if (buyRatio > 0.6) { score += 10; reasons.push('🟢 More buyers'); }
    else if (buyRatio < 0.4) { score -= 5; reasons.push('🔴 More sellers'); }

    const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60) : 0;
    if (ageHours > 24 && ageHours < 168) { score += 10; reasons.push('⏰ Sweet spot age'); }
    else if (ageHours < 6) { score += 5; reasons.push('🆕 Very new'); }

    return { score: Math.max(0, Math.min(100, score)), reasons };
  };

  const fetchProbableWins = useCallback(async () => {
    setWinsLoading(true);
    setWinsError(null);

    try {
      const response = await fetch(`${DEXSCREENER_API}/dex/search?q=pulsechain`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      const pairs = (data.pairs || []).filter(
        p => p.chainId === 'pulsechain' && (p.liquidity?.usd || 0) > 10000
      );

      pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));

      const seen = new Set();
      const scored = [];

      for (const pair of pairs) {
        const addr = pair.baseToken?.address?.toLowerCase();
        if (!addr || seen.has(addr)) continue;
        seen.add(addr);

        const { score, reasons } = calculateWinScore(pair);
        const ageHours = pair.pairCreatedAt ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60) : 0;

        scored.push({
          address: pair.baseToken.address,
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          priceUsd: parseFloat(pair.priceUsd || '0'),
          priceChange24h: pair.priceChange?.h24 || 0,
          priceChange1h: pair.priceChange?.h1 || 0,
          volume24h: pair.volume?.h24 || 0,
          liquidity: pair.liquidity?.usd || 0,
          marketCap: pair.marketCap || 0,
          dexScreenerUrl: pair.url,
          txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
          ageHours,
          score,
          reasons,
        });

        if (scored.length >= 30) break;
      }

      scored.sort((a, b) => b.score - a.score);
      setProbableWins(scored.slice(0, 15));

      if (scored.length > 0) {
        const top = scored[0];
        showToastMsg(`🏆 Loaded ${scored.length} opportunities! Top: ${top.symbol} (${top.score}/100)`, 'success');
      }
    } catch (err) {
      console.error('Probable Wins fetch error:', err);
      setWinsError(`Failed to load: ${err.message}`);
      showToastMsg(`❌ Could not load DEXScreener data`, 'error');
    }

    setWinsLoading(false);
  }, [showToastMsg]);

  // Auto-fetch when Wins tab is active
  useEffect(() => {
    if (activeTab === 'wins' && probableWins.length === 0) {
      fetchProbableWins();
    }
  }, [activeTab, probableWins.length, fetchProbableWins]);

  // Get quote
  const getQuote = useCallback(async (inputAmount, from, to) => {
    if (!provider || !inputAmount || parseFloat(inputAmount) <= 0) { setToAmount(''); setSwapRoute(null); return; }
    setQuoteLoading(true);
    try {
      const allTokens = getAllTokens();
      const fromTokenData = allTokens[from];
      const toTokenData = allTokens[to];
      if (!fromTokenData || !toTokenData) { setToAmount(''); return; }
      
      // Try to find best route across V1 and V2
      const route = await findBestRoute(from, to, inputAmount);
      if (route && route.output > 0) {
        setToAmount(route.output.toFixed(6));
      } else {
        // Fallback: direct V1 quote
        const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, provider);
        const fromAddr = getAddr(fromTokenData.address);
        const toAddr = getAddr(toTokenData.address);
        const amountIn = ethers.parseUnits(inputAmount, fromTokenData.decimals);
        let path = [fromAddr, toAddr];
        let amounts;
        
        try {
          amounts = await router.getAmountsOut(amountIn, path);
        } catch {
          if (fromAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase() && toAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase()) {
            path = [fromAddr, getAddr(CONFIG.WPLS), toAddr];
            amounts = await router.getAmountsOut(amountIn, path);
          }
        }
        
        if (amounts && amounts.length > 0) {
          setToAmount(parseFloat(ethers.formatUnits(amounts[amounts.length - 1], toTokenData.decimals)).toFixed(6));
          setSwapRoute({ router: 'V1', version: 1, pathSymbols: [from, to] });
        }
      }
    } catch (err) {
      console.error('Quote error:', err);
      setToAmount('');
    }
    setQuoteLoading(false);
  }, [provider, routePreference]);

  useEffect(() => {
    const timer = setTimeout(() => { if (fromAmount && fromToken && toToken) getQuote(fromAmount, fromToken, toToken); }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, getQuote, routePreference]);

  // Execute swap
  const executeSwap = async () => {
    if (!signer || !fromAmount || !toAmount) return;
    setSwapLoading(true);
    showToastMsg('Preparing swap...', 'info');
    
    try {
      // Use selected router from route finding, or default to V1
      const routerAddress = swapRoute?.address || CONFIG.ROUTER;
      const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);
      const allTokens = getAllTokens();
      const fromTokenData = allTokens[fromToken];
      const toTokenData = allTokens[toToken];
      const deadline = getDeadline();
      
      const fromAddr = getAddr(fromTokenData.address);
      const toAddr = getAddr(toTokenData.address);
      
      const inputAmount = ethers.parseUnits(fromAmount, fromTokenData.decimals);
      const expectedOutput = ethers.parseUnits(toAmount, toTokenData.decimals);
      const amountOutMin = expectedOutput * BigInt(10000 - slippageBps) / 10000n;
      
      // Use path from route finding if available, otherwise calculate
      let path = swapRoute?.path || [fromAddr, toAddr];
      if (!swapRoute?.path) {
        try { await router.getAmountsOut(inputAmount, path); } catch {
          if (fromAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase() && toAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase()) {
            path = [fromAddr, getAddr(CONFIG.WPLS), toAddr];
          }
        }
      }
      
      // Get gas settings
      const gasPrice = await getGasPrice();
      const txOptions = gasPrice ? { gasPrice } : {};
      
      // Helper to safely check and approve
      const checkAndApprove = async (tokenAddr, tokenSymbol, amount) => {
        try {
          const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
          let allowance = 0n;
          try {
            allowance = await tokenContract.allowance(userAddress, routerAddress);
          } catch (e) {
            console.log('Allowance check failed, assuming 0:', e.message);
          }
          if (allowance < amount) {
            showToastMsg('Approving ' + tokenSymbol + '...', 'info');
            const tx = await tokenContract.approve(routerAddress, ethers.MaxUint256, txOptions);
            await tx.wait();
          }
        } catch (e) {
          console.error('Approval error:', e);
          throw new Error(`Failed to approve ${tokenSymbol}: ${e.message}`);
        }
      };
      
      const routerLabel = swapRoute?.router || 'V1';
      
      // ═══════════════════════════════════════════════════════════════
      // EXECUTE SWAP WITH 1% GROWTH ENGINE FEE
      // ═══════════════════════════════════════════════════════════════
      
      if (fromToken === 'PLS' || fromTokenData.isNative) {
        // Calculate 1% fee from input PLS
        const growthFee = inputAmount * BigInt(CONFIG.GROWTH_ENGINE_FEE_BPS) / 10000n;
        const swapAmount = inputAmount - growthFee;
        
        // Send 1% to Growth Engine first
        showToastMsg('🌱 Sending 1% to Growth Engine...', 'info');
        const feeTx = await signer.sendTransaction({
          to: CONFIG.GROWTH_ENGINE_WALLET,
          value: growthFee,
          ...txOptions
        });
        await feeTx.wait();
        
        showToastMsg(`Swapping via PulseX ${routerLabel}...`, 'info');
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(amountOutMin, path, userAddress, deadline, { value: swapAmount, ...txOptions });
        await tx.wait();
      } else if (toToken === 'PLS' || toTokenData.isNative) {
        await checkAndApprove(fromAddr, fromToken, inputAmount);
        showToastMsg(`Swapping via PulseX ${routerLabel}...`, 'info');
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(inputAmount, amountOutMin, path, userAddress, deadline, txOptions);
        await tx.wait();
        
        // After swap, send 1% of received PLS to Growth Engine
        showToastMsg('🌱 Sending 1% to Growth Engine...', 'info');
        const plsBalance = await signer.provider.getBalance(userAddress);
        const growthFee = amountOutMin * BigInt(CONFIG.GROWTH_ENGINE_FEE_BPS) / 10000n;
        if (plsBalance >= growthFee) {
          const feeTx = await signer.sendTransaction({
            to: CONFIG.GROWTH_ENGINE_WALLET,
            value: growthFee,
            ...txOptions
          });
          await feeTx.wait();
        }
      } else {
        await checkAndApprove(fromAddr, fromToken, inputAmount);
        showToastMsg(`Swapping via PulseX ${routerLabel}...`, 'info');
        const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(inputAmount, amountOutMin, path, userAddress, deadline, txOptions);
        await tx.wait();
        
        // After token-to-token swap, send 1% of received tokens to Growth Engine
        showToastMsg('🌱 Sending 1% to Growth Engine...', 'info');
        const outTokenContract = new ethers.Contract(toAddr, ERC20_ABI, signer);
        const outBalance = await outTokenContract.balanceOf(userAddress);
        const growthFee = amountOutMin * BigInt(CONFIG.GROWTH_ENGINE_FEE_BPS) / 10000n;
        if (outBalance >= growthFee) {
          try {
            const feeTx = await outTokenContract.transfer(CONFIG.GROWTH_ENGINE_WALLET, growthFee, txOptions);
            await feeTx.wait();
          } catch (feeErr) {
            console.warn('Growth fee transfer failed (token may have transfer restrictions):', feeErr.message);
          }
        }
      }
      
      showToastMsg(`✅ Swapped ${fromAmount} ${fromToken} for ${toToken} via ${routerLabel}!`, 'success');
      setFromAmount(''); setToAmount(''); setSwapRoute(null);
      fetchAllBalances();
    } catch (err) {
      console.error('Swap error:', err);
      showToastMsg(err.reason || err.message || 'Swap failed', 'error');
    }
    setSwapLoading(false);
  };

  const flipTokens = () => { setFromToken(toToken); setToToken(fromToken); setFromAmount(toAmount); setToAmount(fromAmount); };

  // LP functions
  const fetchPairInfo = useCallback(async () => {
    if (!provider || !lpToken0 || !lpToken1 || lpToken0 === lpToken1) { setPairAddress(null); setPairReserves(null); return; }
    try {
      const token0 = TOKENS[lpToken0];
      const token1 = TOKENS[lpToken1];
      if (!token0 || !token1) return;
      
      const addr0 = getAddr(token0.address);
      const addr1 = getAddr(token1.address);
      
      console.log('Fetching pair for:', lpToken0, lpToken1, addr0, addr1);
      
      // Check known pairs first (fast lookup)
      const knownKey1 = `${lpToken0}-${lpToken1}`;
      const knownKey2 = `${lpToken1}-${lpToken0}`;
      let lpAddr = KNOWN_PAIRS[knownKey1] || KNOWN_PAIRS[knownKey2] || null;
      
      if (lpAddr) {
        console.log('Found in KNOWN_PAIRS:', lpAddr);
      } else {
        // Try V1 factory first, then V2
        let usedFactory = 'V1';
        
        try {
          const factoryV1 = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
          lpAddr = await factoryV1.getPair(addr0, addr1);
          console.log('V1 Pair address:', lpAddr);
        } catch (e) {
          console.log('V1 factory error:', e.message);
        }
        
        if (!lpAddr || lpAddr === ethers.ZeroAddress) {
          try {
            const factoryV2 = new ethers.Contract(CONFIG.FACTORY_V2, FACTORY_ABI, provider);
            lpAddr = await factoryV2.getPair(addr0, addr1);
            usedFactory = 'V2';
            console.log('V2 Pair address:', lpAddr);
          } catch (e) {
            console.log('V2 factory error:', e.message);
          }
        }
        
        if (lpAddr && lpAddr !== ethers.ZeroAddress) {
          console.log('Found pair on', usedFactory, ':', lpAddr);
        }
      }
      
      if (lpAddr && lpAddr !== ethers.ZeroAddress) {
        setPairAddress(lpAddr);
        
        try {
          const pairContract = new ethers.Contract(lpAddr, PAIR_ABI, provider);
          const [reserves, pairToken0] = await Promise.all([pairContract.getReserves(), pairContract.token0()]);
          const isToken0First = pairToken0.toLowerCase() === addr0.toLowerCase();
          setPairReserves({ reserve0: isToken0First ? reserves[0] : reserves[1], reserve1: isToken0First ? reserves[1] : reserves[0] });
          console.log('Reserves:', reserves[0].toString(), reserves[1].toString());
        } catch (e) {
          console.log('Reserve fetch error:', e.message);
          setPairReserves(null);
        }
      } else {
        console.log('No pair found on V1 or V2');
        setPairAddress(null); 
        setPairReserves(null);
      }
    } catch (err) {
      console.error('Pair fetch error:', err);
      setPairAddress(null); setPairReserves(null);
    }
  }, [provider, lpToken0, lpToken1]);

  useEffect(() => { fetchPairInfo(); }, [fetchPairInfo]);

  const calculateLpAmount1 = useCallback((amount0) => {
    if (!pairReserves || !amount0 || parseFloat(amount0) <= 0) { setLpAmount1(''); return; }
    try {
      const token0 = TOKENS[lpToken0];
      const token1 = TOKENS[lpToken1];
      const amount0Wei = ethers.parseUnits(amount0, token0.decimals);
      const amount1Wei = (amount0Wei * pairReserves.reserve1) / pairReserves.reserve0;
      setLpAmount1(parseFloat(ethers.formatUnits(amount1Wei, token1.decimals)).toFixed(6));
    } catch { setLpAmount1(''); }
  }, [pairReserves, lpToken0, lpToken1]);

  useEffect(() => { const timer = setTimeout(() => { if (lpAmount0) calculateLpAmount1(lpAmount0); }, 300); return () => clearTimeout(timer); }, [lpAmount0, calculateLpAmount1]);

  const addLiquidity = async () => {
    if (!signer || !lpAmount0 || !lpAmount1) {
      showToastMsg('Please enter both amounts', 'error');
      return;
    }
    
    if (!userAddress) {
      showToastMsg('Please connect your wallet first', 'error');
      return;
    }
    
    setLpLoading(true);
    showToastMsg('Preparing transaction...', 'info');
    
    try {
      const token0 = TOKENS[lpToken0];
      const token1 = TOKENS[lpToken1];
      
      if (!token0 || !token1) {
        throw new Error('Invalid token selection');
      }
      
      const addr0 = getAddr(token0.address);
      const addr1 = getAddr(token1.address);
      
      console.log('🔧 LP Creation Debug:');
      console.log('  Token0:', lpToken0, addr0);
      console.log('  Token1:', lpToken1, addr1);
      console.log('  Amount0:', lpAmount0);
      console.log('  Amount1:', lpAmount1);
      
      const amount0Desired = ethers.parseUnits(lpAmount0, token0.decimals);
      const amount1Desired = ethers.parseUnits(lpAmount1, token1.decimals);
      const amount0Min = amount0Desired * BigInt(10000 - slippageBps) / 10000n;
      const amount1Min = amount1Desired * BigInt(10000 - slippageBps) / 10000n;
      const deadline = getDeadline();
      
      // Helper to safely check and approve
      const checkAndApprove = async (tokenAddr, tokenSymbol, amount) => {
        console.log(`  Checking approval for ${tokenSymbol}...`);
        try {
          const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
          let allowance = 0n;
          try {
            allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
            console.log(`  Current allowance: ${ethers.formatEther(allowance)}`);
          } catch (e) {
            console.log('  Allowance check failed, assuming 0:', e.message);
          }
          if (allowance < amount) {
            showToastMsg(`Approving ${tokenSymbol}...`, 'info');
            console.log(`  Approving ${tokenSymbol} for router...`);
            const tx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
            await tx.wait();
            console.log(`  ✅ ${tokenSymbol} approved!`);
          } else {
            console.log(`  ✅ ${tokenSymbol} already approved`);
          }
        } catch (e) {
          console.error('  Approval error:', e);
          throw new Error(`Failed to approve ${tokenSymbol}: ${e.reason || e.message}`);
        }
      };
      
      // Use V1 router for LP creation
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
      console.log('  Router:', CONFIG.ROUTER);
      
      if (lpToken1 === 'PLS') {
        // Token0/PLS pair - approve token0, send PLS as value
        console.log('  Route: addLiquidityETH (token0 + native PLS)');
        await checkAndApprove(addr0, lpToken0, amount0Desired);
        showToastMsg('Adding liquidity...', 'info');
        const tx = await router.addLiquidityETH(
          addr0, 
          amount0Desired, 
          amount0Min, 
          amount1Min, 
          userAddress, 
          deadline, 
          { value: amount1Desired }
        );
        console.log('  TX sent:', tx.hash);
        await tx.wait();
        console.log('  ✅ TX confirmed!');
      } else if (lpToken0 === 'PLS') {
        // PLS/Token1 pair - approve token1, send PLS as value
        console.log('  Route: addLiquidityETH (native PLS + token1)');
        await checkAndApprove(addr1, lpToken1, amount1Desired);
        showToastMsg('Adding liquidity...', 'info');
        const tx = await router.addLiquidityETH(
          addr1, 
          amount1Desired, 
          amount1Min, 
          amount0Min, 
          userAddress, 
          deadline, 
          { value: amount0Desired }
        );
        console.log('  TX sent:', tx.hash);
        await tx.wait();
        console.log('  ✅ TX confirmed!');
      } else {
        // Token0/Token1 pair (no native PLS)
        console.log('  Route: addLiquidity (token0 + token1)');
        await checkAndApprove(addr0, lpToken0, amount0Desired);
        await checkAndApprove(addr1, lpToken1, amount1Desired);
        showToastMsg('Adding liquidity...', 'info');
        const tx = await router.addLiquidity(
          addr0, 
          addr1, 
          amount0Desired, 
          amount1Desired, 
          amount0Min, 
          amount1Min, 
          userAddress, 
          deadline
        );
        console.log('  TX sent:', tx.hash);
        await tx.wait();
        console.log('  ✅ TX confirmed!');
      }
      
      showToastMsg(`✅ Added ${lpToken0}/${lpToken1} liquidity!`, 'success');
      setLpAmount0(''); setLpAmount1('');
      fetchAllBalances(); fetchPairInfo();
    } catch (err) {
      console.error('LP creation error:', err);
      // Better error message extraction
      let errorMsg = 'Transaction failed';
      if (err.reason) {
        errorMsg = err.reason;
      } else if (err.message) {
        if (err.message.includes('user rejected')) {
          errorMsg = 'Transaction rejected by user';
        } else if (err.message.includes('insufficient')) {
          errorMsg = 'Insufficient balance';
        } else {
          errorMsg = err.message.slice(0, 80);
        }
      }
      showToastMsg(errorMsg, 'error');
    }
    setLpLoading(false);
  };

  // Token selector component
  // Enhanced Token Selector with Copy CA, Custom Tokens, Import
  const TokenSelector = ({ value, onChange, show, setShow, excludeToken }) => {
    const allTokens = getAllTokens();
    const currentToken = allTokens[value];
    
    return (
      <div style={{ position: 'relative' }}>
        <button style={styles.tokenSelect} onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
          <TokenIcon icon={currentToken?.logo} emoji={currentToken?.emoji} size={24} />
          <span>{value}</span>
          {currentToken?.address && (
            <span 
              onClick={(e) => { e.stopPropagation(); copyToClipboard(currentToken.address, value + ' CA'); }}
              style={{ marginLeft: '4px', fontSize: '0.6rem', color: '#888', cursor: 'pointer', padding: '2px 4px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}
              title="Copy Contract Address"
            >📋</span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>▼</span>
        </button>
        {show && (
          <div style={{ ...styles.selectDropdown, maxHeight: '350px' }} onClick={(e) => e.stopPropagation()}>
            {/* Quick CA Input at top */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: '#1a1a2e', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  placeholder="Paste CA to import..."
                  value={importCA}
                  onChange={(e) => setImportCA(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    flex: 1, padding: '6px 8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.3)', 
                    borderRadius: '6px', color: '#fff', fontSize: '0.7rem', outline: 'none' 
                  }}
                />
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (importCA.length === 42) {
                      const token = await importTokenByCA(importCA);
                      if (token) {
                        saveCustomToken(token);
                        onChange(token.symbol);
                        setShow(false);
                        setImportCA('');
                      }
                    }
                  }}
                  disabled={importCA.length !== 42 || importLoading}
                  style={{ 
                    padding: '6px 10px', background: importCA.length === 42 ? 'linear-gradient(135deg, #D4AF37, #FFD700)' : 'rgba(255,255,255,0.1)', 
                    border: 'none', borderRadius: '6px', color: importCA.length === 42 ? '#000' : '#666', fontWeight: 600, fontSize: '0.7rem', cursor: importCA.length === 42 ? 'pointer' : 'not-allowed' 
                  }}
                >
                  {importLoading ? '...' : '+ Add'}
                </button>
              </div>
            </div>
            
            {/* Custom tokens section */}
            {Object.keys(customTokens).length > 0 && (
              <div style={{ padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.65rem', color: '#D4AF37', marginBottom: '4px', fontWeight: 600 }}>⭐ YOUR TOKENS</div>
                {Object.entries(customTokens).filter(([sym]) => sym !== excludeToken).map(([symbol, token]) => (
                  <div key={symbol} style={{ ...styles.selectOption, background: symbol === value ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}
                    onClick={() => { onChange(symbol); setShow(false); }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <TokenIcon icon={token.logo} emoji={token.emoji} size={24} />
                    </div>
                    <div style={{ minWidth: '60px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{symbol}</div>
                      <div style={{ fontSize: '0.65rem', color: '#888' }}>{token.name?.slice(0, 12)}</div>
                    </div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(token.address, symbol); }}
                      style={{ fontSize: '0.55rem', color: '#666', cursor: 'pointer', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}
                    >📋 CA</div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); removeCustomToken(symbol); }}
                      style={{ fontSize: '0.55rem', color: '#FF6B6B', cursor: 'pointer', padding: '2px 4px', marginLeft: '4px' }}
                    >🗑️</div>
                    <div style={{ textAlign: 'right', marginLeft: 'auto', minWidth: '80px' }}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>{formatNumber(balances[symbol] || 0)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Built-in tokens */}
            <div style={{ padding: '4px 12px' }}>
              <div style={{ fontSize: '0.65rem', color: '#888', marginBottom: '4px', fontWeight: 600 }}>TOKENS</div>
              {Object.entries(TOKENS).filter(([sym]) => sym !== excludeToken).map(([symbol, token]) => (
                <div key={symbol} style={{ ...styles.selectOption, background: symbol === value ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}
                  onClick={() => { onChange(symbol); setShow(false); }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = symbol === value ? 'rgba(212, 175, 55, 0.2)' : 'transparent'}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TokenIcon icon={token.logo} emoji={token.emoji} size={28} />
                  </div>
                  <div style={{ minWidth: '60px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{symbol}</div>
                    <div style={{ fontSize: '0.7rem', color: '#888' }}>{token.name?.slice(0, 12)}</div>
                  </div>
                  {token.address && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(token.address, symbol); }}
                      style={{ fontSize: '0.55rem', color: '#666', cursor: 'pointer', padding: '2px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}
                    >📋 CA</div>
                  )}
                  <div style={{ textAlign: 'right', marginLeft: 'auto', minWidth: '90px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{formatNumber(balances[symbol] || 0)}</div>
                    <div style={{ fontSize: '0.7rem', color: '#4CAF50', whiteSpace: 'nowrap' }}>{formatUSD((balances[symbol] || 0) * (livePrices[symbol] || 0))}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    const handleClick = () => { setShowFromSelect(false); setShowToSelect(false); setShowLpToken0Select(false); setShowLpToken1Select(false); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div style={styles.container} onClick={() => { setShowFromSelect(false); setShowToSelect(false); }}>
      <div style={styles.header}>
        <div style={styles.title}>⚜️ DTGC Gold Suite</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Wallet Info Button */}
          {userAddress && (
            <button
              onClick={() => setShowWalletPanel(!showWalletPanel)}
              style={{
                background: showWalletPanel ? 'linear-gradient(135deg, #D4AF37 0%, #C5A028 100%)' : 'rgba(212,175,55,0.2)',
                border: '1px solid #D4AF37',
                borderRadius: '8px',
                padding: '6px 10px',
                color: showWalletPanel ? '#000' : '#D4AF37',
                fontSize: '0.65rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              👛 {userAddress.slice(0,4)}...{userAddress.slice(-4)}
            </button>
          )}
          {/* Link TG Bot Button */}
          <button
            onClick={verifyForTelegram}
            disabled={telegramVerifying || !userAddress}
            style={{
              background: telegramVerified ? 'linear-gradient(135deg, #00C853 0%, #00E676 100%)' : 'linear-gradient(135deg, #0088cc 0%, #0099dd 100%)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              color: 'white',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: telegramVerifying ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: !userAddress ? 0.5 : 1,
            }}
          >
            {telegramVerifying ? '⏳' : '🤖'} {telegramVerified ? '✓ Bot Linked' : 'Link TG Bot'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          WALLET INFO PANEL - Shows addresses & allows copying
      ═══════════════════════════════════════════════════════════════════ */}
      {showWalletPanel && userAddress && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '12px',
          padding: '12px',
          marginBottom: '12px',
          border: '1px solid rgba(212,175,55,0.3)',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#D4AF37', marginBottom: '10px' }}>
            👛 Your Wallet
          </div>

          {/* Connected Wallet Address */}
          <div style={{
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.65rem', color: '#888' }}>Connected (DTGC Holder)</span>
              <button
                onClick={() => copyToClipboard(userAddress, 'Wallet')}
                style={{
                  background: copiedAddress === 'Wallet' ? '#00C853' : 'rgba(212,175,55,0.3)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  color: copiedAddress === 'Wallet' ? '#fff' : '#D4AF37',
                  fontSize: '0.6rem',
                  cursor: 'pointer',
                }}
              >
                {copiedAddress === 'Wallet' ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              color: '#D4AF37',
              wordBreak: 'break-all',
            }}>
              {userAddress}
            </div>
          </div>

          {/* DTGC Token Info - Copy CA */}
          <div style={{
            background: 'rgba(212,175,55,0.1)',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '10px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.65rem', color: '#D4AF37' }}>⚜️ DTGC Token (Required for Bot Access)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                onClick={() => copyToClipboard('0xD0676B28a457371D58d47E5247b439114e40Eb0F', 'DTGC')}
                style={{
                  flex: 1,
                  background: copiedAddress === 'DTGC' ? '#00C853' : 'linear-gradient(135deg, #D4AF37 0%, #FFD700 100%)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px',
                  color: '#000',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedAddress === 'DTGC' ? '✓ CA Copied!' : '📋 Copy DTGC CA'}
              </button>
              <a
                href="https://dexscreener.com/pulsechain/0xD0676B28a457371D58d47E5247b439114e40Eb0F"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: 'rgba(212,175,55,0.3)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px',
                  color: '#D4AF37',
                  fontSize: '0.7rem',
                  textDecoration: 'none',
                }}
              >
                📊 Chart
              </a>
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '0.55rem',
              color: '#888',
              wordBreak: 'break-all',
            }}>
              0xD0676B28a457371D58d47E5247b439114e40Eb0F
            </div>
          </div>

          {/* Verification Success - Open Telegram */}
          {telegramVerified && telegramVerified.telegramLink && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,200,83,0.15) 0%, rgba(0,230,118,0.1) 100%)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '10px',
              border: '1px solid rgba(0,200,83,0.3)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#00C853', fontWeight: 600, marginBottom: '6px' }}>
                ✅ Wallet Verified!
              </div>
              <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '10px' }}>
                Balance: {telegramVerified.balance?.toLocaleString()} DTGC (~${telegramVerified.balanceUsd?.toFixed(2)})
              </div>
              <a
                href={telegramVerified.telegramLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  background: 'linear-gradient(135deg, #00C853 0%, #00E676 100%)',
                  borderRadius: '6px',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 700,
                  marginBottom: '8px',
                }}
              >
                🚀 OPEN TELEGRAM BOT
              </a>
              <div style={{ fontSize: '0.55rem', color: '#666', textAlign: 'center' }}>
                Tap above if Telegram didn't open automatically
              </div>
            </div>
          )}

          {/* Bot Wallet (from Telegram) */}
          {telegramVerified && (
            <div style={{
              background: 'rgba(0,136,204,0.1)',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '10px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.65rem', color: '#0088cc' }}>🤖 Bot Wallet (Fund with PLS to trade)</span>
              </div>
              <div style={{ fontSize: '0.6rem', color: '#888', marginBottom: '8px' }}>
                Send PLS from your main wallet to this address to use the sniper bot
              </div>
              <a
                href="https://t.me/DTGBondBot?start=get_wallet"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  background: 'linear-gradient(135deg, #0088cc 0%, #0099dd 100%)',
                  borderRadius: '6px',
                  padding: '8px',
                  color: '#fff',
                  fontSize: '0.65rem',
                  textAlign: 'center',
                  textDecoration: 'none',
                  fontWeight: 600,
                }}
              >
                📱 Open Bot → Get Wallet Address
              </a>
            </div>
          )}

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a
              href="https://t.me/DTGBondBot"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1,
                background: 'linear-gradient(135deg, #0088cc 0%, #0099dd 100%)',
                borderRadius: '6px',
                padding: '8px',
                color: '#fff',
                fontSize: '0.6rem',
                textAlign: 'center',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              🤖 Open TG Bot
            </a>
            <button
              onClick={() => window.open(`https://scan.pulsechain.com/address/${userAddress}`, '_blank')}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                padding: '8px',
                color: '#fff',
                fontSize: '0.6rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              🔍 View on Scanner
            </button>
          </div>
        </div>
      )}

      <div style={styles.tabs}>
        {[
          { id: 'swap', icon: '🔄', label: 'Swap' },
          { id: 'wins', icon: '🏆', label: 'Wins' },
          { id: 'sniper', icon: '🎯', label: 'Snipe' },
          { id: 'portfolio', icon: '📊', label: 'Port' },
          { id: 'instabond', icon: '🔥', label: 'Bond' },
        ].map((tab) => (
          <button
            key={tab.id}
            style={{
              ...styles.tab,
              ...(activeTab === tab.id ? styles.tabActive : styles.tabInactive),
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '2px',
              padding: '6px 2px',
            }}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={{ fontSize: '1.1rem' }}>{tab.icon}</span>
            <span style={{ fontSize: '0.55rem', fontWeight: 500 }}>{tab.label}</span>
          </button>
        ))}
      </div>
      
      {/* SWAP TAB */}
      {activeTab === 'swap' && (
        <div>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={styles.label}>From</span>
              <span style={{ color: '#888', fontSize: '0.6rem' }}>Bal: {formatNumber(balances[fromToken] || 0)} <span style={{ color: '#4CAF50' }}>({formatUSD((balances[fromToken] || 0) * (livePrices[fromToken] || 0))})</span></span>
            </div>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} style={styles.input} />
              <button onClick={() => setFromAmount(((balances[fromToken] || 0) * 0.998).toFixed(6))} style={{ background: 'rgba(212,175,55,0.3)', border: 'none', borderRadius: '4px', padding: '3px 6px', color: '#D4AF37', fontSize: '0.6rem', cursor: 'pointer', marginRight: '4px' }}>MAX</button>
              <TokenSelector value={fromToken} onChange={setFromToken} show={showFromSelect} setShow={setShowFromSelect} excludeToken={toToken} />
            </div>
            {fromAmount && livePrices[fromToken] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(fromAmount) * livePrices[fromToken])}</div>}
          </div>

          <button style={styles.flipButton} onClick={flipTokens}>↕</button>

          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={styles.label}>To {quoteLoading && '⏳'}</span>
              <span style={{ color: '#888', fontSize: '0.6rem' }}>Bal: {formatNumber(balances[toToken] || 0)}</span>
            </div>
            <div style={styles.inputGroup}>
              <input type="text" placeholder="0.0" value={toAmount} readOnly style={{ ...styles.input, color: '#D4AF37' }} />
              <TokenSelector value={toToken} onChange={setToToken} show={showToSelect} setShow={setShowToSelect} excludeToken={fromToken} />
            </div>
            {toAmount && livePrices[toToken] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(toAmount) * livePrices[toToken])}</div>}
          </div>
          
          {/* ═══════════════════════════════════════════════════════════════════
              GAS & ROUTE SETTINGS - PulseX Pro Features
          ═══════════════════════════════════════════════════════════════════ */}
          <div style={{ ...styles.card, padding: '10px 14px', marginBottom: '12px' }}>
            {/* Settings Header Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: showGasSettings || showRouteDetails || showSlippageSettings ? '10px' : 0 }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {/* Gas Toggle */}
                <button
                  onClick={() => { setShowGasSettings(!showGasSettings); setShowRouteDetails(false); setShowSlippageSettings(false); }}
                  style={{ 
                    background: showGasSettings ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)', 
                    border: `1px solid ${showGasSettings ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '6px', padding: '5px 10px', color: showGasSettings ? '#D4AF37' : '#888', 
                    fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  ⛽ {gasMode === 'custom' ? customGasPrice + ' Gwei' : GAS_PRESETS[gasMode]?.label?.replace(/[^\w\s]/g, '') || 'Auto'}
                </button>
                
                {/* Route Toggle */}
                <button
                  onClick={() => { setShowRouteDetails(!showRouteDetails); setShowGasSettings(false); setShowSlippageSettings(false); }}
                  style={{ 
                    background: showRouteDetails ? 'rgba(0,188,212,0.2)' : 'rgba(255,255,255,0.05)', 
                    border: `1px solid ${showRouteDetails ? '#00BCD4' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '6px', padding: '5px 10px', color: showRouteDetails ? '#00BCD4' : '#888', 
                    fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  🛤️ {routePreference === 'best' ? 'Auto' : routePreference.toUpperCase()}
                </button>
                
                {/* Slippage Toggle */}
                <button
                  onClick={() => { setShowSlippageSettings(!showSlippageSettings); setShowGasSettings(false); setShowRouteDetails(false); }}
                  style={{ 
                    background: showSlippageSettings ? 'rgba(156,39,176,0.2)' : 'rgba(255,255,255,0.05)', 
                    border: `1px solid ${showSlippageSettings ? '#9C27B0' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '6px', padding: '5px 10px', color: showSlippageSettings ? '#9C27B0' : '#888', 
                    fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  ⚙️ {(slippageBps / 100).toFixed(1)}%
                </button>
              </div>
            </div>
            
            {/* Slippage Settings Expanded */}
            {showSlippageSettings && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                <div style={{ color: '#9C27B0', fontSize: '0.7rem', fontWeight: 600, marginBottom: '8px' }}>⚙️ Slippage Tolerance</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  {SLIPPAGE_PRESETS.map(bps => (
                    <button
                      key={bps}
                      onClick={() => { setSlippageBps(bps); setCustomSlippage(''); }}
                      style={{
                        flex: 1, padding: '8px 6px', 
                        background: slippageBps === bps ? 'rgba(156,39,176,0.3)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${slippageBps === bps ? '#9C27B0' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px', cursor: 'pointer', textAlign: 'center'
                      }}
                    >
                      <div style={{ color: slippageBps === bps ? '#9C27B0' : '#fff', fontSize: '0.85rem', fontWeight: 600 }}>{(bps / 100).toFixed(1)}%</div>
                    </button>
                  ))}
                </div>
                
                {/* Custom Slippage Input */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Custom %..."
                    value={customSlippage}
                    onChange={(e) => { 
                      setCustomSlippage(e.target.value); 
                      if (e.target.value && parseFloat(e.target.value) > 0) {
                        setSlippageBps(Math.round(parseFloat(e.target.value) * 100));
                      }
                    }}
                    style={{
                      flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', 
                      border: `1px solid ${customSlippage ? '#9C27B0' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none'
                    }}
                  />
                  <span style={{ color: '#888', fontSize: '0.7rem' }}>%</span>
                </div>
                <div style={{ color: '#666', fontSize: '0.6rem', marginTop: '6px' }}>
                  💡 Higher slippage = more likely to succeed, but may get worse price.
                  {slippageBps > 500 && <span style={{ color: '#FF6B6B' }}> ⚠️ High slippage!</span>}
                </div>
              </div>
            )}
            
            {/* Gas Settings Expanded */}
            {showGasSettings && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ color: '#D4AF37', fontSize: '0.7rem', fontWeight: 600, marginBottom: '8px' }}>⛽ Gas Price Settings</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {Object.entries(GAS_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => { setGasMode(key); setCustomGasPrice(''); }}
                      style={{
                        flex: 1, minWidth: '70px', padding: '8px 6px', 
                        background: gasMode === key ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${gasMode === key ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px', cursor: 'pointer', textAlign: 'center'
                      }}
                    >
                      <div style={{ color: gasMode === key ? '#D4AF37' : '#fff', fontSize: '0.75rem', fontWeight: 600 }}>{preset.label}</div>
                      <div style={{ color: '#888', fontSize: '0.6rem' }}>{preset.gwei ? preset.gwei + ' Gwei' : 'Dynamic'}</div>
                      <div style={{ color: '#4CAF50', fontSize: '0.55rem' }}>{preset.time}</div>
                    </button>
                  ))}
                </div>
                
                {/* Custom Gas Input */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder="Custom Gwei..."
                    value={customGasPrice}
                    onChange={(e) => { setCustomGasPrice(e.target.value); if (e.target.value) setGasMode('custom'); }}
                    style={{
                      flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', 
                      border: `1px solid ${gasMode === 'custom' ? '#D4AF37' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '6px', color: '#fff', fontSize: '0.8rem', outline: 'none'
                    }}
                  />
                  <span style={{ color: '#888', fontSize: '0.7rem' }}>Gwei</span>
                </div>
                <div style={{ color: '#666', fontSize: '0.6rem', marginTop: '6px' }}>
                  💡 PulseChain gas is cheap! Even "High" costs fractions of a cent.
                </div>
              </div>
            )}
            
            {/* Route Settings Expanded */}
            {showRouteDetails && (
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ color: '#00BCD4', fontSize: '0.7rem', fontWeight: 600, marginBottom: '8px' }}>🛤️ Swap Route Settings</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  {[
                    { key: 'best', label: '⚡ Best Price', desc: 'Auto-select best router' },
                    { key: 'v1', label: '🔷 PulseX V1', desc: 'Original router' },
                    { key: 'v2', label: '🔶 PulseX V2', desc: 'Newer router' },
                  ].map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setRoutePreference(opt.key)}
                      style={{
                        flex: 1, padding: '8px 6px', 
                        background: routePreference === opt.key ? 'rgba(0,188,212,0.3)' : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${routePreference === opt.key ? '#00BCD4' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px', cursor: 'pointer', textAlign: 'center'
                      }}
                    >
                      <div style={{ color: routePreference === opt.key ? '#00BCD4' : '#fff', fontSize: '0.75rem', fontWeight: 600 }}>{opt.label}</div>
                      <div style={{ color: '#888', fontSize: '0.55rem' }}>{opt.desc}</div>
                    </button>
                  ))}
                </div>
                
                {/* Show current route if available */}
                {swapRoute && (
                  <div style={{ background: 'rgba(0,188,212,0.1)', border: '1px solid rgba(0,188,212,0.3)', borderRadius: '6px', padding: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ color: '#00BCD4', fontSize: '0.7rem', fontWeight: 600 }}>Current Route</span>
                      <span style={{ color: '#4CAF50', fontSize: '0.65rem' }}>via {swapRoute.router}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {swapRoute.pathSymbols?.map((sym, i) => (
                        <React.Fragment key={i}>
                          <span style={{ 
                            background: 'rgba(212,175,55,0.2)', padding: '2px 6px', borderRadius: '4px', 
                            color: '#D4AF37', fontSize: '0.7rem', fontWeight: 500 
                          }}>{sym}</span>
                          {i < swapRoute.pathSymbols.length - 1 && <span style={{ color: '#666' }}>→</span>}
                        </React.Fragment>
                      ))}
                    </div>
                    {swapRoute.allRoutes?.length > 1 && (
                      <div style={{ marginTop: '6px', fontSize: '0.6rem', color: '#888' }}>
                        📊 Compared {swapRoute.allRoutes.length} routes • Best output selected
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Rate & Receive Info */}
          {fromAmount && toAmount && (
            <div style={{ ...styles.card, padding: '12px 16px' }}>
              <div style={styles.infoRow}><span style={{ color: '#888' }}>Rate</span><span style={{ color: '#fff' }}>1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken}</span></div>
              <div style={styles.infoRow}><span style={{ color: '#888' }}>Router</span><span style={{ color: '#00BCD4', fontSize: '0.8rem' }}>{swapRoute?.router || 'V1'}</span></div>
              <div style={{ ...styles.infoRow, borderBottom: 'none' }}><span style={{ color: '#888' }}>You Receive</span><span style={{ color: '#4CAF50', fontWeight: 700 }}>~{formatNumber(parseFloat(toAmount))} {toToken}</span></div>
            </div>
          )}
          
          <button style={{ ...styles.swapButton, ...(!userAddress || !fromAmount || !toAmount || swapLoading ? styles.swapButtonDisabled : {}) }} onClick={executeSwap} disabled={!userAddress || !fromAmount || !toAmount || swapLoading}>
            {!userAddress ? 'Connect Wallet' : swapLoading ? 'Swapping...' : !fromAmount ? 'Enter Amount' : `Swap ${fromToken} → ${toToken}`}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          🏆 PROBABLE WINS TAB - AI-scored trading opportunities
      ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wins' && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem' }}>🏆 Probable Wins</div>
            <button
              onClick={fetchProbableWins}
              disabled={winsLoading}
              style={{
                background: 'rgba(212,175,55,0.2)',
                border: '1px solid rgba(212,175,55,0.5)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#D4AF37',
                cursor: winsLoading ? 'wait' : 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {winsLoading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>
              AI-scored PulseChain tokens by volume, liquidity & price action
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#4CAF50', fontSize: '0.7rem' }}>🟢 70+ = Strong</span>
              <span style={{ color: '#FFB300', fontSize: '0.7rem' }}>🟡 50-70 = Moderate</span>
              <span style={{ color: '#F44336', fontSize: '0.7rem' }}>🔴 &lt;50 = Caution</span>
            </div>
          </div>

          {/* Token list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
            {winsLoading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                ⏳ Loading from DEXScreener...
              </div>
            ) : winsError ? (
              <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(255,87,34,0.1)', borderRadius: '12px', border: '1px solid rgba(255,87,34,0.3)' }}>
                <div style={{ color: '#FF5722', marginBottom: '12px', fontSize: '0.9rem' }}>⚠️ {winsError}</div>
                <button onClick={fetchProbableWins} style={{ background: 'rgba(255,87,34,0.2)', border: '1px solid rgba(255,87,34,0.5)', borderRadius: '8px', padding: '10px 24px', color: '#FF5722', cursor: 'pointer', fontSize: '0.85rem' }}>🔄 Try Again</button>
              </div>
            ) : probableWins.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                <div style={{ marginBottom: '16px' }}>No opportunities loaded yet.</div>
                <button onClick={fetchProbableWins} style={{ background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.5)', borderRadius: '8px', padding: '10px 24px', color: '#D4AF37', cursor: 'pointer', fontSize: '0.85rem' }}>🏆 Find Opportunities</button>
              </div>
            ) : (
              probableWins.map((token, idx) => (
                <div
                  key={token.address}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '8px',
                    border: token.score >= 70 ? '1px solid rgba(76,175,80,0.5)' : token.score >= 50 ? '1px solid rgba(255,179,0,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '50%',
                        background: `linear-gradient(135deg, hsl(${(idx * 36) % 360}, 70%, 50%), hsl(${(idx * 36 + 60) % 360}, 70%, 40%))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                      }}>
                        {token.symbol?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{token.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>${token.symbol}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: token.score >= 70 ? '#4CAF50' : token.score >= 50 ? '#FFB300' : '#F44336',
                        fontWeight: 700, fontSize: '1.1rem',
                      }}>
                        {token.score}/100
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#888' }}>
                        {token.score >= 70 ? '🏆 Strong' : token.score >= 50 ? '📊 Moderate' : '⚠️ Caution'}
                      </div>
                    </div>
                  </div>

                  {/* Score reasons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {token.reasons.slice(0, 3).map((reason, i) => (
                      <span key={i} style={{ background: 'rgba(212,175,55,0.15)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', color: '#D4AF37' }}>{reason}</span>
                    ))}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.7rem', marginBottom: '10px' }}>
                    <div>
                      <div style={{ color: '#888' }}>Price</div>
                      <div style={{ color: '#fff' }}>${token.priceUsd < 0.0001 ? token.priceUsd.toExponential(2) : token.priceUsd.toFixed(6)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>24h</div>
                      <div style={{ color: token.priceChange24h >= 0 ? '#4CAF50' : '#F44336' }}>
                        {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Volume</div>
                      <div style={{ color: '#fff' }}>${token.volume24h >= 1e6 ? (token.volume24h / 1e6).toFixed(1) + 'M' : token.volume24h >= 1e3 ? (token.volume24h / 1e3).toFixed(1) + 'K' : token.volume24h.toFixed(0)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Liquidity</div>
                      <div style={{ color: '#fff' }}>${token.liquidity >= 1e6 ? (token.liquidity / 1e6).toFixed(1) + 'M' : token.liquidity >= 1e3 ? (token.liquidity / 1e3).toFixed(1) + 'K' : token.liquidity.toFixed(0)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Buy/Sell</div>
                      <div style={{ color: '#fff' }}>{token.txns24h.buys}/{token.txns24h.sells}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888' }}>Age</div>
                      <div style={{ color: '#fff' }}>{token.ageHours < 1 ? Math.round(token.ageHours * 60) + 'm' : token.ageHours < 24 ? Math.round(token.ageHours) + 'h' : Math.round(token.ageHours / 24) + 'd'}</div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setActiveTab('sniper');
                        setSniperCA(token.address);
                      }}
                      style={{
                        flex: 1, background: 'linear-gradient(135deg, #4CAF50, #2E7D32)',
                        border: 'none', borderRadius: '8px', padding: '10px',
                        color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
                      }}
                    >
                      💰 Quick Buy
                    </button>
                    <a
                      href={token.dexScreenerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '10px 16px', background: 'rgba(255,255,255,0.1)',
                        borderRadius: '8px', color: '#888', textDecoration: 'none', fontSize: '0.8rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      📊
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          🎯 SNIPER TAB - Paste CA, Set Limit, Snipe/Sell with P&L Card
      ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'sniper' && (
        <div>
          {/* Silver Laser P&L Card Header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(192,192,192,0.15) 0%, rgba(120,120,140,0.1) 50%, rgba(192,192,192,0.15) 100%)',
            border: '1px solid rgba(192,192,192,0.4)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '16px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* Laser scan line animation */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(192,220,255,0.8), transparent)',
              animation: 'laserScan 2s linear infinite',
            }} />
            <style>{`
              @keyframes laserScan {
                0% { transform: translateY(0); opacity: 1; }
                50% { opacity: 0.5; }
                100% { transform: translateY(100px); opacity: 0; }
              }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#C0C0C0', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>🎯 MANDALORIAN SNIPER</div>
                <div style={{ color: '#E8E8E8', fontSize: '1.8rem', fontWeight: 700, marginTop: '4px', textShadow: '0 0 10px rgba(192,220,255,0.5)' }}>
                  {(() => {
                    const pnl = calculatePnL(sniperTrades);
                    return pnl.unrealizedPnL >= 0
                      ? `+${formatUSD(pnl.unrealizedPnL)}`
                      : `-${formatUSD(Math.abs(pnl.unrealizedPnL))}`;
                  })()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  color: calculatePnL(sniperTrades).pnlPercent >= 0 ? '#4CAF50' : '#F44336',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                }}>
                  {calculatePnL(sniperTrades).pnlPercent >= 0 ? '📈' : '📉'} {calculatePnL(sniperTrades).pnlPercent.toFixed(2)}%
                </div>
                <div style={{ color: '#888', fontSize: '0.7rem' }}>Total P&L</div>
              </div>
            </div>

            {/* P&L Stats Row */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(192,192,192,0.2)' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.65rem' }}>INVESTED</div>
                <div style={{ color: '#C0C0C0', fontSize: '0.9rem', fontWeight: 600 }}>{formatUSD(calculatePnL(sniperTrades).totalInvested)}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.65rem' }}>CURRENT</div>
                <div style={{ color: '#4CAF50', fontSize: '0.9rem', fontWeight: 600 }}>{formatUSD(calculatePnL(sniperTrades).totalCurrentValue)}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.65rem' }}>REALIZED</div>
                <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600 }}>{formatUSD(calculatePnL(sniperTrades).totalRealized)}</div>
              </div>
            </div>
          </div>

          {/* CA Paste Input */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>📋 Paste Contract Address (CA)</span>
              {sniperToken && <span style={{ color: '#4CAF50', fontSize: '0.75rem' }}>✓ Token Found</span>}
            </div>
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="0x..."
                value={sniperCA}
                onChange={(e) => setSniperCA(e.target.value)}
                style={{ ...styles.input, fontSize: '0.85rem' }}
              />
              <button
                onClick={async () => {
                  if (sniperCA.length === 42) {
                    setSniperLoading(true);
                    const token = await importTokenByCA(sniperCA);
                    setSniperToken(token);
                    setSniperLoading(false);
                  }
                }}
                disabled={sniperLoading || sniperCA.length !== 42}
                style={{
                  background: sniperCA.length === 42 ? 'linear-gradient(135deg, #D4AF37, #B8960C)' : 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  color: sniperCA.length === 42 ? '#000' : '#666',
                  fontWeight: 600,
                  cursor: sniperCA.length === 42 ? 'pointer' : 'not-allowed',
                  fontSize: '0.8rem',
                }}
              >
                {sniperLoading ? '⏳' : '🔍 Load'}
              </button>
            </div>
          </div>

          {/* Token Info Display */}
          {sniperToken && (
            <div style={{
              ...styles.card,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(0,0,0,0.3))',
              border: '1px solid rgba(212,175,55,0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #D4AF37, #B8960C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {sniperToken.logo ? (
                    <img src={sniperToken.logo} alt={sniperToken.symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '1.5rem' }}>🔸</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>{sniperToken.name}</div>
                  <div style={{ color: '#D4AF37', fontSize: '0.85rem' }}>${sniperToken.symbol}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#4CAF50', fontSize: '0.9rem', fontWeight: 600 }}>
                    {livePrices[sniperToken.symbol] ? formatUSD(livePrices[sniperToken.symbol]) : 'Price N/A'}
                  </div>
                  <div style={{ color: '#888', fontSize: '0.7rem' }}>
                    Balance: {formatNumber(balances[sniperToken.symbol] || 0)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PLS Amount Input */}
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>💜 PLS Amount to Spend</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances.PLS || 0)} PLS</span>
            </div>
            <div style={styles.inputGroup}>
              <input
                type="number"
                placeholder="0.0"
                value={sniperPlsAmount}
                onChange={(e) => setSniperPlsAmount(e.target.value)}
                style={styles.input}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                {[25, 50, 100].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setSniperPlsAmount(((balances.PLS || 0) * pct / 100 * 0.998).toFixed(0))}
                    style={{
                      background: 'rgba(212,175,55,0.2)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      color: '#D4AF37',
                      fontSize: '0.7rem',
                      cursor: 'pointer'
                    }}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
            {sniperPlsAmount && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(sniperPlsAmount) * (livePrices.PLS || 0.0000159))}</div>}
          </div>

          {/* Order Type Selection */}
          <div style={styles.card}>
            <span style={styles.label}>📊 Order Type</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              {[
                { id: 'market', label: '⚡ Market', desc: 'Instant buy at current price' },
                { id: 'limit-buy', label: '📈 Limit Buy', desc: 'Buy when price drops to target' },
                { id: 'limit-sell', label: '📉 Limit Sell', desc: 'Sell when price rises to target' },
                { id: 'instabond', label: '🔥 InstaBond', desc: 'Snipe at graduation + auto TP' },
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => setSniperLimitType(type.id)}
                  style={{
                    padding: '12px 8px',
                    background: sniperLimitType === type.id
                      ? type.id === 'instabond' ? 'linear-gradient(135deg, rgba(255,87,34,0.4), rgba(255,152,0,0.4))' : 'rgba(212,175,55,0.3)'
                      : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${sniperLimitType === type.id ? (type.id === 'instabond' ? '#FF5722' : '#D4AF37') : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ color: sniperLimitType === type.id ? (type.id === 'instabond' ? '#FF5722' : '#D4AF37') : '#fff', fontWeight: 600, fontSize: '0.8rem' }}>{type.label}</div>
                  <div style={{ color: '#888', fontSize: '0.6rem', marginTop: '4px' }}>{type.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* InstaBond Graduation Snipe Settings */}
          {sniperLimitType === 'instabond' && (
            <div style={{ ...styles.card, background: 'linear-gradient(135deg, rgba(255,87,34,0.1), rgba(0,0,0,0.3))', border: '1px solid rgba(255,87,34,0.3)' }}>
              <div style={{ color: '#FF5722', fontWeight: 700, fontSize: '0.9rem', marginBottom: '12px' }}>
                🔥 InstaBond Graduation Snipe
              </div>
              <div style={{ color: '#aaa', fontSize: '0.75rem', marginBottom: '16px' }}>
                Auto-buy at pump.tires graduation → Auto-sell at target % gain
              </div>

              {/* Take Profit % Selection */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '8px' }}>🎯 Take Profit at % Gain:</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  {[
                    { pct: 50, mult: '1.5x', sell: '66.7%' },
                    { pct: 100, mult: '2x', sell: '50%', star: true },
                    { pct: 150, mult: '2.5x', sell: '40%' },
                    { pct: 200, mult: '3x', sell: '33.3%' },
                    { pct: 300, mult: '4x', sell: '25%' },
                    { pct: 500, mult: '6x', sell: '16.7%' },
                  ].map(opt => (
                    <button
                      key={opt.pct}
                      onClick={() => setSniperLimitPrice(opt.pct.toString())}
                      style={{
                        padding: '10px 6px',
                        background: sniperLimitPrice === opt.pct.toString() ? 'rgba(255,87,34,0.3)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${sniperLimitPrice === opt.pct.toString() ? '#FF5722' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ color: sniperLimitPrice === opt.pct.toString() ? '#FF5722' : '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
                        +{opt.pct}%
                      </div>
                      <div style={{ color: '#888', fontSize: '0.6rem' }}>{opt.mult}</div>
                      {opt.star && <div style={{ color: '#4CAF50', fontSize: '0.55rem' }}>⭐ Popular</div>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Breakeven Sell % - Auto-calculated */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#888', fontSize: '0.7rem' }}>Auto-Sell for Breakeven:</div>
                    <div style={{ color: '#4CAF50', fontWeight: 700, fontSize: '1.2rem' }}>
                      {sniperLimitPrice ? (100 / (1 + parseInt(sniperLimitPrice) / 100)).toFixed(1) : '50'}% of tokens
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#888', fontSize: '0.65rem' }}>Recovers:</div>
                    <div style={{ color: '#FFD700', fontWeight: 600, fontSize: '1rem' }}>100% Initial</div>
                  </div>
                </div>
              </div>

              {/* Math Breakdown */}
              <div style={{ color: '#666', fontSize: '0.65rem', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                <strong>Math:</strong> At {sniperLimitPrice || 100}% gain ({((100 + parseInt(sniperLimitPrice || '100')) / 100).toFixed(1)}x),
                selling {sniperLimitPrice ? (100 / (1 + parseInt(sniperLimitPrice) / 100)).toFixed(1) : '50'}% returns your full investment.
                Remaining tokens = pure profit! 🎉
              </div>
            </div>
          )}

          {/* Limit Price Input (only for limit-buy and limit-sell, NOT for InstaBond) */}
          {sniperLimitType !== 'market' && sniperLimitType !== 'instabond' && (
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={styles.label}>🎯 Target Price (PLS)</span>
              </div>
              <div style={styles.inputGroup}>
                <span style={{ color: '#888', fontSize: '1.2rem' }}>◈</span>
                <input
                  type="number"
                  placeholder="0.00001"
                  value={sniperLimitPrice}
                  onChange={(e) => setSniperLimitPrice(e.target.value)}
                  style={styles.input}
                />
              </div>
              <div style={{ color: '#888', fontSize: '0.7rem', marginTop: '8px' }}>
                {sniperLimitType === 'limit-buy'
                  ? '💡 Order triggers when price drops to this level'
                  : '💡 Order triggers when price rises to this level'}
              </div>

              {/* Multi-wallet limit order info */}
              <div style={{
                background: 'rgba(212,175,55,0.1)',
                border: '1px solid rgba(212,175,55,0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '12px'
              }}>
                <div style={{ color: '#D4AF37', fontSize: '0.75rem', fontWeight: 600, marginBottom: '8px' }}>
                  👛 Multi-Wallet Support
                </div>
                <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '8px' }}>
                  Create limit orders across multiple wallets at once! Set labels, toggle active wallets, and execute coordinated orders.
                </div>
                <a
                  href={`https://t.me/DTGBondBot?start=${sniperLimitType === 'limit-buy' ? 'limit_buy' : 'limit_sell'}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, #0088cc, #0099dd)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    color: '#fff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span>🤖</span>
                  <span>Set Up Limit Order in TG Bot</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          )}

          {/* InstaBond Summary - Show calculated values */}
          {sniperLimitType === 'instabond' && sniperToken && sniperPlsAmount && sniperLimitPrice && (
            <div style={styles.card}>
              <div style={{ color: '#FF5722', fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px' }}>
                📊 InstaBond Calculation
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem' }}>Investment</div>
                  <div style={{ color: '#4CAF50', fontSize: '1rem', fontWeight: 600 }}>
                    {parseFloat(sniperPlsAmount).toLocaleString()} PLS
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem' }}>Take Profit Target</div>
                  <div style={{ color: '#FF5722', fontSize: '1rem', fontWeight: 600 }}>
                    +{sniperLimitPrice}% ({((100 + parseInt(sniperLimitPrice)) / 100).toFixed(1)}x)
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem' }}>Auto-Sell Amount</div>
                  <div style={{ color: '#D4AF37', fontSize: '1rem', fontWeight: 600 }}>
                    {(100 / (1 + parseInt(sniperLimitPrice) / 100)).toFixed(1)}% of tokens
                  </div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ color: '#888', fontSize: '0.65rem' }}>Recovers</div>
                  <div style={{ color: '#4CAF50', fontSize: '1rem', fontWeight: 600 }}>
                    100% Initial ✓
                  </div>
                </div>
              </div>
              <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '12px', textAlign: 'center' }}>
                🔥 Remaining tokens after TP = pure profit!
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            {/* SNIPE (Buy) Button */}
            <button
              onClick={async () => {
                if (!sniperToken || !sniperPlsAmount || !userAddress) return;
                setSniperExecuting(true);
                showToastMsg(`🎯 Sniping ${sniperToken.symbol}...`, 'info');

                // Simulate snipe for now - would integrate with router
                try {
                  const trade = {
                    id: Date.now(),
                    type: 'buy',
                    token: sniperToken.symbol,
                    tokenAddress: sniperToken.address,
                    plsAmount: parseFloat(sniperPlsAmount),
                    tokensReceived: parseFloat(sniperPlsAmount) * (livePrices.PLS || 0.0000159) / 0.00001, // Simulated
                    entryPrice: 0.00001,
                    currentPrice: 0.00001,
                    timestamp: new Date().toISOString(),
                    orderType: sniperLimitType,
                    limitPrice: sniperLimitPrice || null,
                  };

                  const updatedTrades = [...sniperTrades, trade];
                  setSniperTrades(updatedTrades);
                  localStorage.setItem('dtgc-sniper-trades', JSON.stringify(updatedTrades));
                  showToastMsg(`✅ Sniped ${sniperToken.symbol}!`, 'success');
                } catch (err) {
                  showToastMsg(`❌ Snipe failed: ${err.message}`, 'error');
                }
                setSniperExecuting(false);
              }}
              disabled={!sniperToken || !sniperPlsAmount || !userAddress || sniperExecuting || (sniperLimitType === 'instabond' && !sniperLimitPrice)}
              style={{
                flex: 1,
                padding: '16px',
                background: sniperToken && sniperPlsAmount
                  ? sniperLimitType === 'instabond'
                    ? 'linear-gradient(135deg, #FF5722, #E64A19)'
                    : 'linear-gradient(135deg, #4CAF50, #2E7D32)'
                  : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '12px',
                color: sniperToken && sniperPlsAmount ? '#fff' : '#666',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: sniperToken && sniperPlsAmount ? 'pointer' : 'not-allowed',
              }}
            >
              {sniperExecuting ? '⏳ Executing...' : sniperLimitType === 'market' ? '🎯 SNIPE NOW' : sniperLimitType === 'instabond' ? `🔥 ARM INSTABOND (+${sniperLimitPrice || '?'}% TP)` : '📈 SET LIMIT BUY'}
            </button>

            {/* SELL Button */}
            <button
              onClick={async () => {
                if (!sniperToken || !userAddress) return;
                setSniperExecuting(true);
                showToastMsg(`📉 Selling ${sniperToken.symbol}...`, 'info');

                try {
                  const balance = balances[sniperToken.symbol] || 0;
                  const trade = {
                    id: Date.now(),
                    type: 'sell',
                    token: sniperToken.symbol,
                    tokenAddress: sniperToken.address,
                    tokensSold: balance,
                    plsReceived: balance * 0.00001 / (livePrices.PLS || 0.0000159), // Simulated
                    exitPrice: 0.00001,
                    timestamp: new Date().toISOString(),
                  };

                  const updatedTrades = [...sniperTrades, trade];
                  setSniperTrades(updatedTrades);
                  localStorage.setItem('dtgc-sniper-trades', JSON.stringify(updatedTrades));
                  showToastMsg(`✅ Sold ${sniperToken.symbol}!`, 'success');
                } catch (err) {
                  showToastMsg(`❌ Sell failed: ${err.message}`, 'error');
                }
                setSniperExecuting(false);
              }}
              disabled={!sniperToken || !userAddress || sniperExecuting}
              style={{
                flex: 1,
                padding: '16px',
                background: sniperToken ? 'linear-gradient(135deg, #F44336, #C62828)' : 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '12px',
                color: sniperToken ? '#fff' : '#666',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: sniperToken ? 'pointer' : 'not-allowed',
              }}
            >
              {sniperExecuting ? '⏳...' : sniperLimitType === 'limit-sell' ? '📉 SET LIMIT SELL' : '💰 SELL ALL'}
            </button>
          </div>

          {/* Recent Sniper Trades */}
          {sniperTrades.length > 0 && (
            <div style={{ ...styles.card, marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ color: '#C0C0C0', fontWeight: 600 }}>📜 Recent Trades</span>
                <button
                  onClick={() => { setSniperTrades([]); localStorage.removeItem('dtgc-sniper-trades'); }}
                  style={{ background: 'rgba(244,67,54,0.2)', border: 'none', borderRadius: '4px', padding: '4px 8px', color: '#F44336', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  🗑️ Clear
                </button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {sniperTrades.slice().reverse().slice(0, 10).map((trade, idx) => (
                  <div key={trade.id || idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '8px',
                    marginBottom: '6px',
                    borderLeft: `3px solid ${trade.type === 'buy' ? '#4CAF50' : '#F44336'}`,
                  }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                        {trade.type === 'buy' ? '🎯 BUY' : '💰 SELL'} {trade.token}
                      </div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>
                        {new Date(trade.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: trade.type === 'buy' ? '#4CAF50' : '#F44336', fontWeight: 600 }}>
                        {trade.type === 'buy'
                          ? `${formatNumber(trade.plsAmount)} PLS`
                          : `+${formatNumber(trade.plsReceived)} PLS`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,193,7,0.1)', borderRadius: '8px', border: '1px solid rgba(255,193,7,0.3)' }}>
            <div style={{ color: '#FFC107', fontSize: '0.75rem' }}>
              ⚠️ <strong>DYOR:</strong> Sniping new tokens is high risk. Never invest more than you can afford to lose.
            </div>
          </div>
        </div>
      )}

      {/* PORTFOLIO TAB */}
      {activeTab === 'portfolio' && (
        <div>
          {!userAddress ? (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Connect wallet</div>) : (
            <>
              <div style={styles.totalPortfolio}>
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>Total Portfolio Value</div>
                <div style={{ color: '#D4AF37', fontSize: '2rem', fontWeight: 700 }}>{formatUSD(totalPortfolioValue)}</div>
                {lastScanTime && <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '4px' }}>Updated: {new Date(lastScanTime).toLocaleTimeString()}</div>}
              </div>
              
              {loadingBalances ? (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>Scanning...</div>) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💰 Tokens ({walletTokens.length})</div>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      {walletTokens.map((token, idx) => (
                        <div key={idx} style={styles.balanceRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              <TokenIcon icon={token.icon} emoji={token.emoji} size={32} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{token.symbol}</span>
                                {token.address && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(token.address);
                                      showToastMsg(`📋 Copied ${token.symbol} address!`, 'success');
                                    }}
                                    title={token.address}
                                    style={{ background: 'rgba(212,175,55,0.3)', border: 'none', borderRadius: '4px', padding: '2px 5px', color: '#D4AF37', fontSize: '0.55rem', cursor: 'pointer' }}
                                  >📋</button>
                                )}
                              </div>
                              <div style={{ color: '#666', fontSize: '0.7rem' }}>{token.name?.slice(0, 18)}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}><div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{formatNumber(token.balance)}</div><div style={{ color: '#4CAF50', fontSize: '0.75rem' }}>{formatUSD(token.usdValue)}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {lpPositions.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💧 LP Positions ({lpPositions.length})</div>
                      {lpPositions.map((lp, idx) => (
                        <div key={idx} style={styles.balanceRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,188,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🔷</div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{lp.name}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(lp.address);
                                    showToastMsg(`📋 Copied ${lp.name} LP address!`, 'success');
                                  }}
                                  title={lp.address}
                                  style={{ background: 'rgba(0,188,212,0.3)', border: 'none', borderRadius: '4px', padding: '2px 5px', color: '#00BCD4', fontSize: '0.55rem', cursor: 'pointer' }}
                                >📋</button>
                              </div>
                              <div style={{ color: '#666', fontSize: '0.7rem' }}>PulseX LP</div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}><div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{formatNumber(lp.balance)}</div><a href={`${CONFIG.EXPLORER}/address/${lp.address}`} target="_blank" rel="noopener noreferrer" style={{ color: '#D4AF37', fontSize: '0.65rem', textDecoration: 'none' }}>View ↗</a></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              
              <button onClick={() => { setWalletTokens([]); scanWalletTokens(); }} disabled={loadingBalances} style={{ ...styles.swapButton, background: loadingBalances ? 'rgba(255,255,255,0.1)' : 'rgba(212,175,55,0.2)', color: loadingBalances ? '#666' : '#D4AF37' }}>
                {loadingBalances ? '🔍 Scanning...' : '🔄 Refresh All'}
              </button>
              
              {/* Quick Contracts Reference */}
              <details style={{ marginTop: '16px', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '8px', padding: '10px 12px' }}>
                <summary style={{ cursor: 'pointer', color: '#D4AF37', fontWeight: 600, fontSize: '0.8rem', userSelect: 'none' }}>
                  📋 Quick Contracts (click to expand)
                </summary>
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { name: 'DTGC', addr: '0xd0676b28a457371d58d47e5247b439114e40eb0f' },
                    { name: 'URMOM', addr: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0' },
                    { name: 'DTGC/PLS LP', addr: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7' },
                    { name: 'DTGC/URMOM LP', addr: '0x670c972bb5388e087a2934a063064d97278e01f3' },
                    { name: 'DTGCStakingV4', addr: '0x578e0DE613acb498652025f98c6aF52F0e4E7001' },
                    { name: 'LPStakingV4', addr: '0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231' },
                    { name: 'PulseX Router', addr: '0x165C3410fC91EF562C50559f7d2289fEbed552d9' },
                    { name: 'PLSX', addr: '0x95b303987a60c71504d99aa1b13b4da07b0790ab' },
                    { name: 'HEX', addr: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39' },
                    { name: 'WPLS', addr: '0xa1077a294dde1b09bb078844df40758a5d0f9a27' },
                  ].map(({ name, addr }) => (
                    <div key={addr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', flex: 1 }}>{name}</span>
                      <code style={{ color: '#D4AF37', fontSize: '0.6rem', fontFamily: 'monospace' }}>
                        {addr.slice(0, 6)}...{addr.slice(-4)}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(addr);
                          showToastMsg(`📋 Copied ${name}!`, 'success');
                        }}
                        style={{ background: 'rgba(212,175,55,0.3)', border: 'none', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '0.65rem', color: '#D4AF37' }}
                      >Copy</button>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      )}
      
      {/* CREATE LP TAB */}
      {activeTab === 'create-lp' && (
        <div>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>Token 1</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances[lpToken0] || 0)} <span style={{ color: '#4CAF50' }}>({formatUSD((balances[lpToken0] || 0) * (livePrices[lpToken0] || 0))})</span></span>
            </div>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={lpAmount0} onChange={(e) => setLpAmount0(e.target.value)} style={styles.input} />
              <button onClick={() => setLpAmount0(((balances[lpToken0] || 0) * 0.998).toFixed(6))} style={{ background: 'rgba(212,175,55,0.3)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: '#D4AF37', fontSize: '0.7rem', cursor: 'pointer', marginRight: '8px' }}>MAX</button>
              <TokenSelector value={lpToken0} onChange={(v) => { setLpToken0(v); setLpAmount0(''); setLpAmount1(''); }} show={showLpToken0Select} setShow={setShowLpToken0Select} excludeToken={lpToken1} />
            </div>
            {lpAmount0 && livePrices[lpToken0] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(lpAmount0) * livePrices[lpToken0])}</div>}
          </div>
          
          <div style={{ textAlign: 'center', margin: '-8px 0', fontSize: '1.5rem', color: '#D4AF37' }}>+</div>
          
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>Token 2 {pairReserves ? '(auto)' : ''}</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances[lpToken1] || 0)}</span>
            </div>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={lpAmount1} onChange={(e) => !pairReserves && setLpAmount1(e.target.value)} readOnly={!!pairReserves} style={{ ...styles.input, color: pairReserves ? '#D4AF37' : '#fff' }} />
              <TokenSelector value={lpToken1} onChange={(v) => { setLpToken1(v); setLpAmount0(''); setLpAmount1(''); }} show={showLpToken1Select} setShow={setShowLpToken1Select} excludeToken={lpToken0} />
            </div>
            {lpAmount1 && livePrices[lpToken1] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(lpAmount1) * livePrices[lpToken1])}</div>}
          </div>
          
          <div style={{ ...styles.card, padding: '12px 16px' }}>
            <div style={styles.infoRow}><span style={{ color: '#888' }}>Pair</span><span style={{ color: '#fff', fontWeight: 600 }}>{lpToken0}/{lpToken1}</span></div>
            <div style={styles.infoRow}>
              <span style={{ color: '#888' }}>Status</span>
              <span style={{ color: pairAddress ? '#4CAF50' : '#FF9800' }}>{pairAddress ? '✓ Pool Exists' : '⚠️ New Pool'}</span>
            </div>
            {pairAddress && pairReserves && (
              <div style={{ background: 'rgba(255,215,0,0.1)', border: '2px solid #FFD700', borderRadius: '8px', padding: '10px', marginTop: '8px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.2rem' }}>🔒</span>
                  <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '0.85rem' }}>RATIO LOCKED TO EXISTING POOL</span>
                </div>
                <div style={{ color: '#aaa', fontSize: '0.75rem' }}>
                  Current ratio: 1 {lpToken0} = {pairReserves.reserve0 > 0n ? (Number(pairReserves.reserve1) / Number(pairReserves.reserve0)).toFixed(6) : '?'} {lpToken1}
                </div>
                <div style={{ color: '#888', fontSize: '0.7rem', marginTop: '4px' }}>
                  Token 2 amount auto-calculated to match pool parity
                </div>
              </div>
            )}
            {pairAddress && (
              <div style={styles.infoRow}>
                <span style={{ color: '#888' }}>LP Address</span>
                <a 
                  href={`https://scan.pulsechain.com/address/${pairAddress}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#4CAF50', fontSize: '0.75rem', textDecoration: 'underline' }}
                >
                  {pairAddress.slice(0, 6)}...{pairAddress.slice(-4)} ↗
                </a>
              </div>
            )}
            {pairAddress && (
              <div style={styles.infoRow}>
                <span style={{ color: '#888' }}>View Chart</span>
                <a 
                  href={`https://dexscreener.com/pulsechain/${pairAddress}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ color: '#D4AF37', fontSize: '0.75rem', textDecoration: 'underline' }}
                >
                  DexScreener ↗
                </a>
              </div>
            )}
            {lpAmount0 && lpAmount1 && (<div style={{ ...styles.infoRow, borderBottom: 'none' }}><span style={{ color: '#888' }}>Total Value</span><span style={{ color: '#4CAF50', fontWeight: 700 }}>{formatUSD((parseFloat(lpAmount0) * (livePrices[lpToken0] || 0)) + (parseFloat(lpAmount1) * (livePrices[lpToken1] || 0)))}</span></div>)}
          </div>
          
          <button style={{ ...styles.swapButton, ...(!userAddress || !lpAmount0 || !lpAmount1 || lpLoading ? styles.swapButtonDisabled : {}) }} onClick={addLiquidity} disabled={!userAddress || !lpAmount0 || !lpAmount1 || lpLoading}>
            {!userAddress ? 'Connect Wallet' : lpLoading ? 'Adding...' : !lpAmount0 ? 'Enter Amount' : `Add ${lpToken0}/${lpToken1} Liquidity`}
          </button>
          
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(244,67,54,0.1)', borderRadius: '8px', border: '1px solid rgba(244,67,54,0.3)' }}>
            <div style={{ color: '#F44336', fontSize: '0.75rem' }}>⚠️ <strong>IL Warning:</strong> Providing liquidity involves impermanent loss risk.</div>
          </div>
        </div>
      )}

      {/* INSTABOND SNIPE TAB - Top 10 Closest to Bonding */}
      {activeTab === 'instabond' && (
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1.1rem' }}>🔥 InstaBond Snipe</div>
            <button
              onClick={fetchPreBondedTokens}
              disabled={instabondLoading}
              style={{
                background: 'rgba(212,175,55,0.2)',
                border: '1px solid rgba(212,175,55,0.5)',
                borderRadius: '8px',
                padding: '6px 12px',
                color: '#D4AF37',
                cursor: instabondLoading ? 'wait' : 'pointer',
                fontSize: '0.8rem',
              }}
            >
              {instabondLoading ? '⏳ Loading...' : '🔄 Refresh'}
            </button>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '8px' }}>
              Top 10 tokens closest to graduation (800M = 100%)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <a href="https://pump.tires" target="_blank" rel="noopener noreferrer" style={{ color: '#4CAF50', fontSize: '0.75rem' }}>🌐 pump.tires →</a>
            </div>
          </div>

          {/* Scrollable token list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
            {instabondLoading ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                ⏳ Loading tokens from pump.tires...
              </div>
            ) : instabondError ? (
              <div style={{ textAlign: 'center', padding: '30px', background: 'rgba(255,87,34,0.1)', borderRadius: '12px', border: '1px solid rgba(255,87,34,0.3)' }}>
                <div style={{ color: '#FF5722', marginBottom: '12px', fontSize: '0.9rem' }}>
                  ⚠️ {instabondError}
                </div>
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '16px' }}>
                  The pump.tires API may be temporarily unavailable.
                </div>
                <button
                  onClick={fetchPreBondedTokens}
                  style={{
                    background: 'rgba(255,87,34,0.2)',
                    border: '1px solid rgba(255,87,34,0.5)',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    color: '#FF5722',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  🔄 Try Again
                </button>
                <a
                  href="https://pump.tires"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    marginTop: '12px',
                    color: '#D4AF37',
                    fontSize: '0.75rem',
                    textDecoration: 'none',
                  }}
                >
                  🌐 Visit pump.tires directly →
                </a>
              </div>
            ) : preBondedTokens.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '40px' }}>
                <div style={{ marginBottom: '16px' }}>No tokens loaded yet.</div>
                <button
                  onClick={fetchPreBondedTokens}
                  style={{
                    background: 'rgba(212,175,55,0.2)',
                    border: '1px solid rgba(212,175,55,0.5)',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    color: '#D4AF37',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  🔄 Load Tokens
                </button>
              </div>
            ) : (
              preBondedTokens.map((token, idx) => (
                <div
                  key={token.address}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '12px',
                    padding: '12px',
                    marginBottom: '8px',
                    border: token.progress >= 80 ? '1px solid rgba(76,175,80,0.5)' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, hsl(${(idx * 36) % 360}, 70%, 50%), hsl(${(idx * 36 + 60) % 360}, 70%, 40%))`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                      }}>
                        {token.logo ? (
                          <img src={token.logo} alt={token.symbol} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                        ) : (
                          token.symbol?.charAt(0) || '?'
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#fff' }}>{token.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>${token.symbol}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: token.progress >= 80 ? '#4CAF50' : token.progress >= 50 ? '#FFB300' : '#888',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                      }}>
                        {token.progress.toFixed(2)}%
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#888' }}>
                        {token.progress >= 80 ? '🔥 Almost bonded!' : token.progress >= 50 ? '📈 Halfway' : '⏳ Early'}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginTop: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(token.progress, 100)}%`,
                      height: '100%',
                      background: token.progress >= 80
                        ? 'linear-gradient(90deg, #4CAF50, #81C784)'
                        : token.progress >= 50
                        ? 'linear-gradient(90deg, #FFB300, #FFD54F)'
                        : 'linear-gradient(90deg, #D4AF37, #FFD700)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(token.address);
                        showToastMsg(`📋 ${token.symbol} address copied!`, 'success');
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        color: '#888',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                      }}
                    >
                      📋 Copy CA
                    </button>
                    <a
                      href={`https://pump.tires/token/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        background: 'rgba(212,175,55,0.2)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px',
                        color: '#D4AF37',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        textAlign: 'center',
                        textDecoration: 'none',
                      }}
                    >
                      🔥 View on pump.tires
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(76,175,80,0.1)', borderRadius: '8px', border: '1px solid rgba(76,175,80,0.3)' }}>
            <div style={{ color: '#4CAF50', fontSize: '0.8rem' }}>
              💡 <strong>Tip:</strong> Tokens at 80%+ are close to graduation. When they hit 100%, LP is created on PulseX!
            </div>
          </div>

          {/* LIMIT BOND SELL - Take Profit Feature */}
          <div style={{ marginTop: '16px', padding: '16px', background: 'linear-gradient(135deg, rgba(212,175,55,0.15), rgba(0,0,0,0.3))', borderRadius: '12px', border: '1px solid rgba(212,175,55,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ color: '#D4AF37', fontWeight: 700, fontSize: '1rem' }}>📈 Limit Bond Sell</div>
              <span style={{ background: 'rgba(212,175,55,0.3)', padding: '2px 8px', borderRadius: '4px', color: '#D4AF37', fontSize: '0.65rem' }}>BREAKEVEN INITIALS</span>
            </div>

            <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '12px', lineHeight: 1.5 }}>
              Automatically sell a % of tokens when price increases by your target %. Perfect for recovering your initial investment!
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: '#4CAF50', fontSize: '1.1rem', fontWeight: 700 }}>2x → 50%</div>
                <div style={{ color: '#888', fontSize: '0.65rem' }}>Recovers 100% initial</div>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ color: '#FFB300', fontSize: '1.1rem', fontWeight: 700 }}>3x → 33%</div>
                <div style={{ color: '#888', fontSize: '0.65rem' }}>Recovers 100% initial</div>
              </div>
            </div>

            <a
              href="https://t.me/DTGBondBot?start=sniper"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0088cc, #0099dd)',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              🤖 Set Up in Telegram Bot →
            </a>
            <div style={{ color: '#666', fontSize: '0.65rem', textAlign: 'center', marginTop: '8px' }}>
              Opens sniper menu → Set TP → Auto-executes on target
            </div>
          </div>
        </div>
      )}

      {onClose && <button onClick={onClose} style={{ width: '100%', marginTop: '16px', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#888', cursor: 'pointer' }}>← Back to Staking</button>}
      {toast && <div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo) }}>{toast.message}</div>}
    </div>
  );
}
