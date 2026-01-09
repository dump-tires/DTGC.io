/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 V4 DeFi GOLD SUITE 🏆
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All-in-one DeFi tools for the DTGC ecosystem
 * - Swap: PLS ↔ DTGC ↔ URMOM with 0.35% burn + 0.35% dev fee
 * - Portfolio: Full wallet scanner via PulseScan API
 * - Create LP: DTGC/PLS and DTGC/URMOM pairs
 * 
 * @version 1.1.0 - Added PulseScan wallet scanner
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  
  FEES: {
    BURN_BPS: 35,
    DEV_BPS: 35,
    TOTAL_BPS: 70,
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  PULSESCAN_API: 'https://api.scan.pulsechain.com/api/v2',
  
  TOKENS: {
    PLS: { address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', symbol: 'PLS', name: 'PulseChain', decimals: 18, logo: '💎', isNative: true },
    DTGC: { address: '0xd0676B28a457371d58d47e5247b439114e40eb0f', symbol: 'DTGC', name: 'DT Gold Coin', decimals: 18, logo: '🪙', isNative: false },
    URMOM: { address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0', symbol: 'URMOM', name: 'URMOM', decimals: 18, logo: '👩', isNative: false },
  },
  
  KNOWN_TOKENS: [
    { symbol: 'PLS', name: 'PulseChain', address: null, decimals: 18, icon: '💜', color: '#E1BEE7' },
    { symbol: 'WPLS', name: 'Wrapped PLS', address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', decimals: 18, icon: '💜', color: '#E1BEE7' },
    { symbol: 'DTGC', name: 'DT Gold Coin', address: '0xd0676b28a457371d58d47e5247b439114e40eb0f', decimals: 18, icon: '🪙', color: '#FFD700' },
    { symbol: 'URMOM', name: 'URMOM', address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0', decimals: 18, icon: '🔥', color: '#FF9800' },
    { symbol: 'PLSX', name: 'PulseX', address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', decimals: 18, icon: '🔷', color: '#00BCD4' },
    { symbol: 'HEX', name: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', decimals: 8, icon: '⬡', color: '#FF00FF' },
    { symbol: 'INC', name: 'Incentive', address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', decimals: 18, icon: '💎', color: '#9C27B0' },
  ],
  
  LP_PAIRS: {
    'DTGC/PLS': { token0: 'DTGC', token1: 'PLS', name: 'DTGC/PLS LP' },
    'DTGC/URMOM': { token0: 'DTGC', token1: 'URMOM', name: 'DTGC/URMOM LP' },
  },
  
  SLIPPAGE_BPS: 250,
  DEADLINE_MINUTES: 20,
  EXPLORER: 'https://scan.pulsechain.com',
};

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)',
  'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
];

const FACTORY_ABI = ['function getPair(address tokenA, address tokenB) external view returns (address pair)'];

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

const styles = {
  container: { background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '20px', border: '1px solid rgba(212, 175, 55, 0.3)', padding: '24px', maxWidth: '520px', width: '100%', margin: '0 auto', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', maxHeight: '90vh', overflowY: 'auto' },
  header: { textAlign: 'center', marginBottom: '24px' },
  title: { fontSize: '1.5rem', fontWeight: 700, background: 'linear-gradient(135deg, #D4AF37, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: '8px' },
  subtitle: { color: '#888', fontSize: '0.85rem' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '12px' },
  tab: { flex: 1, padding: '12px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s ease' },
  tabActive: { background: 'linear-gradient(135deg, #D4AF37, #B8960C)', color: '#000' },
  tabInactive: { background: 'transparent', color: '#888' },
  card: { background: 'rgba(0,0,0,0.3)', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' },
  label: { color: '#888', fontSize: '0.8rem', marginBottom: '8px', display: 'block' },
  inputGroup: { display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', borderRadius: '12px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)' },
  input: { flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', fontWeight: 600, outline: 'none', width: '100%' },
  tokenSelect: { display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(212, 175, 55, 0.2)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', border: 'none', color: '#fff', fontWeight: 600, minWidth: '120px' },
  swapButton: { width: '100%', padding: '16px', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', border: 'none', borderRadius: '12px', color: '#000', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: '16px', transition: 'all 0.2s ease' },
  swapButtonDisabled: { background: 'rgba(255,255,255,0.1)', color: '#666', cursor: 'not-allowed' },
  flipButton: { width: '40px', height: '40px', background: 'linear-gradient(135deg, #D4AF37, #B8960C)', border: 'none', borderRadius: '50%', color: '#000', fontSize: '1.2rem', cursor: 'pointer', margin: '-12px auto', display: 'block', position: 'relative', zIndex: 10 },
  balanceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(0,0,0,0.3)', borderRadius: '12px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)' },
  balanceToken: { display: 'flex', alignItems: 'center', gap: '12px' },
  balanceIcon: { width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' },
  balanceInfo: { display: 'flex', flexDirection: 'column' },
  balanceSymbol: { color: '#fff', fontWeight: 600, fontSize: '0.9rem' },
  balanceName: { color: '#666', fontSize: '0.7rem' },
  balanceAmount: { textAlign: 'right' },
  balanceValue: { color: '#fff', fontWeight: 600, fontSize: '0.9rem' },
  balanceUsd: { color: '#4CAF50', fontSize: '0.75rem' },
  selectDropdown: { position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a2e', border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '12px', marginTop: '8px', overflow: 'hidden', zIndex: 100 },
  selectOption: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer', color: '#fff', transition: 'background 0.2s' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' },
  infoLabel: { color: '#888' },
  infoValue: { color: '#fff', fontWeight: 500 },
  lpSelector: { display: 'flex', gap: '12px', marginBottom: '20px' },
  lpOption: { flex: 1, padding: '16px', borderRadius: '12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', border: '2px solid transparent' },
  lpOptionActive: { background: 'rgba(212, 175, 55, 0.2)', borderColor: '#D4AF37' },
  lpOptionInactive: { background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.1)' },
  toast: { position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', padding: '12px 24px', borderRadius: '8px', color: '#fff', fontWeight: 500, zIndex: 1000 },
  toastSuccess: { background: 'rgba(76, 175, 80, 0.9)' },
  toastError: { background: 'rgba(244, 67, 54, 0.9)' },
  toastInfo: { background: 'rgba(33, 150, 243, 0.9)' },
  totalPortfolio: { background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))', border: '1px solid rgba(212,175,55,0.4)', borderRadius: '16px', padding: '20px', marginBottom: '20px', textAlign: 'center' },
};

export default function V4DeFiGoldSuite({ provider, signer, userAddress, onClose }) {
  const [activeTab, setActiveTab] = useState('swap');
  const [toast, setToast] = useState(null);
  const [fromToken, setFromToken] = useState('PLS');
  const [toToken, setToToken] = useState('DTGC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [swapLoading, setSwapLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [walletTokens, setWalletTokens] = useState([]);
  const [lpBalances, setLpBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [balances, setBalances] = useState({});
  const [selectedPair, setSelectedPair] = useState('DTGC/PLS');
  const [lpAmount0, setLpAmount0] = useState('');
  const [lpAmount1, setLpAmount1] = useState('');
  const [lpLoading, setLpLoading] = useState(false);
  const [pairAddress, setPairAddress] = useState(null);
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);
  const [livePrices, setLivePrices] = useState({ pls: 0.000017, dtgc: 0.0002, urmom: 0.0000001, plsx: 0.00005, hex: 0.003, inc: 0.0001 });

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const formatNumber = (num, decimals = 4) => {
    if (!num || isNaN(num)) return '0';
    const n = parseFloat(num);
    if (n === 0) return '0';
    if (n < 0.0001) return '<0.0001';
    if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(decimals);
  };

  const getDeadline = () => Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

  // Fetch live prices from DexScreener
  const fetchLivePrices = useCallback(async () => {
    try {
      const [urmomRes, dtgcRes] = await Promise.all([
        fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0548656e272fec9534e180d3174cfc57ab6e10c0').catch(() => null),
        fetch('https://api.dexscreener.com/latest/dex/pairs/pulsechain/0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7').catch(() => null),
      ]);
      let pls = 0.000017, dtgc = 0.0002, urmom = 0.0000001;
      if (urmomRes?.ok) {
        const data = await urmomRes.json();
        if (data?.pair?.priceUsd) {
          urmom = parseFloat(data.pair.priceUsd);
          pls = parseFloat(data.pair.priceNative) > 0 ? urmom / parseFloat(data.pair.priceNative) : pls;
        }
      }
      if (dtgcRes?.ok) {
        const data = await dtgcRes.json();
        if (data?.pair?.priceUsd) dtgc = parseFloat(data.pair.priceUsd);
      }
      setLivePrices(prev => ({ ...prev, pls, dtgc, urmom }));
    } catch (err) { console.log('Price fetch error:', err.message); }
  }, []);
  
  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 30000);
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  // Optimized LP fetch - parallel calls (defined first so scanWalletTokens can use it)
  const fetchLpBalancesOptimized = useCallback(async () => {
    if (!provider || !userAddress) return {};
    try {
      const factory = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
      const pairs = Object.entries(CONFIG.LP_PAIRS);
      
      // Get all pair addresses in parallel
      const pairAddresses = await Promise.all(
        pairs.map(([, pair]) => factory.getPair(CONFIG.TOKENS[pair.token0].address, CONFIG.TOKENS[pair.token1].address).catch(() => ethers.ZeroAddress))
      );
      
      // Get all LP balances in parallel
      const balancePromises = pairAddresses.map((addr, i) => {
        if (!addr || addr === ethers.ZeroAddress) return Promise.resolve({ name: pairs[i][0], balance: 0, address: null });
        const lpContract = new ethers.Contract(addr, ERC20_ABI, provider);
        return lpContract.balanceOf(userAddress).then(bal => ({ name: pairs[i][0], balance: parseFloat(ethers.formatEther(bal)), address: addr })).catch(() => ({ name: pairs[i][0], balance: 0, address: null }));
      });
      
      const results = await Promise.all(balancePromises);
      const lpBalances = {};
      results.forEach(r => { if (r.balance > 0) lpBalances[r.name] = { address: r.address, balance: r.balance }; });
      return lpBalances;
    } catch { return {}; }
  }, [provider, userAddress]);

  // OPTIMIZED: Full wallet scan - parallel calls, PulseScan API first
  const scanWalletTokens = useCallback(async () => {
    if (!provider || !userAddress) return;
    setLoadingBalances(true);
    showToast('🔍 Scanning...', 'info');
    
    try {
      const foundTokens = [];
      const seenAddresses = new Set();
      
      // PARALLEL: Fetch PLS balance + PulseScan API + LP balances ALL AT ONCE
      const [plsBal, pulseScanData, lpData] = await Promise.all([
        provider.getBalance(userAddress),
        fetch(`${CONFIG.PULSESCAN_API}/addresses/${userAddress}/token-balances`).then(r => r.ok ? r.json() : []).catch(() => []),
        fetchLpBalancesOptimized(),
      ]);
      
      // 1. Add PLS
      const plsBalFormatted = ethers.formatEther(plsBal);
      const plsBalNum = parseFloat(plsBalFormatted);
      if (plsBalNum > 0) {
        foundTokens.push({ symbol: 'PLS', name: 'PulseChain', address: null, decimals: 18, balance: plsBalFormatted, icon: '💜', color: '#E1BEE7', valueUsd: plsBalNum * livePrices.pls, price: livePrices.pls, hasLiquidity: true });
      }
      setBalances(prev => ({ ...prev, PLS: plsBalNum }));
      
      // 2. Process PulseScan data (ALL tokens in one response!)
      if (Array.isArray(pulseScanData)) {
        for (const item of pulseScanData) {
          const tokenAddr = item.token?.address?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);
          
          const decimals = parseInt(item.token?.decimals) || 18;
          const bal = parseFloat(item.value || '0') / Math.pow(10, decimals);
          if (bal <= 0) continue;
          
          const sym = (item.token?.symbol || '').toUpperCase();
          let price = 0, icon = '🔸', color = '#888', hasLiquidity = false;
          
          // Price lookup for known tokens
          if (sym === 'DTGC') { price = livePrices.dtgc; icon = '🪙'; color = '#FFD700'; hasLiquidity = true; }
          else if (sym === 'URMOM') { price = livePrices.urmom; icon = '🔥'; color = '#FF9800'; hasLiquidity = true; }
          else if (sym === 'PLSX') { price = livePrices.plsx; icon = '🔷'; color = '#00BCD4'; hasLiquidity = true; }
          else if (sym === 'HEX') { price = livePrices.hex; icon = '⬡'; color = '#FF00FF'; hasLiquidity = true; }
          else if (sym === 'WPLS') { price = livePrices.pls; icon = '💜'; color = '#E1BEE7'; hasLiquidity = true; }
          else if (sym === 'INC') { price = livePrices.inc; icon = '💎'; color = '#9C27B0'; hasLiquidity = true; }
          else if (sym === 'DAI' || sym === 'USDC' || sym === 'USDT') { price = 1; icon = '💵'; color = '#26A17B'; hasLiquidity = true; }
          
          foundTokens.push({ symbol: item.token?.symbol || 'UNKNOWN', name: item.token?.name || 'Unknown', address: item.token?.address, decimals, balance: bal.toString(), icon, color, valueUsd: bal * price, price, hasLiquidity });
          
          // Update swap balances for our 3 tokens
          if (sym === 'DTGC' || sym === 'URMOM') setBalances(prev => ({ ...prev, [sym]: bal }));
        }
      }
      
      // Sort: liquidity first, then by USD value
      foundTokens.sort((a, b) => {
        if (a.hasLiquidity && !b.hasLiquidity) return -1;
        if (!a.hasLiquidity && b.hasLiquidity) return 1;
        return (b.valueUsd || 0) - (a.valueUsd || 0);
      });
      
      setWalletTokens(foundTokens);
      setLpBalances(lpData || {});
      setLastScanTime(Date.now());
      const total = foundTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);
      setTotalPortfolioValue(total);
      showToast(`✅ ${foundTokens.length} tokens ($${total.toFixed(2)})`, 'success');
    } catch (err) {
      console.error('Scan error:', err);
      showToast('Scan failed', 'error');
    } finally { setLoadingBalances(false); }
  }, [provider, userAddress, livePrices, showToast, fetchLpBalancesOptimized]);

  // LP balances now handled by fetchLpBalancesOptimized in scanWalletTokens

  useEffect(() => {
    if (activeTab === 'portfolio' && userAddress && walletTokens.length === 0) scanWalletTokens();
  }, [activeTab, userAddress, walletTokens.length, scanWalletTokens]);
  
  useEffect(() => {
    if (userAddress && provider && activeTab === 'swap') {
      const fetchSimpleBalances = async () => {
        try {
          const plsBal = await provider.getBalance(userAddress);
          setBalances(prev => ({ ...prev, PLS: parseFloat(ethers.formatEther(plsBal)) }));
          for (const [symbol, token] of Object.entries(CONFIG.TOKENS)) {
            if (token.isNative) continue;
            const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
            const bal = await contract.balanceOf(userAddress);
            setBalances(prev => ({ ...prev, [symbol]: parseFloat(ethers.formatUnits(bal, token.decimals)) }));
          }
        } catch (e) {}
      };
      fetchSimpleBalances();
    }
  }, [userAddress, provider, activeTab]);

  const getQuote = useCallback(async (inputAmount, from, to) => {
    if (!provider || !inputAmount || parseFloat(inputAmount) <= 0) { setToAmount(''); return; }
    setQuoteLoading(true);
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, provider);
      const fromAddr = CONFIG.TOKENS[from].address;
      const toAddr = CONFIG.TOKENS[to].address;
      const amountIn = ethers.parseUnits(inputAmount, CONFIG.TOKENS[from].decimals);
      const amounts = await router.getAmountsOut(amountIn, [fromAddr, toAddr]);
      setToAmount(parseFloat(ethers.formatUnits(amounts[1], CONFIG.TOKENS[to].decimals)).toFixed(6));
    } catch (err) { setToAmount(''); }
    setQuoteLoading(false);
  }, [provider]);

  useEffect(() => {
    const timer = setTimeout(() => { if (fromAmount) getQuote(fromAmount, fromToken, toToken); }, 500);
    return () => clearTimeout(timer);
  }, [fromAmount, fromToken, toToken, getQuote]);

  const executeSwap = async () => {
    if (!signer || !fromAmount || !toAmount) return;
    setSwapLoading(true);
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
      const fromAddr = CONFIG.TOKENS[fromToken].address;
      const toAddr = CONFIG.TOKENS[toToken].address;
      const deadline = getDeadline();
      const inputAmount = ethers.parseUnits(fromAmount, CONFIG.TOKENS[fromToken].decimals);
      const devFee = inputAmount * BigInt(CONFIG.FEES.DEV_BPS) / 10000n;
      const amountAfterDevFee = inputAmount - devFee;
      const amountsOut = await router.getAmountsOut(amountAfterDevFee, [fromAddr, toAddr]);
      const expectedOut = amountsOut[1];
      const burnFee = expectedOut * BigInt(CONFIG.FEES.BURN_BPS) / 10000n;
      const amountOutMin = (expectedOut - burnFee) * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      
      if (fromToken === 'PLS') {
        showToast(`Sending dev fee...`, 'info');
        await (await signer.sendTransaction({ to: CONFIG.DEV_WALLET, value: devFee })).wait();
        showToast('Swapping...', 'info');
        await (await router.swapExactETHForTokens(amountOutMin, [fromAddr, toAddr], userAddress, deadline, { value: amountAfterDevFee })).wait();
        if (burnFee > 0n) {
          showToast(`Burning ${toToken}...`, 'info');
          const tokenContract = new ethers.Contract(toAddr, ERC20_ABI, signer);
          await (await tokenContract.transfer(CONFIG.BURN_ADDRESS, burnFee)).wait();
        }
      } else if (toToken === 'PLS') {
        const tokenContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < inputAmount) { showToast(`Approving...`, 'info'); await (await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        if (devFee > 0n) { showToast(`Burning ${fromToken}...`, 'info'); await (await tokenContract.transfer(CONFIG.BURN_ADDRESS, devFee)).wait(); }
        showToast('Swapping...', 'info');
        await (await router.swapExactTokensForETH(amountAfterDevFee, amountOutMin, [fromAddr, toAddr], userAddress, deadline)).wait();
        showToast(`Sending dev fee...`, 'info');
        await (await signer.sendTransaction({ to: CONFIG.DEV_WALLET, value: burnFee })).wait();
      } else {
        const fromContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
        const toContract = new ethers.Contract(toAddr, ERC20_ABI, signer);
        const allowance = await fromContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < inputAmount) { showToast(`Approving...`, 'info'); await (await fromContract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        if (devFee > 0n) { showToast(`Burning ${fromToken}...`, 'info'); await (await fromContract.transfer(CONFIG.BURN_ADDRESS, devFee)).wait(); }
        showToast('Swapping...', 'info');
        await (await router.swapExactTokensForTokens(amountAfterDevFee, amountOutMin, [fromAddr, toAddr], userAddress, deadline)).wait();
        if (burnFee > 0n) { showToast(`Burning ${toToken}...`, 'info'); await (await toContract.transfer(CONFIG.BURN_ADDRESS, burnFee)).wait(); }
      }
      showToast(`✅ Swapped! (0.35% burned, 0.35% dev)`, 'success');
      setFromAmount(''); setToAmount('');
      setWalletTokens([]); scanWalletTokens();
    } catch (err) { showToast(err.reason || 'Swap failed', 'error'); }
    setSwapLoading(false);
  };

  const flipTokens = () => { setFromToken(toToken); setToToken(fromToken); setFromAmount(toAmount); setToAmount(fromAmount); };

  const fetchPairInfo = useCallback(async () => {
    if (!provider) return;
    const pair = CONFIG.LP_PAIRS[selectedPair];
    try {
      const factory = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
      const lpAddress = await factory.getPair(CONFIG.TOKENS[pair.token0].address, CONFIG.TOKENS[pair.token1].address);
      setPairAddress(lpAddress !== ethers.ZeroAddress ? lpAddress : null);
    } catch { setPairAddress(null); }
  }, [provider, selectedPair]);

  useEffect(() => { fetchPairInfo(); }, [fetchPairInfo]);

  const calculateLpAmount1 = useCallback(async (amount0) => {
    if (!provider || !pairAddress || !amount0 || parseFloat(amount0) <= 0) { setLpAmount1(''); return; }
    try {
      const pair = CONFIG.LP_PAIRS[selectedPair];
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const reserves = await pairContract.getReserves();
      const pairToken0 = await pairContract.token0();
      const token0Addr = CONFIG.TOKENS[pair.token0].address.toLowerCase();
      let reserve0, reserve1;
      if (pairToken0.toLowerCase() === token0Addr) { reserve0 = reserves[0]; reserve1 = reserves[1]; }
      else { reserve0 = reserves[1]; reserve1 = reserves[0]; }
      const amount0Wei = ethers.parseUnits(amount0, CONFIG.TOKENS[pair.token0].decimals);
      const amount1Wei = (amount0Wei * reserve1) / reserve0;
      setLpAmount1(parseFloat(ethers.formatUnits(amount1Wei, CONFIG.TOKENS[pair.token1].decimals)).toFixed(6));
    } catch { setLpAmount1(''); }
  }, [provider, pairAddress, selectedPair]);

  useEffect(() => { const timer = setTimeout(() => { if (lpAmount0) calculateLpAmount1(lpAmount0); }, 500); return () => clearTimeout(timer); }, [lpAmount0, calculateLpAmount1]);

  const addLiquidity = async () => {
    if (!signer || !lpAmount0 || !lpAmount1) return;
    setLpLoading(true);
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, signer);
      const pair = CONFIG.LP_PAIRS[selectedPair];
      const token0 = CONFIG.TOKENS[pair.token0];
      const token1 = CONFIG.TOKENS[pair.token1];
      const amount0Desired = ethers.parseUnits(lpAmount0, token0.decimals);
      const amount1Desired = ethers.parseUnits(lpAmount1, token1.decimals);
      const amount0Min = amount0Desired * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      const amount1Min = amount1Desired * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      const deadline = getDeadline();
      
      if (token1.isNative) {
        const tokenContract = new ethers.Contract(token0.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amount0Desired) { showToast(`Approving...`, 'info'); await (await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        showToast('Adding liquidity...', 'info');
        await (await router.addLiquidityETH(token0.address, amount0Desired, amount0Min, amount1Min, userAddress, deadline, { value: amount1Desired })).wait();
      } else {
        const token0Contract = new ethers.Contract(token0.address, ERC20_ABI, signer);
        const token1Contract = new ethers.Contract(token1.address, ERC20_ABI, signer);
        if ((await token0Contract.allowance(userAddress, CONFIG.ROUTER)) < amount0Desired) { showToast(`Approving ${token0.symbol}...`, 'info'); await (await token0Contract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        if ((await token1Contract.allowance(userAddress, CONFIG.ROUTER)) < amount1Desired) { showToast(`Approving ${token1.symbol}...`, 'info'); await (await token1Contract.approve(CONFIG.ROUTER, ethers.MaxUint256)).wait(); }
        showToast('Adding liquidity...', 'info');
        await (await router.addLiquidity(token0.address, token1.address, amount0Desired, amount1Desired, amount0Min, amount1Min, userAddress, deadline)).wait();
      }
      showToast(`✅ LP created!`, 'success');
      setLpAmount0(''); setLpAmount1('');
      setWalletTokens([]); scanWalletTokens();
    } catch (err) { showToast(err.reason || 'Failed', 'error'); }
    setLpLoading(false);
  };

  const renderTokenSelector = (isFrom) => {
    const show = isFrom ? showFromSelect : showToSelect;
    const setShow = isFrom ? setShowFromSelect : setShowToSelect;
    const currentToken = isFrom ? fromToken : toToken;
    const setToken = isFrom ? setFromToken : setToToken;
    const otherToken = isFrom ? toToken : fromToken;
    return (
      <div style={{ position: 'relative' }}>
        <button style={styles.tokenSelect} onClick={() => setShow(!show)}>
          <span>{CONFIG.TOKENS[currentToken].logo}</span>
          <span>{currentToken}</span>
          <span style={{ marginLeft: 'auto' }}>▼</span>
        </button>
        {show && (
          <div style={styles.selectDropdown}>
            {Object.entries(CONFIG.TOKENS).map(([symbol, token]) => (
              <div key={symbol} style={{ ...styles.selectOption, opacity: symbol === otherToken ? 0.5 : 1, background: symbol === currentToken ? 'rgba(212, 175, 55, 0.2)' : 'transparent' }}
                onClick={() => { if (symbol !== otherToken) { setToken(symbol); setShow(false); setFromAmount(''); setToAmount(''); } }}>
                <span style={{ fontSize: '1.2rem' }}>{token.logo}</span>
                <div><div style={{ fontWeight: 600 }}>{symbol}</div><div style={{ fontSize: '0.75rem', color: '#888' }}>{token.name}</div></div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>🏆 V4 DeFi Gold Suite</div>
        <div style={styles.subtitle}>Swap • Portfolio • Create LP</div>
      </div>
      
      <div style={styles.tabs}>
        {['swap', 'portfolio', 'create-lp'].map((tab) => (
          <button key={tab} style={{ ...styles.tab, ...(activeTab === tab ? styles.tabActive : styles.tabInactive) }} onClick={() => setActiveTab(tab)}>
            {tab === 'swap' && '🔄 Swap'}{tab === 'portfolio' && '📊 Portfolio'}{tab === 'create-lp' && '💧 Create LP'}
          </button>
        ))}
      </div>
      
      {activeTab === 'swap' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(255,107,107,0.1))', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>🔥</span><span style={{ color: '#FF6B6B', fontSize: '0.85rem', fontWeight: 600 }}>0.35% Burn</span></div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>+</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>💰</span><span style={{ color: '#D4AF37', fontSize: '0.85rem', fontWeight: 600 }}>0.35% Dev</span></div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>=</div>
            <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>0.70%</div>
          </div>
          <div style={styles.card}>
            <span style={styles.label}>From</span>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={fromAmount} onChange={(e) => setFromAmount(e.target.value)} style={styles.input} />
              {renderTokenSelector(true)}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
              Balance: {formatNumber(balances[fromToken])} {fromToken}
              <button onClick={() => setFromAmount(balances[fromToken]?.toString() || '0')} style={{ background: 'none', border: 'none', color: '#D4AF37', marginLeft: '8px', cursor: 'pointer', fontSize: '0.75rem' }}>MAX</button>
            </div>
          </div>
          <button style={styles.flipButton} onClick={flipTokens}>↕</button>
          <div style={styles.card}>
            <span style={styles.label}>To {quoteLoading && '(fetching...)'}</span>
            <div style={styles.inputGroup}>
              <input type="text" placeholder="0.0" value={toAmount} readOnly style={{ ...styles.input, color: '#D4AF37' }} />
              {renderTokenSelector(false)}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>Balance: {formatNumber(balances[toToken])} {toToken}</div>
          </div>
          {fromAmount && toAmount && (
            <div style={{ ...styles.card, padding: '12px 16px' }}>
              <div style={styles.infoRow}><span style={styles.infoLabel}>Rate</span><span style={styles.infoValue}>1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken}</span></div>
              <div style={styles.infoRow}><span style={styles.infoLabel}>🔥 Burn</span><span style={{ ...styles.infoValue, color: '#FF6B6B' }}>0.35%</span></div>
              <div style={styles.infoRow}><span style={styles.infoLabel}>💰 Dev</span><span style={{ ...styles.infoValue, color: '#D4AF37' }}>0.35%</span></div>
              <div style={{ ...styles.infoRow, borderBottom: 'none' }}><span style={styles.infoLabel}>You Get</span><span style={{ ...styles.infoValue, color: '#4CAF50', fontWeight: 700 }}>~{(parseFloat(toAmount) * 0.993).toFixed(4)} {toToken}</span></div>
            </div>
          )}
          <button style={{ ...styles.swapButton, ...(!userAddress || !fromAmount || !toAmount || swapLoading ? styles.swapButtonDisabled : {}) }} onClick={executeSwap} disabled={!userAddress || !fromAmount || !toAmount || swapLoading}>
            {!userAddress ? 'Connect Wallet' : swapLoading ? 'Swapping...' : !fromAmount ? 'Enter Amount' : `Swap ${fromToken} → ${toToken}`}
          </button>
        </div>
      )}
      
      {activeTab === 'portfolio' && (
        <div>
          {!userAddress ? (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Connect wallet to view portfolio</div>) : (
            <>
              <div style={styles.totalPortfolio}>
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '4px' }}>Total Portfolio Value</div>
                <div style={{ color: '#D4AF37', fontSize: '2rem', fontWeight: 700 }}>${formatNumber(totalPortfolioValue, 2)}</div>
                {lastScanTime && <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '4px' }}>Updated: {new Date(lastScanTime).toLocaleTimeString()}</div>}
              </div>
              {loadingBalances ? (<div style={{ textAlign: 'center', padding: '40px', color: '#888' }}><div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔍</div>Scanning...</div>) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💰 Tokens ({walletTokens.length})</div>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {walletTokens.map((token, idx) => (
                        <div key={idx} style={styles.balanceRow}>
                          <div style={styles.balanceToken}>
                            <div style={{ ...styles.balanceIcon, background: token.hasLiquidity ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.1)' }}>{token.icon || '🪙'}</div>
                            <div style={styles.balanceInfo}><span style={styles.balanceSymbol}>{token.symbol}</span><span style={styles.balanceName}>{token.name?.slice(0, 20)}</span></div>
                          </div>
                          <div style={styles.balanceAmount}>
                            <div style={styles.balanceValue}>{formatNumber(token.balance)}</div>
                            {token.valueUsd > 0 && <div style={styles.balanceUsd}>${formatNumber(token.valueUsd, 2)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {Object.keys(lpBalances).length > 0 && (
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>💧 LP Positions</div>
                      {Object.entries(lpBalances).map(([pairName, data]) => (
                        <div key={pairName} style={styles.balanceRow}>
                          <div style={styles.balanceToken}><div style={styles.balanceIcon}>🔷</div><div style={styles.balanceInfo}><span style={styles.balanceSymbol}>{pairName}</span><span style={styles.balanceName}>PulseX LP</span></div></div>
                          <div style={styles.balanceAmount}>
                            <div style={styles.balanceValue}>{formatNumber(data.balance)}</div>
                            {data.address && <a href={`${CONFIG.EXPLORER}/address/${data.address}`} target="_blank" rel="noopener noreferrer" style={{ color: '#D4AF37', fontSize: '0.65rem', textDecoration: 'none' }}>View ↗</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button onClick={() => { setWalletTokens([]); scanWalletTokens(); }} disabled={loadingBalances} style={{ ...styles.swapButton, background: loadingBalances ? 'rgba(255,255,255,0.1)' : 'rgba(212, 175, 55, 0.2)', color: loadingBalances ? '#666' : '#D4AF37' }}>
                {loadingBalances ? '🔍 Scanning...' : '🔄 Refresh All'}
              </button>
            </>
          )}
        </div>
      )}
      
      {activeTab === 'create-lp' && (
        <div>
          <div style={styles.lpSelector}>
            {Object.entries(CONFIG.LP_PAIRS).map(([pairName, pair]) => (
              <div key={pairName} style={{ ...styles.lpOption, ...(selectedPair === pairName ? styles.lpOptionActive : styles.lpOptionInactive) }} onClick={() => { setSelectedPair(pairName); setLpAmount0(''); setLpAmount1(''); }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{CONFIG.TOKENS[pair.token0].logo}{CONFIG.TOKENS[pair.token1].logo}</div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{pairName}</div>
              </div>
            ))}
          </div>
          <div style={styles.card}>
            <span style={styles.label}>{CONFIG.LP_PAIRS[selectedPair].token0}</span>
            <div style={styles.inputGroup}>
              <input type="number" placeholder="0.0" value={lpAmount0} onChange={(e) => setLpAmount0(e.target.value)} style={styles.input} />
              <div style={styles.tokenSelect}><span>{CONFIG.TOKENS[CONFIG.LP_PAIRS[selectedPair].token0].logo}</span><span>{CONFIG.LP_PAIRS[selectedPair].token0}</span></div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
              Balance: {formatNumber(balances[CONFIG.LP_PAIRS[selectedPair].token0])}
              <button onClick={() => setLpAmount0(balances[CONFIG.LP_PAIRS[selectedPair].token0]?.toString() || '0')} style={{ background: 'none', border: 'none', color: '#D4AF37', marginLeft: '8px', cursor: 'pointer', fontSize: '0.75rem' }}>MAX</button>
            </div>
          </div>
          <div style={{ textAlign: 'center', margin: '-8px 0', fontSize: '1.5rem', color: '#D4AF37' }}>+</div>
          <div style={styles.card}>
            <span style={styles.label}>{CONFIG.LP_PAIRS[selectedPair].token1} (auto)</span>
            <div style={styles.inputGroup}>
              <input type="text" placeholder="0.0" value={lpAmount1} readOnly style={{ ...styles.input, color: '#D4AF37' }} />
              <div style={styles.tokenSelect}><span>{CONFIG.TOKENS[CONFIG.LP_PAIRS[selectedPair].token1].logo}</span><span>{CONFIG.LP_PAIRS[selectedPair].token1}</span></div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>Balance: {formatNumber(balances[CONFIG.LP_PAIRS[selectedPair].token1])}</div>
          </div>
          {pairAddress ? (
            <div style={{ ...styles.card, padding: '12px 16px' }}>
              <div style={styles.infoRow}><span style={styles.infoLabel}>Status</span><span style={{ ...styles.infoValue, color: '#4CAF50' }}>✓ Pool Exists</span></div>
              <div style={{ ...styles.infoRow, borderBottom: 'none' }}><span style={styles.infoLabel}>Address</span><a href={`${CONFIG.EXPLORER}/address/${pairAddress}`} target="_blank" rel="noopener noreferrer" style={{ color: '#D4AF37', fontSize: '0.8rem' }}>{pairAddress.slice(0, 8)}...{pairAddress.slice(-6)} ↗</a></div>
            </div>
          ) : (
            <div style={{ ...styles.card, padding: '12px 16px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
              <div style={{ color: '#FF9800', fontSize: '0.85rem', textAlign: 'center' }}>⚠️ Pool doesn't exist. You'll be first LP!</div>
            </div>
          )}
          <button style={{ ...styles.swapButton, ...(!userAddress || !lpAmount0 || !lpAmount1 || lpLoading ? styles.swapButtonDisabled : {}) }} onClick={addLiquidity} disabled={!userAddress || !lpAmount0 || !lpAmount1 || lpLoading}>
            {!userAddress ? 'Connect Wallet' : lpLoading ? 'Adding...' : !lpAmount0 ? 'Enter Amount' : `Add ${selectedPair} LP`}
          </button>
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(244, 67, 54, 0.1)', borderRadius: '8px', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
            <div style={{ color: '#F44336', fontSize: '0.75rem' }}>⚠️ <strong>IL Warning:</strong> Providing liquidity has risk.</div>
          </div>
        </div>
      )}
      
      {onClose && <button onClick={onClose} style={{ width: '100%', marginTop: '16px', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#888', cursor: 'pointer' }}>← Back to Staking</button>}
      {toast && <div style={{ ...styles.toast, ...(toast.type === 'success' ? styles.toastSuccess : toast.type === 'error' ? styles.toastError : styles.toastInfo) }}>{toast.message}</div>}
    </div>
  );
}
