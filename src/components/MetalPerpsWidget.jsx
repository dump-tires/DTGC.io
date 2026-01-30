import React, { useState, useEffect, useRef } from 'react';

// ==================== CONFIGURATION ====================

const LAMBDA_URL = 'https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/';

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

// SYNCED WITH gTrade v10 actual limits
const ASSETS = {
  BTC: { name: 'Bitcoin', symbol: 'BTC', maxLev: 150, minLev: 2 },
  ETH: { name: 'Ethereum', symbol: 'ETH', maxLev: 150, minLev: 2 },
  GOLD: { name: 'Gold', symbol: 'XAU', maxLev: 100, minLev: 2 },    // gTrade commodities max 100x
  SILVER: { name: 'Silver', symbol: 'XAG', maxLev: 100, minLev: 2 }, // gTrade commodities max 100x
};

// Arbitrum Logo
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

// TradingView Mini Chart
const TradingViewMiniSymbol = ({ symbol, height = 180 }) => {
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
    });
    
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetDiv);
    container.appendChild(script);
    containerRef.current.appendChild(container);
    
    return () => { if (containerRef.current) containerRef.current.innerHTML = ''; };
  }, [symbol, height]);
  
  return <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />;
};

// TradingView Ticker
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
    
    return () => { if (containerRef.current) containerRef.current.innerHTML = ''; };
  }, []);
  
  return <div ref={containerRef} style={{ height: '46px', width: '100%' }} />;
};

