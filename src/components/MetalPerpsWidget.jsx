// Institutional Auto Trade v5.0-Q7 - Q7 D-RAM v5.2.6 CALIBRATED
// Lambda: gTrade Direct Prices, Q7 Haneef System, 5-Factor Confluence
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, ColorType, CrosshairMode, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';

// ==================== CONFIGURATION ====================

const LAMBDA_URL = 'https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/';

// Q7 Dev Wallet Address (Lambda trading wallet) - DTGC holders can view live trades
const Q7_DEV_WALLET = '0x978c5786CDB46b1519A9c1C4814e06d5956f6c64';
const DTGC_MIN_REQUIRED = 0; // Paywall disabled - free access for now

// ==================== Q7 D-RAM v5.2.6 CALIBRATION ====================
// Per-asset RSI bounds from Q7 empirical testing (15M timeframe)
const Q7_RSI_BOUNDS = {
  BTC: { oversold: 34, overbought: 66 },
  ETH: { oversold: 32, overbought: 68 },
  GOLD: { oversold: 30, overbought: 70 },
  SILVER: { oversold: 30, overbought: 70 },
};

// Q7 Engine weights (SWP > BRK > MR > TRND priority)
const Q7_ENGINE_WEIGHTS = {
  SWP: 30,   // Sweep - highest priority
  BRK: 25,   // Breakout
  MR: 25,    // Mean Reversion
  TRND: 15,  // Trend - throttled
  MTUM: 5,   // Momentum - confirmation only
};

// Q7 Confluence factors
const Q7_CONFLUENCE_WEIGHTS = {
  trend: 30,    // EMA alignment
  adx: 20,      // ADX strength
  rsi: 20,      // RSI position
  volume: 15,   // Volume confirmation
  mtf: 15,      // Multi-timeframe
};

// Q7 Calibrated TP/SL ratios (1.5:1 R:R minimum)
const Q7_TP_SL = {
  crypto: { tp: 2.25, sl: 1.5 },     // BTC/ETH: 2.25% TP, 1.5% SL
  commodity: { tp: 3.75, sl: 2.5 },  // GOLD/SILVER: wider for volatility
};

// ==================== SCALP MODE PRESETS ====================
// Q7 D-RAM v5.2.6 calibrated presets with 1.5:1 R:R minimum
const SCALP_PRESETS = {
  // Q7 Conservative - empirically calibrated
  conservative: {
    name: '🟢 Q7 Safe',
    tp: 1.5,       // 1.5% take profit (Q7 calibrated)
    sl: 1.0,       // 1.0% stop loss (1.5:1 R:R)
    leverage: 50,  // Lower leverage for safety
    description: 'Q7 safe mode, 1.5:1 R:R',
  },
  // Q7 Standard - balanced with Q7 calibration
  standard: {
    name: '🟡 Q7 Standard',
    tp: 2.25,      // 2.25% take profit (Q7 calibrated)
    sl: 1.5,       // 1.5% stop loss (1.5:1 R:R)
    leverage: 75,  // Medium leverage
    description: 'Q7 balanced, 1.5:1 R:R',
  },
  // Q7 Aggressive - calibrated for volatility
  aggressive: {
    name: '🔴 Q7 Aggro',
    tp: 3.0,       // 3.0% take profit (Q7 calibrated)
    sl: 2.0,       // 2.0% stop loss (1.5:1 R:R)
    leverage: 100, // High leverage
    description: 'Q7 aggressive, 1.5:1 R:R',
  },
  // Q7 Sniper - momentum plays with Q7 confluence
  sniper: {
    name: '🎯 Q7 Sniper',
    tp: 0.75,      // 0.75% take profit (quick grab)
    sl: 0.5,       // 0.5% stop loss (1.5:1 R:R)
    leverage: 125, // Max leverage
    description: 'Q7 momentum, quick in/out',
  },
};

// Auto-trade settings
const AUTO_TRADE_CONFIG = {
  maxRetries: 3,           // Retry failed trades up to 3 times
  retryDelayMs: 1000,      // Wait 1 second between retries
  cooldownMs: 5000,        // 5 second cooldown between auto-trades
  maxConcurrentTrades: 3,  // Max open positions at once
};

// gTrade Pricing API - Direct source for real-time prices
const GTRADE_PRICES_API = 'https://backend-pricing.eu.gains.trade/charts/prices?from=gTrade&pairs=0,1,90,91';

// ==================== MANDO P&L CARD ASSETS ====================
// Randomized images for shareable P&L cards
const MANDO_IMAGES = [
  '/images/mando/mando-sniper.png',
  '/images/mando/mando-gold-lava.jpg',
  '/images/mando/mando-silver-lava.jpg',
  '/images/mando/mando-hallway-gold.jpg',
  '/images/mando/mando-hallway-bright.jpg',
  '/images/mando/mando-action-1.jpg',
  '/images/mando/mando-action-3.jpg',
  '/images/mando/mando-desert-1.jpg',
  '/images/mando/mando-desert-2.jpg',
  '/images/mando/mando-desert-3.jpg',
  '/images/mando/mando-desert-4.jpg',
  '/images/mando/mando-watercolor.jpg',
  '/images/mando/mando-watercolor-lava.jpg',
  '/images/mando/Snow-mando.png',
];

// Gold bar thresholds for profit rewards (USDC)
const GOLD_BAR_THRESHOLDS = [
  { min: 50, bars: 1 },    // $50+ = 1 gold bar
  { min: 100, bars: 2 },   // $100+ = 2 gold bars
  { min: 250, bars: 3 },   // $250+ = 3 gold bars
  { min: 500, bars: 4 },   // $500+ = 4 gold bars
  { min: 1000, bars: 5 },  // $1000+ = 5 gold bars (WHALE!)
];

// gTrade pair indices mapping
const GTRADE_PAIR_INDEX = {
  BTC: '0',
  ETH: '1',
  GOLD: '90',
  SILVER: '91',
};

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

// SYNCED WITH gTrade v10 actual limits + Lambda v4.0-Q7 Q7 D-RAM calibration
const ASSETS = {
  BTC: { name: 'Bitcoin', symbol: 'BTC', maxLev: 150, minLev: 2, type: 'crypto', priceSource: 'gTrade', rsi: Q7_RSI_BOUNDS.BTC },
  ETH: { name: 'Ethereum', symbol: 'ETH', maxLev: 150, minLev: 2, type: 'crypto', priceSource: 'gTrade', rsi: Q7_RSI_BOUNDS.ETH },
  GOLD: { name: 'Gold', symbol: 'XAU', maxLev: 25, minLev: 2, type: 'commodity', priceSource: 'gTrade', rsi: Q7_RSI_BOUNDS.GOLD },
  SILVER: { name: 'Silver', symbol: 'XAG', maxLev: 25, minLev: 2, type: 'commodity', priceSource: 'gTrade', rsi: Q7_RSI_BOUNDS.SILVER },
};

