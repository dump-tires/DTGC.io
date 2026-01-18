import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ============================================
// ZAPPER-X-CHAIN V7.1 - MAXIMUM TOKEN COVERAGE
// CoinGecko API Integration for 15,000+ tokens
// Adjustable amounts, Direct DEX swaps, Liberty Bridge
// Fee Wallet: 0x1449a7d9973e6215534d785e3e306261156eb610
// ============================================

const FEE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';
const DEFAULT_GAS_RESERVE_PERCENT = 15;

// ============================================
// TOKEN SCANNING CONFIG - V7 MAXIMUM COVERAGE
// ============================================
const TOKEN_SCAN_CONFIG = {
  ethereum: { maxTokens: 5000, coingeckoPlatform: 'ethereum' },
  bsc: { maxTokens: 4000, coingeckoPlatform: 'binance-smart-chain' },
  polygon: { maxTokens: 3000, coingeckoPlatform: 'polygon-pos' },
  arbitrum: { maxTokens: 2000, coingeckoPlatform: 'arbitrum-one' },
  optimism: { maxTokens: 1500, coingeckoPlatform: 'optimistic-ethereum' },
  base: { maxTokens: 1500, coingeckoPlatform: 'base' },
  avalanche: { maxTokens: 1500, coingeckoPlatform: 'avalanche' },
};

// Total: 18,500 potential tokens scanned

// USDC addresses per chain
const USDC_ADDRESSES = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

// Wrapped native tokens
const WRAPPED_NATIVE = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  optimism: '0x4200000000000000000000000000000000000006',
  base: '0x4200000000000000000000000000000000000006',
};

// DEX Routers per chain (Uniswap V3 / equivalents)
const DEX_ROUTERS = {
  ethereum: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  bsc: { address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', name: 'PancakeSwap V3' },
  polygon: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  arbitrum: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  avalanche: { address: '0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE', name: 'TraderJoe V2' },
  optimism: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  base: { address: '0x2626664c2603336E57B271c5C0b26F421741e481', name: 'Uniswap V3' },
};

// Universal Router (supports both V2 and V3)
const UNIVERSAL_ROUTER = {
  ethereum: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  polygon: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  arbitrum: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  optimism: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
  base: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
};

const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum', chainId: 1, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#627EEA',
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
    // Fallback tokens if CoinGecko unavailable
    fallbackTokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18, coingeckoId: 'maker' },
      { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', decimals: 18, coingeckoId: 'curve-dao-token' },
      { symbol: 'LDO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', decimals: 18, coingeckoId: 'lido-dao' },
      { symbol: 'APE', address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381', decimals: 18, coingeckoId: 'apecoin' },
    ]
  },
  bsc: {
    name: 'BNB Chain', chainId: 56, symbol: 'BNB', decimals: 18, coingeckoId: 'binancecoin', color: '#F3BA2F',
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'FLOKI', address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', decimals: 9, coingeckoId: 'floki' },
    ]
  },
  polygon: {
    name: 'Polygon', chainId: 137, symbol: 'MATIC', decimals: 18, coingeckoId: 'matic-network', color: '#8247E5',
    rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'LINK', address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18, coingeckoId: 'chainlink' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum', chainId: 42161, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#28A0F0',
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
    ]
  },
  optimism: {
    name: 'Optimism', chainId: 10, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#FF0420',
    rpcs: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
    ]
  },
  base: {
    name: 'Base', chainId: 8453, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#0052FF',
    rpcs: ['https://base.llamarpc.com', 'https://base.publicnode.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
    ]
  },
  avalanche: {
    name: 'Avalanche', chainId: 43114, symbol: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2', color: '#E84142',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18, coingeckoId: 'joe' },
    ]
  }
};

// ABI fragments
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
];

const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
];

const WETH_ABI = [
  'function deposit() external payable',
  'function withdraw(uint256 wad) external',
];

// RPC helpers
const rpcCall = async (rpcUrl, method, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const tryRpcs = async (rpcs, method, params) => {
  for (const rpc of rpcs) {
    try { return await rpcCall(rpc, method, params); } catch (e) { continue; }
  }
  throw new Error('All RPCs failed');
};

// Batch RPC call for efficiency
const batchRpcCall = async (rpcUrl, calls) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const body = calls.map((call, idx) => ({
      jsonrpc: '2.0',
      id: idx + 1,
      method: call.method,
      params: call.params
    }));
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const results = await response.json();
    return Array.isArray(results) ? results : [results];
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const BALANCE_OF_SELECTOR = '0x70a08231';

// ============================================
// COINGECKO TOKEN LIST FETCHER
// ============================================
const tokenListCache = {};

const fetchCoinGeckoTokenList = async (chainKey) => {
  const config = TOKEN_SCAN_CONFIG[chainKey];
  if (!config) return [];
  
  // Check cache
  const cacheKey = `${chainKey}_tokens`;
  if (tokenListCache[cacheKey] && Date.now() - tokenListCache[cacheKey].timestamp < 3600000) {
    return tokenListCache[cacheKey].tokens;
  }
  
  try {
    // Fetch token list from CoinGecko
    const platform = config.coingeckoPlatform;
    const maxTokens = config.maxTokens;
    
    // CoinGecko's coin list with platform addresses
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&category=${platform === 'ethereum' ? '' : platform}`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) {
      console.log(`CoinGecko API error for ${chainKey}, using fallback`);
      return CHAIN_CONFIG[chainKey].fallbackTokens || [];
    }
    
    const coins = await response.json();
    
    // Now fetch addresses for these coins
    const tokenList = [];
    
    // Fetch in batches of 50
    for (let i = 0; i < Math.min(coins.length, 50); i++) {
      const coin = coins[i];
      if (coin.id) {
        try {
          const detailResponse = await fetch(
            `https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
            { headers: { 'Accept': 'application/json' } }
          );
          
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            const address = detail.platforms?.[platform];
            
            if (address && address.startsWith('0x')) {
              tokenList.push({
                symbol: detail.symbol?.toUpperCase() || coin.symbol?.toUpperCase(),
                address: address,
                decimals: detail.detail_platforms?.[platform]?.decimal_place || 18,
                coingeckoId: coin.id,
                price: coin.current_price || 0,
                marketCap: coin.market_cap || 0,
              });
            }
          }
          
          // Rate limit protection
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          continue;
        }
      }
    }
    
    // Cache results
    tokenListCache[cacheKey] = { tokens: tokenList, timestamp: Date.now() };
    
    return tokenList;
  } catch (error) {
    console.log(`Failed to fetch CoinGecko list for ${chainKey}:`, error);
    return CHAIN_CONFIG[chainKey].fallbackTokens || [];
  }
};

