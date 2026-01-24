import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ethers, BrowserProvider, JsonRpcProvider, Contract } from 'ethers';

// ==================== CONFIGURATION ====================
const LAMBDA_URL = 'https://kz45776mye3b2ywtra43m4wwl40hmrdu.lambda-url.us-east-2.on.aws/';

// One-Click Trading Presets
const ONE_CLICK_PRESETS = {
  SCALP: {
    name: '⚡ Scalp',
    description: 'Quick in/out',
    collateral: 25,
    leverage: 50,
    tpPercent: 0.5,
    slPercent: 0.3,
    color: '#FFD700',
  },
  SWING: {
    name: '🎯 Swing',
    description: 'Medium hold',
    collateral: 50,
    leverage: 20,
    tpPercent: 1.5,
    slPercent: 1.0,
    color: '#00ff88',
  },
  POSITION: {
    name: '🏦 Position',
    description: 'Longer term',
    collateral: 100,
    leverage: 10,
    tpPercent: 3.0,
    slPercent: 2.0,
    color: '#00BFFF',
  },
};

// Arbitrum Config
const ARBITRUM_CONFIG = {
  chainId: 42161,
  chainIdHex: '0xa4b1',
  name: 'Arbitrum One',
  rpcUrl: 'https://arb1.arbitrum.io/rpc',
  explorer: 'https://arbiscan.io',
};

// gTrade Contract Addresses (Arbitrum)
const GTRADE_CONTRACTS = {
  TRADING: '0xFF162c694eAA571f685030649814282eA457f169',
  STORAGE: '0xcFa6ebD475d89dB04cAd5A756fff1cb2BC5bE33c',
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
};

// Contract ABIs
const STORAGE_ABI = [
  'function openTrades(address trader, uint256 pairIndex, uint256 index) view returns (tuple(address trader, uint256 pairIndex, uint256 index, uint256 initialPosToken, uint256 positionSizeUsd, uint256 openPrice, bool buy, uint256 leverage, uint256 tp, uint256 sl, uint256 timestamp))',
  'function openTradesCount(address trader, uint256 pairIndex) view returns (uint256)',
];

const TRADING_ABI = [
  'function closeTradeMarket(uint256 pairIndex, uint256 index) external',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
];

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
  BTC: { name: 'Bitcoin', symbol: 'BTC', maxLev: 150, minLev: 1.1, pairIndex: 0, icon: '₿' },
  ETH: { name: 'Ethereum', symbol: 'ETH', maxLev: 150, minLev: 1.1, pairIndex: 1, icon: 'Ξ' },
  GOLD: { name: 'Gold', symbol: 'XAU', maxLev: 25, minLev: 2, pairIndex: 10, icon: '🥇' },
  SILVER: { name: 'Silver', symbol: 'XAG', maxLev: 25, minLev: 2, pairIndex: 11, icon: '🥈' },
};

// Pair index to asset name mapping
const PAIR_INDEX_TO_ASSET = {
  0: 'BTC',
  1: 'ETH',
  10: 'GOLD',
  11: 'SILVER',
};

// Bot wallets for status indicator
const BOT_WALLETS = [
  '0x978c5786cdb46b1519a9c1c4814e06d5956f6c64',  // PHANTOM EDGE (Main)
  '0x43941130bcf4b9042b1bdeeca631b0b2da6c9bf9',  // WEEKEND WARRIOR
];

// TradingView Mini Symbol Overview
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
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [symbol, height]);
  
  return <div ref={containerRef} style={{ height: `${height}px`, width: '100%' }} />;
};

