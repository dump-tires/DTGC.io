import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ============================================
// DAPPER FLEX V6 - Direct RPC Multi-Chain Scanner
// No API keys needed - uses public RPC endpoints
// ============================================

// Chain configurations with public RPC endpoints
const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    rpc: 'https://eth.llamarpc.com',
    backupRpc: 'https://rpc.ankr.com/eth',
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    explorer: 'https://etherscan.io',
    color: '#627EEA',
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5bE3830', decimals: 18, coingeckoId: 'dai' },
    ]
  },
  bsc: {
    name: 'BNB Chain',
    chainId: 56,
    rpc: 'https://bsc-dataseed1.binance.org',
    backupRpc: 'https://bsc-dataseed2.binance.org',
    symbol: 'BNB',
    decimals: 18,
    coingeckoId: 'binancecoin',
    explorer: 'https://bscscan.com',
    color: '#F3BA2F',
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, coingeckoId: 'wbnb' },
    ]
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    rpc: 'https://polygon-rpc.com',
    backupRpc: 'https://rpc-mainnet.matic.quiknode.pro',
    symbol: 'MATIC',
    decimals: 18,
    coingeckoId: 'matic-network',
    explorer: 'https://polygonscan.com',
    color: '#8247E5',
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, coingeckoId: 'wmatic' },
      { symbol: 'AAVE', address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', decimals: 18, coingeckoId: 'aave' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    rpc: 'https://arb1.arbitrum.io/rpc',
    backupRpc: 'https://arbitrum-one.public.blastapi.io',
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    explorer: 'https://arbiscan.io',
    color: '#28A0F0',
    tokens: [
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
    ]
  },
  avalanche: {
    name: 'Avalanche',
    chainId: 43114,
    rpc: 'https://api.avax.network/ext/bc/C/rpc',
    backupRpc: 'https://avalanche-c-chain.publicnode.com',
    symbol: 'AVAX',
    decimals: 18,
    coingeckoId: 'avalanche-2',
    explorer: 'https://snowtrace.io',
    color: '#E84142',
    tokens: [
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WAVAX', address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', decimals: 18, coingeckoId: 'wrapped-avax' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18, coingeckoId: 'joe' },
    ]
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    rpc: 'https://mainnet.optimism.io',
    backupRpc: 'https://optimism.publicnode.com',
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    explorer: 'https://optimistic.etherscan.io',
    color: '#FF0420',
    tokens: [
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
    ]
  },
  base: {
    name: 'Base',
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    backupRpc: 'https://base.publicnode.com',
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    explorer: 'https://basescan.org',
    color: '#0052FF',
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, coingeckoId: 'dai' },
    ]
  },
  fantom: {
    name: 'Fantom',
    chainId: 250,
    rpc: 'https://rpc.ftm.tools',
    backupRpc: 'https://fantom.publicnode.com',
    symbol: 'FTM',
    decimals: 18,
    coingeckoId: 'fantom',
    explorer: 'https://ftmscan.com',
    color: '#1969FF',
    tokens: [
      { symbol: 'USDC', address: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WFTM', address: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', decimals: 18, coingeckoId: 'wrapped-fantom' },
    ]
  }
};

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const DapperFlexV6 = ({ connectedAddress }) => {
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '' });
  const [minValue, setMinValue] = useState(1);
  const [prices, setPrices] = useState({});

  // Fetch prices from CoinGecko
  const fetchPrices = useCallback(async () => {
    try {
      // Collect all unique coingecko IDs
      const ids = new Set();
      Object.values(CHAIN_CONFIG).forEach(chain => {
        ids.add(chain.coingeckoId);
        chain.tokens.forEach(token => ids.add(token.coingeckoId));
      });
      
      const idsString = Array.from(ids).join(',');
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${idsString}&vs_currencies=usd`
      );
      
      if (response.ok) {
        const data = await response.json();
        setPrices(data);
        return data;
      }
    } catch (error) {
      console.log('Price fetch error:', error);
    }
    return prices;
  }, [prices]);

  // Get balance for a single chain
  const getChainBalances = async (chainKey, address, currentPrices) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    try {
      // Try primary RPC, fallback to backup
      let provider;
      try {
        provider = new ethers.JsonRpcProvider(chain.rpc);
        await provider.getBlockNumber(); // Test connection
      } catch {
        provider = new ethers.JsonRpcProvider(chain.backupRpc);
      }

      // Get native balance
      const nativeBalance = await provider.getBalance(address);
      const nativeFormatted = parseFloat(ethers.formatUnits(nativeBalance, chain.decimals));
      
      if (nativeFormatted > 0) {
        const price = currentPrices[chain.coingeckoId]?.usd || 0;
        const value = nativeFormatted * price;
        
        foundAssets.push({
          chain: chain.name,
          chainKey,
          symbol: chain.symbol,
          name: chain.symbol,
          balance: nativeFormatted,
          value,
          price,
          isNative: true,
          color: chain.color,
          explorer: chain.explorer
        });
      }

      // Check ERC20 tokens
      for (const token of chain.tokens) {
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const balance = await contract.balanceOf(address);
          const formatted = parseFloat(ethers.formatUnits(balance, token.decimals));
          
          if (formatted > 0) {
            const price = currentPrices[token.coingeckoId]?.usd || 0;
            const value = formatted * price;
            
            foundAssets.push({
              chain: chain.name,
              chainKey,
              symbol: token.symbol,
              name: token.symbol,
              balance: formatted,
              value,
              price,
              isNative: false,
              color: chain.color,
              explorer: chain.explorer,
              address: token.address
            });
          }
        } catch (tokenError) {
          // Skip failed token queries silently
        }
      }
    } catch (error) {
      console.log(`${chain.name} scan failed:`, error.message);
    }
    
    return foundAssets;
  };

  // Main scan function
  const scanAllChains = async () => {
    if (!connectedAddress) {
      setScanError('Connect wallet first');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setAssets([]);
    setTotalValue(0);

    const chains = Object.keys(CHAIN_CONFIG);
    setScanProgress({ current: 0, total: chains.length, chain: 'Fetching prices...' });

    try {
      // Fetch prices first
      const currentPrices = await fetchPrices();
      
      const allAssets = [];
      
      // Scan each chain
      for (let i = 0; i < chains.length; i++) {
        const chainKey = chains[i];
        setScanProgress({ 
          current: i + 1, 
          total: chains.length, 
          chain: CHAIN_CONFIG[chainKey].name 
        });

        const chainAssets = await getChainBalances(chainKey, connectedAddress, currentPrices);
        allAssets.push(...chainAssets);
        
        // Update UI progressively
        const filtered = allAssets.filter(a => a.value >= minValue);
        setAssets([...filtered].sort((a, b) => b.value - a.value));
        setTotalValue(filtered.reduce((sum, a) => sum + a.value, 0));
      }

      // Final update
      const filtered = allAssets.filter(a => a.value >= minValue);
      setAssets(filtered.sort((a, b) => b.value - a.value));
      setTotalValue(filtered.reduce((sum, a) => sum + a.value, 0));
      
      console.log(`✅ Scan complete: ${filtered.length} assets found across ${chains.length} chains`);
      
    } catch (error) {
      console.error('Scan error:', error);
      setScanError('Scan failed. Try again.');
    } finally {
      setIsScanning(false);
      setScanProgress({ current: 0, total: 0, chain: '' });
    }
  };

  // Refilter when min value changes
  useEffect(() => {
    if (assets.length > 0) {
      const filtered = assets.filter(a => a.value >= minValue);
      setTotalValue(filtered.reduce((sum, a) => sum + a.value, 0));
    }
  }, [minValue]);

  // Format number with commas
  const formatNumber = (num, decimals = 2) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(decimals);
  };

  // Count unique chains with assets
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
            <div>
              <h3 style={{ color: '#FFD700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⭐ OFF-CHAIN ASSETS
              </h3>
            </div>
            <button
              onClick={scanAllChains}
              disabled={isScanning || !connectedAddress}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                background: isScanning 
                  ? 'rgba(100,100,100,0.5)' 
                  : 'linear-gradient(90deg, #FFD700, #FFA500)',
                color: isScanning ? '#888' : '#000',
                cursor: isScanning || !connectedAddress ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isScanning ? (
                <>
                  <span style={{ 
                    display: 'inline-block', 
                    animation: 'spin 1s linear infinite',
                    fontSize: '1rem'
                  }}>🔄</span>
                  Scanning...
                </>
              ) : (
                <>🔄 Rescan All</>
              )}
            </button>
          </div>

          {/* Total Value */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.9rem', color: '#888' }}>Total:</div>
            <div style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#4ade80'
            }}>
              ${formatNumber(totalValue)}
            </div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>
              {assets.filter(a => a.value >= minValue).length} tokens found across {uniqueChains} chains
            </div>
          </div>

          {/* Progress Bar */}
          {isScanning && scanProgress.total > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '5px',
                fontSize: '0.85rem',
                color: '#888'
              }}>
                <span>Scanning {scanProgress.chain}...</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{
                height: '6px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${(scanProgress.current / scanProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #FFD700, #FFA500)',
                  transition: 'width 0.3s ease'
                }} />
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
              <div style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No off-chain assets found</div>
              <div style={{ fontSize: '0.9rem' }}>
                Connect wallet and click "Rescan All"
              </div>
            </div>
          )}
        </div>
      )}

      {/* PulseChain Tab */}
      {activeTab === 'pulsechain' && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '15px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid rgba(147,51,234,0.3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💜</div>
          <h3 style={{ color: '#9333ea', marginBottom: '10px' }}>PulseChain Assets</h3>
          <p style={{ color: '#888' }}>Your PulseChain tokens are shown on the main dashboard</p>
        </div>
      )}

      {/* Stakes Tab */}
      {activeTab === 'stakes' && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '15px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid rgba(96,165,250,0.3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📊</div>
          <h3 style={{ color: '#60a5fa', marginBottom: '10px' }}>Your Flex Stakes</h3>
          <p style={{ color: '#888' }}>No active Dapper Flex stakes yet</p>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '10px' }}>
            Stake your cross-chain LP tokens for 10% APR
          </p>
        </div>
      )}

      {/* Refer Tab */}
      {activeTab === 'refer' && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '15px',
          padding: '40px',
          textAlign: 'center',
          border: '1px solid rgba(244,114,182,0.3)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💝</div>
          <h3 style={{ color: '#f472b6', marginBottom: '10px' }}>Referral Program</h3>
          <p style={{ color: '#888' }}>Earn rewards by referring friends</p>
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '10px' }}>
            Coming soon...
          </p>
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

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DapperFlexV6;
