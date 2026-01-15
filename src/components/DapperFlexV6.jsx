import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════
// 💗⭐ DAPPER FLEX V6 - PINK GOLD CROSS-CHAIN EDITION ⭐💗
// Contract: 0x0b11799Ef41A01fB9399dCbA161076d7aed20b3e
// ═══════════════════════════════════════════════════════════════

const DAPPER_FLEX_V6_ADDRESS = '0x0b11799Ef41A01fB9399dCbA161076d7aed20b3e';

const DAPPER_FLEX_V6_ABI = [
  'function zapPLS(uint256 stakePercent, address referrer) external payable',
  'function zapToken(address token, uint256 amount, uint256 stakePercent, address referrer) external',
  'function stakeLP(uint256 amount) external',
  'function unstake(uint256 stakeId) external',
  'function claimRewards(uint256 stakeId) external',
  'function compound(uint256 stakeId) external',
  'function setReferrer(address referrer) external',
  'function getReferralStats(address referrer) external view returns (uint256 totalReferred, uint256 totalEarned)',
  'function referrerOf(address user) external view returns (address)',
  'function pendingRewards(address user, uint256 stakeId) external view returns (uint256)',
  'function getUserStakes(address user) external view returns (tuple(uint256 lpAmount, uint256 startTime, uint256 lastClaimTime, address referrer, bool active)[])',
  'function totalStakedByUser(address user) external view returns (uint256)',
  'function totalStaked() external view returns (uint256)',
  'function getRewardsPoolBalance() external view returns (uint256)',
];

// ⭐ Cross-Chain Star SVG Component
const CrossChainStar = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 105, 180, 0.8))' }}>
    <defs>
      <linearGradient id="pinkGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF69B4" />
        <stop offset="50%" stopColor="#FFD700" />
        <stop offset="100%" stopColor="#FF1493" />
      </linearGradient>
    </defs>
    <polygon 
      points="50,5 61,35 95,35 68,57 79,90 50,70 21,90 32,57 5,35 39,35" 
      fill="url(#pinkGoldGrad)" 
    />
    <circle cx="50" cy="50" r="15" fill="none" stroke="#FFD700" strokeWidth="2" />
    <circle cx="50" cy="50" r="10" fill="none" stroke="#FF69B4" strokeWidth="2" strokeDasharray="4 2" />
    <circle cx="50" cy="50" r="4" fill="#FFD700" />
  </svg>
);

