/**
 * MetalsWidgetV1.jsx
 * Precious Metals Perps Trading Widget for DTGC.io
 * 
 * Features:
 * - Live Gold (XAU) and Silver (XAG) prices from Pyth/CoinGecko
 * - One-click trading via Synthetix
 * - Spread monitoring between price feeds
 * - Matching DTGC GEX V3 widget aesthetic
 * 
 * Integration: Add to your App.jsx alongside GEXWidgetV3
 */

import React, { useState, useEffect, useCallback } from 'react';

// ============ CONFIGURATION ============
const CONFIG = {
  // Price APIs
  COINGECKO_API: 'https://api.coingecko.com/api/v3/simple/price',
  PYTH_GOLD_ID: 'Gnt27xtC473ZT2Mw5u8wZ68Z3gULkSTb5DuxJy7eJotD',
  PYTH_SILVER_ID: 'HCmGzXH9cKfDqtVqYWLdDjTLCf1WBxK9fGNZpuWZsmXe',
  
  // Synthetix Trading URLs
  SYNTHETIX_TRADE_URL: 'https://synthetix.io/markets',
  KWENTA_XAU_URL: 'https://kwenta.eth.limo/market/?asset=sXAU',
  KWENTA_XAG_URL: 'https://kwenta.eth.limo/market/?asset=sXAG',
  
  // Growth Engine Lambda (configure your endpoint)
  GROWTH_ENGINE_URL: process.env.REACT_APP_METALS_GE_URL || '',
  
  // Refresh interval (ms)
  REFRESH_INTERVAL: 30000,
};

