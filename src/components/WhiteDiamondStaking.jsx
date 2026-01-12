import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const WHITE_DIAMOND_CONFIG = {
  CONTRACT_ADDRESS: '0x326F86e7d594B55B7BA08DFE5195b10b159033fD',
  LP_TOKEN: '0x670c972Bb5388E087a2934a063064d97278e01F3', // URMOM/DTGC LP
  REWARD_TOKEN: '0xD0676B28a457371D58d47E5247b439114e40Eb0F', // DTGC
  APR: 70,
  LOCK_DAYS: 90,
  MIN_STAKE: '1000',
  ENTRY_FEE: 3.75,
  EXIT_FEE: 3.75,
  EARLY_EXIT_PENALTY: 20,
};

const WHITE_DIAMOND_ABI = [
  'function stake(uint256 amount) external returns (uint256)',
  'function withdraw(uint256 tokenId) external',
  'function claimRewards(uint256 tokenId) external',
  'function emergencyWithdraw(uint256 tokenId) external',
  'function getStakesByOwner(address user) external view returns (uint256[])',
  'function getPosition(uint256 tokenId) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lastClaimTime, uint256 pending, bool isActive, uint256 timeRemaining)',
  'function getStats() external view returns (uint256, uint256, uint256, uint256, uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const WhiteDiamondStaking = ({ provider, account, isDark }) => {
  const [lpBalance, setLpBalance] = useState('0');
  const [dtgcBalance, setDtgcBalance] = useState('0');
  const [stakeAmount, setStakeAmount] = useState('');
  const [userStakes, setUserStakes] = useState([]);
  const [contractStats, setContractStats] = useState({
    totalStaked: '0',
    totalNFTs: '0',
    totalRewardsPaid: '0',
  });
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDiamondPaper, setShowDiamondPaper] = useState(false);

  useEffect(() => {
    if (provider && account) {
      loadData();
      const interval = setInterval(loadData, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [provider, account]);

  const loadData = async () => {
    await Promise.all([
      loadBalances(),
      loadUserStakes(),
      loadContractStats(),
      checkApproval(),
    ]);
  };

  const loadBalances = async () => {
    try {
      const lpContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.LP_TOKEN, ERC20_ABI, provider);
      const dtgcContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.REWARD_TOKEN, ERC20_ABI, provider);
      const [lpBal, dtgcBal] = await Promise.all([
        lpContract.balanceOf(account),
        dtgcContract.balanceOf(account),
      ]);
      setLpBalance(ethers.formatEther(lpBal));
      setDtgcBalance(ethers.formatEther(dtgcBal));
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const loadUserStakes = async () => {
    try {
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, provider);
      const tokenIds = await contract.getStakesByOwner(account);
      
      const stakesData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          try {
            const position = await contract.getPosition(tokenId);
            return {
              tokenId: tokenId.toString(),
              amount: ethers.formatEther(position.amount),
              startTime: Number(position.startTime),
              unlockTime: Number(position.unlockTime),
              pending: ethers.formatEther(position.pending),
              isActive: position.isActive,
              timeRemaining: Number(position.timeRemaining),
            };
          } catch (err) {
            console.error(`Error loading stake ${tokenId}:`, err);
            return null;
          }
        })
      );
      setUserStakes(stakesData.filter((s) => s && s.isActive));
    } catch (error) {
      console.error('Error loading stakes:', error);
      setUserStakes([]);
    }
  };

  const loadContractStats = async () => {
    try {
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, provider);
      const stats = await contract.getStats();
      setContractStats({
        totalStaked: ethers.formatEther(stats[0]),
        totalNFTs: stats[1].toString(),
        totalRewardsPaid: ethers.formatEther(stats[2]),
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const checkApproval = async () => {
    try {
      const lpContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.LP_TOKEN, ERC20_ABI, provider);
      const allowance = await lpContract.allowance(account, WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS);
      setIsApproved(allowance > ethers.parseEther(WHITE_DIAMOND_CONFIG.MIN_STAKE));
    } catch (error) {
      console.error('Error checking approval:', error);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const lpContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.LP_TOKEN, ERC20_ABI, signer);
      const tx = await lpContract.approve(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, ethers.MaxUint256);
      await tx.wait();
      setIsApproved(true);
      alert('✅ LP tokens approved successfully!');
    } catch (error) {
      console.error('Approval error:', error);
      alert('❌ Approval failed: ' + (error.reason || error.message));
    }
    setLoading(false);
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) < parseFloat(WHITE_DIAMOND_CONFIG.MIN_STAKE)) {
      alert(`Minimum stake is ${WHITE_DIAMOND_CONFIG.MIN_STAKE} LP tokens`);
      return;
    }

    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const amount = ethers.parseEther(stakeAmount);
      const tx = await contract.stake(amount);
      await tx.wait();
      alert('✅ Stake successful! NFT minted to your wallet.');
      setStakeAmount('');
      await loadData();
    } catch (error) {
      console.error('Stake error:', error);
      alert('❌ Stake failed: ' + (error.reason || error.message));
    }
    setLoading(false);
  };

  const handleClaim = async (tokenId) => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.claimRewards(tokenId);
      await tx.wait();
      alert('✅ Rewards claimed successfully!');
      await loadData();
    } catch (error) {
      console.error('Claim error:', error);
      alert('❌ Claim failed: ' + (error.reason || error.message));
    }
    setLoading(false);
  };

  const handleWithdraw = async (tokenId) => {
    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.withdraw(tokenId);
      await tx.wait();
      alert('✅ Withdrawn successfully! NFT burned.');
      await loadData();
    } catch (error) {
      console.error('Withdraw error:', error);
      alert('❌ Withdraw failed: ' + (error.reason || error.message));
    }
    setLoading(false);
  };

  const handleEmergencyWithdraw = async (tokenId) => {
    if (!window.confirm(`⚠️ Emergency withdraw will forfeit ${WHITE_DIAMOND_CONFIG.EARLY_EXIT_PENALTY}% of rewards + exit fees. Continue?`)) {
      return;
    }

    setLoading(true);
    try {
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.emergencyWithdraw(tokenId);
      await tx.wait();
      alert('✅ Emergency withdrawal complete.');
      await loadData();
    } catch (error) {
      console.error('Emergency withdraw error:', error);
      alert('❌ Emergency withdraw failed: ' + (error.reason || error.message));
    }
    setLoading(false);
  };

  const formatTime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}d ${hours}h`;
  };

  const formatNumber = (num) => {
    const n = parseFloat(num);
    if (isNaN(n)) return '0.00';
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
    return n.toFixed(2);
  };

  const bgColor = isDark ? '#1E1E1E' : '#F0EDE9';
  const cardBg = isDark ? '#2A2A2A' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : '#2A2520';
  const textSecondary = isDark ? '#B0B0B0' : '#5A5550';
  const borderColor = isDark ? '#444' : '#D0C8C0';

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', color: textPrimary }}>
      {/* Header Stats */}
      <div style={{
        background: `linear-gradient(135deg, ${isDark ? '#2A2A2A' : '#FFFFFF'}, ${isDark ? '#1E1E1E' : '#F5F3F0'})`,
        borderRadius: '20px',
        padding: '30px',
        marginBottom: '30px',
        border: `2px solid ${isDark ? '#D4AF37' : '#C4A030'}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: 0.05 }}>💎</div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
            <h2 style={{ 
              color: '#D4AF37', 
              fontSize: '2rem', 
              fontFamily: 'Cinzel, serif', 
              fontWeight: 800,
              margin: 0,
              letterSpacing: '2px',
            }}>
              💎 WHITE DIAMOND
            </h2>
            <button
              onClick={() => setShowDiamondPaper(true)}
              style={{
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                color: '#000',
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(255,215,0,0.3)',
              }}
            >
              ⭐ NFT
            </button>
          </div>
          <p style={{ color: textSecondary, fontSize: '0.9rem', marginBottom: '20px', fontWeight: 500 }}>
            URMOM/DTGC LP Staking | {WHITE_DIAMOND_CONFIG.APR}% APR | {WHITE_DIAMOND_CONFIG.LOCK_DAYS}-Day Lock | NFT-Based Ownership
          </p>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px' }}>
            {[
              { label: 'Total Staked', value: formatNumber(contractStats.totalStaked) + ' LP', icon: '💰' },
              { label: 'Total NFTs', value: contractStats.totalNFTs, icon: '⚔️' },
              { label: 'APR', value: WHITE_DIAMOND_CONFIG.APR + '%', icon: '📈' },
              { label: 'Lock Period', value: WHITE_DIAMOND_CONFIG.LOCK_DAYS + ' Days', icon: '🔒' },
              { label: 'Total Rewards', value: formatNumber(contractStats.totalRewardsPaid) + ' DTGC', icon: '🎁' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.05)',
                padding: '15px',
                borderRadius: '12px',
                border: `1px solid ${isDark ? 'rgba(212,175,55,0.3)' : 'rgba(212,175,55,0.2)'}`,
              }}>
                <div style={{ fontSize: '0.7rem', color: textSecondary, textTransform: 'uppercase', marginBottom: '5px', letterSpacing: '1px' }}>
                  {stat.icon} {stat.label}
                </div>
                <div style={{ color: '#D4AF37', fontSize: '1.5rem', fontWeight: 700 }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Staking Section */}
      <div style={{
        background: cardBg,
        borderRadius: '20px',
        padding: '30px',
        marginBottom: '30px',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}>
        <h3 style={{ color: '#D4AF37', fontSize: '1.5rem', marginBottom: '20px', fontFamily: 'Cinzel, serif', fontWeight: 700 }}>
          Create New Stake
        </h3>

        {/* Balances */}
        <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: textSecondary }}>URMOM/DTGC LP Balance:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: textPrimary }}>{formatNumber(lpBalance)} LP</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: textSecondary }}>DTGC Balance:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: textPrimary }}>{formatNumber(dtgcBalance)} DTGC</span>
          </div>
        </div>

        {/* Input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: textSecondary, marginBottom: '8px', fontWeight: 600 }}>
            Stake Amount (Min: {WHITE_DIAMOND_CONFIG.MIN_STAKE} LP)
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              placeholder="0.00"
              disabled={loading}
              style={{
                flex: 1,
                padding: '15px',
                fontSize: '1.1rem',
                borderRadius: '12px',
                border: `2px solid ${borderColor}`,
                background: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
                color: textPrimary,
                outline: 'none',
              }}
            />
            <button
              onClick={() => setStakeAmount(lpBalance)}
              disabled={loading}
              style={{
                padding: '15px 20px',
                background: 'rgba(212,175,55,0.2)',
                border: '2px solid #D4AF37',
                borderRadius: '12px',
                color: '#D4AF37',
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
              }}
            >
              MAX
            </button>
          </div>
        </div>

        {/* Action Button */}
        {!isApproved ? (
          <button
            onClick={handleApprove}
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #4CAF50, #8BC34A)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
              boxShadow: '0 4px 15px rgba(76,175,80,0.3)',
            }}
          >
            {loading ? '⏳ Approving...' : '🔓 Approve LP Tokens'}
          </button>
        ) : (
          <button
            onClick={handleStake}
            disabled={loading || !stakeAmount || parseFloat(stakeAmount) < parseFloat(WHITE_DIAMOND_CONFIG.MIN_STAKE)}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: (loading || !stakeAmount || parseFloat(stakeAmount) < parseFloat(WHITE_DIAMOND_CONFIG.MIN_STAKE)) ? 'not-allowed' : 'pointer',
              opacity: (loading || !stakeAmount || parseFloat(stakeAmount) < parseFloat(WHITE_DIAMOND_CONFIG.MIN_STAKE)) ? 0.5 : 1,
              boxShadow: '0 4px 15px rgba(255,215,0,0.4)',
            }}
          >
            {loading ? '⏳ Staking...' : '💎 Stake & Mint NFT'}
          </button>
        )}

        {/* Info Box */}
        <div style={{
          marginTop: '20px',
          padding: '16px',
          background: isDark ? 'rgba(33,150,243,0.1)' : 'rgba(33,150,243,0.05)',
          border: `1px solid ${isDark ? 'rgba(33,150,243,0.3)' : 'rgba(33,150,243,0.2)'}`,
          borderRadius: '12px',
        }}>
          <div style={{ color: '#2196F3', fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem' }}>
            ℹ️ How It Works
          </div>
          <ul style={{ fontSize: '0.8rem', color: textSecondary, lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
            <li>Each stake creates a unique transferable NFT</li>
            <li>Entry Fee: {WHITE_DIAMOND_CONFIG.ENTRY_FEE}% (collected in LP)</li>
            <li>Exit Fee: {WHITE_DIAMOND_CONFIG.EXIT_FEE}% (collected in LP)</li>
            <li>Early Exit Penalty: {WHITE_DIAMOND_CONFIG.EARLY_EXIT_PENALTY}% of rewards forfeited</li>
            <li>Rewards accrue per-second at {WHITE_DIAMOND_CONFIG.APR}% APR</li>
            <li>NFTs can be traded or transferred to other wallets</li>
          </ul>
        </div>
      </div>

      {/* Your Stakes */}
      <div style={{
        background: cardBg,
        borderRadius: '20px',
        padding: '30px',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      }}>
        <h3 style={{ color: '#D4AF37', fontSize: '1.5rem', marginBottom: '20px', fontFamily: 'Cinzel, serif', fontWeight: 700 }}>
          Your Stakes ({userStakes.length})
        </h3>

        {userStakes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: textSecondary }}>
            <div style={{ fontSize: '4rem', marginBottom: '20px', opacity: 0.3 }}>💎</div>
            <p style={{ fontSize: '1rem' }}>No active stakes yet. Create your first White Diamond NFT stake above!</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {userStakes.map((stake) => {
              const isUnlocked = stake.timeRemaining === 0;
              return (
                <div key={stake.tokenId} style={{
                  background: `linear-gradient(135deg, ${isDark ? '#2A2A2A' : '#FFFFFF'}, ${isDark ? '#1E1E1E' : '#F8F7F5'})`,
                  border: `2px solid #D4AF37`,
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 4px 20px rgba(212,175,55,0.2)',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 0 8px #FFD700)' }}>⚔️</span>
                      <span style={{ color: '#D4AF37', fontSize: '1.1rem', fontWeight: 700 }}>NFT #{stake.tokenId}</span>
                    </div>
                    <span style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: isUnlocked ? 'rgba(33,150,243,0.2)' : 'rgba(255,152,0,0.2)',
                      color: isUnlocked ? '#2196F3' : '#FF9800',
                      border: `1px solid ${isUnlocked ? '#2196F3' : '#FF9800'}`,
                    }}>
                      {isUnlocked ? 'Unlocked' : 'Locked'}
                    </span>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {[
                      { label: 'Staked Amount', value: formatNumber(stake.amount) + ' LP' },
                      { label: 'Pending Rewards', value: formatNumber(stake.pending) + ' DTGC', highlight: true },
                      { label: 'Time Remaining', value: isUnlocked ? 'Ready!' : formatTime(stake.timeRemaining) },
                      { label: 'Unlock Date', value: new Date(stake.unlockTime * 1000).toLocaleDateString() },
                    ].map((detail, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px',
                        borderBottom: i < 3 ? `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` : 'none',
                      }}>
                        <span style={{ fontSize: '0.85rem', color: textSecondary }}>{detail.label}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: detail.highlight ? '#D4AF37' : textPrimary }}>
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleClaim(stake.tokenId)}
                      disabled={loading || parseFloat(stake.pending) === 0}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(212,175,55,0.15)',
                        border: '1px solid #D4AF37',
                        borderRadius: '8px',
                        color: '#D4AF37',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: (loading || parseFloat(stake.pending) === 0) ? 'not-allowed' : 'pointer',
                        opacity: (loading || parseFloat(stake.pending) === 0) ? 0.3 : 1,
                      }}
                    >
                      Claim
                    </button>
                    <button
                      onClick={() => handleWithdraw(stake.tokenId)}
                      disabled={loading || !isUnlocked}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(76,175,80,0.15)',
                        border: '1px solid #4CAF50',
                        borderRadius: '8px',
                        color: '#4CAF50',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: (loading || !isUnlocked) ? 'not-allowed' : 'pointer',
                        opacity: (loading || !isUnlocked) ? 0.3 : 1,
                      }}
                    >
                      Withdraw
                    </button>
                    <button
                      onClick={() => handleEmergencyWithdraw(stake.tokenId)}
                      disabled={loading || isUnlocked}
                      style={{
                        flex: 1,
                        padding: '10px',
                        background: 'rgba(244,67,54,0.15)',
                        border: '1px solid #f44336',
                        borderRadius: '8px',
                        color: '#f44336',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: (loading || isUnlocked) ? 'not-allowed' : 'pointer',
                        opacity: (loading || isUnlocked) ? 0.3 : 1,
                      }}
                    >
                      Emergency
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diamond Paper Modal */}
      {showDiamondPaper && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
        }} onClick={() => setShowDiamondPaper(false)}>
          <div style={{
            background: cardBg,
            border: `2px solid #D4AF37`,
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflowY: 'auto',
            position: 'relative',
          }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowDiamondPaper(false)}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                color: textSecondary,
                fontSize: '1.5rem',
                cursor: 'pointer',
                width: '30px',
                height: '30px',
              }}
            >
              ×
            </button>
            <h2 style={{ color: '#D4AF37', marginBottom: '20px', fontFamily: 'Cinzel, serif' }}>
              💎 About White Diamond NFT Stakes
            </h2>
            <div style={{ color: textSecondary, lineHeight: '1.8', fontSize: '0.95rem' }}>
              <p>White Diamond implements a revolutionary NFT-based staking system where each stake position is represented as a unique ERC-721 token.</p>
              <h3 style={{ color: '#D4AF37', marginTop: '20px', fontSize: '1.1rem' }}>Key Features:</h3>
              <ul style={{ paddingLeft: '20px' }}>
                <li>Each stake = Unique transferable NFT</li>
                <li>NFTs can be sold on secondary markets</li>
                <li>Transfer ownership between wallets</li>
                <li>Use as collateral in DeFi lending</li>
                <li>Rewards transfer with NFT ownership</li>
              </ul>
              <h3 style={{ color: '#D4AF37', marginTop: '20px', fontSize: '1.1rem' }}>Economics:</h3>
              <ul style={{ paddingLeft: '20px' }}>
                <li>{WHITE_DIAMOND_CONFIG.APR}% APR on URMOM/DTGC LP tokens</li>
                <li>{WHITE_DIAMOND_CONFIG.LOCK_DAYS}-day lock period with {WHITE_DIAMOND_CONFIG.ENTRY_FEE}% entry/{WHITE_DIAMOND_CONFIG.EXIT_FEE}% exit fees</li>
                <li>Non-inflationary: rewards from pre-funded treasury</li>
                <li>Early exit penalty: {WHITE_DIAMOND_CONFIG.EARLY_EXIT_PENALTY}% of accrued rewards</li>
              </ul>
              <p style={{ marginTop: '20px' }}>
                <a href="/docs/White_Diamond_Paper.md" target="_blank" style={{ color: '#D4AF37', textDecoration: 'underline' }}>
                  📄 Read Full Diamond Paper
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhiteDiamondStaking;
