import React, { useState, useEffect, useRef } from 'react';

// ==================== CONFIGURATION ====================
const LAMBDA_URL = 'https://kz45776mye3b2ywtra43m4wwl40hmrdu.lambda-url.us-east-2.on.aws/';

// TradingView symbols for each asset
const TV_SYMBOLS = {
  BTC: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
  GOLD: 'TVC:GOLD',
  SILVER: 'TVC:SILVER',
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

// TradingView Mini Symbol Overview - Shows live price + mini chart
const TradingViewMiniSymbol = ({ symbol, height = 220 }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      height: height,
      locale: 'en',
      dateRange: '1D',
      colorTheme: 'dark',
      isTransparent: true,
      autosize: false,
      largeChartUrl: '',
    });
    
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);
    container.appendChild(script);
    
    containerRef.current.appendChild(container);
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol, height]);
  
  return <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />;
};

// TradingView Ticker Tape - Live scrolling prices
const TradingViewTickerTape = () => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'BINANCE:BTCUSDT', title: 'BTC' },
        { proName: 'BINANCE:ETHUSDT', title: 'ETH' },
        { proName: 'TVC:GOLD', title: 'GOLD' },
        { proName: 'TVC:SILVER', title: 'SILVER' },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'compact',
      colorTheme: 'dark',
      locale: 'en',
    });
    
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);
    container.appendChild(script);
    
    containerRef.current.appendChild(container);
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);
  
  return <div ref={containerRef} style={{ height: '46px', width: '100%', overflow: 'hidden' }} />;
};

// TradingView Symbol Info - Large price display with change
const TradingViewSymbolInfo = ({ symbol }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol: symbol,
      width: '100%',
      locale: 'en',
      colorTheme: 'dark',
      isTransparent: true,
    });
    
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);
    container.appendChild(script);
    
    containerRef.current.appendChild(container);
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol]);
  
  return <div ref={containerRef} style={{ height: '110px', width: '100%' }} />;
};

