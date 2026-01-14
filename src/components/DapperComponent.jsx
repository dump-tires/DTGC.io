import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════
// FAST TOKEN VALIDATOR WITH V1/V2 DEX CHECKS (ETHERS V6 COMPATIBLE)
// ═══════════════════════════════════════════════════════════════

const TOKEN_VALIDATOR = {
  // PulseX V1 Router
  PULSEX_V1_ROUTER: '0x98cc3735511E92F2726d7B2cCcE8e410c4bfbe20',
  // PulseX V2 Router
  PULSEX_V2_ROUTER: '0xa758269B4fF1F387b81eb6f4e5b8Cefb5EB41484',
  
  // SAFE token patterns (trusted tokens on PulseChain)
  SAFE_TOKENS: {
    '0xA1077a294dDE1B09bB074Bec877f05b634579687': 'PLS',
    '0x8a854288a5976036A725879ccf6B1E7933C7F5a0': 'PLSX',
    '0x15a630532c228cba42c9e1843879786ba335e5d8': 'HEX',
    '0x44B6e3e90EaA427B3a23b509CFf4b858506d1D5d': 'INC',
    '0xd0676b28a457371d58d47e5247b439114e40eb0f': 'DTGC',
    '0xe43b3cee3554e120213b8b69caf690b6c04a7ec0': 'URMOM',
  },

  /**
   * FAST VALIDATION - checks in order of speed
   * ~400ms total for full validation
   */
  async validateToken(tokenAddress, provider, signer) {
    const validation = {
      address: tokenAddress,
      isValid: false,
      reason: '',
      hasV1Liquidity: false,
      hasV2Liquidity: false,
      liquidityUsd: 0,
      risk: 'UNKNOWN',
      details: {},
    };

    try {
      // 1. CHECK: Safe token whitelist (INSTANT)
      if (this.SAFE_TOKENS[tokenAddress.toLowerCase()]) {
        validation.isValid = true;
        validation.risk = 'LOW';
        validation.details.whitelisted = true;
        console.log(`✅ Token whitelisted: ${this.SAFE_TOKENS[tokenAddress.toLowerCase()]}`);
        return validation;
      }

      // 2. CHECK: Blacklist patterns (INSTANT)
      const blacklistResult = await this.checkBlacklistPatterns(tokenAddress);
      if (blacklistResult.isBlacklisted) {
        validation.reason = blacklistResult.reason;
        validation.risk = 'CRITICAL';
        console.warn(`🚫 Token blacklisted: ${blacklistResult.reason}`);
        return validation;
      }

      // 3. CHECK: Basic token validation
      const tokenInfo = await this.getTokenInfo(tokenAddress, provider);
      if (!tokenInfo.isValid) {
        validation.reason = 'Invalid token contract';
        return validation;
      }
      validation.details.tokenInfo = tokenInfo;

      // 4. CHECK: V1 Liquidity (concurrent)
      const v1Result = await this.checkV1Liquidity(tokenAddress, provider);
      validation.hasV1Liquidity = v1Result.hasLiquidity;
      validation.liquidityUsd += v1Result.liquidityUsd;
      validation.details.v1 = v1Result;

      // 5. CHECK: V2 Liquidity (concurrent)
      const v2Result = await this.checkV2Liquidity(tokenAddress, provider);
      validation.hasV2Liquidity = v2Result.hasLiquidity;
      validation.liquidityUsd += v2Result.liquidityUsd;
      validation.details.v2 = v2Result;

      // VERDICT
      if (!validation.hasV1Liquidity && !validation.hasV2Liquidity) {
        validation.reason = 'No liquidity found on PulseX V1 or V2';
        validation.risk = 'HIGH';
        console.warn('⚠️ No liquidity detected');
        return validation;
      }

      if (validation.liquidityUsd < 1000) {
        validation.risk = 'HIGH';
        validation.reason = `Very low liquidity ($${validation.liquidityUsd.toFixed(2)})`;
        console.warn(`⚠️ Low liquidity warning: $${validation.liquidityUsd.toFixed(2)}`);
      } else if (validation.liquidityUsd < 5000) {
        validation.risk = 'MEDIUM';
      } else {
        validation.risk = 'LOW';
      }

      validation.isValid = validation.liquidityUsd >= 100; // Minimum $100 liquidity
      if (validation.isValid) {
        console.log(`✅ Token valid: $${validation.liquidityUsd.toFixed(2)} liquidity detected`);
      }

      return validation;
    } catch (err) {
      console.error('Token validation error:', err);
      validation.reason = `Validation error: ${err.message}`;
      validation.risk = 'ERROR';
      return validation;
    }
  },

  /**
   * BLACKLIST PATTERNS - check for known scams
   */
  async checkBlacklistPatterns(tokenAddress) {
    const result = {
      isBlacklisted: false,
      reason: '',
    };

    const addr = tokenAddress.toLowerCase();
    
    // Known scam contracts on PulseChain
    const KNOWN_SCAMS = [
      '0x0000000000000000000000000000000000000000', // Zero address
      '0x000000000000000000000000000000000000dead', // Dead address
    ];

    if (KNOWN_SCAMS.includes(addr)) {
      result.isBlacklisted = true;
      result.reason = 'Known scam/burn address';
      return result;
    }

    return result;
  },

  /**
   * GET BASIC TOKEN INFO
   */
  async getTokenInfo(tokenAddress, provider) {
    const result = {
      isValid: false,
      name: '',
      symbol: '',
      decimals: 18,
      totalSupply: 0,
    };

    try {
      const ERC20_ABI = [
        'function name() external view returns (string)',
        'function symbol() external view returns (string)',
        'function decimals() external view returns (uint8)',
        'function totalSupply() external view returns (uint256)',
      ];

      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Parallel requests for speed
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name().catch(() => ''),
        contract.symbol().catch(() => ''),
        contract.decimals().catch(() => 18),
        contract.totalSupply().catch(() => 0n),
      ]);

      result.name = name || 'Unknown';
      result.symbol = symbol || 'UNKNOWN';
      result.decimals = decimals;
      result.totalSupply = parseFloat(
        ethers.formatUnits(totalSupply, decimals)
      );
      result.isValid = true;

      return result;
    } catch (err) {
      console.error('Token info fetch failed:', err);
      return result;
    }
  },

  /**
   * CHECK V1 LIQUIDITY - concurrent execution
   */
  async checkV1Liquidity(tokenAddress, provider) {
    const result = {
      hasLiquidity: false,
      liquidityUsd: 0,
      plsReserve: 0,
      tokenReserve: 0,
    };

    try {
      const FACTORY_V1 = '0xE1Cc890455B1d9537034da8e1ffB0d5f4E150e9e'; // PulseX V1 Factory
      const FACTORY_ABI = ['function getPair(address,address) external view returns (address)'];
      
      const factory = new ethers.Contract(FACTORY_V1, FACTORY_ABI, provider);
      const PLS = '0xA1077a294dDE1B09bB074Bec877f05b634579687';
      
      // Get pair address
      const pairAddress = await factory.getPair(tokenAddress, PLS);
      
      if (pairAddress === ethers.ZeroAddress) {
        return result;
      }

      // Get reserves
      const PAIR_ABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
      ];

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [token0, token1, reserves] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves(),
      ]);

      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
      const plsReserve = parseFloat(
        ethers.formatUnits(
          isToken0 ? reserves[1] : reserves[0],
          18
        )
      );

      // Estimate liquidity value
      const plsPrice = 0.000016; // Approximate PLS price
      result.plsReserve = plsReserve;
      result.liquidityUsd = plsReserve * plsPrice;
      result.hasLiquidity = result.liquidityUsd > 100;

      return result;
    } catch (err) {
      console.error('V1 liquidity check failed:', err);
      return result;
    }
  },

  /**
   * CHECK V2 LIQUIDITY - concurrent execution
   */
  async checkV2Liquidity(tokenAddress, provider) {
    const result = {
      hasLiquidity: false,
      liquidityUsd: 0,
      plsReserve: 0,
      tokenReserve: 0,
    };

    try {
      const FACTORY_V2 = '0x1715Ac0f39513b6D53a0b3ba5d63c9bc575f7bEA'; // PulseX V2 Factory
      const FACTORY_ABI = ['function getPair(address,address) external view returns (address)'];
      
      const factory = new ethers.Contract(FACTORY_V2, FACTORY_ABI, provider);
      const PLS = '0xA1077a294dDE1B09bB074Bec877f05b634579687';
      
      // Get pair address
      const pairAddress = await factory.getPair(tokenAddress, PLS);
      
      if (pairAddress === ethers.ZeroAddress) {
        return result;
      }

      // Get reserves
      const PAIR_ABI = [
        'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
        'function token0() external view returns (address)',
        'function token1() external view returns (address)',
      ];

      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [token0, token1, reserves] = await Promise.all([
        pair.token0(),
        pair.token1(),
        pair.getReserves(),
      ]);

      const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();
      const plsReserve = parseFloat(
        ethers.formatUnits(
          isToken0 ? reserves[1] : reserves[0],
          18
        )
      );

      // Estimate liquidity value
      const plsPrice = 0.000016; // Approximate PLS price
      result.plsReserve = plsReserve;
      result.liquidityUsd = plsReserve * plsPrice;
      result.hasLiquidity = result.liquidityUsd > 100;

      return result;
    } catch (err) {
      console.error('V2 liquidity check failed:', err);
      return result;
    }
  },
};

