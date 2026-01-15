import React, { useState, useEffect } from 'react';

// ============================================
// DAPPER FLEX V6 - Multi-Chain Scanner + Zap to USDC
// Scan → Zap dust to USDC → Bridge via Liberty Swap
// ============================================

const TEST_WALLETS = {
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
};

// USDC addresses per chain (destination for zaps)
const USDC_ADDRESSES = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

// Native token "addresses" for 1inch (0xeee... = native)
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Chain configurations
const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#627EEA',
    oneInchChainId: 1,
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18, coingeckoId: 'dai' },
    ]
  },
  bsc: {
    name: 'BNB Chain',
    chainId: 56,
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org'],
    symbol: 'BNB',
    decimals: 18,
    coingeckoId: 'binancecoin',
    color: '#F3BA2F',
    oneInchChainId: 56,
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, coingeckoId: 'ethereum' },
    ]
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
    symbol: 'MATIC',
    decimals: 18,
    coingeckoId: 'matic-network',
    color: '#8247E5',
    oneInchChainId: 137,
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'weth' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#28A0F0',
    oneInchChainId: 42161,
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
    ]
  },
  avalanche: {
    name: 'Avalanche',
    chainId: 43114,
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com'],
    symbol: 'AVAX',
    decimals: 18,
    coingeckoId: 'avalanche-2',
    color: '#E84142',
    oneInchChainId: 43114,
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
    ]
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpcs: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#FF0420',
    oneInchChainId: 10,
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
    ]
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpcs: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#0052FF',
    oneInchChainId: 8453,
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
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
const APPROVE_SELECTOR = '0x095ea7b3';
const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