export default function MetalPerpsWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('trade');
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [direction, setDirection] = useState('LONG');
  const [collateral, setCollateral] = useState('50');
  const [leverage, setLeverage] = useState(10);
  const [positions, setPositions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const asset = ASSETS[selectedAsset];
  const tvSymbol = TV_SYMBOLS[selectedAsset];
  const positionSize = parseFloat(collateral || 0) * leverage;

  // Check if commodity market is open
  const isMarketOpen = () => {
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcHour = now.getUTCHours();
    if (utcDay === 6) return false;
    if (utcDay === 0 && utcHour < 22) return false;
    if (utcDay === 5 && utcHour >= 22) return false;
    return true;
  };

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

  // Fetch positions
  const fetchPositions = async () => {
    try {
      const result = await apiCall('POSITIONS');
      if (result.positions) setPositions(result.positions);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  // Fetch balance
  const fetchBalance = async () => {
    try {
      const result = await apiCall('BALANCE');
      if (result.balance !== undefined) setBalance(result.balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

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
        collateral: parseFloat(collateral),
        leverage,
      });
      if (result.success) {
        showToast(`${direction} position opened!`, 'success');
        fetchPositions();
        fetchBalance();
      } else {
        showToast(result.error || 'Failed to open trade', 'error');
      }
    } catch (error) {
      showToast('Failed to open trade', 'error');
    }
    setLoading(false);
  };

  const closeTrade = async (positionId) => {
    setLoading(true);
    try {
      const result = await apiCall('CLOSE_TRADE', { positionId });
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

  // Initial fetch
  useEffect(() => {
    fetchPositions();
    fetchBalance();
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  // Collapsed State - Floating Button
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'fixed',
          bottom: '100px',
          left: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #FFD700, #FFA500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(255, 215, 0, 0.4)',
          zIndex: 9999,
          transition: 'all 0.3s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 215, 0, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 215, 0, 0.4)';
        }}
      >
        <span style={{ fontSize: '24px' }}>📊</span>
      </div>
    );
  }

  // Expanded State
  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      left: '20px',
      width: '420px',
      maxHeight: '90vh',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 215, 0, 0.2)',
      zIndex: 9999,
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(0, 0, 0, 0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>⚔️</span>
          <div>
            <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '14px', fontFamily: "'Orbitron', sans-serif" }}>
              METAL PERPS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#888' }}>
              <ArbitrumLogo size={12} />
              <span style={{ color: '#12AAFF' }}>Arbitrum</span>
              <span>• TradingView Live</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px',
          }}
        >
          ×
        </button>
      </div>

      {/* Live Ticker Tape */}
      <div style={{
        borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        <TradingViewTickerTape />
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
      }}>
        {[
          { id: 'trade', label: '📈 TRADE' },
          { id: 'positions', label: `📊 (${positions.length})` },
          { id: 'learn', label: '🎓 LEARN' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '10px',
              background: activeTab === tab.id ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #FFD700' : '2px solid transparent',
              color: activeTab === tab.id ? '#FFD700' : '#666',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 'calc(90vh - 150px)' }}>
        {activeTab === 'trade' && (
          <div style={{ padding: '12px' }}>
            {/* Asset Selection */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginBottom: '12px',
            }}>
              {Object.keys(ASSETS).map(key => (
                <button
                  key={key}
                  onClick={() => setSelectedAsset(key)}
                  style={{
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: selectedAsset === key ? '2px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: selectedAsset === key 
                      ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.1))'
                      : 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <img 
                    src={ASSET_IMAGES[key]} 
                    alt={key}
                    style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 600,
                    color: selectedAsset === key ? '#FFD700' : '#888',
                  }}>
                    {key}
                  </span>
                </button>
              ))}
            </div>

            {/* TradingView Mini Symbol Overview - Live Price + Chart */}
            <div style={{
              marginBottom: '12px',
              borderRadius: '10px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 215, 0, 0.2)',
              background: 'rgba(0, 0, 0, 0.3)',
            }}>
              <TradingViewMiniSymbol symbol={tvSymbol} height={220} />
              {isCommodity && (
                <div style={{
                  padding: '8px 12px',
                  fontSize: '10px',
                  color: marketOpen ? '#00ff88' : '#ff4444',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                }}>
                  {marketOpen ? '● Market Open' : '● Market Closed (Weekend)'}
                </div>
              )}
            </div>

            {/* Direction Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={() => setDirection('LONG')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: direction === 'LONG' 
                    ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: direction === 'LONG' ? '#000' : '#666',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                }}
              >
                📈 LONG
              </button>
              <button
                onClick={() => setDirection('SHORT')}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: direction === 'SHORT'
                    ? 'linear-gradient(135deg, #ff4444, #cc0000)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: direction === 'SHORT' ? '#fff' : '#666',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '13px',
                  transition: 'all 0.2s',
                }}
              >
                📉 SHORT
              </button>
            </div>

            {/* Collateral Input */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '6px',
                fontSize: '11px',
              }}>
                <span style={{ color: '#888' }}>Collateral (USDC) - Min $5</span>
                <span style={{ color: '#ff6b6b' }}>• 1% fee applied</span>
              </div>
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                min="5"
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: 600,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginTop: '4px',
                fontSize: '10px',
                color: '#666',
              }}>
                <span>Fee: ${(parseFloat(collateral || 0) * 0.01).toFixed(2)}</span>
                <span>Net: ${(parseFloat(collateral || 0) * 0.99).toFixed(2)}</span>
              </div>
            </div>

            {/* Leverage Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '8px',
              }}>
                <span style={{ color: '#888', fontSize: '11px' }}>Leverage</span>
                <span style={{ 
                  color: '#FFD700', 
                  fontWeight: 700, 
                  fontSize: '14px',
                  fontFamily: "'Orbitron', sans-serif",
                }}>
                  {leverage}x
                </span>
              </div>
              <input
                type="range"
                min={asset.minLev}
                max={asset.maxLev}
                step="0.1"
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  background: `linear-gradient(to right, #FFD700 0%, #FFD700 ${((leverage - asset.minLev) / (asset.maxLev - asset.minLev)) * 100}%, #333 ${((leverage - asset.minLev) / (asset.maxLev - asset.minLev)) * 100}%, #333 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                }}
              />
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '9px',
                color: '#555',
                marginTop: '4px',
              }}>
                <span>{asset.minLev}x</span>
                <span>{asset.maxLev}x</span>
              </div>
            </div>

            {/* Position Info */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '12px',
              fontSize: '11px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Position Size</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>
                  ${positionSize.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Open Trade Button */}
            <button
              onClick={openTrade}
              disabled={loading || !marketOpen || parseFloat(collateral) < 5}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '10px',
                border: 'none',
                background: !marketOpen 
                  ? '#333'
                  : direction === 'LONG'
                    ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                    : 'linear-gradient(135deg, #ff4444, #cc0000)',
                color: direction === 'LONG' ? '#000' : '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: loading || !marketOpen ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              {loading ? '⏳ Processing...' : `Market ${direction}`}
            </button>

            {/* One-Click Trading Setup */}
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(255, 215, 0, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 215, 0, 0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#FFD700', fontSize: '11px', fontWeight: 600 }}>
                  ⚡ ONE-CLICK TRADING
                </span>
                <span style={{ color: '#00ff88', fontSize: '10px' }}>
                  SETUP →
                </span>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div style={{ padding: '12px' }}>
            {positions.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 20px',
                color: '#666',
              }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '13px' }}>No open positions</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>
                  Open a trade to get started
                </div>
              </div>
            ) : (
              positions.map((pos, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#fff', fontWeight: 600 }}>
                      {pos.asset} {pos.direction}
                    </span>
                    <span style={{ 
                      color: pos.pnl >= 0 ? '#00ff88' : '#ff4444',
                      fontWeight: 600,
                    }}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnl?.toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                    Size: ${pos.size?.toLocaleString()} • Leverage: {pos.leverage}x
                  </div>
                  <button
                    onClick={() => closeTrade(pos.id)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #ff4444',
                      background: 'transparent',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '11px',
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

        {activeTab === 'learn' && (
          <div style={{ padding: '16px' }}>
            <div style={{ 
              background: 'rgba(255, 215, 0, 0.1)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '12px',
            }}>
              <h3 style={{ color: '#FFD700', margin: '0 0 8px 0', fontSize: '14px' }}>
                🎓 Trading Guide
              </h3>
              <p style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                Metal Perps lets you trade BTC, ETH, Gold, and Silver with up to 150x leverage 
                on Arbitrum via gTrade.
              </p>
            </div>
            
            <div style={{ fontSize: '12px', color: '#888' }}>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#FFD700' }}>📈 Long</strong>: Profit when price goes up
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#FFD700' }}>📉 Short</strong>: Profit when price goes down
              </div>
              <div style={{ marginBottom: '12px' }}>
                <strong style={{ color: '#FFD700' }}>⚡ Leverage</strong>: Multiply your position size
              </div>
              <div>
                <strong style={{ color: '#ff4444' }}>⚠️ Risk</strong>: Higher leverage = higher liquidation risk
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ff4444' : toast.type === 'success' ? '#00ff88' : '#FFD700',
          color: toast.type === 'success' ? '#000' : '#fff',
          padding: '10px 20px',
          borderRadius: '8px',
          fontSize: '12px',
          fontWeight: 600,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          zIndex: 10000,
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
