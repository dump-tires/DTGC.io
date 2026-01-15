import React, { useState, useEffect } from 'react';

// ============================================
// DAPPER FLEX V6 - Multi-Chain Scanner + Bridge
// Direct fetch RPC + Liberty Swap integration
// ============================================

// Known test wallets for debugging (whales with confirmed balances)
const TEST_WALLETS = {
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik - has ETH on multiple chains
  binance: '0xF977814e90dA44bFA03b6295A0616a897441aceC', // Binance hot wallet
};

// Chain configurations with more tokens
const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcs: [
      'https://eth.llamarpc.com',
      'https://ethereum.publicnode.com',
      'https://1rpc.io/eth',
      'https://cloudflare-eth.com'
    ],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#627EEA',
    libertyChainId: 'ethereum',
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'MATIC', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18, coingeckoId: 'matic-network' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' },
    ]
  },
  bsc: {
    name: 'BNB Chain',
    chainId: 56,
    rpcs: [
      'https://bsc-dataseed.binance.org',
      'https://bsc-dataseed1.binance.org',
      'https://bsc-dataseed2.binance.org',
      'https://bsc-dataseed3.binance.org'
    ],
    symbol: 'BNB',
    decimals: 18,
    coingeckoId: 'binancecoin',
    color: '#F3BA2F',
    libertyChainId: 'bsc',
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, coingeckoId: 'wbnb' },
      { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'XRP', address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18, coingeckoId: 'ripple' },
      { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8, coingeckoId: 'dogecoin' },
    ]
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcs: [
      'https://polygon-rpc.com',
      'https://polygon.llamarpc.com',
      'https://1rpc.io/matic',
      'https://polygon-bor-rpc.publicnode.com'
    ],
    symbol: 'MATIC',
    decimals: 18,
    coingeckoId: 'matic-network',
    color: '#8247E5',
    libertyChainId: 'polygon',
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, coingeckoId: 'wmatic' },
      { symbol: 'LINK', address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18, coingeckoId: 'chainlink' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://1rpc.io/arb',
      'https://arbitrum-one-rpc.publicnode.com'
    ],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#28A0F0',
    libertyChainId: 'arbitrum',
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
    ]
  },
  avalanche: {
    name: 'Avalanche',
    chainId: 43114,
    rpcs: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche.public-rpc.com',
      'https://1rpc.io/avax/c',
      'https://avalanche-c-chain-rpc.publicnode.com'
    ],
    symbol: 'AVAX',
    decimals: 18,
    coingeckoId: 'avalanche-2',
    color: '#E84142',
    libertyChainId: 'avalanche',
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WAVAX', address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', decimals: 18, coingeckoId: 'wrapped-avax' },
    ]
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcs: [
      'https://mainnet.optimism.io',
      'https://optimism.llamarpc.com',
      'https://1rpc.io/op',
      'https://optimism-rpc.publicnode.com'
    ],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#FF0420',
    libertyChainId: 'optimism',
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
      { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, coingeckoId: 'weth' },
    ]
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcs: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://1rpc.io/base',
      'https://base-rpc.publicnode.com'
    ],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#0052FF',
    libertyChainId: 'base',
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, coingeckoId: 'dai' },
    ]
  }
};

// Direct JSON-RPC call with timeout
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

// Try multiple RPCs
const tryRpcs = async (rpcs, method, params) => {
  for (const rpc of rpcs) {
    try {
      return await rpcCall(rpc, method, params);
    } catch (e) {
      continue;
    }
  }
  throw new Error('All RPCs failed');
};

const BALANCE_OF_SELECTOR = '0x70a08231';

