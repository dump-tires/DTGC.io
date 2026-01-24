import React, { useState, useEffect, useCallback, useRef } from 'react';

// ==================== CONFIGURATION ====================
const LAMBDA_URL = 'https://kz45776mye3b2ywtra43m4wwl40hmrdu.lambda-url.us-east-2.on.aws/';
const PRICE_UPDATE_INTERVAL = 2000; // 2 seconds for live feel

// Direct price APIs for accuracy
const PRICE_APIS = {
  // Binance public API - most accurate for BTC/ETH
  binance: {
    btc: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
    eth: 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
  },
  // Metals fallback (goldprice.org provides accurate per-ounce data)
  metals: 'https://data-asg.goldprice.org/dbXRates/USD',
};

const ASSET_IMAGES = {
  BTC: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
  GOLD: '/images/gold_bar.png',
  SILVER: '/images/silver_bar.png',
};

// Arbitrum logo SVG
const ArbitrumLogo = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="20" fill="#213147"/>
    <path d="M22.8 10.5L28.5 19.2L26.4 22.5L22.8 16.8V10.5Z" fill="#12AAFF"/>
    <path d="M17.2 10.5V16.8L13.6 22.5L11.5 19.2L17.2 10.5Z" fill="#12AAFF"/>
    <path d="M20 20.5L24.8 28H15.2L20 20.5Z" fill="#9DCCED"/>
    <path d="M28.5 19.2L26.4 22.5L20 32L13.6 22.5L11.5 19.2L20 32L28.5 19.2Z" fill="#213147"/>
    <path d="M20 8L11.5 19.2L13.6 22.5L20 12.5L26.4 22.5L28.5 19.2L20 8Z" fill="#9DCCED"/>
  </svg>
);

const ASSETS = {
  BTC: { name: 'Bitcoin', symbol: 'BTC', maxLev: 150, minLev: 1.1 },
  ETH: { name: 'Ethereum', symbol: 'ETH', maxLev: 150, minLev: 1.1 },
  GOLD: { name: 'Gold', symbol: 'XAU', maxLev: 25, minLev: 2 },
  SILVER: { name: 'Silver', symbol: 'XAG', maxLev: 25, minLev: 2 },
};

