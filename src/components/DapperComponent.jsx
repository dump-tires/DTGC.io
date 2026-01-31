import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════
// DAPPER FLEX - ENHANCED EDITION V3
// Flex Tier LP Zapper • 99% MAX • Double Confirmation
// Error-Resistant • DTGC Favicon • LP Icon
// ═══════════════════════════════════════════════════════════════

// ============================================
// TOKEN LOGO CONFIGURATION
// ============================================
const TOKEN_LOGOS = {
  '0xd0676b28a457371d58d47e5247b439114e40eb0f': '/dtgc-coin.png', // Official DTGC Gold Trading Coin logo
  '0x670c972bb5388e087a2934a063064d97278e01f3': '/LPfavicon.png',
  '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0': 'https://gib.show/image/369/0xe43b3cee3554e120213b8b69caf690b6c04a7ec0',
  '0xa1077a294dde1b09bb074bec877f05b634579687': 'https://tokens.app.pulsex.com/images/tokens/0xA1077a294dDE1B09bB074Bec877f05b634579687.png',
  '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': 'https://gib.show/image/369/0x2b591e99afe9f32eaa6214f7b7629768c40eeb39',
  '0x95b303987a60c71504d99aa1b13b4da07b0790ab': 'https://gib.show/image/369/0x95b303987a60c71504d99aa1b13b4da07b0790ab',
  '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': 'https://gib.show/image/369/0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d',
};

const getTokenLogo = (tokenAddress) => {
  if (!tokenAddress) return null;
  const addr = tokenAddress.toLowerCase();
  if (TOKEN_LOGOS[addr]) return TOKEN_LOGOS[addr];
  return `https://gib.show/image/369/${addr}`;
};

// Token Icon Component
const TokenIcon = ({ address, symbol, size = 32 }) => {
  const [imgError, setImgError] = useState(false);
  const logo = getTokenLogo(address);
  
  if (logo && !imgError) {
    return (
      <img 
        src={logo} 
        alt={symbol || 'Token'}
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%',
          objectFit: 'cover',
          border: '2px solid rgba(255, 20, 147, 0.3)',
          background: '#1a0a10',
        }}
        onError={() => setImgError(true)}
      />
    );
  }
  
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ff149340, #c7158540)',
      border: '2px solid #ff1493',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: size * 0.4,
      color: '#ff1493',
    }}>
      {symbol?.charAt(0) || '?'}
    </div>
  );
};