const DapperFlexV6 = ({ provider, account }) => {
  const [activeTab, setActiveTab] = useState('zap');
  const [zapAmount, setZapAmount] = useState('');
  const [stakePercent, setStakePercent] = useState(100);
  const [userStakes, setUserStakes] = useState([]);
  const [totalStaked, setTotalStaked] = useState('0');
  const [userTotalStaked, setUserTotalStaked] = useState('0');
  const [plsBalance, setPlsBalance] = useState('0');
  const [referrer, setReferrer] = useState(null);
  const [myReferrer, setMyReferrer] = useState(null);
  const [referralStats, setReferralStats] = useState({ count: 0, earnings: '0' });
  const [rewardsPool, setRewardsPool] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const fetchData = useCallback(async () => {
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
      
      try {
        const stakes = await contract.getUserStakes(account);
        const formattedStakes = await Promise.all(stakes.map(async (stake, idx) => {
          let pending = '0';
          if (stake.active) { try { pending = await contract.pendingRewards(account, idx); } catch {} }
          return { id: idx, lpAmount: ethers.formatEther(stake.lpAmount), startTime: Number(stake.startTime), active: stake.active, pendingRewards: ethers.formatEther(pending) };
        }));
        setUserStakes(formattedStakes.filter(s => s.active));
      } catch {}
      
      try {
        const myRef = await contract.referrerOf(account);
        if (myRef !== ethers.ZeroAddress) setMyReferrer(myRef);
        const [count, earnings] = await contract.getReferralStats(account);
        setReferralStats({ count: Number(count), earnings: ethers.formatEther(earnings) });
      } catch {}
    } catch (err) { console.error('Fetch error:', err); }
  }, [provider, account]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const getSigner = async () => {
    if (!provider) return null;
    try { const bp = new ethers.BrowserProvider(window.ethereum); return await bp.getSigner(); } catch { return null; }
  };

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
      fetchData();
    } catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const handleUnstake = async (id) => {
    setLoading(true); setError('');
    try { const signer = await getSigner(); const c = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer); await (await c.unstake(id)).wait(); setSuccess('✅ Unstaked!'); fetchData(); }
    catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const handleClaim = async (id) => {
    setLoading(true); setError('');
    try { const signer = await getSigner(); const c = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer); await (await c.claimRewards(id)).wait(); setSuccess('✅ Claimed!'); fetchData(); }
    catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const handleCompound = async (id) => {
    setLoading(true); setError('');
    try { const signer = await getSigner(); const c = new ethers.Contract(DAPPER_FLEX_V6_ADDRESS, DAPPER_FLEX_V6_ABI, signer); await (await c.compound(id)).wait(); setSuccess('✅ Compounded!'); fetchData(); }
    catch (err) { setError(`❌ ${err.reason || err.message}`); }
    finally { setLoading(false); }
  };

  const copyReferralLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?ref=${account}`);
    setSuccess('📋 Copied!');
  };

  const feePreview = zapAmount && parseFloat(zapAmount) > 0 ? {
    growth: referrer ? (parseFloat(zapAmount) * 0.005).toFixed(4) : (parseFloat(zapAmount) * 0.007).toFixed(4),
    referrer: referrer ? (parseFloat(zapAmount) * 0.003).toFixed(4) : '0',
    dev: referrer ? (parseFloat(zapAmount) * 0.002).toFixed(4) : (parseFloat(zapAmount) * 0.003).toFixed(4),
    net: (parseFloat(zapAmount) * 0.99).toFixed(4),
  } : null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <CrossChainStar size={50} />
        <div>
          <h2 style={styles.title}>DAPPER FLEX V6</h2>
          <p style={styles.subtitle}>💗⭐ Cross-Chain Zapper • 10% APR • Referrals ⭐💗</p>
        </div>
        <CrossChainStar size={50} />
      </div>

      {myReferrer && <div style={styles.referralBanner}>🤝 Referred by: {myReferrer.slice(0, 6)}...{myReferrer.slice(-4)}</div>}
      {referrer && !myReferrer && <div style={{...styles.referralBanner, borderColor: '#4CAF50', color: '#4CAF50'}}>✅ Referrer: {referrer.slice(0, 6)}...{referrer.slice(-4)}</div>}

      <div style={styles.statsRow}>
        <div style={styles.statBox}><div style={styles.statLabel}>Total Staked</div><div style={styles.statValue}>{parseFloat(totalStaked).toLocaleString()} LP</div></div>
        <div style={styles.statBox}><div style={styles.statLabel}>Your Staked</div><div style={{...styles.statValue, color: '#4CAF50'}}>{parseFloat(userTotalStaked).toLocaleString()} LP</div></div>
        <div style={styles.statBox}><div style={styles.statLabel}>APR</div><div style={{...styles.statValue, color: '#FFD700'}}>10%</div></div>
        <div style={styles.statBox}><div style={styles.statLabel}>Rewards</div><div style={{...styles.statValue, color: '#FF69B4'}}>{parseFloat(rewardsPool).toLocaleString()}</div></div>
      </div>

      <div style={styles.tabs}>
        {['zap', 'stakes', 'referral'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{...styles.tab, background: activeTab === tab ? 'linear-gradient(135deg, #FF69B4, #FFD700)' : 'rgba(255,105,180,0.1)', color: activeTab === tab ? '#000' : '#FF69B4'}}>
            {tab === 'zap' && '⚡ Zap'}{tab === 'stakes' && '📊 Stakes'}{tab === 'referral' && '🤝 Refer'}
          </button>
        ))}
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {activeTab === 'zap' && (
        <div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>PLS Amount (Balance: {parseFloat(plsBalance).toFixed(2)})</label>
            <div style={{display: 'flex', gap: '10px'}}>
              <input type="number" value={zapAmount} onChange={(e) => setZapAmount(e.target.value)} placeholder="0.0" style={styles.input} />
              <button onClick={() => setZapAmount((parseFloat(plsBalance) * 0.95).toFixed(4))} style={styles.maxBtn}>MAX</button>
            </div>
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Stake: {stakePercent}%</label>
            <input type="range" min="0" max="100" value={stakePercent} onChange={(e) => setStakePercent(parseInt(e.target.value))} style={{width: '100%', accentColor: '#FF69B4'}} />
          </div>
          {feePreview && (
            <div style={styles.feeBox}>
              <div style={{color: '#FF69B4', fontWeight: 'bold', marginBottom: '8px'}}>💗 1% Entry Fee</div>
              <div style={styles.feeGrid}>
                <span>🔥 Growth:</span><span style={{color: '#FFD700'}}>{feePreview.growth} PLS</span>
                <span>🤝 Referrer:</span><span style={{color: referrer ? '#4CAF50' : '#666'}}>{feePreview.referrer} PLS</span>
                <span>Net to LP:</span><span style={{color: '#4CAF50', fontWeight: 'bold'}}>{feePreview.net} PLS</span>
              </div>
            </div>
          )}
          <button onClick={handleZapPLS} disabled={loading || !zapAmount} style={{...styles.button, opacity: loading ? 0.5 : 1}}>
            {loading ? '⏳ Processing...' : `⚡ Zap ${stakePercent}% to Stake`}
          </button>
          <p style={{color: '#666', fontSize: '11px', textAlign: 'center', marginTop: '10px'}}>PLS → LP → Stake at 10% APR (No Lock!)</p>
        </div>
      )}

      {activeTab === 'stakes' && (
        <div>
          {userStakes.length === 0 ? (
            <div style={{textAlign: 'center', padding: '40px', color: '#666'}}><div style={{fontSize: '48px'}}>💗</div><p>No stakes yet</p></div>
          ) : (
            userStakes.map((s) => (
              <div key={s.id} style={styles.stakeCard}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                  <span style={{color: '#FF69B4', fontWeight: 'bold'}}>#{s.id}</span>
                  <span style={{color: '#4CAF50'}}>{parseFloat(s.lpAmount).toFixed(4)} LP</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px'}}>
                  <span style={{color: '#888'}}>Pending:</span>
                  <span style={{color: '#FFD700'}}>{parseFloat(s.pendingRewards).toFixed(6)} DTGC</span>
                </div>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button onClick={() => handleClaim(s.id)} disabled={loading} style={{...styles.actionBtn, background: '#4CAF50'}}>💰 Claim</button>
                  <button onClick={() => handleCompound(s.id)} disabled={loading} style={{...styles.actionBtn, background: '#9C27B0'}}>🔄 Compound</button>
                  <button onClick={() => handleUnstake(s.id)} disabled={loading} style={{...styles.actionBtn, background: '#f44336'}}>📤 Unstake</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'referral' && (
        <div>
          <div style={styles.referralPanel}>
            <CrossChainStar size={60} />
            <h3 style={{color: '#FFD700', margin: '15px 0'}}>Earn 0.3% on Referrals</h3>
            <div style={styles.referralLink}>{`${window.location.origin}?ref=${account || '0x...'}`}</div>
            <button onClick={copyReferralLink} disabled={!account} style={styles.copyBtn}>📋 Copy Link</button>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
            <div style={styles.referralStat}><div style={{color: '#888', fontSize: '12px'}}>Referrals</div><div style={{color: '#FF69B4', fontSize: '28px', fontWeight: 'bold'}}>{referralStats.count}</div></div>
            <div style={styles.referralStat}><div style={{color: '#888', fontSize: '12px'}}>Earned</div><div style={{color: '#FFD700', fontSize: '28px', fontWeight: 'bold'}}>{parseFloat(referralStats.earnings).toFixed(2)}</div><div style={{color: '#666', fontSize: '11px'}}>PLS</div></div>
          </div>
        </div>
      )}

      <div style={styles.contractInfo}>
        Contract: <a href={`https://scan.pulsechain.com/address/${DAPPER_FLEX_V6_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{color: '#FFD700'}}>{DAPPER_FLEX_V6_ADDRESS.slice(0, 10)}...{DAPPER_FLEX_V6_ADDRESS.slice(-8)}</a>
      </div>
    </div>
  );
};

