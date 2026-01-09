/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏆 V4 DeFi GOLD SUITE 🏆
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * All-in-one DeFi tools for the DTGC ecosystem
 * - Swap: PLS ↔ DTGC ↔ URMOM
 * - Portfolio: View all holdings
 * - Create LP: DTGC/PLS and DTGC/URMOM pairs
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // PulseX V2 Router
  ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  // PulseX V2 Factory
  FACTORY: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  
  // Fee Configuration
  FEES: {
    BURN_BPS: 35,      // 0.35% burn fee
    DEV_BPS: 35,       // 0.35% dev fee
    TOTAL_BPS: 70,     // 0.70% total
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',
  
  TOKENS: {
    PLS: {
      address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', // WPLS
      symbol: 'PLS',
      name: 'PulseChain',
      decimals: 18,
      logo: '💎',
      isNative: true,
    },
    DTGC: {
      address: '0xd0676B28a457371d58d47e5247b439114e40eb0f',
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
      logo: '👩',
      isNative: false,
    },
  },
  
  LP_PAIRS: {
    'DTGC/PLS': {
      token0: 'DTGC',
      token1: 'PLS',
      name: 'DTGC/PLS LP',
    },
    'DTGC/URMOM': {
      token0: 'DTGC',
      token1: 'URMOM',
      name: 'DTGC/URMOM LP',
    },
  },
  
  SLIPPAGE_BPS: 250, // 2.5%
  DEADLINE_MINUTES: 20,
  
  EXPLORER: 'https://scan.pulsechain.com',
};

// ═══════════════════════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════════════════════

const ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
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
  'function totalSupply() view returns (uint256)',
];

const PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
];

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
  container: {
    background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
    borderRadius: '20px',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    padding: '24px',
    maxWidth: '480px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #D4AF37, #FFD700)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#888',
    fontSize: '0.85rem',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    background: 'rgba(0,0,0,0.3)',
    padding: '6px',
    borderRadius: '12px',
  },
  tab: {
    flex: 1,
    padding: '12px 16px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: 'linear-gradient(135deg, #D4AF37, #B8960C)',
    color: '#000',
  },
  tabInactive: {
    background: 'transparent',
    color: '#888',
  },
  card: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  label: {
    color: '#888',
    fontSize: '0.8rem',
    marginBottom: '8px',
    display: 'block',
  },
  inputGroup: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.4)',
    borderRadius: '12px',
    padding: '12px 16px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '1.2rem',
    fontWeight: 600,
    outline: 'none',
    width: '100%',
  },
  tokenSelect: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(212, 175, 55, 0.2)',
    padding: '8px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    minWidth: '120px',
  },
  swapButton: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #D4AF37, #B8960C)',
    border: 'none',
    borderRadius: '12px',
    color: '#000',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '16px',
    transition: 'all 0.2s ease',
  },
  swapButtonDisabled: {
    background: 'rgba(255,255,255,0.1)',
    color: '#666',
    cursor: 'not-allowed',
  },
  flipButton: {
    width: '40px',
    height: '40px',
    background: 'linear-gradient(135deg, #D4AF37, #B8960C)',
    border: 'none',
    borderRadius: '50%',
    color: '#000',
    fontSize: '1.2rem',
    cursor: 'pointer',
    margin: '-12px auto',
    display: 'block',
    position: 'relative',
    zIndex: 10,
  },
  balanceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '12px',
    marginBottom: '12px',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  balanceToken: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  balanceIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(212, 175, 55, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.2rem',
  },
  balanceInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  balanceSymbol: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '1rem',
  },
  balanceName: {
    color: '#666',
    fontSize: '0.75rem',
  },
  balanceAmount: {
    textAlign: 'right',
  },
  balanceValue: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '1rem',
  },
  balanceUsd: {
    color: '#666',
    fontSize: '0.75rem',
  },
  selectDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    background: '#1a1a2e',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '12px',
    marginTop: '8px',
    overflow: 'hidden',
    zIndex: 100,
  },
  selectOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    color: '#fff',
    transition: 'background 0.2s',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: '0.85rem',
  },
  infoLabel: {
    color: '#888',
  },
  infoValue: {
    color: '#fff',
    fontWeight: 500,
  },
  lpSelector: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
  },
  lpOption: {
    flex: 1,
    padding: '16px',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'all 0.2s',
    border: '2px solid transparent',
  },
  lpOptionActive: {
    background: 'rgba(212, 175, 55, 0.2)',
    borderColor: '#D4AF37',
  },
  lpOptionInactive: {
    background: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  toast: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 500,
    zIndex: 1000,
    animation: 'fadeIn 0.3s ease',
  },
  toastSuccess: {
    background: 'rgba(76, 175, 80, 0.9)',
  },
  toastError: {
    background: 'rgba(244, 67, 54, 0.9)',
  },
  toastInfo: {
    background: 'rgba(33, 150, 243, 0.9)',
  },
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
  
  // Portfolio state
  const [balances, setBalances] = useState({});
  const [lpBalances, setLpBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  
  // LP Creator state
  const [selectedPair, setSelectedPair] = useState('DTGC/PLS');
  const [lpAmount0, setLpAmount0] = useState('');
  const [lpAmount1, setLpAmount1] = useState('');
  const [lpLoading, setLpLoading] = useState(false);
  const [pairAddress, setPairAddress] = useState(null);
  
  // Token selector
  const [showFromSelect, setShowFromSelect] = useState(false);
  const [showToSelect, setShowToSelect] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const formatNumber = (num, decimals = 4) => {
    if (!num || isNaN(num)) return '0';
    const n = parseFloat(num);
    if (n === 0) return '0';
    if (n < 0.0001) return '<0.0001';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(decimals);
  };

  const getDeadline = () => Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

  // ═══════════════════════════════════════════════════════════════════════════
  // BALANCE FETCHING
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchBalances = useCallback(async () => {
    if (!provider || !userAddress) return;
    
    setLoadingBalances(true);
    try {
      const newBalances = {};
      
      // Fetch PLS balance
      const plsBal = await provider.getBalance(userAddress);
      newBalances.PLS = parseFloat(ethers.formatEther(plsBal));
      
      // Fetch token balances
      for (const [symbol, token] of Object.entries(CONFIG.TOKENS)) {
        if (token.isNative) continue;
        
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const bal = await contract.balanceOf(userAddress);
        newBalances[symbol] = parseFloat(ethers.formatUnits(bal, token.decimals));
      }
      
      setBalances(newBalances);
      
      // Fetch LP balances
      const factory = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
      const newLpBalances = {};
      
      for (const [pairName, pair] of Object.entries(CONFIG.LP_PAIRS)) {
        const token0Addr = CONFIG.TOKENS[pair.token0].address;
        const token1Addr = CONFIG.TOKENS[pair.token1].address;
        
        const lpAddress = await factory.getPair(token0Addr, token1Addr);
        if (lpAddress && lpAddress !== ethers.ZeroAddress) {
          const lpContract = new ethers.Contract(lpAddress, ERC20_ABI, provider);
          const lpBal = await lpContract.balanceOf(userAddress);
          newLpBalances[pairName] = {
            address: lpAddress,
            balance: parseFloat(ethers.formatEther(lpBal)),
          };
        }
      }
      
      setLpBalances(newLpBalances);
      
    } catch (err) {
      console.error('Error fetching balances:', err);
    }
    setLoadingBalances(false);
  }, [provider, userAddress]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances, activeTab]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SWAP FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const getQuote = useCallback(async (inputAmount, from, to) => {
    if (!provider || !inputAmount || parseFloat(inputAmount) <= 0) {
      setToAmount('');
      return;
    }
    
    setQuoteLoading(true);
    try {
      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, provider);
      const fromAddr = CONFIG.TOKENS[from].address;
      const toAddr = CONFIG.TOKENS[to].address;
      const amountIn = ethers.parseUnits(inputAmount, CONFIG.TOKENS[from].decimals);
      
      const path = [fromAddr, toAddr];
      const amounts = await router.getAmountsOut(amountIn, path);
      const amountOut = ethers.formatUnits(amounts[1], CONFIG.TOKENS[to].decimals);
      
      setToAmount(parseFloat(amountOut).toFixed(6));
    } catch (err) {
      console.error('Quote error:', err);
      setToAmount('');
    }
    setQuoteLoading(false);
  }, [provider]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fromAmount) {
        getQuote(fromAmount, fromToken, toToken);
      }
    }, 500);
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
      
      // Calculate fees
      const devFee = inputAmount * BigInt(CONFIG.FEES.DEV_BPS) / 10000n;
      const amountAfterDevFee = inputAmount - devFee;
      
      // Get quote for amount after dev fee
      const amountsOut = await router.getAmountsOut(amountAfterDevFee, [fromAddr, toAddr]);
      const expectedOut = amountsOut[1];
      
      // Calculate burn fee from output
      const burnFee = expectedOut * BigInt(CONFIG.FEES.BURN_BPS) / 10000n;
      const amountOutAfterBurn = expectedOut - burnFee;
      const amountOutMin = amountOutAfterBurn * BigInt(10000 - CONFIG.SLIPPAGE_BPS) / 10000n;
      
      let tx;
      
      if (fromToken === 'PLS') {
        // Step 1: Send dev fee in PLS
        showToast(`Sending ${ethers.formatEther(devFee)} PLS dev fee...`, 'info');
        const devFeeTx = await signer.sendTransaction({
          to: CONFIG.DEV_WALLET,
          value: devFee,
        });
        await devFeeTx.wait();
        
        // Step 2: Swap remaining PLS for tokens
        showToast('Executing swap...', 'info');
        tx = await router.swapExactETHForTokens(
          amountOutMin,
          [fromAddr, toAddr],
          userAddress,
          deadline,
          { value: amountAfterDevFee }
        );
        await tx.wait();
        
        // Step 3: Burn fee (send DTGC/URMOM to burn address)
        if (burnFee > 0n) {
          showToast(`Burning ${ethers.formatEther(burnFee)} ${toToken}...`, 'info');
          const tokenContract = new ethers.Contract(toAddr, ERC20_ABI, signer);
          const burnTx = await tokenContract.transfer(CONFIG.BURN_ADDRESS, burnFee);
          await burnTx.wait();
        }
        
      } else if (toToken === 'PLS') {
        // Approve first
        const tokenContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < inputAmount) {
          showToast(`Approving ${fromToken}...`, 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        
        // Step 1: Burn fee from input tokens
        if (devFee > 0n) {
          showToast(`Burning ${ethers.formatEther(devFee)} ${fromToken}...`, 'info');
          const burnTx = await tokenContract.transfer(CONFIG.BURN_ADDRESS, devFee);
          await burnTx.wait();
        }
        
        // Step 2: Swap tokens for PLS
        showToast('Executing swap...', 'info');
        tx = await router.swapExactTokensForETH(
          amountAfterDevFee,
          amountOutMin,
          [fromAddr, toAddr],
          userAddress,
          deadline
        );
        await tx.wait();
        
        // Step 3: Send dev fee in PLS from output
        showToast(`Sending dev fee...`, 'info');
        const devFeeTx = await signer.sendTransaction({
          to: CONFIG.DEV_WALLET,
          value: burnFee, // Use burnFee amount for PLS output
        });
        await devFeeTx.wait();
        
      } else {
        // Token to token swap (e.g., DTGC <-> URMOM)
        const fromContract = new ethers.Contract(fromAddr, ERC20_ABI, signer);
        const toContract = new ethers.Contract(toAddr, ERC20_ABI, signer);
        
        // Approve
        const allowance = await fromContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < inputAmount) {
          showToast(`Approving ${fromToken}...`, 'info');
          const approveTx = await fromContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        
        // Step 1: Burn fee from input tokens
        if (devFee > 0n) {
          showToast(`Burning ${ethers.formatEther(devFee)} ${fromToken}...`, 'info');
          const burnTx = await fromContract.transfer(CONFIG.BURN_ADDRESS, devFee);
          await burnTx.wait();
        }
        
        // Step 2: Swap tokens
        showToast('Executing swap...', 'info');
        tx = await router.swapExactTokensForTokens(
          amountAfterDevFee,
          amountOutMin,
          [fromAddr, toAddr],
          userAddress,
          deadline
        );
        await tx.wait();
        
        // Step 3: Burn fee from output tokens
        if (burnFee > 0n) {
          showToast(`Burning ${ethers.formatEther(burnFee)} ${toToken}...`, 'info');
          const burnTx2 = await toContract.transfer(CONFIG.BURN_ADDRESS, burnFee);
          await burnTx2.wait();
        }
      }
      
      showToast(`Swapped ${fromAmount} ${fromToken} for ${toToken}! (0.35% burned, 0.35% dev fee)`, 'success');
      setFromAmount('');
      setToAmount('');
      fetchBalances();
      
    } catch (err) {
      console.error('Swap error:', err);
      showToast(err.reason || 'Swap failed', 'error');
    }
    setSwapLoading(false);
  };

  const flipTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // LP CREATOR FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const fetchPairInfo = useCallback(async () => {
    if (!provider) return;
    
    const pair = CONFIG.LP_PAIRS[selectedPair];
    const token0Addr = CONFIG.TOKENS[pair.token0].address;
    const token1Addr = CONFIG.TOKENS[pair.token1].address;
    
    try {
      const factory = new ethers.Contract(CONFIG.FACTORY, FACTORY_ABI, provider);
      const lpAddress = await factory.getPair(token0Addr, token1Addr);
      setPairAddress(lpAddress !== ethers.ZeroAddress ? lpAddress : null);
    } catch (err) {
      console.error('Error fetching pair:', err);
      setPairAddress(null);
    }
  }, [provider, selectedPair]);

  useEffect(() => {
    fetchPairInfo();
  }, [fetchPairInfo]);

  const calculateLpAmount1 = useCallback(async (amount0) => {
    if (!provider || !pairAddress || !amount0 || parseFloat(amount0) <= 0) {
      setLpAmount1('');
      return;
    }
    
    try {
      const pair = CONFIG.LP_PAIRS[selectedPair];
      const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      
      const reserves = await pairContract.getReserves();
      const pairToken0 = await pairContract.token0();
      
      const token0Addr = CONFIG.TOKENS[pair.token0].address.toLowerCase();
      
      let reserve0, reserve1;
      if (pairToken0.toLowerCase() === token0Addr) {
        reserve0 = reserves[0];
        reserve1 = reserves[1];
      } else {
        reserve0 = reserves[1];
        reserve1 = reserves[0];
      }
      
      const amount0Wei = ethers.parseUnits(amount0, CONFIG.TOKENS[pair.token0].decimals);
      const amount1Wei = (amount0Wei * reserve1) / reserve0;
      const amount1 = ethers.formatUnits(amount1Wei, CONFIG.TOKENS[pair.token1].decimals);
      
      setLpAmount1(parseFloat(amount1).toFixed(6));
    } catch (err) {
      console.error('Error calculating LP amount:', err);
      setLpAmount1('');
    }
  }, [provider, pairAddress, selectedPair]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (lpAmount0) {
        calculateLpAmount1(lpAmount0);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [lpAmount0, calculateLpAmount1]);

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
      
      let tx;
      
      if (token1.isNative) {
        // AddLiquidityETH (token + PLS)
        const tokenContract = new ethers.Contract(token0.address, ERC20_ABI, signer);
        const allowance = await tokenContract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance < amount0Desired) {
          showToast(`Approving ${token0.symbol}...`, 'info');
          const approveTx = await tokenContract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        
        tx = await router.addLiquidityETH(
          token0.address,
          amount0Desired,
          amount0Min,
          amount1Min,
          userAddress,
          deadline,
          { value: amount1Desired }
        );
      } else {
        // AddLiquidity (token + token)
        // Approve both tokens
        const token0Contract = new ethers.Contract(token0.address, ERC20_ABI, signer);
        const token1Contract = new ethers.Contract(token1.address, ERC20_ABI, signer);
        
        const allowance0 = await token0Contract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance0 < amount0Desired) {
          showToast(`Approving ${token0.symbol}...`, 'info');
          const approveTx = await token0Contract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        
        const allowance1 = await token1Contract.allowance(userAddress, CONFIG.ROUTER);
        if (allowance1 < amount1Desired) {
          showToast(`Approving ${token1.symbol}...`, 'info');
          const approveTx = await token1Contract.approve(CONFIG.ROUTER, ethers.MaxUint256);
          await approveTx.wait();
        }
        
        tx = await router.addLiquidity(
          token0.address,
          token1.address,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          userAddress,
          deadline
        );
      }
      
      showToast('Adding liquidity... Waiting for confirmation.', 'info');
      await tx.wait();
      
      showToast(`LP created! Added ${lpAmount0} ${token0.symbol} + ${lpAmount1} ${token1.symbol}`, 'success');
      setLpAmount0('');
      setLpAmount1('');
      fetchBalances();
      
    } catch (err) {
      console.error('Add liquidity error:', err);
      showToast(err.reason || 'Failed to add liquidity', 'error');
    }
    setLpLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  const renderTokenSelector = (isFrom) => {
    const show = isFrom ? showFromSelect : showToSelect;
    const setShow = isFrom ? setShowFromSelect : setShowToSelect;
    const currentToken = isFrom ? fromToken : toToken;
    const setToken = isFrom ? setFromToken : setToToken;
    const otherToken = isFrom ? toToken : fromToken;
    
    return (
      <div style={{ position: 'relative' }}>
        <button
          style={styles.tokenSelect}
          onClick={() => setShow(!show)}
        >
          <span>{CONFIG.TOKENS[currentToken].logo}</span>
          <span>{currentToken}</span>
          <span style={{ marginLeft: 'auto' }}>▼</span>
        </button>
        
        {show && (
          <div style={styles.selectDropdown}>
            {Object.entries(CONFIG.TOKENS).map(([symbol, token]) => (
              <div
                key={symbol}
                style={{
                  ...styles.selectOption,
                  opacity: symbol === otherToken ? 0.5 : 1,
                  background: symbol === currentToken ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
                }}
                onClick={() => {
                  if (symbol !== otherToken) {
                    setToken(symbol);
                    setShow(false);
                    setFromAmount('');
                    setToAmount('');
                  }
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>{token.logo}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{symbol}</div>
                  <div style={{ fontSize: '0.75rem', color: '#888' }}>{token.name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>🏆 V4 DeFi Gold Suite</div>
        <div style={styles.subtitle}>Swap • Portfolio • Create LP</div>
      </div>
      
      {/* Tabs */}
      <div style={styles.tabs}>
        {['swap', 'portfolio', 'create-lp'].map((tab) => (
          <button
            key={tab}
            style={{
              ...styles.tab,
              ...(activeTab === tab ? styles.tabActive : styles.tabInactive),
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'swap' && '🔄 Swap'}
            {tab === 'portfolio' && '📊 Portfolio'}
            {tab === 'create-lp' && '💧 Create LP'}
          </button>
        ))}
      </div>
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* SWAP TAB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'swap' && (
        <div>
          {/* Fee Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(212,175,55,0.1), rgba(255,107,107,0.1))',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🔥</span>
              <span style={{ color: '#FF6B6B', fontSize: '0.85rem', fontWeight: 600 }}>0.35% Burn</span>
            </div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>+</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💰</span>
              <span style={{ color: '#D4AF37', fontSize: '0.85rem', fontWeight: 600 }}>0.35% Dev</span>
            </div>
            <div style={{ color: '#666', fontSize: '0.85rem' }}>=</div>
            <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 700 }}>0.70% Total</div>
          </div>

          {/* From */}
          <div style={styles.card}>
            <span style={styles.label}>From</span>
            <div style={styles.inputGroup}>
              <input
                type="number"
                placeholder="0.0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                style={styles.input}
              />
              {renderTokenSelector(true)}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
              Balance: {formatNumber(balances[fromToken])} {fromToken}
              <button
                onClick={() => setFromAmount(balances[fromToken]?.toString() || '0')}
                style={{ background: 'none', border: 'none', color: '#D4AF37', marginLeft: '8px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                MAX
              </button>
            </div>
          </div>
          
          {/* Flip Button */}
          <button style={styles.flipButton} onClick={flipTokens}>
            ↕
          </button>
          
          {/* To */}
          <div style={styles.card}>
            <span style={styles.label}>To {quoteLoading && '(fetching...)'}</span>
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="0.0"
                value={toAmount}
                readOnly
                style={{ ...styles.input, color: '#D4AF37' }}
              />
              {renderTokenSelector(false)}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
              Balance: {formatNumber(balances[toToken])} {toToken}
            </div>
          </div>
          
          {/* Swap Info */}
          {fromAmount && toAmount && (
            <div style={{ ...styles.card, padding: '12px 16px' }}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Rate</span>
                <span style={styles.infoValue}>
                  1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken}
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>🔥 Burn Fee</span>
                <span style={{ ...styles.infoValue, color: '#FF6B6B' }}>
                  0.35% ({(parseFloat(fromAmount) * 0.0035).toFixed(4)} {fromToken})
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>💰 Dev Fee</span>
                <span style={{ ...styles.infoValue, color: '#D4AF37' }}>
                  0.35% ({(parseFloat(toAmount) * 0.0035).toFixed(4)} {toToken})
                </span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Slippage</span>
                <span style={styles.infoValue}>{CONFIG.SLIPPAGE_BPS / 100}%</span>
              </div>
              <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
                <span style={styles.infoLabel}>You Receive</span>
                <span style={{ ...styles.infoValue, color: '#4CAF50', fontWeight: 700 }}>
                  ~{(parseFloat(toAmount) * 0.993).toFixed(4)} {toToken}
                </span>
              </div>
            </div>
          )}
          
          {/* Swap Button */}
          <button
            style={{
              ...styles.swapButton,
              ...(!userAddress || !fromAmount || !toAmount || swapLoading ? styles.swapButtonDisabled : {}),
            }}
            onClick={executeSwap}
            disabled={!userAddress || !fromAmount || !toAmount || swapLoading}
          >
            {!userAddress ? 'Connect Wallet' :
             swapLoading ? 'Swapping...' :
             !fromAmount ? 'Enter Amount' :
             `Swap ${fromToken} for ${toToken}`}
          </button>
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* PORTFOLIO TAB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'portfolio' && (
        <div>
          {loadingBalances ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              Loading balances...
            </div>
          ) : !userAddress ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              Connect wallet to view portfolio
            </div>
          ) : (
            <>
              {/* Token Balances */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>
                  💰 Token Holdings
                </div>
                {Object.entries(CONFIG.TOKENS).map(([symbol, token]) => (
                  <div key={symbol} style={styles.balanceRow}>
                    <div style={styles.balanceToken}>
                      <div style={styles.balanceIcon}>{token.logo}</div>
                      <div style={styles.balanceInfo}>
                        <span style={styles.balanceSymbol}>{symbol}</span>
                        <span style={styles.balanceName}>{token.name}</span>
                      </div>
                    </div>
                    <div style={styles.balanceAmount}>
                      <div style={styles.balanceValue}>
                        {formatNumber(balances[symbol])}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* LP Balances */}
              <div>
                <div style={{ color: '#D4AF37', fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px' }}>
                  💧 LP Positions
                </div>
                {Object.entries(CONFIG.LP_PAIRS).map(([pairName, pair]) => (
                  <div key={pairName} style={styles.balanceRow}>
                    <div style={styles.balanceToken}>
                      <div style={styles.balanceIcon}>🔷</div>
                      <div style={styles.balanceInfo}>
                        <span style={styles.balanceSymbol}>{pairName}</span>
                        <span style={styles.balanceName}>PulseX LP</span>
                      </div>
                    </div>
                    <div style={styles.balanceAmount}>
                      <div style={styles.balanceValue}>
                        {formatNumber(lpBalances[pairName]?.balance || 0)}
                      </div>
                      {lpBalances[pairName]?.address && (
                        <a
                          href={`${CONFIG.EXPLORER}/address/${lpBalances[pairName].address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#D4AF37', fontSize: '0.7rem', textDecoration: 'none' }}
                        >
                          View LP ↗
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Refresh Button */}
              <button
                onClick={fetchBalances}
                style={{
                  ...styles.swapButton,
                  background: 'rgba(212, 175, 55, 0.2)',
                  color: '#D4AF37',
                }}
              >
                🔄 Refresh Balances
              </button>
            </>
          )}
        </div>
      )}
      
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* CREATE LP TAB */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'create-lp' && (
        <div>
          {/* LP Pair Selector */}
          <div style={styles.lpSelector}>
            {Object.entries(CONFIG.LP_PAIRS).map(([pairName, pair]) => (
              <div
                key={pairName}
                style={{
                  ...styles.lpOption,
                  ...(selectedPair === pairName ? styles.lpOptionActive : styles.lpOptionInactive),
                }}
                onClick={() => {
                  setSelectedPair(pairName);
                  setLpAmount0('');
                  setLpAmount1('');
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>
                  {CONFIG.TOKENS[pair.token0].logo}{CONFIG.TOKENS[pair.token1].logo}
                </div>
                <div style={{ color: '#fff', fontWeight: 600 }}>{pairName}</div>
              </div>
            ))}
          </div>
          
          {/* Token 0 Input */}
          <div style={styles.card}>
            <span style={styles.label}>{CONFIG.LP_PAIRS[selectedPair].token0}</span>
            <div style={styles.inputGroup}>
              <input
                type="number"
                placeholder="0.0"
                value={lpAmount0}
                onChange={(e) => setLpAmount0(e.target.value)}
                style={styles.input}
              />
              <div style={styles.tokenSelect}>
                <span>{CONFIG.TOKENS[CONFIG.LP_PAIRS[selectedPair].token0].logo}</span>
                <span>{CONFIG.LP_PAIRS[selectedPair].token0}</span>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
              Balance: {formatNumber(balances[CONFIG.LP_PAIRS[selectedPair].token0])}
              <button
                onClick={() => setLpAmount0(balances[CONFIG.LP_PAIRS[selectedPair].token0]?.toString() || '0')}
                style={{ background: 'none', border: 'none', color: '#D4AF37', marginLeft: '8px', cursor: 'pointer', fontSize: '0.75rem' }}
              >
                MAX
              </button>
            </div>
          </div>
          
          {/* Plus Icon */}
          <div style={{ textAlign: 'center', margin: '-8px 0', fontSize: '1.5rem', color: '#D4AF37' }}>+</div>
          
          {/* Token 1 Input */}
          <div style={styles.card}>
            <span style={styles.label}>{CONFIG.LP_PAIRS[selectedPair].token1} (auto-calculated)</span>
            <div style={styles.inputGroup}>
              <input
                type="text"
                placeholder="0.0"
                value={lpAmount1}
                readOnly
                style={{ ...styles.input, color: '#D4AF37' }}
              />
              <div style={styles.tokenSelect}>
                <span>{CONFIG.TOKENS[CONFIG.LP_PAIRS[selectedPair].token1].logo}</span>
                <span>{CONFIG.LP_PAIRS[selectedPair].token1}</span>
              </div>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#888' }}>
              Balance: {formatNumber(balances[CONFIG.LP_PAIRS[selectedPair].token1])}
            </div>
          </div>
          
          {/* LP Info */}
          {pairAddress ? (
            <div style={{ ...styles.card, padding: '12px 16px' }}>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Pool Status</span>
                <span style={{ ...styles.infoValue, color: '#4CAF50' }}>✓ Pool Exists</span>
              </div>
              <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
                <span style={styles.infoLabel}>LP Address</span>
                <a
                  href={`${CONFIG.EXPLORER}/address/${pairAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#D4AF37', fontSize: '0.8rem' }}
                >
                  {pairAddress.slice(0, 8)}...{pairAddress.slice(-6)} ↗
                </a>
              </div>
            </div>
          ) : (
            <div style={{ ...styles.card, padding: '12px 16px', background: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
              <div style={{ color: '#FF9800', fontSize: '0.85rem', textAlign: 'center' }}>
                ⚠️ This pool doesn't exist yet. You'll be the first LP!
              </div>
            </div>
          )}
          
          {/* Add Liquidity Button */}
          <button
            style={{
              ...styles.swapButton,
              ...(!userAddress || !lpAmount0 || !lpAmount1 || lpLoading ? styles.swapButtonDisabled : {}),
            }}
            onClick={addLiquidity}
            disabled={!userAddress || !lpAmount0 || !lpAmount1 || lpLoading}
          >
            {!userAddress ? 'Connect Wallet' :
             lpLoading ? 'Adding Liquidity...' :
             !lpAmount0 ? 'Enter Amount' :
             `Add ${selectedPair} Liquidity`}
          </button>
          
          {/* Warning */}
          <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(244, 67, 54, 0.1)', borderRadius: '8px', border: '1px solid rgba(244, 67, 54, 0.3)' }}>
            <div style={{ color: '#F44336', fontSize: '0.75rem' }}>
              ⚠️ <strong>Impermanent Loss Warning:</strong> Providing liquidity involves risk. Token price changes may result in loss compared to holding.
            </div>
          </div>
        </div>
      )}
      
      {/* Close Button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '12px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#888',
            cursor: 'pointer',
          }}
        >
          ← Back to Staking
        </button>
      )}
      
      {/* Toast */}
      {toast && (
        <div style={{
          ...styles.toast,
          ...(toast.type === 'success' ? styles.toastSuccess :
              toast.type === 'error' ? styles.toastError : styles.toastInfo),
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
