/**
 * GEXWidget.jsx - Growth Engine X-Chain Monitor V3.0
 *
 * MULTI-PAIR ARBITRAGE MONITORING
 * ✅ eHEX, WETH, USDC, USDT, DAI, WBTC
 * ✅ Corrected price fetching with proper token addresses
 * ✅ Automatic signal detection (≥3% spread)
 * ✅ Lambda integration for Telegram alerts
 * ✅ Sorted by best opportunity
 */

import React, { useState, useEffect, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  DTGC_GATE_USD: 200,
  SIGNAL_QUEUE_URL: 'https://iwnaatxjwerbpg7jtslldoxeqm0msvdt.lambda-url.us-east-2.on.aws/',
  MIN_SPREAD_SIGNAL: 3,
  MIN_SPREAD_OPPORTUNITY: 5,
  SIGNAL_COOLDOWN_MS: 120000,
  PRICE_REFRESH_MS: 15000,
};

// ═══════════════════════════════════════════════════════════════
// BRIDGED TOKEN PAIRS - Ethereum ↔ PulseChain
// All addresses verified from PulseChain bridge
// ═══════════════════════════════════════════════════════════════

const BRIDGED_PAIRS = [
  {
    id: 'ehex',
    name: 'eHEX',
    icon: '💎',
    ethAddress: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', // HEX on Ethereum
    plsAddress: '0x57fde0a71132198BBeC939B98976993d8D89D225', // eHEX (bridged) on PulseChain
    color: '#627eea',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x57fde0a71132198BBeC939B98976993d8D89D225',
    },
  },
  {
    id: 'weth',
    name: 'WETH',
    icon: '⟠',
    ethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Ethereum
    plsAddress: '0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C', // eWETH (bridged) on PulseChain
    color: '#627eea',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x02DcdD04e3F455D838cd1249292C58f3B79e3C3C',
    },
  },
  {
    id: 'usdc',
    name: 'USDC',
    icon: '💵',
    ethAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    plsAddress: '0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07', // eUSDC (bridged) on PulseChain
    color: '#2775CA',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07',
    },
  },
  {
    id: 'usdt',
    name: 'USDT',
    icon: '💲',
    ethAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
    plsAddress: '0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f', // eUSDT (bridged) on PulseChain
    color: '#26A17B',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0xdAC17F958D2ee523a2206206994597C13D831ec7',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f',
    },
  },
  {
    id: 'dai',
    name: 'DAI',
    icon: '🔶',
    ethAddress: '0x6B175474E89094C44Da98b954EedeBC495271d0F', // DAI on Ethereum
    plsAddress: '0xefD766cCb38EaF1dfd701853BFCe31359239F305', // eDAI (bridged) on PulseChain
    color: '#F5AC37',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0x6B175474E89094C44Da98b954EedeBC495271d0F',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0xefD766cCb38EaF1dfd701853BFCe31359239F305',
    },
  },
  {
    id: 'wbtc',
    name: 'WBTC',
    icon: '₿',
    ethAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC on Ethereum
    plsAddress: '0xb17D901469B9208B17d916112988A3FeD19b5cA1', // eWBTC (bridged) on PulseChain
    color: '#F7931A',
    dexLinks: {
      eth: 'https://app.uniswap.org/#/swap?outputCurrency=0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      pls: 'https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0xb17D901469B9208B17d916112988A3FeD19b5cA1',
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// SIGNAL SERVICE
// ═══════════════════════════════════════════════════════════════

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
          signal: { ...signal, source: 'GEX_V3', timestamp: now }
        })
      });
      
      if (response.ok) {
        this.lastPushTime[key] = now;
        const result = await response.json();
        console.log('[GEX] ✅ Signal pushed:', signal.pair, signal.spread.toFixed(2) + '%');
        return { success: true, ...result };
      }
      return { success: false, reason: 'api_error' };
    } catch (err) {
      console.error('[GEX] Signal error:', err);
      return { success: false, reason: err.message };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// PRICE SERVICE - Uses DexScreener /tokens/ endpoint
// ═══════════════════════════════════════════════════════════════

class PriceService {
  static cache = {};
  
  static async fetchPrice(address, chain) {
    const cacheKey = `${chain}-${address}`;
    const cached = this.cache[cacheKey];
    if (cached && Date.now() - cached.time < 10000) return cached.price;
    
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
      const res = await fetch(url);
      const data = await res.json();
      
      // Filter by chain and get most liquid pair
      const chainId = chain === 'eth' ? 'ethereum' : 'pulsechain';
      let pairs = data.pairs?.filter(p => p.chainId === chainId) || [];
      if (pairs.length === 0) pairs = data.pairs || [];
      
      // Sort by liquidity
      pairs.sort((a, b) => (parseFloat(b.liquidity?.usd) || 0) - (parseFloat(a.liquidity?.usd) || 0));
      
      const price = pairs[0]?.priceUsd ? parseFloat(pairs[0].priceUsd) : null;
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
        const [ethPrice, plsPrice] = await Promise.all([
          this.fetchPrice(pair.ethAddress, 'eth'),
          this.fetchPrice(pair.plsAddress, 'pls'),
        ]);
        
        // Calculate spread
        let spread = 0, absSpread = 0, buyChain = '', sellChain = '';
        if (ethPrice && plsPrice) {
          spread = ((ethPrice - plsPrice) / plsPrice) * 100;
          absSpread = Math.abs(spread);
          buyChain = spread > 0 ? 'PULSECHAIN' : 'ETHEREUM';
          sellChain = spread > 0 ? 'ETHEREUM' : 'PULSECHAIN';
        }
        
        return { ...pair, ethPrice, plsPrice, spread, absSpread, buyChain, sellChain };
      })
    );
    
    // Sort by spread (best first)
    return results.sort((a, b) => b.absSpread - a.absSpread);
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN WIDGET
// ═══════════════════════════════════════════════════════════════

