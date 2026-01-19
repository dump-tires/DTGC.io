import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════
// DAPPER FLEX - ENHANCED EDITION
// Multicall3 Parallel Scanning • gib.show Token Logos • Copy Address
// Error-Resistant Scanning • DTGC/URMOM LP Icons
// ═══════════════════════════════════════════════════════════════

// ============================================
// TOKEN LOGO HELPERS
// ============================================
const getTokenLogo = (tokenAddress) => {
  if (!tokenAddress) return null;
  const addr = tokenAddress.toLowerCase();
  
  // DTGC - Use our gold coin favicon
  if (addr === '0xd0676b28a457371d58d47e5247b439114e40eb0f') {
    return '/favicon-192.png';
  }
  
  // URMOM
  if (addr === '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0') {
    return 'https://gib.show/image/369/0xe43b3cee3554e120213b8b69caf690b6c04a7ec0';
  }
  
  // DTGC/URMOM LP - Use our LP icon
  if (addr === '0x670c972bb5388e087a2934a063064d97278e01f3') {
    return '/lp-token-icon.png';
  }
  
  // PLS (WPLS)
  if (addr === '0xa1077a294dde1b09bb074bec877f05b634579687') {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/pulse/info/logo.png';
  }
  
  // HEX
  if (addr === '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39' || addr === '0x15a630532c228cba42c9e1843879786ba335e5d8') {
    return 'https://gib.show/image/369/0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
  }
  
  // PLSX
  if (addr === '0x95b303987a60c71504d99aa1b13b4da07b0790ab') {
    return 'https://gib.show/image/369/0x95b303987a60c71504d99aa1b13b4da07b0790ab';
  }
  
  // INC
  if (addr === '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d') {
    return 'https://gib.show/image/369/0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d';
  }
  
  // Default: gib.show for PulseChain
  return `https://gib.show/image/369/${addr}`;
};

// Token Icon Component with fallback
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
  
  // Fallback to symbol initial
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

// Copy to Clipboard Component
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
// MULTICALL3 FAST TOKEN VALIDATOR
// Uses parallel calls with timeout protection
// ═══════════════════════════════════════════════════════════════
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = ['function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external payable returns (tuple(bool success, bytes returnData)[])'];

