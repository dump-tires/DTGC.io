/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 SAAS APP WRAPPER - Config-Driven DTGC.io
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This wrapper provides the configuration context to the main App.
 * It enables white-label customization without modifying App.jsx directly.
 * 
 * Usage in index.js:
 *   import SaaSApp from './SaaSApp';
 *   ReactDOM.render(<SaaSApp />, document.getElementById('root'));
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import App from './App';

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULT DTGC CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_CONFIG = {
  id: 'dtgc',
  chain: 'pulsechain',
  chainId: 369,
  
  rpcUrls: [
    'https://rpc.pulsechain.com',
    'https://pulsechain.publicnode.com',
    'https://rpc-pulsechain.g4mm4.io',
  ],
  
  explorer: 'https://scan.pulsechain.com',
  
  // Main token
  token: {
    address: '0x817F2Fa8E14dBB7FA4138067D0C2CbDaB304a0D0',
    symbol: 'DTGC',
    name: 'DT Gold Coin',
    decimals: 18,
    logo: '/dtgc-logo.png',
    totalSupply: 1000000000,
  },
  
  // Secondary token (for Diamond+ LP)
  secondaryToken: {
    address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0',
    symbol: 'URMOM',
    name: 'URMOM',
    decimals: 18,
    logo: '/urmom-logo.png',
  },
  
  // Contract addresses
  contracts: {
    // V4 contracts (current)
    stakingV4: '0xEbC6802e6a2054FbF2Cb450aEc5E2916965b1718',
    lpStakingV4: '0x22f0DE89Ef26AE5c03CB43543dF5Bbd8cb8d0231',
    flexStakingV4: '0x5ccea11cab6a17659ce1860f5b0b6e4a8cea54d6',
    dapper: '0xc7fe28708ba913d6bdf1e7eac2c75f2158d978de',
    
    // V3 contracts (legacy)
    stakingV3: '0xE77929B1c30C51e2C02EF39ba5e5a95CA6534F20',
    lpStakingV3: '0xb5D407914f7b4534b6Dc1f67d3940f78A9e12152',
    daoV3: '0xB4769C1544E6272e78c5c0542EA15B6716393677',
    
    // LP tokens
    lpDTGC_PLS: '0x78AEb0ADfEbf37E500ff4bd8c4e06Fe0D0e4131c',
    lpDTGC_URMOM: '0x5c0e3b5fd00a63084bf85b1e3e9d4cfdc16d0bba',
    
    // DEX
    pulsexRouter: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
    pulsexFactory: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
    wpls: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27',
    
    // Other
    growthEngine: '0x7aAB5EF45b71338Cb6Ea702f0641F99A2F7565A6',
    burnAddress: '0x000000000000000000000000000000000000dEaD',
  },
  
  // Staking tiers
  tiers: [
    {
      id: 0,
      name: 'SILVER',
      icon: '🥈',
      minInvest: 5,
      maxInvest: 0,
      lockDays: 60,
      apr: 15.4,
      boost: 1,
      asset: 'TOKEN',
      color: '#C0C0C0',
      gradient: 'linear-gradient(135deg, #E8E8E8 0%, #C0C0C0 50%, #A8A8A8 100%)',
    },
    {
      id: 1,
      name: 'GOLD',
      icon: '🥇',
      minInvest: 5,
      maxInvest: 0,
      lockDays: 90,
      apr: 16.8,
      boost: 1,
      asset: 'TOKEN',
      color: '#D4AF37',
      gradient: 'linear-gradient(135deg, #FFF1A8 0%, #D4AF37 50%, #B8860B 100%)',
    },
    {
      id: 2,
      name: 'WHALE',
      icon: '🐋',
      minInvest: 2500,
      maxInvest: 50000,
      lockDays: 180,
      apr: 18.2,
      boost: 1,
      asset: 'TOKEN',
      color: '#4169E1',
      gradient: 'linear-gradient(135deg, #6B8DD6 0%, #4169E1 50%, #2E4FA3 100%)',
    },
    {
      id: 3,
      name: 'DIAMOND',
      icon: '💎',
      minInvest: 5,
      maxInvest: 25000,
      lockDays: 90,
      apr: 28,
      boost: 1.5,
      asset: 'LP',
      lpPair: 'DTGC/PLS',
      color: '#00BCD4',
      gradient: 'linear-gradient(135deg, #B9F2FF 0%, #00BCD4 50%, #008BA3 100%)',
    },
    {
      id: 4,
      name: 'DIAMOND+',
      icon: '💜💎',
      minInvest: 5,
      maxInvest: 25000,
      lockDays: 90,
      apr: 35,
      boost: 2,
      asset: 'LP_SECONDARY',
      lpPair: 'DTGC/URMOM',
      color: '#9C27B0',
      gradient: 'linear-gradient(135deg, #E1BEE7 0%, #9C27B0 50%, #7B1FA2 100%)',
    },
    {
      id: 5,
      name: 'FLEX',
      icon: '💗',
      minInvest: 300,
      maxInvest: 0,
      lockDays: 0,
      apr: 10,
      boost: 1,
      asset: 'LP',
      color: '#E91E63',
      gradient: 'linear-gradient(135deg, #F48FB1 0%, #E91E63 50%, #C2185B 100%)',
    },
  ],
  
  // Fee structure
  fees: {
    entry: 3.75,
    exit: 3.75,
    earlyWithdrawal: 20,
    breakdown: {
      daoTreasury: 1.875,
      dev: 0.625,
      autoLP_DTGC_URMOM: 0.5,
      autoLP_DTGC_PLS: 0.5,
      burn: 0.25,
    },
  },
  
  // Branding
  branding: {
    name: 'DTGC',
    fullName: 'DT Gold Coin',
    tagline: 'DeFi Staking Simplified',
    description: 'The premier DeFi staking platform on PulseChain',
    logo: '/dtgc-logo.png',
    logoSmall: '/dtgc-icon.png',
    favicon: '/favicon.ico',
    
    colors: {
      primary: '#FFD700',
      secondary: '#1a1a2e',
      accent: '#00BCD4',
      background: '#0a0a0f',
      surface: '#12121a',
      surfaceHover: '#1a1a2e',
      text: '#ffffff',
      textMuted: '#888888',
      success: '#4CAF50',
      warning: '#FF9800',
      error: '#F44336',
      gold: '#D4AF37',
      diamond: '#00BCD4',
      purple: '#9C27B0',
    },
    
    fonts: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace",
    },
  },
  
  // Social links
  socials: {
    website: 'https://dtgc.io',
    twitter: 'https://twitter.com/DTGoldCoin',
    telegram: 'https://t.me/dtgoldcoin',
    dexscreener: 'https://dexscreener.com/pulsechain/0x78aeb0adfebf37e500ff4bd8c4e06fe0d0e4131c',
  },
  
  // Feature flags
  features: {
    singleStaking: true,
    lpStaking: true,
    flexStaking: true,
    diamondPlus: true,
    dao: true,
    growthEngine: true,
    burnStats: true,
    leaderboard: true,
    calculator: true,
    whitepaper: true,
    lpZapper: true,
    walletScanner: true,
    dapper: true,
  },
  
  // Analytics
  analytics: {
    googleAnalytics: '',
    plausible: '',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG CONTEXT
// ═══════════════════════════════════════════════════════════════════════════

const SaaSConfigContext = createContext(null);

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG LOADER
// ═══════════════════════════════════════════════════════════════════════════

function detectClientId() {
  // Check URL parameter: ?client=memecoin
  const urlParams = new URLSearchParams(window.location.search);
  const clientParam = urlParams.get('client');
  if (clientParam) return clientParam;
  
  // Check subdomain: memecoin.dtgc.io
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'app') {
    return parts[0];
  }
  
  // Domain mappings
  const domainMappings = {
    'dtgc.io': 'dtgc',
    'www.dtgc.io': 'dtgc',
    'app.dtgc.io': 'dtgc',
    'localhost': 'dtgc',
  };
  
  return domainMappings[hostname] || 'dtgc';
}