const DapperFlexV6 = ({ connectedAddress: propAddress }) => {
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '' });
  const [minValue, setMinValue] = useState(0); // Default to ALL to catch dust
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanLog, setScanLog] = useState([]);
  const [debugMode, setDebugMode] = useState(false);

  // Detect wallet
  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) {
        setWalletAddress(propAddress);
        return;
      }
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts?.[0]) setWalletAddress(accounts[0]);
        } catch (e) {}
      }
    };
    detectWallet();
  }, [propAddress]);

  // Fetch prices
  const fetchPrices = async () => {
    try {
      const ids = new Set(['ethereum', 'binancecoin', 'matic-network', 'avalanche-2', 'optimism', 'arbitrum', 'tether', 'usd-coin', 'weth', 'chainlink', 'uniswap', 'shiba-inu', 'pepe', 'dai', 'aave', 'pancakeswap-token', 'wbnb', 'ripple', 'dogecoin', 'wmatic', 'gmx', 'wrapped-avax']);
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${Array.from(ids).join(',')}&vs_currencies=usd`
      );
      
      if (response.ok) {
        const data = await response.json();
        setPrices(data);
        return data;
      }
    } catch (e) {}
    
    // Fallback
    return {
      'ethereum': { usd: 3300 }, 'binancecoin': { usd: 650 }, 'matic-network': { usd: 0.5 },
      'avalanche-2': { usd: 40 }, 'optimism': { usd: 2 }, 'arbitrum': { usd: 1.2 },
      'tether': { usd: 1 }, 'usd-coin': { usd: 1 }, 'weth': { usd: 3300 },
      'chainlink': { usd: 15 }, 'uniswap': { usd: 8 }, 'shiba-inu': { usd: 0.00001 },
      'pepe': { usd: 0.00001 }, 'dai': { usd: 1 }, 'aave': { usd: 90 },
      'pancakeswap-token': { usd: 2 }, 'wbnb': { usd: 650 }, 'dogecoin': { usd: 0.08 },
      'wmatic': { usd: 0.5 }, 'gmx': { usd: 30 }, 'wrapped-avax': { usd: 40 }
    };
  };

  // Get native balance
  const getNativeBalance = async (chain, address) => {
    try {
      const result = await tryRpcs(chain.rpcs, 'eth_getBalance', [address, 'latest']);
      if (!result || result === '0x0' || result === '0x') return 0;
      return Number(BigInt(result)) / Math.pow(10, chain.decimals);
    } catch (e) {
      return 0;
    }
  };

  // Get token balance
  const getTokenBalance = async (chain, tokenAddress, walletAddr, decimals) => {
    try {
      const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
      const result = await tryRpcs(chain.rpcs, 'eth_call', [
        { to: tokenAddress, data: BALANCE_OF_SELECTOR + paddedAddress },
        'latest'
      ]);
      if (!result || result === '0x' || result === '0x0') return 0;
      return Number(BigInt(result)) / Math.pow(10, decimals);
    } catch (e) {
      return 0;
    }
  };

  // Scan chain
  const scanChain = async (chainKey, address, currentPrices) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    // Native balance
    const nativeBalance = await getNativeBalance(chain, address);
    if (nativeBalance > 0.000001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      foundAssets.push({
        chain: chain.name, chainKey, symbol: chain.symbol, balance: nativeBalance,
        value: nativeBalance * price, price, isNative: true, color: chain.color,
        libertyChainId: chain.libertyChainId
      });
      console.log(`✅ ${chain.name}: ${nativeBalance.toFixed(8)} ${chain.symbol} = $${(nativeBalance * price).toFixed(2)}`);
    }

    // Token balances
    for (const token of chain.tokens) {
      const balance = await getTokenBalance(chain, token.address, address, token.decimals);
      if (balance > 0.000001) {
        const price = currentPrices[token.coingeckoId]?.usd || 0;
        foundAssets.push({
          chain: chain.name, chainKey, symbol: token.symbol, balance,
          value: balance * price, price, isNative: false, color: chain.color,
          address: token.address, libertyChainId: chain.libertyChainId
        });
        console.log(`✅ ${chain.name}: ${balance.toFixed(8)} ${token.symbol} = $${(balance * price).toFixed(2)}`);
      }
    }
    
    return foundAssets;
  };

  // Main scan
  const scanAllChains = async (testAddress = null) => {
    let addressToScan = testAddress || walletAddress;
    
    if (!addressToScan && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts?.[0]) {
          addressToScan = accounts[0];
          setWalletAddress(accounts[0]);
        }
      } catch (e) {}
    }

    if (!addressToScan) {
      setScanError('Please connect your wallet first');
      return;
    }

    const isTest = testAddress !== null;
    console.log(`🚀 ${isTest ? 'TEST SCAN' : 'Scanning'} for: ${addressToScan}`);
    
    setIsScanning(true);
    setScanError(null);
    setAssets([]);
    setTotalValue(0);
    setScanLog([isTest ? `🧪 Testing with: ${addressToScan.slice(0,10)}...` : 'Starting scan...']);

    const chains = Object.keys(CHAIN_CONFIG);
    setScanProgress({ current: 0, total: chains.length, chain: 'Loading prices...' });

    try {
      const currentPrices = await fetchPrices();
      setScanLog(prev => [...prev, `💰 Prices loaded`]);
      
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
            setScanLog(prev => [...prev.slice(-5), `✅ ${chain.name}: ${chainAssets.length} found`]);
          } else {
            setScanLog(prev => [...prev.slice(-5), `⚪ ${chain.name}: empty`]);
          }
        } catch (error) {
          setScanLog(prev => [...prev.slice(-5), `⚠️ ${chain.name}: error`]);
        }
        
        // Progressive update
        const filtered = allAssets.filter(a => a.value >= minValue);
        setAssets([...filtered].sort((a, b) => b.value - a.value));
        setTotalValue(filtered.reduce((s, a) => s + a.value, 0));
      }

      const total = allAssets.reduce((s, a) => s + a.value, 0);
      console.log(`🎉 Complete! Found ${allAssets.length} assets ($${total.toFixed(2)})`);
      setScanLog(prev => [...prev.slice(-5), `🎉 Found ${allAssets.length} assets ($${total.toFixed(2)})`]);
      
      setAssets(allAssets.sort((a, b) => b.value - a.value));
      setTotalValue(total);
      
    } catch (error) {
      setScanError('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Test scan with known wallet
  const runTestScan = () => {
    scanAllChains(TEST_WALLETS.vitalik);
  };

  // Build Liberty Swap URL
  const getLibertySwapUrl = (asset) => {
    return `https://libertyswap.finance`;
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      alert(`Copied ${label}!`);
    }).catch(() => {
      // Fallback
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      alert(`Copied ${label}!`);
    });
  };

  // Filter assets
  const filteredAssets = assets.filter(a => a.value >= minValue);
  const uniqueChains = [...new Set(filteredAssets.map(a => a.chain))].length;

  const formatNumber = (num, decimals = 2) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    if (num < 0.01 && num > 0) return num.toFixed(6);
    return num.toFixed(decimals);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,20,40,0.95) 0%, rgba(20,10,30,0.98) 100%)',
      borderRadius: '20px',
      padding: '30px',
      maxWidth: '900px',
      margin: '0 auto',
      border: '2px solid rgba(255,215,0,0.3)',
      boxShadow: '0 0 40px rgba(255,215,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <span style={{ fontSize: '2.5rem' }}>⭐</span>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0
          }}>
            DAPPER FLEX V6
          </h2>
          <span style={{ fontSize: '2.5rem' }}>⭐</span>
        </div>
        <p style={{ color: '#aaa', marginTop: '8px', fontSize: '0.95rem' }}>
          💜⭐ Cross-Chain Scanner • Bridge to PulseChain • 10% APR ⭐💜
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
        {[
          { label: 'Chains', value: '7', color: '#4ade80' },
          { label: 'Your Assets', value: filteredAssets.length.toString(), color: '#60a5fa' },
          { label: 'Total Value', value: `$${formatNumber(totalValue)}`, color: '#fbbf24' },
          { label: 'APR', value: '10%', color: '#f87171' }
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '15px',
            textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '5px' }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: '1.2rem', fontWeight: 'bold' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { id: 'crosschain', label: '🌐 Cross-Chain', color: '#4ade80' },
          { id: 'pulsechain', label: '💜 PulseChain', color: '#9333ea' },
          { id: 'stakes', label: '📊 Stakes', color: '#60a5fa' },
          { id: 'refer', label: '💝 Refer', color: '#f472b6' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px', borderRadius: '10px',
              border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
              background: activeTab === tab.id ? `${tab.color}22` : 'rgba(0,0,0,0.3)',
              color: activeTab === tab.id ? tab.color : '#888',
              cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {scanError && (
        <div style={{
          background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)',
          borderRadius: '10px', padding: '12px', marginBottom: '20px', color: '#fca5a5', textAlign: 'center'
        }}>
          {scanError}
        </div>
      )}

      {/* Cross-Chain Tab */}
      {activeTab === 'crosschain' && (
        <div style={{
          background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '20px',
          border: '1px solid rgba(255,215,0,0.2)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#FFD700', margin: 0 }}>⭐ OFF-CHAIN ASSETS</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* Debug Test Button */}
              <button
                onClick={runTestScan}
                disabled={isScanning}
                style={{
                  padding: '8px 12px', borderRadius: '8px', border: '1px solid #666',
                  background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'pointer', fontSize: '0.8rem'
                }}
              >
                🧪 Test (Vitalik)
              </button>
              {/* Scan Button */}
              <button
                onClick={() => scanAllChains()}
                disabled={isScanning}
                style={{
                  padding: '10px 20px', borderRadius: '8px', border: 'none',
                  background: isScanning ? 'rgba(255,215,0,0.3)' : 'linear-gradient(90deg, #FFD700, #FFA500)',
                  color: isScanning ? '#FFD700' : '#000', cursor: isScanning ? 'wait' : 'pointer',
                  fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                {isScanning ? <><span className="spin-emoji">🔄</span> Scanning...</> : <>🔄 Rescan All</>}
              </button>
            </div>
          </div>

          {/* Wallet Info */}
          {walletAddress && (
            <div style={{ fontSize: '0.8rem', color: '#4ade80', marginBottom: '15px' }}>
              ✅ Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}

          {/* Progress */}
          {isScanning && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#888', marginBottom: '5px' }}>
                <span>{scanProgress.chain}</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #FFD700, #FFA500)', transition: 'width 0.3s'
                }} />
              </div>
              <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.75rem', color: '#888', fontFamily: 'monospace', maxHeight: '100px', overflow: 'auto' }}>
                {scanLog.map((log, i) => <div key={i}>{log}</div>)}
              </div>
            </div>
          )}

          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <span style={{ color: '#888', fontSize: '0.9rem' }}>Min value:</span>
            <select
              value={minValue}
              onChange={(e) => setMinValue(Number(e.target.value))}
              style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.3)',
                background: 'rgba(0,0,0,0.5)', color: '#FFD700', cursor: 'pointer'
              }}
            >
              <option value={0}>All (dust)</option>
              <option value={0.01}>$0.01+</option>
              <option value={1}>$1+</option>
              <option value={10}>$10+</option>
              <option value={100}>$100+</option>
            </select>
            <span style={{ color: '#666', fontSize: '0.8rem' }}>
              {filteredAssets.length} assets across {uniqueChains} chains
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }} />

          {/* Assets */}
          {filteredAssets.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredAssets.map((asset, i) => (
                <div
                  key={`${asset.chainKey}-${asset.symbol}-${i}`}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
                    border: `1px solid ${asset.color}33`, flexWrap: 'wrap', gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: `${asset.color}22`, border: `2px solid ${asset.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 'bold', color: asset.color
                    }}>
                      {asset.symbol.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>
                        {asset.symbol}
                        {asset.isNative && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: asset.color, color: '#000', padding: '2px 6px', borderRadius: '4px' }}>NATIVE</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>{asset.chain}</div>
                      {/* Contract Address for tokens */}
                      {asset.address && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#666', fontFamily: 'monospace' }}>
                            {asset.address.slice(0, 6)}...{asset.address.slice(-4)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(asset.address, `${asset.symbol} CA`)}
                            style={{
                              background: 'none', border: 'none', color: '#FFD700', 
                              cursor: 'pointer', fontSize: '0.7rem', padding: '2px 4px'
                            }}
                            title="Copy Contract Address"
                          >
                            📋
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: '#4ade80' }}>${formatNumber(asset.value)}</div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>{formatNumber(asset.balance, 6)} {asset.symbol}</div>
                    </div>
                    {/* Bridge Button */}
                    <a
                      href={getLibertySwapUrl(asset)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 12px', borderRadius: '8px', background: 'linear-gradient(90deg, #9333ea, #7c3aed)',
                        color: '#fff', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap'
                      }}
                    >
                      Bridge →
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px', opacity: 0.5 }}>🌐</div>
              <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                {isScanning ? 'Scanning 7 chains...' : 'No off-chain assets found'}
              </div>
              <div style={{ fontSize: '0.9rem', marginBottom: '15px' }}>
                {walletAddress ? 'Click "Rescan All" or try "Test (Vitalik)" to verify scanner works' : 'Connect wallet first'}
              </div>
              {!isScanning && (
                <button
                  onClick={runTestScan}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: '1px solid #FFD700',
                    background: 'transparent', color: '#FFD700', cursor: 'pointer'
                  }}
                >
                  🧪 Test with Vitalik's Wallet
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Other Tabs */}
      {activeTab === 'pulsechain' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px solid rgba(147,51,234,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💜</div>
          <h3 style={{ color: '#9333ea', marginBottom: '10px' }}>PulseChain Assets</h3>
          <p style={{ color: '#888' }}>Your PulseChain tokens are shown on the main dashboard</p>
        </div>
      )}

      {activeTab === 'stakes' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px solid rgba(96,165,250,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📊</div>
          <h3 style={{ color: '#60a5fa', marginBottom: '10px' }}>Flex Stakes</h3>
          <p style={{ color: '#888' }}>Stake cross-chain LP for 10% APR</p>
        </div>
      )}

      {activeTab === 'refer' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px solid rgba(244,114,182,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💝</div>
          <h3 style={{ color: '#f472b6', marginBottom: '10px' }}>Referral Program</h3>
          <p style={{ color: '#888' }}>Coming soon...</p>
        </div>
      )}

      {/* Bridge Section */}
      <div style={{
        marginTop: '25px', background: 'rgba(0,0,0,0.3)', borderRadius: '15px',
        padding: '25px', textAlign: 'center', border: '1px solid rgba(255,215,0,0.2)'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌉</div>
        <h3 style={{ color: '#FFD700', marginBottom: '8px' }}>Bridge via Liberty Swap</h3>
        <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>
          Swap any token → USDC → Bridge to PulseChain
        </p>
        <a
          href="https://libertyswap.finance"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block', padding: '12px 30px',
            background: 'linear-gradient(90deg, #FFD700, #FFA500)',
            color: '#000', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold'
          }}
        >
          Open Liberty Swap →
        </a>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-emoji { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default DapperFlexV6;
