/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 V4 DeFi GOLD SUITE v2.0 🏆
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Full DeFi Suite for PulseChain
 * - Swap: Any token ↔ Any token
 * - Portfolio: Full wallet scanner via PulseScan API with USD values
 * - Create LP: Any PulseX pair
 * 
 * @version 2.0.0
 * - Fixed URMOM/DTGC addresses
 * - Added all major PulseX tokens
 * - Dynamic LP pair creation
 * - USD values everywhere
 * - Better approval handling
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  RPC_URL: 'https://pulsechain.publicnode.com',
  ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
  
  FEES: {
    BURN_BPS: 35,
    DEV_BPS: 35,
    TOTAL_BPS: 70,
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  PULSESCAN_API: 'https://api.scan.pulsechain.com/api/v2',
  
  SLIPPAGE_BPS: 300,
  DEADLINE_MINUTES: 20,
  EXPLORER: 'https://scan.pulsechain.com',
};

// All major PulseX tokens - VERIFIED ADDRESSES (lowercase to avoid checksum issues)
const TOKENS = {
  PLS: { 
    address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
    symbol: 'PLS', 
    name: 'PulseChain', 
    decimals: 18, 
    logo: '💜', 
    isNative: true,
  },
  DTGC: { 
    address: '0xd0676b28a457371d58d47e5247b439114e40eb0f', 
    symbol: 'DTGC', 
    name: 'DT Gold Coin', 
    decimals: 18, 
    logo: '🪙',
    isNative: false,
  },
  URMOM: { 
    address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0',
    symbol: 'URMOM', 
    name: 'URMOM', 
    decimals: 18, 
    logo: '🔥',
    isNative: false,
  },
  PLSX: { 
    address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', 
    symbol: 'PLSX', 
    name: 'PulseX', 
    decimals: 18, 
    logo: '🔷',
    isNative: false,
  },
  HEX: { 
    address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', 
    symbol: 'HEX', 
    name: 'HEX', 
    decimals: 8, 
    logo: '⬡',
    isNative: false,
  },
  INC: { 
    address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', 
    symbol: 'INC', 
    name: 'Incentive', 
    decimals: 18, 
    logo: '💎',
    isNative: false,
  },
  DAI: { 
    address: '0xefd766ccb38eaf1dfd701853bfce31359239f305', 
    symbol: 'DAI', 
    name: 'DAI from ETH', 
    decimals: 18, 
    logo: '📀',
    isNative: false,
  },
  USDC: { 
    address: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07', 
    symbol: 'USDC', 
    name: 'USDC from ETH', 
    decimals: 6, 
    logo: '💵',
    isNative: false,
  },
  USDT: { 
    address: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f', 
    symbol: 'USDT', 
    name: 'USDT from ETH', 
    decimals: 6, 
    logo: '💵',
    isNative: false,
  },
  WETH: { 
    address: '0x02dcdd04e3f455d838cd1249292c58f3b79e3c3c', 
    symbol: 'WETH', 
    name: 'WETH from ETH', 
    decimals: 18, 
    logo: '🔹',
    isNative: false,
  },
  WBTC: { 
    address: '0xb17d901469b9208b17d916112988a3fed19b5ca1', 
    symbol: 'WBTC', 
    name: 'WBTC from ETH', 
    decimals: 8, 
    logo: '🟠',
    isNative: false,
  },
};

// ABIs
const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
];

const FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
];

// Helper to normalize addresses for ethers v6
const getAddr = (addr) => {
  try {
    return ethers.getAddress(addr.toLowerCase());
  } catch {
    return addr;
  }
};

