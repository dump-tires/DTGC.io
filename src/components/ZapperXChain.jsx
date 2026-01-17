import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ============================================
// ZAPPER-X-CHAIN - Full In-App Experience
// Adjustable amounts, Direct DEX swaps, Liberty Bridge
// Fee Wallet: 0x1449a7d9973e6215534d785e3e306261156eb610
// ============================================

const FEE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';
const DEFAULT_GAS_RESERVE_PERCENT = 15;

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
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
    ]
  },
  bsc: {
    name: 'BNB Chain', chainId: 56, symbol: 'BNB', decimals: 18, coingeckoId: 'binancecoin', color: '#F3BA2F',
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org'],
    tokens: [
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
    tokens: [
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
    tokens: [
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
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
    ]
  },
  base: {
    name: 'Base', chainId: 8453, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#0052FF',
    rpcs: ['https://base.llamarpc.com', 'https://base.publicnode.com'],
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
    ]
  },
  avalanche: {
    name: 'Avalanche', chainId: 43114, symbol: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2', color: '#E84142',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com'],
    tokens: [
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

const BALANCE_OF_SELECTOR = '0x70a08231';

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
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '' });
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  
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

  // Scan chain
  const scanChain = async (chainKey, address, currentPrices) => {
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

    for (const token of chain.tokens) {
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
    return foundAssets;
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
    setScanProgress({ current: 0, total: chains.length, chain: 'Loading prices...' });

    try {
      const currentPrices = await fetchPrices();
      const allAssets = [];
      const newZapAmounts = {};
      
      for (let i = 0; i < chains.length; i++) {
        const chainKey = chains[i];
        const chain = CHAIN_CONFIG[chainKey];
        setScanProgress({ current: i + 1, total: chains.length, chain: chain.name });
        
        try {
          const chainAssets = await scanChain(chainKey, addressToScan, currentPrices);
          for (const asset of chainAssets) {
            allAssets.push(asset);
            const key = `${asset.chainKey}-${asset.symbol}`;
            // Default: swap full value for tokens, 85% for native (keep 15% gas)
            newZapAmounts[key] = asset.isNative 
              ? Math.max(0, asset.value * 0.85) 
              : asset.value;
          }
        } catch (error) {
          console.log(`Error scanning ${chain.name}:`, error);
        }
        
        setAssets([...allAssets].sort((a, b) => b.value - a.value));
        setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      }

      setAssets(allAssets.sort((a, b) => b.value - a.value));
      setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      setZapAmounts(newZapAmounts);
      
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
    // Wait for network switch
    await new Promise(r => setTimeout(r, 1000));
  };

  // Execute single swap
  const executeSwap = async (asset, dollarAmount) => {
    const ethProvider = getProvider();
    if (!ethProvider) throw new Error('No wallet connected');
    
    // Calculate token amount from dollar amount
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
    
    // For native token, wrap first then swap
    if (asset.isNative) {
      const wrappedAddress = WRAPPED_NATIVE[chainKey];
      
      // Wrap native token
      setZapProgress(prev => ({ ...prev, status: `Wrapping ${asset.symbol}...` }));
      const wethContract = new ethers.Contract(wrappedAddress, WETH_ABI, signer);
      const wrapTx = await wethContract.deposit({ value: amountWei });
      await wrapTx.wait();
      
      // Now swap WETH to USDC
      return await swapTokenToUsdc(signer, wrappedAddress, usdcAddress, amountWei, routerAddress, chainKey);
    } else {
      // ERC20 token - approve then swap
      return await swapTokenToUsdc(signer, asset.address, usdcAddress, amountWei, routerAddress, chainKey);
    }
  };

  // Swap token to USDC via DEX
  const swapTokenToUsdc = async (signer, tokenIn, tokenOut, amountIn, routerAddress, chainKey) => {
    // Check and set approval
    setZapProgress(prev => ({ ...prev, status: 'Checking approval...' }));
    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const currentAllowance = await tokenContract.allowance(await signer.getAddress(), routerAddress);
    
    if (currentAllowance < amountIn) {
      setZapProgress(prev => ({ ...prev, status: 'Approving token...' }));
      const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
      await approveTx.wait();
    }
    
    // Execute swap
    setZapProgress(prev => ({ ...prev, status: 'Swapping to USDC...' }));
    const router = new ethers.Contract(routerAddress, SWAP_ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 min
    
    try {
      // Try exactInputSingle (Uniswap V3 style)
      const params = {
        tokenIn,
        tokenOut,
        fee: 3000, // 0.3% fee tier
        recipient: await signer.getAddress(),
        deadline,
        amountIn,
        amountOutMinimum: 0, // Accept any amount (slippage handled by user)
        sqrtPriceLimitX96: 0
      };
      
      const tx = await router.exactInputSingle(params);
      const receipt = await tx.wait();
      return { success: true, hash: receipt.hash };
    } catch (e) {
      // If V3 fails, try with path encoding
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
        
        // Small delay between swaps
        if (i < chainAssets.length - 1) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } finally {
      setZapProgress({ current: 0, total: 0, status: '', asset: null });
      setIsZapping(false);
      setZapResults(results);
      
      // Update bridge ready status
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        setBridgeReady(prev => ({
          ...prev,
          [chainKey]: (prev[chainKey] || 0) + results.filter(r => r.success).reduce((s, r) => s + (zapAmounts[`${r.asset.chainKey}-${r.asset.symbol}`] || 0), 0)
        }));
      }
    }
  };

  // Update zap amount for an asset
  const updateZapAmount = (assetKey, value) => {
    const numValue = parseFloat(value) || 0;
    setZapAmounts(prev => ({ ...prev, [assetKey]: numValue }));
  };

  // Toggle selection
  const toggleAssetSelection = (assetKey) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetKey)) newSet.delete(assetKey);
      else newSet.add(assetKey);
      return newSet;
    });
  };

  // Select all on a chain
  const selectAllOnChain = (chainKey) => {
    const chainAssets = assets.filter(a => a.chainKey === chainKey && !isUsdcToken(a.symbol));
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      chainAssets.forEach(a => newSet.add(`${a.chainKey}-${a.symbol}`));
      return newSet;
    });
  };

  // Open Liberty Swap for bridging
  const openBridge = (chainKey) => {
    const usdcAmount = bridgeReady[chainKey] || 0;
    // Liberty Swap URL with pre-filled params if possible
    const url = `https://app.libertyswap.finance/?fromChain=${CHAIN_CONFIG[chainKey].chainId}&toChain=369&token=USDC&amount=${usdcAmount.toFixed(2)}`;
    window.open(url, '_blank');
    setBridgeStatus(`🌉 Bridge ${usdcAmount.toFixed(2)} USDC from ${CHAIN_CONFIG[chainKey].name} → Opening Liberty Swap...`);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isUsdcToken = (symbol) => ['USDC', 'USDC.e', 'USDbC', 'USDT', 'DAI', 'BUSD'].includes(symbol);
  
  // Group assets by chain
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

  const totalSelectedValue = assets
    .filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`) && !isUsdcToken(a.symbol))
    .reduce((s, a) => s + (zapAmounts[`${a.chainKey}-${a.symbol}`] || 0), 0);

  const totalBridgeReady = Object.values(bridgeReady).reduce((s, v) => s + v, 0);

  const formatNumber = (num, decimals = 2) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    if (num < 0.01 && num > 0) return num.toFixed(6);
    return num.toFixed(decimals);
  };

  const referralLink = walletAddress ? `${window.location.origin}/zapperxchain?ref=${walletAddress}` : '';

  // ============================================
  // RENDER
  // ============================================
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,20,40,0.95) 0%, rgba(20,10,30,0.98) 100%)',
      borderRadius: '20px', padding: '20px', maxWidth: '900px', margin: '0 auto',
      border: '2px solid rgba(255,215,0,0.3)', boxShadow: '0 0 40px rgba(255,215,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <span style={{ fontSize: '2rem' }}>⚡</span>
          <h2 style={{
            fontSize: '1.5rem', fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FF69B4, #FFD700, #9370DB)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0
          }}>ZAPPER-X-CHAIN</h2>
          <span style={{ fontSize: '2rem' }}>🌉</span>
        </div>
        <p style={{ color: '#888', marginTop: '5px', fontSize: '0.85rem' }}>Scan → Adjust → Zap to USDC → Bridge to PulseChain</p>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' }}>
        {[
          { label: 'Total Found', value: `$${formatNumber(totalValue)}`, color: '#4ade80' },
          { label: 'To Zap', value: `$${formatNumber(totalSelectedValue)}`, color: '#fbbf24' },
          { label: 'Bridge Ready', value: `$${formatNumber(totalBridgeReady)}`, color: totalBridgeReady > 0 ? '#4ade80' : '#888', icon: totalBridgeReady > 0 ? '✅' : '' },
          { label: 'Chains', value: chainsWithAssets.length.toString(), color: '#f87171' }
        ].map((stat, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#888', fontSize: '0.7rem', marginBottom: '2px' }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: '1rem', fontWeight: 'bold' }}>{stat.icon} {stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
        {[
          { id: 'crosschain', label: '⚡ Zap', color: '#4ade80' },
          { id: 'bridge', label: '🌉 Bridge', color: '#60a5fa', badge: totalBridgeReady > 0 },
          { id: 'refer', label: '💝 Refer', color: '#f472b6' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px', borderRadius: '8px', position: 'relative',
            border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
            background: activeTab === tab.id ? `${tab.color}22` : 'rgba(0,0,0,0.3)',
            color: activeTab === tab.id ? tab.color : '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
          }}>
            {tab.label}
            {tab.badge && (
              <span style={{
                position: 'absolute', top: '-5px', right: '-5px',
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#4ade80', border: '2px solid #1a1a2e'
              }} />
            )}
          </button>
        ))}
      </div>

      {scanError && (
        <div style={{ background: 'rgba(239,68,68,0.2)', borderRadius: '8px', padding: '10px', marginBottom: '10px', color: '#fca5a5', textAlign: 'center', fontSize: '0.85rem' }}>
          {scanError}
        </div>
      )}

      {/* Zap Progress Overlay */}
      {isZapping && (
        <div style={{
          background: 'rgba(0,0,0,0.8)',
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '15px',
          border: '2px solid #FFD700',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>⚡</div>
          <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '5px' }}>
            {zapProgress.status}
          </div>
          <div style={{ color: '#888', marginBottom: '10px', fontSize: '0.85rem' }}>
            {zapProgress.current} / {zapProgress.total} swaps
          </div>
          <div style={{ height: '6px', background: 'rgba(0,0,0,0.5)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(zapProgress.current / zapProgress.total) * 100}%`,
              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      {/* ZAP TAB */}
      {activeTab === 'crosschain' && (
        <div>
          {/* Scan Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.8rem', color: walletAddress ? '#4ade80' : '#888' }}>
              {walletAddress ? `✅ ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect wallet to scan'}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { 
                  alert('🔬 Scanning Vitalik\'s wallet (0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045)...\n\nThis is a demo to show how the scanner works!'); 
                  scanAllChains('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); 
                }}
                disabled={isScanning}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid #666',
                  background: 'rgba(0,0,0,0.5)', color: '#888', cursor: isScanning ? 'wait' : 'pointer', fontSize: '0.8rem'
                }}
              >
                🧪 Test Vitalik
              </button>
              <button
                onClick={() => scanAllChains()}
                disabled={isScanning}
                style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none',
                  background: isScanning ? 'rgba(255,215,0,0.3)' : 'linear-gradient(90deg, #FFD700, #FFA500)',
                  color: isScanning ? '#FFD700' : '#000', cursor: isScanning ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                }}
              >
                {isScanning ? '🔄 Scanning...' : '🔄 Scan All Chains'}
              </button>
            </div>
          </div>

          {/* Scan Progress */}
          {isScanning && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#888' }}>
                <span>{scanProgress.chain}</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{ height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', marginTop: '4px' }}>
                <div style={{ height: '100%', width: `${(scanProgress.current / scanProgress.total) * 100}%`, background: 'linear-gradient(90deg, #FFD700, #FFA500)', borderRadius: '2px' }} />
              </div>
            </div>
          )}

          {/* Grouped Assets by Chain */}
          {chainsWithAssets.map(chainKey => {
            const chainConfig = CHAIN_CONFIG[chainKey];
            const chainAssets = assetsByChain[chainKey];
            const chainTotal = chainAssets.reduce((s, a) => s + a.value, 0);
            const nonStableAssets = chainAssets.filter(a => !isUsdcToken(a.symbol));
            const stableAssets = chainAssets.filter(a => isUsdcToken(a.symbol));
            const selectedOnChain = nonStableAssets.filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`));
            const chainBridgeReady = bridgeReady[chainKey] || 0;

            return (
              <div key={chainKey} style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '10px',
                border: `1px solid ${chainConfig.color}44`
              }}>
                {/* Chain Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: `${chainConfig.color}33`,
                      border: `2px solid ${chainConfig.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: chainConfig.color, fontWeight: 'bold', fontSize: '0.8rem'
                    }}>
                      {chainConfig.symbol.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color: chainConfig.color, fontWeight: 'bold', fontSize: '0.9rem' }}>{chainConfig.name}</div>
                      <div style={{ color: '#888', fontSize: '0.7rem' }}>${formatNumber(chainTotal)}</div>
                    </div>
                    {chainBridgeReady > 0 && (
                      <div style={{
                        background: 'rgba(74,222,128,0.2)',
                        border: '1px solid #4ade80',
                        borderRadius: '12px',
                        padding: '2px 8px',
                        fontSize: '0.7rem',
                        color: '#4ade80',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        ✅ ${formatNumber(chainBridgeReady)} ready
                      </div>
                    )}
                  </div>
                  
                  {/* Chain Actions */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {nonStableAssets.length > 0 && (
                      <button
                        onClick={() => selectAllOnChain(chainKey)}
                        style={{
                          padding: '4px 8px', borderRadius: '5px', border: '1px solid #666',
                          background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'pointer', fontSize: '0.7rem'
                        }}
                      >
                        Select All
                      </button>
                    )}
                    {selectedOnChain.length > 0 && (
                      <button
                        onClick={() => zapChain(chainKey)}
                        disabled={isZapping}
                        style={{
                          padding: '4px 10px', borderRadius: '5px', border: 'none',
                          background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                          color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem'
                        }}
                      >
                        ⚡ Zap {selectedOnChain.length} → USDC
                      </button>
                    )}
                    {chainBridgeReady > 0 && (
                      <button
                        onClick={() => openBridge(chainKey)}
                        style={{
                          padding: '4px 10px', borderRadius: '5px', border: 'none',
                          background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                          color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.7rem'
                        }}
                      >
                        🌉 Bridge
                      </button>
                    )}
                  </div>
                </div>

                {/* Stables Ready */}
                {stableAssets.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    {stableAssets.map((asset, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 10px', background: 'rgba(74,222,128,0.1)', borderRadius: '6px',
                        border: '1px solid rgba(74,222,128,0.3)', marginBottom: '4px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#4ade80', fontSize: '0.9rem' }}>✅</span>
                          <span style={{ color: '#fff', fontWeight: '500', fontSize: '0.85rem' }}>{asset.symbol}</span>
                          <span style={{ color: '#4ade80', fontSize: '0.7rem' }}>Ready to bridge!</span>
                        </div>
                        <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '0.9rem' }}>${formatNumber(asset.value)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Non-Stable Tokens with Adjustable Amounts */}
                {nonStableAssets.map((asset, i) => {
                  const assetKey = `${asset.chainKey}-${asset.symbol}`;
                  const isSelected = selectedAssets.has(assetKey);
                  const zapAmount = zapAmounts[assetKey] || 0;
                  const maxAmount = asset.value;
                  const percentOfMax = maxAmount > 0 ? (zapAmount / maxAmount) * 100 : 0;

                  return (
                    <div
                      key={i}
                      style={{
                        background: isSelected ? 'rgba(251,191,36,0.1)' : 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '6px',
                        padding: '10px',
                      }}
                    >
                      {/* Token Row */}
                      <div 
                        onClick={() => toggleAssetSelection(assetKey)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '4px',
                            border: '2px solid #fbbf24',
                            background: isSelected ? '#fbbf24' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#000', fontSize: '0.6rem'
                          }}>
                            {isSelected && '✓'}
                          </div>
                          <div>
                            <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.85rem' }}>
                              {asset.symbol}
                              {asset.isNative && (
                                <span style={{
                                  marginLeft: '5px', fontSize: '0.6rem',
                                  background: '#fbbf24', color: '#000',
                                  padding: '1px 4px', borderRadius: '3px'
                                }}>GAS</span>
                              )}
                            </div>
                            <div style={{ color: '#888', fontSize: '0.7rem' }}>
                              {formatNumber(asset.balance, 4)} @ ${formatNumber(asset.price, 4)}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#fbbf24', fontWeight: 'bold', fontSize: '0.9rem' }}>${formatNumber(maxAmount)}</div>
                        </div>
                      </div>

                      {/* Amount Adjuster (shown when selected) */}
                      {isSelected && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ color: '#888', fontSize: '0.75rem' }}>Amount to zap:</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                ${formatNumber(zapAmount)}
                              </span>
                              <span style={{ color: '#888', fontSize: '0.7rem' }}>
                                ({percentOfMax.toFixed(0)}%)
                              </span>
                            </div>
                          </div>
                          
                          {/* Slider */}
                          <input
                            type="range"
                            min="0"
                            max={maxAmount}
                            step={maxAmount / 100}
                            value={zapAmount}
                            onChange={(e) => updateZapAmount(assetKey, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%',
                              height: '6px',
                              borderRadius: '3px',
                              background: `linear-gradient(to right, #fbbf24 0%, #fbbf24 ${percentOfMax}%, rgba(255,255,255,0.1) ${percentOfMax}%, rgba(255,255,255,0.1) 100%)`,
                              cursor: 'pointer',
                              WebkitAppearance: 'none',
                            }}
                          />
                          
                          {/* Quick buttons */}
                          <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                            {[25, 50, 75, 100].map(pct => (
                              <button
                                key={pct}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newAmount = asset.isNative && pct === 100 
                                    ? maxAmount * 0.85  // Keep 15% for gas
                                    : maxAmount * (pct / 100);
                                  updateZapAmount(assetKey, newAmount);
                                }}
                                style={{
                                  flex: 1, padding: '4px', borderRadius: '4px',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  background: 'rgba(0,0,0,0.3)',
                                  color: '#888', cursor: 'pointer', fontSize: '0.7rem'
                                }}
                              >
                                {asset.isNative && pct === 100 ? '85%' : `${pct}%`}
                              </button>
                            ))}
                          </div>
                          
                          {asset.isNative && (
                            <div style={{ color: '#fbbf24', fontSize: '0.7rem', marginTop: '6px', textAlign: 'center' }}>
                              ⛽ Keep some {asset.symbol} for gas fees
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* No Assets */}
          {!isScanning && assets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
              <div>Scan your wallet to find tokens across 7 chains</div>
            </div>
          )}
        </div>
      )}

      {/* BRIDGE TAB */}
      {activeTab === 'bridge' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,215,0,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌉</div>
            <h3 style={{ color: '#FFD700', marginBottom: '5px' }}>Bridge to PulseChain</h3>
            <p style={{ color: '#888', fontSize: '0.85rem' }}>Send your stablecoins to PulseChain via Liberty Swap</p>
          </div>

          {totalBridgeReady > 0 ? (
            <>
              <div style={{
                background: 'rgba(74,222,128,0.1)',
                border: '2px solid #4ade80',
                borderRadius: '12px',
                padding: '15px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <div style={{ color: '#4ade80', fontSize: '0.85rem', marginBottom: '5px' }}>Total Ready to Bridge</div>
                <div style={{ color: '#4ade80', fontSize: '1.8rem', fontWeight: 'bold' }}>
                  ✅ ${formatNumber(totalBridgeReady)}
                </div>
              </div>

              {/* Per-chain bridge buttons */}
              {Object.entries(bridgeReady).filter(([_, v]) => v > 0).map(([chainKey, amount]) => (
                <div key={chainKey} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '8px',
                  border: `1px solid ${CHAIN_CONFIG[chainKey]?.color}44`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: `${CHAIN_CONFIG[chainKey]?.color}33`,
                      border: `2px solid ${CHAIN_CONFIG[chainKey]?.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: CHAIN_CONFIG[chainKey]?.color, fontWeight: 'bold'
                    }}>
                      {CHAIN_CONFIG[chainKey]?.symbol?.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{CHAIN_CONFIG[chainKey]?.name}</div>
                      <div style={{ color: '#4ade80', fontSize: '0.85rem' }}>${formatNumber(amount)} USDC</div>
                    </div>
                  </div>
                  <button
                    onClick={() => openBridge(chainKey)}
                    style={{
                      padding: '10px 20px', borderRadius: '8px', border: 'none',
                      background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                      color: '#000', cursor: 'pointer', fontWeight: 'bold'
                    }}
                  >
                    🌉 Bridge → PulseChain
                  </button>
                </div>
              ))}

              <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(96,165,250,0.1)', borderRadius: '8px', border: '1px solid rgba(96,165,250,0.3)' }}>
                <div style={{ color: '#60a5fa', fontSize: '0.85rem' }}>
                  <strong>ℹ️ How it works:</strong>
                  <ol style={{ margin: '8px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>Click "Bridge → PulseChain" for each chain</li>
                    <li>Liberty Swap will open with your USDC amount</li>
                    <li>Confirm the bridge transaction</li>
                    <li>Receive USDC on PulseChain in ~5-15 minutes</li>
                  </ol>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '10px' }}>📦</div>
              <div>No stablecoins ready to bridge yet.</div>
              <div style={{ marginTop: '5px', fontSize: '0.85rem' }}>Zap your tokens to USDC first!</div>
              <button
                onClick={() => setActiveTab('crosschain')}
                style={{
                  marginTop: '15px', padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                  color: '#000', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                ⚡ Go to Zap
              </button>
            </div>
          )}

          {bridgeStatus && (
            <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', textAlign: 'center', color: '#4ade80' }}>
              {bridgeStatus}
            </div>
          )}
        </div>
      )}

      {/* REFER TAB */}
      {activeTab === 'refer' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,215,0,0.2)' }}>
          {walletAddress ? (
            <>
              <div style={{ background: 'rgba(255,105,180,0.1)', borderRadius: '10px', padding: '15px', marginBottom: '15px', border: '1px solid rgba(255,105,180,0.3)' }}>
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
      `}</style>
    </div>
  );
};

export default ZapperXChain;