export const GEXWidget = ({
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

  // Fetch prices
  const fetchPrices = useCallback(async () => {
    try {
      const data = await PriceService.fetchAllPairs();
      setPairData(data);
      setLastUpdate(new Date());
      setLoading(false);
      
      // Push signals for opportunities
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
    if (abs < 3) return 'WATCHING';
    if (abs < 5) return 'SIGNAL';
    return '🔥 HOT';
  };

  const formatPrice = (p) => p ? (p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(6)}`) : '--';
  const formatSpread = (s) => s !== undefined ? `${s >= 0 ? '+' : ''}${s.toFixed(2)}%` : '--';

  return (
    <>
      <style>{STYLES}</style>
      <div className="gex-widget" style={{ ...positionStyles[position] }}>
        {!isExpanded ? (
          <button onClick={() => setIsExpanded(true)} className="gex-trigger">
            <span className="gex-icon">⚡</span>
            <span className="gex-label">GEX</span>
            {bestOpp?.absSpread >= 3 && <span className="gex-badge">{bestOpp.absSpread.toFixed(1)}%</span>}
          </button>
        ) : (
          <div className="gex-panel">
            {/* Header */}
            <div className="gex-header">
              <div className="gex-title">
                <span className="gex-logo">⚡ GEX V3</span>
                <span className="gex-subtitle">Multi-Pair Arbitrage</span>
              </div>
              <button onClick={() => setShowInfo(!showInfo)} className="gex-info-btn">?</button>
              <button onClick={() => setIsExpanded(false)} className="gex-close">✕</button>
            </div>

            {/* Info */}
            {showInfo && (
              <div className="gex-info">
                <p><strong>GEX V3</strong> monitors 6 bridged tokens for arbitrage between ETH ↔ PLS.</p>
                <p>📊 eHEX, WETH, USDC, USDT, DAI, WBTC</p>
                <p>🎯 Signals at 3%+ spread</p>
                <button onClick={() => setShowInfo(false)}>Got it!</button>
              </div>
            )}

            {/* Tabs */}
            <div className="gex-tabs">
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

            {/* Content */}
            <div className="gex-content">
              {/* SPREAD TAB */}
              {activeTab === 'spread' && (
                <div className="spread-tab">
                  {/* View Toggle */}
                  <div className="view-toggle">
                    <button className={viewMode === 'all' ? 'active' : ''} onClick={() => setViewMode('all')}>All Pairs</button>
                    <button className={viewMode === 'single' ? 'active' : ''} onClick={() => setViewMode('single')}>Detail</button>
                  </div>

                  {loading ? <div className="loading">Loading...</div> : viewMode === 'all' ? (
                    /* ALL PAIRS */
                    <div className="pairs-list">
                      {pairData.map(p => (
                        <div key={p.id} className={`pair-row ${p.absSpread >= 3 ? 'hot' : ''}`} onClick={() => { setSelectedPair(p.id); setViewMode('single'); }}>
                          <span className="pair-icon">{p.icon}</span>
                          <span className="pair-name">{p.name}</span>
                          <span className="pair-prices">
                            <span className="eth">{formatPrice(p.ethPrice)}</span>
                            <span className="sep">↔</span>
                            <span className="pls">{formatPrice(p.plsPrice)}</span>
                          </span>
                          <span className="pair-spread" style={{ color: getColor(p.absSpread) }}>{formatSpread(p.spread)}</span>
                        </div>
                      ))}
                    </div>
                  ) : currentPair && (
                    /* SINGLE PAIR */
                    <div className="single-view">
                      {/* Selector */}
                      <div className="pair-selector">
                        {pairData.map(p => (
                          <button key={p.id} className={selectedPair === p.id ? 'active' : ''} onClick={() => setSelectedPair(p.id)} style={{ borderColor: selectedPair === p.id ? p.color : 'transparent' }}>
                            {p.icon} {p.name} {p.absSpread >= 3 && '🔥'}
                          </button>
                        ))}
                      </div>

                      {/* Main Display */}
                      <div className="spread-main">
                        <div className="spread-label">{currentPair.name}(E) / {currentPair.name}(P)</div>
                        <div className="spread-value" style={{ color: getColor(currentPair.absSpread) }}>{formatSpread(currentPair.spread)}</div>
                        <div className="spread-status" style={{ color: getColor(currentPair.absSpread), borderColor: getColor(currentPair.absSpread) }}>{getStatus(currentPair.absSpread)}</div>
                      </div>

                      {/* Buy Button */}
                      {currentPair.absSpread >= 2 && (
                        <button className="action-btn" onClick={() => window.open(currentPair.spread > 0 ? currentPair.dexLinks.pls : currentPair.dexLinks.eth, '_blank')}>
                          ⭐ BUY {currentPair.name} on {currentPair.buyChain}
                        </button>
                      )}

                      {/* Price Cards */}
                      <div className="price-cards">
                        <div className="card eth">
                          <div className="chain">◆ ETHEREUM</div>
                          <div className="token">{currentPair.name}(E)</div>
                          <div className="price">{formatPrice(currentPair.ethPrice)}</div>
                        </div>
                        <div className="card pls">
                          <div className="chain">💜 PULSECHAIN</div>
                          <div className="token">{currentPair.name}(P)</div>
                          <div className="price">{formatPrice(currentPair.plsPrice)}</div>
                        </div>
                      </div>

                      {/* Direction */}
                      {currentPair.absSpread >= 2 && (
                        <div className="direction-box">
                          <div className="label">ARBITRAGE DIRECTION</div>
                          <div className="value">
                            <span className="buy">BUY on {currentPair.buyChain}</span> → Bridge → <span className="sell">SELL on {currentPair.sellChain}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Signal Confirmation */}
                  {lastPush && Date.now() - lastPush.time < 60000 && (
                    <div className="push-confirm">📡 Signal: {lastPush.pair} +{lastPush.spread.toFixed(1)}%</div>
                  )}
                </div>
              )}

              {/* SIGNALS TAB */}
              {activeTab === 'signals' && (
                <div className="signals-tab">
                  {!isUnlocked ? (
                    <div className="locked">
                      <div className="icon">🔒</div>
                      <div className="title">Premium Signals</div>
                      <div className="desc">Hold ${CONFIG.DTGC_GATE_USD}+ DTGC to unlock</div>
                      <button onClick={() => window.open('https://dtgc.io', '_blank')}>GET DTGC →</button>
                    </div>
                  ) : (
                    <>
                      <div className="unlocked-header"><span className="badge">✓ UNLOCKED</span></div>
                      <p>🔔 Telegram signals at 3%+ spread</p>
                      <div className="opps">
                        <h4>Current Opportunities</h4>
                        {pairData.filter(p => p.absSpread >= 3).length === 0 ? (
                          <div className="none">📡 Monitoring {BRIDGED_PAIRS.length} pairs...</div>
                        ) : (
                          pairData.filter(p => p.absSpread >= 3).map(p => (
                            <div key={p.id} className="opp-card">
                              <span>{p.icon} {p.name}</span>
                              <span style={{ color: getColor(p.absSpread) }}>{formatSpread(p.spread)}</span>
                              <span className="action">Buy {p.buyChain}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* LIVE TAB */}
              {activeTab === 'live' && (
                <div className="live-tab">
                  <div className="live-header"><span className="dot"></span> LIVE • Updates 15s</div>
                  <div className="live-grid">
                    {pairData.map(p => (
                      <div key={p.id} className="live-card">
                        <div className="name">{p.icon} {p.name}</div>
                        <div className="spread" style={{ color: getColor(p.absSpread) }}>{formatSpread(p.spread)}</div>
                        <div className="status">{getStatus(p.absSpread)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="summary">
                    <div><span>Best:</span> <span>{bestOpp?.name} {formatSpread(bestOpp?.spread)}</span></div>
                    <div><span>Hot (3%+):</span> <span>{pairData.filter(p => p.absSpread >= 3).length} pairs</span></div>
                  </div>
                </div>
              )}

              {/* LEARN TAB */}
              {activeTab === 'learn' && (
                <div className="learn-tab">
                  <div className="section">
                    <h4>🔄 Cross-Chain Arbitrage</h4>
                    <p>Buy token on cheaper chain → Bridge → Sell on expensive chain</p>
                  </div>
                  <div className="section">
                    <h4>📊 Spread Meaning</h4>
                    <p>+% = ETH more expensive → Buy PLS</p>
                    <p>-% = PLS more expensive → Buy ETH</p>
                  </div>
                  <div className="section">
                    <h4>💰 Profitability</h4>
                    <p>• &lt;3% = Usually not worth it</p>
                    <p>• 3-5% = May cover fees</p>
                    <p>• 5%+ = Likely profitable</p>
                  </div>
                  <div className="section">
                    <h4>🔗 Bridge</h4>
                    <a href="https://pulseramp.com" target="_blank" rel="noopener noreferrer">PulseRamp →</a>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="gex-footer">
              <span className="wallet">{walletAddress ? `${walletAddress.slice(0,6)}...${walletAddress.slice(-4)}` : 'Not Connected'}</span>
              <span className="update">{lastUpdate?.toLocaleTimeString() || ''}</span>
              <span className={`balance ${isUnlocked ? 'unlocked' : ''}`}>${dtgcUSDValue.toFixed(0)} {isUnlocked && '✓'}</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════

const STYLES = `
.gex-widget { position: fixed; z-index: 9999; font-family: -apple-system, sans-serif; }
.gex-trigger { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #1a1a2e, #0d0d1a); border: 2px solid #FFD700; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 20px rgba(255,215,0,0.3); transition: all 0.3s; position: relative; }
.gex-trigger:hover { transform: scale(1.1); }
.gex-icon { font-size: 20px; }
.gex-label { font-size: 9px; color: #FFD700; font-weight: bold; }
.gex-badge { position: absolute; top: -4px; right: -4px; background: #00FF88; color: #000; font-size: 9px; font-weight: bold; padding: 2px 5px; border-radius: 8px; }

.gex-panel { width: 360px; max-height: 580px; background: linear-gradient(180deg, #1a1a2e, #0d0d1a); border: 2px solid rgba(255,215,0,0.4); border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow: hidden; }

.gex-header { display: flex; align-items: center; padding: 12px 14px; background: rgba(255,215,0,0.1); border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-title { flex: 1; }
.gex-logo { color: #FFD700; font-weight: 800; font-size: 16px; }
.gex-subtitle { display: block; color: #888; font-size: 10px; }
.gex-info-btn { width: 26px; height: 26px; border-radius: 50%; background: transparent; border: 1px solid rgba(255,215,0,0.5); color: #FFD700; cursor: pointer; margin-right: 8px; }
.gex-close { background: transparent; border: none; color: #888; font-size: 18px; cursor: pointer; }

.gex-info { padding: 12px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-info p { color: #aaa; font-size: 11px; margin: 4px 0; }
.gex-info button { width: 100%; padding: 8px; background: #FFD700; border: none; border-radius: 6px; color: #000; font-weight: bold; cursor: pointer; margin-top: 8px; }

.gex-tabs { display: flex; border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-tabs button { flex: 1; padding: 10px 4px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #666; font-size: 10px; cursor: pointer; }
.gex-tabs button.active { border-bottom-color: #FFD700; color: #FFD700; background: rgba(255,215,0,0.1); }

.gex-content { padding: 14px; max-height: 380px; overflow-y: auto; }
.loading { text-align: center; padding: 30px; color: #888; }

.gex-footer { display: flex; justify-content: space-between; padding: 10px 14px; border-top: 1px solid rgba(255,215,0,0.2); background: rgba(0,0,0,0.3); font-size: 10px; }
.wallet { color: #666; }
.update { color: #888; }
.balance { color: #888; }
.balance.unlocked { color: #00FF88; font-weight: bold; }

/* View Toggle */
.view-toggle { display: flex; gap: 8px; margin-bottom: 12px; }
.view-toggle button { flex: 1; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #888; font-size: 11px; cursor: pointer; }
.view-toggle button.active { background: rgba(255,215,0,0.15); border-color: #FFD700; color: #FFD700; }

/* Pairs List */
.pairs-list { display: flex; flex-direction: column; gap: 6px; }
.pair-row { display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; cursor: pointer; transition: all 0.2s; }
.pair-row:hover { background: rgba(255,215,0,0.1); }
.pair-row.hot { border-color: rgba(0,255,136,0.4); background: rgba(0,255,136,0.05); }
.pair-icon { font-size: 16px; margin-right: 8px; }
.pair-name { width: 50px; font-weight: 600; color: #fff; font-size: 12px; }
.pair-prices { flex: 1; display: flex; align-items: center; gap: 4px; font-size: 9px; justify-content: center; }
.pair-prices .eth { color: #627eea; }
.pair-prices .sep { color: #444; }
.pair-prices .pls { color: #00FF88; }
.pair-spread { width: 60px; text-align: right; font-weight: 700; font-size: 12px; }

/* Pair Selector */
.pair-selector { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.pair-selector button { padding: 6px 10px; background: rgba(255,255,255,0.05); border: 2px solid transparent; border-radius: 6px; color: #888; font-size: 10px; cursor: pointer; }
.pair-selector button.active { background: rgba(255,215,0,0.15); color: #FFD700; }

/* Spread Main */
.spread-main { text-align: center; padding: 16px; background: rgba(255,215,0,0.05); border-radius: 10px; margin-bottom: 12px; }
.spread-label { font-size: 10px; color: #888; margin-bottom: 4px; }
.spread-value { font-size: 32px; font-weight: bold; text-shadow: 0 0 20px currentColor; }
.spread-status { display: inline-block; padding: 4px 12px; border-radius: 20px; border: 1px solid; font-size: 10px; font-weight: bold; margin-top: 8px; }

/* Action Button */
.action-btn { width: 100%; padding: 12px; margin-bottom: 12px; background: transparent; border: 2px solid #FFD700; border-radius: 8px; color: #FFD700; font-size: 13px; font-weight: bold; cursor: pointer; }
.action-btn:hover { background: rgba(255,215,0,0.15); }

/* Price Cards */
.price-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.card { padding: 10px; border-radius: 8px; }
.card.eth { background: rgba(98,126,234,0.1); border: 1px solid rgba(98,126,234,0.3); }
.card.pls { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); }
.card .chain { font-size: 9px; margin-bottom: 2px; }
.card.eth .chain { color: #627eea; }
.card.pls .chain { color: #00FF88; }
.card .token { font-size: 10px; color: #888; }
.card .price { font-size: 14px; font-weight: bold; color: #fff; }

/* Direction Box */
.direction-box { padding: 12px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 8px; text-align: center; }
.direction-box .label { font-size: 9px; color: #FFD700; margin-bottom: 6px; }
.direction-box .value { font-size: 11px; color: #fff; }
.direction-box .buy { color: #00FF88; font-weight: bold; }
.direction-box .sell { color: #FF6B6B; font-weight: bold; }

/* Push Confirm */
.push-confirm { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 8px; margin-top: 12px; font-size: 11px; color: #00FF88; }

/* Signals Tab */
.signals-tab .locked { text-align: center; padding: 20px; }
.signals-tab .locked .icon { font-size: 40px; margin-bottom: 8px; }
.signals-tab .locked .title { font-size: 16px; color: #FFD700; font-weight: bold; }
.signals-tab .locked .desc { font-size: 12px; color: #888; margin: 8px 0; }
.signals-tab .locked button { padding: 10px 20px; background: #FFD700; border: none; border-radius: 8px; color: #000; font-weight: bold; cursor: pointer; }
.signals-tab .unlocked-header { margin-bottom: 8px; }
.signals-tab .badge { padding: 4px 10px; background: rgba(0,255,136,0.1); border: 1px solid #00FF88; border-radius: 6px; color: #00FF88; font-size: 11px; }
.signals-tab p { font-size: 11px; color: #aaa; margin: 8px 0; }
.signals-tab .opps h4 { font-size: 12px; color: #FFD700; margin: 12px 0 8px; }
.signals-tab .none { text-align: center; padding: 20px; color: #666; font-size: 11px; }
.signals-tab .opp-card { display: flex; align-items: center; gap: 8px; padding: 10px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 8px; margin-bottom: 6px; font-size: 12px; }
.signals-tab .opp-card .action { margin-left: auto; color: #888; font-size: 10px; }

/* Live Tab */
.live-tab .live-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,255,136,0.1); border-radius: 8px; margin-bottom: 12px; font-size: 11px; color: #00FF88; }
.live-tab .dot { width: 8px; height: 8px; background: #00FF88; border-radius: 50%; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.live-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
.live-card { padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; }
.live-card .name { font-size: 11px; color: #888; }
.live-card .spread { font-size: 18px; font-weight: bold; }
.live-card .status { font-size: 9px; color: #666; }
.summary { padding: 10px; background: rgba(255,215,0,0.05); border-radius: 8px; }
.summary div { display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0; }
.summary span:first-child { color: #888; }
.summary span:last-child { color: #FFD700; }

/* Learn Tab */
.learn-tab .section { margin-bottom: 12px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; }
.learn-tab h4 { color: #FFD700; font-size: 12px; margin: 0 0 6px; }
.learn-tab p { color: #aaa; font-size: 11px; margin: 4px 0; }
.learn-tab a { display: block; padding: 10px; background: #FFD700; border-radius: 6px; color: #000; text-align: center; text-decoration: none; font-weight: bold; }
`;

export default GEXWidget;
// V3.0.1