// Leverage quick-select buttons per asset type
const LEVERAGE_PRESETS = {
  crypto: [10, 30, 50, 100, 150],    // BTC, ETH - tightened to 30x minimum signal
  commodity: [5, 10, 15, 20, 25],     // GOLD, SILVER - max 25x on gTrade
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

export default function MetalPerpsWidget({ livePrices: externalPrices = {}, connectedAddress = null, dtgcBalance = 0 }) {
  // Alias for backwards compatibility - userAddress is used throughout the component
  const userAddress = connectedAddress;

  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('trade');
  const [selectedAsset, setSelectedAsset] = useState('BTC');
  const [direction, setDirection] = useState('LONG');
  const [collateral, setCollateral] = useState('25');
  const [leverage, setLeverage] = useState(10);
  const [positions, setPositions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [takeProfit, setTakeProfit] = useState('2.25');  // Q7 calibrated default
  const [stopLoss, setStopLoss] = useState('1.5');       // Q7 calibrated default (1.5:1 R:R)
  const [botStatus, setBotStatus] = useState(null);
  const [botActivity, setBotActivity] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [gtradeVerifyPrices, setGtradeVerifyPrices] = useState({});
  const [priceSource, setPriceSource] = useState('loading');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [priceUpdateTime, setPriceUpdateTime] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // ===== SCALP MODE STATE =====
  const [scalpMode, setScalpMode] = useState('aggressive'); // conservative, standard, aggressive, sniper
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);
  const [lastTradeTime, setLastTradeTime] = useState(0);
  const [tradeStats, setTradeStats] = useState({ wins: 0, losses: 0, totalPnl: 0, attempts: 0, successes: 0 });
  const [priceHistory, setPriceHistory] = useState({}); // For momentum detection
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [momentum, setMomentum] = useState({ direction: 'neutral', strength: 0 }); // bearish, neutral, bullish

  // ===== Q7 SIGNAL STATE =====
  const [q7Signal, setQ7Signal] = useState(null); // Latest Q7 analysis from Lambda
  const [q7Loading, setQ7Loading] = useState(false);

  // ===== INSTITUTIONAL CHART STATE =====
  const [candleData, setCandleData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const emaLineRef = useRef(null);

  // ===== PENDING ORDERS / COLLATERAL CLAIM STATE =====
  const [pendingOrders, setPendingOrders] = useState([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [autoClaimEnabled, setAutoClaimEnabled] = useState(true); // Auto-claim on by default
  const [claimResults, setClaimResults] = useState([]);

  // ===== P&L TRACKING & VICTORY CARDS =====
  const [closedTrades, setClosedTrades] = useState([]); // Track closed trades for P&L history

  // ===== USER'S GTRADE POSITIONS (fetched directly from gTrade API) =====
  const [userPositions, setUserPositions] = useState([]);
  const [userPositionsLoading, setUserPositionsLoading] = useState(false);
  const [totalUnrealizedPnl, setTotalUnrealizedPnl] = useState(0);

  // ===== Q7 LIVE ACCESS (DTGC Token Gating) =====
  const hasQ7Access = dtgcBalance >= DTGC_MIN_REQUIRED;

  // ===== POLYMARKET PREDICTION MARKETS =====
  const [polymarketData, setPolymarketData] = useState([]);
  const [polymarketLoading, setPolymarketLoading] = useState(false);
  const [q7PolyPaused, setQ7PolyPaused] = useState(false); // Q7 Polymarket trading pause

  // ===== COPY TRADING / MIRROR MODE =====
  const [copyTradeWallet, setCopyTradeWallet] = useState('');
  const [copyTradeEnabled, setCopyTradeEnabled] = useState(false);
  const [copyTradePositions, setCopyTradePositions] = useState([]);

  // ===== HISTORICAL TRADE DATA (Real P&L) =====
  const [historicalTrades, setHistoricalTrades] = useState([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [realPnL, setRealPnL] = useState({ total: 0, wins: 0, losses: 0, trades: [] });

  // ===== COLLATERAL & BALANCE TRACKING =====
  const [startingBalance, setStartingBalance] = useState(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem('dtgc_starting_balance');
    return saved ? parseFloat(saved) : null;
  });
  const [pnlTimeRange, setPnlTimeRange] = useState('all'); // '24h', '48h', '72h', 'all'

  // ===== 5% FLYWHEEL TRACKING =====
  const FLYWHEEL_PERCENTAGE = 0.05; // 5%
  const GROWTH_ENGINE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';

  const [flywheelStats, setFlywheelStats] = useState(() => {
    const saved = localStorage.getItem('dtgc_flywheel_stats');
    return saved ? JSON.parse(saved) : {
      totalWins: 0,
      totalWinAmount: 0,
      totalFlywheelAllocated: 0,
      lastUpdated: null,
      transactions: [],
    };
  });

  // Save flywheel stats to localStorage when updated
  useEffect(() => {
    localStorage.setItem('dtgc_flywheel_stats', JSON.stringify(flywheelStats));
  }, [flywheelStats]);

  // Calculate 5% flywheel from any profit amount
  const calculateFlywheelAmount = (profitUsd) => {
    if (profitUsd <= 0) return 0;
    return profitUsd * FLYWHEEL_PERCENTAGE;
  };

  // Process a winning trade and track flywheel allocation
  const processWinForFlywheel = (profitUsd, tradeInfo = {}) => {
    if (profitUsd <= 0) return;

    const flywheelAmount = calculateFlywheelAmount(profitUsd);

    setFlywheelStats(prev => ({
      ...prev,
      totalWins: prev.totalWins + 1,
      totalWinAmount: prev.totalWinAmount + profitUsd,
      totalFlywheelAllocated: prev.totalFlywheelAllocated + flywheelAmount,
      lastUpdated: Date.now(),
      transactions: [
        {
          timestamp: Date.now(),
          profit: profitUsd,
          flywheel: flywheelAmount,
          ...tradeInfo,
        },
        ...prev.transactions.slice(0, 99), // Keep last 100
      ],
    }));

    console.log(`🔄 Flywheel: $${profitUsd.toFixed(2)} profit → $${flywheelAmount.toFixed(2)} (5%) to PLS`);
    return flywheelAmount;
  };

  // Get flywheel projection based on current performance
  const getFlywheelProjection = () => {
    const live = getLivePositionStats();
    const currentUnrealized = live.total > 0 ? live.total : 0;
    const projectedFlywheel = calculateFlywheelAmount(currentUnrealized);

    return {
      currentUnrealized,
      projectedFlywheel,
      totalAllocated: flywheelStats.totalFlywheelAllocated,
      totalWithProjected: flywheelStats.totalFlywheelAllocated + projectedFlywheel,
      winningPositions: live.wins,
    };
  };

  // Generate P&L chart data for time graph
  const getPnLChartData = () => {
    if (!historicalTrades || historicalTrades.length === 0) return [];

    // Sort trades by timestamp (oldest first)
    const sortedTrades = [...historicalTrades].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate cumulative P&L
    let cumulative = 0;
    const chartData = sortedTrades.map((trade, idx) => {
      cumulative += trade.pnlUsd;
      return {
        timestamp: trade.timestamp,
        pnl: trade.pnlUsd,
        cumulative,
        index: idx,
      };
    });

    return chartData;
  };

  // Render simple SVG line chart
  const renderPnLChart = () => {
    const data = getPnLChartData();
    if (data.length < 2) return null;

    const width = 340;
    const height = 100;
    const padding = { top: 10, right: 10, bottom: 20, left: 45 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Get min/max values
    const values = data.map(d => d.cumulative);
    const minVal = Math.min(0, ...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;

    // Scale functions
    const scaleX = (idx) => padding.left + (idx / (data.length - 1)) * chartWidth;
    const scaleY = (val) => padding.top + chartHeight - ((val - minVal) / range) * chartHeight;

    // Generate path
    const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(d.cumulative)}`).join(' ');

    // Zero line
    const zeroY = scaleY(0);

    // Get today's date range
    const startDate = new Date(data[0].timestamp);
    const endDate = new Date(data[data.length - 1].timestamp);

    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        {/* Grid lines */}
        <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="rgba(255,255,255,0.2)" strokeDasharray="4" />

        {/* Gradient fill under line */}
        <defs>
          <linearGradient id="pnlGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={data[data.length-1].cumulative >= 0 ? 'rgba(0,255,136,0.4)' : 'rgba(255,68,68,0.4)'} />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={`${pathD} L ${scaleX(data.length-1)} ${zeroY} L ${scaleX(0)} ${zeroY} Z`}
          fill="url(#pnlGradient)"
        />

        {/* Main line */}
        <path
          d={pathD}
          fill="none"
          stroke={data[data.length-1].cumulative >= 0 ? '#00ff88' : '#ff4444'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.length <= 15 && data.map((d, i) => (
          <circle
            key={i}
            cx={scaleX(i)}
            cy={scaleY(d.cumulative)}
            r="3"
            fill={d.pnl >= 0 ? '#00ff88' : '#ff4444'}
            stroke="#000"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        <text x={padding.left - 5} y={padding.top + 4} fill="#888" fontSize="8" textAnchor="end">${maxVal.toFixed(0)}</text>
        <text x={padding.left - 5} y={height - padding.bottom} fill="#888" fontSize="8" textAnchor="end">${minVal.toFixed(0)}</text>

        {/* X-axis labels */}
        <text x={padding.left} y={height - 5} fill="#666" fontSize="8">{startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
        <text x={width - padding.right} y={height - 5} fill="#666" fontSize="8" textAnchor="end">{endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
      </svg>
    );
  };

  // Calculate collateral deployed from open positions
  const collateralDeployed = userPositions.reduce((sum, pos) => sum + (pos.collateral || 0), 0);

  // Calculate LIVE position stats (winning = positive unrealized PnL)
  const getLivePositionStats = () => {
    if (!userPositions.length) return { wins: 0, losses: 0, total: 0, count: 0 };

    const winning = userPositions.filter(p => (p.pnlUsd || 0) > 0);
    const losing = userPositions.filter(p => (p.pnlUsd || 0) < 0);
    const total = userPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);

    return {
      wins: winning.length,
      losses: losing.length,
      total,
      count: userPositions.length,
      winRate: userPositions.length > 0 ? Math.round((winning.length / userPositions.length) * 100) : 0,
    };
  };

  // Get combined stats (historical closed + live open)
  const getCombinedStats = () => {
    const live = getLivePositionStats();
    const closed = realPnL;

    // If we have closed trades, combine them. Otherwise use live positions only
    if (closed.wins > 0 || closed.losses > 0) {
      return {
        wins: closed.wins + live.wins,
        losses: closed.losses + live.losses,
        total: closed.total + live.total,
        count: (closed.trades?.length || 0) + live.count,
      };
    }

    // No closed trades - show live position performance
    return live;
  };

  // Calculate filtered P&L based on time range
  const getFilteredPnL = () => {
    // If no historical trades, use live positions
    if (!historicalTrades.length) {
      const live = getLivePositionStats();
      return {
        total: live.total,
        wins: live.wins,
        losses: live.losses,
        count: live.count,
      };
    }

    const now = Date.now();
    const timeFilters = {
      '24h': 24 * 60 * 60 * 1000,
      '48h': 48 * 60 * 60 * 1000,
      '72h': 72 * 60 * 60 * 1000,
      'all': Infinity,
    };

    const cutoff = now - (timeFilters[pnlTimeRange] || Infinity);
    const filtered = historicalTrades.filter(t => t.timestamp >= cutoff);

    // Add live position stats
    const live = getLivePositionStats();

    return {
      total: filtered.reduce((sum, t) => sum + t.pnlUsd, 0) + live.total,
      wins: filtered.filter(t => t.pnlUsd > 0).length + live.wins,
      losses: filtered.filter(t => t.pnlUsd < 0).length + live.losses,
      count: filtered.length + live.count,
    };
  };

  // Forecast based on recent performance (uses live data if no closed trades)
  const getForecast = () => {
    const recent = getFilteredPnL();
    if (recent.count === 0) return null;

    const totalTrades = recent.wins + recent.losses;
    const winRate = totalTrades > 0 ? recent.wins / totalTrades : 0;
    const avgPnlPerTrade = recent.count > 0 ? recent.total / recent.count : 0;

    // Estimate trades per day based on time range
    let tradesPerDay;
    if (pnlTimeRange === 'all') {
      tradesPerDay = recent.count > 0 ? recent.count / 7 : 0; // Assume 7 days of data
    } else {
      const hours = parseInt(pnlTimeRange) || 24;
      tradesPerDay = recent.count > 0 ? (recent.count / hours) * 24 : 0;
    }

    return {
      winRate: (winRate * 100).toFixed(1),
      avgPnlPerTrade: isNaN(avgPnlPerTrade) ? '0.00' : avgPnlPerTrade.toFixed(2),
      tradesPerDay: isNaN(tradesPerDay) ? '0.0' : tradesPerDay.toFixed(1),
      projected24h: isNaN(avgPnlPerTrade * tradesPerDay) ? '0.00' : (avgPnlPerTrade * tradesPerDay).toFixed(2),
      projected7d: isNaN(avgPnlPerTrade * tradesPerDay * 7) ? '0.00' : (avgPnlPerTrade * tradesPerDay * 7).toFixed(2),
    };
  };

  // ===== SHAREABLE P&L CARDS =====
  const [showShareCard, setShowShareCard] = useState(false);
  const [showRetrospectCard, setShowRetrospectCard] = useState(false);
  const [currentMandoImage, setCurrentMandoImage] = useState(MANDO_IMAGES[0]);
  const pnlCardRef = useRef(null);

  // Randomize Mando image when either card opens
  useEffect(() => {
    if (showShareCard || showRetrospectCard) {
      const randomIndex = Math.floor(Math.random() * MANDO_IMAGES.length);
      setCurrentMandoImage(MANDO_IMAGES[randomIndex]);
    }
  }, [showShareCard, showRetrospectCard]);

  // Calculate ROI percentage
  const getROI = () => {
    if (!startingBalance || startingBalance <= 0) return 0;
    const currentTotal = (balance || 0) + collateralDeployed + (realPnL.total || 0);
    return ((currentTotal - startingBalance) / startingBalance) * 100;
  };

  // Get total system capital
  const getTotalSystemCapital = () => {
    return (balance || 0) + collateralDeployed + totalUnrealizedPnl;
  };

  // Calculate gold bars based on profit
  const getGoldBars = (profit) => {
    if (profit <= 0) return 0;
    for (let i = GOLD_BAR_THRESHOLDS.length - 1; i >= 0; i--) {
      if (profit >= GOLD_BAR_THRESHOLDS[i].min) {
        return GOLD_BAR_THRESHOLDS[i].bars;
      }
    }
    return 0;
  };

  // ===== Q7 DEV WALLET LIVE POSITIONS =====
  const [q7DevPositions, setQ7DevPositions] = useState([]);
  const [q7DevLoading, setQ7DevLoading] = useState(false);
  const [q7DevPnl, setQ7DevPnl] = useState(0);
  
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

  // Sync external prices from App.jsx (CoinGecko/goldprice.org) - always fresh, never stale
  useEffect(() => {
    if (externalPrices.BTC || externalPrices.ETH || externalPrices.GOLD || externalPrices.SILVER) {
      console.log('🔄 Syncing external prices:', externalPrices);
      setLivePrices(prev => ({
        BTC: externalPrices.BTC || prev.BTC,
        ETH: externalPrices.ETH || prev.ETH,
        GOLD: externalPrices.GOLD || prev.GOLD,
        SILVER: externalPrices.SILVER || prev.SILVER
      }));
      setPriceSource('live');
      setPriceUpdateTime(new Date());
    }
  }, [externalPrices.BTC, externalPrices.ETH, externalPrices.GOLD, externalPrices.SILVER]);

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
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Fetch Q7 signal analysis for selected asset
  const fetchQ7Signal = async (assetKey) => {
    setQ7Loading(true);
    try {
      const result = await apiCall('ANALYZE', { asset: assetKey });
      if (result.success && result.analysis) {
        setQ7Signal({
          asset: assetKey,
          score: result.analysis.score || 0,
          direction: result.analysis.direction || 'NEUTRAL',
          engines: result.analysis.engines || {},
          confluence: result.analysis.confluence || 0,
          indicators: result.analysis.indicators || {},
          timestamp: new Date(),
        });
        console.log(`📊 Q7 Signal for ${assetKey}:`, result.analysis);
      }
    } catch (error) {
      console.error('Q7 analysis error:', error);
    }
    setQ7Loading(false);
  };

  // Fetch bot status (includes balance + positions)
  const fetchBotStatus = async () => {
    try {
      const result = await apiCall('STATUS');
      if (result.success) {
        setBotStatus(result);
        setBalance(result.balance);

        // Normalize positions to ensure consistent structure
        const normalizedPositions = (result.positions || []).map((pos, idx) => ({
          ...pos,
          // Ensure index is set (gTrade uses different field names)
          index: pos.index ?? pos.tradeIndex ?? pos.pairIndex ?? idx,
          // Normalize long/short (gTrade uses 'buy' sometimes)
          long: pos.long ?? pos.buy ?? pos.direction === 'LONG',
          // Ensure asset is mapped correctly
          asset: pos.asset || pos.pair || mapPairToAsset(pos.pairIndex),
          // Ensure numeric values
          openPrice: parseFloat(pos.openPrice || pos.entryPrice || 0),
          collateral: parseFloat(pos.collateral || pos.initialPosToken || 0),
          leverage: parseFloat(pos.leverage || 1),
          tp: parseFloat(pos.tp || pos.takeProfit || 0),
          sl: parseFloat(pos.sl || pos.stopLoss || 0),
        }));

        setPositions(normalizedPositions);
        setLastUpdate(new Date());

        console.log('📊 Positions loaded:', normalizedPositions.length, normalizedPositions);

        // Update activity feed
        const newActivity = {
          type: 'STATUS',
          message: `Updated: $${result.balance?.toFixed(2)} | ${normalizedPositions.length} positions`,
          time: new Date().toLocaleTimeString(),
        };
        setBotActivity(prev => [newActivity, ...prev].slice(0, 20));

        // Also fetch pending orders for auto-claim
        if (result.pendingOrders) {
          setPendingOrders(result.pendingOrders);
          // Auto-claim if enabled and there are pending orders
          if (autoClaimEnabled && result.pendingOrders.length > 0) {
            console.log(`💰 Auto-claiming ${result.pendingOrders.length} pending orders...`);
            autoClaimAllCollateral();
          }
        } else {
          // Fetch pending orders separately if not in STATUS response
          fetchPendingOrders();
        }
      }
    } catch (error) {
      console.error('Failed to fetch bot status:', error);
    }
  };

  // ===== FETCH USER'S POSITIONS DIRECTLY FROM GTRADE API =====
  const fetchUserPositions = async (walletAddress) => {
    if (!walletAddress) return;

    setUserPositionsLoading(true);
    try {
      // Try EU endpoint first, then US
      const endpoints = [
        `https://backend-arbitrum.eu.gains.trade/open-trades/${walletAddress}`,
        `https://backend-arbitrum.gains.trade/open-trades/${walletAddress}`,
      ];

      let data = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            data = await response.json();
            console.log(`✅ gTrade positions from ${endpoint}:`, data?.length || 0);
            break;
          }
        } catch (e) {
          console.log(`⚠️ gTrade endpoint failed: ${endpoint}`);
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        // Map gTrade API response to our position format
        const ASSET_INDEX_REVERSE = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };

        const mappedPositions = data.map((t, idx) => {
          const pairIndex = parseInt(t.trade?.pairIndex || t.pairIndex || 0);
          const asset = ASSET_INDEX_REVERSE[pairIndex] || `PAIR${pairIndex}`;
          const isLong = t.trade?.long === true || t.trade?.long === 'true' || t.trade?.buy === true;
          const leverage = parseInt(t.trade?.leverage || t.leverage || 1) / 1000;
          const collateral = parseFloat(t.trade?.collateralAmount || t.collateralAmount || 0) / 1e6;
          const openPrice = parseFloat(t.trade?.openPrice || t.openPrice || 0) / 1e10;
          const tp = parseFloat(t.trade?.tp || t.tp || 0) / 1e10;
          const sl = parseFloat(t.trade?.sl || t.sl || 0) / 1e10;

          // Get current price for P&L calculation
          const currentPrice = livePrices[asset] || openPrice;
          const priceDiff = isLong
            ? (currentPrice - openPrice) / openPrice
            : (openPrice - currentPrice) / openPrice;
          const pnlPct = priceDiff * 100 * leverage;
          const pnlUsd = collateral * priceDiff * leverage;

          return {
            index: parseInt(t.trade?.index || t.index || idx),
            asset,
            pairIndex,
            long: isLong,
            leverage,
            collateral,
            openPrice,
            currentPrice,
            tp,
            sl,
            pnlPct,
            pnlUsd,
          };
        });

        setUserPositions(mappedPositions);

        // Calculate total unrealized P&L
        const totalPnl = mappedPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);
        setTotalUnrealizedPnl(totalPnl);

        console.log(`📊 User positions loaded: ${mappedPositions.length}, Total PnL: $${totalPnl.toFixed(2)}`);
      } else {
        setUserPositions([]);
        setTotalUnrealizedPnl(0);
      }
    } catch (error) {
      console.error('Failed to fetch user positions from gTrade:', error);
    }
    setUserPositionsLoading(false);
  };

  // Fetch user positions when wallet connects or prices update
  useEffect(() => {
    if (connectedAddress) {
      fetchUserPositions(connectedAddress);
    }
  }, [connectedAddress]);

  // Refresh user positions every 10 seconds when expanded
  useEffect(() => {
    if (isExpanded && connectedAddress) {
      const interval = setInterval(() => {
        fetchUserPositions(connectedAddress);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isExpanded, connectedAddress]);

  // Update P&L when prices change
  useEffect(() => {
    if (userPositions.length > 0 && Object.keys(livePrices).length > 0) {
      const updatedPositions = userPositions.map(pos => {
        const currentPrice = livePrices[pos.asset] || pos.currentPrice;
        const priceDiff = pos.long
          ? (currentPrice - pos.openPrice) / pos.openPrice
          : (pos.openPrice - currentPrice) / pos.openPrice;
        const pnlPct = priceDiff * 100 * pos.leverage;
        const pnlUsd = pos.collateral * priceDiff * pos.leverage;

        return { ...pos, currentPrice, pnlPct, pnlUsd };
      });

      setUserPositions(updatedPositions);
      const totalPnl = updatedPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);
      setTotalUnrealizedPnl(totalPnl);
    }
  }, [livePrices]);

  // ===== POLYMARKET PREDICTION MARKETS =====
  const POLYMARKET_CRYPTO_MARKETS = [
    { slug: 'will-bitcoin-hit-100000-in-2025', label: 'BTC $100K 2025' },
    { slug: 'will-bitcoin-hit-150000-in-2025', label: 'BTC $150K 2025' },
    { slug: 'will-ethereum-hit-5000-in-2025', label: 'ETH $5K 2025' },
    { slug: 'will-solana-hit-500-in-2025', label: 'SOL $500 2025' },
    { slug: 'fed-rate-cut-march-2025', label: 'Fed Cut Mar 2025' },
    { slug: 'us-strategic-bitcoin-reserve-2025', label: 'US BTC Reserve' },
  ];

  const fetchPolymarketData = async () => {
    setPolymarketLoading(true);
    try {
      // Polymarket CLOB API for market data
      const markets = [];

      // Fetch trending/popular crypto markets via gamma API
      const response = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=20&order=volume24hr&ascending=false&tag=crypto');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          data.forEach(market => {
            if (market.question && market.outcomePrices) {
              const prices = JSON.parse(market.outcomePrices || '[]');
              const yesPrice = prices[0] || 0;
              markets.push({
                id: market.id,
                question: market.question,
                yesPrice: (parseFloat(yesPrice) * 100).toFixed(1),
                volume: market.volume24hr ? `$${(parseFloat(market.volume24hr) / 1000).toFixed(1)}K` : 'N/A',
                liquidity: market.liquidityClob ? `$${(parseFloat(market.liquidityClob) / 1000).toFixed(0)}K` : 'N/A',
                endDate: market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A',
                image: market.image,
              });
            }
          });
        }
      }

      // Also fetch macro/politics markets
      const macroResp = await fetch('https://gamma-api.polymarket.com/markets?closed=false&limit=10&order=volume24hr&ascending=false&tag=politics');
      if (macroResp.ok) {
        const macroData = await macroResp.json();
        if (Array.isArray(macroData)) {
          macroData.forEach(market => {
            if (market.question && market.outcomePrices) {
              const prices = JSON.parse(market.outcomePrices || '[]');
              const yesPrice = prices[0] || 0;
              markets.push({
                id: market.id,
                question: market.question,
                yesPrice: (parseFloat(yesPrice) * 100).toFixed(1),
                volume: market.volume24hr ? `$${(parseFloat(market.volume24hr) / 1000).toFixed(1)}K` : 'N/A',
                liquidity: market.liquidityClob ? `$${(parseFloat(market.liquidityClob) / 1000).toFixed(0)}K` : 'N/A',
                endDate: market.endDate ? new Date(market.endDate).toLocaleDateString() : 'N/A',
                image: market.image,
                tag: 'macro',
              });
            }
          });
        }
      }

      setPolymarketData(markets);
      console.log('🎰 Polymarket data loaded:', markets.length, 'markets');
    } catch (error) {
      console.error('Failed to fetch Polymarket data:', error);
      // Fallback data
      setPolymarketData([
        { question: 'BTC $100K by EOY 2025?', yesPrice: '62.5', volume: '$1.2M', tag: 'crypto' },
        { question: 'ETH $5K by EOY 2025?', yesPrice: '34.2', volume: '$450K', tag: 'crypto' },
        { question: 'Fed Rate Cut Q1 2025?', yesPrice: '78.1', volume: '$890K', tag: 'macro' },
      ]);
    }
    setPolymarketLoading(false);
  };

  // Fetch Polymarket data when tab is active
  useEffect(() => {
    if (activeTab === 'polymarket' && polymarketData.length === 0) {
      fetchPolymarketData();
    }
  }, [activeTab]);

  // ===== Q7 DEV WALLET POSITION FETCH =====
  const fetchQ7DevPositions = async () => {
    setQ7DevLoading(true);
    try {
      // Fetch Q7 dev wallet positions directly from gTrade API
      const endpoints = [
        `https://backend-arbitrum.gains.trade/open-trades/${Q7_DEV_WALLET}`,
        `https://backend-arbitrum.eu.gains.trade/open-trades/${Q7_DEV_WALLET}`,
      ];

      let data = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            data = await response.json();
            console.log(`✅ Q7 Dev positions from gTrade:`, data?.length || 0);
            break;
          }
        } catch (e) {
          console.log(`⚠️ gTrade endpoint failed: ${endpoint}`);
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        const ASSET_INDEX_REVERSE = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };

        const mappedPositions = data.map((t, idx) => {
          const pairIndex = parseInt(t.trade?.pairIndex || t.pairIndex || 0);
          const asset = ASSET_INDEX_REVERSE[pairIndex] || `PAIR${pairIndex}`;
          const isLong = t.trade?.long === true || t.trade?.long === 'true' || t.trade?.buy === true;
          const leverage = parseInt(t.trade?.leverage || t.leverage || 1) / 1000;
          const collateral = parseFloat(t.trade?.collateralAmount || t.collateralAmount || 0) / 1e6;
          const openPrice = parseFloat(t.trade?.openPrice || t.openPrice || 0) / 1e10;
          const tp = parseFloat(t.trade?.tp || t.tp || 0) / 1e10;
          const sl = parseFloat(t.trade?.sl || t.sl || 0) / 1e10;

          // Get current price for P&L calculation
          const currentPrice = livePrices[asset] || openPrice;
          const priceDiff = isLong
            ? (currentPrice - openPrice) / openPrice
            : (openPrice - currentPrice) / openPrice;
          const pnlPct = priceDiff * 100 * leverage;
          const pnlUsd = collateral * priceDiff * leverage;

          return {
            index: parseInt(t.trade?.index || t.index || idx),
            asset,
            pairIndex,
            long: isLong,
            leverage,
            collateral,
            openPrice,
            currentPrice,
            tp,
            sl,
            pnlPct,
            pnlUsd,
          };
        });

        setQ7DevPositions(mappedPositions);
        const totalPnl = mappedPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);
        setQ7DevPnl(totalPnl);
        console.log(`🔴 Q7 Dev positions loaded: ${mappedPositions.length}, Total PnL: $${totalPnl.toFixed(2)}`);
      } else {
        setQ7DevPositions([]);
        setQ7DevPnl(0);
      }
    } catch (error) {
      console.error('Failed to fetch Q7 dev positions:', error);
    }
    setQ7DevLoading(false);
  };

  // Fetch Q7 dev positions when tab is active and refresh every 10s
  useEffect(() => {
    if (activeTab === 'q7live') {
      fetchQ7DevPositions();
      const interval = setInterval(fetchQ7DevPositions, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Update Q7 dev positions P&L when prices change
  useEffect(() => {
    if (q7DevPositions.length > 0 && Object.keys(livePrices).length > 0) {
      const updatedPositions = q7DevPositions.map(pos => {
        const currentPrice = livePrices[pos.asset] || pos.currentPrice;
        const priceDiff = pos.long
          ? (currentPrice - pos.openPrice) / pos.openPrice
          : (pos.openPrice - currentPrice) / pos.openPrice;
        const pnlPct = priceDiff * 100 * pos.leverage;
        const pnlUsd = pos.collateral * priceDiff * pos.leverage;
        return { ...pos, currentPrice, pnlPct, pnlUsd };
      });
      setQ7DevPositions(updatedPositions);
      const totalPnl = updatedPositions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);
      setQ7DevPnl(totalPnl);
    }
  }, [livePrices]);

  // ===== FETCH HISTORICAL TRADES (Real P&L) =====
  const fetchHistoricalTrades = async (walletAddr = Q7_DEV_WALLET) => {
    setHistoricalLoading(true);
    try {
      // gTrade historical trades API
      const endpoints = [
        `https://backend-arbitrum.gains.trade/historical-trades/${walletAddr}?limit=50`,
        `https://backend-arbitrum.eu.gains.trade/historical-trades/${walletAddr}?limit=50`,
      ];

      let data = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            data = await response.json();
            console.log(`✅ Historical trades from gTrade:`, data?.length || 0);
            break;
          }
        } catch (e) {
          console.log(`⚠️ Historical endpoint failed: ${endpoint}`);
        }
      }

      if (Array.isArray(data) && data.length > 0) {
        const ASSET_INDEX_REVERSE = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };

        const trades = data.map(t => {
          const pairIndex = parseInt(t.pairIndex || 0);
          const asset = ASSET_INDEX_REVERSE[pairIndex] || `PAIR${pairIndex}`;
          const isLong = t.long === true || t.long === 'true' || t.buy === true;
          const leverage = parseInt(t.leverage || 1) / 1000;
          const collateral = parseFloat(t.collateralAmount || 0) / 1e6;
          const openPrice = parseFloat(t.openPrice || 0) / 1e10;
          const closePrice = parseFloat(t.closePrice || 0) / 1e10;
          const pnlRaw = parseFloat(t.percentProfit || 0);
          const pnlUsd = collateral * (pnlRaw / 100);
          const timestamp = parseInt(t.timestamp || t.closeTimestamp || Date.now());

          return {
            asset,
            direction: isLong ? 'LONG' : 'SHORT',
            leverage,
            collateral,
            openPrice,
            closePrice,
            pnlPercent: pnlRaw,
            pnlUsd,
            timestamp,
            closeType: t.closeType || 'CLOSED',
            txHash: t.txHash || null,
          };
        }).sort((a, b) => b.timestamp - a.timestamp);

        setHistoricalTrades(trades);

        // Calculate real P&L stats
        const wins = trades.filter(t => t.pnlUsd > 0).length;
        const losses = trades.filter(t => t.pnlUsd < 0).length;
        const total = trades.reduce((sum, t) => sum + t.pnlUsd, 0);

        setRealPnL({ total, wins, losses, trades });
        setClosedTrades(trades.slice(0, 20)); // Also update closedTrades for display

        // Calculate 5% Flywheel from ALL winning closed trades
        const winningTrades = trades.filter(t => t.pnlUsd > 0);
        const totalWinAmount = winningTrades.reduce((sum, t) => sum + t.pnlUsd, 0);
        const totalFlywheelFromClosed = totalWinAmount * FLYWHEEL_PERCENTAGE;

        // Update flywheel stats with historical data
        setFlywheelStats(prev => ({
          ...prev,
          totalWins: wins,
          totalWinAmount: totalWinAmount,
          totalFlywheelAllocated: totalFlywheelFromClosed,
          lastUpdated: Date.now(),
        }));

        // Sync tradeStats with real historical data for Bot tab congruency
        setTradeStats(prev => ({
          ...prev,
          wins,
          losses,
          totalPnl: total,
          successes: wins,
          attempts: wins + losses,
        }));
        console.log(`📊 Real P&L: $${total.toFixed(2)} | ${wins}W/${losses}L`);
        console.log(`🔄 Flywheel from closed wins: $${totalFlywheelFromClosed.toFixed(2)} (5% of $${totalWinAmount.toFixed(2)})`);
      }
    } catch (error) {
      console.error('Failed to fetch historical trades:', error);
    }
    setHistoricalLoading(false);
  };

  // ===== COPY TRADING - Fetch positions for wallet to mirror =====
  const fetchCopyTradePositions = async () => {
    if (!copyTradeWallet || copyTradeWallet.length < 42) return;

    try {
      const endpoints = [
        `https://backend-arbitrum.gains.trade/open-trades/${copyTradeWallet}`,
        `https://backend-arbitrum.eu.gains.trade/open-trades/${copyTradeWallet}`,
      ];

      let data = null;
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            data = await response.json();
            break;
          }
        } catch (e) { /* silent fail */ }
      }

      if (Array.isArray(data)) {
        const ASSET_INDEX_REVERSE = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };
        const positions = data.map(t => ({
          asset: ASSET_INDEX_REVERSE[parseInt(t.trade?.pairIndex || 0)] || 'BTC',
          direction: t.trade?.long ? 'LONG' : 'SHORT',
          leverage: parseInt(t.trade?.leverage || 1) / 1000,
          collateral: parseFloat(t.trade?.collateralAmount || 0) / 1e6,
          openPrice: parseFloat(t.trade?.openPrice || 0) / 1e10,
        }));
        setCopyTradePositions(positions);
        console.log(`📋 Copy trade positions loaded:`, positions.length);
      }
    } catch (error) {
      console.error('Failed to fetch copy trade positions:', error);
    }
  };

  // Fetch historical trades for CONNECTED WALLET on mount AND when tab changes
  useEffect(() => {
    if (userAddress) {
      fetchHistoricalTrades(userAddress);
    }
  }, [userAddress]); // Fetch on mount when wallet connects

  // Refetch when switching to stats tab
  useEffect(() => {
    if (activeTab === 'stats' && userAddress) {
      fetchHistoricalTrades(userAddress);
    }
  }, [activeTab]);

  // Sync tradeStats with userPositions (for OPEN position counts)
  useEffect(() => {
    if (userPositions.length > 0) {
      const longs = userPositions.filter(p => p.direction === 'LONG').length;
      const shorts = userPositions.filter(p => p.direction === 'SHORT').length;
      // Update with open position counts (not historical wins/losses)
      setTradeStats(prev => ({
        ...prev,
        openLongs: longs,
        openShorts: shorts,
        openTotal: userPositions.length,
        deployedCollateral: collateralDeployed,
      }));
    }
  }, [userPositions, collateralDeployed]);

  // Save starting balance when first balance is loaded
  useEffect(() => {
    if (balance !== null && startingBalance === null) {
      const total = balance + collateralDeployed;
      setStartingBalance(total);
      localStorage.setItem('dtgc_starting_balance', total.toString());
      console.log(`💰 Starting balance set: $${total.toFixed(2)} (${balance} available + ${collateralDeployed.toFixed(2)} deployed)`);
    }
  }, [balance, collateralDeployed, startingBalance]);

  // ===== PENDING ORDERS / COLLATERAL CLAIM FUNCTIONS =====

  // Fetch pending orders (timed out market orders)
  const fetchPendingOrders = async () => {
    try {
      const result = await apiCall('GET_PENDING');
      if (result.success && result.pendingOrders) {
        setPendingOrders(result.pendingOrders);
        console.log('📋 Pending orders:', result.pendingOrders.length);

        // Auto-claim if enabled
        if (autoClaimEnabled && result.pendingOrders.length > 0) {
          console.log(`💰 Auto-claiming ${result.pendingOrders.length} pending orders...`);
          autoClaimAllCollateral();
        }
      }
    } catch (error) {
      console.error('Failed to fetch pending orders:', error);
    }
  };

  // Claim collateral from a single order
  const claimCollateral = async (orderId, isLimitOrder = false) => {
    setIsClaiming(true);
    try {
      const result = await apiCall('CLAIM_COLLATERAL', { orderId, isLimitOrder });

      if (result.success) {
        showToast(`💰 Collateral claimed from order #${orderId}!`, 'success');
        setBotActivity(prev => [{
          type: 'CLAIM',
          message: `💰 Claimed collateral #${orderId}`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));

        // Refresh status
        fetchBotStatus();
      } else {
        showToast(result.error || 'Claim failed', 'error');
      }
    } catch (error) {
      showToast('Claim failed: ' + error.message, 'error');
    }
    setIsClaiming(false);
  };

  // Auto-claim ALL pending collateral
  const autoClaimAllCollateral = async () => {
    if (isClaiming) return; // Prevent double-claiming

    setIsClaiming(true);
    showToast('💰 Auto-claiming all pending collateral...', 'info');

    try {
      const result = await apiCall('AUTO_CLAIM_ALL');

      if (result.success) {
        const msg = `💰 Claimed ${result.claimed} orders ($${result.totalClaimed?.toFixed(2) || '0'})`;
        showToast(msg, 'success');

        setBotActivity(prev => [{
          type: 'AUTO_CLAIM',
          message: msg,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));

        setClaimResults(result.results || []);

        // Refresh status to update balance
        setTimeout(fetchBotStatus, 2000);
      } else {
        showToast(result.error || result.message || 'No orders to claim', 'info');
      }
    } catch (error) {
      showToast('Auto-claim failed: ' + error.message, 'error');
    }

    setIsClaiming(false);
  };

  // Helper to map gTrade pair indices to asset symbols
  const mapPairToAsset = (pairIndex) => {
    const pairMap = { 0: 'BTC', 1: 'ETH', 90: 'GOLD', 91: 'SILVER' };
    return pairMap[pairIndex] || 'BTC';
  };

  // Fetch live prices - gTRADE DIRECT is PRIMARY (matches perps exactly!)
  const fetchPrices = async () => {
    // PRIMARY: gTrade backend prices DIRECTLY - MATCHES LIVE PERPS EXACTLY!
    // This returns an array where index = pair ID (0=BTC, 1=ETH, 90=GOLD, 91=SILVER)
    try {
      const res = await fetch('/api/gtrade-prices');
      if (!res.ok) throw new Error(`gTrade API returned ${res.status}`);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 90) {
        const prices = {
          BTC: parseFloat(data[0]),    // Pair 0 = BTC/USD
          ETH: parseFloat(data[1]),    // Pair 1 = ETH/USD
          GOLD: parseFloat(data[90]),  // Pair 90 = XAU/USD (Gold)
          SILVER: parseFloat(data[91]) // Pair 91 = XAG/USD (Silver)
        };

        // Validate prices are real
        if (prices.BTC > 50000 && prices.ETH > 1000 && prices.GOLD > 2000) {
          console.log('🎯 gTrade DIRECT prices (matches perps!):', prices);
          setLivePrices(prices);
          setGtradeVerifyPrices(prices);
          setPriceSource('gtrade-direct');
          setPriceUpdateTime(new Date());
          // Update momentum for selected asset
          updateMomentum(selectedAsset, prices[selectedAsset]);
          return;
        }
      }
    } catch (e) {
      console.log('gTrade direct fetch failed:', e.message);
    }

    // SECONDARY: Try Lambda (if gTrade direct failed)
    try {
      const result = await apiCall('GET_PRICES');
      if (result.success && result.prices) {
        const p = result.prices;
        if (p.BTC > 50000 && p.ETH > 1000 && p.GOLD > 2000) {
          console.log('🎯 Lambda gTrade prices:', p);
          setLivePrices(p);
          setGtradeVerifyPrices(p);
          setPriceSource(result.source || 'gtrade-api');
          setPriceUpdateTime(new Date());
          return;
        }
      }
    } catch (e) {
      console.log('Lambda price fetch failed:', e.message);
    }

    // LAST RESORT: Use external prices from App.jsx (CoinGecko/goldprice.org)
    // or previous cached prices - NO stale hardcoded values
    const prices = {
      BTC: livePrices.BTC || externalPrices.BTC || null,
      ETH: livePrices.ETH || externalPrices.ETH || null,
      GOLD: livePrices.GOLD || externalPrices.GOLD || null,
      SILVER: livePrices.SILVER || externalPrices.SILVER || null
    };

    // Only update if we have at least some prices
    if (prices.BTC || prices.ETH || prices.GOLD || prices.SILVER) {
      console.log('📊 Using external/cached prices:', prices);
      setLivePrices(prices);
      setPriceSource(externalPrices.BTC ? 'live' : 'cached');
    } else {
      console.log('⚠️ No prices available');
      setPriceSource('unavailable');
    }
    setPriceUpdateTime(new Date());
  };

  // ===== MOMENTUM DETECTION =====
  // Tracks price changes to determine trend direction
  const updateMomentum = (asset, currentPrice) => {
    setPriceHistory(prev => {
      const history = prev[asset] || [];
      const newHistory = [...history, { price: currentPrice, time: Date.now() }].slice(-10); // Keep last 10 samples

      // Calculate momentum from price changes
      if (newHistory.length >= 3) {
        const recent = newHistory.slice(-3);
        const priceChange = (recent[2].price - recent[0].price) / recent[0].price * 100;
        const strength = Math.min(100, Math.abs(priceChange) * 50); // Scale to 0-100

        setMomentum({
          direction: priceChange > 0.05 ? 'bullish' : priceChange < -0.05 ? 'bearish' : 'neutral',
          strength: strength,
          change: priceChange,
        });
      }

      return { ...prev, [asset]: newHistory };
    });
  };

  // ===== INSTITUTIONAL CHART - CANDLE FETCHING =====
  const fetchCandleData = useCallback(async (asset) => {
    setChartLoading(true);
    try {
      const productMap = { BTC: 'BTC-USD', ETH: 'ETH-USD' };
      const product = productMap[asset];

      if (asset === 'GOLD' || asset === 'SILVER') {
        // Use PAXG as gold proxy for chart
        const url = `https://api.exchange.coinbase.com/products/PAXG-USD/candles?granularity=900`;
        const response = await fetch(url);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const candles = data.slice(0, 100).reverse().map(c => ({
            time: c[0],
            open: parseFloat(c[3]),
            high: parseFloat(c[2]),
            low: parseFloat(c[1]),
            close: parseFloat(c[4]),
          }));
          const volumes = data.slice(0, 100).reverse().map(c => ({
            time: c[0],
            value: parseFloat(c[5]),
            color: parseFloat(c[4]) >= parseFloat(c[3]) ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 68, 68, 0.5)',
          }));
          setCandleData(candles);
          setVolumeData(volumes);
        }
      } else if (product) {
        const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=900`;
        const response = await fetch(url);
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const candles = data.slice(0, 100).reverse().map(c => ({
            time: c[0],
            open: parseFloat(c[3]),
            high: parseFloat(c[2]),
            low: parseFloat(c[1]),
            close: parseFloat(c[4]),
          }));
          const volumes = data.slice(0, 100).reverse().map(c => ({
            time: c[0],
            value: parseFloat(c[5]),
            color: parseFloat(c[4]) >= parseFloat(c[3]) ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 68, 68, 0.5)',
          }));
          setCandleData(candles);
          setVolumeData(volumes);
        }
      }
    } catch (e) {
      console.log('Chart candle fetch failed:', e.message);
    }
    setChartLoading(false);
  }, []);

  // ===== CHART INITIALIZATION =====
  useEffect(() => {
    if (!chartContainerRef.current || candleData.length === 0) return;

    // Clean up existing chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create new chart with institutional styling
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#888',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,215,0,0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(255,215,0,0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // Add candlestick series with institutional colors (v5 API)
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00ff88',
      downColor: '#ff4444',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff4444',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4444',
    });
    candleSeries.setData(candleData);
    candleSeriesRef.current = candleSeries;

    // Add volume histogram (v5 API)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    // Add EMA line if we have enough data (v5 API)
    if (candleData.length >= 21) {
      const emaData = [];
      let ema = candleData.slice(0, 21).reduce((sum, c) => sum + c.close, 0) / 21;
      for (let i = 21; i < candleData.length; i++) {
        ema = candleData[i].close * (2/22) + ema * (1 - 2/22);
        emaData.push({ time: candleData[i].time, value: ema });
      }
      const emaLine = chart.addSeries(LineSeries, {
        color: '#FFD700',
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      emaLine.setData(emaData);
      emaLineRef.current = emaLine;
    }

    // Fit content
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [candleData, volumeData]);

  // Fetch candles when asset changes
  useEffect(() => {
    fetchCandleData(selectedAsset);
  }, [selectedAsset, fetchCandleData]);

  // Update candles every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCandleData(selectedAsset);
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedAsset, fetchCandleData]);

  // ===== AGGRESSIVE SCALP TRADE EXECUTION =====
  // Retry logic + quick execution for volatile markets
  const openTrade = async (retryAttempt = 0) => {
    if (parseFloat(collateral) < 5) {
      showToast('Minimum collateral is $5', 'error');
      return;
    }

    // Cooldown check for auto-trades
    const now = Date.now();
    if (autoTradeEnabled && now - lastTradeTime < AUTO_TRADE_CONFIG.cooldownMs) {
      const remaining = Math.ceil((AUTO_TRADE_CONFIG.cooldownMs - (now - lastTradeTime)) / 1000);
      showToast(`⏳ Cooldown: ${remaining}s`, 'info');
      return;
    }

    // Validate price exists before trading
    const currentPrice = livePrices[selectedAsset];
    if (!currentPrice || currentPrice <= 0) {
      showToast(`No price for ${selectedAsset}. Refreshing...`, 'error');
      await fetchPrices();
      return;
    }

    // Apply SCALP PRESET settings for quick trades
    const preset = SCALP_PRESETS[scalpMode];
    const scalpTp = parseFloat(takeProfit) || preset.tp;
    const scalpSl = parseFloat(stopLoss) || preset.sl;
    const roundedLeverage = Math.round(leverage);

    // Track attempt
    setTradeStats(prev => ({ ...prev, attempts: prev.attempts + 1 }));
    setLoading(true);
    setRetryCount(retryAttempt);

    if (retryAttempt > 0) {
      setIsRetrying(true);
      showToast(`🔄 Retry ${retryAttempt}/${AUTO_TRADE_CONFIG.maxRetries}...`, 'info');
    }

    try {
      console.log(`⚡ Opening ${direction} ${selectedAsset} @ ${roundedLeverage}x (attempt ${retryAttempt + 1})`);

      const result = await apiCall('OPEN_TRADE', {
        asset: selectedAsset,
        direction,
        collateral: parseFloat(collateral),
        leverage: roundedLeverage,
        takeProfit: scalpTp,  // Use scalp preset TP
        stopLoss: scalpSl,     // Use scalp preset SL
        price: currentPrice,
        // Extra params for aggressive execution
        slippage: 2,           // Higher slippage tolerance
        urgent: true,          // Priority execution flag
      });

      if (result.success) {
        // SUCCESS - Update stats and state
        setLastTradeTime(Date.now());
        setTradeStats(prev => ({ ...prev, successes: prev.successes + 1 }));
        setIsRetrying(false);
        setRetryCount(0);

        showToast(`✅ ${direction} ${selectedAsset} @ ${roundedLeverage}x FILLED!`, 'success');

        setBotActivity(prev => [{
          type: direction === 'LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
          message: `⚡ ${direction} ${selectedAsset} $${collateral} @ ${roundedLeverage}x (${preset.name})`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));

        fetchBotStatus();
      } else {
        // FAILED - Retry if under limit
        const errorMsg = result.error || 'Execution failed';
        console.warn(`❌ Trade failed (attempt ${retryAttempt + 1}): ${errorMsg}`);

        if (retryAttempt < AUTO_TRADE_CONFIG.maxRetries) {
          // Wait and retry
          showToast(`⚠️ Failed, retrying... (${retryAttempt + 1}/${AUTO_TRADE_CONFIG.maxRetries})`, 'error');

          setBotActivity(prev => [{
            type: 'RETRY',
            message: `🔄 Retry ${retryAttempt + 1}: ${errorMsg}`,
            time: new Date().toLocaleTimeString(),
          }, ...prev].slice(0, 20));

          // Exponential backoff: 500ms, 1000ms, 2000ms
          const delay = AUTO_TRADE_CONFIG.retryDelayMs * Math.pow(2, retryAttempt);
          setTimeout(() => openTrade(retryAttempt + 1), delay);
          return; // Don't setLoading(false) yet
        } else {
          // Max retries reached
          showToast(`❌ Failed after ${AUTO_TRADE_CONFIG.maxRetries} attempts: ${errorMsg}`, 'error');
          setIsRetrying(false);
          setRetryCount(0);

          setBotActivity(prev => [{
            type: 'FAILED',
            message: `❌ FAILED ${direction} ${selectedAsset} after ${AUTO_TRADE_CONFIG.maxRetries} retries`,
            time: new Date().toLocaleTimeString(),
          }, ...prev].slice(0, 20));
        }
      }
    } catch (error) {
      console.error('Trade error:', error);

      // Network/connection errors - always retry
      if (retryAttempt < AUTO_TRADE_CONFIG.maxRetries) {
        showToast(`🔄 Connection error, retrying...`, 'error');
        const delay = AUTO_TRADE_CONFIG.retryDelayMs * Math.pow(2, retryAttempt);
        setTimeout(() => openTrade(retryAttempt + 1), delay);
        return;
      }

      showToast('Trade failed: ' + error.message, 'error');
      setIsRetrying(false);
      setRetryCount(0);
    }

    setLoading(false);
  };

  // ===== QUICK SCALP TRADE =====
  // One-click trade with current scalp settings
  const quickScalpTrade = async (dir) => {
    setDirection(dir);

    // Apply scalp preset immediately
    const preset = SCALP_PRESETS[scalpMode];
    setTakeProfit(preset.tp.toString());
    setStopLoss(preset.sl.toString());

    // Adjust leverage for asset type
    const maxLev = ASSETS[selectedAsset].maxLev;
    const targetLev = Math.min(preset.leverage, maxLev);
    setLeverage(targetLev);

    // Execute immediately
    await openTrade(0);
  };

  // Close trade - handles multiple index formats from gTrade
  const closeTrade = async (tradeIndex, position = null) => {
    if (tradeIndex === undefined || tradeIndex === null) {
      showToast('Invalid position index', 'error');
      return;
    }
    setLoading(true);
    try {
      // Try with the provided index first
      let result = await apiCall('CLOSE_TRADE', { tradeIndex });

      // If that fails and we have position info, try alternative methods
      if (!result.success && position) {
        console.log('Trying alternative close methods...');

        // Try with pairIndex + index combo (gTrade v10 format)
        if (position.pairIndex !== undefined) {
          result = await apiCall('CLOSE_TRADE', {
            pairIndex: position.pairIndex,
            index: position.index,
          });
        }

        // Try with full position object
        if (!result.success) {
          result = await apiCall('CLOSE_TRADE', { position });
        }
      }

      if (result.success) {
        const pnl = position ? calculatePnL(position) : null;
        const pnlMsg = pnl ? ` @ ${pnl.percent >= 0 ? '+' : ''}${pnl.percent.toFixed(1)}%` : '';
        showToast(`Position closed!${pnlMsg}`, 'success');
        setBotActivity(prev => [{
          type: 'CLOSE',
          message: `Closed ${position?.asset || 'position'} #${tradeIndex}${pnlMsg}`,
          time: new Date().toLocaleTimeString(),
        }, ...prev].slice(0, 20));

        // ===== UPDATE P&L STATS =====
        if (pnl) {
          setTradeStats(prev => ({
            ...prev,
            wins: pnl.percent >= 0 ? prev.wins + 1 : prev.wins,
            losses: pnl.percent < 0 ? prev.losses + 1 : prev.losses,
            totalPnl: prev.totalPnl + (pnl.usd || 0),
          }));

          // Add to closed trades history for victory cards
          setClosedTrades(prev => [{
            asset: position?.asset,
            direction: position?.long ? 'LONG' : 'SHORT',
            pnlPercent: pnl.percent,
            pnlUsd: pnl.usd,
            leverage: position?.leverage,
            collateral: position?.collateral,
            closedAt: new Date().toISOString(),
            closeType: 'MANUAL',
          }, ...prev].slice(0, 50));
        }

        fetchBotStatus();
      } else {
        showToast(result.error || 'Failed to close', 'error');
        console.error('Close trade failed:', result);
      }
    } catch (error) {
      showToast('Close failed: ' + error.message, 'error');
      console.error('Close trade error:', error);
    }
    setLoading(false);
  };

  // Calculate P&L for a position - MATCHES gTRADE FORMULA EXACTLY
  const calculatePnL = (pos) => {
    const currentPrice = livePrices[pos.asset];
    if (!currentPrice || currentPrice <= 0 || !pos.openPrice || pos.openPrice <= 0) {
      console.warn(`⚠️ Invalid prices for ${pos.asset}: current=${currentPrice}, open=${pos.openPrice}`);
      return null;
    }

    // Ensure pos.long is a boolean (gTrade API may return string)
    const isLong = pos.long === true || pos.long === 'true';
    const leverage = pos.leverage || 1;
    const collateral = pos.collateral || 0;

    // gTrade P&L formula: (currentPrice - openPrice) / openPrice * leverage
    const priceDiff = isLong
      ? (currentPrice - pos.openPrice) / pos.openPrice
      : (pos.openPrice - currentPrice) / pos.openPrice;

    const pnlPercent = priceDiff * 100 * leverage;
    const pnlUsd = collateral * priceDiff * leverage;

    console.log(`📊 P&L calc for ${pos.asset}: current=$${currentPrice.toFixed(2)}, open=$${pos.openPrice.toFixed(2)}, ` +
      `isLong=${isLong}, lev=${leverage}x, diff=${(priceDiff*100).toFixed(4)}%, pnl=${pnlPercent.toFixed(2)}%`);

    return { percent: pnlPercent, usd: pnlUsd, currentPrice };
  };

  // AUTO TP/SL MONITORING - Check if any position hits TP or SL and auto-close
  const checkAutoClose = async () => {
    if (positions.length === 0 || Object.keys(livePrices).length === 0) return;

    for (const pos of positions) {
      const currentPrice = livePrices[pos.asset];
      if (!currentPrice || !pos.openPrice) continue;

      const isLong = pos.long === true || pos.long === 'true';
      const priceDiff = isLong
        ? (currentPrice - pos.openPrice) / pos.openPrice
        : (pos.openPrice - currentPrice) / pos.openPrice;
      const pnlPercent = priceDiff * 100 * (pos.leverage || 1);

      // Check Take Profit
      if (pos.tp > 0) {
        const tpPrice = isLong
          ? pos.openPrice * (1 + pos.tp / 100 / (pos.leverage || 1))
          : pos.openPrice * (1 - pos.tp / 100 / (pos.leverage || 1));

        const tpHit = isLong ? currentPrice >= tpPrice : currentPrice <= tpPrice;

        if (tpHit) {
          const pnlUsd = pos.collateral * (pnlPercent / 100);
          console.log(`🎯 TP HIT for ${pos.asset}! Current: $${currentPrice}, TP: $${tpPrice}, PnL: ${pnlPercent.toFixed(2)}% (+$${pnlUsd.toFixed(2)})`);
          showToast(`🎯 TP HIT! Closing ${pos.asset} @ +${pnlPercent.toFixed(1)}%`, 'success');

          // Auto-close the position
          try {
            const closeResult = await apiCall('CLOSE_TRADE', { tradeIndex: pos.index });
            setBotActivity(prev => [{
              type: 'TP_HIT',
              message: `🎯 TP: ${pos.asset} closed @ +${pnlPercent.toFixed(1)}% (+$${pnlUsd.toFixed(2)})`,
              time: new Date().toLocaleTimeString(),
            }, ...prev].slice(0, 20));

            // ===== UPDATE P&L STATS FOR TP HIT =====
            if (closeResult.success) {
              setTradeStats(prev => ({
                ...prev,
                wins: prev.wins + 1,
                totalPnl: prev.totalPnl + pnlUsd,
              }));
              setClosedTrades(prev => [{
                asset: pos.asset,
                direction: pos.long ? 'LONG' : 'SHORT',
                pnlPercent: pnlPercent,
                pnlUsd: pnlUsd,
                leverage: pos.leverage,
                collateral: pos.collateral,
                closedAt: new Date().toISOString(),
                closeType: 'TP_HIT',
              }, ...prev].slice(0, 50));
              console.log(`📊 P&L Updated: +$${pnlUsd.toFixed(2)} (TP HIT)`);
            }

            // MASTER TP: After successful close, auto-claim any pending collateral
            if (closeResult.success) {
              console.log('💰 TP closed - checking for pending collateral to reclaim...');
              setTimeout(async () => {
                try {
                  const pendingResult = await apiCall('GET_PENDING');
                  if (pendingResult.success && pendingResult.pendingOrders?.length > 0) {
                    console.log(`💰 Found ${pendingResult.pendingOrders.length} pending orders - auto-claiming...`);
                    await apiCall('AUTO_CLAIM_ALL');
                    showToast(`💰 Auto-claimed collateral after TP`, 'success');
                  }
                } catch (claimErr) {
                  console.log('Auto-claim after TP failed:', claimErr.message);
                }
              }, 2000); // Wait 2 seconds for blockchain to settle
            }

            fetchBotStatus(); // Refresh positions
          } catch (e) {
            console.error('Auto-close TP failed:', e);
          }
          return; // Process one at a time
        }
      }

      // Check Stop Loss
      if (pos.sl > 0) {
        const slPrice = isLong
          ? pos.openPrice * (1 - pos.sl / 100 / (pos.leverage || 1))
          : pos.openPrice * (1 + pos.sl / 100 / (pos.leverage || 1));

        const slHit = isLong ? currentPrice <= slPrice : currentPrice >= slPrice;

        if (slHit) {
          const pnlUsd = pos.collateral * (pnlPercent / 100);
          console.log(`🛑 SL HIT for ${pos.asset}! Current: $${currentPrice}, SL: $${slPrice}, PnL: ${pnlPercent.toFixed(2)}% ($${pnlUsd.toFixed(2)})`);
          showToast(`🛑 SL HIT! Closing ${pos.asset} @ ${pnlPercent.toFixed(1)}%`, 'error');

          // Auto-close the position
          try {
            const closeResult = await apiCall('CLOSE_TRADE', { tradeIndex: pos.index });
            setBotActivity(prev => [{
              type: 'SL_HIT',
              message: `🛑 SL: ${pos.asset} closed @ ${pnlPercent.toFixed(1)}% ($${pnlUsd.toFixed(2)})`,
              time: new Date().toLocaleTimeString(),
            }, ...prev].slice(0, 20));

            // ===== UPDATE P&L STATS FOR SL HIT =====
            if (closeResult?.success !== false) {
              setTradeStats(prev => ({
                ...prev,
                losses: prev.losses + 1,
                totalPnl: prev.totalPnl + pnlUsd, // pnlUsd is negative
              }));
              setClosedTrades(prev => [{
                asset: pos.asset,
                direction: pos.long ? 'LONG' : 'SHORT',
                pnlPercent: pnlPercent,
                pnlUsd: pnlUsd,
                leverage: pos.leverage,
                collateral: pos.collateral,
                closedAt: new Date().toISOString(),
                closeType: 'SL_HIT',
              }, ...prev].slice(0, 50));
              console.log(`📊 P&L Updated: $${pnlUsd.toFixed(2)} (SL HIT)`);
            }

            fetchBotStatus(); // Refresh positions
          } catch (e) {
            console.error('Auto-close SL failed:', e);
          }
          return; // Process one at a time
        }
      }

      // Check for liquidation risk (90% loss)
      if (pnlPercent <= -90) {
        console.log(`⚠️ LIQUIDATION RISK for ${pos.asset}! PnL: ${pnlPercent.toFixed(2)}%`);
        showToast(`⚠️ ${pos.asset} near liquidation! ${pnlPercent.toFixed(1)}%`, 'error');
      }
    }
  };

  // Initial load + auto-refresh - AGGRESSIVE for real-time P&L
  useEffect(() => {
    fetchBotStatus();
    fetchPrices();
    // Refresh prices every 3 seconds for accurate P&L display
    const priceInterval = setInterval(fetchPrices, 3000);
    // Refresh positions every 10 seconds
    const statusInterval = setInterval(fetchBotStatus, 10000);
    // Check TP/SL every 2 seconds for faster execution
    const tpSlInterval = setInterval(checkAutoClose, 2000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(priceInterval);
      clearInterval(tpSlInterval);
    };
  }, []);

  // Extra fast refresh when viewing positions tab
  useEffect(() => {
    if (activeTab === 'positions' && positions.length > 0) {
      const fastPriceInterval = setInterval(fetchPrices, 2000);
      return () => clearInterval(fastPriceInterval);
    }
  }, [activeTab, positions.length]);

  // Run auto-close check whenever prices or positions update
  useEffect(() => {
    if (positions.length > 0 && Object.keys(livePrices).length > 0) {
      checkAutoClose();
    }
  }, [livePrices, positions]);

  // Fetch Q7 signal when asset changes or on initial load
  useEffect(() => {
    if (isExpanded && activeTab === 'trade') {
      fetchQ7Signal(selectedAsset);
      // Refresh Q7 signal every 30 seconds
      const q7Interval = setInterval(() => fetchQ7Signal(selectedAsset), 30000);
      return () => clearInterval(q7Interval);
    }
  }, [selectedAsset, isExpanded, activeTab]);

  // ==================== COLLAPSED STATE ====================
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          position: 'fixed',
          bottom: isMobile ? '75px' : '100px',
          left: isMobile ? 'auto' : '20px',
          right: isMobile ? '12px' : 'auto',
          width: isMobile ? '48px' : '56px',
          height: isMobile ? '48px' : '56px',
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
      bottom: isMobile ? '60px' : '20px',
      left: isMobile ? '8px' : '20px',
      right: isMobile ? '8px' : 'auto',
      width: isMobile ? 'auto' : '400px',
      maxWidth: '420px',
      maxHeight: isMobile ? '75vh' : '90vh',
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
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>Q7 Auto Trade v5.0</div>
              <div style={{ fontSize: '9px', color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00ff88', animation: 'pulse 2s infinite' }} />
                <ArbitrumLogo size={10} />
                <span>gTrade v10</span>
                <span style={{ color: priceSource.includes('gtrade') || priceSource === 'mixed-api' ? '#00ff88' : '#ff9900' }}>
                  • {priceSource.includes('gtrade') ? '🎯 Live' : priceSource === 'mixed-api' ? '📡 API' : '⚠️ Stale'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Collateral Deployed Badge */}
            {collateralDeployed > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.3), rgba(75, 0, 130, 0.2))',
                border: '1px solid rgba(138, 43, 226, 0.5)',
                borderRadius: '8px',
                padding: '4px 8px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#8a2be2', fontWeight: 700, fontSize: '12px' }}>
                  ${collateralDeployed.toFixed(2)}
                </div>
                <div style={{ color: '#666', fontSize: '7px' }}>DEPLOYED</div>
              </div>
            )}
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
          { id: 'positions', label: `💼 ${userPositions.length || positions.length}` },
          { id: 'stats', label: '📊 P&L' },
          { id: 'q7live', label: '🔴 Q7' },
          { id: 'polymarket', label: '🎰 Poly' },
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
            {/* Asset Selection with price source indicator */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              {Object.keys(ASSETS).map((key) => {
                const assetInfo = ASSETS[key];
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedAsset(key);
                      // Reset leverage to appropriate default when switching asset types
                      if (assetInfo.type === 'commodity' && leverage > 25) {
                        setLeverage(25);
                      }
                    }}
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
                      gap: '2px',
                      position: 'relative',
                    }}
                  >
                    <img src={ASSET_IMAGES[key]} alt={key} style={{ width: '18px', height: '18px', borderRadius: '4px' }} onError={(e) => e.target.style.display = 'none'} />
                    <span style={{ color: selectedAsset === key ? '#FFD700' : '#888', fontSize: '9px', fontWeight: 600 }}>{key}</span>
                    {/* Price source indicator */}
                    <span style={{
                      fontSize: '6px',
                      color: '#00ff88',
                      opacity: 0.8,
                    }}>
                      🎯
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ===== INSTITUTIONAL CHART ===== */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,0,0,0.5), rgba(20,20,40,0.5))',
              borderRadius: '10px',
              overflow: 'hidden',
              marginBottom: '10px',
              border: '1px solid rgba(255,215,0,0.15)',
              position: 'relative',
            }}>
              {/* Chart Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(0,0,0,0.3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '12px' }}>
                    {selectedAsset}/USD
                  </span>
                  <span style={{ color: '#888', fontSize: '9px' }}>15m</span>
                  {chartLoading && <span style={{ color: '#FFD700', fontSize: '8px' }}>⟳</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: candleData.length > 1 && candleData[candleData.length-1]?.close >= candleData[candleData.length-2]?.close
                      ? '#00ff88' : '#ff4444',
                  }}>
                    ${livePrices[selectedAsset]?.toLocaleString(undefined, {
                      minimumFractionDigits: selectedAsset === 'BTC' ? 2 : selectedAsset === 'ETH' ? 2 : 2,
                      maximumFractionDigits: selectedAsset === 'BTC' ? 2 : selectedAsset === 'ETH' ? 2 : 2
                    }) || '---'}
                  </span>
                  {candleData.length > 1 && (
                    <span style={{
                      fontSize: '9px',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      background: candleData[candleData.length-1]?.close >= candleData[candleData.length-2]?.close
                        ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)',
                      color: candleData[candleData.length-1]?.close >= candleData[candleData.length-2]?.close
                        ? '#00ff88' : '#ff4444',
                    }}>
                      {candleData[candleData.length-1]?.close >= candleData[candleData.length-2]?.close ? '▲' : '▼'}
                      {(Math.abs(((Number(candleData[candleData.length-1]?.close) - Number(candleData[candleData.length-2]?.close)) / Number(candleData[candleData.length-2]?.close)) * 100) || 0).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Chart Container */}
              <div
                ref={chartContainerRef}
                style={{
                  width: '100%',
                  height: '200px',
                  background: 'transparent',
                }}
              />

              {/* Chart Footer - OHLC */}
              {candleData.length > 0 && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 10px',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                  background: 'rgba(0,0,0,0.3)',
                  fontSize: '8px',
                  color: '#666',
                }}>
                  <span>O: <span style={{ color: '#aaa' }}>${Number(candleData[candleData.length-1]?.open || 0).toFixed(2)}</span></span>
                  <span>H: <span style={{ color: '#00ff88' }}>${Number(candleData[candleData.length-1]?.high || 0).toFixed(2)}</span></span>
                  <span>L: <span style={{ color: '#ff4444' }}>${Number(candleData[candleData.length-1]?.low || 0).toFixed(2)}</span></span>
                  <span>C: <span style={{ color: '#FFD700' }}>${Number(candleData[candleData.length-1]?.close || 0).toFixed(2)}</span></span>
                </div>
              )}

              {/* EMA Legend */}
              <div style={{
                position: 'absolute',
                top: '32px',
                left: '10px',
                fontSize: '8px',
                color: '#FFD700',
                opacity: 0.7,
              }}>
                EMA 21
              </div>
            </div>

            {/* Price Display - Live from Lambda/gTrade */}
            <div style={{
              background: priceSource.includes('gtrade') ? 'rgba(0, 255, 136, 0.08)' : 'rgba(255, 150, 0, 0.08)',
              borderRadius: '8px',
              padding: '8px',
              marginBottom: '10px',
              border: `1px solid ${priceSource.includes('gtrade') ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 150, 0, 0.2)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{
                    fontSize: '10px',
                    color: priceSource.includes('gtrade') ? '#00ff88' : '#ff9900',
                    fontWeight: 600
                  }}>
                    {priceSource.includes('gtrade') ? '🎯 LIVE' : priceSource === 'mixed-api' ? '📡 API' : '⚠️ STALE'}
                  </span>
                  {priceUpdateTime && (
                    <span style={{ fontSize: '8px', color: '#555' }}>
                      {Math.round((Date.now() - priceUpdateTime.getTime()) / 1000)}s ago
                    </span>
                  )}
                </div>
                <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '16px' }}>
                  ${livePrices[selectedAsset]?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', color: '#666' }}>
                  {priceSource.includes('gtrade') ? 'gTrade Oracle Price' : 'Market Price'}
                </span>
                <span style={{
                  fontSize: '8px',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: priceSource.includes('gtrade') ? 'rgba(0,255,136,0.2)' : 'rgba(255,150,0,0.2)',
                  color: priceSource.includes('gtrade') ? '#00ff88' : '#ff9900',
                }}>
                  {priceSource.includes('gtrade') ? '✓ Synced with gTrade' : 'May differ from gTrade'}
                </span>
              </div>
            </div>

            {/* ===== Q7 SIGNAL DISPLAY ===== */}
            <div style={{
              background: q7Signal?.score >= 20
                ? `linear-gradient(135deg, ${q7Signal?.direction === 'LONG' ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)'}, rgba(138,43,226,0.1))`
                : 'rgba(50,50,70,0.3)',
              borderRadius: '8px',
              padding: '8px',
              marginBottom: '10px',
              border: `1px solid ${q7Signal?.score >= 20 ? (q7Signal?.direction === 'LONG' ? 'rgba(0,255,136,0.4)' : 'rgba(255,68,68,0.4)') : 'rgba(138,43,226,0.2)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#8a2be2', fontWeight: 600 }}>🧠 Q7 SIGNAL</span>
                  {q7Loading && <span style={{ fontSize: '8px', color: '#888' }}>⏳</span>}
                </div>
                {q7Signal && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: q7Signal.score >= 20 ? (q7Signal.direction === 'LONG' ? '#00ff88' : '#ff4444') : '#888',
                    }}>
                      {q7Signal.direction === 'LONG' ? '📈' : q7Signal.direction === 'SHORT' ? '📉' : '➖'} {q7Signal.score}
                    </span>
                    <span style={{
                      fontSize: '8px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: q7Signal.score >= 20 ? 'rgba(138,43,226,0.3)' : 'rgba(100,100,100,0.3)',
                      color: q7Signal.score >= 20 ? '#8a2be2' : '#888',
                    }}>
                      {q7Signal.score >= 20 ? '✓ READY' : 'WAIT'}
                    </span>
                  </div>
                )}
              </div>

              {q7Signal && (
                <>
                  {/* Engine Scores */}
                  <div style={{ display: 'flex', gap: '3px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    {Object.entries(q7Signal.engines || {}).map(([engine, data]) => (
                      <span key={engine} style={{
                        fontSize: '7px',
                        padding: '2px 4px',
                        borderRadius: '3px',
                        background: data.score > 0 ? 'rgba(0,255,136,0.15)' : 'rgba(100,100,100,0.2)',
                        color: data.score > 0 ? '#00ff88' : '#666',
                        border: `1px solid ${data.score > 0 ? 'rgba(0,255,136,0.3)' : 'transparent'}`,
                      }}>
                        {engine}: {data.score || 0}
                      </span>
                    ))}
                  </div>

                  {/* RSI + Confluence */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#888' }}>
                    <span>RSI: {q7Signal.indicators?.rsi || '--'} (Q7: {asset.rsi?.oversold}/{asset.rsi?.overbought})</span>
                    <span>Confluence: {q7Signal.confluence || 0}%</span>
                  </div>
                </>
              )}

              {!q7Signal && !q7Loading && (
                <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', padding: '4px' }}>
                  Analyzing {selectedAsset}...
                </div>
              )}
            </div>

            {/* ===== Q7 SCALP MODE SELECTOR ===== */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15), rgba(255, 140, 0, 0.1))',
              borderRadius: '8px',
              padding: '8px',
              marginBottom: '10px',
              border: '1px solid rgba(138, 43, 226, 0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#8a2be2', fontSize: '10px', fontWeight: 600 }}>⚡ Q7 SCALP MODE (1.5:1 R:R)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {momentum.direction !== 'neutral' && (
                    <span style={{
                      fontSize: '8px',
                      padding: '2px 4px',
                      borderRadius: '3px',
                      background: momentum.direction === 'bullish' ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)',
                      color: momentum.direction === 'bullish' ? '#00ff88' : '#ff4444',
                    }}>
                      {momentum.direction === 'bullish' ? '📈' : '📉'} {momentum.change?.toFixed(3)}%
                    </span>
                  )}
                  <span style={{ color: '#888', fontSize: '8px' }}>
                    {tradeStats.successes}/{tradeStats.attempts} trades
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {Object.entries(SCALP_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setScalpMode(key);
                      setTakeProfit(preset.tp.toString());
                      setStopLoss(preset.sl.toString());
                      // Adjust leverage for asset type
                      const maxLev = ASSETS[selectedAsset].maxLev;
                      setLeverage(Math.min(preset.leverage, maxLev));
                    }}
                    style={{
                      flex: 1,
                      padding: '6px 4px',
                      borderRadius: '4px',
                      border: scalpMode === key ? '2px solid #ff8c00' : '1px solid rgba(255,255,255,0.1)',
                      background: scalpMode === key ? 'rgba(255, 140, 0, 0.2)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: '8px',
                    }}
                  >
                    <div style={{ color: scalpMode === key ? '#ff8c00' : '#888', fontWeight: 600 }}>{preset.name}</div>
                    <div style={{ color: '#666', fontSize: '7px' }}>TP:{preset.tp}% SL:{preset.sl}%</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ===== QUICK SCALP BUTTONS ===== */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
              <button
                onClick={() => quickScalpTrade('LONG')}
                disabled={loading || isRetrying}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: '2px solid #00ff88',
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 200, 100, 0.1))',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '14px' }}>📈 LONG</div>
                <div style={{ color: '#00cc6a', fontSize: '9px' }}>Quick {SCALP_PRESETS[scalpMode].name}</div>
              </button>
              <button
                onClick={() => quickScalpTrade('SHORT')}
                disabled={loading || isRetrying}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: '2px solid #ff4444',
                  background: 'linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(200, 50, 50, 0.1))',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                <div style={{ color: '#ff4444', fontWeight: 700, fontSize: '14px' }}>📉 SHORT</div>
                <div style={{ color: '#cc3333', fontSize: '9px' }}>Quick {SCALP_PRESETS[scalpMode].name}</div>
              </button>
            </div>

            {/* Retry Status Indicator */}
            {isRetrying && (
              <div style={{
                background: 'rgba(255, 140, 0, 0.15)',
                borderRadius: '6px',
                padding: '8px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}>
                <span style={{ animation: 'pulse 1s infinite' }}>🔄</span>
                <span style={{ color: '#ff8c00', fontSize: '11px', fontWeight: 600 }}>
                  Retrying trade... ({retryCount}/{AUTO_TRADE_CONFIG.maxRetries})
                </span>
              </div>
            )}

            {/* Direction (smaller, secondary option) */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <button
                onClick={() => setDirection('LONG')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: direction === 'LONG' ? '2px solid #00ff88' : '1px solid rgba(0, 255, 136, 0.2)',
                  background: direction === 'LONG' ? 'rgba(0, 255, 136, 0.15)' : 'transparent',
                  color: direction === 'LONG' ? '#00ff88' : '#555',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '10px',
                }}
              >📈 LONG</button>
              <button
                onClick={() => setDirection('SHORT')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: direction === 'SHORT' ? '2px solid #ff4444' : '1px solid rgba(255, 68, 68, 0.2)',
                  background: direction === 'SHORT' ? 'rgba(255, 68, 68, 0.15)' : 'transparent',
                  color: direction === 'SHORT' ? '#ff4444' : '#555',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '10px',
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
                {['10', '25', '50', '100'].map((amt) => (
                  <button key={amt} onClick={() => setCollateral(amt)} style={{ flex: 1, padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '9px' }}>${amt}</button>
                ))}
              </div>
            </div>

            {/* Leverage - Asset-specific presets (crypto vs commodity) */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '10px' }}>
                  Leverage {asset.type === 'commodity' ? '(Commodity Max 25x)' : ''}
                </span>
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
                {LEVERAGE_PRESETS[asset.type].map((l) => (
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

            {/* Submit - Manual Trade with Current Settings */}
            <button
              onClick={() => openTrade(0)}
              disabled={loading || isRetrying}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: isRetrying
                  ? 'linear-gradient(135deg, #ff8c00, #cc6600)'
                  : direction === 'LONG'
                    ? 'linear-gradient(135deg, #00ff88, #00cc6a)'
                    : 'linear-gradient(135deg, #ff4444, #cc0000)',
                color: direction === 'LONG' && !isRetrying ? '#000' : '#fff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: (loading || isRetrying) ? 'not-allowed' : 'pointer',
                opacity: (loading || isRetrying) ? 0.7 : 1,
              }}
            >
              {isRetrying ? `🔄 Retrying (${retryCount}/${AUTO_TRADE_CONFIG.maxRetries})...` :
               loading ? '⏳ Opening...' : `⚡ ${direction} ${selectedAsset} @ ${displayLeverage}x`}
            </button>
          </>
        )}

        {/* ----- POSITIONS TAB ----- */}
        {activeTab === 'positions' && (
          <>
            {/* Summary Header */}
            <div style={{
              background: totalUnrealizedPnl >= 0 ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '12px',
              border: `1px solid ${totalUnrealizedPnl >= 0 ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,68,0.3)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#888', fontSize: '10px' }}>Unrealized P&L</div>
                  <div style={{
                    color: totalUnrealizedPnl >= 0 ? '#00ff88' : '#ff4444',
                    fontSize: '20px',
                    fontWeight: 700,
                  }}>
                    {totalUnrealizedPnl >= 0 ? '+' : ''}${totalUnrealizedPnl.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#888', fontSize: '10px' }}>Positions</div>
                  <div style={{ color: '#FFD700', fontSize: '18px', fontWeight: 700 }}>{userPositions.length}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#888', fontSize: '10px' }}>
                {connectedAddress ? `gTrade Positions (${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)})` : 'Connect Wallet'}
              </span>
              <button onClick={() => fetchUserPositions(connectedAddress)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,215,0,0.3)', background: 'transparent', color: '#FFD700', cursor: 'pointer', fontSize: '9px' }}>
                {userPositionsLoading ? '⏳' : '🔄'} Refresh
              </button>
            </div>

            {userPositions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#666' }}>
                <div style={{ fontSize: '32px', marginBottom: '10px' }}>{userPositionsLoading ? '⏳' : '📭'}</div>
                <div style={{ fontSize: '12px' }}>{userPositionsLoading ? 'Loading positions...' : 'No open positions'}</div>
                <div style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
                  {connectedAddress ? 'Open a trade on gTrade to see it here' : 'Connect your wallet to see positions'}
                </div>
              </div>
            ) : (
              userPositions.map((pos, idx) => {
                const isLong = pos.long === true;
                const currentPrice = pos.currentPrice || livePrices[pos.asset];
                return (
                  <div key={idx} style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    padding: '10px',
                    marginBottom: '8px',
                    border: `1px solid ${pos.pnlUsd >= 0 ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{isLong ? '📈' : '📉'}</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>{pos.asset}</span>
                        <span style={{ color: isLong ? '#00ff88' : '#ff4444', fontSize: '10px', fontWeight: 600 }}>{isLong ? 'LONG' : 'SHORT'}</span>
                      </div>
                      <span style={{ color: '#FFD700', fontSize: '11px', fontWeight: 600 }}>{Number(pos.leverage || 0).toFixed(1)}x</span>
                    </div>

                    {/* Price comparison - MATCHES gTRADE UI */}
                    <div style={{
                      background: 'rgba(255,215,0,0.08)',
                      borderRadius: '6px',
                      padding: '6px',
                      marginBottom: '6px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                        <span style={{ color: '#888' }}>Open Price</span>
                        <span style={{ color: '#fff', fontWeight: 600 }}>${Number(pos.openPrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: '#888' }}>Current Price</span>
                        <span style={{ color: currentPrice > pos.openPrice ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
                          ${Number(currentPrice || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', marginBottom: '8px' }}>
                      <div>
                        <span style={{ color: '#666' }}>Collateral: </span>
                        <span style={{ color: '#fff' }}>${Number(pos.collateral || 0).toFixed(2)} USDC</span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>Position: </span>
                        <span style={{ color: '#FFD700' }}>${Number((pos.collateral || 0) * (pos.leverage || 1)).toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#00ff88' }}>TP: </span>
                        <span style={{ color: '#00ff88' }}>${pos.tp > 0 ? Number(pos.tp).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'None'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#ff4444' }}>SL: </span>
                        <span style={{ color: '#ff4444' }}>${pos.sl > 0 ? Number(pos.sl).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'None'}</span>
                      </div>
                    </div>

                    {/* P&L Display - MATCHES gTRADE FORMAT */}
                    <div style={{
                      background: pos.pnlUsd >= 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)',
                      borderRadius: '6px',
                      padding: '8px',
                      marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '10px' }}>Unrealized PnL</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: pos.pnlUsd >= 0 ? '#00ff88' : '#ff4444', fontWeight: 700, fontSize: '14px' }}>
                            {pos.pnlUsd >= 0 ? '+' : ''}{Number(pos.pnlUsd || 0).toFixed(2)} USDC
                          </div>
                          <div style={{ color: pos.pnlPct >= 0 ? '#00ff88' : '#ff4444', fontSize: '10px', opacity: 0.8 }}>
                            ({pos.pnlPct >= 0 ? '+' : ''}{Number(pos.pnlPct || 0).toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => closeTrade(pos.index, pos)}
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

        {/* ----- STATS/P&L TAB ----- */}
        {activeTab === 'stats' && (
          <>
            {/* SHAREABLE MANDALORIAN P&L CARD */}
            <div ref={pnlCardRef} style={{
              background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
              borderRadius: '16px',
              padding: '16px',
              marginBottom: '12px',
              border: '2px solid rgba(255, 215, 0, 0.4)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(255, 215, 0, 0.15)',
            }}>
              {/* Mandalorian-style corner accents */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '40px', borderTop: '3px solid #FFD700', borderLeft: '3px solid #FFD700', borderRadius: '12px 0 0 0' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '40px', borderTop: '3px solid #FFD700', borderRight: '3px solid #FFD700', borderRadius: '0 12px 0 0' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '40px', height: '40px', borderBottom: '3px solid #FFD700', borderLeft: '3px solid #FFD700', borderRadius: '0 0 0 12px' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '40px', height: '40px', borderBottom: '3px solid #FFD700', borderRight: '3px solid #FFD700', borderRadius: '0 0 12px 0' }} />

              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ArbitrumLogo size={28} />
                  <div>
                    <div style={{ color: '#FFD700', fontWeight: 800, fontSize: '15px', letterSpacing: '0.5px' }}>Q7 ARBITRUM AUTO-PERP</div>
                    <div style={{ color: '#888', fontSize: '10px' }}>gTrade • DTGC.io • D-RAM v5.2.6</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    {collateralDeployed > 0 && (
                      <div style={{ background: 'rgba(138, 43, 226, 0.2)', padding: '4px 8px', borderRadius: '6px' }}>
                        <div style={{ color: '#8a2be2', fontWeight: 700, fontSize: '12px' }}>${collateralDeployed.toFixed(2)}</div>
                        <div style={{ color: '#666', fontSize: '7px' }}>DEPLOYED</div>
                      </div>
                    )}
                    <div>
                      <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '18px' }}>${balance?.toFixed(2) || '---'}</div>
                      <div style={{ color: '#888', fontSize: '8px' }}>AVAILABLE</div>
                    </div>
                  </div>
                  {startingBalance && (
                    <div style={{ color: '#555', fontSize: '8px', marginTop: '2px' }}>
                      Started: ${startingBalance.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>

              {/* 📸 SNAPSHOT LIVE TRADES P&L */}
              {userPositions.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 150, 255, 0.15), rgba(138, 43, 226, 0.1))',
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '12px',
                  border: '2px solid rgba(0, 150, 255, 0.4)',
                }}>
                  <div style={{ color: '#0096ff', fontSize: '11px', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>
                    📸 SNAPSHOT LIVE TRADES P&L
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ color: '#888', fontSize: '10px' }}>{userPositions.length} open positions</div>
                    <div style={{
                      color: totalUnrealizedPnl >= 0 ? '#00ff88' : '#ff4444',
                      fontWeight: 800,
                      fontSize: '20px',
                    }}>
                      {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)} USDC
                    </div>
                  </div>
                  {(() => {
                    const live = getLivePositionStats();
                    return (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <div style={{ flex: 1, background: 'rgba(0, 255, 136, 0.2)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                          <div style={{ color: '#00ff88', fontSize: '16px', fontWeight: 700 }}>{live.wins}</div>
                          <div style={{ color: '#00ff88', fontSize: '8px' }}>WINNING</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(255, 68, 68, 0.2)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                          <div style={{ color: '#ff4444', fontSize: '16px', fontWeight: 700 }}>{live.losses}</div>
                          <div style={{ color: '#ff4444', fontSize: '8px' }}>LOSING</div>
                        </div>
                        <div style={{ flex: 1, background: 'rgba(138, 43, 226, 0.2)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                          <div style={{ color: '#8a2be2', fontSize: '16px', fontWeight: 700 }}>{live.winRate}%</div>
                          <div style={{ color: '#8a2be2', fontSize: '8px' }}>RATE</div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 📜 CLOSED TRADES P&L (Realized) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 140, 0, 0.05))',
                borderRadius: '10px',
                padding: '12px',
                marginBottom: '12px',
                border: '2px solid rgba(255, 215, 0, 0.3)',
              }}>
                <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 700, marginBottom: '8px', letterSpacing: '0.5px' }}>
                  📜 CLOSED TRADES P&L (Realized)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#888', fontSize: '10px' }}>{historicalTrades.length} trades closed</div>
                  <div style={{
                    color: (realPnL.total || 0) >= 0 ? '#00ff88' : '#ff4444',
                    fontWeight: 800,
                    fontSize: '20px',
                  }}>
                    {(realPnL.total || 0) >= 0 ? '+' : ''}{(realPnL.total || 0).toFixed(2)} USDC
                  </div>
                </div>
                {historicalTrades.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <div style={{ flex: 1, background: 'rgba(0, 255, 136, 0.2)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                      <div style={{ color: '#00ff88', fontSize: '16px', fontWeight: 700 }}>{realPnL.wins || 0}</div>
                      <div style={{ color: '#00ff88', fontSize: '8px' }}>WINS</div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(255, 68, 68, 0.2)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                      <div style={{ color: '#ff4444', fontSize: '16px', fontWeight: 700 }}>{realPnL.losses || 0}</div>
                      <div style={{ color: '#ff4444', fontSize: '8px' }}>LOSSES</div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(138, 43, 226, 0.2)', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                      <div style={{ color: '#8a2be2', fontSize: '16px', fontWeight: 700 }}>
                        {(realPnL.wins + realPnL.losses) > 0 ? Math.round((realPnL.wins / (realPnL.wins + realPnL.losses)) * 100) : 0}%
                      </div>
                      <div style={{ color: '#8a2be2', fontSize: '8px' }}>RATE</div>
                    </div>
                  </div>
                )}
                {historicalTrades.length === 0 && (
                  <div style={{ color: '#555', fontSize: '9px', textAlign: 'center', marginTop: '4px' }}>
                    No closed trades yet
                  </div>
                )}
              </div>

              {/* 💎 COMBINED TOTAL P&L (Live + Closed) */}
              {(() => {
                const stats = getCombinedStats();
                const displayPnL = stats.total;
                const liveCount = userPositions.length;
                const closedCount = historicalTrades.length;
                return (
                  <div style={{
                    background: displayPnL >= 0
                      ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 200, 100, 0.1))'
                      : 'linear-gradient(135deg, rgba(255, 68, 68, 0.2), rgba(200, 50, 50, 0.1))',
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    border: `3px solid ${displayPnL >= 0 ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 68, 68, 0.5)'}`,
                    marginBottom: '12px',
                    boxShadow: displayPnL >= 0 ? '0 4px 20px rgba(0, 255, 136, 0.2)' : '0 4px 20px rgba(255, 68, 68, 0.2)',
                  }}>
                    <div style={{ color: '#FFD700', fontSize: '11px', marginBottom: '6px', fontWeight: 700, letterSpacing: '1px' }}>
                      💎 COMBINED TOTAL P&L
                    </div>
                    <div style={{
                      color: displayPnL >= 0 ? '#00ff88' : '#ff4444',
                      fontSize: '40px',
                      fontWeight: 900,
                      textShadow: displayPnL >= 0 ? '0 0 30px rgba(0,255,136,0.6)' : '0 0 30px rgba(255,68,68,0.6)',
                    }}>
                      {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(2)} USDC
                    </div>
                    <div style={{ color: '#666', fontSize: '9px', marginTop: '6px' }}>
                      {liveCount > 0 && <span style={{ color: '#0096ff' }}>{liveCount} live</span>}
                      {liveCount > 0 && closedCount > 0 && ' + '}
                      {closedCount > 0 && <span style={{ color: '#FFD700' }}>{closedCount} closed</span>}
                      {liveCount === 0 && closedCount === 0 && 'No trades yet'}
                      <span style={{ color: '#555' }}> • Q7 D-RAM</span>
                    </div>
                  </div>
                );
              })()}

              {/* Time Range Slider */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '12px',
              }}>
                <div style={{ color: '#888', fontSize: '9px', marginBottom: '8px', textAlign: 'center' }}>📅 P&L TIME RANGE</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                  {['24h', '48h', '72h', 'all'].map(range => (
                    <button
                      key={range}
                      onClick={() => setPnlTimeRange(range)}
                      style={{
                        flex: 1,
                        padding: '6px 10px',
                        background: pnlTimeRange === range ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                        border: `1px solid ${pnlTimeRange === range ? '#FFD700' : '#444'}`,
                        borderRadius: '6px',
                        color: pnlTimeRange === range ? '#FFD700' : '#888',
                        fontSize: '10px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
                {pnlTimeRange !== 'all' && (
                  <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <div style={{ color: getFilteredPnL().total >= 0 ? '#00ff88' : '#ff4444', fontSize: '14px', fontWeight: 700 }}>
                      {getFilteredPnL().total >= 0 ? '+' : ''}{getFilteredPnL().total.toFixed(2)} USDC
                    </div>
                    <div style={{ color: '#666', fontSize: '9px' }}>
                      {getFilteredPnL().wins}W / {getFilteredPnL().losses}L in last {pnlTimeRange}
                    </div>
                  </div>
                )}
              </div>

              {/* Forecast Section */}
              {getForecast() && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 150, 255, 0.1), rgba(138, 43, 226, 0.1))',
                  borderRadius: '8px',
                  padding: '10px',
                  marginBottom: '12px',
                  border: '1px solid rgba(0, 150, 255, 0.3)',
                }}>
                  <div style={{ color: '#0096ff', fontSize: '10px', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                    📈 FORECAST (based on {pnlTimeRange} data)
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#0096ff', fontSize: '14px', fontWeight: 700 }}>{getForecast().winRate}%</div>
                      <div style={{ color: '#666', fontSize: '8px' }}>Win Rate</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#FFD700', fontSize: '14px', fontWeight: 700 }}>${getForecast().projected24h}</div>
                      <div style={{ color: '#666', fontSize: '8px' }}>24h Proj</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ color: '#00ff88', fontSize: '14px', fontWeight: 700 }}>${getForecast().projected7d}</div>
                      <div style={{ color: '#666', fontSize: '8px' }}>7d Proj</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '6px' }}>
                    <div style={{ color: '#888', fontSize: '8px' }}>
                      ~{getForecast().tradesPerDay} trades/day • ${getForecast().avgPnlPerTrade} avg/trade
                    </div>
                  </div>
                </div>
              )}

              {/* Share Buttons Row */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <button
                  onClick={() => setShowShareCard(true)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: 'linear-gradient(135deg, #0096ff, #0066cc)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  📸 SNAPSHOT
                </button>
                <button
                  onClick={() => setShowRetrospectCard(true)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: 'linear-gradient(135deg, #FFD700, #ff8c00)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  📊 RETROSPECT
                </button>
                <a
                  href="/Metals_Arbitrum_PulseChain_Whitepaper.pdf"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    background: 'linear-gradient(135deg, #B8860B, #8B6914)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '11px',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  📑 WHITEPAPER
                </a>
              </div>

              {/* Wallet Address - Shows connected wallet */}
              <div style={{ textAlign: 'center', color: '#555', fontSize: '8px' }}>
                {userAddress ? `${userAddress.slice(0, 10)}...${userAddress.slice(-8)}` : 'Connect Wallet'}
              </div>
            </div>

            {/* 🔄 5% FLYWHEEL TO PULSECHAIN */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 0, 128, 0.1), rgba(138, 43, 226, 0.15))',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '12px',
              border: '2px solid rgba(255, 0, 128, 0.4)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ color: '#ff0080', fontWeight: 700, fontSize: '12px' }}>🔄 5% FLYWHEEL → PLS</div>
                <div style={{
                  background: 'rgba(0, 255, 136, 0.2)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  color: '#00ff88',
                  fontSize: '10px',
                  fontWeight: 600,
                }}>
                  ACTIVE
                </div>
              </div>

              {/* Flywheel Stats */}
              {(() => {
                const projection = getFlywheelProjection();
                const liveStats = getLivePositionStats();
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '10px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ color: '#00ff88', fontSize: '16px', fontWeight: 700 }}>
                          ${projection.totalAllocated.toFixed(2)}
                        </div>
                        <div style={{ color: '#888', fontSize: '8px' }}>TOTAL ALLOCATED</div>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                        <div style={{ color: '#ff0080', fontSize: '16px', fontWeight: 700 }}>
                          ${projection.projectedFlywheel.toFixed(2)}
                        </div>
                        <div style={{ color: '#888', fontSize: '8px' }}>PENDING (UNREALIZED)</div>
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#888', fontSize: '9px' }}>Winning Trades (Closed)</span>
                        <span style={{ color: '#00ff88', fontSize: '10px', fontWeight: 600 }}>{flywheelStats.totalWins}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#888', fontSize: '9px' }}>Total Win Amount</span>
                        <span style={{ color: '#00ff88', fontSize: '10px', fontWeight: 600 }}>${flywheelStats.totalWinAmount.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: '#888', fontSize: '9px' }}>Winning Positions (Live)</span>
                        <span style={{ color: '#0096ff', fontSize: '10px', fontWeight: 600 }}>{projection.winningPositions}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <span style={{ color: '#ff0080', fontSize: '9px', fontWeight: 600 }}>Est. Total to PLS</span>
                        <span style={{ color: '#ff0080', fontSize: '11px', fontWeight: 700 }}>${projection.totalWithProjected.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Growth Engine Wallet */}
                    <div style={{ marginTop: '10px', textAlign: 'center' }}>
                      <div style={{ color: '#666', fontSize: '8px', marginBottom: '4px' }}>GROWTH ENGINE WALLET</div>
                      <div
                        onClick={() => navigator.clipboard.writeText(GROWTH_ENGINE_WALLET)}
                        style={{
                          color: '#ff0080',
                          fontSize: '8px',
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                        }}
                        title="Click to copy"
                      >
                        {GROWTH_ENGINE_WALLET.slice(0, 14)}...{GROWTH_ENGINE_WALLET.slice(-12)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* COPY TRADING SECTION */}
            <div style={{
              background: 'rgba(138, 43, 226, 0.1)',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '12px',
              border: '1px solid rgba(138, 43, 226, 0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ color: '#8a2be2', fontWeight: 700, fontSize: '12px' }}>🔄 COPY TRADING</div>
                <button
                  onClick={() => setCopyTradeEnabled(!copyTradeEnabled)}
                  style={{
                    padding: '4px 12px',
                    background: copyTradeEnabled ? 'rgba(0, 255, 136, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                    border: `1px solid ${copyTradeEnabled ? '#00ff88' : '#555'}`,
                    borderRadius: '6px',
                    color: copyTradeEnabled ? '#00ff88' : '#888',
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copyTradeEnabled ? '✓ ENABLED' : 'DISABLED'}
                </button>
              </div>

              <input
                type="text"
                placeholder="Enter Arbitrum wallet to mirror..."
                value={copyTradeWallet}
                onChange={(e) => setCopyTradeWallet(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(138, 43, 226, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '11px',
                  marginBottom: '10px',
                  boxSizing: 'border-box',
                }}
              />

              <button
                onClick={fetchCopyTradePositions}
                disabled={!copyTradeWallet || copyTradeWallet.length < 42}
                style={{
                  width: '100%',
                  padding: '10px',
                  background: copyTradeWallet.length >= 42 ? 'rgba(138, 43, 226, 0.4)' : 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(138, 43, 226, 0.5)',
                  borderRadius: '8px',
                  color: copyTradeWallet.length >= 42 ? '#fff' : '#555',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: copyTradeWallet.length >= 42 ? 'pointer' : 'not-allowed',
                  marginBottom: '8px',
                }}
              >
                📋 Load Positions to Mirror
              </button>

              {copyTradePositions.length > 0 && (
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '8px', marginTop: '8px' }}>
                  <div style={{ color: '#888', fontSize: '9px', marginBottom: '6px' }}>Positions to copy:</div>
                  {copyTradePositions.map((pos, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: '#fff', fontSize: '10px' }}>{pos.asset} {pos.direction}</span>
                      <span style={{ color: '#FFD700', fontSize: '10px' }}>{pos.leverage}x • ${pos.collateral.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ color: '#666', fontSize: '9px', marginTop: '8px', lineHeight: 1.4 }}>
                💡 Enter any Arbitrum wallet to view & mirror their gTrade positions. Auto-copy coming soon!
              </div>
            </div>

            {/* Trade History with Timestamps */}
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ color: '#FFD700', fontSize: '12px', fontWeight: 700 }}>📜 TRADE HISTORY</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ color: '#555', fontSize: '9px' }}>{historicalTrades.length || closedTrades.length} trades</span>
                  <button
                    onClick={() => userAddress && fetchHistoricalTrades(userAddress)}
                    disabled={historicalLoading || !userAddress}
                    style={{ background: 'rgba(255,215,0,0.2)', border: 'none', borderRadius: '4px', padding: '3px 8px', color: '#FFD700', fontSize: '9px', cursor: 'pointer' }}
                  >
                    {historicalLoading ? '⏳' : '🔄'}
                  </button>
                </div>
              </div>

              {(historicalTrades.length > 0 || closedTrades.length > 0) ? (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {(historicalTrades.length > 0 ? historicalTrades : closedTrades).slice(0, 15).map((trade, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px',
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '8px',
                      marginBottom: '6px',
                      border: `1px solid ${trade.pnlPercent >= 0 ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px' }}>{trade.direction === 'LONG' ? '📈' : '📉'}</span>
                        <div>
                          <div style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>{trade.asset}</div>
                          <div style={{ color: '#888', fontSize: '9px' }}>{trade.leverage?.toFixed(0)}x • {trade.closeType || 'CLOSED'}</div>
                          <div style={{ color: '#555', fontSize: '8px' }}>
                            {trade.timestamp ? new Date(trade.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '---'}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: trade.pnlPercent >= 0 ? '#00ff88' : '#ff4444', fontSize: '13px', fontWeight: 800 }}>
                          {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent?.toFixed(1)}%
                        </div>
                        <div style={{ color: trade.pnlUsd >= 0 ? '#00ff88' : '#ff4444', fontSize: '10px', fontWeight: 600 }}>
                          {trade.pnlUsd >= 0 ? '+' : ''}${trade.pnlUsd?.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#555', fontSize: '11px' }}>
                  {historicalLoading ? '⏳ Loading trade history...' : 'No closed trades yet'}
                </div>
              )}
            </div>

            {/* AUTO-TRADING SETUP GUIDE */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(255, 215, 0, 0.05))',
              borderRadius: '12px',
              padding: '14px',
              border: '1px solid rgba(0, 255, 136, 0.2)',
            }}>
              <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '12px', marginBottom: '10px' }}>⚡ AUTO-TRADING SETUP</div>
              <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.5, marginBottom: '10px' }}>
                1️⃣ Connect your Arbitrum wallet<br/>
                2️⃣ Deposit USDC to gTrade<br/>
                3️⃣ Go to "🤖 Bot" tab<br/>
                4️⃣ Select scalp preset & leverage<br/>
                5️⃣ Enable Auto-Trade switch<br/>
                6️⃣ Q7 D-RAM executes automatically!
              </div>
              <a
                href="https://gains.trade"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
                  color: '#000',
                  padding: '10px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                🚀 Open gTrade to Fund Wallet
              </a>
            </div>
          </>
        )}

        {/* ----- Q7 LIVE TRADES TAB ----- */}
        {activeTab === 'q7live' && (
          <>
            {!hasQ7Access ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 140, 0, 0.1))',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center',
                border: '1px solid rgba(255, 215, 0, 0.3)',
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
                <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>
                  DTGC Holder Access Required
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '16px' }}>
                  Hold {DTGC_MIN_REQUIRED}+ DTGC to view Q7 Dev Wallet live trades
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ color: '#888', fontSize: '10px', marginBottom: '4px' }}>Your DTGC Balance</div>
                  <div style={{ color: '#ff8c00', fontSize: '20px', fontWeight: 700 }}>
                    {dtgcBalance?.toFixed(2) || '0.00'} DTGC
                  </div>
                </div>
                <a href="https://pulsex.mypinata.cloud/ipfs/bafybeicakbywm4bqgprhgo74p6y6d4knphhxd2i2nhsxp4tnz7dkd3ywqq/#/?outputCurrency=0xD0676B28a457371D58d47E5247b439114e40Eb0F"
                   target="_blank" rel="noopener noreferrer"
                   style={{ display: 'inline-block', background: 'linear-gradient(135deg, #FFD700, #ff8c00)', color: '#000', padding: '10px 20px', borderRadius: '8px', fontWeight: 700, fontSize: '12px', textDecoration: 'none' }}>
                  🛒 Buy DTGC on PulseX
                </a>
              </div>
            ) : (
              <>
                {/* Q7 Live Status Header */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 0, 0, 0.2), rgba(255, 140, 0, 0.15))',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '12px',
                  border: '1px solid rgba(255, 0, 0, 0.3)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff0000', boxShadow: '0 0 10px #ff0000', animation: 'pulse 1s infinite' }} />
                      <span style={{ color: '#ff4444', fontSize: '12px', fontWeight: 700 }}>Q7 DEV WALLET LIVE</span>
                    </div>
                    <div style={{ background: 'rgba(0, 255, 136, 0.2)', padding: '3px 8px', borderRadius: '4px', fontSize: '9px', color: '#00ff88', fontWeight: 600 }}>
                      🔓 DTGC Access
                    </div>
                  </div>
                  <div style={{ color: '#888', fontSize: '9px', fontFamily: 'monospace' }}>
                    {Q7_DEV_WALLET.slice(0, 12)}...{Q7_DEV_WALLET.slice(-10)}
                  </div>
                </div>

                {/* Q7 Active Positions - fetched from gTrade API */}
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ color: '#888', fontSize: '10px', fontWeight: 600 }}>🔥 Q7 ACTIVE POSITIONS ({q7DevPositions.length})</div>
                    {q7DevLoading && <span style={{ color: '#FFD700', fontSize: '10px' }}>⏳</span>}
                    <div style={{ color: q7DevPnl >= 0 ? '#00ff88' : '#ff4444', fontSize: '11px', fontWeight: 700 }}>
                      {q7DevPnl >= 0 ? '+' : ''}${q7DevPnl.toFixed(2)}
                    </div>
                  </div>
                  {q7DevPositions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#555', fontSize: '10px' }}>
                      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{q7DevLoading ? '⏳' : '📊'}</div>
                      {q7DevLoading ? 'Loading Q7 positions...' : 'No active positions - Q7 analyzing markets...'}
                    </div>
                  ) : (
                    q7DevPositions.map((pos, idx) => (
                      <div key={idx} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginBottom: '6px',
                        border: `1px solid ${pos.pnlPct >= 0 ? 'rgba(0,255,136,0.3)' : 'rgba(255,68,68,0.3)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '16px' }}>{pos.long ? '📈' : '📉'}</span>
                          <div>
                            <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>{pos.asset}</div>
                            <div style={{ color: '#888', fontSize: '9px' }}>{pos.leverage?.toFixed(0)}x {pos.long ? 'LONG' : 'SHORT'} • ${pos.collateral?.toFixed(2)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: pos.pnlPct >= 0 ? '#00ff88' : '#ff4444', fontSize: '14px', fontWeight: 700 }}>
                            {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                          </div>
                          <div style={{ color: pos.pnlUsd >= 0 ? '#00ff88' : '#ff4444', fontSize: '10px' }}>
                            {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Participation Instructions */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(138, 43, 226, 0.1))',
                  borderRadius: '10px', padding: '14px', marginBottom: '12px',
                  border: '1px solid rgba(0, 255, 136, 0.2)',
                }}>
                  <div style={{ color: '#00ff88', fontSize: '11px', fontWeight: 700, marginBottom: '10px' }}>🎮 WANT TO PARTICIPATE?</div>
                  <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.6, marginBottom: '12px' }}>
                    Follow Q7's trades at your own risk. Load your Arbitrum wallet:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ color: '#00ff88', fontSize: '16px', fontWeight: 700 }}>$30+</div>
                      <div style={{ color: '#888', fontSize: '9px' }}>USDC</div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                      <div style={{ color: '#627EEA', fontSize: '16px', fontWeight: 700 }}>$10+</div>
                      <div style={{ color: '#888', fontSize: '9px' }}>ETH (Gas)</div>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255, 215, 0, 0.1)', borderRadius: '6px', padding: '10px', border: '1px solid rgba(255, 215, 0, 0.2)' }}>
                    <div style={{ color: '#FFD700', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>💰 5% PROFIT SHARING</div>
                    <div style={{ color: '#888', fontSize: '9px', lineHeight: 1.5 }}>
                      Winning trades send 5% to Q7 Dev wallet for continued development.
                    </div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div style={{ background: 'rgba(255, 68, 68, 0.1)', borderRadius: '8px', padding: '10px', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
                  <div style={{ color: '#ff4444', fontSize: '9px', lineHeight: 1.5 }}>
                    ⚠️ <strong>RISK:</strong> Trading perpetuals involves loss risk. Past performance ≠ future results. DYOR.
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ----- POLYMARKET TAB ----- */}
        {activeTab === 'polymarket' && (
          <>
            {/* Q7 THEORY / TRADING LOGIC DISPLAY */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 140, 0, 0.1))',
              borderRadius: '12px',
              padding: '14px',
              marginBottom: '12px',
              border: '1px solid rgba(255, 215, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ color: '#FFD700', fontWeight: 800, fontSize: '13px' }}>⚡ Q7 TRADING LOGIC</div>
                <button
                  onClick={() => setQ7PolyPaused(!q7PolyPaused)}
                  style={{
                    padding: '6px 14px',
                    background: q7PolyPaused ? 'rgba(255, 68, 68, 0.3)' : 'rgba(0, 255, 136, 0.3)',
                    border: `1px solid ${q7PolyPaused ? '#ff4444' : '#00ff88'}`,
                    borderRadius: '8px',
                    color: q7PolyPaused ? '#ff4444' : '#00ff88',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {q7PolyPaused ? '⏸️ PAUSED' : '▶️ ACTIVE'}
                </button>
              </div>

              {/* Q7 Theory Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ color: '#00ff88', fontSize: '10px', fontWeight: 700 }}>🎯 SWP (30%)</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>Sweep - High priority liquidity grabs</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ color: '#ff8c00', fontSize: '10px', fontWeight: 700 }}>💥 BRK (25%)</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>Breakout - Structure breaks</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ color: '#8a2be2', fontSize: '10px', fontWeight: 700 }}>📊 MR (25%)</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>Mean Reversion - RSI extremes</div>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ color: '#00bcd4', fontSize: '10px', fontWeight: 700 }}>📈 TRND (15%)</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>Trend - EMA alignment</div>
                </div>
              </div>

              {/* Current Market Bias */}
              <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: '8px', padding: '10px' }}>
                <div style={{ color: '#888', fontSize: '9px', marginBottom: '4px' }}>Q7 CONFLUENCE SIGNAL</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#FFD700', fontSize: '14px', fontWeight: 800 }}>
                    {polymarketData.length > 0 && parseFloat(polymarketData[0]?.yesPrice) > 60 ? '🟢 BULLISH BIAS' : parseFloat(polymarketData[0]?.yesPrice) < 40 ? '🔴 BEARISH BIAS' : '🟡 NEUTRAL'}
                  </div>
                  <div style={{ color: '#666', fontSize: '9px' }}>
                    Based on {polymarketData.filter(m => m.tag === 'crypto' || !m.tag).length} crypto markets
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(138, 43, 226, 0.15), rgba(255, 215, 0, 0.1))',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '12px',
              border: '1px solid rgba(138, 43, 226, 0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ color: '#8a2be2', fontSize: '14px', fontWeight: 700 }}>
                  🎰 POLYMARKET ALPHA
                </div>
                <button
                  onClick={fetchPolymarketData}
                  disabled={polymarketLoading}
                  style={{
                    background: 'rgba(138, 43, 226, 0.3)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: '#fff',
                    fontSize: '10px',
                    cursor: 'pointer',
                  }}
                >
                  {polymarketLoading ? '⏳' : '🔄 Refresh'}
                </button>
              </div>
              <div style={{ color: '#888', fontSize: '10px' }}>
                Institutional-grade prediction market signals • Trade the crowd
              </div>
            </div>

            {polymarketLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎰</div>
                Loading prediction markets...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Crypto Markets Section */}
                <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
                  📊 CRYPTO MARKETS
                </div>
                {polymarketData.filter(m => !m.tag || m.tag === 'crypto').slice(0, 8).map((market, idx) => (
                  <div
                    key={market.id || idx}
                    style={{
                      background: 'rgba(0,0,0,0.3)',
                      borderRadius: '8px',
                      padding: '10px',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>
                      {market.question?.length > 60 ? market.question.slice(0, 60) + '...' : market.question}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        background: parseFloat(market.yesPrice) > 50
                          ? 'rgba(0, 255, 136, 0.2)'
                          : 'rgba(255, 107, 107, 0.2)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: parseFloat(market.yesPrice) > 50 ? '#00ff88' : '#ff6b6b',
                      }}>
                        {market.yesPrice}% YES
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: '#666' }}>
                        <span>Vol: {market.volume}</span>
                        <span>Liq: {market.liquidity}</span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Macro/Politics Section */}
                {polymarketData.filter(m => m.tag === 'macro').length > 0 && (
                  <>
                    <div style={{ color: '#ff8c00', fontSize: '11px', fontWeight: 600, marginTop: '8px', marginBottom: '4px' }}>
                      🏛️ MACRO / POLITICS
                    </div>
                    {polymarketData.filter(m => m.tag === 'macro').slice(0, 5).map((market, idx) => (
                      <div
                        key={market.id || `macro-${idx}`}
                        style={{
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: '8px',
                          padding: '10px',
                          border: '1px solid rgba(255, 140, 0, 0.1)',
                        }}
                      >
                        <div style={{ fontSize: '11px', color: '#fff', marginBottom: '6px', lineHeight: 1.3 }}>
                          {market.question?.length > 60 ? market.question.slice(0, 60) + '...' : market.question}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{
                            background: parseFloat(market.yesPrice) > 50
                              ? 'rgba(0, 255, 136, 0.2)'
                              : 'rgba(255, 107, 107, 0.2)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: 700,
                            color: parseFloat(market.yesPrice) > 50 ? '#00ff88' : '#ff6b6b',
                          }}>
                            {market.yesPrice}% YES
                          </div>
                          <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: '#666' }}>
                            <span>Vol: {market.volume}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Trading Insight */}
                <div style={{
                  background: 'rgba(138, 43, 226, 0.1)',
                  borderRadius: '8px',
                  padding: '10px',
                  marginTop: '8px',
                  border: '1px solid rgba(138, 43, 226, 0.2)',
                }}>
                  <div style={{ color: '#8a2be2', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>
                    💡 ALPHA INSIGHT
                  </div>
                  <div style={{ color: '#888', fontSize: '10px', lineHeight: 1.4 }}>
                    High-probability markets (70%+) often price in consensus. Contrarian opportunities emerge when markets diverge from fundamentals. Track volume spikes for smart money flow.
                  </div>
                </div>

                <a
                  href="https://polymarket.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #8a2be2, #ff8c00)',
                    color: '#fff',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    marginTop: '8px',
                  }}
                >
                  🎰 Trade on Polymarket →
                </a>
              </div>
            )}
          </>
        )}

        {/* ----- BOT TAB ----- */}
        {activeTab === 'bot' && (
          <>
            {/* Bot Status Card - v4.0 Aggressive Scalp Execution */}
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
                    <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '13px' }}>🤖 Q7 D-RAM v5.0 Auto Trade</div>
                    <div style={{ color: '#888', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: priceSource === 'live' || priceSource === 'gtrade-direct' || priceSource === 'gtrade-api' ? '#00ff88' : '#ff9900' }}>
                        {priceSource === 'live' ? '📈 Live Prices' : priceSource === 'gtrade-direct' ? '🎯 gTrade Direct' : priceSource === 'gtrade-api' ? '🎯 gTrade API' : '📡 Cached'}
                      </span>
                      <span style={{ color: '#ff8c00' }}>| {SCALP_PRESETS[scalpMode].name}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '14px' }}>${balance?.toFixed(2) || '---'}</div>
                  <div style={{ color: '#888', fontSize: '9px' }}>Available</div>
                </div>
              </div>

              {/* Trade Stats - Session Performance */}
              <div style={{
                background: 'rgba(255, 140, 0, 0.1)',
                borderRadius: '6px',
                padding: '8px',
                marginBottom: '10px',
                border: '1px solid rgba(255, 140, 0, 0.2)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ color: '#ff8c00', fontSize: '9px', fontWeight: 600 }}>⚡ SESSION STATS</span>
                  <span style={{ color: '#888', fontSize: '8px' }}>
                    Success Rate: {tradeStats.attempts > 0 ? ((tradeStats.successes / tradeStats.attempts) * 100).toFixed(0) : 0}%
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <div style={{ flex: 1, background: 'rgba(0,255,136,0.1)', borderRadius: '4px', padding: '6px', textAlign: 'center' }}>
                    <div style={{ color: '#00ff88', fontSize: '14px', fontWeight: 700 }}>{tradeStats.successes}</div>
                    <div style={{ color: '#888', fontSize: '7px' }}>FILLED</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,68,68,0.1)', borderRadius: '4px', padding: '6px', textAlign: 'center' }}>
                    <div style={{ color: '#ff4444', fontSize: '14px', fontWeight: 700 }}>{tradeStats.attempts - tradeStats.successes}</div>
                    <div style={{ color: '#888', fontSize: '7px' }}>FAILED</div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(255,215,0,0.1)', borderRadius: '4px', padding: '6px', textAlign: 'center' }}>
                    <div style={{ color: '#FFD700', fontSize: '14px', fontWeight: 700 }}>{tradeStats.attempts}</div>
                    <div style={{ color: '#888', fontSize: '7px' }}>ATTEMPTS</div>
                  </div>
                </div>
              </div>

              {/* ===== PENDING COLLATERAL / AUTO-CLAIM ===== */}
              {pendingOrders.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(255, 68, 68, 0.15), rgba(255, 140, 0, 0.1))',
                  borderRadius: '6px',
                  padding: '10px',
                  marginBottom: '10px',
                  border: '1px solid rgba(255, 68, 68, 0.3)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>⚠️</span>
                      <div>
                        <div style={{ color: '#ff4444', fontSize: '11px', fontWeight: 700 }}>
                          {pendingOrders.length} PENDING CLAIMS
                        </div>
                        <div style={{ color: '#888', fontSize: '8px' }}>
                          ${pendingOrders.reduce((sum, o) => sum + (o.collateral || 0), 0).toFixed(2)} stuck collateral
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={autoClaimAllCollateral}
                      disabled={isClaiming}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isClaiming ? '#666' : 'linear-gradient(135deg, #FFD700, #ff8c00)',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '10px',
                        cursor: isClaiming ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isClaiming ? '⏳ Claiming...' : '💰 CLAIM ALL'}
                    </button>
                  </div>

                  {/* List of pending orders */}
                  <div style={{ maxHeight: '80px', overflowY: 'auto' }}>
                    {pendingOrders.map((order, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 6px',
                        background: 'rgba(0,0,0,0.2)',
                        borderRadius: '4px',
                        marginBottom: '3px',
                        fontSize: '9px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: order.long ? '#00ff88' : '#ff4444' }}>
                            {order.long ? '📈' : '📉'}
                          </span>
                          <span style={{ color: '#fff' }}>{order.asset}</span>
                          <span style={{ color: '#888' }}>#{order.orderId}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#FFD700' }}>${order.collateral?.toFixed(2)}</span>
                          <button
                            onClick={() => claimCollateral(order.orderId, order.isLimitOrder)}
                            disabled={isClaiming}
                            style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              border: '1px solid #FFD700',
                              background: 'transparent',
                              color: '#FFD700',
                              fontSize: '8px',
                              cursor: isClaiming ? 'not-allowed' : 'pointer',
                            }}
                          >
                            Claim
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Auto-claim toggle */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid rgba(255,255,255,0.1)',
                  }}>
                    <span style={{ color: '#888', fontSize: '9px' }}>Auto-claim on startup</span>
                    <button
                      onClick={() => setAutoClaimEnabled(!autoClaimEnabled)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: autoClaimEnabled ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.1)',
                        color: autoClaimEnabled ? '#00ff88' : '#888',
                        fontSize: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      {autoClaimEnabled ? '✓ ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              )}

              {/* No pending claims - show status */}
              {pendingOrders.length === 0 && (
                <div style={{
                  background: 'rgba(0, 255, 136, 0.08)',
                  borderRadius: '6px',
                  padding: '8px',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}>
                  <span style={{ color: '#00ff88', fontSize: '10px' }}>✓</span>
                  <span style={{ color: '#888', fontSize: '9px' }}>No pending collateral claims</span>
                </div>
              )}

              {/* Position Counters */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
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

              {/* Oracle Price Status - Live prices from CoinGecko/goldprice.org or gTrade */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '9px', color: '#666', marginBottom: '6px', fontWeight: 600 }}>
                  📊 LIVE PRICES ({priceSource === 'live' ? 'Real-Time' : priceSource.includes('gtrade') ? 'gTrade' : 'Cached'})
                </div>
                {Object.keys(ASSETS).map(key => {
                  const price = livePrices[key];
                  const isLive = priceSource === 'live' || priceSource.includes('gtrade');
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: isLive ? '#00ff88' : '#ff9900' }}>
                          {isLive ? '📈' : '📡'}
                        </span>
                        <span style={{ color: '#888', fontSize: '9px' }}>{key}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#FFD700', fontSize: '10px', fontWeight: 600 }}>
                          ${price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '---'}
                        </span>
                        <span style={{
                          fontSize: '8px',
                          padding: '1px 3px',
                          borderRadius: '2px',
                          background: isLive ? 'rgba(0,255,136,0.2)' : 'rgba(255,150,0,0.2)',
                          color: isLive ? '#00ff88' : '#ff9900',
                        }}>
                          {isLive ? '✓' : '~'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '6px', fontSize: '8px', color: '#555', textAlign: 'center' }}>
                  {priceSource === 'live'
                    ? '✓ Live market prices'
                    : priceSource.includes('gtrade')
                    ? '✓ gTrade oracle prices'
                    : '📊 Using cached prices'}
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

      {/* ===== SHARE P&L CARD MODAL ===== */}
      {showShareCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px',
        }}>
          {/* Close Button */}
          <button
            onClick={() => setShowShareCard(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >✕</button>

          {/* MANDALORIAN P&L CARD - Full Background Art */}
          <div style={{
            borderRadius: '20px',
            maxWidth: '400px',
            width: '100%',
            border: '4px solid rgba(255, 215, 0, 0.7)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(255, 215, 0, 0.3), 0 0 100px rgba(255, 215, 0, 0.1)',
          }}>
            {/* FULL MANDO BACKGROUND IMAGE */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${currentMandoImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              zIndex: 0,
            }} />

            {/* Artistic gradient overlay - NOT opaque */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.75) 60%, rgba(0,0,0,0.85) 100%)',
              zIndex: 1,
            }} />

            {/* Content Container */}
            <div style={{ position: 'relative', zIndex: 2, padding: '24px' }}>
              {/* Mandalorian Beskar corners */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '50px', height: '50px', borderTop: '4px solid #FFD700', borderLeft: '4px solid #FFD700', borderRadius: '16px 0 0 0' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '50px', height: '50px', borderTop: '4px solid #FFD700', borderRight: '4px solid #FFD700', borderRadius: '0 16px 0 0' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '50px', height: '50px', borderBottom: '4px solid #FFD700', borderLeft: '4px solid #FFD700', borderRadius: '0 0 0 16px' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '50px', height: '50px', borderBottom: '4px solid #FFD700', borderRight: '4px solid #FFD700', borderRadius: '0 0 16px 0' }} />

              {/* Glow Effect */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle at center, rgba(255,215,0,0.15) 0%, transparent 50%)',
                pointerEvents: 'none',
              }} />

            {/* Header - Glassmorphism style */}
            <div style={{
              textAlign: 'center',
              marginBottom: '16px',
              padding: '16px',
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(10px)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
                <ArbitrumLogo size={32} />
                <div>
                  <div style={{ color: '#FFD700', fontWeight: 900, fontSize: '20px', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>Q7 AUTO-PERP</div>
                  <div style={{ color: '#ccc', fontSize: '11px', textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}>ARBITRUM • gTRADE • DTGC.io</div>
                </div>
              </div>
              <div style={{ color: '#888', fontSize: '9px' }}>D-RAM v5.2.6 Calibrated</div>

              {/* Time Range Toggle in Card */}
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '10px' }}>
                {['24h', '48h', '72h', 'all'].map(range => (
                  <button
                    key={range}
                    onClick={() => setPnlTimeRange(range)}
                    style={{
                      padding: '4px 10px',
                      background: pnlTimeRange === range ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${pnlTimeRange === range ? '#FFD700' : '#333'}`,
                      borderRadius: '4px',
                      color: pnlTimeRange === range ? '#FFD700' : '#666',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {range.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Grid - Glassmorphism style */}
            {(() => {
              const stats = getFilteredPnL();
              const winRate = (stats.wins + stats.losses) > 0
                ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
                : 0;
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                  <div style={{ background: 'rgba(0, 255, 136, 0.2)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '14px', textAlign: 'center', border: '2px solid rgba(0, 255, 136, 0.4)' }}>
                    <div style={{ color: '#00ff88', fontSize: '32px', fontWeight: 900, textShadow: '0 2px 10px rgba(0,255,136,0.5)' }}>{stats.wins}</div>
                    <div style={{ color: '#00ff88', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>WINNING</div>
                  </div>
                  <div style={{ background: 'rgba(255, 68, 68, 0.2)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '14px', textAlign: 'center', border: '2px solid rgba(255, 68, 68, 0.4)' }}>
                    <div style={{ color: '#ff4444', fontSize: '32px', fontWeight: 900, textShadow: '0 2px 10px rgba(255,68,68,0.5)' }}>{stats.losses}</div>
                    <div style={{ color: '#ff4444', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>LOSING</div>
                  </div>
                  <div style={{ background: 'rgba(138, 43, 226, 0.2)', backdropFilter: 'blur(10px)', borderRadius: '12px', padding: '14px', textAlign: 'center', border: '2px solid rgba(138, 43, 226, 0.4)' }}>
                    <div style={{ color: '#8a2be2', fontSize: '32px', fontWeight: 900, textShadow: '0 2px 10px rgba(138,43,226,0.5)' }}>{winRate}%</div>
                    <div style={{ color: '#8a2be2', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>WIN RATE</div>
                  </div>
                </div>
              );
            })()}

            {/* Total P&L Hero - Glassmorphism */}
            {(() => {
              const stats = getFilteredPnL();
              const displayPnL = stats.total;
              const tradeCount = stats.count;
              return (
                <div style={{
                  background: displayPnL >= 0
                    ? 'rgba(0, 255, 136, 0.15)'
                    : 'rgba(255, 68, 68, 0.15)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '16px',
                  padding: '20px',
                  textAlign: 'center',
                  border: `3px solid ${displayPnL >= 0 ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 68, 68, 0.5)'}`,
                  marginBottom: '16px',
                }}>
                  <div style={{ color: '#fff', fontSize: '12px', marginBottom: '8px', fontWeight: 600, letterSpacing: '1px', textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}>
                    {pnlTimeRange === 'all' ? 'TOTAL P&L' : `P&L (${pnlTimeRange.toUpperCase()})`}
                  </div>
                  <div style={{
                    color: displayPnL >= 0 ? '#00ff88' : '#ff4444',
                    fontSize: '44px',
                    fontWeight: 900,
                    textShadow: displayPnL >= 0 ? '0 0 40px rgba(0,255,136,0.8), 0 2px 10px rgba(0,0,0,0.5)' : '0 0 40px rgba(255,68,68,0.8), 0 2px 10px rgba(0,0,0,0.5)',
                  }}>
                    {displayPnL >= 0 ? '+' : ''}{displayPnL.toFixed(2)} USDC
                  </div>
                  <div style={{ color: '#666', fontSize: '11px', marginTop: '8px' }}>
                    {tradeCount} trades {pnlTimeRange !== 'all' ? `in ${pnlTimeRange}` : 'executed'}
                  </div>
                </div>
              );
            })()}

            {/* Footer */}
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{ color: '#FFD700', fontSize: '11px', fontWeight: 700, marginBottom: '4px' }}>🎯 DTGC.io/gold</div>
              <div style={{ color: '#555', fontSize: '9px' }}>
                {userAddress ? `${userAddress.slice(0, 12)}...${userAddress.slice(-10)}` : 'Connect Wallet'}
              </div>
              <div style={{ color: '#333', fontSize: '8px', marginTop: '8px' }}>
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {/* Gold Bars Reward Section - Shows when profit is $50+ */}
            {(() => {
              const displayPnL = pnlTimeRange === 'all' ? (realPnL.total || 0) : getFilteredPnL().total;
              return getGoldBars(displayPnL) > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 140, 0, 0.1))',
                borderRadius: '12px',
                border: '2px solid rgba(255, 215, 0, 0.4)',
                position: 'relative',
                zIndex: 1,
              }}>
                <div style={{
                  color: '#FFD700',
                  fontSize: '10px',
                  fontWeight: 700,
                  textAlign: 'center',
                  marginBottom: '8px',
                  letterSpacing: '1px'
                }}>
                  🏆 PROFIT REWARD LEVEL 🏆
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}>
                  {[...Array(getGoldBars(displayPnL))].map((_, i) => (
                    <img
                      key={i}
                      src="/gold_bar.png"
                      alt="Gold Bar"
                      style={{
                        width: '48px',
                        height: '24px',
                        objectFit: 'contain',
                        filter: 'drop-shadow(0 2px 4px rgba(255, 215, 0, 0.5))',
                        animation: `goldPulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
                <div style={{
                  color: '#888',
                  fontSize: '9px',
                  textAlign: 'center',
                  marginTop: '8px',
                }}>
                  {displayPnL >= 1000 ? '🐋 WHALE STATUS!' :
                   displayPnL >= 500 ? '💎 Diamond Hands!' :
                   displayPnL >= 250 ? '🔥 On Fire!' :
                   displayPnL >= 100 ? '📈 Stacking!' :
                   '✨ Nice Gains!'}
                </div>
              </div>
            );
            })()}
          </div>
          {/* Close Card Container */}
          </div>

          {/* Share Instructions */}
          <div style={{ color: '#888', fontSize: '12px', marginTop: '20px', textAlign: 'center' }}>
            📸 Screenshot this card to share your results!
          </div>

          {/* Copy Link Button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(`Check out my Q7 Auto-Perp results! 🎯\n\n${(realPnL.wins || 0)}W / ${(realPnL.losses || 0)}L\nTotal P&L: ${(realPnL.total || 0) >= 0 ? '+' : ''}$${(realPnL.total || 0).toFixed(2)} USDC\n\nTry it: dtgc.io/gold`);
              setShowShareCard(false);
              showToastMsg('📋 Results copied to clipboard!', 'success');
            }}
            style={{
              marginTop: '16px',
              padding: '12px 32px',
              background: 'linear-gradient(135deg, #FFD700, #ff8c00)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontWeight: 800,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            📋 COPY RESULTS
          </button>
        </div>
      )}

      {/* ===== P&L RETROSPECT CARD MODAL ===== */}
      {showRetrospectCard && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.95)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '20px',
        }}>
          {/* Close Button */}
          <button
            onClick={() => setShowRetrospectCard(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: '#fff',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >✕</button>

          {/* RETROSPECT P&L CARD - Full Background Mando Art */}
          <div style={{
            borderRadius: '20px',
            maxWidth: '400px',
            width: '100%',
            border: '4px solid rgba(255, 215, 0, 0.7)',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(255, 215, 0, 0.3), 0 0 100px rgba(255, 215, 0, 0.1)',
          }}>
            {/* FULL MANDO BACKGROUND IMAGE */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${currentMandoImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              zIndex: 0,
            }} />

            {/* Artistic gradient overlay - very transparent, lets Mando show through */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.3) 25%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.6) 75%, rgba(0,0,0,0.75) 100%)',
              zIndex: 1,
            }} />

            {/* Content Container */}
            <div style={{ position: 'relative', zIndex: 2, padding: '24px' }}>
              {/* Mandalorian Beskar corners */}
              <div style={{ position: 'absolute', top: 0, left: 0, width: '60px', height: '60px', borderTop: '4px solid #FFD700', borderLeft: '4px solid #FFD700', borderRadius: '16px 0 0 0' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', borderTop: '4px solid #FFD700', borderRight: '4px solid #FFD700', borderRadius: '0 16px 0 0' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, width: '60px', height: '60px', borderBottom: '4px solid #FFD700', borderLeft: '4px solid #FFD700', borderRadius: '0 0 0 16px' }} />
              <div style={{ position: 'absolute', bottom: 0, right: 0, width: '60px', height: '60px', borderBottom: '4px solid #FFD700', borderRight: '4px solid #FFD700', borderRadius: '0 0 16px 0' }} />

              {/* Radial glow effect */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: 'radial-gradient(circle at center, rgba(255,215,0,0.1) 0%, transparent 50%)',
                pointerEvents: 'none',
              }} />

              {/* Header - Glassmorphism style - more transparent for Mando art */}
              <div style={{
                textAlign: 'center',
                marginBottom: '16px',
                padding: '16px',
                background: 'rgba(0, 0, 0, 0.2)',
                backdropFilter: 'blur(4px)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 215, 0, 0.4)',
              }}>
                <div style={{ color: '#FFD700', fontWeight: 900, fontSize: '22px', letterSpacing: '1px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>📊 P&L RETROSPECT</div>
                <div style={{ color: '#ccc', fontSize: '11px', marginTop: '4px', textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}>ARBITRUM • gTRADE • DTGC.io</div>
                <div style={{ color: '#888', fontSize: '9px', marginTop: '2px' }}>Portfolio Performance Summary</div>
              </div>

              {/* Initial Capital - Glassmorphism - transparent for art */}
              <div style={{
                background: 'rgba(138, 43, 226, 0.1)',
                backdropFilter: 'blur(3px)',
                borderRadius: '12px',
                padding: '14px',
                marginBottom: '12px',
                border: '2px solid rgba(138, 43, 226, 0.5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#d896ff', fontSize: '11px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>💰 INITIAL CAPITAL</div>
                  <div style={{ color: '#d896ff', fontSize: '22px', fontWeight: 800, textShadow: '0 2px 10px rgba(138,43,226,0.6)' }}>
                    ${(startingBalance || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Closed Trades & Win Rate Row - Glassmorphism - transparent */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{
                  flex: 1,
                  background: 'rgba(255, 215, 0, 0.08)',
                  backdropFilter: 'blur(3px)',
                  borderRadius: '12px',
                  padding: '14px',
                  textAlign: 'center',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                }}>
                  <div style={{ color: '#FFD700', fontSize: '30px', fontWeight: 900, textShadow: '0 2px 10px rgba(255,215,0,0.5)' }}>{historicalTrades.length}</div>
                  <div style={{ color: '#FFD700', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>CLOSED TRADES</div>
                </div>
                <div style={{
                  flex: 1,
                  background: 'rgba(0, 255, 136, 0.08)',
                  backdropFilter: 'blur(3px)',
                  borderRadius: '12px',
                  padding: '14px',
                  textAlign: 'center',
                  border: '2px solid rgba(0, 255, 136, 0.5)',
                }}>
                  <div style={{ color: '#00ff88', fontSize: '30px', fontWeight: 900, textShadow: '0 2px 10px rgba(0,255,136,0.5)' }}>
                    {(realPnL.wins + realPnL.losses) > 0 ? Math.round((realPnL.wins / (realPnL.wins + realPnL.losses)) * 100) : 0}%
                  </div>
                  <div style={{ color: '#00ff88', fontSize: '10px', fontWeight: 700, letterSpacing: '1px' }}>WIN RATE</div>
                </div>
              </div>

              {/* W/L Breakdown - Glassmorphism - transparent */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1, background: 'rgba(0, 255, 136, 0.06)', backdropFilter: 'blur(2px)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid rgba(0, 255, 136, 0.3)' }}>
                  <div style={{ color: '#00ff88', fontSize: '20px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,255,136,0.4)' }}>{realPnL.wins || 0}</div>
                  <div style={{ color: '#00ff88', fontSize: '9px', fontWeight: 600 }}>WINS</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(255, 68, 68, 0.06)', backdropFilter: 'blur(2px)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid rgba(255, 68, 68, 0.3)' }}>
                  <div style={{ color: '#ff4444', fontSize: '20px', fontWeight: 700, textShadow: '0 1px 5px rgba(255,68,68,0.4)' }}>{realPnL.losses || 0}</div>
                  <div style={{ color: '#ff4444', fontSize: '9px', fontWeight: 600 }}>LOSSES</div>
                </div>
                <div style={{ flex: 1, background: 'rgba(0, 150, 255, 0.06)', backdropFilter: 'blur(2px)', borderRadius: '10px', padding: '10px', textAlign: 'center', border: '1px solid rgba(0, 150, 255, 0.3)' }}>
                  <div style={{ color: '#0096ff', fontSize: '20px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,150,255,0.4)' }}>{userPositions.length}</div>
                  <div style={{ color: '#0096ff', fontSize: '9px', fontWeight: 600 }}>OPEN</div>
                </div>
              </div>

              {/* P&L TIME GRAPH - transparent */}
              {historicalTrades.length >= 2 && (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.15)',
                  backdropFilter: 'blur(2px)',
                  borderRadius: '12px',
                  padding: '12px',
                  marginBottom: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                }}>
                  <div style={{ color: '#FFD700', fontSize: '10px', fontWeight: 700, marginBottom: '8px', textAlign: 'center', letterSpacing: '1px' }}>
                    📈 P&L OVER TIME
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {renderPnLChart()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', padding: '0 5px' }}>
                    <div style={{ color: '#888', fontSize: '8px' }}>{historicalTrades.length} trades</div>
                    <div style={{
                      color: (realPnL.total || 0) >= 0 ? '#00ff88' : '#ff4444',
                      fontSize: '9px',
                      fontWeight: 700,
                    }}>
                      {(realPnL.total || 0) >= 0 ? '↑' : '↓'} ${Math.abs(realPnL.total || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              {/* Total System Capital NOW - Hero but transparent for Mando */}
              <div style={{
                background: 'rgba(0, 255, 136, 0.08)',
                backdropFilter: 'blur(3px)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                border: '3px solid rgba(0, 255, 136, 0.5)',
                marginBottom: '12px',
                boxShadow: '0 4px 30px rgba(0, 255, 136, 0.15)',
              }}>
                <div style={{ color: '#ccc', fontSize: '11px', marginBottom: '6px', fontWeight: 600, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>💎 TOTAL SYSTEM CAPITAL NOW</div>
                <div style={{
                  color: '#00ff88',
                  fontSize: '40px',
                  fontWeight: 900,
                  textShadow: '0 0 40px rgba(0,255,136,0.7), 0 2px 10px rgba(0,0,0,0.5)',
                }}>
                  ${getTotalSystemCapital().toFixed(2)}
                </div>
                {startingBalance && startingBalance > 0 && (
                  <div style={{
                    color: getROI() >= 0 ? '#00ff88' : '#ff4444',
                    fontSize: '16px',
                    fontWeight: 700,
                    marginTop: '6px',
                    textShadow: getROI() >= 0 ? '0 0 15px rgba(0,255,136,0.6)' : '0 0 15px rgba(255,68,68,0.6)',
                  }}>
                    {getROI() >= 0 ? '↑' : '↓'} {Math.abs(getROI()).toFixed(2)}% ROI
                  </div>
                )}
              </div>

              {/* Realized & Unrealized P&L - transparent */}
              <div style={{
                background: 'rgba(255, 215, 0, 0.05)',
                backdropFilter: 'blur(2px)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(255, 215, 0, 0.4)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#FFD700', fontSize: '10px', fontWeight: 600 }}>📜 Realized P&L</div>
                  <div style={{ color: (realPnL.total || 0) >= 0 ? '#00ff88' : '#ff4444', fontSize: '15px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
                    {(realPnL.total || 0) >= 0 ? '+' : ''}{(realPnL.total || 0).toFixed(2)} USDC
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                  <div style={{ color: '#0096ff', fontSize: '10px', fontWeight: 600 }}>📸 Unrealized P&L</div>
                  <div style={{ color: totalUnrealizedPnl >= 0 ? '#00ff88' : '#ff4444', fontSize: '15px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
                    {totalUnrealizedPnl >= 0 ? '+' : ''}{totalUnrealizedPnl.toFixed(2)} USDC
                  </div>
                </div>
              </div>

              {/* 5% Flywheel to PLS - transparent */}
              <div style={{
                background: 'rgba(255, 0, 128, 0.06)',
                backdropFilter: 'blur(2px)',
                borderRadius: '12px',
                padding: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(255, 0, 128, 0.5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ color: '#ff0080', fontSize: '10px', fontWeight: 600 }}>🔄 5% Flywheel → PLS</div>
                  <div style={{ color: '#ff0080', fontSize: '15px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>
                    ${(flywheelStats.totalFlywheelAllocated + calculateFlywheelAmount(totalUnrealizedPnl > 0 ? totalUnrealizedPnl : 0)).toFixed(2)}
                  </div>
                </div>
                <div style={{ color: '#888', fontSize: '8px', marginTop: '4px', textAlign: 'right' }}>
                  To: {GROWTH_ENGINE_WALLET.slice(0, 10)}...
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#FFD700', fontSize: '12px', fontWeight: 700, textShadow: '0 1px 5px rgba(0,0,0,0.5)' }}>🎯 DTGC.io/gold</div>
                <div style={{ color: '#999', fontSize: '9px', marginTop: '4px' }}>
                  {userAddress ? `${userAddress.slice(0, 12)}...${userAddress.slice(-10)}` : 'Connect Wallet'}
                </div>
                <div style={{ color: '#666', fontSize: '8px', marginTop: '4px' }}>
                  {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Gold Bars for high profit - transparent for Mando art */}
              {getGoldBars(getTotalSystemCapital() - (startingBalance || 0)) > 0 && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: 'rgba(255, 215, 0, 0.06)',
                  backdropFilter: 'blur(2px)',
                  borderRadius: '12px',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                }}>
                  <div style={{
                    color: '#FFD700',
                    fontSize: '10px',
                    fontWeight: 700,
                    textAlign: 'center',
                    marginBottom: '8px',
                    letterSpacing: '1px',
                    textShadow: '0 1px 5px rgba(0,0,0,0.5)',
                  }}>
                    🏆 PROFIT REWARD LEVEL 🏆
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {[...Array(getGoldBars(getTotalSystemCapital() - (startingBalance || 0)))].map((_, i) => (
                      <img
                        key={i}
                        src="/gold_bar.png"
                        alt="Gold Bar"
                        style={{
                          width: '44px',
                          height: '22px',
                          objectFit: 'contain',
                          filter: 'drop-shadow(0 2px 6px rgba(255, 215, 0, 0.6))',
                          animation: `goldPulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                  <div style={{
                    color: '#ccc',
                    fontSize: '9px',
                    textAlign: 'center',
                    marginTop: '8px',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}>
                    {(getTotalSystemCapital() - (startingBalance || 0)) >= 1000 ? '🐋 WHALE STATUS!' :
                     (getTotalSystemCapital() - (startingBalance || 0)) >= 500 ? '💎 Diamond Hands!' :
                     (getTotalSystemCapital() - (startingBalance || 0)) >= 250 ? '🔥 On Fire!' :
                     (getTotalSystemCapital() - (startingBalance || 0)) >= 100 ? '📈 Stacking!' :
                     '✨ Nice Gains!'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Share Instructions */}
          <div style={{ color: '#888', fontSize: '12px', marginTop: '20px', textAlign: 'center' }}>
            📸 Screenshot to share your portfolio journey!
          </div>

          {/* Share Buttons Row */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              onClick={() => {
                const text = `📊 Q7 Auto-Perp Retrospect\n\n💰 Started: $${(startingBalance || 0).toFixed(2)}\n📜 Closed: ${historicalTrades.length} trades (${realPnL.wins}W/${realPnL.losses}L)\n🎯 Win Rate: ${(realPnL.wins + realPnL.losses) > 0 ? Math.round((realPnL.wins / (realPnL.wins + realPnL.losses)) * 100) : 0}%\n💎 Current: $${getTotalSystemCapital().toFixed(2)}\n${startingBalance ? `📈 ROI: ${getROI() >= 0 ? '+' : ''}${getROI().toFixed(2)}%` : ''}\n\n🎯 dtgc.io/gold`;
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              style={{
                padding: '12px 24px',
                background: '#000',
                border: '2px solid #333',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              𝕏 POST
            </button>
            <button
              onClick={() => {
                const text = `📊 Q7 Auto-Perp Retrospect\n\n💰 Started: $${(startingBalance || 0).toFixed(2)}\n📜 Closed: ${historicalTrades.length} trades\n🎯 Win Rate: ${(realPnL.wins + realPnL.losses) > 0 ? Math.round((realPnL.wins / (realPnL.wins + realPnL.losses)) * 100) : 0}%\n💎 Current: $${getTotalSystemCapital().toFixed(2)}\n\n🎯 dtgc.io/gold`;
                window.open(`https://t.me/share/url?url=${encodeURIComponent('https://dtgc.io/gold')}&text=${encodeURIComponent(text)}`, '_blank');
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #0088cc, #0066aa)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              📱 TELEGRAM
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`📊 Q7 Auto-Perp Retrospect\n\n💰 Started: $${(startingBalance || 0).toFixed(2)}\n📜 Closed: ${historicalTrades.length} trades (${realPnL.wins}W/${realPnL.losses}L)\n🎯 Win Rate: ${(realPnL.wins + realPnL.losses) > 0 ? Math.round((realPnL.wins / (realPnL.wins + realPnL.losses)) * 100) : 0}%\n💎 Current: $${getTotalSystemCapital().toFixed(2)}\n${startingBalance ? `📈 ROI: ${getROI() >= 0 ? '+' : ''}${getROI().toFixed(2)}%` : ''}\n\n🎯 dtgc.io/gold`);
                setShowRetrospectCard(false);
                showToastMsg('📋 Retrospect copied to clipboard!', 'success');
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #FFD700, #ff8c00)',
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              📋 COPY
            </button>
          </div>
        </div>
      )}

      {/* ===== ANIMATIONS ===== */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes goldPulse {
          0%, 100% {
            transform: scale(1) rotate(0deg);
            filter: drop-shadow(0 2px 4px rgba(255, 215, 0, 0.5));
          }
          50% {
            transform: scale(1.1) rotate(2deg);
            filter: drop-shadow(0 4px 8px rgba(255, 215, 0, 0.8));
          }
        }
      `}</style>
    </div>
  );
}