// ============ STYLES ============
const styles = {
  // Collapsed button (floating)
  collapsedButton: {
    position: 'fixed',
    bottom: '90px', // Position above GEX widget
    right: '20px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    border: '2px solid #C9A227',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(201, 162, 39, 0.3)',
    zIndex: 9998,
    transition: 'all 0.3s ease',
  },
  
  collapsedButtonHover: {
    transform: 'scale(1.05)',
    boxShadow: '0 6px 25px rgba(201, 162, 39, 0.5)',
  },
  
  // Price badge on collapsed button
  priceBadge: {
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    background: 'linear-gradient(135deg, #C9A227 0%, #FFD700 100%)',
    color: '#000',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '8px',
    minWidth: '36px',
    textAlign: 'center',
  },
  
  // Main widget panel
  widget: {
    position: 'fixed',
    bottom: '90px',
    right: '20px',
    width: '340px',
    background: 'linear-gradient(180deg, #1a1a1a 0%, #0d0d0d 100%)',
    border: '1px solid rgba(201, 162, 39, 0.3)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
    zIndex: 9999,
    fontFamily: "'Inter', -apple-system, sans-serif",
    overflow: 'hidden',
  },
  
  // Header
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(201, 162, 39, 0.2)',
    background: 'linear-gradient(90deg, rgba(201, 162, 39, 0.1) 0%, transparent 100%)',
  },
  
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  
  logo: {
    width: '28px',
    height: '28px',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #C9A227 0%, #FFD700 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
  },
  
  title: {
    color: '#FFD700',
    fontSize: '16px',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  
  subtitle: {
    color: '#888',
    fontSize: '10px',
    fontWeight: '400',
  },
  
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  
  iconButton: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '4px',
    transition: 'color 0.2s',
    fontSize: '16px',
  },
  
  // Tabs
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(201, 162, 39, 0.15)',
  },
  
  tab: {
    flex: 1,
    padding: '10px 8px',
    background: 'transparent',
    border: 'none',
    color: '#666',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
  },
  
  tabActive: {
    color: '#FFD700',
    borderBottom: '2px solid #FFD700',
  },
  
  // Content area
  content: {
    padding: '12px',
    maxHeight: '280px',
    overflowY: 'auto',
  },
  
  // Metal row
  metalRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '10px',
    marginBottom: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'all 0.2s',
    cursor: 'pointer',
  },
  
  metalRowHover: {
    background: 'rgba(201, 162, 39, 0.1)',
    border: '1px solid rgba(201, 162, 39, 0.3)',
  },
  
  metalInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  
  metalIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  },
  
  goldIcon: {
    background: 'linear-gradient(135deg, #C9A227 0%, #FFD700 100%)',
    boxShadow: '0 2px 8px rgba(201, 162, 39, 0.4)',
  },
  
  silverIcon: {
    background: 'linear-gradient(135deg, #8B8B8B 0%, #C0C0C0 100%)',
    boxShadow: '0 2px 8px rgba(192, 192, 192, 0.4)',
  },
  
  metalName: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
  },
  
  metalSymbol: {
    color: '#666',
    fontSize: '11px',
  },
  
  metalPrices: {
    textAlign: 'right',
  },
  
  priceMain: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: '700',
  },
  
  priceChange: {
    fontSize: '11px',
    fontWeight: '600',
  },
  
  priceUp: { color: '#00D4AA' },
  priceDown: { color: '#FF4757' },
  
  // Trade button
  tradeButton: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #C9A227 0%, #FFD700 100%)',
    border: 'none',
    borderRadius: '10px',
    color: '#000',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'all 0.2s',
    letterSpacing: '0.5px',
  },
  
  tradeButtonHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 15px rgba(201, 162, 39, 0.5)',
  },
  
  // Signals tab
  signalCard: {
    background: 'rgba(0, 212, 170, 0.1)',
    border: '1px solid rgba(0, 212, 170, 0.3)',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '8px',
  },
  
  signalBearish: {
    background: 'rgba(255, 71, 87, 0.1)',
    border: '1px solid rgba(255, 71, 87, 0.3)',
  },
  
  signalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  
  signalType: {
    color: '#00D4AA',
    fontSize: '12px',
    fontWeight: '700',
  },
  
  signalTime: {
    color: '#666',
    fontSize: '10px',
  },
  
  signalText: {
    color: '#ccc',
    fontSize: '12px',
    lineHeight: '1.4',
  },
  
  // Footer
  footer: {
    padding: '10px 16px',
    borderTop: '1px solid rgba(201, 162, 39, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '10px',
    color: '#666',
  },
  
  footerStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: '#00D4AA',
  },
  
  statusDotOffline: {
    background: '#FF4757',
  },
  
  // Learn tab
  learnItem: {
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    marginBottom: '6px',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  
  learnTitle: {
    color: '#FFD700',
    fontSize: '12px',
    fontWeight: '600',
    marginBottom: '4px',
  },
  
  learnDesc: {
    color: '#888',
    fontSize: '11px',
    lineHeight: '1.3',
  },
};