const styles = {
  container: { background: 'linear-gradient(135deg, #1a0a15 0%, #2a1520 50%, #1a1020 100%)', border: '2px solid #FF69B4', borderRadius: '16px', padding: '24px', maxWidth: '550px', margin: '20px auto', color: '#fff', boxShadow: '0 0 40px rgba(255,105,180,0.3), 0 0 80px rgba(255,215,0,0.1)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '20px' },
  title: { background: 'linear-gradient(135deg, #FF69B4, #FFD700, #FF1493)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '26px', fontWeight: 'bold', textAlign: 'center', margin: 0 },
  subtitle: { color: '#aaa', fontSize: '11px', textAlign: 'center', margin: 0 },
  referralBanner: { background: 'rgba(255,105,180,0.1)', border: '1px solid #FF69B4', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '12px', color: '#FF69B4', marginBottom: '15px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '15px' },
  statBox: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.2)', borderRadius: '10px', padding: '10px 6px', textAlign: 'center' },
  statLabel: { color: '#888', fontSize: '10px', marginBottom: '2px' },
  statValue: { color: '#FF69B4', fontSize: '13px', fontWeight: 'bold' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '15px' },
  tab: { flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid #FF69B4', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  inputGroup: { marginBottom: '12px' },
  label: { color: '#888', fontSize: '12px', display: 'block', marginBottom: '5px' },
  input: { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #FF69B4', background: '#0d0510', color: '#fff', fontSize: '16px', width: '100%' },
  maxBtn: { padding: '12px 16px', borderRadius: '10px', border: '1px solid #FFD700', background: 'rgba(255,215,0,0.1)', color: '#FFD700', cursor: 'pointer', fontWeight: 'bold' },
  feeBox: { background: 'rgba(255,105,180,0.1)', border: '1px solid rgba(255,105,180,0.3)', borderRadius: '10px', padding: '12px', marginBottom: '12px', fontSize: '12px' },
  feeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', color: '#888' },
  button: { width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #FF69B4, #FFD700)', color: '#000', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,105,180,0.4)' },
  stakeCard: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.3)', borderRadius: '12px', padding: '14px', marginBottom: '10px' },
  actionBtn: { flex: 1, padding: '10px', borderRadius: '8px', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' },
  referralPanel: { background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '12px', padding: '20px', textAlign: 'center', marginBottom: '15px' },
  referralLink: { background: '#0d0510', border: '1px solid #FF69B4', borderRadius: '8px', padding: '10px', marginBottom: '12px', wordBreak: 'break-all', fontSize: '10px', color: '#4CAF50' },
  copyBtn: { padding: '10px 24px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #FF69B4, #FFD700)', color: '#000', fontWeight: 'bold', cursor: 'pointer' },
  referralStat: { background: 'rgba(255,105,180,0.05)', border: '1px solid rgba(255,105,180,0.2)', borderRadius: '12px', padding: '15px', textAlign: 'center' },
  contractInfo: { marginTop: '15px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '10px', color: '#555', textAlign: 'center' },
  error: { background: 'rgba(255,0,0,0.15)', border: '1px solid #ff4444', color: '#ff6666', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' },
  success: { background: 'rgba(0,255,0,0.15)', border: '1px solid #44ff44', color: '#66ff66', padding: '10px', borderRadius: '8px', marginBottom: '12px', fontSize: '12px' },
};

export default DapperFlexV6;
