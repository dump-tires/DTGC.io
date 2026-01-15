import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// 💗⭐ DAPPER FLEX V6 - TRUE CROSS-CHAIN ZAPPER ⭐💗
// Contract: 0x0b11799Ef41A01fB9399dCbA161076d7aed20b3e
// 
// Features:
// ✅ ANKR Advanced API - Scans ALL tokens across ALL chains (FREE!)
// ✅ Automatic USD values & liquidity detection
// ✅ Smart routing: Swap → USDC → Bridge via Liberty Swap
// ✅ PulseChain token zapping
// ✅ 10% APR Flex Staking (No Lock)
// ✅ Referral system (0.3% rewards)
// ═══════════════════════════════════════════════════════════════════════════

const DAPPER_FLEX_V6_ADDRESS = '0x0b11799Ef41A01fB9399dCbA161076d7aed20b3e';

// Ankr Advanced API (FREE - scans ALL tokens!)
const ANKR_RPC = 'https://rpc.ankr.com/multichain';

// Chain configurations
const CHAINS = {
  eth: {
    id: '0x1',
    ankrId: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    icon: '🔵',
    color: '#627EEA',
    dex: 'https://app.uniswap.org/#/swap',
    dexName: 'Uniswap',
    explorer: 'https://etherscan.io',
  },
  bsc: {
    id: '0x38',
    ankrId: 'bsc',
    name: 'BNB Chain',
    symbol: 'BNB',
    icon: '🟡',
    color: '#F3BA2F',
    dex: 'https://pancakeswap.finance/swap',
    dexName: 'PancakeSwap',
    explorer: 'https://bscscan.com',
  },
  polygon: {
    id: '0x89',
    ankrId: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    icon: '🟣',
    color: '#8247E5',
    dex: 'https://quickswap.exchange/#/swap',
    dexName: 'QuickSwap',
    explorer: 'https://polygonscan.com',
  },
  arbitrum: {
    id: '0xa4b1',
    ankrId: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    icon: '🔶',
    color: '#28A0F0',
    dex: 'https://app.camelot.exchange',
    dexName: 'Camelot',
    explorer: 'https://arbiscan.io',
  },
  base: {
    id: '0x2105',
    ankrId: 'base',
    name: 'Base',
    symbol: 'ETH',
    icon: '🔷',
    color: '#0052FF',
    dex: 'https://aerodrome.finance/swap',
    dexName: 'Aerodrome',
    explorer: 'https://basescan.org',
  },
  optimism: {
    id: '0xa',
    ankrId: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    icon: '🔴',
    color: '#FF0420',
    dex: 'https://app.velodrome.finance/swap',
    dexName: 'Velodrome',
    explorer: 'https://optimistic.etherscan.io',
  },
  avalanche: {
    id: '0xa86a',
    ankrId: 'avalanche',
    name: 'Avalanche',
    symbol: 'AVAX',
    icon: '🔺',
    color: '#E84142',
    dex: 'https://traderjoexyz.com/avalanche/trade',
    dexName: 'Trader Joe',
    explorer: 'https://snowtrace.io',
  },
  fantom: {
    id: '0xfa',
    ankrId: 'fantom',
    name: 'Fantom',
    symbol: 'FTM',
    icon: '👻',
    color: '#1969FF',
    dex: 'https://spooky.fi/#/swap',
    dexName: 'SpookySwap',
    explorer: 'https://ftmscan.com',
  },
};

// Stablecoin addresses (for smart routing)
const STABLECOINS = [
  'usdc', 'usdt', 'dai', 'busd', 'frax', 'tusd', 'usdp', 'gusd', 'lusd', 'susd',
];

// Liberty Swap
const LIBERTY_SWAP_URL = 'https://libertyswap.io';

// Minimum USD value to display (filter dust)
const MIN_USD_VALUE = 1;

// ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address, uint256) returns (bool)',
  'function allowance(address, address) view returns (uint256)',
];

const DAPPER_FLEX_V6_ABI = [
  'function zapPLS(uint256 stakePercent, address referrer) external payable',
  'function zapToken(address token, uint256 amount, uint256 stakePercent, address referrer) external',
  'function stakeLP(uint256 amount) external',
  'function unstake(uint256 stakeId) external',
  'function claimRewards(uint256 stakeId) external',
  'function compound(uint256 stakeId) external',
  'function getReferralStats(address referrer) external view returns (uint256 totalReferred, uint256 totalEarned)',
  'function referrerOf(address user) external view returns (address)',
  'function pendingRewards(address user, uint256 stakeId) external view returns (uint256)',
  'function getUserStakes(address user) external view returns (tuple(uint256 lpAmount, uint256 startTime, uint256 lastClaimTime, address referrer, bool active)[])',
  'function totalStakedByUser(address user) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
  'function getRewardsPoolBalance() external view returns (uint256)',
];