// Alternative: Fetch from token list aggregators (faster)
const fetchTokenListFromAggregator = async (chainKey) => {
  const chainId = CHAIN_CONFIG[chainKey]?.chainId;
  if (!chainId) return [];
  
  // Token list URLs by chain
  const tokenListUrls = {
    1: 'https://tokens.coingecko.com/ethereum/all.json',
    56: 'https://tokens.coingecko.com/binance-smart-chain/all.json',
    137: 'https://tokens.coingecko.com/polygon-pos/all.json',
    42161: 'https://tokens.coingecko.com/arbitrum-one/all.json',
    10: 'https://tokens.coingecko.com/optimistic-ethereum/all.json',
    8453: 'https://tokens.coingecko.com/base/all.json',
    43114: 'https://tokens.coingecko.com/avalanche/all.json',
  };
  
  const url = tokenListUrls[chainId];
  if (!url) return CHAIN_CONFIG[chainKey].fallbackTokens || [];
  
  // Check cache
  const cacheKey = `${chainKey}_list`;
  if (tokenListCache[cacheKey] && Date.now() - tokenListCache[cacheKey].timestamp < 3600000) {
    return tokenListCache[cacheKey].tokens;
  }
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch');
    
    const data = await response.json();
    const tokens = data.tokens || [];
    
    // Limit to configured max
    const maxTokens = TOKEN_SCAN_CONFIG[chainKey]?.maxTokens || 1000;
    const limitedTokens = tokens.slice(0, maxTokens).map(t => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals || 18,
      coingeckoId: t.extensions?.coingeckoId || t.symbol?.toLowerCase(),
      logoURI: t.logoURI,
    }));
    
    tokenListCache[cacheKey] = { tokens: limitedTokens, timestamp: Date.now() };
    return limitedTokens;
  } catch (error) {
    console.log(`Token list fetch failed for ${chainKey}, using fallback`);
    return CHAIN_CONFIG[chainKey].fallbackTokens || [];
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
const ZapperXChain = ({ connectedAddress: propAddress }) => {
  // Core state
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '', tokensScanned: 0, tokensFound: 0 });
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanMode, setScanMode] = useState('deep'); // 'quick' or 'deep'
  
  // Zap state
  const [zapAmounts, setZapAmounts] = useState({}); // { 'chainKey-symbol': dollarAmount }
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [isZapping, setIsZapping] = useState(false);
  const [zapProgress, setZapProgress] = useState({ current: 0, total: 0, status: '', asset: null });
  const [zapResults, setZapResults] = useState([]);
  
  // Bridge state
  const [bridgeReady, setBridgeReady] = useState({}); // { chainKey: usdcAmount }
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState('');
  
  // Referral state
  const [referrer, setReferrer] = useState(null);
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, volumeGenerated: 0, earnings: 0 });
  const [copySuccess, setCopySuccess] = useState(false);

  // Get Rabby-aware provider
  const getProvider = useCallback(() => {
    let ethProvider = window.ethereum;
    if (window.ethereum?.isRabby) {
      ethProvider = window.ethereum;
    } else if (window.ethereum?.providers?.length) {
      const rabby = window.ethereum.providers.find(p => p.isRabby);
      if (rabby) ethProvider = rabby;
    }
    return ethProvider;
  }, []);

  // Detect referral from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ref.startsWith('0x') && ref.length === 42) {
      setReferrer(ref);
      localStorage.setItem('zapperxchainReferrer', ref);
    } else {
      const storedRef = localStorage.getItem('zapperxchainReferrer');
      if (storedRef) setReferrer(storedRef);
    }
  }, []);

  // Load referral stats
  useEffect(() => {
    if (walletAddress) {
      const stats = {
        totalReferrals: parseInt(localStorage.getItem(`zapperxchain_signups_${walletAddress}`) || '0'),
        volumeGenerated: parseFloat(localStorage.getItem(`zapperxchain_volume_${walletAddress}`) || '0'),
        earnings: parseFloat(localStorage.getItem(`zapperxchain_earnings_${walletAddress}`) || '0')
      };
      setReferralStats(stats);
    }
  }, [walletAddress]);

  // Detect wallet
  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) { setWalletAddress(propAddress); return; }
      const ethProvider = getProvider();
      if (ethProvider) {
        try {
          const accounts = await ethProvider.request({ method: 'eth_accounts' });
          if (accounts?.[0]) setWalletAddress(accounts[0]);
        } catch (e) {}
      }
    };
    detectWallet();
  }, [propAddress, getProvider]);

  // Fetch prices
  const fetchPrices = async () => {
    try {
      const ids = 'ethereum,binancecoin,matic-network,avalanche-2,optimism,arbitrum,tether,usd-coin,chainlink,uniswap,shiba-inu,pancakeswap-token,wrapped-bitcoin,dai,aave,maker,curve-dao-token,lido-dao,apecoin,pepe,gmx,joe,velodrome-finance,aerodrome-finance,floki';
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (response.ok) { const data = await response.json(); setPrices(data); return data; }
    } catch (e) { console.log('Price fetch error'); }
    return { 
      'ethereum': { usd: 3300 }, 'binancecoin': { usd: 650 }, 'matic-network': { usd: 0.5 }, 
      'avalanche-2': { usd: 35 }, 'tether': { usd: 1 }, 'usd-coin': { usd: 1 },
    };
  };

  // Get balances
  const getNativeBalance = async (chain, address) => {
    try {
      const result = await tryRpcs(chain.rpcs, 'eth_getBalance', [address, 'latest']);
      if (!result || result === '0x0') return 0;
      return Number(BigInt(result)) / Math.pow(10, chain.decimals);
    } catch (e) { return 0; }
  };

  const getTokenBalance = async (chain, tokenAddress, walletAddr, decimals) => {
    try {
      const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
      const result = await tryRpcs(chain.rpcs, 'eth_call', [{ to: tokenAddress, data: BALANCE_OF_SELECTOR + paddedAddress }, 'latest']);
      if (!result || result === '0x') return 0;
      return Number(BigInt(result)) / Math.pow(10, decimals);
    } catch (e) { return 0; }
  };
  
  // Batch balance check for efficiency
  const getTokenBalancesBatch = async (chain, tokens, walletAddr) => {
    const rpc = chain.rpcs[0];
    const BATCH_SIZE = 100; // RPC batch limit
    const results = [];
    
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
      
      const calls = batch.map(token => ({
        method: 'eth_call',
        params: [{ to: token.address, data: BALANCE_OF_SELECTOR + paddedAddress }, 'latest']
      }));
      
      try {
        const batchResults = await batchRpcCall(rpc, calls);
        
        for (let j = 0; j < batch.length; j++) {
          const result = batchResults[j]?.result;
          if (result && result !== '0x' && result !== '0x0') {
            try {
              const balance = Number(BigInt(result)) / Math.pow(10, batch[j].decimals || 18);
              if (balance > 0.0001) {
                results.push({ ...batch[j], balance });
              }
            } catch (e) {}
          }
        }
      } catch (error) {
        // Fallback to individual calls if batch fails
        for (const token of batch) {
          try {
            const balance = await getTokenBalance(chain, token.address, walletAddr, token.decimals || 18);
            if (balance > 0.0001) {
              results.push({ ...token, balance });
            }
          } catch (e) {}
        }
      }
    }
    
    return results;
  };

  // Scan chain with CoinGecko token list
  const scanChainDeep = async (chainKey, address, currentPrices, onProgress) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    // Native balance
    const nativeBalance = await getNativeBalance(chain, address);
    if (nativeBalance > 0.0001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      const value = nativeBalance * price;
      foundAssets.push({
        chain: chain.name, chainKey, symbol: chain.symbol, balance: nativeBalance,
        value, price, isNative: true, color: chain.color,
        decimals: chain.decimals, chainId: chain.chainId
      });
    }
    
    // Fetch token list
    onProgress?.(`Loading ${chain.name} token list...`, 0);
    let tokenList = await fetchTokenListFromAggregator(chainKey);
    
    if (tokenList.length === 0) {
      tokenList = chain.fallbackTokens || [];
    }
    
    const totalTokens = tokenList.length;
    onProgress?.(`Scanning ${totalTokens.toLocaleString()} tokens on ${chain.name}...`, 0);
    
    // Batch check balances
    const tokensWithBalances = await getTokenBalancesBatch(chain, tokenList, address);
    
    // Add found tokens
    for (const token of tokensWithBalances) {
      const price = currentPrices[token.coingeckoId]?.usd || token.price || 0;
      foundAssets.push({
        chain: chain.name, chainKey, symbol: token.symbol, balance: token.balance,
        value: token.balance * price, price, isNative: false, color: chain.color,
        address: token.address, decimals: token.decimals, chainId: chain.chainId,
        logoURI: token.logoURI
      });
    }
    
    onProgress?.(`Found ${foundAssets.length} assets on ${chain.name}`, totalTokens);
    
    return { assets: foundAssets, tokensScanned: totalTokens };
  };

  // Quick scan (fallback tokens only)
  const scanChainQuick = async (chainKey, address, currentPrices) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    const nativeBalance = await getNativeBalance(chain, address);
    if (nativeBalance > 0.0001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      const value = nativeBalance * price;
      foundAssets.push({
        chain: chain.name, chainKey, symbol: chain.symbol, balance: nativeBalance,
        value, price, isNative: true, color: chain.color,
        decimals: chain.decimals, chainId: chain.chainId
      });
    }

    for (const token of chain.fallbackTokens || []) {
      const balance = await getTokenBalance(chain, token.address, address, token.decimals);
      if (balance > 0.0001) {
        const price = currentPrices[token.coingeckoId]?.usd || 0;
        foundAssets.push({
          chain: chain.name, chainKey, symbol: token.symbol, balance,
          value: balance * price, price, isNative: false, color: chain.color,
          address: token.address, decimals: token.decimals, chainId: chain.chainId
        });
      }
    }
    return { assets: foundAssets, tokensScanned: (chain.fallbackTokens || []).length };
  };

  // Main scan
  const scanAllChains = async (testAddress = null) => {
    let addressToScan = testAddress || walletAddress;
    const ethProvider = getProvider();
    if (!addressToScan && ethProvider) {
      try {
        const accounts = await ethProvider.request({ method: 'eth_accounts' });
        if (accounts?.[0]) { addressToScan = accounts[0]; setWalletAddress(accounts[0]); }
      } catch (e) {}
    }
    if (!addressToScan) { setScanError('Please connect your wallet'); return; }

    setIsScanning(true);
    setScanError(null);
    setAssets([]);
    setTotalValue(0);
    setSelectedAssets(new Set());
    setZapAmounts({});
    setBridgeReady({});

    const chains = Object.keys(CHAIN_CONFIG);
    const totalExpectedTokens = scanMode === 'deep' 
      ? Object.values(TOKEN_SCAN_CONFIG).reduce((s, c) => s + c.maxTokens, 0)
      : chains.length * 15;
      
    setScanProgress({ current: 0, total: chains.length, chain: 'Loading prices...', tokensScanned: 0, tokensFound: 0 });

    try {
      const currentPrices = await fetchPrices();
      const allAssets = [];
      const newZapAmounts = {};
      let totalTokensScanned = 0;
      
      for (let i = 0; i < chains.length; i++) {
        const chainKey = chains[i];
        const chain = CHAIN_CONFIG[chainKey];
        
        setScanProgress(prev => ({ 
          ...prev, 
          current: i + 1, 
          chain: chain.name,
          tokensScanned: totalTokensScanned
        }));
        
        try {
          const onProgress = (status, scanned) => {
            setScanProgress(prev => ({ 
              ...prev, 
              chain: status,
              tokensScanned: totalTokensScanned + scanned
            }));
          };
          
          const result = scanMode === 'deep'
            ? await scanChainDeep(chainKey, addressToScan, currentPrices, onProgress)
            : await scanChainQuick(chainKey, addressToScan, currentPrices);
          
          totalTokensScanned += result.tokensScanned;
          
          for (const asset of result.assets) {
            allAssets.push(asset);
            const key = `${asset.chainKey}-${asset.symbol}`;
            newZapAmounts[key] = asset.isNative 
              ? Math.max(0, asset.value * 0.85) 
              : asset.value;
          }
        } catch (error) {
          console.log(`Error scanning ${chain.name}:`, error);
        }
        
        setAssets([...allAssets].sort((a, b) => b.value - a.value));
        setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
        setScanProgress(prev => ({ ...prev, tokensFound: allAssets.length }));
      }

      setAssets(allAssets.sort((a, b) => b.value - a.value));
      setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      setZapAmounts(newZapAmounts);
      setScanProgress(prev => ({ 
        ...prev, 
        chain: `✅ Complete! Scanned ${totalTokensScanned.toLocaleString()} tokens`,
        tokensScanned: totalTokensScanned,
        tokensFound: allAssets.length
      }));
      
      // Check for existing USDC balances
      checkBridgeReady(allAssets);
    } catch (error) {
      setScanError('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Check which chains have USDC ready to bridge
  const checkBridgeReady = (assetList) => {
    const ready = {};
    for (const asset of assetList) {
      if (isUsdcToken(asset.symbol)) {
        ready[asset.chainKey] = (ready[asset.chainKey] || 0) + asset.value;
      }
    }
    setBridgeReady(ready);
  };

  // Switch network
  const switchNetwork = async (chainId) => {
    const ethProvider = getProvider();
    if (!ethProvider) throw new Error('No wallet');
    
    try {
      await ethProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + chainId.toString(16) }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        const chainConfig = Object.values(CHAIN_CONFIG).find(c => c.chainId === chainId);
        if (chainConfig) {
          await ethProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + chainId.toString(16),
              chainName: chainConfig.name,
              nativeCurrency: { name: chainConfig.symbol, symbol: chainConfig.symbol, decimals: 18 },
              rpcUrls: chainConfig.rpcs,
            }]
          });
        }
      } else {
        throw switchError;
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  };

  // Execute single swap
  const executeSwap = async (asset, dollarAmount) => {
    const ethProvider = getProvider();
    if (!ethProvider) throw new Error('No wallet connected');
    
    const tokenAmount = dollarAmount / asset.price;
    const amountWei = BigInt(Math.floor(tokenAmount * Math.pow(10, asset.decimals)));
    
    if (amountWei <= 0n) throw new Error('Amount too small');
    
    await switchNetwork(asset.chainId);
    
    const provider = new ethers.BrowserProvider(ethProvider);
    const signer = await provider.getSigner();
    
    const chainKey = asset.chainKey;
    const usdcAddress = USDC_ADDRESSES[chainKey];
    const routerAddress = DEX_ROUTERS[chainKey]?.address;
    
    if (!routerAddress) throw new Error('No DEX router for this chain');
    
    if (asset.isNative) {
      const wrappedAddress = WRAPPED_NATIVE[chainKey];
      
      setZapProgress(prev => ({ ...prev, status: `Wrapping ${asset.symbol}...` }));
      const wethContract = new ethers.Contract(wrappedAddress, WETH_ABI, signer);
      const wrapTx = await wethContract.deposit({ value: amountWei });
      await wrapTx.wait();
      
      return await swapTokenToUsdc(signer, wrappedAddress, usdcAddress, amountWei, routerAddress, chainKey);
    } else {
      return await swapTokenToUsdc(signer, asset.address, usdcAddress, amountWei, routerAddress, chainKey);
    }
  };

  // Swap token to USDC via DEX
  const swapTokenToUsdc = async (signer, tokenIn, tokenOut, amountIn, routerAddress, chainKey) => {
    setZapProgress(prev => ({ ...prev, status: 'Checking approval...' }));
    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const currentAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);
    
    if (currentAllowance < amountIn) {
      setZapProgress(prev => ({ ...prev, status: 'Approving token...' }));
      const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
      await approveTx.wait();
    }
    
    setZapProgress(prev => ({ ...prev, status: 'Swapping to USDC...' }));
    const router = new ethers.Contract(routerAddress, SWAP_ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    try {
      const params = {
        tokenIn,
        tokenOut,
        fee: 3000,
        recipient: await signer.getAddress(),
        deadline,
        amountIn,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      };
      
      const tx = await router.exactInputSingle(params);
      const receipt = await tx.wait();
      return { success: true, hash: receipt.hash };
    } catch (e) {
      console.log('V3 single failed, trying path...', e.message);
      
      try {
        const path = ethers.solidityPacked(
          ['address', 'uint24', 'address'],
          [tokenIn, 3000, tokenOut]
        );
        
        const params = {
          path,
          recipient: await signer.getAddress(),
          deadline,
          amountIn,
          amountOutMinimum: 0
        };
        
        const tx = await router.exactInput(params);
        const receipt = await tx.wait();
        return { success: true, hash: receipt.hash };
      } catch (e2) {
        throw new Error('Swap failed: ' + e2.message);
      }
    }
  };

  // Zap all selected on a chain
  const zapChain = async (chainKey) => {
    const chainAssets = assets.filter(a => 
      a.chainKey === chainKey && 
      selectedAssets.has(`${a.chainKey}-${a.symbol}`) && 
      !isUsdcToken(a.symbol)
    );
    
    if (chainAssets.length === 0) return;
    
    setIsZapping(true);
    setZapResults([]);
    const results = [];
    
    try {
      for (let i = 0; i < chainAssets.length; i++) {
        const asset = chainAssets[i];
        const key = `${asset.chainKey}-${asset.symbol}`;
        const dollarAmount = zapAmounts[key] || 0;
        
        if (dollarAmount < 0.01) {
          results.push({ asset, success: false, error: 'Amount too small' });
          continue;
        }
        
        setZapProgress({
          current: i + 1,
          total: chainAssets.length,
          status: `Zapping ${asset.symbol}...`,
          asset
        });
        
        try {
          const result = await executeSwap(asset, dollarAmount);
          results.push({ asset, ...result });
        } catch (error) {
          console.error(`Swap error for ${asset.symbol}:`, error);
          results.push({ asset, success: false, error: error.message });
        }
        
        if (i < chainAssets.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } finally {
      setZapProgress({ current: 0, total: 0, status: '', asset: null });
      setIsZapping(false);
      setZapResults(results);
      
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        setBridgeReady(prev => ({
          ...prev,
          [chainKey]: (prev[chainKey] || 0) + results.filter(r => r.success).reduce((s, r) => s + (zapAmounts[`${r.asset.chainKey}-${r.asset.symbol}`] || 0), 0)
        }));
      }
    }
  };

  const updateZapAmount = (assetKey, value) => {
    const numValue = parseFloat(value) || 0;
    setZapAmounts(prev => ({ ...prev, [assetKey]: numValue }));
  };

  const toggleAssetSelection = (assetKey) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetKey)) newSet.delete(assetKey);
      else newSet.add(assetKey);
      return newSet;
    });
  };

  const selectAllOnChain = (chainKey) => {
    const chainAssets = assets.filter(a => a.chainKey === chainKey && !isUsdcToken(a.symbol));
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      chainAssets.forEach(a => newSet.add(`${a.chainKey}-${a.symbol}`));
      return newSet;
    });
  };

  const openBridge = (chainKey) => {
    const usdcAmount = bridgeReady[chainKey] || 0;
    const url = `https://libertyswap.finance/#/bridge?fromChain=${CHAIN_CONFIG[chainKey].chainId}&toChain=369`;
    window.open(url, '_blank');
    setBridgeStatus(`🌉 Bridge ${usdcAmount.toFixed(2)} USDC from ${CHAIN_CONFIG[chainKey].name} → Opening Liberty Swap...`);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isUsdcToken = (symbol) => ['USDC', 'USDC.e', 'USDbC', 'USDT', 'DAI', 'BUSD'].includes(symbol);
  
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };
  
  const assetsByChain = assets.reduce((acc, asset) => {
    if (!acc[asset.chainKey]) acc[asset.chainKey] = [];
    acc[asset.chainKey].push(asset);
    return acc;
  }, {});
  
  const chainsWithAssets = Object.keys(assetsByChain).sort((a, b) => {
    const valueA = assetsByChain[a].reduce((s, asset) => s + asset.value, 0);
    const valueB = assetsByChain[b].reduce((s, asset) => s + asset.value, 0);
    return valueB - valueA;
  });

  const referralLink = walletAddress 
    ? `${window.location.origin}${window.location.pathname}?ref=${walletAddress}` 
    : '';

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: '25px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        borderRadius: '15px',
        padding: '25px',
        border: '2px solid #FFD700'
      }}>
        <h1 style={{ 
          color: '#FFD700', 
          marginBottom: '10px',
          fontSize: '2rem',
          textShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
        }}>
          ⚡ Zapper-X-Chain V7.1 ⚡
        </h1>
        <p style={{ color: '#aaa', marginBottom: '15px' }}>
          Maximum Token Coverage • Scan up to 18,500 tokens across 7 chains
        </p>
        
        {/* Scan Mode Toggle */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: '10px', 
          marginBottom: '15px' 
        }}>
          <button
            onClick={() => setScanMode('quick')}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: scanMode === 'quick' ? '2px solid #FFD700' : '1px solid #666',
              background: scanMode === 'quick' ? 'rgba(255,215,0,0.2)' : 'transparent',
              color: scanMode === 'quick' ? '#FFD700' : '#888',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ⚡ Quick (~50 tokens)
          </button>
          <button
            onClick={() => setScanMode('deep')}
            style={{
              padding: '8px 20px',
              borderRadius: '20px',
              border: scanMode === 'deep' ? '2px solid #4ade80' : '1px solid #666',
              background: scanMode === 'deep' ? 'rgba(74,222,128,0.2)' : 'transparent',
              color: scanMode === 'deep' ? '#4ade80' : '#888',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            🔍 Deep (18,500+ tokens)
          </button>
        </div>
        
        {walletAddress && (
          <div style={{ 
            display: 'inline-block', 
            background: 'rgba(255,255,255,0.1)', 
            padding: '8px 15px', 
            borderRadius: '20px',
            color: '#4ade80',
            fontSize: '0.9rem',
            marginBottom: '10px'
          }}>
            🔗 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            {referrer && (
              <span style={{ marginLeft: '10px', color: '#FF69B4' }}>
                📍 Referred by {referrer.slice(0, 6)}...
              </span>
            )}
          </div>
        )}
        
        <div style={{ marginTop: '15px' }}>
          <button
            onClick={() => scanAllChains()}
            disabled={isScanning}
            style={{
              padding: '15px 40px',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              borderRadius: '25px',
              border: 'none',
              background: isScanning 
                ? '#666' 
                : 'linear-gradient(90deg, #FFD700, #FFA500)',
              color: '#000',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)',
              transition: 'transform 0.2s'
            }}
          >
            {isScanning ? (
              <span className="zap-spinner">⚡</span>
            ) : (
              `🔍 Scan All Chains (${scanMode === 'deep' ? '18,500+' : '~50'} tokens)`
            )}
          </button>
        </div>
        
        {isScanning && (
          <div style={{ marginTop: '15px', color: '#888' }}>
            <div style={{ marginBottom: '5px' }}>
              Chain {scanProgress.current}/{scanProgress.total}: {scanProgress.chain}
            </div>
            <div style={{ 
              fontSize: '0.85rem', 
              color: '#4ade80' 
            }}>
              📊 Tokens scanned: {scanProgress.tokensScanned?.toLocaleString() || 0} | 
              Found: {scanProgress.tokensFound || 0} with balance
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              background: '#333',
              borderRadius: '2px',
              overflow: 'hidden',
              marginTop: '10px'
            }}>
              <div style={{
                width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #FFD700, #4ade80)',
                transition: 'width 0.3s'
              }} />
            </div>
          </div>
        )}
        
        {scanError && (
          <div style={{ 
            color: '#f87171', 
            marginTop: '15px',
            padding: '10px',
            background: 'rgba(239,68,68,0.1)',
            borderRadius: '8px'
          }}>
            ⚠️ {scanError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        justifyContent: 'center'
      }}>
        {[
          { id: 'crosschain', label: '⚡ Cross-Chain Zapper', color: '#FFD700' },
          { id: 'bridge', label: '🌉 Bridge to PulseChain', color: '#4ade80' },
          { id: 'referral', label: '🎁 Referral Program', color: '#FF69B4' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              border: activeTab === tab.id ? `2px solid ${tab.color}` : '1px solid #333',
              background: activeTab === tab.id ? `rgba(${tab.color === '#FFD700' ? '255,215,0' : tab.color === '#4ade80' ? '74,222,128' : '255,105,180'},0.15)` : 'transparent',
              color: activeTab === tab.id ? tab.color : '#888',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      {assets.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '15px',
          marginBottom: '20px'
        }}>
          {[
            { label: 'Total Value', value: `$${formatNumber(totalValue)}`, color: '#FFD700' },
            { label: 'Assets Found', value: assets.length, color: '#4ade80' },
            { label: 'Chains', value: chainsWithAssets.length, color: '#60a5fa' },
            { label: 'Tokens Scanned', value: scanProgress.tokensScanned?.toLocaleString() || '0', color: '#a855f7' }
          ].map((stat, i) => (
            <div key={i} style={{
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              borderRadius: '10px',
              padding: '15px',
              textAlign: 'center',
              border: '1px solid #333'
            }}>
              <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '5px' }}>{stat.label}</div>
              <div style={{ color: stat.color, fontSize: '1.3rem', fontWeight: 'bold' }}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cross-Chain Zapper Tab */}
      {activeTab === 'crosschain' && (
        <div>
          {chainsWithAssets.length === 0 && !isScanning && (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#888',
              background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
              borderRadius: '15px',
              border: '1px solid #333'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🔍</div>
              <div style={{ fontSize: '1.1rem', marginBottom: '10px' }}>No assets found yet</div>
              <div style={{ fontSize: '0.9rem' }}>Click "Scan All Chains" to find your tokens</div>
            </div>
          )}

          {chainsWithAssets.map(chainKey => {
            const chain = CHAIN_CONFIG[chainKey];
            const chainAssets = assetsByChain[chainKey];
            const chainTotal = chainAssets.reduce((s, a) => s + a.value, 0);
            const zappableAssets = chainAssets.filter(a => !isUsdcToken(a.symbol));
            const selectedOnChain = zappableAssets.filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`));
            
            return (
              <div key={chainKey} style={{
                background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
                borderRadius: '15px',
                padding: '20px',
                marginBottom: '15px',
                border: `2px solid ${chain.color}30`
              }}>
                {/* Chain Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      background: chain.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}>
                      {chain.symbol[0]}
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{chain.name}</div>
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>
                        {chainAssets.length} assets • ${formatNumber(chainTotal)}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {zappableAssets.length > 0 && (
                      <>
                        <button
                          onClick={() => selectAllOnChain(chainKey)}
                          style={{
                            padding: '8px 15px',
                            borderRadius: '8px',
                            border: '1px solid #666',
                            background: 'transparent',
                            color: '#888',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => zapChain(chainKey)}
                          disabled={isZapping || selectedOnChain.length === 0}
                          style={{
                            padding: '8px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: selectedOnChain.length > 0 
                              ? 'linear-gradient(90deg, #FFD700, #FFA500)' 
                              : '#333',
                            color: selectedOnChain.length > 0 ? '#000' : '#666',
                            cursor: selectedOnChain.length > 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold',
                            fontSize: '0.85rem'
                          }}
                        >
                          ⚡ Zap {selectedOnChain.length} to USDC
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Asset List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chainAssets.map(asset => {
                    const assetKey = `${asset.chainKey}-${asset.symbol}`;
                    const isUsdc = isUsdcToken(asset.symbol);
                    const isSelected = selectedAssets.has(assetKey);
                    
                    return (
                      <div key={assetKey} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px',
                        background: isSelected ? 'rgba(255,215,0,0.1)' : 'rgba(0,0,0,0.2)',
                        borderRadius: '10px',
                        border: isSelected ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent',
                        flexWrap: 'wrap'
                      }}>
                        {/* Selection checkbox */}
                        {!isUsdc && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAssetSelection(assetKey)}
                            style={{ 
                              width: '18px', 
                              height: '18px', 
                              cursor: 'pointer',
                              accentColor: '#FFD700'
                            }}
                          />
                        )}
                        
                        {/* Token info */}
                        <div style={{ flex: '1', minWidth: '120px' }}>
                          <div style={{ 
                            color: isUsdc ? '#4ade80' : '#fff', 
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            {asset.symbol}
                            {asset.isNative && <span style={{ fontSize: '0.7rem', color: '#888' }}>(native)</span>}
                            {isUsdc && <span style={{ fontSize: '0.7rem', color: '#4ade80' }}>✓ Ready</span>}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.8rem' }}>
                            {asset.balance.toFixed(asset.balance < 0.01 ? 6 : 4)} • ${asset.value.toFixed(2)}
                          </div>
                        </div>
                        
                        {/* Amount slider for non-USDC */}
                        {!isUsdc && isSelected && (
                          <div style={{ 
                            flex: '2', 
                            minWidth: '200px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px'
                          }}>
                            <input
                              type="range"
                              min="0"
                              max={asset.value}
                              step={asset.value / 100}
                              value={zapAmounts[assetKey] || 0}
                              onChange={(e) => updateZapAmount(assetKey, e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <div style={{ 
                              color: '#FFD700', 
                              fontWeight: 'bold',
                              minWidth: '70px',
                              textAlign: 'right'
                            }}>
                              ${(zapAmounts[assetKey] || 0).toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bridge Tab */}
      {activeTab === 'bridge' && (
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          borderRadius: '15px',
          padding: '25px',
          border: '2px solid #4ade80'
        }}>
          <h2 style={{ color: '#4ade80', marginBottom: '20px', textAlign: 'center' }}>
            🌉 Bridge USDC to PulseChain
          </h2>
          
          {bridgeStatus && (
            <div style={{
              padding: '15px',
              background: 'rgba(74,222,128,0.1)',
              borderRadius: '10px',
              marginBottom: '20px',
              color: '#4ade80',
              textAlign: 'center'
            }}>
              {bridgeStatus}
            </div>
          )}
          
          {Object.keys(bridgeReady).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💫</div>
              <div>No USDC ready to bridge yet.</div>
              <div style={{ fontSize: '0.9rem', marginTop: '10px' }}>
                Zap your tokens to USDC first, then bridge here!
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(bridgeReady).map(([chainKey, amount]) => {
                const chain = CHAIN_CONFIG[chainKey];
                return (
                  <div key={chainKey} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    border: `1px solid ${chain.color}50`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: chain.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}>
                        {chain.symbol[0]}
                      </div>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 'bold' }}>{chain.name}</div>
                        <div style={{ color: '#4ade80', fontSize: '0.9rem' }}>
                          ${formatNumber(amount)} USDC ready
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => openBridge(chainKey)}
                      disabled={isBridging}
                      style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                        color: '#000',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      🌉 Bridge to PulseChain
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          
          <div style={{
            marginTop: '20px',
            padding: '15px',
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '10px',
            color: '#888',
            fontSize: '0.85rem',
            textAlign: 'center'
          }}>
            💡 Uses Liberty Swap for secure cross-chain bridging to PulseChain (Chain ID: 369)
          </div>
        </div>
      )}

      {/* Referral Tab */}
      {activeTab === 'referral' && (
        <div style={{
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          borderRadius: '15px',
          padding: '25px',
          border: '2px solid #FF69B4'
        }}>
          <h2 style={{ color: '#FF69B4', marginBottom: '20px', textAlign: 'center' }}>
            🎁 Referral Program
          </h2>
          
          {walletAddress ? (
            <>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: '#FF69B4', fontWeight: 'bold', marginBottom: '8px' }}>🔗 Your Referral Link</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    style={{
                      flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px',
                      border: '1px solid #FF69B4', background: 'rgba(0,0,0,0.3)',
                      color: '#fff', fontSize: '0.8rem'
                    }}
                  />
                  <button
                    onClick={() => copyToClipboard(referralLink)}
                    style={{
                      padding: '10px 15px', borderRadius: '8px', border: 'none',
                      background: copySuccess ? '#4ade80' : 'linear-gradient(90deg, #FF69B4, #FFD700)',
                      color: '#000', cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    {copySuccess ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '15px' }}>
                {[
                  { label: 'Referrals', value: referralStats.totalReferrals, color: '#FF69B4' },
                  { label: 'Volume', value: `$${formatNumber(referralStats.volumeGenerated)}`, color: '#FFD700' },
                  { label: 'Earnings', value: `$${formatNumber(referralStats.earnings)}`, color: '#4ade80' }
                ].map((stat, i) => (
                  <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                    <div style={{ color: '#888', fontSize: '0.75rem' }}>{stat.label}</div>
                    <div style={{ color: stat.color, fontWeight: 'bold', fontSize: '1.1rem' }}>{stat.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href={`https://twitter.com/intent/tweet?text=Zap%20dust%20to%20USDC%20with%20Zapper-X-Chain!&url=${encodeURIComponent(referralLink)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 15px', borderRadius: '8px', background: '#000', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #333' }}>𝕏 Share</a>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Zap%20dust%20to%20USDC%20with%20Zapper-X-Chain!`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 15px', borderRadius: '8px', background: '#0088cc', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>✈️ Telegram</a>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
              Connect wallet to get your referral link
            </div>
          )}
        </div>
      )}

      {/* Zap Results Modal */}
      {zapResults.length > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderRadius: '15px', padding: '25px', maxWidth: '400px', width: '100%',
            border: '2px solid #FFD700', maxHeight: '80vh', overflow: 'auto'
          }}>
            <h3 style={{ color: '#FFD700', marginBottom: '15px', textAlign: 'center' }}>⚡ Zap Results</h3>
            
            {zapResults.map((result, i) => (
              <div key={i} style={{
                padding: '10px', borderRadius: '8px', marginBottom: '8px',
                background: result.success ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${result.success ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#fff' }}>{result.asset.symbol}</span>
                  <span style={{ color: result.success ? '#4ade80' : '#f87171', fontSize: '0.85rem' }}>
                    {result.success ? '✅ Success' : `❌ ${result.error?.slice(0, 25)}...`}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button
                onClick={() => setZapResults([])}
                style={{
                  flex: 1, padding: '12px', borderRadius: '8px',
                  border: '1px solid #666', background: 'transparent',
                  color: '#888', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Close
              </button>
              {zapResults.some(r => r.success) && (
                <button
                  onClick={() => { setZapResults([]); setActiveTab('bridge'); }}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                    color: '#000', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  🌉 Go to Bridge
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zapping Progress Overlay */}
      {isZapping && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderRadius: '15px', padding: '30px', textAlign: 'center',
            border: '2px solid #FFD700', maxWidth: '350px'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }} className="zap-spinner">⚡</div>
            <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px' }}>
              Zapping {zapProgress.current}/{zapProgress.total}
            </div>
            {zapProgress.asset && (
              <div style={{ color: '#fff', marginBottom: '10px' }}>
                {zapProgress.asset.symbol} on {zapProgress.asset.chain}
              </div>
            )}
            <div style={{ color: '#888', fontSize: '0.9rem' }}>
              {zapProgress.status}
            </div>
          </div>
        </div>
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          border: 2px solid #000;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          border: 2px solid #000;
        }
        @keyframes zapSpin {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(15deg) scale(1.1); }
          50% { transform: rotate(0deg) scale(1); }
          75% { transform: rotate(-15deg) scale(1.1); }
          100% { transform: rotate(0deg) scale(1); }
        }
        @keyframes zapPulse {
          0%, 100% { opacity: 1; text-shadow: 0 0 10px #FFD700, 0 0 20px #FFD700; }
          50% { opacity: 0.7; text-shadow: 0 0 20px #FFD700, 0 0 40px #FFA500, 0 0 60px #FF6600; }
        }
        .zap-spinner {
          display: inline-block;
          animation: zapSpin 0.5s ease-in-out infinite, zapPulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ZapperXChain;