const DapperFlexV6 = ({ connectedAddress: propAddress }) => {
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '' });
  const [minValue, setMinValue] = useState(0);
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanLog, setScanLog] = useState([]);
  const [swapStatus, setSwapStatus] = useState({}); // {assetKey: 'idle'|'quoting'|'approving'|'swapping'|'done'|'error'}
  const [selectedAssets, setSelectedAssets] = useState(new Set()); // For batch zap

  // Detect wallet
  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) { setWalletAddress(propAddress); return; }
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
      const ids = 'ethereum,binancecoin,matic-network,avalanche-2,optimism,arbitrum,tether,usd-coin,weth,chainlink,uniswap,shiba-inu,pepe,dai,pancakeswap-token,gmx';
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (response.ok) { const data = await response.json(); setPrices(data); return data; }
    } catch (e) {}
    return { 'ethereum': { usd: 3300 }, 'binancecoin': { usd: 650 }, 'matic-network': { usd: 0.5 }, 'tether': { usd: 1 }, 'usd-coin': { usd: 1 } };
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
      const result = await tryRpcs(chain.rpcs, 'eth_call', [
        { to: tokenAddress, data: BALANCE_OF_SELECTOR + paddedAddress }, 'latest'
      ]);
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
        decimals: chain.decimals, oneInchChainId: chain.oneInchChainId,
        tokenAddress: NATIVE_TOKEN
      });
    }

    for (const token of chain.tokens) {
      const balance = await getTokenBalance(chain, token.address, address, token.decimals);
      if (balance > 0.000001) {
        const price = currentPrices[token.coingeckoId]?.usd || 0;
        foundAssets.push({
          chain: chain.name, chainKey, symbol: token.symbol, balance,
          value: balance * price, price, isNative: false, color: chain.color,
          address: token.address, decimals: token.decimals,
          oneInchChainId: chain.oneInchChainId, tokenAddress: token.address
        });
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

  // Switch network
  const switchNetwork = async (chainId) => {
    if (!window.ethereum) throw new Error('No wallet');
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + chainId.toString(16) }]
      });
      return true;
    } catch (error) {
      if (error.code === 4902) {
        throw new Error('Please add this network to your wallet');
      }
      throw error;
    }
  };

  // Get 1inch swap quote and tx
  const get1inchSwap = async (chainId, fromToken, toToken, amount, fromAddress, slippage = 1) => {
    // 1inch API v5
    const baseUrl = `https://api.1inch.dev/swap/v6.0/${chainId}`;
    
    // First get quote
    const quoteUrl = `${baseUrl}/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`;
    
    // Then get swap tx
    const swapUrl = `${baseUrl}/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${fromAddress}&slippage=${slippage}&disableEstimate=true`;
    
    // Note: 1inch API now requires API key. Let's use 0x API instead which has a free tier
    // Or we can use Paraswap which is also free
    
    // Using ParaSwap (free, no API key)
    const paraswapUrl = `https://apiv5.paraswap.io/prices?srcToken=${fromToken}&destToken=${toToken}&amount=${amount}&srcDecimals=18&destDecimals=6&side=SELL&network=${chainId}`;
    
    const response = await fetch(paraswapUrl);
    if (!response.ok) throw new Error('Quote failed');
    return await response.json();
  };

  // Approve token spending
  const approveToken = async (tokenAddress, spenderAddress, chainId) => {
    if (!window.ethereum) throw new Error('No wallet connected');
    
    const data = APPROVE_SELECTOR + 
      spenderAddress.slice(2).padStart(64, '0') + 
      MAX_UINT256.slice(2);
    
    const tx = await window.ethereum.request({
      method: 'eth_sendTransaction',
      params: [{
        from: walletAddress,
        to: tokenAddress,
        data: data,
        chainId: '0x' + chainId.toString(16)
      }]
    });
    
    return tx;
  };

  // Execute swap to USDC
  const zapToUsdc = async (asset) => {
    const assetKey = `${asset.chainKey}-${asset.symbol}`;
    
    // Skip if already USDC
    if (asset.symbol === 'USDC' || asset.symbol === 'USDC.e') {
      alert('This is already USDC! Just bridge it.');
      return;
    }

    try {
      setSwapStatus(prev => ({ ...prev, [assetKey]: 'switching' }));
      
      // Get chain config
      const chain = CHAIN_CONFIG[asset.chainKey];
      const usdcAddress = USDC_ADDRESSES[asset.chainKey];
      
      if (!usdcAddress) {
        throw new Error('USDC not available on this chain');
      }

      // Switch to correct network
      await switchNetwork(chain.chainId);
      setSwapStatus(prev => ({ ...prev, [assetKey]: 'quoting' }));

      // Calculate amount in wei
      const amountWei = BigInt(Math.floor(asset.balance * Math.pow(10, asset.decimals))).toString();
      
      // For now, open a DEX directly since aggregator APIs need keys
      // We'll open 1inch app with prefilled params
      const fromToken = asset.isNative ? 'ETH' : asset.tokenAddress;
      
      // Build 1inch app URL (works without API key)
      const oneInchUrl = `https://app.1inch.io/#/${chain.chainId}/simple/swap/${fromToken}/${usdcAddress}`;
      
      setSwapStatus(prev => ({ ...prev, [assetKey]: 'ready' }));
      
      // Open 1inch in new tab
      window.open(oneInchUrl, '_blank');
      
      alert(`Opening 1inch to swap ${asset.balance.toFixed(4)} ${asset.symbol} to USDC on ${asset.chain}.\n\nAfter swapping, come back and bridge your USDC via Liberty Swap!`);
      
      setSwapStatus(prev => ({ ...prev, [assetKey]: 'done' }));
      
    } catch (error) {
      console.error('Zap error:', error);
      setSwapStatus(prev => ({ ...prev, [assetKey]: 'error' }));
      alert(`Swap failed: ${error.message}`);
    }
  };

  // Toggle asset selection for batch zap
  const toggleAssetSelection = (assetKey) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetKey)) {
        newSet.delete(assetKey);
      } else {
        newSet.add(assetKey);
      }
      return newSet;
    });
  };

  // Batch zap selected assets
  const batchZapToUsdc = async () => {
    if (selectedAssets.size === 0) {
      alert('Select assets to zap first');
      return;
    }

    const selectedList = assets.filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`));
    
    // Group by chain
    const byChain = {};
    selectedList.forEach(asset => {
      if (!byChain[asset.chainKey]) byChain[asset.chainKey] = [];
      byChain[asset.chainKey].push(asset);
    });

    // Open 1inch for each chain
    for (const chainKey of Object.keys(byChain)) {
      const chain = CHAIN_CONFIG[chainKey];
      const chainAssets = byChain[chainKey];
      
      // Can only swap one at a time on 1inch UI, so open for the largest
      const largest = chainAssets.sort((a, b) => b.value - a.value)[0];
      const fromToken = largest.isNative ? 'ETH' : largest.tokenAddress;
      const usdcAddress = USDC_ADDRESSES[chainKey];
      
      const oneInchUrl = `https://app.1inch.io/#/${chain.chainId}/simple/swap/${fromToken}/${usdcAddress}`;
      window.open(oneInchUrl, '_blank');
    }

    alert(`Opened 1inch for ${Object.keys(byChain).length} chain(s).\n\nSwap each token to USDC, then bridge via Liberty Swap!`);
  };

  // Copy to clipboard
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text).catch(() => {});
    alert(`Copied ${label}!`);
  };

  const filteredAssets = assets.filter(a => a.value >= minValue);
  const uniqueChains = [...new Set(filteredAssets.map(a => a.chain))].length;
  const nonUsdcAssets = filteredAssets.filter(a => a.symbol !== 'USDC' && a.symbol !== 'USDC.e');
  const usdcAssets = filteredAssets.filter(a => a.symbol === 'USDC' || a.symbol === 'USDC.e');
  const totalUsdcValue = usdcAssets.reduce((s, a) => s + a.value, 0);

  const formatNumber = (num, decimals = 2) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    if (num < 0.01 && num > 0) return num.toFixed(6);
    return num.toFixed(decimals);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,20,40,0.95) 0%, rgba(20,10,30,0.98) 100%)',
      borderRadius: '20px', padding: '30px', maxWidth: '900px', margin: '0 auto',
      border: '2px solid rgba(255,215,0,0.3)', boxShadow: '0 0 40px rgba(255,215,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <span style={{ fontSize: '2.5rem' }}>⭐</span>
          <h2 style={{
            fontSize: '2rem', fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0
          }}>DAPPER FLEX V6</h2>
          <span style={{ fontSize: '2.5rem' }}>⭐</span>
        </div>
        <p style={{ color: '#aaa', marginTop: '8px', fontSize: '0.95rem' }}>
          💜⭐ Scan → Zap to USDC → Bridge to PulseChain ⭐💜
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
        {[
          { label: 'Total Found', value: `$${formatNumber(totalValue)}`, color: '#4ade80' },
          { label: 'Ready (USDC)', value: `$${formatNumber(totalUsdcValue)}`, color: '#60a5fa' },
          { label: 'Need Zap', value: nonUsdcAssets.length.toString(), color: '#fbbf24' },
          { label: 'Chains', value: uniqueChains.toString(), color: '#f87171' }
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
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px', borderRadius: '10px',
            border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
            background: activeTab === tab.id ? `${tab.color}22` : 'rgba(0,0,0,0.3)',
            color: activeTab === tab.id ? tab.color : '#888', cursor: 'pointer', fontWeight: 'bold'
          }}>{tab.label}</button>
        ))}
      </div>

      {scanError && (
        <div style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '10px', padding: '12px', marginBottom: '20px', color: '#fca5a5', textAlign: 'center' }}>
          {scanError}
        </div>
      )}

      {/* Cross-Chain Tab */}
      {activeTab === 'crosschain' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '20px', border: '1px solid rgba(255,215,0,0.2)' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#FFD700', margin: 0 }}>⭐ OFF-CHAIN ASSETS</h3>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={() => scanAllChains(TEST_WALLETS.vitalik)} disabled={isScanning} style={{
                padding: '8px 12px', borderRadius: '8px', border: '1px solid #666',
                background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'pointer', fontSize: '0.8rem'
              }}>🧪 Test</button>
              <button onClick={() => scanAllChains()} disabled={isScanning} style={{
                padding: '10px 20px', borderRadius: '8px', border: 'none',
                background: isScanning ? 'rgba(255,215,0,0.3)' : 'linear-gradient(90deg, #FFD700, #FFA500)',
                color: isScanning ? '#FFD700' : '#000', cursor: isScanning ? 'wait' : 'pointer', fontWeight: 'bold'
              }}>{isScanning ? '🔄 Scanning...' : '🔄 Rescan All'}</button>
            </div>
          </div>

          {walletAddress && <div style={{ fontSize: '0.8rem', color: '#4ade80', marginBottom: '15px' }}>✅ {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>}

          {/* Progress */}
          {isScanning && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#888' }}>
                <span>{scanProgress.chain}</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', marginTop: '5px' }}>
                <div style={{ height: '100%', width: `${(scanProgress.current / scanProgress.total) * 100}%`, background: 'linear-gradient(90deg, #FFD700, #FFA500)' }} />
              </div>
            </div>
          )}

          {/* Batch Zap Button */}
          {nonUsdcAssets.length > 0 && (
            <div style={{ background: 'rgba(255,215,0,0.1)', borderRadius: '10px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(255,215,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ color: '#FFD700', fontWeight: 'bold' }}>⚡ Zap All Dust to USDC</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>
                    {selectedAssets.size > 0 ? `${selectedAssets.size} selected` : 'Select tokens below or zap individually'}
                  </div>
                </div>
                <button
                  onClick={batchZapToUsdc}
                  disabled={selectedAssets.size === 0}
                  style={{
                    padding: '10px 20px', borderRadius: '8px', border: 'none',
                    background: selectedAssets.size > 0 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'rgba(100,100,100,0.3)',
                    color: selectedAssets.size > 0 ? '#000' : '#666', cursor: selectedAssets.size > 0 ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold'
                  }}
                >
                  ⚡ Zap Selected ({selectedAssets.size})
                </button>
              </div>
            </div>
          )}

          {/* Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            <span style={{ color: '#888', fontSize: '0.9rem' }}>Filter:</span>
            <select value={minValue} onChange={(e) => setMinValue(Number(e.target.value))} style={{
              padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,215,0,0.3)',
              background: 'rgba(0,0,0,0.5)', color: '#FFD700', cursor: 'pointer'
            }}>
              <option value={0}>All</option>
              <option value={1}>$1+</option>
              <option value={10}>$10+</option>
            </select>
          </div>

          {/* USDC Ready Section */}
          {usdcAssets.length > 0 && (
            <>
              <div style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✅ READY TO BRIDGE (USDC: ${formatNumber(totalUsdcValue)})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {usdcAssets.map((asset, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px', background: 'rgba(74,222,128,0.1)', borderRadius: '10px',
                    border: '1px solid rgba(74,222,128,0.3)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#4ade8022', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontWeight: 'bold' }}>$</div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{asset.symbol} <span style={{ color: '#4ade80', fontSize: '0.8rem' }}>✓ Ready</span></div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{asset.chain}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: '#4ade80' }}>${formatNumber(asset.value)}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{formatNumber(asset.balance, 2)}</div>
                      </div>
                      <a href="https://libertyswap.finance" target="_blank" rel="noopener noreferrer" style={{
                        padding: '8px 12px', borderRadius: '8px', background: 'linear-gradient(90deg, #4ade80, #22c55e)',
                        color: '#000', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold'
                      }}>Bridge →</a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Needs Zap Section */}
          {nonUsdcAssets.length > 0 && (
            <>
              <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '10px' }}>
                ⚡ NEEDS ZAP TO USDC ({nonUsdcAssets.length} tokens)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nonUsdcAssets.map((asset, i) => {
                  const assetKey = `${asset.chainKey}-${asset.symbol}`;
                  const status = swapStatus[assetKey] || 'idle';
                  const isSelected = selectedAssets.has(assetKey);
                  
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px', background: isSelected ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.3)',
                      borderRadius: '10px', border: isSelected ? '2px solid #fbbf24' : `1px solid ${asset.color}33`,
                      cursor: 'pointer'
                    }} onClick={() => toggleAssetSelection(assetKey)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Checkbox */}
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '4px',
                          border: '2px solid #fbbf24', background: isSelected ? '#fbbf24' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000'
                        }}>
                          {isSelected && '✓'}
                        </div>
                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: `${asset.color}22`, border: `2px solid ${asset.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: asset.color, fontWeight: 'bold' }}>
                          {asset.symbol.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>
                            {asset.symbol}
                            {asset.isNative && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: asset.color, color: '#000', padding: '2px 6px', borderRadius: '4px' }}>NATIVE</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#888' }}>{asset.chain}</div>
                          {asset.address && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.7rem', color: '#666', fontFamily: 'monospace' }}>{asset.address.slice(0,6)}...{asset.address.slice(-4)}</span>
                              <button onClick={(e) => { e.stopPropagation(); copyToClipboard(asset.address, 'CA'); }} style={{ background: 'none', border: 'none', color: '#FFD700', cursor: 'pointer', fontSize: '0.7rem', padding: '2px' }}>📋</button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: '#fbbf24' }}>${formatNumber(asset.value)}</div>
                          <div style={{ fontSize: '0.8rem', color: '#888' }}>{formatNumber(asset.balance, 6)}</div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); zapToUsdc(asset); }}
                          disabled={status === 'swapping'}
                          style={{
                            padding: '8px 12px', borderRadius: '8px',
                            background: status === 'done' ? '#4ade80' : 'linear-gradient(90deg, #f59e0b, #d97706)',
                            color: '#000', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'
                          }}
                        >
                          {status === 'done' ? '✓ Done' : '⚡ Zap'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Empty State */}
          {filteredAssets.length === 0 && !isScanning && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px', opacity: 0.5 }}>🌐</div>
              <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No off-chain assets found</div>
              <div style={{ fontSize: '0.9rem' }}>Click "Rescan All" or test with Vitalik's wallet</div>
            </div>
          )}
        </div>
      )}

      {/* Other tabs */}
      {activeTab === 'pulsechain' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px solid rgba(147,51,234,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💜</div>
          <h3 style={{ color: '#9333ea', marginBottom: '10px' }}>PulseChain Assets</h3>
          <p style={{ color: '#888' }}>Your PulseChain tokens are on the main dashboard</p>
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
      <div style={{ marginTop: '25px', background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '25px', textAlign: 'center', border: '1px solid rgba(255,215,0,0.2)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌉</div>
        <h3 style={{ color: '#FFD700', marginBottom: '8px' }}>Bridge USDC via Liberty Swap</h3>
        <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>
          After zapping to USDC, bridge to PulseChain
        </p>
        <a href="https://libertyswap.finance" target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', padding: '12px 30px', background: 'linear-gradient(90deg, #FFD700, #FFA500)',
          color: '#000', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold'
        }}>Open Liberty Swap →</a>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-emoji { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default DapperFlexV6;
