import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ============================================
// ZAPPER-X-CHAIN - ULTRA SCAN EDITION
// Multicall3 Parallel Scanning • Gasless Zaps • 1% Fee
// Fee Wallet: 0x1449a7d9973e6215534d785e3e306261156eb610
// ALL transactions through our UI with 1% fee always
// ============================================

const FEE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';
const FEE_PERCENT = 1;

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = ['function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external payable returns (tuple(bool success, bytes returnData)[])'];

// ============================================
// SCAN CONFIG - Now with ULTRA mode
// ============================================
const TOKEN_SCAN_CONFIG = {
  ethereum: { quickTokens: 500, deepTokens: 5000, ultraTokens: 25000 },
  bsc: { quickTokens: 400, deepTokens: 4000, ultraTokens: 20000 },
  polygon: { quickTokens: 300, deepTokens: 3000, ultraTokens: 15000 },
  arbitrum: { quickTokens: 300, deepTokens: 2000, ultraTokens: 10000 },
  optimism: { quickTokens: 200, deepTokens: 1500, ultraTokens: 8000 },
  base: { quickTokens: 200, deepTokens: 1500, ultraTokens: 8000 },
  avalanche: { quickTokens: 200, deepTokens: 1500, ultraTokens: 8000 },
};

// Multiple Token List Sources for ULTRA mode
const TOKEN_LIST_SOURCES = {
  ethereum: [
    'https://tokens.coingecko.com/ethereum/all.json',
    'https://tokens.1inch.eth.limo/v1.2/1/tokens.json',
  ],
  bsc: [
    'https://tokens.coingecko.com/binance-smart-chain/all.json',
    'https://tokens.1inch.eth.limo/v1.2/56/tokens.json',
  ],
  polygon: [
    'https://tokens.coingecko.com/polygon-pos/all.json',
    'https://tokens.1inch.eth.limo/v1.2/137/tokens.json',
  ],
  arbitrum: [
    'https://tokens.coingecko.com/arbitrum-one/all.json',
    'https://tokens.1inch.eth.limo/v1.2/42161/tokens.json',
  ],
  optimism: [
    'https://tokens.coingecko.com/optimistic-ethereum/all.json',
    'https://tokens.1inch.eth.limo/v1.2/10/tokens.json',
  ],
  base: [
    'https://tokens.coingecko.com/base/all.json',
    'https://tokens.1inch.eth.limo/v1.2/8453/tokens.json',
  ],
  avalanche: [
    'https://tokens.coingecko.com/avalanche/all.json',
    'https://tokens.1inch.eth.limo/v1.2/43114/tokens.json',
  ],
};

// Ankr API for ULTRA mode token discovery
const ANKR_CHAINS = {
  ethereum: 'eth',
  bsc: 'bsc',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  base: 'base',
  avalanche: 'avalanche',
};

const USDC_ADDRESSES = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

const WRAPPED_NATIVE = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  optimism: '0x4200000000000000000000000000000000000006',
  base: '0x4200000000000000000000000000000000000006',
};

const DEX_ROUTERS = {
  ethereum: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  bsc: { address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', name: 'PancakeSwap V3' },
  polygon: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  arbitrum: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  avalanche: { address: '0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE', name: 'TraderJoe V2' },
  optimism: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  base: { address: '0x2626664c2603336E57B271c5C0b26F421741e481', name: 'Uniswap V3' },
};

const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum', chainId: 1, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#627EEA',
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' },
    ]
  },
  bsc: {
    name: 'BNB Chain', chainId: 56, symbol: 'BNB', decimals: 18, coingeckoId: 'binancecoin', color: '#F3BA2F',
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
    ]
  },
  polygon: {
    name: 'Polygon', chainId: 137, symbol: 'MATIC', decimals: 18, coingeckoId: 'matic-network', color: '#8247E5',
    rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'ethereum' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum', chainId: 42161, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#28A0F0',
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
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
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
    ]
  },
  base: {
    name: 'Base', chainId: 8453, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#0052FF',
    rpcs: ['https://base.llamarpc.com', 'https://mainnet.base.org'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
    ]
  },
  avalanche: {
    name: 'Avalanche', chainId: 43114, symbol: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2', color: '#E84142',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.publicnode.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18, coingeckoId: 'joe' },
    ]
  }
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function nonces(address owner) external view returns (uint256)',
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
];

const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
];

const WETH_ABI = ['function deposit() external payable'];

// RPC helpers
const rpcCall = async (rpcUrl, method, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } catch (e) { clearTimeout(timeoutId); throw e; }
};

const tryRpcs = async (rpcs, method, params) => {
  for (const rpc of rpcs) {
    try { return await rpcCall(rpc, method, params); } catch (e) { continue; }
  }
  throw new Error('All RPCs failed');
};

const BALANCE_OF_SELECTOR = '0x70a08231';
const SYMBOL_SELECTOR = '0x95d89b41';
const DECIMALS_SELECTOR = '0x313ce567';

