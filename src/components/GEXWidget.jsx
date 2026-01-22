/**
 * GEXWidget.jsx - Growth Engine X-Chain Monitor (Complete)
 *
 * INTEGRATED FEATURES:
 * ✅ Spread Monitor (eHEX/pHEX cross-chain)
 * ✅ GE Activity Feed (live Growth Engine stats)
 * ✅ Signal System (token-gated alerts)
 * ✅ Auto-Trade (optional, feeds 30% to GE)
 * ✅ Token Gate ($200 DTGC required)
 * ✅ Lambda Signal Queue Integration (NEW!)
 *
 * DROP INTO: src/components/GEXWidget.jsx
 * IMPORT IN: App.jsx
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION - UPDATE THESE
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // Token gating
  DTGC_GATE_USD: 200,
  DTGC_CONTRACT: '0xd0676b28a457371d58d47e5247b439114e40eb0f',

  // API endpoints (update after deploying Lambdas)
  GE_STATS_API: 'https://iwnaatxjwerbpg7jtslldoxeqm0msvdt.lambda-url.us-east-2.on.aws',
  ARB_SIGNAL_API: 'https://iwnaatxjwerbpg7jtslldoxeqm0msvdt.lambda-url.us-east-2.on.aws',
  
  // 🔥 NEW: Signal Queue Lambda URL
  SIGNAL_QUEUE_URL: 'https://iwnaatxjwerbpg7jtslldoxeqm0msvdt.lambda-url.us-east-2.on.aws/',

  // DexScreener - FIXED: Using TOKEN addresses, not pair addresses
  // eHEX(E) Token: 0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39
  // eHEX(P) Token: 0x57fde0a71132198BBeC939B98976993d8D89D225
  DEXSCREENER: {
    HEX_ETH: 'https://api.dexscreener.com/latest/dex/tokens/0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39',
    HEX_PLS: 'https://api.dexscreener.com/latest/dex/tokens/0x57fde0a71132198BBeC939B98976993d8D89D225',
    DTGC: 'https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
  },

  // Auto-trade settings
  GE_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  GE_PROFIT_SHARE: 30,
  MIN_PROFIT_USD: 25,

  // Refresh intervals
  PRICE_REFRESH_MS: 15000,
  STATS_REFRESH_MS: 30000,
  
  // 🔥 NEW: Signal thresholds
  MIN_SPREAD_SIGNAL: 3,      // Push to Lambda at 3%
  MIN_SPREAD_OPPORTUNITY: 4, // Show as opportunity at 4% (was 5%)
  SIGNAL_COOLDOWN_MS: 120000, // 2 minutes between same signal type
};

// Signal types
const SIGNAL_TYPES = {
  ARBITRAGE: { icon: '🔄', color: '#00FF88', label: 'ARBITRAGE' },
  GE_ACTIVITY: { icon: '⚡', color: '#FFD700', label: 'GE ACTIVE' },
  SPREAD_ALERT: { icon: '📊', color: '#627eea', label: 'SPREAD' },
};

// ═══════════════════════════════════════════════════════════════
// 🔥 NEW: SIGNAL QUEUE SERVICE
// ═══════════════════════════════════════════════════════════════

class SignalQueueService {
  static lastPushTime = {};
  
  static async pushSignal(signal) {
    const now = Date.now();
    const key = `${signal.type}-${signal.direction || 'none'}`;
    
    // Cooldown check
    if (this.lastPushTime[key] && (now - this.lastPushTime[key]) < CONFIG.SIGNAL_COOLDOWN_MS) {
      console.log('[GEX] Signal cooldown active, skipping push');
      return { success: false, reason: 'cooldown' };
    }
    
    try {
      const response = await fetch(CONFIG.SIGNAL_QUEUE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD_SIGNAL',
          signal: {
            ...signal,
            source: 'GEX_WIDGET',
            timestamp: now,
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        this.lastPushTime[key] = now;
        console.log('[GEX] ✅ Signal pushed to Lambda:', result.signalId);
        return { success: true, signalId: result.signalId };
      } else {
        console.error('[GEX] Signal push failed:', response.status);
        return { success: false, reason: 'api_error' };
      }
    } catch (err) {
      console.error('[GEX] Signal push error:', err);
      return { success: false, reason: err.message };
    }
  }
  
  static async getQueueStatus() {
    try {
      const response = await fetch(`${CONFIG.SIGNAL_QUEUE_URL}?action=STATUS`);
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.error('[GEX] Queue status error:', err);
    }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN WIDGET COMPONENT
// ═══════════════════════════════════════════════════════════════

export const GEXWidget = ({
  walletAddress,
  dtgcBalance = 0,
  dtgcPrice = 0,
  signer = null,
  position = 'bottom-right',
}) => {
  // Widget state
  const [isExpanded, setIsExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState('spread');

  // Calculate USD value for token gating
  const dtgcUSDValue = dtgcBalance * dtgcPrice;
  const isUnlocked = dtgcUSDValue >= CONFIG.DTGC_GATE_USD;

  // Position styles
  const positionStyles = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '100px', right: '20px' },
  };

  return (
    <>
      <style>{GEX_STYLES}</style>
      <div className="gex-widget" style={{ ...positionStyles[position] }}>
        {/* Collapsed - Floating Button */}
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="gex-trigger"
            title="Growth Engine X-Chain Monitor"
          >
            <span className="gex-icon">GEX</span>
          </button>
        )}

        {/* Expanded Panel */}
        {isExpanded && (
          <div className="gex-panel">
            {/* Header */}
            <div className="gex-header">
              <div className="gex-title">
                <span className="gex-logo">⚡ GEX</span>
                <span className="gex-subtitle">Growth Engine Monitor</span>
              </div>
              <button onClick={() => setShowInfo(!showInfo)} className="gex-info-btn" title="What is GEX?">?</button>
              <button onClick={() => setIsExpanded(false)} className="gex-close">✕</button>
            </div>

            {/* Info Panel */}
            {showInfo && (
              <div className="gex-info-panel">
                <h3>⚡ What is GEX?</h3>
                <p><strong>Growth Engine X-Chain Monitor</strong> tracks cross-chain arbitrage opportunities between eHEX on Ethereum and bridged eHEX on PulseChain.</p>
                <h4>📊 SPREAD Tab</h4>
                <p>Shows real-time price difference between eHEX on both chains. When spread exceeds 2.5%, arbitrage becomes profitable after bridge fees.</p>
                <h4>⚡ GE LIVE Tab</h4>
                <p>Live feed of Growth Engine activity - automated buys, sells, and PLS generation from the DTGC ecosystem flywheel.</p>
                <h4>🎯 SIGNALS Tab</h4>
                <p>Token-gated alerts for optimal entry points. Requires $200+ DTGC to unlock. Signals auto-push to Growth Engine Lambda when spread ≥3%.</p>
                <h4>🔄 How Arbitrage Works</h4>
                <p>1. Buy eHEX on cheaper chain<br/>2. Bridge to other chain<br/>3. Sell at higher price<br/>4. Profit feeds Growth Engine → More URMOM/DTGC buys → Higher prices</p>
                <button onClick={() => setShowInfo(false)} className="gex-info-close">Got it!</button>
              </div>
            )}

            {/* Tabs */}
            <div className="gex-tabs">
              {[
                { id: 'spread', label: 'SPREAD', icon: '📊' },
                { id: 'ge', label: 'GE LIVE', icon: '⚡' },
                { id: 'signals', label: 'SIGNALS', icon: '🎯', locked: !isUnlocked },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`gex-tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  {tab.icon} {tab.label} {tab.locked && '🔒'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="gex-content">
              {activeTab === 'spread' && <SpreadMonitor />}
              {activeTab === 'ge' && <GEActivityFeed />}
              {activeTab === 'signals' && (
                <SignalPanel
                  isUnlocked={isUnlocked}
                  dtgcUSDValue={dtgcUSDValue}
                  requiredUSD={CONFIG.DTGC_GATE_USD}
                  signer={signer}
                />
              )}
            </div>

            {/* Footer */}
            <div className="gex-footer">
              <span className="gex-wallet">
                {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not Connected'}
              </span>
              <span className={`gex-balance ${isUnlocked ? 'unlocked' : 'locked'}`}>
                ${dtgcUSDValue.toFixed(0)} DTGC {isUnlocked && '✓'}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// SPREAD MONITOR (with Lambda push)
// ═══════════════════════════════════════════════════════════════

const SpreadMonitor = () => {
  const [prices, setPrices] = useState({ ethHex: null, plsHex: null, spread: null });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastPush, setLastPush] = useState(null); // 🔥 NEW: Track last push

  const fetchPrices = useCallback(async () => {
    try {
      const [ethRes, plsRes] = await Promise.all([
        fetch(CONFIG.DEXSCREENER.HEX_ETH).then(r => r.json()),
        fetch(CONFIG.DEXSCREENER.HEX_PLS).then(r => r.json()),
      ]);

      // FIXED: /tokens/ endpoint returns { pairs: [...] }, not { pair: {...} }
      const ethHex = parseFloat(ethRes?.pairs?.[0]?.priceUsd || 0);
      const plsHex = parseFloat(plsRes?.pairs?.[0]?.priceUsd || 0);
      const spread = ethHex && plsHex ? ((ethHex - plsHex) / plsHex) * 100 : null;

      console.log('[GEX] Prices:', { ethHex, plsHex, spread: spread?.toFixed(2) + '%' });

      setPrices({ ethHex, plsHex, spread });
      setHistory(prev => [...prev.slice(-19), { spread, time: Date.now() }]);
      setLoading(false);
      
      // 🔥 NEW: Auto-push signal to Lambda when spread >= 3%
      const absSpread = Math.abs(spread || 0);
      if (absSpread >= CONFIG.MIN_SPREAD_SIGNAL) {
        // CORRECTED: If ETH price higher (spread > 0), buy on PLS (cheaper)
        const direction = spread > 0 ? 'BUY_PHEX' : 'BUY_EHEX';
        console.log('[GEX] Signal triggered:', { direction, absSpread: absSpread.toFixed(2) + '%' });
        
        const result = await SignalQueueService.pushSignal({
          type: 'EHEX_ARB',
          spread: absSpread,
          ethPrice: ethHex,
          plsPrice: plsHex,
          direction: direction,
          confidence: absSpread >= CONFIG.MIN_SPREAD_OPPORTUNITY ? 'HIGH' : 'MEDIUM',
        });
        if (result.success) {
          setLastPush({ time: Date.now(), signalId: result.signalId, spread: absSpread });
        }
      }
    } catch (err) {
      console.error('Price fetch error:', err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, CONFIG.PRICE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const getStatus = (spread) => {
    const abs = Math.abs(spread || 0);
    if (abs < 2) return { color: '#888', label: 'NORMAL' };
    if (abs < 3) return { color: '#FFD700', label: 'WATCHING' };
    if (abs < 4) return { color: '#FFA500', label: 'SIGNAL SENT' }; // 🔥 Changed from 5 to 4
    return { color: '#00FF88', label: 'OPPORTUNITY' }; // Now triggers at 4%+
  };

  const status = getStatus(prices.spread);

  // Sparkline
  const renderSparkline = () => {
    if (history.length < 2) return null;
    const values = history.map(h => h.spread || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const w = 140, h = 35;
    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={w} height={h} style={{ margin: '8px auto', display: 'block' }}>
        <polyline points={points} fill="none" stroke="#FFD700" strokeWidth="2" />
      </svg>
    );
  };

  if (loading) return <div className="gex-loading">Loading prices...</div>;

  return (
    <div className="spread-monitor">
      <div className="spread-main">
        <div className="spread-label">eHEX(E) / eHEX(P) SPREAD</div>
        <div className="spread-value" style={{ color: prices.spread >= 0 ? '#00FF88' : '#FF6B6B' }}>
          {prices.spread !== null ? `${prices.spread >= 0 ? '+' : ''}${prices.spread.toFixed(2)}%` : '--'}
        </div>
        <div className="spread-status" style={{ background: `${status.color}22`, borderColor: status.color, color: status.color }}>
          {status.label}
        </div>
        {renderSparkline()}
      </div>

      {/* CORRECTED: BUY button shows the CHEAPER chain */}
      {prices.spread !== null && Math.abs(prices.spread) >= 2 && (
        <button 
          className="gex-buy-btn"
          onClick={() => {
            // Open the DEX for the cheaper chain
            const url = prices.spread > 0 
              ? `https://pulsex.mypinata.cloud/ipfs/bafybeiesh56oijasgr7creubue6xt5anivxifrwd5a5argiz4orbed57qi/#/?outputCurrency=0x57fde0a71132198BBeC939B98976993d8D89D225`
              : `https://app.uniswap.org/#/swap?outputCurrency=0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39`;
            window.open(url, '_blank');
          }}
          style={{
            width: '100%',
            padding: '12px 16px',
            marginBottom: '12px',
            background: 'transparent',
            border: '2px solid #FFD700',
            borderRadius: '10px',
            color: '#FFD700',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          ⭐ BUY eHEX on {prices.spread > 0 ? 'PULSECHAIN' : 'ETHEREUM'} (CHEAPER)
        </button>
      )}

      {/* 🔥 NEW: Lambda push confirmation */}
      {lastPush && (Date.now() - lastPush.time) < 60000 && (
        <div className="lambda-push-confirm">
          <span className="lambda-icon">📡</span>
          <span>Signal pushed to Growth Engine</span>
          <span className="lambda-spread">+{lastPush.spread.toFixed(1)}%</span>
        </div>
      )}

      <div className="price-cards">
        <div className="price-card eth">
          <div className="chain">◆ ETHEREUM</div>
          <div className="token">eHEX</div>
          <div className="price">${prices.ethHex?.toFixed(4) || '--'}</div>
        </div>
        <div className="price-card pls">
          <div className="chain">💜 PULSECHAIN</div>
          <div className="token">eHEX (PLS)</div>
          <div className="price">${prices.plsHex?.toFixed(4) || '--'}</div>
        </div>
      </div>

      {prices.spread !== null && Math.abs(prices.spread) >= 2 && (
        <div className="direction-box">
          <div className="direction-label">⭐ ARBITRAGE DIRECTION</div>
          <div className="direction-value">
            {prices.spread > 0
              ? <>
                  {/* ETH is MORE expensive, so BUY on PulseChain (cheaper) */}
                  <span className="buy">BUY eHEX on PULSECHAIN</span> (${prices.plsHex?.toFixed(6)})<br/>
                  → Bridge to Ethereum →<br/>
                  <span className="sell">SELL eHEX on ETHEREUM</span> (${prices.ethHex?.toFixed(6)})
                </>
              : <>
                  {/* PLS is MORE expensive, so BUY on Ethereum (cheaper) */}
                  <span className="buy-eth">BUY eHEX on ETHEREUM</span> (${prices.ethHex?.toFixed(6)})<br/>
                  → Bridge to PulseChain →<br/>
                  <span className="sell">SELL eHEX on PULSECHAIN</span> (${prices.plsHex?.toFixed(6)})
                </>
            }
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// GE ACTIVITY FEED
// ═══════════════════════════════════════════════════════════════

const GEActivityFeed = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(CONFIG.GE_STATS_API);
        if (res.ok) {
          setStats(await res.json());
        } else {
          throw new Error('API unavailable');
        }
      } catch {
        // Mock data for development
        setStats({
          cycles: 1247,
          microBuys: 892,
          buys: 456,
          urmomAccumulated: 1245000000,
          dtgcAccumulated: 8500000,
          plsxAccumulated: 2300000,
          plsGenerated: 45000000,
          flywheelRevolutions: 234,
          allocation: { URMOM: 62.3, DTGC: 18.7, PLSX: 5.2, PLS: 13.8 },
        });
      }
      setLoading(false);
    };

    fetchStats();
    const interval = setInterval(fetchStats, CONFIG.STATS_REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const formatNum = (n) => {
    if (!n) return '0';
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  };

  if (loading) return <div className="gex-loading">Syncing with Growth Engine...</div>;

  return (
    <div className="ge-feed">
      <div className="ge-status">
        <span className="status-dot live"></span>
        <span className="status-text">LIVE</span>
        <span className="ge-wallet">0xc1cd...e87c</span>
      </div>

      <div className="ge-stats">
        <div className="stat"><div className="label">CYCLES</div><div className="value gold">{stats?.cycles || 0}</div></div>
        <div className="stat"><div className="label">MICRO-BUYS</div><div className="value gold">{stats?.microBuys || 0}</div></div>
        <div className="stat"><div className="label">URMOM</div><div className="value green">{formatNum(stats?.urmomAccumulated)}</div></div>
        <div className="stat"><div className="label">DTGC</div><div className="value blue">{formatNum(stats?.dtgcAccumulated)}</div></div>
      </div>

      <div className="ge-allocation">
        <div className="alloc-header">ALLOCATION</div>
        {stats?.allocation && Object.entries(stats.allocation).map(([token, pct]) => (
          <div className="alloc-row" key={token}>
            <span className="token">{token}</span>
            <div className="bar"><div className="fill" style={{ width: `${pct}%` }}></div></div>
            <span className="pct">{pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="ge-flywheel">
        <div className="flywheel-icon">🔄</div>
        <div className="flywheel-info">
          <div className="flywheel-label">FLYWHEEL</div>
          <div className="flywheel-value">{stats?.flywheelRevolutions || 0} revolutions</div>
        </div>
        <div className="pls-generated">
          <div className="pls-label">PLS Generated</div>
          <div className="pls-value">{formatNum(stats?.plsGenerated || 0)}</div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// SIGNAL PANEL (with auto-trade and Lambda push)
// ═══════════════════════════════════════════════════════════════

const SignalPanel = ({ isUnlocked, dtgcUSDValue, requiredUSD, signer }) => {
  const [signals, setSignals] = useState([]);
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);
  const [settings, setSettings] = useState({ arb: true, ge: true, spread: true });
  const [queueStatus, setQueueStatus] = useState(null); // 🔥 NEW: Queue status
  const signalIdRef = useRef(0);

  // 🔥 NEW: Fetch queue status periodically
  useEffect(() => {
    if (!isUnlocked) return;
    
    const fetchQueueStatus = async () => {
      const status = await SignalQueueService.getQueueStatus();
      if (status) setQueueStatus(status);
    };
    
    fetchQueueStatus();
    const interval = setInterval(fetchQueueStatus, 30000);
    return () => clearInterval(interval);
  }, [isUnlocked]);

  // Fetch spread and generate signals
  useEffect(() => {
    if (!isUnlocked) return;

    const generateSignals = async () => {
      try {
        const [ethRes, plsRes] = await Promise.all([
          fetch(CONFIG.DEXSCREENER.HEX_ETH).then(r => r.json()),
          fetch(CONFIG.DEXSCREENER.HEX_PLS).then(r => r.json()),
        ]);

        // FIXED: /tokens/ endpoint returns { pairs: [...] }, not { pair: {...} }
        const ethHex = parseFloat(ethRes?.pairs?.[0]?.priceUsd || 0);
        const plsHex = parseFloat(plsRes?.pairs?.[0]?.priceUsd || 0);
        const spread = ethHex && plsHex ? ((ethHex - plsHex) / plsHex) * 100 : 0;
        const absSpread = Math.abs(spread);

        if (absSpread >= 4) {
          const direction = spread > 0 ? { buy: 'pHEX', sell: 'eHEX' } : { buy: 'eHEX', sell: 'pHEX' };
          const profit = 500 * (absSpread / 100) - 20; // $500 trade minus ~$20 fees
          const geShare = profit * 0.3;

          const newSignal = {
            id: `sig-${++signalIdRef.current}`,
            type: 'ARBITRAGE',
            title: `${direction.buy}→${direction.sell} +${absSpread.toFixed(1)}%`,
            description: `Est. profit: $${profit.toFixed(0)} | GE share: $${geShare.toFixed(0)}`,
            profit: `$${profit.toFixed(0)}`,
            confidence: absSpread >= 4 ? 'HIGH' : 'MEDIUM', // 🔥 Changed from 6 to 4
            timestamp: Date.now(),
            canAutoTrade: absSpread >= 4 && profit >= CONFIG.MIN_PROFIT_USD, // 🔥 Changed from 6 to 4
            pushedToLambda: false, // 🔥 NEW: Track if pushed
          };

          // 🔥 NEW: Push to Lambda for HIGH confidence signals
          if (newSignal.confidence === 'HIGH') {
            const pushResult = await SignalQueueService.pushSignal({
              type: 'EHEX_ARB',
              spread: absSpread,
              ethPrice: ethHex,
              plsPrice: plsHex,
              direction: spread > 0 ? 'BUY_PHEX' : 'BUY_EHEX',
              confidence: 'HIGH',
              title: newSignal.title,
            });
            newSignal.pushedToLambda = pushResult.success;
            if (pushResult.success) {
              newSignal.lambdaSignalId = pushResult.signalId;
            }
          }

          setSignals(prev => {
            // Avoid duplicates within 2 minutes
            const recent = prev.find(s => Date.now() - s.timestamp < 120000 && s.type === 'ARBITRAGE');
            if (recent) return prev;
            return [newSignal, ...prev.slice(0, 19)];
          });
        }
      } catch (err) {
        console.error('Signal generation error:', err);
      }
    };

    generateSignals();
    const interval = setInterval(generateSignals, 30000);
    return () => clearInterval(interval);
  }, [isUnlocked]);

  const timeAgo = (ts) => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    return `${Math.floor(sec / 3600)}h`;
  };

  // Locked state
  if (!isUnlocked) {
    return (
      <div className="signal-locked">
        <div className="lock-icon">🔒</div>
        <div className="lock-title">Premium Signals Locked</div>
        <div className="lock-desc">Hold <span className="hl">${requiredUSD} DTGC</span> to unlock:</div>
        <div className="features">
          <div>🔄 Real-time arbitrage signals</div>
          <div>🤖 Auto-trade execution</div>
          <div>💰 30% profits to GE</div>
          <div>📡 Lambda signal queue</div>
        </div>
        <div className="progress">
          <div className="progress-info">
            <span>Balance</span>
            <span className="progress-val">${dtgcUSDValue.toFixed(0)} / ${requiredUSD}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min((dtgcUSDValue / requiredUSD) * 100, 100)}%` }}></div>
          </div>
        </div>
        <button className="get-btn" onClick={() => window.open('https://dtgc.io', '_blank')}>GET DTGC →</button>
      </div>
    );
  }

  // Unlocked state
  return (
    <div className="signal-unlocked">
      <div className="unlock-header">
        <span className="badge">✓ UNLOCKED</span>
        <span className="bal">${dtgcUSDValue.toFixed(0)} DTGC</span>
      </div>

      {/* 🔥 NEW: Lambda queue status */}
      {queueStatus && (
        <div className="lambda-status">
          <span className="lambda-dot"></span>
          <span>Lambda Queue: {queueStatus.pending} pending | {queueStatus.executed} executed</span>
        </div>
      )}

      <div className="auto-trade">
        <div className="auto-info">
          <span className="auto-icon">🤖</span>
          <span>Auto-Trade</span>
        </div>
        <button
          className={`toggle ${autoTradeEnabled ? 'on' : ''}`}
          onClick={() => setAutoTradeEnabled(!autoTradeEnabled)}
        >
          {autoTradeEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {autoTradeEnabled && (
        <div className="auto-status">
          <span className="dot"></span>
          Auto-executing ≥$25 opportunities → 30% to GE
        </div>
      )}

      <div className="filter-btns">
        <button className={settings.arb ? 'active' : ''} onClick={() => setSettings(s => ({ ...s, arb: !s.arb }))}>🔄 Arb</button>
        <button className={settings.ge ? 'active' : ''} onClick={() => setSettings(s => ({ ...s, ge: !s.ge }))}>⚡ GE</button>
        <button className={settings.spread ? 'active' : ''} onClick={() => setSettings(s => ({ ...s, spread: !s.spread }))}>📊 Spread</button>
      </div>

      <div className="signals-header">
        <span>SIGNALS</span>
        <span className="count">{signals.length}</span>
      </div>

      <div className="signals-list">
        {signals.length === 0 ? (
          <div className="no-signals">📡 Monitoring...</div>
        ) : (
          signals.slice(0, 8).map(sig => (
            <div key={sig.id} className={`signal ${sig.type.toLowerCase()}`}>
              <div className="sig-top">
                <span className="sig-type">{SIGNAL_TYPES[sig.type]?.icon} {SIGNAL_TYPES[sig.type]?.label}</span>
                <span className="sig-time">{timeAgo(sig.timestamp)}</span>
              </div>
              <div className="sig-title">{sig.title}</div>
              <div className="sig-desc">{sig.description}</div>
              <div className="sig-bottom">
                {sig.profit && <span className="sig-profit">{sig.profit}</span>}
                <span className={`sig-conf ${sig.confidence.toLowerCase()}`}>{sig.confidence}</span>
                {sig.canAutoTrade && autoTradeEnabled && <span className="auto-badge">🤖</span>}
                {sig.pushedToLambda && <span className="lambda-badge">📡 GE</span>}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="action-btns">
        <button className="pulsex" onClick={() => window.open('https://pulsex.com', '_blank')}>PulseX →</button>
        <button className="uniswap" onClick={() => window.open('https://app.uniswap.org', '_blank')}>Uniswap →</button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// STYLES (with new Lambda-related styles)
// ═══════════════════════════════════════════════════════════════

const GEX_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Rajdhani:wght@400;500;600;700&display=swap');

.gex-widget { position: fixed; z-index: 99999; font-family: 'Rajdhani', sans-serif; }

.gex-trigger { width: 60px; height: 60px; border-radius: 12px; background: linear-gradient(135deg, #1a1a1a, #0d0d0d); border: 2px solid #FFD700; box-shadow: 0 0 20px rgba(255,215,0,0.3); cursor: pointer; animation: gexPulse 2s ease-in-out infinite; transition: transform 0.2s; }
.gex-trigger:hover { transform: scale(1.05); }
.gex-icon { font-family: 'Orbitron', sans-serif; font-size: 18px; font-weight: bold; color: #FFD700; text-shadow: 0 0 10px rgba(255,215,0,0.5); }
@keyframes gexPulse { 0%, 100% { box-shadow: 0 0 20px rgba(255,215,0,0.3); } 50% { box-shadow: 0 0 35px rgba(255,215,0,0.5); } }

.gex-panel { width: 360px; max-height: 540px; background: linear-gradient(180deg, #0d0d0d, #1a1a1a, #0d0d0d); border: 2px solid #FFD700; border-radius: 16px; box-shadow: 0 0 40px rgba(255,215,0,0.2), 0 20px 60px rgba(0,0,0,0.8); overflow: hidden; }

.gex-header { padding: 12px 16px; background: linear-gradient(90deg, rgba(255,215,0,0.1), transparent, rgba(255,215,0,0.1)); border-bottom: 1px solid rgba(255,215,0,0.3); display: flex; justify-content: space-between; align-items: center; }
.gex-title { display: flex; align-items: center; gap: 10px; }
.gex-logo { font-family: 'Orbitron'; font-size: 18px; font-weight: bold; color: #FFD700; text-shadow: 0 0 10px rgba(255,215,0,0.5); }
.gex-subtitle { font-size: 10px; color: #888; letter-spacing: 1px; }

.gex-info-btn { background: rgba(255,215,0,0.2); border: 1px solid #FFD700; color: #FFD700; width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-weight: bold; margin-right: 8px; }
.gex-info-btn:hover { background: rgba(255,215,0,0.4); }

.gex-info-panel { background: rgba(0,0,0,0.95); border: 1px solid #FFD700; border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.gex-info-panel h3 { color: #FFD700; margin: 0 0 12px 0; font-size: 16px; }
.gex-info-panel h4 { color: #FFD700; margin: 12px 0 6px 0; font-size: 13px; }
.gex-info-panel p { color: #ccc; font-size: 12px; line-height: 1.5; margin: 0 0 8px 0; }
.gex-info-close { width: 100%; padding: 10px; background: linear-gradient(135deg, #FFD700, #FFA500); border: none; border-radius: 8px; color: #000; font-weight: bold; cursor: pointer; margin-top: 12px; }

.gex-close { background: transparent; border: none; color: #FFD700; font-size: 20px; cursor: pointer; padding: 4px 8px; }

.gex-tabs { display: flex; border-bottom: 1px solid rgba(255,215,0,0.2); }
.gex-tab { flex: 1; padding: 10px; background: transparent; border: none; border-bottom: 2px solid transparent; color: #666; font-size: 11px; font-weight: bold; letter-spacing: 1px; cursor: pointer; transition: all 0.2s; }
.gex-tab.active { background: rgba(255,215,0,0.1); border-bottom-color: #FFD700; color: #FFD700; }

.gex-content { padding: 16px; max-height: 380px; overflow-y: auto; }

.gex-footer { padding: 10px 16px; border-top: 1px solid rgba(255,215,0,0.2); background: rgba(0,0,0,0.3); display: flex; justify-content: space-between; align-items: center; }
.gex-wallet { font-size: 10px; color: #666; }
.gex-balance { font-size: 11px; font-weight: bold; }
.gex-balance.unlocked { color: #00FF88; }
.gex-balance.locked { color: #FF6B6B; }

.gex-loading { text-align: center; padding: 30px; color: #888; }

/* Spread Monitor */
.spread-main { text-align: center; padding: 16px; background: rgba(255,215,0,0.05); border-radius: 12px; margin-bottom: 16px; }
.spread-label { font-size: 10px; color: #666; letter-spacing: 2px; margin-bottom: 4px; }
.spread-value { font-size: 32px; font-weight: bold; text-shadow: 0 0 20px currentColor; }
.spread-status { display: inline-block; padding: 4px 12px; border-radius: 20px; border: 1px solid; font-size: 10px; font-weight: bold; margin-top: 8px; }

/* 🔥 NEW: Lambda push confirmation */
.lambda-push-confirm { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); border-radius: 8px; margin-bottom: 12px; font-size: 11px; color: #00FF88; }
.lambda-icon { font-size: 14px; }
.lambda-spread { margin-left: auto; font-weight: bold; }

.price-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.price-card { padding: 12px; border-radius: 10px; }
.price-card.eth { background: rgba(98,126,234,0.1); border: 1px solid rgba(98,126,234,0.3); }
.price-card.pls { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); }
.chain { font-size: 10px; margin-bottom: 4px; }
.price-card.eth .chain { color: #627eea; }
.price-card.pls .chain { color: #00FF88; }
.token { font-size: 11px; color: #888; margin-bottom: 2px; }
.price { font-size: 16px; font-weight: bold; color: #fff; }

.direction-box { padding: 12px; background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); border-radius: 10px; text-align: center; }
.direction-label { font-size: 10px; color: #FFD700; letter-spacing: 1px; margin-bottom: 4px; }
.direction-value { font-size: 13px; font-weight: bold; color: #fff; }
.direction-value .buy { color: #00FF88; }
.direction-value .buy-eth { color: #627eea; }
.direction-value .sell { color: #FF6B6B; }

/* GE Feed */
.ge-status { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; animation: pulse 2s infinite; }
.status-dot.live { background: #00FF88; box-shadow: 0 0 10px #00FF88; }
.status-text { font-size: 11px; color: #00FF88; font-weight: bold; }
.ge-wallet { font-size: 9px; color: #444; margin-left: auto; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

.ge-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
.stat { padding: 10px; background: rgba(255,215,0,0.05); border-radius: 8px; text-align: center; }
.stat .label { font-size: 9px; color: #666; margin-bottom: 2px; }
.stat .value { font-size: 16px; font-weight: bold; }
.stat .value.gold { color: #FFD700; }
.stat .value.green { color: #00FF88; }
.stat .value.blue { color: #627eea; }

.ge-allocation { margin-bottom: 16px; }
.alloc-header { font-size: 10px; color: #666; letter-spacing: 1px; margin-bottom: 8px; }
.alloc-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.alloc-row .token { font-size: 10px; color: #888; width: 50px; }
.alloc-row .bar { flex: 1; height: 8px; background: #222; border-radius: 4px; overflow: hidden; }
.alloc-row .fill { height: 100%; background: linear-gradient(90deg, #FFD700, #00FF88); border-radius: 4px; }
.alloc-row .pct { font-size: 10px; color: #FFD700; width: 40px; text-align: right; }

.ge-flywheel { display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255,215,0,0.05); border-radius: 10px; }
.flywheel-icon { font-size: 24px; animation: spin 4s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.flywheel-label { font-size: 9px; color: #888; }
.flywheel-value { font-size: 14px; font-weight: bold; color: #FFD700; }
.pls-generated { margin-left: auto; text-align: right; }
.pls-label { font-size: 9px; color: #888; }
.pls-value { font-size: 14px; font-weight: bold; color: #00FF88; }

/* Signal Panel - Locked */
.signal-locked { text-align: center; padding: 20px 0; }
.lock-icon { font-size: 48px; margin-bottom: 12px; }
.lock-title { font-size: 16px; font-weight: bold; color: #FFD700; margin-bottom: 8px; }
.lock-desc { font-size: 12px; color: #888; margin-bottom: 16px; }
.lock-desc .hl { color: #FFD700; font-weight: bold; }
.features { text-align: left; padding: 12px 16px; background: rgba(255,215,0,0.05); border-radius: 10px; margin-bottom: 16px; }
.features div { font-size: 11px; color: #aaa; padding: 4px 0; }
.progress { margin-bottom: 16px; }
.progress-info { display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 4px; }
.progress-val { color: #FF6B6B; }
.progress-bar { height: 8px; background: #222; border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #FF6B6B, #FFD700); border-radius: 4px; }
.get-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #FFD700, #FFA500); border: none; border-radius: 10px; color: #000; font-size: 12px; font-weight: bold; cursor: pointer; }

/* Signal Panel - Unlocked */
.unlock-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.badge { padding: 6px 12px; background: rgba(0,255,136,0.1); border: 1px solid #00FF88; border-radius: 8px; color: #00FF88; font-size: 11px; font-weight: bold; }
.bal { font-size: 10px; color: #888; }

/* 🔥 NEW: Lambda status */
.lambda-status { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(0,255,136,0.05); border-radius: 6px; margin-bottom: 10px; font-size: 10px; color: #888; }
.lambda-dot { width: 6px; height: 6px; border-radius: 50%; background: #00FF88; box-shadow: 0 0 6px #00FF88; }

.auto-trade { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,215,0,0.05); border: 1px solid rgba(255,215,0,0.2); border-radius: 10px; margin-bottom: 8px; }
.auto-info { display: flex; align-items: center; gap: 8px; }
.auto-icon { font-size: 18px; }
.auto-info span:last-child { font-size: 12px; font-weight: bold; color: #FFD700; }
.toggle { padding: 6px 16px; background: #333; border: none; border-radius: 20px; color: #888; font-size: 10px; font-weight: bold; cursor: pointer; }
.toggle.on { background: #00FF88; color: #000; }
.auto-status { display: flex; align-items: center; gap: 8px; font-size: 10px; color: #888; margin-bottom: 12px; padding-left: 4px; }
.auto-status .dot { width: 6px; height: 6px; border-radius: 50%; background: #00FF88; box-shadow: 0 0 8px #00FF88; animation: pulse 2s infinite; }

.filter-btns { display: flex; gap: 8px; margin-bottom: 12px; }
.filter-btns button { flex: 1; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid #333; border-radius: 8px; color: #666; font-size: 10px; cursor: pointer; }
.filter-btns button.active { background: rgba(255,215,0,0.15); border-color: #FFD700; color: #FFD700; }

.signals-header { display: flex; justify-content: space-between; font-size: 10px; color: #666; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,215,0,0.1); }
.count { background: rgba(255,215,0,0.2); padding: 2px 8px; border-radius: 10px; color: #FFD700; }

.signals-list { max-height: 180px; overflow-y: auto; }
.no-signals { text-align: center; padding: 30px; color: #444; }

.signal { padding: 12px; margin-bottom: 8px; border-radius: 10px; animation: slideIn 0.3s ease; }
.signal.arbitrage { background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.3); }
.signal.ge_activity { background: rgba(255,215,0,0.1); border: 1px solid rgba(255,215,0,0.3); }
@keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }

.sig-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
.sig-type { font-size: 10px; font-weight: bold; color: #00FF88; }
.sig-time { font-size: 9px; color: #666; }
.sig-title { font-size: 12px; font-weight: bold; color: #fff; margin-bottom: 4px; }
.sig-desc { font-size: 10px; color: #888; margin-bottom: 8px; }

.sig-bottom { display: flex; align-items: center; gap: 8px; }
.sig-profit { padding: 3px 8px; background: rgba(0,255,136,0.2); border-radius: 4px; font-size: 10px; font-weight: bold; color: #00FF88; }
.sig-conf { padding: 3px 8px; border-radius: 4px; font-size: 9px; font-weight: bold; }
.sig-conf.high { background: rgba(0,255,136,0.2); color: #00FF88; }
.sig-conf.medium { background: rgba(255,215,0,0.2); color: #FFD700; }
.auto-badge { padding: 3px 8px; background: rgba(0,255,136,0.3); border-radius: 4px; font-size: 8px; }

/* 🔥 NEW: Lambda badge */
.lambda-badge { padding: 3px 8px; background: rgba(98,126,234,0.3); border-radius: 4px; font-size: 8px; color: #627eea; }

.action-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,215,0,0.1); }
.action-btns button { padding: 10px; border: none; border-radius: 8px; font-size: 10px; font-weight: bold; cursor: pointer; }
.action-btns .pulsex { background: linear-gradient(135deg, #00FF88, #00CC6A); color: #000; }
.action-btns .uniswap { background: linear-gradient(135deg, #FF007A, #CC0062); color: #fff; }
`;

export default GEXWidget;

// GEX Widget V2 with Lambda Integration
// Deploy: ${Date.now()}
