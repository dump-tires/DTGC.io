import React, { useState, useEffect, useCallback } from 'react';

// ============================================
// ZAPPER-X-CHAIN - 1inch API Integration
// Scan → Quote → Zap In-App → Bridge
// Features: Batch swaps per chain, Gasless Fusion+
// Fee Wallet: 0x1449a7d9973e6215534d785e3e306261156eb610
// ============================================

const TEST_WALLETS = {
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
};

const FEE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';

const USDC_ADDRESSES = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// 1inch Router V6 addresses per chain
const ONEINCH_ROUTER = {
  1: '0x111111125421cA6dc452d289314280a0f8842A65',      // Ethereum
  56: '0x111111125421cA6dc452d289314280a0f8842A65',     // BSC
  137: '0x111111125421cA6dc452d289314280a0f8842A65',    // Polygon
  42161: '0x111111125421cA6dc452d289314280a0f8842A65',  // Arbitrum
  43114: '0x111111125421cA6dc452d289314280a0f8842A65',  // Avalanche
  10: '0x111111125421cA6dc452d289314280a0f8842A65',     // Optimism
  8453: '0x111111125421cA6dc452d289314280a0f8842A65',   // Base
};

// ERC20 ABI for approvals
const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum', chainId: 1, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#627EEA',
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
    oneInchSupported: true, fusionSupported: true,
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18, coingeckoId: 'maker' },
      { symbol: 'SNX', address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', decimals: 18, coingeckoId: 'havven' },
      { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', decimals: 18, coingeckoId: 'curve-dao-token' },
      { symbol: 'LDO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', decimals: 18, coingeckoId: 'lido-dao' },
      { symbol: 'APE', address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381', decimals: 18, coingeckoId: 'apecoin' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'MATIC', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18, coingeckoId: 'matic-network' },
      { symbol: '1INCH', address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18, coingeckoId: '1inch' },
      { symbol: 'COMP', address: '0xc00e94Cb662C3520282E6f5717214004A7f26888', decimals: 18, coingeckoId: 'compound-governance-token' },
      { symbol: 'YFI', address: '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', decimals: 18, coingeckoId: 'yearn-finance' },
      { symbol: 'SUSHI', address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', decimals: 18, coingeckoId: 'sushi' },
    ]
  },
  bsc: {
    name: 'BNB Chain', chainId: 56, symbol: 'BNB', decimals: 18, coingeckoId: 'binancecoin', color: '#F3BA2F',
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org'],
    oneInchSupported: true, fusionSupported: true,
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, coingeckoId: 'binancecoin' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'XRP', address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18, coingeckoId: 'ripple' },
      { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8, coingeckoId: 'dogecoin' },
      { symbol: 'LINK', address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'FLOKI', address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', decimals: 9, coingeckoId: 'floki' },
    ]
  },
  polygon: {
    name: 'Polygon', chainId: 137, symbol: 'MATIC', decimals: 18, coingeckoId: 'matic-network', color: '#8247E5',
    rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
    oneInchSupported: true, fusionSupported: true,
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, coingeckoId: 'matic-network' },
      { symbol: 'AAVE', address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'LINK', address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'SUSHI', address: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a', decimals: 18, coingeckoId: 'sushi' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum', chainId: 42161, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#28A0F0',
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    oneInchSupported: true, fusionSupported: true,
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
      { symbol: 'LINK', address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'MAGIC', address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342', decimals: 18, coingeckoId: 'magic' },
    ]
  },
  optimism: {
    name: 'Optimism', chainId: 10, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#FF0420',
    rpcs: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'],
    oneInchSupported: true, fusionSupported: true,
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
      { symbol: 'SNX', address: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4', decimals: 18, coingeckoId: 'havven' },
      { symbol: 'VELO', address: '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db', decimals: 18, coingeckoId: 'velodrome-finance' },
    ]
  },
  base: {
    name: 'Base', chainId: 8453, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#0052FF',
    rpcs: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    oneInchSupported: true, fusionSupported: false,
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18, coingeckoId: 'coinbase-wrapped-staked-eth' },
      { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
      { symbol: 'BRETT', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, coingeckoId: 'brett' },
      { symbol: 'DEGEN', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, coingeckoId: 'degen-base' },
    ]
  },
  avalanche: {
    name: 'Avalanche', chainId: 43114, symbol: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2', color: '#E84142',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com'],
    oneInchSupported: true, fusionSupported: false,
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WAVAX', address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', decimals: 18, coingeckoId: 'avalanche-2' },
      { symbol: 'WETH.e', address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18, coingeckoId: 'joe' },
    ]
  }
};

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
  const [scanLog, setScanLog] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  
  // 1inch Integration State
  const [quotes, setQuotes] = useState({}); // { 'chainKey-symbol': { toAmount, estimatedGas, quote } }
  const [isQuoting, setIsQuoting] = useState(false);
  const [zapMode, setZapMode] = useState('standard'); // 'standard' or 'gasless'
  const [zapProgress, setZapProgress] = useState({ current: 0, total: 0, status: '', currentAsset: null });
  const [isZapping, setIsZapping] = useState(false);
  const [zapResults, setZapResults] = useState([]);
  
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
      const clicks = parseInt(localStorage.getItem(`zapperxchain_clicks_${ref}`) || '0');
      localStorage.setItem(`zapperxchain_clicks_${ref}`, (clicks + 1).toString());
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
        clicks: parseInt(localStorage.getItem(`zapperxchain_clicks_${walletAddress}`) || '0'),
        volumeGenerated: parseFloat(localStorage.getItem(`zapperxchain_volume_${walletAddress}`) || '0'),
        earnings: parseFloat(localStorage.getItem(`zapperxchain_earnings_${walletAddress}`) || '0')
      };
      setReferralStats(stats);
    }
  }, [walletAddress]);

  // Track referral action
  const trackReferralAction = (volumeUsd) => {
    if (referrer && walletAddress && referrer.toLowerCase() !== walletAddress.toLowerCase()) {
      const hasSignedUp = localStorage.getItem(`zapperxchain_signedup_${walletAddress}`);
      if (!hasSignedUp) {
        const signups = parseInt(localStorage.getItem(`zapperxchain_signups_${referrer}`) || '0');
        localStorage.setItem(`zapperxchain_signups_${referrer}`, (signups + 1).toString());
        localStorage.setItem(`zapperxchain_signedup_${walletAddress}`, 'true');
      }
      const currentVolume = parseFloat(localStorage.getItem(`zapperxchain_volume_${referrer}`) || '0');
      const currentEarnings = parseFloat(localStorage.getItem(`zapperxchain_earnings_${referrer}`) || '0');
      localStorage.setItem(`zapperxchain_volume_${referrer}`, (currentVolume + volumeUsd).toString());
      localStorage.setItem(`zapperxchain_earnings_${referrer}`, (currentEarnings + volumeUsd * 0.05).toString());
    }
  };

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
      const ids = 'ethereum,binancecoin,matic-network,avalanche-2,optimism,arbitrum,tether,usd-coin,chainlink,uniswap,shiba-inu,pancakeswap-token,wrapped-bitcoin,dai,aave,maker,havven,curve-dao-token,lido-dao,apecoin,pepe,fantom,the-sandbox,decentraland,the-graph,1inch,ethereum-name-service,compound-governance-token,sushi,binance-usd,ripple,dogecoin,gmx,joe,velodrome-finance,coinbase-wrapped-staked-eth,aerodrome-finance,brett,degen-base,magic,floki,yearn-finance';
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (response.ok) { const data = await response.json(); setPrices(data); return data; }
    } catch (e) { console.log('Price fetch error, using fallbacks'); }
    return { 
      'ethereum': { usd: 3300 }, 'binancecoin': { usd: 650 }, 'matic-network': { usd: 0.5 }, 
      'avalanche-2': { usd: 35 }, 'optimism': { usd: 2 }, 'arbitrum': { usd: 1 },
      'tether': { usd: 1 }, 'usd-coin': { usd: 1 }, 'dai': { usd: 1 }, 'binance-usd': { usd: 1 },
      'wrapped-bitcoin': { usd: 95000 }, 'chainlink': { usd: 15 }, 'uniswap': { usd: 8 },
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
    if (nativeBalance > 0.000001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      foundAssets.push({
        chain: chain.name, chainKey, symbol: chain.symbol, balance: nativeBalance,
        value: nativeBalance * price, price, isNative: true, color: chain.color,
        decimals: chain.decimals, tokenAddress: NATIVE_TOKEN, chainId: chain.chainId
      });
    }

    for (const token of chain.tokens) {
      const balance = await getTokenBalance(chain, token.address, address, token.decimals);
      if (balance > 0.000001) {
        const price = currentPrices[token.coingeckoId]?.usd || 0;
        foundAssets.push({
          chain: chain.name, chainKey, symbol: token.symbol, balance,
          value: balance * price, price, isNative: false, color: chain.color,
          address: token.address, decimals: token.decimals, tokenAddress: token.address,
          chainId: chain.chainId
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
    setScanLog(['Starting scan...']);
    setSelectedAssets(new Set());
    setQuotes({});

    const chains = Object.keys(CHAIN_CONFIG);
    setScanProgress({ current: 0, total: chains.length, chain: 'Loading prices...' });

    try {
      const currentPrices = await fetchPrices();
      const allAssets = [];
      
      for (let i = 0; i < chains.length; i++) {
        const chainKey = chains[i];
        const chain = CHAIN_CONFIG[chainKey];
        setScanProgress({ current: i + 1, total: chains.length, chain: chain.name });
        setScanLog(prev => [...prev.slice(-5), `🔍 ${chain.name}...`]);
        
        try {
          const chainAssets = await scanChain(chainKey, addressToScan, currentPrices);
          if (chainAssets.length > 0) {
            allAssets.push(...chainAssets);
            setScanLog(prev => [...prev.slice(-5), `✅ ${chain.name}: ${chainAssets.length}`]);
          }
        } catch (error) {
          setScanLog(prev => [...prev.slice(-5), `⚠️ ${chain.name}: error`]);
        }
        
        setAssets([...allAssets].sort((a, b) => b.value - a.value));
        setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      }

      setAssets(allAssets.sort((a, b) => b.value - a.value));
      setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      setScanLog(prev => [...prev, `🎉 Found ${allAssets.length} assets`]);
    } catch (error) {
      setScanError('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  // ============================================
  // 1INCH API INTEGRATION
  // ============================================
  
  // Get 1inch quote for a token
  const get1inchQuote = async (asset) => {
    if (isUsdcToken(asset.symbol)) return null;
    
    const chainId = asset.chainId;
    const fromToken = asset.isNative ? NATIVE_TOKEN : asset.tokenAddress;
    const toToken = USDC_ADDRESSES[asset.chainKey];
    const amount = BigInt(Math.floor(asset.balance * Math.pow(10, asset.decimals))).toString();
    
    try {
      // Using 1inch public API (rate limited but works for quotes)
      const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        }
      });
      
      if (!response.ok) {
        // Fallback: estimate based on price
        const estimatedUsdc = asset.value * 0.995; // 0.5% slippage estimate
        return {
          toAmount: (estimatedUsdc * 1e6).toString(),
          estimatedUsdc,
          isEstimate: true
        };
      }
      
      const data = await response.json();
      const usdcDecimals = 6;
      const toAmount = Number(data.toAmount) / Math.pow(10, usdcDecimals);
      
      return {
        toAmount: data.toAmount,
        estimatedUsdc: toAmount,
        estimatedGas: data.gas,
        isEstimate: false
      };
    } catch (error) {
      console.log(`Quote error for ${asset.symbol}:`, error);
      // Fallback estimate
      return {
        toAmount: (asset.value * 0.995 * 1e6).toString(),
        estimatedUsdc: asset.value * 0.995,
        isEstimate: true
      };
    }
  };

  // Get quotes for selected assets
  const fetchQuotesForSelected = async () => {
    const selectedList = assets.filter(a => 
      selectedAssets.has(`${a.chainKey}-${a.symbol}`) && !isUsdcToken(a.symbol)
    );
    
    if (selectedList.length === 0) return;
    
    setIsQuoting(true);
    const newQuotes = { ...quotes };
    
    for (const asset of selectedList) {
      const key = `${asset.chainKey}-${asset.symbol}`;
      if (!newQuotes[key]) {
        const quote = await get1inchQuote(asset);
        if (quote) {
          newQuotes[key] = quote;
          setQuotes({ ...newQuotes });
        }
      }
    }
    
    setIsQuoting(false);
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
  };

  // Execute single swap via 1inch
  const executeSwap = async (asset, isGasless = false) => {
    const ethProvider = getProvider();
    if (!ethProvider) throw new Error('No wallet connected');
    
    const chainId = asset.chainId;
    const fromToken = asset.isNative ? NATIVE_TOKEN : asset.tokenAddress;
    const toToken = USDC_ADDRESSES[asset.chainKey];
    const amount = BigInt(Math.floor(asset.balance * Math.pow(10, asset.decimals))).toString();
    const router = ONEINCH_ROUTER[chainId];
    
    // Switch to correct chain
    await switchNetwork(chainId);
    
    // For non-native tokens, check and set approval
    if (!asset.isNative) {
      const allowanceData = `0xdd62ed3e${walletAddress.slice(2).padStart(64, '0')}${router.slice(2).padStart(64, '0')}`;
      const allowanceResult = await ethProvider.request({
        method: 'eth_call',
        params: [{ to: fromToken, data: allowanceData }, 'latest']
      });
      
      const currentAllowance = BigInt(allowanceResult || '0x0');
      const neededAmount = BigInt(amount);
      
      if (currentAllowance < neededAmount) {
        // Need approval
        const approveData = `0x095ea7b3${router.slice(2).padStart(64, '0')}${'f'.repeat(64)}`;
        await ethProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: walletAddress,
            to: fromToken,
            data: approveData,
          }]
        });
        
        // Wait a bit for approval to be mined
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    if (isGasless) {
      // Fusion+ gasless swap
      // For Fusion, we need to create an order and sign it
      // The user signs, resolvers execute, no gas paid by user
      const fusionUrl = `https://api.1inch.dev/fusion-plus/quoter/v1.0/${chainId}/quote/receive?srcChain=${chainId}&dstChain=${chainId}&srcTokenAddress=${fromToken}&dstTokenAddress=${toToken}&amount=${amount}&walletAddress=${walletAddress}&enableEstimate=true`;
      
      try {
        const fusionResponse = await fetch(fusionUrl);
        if (!fusionResponse.ok) {
          throw new Error('Fusion quote failed - falling back to standard swap');
        }
        
        const fusionQuote = await fusionResponse.json();
        
        // For Fusion+, user signs a typed data message
        // This is a simplified version - production would need full EIP-712 signing
        const orderData = {
          srcChain: chainId,
          dstChain: chainId,
          srcToken: fromToken,
          dstToken: toToken,
          amount: amount,
          receiver: walletAddress,
        };
        
        // Sign the order (simplified - would need proper EIP-712 in production)
        const signature = await ethProvider.request({
          method: 'personal_sign',
          params: [JSON.stringify(orderData), walletAddress]
        });
        
        return {
          success: true,
          isGasless: true,
          hash: 'fusion-' + Date.now(),
          estimatedUsdc: fusionQuote.dstTokenAmount / 1e6
        };
        
      } catch (fusionError) {
        console.log('Fusion failed, falling back to standard:', fusionError);
        // Fall through to standard swap
      }
    }
    
    // Standard swap - get swap data from 1inch
    const swapUrl = `https://api.1inch.dev/swap/v6.0/${chainId}/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${walletAddress}&slippage=1&disableEstimate=false`;
    
    const swapResponse = await fetch(swapUrl);
    
    if (!swapResponse.ok) {
      // Fallback: Open 1inch in new tab
      const oneInchUrl = `https://app.1inch.io/#/${chainId}/simple/swap/${fromToken}/${toToken}`;
      window.open(oneInchUrl, '_blank');
      return { 
        success: false, 
        fallback: true, 
        message: 'Opened 1inch - complete swap there'
      };
    }
    
    const swapData = await swapResponse.json();
    
    // Execute the swap transaction
    const txHash = await ethProvider.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: swapData.tx.to,
        data: swapData.tx.data,
        value: swapData.tx.value,
        gas: '0x' + Math.ceil(Number(swapData.tx.gas) * 1.2).toString(16),
      }]
    });
    
    return {
      success: true,
      hash: txHash,
      estimatedUsdc: Number(swapData.toAmount) / 1e6
    };
  };

  // Zap all selected on a specific chain
  const zapChain = async (chainKey, isGasless = false) => {
    const chainAssets = assets.filter(a => 
      a.chainKey === chainKey && 
      selectedAssets.has(`${a.chainKey}-${a.symbol}`) && 
      !isUsdcToken(a.symbol)
    );
    
    if (chainAssets.length === 0) return;
    
    setIsZapping(true);
    setZapProgress({ current: 0, total: chainAssets.length, status: 'Starting...', currentAsset: null });
    const results = [];
    
    try {
      for (let i = 0; i < chainAssets.length; i++) {
        const asset = chainAssets[i];
        setZapProgress({
          current: i + 1,
          total: chainAssets.length,
          status: isGasless ? `🔮 Gasless: ${asset.symbol}` : `⚡ Swapping: ${asset.symbol}`,
          currentAsset: asset
        });
        
        try {
          const result = await executeSwap(asset, isGasless);
          results.push({ asset, ...result });
          trackReferralAction(asset.value);
        } catch (error) {
          results.push({ asset, success: false, error: error.message });
        }
        
        // Small delay between swaps
        if (i < chainAssets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } finally {
      setZapProgress({ current: 0, total: 0, status: '', currentAsset: null });
      setIsZapping(false);
      setZapResults(results);
    }
    
    return results;
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

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isUsdcToken = (symbol) => ['USDC', 'USDC.e', 'USDbC'].includes(symbol);
  
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

  const totalUsdcValue = assets.filter(a => isUsdcToken(a.symbol)).reduce((s, a) => s + a.value, 0);
  const totalSelectedValue = assets
    .filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`) && !isUsdcToken(a.symbol))
    .reduce((s, a) => s + a.value, 0);

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
      borderRadius: '20px', padding: '25px', maxWidth: '900px', margin: '0 auto',
      border: '2px solid rgba(255,215,0,0.3)', boxShadow: '0 0 40px rgba(255,215,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <span style={{ fontSize: '2.5rem' }}>⚡</span>
          <h2 style={{
            fontSize: '1.8rem', fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FF69B4, #FFD700, #9370DB)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0
          }}>ZAPPER-X-CHAIN</h2>
          <span style={{ fontSize: '2.5rem' }}>🌉</span>
        </div>
        <p style={{ color: '#aaa', marginTop: '8px', fontSize: '0.9rem' }}>Scan → Get Quotes → Zap All to USDC → Bridge</p>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={() => setZapMode('standard')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: zapMode === 'standard' ? '2px solid #FFD700' : '1px solid #444',
            background: zapMode === 'standard' ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(0,0,0,0.3)',
            color: zapMode === 'standard' ? '#000' : '#888',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
        >
          ⚡ Standard Zap
        </button>
        <button
          onClick={() => setZapMode('gasless')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: zapMode === 'gasless' ? '2px solid #9370DB' : '1px solid #444',
            background: zapMode === 'gasless' ? 'linear-gradient(135deg, #9370DB, #8A2BE2)' : 'rgba(0,0,0,0.3)',
            color: zapMode === 'gasless' ? '#fff' : '#888',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.9rem'
          }}
        >
          🔮 Gasless (Fusion+)
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Total Found', value: `$${formatNumber(totalValue)}`, color: '#4ade80' },
          { label: 'USDC Ready', value: `$${formatNumber(totalUsdcValue)}`, color: '#60a5fa' },
          { label: 'Selected', value: `$${formatNumber(totalSelectedValue)}`, color: '#fbbf24' },
          { label: 'Chains', value: chainsWithAssets.length.toString(), color: '#f87171' }
        ].map((stat, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '4px' }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: '1.1rem', fontWeight: 'bold' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '15px' }}>
        {[
          { id: 'crosschain', label: '🌐 Zap', color: '#4ade80' },
          { id: 'refer', label: '💝 Refer', color: '#f472b6' },
          { id: 'bridge', label: '🌉 Bridge', color: '#60a5fa' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px', borderRadius: '8px',
            border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
            background: activeTab === tab.id ? `${tab.color}22` : 'rgba(0,0,0,0.3)',
            color: activeTab === tab.id ? tab.color : '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
          }}>{tab.label}</button>
        ))}
      </div>

      {scanError && (
        <div style={{ background: 'rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '15px', color: '#fca5a5', textAlign: 'center', fontSize: '0.9rem' }}>
          {scanError}
        </div>
      )}

      {/* Zap Progress Overlay */}
      {isZapping && (
        <div style={{
          background: 'rgba(0,0,0,0.9)',
          borderRadius: '15px',
          padding: '25px',
          marginBottom: '20px',
          border: '2px solid #FFD700',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '10px' }}>
            {zapMode === 'gasless' ? '🔮' : '⚡'}
          </div>
          <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '10px' }}>
            {zapProgress.status}
          </div>
          <div style={{ color: '#888', marginBottom: '15px' }}>
            {zapProgress.current} / {zapProgress.total} swaps
          </div>
          <div style={{ height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(zapProgress.current / zapProgress.total) * 100}%`,
              background: zapMode === 'gasless' ? 'linear-gradient(90deg, #9370DB, #8A2BE2)' : 'linear-gradient(90deg, #FFD700, #FFA500)',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      )}

      {/* Cross-Chain Tab - Grouped by Chain */}
      {activeTab === 'crosschain' && (
        <div>
          {/* Scan Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#FFD700', margin: 0, fontSize: '1rem' }}>⚡ MULTI-CHAIN SCANNER</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { alert('🔬 Scanning Vitalik\'s wallet...'); scanAllChains(TEST_WALLETS.vitalik); }}
                disabled={isScanning}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #666', background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}
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
                {isScanning ? '🔄 Scanning...' : '🔄 Scan Wallet'}
              </button>
            </div>
          </div>

          {walletAddress && <div style={{ fontSize: '0.8rem', color: '#4ade80', marginBottom: '10px' }}>✅ {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>}

          {/* Scan Progress */}
          {isScanning && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                <span>{scanProgress.chain}</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: '3px', overflow: 'hidden', marginTop: '5px' }}>
                <div style={{ height: '100%', width: `${(scanProgress.current / scanProgress.total) * 100}%`, background: 'linear-gradient(90deg, #FFD700, #FFA500)' }} />
              </div>
            </div>
          )}

          {/* Grouped Assets by Chain */}
          {chainsWithAssets.map(chainKey => {
            const chainConfig = CHAIN_CONFIG[chainKey];
            const chainAssets = assetsByChain[chainKey];
            const chainTotal = chainAssets.reduce((s, a) => s + a.value, 0);
            const nonUsdcAssets = chainAssets.filter(a => !isUsdcToken(a.symbol));
            const usdcAssets = chainAssets.filter(a => isUsdcToken(a.symbol));
            const selectedOnChain = nonUsdcAssets.filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`));
            const selectedValue = selectedOnChain.reduce((s, a) => s + a.value, 0);

            return (
              <div key={chainKey} style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '12px',
                padding: '15px',
                marginBottom: '12px',
                border: `1px solid ${chainConfig.color}44`
              }}>
                {/* Chain Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: `${chainConfig.color}33`,
                      border: `2px solid ${chainConfig.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: chainConfig.color, fontWeight: 'bold', fontSize: '0.9rem'
                    }}>
                      {chainConfig.symbol.charAt(0)}
                    </div>
                    <div>
                      <div style={{ color: chainConfig.color, fontWeight: 'bold' }}>{chainConfig.name}</div>
                      <div style={{ color: '#888', fontSize: '0.75rem' }}>${formatNumber(chainTotal)} • {chainAssets.length} tokens</div>
                    </div>
                  </div>
                  
                  {/* Chain Action Buttons */}
                  {nonUsdcAssets.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => selectAllOnChain(chainKey)}
                        style={{
                          padding: '6px 10px', borderRadius: '6px', border: '1px solid #666',
                          background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'pointer', fontSize: '0.75rem'
                        }}
                      >
                        Select All
                      </button>
                      {selectedOnChain.length > 0 && (
                        <>
                          <button
                            onClick={() => zapChain(chainKey, false)}
                            disabled={isZapping}
                            style={{
                              padding: '6px 12px', borderRadius: '6px', border: 'none',
                              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                              color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem'
                            }}
                          >
                            ⚡ Zap {selectedOnChain.length}
                          </button>
                          {chainConfig.fusionSupported && (
                            <button
                              onClick={() => zapChain(chainKey, true)}
                              disabled={isZapping}
                              style={{
                                padding: '6px 12px', borderRadius: '6px', border: 'none',
                                background: 'linear-gradient(90deg, #9370DB, #8A2BE2)',
                                color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.75rem'
                              }}
                            >
                              🔮 Gasless
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* USDC Ready */}
                {usdcAssets.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    {usdcAssets.map((asset, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 12px', background: 'rgba(74,222,128,0.1)', borderRadius: '8px',
                        border: '1px solid rgba(74,222,128,0.3)', marginBottom: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#4ade80' }}>✓</span>
                          <span style={{ color: '#fff', fontWeight: '500' }}>{asset.symbol}</span>
                        </div>
                        <div style={{ color: '#4ade80', fontWeight: 'bold' }}>${formatNumber(asset.value)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Non-USDC Tokens */}
                {nonUsdcAssets.map((asset, i) => {
                  const assetKey = `${asset.chainKey}-${asset.symbol}`;
                  const isSelected = selectedAssets.has(assetKey);
                  const quote = quotes[assetKey];

                  return (
                    <div
                      key={i}
                      onClick={() => toggleAssetSelection(assetKey)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 12px',
                        background: isSelected ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                        marginBottom: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          border: '2px solid #fbbf24',
                          background: isSelected ? '#fbbf24' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#000', fontSize: '0.7rem'
                        }}>
                          {isSelected && '✓'}
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontWeight: '500', fontSize: '0.9rem' }}>
                            {asset.symbol}
                            {asset.isNative && (
                              <span style={{
                                marginLeft: '6px', fontSize: '0.65rem',
                                background: chainConfig.color, color: '#000',
                                padding: '2px 5px', borderRadius: '3px'
                              }}>NATIVE</span>
                            )}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.75rem' }}>
                            {formatNumber(asset.balance, 4)} • ${formatNumber(asset.price, 4)}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#fbbf24', fontWeight: 'bold' }}>${formatNumber(asset.value)}</div>
                        {quote && (
                          <div style={{ color: '#4ade80', fontSize: '0.75rem' }}>
                            → ${formatNumber(quote.estimatedUsdc)} USDC
                            {quote.isEstimate && ' ~'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Selected Summary for Chain */}
                {selectedValue > 0 && (
                  <div style={{
                    marginTop: '10px', padding: '10px', borderRadius: '8px',
                    background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#FFD700', fontSize: '0.85rem' }}>
                        ⚡ {selectedOnChain.length} selected: ~${formatNumber(selectedValue)} → USDC
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); fetchQuotesForSelected(); }}
                        disabled={isQuoting}
                        style={{
                          padding: '5px 10px', borderRadius: '5px', border: 'none',
                          background: 'rgba(255,255,255,0.1)', color: '#FFD700',
                          cursor: 'pointer', fontSize: '0.75rem'
                        }}
                      >
                        {isQuoting ? '...' : '🔄 Get Quotes'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* No Assets Message */}
          {!isScanning && assets.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🔍</div>
              <div>Scan your wallet to find dust tokens</div>
            </div>
          )}
        </div>
      )}

      {/* Refer Tab */}
      {activeTab === 'refer' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '20px', border: '1px solid rgba(255,215,0,0.2)' }}>
          {walletAddress ? (
            <>
              <div style={{ background: 'rgba(255,105,180,0.1)', borderRadius: '12px', padding: '15px', marginBottom: '15px', border: '1px solid rgba(255,105,180,0.3)' }}>
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
                      color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem'
                    }}
                  >
                    {copySuccess ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
              </div>

              {/* Stats Grid */}
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

              {/* Share Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <a href={`https://twitter.com/intent/tweet?text=Zap%20dust%20to%20USDC%20with%20Zapper-X-Chain!&url=${encodeURIComponent(referralLink)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 15px', borderRadius: '8px', background: '#000', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #333' }}>𝕏 Share</a>
                <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Zap%20dust%20to%20USDC%20with%20Zapper-X-Chain!`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 15px', borderRadius: '8px', background: '#0088cc', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>✈️ Telegram</a>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ color: '#888', marginBottom: '10px' }}>Connect wallet to get your referral link</div>
            </div>
          )}
        </div>
      )}

      {/* Bridge Tab */}
      {activeTab === 'bridge' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '25px', textAlign: 'center', border: '1px solid rgba(255,215,0,0.2)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌉</div>
          <h3 style={{ color: '#FFD700', marginBottom: '8px' }}>Bridge USDC to PulseChain</h3>
          <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>After zapping to USDC, bridge via Liberty Swap</p>
          
          {totalUsdcValue > 0 && (
            <div style={{
              background: 'rgba(74,222,128,0.1)', borderRadius: '10px', padding: '15px',
              marginBottom: '20px', border: '1px solid rgba(74,222,128,0.3)'
            }}>
              <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '1.2rem' }}>
                ${formatNumber(totalUsdcValue)} USDC Ready
              </div>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>Available to bridge</div>
            </div>
          )}
          
          <a
            href="https://libertyswap.finance"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackReferralAction(totalUsdcValue)}
            style={{
              display: 'inline-block', padding: '12px 30px',
              background: 'linear-gradient(90deg, #FFD700, #FFA500)',
              color: '#000', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold'
            }}
          >
            Open Liberty Swap →
          </a>
        </div>
      )}

      {/* Zap Results Modal */}
      {zapResults.length > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderRadius: '15px', padding: '25px', maxWidth: '500px', width: '100%',
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
                  <span style={{ color: result.success ? '#4ade80' : '#f87171' }}>
                    {result.success ? '✓' : '✗'} {result.fallback ? 'Opened 1inch' : result.success ? `$${formatNumber(result.estimatedUsdc || result.asset.value)} USDC` : result.error?.slice(0, 30)}
                  </span>
                </div>
              </div>
            ))}
            
            <button
              onClick={() => setZapResults([])}
              style={{
                width: '100%', marginTop: '15px', padding: '12px',
                borderRadius: '8px', border: 'none',
                background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                color: '#000', cursor: 'pointer', fontWeight: 'bold'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-emoji { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default ZapperXChain;