const multicallBalances = async (rpcUrl, tokens, walletAddr) => {
  const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
  const calls = tokens.map(token => ({ target: token.address, allowFailure: true, callData: BALANCE_OF_SELECTOR + paddedAddress }));
  const iface = new ethers.Interface(MULTICALL3_ABI);
  const calldata = iface.encodeFunctionData('aggregate3', [calls]);
  
  try {
    const result = await rpcCall(rpcUrl, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: calldata }, 'latest']);
    const decoded = iface.decodeFunctionResult('aggregate3', result);
    const results = [];
    for (let i = 0; i < tokens.length; i++) {
      const { success, returnData } = decoded[0][i];
      if (success && returnData && returnData !== '0x' && returnData.length >= 66) {
        try {
          const balance = BigInt(returnData);
          if (balance > 0n) {
            const balanceNum = Number(balance) / Math.pow(10, tokens[i].decimals || 18);
            if (balanceNum > 0.0001) results.push({ ...tokens[i], balance: balanceNum });
          }
        } catch (e) {}
      }
    }
    return results;
  } catch (error) {
    return fallbackBatchBalances(rpcUrl, tokens, walletAddr);
  }
};

const fallbackBatchBalances = async (rpcUrl, tokens, walletAddr) => {
  const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
  const results = [];
  const body = tokens.map((token, idx) => ({ jsonrpc: '2.0', id: idx + 1, method: 'eth_call', params: [{ to: token.address, data: BALANCE_OF_SELECTOR + paddedAddress }, 'latest'] }));
  try {
    const response = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const batchResults = await response.json();
    const resultsArray = Array.isArray(batchResults) ? batchResults : [batchResults];
    for (let i = 0; i < tokens.length; i++) {
      const result = resultsArray.find(r => r.id === i + 1)?.result;
      if (result && result !== '0x' && result !== '0x0') {
        try {
          const balance = Number(BigInt(result)) / Math.pow(10, tokens[i].decimals || 18);
          if (balance > 0.0001) results.push({ ...tokens[i], balance });
        } catch (e) {}
      }
    }
  } catch (e) {}
  return results;
};

// ============================================
// TOKEN LIST FETCHING - Standard + Multi-Source
// ============================================
const tokenListCache = {};

// Standard single-source fetch (quick/deep mode)
const fetchTokenList = async (chainKey, limit) => {
  const chainId = CHAIN_CONFIG[chainKey]?.chainId;
  if (!chainId) return [];
  const cacheKey = `${chainKey}_${limit}`;
  if (tokenListCache[cacheKey] && Date.now() - tokenListCache[cacheKey].timestamp < 3600000) return tokenListCache[cacheKey].tokens;
  
  const urls = { 1: 'https://tokens.coingecko.com/ethereum/all.json', 56: 'https://tokens.coingecko.com/binance-smart-chain/all.json', 137: 'https://tokens.coingecko.com/polygon-pos/all.json', 42161: 'https://tokens.coingecko.com/arbitrum-one/all.json', 10: 'https://tokens.coingecko.com/optimistic-ethereum/all.json', 8453: 'https://tokens.coingecko.com/base/all.json', 43114: 'https://tokens.coingecko.com/avalanche/all.json' };
  
  try {
    const response = await fetch(urls[chainId]);
    if (!response.ok) throw new Error();
    const data = await response.json();
    const tokens = (data.tokens || []).slice(0, limit).map(t => ({ symbol: t.symbol, address: t.address, decimals: t.decimals || 18, coingeckoId: t.extensions?.coingeckoId || t.symbol?.toLowerCase() }));
    tokenListCache[cacheKey] = { tokens, timestamp: Date.now() };
    return tokens;
  } catch (e) { return CHAIN_CONFIG[chainKey].fallbackTokens || []; }
};

// Multi-source fetch for ULTRA mode
const fetchMultiSourceTokenList = async (chainKey, limit) => {
  const chainId = CHAIN_CONFIG[chainKey]?.chainId;
  if (!chainId) return [];
  
  const cacheKey = `${chainKey}_ultra_${limit}`;
  if (tokenListCache[cacheKey] && Date.now() - tokenListCache[cacheKey].timestamp < 3600000) {
    return tokenListCache[cacheKey].tokens;
  }
  
  const sources = TOKEN_LIST_SOURCES[chainKey] || [];
  const seenAddresses = new Set();
  let allTokens = [];
  
  // Fetch from all sources in parallel
  const fetchPromises = sources.map(async (url) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) return [];
      const data = await response.json();
      
      let tokens = [];
      if (data.tokens) {
        tokens = data.tokens;
      } else if (typeof data === 'object' && !Array.isArray(data)) {
        tokens = Object.values(data);
      } else if (Array.isArray(data)) {
        tokens = data;
      }
      
      return tokens.filter(t => !t.chainId || t.chainId === chainId);
    } catch (e) {
      return [];
    }
  });
  
  const results = await Promise.all(fetchPromises);
  
  // Merge and deduplicate
  for (const tokens of results) {
    for (const t of tokens) {
      const addr = (t.address || '').toLowerCase();
      if (addr && !seenAddresses.has(addr)) {
        seenAddresses.add(addr);
        allTokens.push({
          symbol: t.symbol || 'UNKNOWN',
          address: t.address,
          decimals: t.decimals || 18,
          coingeckoId: t.extensions?.coingeckoId || t.symbol?.toLowerCase() || '',
        });
      }
    }
  }
  
  // Add fallback tokens
  const fallbacks = CHAIN_CONFIG[chainKey].fallbackTokens || [];
  for (const fb of fallbacks) {
    const addr = fb.address.toLowerCase();
    if (!seenAddresses.has(addr)) {
      seenAddresses.add(addr);
      allTokens.push(fb);
    }
  }
  
  allTokens.sort((a, b) => {
    if (a.coingeckoId && !b.coingeckoId) return -1;
    if (!a.coingeckoId && b.coingeckoId) return 1;
    return (a.symbol || '').localeCompare(b.symbol || '');
  });
  
  const limited = allTokens.slice(0, limit);
  tokenListCache[cacheKey] = { tokens: limited, timestamp: Date.now() };
  return limited;
};

