// Institutional Auto Trade v4.2 - MASTER TP + AUTO-CLAIM
// Lambda: gTrade Direct Prices, Auto-Retry, Momentum Detection, Auto-Claim Pending
import React, { useState, useEffect, useRef } from 'react';

// ==================== CONFIGURATION ====================

const LAMBDA_URL = 'https://mqd4yvwog76amuift2p23du2ma0ehaqp.lambda-url.us-east-2.on.aws/';

// ==================== SCALP MODE PRESETS ====================
// Optimized for quick in-and-out trades during volatile markets
const SCALP_PRESETS = {
  // Conservative scalp - safer margins
  conservative: {
    name: '🟢 Safe Scalp',
    tp: 0.5,       // 0.5% take profit
    sl: 0.3,       // 0.3% stop loss
    leverage: 50,  // Lower leverage for safety
    description: 'Small gains, tight stops',
  },
  // Standard scalp - balanced
  standard: {
    name: '🟡 Standard',
    tp: 1.0,       // 1% take profit
    sl: 0.5,       // 0.5% stop loss
    leverage: 75,  // Medium leverage
    description: 'Balanced risk/reward',
  },
  // Aggressive scalp - max gains
  aggressive: {
    name: '🔴 Aggressive',
    tp: 1.5,       // 1.5% take profit
    sl: 0.75,      // 0.75% stop loss
    leverage: 100, // High leverage
    description: 'Higher risk, higher reward',
  },
  // Sniper mode - very tight for momentum plays
  sniper: {
    name: '🎯 Sniper',
    tp: 0.3,       // 0.3% take profit (quick grab)
    sl: 0.2,       // 0.2% stop loss (tight)
    leverage: 125, // Max leverage
    description: 'Quick in/out, momentum plays',
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

// SYNCED WITH gTrade v10 actual limits + Lambda v3.86 gTrade native pricing
const ASSETS = {
  BTC: { name: 'Bitcoin', symbol: 'BTC', maxLev: 150, minLev: 2, type: 'crypto', priceSource: 'gTrade' },
  ETH: { name: 'Ethereum', symbol: 'ETH', maxLev: 150, minLev: 2, type: 'crypto', priceSource: 'gTrade' },
  GOLD: { name: 'Gold', symbol: 'XAU', maxLev: 25, minLev: 2, type: 'commodity', priceSource: 'gTrade' },
  SILVER: { name: 'Silver', symbol: 'XAG', maxLev: 25, minLev: 2, type: 'commodity', priceSource: 'gTrade' },
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

export default function MetalPerpsWidget() {
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
  const [takeProfit, setTakeProfit] = useState('1.5');
  const [stopLoss, setStopLoss] = useState('1.0');
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

  // ===== PENDING ORDERS / COLLATERAL CLAIM STATE =====
  const [pendingOrders, setPendingOrders] = useState([]);
  const [isClaiming, setIsClaiming] = useState(false);
  const [autoClaimEnabled, setAutoClaimEnabled] = useState(true); // Auto-claim on by default
  const [claimResults, setClaimResults] = useState([]);
  
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

    // LAST RESORT: Use previous prices if we have them
    // These should be very close to gTrade since we fetch frequently
    const prices = {
      BTC: livePrices.BTC || 104000,
      ETH: livePrices.ETH || 3200,
      GOLD: livePrices.GOLD || 2770,
      SILVER: livePrices.SILVER || 31
    };

    console.log('⚠️ Using cached/fallback prices:', prices);
    setLivePrices(prices);
    setPriceSource('fallback');
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
          console.log(`🎯 TP HIT for ${pos.asset}! Current: $${currentPrice}, TP: $${tpPrice}, PnL: ${pnlPercent.toFixed(2)}%`);
          showToast(`🎯 TP HIT! Closing ${pos.asset} @ +${pnlPercent.toFixed(1)}%`, 'success');

          // Auto-close the position
          try {
            const closeResult = await apiCall('CLOSE_TRADE', { tradeIndex: pos.index });
            setBotActivity(prev => [{
              type: 'TP_HIT',
              message: `🎯 TP: ${pos.asset} closed @ +${pnlPercent.toFixed(1)}%`,
              time: new Date().toLocaleTimeString(),
            }, ...prev].slice(0, 20));

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
          console.log(`🛑 SL HIT for ${pos.asset}! Current: $${currentPrice}, SL: $${slPrice}, PnL: ${pnlPercent.toFixed(2)}%`);
          showToast(`🛑 SL HIT! Closing ${pos.asset} @ ${pnlPercent.toFixed(1)}%`, 'error');

          // Auto-close the position
          try {
            await apiCall('CLOSE_TRADE', { tradeIndex: pos.index });
            setBotActivity(prev => [{
              type: 'SL_HIT',
              message: `🛑 SL: ${pos.asset} closed @ ${pnlPercent.toFixed(1)}%`,
              time: new Date().toLocaleTimeString(),
            }, ...prev].slice(0, 20));
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
              <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>Institutional Auto Trade</div>
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

            {/* Chart */}
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', overflow: 'hidden', marginBottom: '6px' }}>
              <TradingViewMiniSymbol symbol={tvSymbol} height={160} />
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

            {/* ===== SCALP MODE SELECTOR ===== */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.1), rgba(255, 68, 68, 0.1))',
              borderRadius: '8px',
              padding: '8px',
              marginBottom: '10px',
              border: '1px solid rgba(255, 140, 0, 0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ color: '#ff8c00', fontSize: '10px', fontWeight: 600 }}>⚡ SCALP MODE</span>
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
                const isLong = pos.long === true || pos.long === 'true';
                const currentPrice = livePrices[pos.asset];
                return (
                  <div key={idx} style={{
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '10px',
                    padding: '10px',
                    marginBottom: '8px',
                    border: `1px solid ${isLong ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{isLong ? '📈' : '📉'}</span>
                        <span style={{ color: '#fff', fontWeight: 700, fontSize: '12px' }}>{pos.asset}</span>
                        <span style={{ color: isLong ? '#00ff88' : '#ff4444', fontSize: '10px', fontWeight: 600 }}>{isLong ? 'LONG' : 'SHORT'}</span>
                      </div>
                      <span style={{ color: '#FFD700', fontSize: '11px', fontWeight: 600 }}>{pos.leverage?.toFixed(1)}x</span>
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
                        <span style={{ color: '#fff', fontWeight: 600 }}>${pos.openPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                        <span style={{ color: '#888' }}>Current Price</span>
                        <span style={{ color: currentPrice && currentPrice > pos.openPrice ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
                          ${currentPrice?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '---'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '10px', marginBottom: '8px' }}>
                      <div>
                        <span style={{ color: '#666' }}>Collateral: </span>
                        <span style={{ color: '#fff' }}>${pos.collateral?.toFixed(2)} USDC</span>
                      </div>
                      <div>
                        <span style={{ color: '#666' }}>Position: </span>
                        <span style={{ color: '#FFD700' }}>${(pos.collateral * pos.leverage).toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#00ff88' }}>TP: </span>
                        <span style={{ color: '#00ff88' }}>${pos.tp > 0 ? pos.tp.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'None'}</span>
                      </div>
                      <div>
                        <span style={{ color: '#ff4444' }}>SL: </span>
                        <span style={{ color: '#ff4444' }}>${pos.sl > 0 ? pos.sl.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'None'}</span>
                      </div>
                    </div>

                    {/* P&L Display - MATCHES gTRADE FORMAT */}
                    <div style={{
                      background: pnl && pnl.percent >= 0 ? 'rgba(0,255,136,0.15)' : 'rgba(255,68,68,0.15)',
                      borderRadius: '6px',
                      padding: '8px',
                      marginBottom: '8px',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#888', fontSize: '10px' }}>Unrealized PnL</span>
                        {pnl ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: pnl.percent >= 0 ? '#00ff88' : '#ff4444', fontWeight: 700, fontSize: '14px' }}>
                              {pnl.usd >= 0 ? '+' : ''}{pnl.usd.toFixed(2)} USDC
                            </div>
                            <div style={{ color: pnl.percent >= 0 ? '#00ff88' : '#ff4444', fontSize: '10px', opacity: 0.8 }}>
                              ({pnl.percent >= 0 ? '+' : ''}{pnl.percent.toFixed(2)}%)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#666', fontSize: '12px' }}>Loading...</span>
                        )}
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
                    <div style={{ color: '#00ff88', fontWeight: 700, fontSize: '13px' }}>🤖 Institutional Auto Trade v4.1</div>
                    <div style={{ color: '#888', fontSize: '9px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: priceSource === 'gtrade-direct' || priceSource === 'gtrade-api' ? '#00ff88' : '#ff9900' }}>
                        {priceSource === 'gtrade-direct' ? '🎯 gTrade Direct' : priceSource === 'gtrade-api' ? '🎯 gTrade API' : '📡 Fallback Mode'}
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

              {/* Oracle Price Status - DIRECT from gTrade */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '8px' }}>
                <div style={{ fontSize: '9px', color: '#666', marginBottom: '6px', fontWeight: 600 }}>
                  📊 LIVE PRICES ({priceSource.includes('gtrade') ? 'gTrade Direct' : 'Fallback'})
                </div>
                {Object.keys(ASSETS).map(key => {
                  const price = livePrices[key];
                  return (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: priceSource.includes('gtrade') ? '#00ff88' : '#ff9900' }}>
                          {priceSource.includes('gtrade') ? '🎯' : '📡'}
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
                          background: priceSource.includes('gtrade') ? 'rgba(0,255,136,0.2)' : 'rgba(255,150,0,0.2)',
                          color: priceSource.includes('gtrade') ? '#00ff88' : '#ff9900',
                        }}>
                          {priceSource.includes('gtrade') ? '✓ SYNC' : 'FB'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '6px', fontSize: '8px', color: '#555', textAlign: 'center' }}>
                  {priceSource.includes('gtrade')
                    ? '✓ Prices match gTrade UI exactly'
                    : '⚠️ Using fallback - may differ from gTrade'}
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