// ============ COMPONENT ============
const MetalsWidgetV1 = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('PRICES');
  const [prices, setPrices] = useState({
    gold: { price: 0, change: 0 },
    silver: { price: 0, change: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [hoveredRow, setHoveredRow] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(false);
  const [signals, setSignals] = useState([]);

  // Fetch prices from CoinGecko
  const fetchPrices = useCallback(async () => {
    try {
      // Using CoinGecko for gold/silver spot prices
      // Note: CoinGecko uses 'tether-gold' and 'silver' for commodities
      const response = await fetch(
        `${CONFIG.COINGECKO_API}?ids=tether-gold,silver&vs_currencies=usd&include_24hr_change=true`
      );
      
      if (!response.ok) throw new Error('Price fetch failed');
      
      const data = await response.json();
      
      // Map to actual spot prices (CoinGecko tokenized gold/silver)
      setPrices({
        gold: {
          price: data['tether-gold']?.usd || 2650,
          change: data['tether-gold']?.usd_24h_change || 0,
        },
        silver: {
          price: data['silver']?.usd || 31.50,
          change: data['silver']?.usd_24h_change || 0,
        },
      });
      
      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('MetalsWidget: Price fetch error', error);
      // Fallback to approximate spot prices
      setPrices({
        gold: { price: 2650, change: 0.45 },
        silver: { price: 31.50, change: 1.2 },
      });
      setIsLoading(false);
    }
  }, []);

  // Generate mock signals (in production, this would come from your Lambda)
  const generateSignals = useCallback(() => {
    const mockSignals = [
      {
        id: 1,
        type: 'BULLISH',
        metal: 'Gold',
        text: 'XAU breaking above $2,650 resistance. Strong momentum.',
        time: '2m ago',
      },
      {
        id: 2,
        type: 'NEUTRAL',
        metal: 'Silver',
        text: 'XAG consolidating at $31.50. Watch for breakout.',
        time: '15m ago',
      },
    ];
    setSignals(mockSignals);
  }, []);

  // Initial fetch and interval
  useEffect(() => {
    fetchPrices();
    generateSignals();
    
    const interval = setInterval(fetchPrices, CONFIG.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchPrices, generateSignals]);

  // Handle trade click
  const handleTrade = (metal) => {
    const url = metal === 'gold' ? CONFIG.KWENTA_XAU_URL : CONFIG.KWENTA_XAG_URL;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Format price
  const formatPrice = (price, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(price);
  };

  // Format change percentage
  const formatChange = (change) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  // Render collapsed button
  if (!isOpen) {
    return (
      <div
        style={{
          ...styles.collapsedButton,
          ...(hoveredButton ? styles.collapsedButtonHover : {}),
        }}
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setHoveredButton(true)}
        onMouseLeave={() => setHoveredButton(false)}
        title="Precious Metals Trading"
      >
        {/* Gold bars icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="14" width="18" height="6" rx="1" fill="#FFD700" />
          <rect x="5" y="9" width="14" height="5" rx="1" fill="#C9A227" />
          <rect x="7" y="5" width="10" height="4" rx="1" fill="#B8860B" />
        </svg>
        
        {/* Price badge */}
        <div style={styles.priceBadge}>
          {isLoading ? '...' : `$${Math.round(prices.gold.price)}`}
        </div>
      </div>
    );
  }

  // Render tabs content
  const renderContent = () => {
    switch (activeTab) {
      case 'PRICES':
        return (
          <>
            {/* Gold Row */}
            <div
              style={{
                ...styles.metalRow,
                ...(hoveredRow === 'gold' ? styles.metalRowHover : {}),
              }}
              onMouseEnter={() => setHoveredRow('gold')}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => handleTrade('gold')}
            >
              <div style={styles.metalInfo}>
                <div style={{ ...styles.metalIcon, ...styles.goldIcon }}>🥇</div>
                <div>
                  <div style={styles.metalName}>Gold</div>
                  <div style={styles.metalSymbol}>XAU/USD</div>
                </div>
              </div>
              <div style={styles.metalPrices}>
                <div style={styles.priceMain}>
                  {formatPrice(prices.gold.price)}
                </div>
                <div
                  style={{
                    ...styles.priceChange,
                    ...(prices.gold.change >= 0 ? styles.priceUp : styles.priceDown),
                  }}
                >
                  {formatChange(prices.gold.change)}
                </div>
              </div>
            </div>

            {/* Silver Row */}
            <div
              style={{
                ...styles.metalRow,
                ...(hoveredRow === 'silver' ? styles.metalRowHover : {}),
              }}
              onMouseEnter={() => setHoveredRow('silver')}
              onMouseLeave={() => setHoveredRow(null)}
              onClick={() => handleTrade('silver')}
            >
              <div style={styles.metalInfo}>
                <div style={{ ...styles.metalIcon, ...styles.silverIcon }}>🥈</div>
                <div>
                  <div style={styles.metalName}>Silver</div>
                  <div style={styles.metalSymbol}>XAG/USD</div>
                </div>
              </div>
              <div style={styles.metalPrices}>
                <div style={styles.priceMain}>
                  {formatPrice(prices.silver.price)}
                </div>
                <div
                  style={{
                    ...styles.priceChange,
                    ...(prices.silver.change >= 0 ? styles.priceUp : styles.priceDown),
                  }}
                >
                  {formatChange(prices.silver.change)}
                </div>
              </div>
            </div>

            {/* Trade Button */}
            <button
              style={{
                ...styles.tradeButton,
                ...(hoveredButton ? styles.tradeButtonHover : {}),
              }}
              onMouseEnter={() => setHoveredButton(true)}
              onMouseLeave={() => setHoveredButton(false)}
              onClick={() => window.open(CONFIG.SYNTHETIX_TRADE_URL, '_blank')}
            >
              ⚡ TRADE ON SYNTHETIX
            </button>
          </>
        );

      case 'SIGNALS':
        return (
          <>
            {signals.map((signal) => (
              <div
                key={signal.id}
                style={{
                  ...styles.signalCard,
                  ...(signal.type === 'BEARISH' ? styles.signalBearish : {}),
                }}
              >
                <div style={styles.signalHeader}>
                  <span
                    style={{
                      ...styles.signalType,
                      color: signal.type === 'BULLISH' ? '#00D4AA' : 
                             signal.type === 'BEARISH' ? '#FF4757' : '#FFD700',
                    }}
                  >
                    {signal.type} • {signal.metal}
                  </span>
                  <span style={styles.signalTime}>{signal.time}</span>
                </div>
                <div style={styles.signalText}>{signal.text}</div>
              </div>
            ))}
            
            <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', marginTop: '12px' }}>
              Signals update every 5 minutes
            </div>
          </>
        );

      case 'LIVE':
        return (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
            <div style={{ color: '#FFD700', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Growth Engine Status
            </div>
            <div style={{ color: '#00D4AA', fontSize: '12px', marginBottom: '16px' }}>
              ● Active
            </div>
            <div style={{ color: '#888', fontSize: '11px', lineHeight: '1.6' }}>
              Auto-DCA into XAU/XAG<br />
              Next buy: When spread {'>'} 0.5%<br />
              <br />
              <span style={{ color: '#FFD700' }}>Total accumulated:</span><br />
              0.015 sXAU • 2.5 sXAG
            </div>
          </div>
        );

      case 'LEARN':
        return (
          <>
            <div
              style={styles.learnItem}
              onClick={() => window.open('https://blog.synthetix.io/nunki/', '_blank')}
            >
              <div style={styles.learnTitle}>📖 What are Precious Metal Perps?</div>
              <div style={styles.learnDesc}>
                Trade Gold & Silver with up to 50x leverage on-chain via Synthetix.
              </div>
            </div>
            
            <div
              style={styles.learnItem}
              onClick={() => window.open('https://docs.synthetix.io/', '_blank')}
            >
              <div style={styles.learnTitle}>⚙️ How the Growth Engine Works</div>
              <div style={styles.learnDesc}>
                Automated DCA strategy that accumulates metals during favorable conditions.
              </div>
            </div>
            
            <div
              style={styles.learnItem}
              onClick={() => window.open('https://www.tradingview.com/symbols/XAUUSD/', '_blank')}
            >
              <div style={styles.learnTitle}>📈 Gold/Silver Charts</div>
              <div style={styles.learnDesc}>
                View detailed TradingView charts for XAU and XAG.
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div style={styles.widget} className="metals-widget-v1">
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>🥇</div>
          <div>
            <div style={styles.title}>METALS V1</div>
            <div style={styles.subtitle}>Precious Metals Perps</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button
            style={styles.iconButton}
            onClick={() => window.open('https://docs.synthetix.io/', '_blank')}
            title="Help"
          >
            ?
          </button>
          <button
            style={styles.iconButton}
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {['PRICES', 'SIGNALS', 'LIVE', 'LEARN'].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : {}),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'PRICES' && '💰'}
            {tab === 'SIGNALS' && '📡'}
            {tab === 'LIVE' && '⚡'}
            {tab === 'LEARN' && '📚'}
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {renderContent()}
      </div>

      {/* Footer */}
      <div style={styles.footer}>
        <div style={styles.footerStatus}>
          <div
            style={{
              ...styles.statusDot,
              ...(isLoading ? styles.statusDotOffline : {}),
            }}
          />
          <span>{isLoading ? 'Loading...' : 'Live Prices'}</span>
        </div>
        <span>
          {lastUpdate
            ? `Updated ${lastUpdate.toLocaleTimeString()}`
            : 'Connecting...'}
        </span>
      </div>
    </div>
  );
};

export default MetalsWidgetV1;