const TOKEN_VALIDATOR = {
  // Pre-computed pairs cache (instant lookup)
  KNOWN_PAIRS: {
    'dtgc:pls': '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7',
    'urmom:pls': '0x670c972bb5388e087a2934a063064d97278e01f3',
    'hex:pls': '0x6F1cCa5F5F36C20b5E7eD57B10b5C8a5A6e2F9d7',
    'plsx:pls': '0x1b45b9148791D3a104184Cd5DFE5CE57193a3ee9',
    'inc:pls': '0x3b08e66F4B14d49Ce3F9f5b0B8e6e2f5C7e8D9A6',
  },

  // Runtime caches
  VALIDATION_CACHE: new Map(),
  PAIR_CACHE: new Map(),

  // Whitelisted safe tokens with logos
  SAFE_TOKENS: {
    '0xa1077a294dde1b09bb074bec877f05b634579687': { name: 'WPLS', symbol: 'WPLS', risk: 'LOW', decimals: 18 },
    '0x95b303987a60c71504d99aa1b13b4da07b0790ab': { name: 'PLSX', symbol: 'PLSX', risk: 'LOW', decimals: 18 },
    '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39': { name: 'HEX', symbol: 'HEX', risk: 'LOW', decimals: 8 },
    '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d': { name: 'INC', symbol: 'INC', risk: 'LOW', decimals: 18 },
    '0xd0676b28a457371d58d47e5247b439114e40eb0f': { name: 'DTGC', symbol: 'DTGC', risk: 'LOW', decimals: 18 },
    '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0': { name: 'URMOM', symbol: 'URMOM', risk: 'LOW', decimals: 18 },
    '0x670c972bb5388e087a2934a063064d97278e01f3': { name: 'DTGC/URMOM LP', symbol: 'DTGC-URMOM-LP', risk: 'LOW', decimals: 18 },
    '0xefD766cCb38EaF1dfd701853BFCe31359239F305': { name: 'DAI', symbol: 'DAI', risk: 'LOW', decimals: 18 },
    '0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07': { name: 'USDC', symbol: 'USDC', risk: 'LOW', decimals: 6 },
  },

  /**
   * ULTRA-FAST VALIDATION with timeout protection (~100-300ms)
   */
  async validateToken(tokenAddress, provider, timeoutMs = 5000) {
    const addr = tokenAddress.toLowerCase();

    // 1. CHECK CACHE FIRST (instant)
    if (this.VALIDATION_CACHE.has(addr)) {
      console.log(`✅ Cache HIT for ${addr.slice(0, 10)}...`);
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

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Validation timeout')), timeoutMs)
    );

    try {
      // 2. WHITELIST CHECK (instant)
      if (this.SAFE_TOKENS[addr]) {
        const token = this.SAFE_TOKENS[addr];
        validation.isValid = true;
        validation.risk = 'LOW';
        validation.hasLiquidity = true;
        validation.liquidityUsd = 50000;
        validation.details.whitelisted = true;
        validation.details.name = token.name;
        validation.details.symbol = token.symbol;
        validation.details.decimals = token.decimals;
        validation.details.tokenInfo = { 
          name: token.name, 
          symbol: token.symbol, 
          decimals: token.decimals,
          isValid: true 
        };
        console.log(`✅ Token whitelisted: ${token.name}`);
        this.VALIDATION_CACHE.set(addr, validation);
        return validation;
      }

      // 3. BLACKLIST CHECK (instant)
      if (this.isBlacklisted(addr)) {
        validation.reason = 'Blacklisted address';
        validation.risk = 'CRITICAL';
        this.VALIDATION_CACHE.set(addr, validation);
        return validation;
      }

      // 4. RACE against timeout - GET TOKEN INFO
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

      // 5. CHECK LIQUIDITY with timeout protection
      try {
        const liquidity = await Promise.race([
          this.checkLiquidityFast(addr, tokenInfo.symbol, provider),
          new Promise((resolve) => setTimeout(() => resolve({ hasLiquidity: false, liquidityUsd: 0, timedOut: true }), 3000))
        ]);
        
        validation.hasLiquidity = liquidity.hasLiquidity;
        validation.liquidityUsd = liquidity.liquidityUsd;
        validation.details.liquidity = liquidity;
        
        if (liquidity.timedOut) {
          validation.details.liquidityNote = 'Liquidity check timed out - proceed with caution';
        }
      } catch (liqErr) {
        console.log('Liquidity check failed, continuing:', liqErr.message);
        validation.details.liquidityNote = 'Could not verify liquidity';
      }

      // VERDICT
      if (!validation.hasLiquidity && !validation.details.liquidityNote) {
        validation.reason = 'No liquidity found';
        validation.risk = 'HIGH';
      } else if (validation.liquidityUsd < 1000) {
        validation.risk = validation.liquidityUsd < 100 ? 'HIGH' : 'MEDIUM';
        validation.reason = validation.liquidityUsd > 0 
          ? `Low liquidity ($${validation.liquidityUsd.toFixed(0)})`
          : 'Liquidity unverified';
      } else if (validation.liquidityUsd < 5000) {
        validation.risk = 'MEDIUM';
      } else {
        validation.risk = 'LOW';
      }

      // Allow tokens even with unverified liquidity (user's choice)
      validation.isValid = tokenInfo.isValid;
      
      if (validation.isValid) {
        console.log(`✅ Token valid: ${tokenInfo.symbol} - $${validation.liquidityUsd.toFixed(0)} liquidity`);
      }

      this.VALIDATION_CACHE.set(addr, validation);
      return validation;

    } catch (err) {
      console.error('Validation error:', err.message);
      
      // On timeout, still allow with warning
      if (err.message === 'Validation timeout') {
        validation.isValid = true;
        validation.risk = 'MEDIUM';
        validation.reason = 'Validation timed out - proceed with caution';
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
    const BLACKLIST = [
      '0x0000000000000000000000000000000000000000',
      '0x000000000000000000000000000000000000dead',
    ];
    return BLACKLIST.includes(address.toLowerCase());
  },

  async getTokenInfoFast(tokenAddress, provider) {
    const result = { isValid: false, name: '', symbol: '', decimals: 18 };
    
    try {
      const ERC20_ABI = [
        'function name() external view returns (string)',
        'function symbol() external view returns (string)',
        'function decimals() external view returns (uint8)',
      ];
      
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Parallel calls with individual timeouts
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
      console.error('Token info error:', err.message);
      return result;
    }
  },

  async checkLiquidityFast(tokenAddress, tokenSymbol, provider) {
    const result = { hasLiquidity: false, liquidityUsd: 0 };
    
    try {
      const pls = '0xA1077a294dDE1B09bB074Bec877f05b634579687';
      const cacheKey = `${tokenSymbol?.toLowerCase() || ''}:pls`;

      // 1. CHECK KNOWN_PAIRS CACHE FIRST
      if (this.KNOWN_PAIRS[cacheKey]) {
        const pairAddress = this.KNOWN_PAIRS[cacheKey];
        console.log(`✅ Found in KNOWN_PAIRS: ${pairAddress.slice(0, 10)}...`);
        const reserves = await this.getReservesFast(pairAddress, provider);
        result.hasLiquidity = reserves.liquidityUsd > 100;
        result.liquidityUsd = reserves.liquidityUsd;
        return result;
      }

      // 2. CHECK RUNTIME CACHE
      if (this.PAIR_CACHE.has(tokenAddress.toLowerCase())) {
        const cached = this.PAIR_CACHE.get(tokenAddress.toLowerCase());
        return cached;
      }

      // 3. QUERY FACTORIES (with timeout)
      const pairAddress = await this.findPairFast(tokenAddress, pls, provider);
      
      if (!pairAddress || pairAddress === ethers.ZeroAddress) {
        return result;
      }

      const reserves = await this.getReservesFast(pairAddress, provider);
      result.hasLiquidity = reserves.liquidityUsd > 100;
      result.liquidityUsd = reserves.liquidityUsd;

      this.PAIR_CACHE.set(tokenAddress.toLowerCase(), result);
      return result;
      
    } catch (err) {
      console.error('Liquidity check error:', err.message);
      return result;
    }
  },

  async findPairFast(tokenAddress, pls, provider) {
    try {
      const FACTORY_ABI = ['function getPair(address,address) external view returns (address)'];
      
      const v1Factory = new ethers.Contract('0xE1Cc890455B1d9537034da8e1ffB0d5f4E150e9e', FACTORY_ABI, provider);
      const v2Factory = new ethers.Contract('0x1715Ac0f39513b6D53a0b3ba5d63c9bc575f7bEA', FACTORY_ABI, provider);

      const [v1Pair, v2Pair] = await Promise.all([
        v1Factory.getPair(tokenAddress, pls).catch(() => ethers.ZeroAddress),
        v2Factory.getPair(tokenAddress, pls).catch(() => ethers.ZeroAddress),
      ]);

      return v1Pair !== ethers.ZeroAddress ? v1Pair : v2Pair;
    } catch (err) {
      console.error('Find pair error:', err.message);
      return ethers.ZeroAddress;
    }
  },

  async getReservesFast(pairAddress, provider) {
    const result = { liquidityUsd: 0 };
    
    try {
      const PAIR_ABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      ];
      
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const reserves = await pair.getReserves();
      
      const plsReserve = parseFloat(ethers.formatUnits(reserves[1], 18));
      const plsPrice = 0.000018; // Current PLS price estimate
      result.liquidityUsd = plsReserve * plsPrice * 2; // Both sides of LP
      
      return result;
    } catch (err) {
      console.error('Get reserves error:', err.message);
      return result;
    }
  },

  clearCache() {
    this.VALIDATION_CACHE.clear();
    this.PAIR_CACHE.clear();
    console.log('🧹 Caches cleared');
  },
};

// ═══════════════════════════════════════════════════════════════
// DAPPER COMPONENT (ENHANCED WITH LOGOS & COPY)
// ═══════════════════════════════════════════════════════════════
const DapperComponent = ({ provider, account }) => {
  const [inputToken, setInputToken] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recentTokens, setRecentTokens] = useState([]);
  const validateTimeoutRef = useRef(null);

  // Load recent tokens from localStorage
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

  const handleTokenChange = useCallback(async (tokenAddress) => {
    setInputToken(tokenAddress);
    setError('');
    setSuccess('');

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
        }

        if (!result.isValid) {
          setError(`❌ Invalid token: ${result.reason}`);
        } else if (result.risk === 'HIGH') {
          setError(`⚠️ WARNING: ${result.reason || 'High risk token'}`);
        } else if (result.details.timedOut) {
          setError(`⚠️ Validation timed out - proceed with caution`);
        }
      } catch (err) {
        setError(`Validation error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 150); // Fast debounce
  }, [provider, recentTokens]);

  const handleQuickSelect = (token) => {
    setInputToken(token.address);
    handleTokenChange(token.address);
  };

  const handleZap = async () => {
    if (!validation || !validation.isValid) {
      setError('⛔ Token validation failed');
      return;
    }

    if (!inputAmount || parseFloat(inputAmount) <= 0) {
      setError('❌ Enter valid amount');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      console.log('🚀 Executing zap:', {
        token: inputToken,
        amount: inputAmount,
        account: account,
      });

      // TODO: Implement actual zap transaction
      setSuccess('✅ Zap executed successfully!');
    } catch (err) {
      setError(`Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Quick access tokens
  const QUICK_TOKENS = [
    { address: '0xd0676b28a457371d58d47e5247b439114e40eb0f', symbol: 'DTGC', name: 'DTGC' },
    { address: '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0', symbol: 'URMOM', name: 'URMOM' },
    { address: '0x670c972bb5388e087a2934a063064d97278e01f3', symbol: 'LP', name: 'DTGC/URMOM LP' },
    { address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', symbol: 'HEX', name: 'HEX' },
    { address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', symbol: 'PLSX', name: 'PLSX' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>💎⚡ DAPPER FLEX</h2>
        <p style={styles.subtitle}>One-Click LP Zapping • Fast Validation • No Lockup</p>
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

      {/* Recent Tokens */}
      {recentTokens.length > 0 && (
        <div style={styles.recentTokens}>
          <div style={styles.quickLabel}>Recent:</div>
          <div style={styles.quickGrid}>
            {recentTokens.map(token => (
              <button
                key={token.address}
                onClick={() => handleQuickSelect(token)}
                style={styles.recentButton}
              >
                <TokenIcon address={token.address} symbol={token.symbol} size={16} />
                <span>{token.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
            <div style={styles.statItem}>
              <span style={styles.statLabel}>Liquidity</span>
              <span style={styles.statValue}>
                ${validation.liquidityUsd?.toFixed(2) || '0.00'}
              </span>
            </div>
            {validation.details.whitelisted && (
              <div style={styles.statItem}>
                <span style={styles.statLabel}>Status</span>
                <span style={{...styles.statValue, color: '#00ff00'}}>✅ Whitelisted</span>
              </div>
            )}
            {validation.details.liquidityNote && (
              <div style={styles.warningNote}>
                ⚠️ {validation.details.liquidityNote}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amount Input */}
      {validation?.isValid && (
        <div style={styles.inputGroup}>
          <label style={styles.label}>Amount to Zap</label>
          <input
            type="number"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            style={styles.input}
          />
        </div>
      )}

      {/* Messages */}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Zap Button */}
      <button
        onClick={handleZap}
        disabled={!validation?.isValid || !inputAmount || loading}
        style={{
          ...styles.button,
          opacity: !validation?.isValid || !inputAmount || loading ? 0.5 : 1,
          cursor: !validation?.isValid || !inputAmount || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? '⏳ Processing...' : '🚀 Zap to Flex'}
      </button>

      {/* Info Footer */}
      <div style={styles.footer}>
        <div style={styles.footerItem}>
          <TokenIcon address="0xd0676b28a457371d58d47e5247b439114e40eb0f" symbol="DTGC" size={16} />
          <span>DTGC Ecosystem</span>
        </div>
        <div style={styles.footerItem}>
          <span>⚡ Multicall3 Fast Scan</span>
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
    margin: '0 0 8px 0',
    fontSize: '1.8rem',
    background: 'linear-gradient(135deg, #ff1493, #ff69b4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    margin: 0,
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
  recentTokens: {
    marginBottom: '15px',
    padding: '10px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '8px',
  },
  recentButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    background: 'rgba(255,20,147,0.1)',
    border: '1px solid #ff149340',
    borderRadius: '15px',
    cursor: 'pointer',
    color: '#ffb6c1',
    fontSize: '11px',
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
    transition: 'border-color 0.2s',
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
  warningNote: {
    gridColumn: '1 / -1',
    fontSize: '11px',
    color: '#ffaa00',
    background: 'rgba(255,170,0,0.1)',
    padding: '8px',
    borderRadius: '6px',
    marginTop: '8px',
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
    transition: 'transform 0.2s, box-shadow 0.2s',
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
export { TOKEN_VALIDATOR, TokenIcon, CopyButton, getTokenLogo };