// Cross-Chain Star Icon
const CrossChainStar = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 105, 180, 0.8))' }}>
    <defs>
      <linearGradient id="pinkGoldGradV6" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF69B4" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#FF1493" />
      </linearGradient>
    </defs>
    <polygon points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" fill="url(#pinkGoldGradV6)" />
    <circle cx="50" cy="50" r="15" fill="none" stroke="#FFD700" strokeWidth="2" />
    <circle cx="50" cy="50" r="10" fill="none" stroke="#FF69B4" strokeWidth="2" strokeDasharray="4 2" />
    <circle cx="50" cy="50" r="4" fill="#FFD700" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const DapperFlexV6 = ({ provider, account }) => {
  // Tabs
  const [activeTab, setActiveTab] = useState('crosschain');
  
  // Cross-chain state
  const [allTokens, setAllTokens] = useState([]);
  const [tokensByChain, setTokensByChain] = useState({});
  const [scanningChains, setScanningChains] = useState(false);
  const [offChainTotal, setOffChainTotal] = useState(0);
  const [scanError, setScanError] = useState('');
  const [minValueFilter, setMinValueFilter] = useState(MIN_USD_VALUE);
  
  // PulseChain state
  const [zapMode, setZapMode] = useState('pls');
  const [zapAmount, setZapAmount] = useState('');
  const [stakePercent, setStakePercent] = useState(100);
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenValidation, setTokenValidation] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [validating, setValidating] = useState(false);
  
  // Contract state
  const [userStakes, setUserStakes] = useState([]);
  const [totalStaked, setTotalStaked] = useState('0');
  const [userTotalStaked, setUserTotalStaked] = useState('0');
  const [plsBalance, setPlsBalance] = useState('0');
  const [rewardsPool, setRewardsPool] = useState('0');
  
  // Referral state
  const [referrer, setReferrer] = useState(null);
  const [myReferrer, setMyReferrer] = useState(null);
  const [referralStats, setReferralStats] = useState({ count: 0, earnings: '0' });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const validateTimeoutRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // ANKR ADVANCED API - SCAN ALL TOKENS ACROSS ALL CHAINS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const scanAllChainsAnkr = useCallback(async () => {
    if (!account) return;
    
    setScanningChains(true);
    setScanError('');
    
    try {
      // Ankr's getAccountBalance returns ALL tokens with USD values!
      const response = await fetch(ANKR_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'ankr_getAccountBalance',
          params: {
            walletAddress: account,
            blockchain: ['eth', 'bsc', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanche', 'fantom'],
            onlyWhitelisted: false, // Get ALL tokens, not just whitelisted
          },
          id: 1,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error.message || 'Ankr API error');
      }

      const assets = data.result?.assets || [];
      
      // Filter by minimum USD value and organize by chain
      const filteredAssets = assets.filter(asset => 
        parseFloat(asset.balanceUsd || 0) >= minValueFilter
      );
      
      // Sort by USD value descending
      filteredAssets.sort((a, b) => parseFloat(b.balanceUsd || 0) - parseFloat(a.balanceUsd || 0));
      
      // Organize by chain
      const byChain = {};
      let total = 0;
      
      filteredAssets.forEach(asset => {
        const chainKey = asset.blockchain;
        if (!byChain[chainKey]) byChain[chainKey] = [];
        
        const usdValue = parseFloat(asset.balanceUsd || 0);
        total += usdValue;
        
        // Check if stablecoin
        const isStable = STABLECOINS.some(s => 
          asset.tokenSymbol?.toLowerCase().includes(s)
        );
        
        byChain[chainKey].push({
          symbol: asset.tokenSymbol || '???',
          name: asset.tokenName || 'Unknown',
          address: asset.contractAddress || 'native',
          balance: parseFloat(asset.balance || 0),
          balanceRaw: asset.balanceRawInteger,
          decimals: asset.tokenDecimals || 18,
          usdValue,
          price: parseFloat(asset.tokenPrice || 0),
          chain: chainKey,
          chainData: CHAINS[chainKey],
          isStable,
          isNative: !asset.contractAddress,
          thumbnail: asset.thumbnail,
        });
      });
      
      setAllTokens(filteredAssets);
      setTokensByChain(byChain);
      setOffChainTotal(total);
      
    } catch (err) {
      console.error('Ankr scan error:', err);
      setScanError(`Scan failed: ${err.message}. Try again.`);
    } finally {
      setScanningChains(false);
    }
  }, [account, minValueFilter]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PULSECHAIN DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════
  
  const fetchPulseData = useCallback(async () => {
    if (!provider || !account) return;
    
    try {
      const contract = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, provider);
      
      const [plsBal, totalStakedVal, userTotalVal, rewardsPoolVal] = await Promise.all([
        provider.getBalance(account),
        contract.totalStaked().catch(() => 0n),
        contract.totalStakedByUser(account).catch(() => 0n),
        contract.getRewardsPoolBalance().catch(() => 0n),
      ]);
      
      setPlsBalance(ethers.formatEther(plsBal));
      setTotalStaked(ethers.formatEther(totalStakedVal));
      setUserTotalStaked(ethers.formatEther(userTotalVal));
      setRewardsPool(ethers.formatEther(rewardsPoolVal));
      
      // Fetch stakes
      try {
        const stakes = await contract.getUserStakes(account);
        const formattedStakes = await Promise.all(stakes.map(async (stake, idx) => {
          let pending = '0';
          if (stake.active) {
            try { pending = await contract.pendingRewards(account, idx); } catch {}
          }
          return {
            id: idx,
            lpAmount: ethers.formatEther(stake.lpAmount),
            startTime: Number(stake.startTime),
            active: stake.active,
            pendingRewards: ethers.formatEther(pending),
          };
        }));
        setUserStakes(formattedStakes.filter(s => s.active));
      } catch {}
      
      // Referral info
      try {
        const myRef = await contract.referrerOf(account);
        if (myRef !== ethers.ZeroAddress) setMyReferrer(myRef);
        const [count, earnings] = await contract.getReferralStats(account);
        setReferralStats({ count: Number(count), earnings: ethers.formatEther(earnings) });
      } catch {}
      
    } catch (err) {
      console.error('Pulse data fetch error:', err);
    }
  }, [provider, account]);

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Check URL for referrer
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ethers.isAddress(ref)) {
      localStorage.setItem('dtgc_referrer', ref);
      setReferrer(ref);
    } else {
      const storedRef = localStorage.getItem('dtgc_referrer');
      if (storedRef && ethers.isAddress(storedRef)) setReferrer(storedRef);
    }
  }, []);

  // Initial scan
  useEffect(() => {
    if (account) {
      scanAllChainsAnkr();
      fetchPulseData();
    }
  }, [account, scanAllChainsAnkr, fetchPulseData]);

  // Auto-refresh pulse data
  useEffect(() => {
    const interval = setInterval(() => {
      if (account) fetchPulseData();
    }, 30000);
    return () => clearInterval(interval);
  }, [account, fetchPulseData]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const getSigner = async () => {
    if (!provider) return null;
    try {
      const bp = new ethers.BrowserProvider(window.ethereum);
      return await bp.getSigner();
    } catch { return null; }
  };

  // Open DEX to swap
  const openSwap = (chainKey, token) => {
    const chain = CHAINS[chainKey];
    if (chain?.dex) {
      window.open(chain.dex, '_blank');
    }
  };

  // Open Liberty Swap
  const openBridge = () => {
    window.open(LIBERTY_SWAP_URL, '_blank');
  };

  // Zap PLS
  const handleZapPLS = async () => {
    if (!zapAmount || parseFloat(zapAmount) <= 0) { setError('❌ Enter valid amount'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      const signer = await getSigner();
      if (!signer) { setError('❌ Connect wallet'); setLoading(false); return; }
      const contract = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer);
      const tx = await contract.zapPLS(stakePercent, referrer || ethers.ZeroAddress, { value: ethers.parseEther(zapAmount) });
      setSuccess('⏳ Waiting for confirmation...');
      await tx.wait();
      setSuccess(`🎉 Zapped ${zapAmount} PLS!`);
      setZapAmount('');
      fetchPulseData();
    } catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  // Validate PulseChain token
  const handleTokenChange = useCallback(async (address) => {
    setTokenAddress(address);
    setTokenValidation(null);
    setTokenBalance('0');
    setError('');

    if (!address || address.length < 42 || !ethers.isAddress(address)) return;
    if (validateTimeoutRef.current) clearTimeout(validateTimeoutRef.current);

    setValidating(true);
    validateTimeoutRef.current = setTimeout(async () => {
      try {
        const tokenContract = new ethers.Contract(address, ERC20_ABI, provider);
        const [symbol, decimals, balance] = await Promise.all([
          tokenContract.symbol().catch(() => '???'),
          tokenContract.decimals().catch(() => 18),
          tokenContract.balanceOf(account).catch(() => 0n),
        ]);
        
        setTokenValidation({ symbol, decimals: Number(decimals), isValid: true });
        setTokenBalance(ethers.formatUnits(balance, decimals));
      } catch (err) {
        setError(`Validation error: ${err.message}`);
      } finally {
        setValidating(false);
      }
    }, 300);
  }, [provider, account]);

  // Zap Token
  const handleZapToken = async () => {
    if (!tokenValidation?.isValid) { setError('❌ Invalid token'); return; }
    if (!zapAmount || parseFloat(zapAmount) <= 0) { setError('❌ Enter valid amount'); return; }
    
    setLoading(true); setError(''); setSuccess('');
    try {
      const signer = await getSigner();
      if (!signer) { setError('❌ Connect wallet'); setLoading(false); return; }
      
      const decimals = tokenValidation.decimals || 18;
      const amountWei = ethers.parseUnits(zapAmount, decimals);
      
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(account, DAPPER_FLEX_V6_ADDRESS);
      
      if (allowance < amountWei) {
        setSuccess('⏳ Approving token...');
        const approveTx = await tokenContract.approve(DAPPER_FLEX_V6_ADDRESS, ethers.MaxUint256);
        await approveTx.wait();
      }
      
      setSuccess('⏳ Zapping token...');
      const contract = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer);
      const tx = await contract.zapToken(tokenAddress, amountWei, stakePercent, referrer || ethers.ZeroAddress);
      await tx.wait();
      
      setSuccess(`🎉 Zapped ${zapAmount} ${tokenValidation.symbol}!`);
      setZapAmount('');
      setTokenAddress('');
      setTokenValidation(null);
      fetchPulseData();
    } catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  // Stake actions
  const handleClaim = async (id) => {
    setLoading(true); setError('');
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer);
      await (await c.claimRewards(id)).wait();
      setSuccess('✅ Claimed!');
      fetchPulseData();
    } catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const handleCompound = async (id) => {
    setLoading(true); setError('');
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer);
      await (await c.compound(id)).wait();
      setSuccess('✅ Compounded!');
      fetchPulseData();
    } catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const handleUnstake = async (id) => {
    setLoading(true); setError('');
    try {
      const signer = await getSigner();
      const c = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer);
      await (await c.unstake(id)).wait();
      setSuccess('✅ Unstaked!');
      fetchPulseData();
    } catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?ref=${account}`);
    setSuccess('📋 Referral link copied!');
  };

  // Count total tokens found
  const totalTokensFound = Object.values(tokensByChain).reduce((sum, tokens) => sum + tokens.length, 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <CrossChainStar size={42} />
        <div>
          <h2 style={styles.title}>DAPPER FLEX V6</h2>
          <p style={styles.subtitle}>💗⭐ True Cross-Chain Scanner • 10% APR • Referrals ⭐💗</p>
        </div>
        <CrossChainStar size={42} />
      </div>

      {/* Referral Banner */}
      {myReferrer && (
        <div style={styles.referralBanner}>
          🤝 Referred by: {myReferrer.slice(0, 6)}...{myReferrer.slice(-4)}
        </div>
      )}

      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statBox}>
          <div style={styles.statLabel}>Total Staked</div>
          <div style={styles.statValue}>{parseFloat(totalStaked).toLocaleString()} LP</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statLabel}>Your Staked</div>
          <div style={{...styles.statValue, color: '#4CAF50'}}>{parseFloat(userTotalStaked).toLocaleString()} LP</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statLabel}>APR</div>
          <div style={{...styles.statValue, color: '#FFD700'}}>10%</div>
        </div>
        <div style={styles.statBox}>
          <div style={styles.statLabel}>Rewards Pool</div>
          <div style={{...styles.statValue, color: '#FF69B4'}}>{parseFloat(rewardsPool).toLocaleString()}</div>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={styles.tabs}>
        {[
          { id: 'crosschain', label: '🌐 Cross-Chain' },
          { id: 'pulse', label: '💗 PulseChain' },
          { id: 'stakes', label: '📊 Stakes' },
          { id: 'referral', label: '🤝 Refer' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...styles.tab,
              background: activeTab === tab.id ? 'linear-gradient(135deg, #FF69B4, #FFD700)' : 'rgba(255,105,180,0.1)',
              color: activeTab === tab.id ? '#000' : '#FF69B4',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}
      {scanError && <div style={styles.error}>{scanError}</div>}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* CROSS-CHAIN TAB */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'crosschain' && (
        <div>
          {/* Summary Box */}
          <div style={styles.summaryBox}>
            <div style={styles.summaryHeader}>
              <span>⭐ OFF-CHAIN ASSETS</span>
              <button onClick={scanAllChainsAnkr} disabled={scanningChains} style={styles.scanBtn}>
                {scanningChains ? '🔍 Scanning...' : '🔄 Rescan All'}
              </button>
            </div>
            <div style={styles.summaryTotal}>
              Total: <span style={{color: '#FFD700'}}>${offChainTotal.toFixed(2)}</span>
            </div>
            <div style={styles.summaryMeta}>
              {totalTokensFound} tokens found across {Object.keys(tokensByChain).length} chains
            </div>
            
            {/* Filter */}
            <div style={styles.filterRow}>
              <span style={{fontSize: '11px', color: '#888'}}>Min value:</span>
              <select 
                value={minValueFilter} 
                onChange={(e) => setMinValueFilter(parseFloat(e.target.value))}
                style={styles.filterSelect}
              >
                <option value="0">All</option>
                <option value="1">$1+</option>
                <option value="10">$10+</option>
                <option value="50">$50+</option>
                <option value="100">$100+</option>
              </select>
            </div>
          </div>

          {/* Scanning indicator */}
          {scanningChains && (
            <div style={styles.scanningBox}>
              <div className="spinner" style={styles.spinner}></div>
              <span>Scanning 8 chains for ALL your tokens...</span>
            </div>
          )}

          {/* Chain Cards */}
          {!scanningChains && Object.keys(tokensByChain).length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{fontSize: '40px'}}>🌐</div>
              <p>No off-chain assets found</p>
              <p style={{fontSize: '11px', color: '#666'}}>Connect wallet and click "Rescan All"</p>
            </div>
          ) : (
            Object.entries(tokensByChain).map(([chainKey, tokens]) => {
              const chain = CHAINS[chainKey];
              if (!chain) return null;
              
              const chainTotal = tokens.reduce((sum, t) => sum + t.usdValue, 0);
              
              return (
                <div key={chainKey} style={styles.chainCard}>
                  <div style={styles.chainHeader}>
                    <span style={{fontSize: '18px'}}>{chain.icon}</span>
                    <span style={{fontWeight: 'bold', color: chain.color}}>{chain.name}</span>
                    <span style={{fontSize: '11px', color: '#888'}}>({tokens.length} tokens)</span>
                    <span style={{marginLeft: 'auto', color: '#FFD700', fontWeight: 'bold'}}>${chainTotal.toFixed(2)}</span>
                  </div>
                  
                  {tokens.map((token, idx) => (
                    <div key={idx} style={styles.tokenRow}>
                      <div style={styles.tokenLeft}>
                        {token.thumbnail && (
                          <img src={token.thumbnail} alt="" style={styles.tokenIcon} onError={(e) => e.target.style.display = 'none'} />
                        )}
                        <div>
                          <div style={styles.tokenSymbol}>
                            {token.symbol}
                            {token.isStable && <span style={styles.stableBadge}>💵 STABLE</span>}
                            {token.isNative && <span style={styles.nativeBadge}>⛽ NATIVE</span>}
                          </div>
                          <div style={styles.tokenName}>{token.name}</div>
                        </div>
                      </div>
                      
                      <div style={styles.tokenRight}>
                        <div style={styles.tokenBalance}>{token.balance.toFixed(4)}</div>
                        <div style={styles.tokenUsd}>${token.usdValue.toFixed(2)}</div>
                      </div>
                      
                      <div style={styles.tokenActions}>
                        {token.isStable ? (
                          <button onClick={openBridge} style={styles.bridgeBtn}>
                            🌉 Bridge
                          </button>
                        ) : (
                          <button onClick={() => openSwap(chainKey, token)} style={styles.swapBtn}>
                            💱 Swap
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}

          {/* Liberty Swap CTA */}
          <div style={styles.libertyBox}>
            <div style={{fontSize: '24px', marginBottom: '8px'}}>🌉</div>
            <h4 style={{color: '#FFD700', margin: '0 0 6px 0'}}>Bridge via Liberty Swap</h4>
            <p style={{color: '#888', fontSize: '11px', marginBottom: '10px'}}>
              Bridge USDC from any chain to PulseChain, then zap into DTGC LP!
            </p>
            <button onClick={openBridge} style={styles.libertyBtn}>
              Open Liberty Swap →
            </button>
          </div>

          {/* Instructions */}
          <div style={styles.instructionBox}>
            <div style={{color: '#FF69B4', fontWeight: 'bold', marginBottom: '6px', fontSize: '12px'}}>📋 How to Zap Cross-Chain:</div>
            <ol style={{margin: 0, paddingLeft: '18px', fontSize: '11px', color: '#888', lineHeight: '1.7'}}>
              <li>Click <strong>💱 Swap</strong> to convert any token to USDC on its native chain</li>
              <li>Click <strong>🌉 Bridge</strong> to send USDC to PulseChain via Liberty Swap</li>
              <li>Go to <strong>💗 PulseChain</strong> tab and zap your bridged tokens!</li>
            </ol>
          </div>

          {/* Powered by */}
          <div style={styles.poweredBy}>
            ⚡ Powered by Ankr Advanced API - Scanning ALL tokens across 8 chains
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* PULSECHAIN TAB */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pulse' && (
        <div>
          {/* Mode Toggle */}
          <div style={styles.modeToggle}>
            <button
              onClick={() => setZapMode('pls')}
              style={{
                ...styles.modeBtn,
                background: zapMode === 'pls' ? 'linear-gradient(135deg, #FF69B4, #FFD700)' : 'rgba(255,105,180,0.1)',
                color: zapMode === 'pls' ? '#000' : '#FF69B4',
              }}
            >
              ⚡ Zap PLS
            </button>
            <button
              onClick={() => setZapMode('token')}
              style={{
                ...styles.modeBtn,
                background: zapMode === 'token' ? 'linear-gradient(135deg, #FF69B4, #FFD700)' : 'rgba(255,105,180,0.1)',
                color: zapMode === 'token' ? '#000' : '#FF69B4',
              }}
            >
              🔗 Zap Token
            </button>
          </div>

          {/* PLS Mode */}
          {zapMode === 'pls' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>PLS Amount (Balance: {parseFloat(plsBalance).toFixed(2)})</label>
              <div style={{display: 'flex', gap: '10px'}}>
                <input
                  type="number"
                  value={zapAmount}
                  onChange={(e) => setZapAmount(e.target.value)}
                  placeholder="0.0"
                  style={styles.input}
                />
                <button onClick={() => setZapAmount((parseFloat(plsBalance) * 0.95).toFixed(4))} style={styles.maxBtn}>
                  MAX
                </button>
              </div>
            </div>
          )}

          {/* Token Mode */}
          {zapMode === 'token' && (
            <>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Token Address (Any PulseChain token)</label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => handleTokenChange(e.target.value)}
                  placeholder="0x..."
                  style={styles.input}
                />
                {validating && <span style={{color: '#FF69B4', fontSize: '11px'}}>🔍 Validating...</span>}
              </div>

              {tokenValidation?.isValid && (
                <div style={styles.inputGroup}>
                  <label style={styles.label}>
                    {tokenValidation.symbol} Amount (Balance: {parseFloat(tokenBalance).toFixed(4)})
                  </label>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <input
                      type="number"
                      value={zapAmount}
                      onChange={(e) => setZapAmount(e.target.value)}
                      placeholder="0.0"
                      style={styles.input}
                    />
                    <button onClick={() => setZapAmount((parseFloat(tokenBalance) * 0.95).toFixed(4))} style={styles.maxBtn}>
                      MAX
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Stake Slider */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Stake: {stakePercent}%</label>
            <input
              type="range"
              min="0"
              max="100"
              value={stakePercent}
              onChange={(e) => setStakePercent(parseInt(e.target.value))}
              style={{width: '100%', accentColor: '#FF69B4'}}
            />
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#666'}}>
              <span>0% (LP to wallet)</span>
              <span>100% (All staked)</span>
            </div>
          </div>

          {/* Zap Button */}
          <button
            onClick={zapMode === 'pls' ? handleZapPLS : handleZapToken}
            disabled={loading || !zapAmount || (zapMode === 'token' && !tokenValidation?.isValid)}
            style={{...styles.zapButton, opacity: loading ? 0.5 : 1}}
          >
            {loading ? '⏳ Processing...' : `⚡ Zap ${stakePercent}% to Stake`}
          </button>

          <p style={{color: '#666', fontSize: '11px', textAlign: 'center', marginTop: '10px'}}>
            {zapMode === 'pls' ? 'PLS → DTGC/PLS LP → Stake at 10% APR' : 'Token → LP → Stake at 10% APR'} (No Lock!)
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* STAKES TAB */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'stakes' && (
        <div>
          {userStakes.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{fontSize: '48px'}}>💗</div>
              <p>No active stakes</p>
            </div>
          ) : (
            userStakes.map((stake) => (
              <div key={stake.id} style={styles.stakeCard}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                  <span style={{color: '#FF69B4', fontWeight: 'bold'}}>Stake #{stake.id}</span>
                  <span style={{color: '#4CAF50'}}>{parseFloat(stake.lpAmount).toFixed(4)} LP</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px'}}>
                  <span style={{color: '#888'}}>Pending Rewards:</span>
                  <span style={{color: '#FFD700'}}>{parseFloat(stake.pendingRewards).toFixed(6)} DTGC</span>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button onClick={() => handleClaim(stake.id)} disabled={loading} style={{...styles.actionBtn, background: '#4CAF50'}}>
                    💰 Claim
                  </button>
                  <button onClick={() => handleCompound(stake.id)} disabled={loading} style={{...styles.actionBtn, background: '#9C27B0'}}>
                    🔄 Compound
                  </button>
                  <button onClick={() => handleUnstake(stake.id)} disabled={loading} style={{...styles.actionBtn, background: '#f44336'}}>
                    📤 Unstake
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* REFERRAL TAB */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'referral' && (
        <div>
          <div style={styles.referralPanel}>
            <CrossChainStar size={50} />
            <h3 style={{color: '#FFD700', margin: '12px 0'}}>Earn 0.3% on Every Referral</h3>
            <p style={{color: '#888', fontSize: '12px', marginBottom: '12px'}}>
              Share your link and earn PLS when anyone zaps!
            </p>
            <div style={styles.referralLink}>
              {`${window.location.origin}?ref=${account || '0x...'}`}
            </div>
            <button onClick={copyReferralLink} disabled={!account} style={styles.copyBtn}>
              📋 Copy Referral Link
            </button>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
            <div style={styles.referralStat}>
              <div style={{color: '#888', fontSize: '11px'}}>Total Referrals</div>
              <div style={{color: '#FF69B4', fontSize: '28px', fontWeight: 'bold'}}>{referralStats.count}</div>
            </div>
            <div style={styles.referralStat}>
              <div style={{color: '#888', fontSize: '11px'}}>Total Earned</div>
              <div style={{color: '#FFD700', fontSize: '28px', fontWeight: 'bold'}}>{parseFloat(referralStats.earnings).toFixed(2)}</div>
              <div style={{color: '#666', fontSize: '10px'}}>PLS</div>
            </div>
          </div>
        </div>
      )}

      {/* Contract Info */}
      <div style={styles.contractInfo}>
        Contract: <a
          href={`https://scan.pulsechain.com/address/${DAPPER_FLEX_V6_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{color: '#FFD700'}}
        >
          {DAPPER_FLEX_V6_ADDRESS.slice(0, 10)}...{DAPPER_FLEX_V6_ADDRESS.slice(-8)}
        </a>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
  container: {
    background: 'linear-gradient(135deg, #1a0a15 0%, #2a1520 50%, #1a1020 100%)',
    border: '2px solid #FF69B4',
    borderRadius: '16px',
    padding: '20px',
    maxWidth: '600px',
    margin: '20px auto',
    color: '#fff',
    boxShadow: '0 0 40px rgba(255,105,180,0.3), 0 0 80px rgba(255,215,0,0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  title: {
    background: 'linear-gradient(135deg, #FF69B4, #FFD700, #FF1493)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: '24px',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: 0,
  },
  subtitle: { color: '#aaa', fontSize: '10px', textAlign: 'center', margin: 0 },
  referralBanner: { background: 'rgba(255,105,180,0.1)', border: '1px solid #FF69B4', borderRadius: '8px', padding: '6px', textAlign: 'center', fontSize: '11px', color: '#FF69B4', marginBottom: '12px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '12px' },
  statBox: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.2)', borderRadius: '8px', padding: '8px 4px', textAlign: 'center' },
  statLabel: { color: '#888', fontSize: '9px', marginBottom: '2px' },
  statValue: { color: '#FF69B4', fontSize: '12px', fontWeight: 'bold' },
  tabs: { display: 'flex', gap: '6px', marginBottom: '12px' },
  tab: { flex: 1, padding: '8px 4px', borderRadius: '8px', border: '1px solid #FF69B4', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' },
  error: { background: 'rgba(255,0,0,0.15)', border: '1px solid #ff4444', color: '#ff6666', padding: '8px', borderRadius: '8px', marginBottom: '10px', fontSize: '11px' },
  success: { background: 'rgba(0,255,0,0.15)', border: '1px solid #44ff44', color: '#66ff66', padding: '8px', borderRadius: '8px', marginBottom: '10px', fontSize: '11px' },

  // Cross-chain
  summaryBox: { background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,105,180,0.1))', border: '2px solid #FFD700', borderRadius: '12px', padding: '14px', marginBottom: '14px' },
  summaryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', color: '#FFD700', fontWeight: 'bold', fontSize: '13px' },
  summaryTotal: { fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' },
  summaryMeta: { fontSize: '11px', color: '#888' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' },
  filterSelect: { padding: '4px 8px', borderRadius: '4px', border: '1px solid #FF69B4', background: '#1a0a15', color: '#fff', fontSize: '11px' },
  scanBtn: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #FF69B4', background: 'rgba(255,105,180,0.1)', color: '#FF69B4', cursor: 'pointer', fontSize: '11px' },
  scanningBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '20px', color: '#FF69B4', fontSize: '12px' },
  spinner: { width: '20px', height: '20px', border: '2px solid #FF69B4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  chainCard: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '12px', marginBottom: '10px' },
  chainHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' },
  tokenRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', gap: '8px' },
  tokenLeft: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1 },
  tokenIcon: { width: '24px', height: '24px', borderRadius: '50%' },
  tokenSymbol: { fontWeight: 'bold', color: '#fff', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' },
  tokenName: { fontSize: '10px', color: '#666' },
  tokenRight: { textAlign: 'right' },
  tokenBalance: { fontSize: '12px', color: '#fff' },
  tokenUsd: { fontSize: '11px', color: '#4CAF50', fontWeight: 'bold' },
  tokenActions: { marginLeft: '8px' },
  stableBadge: { background: 'rgba(76,175,80,0.2)', color: '#4CAF50', padding: '2px 5px', borderRadius: '4px', fontSize: '8px', marginLeft: '4px' },
  nativeBadge: { background: 'rgba(255,165,0,0.2)', color: '#FFA500', padding: '2px 5px', borderRadius: '4px', fontSize: '8px', marginLeft: '4px' },
  swapBtn: { padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #FF69B4, #FF1493)', color: '#fff', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  bridgeBtn: { padding: '5px 10px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap' },
  libertyBox: { background: 'linear-gradient(135deg, rgba(255,215,0,0.05), rgba(255,165,0,0.1))', border: '1px solid rgba(255,215,0,0.3)', borderRadius: '12px', padding: '14px', textAlign: 'center', marginBottom: '12px' },
  libertyBtn: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #FFD700, #FFA500)', color: '#000', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  instructionBox: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '10px' },
  poweredBy: { textAlign: 'center', fontSize: '10px', color: '#666', marginTop: '10px' },
  emptyState: { textAlign: 'center', padding: '30px', color: '#666' },

  // PulseChain
  modeToggle: { display: 'flex', gap: '8px', marginBottom: '12px' },
  modeBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #FF69B4', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' },
  inputGroup: { marginBottom: '12px' },
  label: { color: '#888', fontSize: '11px', display: 'block', marginBottom: '4px' },
  input: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #FF69B4', background: '#0d0510', color: '#fff', fontSize: '14px', width: '100%', boxSizing: 'border-box' },
  maxBtn: { padding: '10px 14px', borderRadius: '8px', border: '1px solid #FFD700', background: 'rgba(255,215,0,0.1)', color: '#FFD700', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  zapButton: { width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #FF69B4, #FFD700)', color: '#000', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,105,180,0.4)' },

  // Stakes
  stakeCard: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '8px' },
  actionBtn: { flex: 1, padding: '8px', borderRadius: '6px', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' },

  // Referral
  referralPanel: { background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '12px', padding: '16px', textAlign: 'center', marginBottom: '12px' },
  referralLink: { background: '#0d0510', border: '1px solid #FF69B4', borderRadius: '6px', padding: '8px', marginBottom: '10px', wordBreak: 'break-all', fontSize: '9px', color: '#4CAF50' },
  copyBtn: { padding: '8px 20px', borderRadius: '6px', border: 'none', background: 'linear-gradient(135deg, #FF69B4, #FFD700)', color: '#000', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' },
  referralStat: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.2)', borderRadius: '10px', padding: '12px', textAlign: 'center' },

  contractInfo: { marginTop: '12px', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '9px', color: '#555', textAlign: 'center' },
};

// Add keyframes for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);

export default DapperFlexV6;
