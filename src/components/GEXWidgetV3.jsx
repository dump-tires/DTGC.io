/**
 * GEXWidgetV3.jsx - Growth Engine X-Chain Monitor V3.4
 * 
 * MULTI-PAIR ARBITRAGE MONITORING
 * eHEX, WETH, WBTC (3 pairs - stablecoins removed)
 * 
 * V3.4 Changes:
 * - TradingView live reference prices
 * - CoinGecko reference for programmatic comparison
 * - Shows deviation from "true" market price
 * - More accurate spread calculation
 * 
 * Features:
 * - All pairs view sorted by best opportunity
 * - Single pair detail view
 * - Auto-signals at 4%+ spread
 * - ZapperX integration for bridging
 * - TradingView live ticker for reference
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

const CONFIG = {
  DTGC_GATE_USD: 200,
  SIGNAL_QUEUE_URL: 'https://iwnaatxjwerbpg7jtslldoxeqm0msvdt.lambda-url.us-east-2.on.aws/',
  MIN_SPREAD_SIGNAL: 4,
  MIN_SPREAD_OPPORTUNITY: 5,
  SIGNAL_COOLDOWN_MS: 120000,
  PRICE_REFRESH_MS: 5000, // 5 second refresh for live feel
  COINGECKO_IDS: {
    weth: 'ethereum',
    wbtc: 'wrapped-bitcoin',
    ehex: 'hex',
  },
};

// TradingView symbols for reference
const TV_SYMBOLS = {
  weth: 'BINANCE:ETHUSDT',
  wbtc: 'BINANCE:BTCUSDT',
  usdc: 'BITSTAMP:USDCUSD',
};

// TradingView Ticker Tape Component - Live Reference Prices
const TradingViewTicker = () => {
  const containerRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'BINANCE:ETHUSDT', title: 'ETH' },
        { proName: 'BINANCE:BTCUSDT', title: 'BTC' },
        { proName: 'UNISWAP3ETH:HEXWETH', title: 'HEX' },
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

// ═══════════════════════════════════════════════════════════════
// BRIDGED TOKEN PAIRS - Verified addresses only
// Using token addresses for DexScreener /tokens/ endpoint
// ═══════════════════════════════════════════════════════════════

const BRIDGED_PAIRS = [
  {
    id: 'ehex',
    name: 'eHEX',
    // gib.show image API - chainId 1 = Ethereum
    icon: 'https://gib.show/image/1/0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
    // HEX on Ethereum (native)
    ethAddress: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
    // eHEX on PulseChain (bridged from Ethereum)
    plsAddress: '0x57fde0a71132198BBeC939B98976993d8D89D225',
    color: '#627eea',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x57fde0a71132198BBeC939B98976993d8D89D225',
    },
  },
  {
    id: 'weth',
    name: 'WETH',
    icon: 'https://gib.show/image/1/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // WETH on Ethereum
    ethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    // eWETH on PulseChain (bridged from Ethereum)
    plsAddress: '0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C',
    color: '#627eea',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C',
    },
  },
  // USDC & DAI REMOVED - stablecoins not useful for arb
  {
    id: 'wbtc',
    name: 'WBTC',
    icon: 'https://gib.show/image/1/0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    // WBTC on Ethereum
    ethAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    // eWBTC on PulseChain (bridged from Ethereum)
    plsAddress: '0xb17D901469B9208B17d916112988A3FeD19b5cA1',
    color: '#F7931A',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0xb17D901469B9208B17d916112988A3FeD19b5cA1',
    },
  },
];

// Bridge/Zap Links
const BRIDGE_LINKS = {
  zapperX: 'https://dtgc.io/zapperX',
  pulseRamp: 'https://pulseramp.com',
  portalBridge: 'https://portal.bridge.pulsechain.com',
};

class SignalService {
  static lastPushTime = {};
  
  static async pushSignal(signal) {
    const now = Date.now();
    const key = `${signal.pair}-${signal.direction}`;
    
    if (this.lastPushTime[key] && (now - this.lastPushTime[key]) < CONFIG.SIGNAL_COOLDOWN_MS) {
      return { success: false, reason: 'cooldown' };
    }
    
    try {
      const response = await fetch(CONFIG.SIGNAL_QUEUE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_SIGNAL',
          signal: { ...signal, source: 'GEX_V3.2', timestamp: now }
        })
      });
      
      if (response.ok) {
        this.lastPushTime[key] = now;
        const result = await response.json();
        console.log('[GEX] Signal pushed:', signal.pair, signal.spread.toFixed(2) + '%');
        return { success: true, ...result };
      }
      return { success: false, reason: 'api_error' };
    } catch (err) {
      console.error('[GEX] Signal error:', err);
      return { success: false, reason: err.message };
    }
  }
}

class PriceService {
  static cache = {};
  static refCache = {}; // CoinGecko reference prices
  static lastRefFetch = 0;
  
  // Fetch ALL reference prices from CoinGecko at once (more efficient)
  static async fetchAllReferencePrices() {
    // Only fetch every 10 seconds to avoid rate limits
    if (Date.now() - this.lastRefFetch < 10000 && Object.keys(this.refCache).length > 0) {
      return this.refCache;
    }
    
    try {
      const ids = Object.values(CONFIG.COINGECKO_IDS).join(',');
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
      const res = await fetch(url);
      const data = await res.json();
      
      // Map back to our pair IDs
      Object.entries(CONFIG.COINGECKO_IDS).forEach(([pairId, geckoId]) => {
        if (data[geckoId]?.usd) {
          this.refCache[pairId] = { price: data[geckoId].usd, time: Date.now() };
        }
      });
      
      this.lastRefFetch = Date.now();
      console.log('[GEX] CoinGecko prices:', Object.entries(this.refCache).map(([k,v]) => `${k}: $${v.price}`).join(', '));
      return this.refCache;
    } catch (err) {
      console.log('[GEX] CoinGecko error, using cache:', err.message);
      return this.refCache;
    }
  }
  
  // Get reference price for a specific pair (from cache)
  static async fetchReferencePrice(pairId) {
    await this.fetchAllReferencePrices();
    return this.refCache[pairId]?.price || null;
  }
  
  static async fetchPrice(address, chain) {
    const cacheKey = `${chain}-${address}`;
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.time < 10000) return cached.price;
    
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
      const res = await fetch(url);
      const data = await res.json();
      
      const chainId = chain === 'eth' ? 'ethereum' : 'pulsechain';
      let pairs = data.pairs?.filter(p => p.chainId === chainId) || [];
      
      // If no chain-specific pairs, skip (don't use wrong chain data)
      if (pairs.length === 0) {
        console.log(`[GEX] No ${chainId} pairs found for ${address}`);
        return null;
      }
      
      // Sort by liquidity to get most accurate price
      pairs.sort((a, b) => (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0));
      
      // Only use if reasonable liquidity (> $1000)
      const topPair = pairs[0];
      const liquidity = parseFloat(topPair.liquidity?.usd) || 0;
      if (liquidity < 1000) {
        console.log(`[GEX] Low liquidity for ${address} on ${chainId}: $${liquidity}`);
        return null;
      }
      
      const price = topPair.priceUsd ? parseFloat(topPair.priceUsd) : null;
      if (price) this.cache[cacheKey] = { price, time: Date.now() };
      
      return price;
    } catch (err) {
      console.error(`[GEX] Price error ${chain}/${address}:`, err);
      return this.cache[cacheKey]?.price || null;
    }
  }
  
  static async fetchAllPairs() {
    const results = await Promise.all(
      BRIDGED_PAIRS.map(async (pair) => {
        // Fetch all three prices in parallel
        const [ethDexPrice, plsPrice, refPrice] = await Promise.all([
          this.fetchPrice(pair.ethAddress, 'eth'),
          this.fetchPrice(pair.plsAddress, 'pls'),
          this.fetchReferencePrice(pair.id),
        ]);
        
        // Use TradingView/CoinGecko reference as the "true" ETH price
        // Fall back to DexScreener ETH price if no reference available
        const ethPrice = refPrice || ethDexPrice;
        
        let spread = 0, absSpread = 0, buyChain = '', sellChain = '';
        let ethDeviation = 0, plsDeviation = 0;
        
        if (ethPrice && plsPrice) {
          // Spread is now: Reference Price vs PulseChain DEX Price
          spread = ((ethPrice - plsPrice) / plsPrice) * 100;
          absSpread = Math.abs(spread);
          buyChain = spread > 0 ? 'PULSECHAIN' : 'ETHEREUM';
          sellChain = spread > 0 ? 'ETHEREUM' : 'PULSECHAIN';
          
          // Calculate deviation from reference (if we have both DEX prices)
          if (refPrice && ethDexPrice) {
            ethDeviation = ((ethDexPrice - refPrice) / refPrice) * 100;
          }
          if (refPrice) {
            plsDeviation = ((plsPrice - refPrice) / refPrice) * 100;
          }
        }
        
        return { 
          ...pair, 
          ethPrice,       // TradingView/CoinGecko reference (or DEX fallback)
          ethDexPrice,    // Actual ETH DEX price (for comparison)
          plsPrice,       // PulseChain DEX price
          refPrice,       // Raw reference price
          ethDeviation,   // How far ETH DEX is from true price
          plsDeviation,   // How far PLS DEX is from true price
          spread,         // Reference vs PLS spread
          absSpread, 
          buyChain, 
          sellChain,
          usingReference: !!refPrice, // Flag if we're using TV reference
        };
      })
    );
    
    // Filter out pairs with missing prices, then sort by spread
    return results
      .filter(p => p.ethPrice && p.plsPrice)
      .sort((a, b) => b.absSpread - a.absSpread);
  }
}

export const GEXWidgetV3 = ({
  walletAddress,
  dtgcBalance = 0,
  dtgcPrice = 0,
  position = 'bottom-right',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState('spread');
  const [selectedPair, setSelectedPair] = useState('ehex');
  const [viewMode, setViewMode] = useState('all');
  const [pairData, setPairData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [lastPush, setLastPush] = useState(null);

  const dtgcUSDValue = dtgcBalance * dtgcPrice;
  const isUnlocked = dtgcUSDValue >= CONFIG.DTGC_GATE_USD;

  const fetchPrices = useCallback(async () => {
    try {
      const data = await PriceService.fetchAllPairs();
      setPairData(data);
      setLastUpdate(new Date());
      setLoading(false);
      
      for (const pair of data) {
        if (pair.absSpread >= CONFIG.MIN_SPREAD_SIGNAL) {
          const result = await SignalService.pushSignal({
            type: 'MULTI_ARB',
            pair: pair.id,
            pairName: pair.name,
            spread: pair.absSpread,
            ethPrice: pair.ethPrice,
            plsPrice: pair.plsPrice,
            direction: pair.spread > 0 ? 'BUY_PLS' : 'BUY_ETH',
            buyChain: pair.buyChain,
            sellChain: pair.sellChain,
            confidence: pair.absSpread >= 5 ? 'HIGH' : 'MEDIUM',
          });
          if (result.success) {
            setLastPush({ pair: pair.name, spread: pair.absSpread, time: Date.now() });
          }
        }
      }
    } catch (err) {
      console.error('[GEX] Fetch error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, CONFIG.PRICE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const currentPair = pairData.find(p => p.id === selectedPair) || pairData[0];
  const bestOpp = pairData[0];

  const positionStyles = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '100px', right: '20px' },
  };

  const getColor = (abs) => {
    if (!abs || abs < 2) return '#888';
    if (abs < 3) return '#FFD700';
    if (abs < 5) return '#FFA500';
    return '#00FF88';
  };

  const getStatus = (abs) => {
    if (!abs || abs < 2) return 'NORMAL';
    if (abs < 4) return 'WATCHING';
    if (abs < 5) return 'SIGNAL';
    return '🔥 HOT';
  };

  const formatPrice = (p) => p ? (p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(6)}`) : '--';
  const formatSpread = (s) => s !== undefined ? `${s >= 0 ? '+' : ''}${s.toFixed(2)}%` : '--';

  return (
    <>
      <style>{STYLES}</style>
      <div className="gex-widget-v3" style={{ ...positionStyles[position] }}>
        {!isExpanded ? (
          <button onClick={() => setIsExpanded(true)} className="gex-trigger-v3">
            <span className="gex-icon-v3">⚡</span>
            <span className="gex-label-v3">GEX</span>
            {bestOpp?.absSpread >= 4 && <span className="gex-badge-v3">{bestOpp.absSpread.toFixed(1)}%</span>}
          </button>
        ) : (
          <div className="gex-panel-v3">
            <div className="gex-header-v3">
              <div className="gex-title-v3">
                <span className="gex-logo-v3">⚡ GEX V3</span>
                <span className="gex-subtitle-v3">Multi-Pair Arbitrage</span>
              </div>
              <button onClick={() => setShowInfo(!showInfo)} className="gex-info-btn-v3">?</button>
              <button onClick={() => setIsExpanded(false)} className="gex-close-v3">✕</button>
            </div>

            {showInfo && (
              <div className="gex-info-v3">
                <p><strong>GEX V3.4</strong> monitors bridged tokens for arbitrage between ETH ↔ PLS.</p>
                <p>📊 eHEX, WETH, WBTC</p>
                <p>📈 TradingView live reference prices</p>
                <p>🎯 Signals at 4%+ spread → Telegram</p>
                <p>🔗 Use ZapperX or PulseRamp to bridge!</p>
                <button onClick={() => setShowInfo(false)}>Got it!</button>
              </div>
            )}

            {/* TradingView Live Reference Prices */}
            <div style={{
              borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '2px 0',
            }}>
              <TradingViewTicker />
            </div>

            <div className="gex-tabs-v3">
              {['spread', 'signals', 'live', 'learn'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? 'active' : ''}
                >
                  {tab === 'spread' && '📊'} {tab === 'signals' && '🎯'} {tab === 'live' && '⚡'} {tab === 'learn' && '📚'} {tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="gex-content-v3">
              {activeTab === 'spread' && (
                <div className="spread-tab-v3">
                  <div className="view-toggle-v3">
                    <button className={viewMode === 'all' ? 'active' : ''} onClick={() => setViewMode('all')}>All Pairs</button>
                    <button className={viewMode === 'single' ? 'active' : ''} onClick={() => setViewMode('single')}>Detail</button>
                  </div>

                  {loading ? <div className="loading-v3">Loading prices...</div> : viewMode === 'all' ? (
                    <div className="pairs-list-v3">
                      {pairData.length === 0 ? (
                        <div className="no-data-v3">No price data available</div>
                      ) : pairData.map(p => (
                        <div key={p.id} className={`pair-row-v3 ${p.absSpread >= 3 ? 'hot' : ''}`} onClick={() => { setSelectedPair(p.id); setViewMode('single'); }}>
                          <span className="pair-icon-v3">{p.icon.startsWith('http') ? <img src={p.icon} alt={p.name} style={{ width: 20, height: 20, borderRadius: '50%' }} /> : p.icon}</span>
                          <span className="pair-name-v3">{p.name}</span>
                          <span className="pair-prices-v3">
                            <span className="eth" style={{ color: p.usingReference ? '#FFD700' : '#888' }} title={p.usingReference ? '📈 CoinGecko/TradingView Live' : 'ETH DEX'}>
                              {formatPrice(p.ethPrice)}{p.usingReference && <span style={{ fontSize: '8px', marginLeft: '2px' }}>📈</span>}
                            </span>
                            <span className="sep">↔</span>
                            <span className="pls" title="PulseChain DEX" style={{ color: '#00ff88' }}>
                              {formatPrice(p.plsPrice)}
                            </span>
                          </span>
                          <span className="pair-spread-v3" style={{ color: getColor(p.absSpread) }}>{formatSpread(p.spread)}</span>
                        </div>
                      ))}
                    </div>
                  ) : currentPair && (
                    <div className="single-view-v3">
                      <div className="pair-selector-v3">
                        {pairData.map(p => (
                          <button key={p.id} className={selectedPair === p.id ? 'active' : ''} onClick={() => setSelectedPair(p.id)} style={{ borderColor: selectedPair === p.id ? p.color : 'transparent' }}>
                            {p.icon.startsWith('http') ? <img src={p.icon} alt={p.name} style={{ width: 16, height: 16, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle' }} /> : p.icon} {p.name} {p.absSpread >= 4 && '🔥'}
                          </button>
                        ))}
                      </div>

                      <div className="spread-main-v3">
                        <div className="spread-label-v3">{currentPair.name}(E) / {currentPair.name}(P)</div>
                        <div className="spread-value-v3" style={{ color: getColor(currentPair.absSpread) }}>{formatSpread(currentPair.spread)}</div>
                        <div className="spread-status-v3" style={{ color: getColor(currentPair.absSpread), borderColor: getColor(currentPair.absSpread) }}>{getStatus(currentPair.absSpread)}</div>
                      </div>

                      {currentPair.absSpread >= 2 && (
                        <button className="action-btn-v3" onClick={() => window.open(currentPair.spread > 0 ? currentPair.dexLinks.pls : currentPair.dexLinks.eth, '_blank')}>
                          ⭐ BUY {currentPair.name} on {currentPair.buyChain}
                        </button>
                      )}

                      {/* Reference Price - if available */}
                      {currentPair.refPrice && (
                        <div style={{
                          background: 'rgba(255, 215, 0, 0.1)',
                          border: '1px solid rgba(255, 215, 0, 0.3)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          marginBottom: '12px',
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>
                            📈 TradingView Reference
                          </div>
                          <div style={{ fontSize: '16px', color: '#FFD700', fontWeight: 700 }}>
                            {formatPrice(currentPair.refPrice)}
                          </div>
                        </div>
                      )}

                      {/* Price comparison - Reference vs PulseChain */}
                      <div className="price-cards-v3">
                        <div className="card-v3 eth" style={{ borderColor: currentPair.usingReference ? '#FFD700' : undefined }}>
                          <div className="chain-v3" style={{ color: currentPair.usingReference ? '#FFD700' : undefined }}>
                            {currentPair.usingReference ? '📈 TRADINGVIEW' : '◆ ETHEREUM DEX'}
                          </div>
                          <div className="token-v3">{currentPair.name}</div>
                          <div className="price-v3" style={{ color: currentPair.usingReference ? '#FFD700' : undefined }}>
                            {formatPrice(currentPair.ethPrice)}
                          </div>
                          {currentPair.usingReference && currentPair.ethDexPrice && (
                            <div style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>
                              DEX: {formatPrice(currentPair.ethDexPrice)}
                            </div>
                          )}
                        </div>
                        <div className="card-v3 pls">
                          <div className="chain-v3">💜 PULSECHAIN DEX</div>
                          <div className="token-v3">{currentPair.name}</div>
                          <div className="price-v3" style={{ color: '#00ff88' }}>{formatPrice(currentPair.plsPrice)}</div>
                          {currentPair.refPrice && (
                            <div style={{ 
                              fontSize: '10px', 
                              color: currentPair.plsDeviation >= 0 ? '#00ff88' : '#ff4444',
                              marginTop: '4px' 
                            }}>
                              {currentPair.plsDeviation >= 0 ? '+' : ''}{currentPair.plsDeviation.toFixed(2)}% vs TV
                            </div>
                          )}
                        </div>
                      </div>

                      {currentPair.absSpread >= 2 && (
                        <div className="direction-box-v3">
                          <div className="label-v3">ARBITRAGE DIRECTION</div>
                          <div className="value-v3">
                            <span className="buy-v3">BUY on {currentPair.buyChain}</span> → Bridge → <span className="sell-v3">SELL on {currentPair.sellChain}</span>
                          </div>
                        </div>
                      )}

                      {/* Bridge Links */}
                      <div className="bridge-links-v3">
                        <div className="bridge-label-v3">🔗 BRIDGE OPTIONS</div>
                        <div className="bridge-btns-v3">
                          <a href={BRIDGE_LINKS.zapperX} target="_blank" rel="noopener noreferrer" className="bridge-btn-v3 zapperx">⚡ ZapperX</a>
                          <a href={BRIDGE_LINKS.pulseRamp} target="_blank" rel="noopener noreferrer" className="bridge-btn-v3 pulseramp">🌉 PulseRamp</a>
                          <a href={BRIDGE_LINKS.portalBridge} target="_blank" rel="noopener noreferrer" className="bridge-btn-v3 portal">🔮 Portal</a>
                        </div>
                      </div>
                    </div>
                  )}

                  {lastPush && Date.now() - lastPush.time < 60000 && (
                    <div className="push-confirm-v3">📡 Signal: {lastPush.pair} +{lastPush.spread.toFixed(1)}%</div>
                  )}
                </div>
              )}

              {activeTab === 'signals' && (
                <div className="signals-tab-v3">
                  {!isUnlocked ? (
                    <div className="locked-v3">
                      <div className="icon-v3">🔒</div>
                      <div className="title-v3">Premium Signals</div>
                      <div className="desc-v3">Hold ${CONFIG.DTGC_GATE_USD}+ DTGC to unlock</div>
                      <button onClick={() => window.open('https://dtgc.io', '_blank')}>GET DTGC →</button>
                    </div>
                  ) : (
                    <>
                      <div className="unlocked-header-v3"><span className="badge-v3">✓ UNLOCKED</span></div>
                      <p>🔔 Telegram signals at 3%+ spread</p>
                      <div className="opps-v3">
                        <h4>Current Opportunities</h4>
                        {pairData.filter(p => p.absSpread >= 3).length === 0 ? (
                          <div className="none-v3">📡 Monitoring {BRIDGED_PAIRS.length} pairs...</div>
                        ) : (
                          pairData.filter(p => p.absSpread >= 4).map(p => (
                            <div key={p.id} className="opp-card-v3">
                              <span>{p.icon.startsWith('http') ? <img src={p.icon} alt={p.name} style={{ width: 16, height: 16, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle' }} /> : p.icon} {p.name}</span>
                              <span style={{ color: getColor(p.absSpread) }}>{formatSpread(p.spread)}</span>
                              <span className="action-v3">Buy {p.buyChain}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'live' && (
                <div className="live-tab-v3">
                  <div className="live-header-v3"><span className="dot-v3"></span> LIVE • CoinGecko + DEX • 5s</div>
                  <div className="live-grid-v3">
                    {pairData.map(p => (
                      <div key={p.id} className="live-card-v3">
                        <div className="name-v3">{p.icon.startsWith('http') ? <img src={p.icon} alt={p.name} style={{ width: 18, height: 18, borderRadius: '50%', marginRight: 6, verticalAlign: 'middle' }} /> : p.icon} {p.name}</div>
                        <div className="spread-v3" style={{ color: getColor(p.absSpread) }}>{formatSpread(p.spread)}</div>
                        <div className="status-v3">{getStatus(p.absSpread)}</div>
                        {p.refPrice && (
                          <div style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>
                            Ref: {formatPrice(p.refPrice)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="summary-v3">
                    <div><span>Best:</span> <span>{bestOpp?.name} {formatSpread(bestOpp?.spread)}</span></div>
                    <div><span>Hot (4%+):</span> <span>{pairData.filter(p => p.absSpread >= 4).length} pairs</span></div>
                  </div>
                </div>
              )}

              {activeTab === 'learn' && (
                <div className="learn-tab-v3">
                  <div className="section-v3">
                    <h4>🔄 Cross-Chain Arbitrage</h4>
                    <p>Buy token on cheaper chain → Bridge → Sell on expensive chain</p>
                  </div>
                  <div className="section-v3">
                    <h4>📊 Spread Meaning</h4>
                    <p>+% = ETH more expensive → Buy PLS</p>
                    <p>-% = PLS more expensive → Buy ETH</p>
                  </div>
                  <div className="section-v3">
                    <h4>💰 Profitability</h4>
                    <p>• &lt;3% = Usually not worth it</p>
                    <p>• 3-5% = May cover fees</p>
                    <p>• 5%+ = Likely profitable</p>
                  </div>
                  <div className="section-v3">
                    <h4>🔗 Bridge Options</h4>
                    <a href={BRIDGE_LINKS.zapperX} className="link-btn-v3">⚡ ZapperX (DTGC.io)</a>
                    <a href={BRIDGE_LINKS.pulseRamp} className="link-btn-v3">🌉 PulseRamp</a>
                  </div>
                </div>
              )}
            </div>

            <div className="gex-footer-v3">
              <span className="wallet-v3">{walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : 'Not Connected'}</span>
              <span className="update-v3">{lastUpdate?.toLocaleTimeString() || ''}</span>
              <span className={`balance-v3 ${isUnlocked ? 'unlocked' : ''}`}>${dtgcUSDValue.toFixed(0)} {isUnlocked && '✓'}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const STYLES = `
.gex-widget-v3 { position: fixed; z-index: 9999; font-family: -apple-system, sans-serif; }
.gex-trigger-v3 { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #1a1a2e, #0d0d1a); border: 2px solid #FFD700; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 20px rgba(255,215,0,0.3); transition: all 0.3s; position: relative; }
.gex-trigger-v3:hover { transform: scale(1.1); }
.gex-icon-v3 { font-size: 20px; }
.gex-label-v3 { font-size: 9px; color: #FFD700; font-weight: bold; }
.gex-badge-v3 { position: absolute; top: -4px; right: -4px; background: #00FF88; color: #000; font-size: 9px; font-weight: bold; padding: 2px 5px; border-radius: 8px; }

.gex-panel-v3 { width: 360px; max-height: 580px; background: linear-gradient(180deg, #1a1a2e, #0d0d1a); border: 2px solid rgba(255,215,0,0.4); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow: hidden; }

/* Mobile responsive */
@media (max-width: 480px) {
  .gex-widget-v3 { right: 10px !important; bottom: 130px !important; left: auto !important; }
  .gex-trigger-v3 { width: 44px; height: 44px; }
  .gex-trigger-v3:hover { transform: none; }
  .gex-icon-v3 { font-size: 16px; }
  .gex-label-v3 { font-size: 8px; }
  .gex-badge-v3 { font-size: 8px; padding: 1px 4px; top: -2px; right: -2px; }
  .gex-panel-v3 { width: calc(100vw - 20px); max-width: 360px; border-radius: 12px; max-height: 75vh; }
  .gex-header-v3 { padding: 10px 12px; }
  .gex-logo-v3 { font-size: 14px; }
  .gex-content-v3 { padding: 10px; max-height: 300px; }
  .gex-tabs-v3 button { padding: 8px 2px; font-size: 9px; }
  .pair-row-v3 { padding: 8px; }
  .pair-prices-v3 { font-size: 10px; }
  .live-grid-v3 { grid-template-columns: 1fr; }
}

.gex-header-v3 { display: flex; align-items: center; padding: 12px 14px; background: rgba(255,215,0,0.1); border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-title-v3 { flex: 1; }
.gex-logo-v3 { color: #FFD700; font-weight: 800; font-size: 16px; }
.gex-subtitle-v3 { display: block; color: #888; font-size: 10px; }
.gex-info-btn-v3 { width: 26px; height: 26px; border-radius: 50%; background: transparent; border: 1px solid rgba(255,215,0,0.5); color: #FFD700; cursor: pointer; margin-right: 8px; }
.gex-close-v3 { background: transparent; border: none; color: #888; font-size: 18px; cursor: pointer; }

.gex-info-v3 { padding: 12px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-info-v3 p { color: #aaa; font-size: 11px; margin: 4px 0; }
.gex-info-v3 button { width: 100%; padding: 8px; background: #FFD700; border: none; border-radius: 6px; color: #000; font-weight: bold; cursor: pointer; margin-top: 8px; }

.gex-tabs-v3 { display: flex; border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-tabs-v3 button { flex: 1; padding: 10px 4px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #666; font-size: 10px; cursor: pointer; }
.gex-tabs-v3 button.active { border-bottom-color: #FFD700; color: #FFD700; background: rgba(255,215,0,0.1); }

.gex-content-v3 { padding: 14px; max-height: 380px; overflow-y: auto; }
.loading-v3 { text-align: center; padding: 30px; color: #888; }
.no-data-v3 { text-align: center; padding: 30px; color: #666; font-size: 12px; }

.gex-footer-v3 { display: flex; justify-content: space-between; padding: 10px 14px; border-top: 1px solid rgba(255,215,0,0.2); background: rgba(0,0,0,0.3); font-size: 10px; }
.wallet-v3 { color: #666; }
.update-v3 { color: #888; }
.balance-v3 { color: #888; }
.balance-v3.unlocked { color: #00FF88; font-weight: bold; }

.view-toggle-v3 { display: flex; gap: 8px; margin-bottom: 12px; }
.view-toggle-v3 button { flex: 1; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #888; font-size: 11px; cursor: pointer; }
.view-toggle-v3 button.active { background: rgba(255,215,0,0.15); border-color: #FFD700; color: #FFD700; }

.pairs-list-v3 { display: flex; flex-direction: column; gap: 6px; }
.pair-row-v3 { display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.pair-row-v3:hover { background: rgba(255,215,0,0.1); }
.pair-row-v3.hot { border-color: rgba(0,255,136,0.4); background: rgba(0,255,136,0.05); }
.pair-icon-v3 { font-size: 16px; margin-right: 8px; }
.pair-name-v3 { width: 50px; font-weight: 600; color: #fff; font-size: 12px; }
.pair-prices-v3 { flex: 1; display: flex; align-items: center; gap: 4px; font-size: 9px; justify-content: center; }
.pair-prices-v3 .eth { color: #627eea; }
.pair-prices-v3 .sep { color: #444; }
.pair-prices-v3 .pls { color: #00FF88; }
.pair-spread-v3 { width: 60px; text-align: right; font-weight: 700; font-size: 12px; }

.pair-selector-v3 { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pair-selector-v3 button { padding: 6px 10px; background: rgba(255,255,255,0.05); border: 2px solid transparent; border-radius: 6px; color: #888; font-size: 10px; cursor: pointer; }
.pair-selector-v3 button.active { background: rgba(255,215,0,0.15); color: #FFD700; }

.spread-main-v3 { text-align: center; padding: 16px; background: rgba(255,215,0,0.05); border-radius: 10px; margin-bottom: 12px; }
.spread-label-v3 { font-size: 10px; color: #888; margin-bottom: 4px; }
.spread-value-v3 { font-size: 32px; font-weight: bold; text-shadow: 0 0 20px currentColor; }
.spread-status-v3 { display: inline-block; padding: 4px 12px; border-radius: 20px; border: 1px solid; font-size: 10px; font-weight: bold; margin-top: 8px; }

.action-btn-v3 { width: 100%; padding: 12px; margin-bottom: 12px; background: transparent; border: 2px solid #FFD700; border-radius: 8px; color: #FFD700; font-size: 13px; font-weight: bold; cursor: pointer; }
.action-btn-v3:hover { background: rgba(255,215,0,0.15); }

.price-cards-v3 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.card-v3 { padding: 10px; border-radius: 8px; }
.card-v3.eth { background: rgba(98,126,234,0.1); border: 1px solid rgba(98,126,234,0.3); }
.card-v3.pls { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); }
.chain-v3 { font-size: 9px; margin-bottom: 2px; }
.card-v3.eth .chain-v3 { color: #627eea; }
.card-v3.pls .chain-v3 { color: #00FF88; }
.token-v3 { font-size: 10px; color: #888; }
.price-v3 { font-size: 14px; font-weight: bold; color: #fff; }

.direction-box-v3 { padding: 12px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 8px; text-align: center; margin-bottom: 12px; }
.direction-box-v3 .label-v3 { font-size: 9px; color: #FFD700; margin-bottom: 6px; }
.direction-box-v3 .value-v3 { font-size: 11px; color: #fff; }
.buy-v3 { color: #00FF88; font-weight: bold; }
.sell-v3 { color: #FF6B6B; font-weight: bold; }

.bridge-links-v3 { padding: 12px; background: rgba(138,43,226,0.1); border: 1px solid rgba(138,43,226,0.3); border-radius: 8px; }
.bridge-label-v3 { font-size: 10px; color: #9932CC; margin-bottom: 8px; text-align: center; }
.bridge-btns-v3 { display: flex; gap: 6px; }
.bridge-btn-v3 { flex: 1; padding: 8px 4px; border-radius: 6px; text-decoration: none; font-size: 10px; font-weight: bold; text-align: center; }
.bridge-btn-v3.zapperx { background: linear-gradient(135deg, #FFD700, #FFA500); color: #000; }
.bridge-btn-v3.pulseramp { background: rgba(0,255,136,0.2); border: 1px solid #00FF88; color: #00FF88; }
.bridge-btn-v3.portal { background: rgba(138,43,226,0.2); border: 1px solid #9932CC; color: #9932CC; }

.push-confirm-v3 { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 8px; margin-top: 12px; font-size: 11px; color: #00FF88; }

.signals-tab-v3 .locked-v3 { text-align: center; padding: 20px; }
.signals-tab-v3 .locked-v3 .icon-v3 { font-size: 40px; margin-bottom: 8px; }
.signals-tab-v3 .locked-v3 .title-v3 { font-size: 16px; color: #FFD700; font-weight: bold; }
.signals-tab-v3 .locked-v3 .desc-v3 { font-size: 12px; color: #888; margin: 8px 0; }
.signals-tab-v3 .locked-v3 button { padding: 10px 20px; background: #FFD700; border: none; border-radius: 8px; color: #000; font-weight: bold; cursor: pointer; }
.signals-tab-v3 .unlocked-header-v3 { margin-bottom: 8px; }
.signals-tab-v3 .badge-v3 { padding: 4px 10px; background: rgba(0,255,136,0.1); border: 1px solid #00FF88; border-radius: 6px; color: #00FF88; font-size: 11px; }
.signals-tab-v3 p { font-size: 11px; color: #aaa; margin: 8px 0; }
.signals-tab-v3 .opps-v3 h4 { font-size: 12px; color: #FFD700; margin: 12px 0 8px; }
.signals-tab-v3 .none-v3 { text-align: center; padding: 20px; color: #666; font-size: 11px; }
.signals-tab-v3 .opp-card-v3 { display: flex; align-items: center; gap: 8px; padding: 10px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 8px; margin-bottom: 6px; font-size: 12px; }
.signals-tab-v3 .opp-card-v3 .action-v3 { margin-left: auto; color: #888; font-size: 10px; }

.live-tab-v3 .live-header-v3 { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,255,136,0.1); border-radius: 8px; margin-bottom: 12px; font-size: 11px; color: #00FF88; }
.live-tab-v3 .dot-v3 { width: 8px; height: 8px; background: #00FF88; border-radius: 50%; animation: pulse-v3 2s infinite; }
@keyframes pulse-v3 { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.live-grid-v3 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
.live-card-v3 { padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; }
.live-card-v3 .name-v3 { font-size: 11px; color: #888; }
.live-card-v3 .spread-v3 { font-size: 18px; font-weight: bold; }
.live-card-v3 .status-v3 { font-size: 9px; color: #666; }
.summary-v3 { padding: 10px; background: rgba(255,215,0,0.05); border-radius: 8px; }
.summary-v3 div { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; }
.summary-v3 span:first-child { color: #888; }
.summary-v3 span:last-child { color: #FFD700; }

.learn-tab-v3 .section-v3 { margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; }
.learn-tab-v3 h4 { color: #FFD700; font-size: 12px; margin: 0 0 6px; }
.learn-tab-v3 p { color: #aaa; font-size: 11px; margin: 4px 0; }
.learn-tab-v3 .link-btn-v3 { display: block; padding: 10px; background: rgba(255,215,0,0.1); border: 1px solid #FFD700; border-radius: 6px; color: #FFD700; text-align: center; text-decoration: none; font-weight: bold; margin-top: 8px; }
`;

export default GEXWidgetV3;
// V3.2.1
