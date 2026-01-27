import React, { useState, useEffect, useRef } from 'react';

// ==================== CONFIGURATION ====================
const LAMBDA_URL = 'https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/';

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
      colorTheme: 'dark',
      isTransparent: true,
      displayMode: 'adaptive',
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
  
  return <div ref={containerRef} style={{ height: '46px', width: '100%' }} />;
};

// TradingView Technical Analysis Widget
const TradingViewAnalysis = ({ symbol }) => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      interval: '1h',
      width: '100%',
      isTransparent: true,
      height: 110,
      symbol: symbol,
      showIntervalTabs: false,
      displayMode: 'single',
      locale: 'en',
      colorTheme: 'dark',
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

// Bot Activity Item Component
const BotActivityItem = ({ activity }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'OPEN_LONG': return '🟢';
      case 'OPEN_SHORT': return '🔴';
      case 'CLOSE': return '⚪';
      case 'TP_HIT': return '🎯';
      case 'SL_HIT': return '🛑';
      case 'SCALP': return '⚡';
      case 'CYCLE': return '🔄';
      default: return '📊';
    }
  };
  
  const getColor = (type) => {
    switch (type) {
      case 'OPEN_LONG': case 'TP_HIT': case 'SCALP': return '#00ff88';
      case 'OPEN_SHORT': case 'SL_HIT': return '#ff4444';
      default: return '#888';
    }
  };
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '8px 10px',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '6px',
      marginBottom: '6px',
      fontSize: '11px',
    }}>
      <span style={{ marginRight: '8px', fontSize: '14px' }}>{getIcon(activity.type)}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: getColor(activity.type), fontWeight: 600 }}>
          {activity.message}
        </div>
        {activity.details && (
          <div style={{ color: '#666', fontSize: '10px', marginTop: '2px' }}>
            {activity.details}
          </div>
        )}
      </div>
      <div style={{ color: '#555', fontSize: '9px' }}>
        {activity.time}
      </div>
    </div>
  );
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
  
  // Order type and advanced options
  const [orderType, setOrderType] = useState('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Bot status and activity
  const [botStatus, setBotStatus] = useState(null);
  const [botActivity, setBotActivity] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

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

  // Fetch bot status
  const fetchBotStatus = async () => {
    try {
      const result = await apiCall('STATUS');
      if (result.success) {
        setBotStatus({
          wallet: result.wallet,
          balance: result.balance,
          positions: result.positions,
        });
        setLastUpdate(new Date().toLocaleTimeString());
        
        // Update shared balance and positions
        if (result.balance !== undefined) setBalance(result.balance);
        if (result.positions) setPositions(result.positions);
        
        // Generate activity from positions
        const activities = [];
        if (result.positions && result.positions.length > 0) {
          result.positions.forEach(pos => {
            activities.push({
              type: pos.long ? 'OPEN_LONG' : 'OPEN_SHORT',
              message: `${pos.asset} ${pos.long ? 'LONG' : 'SHORT'} ${pos.leverage}x`,
              details: `$${pos.collateral?.toFixed(2)} @ $${pos.openPrice?.toFixed(2)}`,
              time: 'Active',
            });
          });
        }
        
        // Add cycle activity
        activities.unshift({
          type: 'CYCLE',
          message: 'Bot cycle completed',
          details: `${result.positions?.length || 0} active positions`,
          time: new Date().toLocaleTimeString(),
        });
        
        setBotActivity(prev => {
          const newActivity = [...activities, ...prev].slice(0, 20);
          return newActivity;
        });
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
      setBotActivity(prev => [{
        type: 'ERROR',
        message: 'Connection error',
        details: error.message,
        time: new Date().toLocaleTimeString(),
      }, ...prev].slice(0, 20));
    }
  };

  // Trade functions
  const openTrade = async () => {
    if (!marketOpen) {
      showToast('Market closed for commodities', 'error');
      return;
    }
    
    if (orderType === 'LIMIT' && !limitPrice) {
      showToast('Please enter a limit price', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const tradeParams = {
        asset: selectedAsset,
        direction,
        collateral: parseFloat(collateral),
        leverage,
        orderType,
      };
      
      if (orderType === 'LIMIT' && limitPrice) {
        tradeParams.limitPrice = parseFloat(limitPrice);
      }
      if (takeProfit) {
        tradeParams.takeProfit = parseFloat(takeProfit);
      }
      if (stopLoss) {
        tradeParams.stopLoss = parseFloat(stopLoss);
      }
      
      const result = await apiCall('OPEN_TRADE', tradeParams);
      
      if (result.success) {
        const orderTypeLabel = orderType === 'LIMIT' ? 'Limit order placed' : `${direction} position opened`;
        showToast(`${orderTypeLabel}!`, 'success');
        fetchPositions();
        fetchBalance();
        setTakeProfit('');
        setStopLoss('');
        if (orderType === 'LIMIT') setLimitPrice('');
        
        // Add to activity
        setBotActivity(prev => [{
          type: direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
          message: `Manual ${selectedAsset} ${direction}`,
          details: `$${collateral} @ ${leverage}x`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));
      } else {
        showToast(result.error || 'Failed to open trade', 'error');
      }
    } catch (error) {
      showToast('Failed to open trade', 'error');
    }
    setLoading(false);
  };

  const closeTrade = async (tradeIndex) => {
    setLoading(true);
    try {
      const result = await apiCall('CLOSE_TRADE', { tradeIndex });
      if (result.success) {
        showToast('Position closed!', 'success');
        fetchPositions();
        fetchBalance();
        
        setBotActivity(prev => [{
          type: 'CLOSE',
          message: `Closed position #${tradeIndex}`,
          details: `TX: ${result.txHash?.slice(0, 10)}...`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));
      } else {
        showToast(result.error || 'Failed to close trade', 'error');
      }
    } catch (error) {
      showToast('Failed to close trade', 'error');
    }
    setLoading(false);
  };

  // Initial load and polling
  useEffect(() => {
    fetchBotStatus();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchBotStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '380px',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 215, 0, 0.1)',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        border: '1px solid rgba(255, 215, 0, 0.2)',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 140, 0, 0.1) 100%)',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255, 215, 0, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
            }}
          >
            <span style={{ fontSize: '20px' }}>⚡</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>
              METAL PERPS
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: '#FFD700', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              marginTop: '2px',
            }}>
              <ArbitrumLogo size={12} />
              <span>Arbitrum • gTrade</span>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ 
            color: '#FFD700', 
            fontWeight: 700, 
            fontSize: '14px',
            fontFamily: "'Orbitron', sans-serif",
          }}>
            {balance !== null ? `$${balance.toFixed(2)}` : '---'}
          </div>
          <div style={{ color: '#888', fontSize: '10px' }}>USDC Balance</div>
        </div>
      </div>

      {/* Live Ticker */}
      <TradingViewTickerTape />

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
        }}
      >
        {[
          { id: 'trade', label: '📈 Trade' },
          { id: 'positions', label: '💼 Positions' },
          { id: 'bot', label: '🤖 Bot' },
          { id: 'learn', label: '📚 Learn' },
        ].map((tab) => (
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
            {tab.id === 'positions' && positions.length > 0 && (
              <span style={{
                marginLeft: '4px',
                background: '#FFD700',
                color: '#000',
                borderRadius: '4px',
                padding: '1px 5px',
                fontSize: '9px',
              }}>
                {positions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'trade' && (
        <div style={{ padding: '12px' }}>
          {/* Asset Selection */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {Object.keys(ASSETS).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedAsset(key)}
                  style={{
                    flex: 1,
                    padding: '10px 8px',
                    borderRadius: '10px',
                    border: selectedAsset === key ? '2px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: selectedAsset === key ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 0, 0, 0.2)',
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
                    style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: key === 'GOLD' || key === 'SILVER' ? '4px' : '50%',
                    }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <span style={{ 
                    color: selectedAsset === key ? '#FFD700' : '#888',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}>
                    {key}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            overflow: 'hidden',
            marginBottom: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <TradingViewMiniSymbol symbol={tvSymbol} height={200} />
          </div>

          {/* Direction Toggle */}
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            marginBottom: '12px',
          }}>
            <button
              onClick={() => setDirection('LONG')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: direction === 'LONG' ? '2px solid #00ff88' : '1px solid rgba(0, 255, 136, 0.2)',
                background: direction === 'LONG' ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
                color: direction === 'LONG' ? '#00ff88' : '#555',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>📈</span> LONG
            </button>
            <button
              onClick={() => setDirection('SHORT')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: direction === 'SHORT' ? '2px solid #ff4444' : '1px solid rgba(255, 68, 68, 0.2)',
                background: direction === 'SHORT' ? 'rgba(255, 68, 68, 0.15)' : 'transparent',
                color: direction === 'SHORT' ? '#ff4444' : '#555',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>📉</span> SHORT
            </button>
          </div>

          {/* Order Type Toggle */}
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            marginBottom: '12px',
          }}>
            {['MARKET', 'LIMIT'].map((type) => (
              <button
                key={type}
                onClick={() => setOrderType(type)}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: orderType === type ? '1px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: orderType === type ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                  color: orderType === type ? '#FFD700' : '#666',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
              >
                {type === 'MARKET' ? '⚡ Market' : '📋 Limit'}
              </button>
            ))}
          </div>

          {/* Limit Price Input (if LIMIT order) */}
          {orderType === 'LIMIT' && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}>
                <span style={{ color: '#888', fontSize: '11px' }}>Limit Price (USD)</span>
              </div>
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder="Enter limit price..."
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#FFD700',
                  fontSize: '16px',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: "'Orbitron', sans-serif",
                }}
              />
            </div>
          )}

          {/* Collateral Input */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}>
              <span style={{ color: '#888', fontSize: '11px' }}>Collateral (USDC)</span>
              <span style={{ 
                color: '#FFD700', 
                fontSize: '11px',
                cursor: 'pointer',
              }} onClick={() => balance && setCollateral(Math.floor(balance).toString())}>
                Max: ${balance?.toFixed(2) || '0.00'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#FFD700',
                  fontSize: '18px',
                  fontWeight: 700,
                  outline: 'none',
                  fontFamily: "'Orbitron', sans-serif",
                }}
              />
              <div style={{
                padding: '12px 16px',
                borderRadius: '10px',
                background: 'rgba(255, 215, 0, 0.1)',
                color: '#FFD700',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
              }}>
                USDC
              </div>
            </div>
            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {['25', '50', '100', '250'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setCollateral(amt)}
                  style={{
                    flex: 1,
                    padding: '6px',
                    borderRadius: '6px',
                    border: collateral === amt ? '1px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                    background: collateral === amt ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                    color: collateral === amt ? '#FFD700' : '#666',
                    cursor: 'pointer',
                    fontSize: '10px',
                    fontWeight: 600,
                  }}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Leverage Slider */}
          <div style={{ marginBottom: '12px' }}>
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

          {/* TP/SL Toggle */}
          <div style={{ marginBottom: '12px' }}>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                background: showAdvanced ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                color: showAdvanced ? '#FFD700' : '#888',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>🎯 Take Profit / Stop Loss</span>
              <span style={{ fontSize: '10px' }}>{showAdvanced ? '▲ Hide' : '▼ Show'}</span>
            </button>
            
            {showAdvanced && (
              <div style={{ 
                marginTop: '10px', 
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 215, 0, 0.1)',
              }}>
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '6px',
                    fontSize: '11px',
                  }}>
                    <span style={{ color: '#00ff88' }}>🎯 Take Profit (%)</span>
                  </div>
                  <input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="e.g. 5 for +5%"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(0, 255, 136, 0.3)',
                      background: 'rgba(0, 0, 0, 0.4)',
                      color: '#00ff88',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                
                <div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '6px',
                    fontSize: '11px',
                  }}>
                    <span style={{ color: '#ff4444' }}>🛑 Stop Loss (%)</span>
                  </div>
                  <input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="e.g. 3 for -3%"
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 68, 68, 0.3)',
                      background: 'rgba(0, 0, 0, 0.4)',
                      color: '#ff4444',
                      fontSize: '13px',
                      fontWeight: 600,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Position Size Display */}
          <div style={{
            background: 'rgba(255, 215, 0, 0.08)',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid rgba(255, 215, 0, 0.15)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#888', fontSize: '11px' }}>Position Size</span>
              <span style={{ 
                color: '#FFD700', 
                fontWeight: 700,
                fontFamily: "'Orbitron', sans-serif",
              }}>
                ${positionSize.toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888', fontSize: '11px' }}>Max {asset.maxLev}x</span>
              <span style={{ color: '#666', fontSize: '10px' }}>
                Liq. price varies by market
              </span>
            </div>
          </div>

          {/* Market Status Warning */}
          {isCommodity && !marketOpen && (
            <div style={{
              background: 'rgba(255, 68, 68, 0.1)',
              border: '1px solid rgba(255, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '12px',
              textAlign: 'center',
            }}>
              <span style={{ color: '#ff4444', fontSize: '11px' }}>
                ⚠️ Commodity markets closed (Opens Sun 22:00 UTC)
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={openTrade}
            disabled={loading || !marketOpen || (orderType === 'LIMIT' && !limitPrice)}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: !marketOpen 
                ? '#333'
                : orderType === 'LIMIT'
                  ? 'linear-gradient(135deg, #00BFFF, #0080FF)'
                  : direction === 'LONG'
                    ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                    : 'linear-gradient(135deg, #ff4444, #cc0000)',
              color: orderType === 'LIMIT' ? '#fff' : (direction === 'LONG' ? '#000' : '#fff'),
              fontWeight: 700,
              fontSize: '14px',
              cursor: loading || !marketOpen || (orderType === 'LIMIT' && !limitPrice) ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Processing...' : orderType === 'LIMIT' 
              ? `📋 Place Limit ${direction}` 
              : `⚡ Market ${direction}`}
          </button>
        </div>
      )}

      {activeTab === 'positions' && (
        <div style={{ padding: '12px' }}>
          {/* Refresh button */}
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={fetchBotStatus}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                background: 'transparent',
                color: '#FFD700',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 600,
              }}
            >
              🔄 Refresh
            </button>
          </div>
          
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
                  <span style={{ color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: pos.long ? '#00ff88' : '#ff4444' }}>
                      {pos.long ? '📈' : '📉'}
                    </span>
                    {pos.asset} {pos.long ? 'LONG' : 'SHORT'}
                  </span>
                  <span style={{ 
                    color: '#FFD700',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}>
                    {pos.leverage}x
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
                  <div>Collateral: ${pos.collateral?.toFixed(2)}</div>
                  <div>Size: ${pos.positionSize?.toFixed(2)}</div>
                  <div>Entry: ${pos.openPrice?.toFixed(2)}</div>
                  {pos.tp > 0 && <span style={{ color: '#00ff88' }}> TP: ${pos.tp.toFixed(2)}</span>}
                  {pos.sl > 0 && <span style={{ color: '#ff4444' }}> SL: ${pos.sl.toFixed(2)}</span>}
                </div>
                <button
                  onClick={() => closeTrade(pos.index)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px solid #ff4444',
                    background: 'transparent',
                    color: '#ff4444',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {loading ? '⏳...' : '✕ Close Position'}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* BOT TAB - Live Activity Feed */}
      {activeTab === 'bot' && (
        <div style={{ padding: '12px' }}>
          {/* Bot Status Header */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(255, 215, 0, 0.1))',
            borderRadius: '10px',
            padding: '12px',
            marginBottom: '12px',
            border: '1px solid rgba(0, 255, 136, 0.2)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ 
                  color: '#00ff88', 
                  fontWeight: 700, 
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#00ff88',
                    boxShadow: '0 0 10px #00ff88',
                    animation: 'pulse 2s infinite',
                  }} />
                  🤖 PHANTOM EDGE
                </div>
                <div style={{ color: '#888', fontSize: '10px', marginTop: '4px' }}>
                  Auto-trading metals 24/7
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '13px' }}>
                  {botStatus?.balance ? `$${botStatus.balance.toFixed(2)}` : '---'}
                </div>
                <div style={{ color: '#666', fontSize: '9px' }}>
                  {lastUpdate ? `Updated ${lastUpdate}` : 'Loading...'}
                </div>
              </div>
            </div>
          </div>

          {/* Active Positions Summary */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <div style={{
              flex: 1,
              background: 'rgba(0, 255, 136, 0.1)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#00ff88', fontSize: '18px', fontWeight: 700 }}>
                {botStatus?.positions?.filter(p => p.long).length || 0}
              </div>
              <div style={{ color: '#888', fontSize: '9px' }}>LONGS</div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(255, 68, 68, 0.1)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#ff4444', fontSize: '18px', fontWeight: 700 }}>
                {botStatus?.positions?.filter(p => !p.long).length || 0}
              </div>
              <div style={{ color: '#888', fontSize: '9px' }}>SHORTS</div>
            </div>
            <div style={{
              flex: 1,
              background: 'rgba(255, 215, 0, 0.1)',
              borderRadius: '8px',
              padding: '10px',
              textAlign: 'center',
            }}>
              <div style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700 }}>
                {botStatus?.positions?.length || 0}
              </div>
              <div style={{ color: '#888', fontSize: '9px' }}>TOTAL</div>
            </div>
          </div>

          {/* Activity Feed */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '10px',
            padding: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '10px',
            }}>
              <span style={{ color: '#888', fontSize: '11px', fontWeight: 600 }}>
                📊 LIVE ACTIVITY
              </span>
              <button
                onClick={fetchBotStatus}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  background: 'transparent',
                  color: '#FFD700',
                  cursor: 'pointer',
                  fontSize: '9px',
                }}
              >
                🔄 Refresh
              </button>
            </div>
            
            {botActivity.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '20px',
                color: '#555',
                fontSize: '11px',
              }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
                Loading bot activity...
              </div>
            ) : (
              botActivity.map((activity, idx) => (
                <BotActivityItem key={idx} activity={activity} />
              ))
            )}
          </div>

          {/* Bot Wallet */}
          {botStatus?.wallet && (
            <div style={{
              marginTop: '12px',
              padding: '10px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '10px',
              color: '#666',
            }}>
              <span style={{ color: '#888' }}>Bot Wallet: </span>
              <span style={{ color: '#FFD700', fontFamily: 'monospace' }}>
                {botStatus.wallet.slice(0, 6)}...{botStatus.wallet.slice(-4)}
              </span>
            </div>
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
            <div style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#00ff88' }}>🤖 Bot</strong>: PHANTOM EDGE trades 24/7 automatically
            </div>
            <div>
              <strong style={{ color: '#ff4444' }}>⚠️ Risk</strong>: Higher leverage = higher liquidation risk
            </div>
          </div>
        </div>
      )}

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

      {/* Pulse animation for bot status */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