export default function MetalPerpsWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('trade');
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [direction, setDirection] = useState('LONG');
  const [collateral, setCollateral] = useState('50');
  const [leverage, setLeverage] = useState(10);
  const [prices, setPrices] = useState({
    BTC: 89500,
    ETH: 2950,
    GOLD: 2650,
    SILVER: 31,
  });
  const [prevPrices, setPrevPrices] = useState({});
  const [priceChanges, setPriceChanges] = useState({});
  const [positions, setPositions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [priceFlash, setPriceFlash] = useState({});
  
  const priceRef = useRef({
    BTC: 89500,
    ETH: 2950,
    GOLD: 2650,
    SILVER: 31,
  });

  const asset = ASSETS[selectedAsset];
  const currentPrice = prices[selectedAsset] || 0;
  const positionSize = parseFloat(collateral || 0) * leverage;

  // Check if commodity market is open
  const isMarketOpen = useCallback(() => {
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcHour = now.getUTCHours();
    if (utcDay === 6) return false;
    if (utcDay === 0 && utcHour < 22) return false;
    if (utcDay === 5 && utcHour >= 22) return false;
    return true;
  }, []);

  const isCommodity = selectedAsset === 'GOLD' || selectedAsset === 'SILVER';
  const marketOpen = !isCommodity || isMarketOpen();

  // Toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // API helper
  const apiCall = async (action, params = {}) => {
    try {
      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      const data = await response.json();
      if (data.body) return JSON.parse(data.body);
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Fetch prices with change tracking - DIRECT API CALLS for accuracy
  const fetchPrices = useCallback(async () => {
    try {
      let newPrices = { ...priceRef.current };
      
      // PARALLEL fetch for speed - Binance for crypto, goldprice.org for metals
      const [btcRes, ethRes, metalsRes] = await Promise.allSettled([
        fetch(PRICE_APIS.binance.btc),
        fetch(PRICE_APIS.binance.eth),
        fetch(PRICE_APIS.metals),
      ]);
      
      // Parse BTC
      if (btcRes.status === 'fulfilled') {
        const btcData = await btcRes.value.json();
        if (btcData?.price) newPrices.BTC = parseFloat(btcData.price);
      }
      
      // Parse ETH
      if (ethRes.status === 'fulfilled') {
        const ethData = await ethRes.value.json();
        if (ethData?.price) newPrices.ETH = parseFloat(ethData.price);
      }
      
      // Parse Gold/Silver from goldprice.org
      if (metalsRes.status === 'fulfilled') {
        const metalsData = await metalsRes.value.json();
        if (metalsData?.items?.[0]) {
          const item = metalsData.items[0];
          if (item.xauPrice) newPrices.GOLD = parseFloat(item.xauPrice);
          if (item.xagPrice) newPrices.SILVER = parseFloat(item.xagPrice);
        }
      }
      
      const oldPrices = priceRef.current;
      
      // Calculate price changes
      const changes = {};
      const flashes = {};
      Object.keys(newPrices).forEach(asset => {
        const oldPrice = oldPrices[asset] || newPrices[asset];
        const newPrice = newPrices[asset];
        if (oldPrice && newPrice) {
          const change = ((newPrice - oldPrice) / oldPrice) * 100;
          changes[asset] = change;
          
          // Trigger flash animation if price changed
          if (Math.abs(newPrice - oldPrice) > 0.01) {
            flashes[asset] = change > 0 ? 'up' : 'down';
          }
        }
      });
      
      setPrevPrices(oldPrices);
      setPrices(newPrices);
      setPriceChanges(changes);
      setPriceFlash(flashes);
      priceRef.current = newPrices;
      setLastUpdate(new Date());
      
      // Clear flash after animation
      setTimeout(() => setPriceFlash({}), 500);
    } catch (error) {
      console.error('Failed to fetch prices:', error);
    }
  }, []);

  // Fetch positions
  const fetchPositions = useCallback(async () => {
    try {
      const result = await apiCall('POSITIONS');
      if (result.positions) setPositions(result.positions);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  }, []);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    try {
      const result = await apiCall('BALANCE');
      if (result.balance !== undefined) setBalance(result.balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, []);

  // Trade functions
  const openTrade = async () => {
    if (!marketOpen) {
      showToast('Market closed for commodities', 'error');
      return;
    }
    setLoading(true);
    try {
      const result = await apiCall('OPEN_TRADE', {
        asset: selectedAsset,
        direction,
        collateralUsd: parseFloat(collateral),
        leverage,
      });
      if (result.success) {
        showToast(`${direction} ${selectedAsset} opened! (1% fee applied)`, 'success');
        fetchPositions();
        fetchBalance();
      } else {
        showToast(result.error || 'Trade failed', 'error');
      }
    } catch (error) {
      showToast('Failed to open trade', 'error');
    }
    setLoading(false);
  };

  const closePosition = async (index) => {
    setLoading(true);
    try {
      const result = await apiCall('CLOSE_TRADE', { positionIndex: index });
      if (result.success) {
        showToast('Position closed!', 'success');
        fetchPositions();
        fetchBalance();
      } else {
        showToast(result.error || 'Failed to close', 'error');
      }
    } catch (error) {
      showToast('Failed to close position', 'error');
    }
    setLoading(false);
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchPrices();
    fetchPositions();
    fetchBalance();
    
    // More frequent price updates for live feel
    const priceInterval = setInterval(fetchPrices, PRICE_UPDATE_INTERVAL);
    const positionInterval = setInterval(fetchPositions, 30000);
    
    return () => {
      clearInterval(priceInterval);
      clearInterval(positionInterval);
    };
  }, [fetchPrices, fetchPositions, fetchBalance]);

  // Formatters - Institutional grade precision
  const formatPrice = (price) => {
    if (!price) return '$0.00';
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calcLiquidationPrice = () => {
    if (!currentPrice || !leverage) return 0;
    const liqDistance = currentPrice / leverage;
    return direction === 'LONG' 
      ? currentPrice - liqDistance * 0.9
      : currentPrice + liqDistance * 0.9;
  };

  const formatTimeAgo = (date) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  // Get price change color and arrow
  const getPriceChangeDisplay = (assetKey) => {
    const change = priceChanges[assetKey] || 0;
    if (Math.abs(change) < 0.001) return { color: '#888', arrow: '•', text: '0.00%' };
    if (change > 0) return { color: '#00ff88', arrow: '▲', text: `+${change.toFixed(2)}%` };
    return { color: '#ff4444', arrow: '▼', text: `${change.toFixed(2)}%` };
  };

  // ==================== COLLAPSED BUTTON ====================
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'fixed',
          bottom: '90px',
          left: '20px',
          zIndex: 9998,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFD700 0%, #B8860B 100%)',
          border: '2px solid #FFD700',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 4px 20px rgba(255, 215, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.3)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 215, 0, 0.6), 0 0 40px rgba(255, 215, 0, 0.4)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 215, 0, 0.5), 0 0 30px rgba(255, 215, 0, 0.3)';
        }}
        title="⚔️ Metal Perps Trading"
      >
        ⚔️
      </button>
    );
  }

  // ==================== EXPANDED WIDGET ====================
  return (
    <div style={{
      position: 'fixed',
      bottom: '90px',
      left: '20px',
      zIndex: 9998,
      width: '400px',
      maxHeight: '85vh',
      overflowY: 'auto',
      background: 'linear-gradient(145deg, #0a0a0a 0%, #0d0d0d 50%, #0a0a0a 100%)',
      border: '1px solid #B8860B',
      borderRadius: '16px',
      boxShadow: '0 0 60px rgba(255, 215, 0, 0.15), 0 20px 60px rgba(0, 0, 0, 0.5)',
      fontFamily: "'Rajdhani', sans-serif",
      color: '#fff',
    }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          borderRadius: '8px',
          background: toast.type === 'success' ? '#00ff88' : toast.type === 'error' ? '#ff4444' : '#FFD700',
          color: '#000',
          fontWeight: 600,
          fontSize: '12px',
          zIndex: 10000,
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'linear-gradient(180deg, rgba(255,215,0,0.1) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚔️</span>
          <div>
            <span style={{ 
              fontFamily: "'Orbitron', sans-serif", 
              fontWeight: 700, 
              fontSize: '14px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'block',
            }}>
              METAL PERPS
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <ArbitrumLogo size={12} />
              <span style={{ fontSize: '9px', color: '#12AAFF', fontWeight: 500 }}>Arbitrum</span>
              <span style={{ fontSize: '9px', color: '#444', marginLeft: '4px' }}>
                • {formatTimeAgo(lastUpdate)}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {balance !== null && (
            <span style={{ fontSize: '11px', color: '#888' }}>
              ${balance?.toFixed(2) || '0.00'}
            </span>
          )}
          <button
            onClick={() => setIsExpanded(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #2a2a2a' }}>
        {[
          { key: 'trade', label: '📈 Trade' },
          { key: 'positions', label: `📊 (${positions.length})` },
          { key: 'learn', label: '📚 Learn' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '10px 6px',
              background: activeTab === tab.key ? 'rgba(255,215,0,0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #FFD700' : '2px solid transparent',
              color: activeTab === tab.key ? '#FFD700' : '#888',
              cursor: 'pointer',
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 600,
              fontSize: '11px',
              textTransform: 'uppercase',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px' }}>
        {/* ==================== TRADE TAB ==================== */}
        {activeTab === 'trade' && (
          <>
            {/* Live Prices Bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '4px',
              marginBottom: '12px',
              padding: '8px',
              background: '#111',
              borderRadius: '8px',
              border: '1px solid #1a1a1a',
            }}>
              {Object.keys(ASSETS).map((key) => {
                const priceChange = getPriceChangeDisplay(key);
                const isFlashing = priceFlash[key];
                return (
                  <div 
                    key={key}
                    style={{
                      textAlign: 'center',
                      padding: '4px',
                      borderRadius: '4px',
                      background: isFlashing 
                        ? isFlashing === 'up' ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'
                        : 'transparent',
                      transition: 'background 0.3s',
                    }}
                  >
                    <div style={{ fontSize: '9px', color: '#666' }}>{key}</div>
                    <div style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: '#fff',
                      fontFamily: "'Orbitron', sans-serif",
                    }}>
                      ${prices[key]?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </div>
                    <div style={{ 
                      fontSize: '8px', 
                      color: priceChange.color,
                      fontWeight: 600,
                    }}>
                      {priceChange.arrow} {priceChange.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Asset Selection */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '16px',
            }}>
              {Object.keys(ASSETS).map((key) => {
                const priceChange = getPriceChangeDisplay(key);
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedAsset(key);
                      setLeverage(Math.min(leverage, ASSETS[key].maxLev));
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: selectedAsset === key ? '2px solid #FFD700' : '1px solid #2a2a2a',
                      background: selectedAsset === key 
                        ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(184,134,11,0.1))'
                        : '#1a1a1a',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      position: 'relative',
                    }}
                  >
                    <img 
                      src={ASSET_IMAGES[key]} 
                      alt={key}
                      style={{ width: '24px', height: '24px', borderRadius: '50%' }}
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 600,
                      color: selectedAsset === key ? '#FFD700' : '#888',
                    }}>
                      {key}
                    </span>
                    {/* Live indicator dot */}
                    <div style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: priceChange.color,
                      animation: 'pulse 2s infinite',
                    }} />
                  </button>
                );
              })}
            </div>

            {/* Price Display */}
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: priceFlash[selectedAsset] 
                ? priceFlash[selectedAsset] === 'up' 
                  ? 'linear-gradient(135deg, rgba(0,255,136,0.15), #1a1a1a)'
                  : 'linear-gradient(135deg, rgba(255,68,68,0.15), #1a1a1a)'
                : '#1a1a1a',
              borderRadius: '8px',
              marginBottom: '16px',
              transition: 'background 0.3s',
              border: `1px solid ${priceFlash[selectedAsset] ? (priceFlash[selectedAsset] === 'up' ? '#00ff88' : '#ff4444') : '#2a2a2a'}`,
            }}>
              <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                {asset.name} Price
                <span style={{ 
                  marginLeft: '8px', 
                  color: getPriceChangeDisplay(selectedAsset).color,
                  fontWeight: 600,
                }}>
                  {getPriceChangeDisplay(selectedAsset).arrow} {getPriceChangeDisplay(selectedAsset).text}
                </span>
              </div>
              <div style={{ 
                fontSize: '28px', 
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
                color: '#FFD700',
                textShadow: priceFlash[selectedAsset] 
                  ? priceFlash[selectedAsset] === 'up'
                    ? '0 0 20px rgba(0,255,136,0.5)'
                    : '0 0 20px rgba(255,68,68,0.5)'
                  : 'none',
                transition: 'text-shadow 0.3s',
              }}>
                {formatPrice(currentPrice)}
              </div>
              {isCommodity && (
                <div style={{
                  fontSize: '10px',
                  color: marketOpen ? '#00ff88' : '#ff4444',
                  marginTop: '4px',
                }}>
                  {marketOpen ? '● Market Open' : '● Market Closed (Weekend)'}
                </div>
              )}
              <div style={{ fontSize: '9px', color: '#444', marginTop: '4px' }}>
                🔴 LIVE • Updates every 2s
              </div>
            </div>

            {/* Direction */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '16px',
            }}>
              {['LONG', 'SHORT'].map((dir) => (
                <button
                  key={dir}
                  onClick={() => setDirection(dir)}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: direction === dir
                      ? dir === 'LONG' 
                        ? 'linear-gradient(135deg, #00ff88, #00aa55)'
                        : 'linear-gradient(135deg, #ff4444, #aa2222)'
                      : '#1a1a1a',
                    color: direction === dir ? '#000' : '#888',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {dir === 'LONG' ? '📈' : '📉'} {dir}
                </button>
              ))}
            </div>

            {/* Collateral Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', color: '#888', marginBottom: '6px', display: 'block' }}>
                Collateral (USDC) - Min $5 • <span style={{ color: '#FFD700' }}>1% fee applied</span>
              </label>
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                placeholder="50"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #2a2a2a',
                  background: '#1a1a1a',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {parseFloat(collateral) >= 5 && (
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
                  Fee: ${(parseFloat(collateral) * 0.01).toFixed(2)} • Net: ${(parseFloat(collateral) * 0.99).toFixed(2)}
                </div>
              )}
            </div>

            {/* Leverage Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '11px', color: '#888' }}>Leverage</label>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 700, 
                  color: leverage > 50 ? '#ff4444' : leverage > 25 ? '#FFA500' : '#FFD700',
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                  {leverage}x
                </span>
              </div>
              <input
                type="range"
                min={asset.minLev}
                max={asset.maxLev}
                step={asset.maxLev > 50 ? 1 : 0.5}
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #FFD700 0%, #FFD700 ${((leverage - asset.minLev) / (asset.maxLev - asset.minLev)) * 100}%, #2a2a2a ${((leverage - asset.minLev) / (asset.maxLev - asset.minLev)) * 100}%, #2a2a2a 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '9px', color: '#666' }}>{asset.minLev}x</span>
                <span style={{ fontSize: '9px', color: '#666' }}>{asset.maxLev}x</span>
              </div>
            </div>

            {/* Position Summary */}
            <div style={{
              padding: '12px',
              background: '#1a1a1a',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '11px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#888' }}>Position Size</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>${positionSize.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>Liq. Price</span>
                <span style={{ color: '#ff4444', fontWeight: 600 }}>{formatPrice(calcLiquidationPrice())}</span>
              </div>
            </div>

            {/* Open Trade Button */}
            <button
              onClick={openTrade}
              disabled={loading || !marketOpen || parseFloat(collateral) < 5}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: loading || !marketOpen || parseFloat(collateral) < 5
                  ? '#333'
                  : direction === 'LONG'
                    ? 'linear-gradient(135deg, #00ff88, #00aa55)'
                    : 'linear-gradient(135deg, #ff4444, #aa2222)',
                color: loading || !marketOpen ? '#666' : '#000',
                cursor: loading || !marketOpen || parseFloat(collateral) < 5 ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: '14px',
                fontFamily: "'Rajdhani', sans-serif",
              }}
            >
              {loading ? '⏳ Processing...' : `Open ${direction}`}
            </button>
          </>
        )}

        {/* ==================== POSITIONS TAB ==================== */}
        {activeTab === 'positions' && (
          <div>
            {positions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <div>No open positions</div>
              </div>
            ) : (
              positions.map((pos, idx) => (
                <div key={idx} style={{
                  padding: '12px',
                  background: '#1a1a1a',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  border: '1px solid #2a2a2a',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: '#FFD700' }}>
                      {pos.pairIndex === 0 ? 'BTC' : pos.pairIndex === 1 ? 'ETH' : pos.pairIndex === 90 ? 'GOLD' : 'SILVER'}
                    </span>
                    <span style={{ 
                      color: pos.long ? '#00ff88' : '#ff4444',
                      fontWeight: 600,
                      fontSize: '12px',
                    }}>
                      {pos.long ? '📈 LONG' : '📉 SHORT'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                    <div>Size: ${(pos.positionSizeUsd || 0).toFixed(2)}</div>
                    <div>Leverage: {pos.leverage || 'N/A'}x</div>
                  </div>
                  <button
                    onClick={() => closePosition(idx)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #ff4444',
                      background: 'transparent',
                      color: '#ff4444',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Close Position
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ==================== LEARN TAB ==================== */}
        {activeTab === 'learn' && (
          <div style={{ fontSize: '12px', lineHeight: 1.6 }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(18,170,255,0.05))',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              border: '1px solid rgba(255,215,0,0.2)',
            }}>
              <h3 style={{ color: '#FFD700', margin: '0 0 12px 0', fontSize: '14px' }}>
                ⚔️ What is Metal Perps?
              </h3>
              <p style={{ color: '#ccc', margin: 0 }}>
                Trade <strong style={{ color: '#FFD700' }}>perpetual futures</strong> on crypto & metals with up to <strong style={{ color: '#00ff88' }}>150x leverage</strong>.
              </p>
            </div>

            <div style={{
              background: '#1a1a1a',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
            }}>
              <h3 style={{ color: '#FFD700', margin: '0 0 12px 0', fontSize: '14px' }}>📖 Quick Guide</h3>
              <div style={{ color: '#aaa' }}>
                <div style={{ marginBottom: '8px' }}><span style={{ color: '#00ff88' }}>1.</span> <strong>LONG</strong> = bet price goes UP</div>
                <div style={{ marginBottom: '8px' }}><span style={{ color: '#00ff88' }}>2.</span> <strong>SHORT</strong> = bet price goes DOWN</div>
                <div style={{ marginBottom: '8px' }}><span style={{ color: '#00ff88' }}>3.</span> <strong>Leverage</strong> = multiplies your position</div>
                <div><span style={{ color: '#ff4444' }}>⚠️</span> Higher leverage = higher risk!</div>
              </div>
            </div>

            <div style={{
              background: 'rgba(255,68,68,0.1)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              border: '1px solid rgba(255,68,68,0.3)',
            }}>
              <h3 style={{ color: '#ff4444', margin: '0 0 8px 0', fontSize: '14px' }}>⚠️ Risk Warning</h3>
              <p style={{ color: '#ffaaaa', margin: 0, fontSize: '11px' }}>
                Leveraged trading is <strong>HIGH RISK</strong>. You can lose your entire collateral.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,215,0,0.1)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px',
              border: '1px solid rgba(255,215,0,0.3)',
            }}>
              <h3 style={{ color: '#FFD700', margin: '0 0 8px 0', fontSize: '14px' }}>💰 1% Fee</h3>
              <p style={{ color: '#ccc', margin: 0, fontSize: '11px' }}>
                1% of every trade goes to the DTGC Metals Treasury for ecosystem growth.
              </p>
            </div>

            <a
              href="/docs/MetalPerps_Whitepaper.pdf"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '14px',
                background: 'linear-gradient(135deg, #FFD700, #B8860B)',
                borderRadius: '8px',
                color: '#000',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: '13px',
              }}
            >
              📄 Download Full Whitepaper (PDF)
            </a>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '9px',
        color: '#444',
      }}>
        <span>Powered by gTrade Protocol</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#00ff88',
            animation: 'pulse 2s infinite',
          }} />
          <span>LIVE</span>
          <ArbitrumLogo size={10} />
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