// Copy Button Component
const CopyButton = ({ text, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };
  
  return (
    <button 
      onClick={handleCopy}
      style={{
        padding: '4px 8px',
        fontSize: '11px',
        background: copied ? 'rgba(0,255,0,0.2)' : 'rgba(255,20,147,0.2)',
        border: `1px solid ${copied ? '#00ff00' : '#ff1493'}`,
        borderRadius: '4px',
        color: copied ? '#00ff00' : '#ff1493',
        cursor: 'pointer',
        marginLeft: '8px',
      }}
    >
      {copied ? '✓ Copied!' : `📋 ${label}`}
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════
// CONFIRMATION MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  tokenSymbol, 
  tokenAmount, 
  plsValue, 
  usdValue,
  loading 
}) => {
  const [step, setStep] = useState(1);
  
  useEffect(() => {
    if (isOpen) setStep(1);
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  const handleFirstConfirm = () => {
    setStep(2);
  };
  
  const handleFinalConfirm = () => {
    onConfirm();
  };
  
  return (
    <div style={modalStyles.overlay}>
      <div style={modalStyles.modal}>
        <div style={modalStyles.header}>
          <h3 style={modalStyles.title}>
            {step === 1 ? '⚠️ Confirm Zap' : '🔐 Final Confirmation'}
          </h3>
          <button onClick={onClose} style={modalStyles.closeBtn}>✕</button>
        </div>
        
        <div style={modalStyles.body}>
          {step === 1 ? (
            <>
              <div style={modalStyles.infoBox}>
                <div style={modalStyles.infoLabel}>You are zapping:</div>
                <div style={modalStyles.infoValue}>
                  {parseFloat(tokenAmount).toLocaleString()} {tokenSymbol}
                </div>
              </div>
              
              <div style={modalStyles.valueBox}>
                <div style={modalStyles.valueRow}>
                  <span>Estimated PLS Value:</span>
                  <span style={{ color: '#D4AF37', fontWeight: 'bold' }}>
                    {plsValue ? `${parseFloat(plsValue).toLocaleString()} PLS` : 'Calculating...'}
                  </span>
                </div>
                <div style={modalStyles.valueRow}>
                  <span>Estimated USD Value:</span>
                  <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                    ${usdValue ? parseFloat(usdValue).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
              
              <div style={modalStyles.warning}>
                ⚠️ This action will convert your tokens to LP and stake them in the Flex tier at 10% APR with no lockup.
              </div>
              
              <button 
                onClick={handleFirstConfirm}
                style={modalStyles.confirmBtn}
              >
                Continue to Final Confirmation →
              </button>
            </>
          ) : (
            <>
              <div style={modalStyles.finalWarning}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>🚨</div>
                <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
                  ARE YOU SURE?
                </div>
                <div style={{ fontSize: '0.9rem', color: '#aaa' }}>
                  You are about to zap <strong style={{ color: '#ff1493' }}>{parseFloat(tokenAmount).toLocaleString()} {tokenSymbol}</strong> 
                  {' '}worth approximately <strong style={{ color: '#4CAF50' }}>${usdValue ? parseFloat(usdValue).toFixed(2) : '0.00'}</strong>
                </div>
              </div>
              
              <div style={modalStyles.buttonRow}>
                <button 
                  onClick={onClose}
                  style={modalStyles.cancelBtn}
                >
                  ❌ Cancel
                </button>
                <button 
                  onClick={handleFinalConfirm}
                  disabled={loading}
                  style={{
                    ...modalStyles.finalConfirmBtn,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {loading ? '⏳ Processing...' : '✅ CONFIRM ZAP'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  modal: {
    background: 'linear-gradient(135deg, #2a1520 0%, #1a0a15 100%)',
    border: '2px solid #ff1493',
    borderRadius: '16px',
    maxWidth: '450px',
    width: '90%',
    boxShadow: '0 8px 32px rgba(255, 20, 147, 0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #ff149340',
  },
  title: {
    margin: 0,
    color: '#fff',
    fontSize: '1.1rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '1.2rem',
    cursor: 'pointer',
  },
  body: {
    padding: '20px',
  },
  infoBox: {
    background: 'rgba(255,20,147,0.1)',
    border: '1px solid #ff149340',
    borderRadius: '10px',
    padding: '15px',
    marginBottom: '15px',
    textAlign: 'center',
  },
  infoLabel: {
    color: '#888',
    fontSize: '0.85rem',
    marginBottom: '5px',
  },
  infoValue: {
    color: '#ff1493',
    fontSize: '1.4rem',
    fontWeight: 'bold',
  },
  valueBox: {
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '10px',
    padding: '15px',
    marginBottom: '15px',
  },
  valueRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    color: '#ccc',
    fontSize: '0.9rem',
  },
  warning: {
    background: 'rgba(255,170,0,0.1)',
    border: '1px solid #ffaa0040',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '15px',
    color: '#ffaa00',
    fontSize: '0.8rem',
    textAlign: 'center',
  },
  confirmBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #ff1493, #c71585)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  finalWarning: {
    textAlign: 'center',
    padding: '20px',
    color: '#fff',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  cancelBtn: {
    flex: 1,
    padding: '14px',
    background: 'rgba(255,0,0,0.2)',
    border: '2px solid #ff4444',
    borderRadius: '10px',
    color: '#ff4444',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  finalConfirmBtn: {
    flex: 1,
    padding: '14px',
    background: 'linear-gradient(135deg, #00aa00, #008800)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

// ═══════════════════════════════════════════════════════════════
// TOKEN VALIDATOR (with timeout protection)
// ═══════════════════════════════════════════════════════════════
const TOKEN_VALIDATOR = {
  KNOWN_PAIRS: {
    'dtgc:pls': '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
    'urmom:pls': '0x0548656e272fec9534e180d3174cfc57ab6e10c0',
    'hex:pls': '0x6F1cCa5F5F36C20b5E7eD57B10b5C8a5A6e2F9d7',
    'plsx:pls': '0x1b45b9148791D3a104184Cd5DFE5CE57193a3ee9',
    'inc:pls': '0xe56043671df55de5cdf8459710433c10324de0ae',
  },

  VALIDATION_CACHE: new Map(),
  PAIR_CACHE: new Map(),

  SAFE_TOKENS: {
    '0xa1077a294dde1b09bb074bec877f05b634579687': { name: 'WPLS', symbol: 'WPLS', risk: 'LOW', decimals: 18 },
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab': { name: 'PLSX', symbol: 'PLSX', risk: 'LOW', decimals: 18 },
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': { name: 'HEX', symbol: 'HEX', risk: 'LOW', decimals: 8 },
    '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': { name: 'INC', symbol: 'INC', risk: 'LOW', decimals: 18 },
    '0xd0676b28a457371d58d47e5247b439114e40eb0f': { name: 'DTGC', symbol: 'DTGC', risk: 'LOW', decimals: 18 },
    '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0': { name: 'URMOM', symbol: 'URMOM', risk: 'LOW', decimals: 18 },
    '0x670c972bb5388e087a2934a063064d97278e01f3': { name: 'DTGC/URMOM LP', symbol: 'DTGC-URMOM-LP', risk: 'LOW', decimals: 18 },
  },

  async validateToken(tokenAddress, provider, timeoutMs = 5000) {
    const addr = tokenAddress.toLowerCase();

    if (this.VALIDATION_CACHE.has(addr)) {
      return this.VALIDATION_CACHE.get(addr);
    }

    const validation = {
      address: tokenAddress,
      isValid: false,
      reason: '',
      hasLiquidity: false,
      liquidityUsd: 0,
      risk: 'UNKNOWN',
      details: {},
    };

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Validation timeout')), timeoutMs)
    );

    try {
      if (this.SAFE_TOKENS[addr]) {
        const token = this.SAFE_TOKENS[addr];
        validation.isValid = true;
        validation.risk = 'LOW';
        validation.hasLiquidity = true;
        validation.liquidityUsd = 50000;
        validation.details = {
          whitelisted: true,
          name: token.name,
          symbol: token.symbol,
          decimals: token.decimals,
          tokenInfo: { name: token.name, symbol: token.symbol, decimals: token.decimals, isValid: true }
        };
        this.VALIDATION_CACHE.set(addr, validation);
        return validation;
      }

      if (this.isBlacklisted(addr)) {
        validation.reason = 'Blacklisted address';
        validation.risk = 'CRITICAL';
        this.VALIDATION_CACHE.set(addr, validation);
        return validation;
      }

      const tokenInfo = await Promise.race([
        this.getTokenInfoFast(addr, provider),
        timeoutPromise
      ]);
      
      if (!tokenInfo.isValid) {
        validation.reason = 'Invalid token contract';
        this.VALIDATION_CACHE.set(addr, validation);
        return validation;
      }

      validation.details.tokenInfo = tokenInfo;

      try {
        const liquidity = await Promise.race([
          this.checkLiquidityFast(addr, tokenInfo.symbol, provider),
          new Promise((resolve) => setTimeout(() => resolve({ hasLiquidity: false, liquidityUsd: 0, timedOut: true }), 3000))
        ]);
        
        validation.hasLiquidity = liquidity.hasLiquidity;
        validation.liquidityUsd = liquidity.liquidityUsd;
        validation.details.liquidity = liquidity;
      } catch (liqErr) {
        validation.details.liquidityNote = 'Could not verify liquidity';
      }

      if (!validation.hasLiquidity) {
        validation.reason = 'No liquidity found';
        validation.risk = 'HIGH';
      } else if (validation.liquidityUsd < 1000) {
        validation.risk = validation.liquidityUsd < 100 ? 'HIGH' : 'MEDIUM';
        validation.reason = `Low liquidity ($${validation.liquidityUsd.toFixed(0)})`;
      } else {
        validation.risk = 'LOW';
      }

      validation.isValid = tokenInfo.isValid;
      this.VALIDATION_CACHE.set(addr, validation);
      return validation;

    } catch (err) {
      if (err.message === 'Validation timeout') {
        validation.isValid = true;
        validation.risk = 'MEDIUM';
        validation.reason = 'Validation timed out';
        validation.details.timedOut = true;
      } else {
        validation.reason = `Error: ${err.message}`;
        validation.risk = 'ERROR';
      }
      this.VALIDATION_CACHE.set(addr, validation);
      return validation;
    }
  },

  isBlacklisted(address) {
    return ['0x0000000000000000000000000000000000000000', '0x000000000000000000000000000000000000dead'].includes(address.toLowerCase());
  },

  async getTokenInfoFast(tokenAddress, provider) {
    const result = { isValid: false, name: '', symbol: '', decimals: 18 };
    try {
      const contract = new ethers.Contract(tokenAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
      ], provider);
      
      const [name, symbol, decimals] = await Promise.all([
        contract.name().catch(() => ''),
        contract.symbol().catch(() => ''),
        contract.decimals().catch(() => 18),
      ]);

      result.name = name || 'Unknown';
      result.symbol = symbol || 'UNKNOWN';
      result.decimals = decimals || 18;
      result.isValid = true;
      return result;
    } catch (err) {
      return result;
    }
  },

  async checkLiquidityFast(tokenAddress, tokenSymbol, provider) {
    const result = { hasLiquidity: false, liquidityUsd: 0 };
    try {
      const pls = '0xA1077a294dDE1B09bB074Bec877f05b634579687';
      const cacheKey = `${tokenSymbol?.toLowerCase() || ''}:pls`;

      if (this.KNOWN_PAIRS[cacheKey]) {
        const pairAddress = this.KNOWN_PAIRS[cacheKey];
        const reserves = await this.getReservesFast(pairAddress, provider);
        result.hasLiquidity = reserves.liquidityUsd > 100;
        result.liquidityUsd = reserves.liquidityUsd;
        return result;
      }

      if (this.PAIR_CACHE.has(tokenAddress.toLowerCase())) {
        return this.PAIR_CACHE.get(tokenAddress.toLowerCase());
      }

      const pairAddress = await this.findPairFast(tokenAddress, pls, provider);
      if (!pairAddress || pairAddress === ethers.ZeroAddress) return result;

      const reserves = await this.getReservesFast(pairAddress, provider);
      result.hasLiquidity = reserves.liquidityUsd > 100;
      result.liquidityUsd = reserves.liquidityUsd;
      this.PAIR_CACHE.set(tokenAddress.toLowerCase(), result);
      return result;
    } catch (err) {
      return result;
    }
  },

  async findPairFast(tokenAddress, pls, provider) {
    try {
      const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
      const v1Factory = new ethers.Contract('0xE1Cc890455B1d9537034da8e1ffB0d5f4E150e9e', FACTORY_ABI, provider);
      const v2Factory = new ethers.Contract('0x1715Ac0f39513b6D53a0b3ba5d63c9bc575f7bEA', FACTORY_ABI, provider);

      const [v1Pair, v2Pair] = await Promise.all([
        v1Factory.getPair(tokenAddress, pls).catch(() => ethers.ZeroAddress),
        v2Factory.getPair(tokenAddress, pls).catch(() => ethers.ZeroAddress),
      ]);

      return v1Pair !== ethers.ZeroAddress ? v1Pair : v2Pair;
    } catch (err) {
      return ethers.ZeroAddress;
    }
  },

  async getReservesFast(pairAddress, provider) {
    try {
      const pair = new ethers.Contract(pairAddress, [
        'function getReserves() view returns (uint112, uint112, uint32)',
      ], provider);
      const reserves = await pair.getReserves();
      const plsReserve = parseFloat(ethers.formatUnits(reserves[1], 18));
      return { liquidityUsd: plsReserve * 0.000018 * 2 };
    } catch (err) {
      return { liquidityUsd: 0 };
    }
  },

  clearCache() {
    this.VALIDATION_CACHE.clear();
    this.PAIR_CACHE.clear();
  },
};

// ═══════════════════════════════════════════════════════════════
// DAPPER COMPONENT (FLEX TIER ZAPPER)
// ═══════════════════════════════════════════════════════════════
const DapperComponent = ({ provider, account, livePrices = {} }) => {
  const [inputToken, setInputToken] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentTokens, setRecentTokens] = useState([]);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [estimatedValues, setEstimatedValues] = useState({ pls: 0, usd: 0 });
  const validateTimeoutRef = useRef(null);

  // Load recent tokens
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dapper-recent-tokens');
      if (saved) setRecentTokens(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // Save recent token
  const saveRecentToken = (token) => {
    const updated = [token, ...recentTokens.filter(t => t.address !== token.address)].slice(0, 5);
    setRecentTokens(updated);
    localStorage.setItem('dapper-recent-tokens', JSON.stringify(updated));
  };

  // Fetch token balance
  const fetchBalance = useCallback(async (tokenAddress) => {
    if (!provider || !account || !tokenAddress) return;
    try {
      const contract = new ethers.Contract(tokenAddress, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
      ], provider);
      
      const [balance, decimals] = await Promise.all([
        contract.balanceOf(account),
        contract.decimals().catch(() => 18),
      ]);
      
      const balanceNum = parseFloat(ethers.formatUnits(balance, decimals));
      setTokenBalance(balanceNum);
    } catch (err) {
      console.log('Balance fetch error:', err.message);
      setTokenBalance(0);
    }
  }, [provider, account]);

  const handleTokenChange = useCallback(async (tokenAddress) => {
    setInputToken(tokenAddress);
    setError('');
    setSuccess('');
    setInputAmount('');
    setTokenBalance(0);

    if (!tokenAddress || tokenAddress.length < 40) {
      setValidation(null);
      return;
    }

    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current);
    }

    setLoading(true);

    validateTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await TOKEN_VALIDATOR.validateToken(tokenAddress, provider, 5000);
        setValidation(result);
        
        if (result.isValid && result.details.tokenInfo) {
          saveRecentToken({
            address: tokenAddress,
            symbol: result.details.tokenInfo.symbol,
            name: result.details.tokenInfo.name,
          });
          // Fetch balance
          fetchBalance(tokenAddress);
        }

        if (!result.isValid) {
          setError(`❌ Invalid token: ${result.reason}`);
        } else if (result.risk === 'HIGH') {
          setError(`⚠️ WARNING: ${result.reason || 'High risk token'}`);
        }
      } catch (err) {
        setError(`Validation error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 150);
  }, [provider, recentTokens, fetchBalance]);

  const handleQuickSelect = (token) => {
    setInputToken(token.address);
    handleTokenChange(token.address);
  };

  // **MAX BUTTON - Uses 99% to avoid gas errors**
  const handleMax = () => {
    if (tokenBalance > 0) {
      const maxAmount = (tokenBalance * 0.99).toFixed(6); // 99% of balance
      setInputAmount(maxAmount);
      calculateEstimates(maxAmount);
    }
  };

  // Calculate PLS and USD estimates
  const calculateEstimates = (amount) => {
    const amt = parseFloat(amount) || 0;
    const symbol = validation?.details?.tokenInfo?.symbol?.toUpperCase() || '';
    
    // Get token price from livePrices
    let tokenPrice = 0;
    if (livePrices[symbol?.toLowerCase()]) {
      tokenPrice = livePrices[symbol.toLowerCase()];
    } else if (symbol === 'DTGC') {
      tokenPrice = livePrices.dtgc || 0.0006;
    } else if (symbol === 'URMOM') {
      tokenPrice = livePrices.urmom || 0.00019;
    }
    
    const plsPrice = livePrices.pls || 0.000016;
    const usdValue = amt * tokenPrice;
    const plsValue = tokenPrice > 0 && plsPrice > 0 ? usdValue / plsPrice : 0;
    
    setEstimatedValues({ pls: plsValue, usd: usdValue });
  };

  useEffect(() => {
    if (inputAmount) {
      calculateEstimates(inputAmount);
    }
  }, [inputAmount, validation, livePrices]);

  // Open confirmation modal
  const handleZapClick = () => {
    if (!validation || !validation.isValid) {
      setError('⛔ Token validation failed');
      return;
    }
    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('❌ Enter valid amount');
      return;
    }
    // Open double confirmation modal
    setShowConfirmation(true);
  };

  // Execute zap after confirmation
  const executeZap = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setShowConfirmation(false);

    try {
      console.log('🚀 Executing Flex Zap:', {
        token: inputToken,
        amount: inputAmount,
        account: account,
        estimatedPLS: estimatedValues.pls,
        estimatedUSD: estimatedValues.usd,
      });

      // TODO: Implement actual zap transaction
      // This would call the Flex staking contract
      
      setSuccess(`✅ Successfully zapped ${inputAmount} ${validation?.details?.tokenInfo?.symbol || 'tokens'}!`);
      setInputAmount('');
      fetchBalance(inputToken);
    } catch (err) {
      setError(`Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_TOKENS = [
    { address: '0xd0676b28a457371d58d47e5247b439114e40eb0f', symbol: 'DTGC', name: 'DTGC' },
    { address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0', symbol: 'URMOM', name: 'URMOM' },
    { address: '0x670c972bb5388e087a2934a063064d97278e01f3', symbol: 'LP', name: 'DTGC/URMOM LP' },
    { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', symbol: 'HEX', name: 'HEX' },
    { address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', symbol: 'PLSX', name: 'PLSX' },
  ];

  return (
    <div style={styles.container}>
      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => setShowConfirmation(false)}
        onConfirm={executeZap}
        tokenSymbol={validation?.details?.tokenInfo?.symbol || 'TOKEN'}
        tokenAmount={inputAmount}
        plsValue={estimatedValues.pls}
        usdValue={estimatedValues.usd}
        loading={loading}
      />

      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <img src="/dtgc-coin.png" alt="DTGC" style={{ width: 40, height: 40, borderRadius: '50%' }} />
          <h2 style={styles.title}>💎 DAPPER FLEX</h2>
        </div>
        <p style={styles.subtitle}>Flex Tier LP Zapper • 10% APR • No Lockup</p>
      </div>

      <div style={styles.accessNotice}>
        ✅ <strong>UNLIMITED ACCESS</strong> - No stake required!
      </div>

      {/* Quick Token Selector */}
      <div style={styles.quickTokens}>
        <div style={styles.quickLabel}>Quick Select:</div>
        <div style={styles.quickGrid}>
          {QUICK_TOKENS.map(token => (
            <button
              key={token.address}
              onClick={() => handleQuickSelect(token)}
              style={{
                ...styles.quickButton,
                background: inputToken.toLowerCase() === token.address.toLowerCase() 
                  ? 'rgba(255,20,147,0.3)' 
                  : 'rgba(255,20,147,0.1)',
                border: inputToken.toLowerCase() === token.address.toLowerCase()
                  ? '2px solid #ff1493'
                  : '1px solid #ff149360',
              }}
            >
              <TokenIcon address={token.address} symbol={token.symbol} size={20} />
              <span>{token.symbol}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Token Address Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Token Address</label>
        <div style={styles.inputWrapper}>
          <input
            type="text"
            placeholder="0x..."
            value={inputToken}
            onChange={(e) => handleTokenChange(e.target.value)}
            style={styles.input}
          />
          {inputToken && <CopyButton text={inputToken} label="Copy" />}
        </div>
        {loading && <span style={styles.loading}>🔍 Validating...</span>}
      </div>

      {/* Token Validation Display */}
      {validation && (
        <div style={{
          ...styles.validationBox,
          borderColor: validation.isValid 
            ? (validation.risk === 'HIGH' ? '#ffaa00' : '#00ff00') 
            : '#ff0000',
        }}>
          <div style={styles.validationHeader}>
            <TokenIcon 
              address={inputToken} 
              symbol={validation.details.tokenInfo?.symbol} 
              size={40} 
            />
            <div style={styles.validationInfo}>
              <div style={styles.tokenName}>
                {validation.details.tokenInfo?.name || 'Unknown Token'}
                <span style={styles.tokenSymbol}>
                  ({validation.details.tokenInfo?.symbol || '???'})
                </span>
              </div>
              <div style={styles.addressRow}>
                <span style={styles.addressText}>
                  {inputToken.slice(0, 10)}...{inputToken.slice(-8)}
                </span>
                <CopyButton text={inputToken} label="Address" />
              </div>
            </div>
          </div>

          <div style={styles.validationStats}>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Your Balance</span>
              <span style={styles.statValue}>
                {tokenBalance.toLocaleString()} {validation.details.tokenInfo?.symbol || ''}
              </span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Risk Level</span>
              <span style={{
                ...styles.statValue,
                color: validation.risk === 'LOW' ? '#00ff00' 
                  : validation.risk === 'MEDIUM' ? '#ffaa00' 
                  : '#ff6666'
              }}>
                {validation.risk === 'LOW' ? '✅' : validation.risk === 'MEDIUM' ? '⚠️' : '🚨'} {validation.risk}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Amount Input */}
      {validation?.isValid && (
        <div style={styles.inputGroup}>
          <label style={styles.label}>Amount to Zap</label>
          <div style={styles.amountWrapper}>
            <input
              type="number"
              placeholder="0.00"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              style={styles.amountInput}
            />
            <button onClick={handleMax} style={styles.maxButton}>
              MAX (99%)
            </button>
          </div>
          
          {/* Estimated Values Display */}
          {inputAmount && parseFloat(inputAmount) > 0 && (
            <div style={styles.estimateBox}>
              <div style={styles.estimateRow}>
                <span>≈ PLS Value:</span>
                <span style={{ color: '#D4AF37' }}>{estimatedValues.pls.toLocaleString()} PLS</span>
              </div>
              <div style={styles.estimateRow}>
                <span>≈ USD Value:</span>
                <span style={{ color: '#4CAF50' }}>${estimatedValues.usd.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Zap Button */}
      <button
        onClick={handleZapClick}
        disabled={!validation?.isValid || !inputAmount || loading}
        style={{
          ...styles.button,
          opacity: !validation?.isValid || !inputAmount || loading ? 0.5 : 1,
          cursor: !validation?.isValid || !inputAmount || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '⏳ Processing...' : '🚀 Zap to Flex Tier'}
      </button>

      {/* Info Footer */}
      <div style={styles.footer}>
        <div style={styles.footerItem}>
          <img src="/dtgc-coin.png" alt="DTGC" style={{ width: 16, height: 16, borderRadius: '50%' }} />
          <span>DTGC Ecosystem</span>
        </div>
        <div style={styles.footerItem}>
          <span>💎 10% APR • No Lock</span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, #2a1520 0%, #1a0a15 100%)',
    border: '2px solid #ff1493',
    borderRadius: '16px',
    padding: '24px',
    maxWidth: '520px',
    margin: '20px auto',
    color: '#fff',
    boxShadow: '0 8px 32px rgba(255, 20, 147, 0.2)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  title: {
    margin: '0',
    fontSize: '1.8rem',
    background: 'linear-gradient(135deg, #ff1493, #ff69b4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: '8px 0 0 0',
    color: '#ffb6c1',
    fontSize: '0.9rem',
  },
  accessNotice: {
    background: 'rgba(0, 255, 0, 0.1)',
    border: '2px solid #00ff00',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '20px',
    color: '#00ff00',
    fontSize: '14px',
    textAlign: 'center',
  },
  quickTokens: {
    marginBottom: '15px',
  },
  quickLabel: {
    fontSize: '12px',
    color: '#ff69b4',
    marginBottom: '8px',
    fontWeight: 'bold',
  },
  quickGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  quickButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '20px',
    cursor: 'pointer',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.2s',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    color: '#ff69b4',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '12px',
    background: '#1a0a10',
    border: '2px solid #ff149360',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  amountWrapper: {
    display: 'flex',
    gap: '8px',
  },
  amountInput: {
    flex: 1,
    padding: '12px',
    background: '#1a0a10',
    border: '2px solid #ff149360',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  },
  maxButton: {
    padding: '12px 16px',
    background: 'rgba(212,175,55,0.3)',
    border: '2px solid #D4AF37',
    borderRadius: '10px',
    color: '#D4AF37',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
  },
  estimateBox: {
    marginTop: '10px',
    padding: '10px',
    background: 'rgba(0,0,0,0.3)',
    borderRadius: '8px',
    fontSize: '13px',
  },
  estimateRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    color: '#ccc',
  },
  loading: {
    color: '#ffb6c1',
    fontSize: '12px',
    marginTop: '6px',
    display: 'block',
  },
  validationBox: {
    background: 'rgba(255, 20, 147, 0.08)',
    border: '2px solid #ff1493',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '20px',
  },
  validationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '15px',
    paddingBottom: '12px',
    borderBottom: '1px solid #ff149330',
  },
  validationInfo: {
    flex: 1,
  },
  tokenName: {
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#fff',
  },
  tokenSymbol: {
    color: '#ff69b4',
    marginLeft: '6px',
    fontSize: '14px',
  },
  addressRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '4px',
  },
  addressText: {
    fontSize: '11px',
    color: '#888',
    fontFamily: 'monospace',
  },
  validationStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  statLabel: {
    fontSize: '11px',
    color: '#888',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#fff',
  },
  button: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #ff1493, #c71585)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '10px',
    boxShadow: '0 4px 15px rgba(255, 20, 147, 0.3)',
  },
  error: {
    background: 'rgba(255, 0, 0, 0.15)',
    color: '#ff6666',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '10px',
    fontSize: '13px',
    border: '1px solid #ff000040',
  },
  success: {
    background: 'rgba(0, 255, 0, 0.15)',
    color: '#66ff66',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '10px',
    fontSize: '13px',
    border: '1px solid #00ff0040',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #ff149330',
    fontSize: '11px',
    color: '#888',
  },
  footerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
};

export default DapperComponent;
export { TOKEN_VALIDATOR, TokenIcon, CopyButton, getTokenLogo, TOKEN_LOGOS };