// TradingView Ticker Tape
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
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);
  
  return <div ref={containerRef} style={{ height: '46px', width: '100%', overflow: 'hidden' }} />;
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
  
  const [orderType, setOrderType] = useState('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // One-Click Trading State
  const [oneClickEnabled, setOneClickEnabled] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('SCALP');
  const [oneClickLoading, setOneClickLoading] = useState(false);

  // WALLET CONNECTION STATE
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainPositions, setChainPositions] = useState([]);
  const [usdcBalance, setUsdcBalance] = useState(null);
  const [prices, setPrices] = useState({});
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [isBotWallet, setIsBotWallet] = useState(false);

  const asset = ASSETS[selectedAsset];
  const tvSymbol = TV_SYMBOLS[selectedAsset];
  const positionSize = parseFloat(collateral || 0) * leverage;

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

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // WALLET CONNECTION
  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        showToast('Please install MetaMask!', 'error');
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      
      if (parseInt(chainId, 16) !== ARBITRUM_CONFIG.chainId) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: ARBITRUM_CONFIG.chainIdHex }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: ARBITRUM_CONFIG.chainIdHex,
                chainName: ARBITRUM_CONFIG.name,
                rpcUrls: [ARBITRUM_CONFIG.rpcUrl],
                blockExplorerUrls: [ARBITRUM_CONFIG.explorer],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
              }],
            });
          } else {
            showToast('Please switch to Arbitrum', 'error');
            return;
          }
        }
      }

      const web3Provider = new BrowserProvider(window.ethereum);
      const web3Signer = await web3Provider.getSigner();
      const address = accounts[0];

      setProvider(web3Provider);
      setSigner(web3Signer);
      setWalletAddress(address);
      setWalletConnected(true);

      const isBot = BOT_WALLETS.some(w => w.toLowerCase() === address.toLowerCase());
      setIsBotWallet(isBot);

      await fetchOnChainData(address);
      showToast('Wallet connected!', 'success');

      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else {
          setWalletAddress(accounts[0]);
          fetchOnChainData(accounts[0]);
        }
      });

    } catch (err) {
      console.error('Connection error:', err);
      showToast('Failed to connect', 'error');
    }
  };

  const disconnectWallet = () => {
    setProvider(null);
    setSigner(null);
    setWalletAddress(null);
    setWalletConnected(false);
    setChainPositions([]);
    setUsdcBalance(null);
    setIsBotWallet(false);
  };

  // FETCH PRICES
  const fetchPrices = useCallback(async () => {
    try {
      const [btcRes, ethRes] = await Promise.all([
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
        fetch('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
      ]);
      
      const btcData = await btcRes.json();
      const ethData = await ethRes.json();
      
      const newPrices = {
        0: parseFloat(btcData.price),
        1: parseFloat(ethData.price),
      };
      
      try {
        const metalsRes = await fetch('https://data-asg.goldprice.org/dbXRates/USD');
        const metalsData = await metalsRes.json();
        if (metalsData?.items?.[0]) {
          newPrices[10] = parseFloat(metalsData.items[0].xauPrice);
          newPrices[11] = parseFloat(metalsData.items[0].xagPrice);
        }
      } catch (e) {
        newPrices[10] = 2650;
        newPrices[11] = 31;
      }
      
      setPrices(newPrices);
      return newPrices;
    } catch (err) {
      console.error('Price fetch error:', err);
      return prices;
    }
  }, [prices]);

  // FETCH ON-CHAIN DATA
  const fetchOnChainData = useCallback(async (address) => {
    if (!address) return;
    setPositionsLoading(true);
    
    try {
      const currentPrices = await fetchPrices();
      const readProvider = new JsonRpcProvider(ARBITRUM_CONFIG.rpcUrl);
      const storage = new Contract(GTRADE_CONTRACTS.STORAGE, STORAGE_ABI, readProvider);
      const usdc = new Contract(GTRADE_CONTRACTS.USDC, ERC20_ABI, readProvider);
      
      const bal = await usdc.balanceOf(address);
      const balUsd = parseFloat(ethers.formatUnits(bal, 6));
      setUsdcBalance(balUsd);
      
      const newPositions = [];
      const pairIndices = [0, 1, 10, 11];
      
      for (const pairIndex of pairIndices) {
        try {
          const count = await storage.openTradesCount(address, pairIndex);
          
          for (let i = 0; i < Number(count); i++) {
            const trade = await storage.openTrades(address, pairIndex, i);
            
            if (trade.trader !== ethers.ZeroAddress) {
              const position = {
                pairIndex: Number(trade.pairIndex),
                index: Number(trade.index),
                collateral: parseFloat(ethers.formatUnits(trade.initialPosToken, 6)),
                size: parseFloat(ethers.formatUnits(trade.positionSizeUsd, 18)),
                openPrice: parseFloat(ethers.formatUnits(trade.openPrice, 10)),
                isLong: trade.buy,
                leverage: Number(trade.leverage) / 1e10,
                tp: parseFloat(ethers.formatUnits(trade.tp, 10)),
                sl: parseFloat(ethers.formatUnits(trade.sl, 10)),
                timestamp: Number(trade.timestamp),
                asset: PAIR_INDEX_TO_ASSET[Number(trade.pairIndex)] || 'Unknown',
              };
              
              const currentPrice = currentPrices[position.pairIndex] || position.openPrice;
              const priceDiff = position.isLong 
                ? currentPrice - position.openPrice 
                : position.openPrice - currentPrice;
              const pnlPercent = (priceDiff / position.openPrice) * 100;
              const pnlUsd = position.size * (pnlPercent / 100);
              
              position.currentPrice = currentPrice;
              position.pnlPercent = pnlPercent;
              position.pnlUsd = pnlUsd;
              
              newPositions.push(position);
            }
          }
        } catch (err) {
          console.error(`Error fetching pair ${pairIndex}:`, err);
        }
      }
      
      setChainPositions(newPositions);
    } catch (err) {
      console.error('On-chain fetch error:', err);
      showToast('Failed to fetch positions', 'error');
    } finally {
      setPositionsLoading(false);
    }
  }, [fetchPrices]);

  // CLOSE POSITION ON-CHAIN
  const closePositionOnChain = async (pairIndex, index) => {
    if (!signer) {
      showToast('Please connect wallet', 'error');
      return;
    }
    
    const confirmed = window.confirm('Close this position at market price?');
    if (!confirmed) return;
    
    setLoading(true);
    try {
      const trading = new Contract(GTRADE_CONTRACTS.TRADING, TRADING_ABI, signer);
      showToast('Submitting close order...', 'info');
      
      const tx = await trading.closeTradeMarket(pairIndex, index);
      showToast('Transaction submitted...', 'info');
      
      await tx.wait();
      showToast('Position closed!', 'success');
      
      setTimeout(() => fetchOnChainData(walletAddress), 2000);
    } catch (err) {
      console.error('Close error:', err);
      showToast(`Close failed: ${err.message?.slice(0, 50)}`, 'error');
    } finally {
      setLoading(false);
    }
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

  const fetchPositions = async () => {
    try {
      const result = await apiCall('POSITIONS');
      if (result.positions) setPositions(result.positions);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const result = await apiCall('BALANCE');
      if (result.balance !== undefined) setBalance(result.balance);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

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
      
      if (orderType === 'LIMIT' && limitPrice) tradeParams.limitPrice = parseFloat(limitPrice);
      if (takeProfit) tradeParams.takeProfit = parseFloat(takeProfit);
      if (stopLoss) tradeParams.stopLoss = parseFloat(stopLoss);
      
      const result = await apiCall('OPEN_TRADE', tradeParams);
      
      if (result.success) {
        const orderTypeLabel = orderType === 'LIMIT' ? 'Limit order placed' : `${direction} position opened`;
        showToast(`${orderTypeLabel}!`, 'success');
        fetchPositions();
        fetchBalance();
        if (walletConnected) fetchOnChainData(walletAddress);
        setTakeProfit('');
        setStopLoss('');
        if (orderType === 'LIMIT') setLimitPrice('');
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
        if (walletConnected) fetchOnChainData(walletAddress);
      } else {
        showToast(result.error || 'Failed to close', 'error');
      }
    } catch (error) {
      showToast('Failed to close position', 'error');
    }
    setLoading(false);
  };

  // ONE-CLICK TRADE EXECUTION
  const executeOneClickTrade = async (dir) => {
    if (!marketOpen) {
      showToast('Market closed for commodities', 'error');
      return;
    }
    
    const preset = ONE_CLICK_PRESETS[selectedPreset];
    setOneClickLoading(true);
    
    try {
      // Calculate TP/SL based on current price direction
      const tradeParams = {
        asset: selectedAsset,
        direction: dir,
        collateral: preset.collateral,
        leverage: preset.leverage,
        orderType: 'MARKET',
        // TP/SL will be calculated by Lambda based on entry price
        tpPercent: preset.tpPercent,
        slPercent: preset.slPercent,
      };
      
      const result = await apiCall('OPEN_TRADE', tradeParams);
      
      if (result.success) {
        showToast(`⚡ ${preset.name} ${dir} opened!`, 'success');
        fetchPositions();
        fetchBalance();
        if (walletConnected) fetchOnChainData(walletAddress);
      } else {
        showToast(result.error || 'Trade failed', 'error');
      }
    } catch (error) {
      showToast('One-click trade failed', 'error');
    }
    setOneClickLoading(false);
  };

  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 480);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchPositions();
    fetchBalance();
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!walletConnected || !walletAddress) return;
    const interval = setInterval(() => fetchOnChainData(walletAddress), 15000);
    return () => clearInterval(interval);
  }, [walletConnected, walletAddress, fetchOnChainData]);

  useEffect(() => {
    if (window.ethereum?.selectedAddress) connectWallet();
  }, []);

  const formatPrice = (price, pairIndex) => {
    if (pairIndex === 11) return price?.toFixed(3);
    return price?.toFixed(2);
  };

  const totalExposure = chainPositions.reduce((sum, p) => sum + p.size, 0);
  const totalPnl = chainPositions.reduce((sum, p) => sum + p.pnlUsd, 0);

  // Collapsed State
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
        onMouseEnter={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 6px 30px rgba(255, 215, 0, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isMobile) {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(255, 215, 0, 0.4)';
          }
        }}
      >
        <span style={{ fontSize: isMobile ? '18px' : '24px' }}>👁️</span>
        {chainPositions.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '-5px',
            right: '-5px',
            background: '#ff4444',
            color: '#fff',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
          }}>
            {chainPositions.length}
          </div>
        )}
      </div>
    );
  }

  // Expanded State
  return (
    <div style={{
      position: 'fixed',
      bottom: isMobile ? '10px' : '20px',
      left: isMobile ? '10px' : '20px',
      right: isMobile ? '10px' : 'auto',
      width: isMobile ? 'auto' : '420px',
      maxWidth: '420px',
      maxHeight: isMobile ? '85vh' : '90vh',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #0d0d1a 100%)',
      borderRadius: isMobile ? '12px' : '16px',
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
          <span style={{ fontSize: '20px' }}>👁️</span>
          <div>
            <div style={{ color: '#FFD700', fontWeight: 700, fontSize: '13px', fontFamily: "'Orbitron', sans-serif" }}>
              PHANTOM ARB METALS+
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#888' }}>
              <ArbitrumLogo size={12} />
              <span style={{ color: '#12AAFF' }}>Arbitrum</span>
              {isBotWallet && (
                <span style={{ color: '#00ff88', background: 'rgba(0, 255, 136, 0.1)', padding: '1px 6px', borderRadius: '4px', marginLeft: '4px' }}>
                  🤖 BOT
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={walletConnected ? disconnectWallet : connectWallet}
            style={{
              background: walletConnected ? 'rgba(0, 255, 136, 0.1)' : 'linear-gradient(135deg, #FFD700, #FFA500)',
              border: walletConnected ? '1px solid #00ff88' : 'none',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '10px',
              fontWeight: 600,
              color: walletConnected ? '#00ff88' : '#000',
              cursor: 'pointer',
            }}
          >
            {walletConnected ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '🔗 Connect'}
          </button>
          <button onClick={() => setIsExpanded(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '20px', padding: '4px' }}>
            ×
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {walletConnected && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          padding: '10px 12px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderBottom: '1px solid rgba(255, 215, 0, 0.1)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>BALANCE</div>
            <div style={{ fontSize: '12px', color: '#FFD700', fontWeight: 600 }}>${usdcBalance?.toFixed(2) || '0.00'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>POSITIONS</div>
            <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>{chainPositions.length}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>EXPOSURE</div>
            <div style={{ fontSize: '12px', color: '#fff', fontWeight: 600 }}>${totalExposure.toFixed(0)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '9px', color: '#888', marginBottom: '2px' }}>P&L</div>
            <div style={{ fontSize: '12px', color: totalPnl >= 0 ? '#00ff88' : '#ff4444', fontWeight: 600 }}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Ticker Tape */}
      <div style={{ borderBottom: '1px solid rgba(255, 215, 0, 0.1)', background: 'rgba(0, 0, 0, 0.2)' }}>
        <TradingViewTickerTape />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255, 215, 0, 0.1)' }}>
        {[
          { id: 'trade', label: '📈 TRADE' },
          { id: 'positions', label: `📊 POSITIONS${chainPositions.length > 0 ? ` (${chainPositions.length})` : ''}` },
          { id: 'learn', label: '📚 INFO' },
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
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: selectedAsset === key ? '1px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: selectedAsset === key ? 'rgba(255, 215, 0, 0.1)' : 'rgba(0, 0, 0, 0.3)',
                      color: selectedAsset === key ? '#FFD700' : '#888',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    {ASSETS[key].icon} {key}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart */}
            <div style={{ borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
              <TradingViewMiniSymbol symbol={tvSymbol} height={180} />
            </div>

            {/* Market Warning */}
            {isCommodity && !marketOpen && (
              <div style={{
                background: 'rgba(255, 152, 0, 0.1)',
                border: '1px solid rgba(255, 152, 0, 0.3)',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '12px',
                fontSize: '11px',
                color: '#FF9800',
                textAlign: 'center',
              }}>
                ⚠️ Commodities market is closed (weekends)
              </div>
            )}

            {/* Direction */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {['LONG', 'SHORT'].map((dir) => (
                <button
                  key={dir}
                  onClick={() => setDirection(dir)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: direction === dir 
                      ? (dir === 'LONG' ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : 'linear-gradient(135deg, #ff4444, #cc0000)')
                      : 'rgba(0, 0, 0, 0.3)',
                    color: direction === dir ? (dir === 'LONG' ? '#000' : '#fff') : '#666',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {dir === 'LONG' ? '📈' : '📉'} {dir}
                </button>
              ))}
            </div>

            {/* Collateral */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '6px' }}>Collateral (USDC)</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  value={collateral}
                  onChange={(e) => setCollateral(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  placeholder="50"
                />
                {[25, 50, 100].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCollateral(amt.toString())}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 215, 0, 0.2)',
                      background: collateral === amt.toString() ? 'rgba(255, 215, 0, 0.2)' : 'rgba(0, 0, 0, 0.3)',
                      color: '#FFD700',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            {/* Leverage */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '11px', color: '#888' }}>Leverage</label>
                <span style={{ color: '#FFD700', fontWeight: 700, fontSize: '14px', background: 'rgba(255, 215, 0, 0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                  {leverage}x
                </span>
              </div>
              <input
                type="range"
                min={asset.minLev}
                max={asset.maxLev}
                value={leverage}
                onChange={(e) => setLeverage(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#FFD700' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666', marginTop: '4px' }}>
                <span>{asset.minLev}x</span>
                <span>{asset.maxLev}x</span>
              </div>
            </div>

            {/* Advanced Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                background: 'transparent',
                color: '#888',
                cursor: 'pointer',
                fontSize: '11px',
                marginBottom: '12px',
              }}
            >
              ⚙️ Advanced {showAdvanced ? '▲' : '▼'}
            </button>

            {/* Advanced Options */}
            {showAdvanced && (
              <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '4px' }}>Order Type</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {['MARKET', 'LIMIT'].map((type) => (
                      <button
                        key={type}
                        onClick={() => setOrderType(type)}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '6px',
                          border: orderType === type ? '1px solid #FFD700' : '1px solid rgba(255, 255, 255, 0.1)',
                          background: orderType === type ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                          color: orderType === type ? '#FFD700' : '#888',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {orderType === 'LIMIT' && (
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '10px', color: '#888', display: 'block', marginBottom: '4px' }}>Limit Price (USD)</label>
                    <input
                      type="number"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder="Enter limit price"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 191, 255, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#00BFFF',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10px', color: '#00ff88', display: 'block', marginBottom: '4px' }}>Take Profit (USD)</label>
                    <input
                      type="number"
                      value={takeProfit}
                      onChange={(e) => setTakeProfit(e.target.value)}
                      placeholder="TP Price"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(0, 255, 136, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#00ff88',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10px', color: '#ff4444', display: 'block', marginBottom: '4px' }}>Stop Loss (USD)</label>
                    <input
                      type="number"
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="SL Price"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 68, 68, 0.3)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#ff4444',
                        fontSize: '12px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Position Info */}
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: '8px', padding: '10px', marginBottom: '12px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#888' }}>Position Size</span>
                <span style={{ color: '#fff', fontWeight: 600 }}>${positionSize.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              {takeProfit && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#00ff88' }}>Take Profit</span>
                  <span style={{ color: '#00ff88', fontWeight: 600 }}>${parseFloat(takeProfit).toLocaleString()}</span>
                </div>
              )}
              {stopLoss && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#ff4444' }}>Stop Loss</span>
                  <span style={{ color: '#ff4444', fontWeight: 600 }}>${parseFloat(stopLoss).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Open Trade Button */}
            <button
              onClick={openTrade}
              disabled={loading || !marketOpen || parseFloat(collateral) < 5 || (orderType === 'LIMIT' && !limitPrice)}
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
              }}
            >
              {loading ? '⏳ Processing...' : orderType === 'LIMIT' ? `📋 Place Limit ${direction}` : `⚡ Market ${direction}`}
            </button>

            {/* One-Click Trading Section */}
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.05), rgba(255, 165, 0, 0.05))',
              borderRadius: '10px',
              border: '1px solid rgba(255, 215, 0, 0.2)',
            }}>
              {/* Header */}
              <div 
                onClick={() => setOneClickEnabled(!oneClickEnabled)}
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  cursor: 'pointer',
                  marginBottom: oneClickEnabled ? '12px' : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '14px' }}>⚡</span>
                  <span style={{ color: '#FFD700', fontSize: '12px', fontWeight: 700 }}>
                    ONE-CLICK TRADING
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    color: oneClickEnabled ? '#00ff88' : '#666', 
                    fontSize: '10px',
                    background: oneClickEnabled ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}>
                    {oneClickEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                  <span style={{ color: '#888', fontSize: '12px' }}>
                    {oneClickEnabled ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* One-Click Panel */}
              {oneClickEnabled && (
                <>
                  {/* Preset Selection */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                    {Object.entries(ONE_CLICK_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedPreset(key)}
                        style={{
                          flex: 1,
                          padding: '8px 4px',
                          borderRadius: '6px',
                          border: selectedPreset === key ? `1px solid ${preset.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                          background: selectedPreset === key ? `${preset.color}15` : 'rgba(0, 0, 0, 0.3)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div style={{ color: selectedPreset === key ? preset.color : '#888', fontSize: '11px', fontWeight: 600 }}>
                          {preset.name}
                        </div>
                        <div style={{ color: '#666', fontSize: '9px', marginTop: '2px' }}>
                          {preset.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Preset Details */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    marginBottom: '10px',
                    fontSize: '10px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888' }}>
                      <span>Collateral: <span style={{ color: '#fff' }}>${ONE_CLICK_PRESETS[selectedPreset].collateral}</span></span>
                      <span>Leverage: <span style={{ color: '#FFD700' }}>{ONE_CLICK_PRESETS[selectedPreset].leverage}x</span></span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', marginTop: '4px' }}>
                      <span>TP: <span style={{ color: '#00ff88' }}>+{ONE_CLICK_PRESETS[selectedPreset].tpPercent}%</span></span>
                      <span>SL: <span style={{ color: '#ff4444' }}>-{ONE_CLICK_PRESETS[selectedPreset].slPercent}%</span></span>
                    </div>
                    <div style={{ color: '#666', marginTop: '4px', textAlign: 'center' }}>
                      Position: ${ONE_CLICK_PRESETS[selectedPreset].collateral * ONE_CLICK_PRESETS[selectedPreset].leverage}
                    </div>
                  </div>

                  {/* Quick Trade Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => executeOneClickTrade('LONG')}
                      disabled={oneClickLoading || !marketOpen}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: marketOpen ? 'linear-gradient(135deg, #00ff88, #00cc6a)' : '#333',
                        color: '#000',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: oneClickLoading || !marketOpen ? 'not-allowed' : 'pointer',
                        opacity: oneClickLoading ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      {oneClickLoading ? '⏳' : '📈'} LONG {selectedAsset}
                    </button>
                    <button
                      onClick={() => executeOneClickTrade('SHORT')}
                      disabled={oneClickLoading || !marketOpen}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '8px',
                        border: 'none',
                        background: marketOpen ? 'linear-gradient(135deg, #ff4444, #cc0000)' : '#333',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: oneClickLoading || !marketOpen ? 'not-allowed' : 'pointer',
                        opacity: oneClickLoading ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      {oneClickLoading ? '⏳' : '📉'} SHORT {selectedAsset}
                    </button>
                  </div>

                  {/* Warning */}
                  <div style={{
                    marginTop: '8px',
                    padding: '6px 8px',
                    background: 'rgba(255, 152, 0, 0.1)',
                    borderRadius: '4px',
                    fontSize: '9px',
                    color: '#FF9800',
                    textAlign: 'center',
                  }}>
                    ⚠️ One-click trades execute immediately at market price
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* POSITIONS TAB */}
        {activeTab === 'positions' && (
          <div style={{ padding: '12px' }}>
            {walletConnected && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>Live from gTrade • Auto-refresh 15s</span>
                <button
                  onClick={() => fetchOnChainData(walletAddress)}
                  disabled={positionsLoading}
                  style={{
                    background: 'rgba(255, 215, 0, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    color: '#FFD700',
                    cursor: positionsLoading ? 'not-allowed' : 'pointer',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {positionsLoading ? '⏳' : '🔄'} Refresh
                </button>
              </div>
            )}

            {!walletConnected ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔗</div>
                <div style={{ fontSize: '13px', marginBottom: '12px' }}>Connect wallet to view positions</div>
                <button
                  onClick={connectWallet}
                  style={{
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    color: '#000',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Connect Wallet
                </button>
              </div>
            ) : chainPositions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                <div style={{ fontSize: '13px' }}>No open positions</div>
                <div style={{ fontSize: '11px', marginTop: '4px' }}>Open a trade to get started</div>
              </div>
            ) : (
              chainPositions.map((pos) => (
                <div
                  key={`${pos.pairIndex}-${pos.index}`}
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '10px',
                    padding: '12px',
                    marginBottom: '10px',
                    border: `1px solid ${pos.pnlUsd >= 0 ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 68, 0.2)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{ASSETS[pos.asset]?.icon || '?'}</span>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 600, fontSize: '14px' }}>{pos.asset}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                          <span style={{ color: pos.isLong ? '#00ff88' : '#ff4444', fontWeight: 700 }}>
                            {pos.isLong ? 'LONG' : 'SHORT'}
                          </span>
                          <span style={{ background: 'rgba(255, 215, 0, 0.2)', color: '#FFD700', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 600 }}>
                            {pos.leverage.toFixed(0)}x
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: pos.pnlUsd >= 0 ? '#00ff88' : '#ff4444', fontWeight: 700, fontSize: '16px' }}>
                        {pos.pnlUsd >= 0 ? '+' : ''}${pos.pnlUsd.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '11px', color: pos.pnlPercent >= 0 ? '#00ff88' : '#ff4444' }}>
                        ({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '11px', marginBottom: '10px' }}>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#888', marginBottom: '2px' }}>Size</div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>${pos.size.toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#888', marginBottom: '2px' }}>Collateral</div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>${pos.collateral.toFixed(2)}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#888', marginBottom: '2px' }}>Entry</div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>${formatPrice(pos.openPrice, pos.pairIndex)}</div>
                    </div>
                    <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '6px' }}>
                      <div style={{ color: '#888', marginBottom: '2px' }}>Current</div>
                      <div style={{ color: '#fff', fontWeight: 600 }}>${formatPrice(pos.currentPrice, pos.pairIndex)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', fontSize: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1, padding: '6px 8px', background: 'rgba(0, 255, 136, 0.05)', borderRadius: '4px', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
                      <span style={{ color: '#00ff88' }}>TP: </span>
                      <span style={{ color: '#fff' }}>${formatPrice(pos.tp, pos.pairIndex)}</span>
                    </div>
                    <div style={{ flex: 1, padding: '6px 8px', background: 'rgba(255, 68, 68, 0.05)', borderRadius: '4px', border: '1px solid rgba(255, 68, 68, 0.2)' }}>
                      <span style={{ color: '#ff4444' }}>SL: </span>
                      <span style={{ color: '#fff' }}>${formatPrice(pos.sl, pos.pairIndex)}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => closePositionOnChain(pos.pairIndex, pos.index)}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #ff4444',
                      background: 'rgba(255, 68, 68, 0.1)',
                      color: '#ff4444',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {loading ? '⏳ Closing...' : '✕ Close Position'}
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'learn' && (
          <div style={{ padding: '16px' }}>
            <div style={{ background: 'rgba(255, 215, 0, 0.1)', borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
              <h3 style={{ color: '#FFD700', margin: '0 0 8px 0', fontSize: '14px' }}>👁️ Phantom Arbitrum Metals+</h3>
              <p style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                Trade BTC, ETH, Gold, and Silver with up to 150x leverage on Arbitrum via gTrade. Connect your wallet to see live positions!
              </p>
            </div>

            {/* One-Click Info */}
            <div style={{ background: 'rgba(255, 215, 0, 0.05)', borderRadius: '10px', padding: '16px', marginBottom: '12px', border: '1px solid rgba(255, 215, 0, 0.1)' }}>
              <h3 style={{ color: '#FFD700', margin: '0 0 8px 0', fontSize: '14px' }}>⚡ One-Click Trading</h3>
              <p style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5, margin: '0 0 8px 0' }}>
                Pre-configured trade presets for instant execution:
              </p>
              <div style={{ fontSize: '11px', color: '#888' }}>
                <div style={{ marginBottom: '4px' }}>• <span style={{ color: '#FFD700' }}>Scalp</span>: $25 @ 50x, TP 0.5%, SL 0.3%</div>
                <div style={{ marginBottom: '4px' }}>• <span style={{ color: '#00ff88' }}>Swing</span>: $50 @ 20x, TP 1.5%, SL 1.0%</div>
                <div>• <span style={{ color: '#00BFFF' }}>Position</span>: $100 @ 10x, TP 3.0%, SL 2.0%</div>
              </div>
            </div>

            <div style={{ background: 'rgba(0, 255, 136, 0.05)', borderRadius: '10px', padding: '16px', marginBottom: '12px', border: '1px solid rgba(0, 255, 136, 0.2)' }}>
              <h3 style={{ color: '#00ff88', margin: '0 0 8px 0', fontSize: '14px' }}>🤖 PHANTOM EDGE Bots</h3>
              <p style={{ color: '#ccc', fontSize: '12px', lineHeight: 1.5, margin: 0 }}>
                Auto-trading bots run 24/7 on AWS Lambda. Connect the bot wallet to monitor positions and P&L in real-time.
              </p>
              <div style={{ marginTop: '10px', fontSize: '10px', color: '#888' }}>
                <div>Main Bot: 0x978c...e87c</div>
                <div>Weekend Warrior: 0x4394...9bf9</div>
              </div>
            </div>
            
            <div style={{ fontSize: '12px', color: '#888' }}>
              <div style={{ marginBottom: '12px' }}><strong style={{ color: '#FFD700' }}>📈 Long</strong>: Profit when price goes up</div>
              <div style={{ marginBottom: '12px' }}><strong style={{ color: '#FFD700' }}>📉 Short</strong>: Profit when price goes down</div>
              <div style={{ marginBottom: '12px' }}><strong style={{ color: '#FFD700' }}>⚡ Leverage</strong>: Multiply your position size</div>
              <div><strong style={{ color: '#ff4444' }}>⚠️ Risk</strong>: Higher leverage = higher liquidation risk</div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
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