// ============================================
// ULTRA MODE: INDEXER API DISCOVERY
// ============================================
const discoverTokensViaAnkr = async (chainKey, walletAddr) => {
  const ankrChain = ANKR_CHAINS[chainKey];
  if (!ankrChain) return [];
  
  try {
    const response = await fetch('https://rpc.ankr.com/multichain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'ankr_getAccountBalance',
        params: {
          blockchain: ankrChain,
          walletAddress: walletAddr,
          onlyWhitelisted: false,
        }
      })
    });
    
    const data = await response.json();
    if (data.error || !data.result?.assets) return [];
    
    return data.result.assets
      .filter(a => a.tokenType === 'ERC20' && parseFloat(a.balance) > 0)
      .map(a => ({
        symbol: a.tokenSymbol || 'UNKNOWN',
        address: a.contractAddress,
        decimals: a.tokenDecimals || 18,
        balance: parseFloat(a.balance),
        balanceUsd: parseFloat(a.balanceUsd || 0),
        price: parseFloat(a.tokenPrice || 0),
        coingeckoId: '',
        fromIndexer: true,
      }));
  } catch (e) {
    return [];
  }
};

// Fetch token metadata for unknowns
const fetchTokenMetadata = async (rpcUrl, tokens) => {
  const iface = new ethers.Interface(MULTICALL3_ABI);
  const tokensNeedingMeta = tokens.filter(t => t.symbol === 'UNKNOWN' || !t.decimals);
  
  if (tokensNeedingMeta.length === 0) return tokens;
  
  const calls = [];
  for (const token of tokensNeedingMeta) {
    calls.push({ target: token.address, allowFailure: true, callData: SYMBOL_SELECTOR });
    calls.push({ target: token.address, allowFailure: true, callData: DECIMALS_SELECTOR });
  }
  
  try {
    const calldata = iface.encodeFunctionData('aggregate3', [calls]);
    const result = await rpcCall(rpcUrl, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: calldata }, 'latest']);
    const decoded = iface.decodeFunctionResult('aggregate3', result);
    
    const tokenMap = new Map(tokens.map(t => [t.address.toLowerCase(), t]));
    
    for (let i = 0; i < tokensNeedingMeta.length; i++) {
      const token = tokensNeedingMeta[i];
      const symbolResult = decoded[0][i * 2];
      const decimalsResult = decoded[0][i * 2 + 1];
      
      const existing = tokenMap.get(token.address.toLowerCase());
      if (existing) {
        if (symbolResult.success && symbolResult.returnData.length > 2) {
          try {
            const abiCoder = new ethers.AbiCoder();
            existing.symbol = abiCoder.decode(['string'], symbolResult.returnData)[0];
          } catch (e) {
            try {
              existing.symbol = ethers.decodeBytes32String(symbolResult.returnData);
            } catch (e2) {}
          }
        }
        if (decimalsResult.success && decimalsResult.returnData.length >= 66) {
          try {
            existing.decimals = Number(BigInt(decimalsResult.returnData));
          } catch (e) {}
        }
      }
    }
    
    return Array.from(tokenMap.values());
  } catch (e) {
    return tokens;
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
const ZapperXChain = ({ connectedAddress: propAddress }) => {
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ chain: '', tokensScanned: 0, tokensFound: 0 });
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanMode, setScanMode] = useState('quick');
  const [deepScanAvailable, setDeepScanAvailable] = useState(false);
  const [ultraScanAvailable, setUltraScanAvailable] = useState(false);
  const [gaslessMode, setGaslessMode] = useState(false);
  
  const [zapAmounts, setZapAmounts] = useState({});
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [isZapping, setIsZapping] = useState(false);
  const [zapProgress, setZapProgress] = useState({ current: 0, total: 0, status: '', asset: null });
  const [zapResults, setZapResults] = useState([]);
  
  const [bridgeReady, setBridgeReady] = useState({});
  const [bridgeStatus, setBridgeStatus] = useState('');
  const [totalFeesCollected, setTotalFeesCollected] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Test wallet (Vitalik feature)
  const [testWalletInput, setTestWalletInput] = useState('');
  const [showTestInput, setShowTestInput] = useState(false);

  const formatNumber = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toFixed(2);
  const isUsdcToken = (symbol) => ['USDC', 'USDC.e', 'USDbC', 'axlUSDC'].includes(symbol?.toUpperCase());
  const referralLink = walletAddress ? `https://dtgc.io/zapperx?ref=${walletAddress}` : '';

  const getProvider = useCallback(() => {
    let p = window.ethereum;
    if (window.ethereum?.isRabby) p = window.ethereum;
    else if (window.ethereum?.providers?.length) { const r = window.ethereum.providers.find(x => x.isRabby); if (r) p = r; }
    return p;
  }, []);

  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) { setWalletAddress(propAddress); return; }
      const p = getProvider();
      if (p) { try { const a = await p.request({ method: 'eth_accounts' }); if (a?.[0]) setWalletAddress(a[0]); } catch (e) {} }
    };
    detectWallet();
  }, [propAddress, getProvider]);

  const fetchPrices = async () => {
    try {
      const ids = 'ethereum,binancecoin,matic-network,avalanche-2,tether,usd-coin,chainlink,uniswap,shiba-inu,pancakeswap-token,wrapped-bitcoin,aave,pepe,gmx,joe,aerodrome-finance,arbitrum,optimism';
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (r.ok) { const d = await r.json(); setPrices(d); return d; }
    } catch (e) {}
    return { ethereum: { usd: 3300 }, binancecoin: { usd: 650 }, 'matic-network': { usd: 0.5 }, 'avalanche-2': { usd: 35 }, tether: { usd: 1 }, 'usd-coin': { usd: 1 } };
  };

  const getNativeBalance = async (chain, address) => {
    try {
      const r = await tryRpcs(chain.rpcs, 'eth_getBalance', [address, 'latest']);
      if (!r || r === '0x0') return 0;
      return Number(BigInt(r)) / Math.pow(10, chain.decimals);
    } catch (e) { return 0; }
  };

  // ============================================
  // CHAIN SCANNER - Supports all modes
  // ============================================
  const scanChainOptimized = async (chainKey, address, currentPrices, tokenLimit, mode) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    // Native balance
    const nativeBalance = await getNativeBalance(chain, address);
    if (nativeBalance > 0.0001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      foundAssets.push({ chain: chain.name, chainKey, symbol: chain.symbol, balance: nativeBalance, value: nativeBalance * price, price, isNative: true, color: chain.color, decimals: chain.decimals, chainId: chain.chainId });
    }
    
    // ULTRA mode: Use indexer first
    if (mode === 'ultra') {
      const ankrTokens = await discoverTokensViaAnkr(chainKey, address);
      
      for (const token of ankrTokens) {
        const price = token.price || currentPrices[token.coingeckoId]?.usd || 0;
        const value = token.balanceUsd || (token.balance * price);
        if (value > 0.01 || token.balance > 0.0001) {
          foundAssets.push({
            chain: chain.name, chainKey, symbol: token.symbol, balance: token.balance,
            value, price, isNative: false, color: chain.color, address: token.address,
            decimals: token.decimals, chainId: chain.chainId, fromIndexer: true,
          });
        }
      }
    }
    
    // Get token list (multi-source for ultra, single for quick/deep)
    let tokenList = mode === 'ultra' 
      ? await fetchMultiSourceTokenList(chainKey, tokenLimit)
      : await fetchTokenList(chainKey, tokenLimit);
    
    if (tokenList.length === 0) tokenList = chain.fallbackTokens || [];
    
    // Filter out tokens already found via indexer
    const existingAddresses = new Set(foundAssets.filter(a => a.address).map(a => a.address.toLowerCase()));
    const tokensToScan = tokenList.filter(t => !existingAddresses.has(t.address.toLowerCase()));
    
    // Batch scan
    const BATCH_SIZE = mode === 'ultra' ? 800 : 500;
    for (let i = 0; i < tokensToScan.length; i += BATCH_SIZE) {
      const batch = tokensToScan.slice(i, i + BATCH_SIZE);
      try {
        let tokensWithBalances = await multicallBalances(chain.rpcs[0], batch, address);
        
        // Fetch metadata for unknowns in ULTRA mode
        if (mode === 'ultra') {
          tokensWithBalances = await fetchTokenMetadata(chain.rpcs[0], tokensWithBalances);
        }
        
        for (const token of tokensWithBalances) {
          const price = currentPrices[token.coingeckoId]?.usd || 0;
          foundAssets.push({ chain: chain.name, chainKey, symbol: token.symbol, balance: token.balance, value: token.balance * price, price, isNative: false, color: chain.color, address: token.address, decimals: token.decimals, chainId: chain.chainId });
        }
      } catch (e) {}
    }
    return { assets: foundAssets, tokensScanned: tokenList.length };
  };

  const scanAllChains = async (testAddress = null) => {
    let addressToScan = testAddress || walletAddress;
    const p = getProvider();
    if (!addressToScan && p) { try { const a = await p.request({ method: 'eth_accounts' }); if (a?.[0]) { addressToScan = a[0]; setWalletAddress(a[0]); } } catch (e) {} }
    if (!addressToScan) { setScanError('Please connect wallet'); return; }

    setIsScanning(true); setScanError(null); setAssets([]); setTotalValue(0); setSelectedAssets(new Set()); setZapAmounts({}); setBridgeReady({}); setDeepScanAvailable(false); setUltraScanAvailable(false);

    const chains = Object.keys(CHAIN_CONFIG);
    const mode = scanMode;
    const modeLabels = { quick: '⚡ Quick', deep: '🔍 Deep', ultra: '🚀 ULTRA' };
    
    setScanProgress({ chain: 'Loading prices...', tokensScanned: 0, tokensFound: 0 });

    try {
      const currentPrices = await fetchPrices();
      setScanProgress(prev => ({ ...prev, chain: `${modeLabels[mode]} Scanning ${chains.length} chains...` }));
      
      const scanPromises = chains.map(async (chainKey) => {
        const config = TOKEN_SCAN_CONFIG[chainKey];
        const limit = mode === 'quick' ? config.quickTokens : mode === 'deep' ? config.deepTokens : config.ultraTokens;
        try { return await scanChainOptimized(chainKey, addressToScan, currentPrices, limit, mode); }
        catch (e) { return { assets: [], tokensScanned: 0 }; }
      });
      
      const results = await Promise.all(scanPromises);
      
      const allAssets = [];
      const newZapAmounts = {};
      let totalTokensScanned = 0;
      
      for (const result of results) {
        totalTokensScanned += result.tokensScanned;
        for (const asset of result.assets) {
          allAssets.push(asset);
          const key = `${asset.chainKey}-${asset.symbol}`;
          newZapAmounts[key] = asset.isNative ? Math.max(0, asset.value * 0.85) : asset.value;
        }
      }
      
      allAssets.sort((a, b) => b.value - a.value);
      setAssets(allAssets);
      setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      setZapAmounts(newZapAmounts);
      setScanProgress({ chain: '✅ Complete!', tokensScanned: totalTokensScanned, tokensFound: allAssets.length });
      
      if (mode === 'quick') { setDeepScanAvailable(true); setUltraScanAvailable(true); }
      else if (mode === 'deep') { setUltraScanAvailable(true); }
      
      const ready = {};
      for (const asset of allAssets) { if (isUsdcToken(asset.symbol)) ready[asset.chainKey] = (ready[asset.chainKey] || 0) + asset.value; }
      setBridgeReady(ready);
    } catch (e) { setScanError('Scan failed: ' + e.message); } finally { setIsScanning(false); }
  };

  const extendDeepScan = async () => { setScanMode('deep'); setDeepScanAvailable(false); setUltraScanAvailable(false); await scanAllChains(); };
  const extendUltraScan = async () => { setScanMode('ultra'); setDeepScanAvailable(false); setUltraScanAvailable(false); await scanAllChains(); };
  
  // Test wallet scan
  const scanTestWallet = async () => {
    const addr = testWalletInput.trim();
    if (!addr || !ethers.isAddress(addr)) { setScanError('Invalid address'); return; }
    setShowTestInput(false);
    await scanAllChains(addr);
  };

  const switchNetwork = async (chainId) => {
    const p = getProvider();
    if (!p) throw new Error('No wallet');
    try { await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] }); }
    catch (e) {
      if (e.code === 4902) {
        const c = Object.values(CHAIN_CONFIG).find(x => x.chainId === chainId);
        if (c) await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x' + chainId.toString(16), chainName: c.name, nativeCurrency: { name: c.symbol, symbol: c.symbol, decimals: 18 }, rpcUrls: c.rpcs }] });
      } else throw e;
    }
    await new Promise(r => setTimeout(r, 1000));
  };

  // EXECUTE SWAP WITH 1% FEE
  const executeSwapWithFee = async (asset, dollarAmount) => {
    const p = getProvider();
    if (!p) throw new Error('No wallet');
    
    const tokenAmount = dollarAmount / asset.price;
    const amountWei = BigInt(Math.floor(tokenAmount * Math.pow(10, asset.decimals)));
    if (amountWei <= 0n) throw new Error('Amount too small');
    
    await switchNetwork(asset.chainId);
    
    const provider = new ethers.BrowserProvider(p);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    const chainKey = asset.chainKey;
    const usdcAddress = USDC_ADDRESSES[chainKey];
    const routerAddress = DEX_ROUTERS[chainKey]?.address;
    if (!routerAddress) throw new Error('No DEX router');
    
    let swapResult;
    
    if (asset.isNative) {
      const wrappedAddress = WRAPPED_NATIVE[chainKey];
      setZapProgress(prev => ({ ...prev, status: `Wrapping ${asset.symbol}...` }));
      const wethContract = new ethers.Contract(wrappedAddress, WETH_ABI, signer);
      const wrapTx = await wethContract.deposit({ value: amountWei });
      await wrapTx.wait();
      swapResult = await swapTokenToUsdc(signer, wrappedAddress, usdcAddress, amountWei, routerAddress, chainKey, userAddress);
    } else {
      swapResult = await swapTokenToUsdc(signer, asset.address, usdcAddress, amountWei, routerAddress, chainKey, userAddress);
    }
    
    if (swapResult.success) await sendFeeToGrowthEngine(signer, usdcAddress, chainKey, dollarAmount);
    
    return swapResult;
  };

  const sendFeeToGrowthEngine = async (signer, usdcAddress, chainKey, dollarAmount) => {
    try {
      setZapProgress(prev => ({ ...prev, status: '💰 Sending 1% fee to Growth Engine...' }));
      const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
      const decimals = chainKey === 'bsc' ? 18 : 6;
      const feeAmount = BigInt(Math.floor((dollarAmount * FEE_PERCENT / 100) * Math.pow(10, decimals)));
      if (feeAmount > 0n) {
        const feeTx = await usdcContract.transfer(FEE_WALLET, feeAmount);
        await feeTx.wait();
        const feeUsd = Number(feeAmount) / Math.pow(10, decimals);
        setTotalFeesCollected(prev => prev + feeUsd);
      }
    } catch (e) { console.log('Fee transfer failed:', e.message); }
  };

  const swapTokenToUsdc = async (signer, tokenIn, tokenOut, amountIn, routerAddress, chainKey, userAddress) => {
    setZapProgress(prev => ({ ...prev, status: 'Checking approval...' }));
    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const currentAllowance = await tokenContract.allowance(userAddress, routerAddress);
    
    if (currentAllowance < amountIn) {
      setZapProgress(prev => ({ ...prev, status: 'Requesting approval...' }));
      const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
      await approveTx.wait();
    }
    
    setZapProgress(prev => ({ ...prev, status: 'Swapping to USDC...' }));
    const router = new ethers.Contract(routerAddress, SWAP_ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    const fees = [3000, 500, 10000];
    for (const fee of fees) {
      try {
        const tx = await router.exactInputSingle({
          tokenIn, tokenOut, fee, recipient: userAddress, deadline, amountIn,
          amountOutMinimum: 0, sqrtPriceLimitX96: 0
        });
        await tx.wait();
        return { success: true };
      } catch (e) { continue; }
    }
    return { success: false, error: 'No liquidity' };
  };

  const executeZap = async () => {
    const selected = [...selectedAssets].map(key => {
      const [chainKey, symbol] = key.split('-');
      return assets.find(a => a.chainKey === chainKey && a.symbol === symbol);
    }).filter(Boolean);
    
    if (selected.length === 0) return;
    
    setIsZapping(true);
    setZapProgress({ current: 0, total: selected.length, status: 'Starting...', asset: null });
    const results = [];
    
    for (let i = 0; i < selected.length; i++) {
      const asset = selected[i];
      const key = `${asset.chainKey}-${asset.symbol}`;
      const amount = zapAmounts[key] || 0;
      
      if (amount < 0.01) { results.push({ asset, success: false, error: 'Amount too small' }); continue; }
      
      setZapProgress({ current: i + 1, total: selected.length, status: `Processing ${asset.symbol}...`, asset });
      
      try {
        const result = await executeSwapWithFee(asset, amount);
        results.push({ asset, ...result });
        if (result.success) {
          const newUsdcAmount = (amount * (100 - FEE_PERCENT)) / 100;
          setBridgeReady(prev => ({ ...prev, [asset.chainKey]: (prev[asset.chainKey] || 0) + newUsdcAmount }));
        }
      } catch (e) { results.push({ asset, success: false, error: e.message }); }
    }
    
    setZapResults(results);
    setIsZapping(false);
    setSelectedAssets(new Set());
  };

  const toggleAssetSelection = (key) => {
    setSelectedAssets(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  };

  const updateZapAmount = (key, value) => {
    setZapAmounts(prev => ({ ...prev, [key]: parseFloat(value) || 0 }));
  };

  const openBridge = (chainKey) => {
    window.open(`https://swap.liberty.io/#/?chainId=369`, '_blank');
    setBridgeStatus(`Bridge opened for ${CHAIN_CONFIG[chainKey].name} USDC`);
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 2000); } catch (e) {}
  };

  const groupedAssets = assets.reduce((acc, asset) => {
    if (!acc[asset.chainKey]) acc[asset.chainKey] = [];
    acc[asset.chainKey].push(asset);
    return acc;
  }, {});

  const totalZapValue = [...selectedAssets].reduce((sum, key) => sum + (zapAmounts[key] || 0), 0);
  const totalFeeValue = totalZapValue * FEE_PERCENT / 100;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <h1 style={{ color: '#FFD700', marginBottom: '10px', fontSize: '2rem' }}>⚡ Zapper X-Chain</h1>
        <div style={{ color: '#888', fontSize: '0.9rem' }}>Consolidate dust across 7 chains → USDC → PulseChain</div>
        <div style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: '5px' }}>1% fee powers the Growth Engine 🚀</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'crosschain', label: '🌐 Cross-Chain', color: '#FFD700' },
          { id: 'bridge', label: '🌉 Bridge', color: '#4ade80' },
          { id: 'referral', label: '🎁 Referral', color: '#FF69B4' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 20px', borderRadius: '10px', border: activeTab === tab.id ? `2px solid ${tab.color}` : '1px solid #333',
            background: activeTab === tab.id ? `${tab.color}15` : 'transparent', color: activeTab === tab.id ? tab.color : '#666',
            cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
          }}>{tab.label}</button>
        ))}
      </div>

      {/* Cross-Chain Tab */}
      {activeTab === 'crosschain' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Scan Controls */}
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '20px', border: '2px solid #FFD700' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '5px' }}>
                  {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not Connected'}
                </div>
                {totalValue > 0 && <div style={{ color: '#4ade80', fontSize: '1.5rem', fontWeight: 'bold' }}>${formatNumber(totalValue)}</div>}
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* NEW: Scan Mode Selector */}
                <select value={scanMode} onChange={(e) => setScanMode(e.target.value)} disabled={isScanning} style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid #FFD700',
                  background: 'rgba(0,0,0,0.3)', color: '#FFD700', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                }}>
                  <option value="quick">⚡ Quick (~2K)</option>
                  <option value="deep">🔍 Deep (~18K)</option>
                  <option value="ultra">🚀 ULTRA (~95K+)</option>
                </select>
                
                <button onClick={() => scanAllChains()} disabled={isScanning} style={{
                  padding: '12px 25px', borderRadius: '10px', border: 'none',
                  background: isScanning ? '#666' : 'linear-gradient(90deg, #FFD700, #FFA500)',
                  color: '#000', cursor: isScanning ? 'not-allowed' : 'pointer', fontWeight: 'bold'
                }}>{isScanning ? '⏳ Scanning...' : '🔍 Scan All Chains'}</button>
                
                {/* Test Wallet Button */}
                <button onClick={() => setShowTestInput(!showTestInput)} style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid #8B5CF6',
                  background: 'transparent', color: '#8B5CF6', cursor: 'pointer', fontSize: '0.85rem'
                }} title="Test any wallet">🧪</button>
              </div>
            </div>
            
            {/* Test Wallet Input */}
            {showTestInput && (
              <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(139,92,246,0.1)', borderRadius: '10px', border: '1px solid #8B5CF6' }}>
                <div style={{ color: '#8B5CF6', fontSize: '0.85rem', marginBottom: '10px' }}>
                  🧪 Test Mode - Try: 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 (Vitalik)
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="text" value={testWalletInput} onChange={(e) => setTestWalletInput(e.target.value)} placeholder="0x..."
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #8B5CF6', background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'monospace' }} />
                  <button onClick={scanTestWallet} disabled={isScanning} style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(90deg, #8B5CF6, #6366F1)', color: '#fff', cursor: 'pointer', fontWeight: 'bold'
                  }}>Scan</button>
                </div>
              </div>
            )}
            
            {/* Scan Progress */}
            {isScanning && (
              <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(255,215,0,0.1)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#FFD700' }}>{scanProgress.chain}</span>
                  <span style={{ color: '#888' }}>{scanProgress.tokensScanned.toLocaleString()} scanned</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,215,0,0.2)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#FFD700', animation: 'pulse 1s infinite', width: '100%' }} />
                </div>
              </div>
            )}
            
            {/* Upgrade Scan Buttons */}
            {!isScanning && (deepScanAvailable || ultraScanAvailable) && (
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {deepScanAvailable && (
                  <button onClick={extendDeepScan} style={{
                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #3B82F6',
                    background: 'rgba(59,130,246,0.1)', color: '#3B82F6', cursor: 'pointer', fontSize: '0.85rem'
                  }}>🔍 Extend to Deep (~18K tokens)</button>
                )}
                {ultraScanAvailable && (
                  <button onClick={extendUltraScan} style={{
                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #8B5CF6',
                    background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', cursor: 'pointer', fontSize: '0.85rem'
                  }}>🚀 ULTRA Scan (~95K+ airdrops)</button>
                )}
              </div>
            )}
            
            {scanError && <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', color: '#f87171' }}>{scanError}</div>}
          </div>

          {/* Zap Summary */}
          {selectedAssets.size > 0 && (
            <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '20px', border: '2px solid #4ade80' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div>
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>Selected: {selectedAssets.size} tokens</div>
                  <div style={{ color: '#FFD700', fontSize: '1.3rem' }}>${formatNumber(totalZapValue)} → ${formatNumber(totalZapValue - totalFeeValue)} USDC</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>Fee: ${formatNumber(totalFeeValue)} (1%)</div>
                </div>
                <button onClick={executeZap} disabled={isZapping} style={{
                  padding: '15px 30px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                  color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem'
                }}>⚡ ZAP TO USDC</button>
              </div>
            </div>
          )}

          {/* Assets by Chain */}
          {Object.entries(groupedAssets).map(([chainKey, chainAssets]) => {
            const chain = CHAIN_CONFIG[chainKey];
            const chainTotal = chainAssets.reduce((s, a) => s + a.value, 0);
            return (
              <div key={chainKey} style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '20px', border: `2px solid ${chain.color}30` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: chain.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000', fontSize: '1.1rem' }}>{chain.symbol[0]}</div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{chain.name}</div>
                      <div style={{ color: chain.color }}>${formatNumber(chainTotal)} • {chainAssets.length} tokens</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {chainAssets.filter(a => !isUsdcToken(a.symbol)).length > 0 && <>
                      <button onClick={() => {
                        chainAssets.filter(a => !isUsdcToken(a.symbol)).forEach(a => setSelectedAssets(prev => new Set([...prev, `${a.chainKey}-${a.symbol}`])));
                      }} style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${chain.color}`, background: 'transparent', color: chain.color, cursor: 'pointer', fontSize: '0.8rem' }}>Select All</button>
                      <button onClick={() => {
                        chainAssets.forEach(a => setSelectedAssets(prev => { const n = new Set(prev); n.delete(`${a.chainKey}-${a.symbol}`); return n; }));
                      }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #666', background: 'transparent', color: '#666', cursor: 'pointer', fontSize: '0.8rem' }}>Clear</button>
                    </>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chainAssets.map(asset => {
                    const key = `${asset.chainKey}-${asset.symbol}`;
                    const isUsdc = isUsdcToken(asset.symbol);
                    const isSel = selectedAssets.has(key);
                    const zapAmt = zapAmounts[key] || 0;
                    const feeAmt = zapAmt * FEE_PERCENT / 100;
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: isSel ? 'rgba(255,215,0,0.1)' : 'rgba(0,0,0,0.2)', borderRadius: '10px', border: isSel ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent', flexWrap: 'wrap' }}>
                        {!isUsdc && <input type="checkbox" checked={isSel} onChange={() => toggleAssetSelection(key)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#FFD700' }} />}
                        <div style={{ flex: '1', minWidth: '120px' }}>
                          <div style={{ color: isUsdc ? '#4ade80' : '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {asset.symbol}
                            {asset.isNative && <span style={{ fontSize: '0.7rem', color: '#888' }}>(native)</span>}
                            {isUsdc && <span style={{ fontSize: '0.7rem', color: '#4ade80' }}>✓</span>}
                            {asset.fromIndexer && <span style={{ fontSize: '0.65rem', color: '#8B5CF6', marginLeft: '4px' }} title="Found via ULTRA indexer">📡</span>}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.8rem' }}>{asset.balance.toFixed(asset.balance < 0.01 ? 6 : 4)} • ${asset.value.toFixed(2)}</div>
                        </div>
                        {!isUsdc && isSel && <div style={{ flex: '2', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}><input type="range" min="0" max={asset.value} step={asset.value / 100} value={zapAmt} onChange={(e) => updateZapAmount(key, e.target.value)} style={{ flex: 1 }} /><div style={{ minWidth: '90px', textAlign: 'right' }}><div style={{ color: '#FFD700', fontWeight: 'bold' }}>${zapAmt.toFixed(2)}</div><div style={{ color: '#888', fontSize: '0.7rem' }}>Fee: ${feeAmt.toFixed(2)}</div></div></div>}
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
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '25px', border: '2px solid #4ade80' }}>
          <h2 style={{ color: '#4ade80', marginBottom: '20px', textAlign: 'center' }}>🌉 Bridge to PulseChain</h2>
          {bridgeStatus && <div style={{ padding: '15px', background: 'rgba(74,222,128,0.1)', borderRadius: '10px', marginBottom: '20px', color: '#4ade80', textAlign: 'center' }}>{bridgeStatus}</div>}
          {Object.keys(bridgeReady).length === 0 ? <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><div style={{ fontSize: '2rem', marginBottom: '10px' }}>💫</div><div>Zap tokens first!</div></div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(bridgeReady).map(([chainKey, amount]) => {
                const chain = CHAIN_CONFIG[chainKey];
                return (
                  <div key={chainKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: `1px solid ${chain.color}50` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><div style={{ width: '36px', height: '36px', borderRadius: '50%', background: chain.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#000' }}>{chain.symbol[0]}</div><div><div style={{ color: '#fff', fontWeight: 'bold' }}>{chain.name}</div><div style={{ color: '#4ade80', fontSize: '0.9rem' }}>${formatNumber(amount)} USDC</div></div></div>
                    <button onClick={() => openBridge(chainKey)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #4ade80, #22c55e)', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>🌉 Bridge</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>💡 Liberty Swap • PulseChain (369)</div>
        </div>
      )}

      {/* Referral Tab */}
      {activeTab === 'referral' && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '25px', border: '2px solid #FF69B4' }}>
          <h2 style={{ color: '#FF69B4', marginBottom: '20px', textAlign: 'center' }}>🎁 Referral Program</h2>
          {walletAddress ? <>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#FF69B4', fontWeight: 'bold', marginBottom: '8px' }}>🔗 Your Link</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" value={referralLink} readOnly style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #FF69B4', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.8rem' }} />
                <button onClick={() => copyToClipboard(referralLink)} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', background: copySuccess ? '#4ade80' : 'linear-gradient(90deg, #FF69B4, #FFD700)', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>{copySuccess ? '✓ Copied!' : '📋 Copy'}</button>
              </div>
            </div>
            
            {/* How It Works */}
            <div style={{ padding: '20px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', border: '1px solid rgba(255,105,180,0.2)' }}>
              <div style={{ color: '#FF69B4', fontWeight: 'bold', marginBottom: '12px', fontSize: '0.95rem' }}>💡 How Referrals Work</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', color: '#aaa', fontSize: '0.85rem', lineHeight: '1.5' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#FFD700', fontWeight: 'bold', minWidth: '20px' }}>1.</span>
                  <span>Share your unique referral link with friends</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#FFD700', fontWeight: 'bold', minWidth: '20px' }}>2.</span>
                  <span>When they zap dust using your link, you earn <span style={{ color: '#4ade80' }}>0.25%</span> of their zap value</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#FFD700', fontWeight: 'bold', minWidth: '20px' }}>3.</span>
                  <span>Rewards are paid in USDC directly to your wallet</span>
                </div>
              </div>
              <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(255,215,0,0.1)', borderRadius: '8px', color: '#FFD700', fontSize: '0.8rem', textAlign: 'center' }}>
                🚀 No limit on referrals • Earn forever on every zap
              </div>
            </div>
          </> : <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Connect wallet for referral link</div>}
        </div>
      )}

      {/* Zap Results */}
      {zapResults.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '25px', maxWidth: '400px', width: '100%', border: '2px solid #FFD700', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ color: '#FFD700', marginBottom: '15px', textAlign: 'center' }}>⚡ Zap Results</h3>
            {zapResults.map((r, i) => <div key={i} style={{ padding: '10px', borderRadius: '8px', marginBottom: '8px', background: r.success ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${r.success ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}` }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: '#fff' }}>{r.asset.symbol}</span><span style={{ color: r.success ? '#4ade80' : '#f87171', fontSize: '0.85rem' }}>{r.success ? '✅' : '❌'}</span></div></div>)}
            <div style={{ padding: '10px', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}><div style={{ color: '#4ade80', fontSize: '0.85rem' }}>💰 {FEE_PERCENT}% fee → Growth Engine</div></div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setZapResults([])} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #666', background: 'transparent', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
              {zapResults.some(r => r.success) && <button onClick={() => { setZapResults([]); setActiveTab('bridge'); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #4ade80, #22c55e)', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>🌉 Bridge</button>}
            </div>
          </div>
        </div>
      )}

      {/* Zapping Overlay */}
      {isZapping && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '30px', textAlign: 'center', border: '2px solid #FFD700', maxWidth: '350px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }} className="zap-spinner">⚡</div>
            <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px' }}>Zapping {zapProgress.current}/{zapProgress.total}</div>
            {zapProgress.asset && <div style={{ color: '#fff', marginBottom: '10px' }}>{zapProgress.asset.symbol}</div>}
            <div style={{ color: '#888', fontSize: '0.9rem' }}>{zapProgress.status}</div>
            <div style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: '10px' }}>{FEE_PERCENT}% → Growth Engine</div>
          </div>
        </div>
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #fbbf24; cursor: pointer; border: 2px solid #000; }
        @keyframes zapSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .zap-spinner { display: inline-block; animation: zapSpin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ZapperXChain;
