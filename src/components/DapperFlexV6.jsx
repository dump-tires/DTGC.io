import React, { useState, useEffect } from 'react';

// ============================================
// DAPPER FLEX V6 - Direct Fetch Multi-Chain Scanner
// Uses direct JSON-RPC fetch calls (bypasses ethers provider issues)
// ============================================

// Chain configurations with multiple CORS-friendly RPC endpoints
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
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'weth' },
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
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
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
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
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
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
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
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
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
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
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
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
    ]
  }
};

// Direct JSON-RPC call with timeout
const rpcCall = async (rpcUrl, method, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'RPC Error');
    }
    
    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Try multiple RPCs until one works
const tryRpcs = async (rpcs, method, params) => {
  let lastError;
  
  for (const rpc of rpcs) {
    try {
      const result = await rpcCall(rpc, method, params);
      return result;
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  
  throw lastError || new Error('All RPCs failed');
};

// balanceOf(address) function selector
const BALANCE_OF_SELECTOR = '0x70a08231';

const DapperFlexV6 = ({ connectedAddress: propAddress }) => {
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '' });
  const [minValue, setMinValue] = useState(1);
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanLog, setScanLog] = useState([]);

  // Detect wallet on mount
  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) {
        setWalletAddress(propAddress);
        return;
      }
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setWalletAddress(accounts[0]);
          }
        } catch (e) {
          console.log('Wallet detection failed:', e);
        }
      }
    };
    detectWallet();
  }, [propAddress]);

  // Fetch prices
  const fetchPrices = async () => {
    try {
      const ids = new Set();
      Object.values(CHAIN_CONFIG).forEach(chain => {
        ids.add(chain.coingeckoId);
        chain.tokens.forEach(token => ids.add(token.coingeckoId));
      });
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${Array.from(ids).join(',')}&vs_currencies=usd`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('💰 Prices loaded:', data);
        setPrices(data);
        return data;
      }
    } catch (error) {
      console.log('Price fetch error:', error);
    }
    
    // Fallback prices if CoinGecko fails
    const fallback = {
      'ethereum': { usd: 3500 },
      'binancecoin': { usd: 650 },
      'matic-network': { usd: 0.5 },
      'avalanche-2': { usd: 40 },
      'optimism': { usd: 2 },
      'arbitrum': { usd: 1.2 },
      'tether': { usd: 1 },
      'usd-coin': { usd: 1 },
      'weth': { usd: 3500 },
      'binance-usd': { usd: 1 }
    };
    setPrices(fallback);
    return fallback;
  };

  // Get native balance
  const getNativeBalance = async (chain, address) => {
    try {
      const result = await tryRpcs(chain.rpcs, 'eth_getBalance', [address, 'latest']);
      
      if (!result || result === '0x0' || result === '0x') {
        return 0;
      }
      
      const balanceWei = BigInt(result);
      const balance = Number(balanceWei) / Math.pow(10, chain.decimals);
      return balance;
    } catch (error) {
      console.log(`❌ ${chain.name} native failed:`, error.message);
      return 0;
    }
  };

  // Get ERC20 token balance
  const getTokenBalance = async (chain, tokenAddress, walletAddr, decimals) => {
    try {
      const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
      const callData = BALANCE_OF_SELECTOR + paddedAddress;
      
      const result = await tryRpcs(chain.rpcs, 'eth_call', [
        { to: tokenAddress, data: callData },
        'latest'
      ]);
      
      if (!result || result === '0x' || result === '0x0') {
        return 0;
      }
      
      const balanceWei = BigInt(result);
      const balance = Number(balanceWei) / Math.pow(10, decimals);
      return balance;
    } catch (error) {
      return 0;
    }
  };

  // Scan a single chain
  const scanChain = async (chainKey, address, currentPrices) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    console.log(`🔍 Scanning ${chain.name}...`);
    
    // Get native balance
    const nativeBalance = await getNativeBalance(chain, address);
    
    if (nativeBalance > 0.0001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      const value = nativeBalance * price;
      
      foundAssets.push({
        chain: chain.name,
        chainKey,
        symbol: chain.symbol,
        name: chain.symbol,
        balance: nativeBalance,
        value,
        price,
        isNative: true,
        color: chain.color
      });
      
      console.log(`✅ ${chain.name}: ${nativeBalance.toFixed(6)} ${chain.symbol} = $${value.toFixed(2)}`);
    } else {
      console.log(`⚪ ${chain.name}: 0 ${chain.symbol}`);
    }

    // Get token balances
    for (const token of chain.tokens) {
      try {
        const balance = await getTokenBalance(chain, token.address, address, token.decimals);
        
        if (balance > 0.01) {
          const price = currentPrices[token.coingeckoId]?.usd || 0;
          const value = balance * price;
          
          foundAssets.push({
            chain: chain.name,
            chainKey,
            symbol: token.symbol,
            name: token.symbol,
            balance,
            value,
            price,
            isNative: false,
            color: chain.color,
            address: token.address
          });
          
          console.log(`✅ ${chain.name}: ${balance.toFixed(4)} ${token.symbol} = $${value.toFixed(2)}`);
        }
      } catch (e) {
        // Skip failed tokens silently
      }
    }
    
    return foundAssets;
  };

  // Main scan function
  const scanAllChains = async () => {
    let addressToScan = walletAddress;
    
    // Try to get wallet if not set
    if (!addressToScan && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          addressToScan = accounts[0];
          setWalletAddress(accounts[0]);
        }
      } catch (e) {
        console.log('Could not get wallet:', e);
      }
    }

    if (!addressToScan) {
      setScanError('Please connect your wallet first');
      return;
    }

    console.log('🚀 Starting cross-chain scan for:', addressToScan);
    setIsScanning(true);
    setScanError(null);
    setAssets([]);
    setTotalValue(0);
    setScanLog(['Starting scan...']);

    const chains = Object.keys(CHAIN_CONFIG);
    setScanProgress({ current: 0, total: chains.length, chain: 'Loading prices...' });

    try {
      // Fetch prices first
      const currentPrices = await fetchPrices();
      setScanLog(prev => [...prev, `✅ Prices loaded (${Object.keys(currentPrices).length} tokens)`]);
      
      const allAssets = [];
      
      // Scan each chain sequentially
      for (let i = 0; i < chains.length; i++) {
        const chainKey = chains[i];
        const chain = CHAIN_CONFIG[chainKey];
        
        setScanProgress({ 
          current: i + 1, 
          total: chains.length, 
          chain: chain.name 
        });
        
        setScanLog(prev => [...prev.slice(-4), `🔍 Scanning ${chain.name}...`]);
        
        try {
          const chainAssets = await scanChain(chainKey, addressToScan, currentPrices);
          
          if (chainAssets.length > 0) {
            allAssets.push(...chainAssets);
            setScanLog(prev => [...prev.slice(-4), `✅ ${chain.name}: Found ${chainAssets.length} assets`]);
          } else {
            setScanLog(prev => [...prev.slice(-4), `⚪ ${chain.name}: No assets`]);
          }
        } catch (error) {
          console.log(`${chain.name} scan error:`, error.message);
          setScanLog(prev => [...prev.slice(-4), `⚠️ ${chain.name}: Failed`]);
        }
        
        // Update UI progressively
        if (allAssets.length > 0) {
          const filtered = allAssets.filter(a => a.value >= minValue);
          setAssets([...filtered].sort((a, b) => b.value - a.value));
          setTotalValue(filtered.reduce((sum, a) => sum + a.value, 0));
        }
      }

      // Final update
      const filtered = allAssets.filter(a => a.value >= minValue);
      setAssets(filtered.sort((a, b) => b.value - a.value));
      setTotalValue(filtered.reduce((sum, a) => sum + a.value, 0));
      
      const finalMsg = `🎉 Complete! Found ${allAssets.length} assets ($${filtered.reduce((s,a)=>s+a.value,0).toFixed(2)})`;
      console.log(finalMsg);
      setScanLog(prev => [...prev.slice(-4), finalMsg]);
      
    } catch (error) {
      console.error('Scan error:', error);
      setScanError('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Refilter when min value changes
  useEffect(() => {
    if (assets.length > 0) {
      const filtered = assets.filter(a => a.value >= minValue);
      setTotalValue(filtered.reduce((sum, a) => sum + a.value, 0));
    }
  }, [minValue, assets]);

  // Format numbers
  const formatNumber = (num, decimals = 2) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(decimals);
  };

  const uniqueChains = [...new Set(assets.filter(a => a.value >= minValue).map(a => a.chain))].length;

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
          💜⭐ True Cross-Chain Scanner • 10% APR • Referrals ⭐💜
        </p>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '15px',
        marginBottom: '25px'
      }}>
        {[
          { label: 'Total Staked', value: '0 LP', color: '#4ade80' },
          { label: 'Your Staked', value: '0 LP', color: '#60a5fa' },
          { label: 'APR', value: '10%', color: '#fbbf24' },
          { label: 'Rewards Pool', value: '1,000,000', color: '#f87171' }
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'rgba(0,0,0,0.3)',
            borderRadius: '12px',
            padding: '15px',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '5px' }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: '1.2rem', fontWeight: 'bold' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '10px',
        marginBottom: '20px'
      }}>
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
              padding: '12px',
              borderRadius: '10px',
              border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
              background: activeTab === tab.id ? `${tab.color}22` : 'rgba(0,0,0,0.3)',
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

      {/* Error Display */}
      {scanError && (
        <div style={{
          background: 'rgba(239,68,68,0.2)',
          border: '1px solid rgba(239,68,68,0.5)',
          borderRadius: '10px',
          padding: '12px',
          marginBottom: '20px',
          color: '#fca5a5',
          textAlign: 'center'
        }}>
          {scanError}
        </div>
      )}

      {/* Cross-Chain Tab Content */}
      {activeTab === 'crosschain' && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '15px',
          padding: '20px',
          border: '1px solid rgba(255,215,0,0.2)'
        }}>
          {/* Header with Rescan */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{ color: '#FFD700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              ⭐ OFF-CHAIN ASSETS
            </h3>
            <button
              onClick={scanAllChains}
              disabled={isScanning}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: isScanning 
                  ? 'rgba(255,215,0,0.3)' 
                  : 'linear-gradient(90deg, #FFD700, #FFA500)',
                color: isScanning ? '#FFD700' : '#000',
                cursor: isScanning ? 'wait' : 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px',
                justifyContent: 'center'
              }}
            >
              {isScanning ? (
                <>
                  <span className="spin-emoji">🔄</span>
                  Scanning...
                </>
              ) : (
                <>🔄 Rescan All</>
              )}
            </button>
          </div>

          {/* Wallet & Total Value */}
          <div style={{ marginBottom: '20px' }}>
            {walletAddress && (
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#4ade80', 
                marginBottom: '8px'
              }}>
                ✅ Wallet: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
            )}
            <div style={{ fontSize: '0.9rem', color: '#888' }}>Total:</div>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#4ade80'
            }}>
              ${formatNumber(totalValue)}
            </div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>
              {assets.filter(a => a.value >= minValue).length} tokens across {uniqueChains} chains
            </div>
          </div>

          {/* Progress Bar & Log */}
          {isScanning && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '5px',
                fontSize: '0.85rem',
                color: '#888'
              }}>
                <span>{scanProgress.chain}</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{
                height: '8px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              {/* Live Scan Log */}
              <div style={{ 
                marginTop: '12px', 
                padding: '10px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '8px',
                fontSize: '0.75rem', 
                color: '#888',
                maxHeight: '80px',
                overflow: 'auto',
                fontFamily: 'monospace'
              }}>
                {scanLog.map((log, i) => (
                  <div key={i} style={{ marginBottom: '2px' }}>{log}</div>
                ))}
              </div>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }} />

          {/* Min Value Filter */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            marginBottom: '20px'
          }}>
            <span style={{ color: '#888', fontSize: '0.9rem' }}>Min value:</span>
            <select
              value={minValue}
              onChange={(e) => setMinValue(Number(e.target.value))}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,215,0,0.3)',
                background: 'rgba(0,0,0,0.5)',
                color: '#FFD700',
                cursor: 'pointer'
              }}
            >
              <option value={0}>All</option>
              <option value={1}>$1+</option>
              <option value={10}>$10+</option>
              <option value={100}>$100+</option>
              <option value={1000}>$1K+</option>
            </select>
          </div>

          {/* Assets List */}
          {assets.filter(a => a.value >= minValue).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {assets.filter(a => a.value >= minValue).map((asset, i) => (
                <div
                  key={`${asset.chainKey}-${asset.symbol}-${i}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '15px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    border: `1px solid ${asset.color}33`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: `${asset.color}22`,
                      border: `2px solid ${asset.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: asset.color
                    }}>
                      {asset.symbol.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>
                        {asset.symbol}
                        {asset.isNative && <span style={{ 
                          marginLeft: '6px', 
                          fontSize: '0.7rem', 
                          background: asset.color,
                          color: '#000',
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}>NATIVE</span>}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        {asset.chain}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: '#4ade80' }}>
                      ${formatNumber(asset.value)}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {formatNumber(asset.balance, 4)} {asset.symbol}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px',
              color: '#666'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px', opacity: 0.5 }}>🌐</div>
              <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>
                {isScanning ? 'Scanning chains...' : 'No off-chain assets found'}
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                {walletAddress ? 'Click "Rescan All" to scan 7 EVM chains' : 'Connect wallet and click "Rescan All"'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Other tabs... */}
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
          <h3 style={{ color: '#60a5fa', marginBottom: '10px' }}>Your Flex Stakes</h3>
          <p style={{ color: '#888' }}>No active Dapper Flex stakes yet</p>
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
        marginTop: '25px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '15px',
        padding: '25px',
        textAlign: 'center',
        border: '1px solid rgba(255,215,0,0.2)'
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌐</div>
        <h3 style={{ color: '#FFD700', marginBottom: '8px' }}>Bridge via Liberty Swap</h3>
        <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>
          Bridge assets from other chains to PulseChain
        </p>
        <a
          href="https://libertyswap.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '12px 30px',
            background: 'linear-gradient(90deg, #FFD700, #FFA500)',
            color: '#000',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 'bold'
          }}
        >
          Open Liberty Swap →
        </a>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-emoji {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default DapperFlexV6;
