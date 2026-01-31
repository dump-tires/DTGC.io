/**
 * ⚜️ DTRADER MANDALORIAN - Configuration
 * Congruent with PulseXGold at dtgc.io/pulsexgold
 */

require('dotenv').config();

module.exports = {
  // Telegram
  BOT_TOKEN: process.env.BOT_TOKEN,

  // PulseChain Network
  RPC_URL: 'https://pulsechain.publicnode.com',
  CHAIN_ID: 369,

  // PulseX DEX
  ROUTER_V1: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  ROUTER_V2: '0x636f6407B90661b73b1C0F7e24F4C79f624d0738',
  FACTORY_V1: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  FACTORY_V2: '0x29eA7545DEf87022BAdc76323F373EA1e707C523',
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',

  // DTGC Token (0xD0676B28a457371D58d47E5247b439114e40Eb0F)
  DTGC_ADDRESS: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
  DTGC_MIN_USD: 50, // $50 minimum for PRO features

  // Fee Structure (1% total)
  FEES: {
    BUY_BURN_BPS: 50,  // 0.5% buy & burn DTGC
    DEV_BPS: 50,       // 0.5% to dev wallet in PLS
    TOTAL_BPS: 100,    // 1% total
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',

  // Links - CONGRUENT WITH PULSEXGOLD
  LINKS: {
    PULSEX_GOLD: 'https://dtgc.io/pulsexgold',
    DTGC_WEBSITE: 'https://dtgc.io',
    PULSESCAN: 'https://scan.pulsechain.com',
    PUMP_TIRES: 'https://pump.tires',
    DEXSCREENER: 'https://dexscreener.com/pulsechain',
  },

  // Trading Defaults
  DEFAULT_SLIPPAGE_BPS: 300, // 3%
  DEFAULT_GAS_LIMIT: 500000,
  DEADLINE_MINUTES: 20,

  // Sniper Settings
  SNIPER: {
    MAX_WALLETS: 6,
    MIN_LIQUIDITY_PLS: '1000', // 1000 PLS minimum
    ANTI_RUG_CHECK: true,
  },

  // pump.tires Integration
  PUMP_TIRES: {
    API_URL: 'https://pump.tires/api',
    GRADUATION_THRESHOLD: 800000000, // 800M tokens = bonded
  },
};