// Styles
const styles = {
  container: { background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '24px', maxWidth: '520px', width: '100%', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxHeight: '90vh', overflowY: 'auto' },
  header: { textAlign: 'center', marginBottom: '24px' },
  title: { fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #D4AF37, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' },
  subtitle: { color: '#888', fontSize: '0.85rem' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '12px' },
  tab: { flex: 1, padding: '12px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s ease' },
  tabActive: { background: 'linear-gradient(135deg, #D4AF37, #B8960C)', color: '#000' },
  tabInactive: { background: 'transparent', color: '#888' },
  card: { background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' },
  label: { color: '#888', fontSize: '0.8rem', marginBottom: '8px', display: 'block' },
  inputGroup: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)', gap: '12px' },
  input: { flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', fontWeight: 600, outline: 'none', width: '100%', minWidth: 0 },
  tokenSelect: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(212, 175, 55, 0.2)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 600, minWidth: '130px', flexShrink: 0 },
  swapButton: { width: '100%', padding: '16px', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: '16px', transition: 'all 0.2s ease' },
  swapButtonDisabled: { background: 'rgba(255,255,255,0.1)', color: '#666', cursor: 'not-allowed' },
  flipButton: { width: '40px', height: '40px', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', border: 'none', borderRadius: '50%', color: '#000', fontSize: '1.2rem', cursor: 'pointer', margin: '-12px auto', display: 'block', position: 'relative', zIndex: 10 },
  balanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' },
  selectDropdown: { position: 'absolute', top: '100%', right: 0, background: '#1a1a2e', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '12px', marginTop: '8px', overflow: 'hidden', zIndex: 1000, maxHeight: '300px', overflowY: 'auto', minWidth: '280px', width: 'max-content' },
  selectOption: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', color: '#fff', transition: 'background 0.2s', borderBottom: '1px solid rgba(255,255,255,0.05)' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' },
  toast: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: '8px', color: '#fff', fontWeight: 500, zIndex: 10000, maxWidth: '90%', textAlign: 'center' },
  toastSuccess: { background: 'rgba(76, 175, 80, 0.95)' },
  toastError: { background: 'rgba(244, 67, 54, 0.95)' },
  toastInfo: { background: 'rgba(33, 150, 243, 0.95)' },
  totalPortfolio: { background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '16px', padding: '20px', marginBottom: '20px', textAlign: 'center' },
  usdValue: { color: '#4CAF50', fontSize: '0.75rem', marginTop: '2px' },
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function V4DeFiGoldSuite({ provider, signer, userAddress, onClose }) {
  const [activeTab, setActiveTab] = useState('swap');
  const [toast, setToast] = useState(null);
  
  // Swap state
  const [fromToken, setFromToken] = useState('PLS');
  const [toToken, setToToken] = useState('DTGC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);
  
  // Portfolio state
  const [walletTokens, setWalletTokens] = useState([]);
  const [lpPositions, setLpPositions] = useState([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  
  // LP Creator state
  const [lpToken0, setLpToken0] = useState('DTGC');
  const [lpToken1, setLpToken1] = useState('PLS');
  const [lpAmount0, setLpAmount0] = useState('');
  const [lpAmount1, setLpAmount1] = useState('');
  const [lpLoading, setLpLoading] = useState(false);
  const [pairAddress, setPairAddress] = useState(null);
  const [pairReserves, setPairReserves] = useState(null);
  const [showLpToken0Select, setShowLpToken0Select] = useState(false);
  const [showLpToken1Select, setShowLpToken1Select] = useState(false);
  
  // Balances for all tokens
  const [balances, setBalances] = useState({});
  
  // Live prices
  const [livePrices, setLivePrices] = useState({
    PLS: 0.000018, DTGC: 0.0002, URMOM: 0.0000001, PLSX: 0.00005, HEX: 0.003, INC: 0.0001, DAI: 1, USDC: 1, USDT: 1, WETH: 3300, WBTC: 100000,
  });

  const showToastMsg = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const formatNumber = (num, decimals = 4) => {
    if (!num || isNaN(num)) return '0';
    const n = parseFloat(num);
    if (n === 0) return '0';
    if (n < 0.000001) return '<0.000001';
    if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(decimals);
  };

  const formatUSD = (num) => {
    if (!num || isNaN(num) || num === 0) return '$0.00';
    if (num < 0.01) return '<$0.01';
    return '$' + formatNumber(num, 2);
  };

  const getDeadline = () => Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

  // Fetch live prices
  const fetchLivePrices = useCallback(async () => {
    try {
      const pairs = [
        { symbol: 'URMOM', pair: '0x0548656e272fec9534e180d3174cfc57ab6e10c0' },
        { symbol: 'DTGC', pair: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7' },
        { symbol: 'PLSX', pair: '0x1b45b9148791d3a104184cd5dfe5ce57193a3ee9' },
        { symbol: 'HEX', pair: '0xf1f4ee610b2babb05c635f726ef8b0c568c8dc65' },
      ];
      
      const newPrices = { ...livePrices };
      
      await Promise.all(pairs.map(async ({ symbol, pair }) => {
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/pairs/pulsechain/${pair}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.pair?.priceUsd) {
              newPrices[symbol] = parseFloat(data.pair.priceUsd);
              if (data.pair.priceNative && parseFloat(data.pair.priceNative) > 0) {
                newPrices.PLS = parseFloat(data.pair.priceUsd) / parseFloat(data.pair.priceNative);
              }
            }
          }
        } catch {}
      }));
      
      setLivePrices(newPrices);
    } catch (err) {
      console.log('Price fetch error:', err.message);
    }
  }, []);

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 30000);
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  // Fetch all balances
  const fetchAllBalances = useCallback(async () => {
    if (!provider || !userAddress) return;
    
    try {
      const newBalances = {};
      const plsBal = await provider.getBalance(userAddress);
      newBalances.PLS = parseFloat(ethers.formatEther(plsBal));
      
      const tokenPromises = Object.entries(TOKENS).map(async ([symbol, token]) => {
        if (token.isNative) return;
        try {
          const contract = new ethers.Contract(getAddr(token.address), ERC20_ABI, provider);
          const bal = await contract.balanceOf(userAddress);
          newBalances[symbol] = parseFloat(ethers.formatUnits(bal, token.decimals));
        } catch {
          newBalances[symbol] = 0;
        }
      });
      
      await Promise.all(tokenPromises);
      setBalances(newBalances);
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  }, [provider, userAddress]);

  useEffect(() => {
    if (userAddress && provider) fetchAllBalances();
  }, [userAddress, provider, fetchAllBalances]);

  // Wallet scanner
  const scanWalletTokens = useCallback(async () => {
    if (!provider || !userAddress) return;
    setLoadingBalances(true);
    showToastMsg('🔍 Scanning wallet...', 'info');
    
    try {
      const foundTokens = [];
      const seenAddresses = new Set();
      
      const [plsBal, pulseScanData] = await Promise.all([
        provider.getBalance(userAddress),
        fetch(`${CONFIG.PULSESCAN_API}/addresses/${userAddress}/token-balances`).then(r => r.ok ? r.json() : []).catch(() => []),
      ]);
      
      const plsBalNum = parseFloat(ethers.formatEther(plsBal));
      if (plsBalNum > 0) {
        foundTokens.push({ symbol: 'PLS', name: 'PulseChain', address: null, decimals: 18, balance: plsBalNum, icon: '💜', usdValue: plsBalNum * livePrices.PLS, price: livePrices.PLS });
      }
      setBalances(prev => ({ ...prev, PLS: plsBalNum }));
      
      if (Array.isArray(pulseScanData)) {
        for (const item of pulseScanData) {
          const tokenAddr = item.token?.address?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);
          
          const decimals = parseInt(item.token?.decimals) || 18;
          const bal = parseFloat(item.value || '0') / Math.pow(10, decimals);
          if (bal <= 0) continue;
          
          const sym = (item.token?.symbol || '').toUpperCase();
          const price = livePrices[sym] || 0;
          let icon = '🔸';
          Object.values(TOKENS).forEach(t => {
            if (t.address?.toLowerCase() === tokenAddr) icon = t.logo;
          });
          
          foundTokens.push({ symbol: item.token?.symbol || 'UNKNOWN', name: item.token?.name || 'Unknown', address: item.token?.address, decimals, balance: bal, icon, usdValue: bal * price, price });
          if (TOKENS[sym]) setBalances(prev => ({ ...prev, [sym]: bal }));
        }
      }
      
      foundTokens.sort((a, b) => (b.usdValue || 0) - (a.usdValue || 0));
      setWalletTokens(foundTokens);
      setLastScanTime(Date.now());
      const total = foundTokens.reduce((sum, t) => sum + (t.usdValue || 0), 0);
      setTotalPortfolioValue(total);
      await fetchLpPositions();
      showToastMsg(`✅ Found ${foundTokens.length} tokens (${formatUSD(total)})`, 'success');
    } catch (err) {
      console.error('Scan error:', err);
      showToastMsg('Scan failed', 'error');
    } finally {
      setLoadingBalances(false);
    }
  }, [provider, userAddress, livePrices, showToastMsg]);

  const fetchLpPositions = useCallback(async () => {
    if (!provider || !userAddress) return;
    try {
      const factory = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
      const positions = [];
      const pairsToCheck = [['DTGC', 'PLS'], ['DTGC', 'URMOM'], ['URMOM', 'PLS'], ['PLSX', 'PLS'], ['HEX', 'PLS']];
      
      await Promise.all(pairsToCheck.map(async ([sym0, sym1]) => {
        try {
          const token0 = TOKENS[sym0];
          const token1 = TOKENS[sym1];
          if (!token0 || !token1) return;
          
          const addr0 = getAddr(token0.address);
          const addr1 = getAddr(token1.address);
          
          const lpAddr = await factory.getPair(addr0, addr1);
          if (!lpAddr || lpAddr === ethers.ZeroAddress) return;
          
          const lpContract = new ethers.Contract(lpAddr, PAIR_ABI, provider);
          const lpBal = await lpContract.balanceOf(userAddress);
          const lpBalNum = parseFloat(ethers.formatEther(lpBal));
          
          if (lpBalNum > 0) positions.push({ name: `${sym0}/${sym1}`, address: lpAddr, balance: lpBalNum });
        } catch {}
      }));
      
      setLpPositions(positions);
    } catch {}
  }, [provider, userAddress]);

  useEffect(() => {
    if (activeTab === 'portfolio' && userAddress && walletTokens.length === 0) scanWalletTokens();
  }, [activeTab, userAddress, walletTokens.length, scanWalletTokens]);

  // Get quote
  const getQuote = useCallback(async (inputAmount, from, to) => {
    if (!provider || !inputAmount || parseFloat(inputAmount) <= 0) { setToAmount(''); return; }
    setQuoteLoading(true);
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, provider);
      const fromTokenData = TOKENS[from];
      const toTokenData = TOKENS[to];
      if (!fromTokenData || !toTokenData) { setToAmount(''); return; }
      
      const fromAddr = getAddr(fromTokenData.address);
      const toAddr = getAddr(toTokenData.address);
      
      const amountIn = ethers.parseUnits(inputAmount, fromTokenData.decimals);
      let path = [fromAddr, toAddr];
      let amounts;
      
      try {
        amounts = await router.getAmountsOut(amountIn, path);
      } catch {
        if (fromAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase() && toAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase()) {
          path = [fromAddr, getAddr(CONFIG.WPLS), toAddr];
          amounts = await router.getAmountsOut(amountIn, path);
        }
      }
      
      if (amounts && amounts.length > 0) {
        setToAmount(parseFloat(ethers.formatUnits(amounts[amounts.length - 1], toTokenData.decimals)).toFixed(6));
      }
    } catch (err) {
      console.error('Quote error:', err);
      setToAmount('');
    }
    setQuoteLoading(false);
  }, [provider]);

  useEffect(() => {
    const timer = setTimeout(() => { if (fromAmount && fromToken && toToken) getQuote(fromAmount, fromToken, toToken); }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, getQuote]);

  // Execute swap
  const executeSwap = async () => {
    if (!signer || !fromAmount || !toAmount) return;
    setSwapLoading(true);
    showToastMsg('Preparing swap...', 'info');
    
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
      const fromTokenData = TOKENS[fromToken];
      const toTokenData = TOKENS[toToken];
      const deadline = getDeadline();
      
      const fromAddr = getAddr(fromTokenData.address);
      const toAddr = getAddr(toTokenData.address);
      
      const inputAmount = ethers.parseUnits(fromAmount, fromTokenData.decimals);
      const expectedOutput = ethers.parseUnits(toAmount, toTokenData.decimals);
      const amountOutMin = expectedOutput * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      
      let path = [fromAddr, toAddr];
      try { await router.getAmountsOut(inputAmount, path); } catch {
        if (fromAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase() && toAddr.toLowerCase() !== CONFIG.WPLS.toLowerCase()) {
          path = [fromAddr, getAddr(CONFIG.WPLS), toAddr];
        }
      }
      
      if (fromToken === 'PLS') {
        showToastMsg('Swapping PLS...', 'info');
        const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(amountOutMin, path, userAddress, deadline, { value: inputAmount });
        await tx.wait();
      } else if (toToken === 'PLS') {
        const tokenContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < inputAmount) {
          showToastMsg('Approving ' + fromToken + '...', 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        showToastMsg('Swapping...', 'info');
        const tx = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(inputAmount, amountOutMin, path, userAddress, deadline);
        await tx.wait();
      } else {
        const tokenContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < inputAmount) {
          showToastMsg('Approving ' + fromToken + '...', 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        showToastMsg('Swapping...', 'info');
        const tx = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(inputAmount, amountOutMin, path, userAddress, deadline);
        await tx.wait();
      }
      
      showToastMsg(`✅ Swapped ${fromAmount} ${fromToken} for ${toToken}!`, 'success');
      setFromAmount(''); setToAmount('');
      fetchAllBalances();
    } catch (err) {
      console.error('Swap error:', err);
      showToastMsg(err.reason || err.message || 'Swap failed', 'error');
    }
    setSwapLoading(false);
  };

  const flipTokens = () => { setFromToken(toToken); setToToken(fromToken); setFromAmount(toAmount); setToAmount(fromAmount); };

  // LP functions
  const fetchPairInfo = useCallback(async () => {
    if (!provider || !lpToken0 || !lpToken1 || lpToken0 === lpToken1) { setPairAddress(null); setPairReserves(null); return; }
    try {
      const factory = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
      const token0 = TOKENS[lpToken0];
      const token1 = TOKENS[lpToken1];
      if (!token0 || !token1) return;
      
      const addr0 = getAddr(token0.address);
      const addr1 = getAddr(token1.address);
      
      console.log('Fetching pair for:', addr0, addr1);
      const lpAddr = await factory.getPair(addr0, addr1);
      console.log('Pair address:', lpAddr);
      
      if (lpAddr && lpAddr !== ethers.ZeroAddress) {
        setPairAddress(lpAddr);
        const pairContract = new ethers.Contract(lpAddr, PAIR_ABI, provider);
        const [reserves, pairToken0] = await Promise.all([pairContract.getReserves(), pairContract.token0()]);
        const isToken0First = pairToken0.toLowerCase() === addr0.toLowerCase();
        setPairReserves({ reserve0: isToken0First ? reserves[0] : reserves[1], reserve1: isToken0First ? reserves[1] : reserves[0] });
        console.log('Reserves:', reserves[0].toString(), reserves[1].toString());
      } else {
        setPairAddress(null); setPairReserves(null);
      }
    } catch (err) {
      console.error('Pair fetch error:', err);
      setPairAddress(null); setPairReserves(null);
    }
  }, [provider, lpToken0, lpToken1]);

  useEffect(() => { fetchPairInfo(); }, [fetchPairInfo]);

  const calculateLpAmount1 = useCallback((amount0) => {
    if (!pairReserves || !amount0 || parseFloat(amount0) <= 0) { setLpAmount1(''); return; }
    try {
      const token0 = TOKENS[lpToken0];
      const token1 = TOKENS[lpToken1];
      const amount0Wei = ethers.parseUnits(amount0, token0.decimals);
      const amount1Wei = (amount0Wei * pairReserves.reserve1) / pairReserves.reserve0;
      setLpAmount1(parseFloat(ethers.formatUnits(amount1Wei, token1.decimals)).toFixed(6));
    } catch { setLpAmount1(''); }
  }, [pairReserves, lpToken0, lpToken1]);

  useEffect(() => { const timer = setTimeout(() => { if (lpAmount0) calculateLpAmount1(lpAmount0); }, 300); return () => clearTimeout(timer); }, [lpAmount0, calculateLpAmount1]);

  const addLiquidity = async () => {
    if (!signer || !lpAmount0 || !lpAmount1) return;
    setLpLoading(true);
    showToastMsg('Preparing...', 'info');
    
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
      const token0 = TOKENS[lpToken0];
      const token1 = TOKENS[lpToken1];
      
      const addr0 = getAddr(token0.address);
      const addr1 = getAddr(token1.address);
      
      const amount0Desired = ethers.parseUnits(lpAmount0, token0.decimals);
      const amount1Desired = ethers.parseUnits(lpAmount1, token1.decimals);
      const amount0Min = amount0Desired * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      const amount1Min = amount1Desired * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      const deadline = getDeadline();
      
      if (lpToken1 === 'PLS') {
        const tokenContract = new ethers.Contract(addr0, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amount0Desired) {
          showToastMsg('Approving ' + lpToken0 + '...', 'info');
          await (await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait();
        }
        showToastMsg('Adding liquidity...', 'info');
        await (await router.addLiquidityETH(addr0, amount0Desired, amount0Min, amount1Min, userAddress, deadline, { value: amount1Desired })).wait();
      } else if (lpToken0 === 'PLS') {
        const tokenContract = new ethers.Contract(addr1, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amount1Desired) {
          showToastMsg('Approving ' + lpToken1 + '...', 'info');
          await (await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait();
        }
        showToastMsg('Adding liquidity...', 'info');
        await (await router.addLiquidityETH(addr1, amount1Desired, amount1Min, amount0Min, userAddress, deadline, { value: amount0Desired })).wait();
      } else {
        const token0Contract = new ethers.Contract(addr0, ERC20_ABI, signer);
        const token1Contract = new ethers.Contract(addr1, ERC20_ABI, signer);
        const [allowance0, allowance1] = await Promise.all([token0Contract.allowance(userAddress, CONFIG.ROUTER), token1Contract.allowance(userAddress, CONFIG.ROUTER)]);
        if (allowance0 < amount0Desired) { showToastMsg('Approving ' + lpToken0 + '...', 'info'); await (await token0Contract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        if (allowance1 < amount1Desired) { showToastMsg('Approving ' + lpToken1 + '...', 'info'); await (await token1Contract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        showToastMsg('Adding liquidity...', 'info');
        await (await router.addLiquidity(addr0, addr1, amount0Desired, amount1Desired, amount0Min, amount1Min, userAddress, deadline)).wait();
      }
      
      showToastMsg(`✅ Added ${lpToken0}/${lpToken1} liquidity!`, 'success');
      setLpAmount0(''); setLpAmount1('');
      fetchAllBalances(); fetchPairInfo();
    } catch (err) {
      console.error('LP error:', err);
      showToastMsg(err.reason || err.message || 'Failed', 'error');
    }
    setLpLoading(false);
  };

  // Token selector component
  const TokenSelector = ({ value, onChange, show, setShow, excludeToken }) => (
    <div style={{ position: 'relative' }}>
      <button style={styles.tokenSelect} onClick={(e) => { e.stopPropagation(); setShow(!show); }}>
        <span style={{ fontSize: '1.1rem' }}>{TOKENS[value]?.logo || '🔸'}</span>
        <span>{value}</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem' }}>▼</span>
      </button>
      {show && (
        <div style={styles.selectDropdown} onClick={(e) => e.stopPropagation()}>
          {Object.entries(TOKENS).filter(([sym]) => sym !== excludeToken).map(([symbol, token]) => (
            <div key={symbol} style={{ ...styles.selectOption, background: symbol === value ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}
              onClick={() => { onChange(symbol); setShow(false); }}
              onMouseEnter={(e) => e.target.style.background = 'rgba(212, 175, 55, 0.1)'}
              onMouseLeave={(e) => e.target.style.background = symbol === value ? 'rgba(212, 175, 55, 0.2)' : 'transparent'}>
              <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{token.logo}</span>
              <div style={{ minWidth: '70px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{symbol}</div>
                <div style={{ fontSize: '0.7rem', color: '#888' }}>{token.name}</div>
              </div>
              <div style={{ textAlign: 'right', marginLeft: 'auto', minWidth: '100px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{formatNumber(balances[symbol] || 0)}</div>
                <div style={{ fontSize: '0.75rem', color: '#4CAF50', whiteSpace: 'nowrap' }}>{formatUSD((balances[symbol] || 0) * (livePrices[symbol] || 0))}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    const handleClick = () => { setShowFromSelect(false); setShowToSelect(false); setShowLpToken0Select(false); setShowLpToken1Select(false); };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div style={styles.container} onClick={() => { setShowFromSelect(false); setShowToSelect(false); }}>
      <div style={styles.header}>
        <div style={styles.title}>🏆 DeFi Gold Suite</div>
        <div style={styles.subtitle}>Swap • Portfolio • Create LP</div>
      </div>
      
      <div style={styles.tabs}>
        {['swap', 'portfolio', 'create-lp'].map((tab) => (
          <button key={tab} style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : styles.tabInactive) }} onClick={() => setActiveTab(tab)}>
            {tab === 'swap' && '🔄 Swap'}{tab === 'portfolio' && '📊 Portfolio'}{tab === 'create-lp' && '💧 LP'}
          </button>
        ))}
      </div>
      
      {/* SWAP TAB */}
      {activeTab === 'swap' && (
        <div>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>From</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances[fromToken] || 0)} <span style={{ color: '#4CAF50' }}>({formatUSD((balances[fromToken] || 0) * (livePrices[fromToken] || 0))})</span></span>
            </div>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} style={styles.input} />
              <button onClick={() => setFromAmount((balances[fromToken] || 0).toString())} style={{ background: 'rgba(212,175,55,0.3)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: '#D4AF37', fontSize: '0.7rem', cursor: 'pointer', marginRight: '8px' }}>MAX</button>
              <TokenSelector value={fromToken} onChange={setFromToken} show={showFromSelect} setShow={setShowFromSelect} excludeToken={toToken} />
            </div>
            {fromAmount && livePrices[fromToken] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(fromAmount) * livePrices[fromToken])}</div>}
          </div>
          
          <button style={styles.flipButton} onClick={flipTokens}>↕</button>
          
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>To {quoteLoading && '(fetching...)'}</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances[toToken] || 0)}</span>
            </div>
            <div style={styles.inputGroup}>
              <input type="text" placeholder="0.0" value={toAmount} readOnly style={{ ...styles.input, color: '#D4AF37' }} />
              <TokenSelector value={toToken} onChange={setToToken} show={showToSelect} setShow={setShowToSelect} excludeToken={fromToken} />
            </div>
            {toAmount && livePrices[toToken] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(toAmount) * livePrices[toToken])}</div>}
          </div>
          
          {fromAmount && toAmount && (
            <div style={{ ...styles.card, padding: '12px 16px' }}>
              <div style={styles.infoRow}><span style={{ color: '#888' }}>Rate</span><span style={{ color: '#fff' }}>1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken}</span></div>
              <div style={{ ...styles.infoRow, borderBottom: 'none' }}><span style={{ color: '#888' }}>You Receive</span><span style={{ color: '#4CAF50', fontWeight: 700 }}>~{formatNumber(parseFloat(toAmount))} {toToken}</span></div>
            </div>
          )}
          
          <button style={{ ...styles.swapButton, ...(!userAddress || !fromAmount || !toAmount || swapLoading ? styles.swapButtonDisabled : {}) }} onClick={executeSwap} disabled={!userAddress || !fromAmount || !toAmount || swapLoading}>
            {!userAddress ? 'Connect Wallet' : swapLoading ? 'Swapping...' : !fromAmount ? 'Enter Amount' : `Swap ${fromToken} → ${toToken}`}
          </button>
        </div>
      )}
      
      {/* PORTFOLIO TAB */}
      {activeTab === 'portfolio' && (
        <div>
          {!userAddress ? (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Connect wallet</div>) : (
            <>
              <div style={styles.totalPortfolio}>
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>Total Portfolio Value</div>
                <div style={{ color: '#D4AF37', fontSize: '2rem', fontWeight: 700 }}>{formatUSD(totalPortfolioValue)}</div>
                {lastScanTime && <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '4px' }}>Updated: {new Date(lastScanTime).toLocaleTimeString()}</div>}
              </div>
              
              {loadingBalances ? (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>Scanning...</div>) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💰 Tokens ({walletTokens.length})</div>
                    <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                      {walletTokens.map((token, idx) => (
                        <div key={idx} style={styles.balanceRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>{token.icon}</div>
                            <div><div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{token.symbol}</div><div style={{ color: '#666', fontSize: '0.7rem' }}>{token.name?.slice(0, 18)}</div></div>
                          </div>
                          <div style={{ textAlign: 'right' }}><div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{formatNumber(token.balance)}</div><div style={{ color: '#4CAF50', fontSize: '0.75rem' }}>{formatUSD(token.usdValue)}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {lpPositions.length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💧 LP Positions ({lpPositions.length})</div>
                      {lpPositions.map((lp, idx) => (
                        <div key={idx} style={styles.balanceRow}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(0,188,212,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>🔷</div>
                            <div><div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{lp.name}</div><div style={{ color: '#666', fontSize: '0.7rem' }}>PulseX LP</div></div>
                          </div>
                          <div style={{ textAlign: 'right' }}><div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>{formatNumber(lp.balance)}</div><a href={`${CONFIG.EXPLORER}/address/${lp.address}`} target="_blank" rel="noopener noreferrer" style={{ color: '#D4AF37', fontSize: '0.65rem', textDecoration: 'none' }}>View ↗</a></div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              
              <button onClick={() => { setWalletTokens([]); scanWalletTokens(); }} disabled={loadingBalances} style={{ ...styles.swapButton, background: loadingBalances ? 'rgba(255,255,255,0.1)' : 'rgba(212,175,55,0.2)', color: loadingBalances ? '#666' : '#D4AF37' }}>
                {loadingBalances ? '🔍 Scanning...' : '🔄 Refresh All'}
              </button>
            </>
          )}
        </div>
      )}
      
      {/* CREATE LP TAB */}
      {activeTab === 'create-lp' && (
        <div>
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>Token 1</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances[lpToken0] || 0)} <span style={{ color: '#4CAF50' }}>({formatUSD((balances[lpToken0] || 0) * (livePrices[lpToken0] || 0))})</span></span>
            </div>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={lpAmount0} onChange={(e) => setLpAmount0(e.target.value)} style={styles.input} />
              <button onClick={() => setLpAmount0((balances[lpToken0] || 0).toString())} style={{ background: 'rgba(212,175,55,0.3)', border: 'none', borderRadius: '6px', padding: '4px 8px', color: '#D4AF37', fontSize: '0.7rem', cursor: 'pointer', marginRight: '8px' }}>MAX</button>
              <TokenSelector value={lpToken0} onChange={(v) => { setLpToken0(v); setLpAmount0(''); setLpAmount1(''); }} show={showLpToken0Select} setShow={setShowLpToken0Select} excludeToken={lpToken1} />
            </div>
            {lpAmount0 && livePrices[lpToken0] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(lpAmount0) * livePrices[lpToken0])}</div>}
          </div>
          
          <div style={{ textAlign: 'center', margin: '-8px 0', fontSize: '1.5rem', color: '#D4AF37' }}>+</div>
          
          <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={styles.label}>Token 2 {pairReserves ? '(auto)' : ''}</span>
              <span style={{ color: '#888', fontSize: '0.75rem' }}>Balance: {formatNumber(balances[lpToken1] || 0)}</span>
            </div>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={lpAmount1} onChange={(e) => !pairReserves && setLpAmount1(e.target.value)} readOnly={!!pairReserves} style={{ ...styles.input, color: pairReserves ? '#D4AF37' : '#fff' }} />
              <TokenSelector value={lpToken1} onChange={(v) => { setLpToken1(v); setLpAmount0(''); setLpAmount1(''); }} show={showLpToken1Select} setShow={setShowLpToken1Select} excludeToken={lpToken0} />
            </div>
            {lpAmount1 && livePrices[lpToken1] && <div style={styles.usdValue}>≈ {formatUSD(parseFloat(lpAmount1) * livePrices[lpToken1])}</div>}
          </div>
          
          <div style={{ ...styles.card, padding: '12px 16px' }}>
            <div style={styles.infoRow}><span style={{ color: '#888' }}>Pair</span><span style={{ color: '#fff', fontWeight: 600 }}>{lpToken0}/{lpToken1}</span></div>
            <div style={styles.infoRow}><span style={{ color: '#888' }}>Status</span><span style={{ color: pairAddress ? '#4CAF50' : '#FF9800' }}>{pairAddress ? '✓ Pool Exists' : '⚠️ New Pool'}</span></div>
            {lpAmount0 && lpAmount1 && (<div style={{ ...styles.infoRow, borderBottom: 'none' }}><span style={{ color: '#888' }}>Total Value</span><span style={{ color: '#4CAF50', fontWeight: 700 }}>{formatUSD((parseFloat(lpAmount0) * (livePrices[lpToken0] || 0)) + (parseFloat(lpAmount1) * (livePrices[lpToken1] || 0)))}</span></div>)}
          </div>
          
          <button style={{ ...styles.swapButton, ...(!userAddress || !lpAmount0 || !lpAmount1 || lpLoading ? styles.swapButtonDisabled : {}) }} onClick={addLiquidity} disabled={!userAddress || !lpAmount0 || !lpAmount1 || lpLoading}>
            {!userAddress ? 'Connect Wallet' : lpLoading ? 'Adding...' : !lpAmount0 ? 'Enter Amount' : `Add ${lpToken0}/${lpToken1} Liquidity`}
          </button>
          
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(244,67,54,0.1)', borderRadius: '8px', border: '1px solid rgba(244,67,54,0.3)' }}>
            <div style={{ color: '#F44336', fontSize: '0.75rem' }}>⚠️ <strong>IL Warning:</strong> Providing liquidity involves impermanent loss risk.</div>
          </div>
        </div>
      )}
      
      {onClose && <button onClick={onClose} style={{ width: '100%', marginTop: '16px', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#888', cursor: 'pointer' }}>← Back to Staking</button>}
      {toast && <div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo) }}>{toast.message}</div>}
    </div>
  );
}