// ==================== MAIN COMPONENT ====================

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
  const [takeProfit, setTakeProfit] = useState('1.5');
  const [stopLoss, setStopLoss] = useState('1.0');
  const [botStatus, setBotStatus] = useState(null);
  const [botActivity, setBotActivity] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const asset = ASSETS[selectedAsset];
  const tvSymbol = TV_SYMBOLS[selectedAsset];
  // FIX: Always use integer leverage for display and calculations
  const displayLeverage = Math.round(leverage);
  const positionSize = parseFloat(collateral || 0) * displayLeverage;

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Toast helper
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
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Fetch bot status (includes balance + positions)
  const fetchBotStatus = async () => {
    try {
      const result = await apiCall('STATUS');
      if (result.success) {
        setBotStatus(result);
        setBalance(result.balance);
        setPositions(result.positions || []);
        setLastUpdate(new Date());
        
        // Update activity feed
        const newActivity = {
          type: 'STATUS',
          message: `Updated: $${result.balance?.toFixed(2)} | ${result.positions?.length || 0} positions`,
          time: new Date().toLocaleTimeString(),
        };
        setBotActivity(prev => [newActivity, ...prev].slice(0, 20));
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    }
  };

  // Fetch live prices for ALL assets including Gold/Silver
  const fetchPrices = async () => {
    const prices = {};
    try {
      // BTC & ETH from Binance (parallel fetch)
      const [btcRes, ethRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
      ]);
      const btcData = await btcRes.json();
      const ethData = await ethRes.json();
      prices.BTC = parseFloat(btcData.price);
      prices.ETH = parseFloat(ethData.price);

      // GOLD & SILVER from metals.live API
      try {
        const metalsRes = await fetch('https://api.metals.live/v1/spot');
        const metalsData = await metalsRes.json();
        if (metalsData && metalsData.length > 0) {
          const goldSpot = metalsData.find(m => m.metal === 'gold');
          const silverSpot = metalsData.find(m => m.metal === 'silver');
          if (goldSpot) prices.GOLD = goldSpot.price;
          if (silverSpot) prices.SILVER = silverSpot.price;
        }
      } catch (metalErr) {
        console.log('Metals API unavailable, using fallback prices');
        // Fallback to approximate current prices
        prices.GOLD = 2650;
        prices.SILVER = 31;
      }

      // Ensure all prices have fallbacks
      if (!prices.GOLD) prices.GOLD = 2650;
      if (!prices.SILVER) prices.SILVER = 31;

      console.log('📊 Live prices:', prices);
    } catch (e) {
      console.log('Price fetch error:', e);
      // Emergency fallbacks
      prices.BTC = prices.BTC || 100000;
      prices.ETH = prices.ETH || 3500;
      prices.GOLD = prices.GOLD || 2650;
      prices.SILVER = prices.SILVER || 31;
    }
    setLivePrices(prices);
  };

  // Open trade - FIX: Validate price and send integer leverage
  const openTrade = async () => {
    if (parseFloat(collateral) < 5) {
      showToast('Minimum collateral is $5', 'error');
      return;
    }

    // FIX: Validate price exists before trading
    const currentPrice = livePrices[selectedAsset];
    if (!currentPrice || currentPrice <= 0) {
      showToast(`No price for ${selectedAsset}. Refreshing...`, 'error');
      await fetchPrices();
      return;
    }

    // FIX: Round leverage to integer
    const roundedLeverage = Math.round(leverage);

    setLoading(true);
    try {
      const result = await apiCall('OPEN_TRADE', {
        asset: selectedAsset,
        direction,
        collateral: parseFloat(collateral),
        leverage: roundedLeverage,  // FIX: Send integer leverage
        takeProfit: parseFloat(takeProfit),
        stopLoss: parseFloat(stopLoss),
        price: currentPrice,  // FIX: Validated price
      });

      if (result.success) {
        showToast(`✅ ${direction} ${selectedAsset} @ ${roundedLeverage}x opened!`, 'success');
        setBotActivity(prev => [{
          type: direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
          message: `${direction} ${selectedAsset} $${collateral} @ ${roundedLeverage}x`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));
        fetchBotStatus();
      } else {
        showToast(result.error || 'Failed to open trade', 'error');
      }
    } catch (error) {
      showToast('Trade failed: ' + error.message, 'error');
    }
    setLoading(false);
  };

  // Close trade
  const closeTrade = async (tradeIndex) => {
    setLoading(true);
    try {
      const result = await apiCall('CLOSE_TRADE', { tradeIndex });
      if (result.success) {
        showToast('Position closed!', 'success');
        setBotActivity(prev => [{
          type: 'CLOSE',
          message: `Closed position #${tradeIndex}`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));
        fetchBotStatus();
      } else {
        showToast(result.error || 'Failed to close', 'error');
      }
    } catch (error) {
      showToast('Close failed', 'error');
    }
    setLoading(false);
  };

  // Calculate P&L for a position
  const calculatePnL = (pos) => {
    const currentPrice = livePrices[pos.asset];
    if (!currentPrice || !pos.openPrice) return null;
    
    const priceDiff = pos.long 
      ? (currentPrice - pos.openPrice) / pos.openPrice
      : (pos.openPrice - currentPrice) / pos.openPrice;
    
    const pnlPercent = priceDiff * 100 * (pos.leverage || 1);
    const pnlUsd = (pos.collateral || 0) * priceDiff * (pos.leverage || 1);
    
    return { percent: pnlPercent, usd: pnlUsd, currentPrice };
  };

  // Initial load + auto-refresh
  useEffect(() => {
    fetchBotStatus();
    fetchPrices();
    const statusInterval = setInterval(fetchBotStatus, 30000);
    const priceInterval = setInterval(fetchPrices, 60000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(priceInterval);
    };
  }, []);

  // ==================== COLLAPSED STATE ====================
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '185px' : '100px',
          left: isMobile ? 'auto' : '20px',
          right: isMobile ? '10px' : 'auto',
          width: isMobile ? '44px' : '56px',
          height: isMobile ? '44px' : '56px',
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
        onMouseEnter={(e) => !isMobile && (e.currentTarget.style.transform = 'scale(1.1)')}
        onMouseLeave={(e) => !isMobile && (e.currentTarget.style.transform = 'scale(1)')}
      >
        <span style={{ fontSize: isMobile ? '18px' : '24px' }}>📊</span>
      </div>
    );
  }

  // ==================== EXPANDED STATE ====================
  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? '10px' : '20px',
      left: isMobile ? '10px' : '20px',
      right: isMobile ? '10px' : 'auto',
      width: isMobile ? 'auto' : '400px',
      maxWidth: '420px',
      maxHeight: isMobile ? '85vh' : '90vh',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 215, 0, 0.2)',
      zIndex: 9999,
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      
      {/* ===== HEADER ===== */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 140, 0, 0.1) 100%)',
        padding: '10px 12px',
        borderBottom: '1px solid rgba(255, 215, 0, 0.15)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)',
            }}>
              <span style={{ fontSize: '16px' }}>⚡</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>PHANTOM EDGE</div>
              <div style={{ fontSize: '9px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', animation: 'pulse 2s infinite' }} />
                <ArbitrumLogo size={10} />
                <span>gTrade v10 • Live</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '14px' }}>
                ${balance?.toFixed(2) || '---'}
              </div>
              <div style={{ color: '#888', fontSize: '9px' }}>USDC Balance</div>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '6px',
                width: '26px',
                height: '26px',
                cursor: 'pointer',
                color: '#888',
                fontSize: '12px',
              }}
            >✕</button>
          </div>
        </div>
      </div>

      {/* ===== TICKER ===== */}
      <TradingViewTickerTape />

      {/* ===== TABS ===== */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
        background: 'rgba(0, 0, 0, 0.2)',
      }}>
        {[
          { id: 'trade', label: '⚡ Trade' },
          { id: 'positions', label: `💼 ${positions.length}` },
          { id: 'bot', label: '🤖 Bot' },
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
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB CONTENT ===== */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        
        {/* ----- TRADE TAB ----- */}
        {activeTab === 'trade' && (
          <>
            {/* Asset Selection */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {Object.keys(ASSETS).map((key) => (
                <button
                  key={key}
                  onClick={() => setSelectedAsset(key)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: selectedAsset === key ? '2px solid #FFD700' : '1px solid rgba(255,255,255,0.1)',
                    background: selectedAsset === key ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <img src={ASSET_IMAGES[key]} alt={key} style={{ width: '18px', height: '18px', borderRadius: '4px' }} onError={(e) => e.target.style.display = 'none'} />
                  <span style={{ color: selectedAsset === key ? '#FFD700' : '#888', fontSize: '9px', fontWeight: 600 }}>{key}</span>
                </button>
              ))}
            </div>

            {/* Chart */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', overflow: 'hidden', marginBottom: '10px' }}>
              <TradingViewMiniSymbol symbol={tvSymbol} height={160} />
            </div>

            {/* Direction */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button
                onClick={() => setDirection('LONG')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: direction === 'LONG' ? '2px solid #00ff88' : '1px solid rgba(0, 255, 136, 0.2)',
                  background: direction === 'LONG' ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
                  color: direction === 'LONG' ? '#00ff88' : '#555',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >📈 LONG</button>
              <button
                onClick={() => setDirection('SHORT')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: direction === 'SHORT' ? '2px solid #ff4444' : '1px solid rgba(255, 68, 68, 0.2)',
                  background: direction === 'SHORT' ? 'rgba(255, 68, 68, 0.15)' : 'transparent',
                  color: direction === 'SHORT' ? '#ff4444' : '#555',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '12px',
                }}
              >📉 SHORT</button>
            </div>

            {/* Collateral */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '10px' }}>Collateral (USDC)</span>
                <span style={{ color: '#FFD700', fontSize: '10px', cursor: 'pointer' }} onClick={() => balance && setCollateral(Math.floor(balance * 0.9).toString())}>
                  Max: ${balance?.toFixed(2) || '0'}
                </span>
              </div>
              <input
                type="number"
                value={collateral}
                onChange={(e) => setCollateral(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#FFD700',
                  fontSize: '16px',
                  fontWeight: 700,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                {['25', '50', '100', '200'].map((amt) => (
                  <button key={amt} onClick={() => setCollateral(amt)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '9px' }}>${amt}</button>
                ))}
              </div>
            </div>

            {/* Leverage - FIX: step=1 for whole numbers only */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '10px' }}>Leverage</span>
                <span style={{ color: '#FFD700', fontWeight: 700 }}>{displayLeverage}x</span>
              </div>
              <input
                type="range"
                min={asset.minLev}
                max={asset.maxLev}
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(parseInt(e.target.value))}
                style={{ width: '100%', height: '6px', borderRadius: '3px', background: '#333', outline: 'none', cursor: 'pointer', WebkitAppearance: 'none' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                {[5, 10, 25, 50, 100].filter(l => l <= asset.maxLev).map((l) => (
                  <button key={l} onClick={() => setLeverage(l)} style={{ padding: '2px 6px', borderRadius: '4px', border: 'none', background: displayLeverage === l ? 'rgba(255,215,0,0.2)' : 'transparent', color: displayLeverage === l ? '#FFD700' : '#666', cursor: 'pointer', fontSize: '9px' }}>{l}x</button>
                ))}
              </div>
            </div>

            {/* TP/SL */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#00ff88', fontSize: '9px', marginBottom: '2px' }}>TP %</div>
                <input type="number" value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid rgba(0,255,136,0.3)', background: 'rgba(0,0,0,0.3)', color: '#00ff88', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#ff4444', fontSize: '9px', marginBottom: '2px' }}>SL %</div>
                <input type="number" value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid rgba(255,68,68,0.3)', background: 'rgba(0,0,0,0.3)', color: '#ff4444', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Position Summary */}
            <div style={{ background: 'rgba(255, 215, 0, 0.08)', borderRadius: '8px', padding: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: '#888' }}>Position Size</span>
                <span style={{ color: '#FFD700', fontWeight: 700 }}>${positionSize.toLocaleString()}</span>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={openTrade}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: direction === 'LONG' ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : 'linear-gradient(135deg, #ff4444, #cc0000)',
                color: direction === 'LONG' ? '#000' : '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? '⏳ Opening...' : `⚡ ${direction} ${selectedAsset}`}
            </button>
          </>
        )}

        {/* ----- POSITIONS TAB ----- */}
        {activeTab === 'positions' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#888', fontSize: '10px' }}>Open Positions</span>
              <button onClick={fetchBotStatus} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,215,0,0.3)', background: 'transparent', color: '#FFD700', cursor: 'pointer', fontSize: '9px' }}>🔄 Refresh</button>
            </div>
            
            {positions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>📭</div>
                <div style={{ fontSize: '12px' }}>No open positions</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>Open a trade to get started</div>
              </div>
            ) : (
              positions.map((pos, idx) => {
                const pnl = calculatePnL(pos);
                return (
                  <div key={idx} style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    padding: '10px',
                    marginBottom: '8px',
                    border: `1px solid ${pos.long ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{pos.long ? '📈' : '📉'}</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>{pos.asset}</span>
                        <span style={{ color: pos.long ? '#00ff88' : '#ff4444', fontSize: '10px', fontWeight: 600 }}>{pos.long ? 'LONG' : 'SHORT'}</span>
                      </div>
                      <span style={{ color: '#FFD700', fontSize: '11px', fontWeight: 600 }}>{pos.leverage}x</span>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', marginBottom: '8px' }}>
                      <div>
                        <span style={{ color: '#666' }}>Entry: </span>
                        <span style={{ color: '#fff' }}>${pos.openPrice?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>Size: </span>
                        <span style={{ color: '#fff' }}>${pos.collateral?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#00ff88' }}>TP: </span>
                        <span style={{ color: '#00ff88' }}>${pos.tp?.toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#ff4444' }}>SL: </span>
                        <span style={{ color: '#ff4444' }}>${pos.sl?.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {pnl && (
                      <div style={{
                        background: pnl.percent >= 0 ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                        borderRadius: '6px',
                        padding: '6px',
                        marginBottom: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}>
                        <span style={{ color: '#888', fontSize: '10px' }}>Live P&L</span>
                        <span style={{ color: pnl.percent >= 0 ? '#00ff88' : '#ff4444', fontWeight: 700, fontSize: '12px' }}>
                          {pnl.percent >= 0 ? '+' : ''}{pnl.percent.toFixed(2)}% (${pnl.usd >= 0 ? '+' : ''}{pnl.usd.toFixed(2)})
                        </span>
                      </div>
                    )}
                    
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
                    >✕ Close Position</button>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ----- BOT TAB ----- */}
        {activeTab === 'bot' && (
          <>
            {/* Bot Status Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(255, 215, 0, 0.1))',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '12px',
              border: '1px solid rgba(0, 255, 136, 0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 10px #00ff88', animation: 'pulse 2s infinite' }} />
                  <div>
                    <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '13px' }}>🤖 HANEEF ENGINE</div>
                    <div style={{ color: '#888', fontSize: '9px' }}>Auto-trading 24/7 on Arbitrum</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '14px' }}>${balance?.toFixed(2) || '---'}</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>Available</div>
                </div>
              </div>
              
              {/* Position Counters */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, background: 'rgba(0,255,136,0.15)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ color: '#00ff88', fontSize: '18px', fontWeight: 700 }}>{positions.filter(p => p.long).length}</div>
                  <div style={{ color: '#888', fontSize: '8px' }}>LONGS</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,68,68,0.15)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ color: '#ff4444', fontSize: '18px', fontWeight: 700 }}>{positions.filter(p => !p.long).length}</div>
                  <div style={{ color: '#888', fontSize: '8px' }}>SHORTS</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255,215,0,0.15)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                  <div style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700 }}>{positions.length}</div>
                  <div style={{ color: '#888', fontSize: '8px' }}>TOTAL</div>
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#888', fontSize: '10px', fontWeight: 600 }}>📊 ACTIVITY FEED</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#555', fontSize: '8px' }}>{lastUpdate?.toLocaleTimeString()}</span>
                  <button onClick={fetchBotStatus} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid rgba(255,215,0,0.3)', background: 'transparent', color: '#FFD700', cursor: 'pointer', fontSize: '8px' }}>🔄</button>
                </div>
              </div>
              
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {botActivity.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#555', fontSize: '10px' }}>
                    Waiting for activity...
                  </div>
                ) : (
                  botActivity.map((act, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '6px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '4px',
                      marginBottom: '4px',
                    }}>
                      <span style={{ marginRight: '8px', fontSize: '12px' }}>
                        {act.type === 'OPEN_LONG' ? '🟢' : act.type === 'OPEN_SHORT' ? '🔴' : act.type === 'CLOSE' ? '⚪' : '🔄'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          color: act.type === 'OPEN_LONG' ? '#00ff88' : act.type === 'OPEN_SHORT' ? '#ff4444' : '#888',
                          fontSize: '10px',
                          fontWeight: 600,
                        }}>{act.message}</div>
                      </div>
                      <div style={{ color: '#555', fontSize: '8px' }}>{act.time}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Wallet Info */}
            <div style={{ marginTop: '10px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#666', fontSize: '9px' }}>Bot Wallet</span>
                <span style={{ color: '#FFD700', fontSize: '9px', fontFamily: 'monospace' }}>
                  {botStatus?.wallet ? `${botStatus.wallet.slice(0, 6)}...${botStatus.wallet.slice(-4)}` : '---'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== TOAST ===== */}
      {toast && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: toast.type === 'error' ? '#ff4444' : toast.type === 'success' ? '#00ff88' : '#FFD700',
          color: toast.type === 'success' ? '#000' : '#fff',
          padding: '8px 16px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          zIndex: 10000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          {toast.message}
        </div>
      )}

      {/* ===== PULSE ANIMATION ===== */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