async function loadClientConfig(clientId) {
  // For DTGC, use defaults
  if (clientId === 'dtgc') {
    return DEFAULT_CONFIG;
  }
  
  // Try to load from API
  try {
    const response = await fetch(`/api/config/${clientId}`);
    if (response.ok) {
      const clientConfig = await response.json();
      return mergeConfig(DEFAULT_CONFIG, clientConfig);
    }
  } catch (e) {
    console.log('API config not available');
  }
  
  // Try static file
  try {
    const response = await fetch(`/configs/${clientId}.json`);
    if (response.ok) {
      const clientConfig = await response.json();
      return mergeConfig(DEFAULT_CONFIG, clientConfig);
    }
  } catch (e) {
    console.log('Static config not found');
  }
  
  return DEFAULT_CONFIG;
}

function mergeConfig(defaults, overrides) {
  const result = { ...defaults };
  
  for (const key of Object.keys(overrides)) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = mergeConfig(defaults[key] || {}, overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// CSS VARIABLE INJECTION
// ═══════════════════════════════════════════════════════════════════════════

function injectCSSVariables(config) {
  const { colors, fonts } = config.branding;
  
  const css = `
    :root {
      /* Primary Colors */
      --color-primary: ${colors.primary};
      --color-secondary: ${colors.secondary};
      --color-accent: ${colors.accent};
      
      /* Background */
      --color-background: ${colors.background};
      --color-surface: ${colors.surface};
      --color-surface-hover: ${colors.surfaceHover || colors.surface};
      
      /* Text */
      --color-text: ${colors.text};
      --color-text-muted: ${colors.textMuted};
      
      /* Status */
      --color-success: ${colors.success};
      --color-warning: ${colors.warning};
      --color-error: ${colors.error};
      
      /* Brand */
      --color-gold: ${colors.gold || colors.primary};
      --color-diamond: ${colors.diamond || colors.accent};
      --color-purple: ${colors.purple || '#9C27B0'};
      
      /* Fonts */
      --font-primary: ${fonts.primary};
      --font-mono: ${fonts.mono || 'monospace'};
      
      /* Tier Colors */
      ${config.tiers.map(t => `--tier-${t.name.toLowerCase()}: ${t.color};`).join('\n      ')}
    }
  `;
  
  // Remove existing style if present
  const existing = document.getElementById('saas-config-vars');
  if (existing) existing.remove();
  
  // Inject new styles
  const style = document.createElement('style');
  style.id = 'saas-config-vars';
  style.textContent = css;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function SaaSConfigProvider({ children, overrideConfig = null }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function init() {
      let loadedConfig;
      
      if (overrideConfig) {
        loadedConfig = mergeConfig(DEFAULT_CONFIG, overrideConfig);
      } else {
        const clientId = detectClientId();
        console.log(`🔧 Loading config for: ${clientId}`);
        loadedConfig = await loadClientConfig(clientId);
      }
      
      // Inject CSS variables
      injectCSSVariables(loadedConfig);
      
      // Update document
      document.title = `${loadedConfig.branding.name} | Staking`;
      
      setConfig(loadedConfig);
      setLoading(false);
    }
    
    init();
  }, [overrideConfig]);
  
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0a0a0f',
        color: '#FFD700',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚡</div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }
  
  return (
    <SaaSConfigContext.Provider value={config}>
      {children}
    </SaaSConfigContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

export function useSaaSConfig() {
  const config = useContext(SaaSConfigContext);
  if (!config) {
    // Return defaults if not in provider (backward compat)
    return DEFAULT_CONFIG;
  }
  return config;
}

export function useBranding() {
  const config = useSaaSConfig();
  return config.branding;
}

export function useTiers() {
  const config = useSaaSConfig();
  return config.tiers;
}

export function useContracts() {
  const config = useSaaSConfig();
  return config.contracts;
}

export function useFeatures() {
  const config = useSaaSConfig();
  return config.features;
}

export function useToken() {
  const config = useSaaSConfig();
  return config.token;
}

export function useFees() {
  const config = useSaaSConfig();
  return config.fees;
}

export function useSocials() {
  const config = useSaaSConfig();
  return config.socials;
}

// Helper to get tier by name
export function useTierByName(name) {
  const tiers = useTiers();
  return tiers.find(t => t.name.toUpperCase() === name.toUpperCase());
}

// Helper to get single-token tiers only
export function useSingleTiers() {
  const tiers = useTiers();
  return tiers.filter(t => t.asset === 'TOKEN');
}

// Helper to get LP tiers only
export function useLPTiers() {
  const tiers = useTiers();
  return tiers.filter(t => t.asset === 'LP' || t.asset === 'LP_SECONDARY');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SAAS APP WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

export default function SaaSApp() {
  return (
    <SaaSConfigProvider>
      <App />
    </SaaSConfigProvider>
  );
}

// Export config for use in App.jsx
export { DEFAULT_CONFIG };