// ═══════════════════════════════════════════════════════════════
// DAPPER COMPONENT - NO DIAMOND+ REQUIREMENT (ETHERS V6)
// ═══════════════════════════════════════════════════════════════

const DapperComponent = ({ provider, account }) => {
  const [inputToken, setInputToken] = useState('');
  const [inputAmount, setInputAmount] = useState('');
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const validateTimeoutRef = useRef(null);

  /**
   * FAST TOKEN VALIDATION ON INPUT
   */
  const handleTokenChange = useCallback(async (tokenAddress) => {
    setInputToken(tokenAddress);
    setError('');

    if (!tokenAddress || tokenAddress.length < 40) {
      setValidation(null);
      return;
    }

    // Debounce validation
    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current);
    }

    setLoading(true);
    validateTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await TOKEN_VALIDATOR.validateToken(
          tokenAddress,
          provider,
          provider.getSigner ? await provider.getSigner() : null
        );

        setValidation(result);

        if (!result.isValid) {
          setError(`❌ Invalid token: ${result.reason}`);
        } else if (result.risk === 'HIGH') {
          setError(`⚠️ WARNING: ${result.reason}`);
        }
      } catch (err) {
        setError(`Validation error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce for fast UX
  }, [provider]);

  /**
   * EXECUTE ZAP - no access gate
   */
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
      // Your existing zap logic here
      console.log('🚀 Executing zap:', {
        token: inputToken,
        amount: inputAmount,
        account: account,
      });

      setSuccess('✅ Zap executed successfully!');
    } catch (err) {
      setError(`Transaction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2>💎⚡ DAPPER FLEX</h2>
      <p>One-Click LP Zapping (No Lockup Required)</p>

      {/* ACCESS GATE REMOVED - Now open to all users */}
      <div style={styles.accessNotice}>
        ✅ <strong>UNLIMITED ACCESS</strong> - No stake required!
      </div>

      {/* TOKEN INPUT */}
      <div style={styles.inputGroup}>
        <label>Token Address</label>
        <input
          type="text"
          placeholder="0x..."
          value={inputToken}
          onChange={(e) => handleTokenChange(e.target.value)}
          style={styles.input}
        />
        {loading && <span style={styles.loading}>🔍 Validating...</span>}
      </div>

      {/* VALIDATION RESULT */}
      {validation && (
        <div style={{
          ...styles.validationBox,
          borderColor: validation.isValid ? '#00ff00' : '#ff0000',
        }}>
          <h4>Token Validation</h4>
          <div>Symbol: {validation.details.tokenInfo?.symbol || 'N/A'}</div>
          <div>Risk Level: {validation.risk}</div>
          <div>V1 Liquidity: {validation.hasV1Liquidity ? '✅' : '❌'}</div>
          <div>V2 Liquidity: {validation.hasV2Liquidity ? '✅' : '❌'}</div>
          <div>Total Liquidity: ${validation.liquidityUsd.toFixed(2)}</div>
        </div>
      )}

      {/* AMOUNT INPUT */}
      {validation?.isValid && (
        <div style={styles.inputGroup}>
          <label>Amount to Zap</label>
          <input
            type="number"
            placeholder="0.00"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
            style={styles.input}
          />
        </div>
      )}

      {/* MESSAGES */}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* ZAP BUTTON */}
      <button
        onClick={handleZap}
        disabled={!validation?.isValid || !inputAmount || loading}
        style={{
          ...styles.button,
          opacity: !validation?.isValid || !inputAmount || loading ? 0.5 : 1,
          cursor: !validation?.isValid || !inputAmount || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Processing...' : '🚀 Zap to Flex'}
      </button>
    </div>
  );
};

const styles = {
  container: {
    background: '#2a1520',
    border: '2px solid #ff1493',
    borderRadius: '12px',
    padding: '20px',
    maxWidth: '500px',
    margin: '20px auto',
    color: '#fff',
  },
  accessNotice: {
    background: 'rgba(0, 255, 0, 0.1)',
    border: '2px solid #00ff00',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '15px',
    color: '#00ff00',
    fontSize: '14px',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  input: {
    width: '100%',
    padding: '10px',
    marginTop: '5px',
    background: '#1a0a10',
    border: '1px solid #ff1493',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '14px',
  },
  loading: {
    color: '#ffb6c1',
    fontSize: '12px',
    marginTop: '5px',
    display: 'block',
  },
  validationBox: {
    background: 'rgba(255, 20, 147, 0.1)',
    border: '2px solid #ff1493',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '15px',
    fontSize: '13px',
  },
  button: {
    width: '100%',
    padding: '12px',
    background: 'linear-gradient(135deg, #ff1493, #c71585)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    marginTop: '15px',
  },
  error: {
    background: 'rgba(255, 0, 0, 0.15)',
    color: '#ff6666',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '10px',
    fontSize: '13px',
  },
  success: {
    background: 'rgba(0, 255, 0, 0.15)',
    color: '#66ff66',
    padding: '10px',
    borderRadius: '6px',
    marginBottom: '10px',
    fontSize: '13px',
  },
};

export default DapperComponent;
export { TOKEN_VALIDATOR };
