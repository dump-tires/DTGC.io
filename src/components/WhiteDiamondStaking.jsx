import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

// ACTUAL DEPLOYED CONTRACT - matches what's on-chain
const WHITE_DIAMOND_CONFIG = {
  CONTRACT_ADDRESS: '0x326F86e7d594B55B7BA08DFE5195b10b159033fD',
  LP_TOKEN: '0x670c972Bb5388E087a2934a063064d97278e01F3',
  REWARD_TOKEN: '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
  APR: 70,
  LOCK_DAYS: 90,
  MIN_STAKE: '1000',
};

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// CORRECT ABI - matches deployed contract
const WHITE_DIAMOND_ABI = [
  'function stake(uint256 amount) external returns (uint256)',
  'function withdraw(uint256 tokenId) external',
  'function claimRewards(uint256 tokenId) external',
  'function emergencyWithdraw(uint256 tokenId) external',
  'function getStakesByOwner(address owner) view returns (uint256[])',
  'function getPosition(uint256 tokenId) view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lastClaimTime, uint256 pending, bool isActive, uint256 timeRemaining)',
  'function getStats() view returns (uint256 totalStaked, uint256 totalSupply, uint256 totalRewardsPaid, uint256 apr, uint256 lockTime)',
  'function pendingRewards(uint256 tokenId) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

const WhiteDiamondStaking = ({ provider, signer, userAddress, livePrices }) => {
  const [isDark, setIsDark] = useState(true);
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
  const [showWrapGuide, setShowWrapGuide] = useState(false);

  // Auto-detect theme
  useEffect(() => {
    const checkTheme = () => {
      const isDarkMode = document.body.classList.contains('dark') || 
                        document.documentElement.classList.contains('dark') ||
                        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(isDarkMode);
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (provider && userAddress) {
      console.log('✅ White Diamond: Component loaded');
      console.log('📍 User:', userAddress);
      console.log('📍 Contract:', WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS);
      loadData();
      const interval = setInterval(loadData, 30000);
      return () => clearInterval(interval);
    }
  }, [provider, userAddress]);

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
      console.log('💰 Loading balances...');
      const lpContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.LP_TOKEN, ERC20_ABI, provider);
      const dtgcContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.REWARD_TOKEN, ERC20_ABI, provider);
      const [lpBal, dtgcBal] = await Promise.all([
        lpContract.balanceOf(userAddress),
        dtgcContract.balanceOf(userAddress),
      ]);
      console.log('✅ LP:', ethers.formatEther(lpBal));
      console.log('✅ DTGC:', ethers.formatEther(dtgcBal));
      setLpBalance(ethers.formatEther(lpBal));
      setDtgcBalance(ethers.formatEther(dtgcBal));
    } catch (error) {
      console.error('❌ Error loading balances:', error);
    }
  };

  const loadUserStakes = async () => {
    try {
      console.log('🔍 Loading NFTs...');
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, provider);
      const tokenIds = await contract.getStakesByOwner(userAddress);
      console.log('📋 NFT IDs:', tokenIds.map(id => id.toString()));
      
      if (tokenIds.length === 0) {
        console.log('ℹ️ No NFTs found');
        setUserStakes([]);
        return;
      }
      
      const stakes = [];
      for (const tokenId of tokenIds) {
        try {
          console.log(`📊 Loading NFT #${tokenId}...`);
          const position = await contract.getPosition(tokenId);
          // position returns: amount, startTime, unlockTime, lastClaimTime, pending, isActive, timeRemaining
          if (position[5]) { // isActive
            stakes.push({
              tokenId: tokenId.toString(),
              amount: ethers.formatEther(position[0]),
              startTime: Number(position[1]) * 1000,
              unlockTime: Number(position[2]) * 1000,
              rewards: ethers.formatEther(position[4]), // pending rewards
              active: position[5], // isActive
            });
            console.log(`✅ NFT #${tokenId}: ${ethers.formatEther(position[0])} LP`);
          }
        } catch (err) {
          console.error(`❌ Error loading NFT #${tokenId}:`, err);
        }
      }
      
      console.log(`✅ Found ${stakes.length} active NFTs`);
      setUserStakes(stakes);
    } catch (error) {
      console.error('❌ Error loading stakes:', error.message);
    }
  };

  const loadContractStats = async () => {
    try {
      console.log('📊 Loading contract stats...');
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, provider);
      const stats = await contract.getStats();
      // getStats returns: totalStaked, totalSupply, totalRewardsPaid, apr, lockTime
      console.log('✅ Stats loaded');
      setContractStats({
        totalStaked: ethers.formatEther(stats[0]),
        totalNFTs: stats[1].toString(),
        totalRewardsPaid: ethers.formatEther(stats[2]),
      });
    } catch (error) {
      console.error('❌ Error loading stats:', error);
    }
  };

  const checkApproval = async () => {
    try {
      const lpContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.LP_TOKEN, ERC20_ABI, provider);
      const allowance = await lpContract.allowance(userAddress, WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS);
      const approved = allowance > ethers.parseEther('1000000');
      setIsApproved(approved);
    } catch (error) {
      console.error('❌ Error checking approval:', error);
    }
  };

  const calculateLPValueUSD = () => {
    if (!stakeAmount || !livePrices || !livePrices.dtgc) return 0;
    const lpAmount = parseFloat(stakeAmount);
    const dtgcPrice = livePrices.dtgc || 0;
    return lpAmount * dtgcPrice * 2;
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      if (!signer) {
        alert('Please connect wallet');
        setLoading(false);
        return;
      }
      const lpContract = new ethers.Contract(WHITE_DIAMOND_CONFIG.LP_TOKEN, ERC20_ABI, signer);
      const tx = await lpContract.approve(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, ethers.MaxUint256);
      await tx.wait();
      setIsApproved(true);
      alert('✅ Approved!');
    } catch (error) {
      console.error('❌ Approval error:', error);
      alert('❌ Approval failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) < parseFloat(WHITE_DIAMOND_CONFIG.MIN_STAKE)) {
      alert(`Minimum stake is ${WHITE_DIAMOND_CONFIG.MIN_STAKE} LP`);
      return;
    }

    setLoading(true);
    try {
      if (!signer) {
        alert('Please connect wallet');
        setLoading(false);
        return;
      }
      
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const amount = ethers.parseEther(stakeAmount);
      
      console.log(`💎 Staking ${stakeAmount} LP...`);
      const tx = await contract.stake(amount);
      await tx.wait();
      
      alert(`✅ Staked ${stakeAmount} LP! NFT minted.`);
      setStakeAmount('');
      await loadData();
    } catch (error) {
      console.error('❌ Stake error:', error);
      alert('❌ Staking failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (tokenId) => {
    setLoading(true);
    try {
      if (!signer) {
        alert('Please connect wallet');
        setLoading(false);
        return;
      }
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.claimRewards(tokenId);
      await tx.wait();
      alert('✅ Rewards claimed!');
      await loadData();
    } catch (error) {
      console.error('❌ Claim error:', error);
      alert('❌ Claim failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (tokenId) => {
    setLoading(true);
    try {
      if (!signer) {
        alert('Please connect wallet');
        setLoading(false);
        return;
      }
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.withdraw(tokenId);
      await tx.wait();
      alert('✅ Withdrawn! NFT burned.');
      await loadData();
    } catch (error) {
      console.error('❌ Withdraw error:', error);
      alert('❌ Withdraw failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyWithdraw = async (tokenId) => {
    if (!window.confirm(`⚠️ Emergency withdraw = 20% penalty. Continue?`)) return;

    setLoading(true);
    try {
      if (!signer) {
        alert('Please connect wallet');
        setLoading(false);
        return;
      }
      const contract = new ethers.Contract(WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.emergencyWithdraw(tokenId);
      await tx.wait();
      alert('✅ Emergency withdrawal complete');
      await loadData();
    } catch (error) {
      console.error('❌ Emergency error:', error);
      alert('❌ Emergency failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    const n = parseFloat(num);
    if (isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(2);
  };

  const formatTimeRemaining = (unlockTime) => {
    const now = Date.now();
    if (unlockTime <= now) return 'Unlocked';
    const diff = unlockTime - now;
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    return `${days}d ${hours}h`;
  };

  const theme = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    cardBg: isDark ? '#2a2a2a' : '#f5f5f5',
    text: isDark ? '#ffffff' : '#000000',
    textMuted: isDark ? '#888888' : '#666666',
    border: '#D4AF37',
    gold: '#D4AF37',
    gradient: isDark 
      ? 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(212,175,55,0.05) 100%)'
      : 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.1) 100%)',
  };

  const usdValue = calculateLPValueUSD();

  return (
    <div style={{ fontFamily: 'Montserrat, sans-serif', color: theme.text, maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* Header Stats */}
      <div style={{
        background: theme.gradient,
        borderRadius: '20px',
        padding: '40px 20px',
        marginBottom: '30px',
        border: `1px solid ${theme.border}`,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '15rem',
          opacity: 0.03,
        }}>💎</div>
        
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h1 style={{
            fontFamily: 'Cinzel, serif',
            fontSize: '2.5rem',
            color: theme.gold,
            marginBottom: '10px',
            letterSpacing: '3px',
            textShadow: '0 0 20px rgba(212,175,55,0.5)',
          }}>
            💎 WHITE DIAMOND
          </h1>
          
          <button
            onClick={() => setShowDiamondPaper(true)}
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
              border: 'none',
              borderRadius: '20px',
              padding: '8px 20px',
              color: '#000',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              marginBottom: '20px',
            }}
          >
            ⭐ NFT STAKING SYSTEM
          </button>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '20px',
            marginTop: '20px',
          }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: theme.gold }}>{formatNumber(contractStats.totalStaked)}</div>
              <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>Total LP Staked</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: theme.gold }}>{contractStats.totalNFTs}</div>
              <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>NFTs Minted</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: theme.gold }}>{WHITE_DIAMOND_CONFIG.APR}%</div>
              <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>APR</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: theme.gold }}>{WHITE_DIAMOND_CONFIG.LOCK_DAYS}</div>
              <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>Days Lock</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: theme.gold }}>{formatNumber(contractStats.totalRewardsPaid)}</div>
              <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>Rewards Paid</div>
            </div>
          </div>
        </div>
      </div>

      {/* Staking Interface */}
      <div style={{
        background: theme.cardBg,
        borderRadius: '20px',
        padding: '30px',
        border: `1px solid ${theme.border}`,
        marginBottom: '30px',
      }}>
        <h2 style={{ fontFamily: 'Cinzel, serif', color: theme.gold, marginBottom: '20px' }}>Stake LP & Mint NFT</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: theme.textMuted, marginBottom: '5px' }}>Your LP Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.gold }}>{formatNumber(lpBalance)} LP</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: theme.textMuted, marginBottom: '5px' }}>DTGC Balance</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.gold }}>{formatNumber(dtgcBalance)} DTGC</div>
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Amount to Stake</label>
            <button
              onClick={() => setStakeAmount(lpBalance)}
              style={{
                background: 'none',
                border: '1px solid ' + theme.gold,
                borderRadius: '10px',
                padding: '4px 12px',
                color: theme.gold,
                fontSize: '0.75rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              MAX
            </button>
          </div>
          <input
            type="number"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder={`Min: ${WHITE_DIAMOND_CONFIG.MIN_STAKE} LP`}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '12px',
              border: `2px solid ${theme.border}`,
              background: theme.bg,
              color: theme.text,
              fontSize: '1.1rem',
              fontWeight: 600,
            }}
          />
          {stakeAmount && usdValue > 0 && (
            <div style={{ fontSize: '0.85rem', color: '#4CAF50', marginTop: '8px', fontWeight: 600 }}>
              💵 LP Value: ~${usdValue.toFixed(2)} USD (estimate)
            </div>
          )}
        </div>

        <div style={{
          background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.2)',
          padding: '15px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          lineHeight: '1.6',
        }}>
          <strong style={{ color: theme.gold }}>ℹ️ How it works:</strong><br/>
          • Stake URMOM/DTGC LP tokens and receive an NFT<br/>
          • 70% APR, 90-day lock, 3.75% fees<br/>
          • 20% penalty on early withdrawal<br/>
          • NFTs are tradeable ERC721 tokens
        </div>

        {!isApproved ? (
          <button
            onClick={handleApprove}
            disabled={loading}
            style={{
              width: '100%',
              padding: '18px',
              background: 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontSize: '1.1rem',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Approving...' : '🔓 Approve LP Tokens'}
          </button>
        ) : (
          <button
            onClick={handleStake}
            disabled={loading || !stakeAmount}
            style={{
              width: '100%',
              padding: '18px',
              background: loading || !stakeAmount 
                ? 'linear-gradient(135deg, #666 0%, #888 100%)'
                : 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#000',
              fontSize: '1.1rem',
              fontWeight: 700,
              cursor: loading || !stakeAmount ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '⏳ Staking...' : '💎 Stake & Mint NFT'}
          </button>
        )}
      </div>

      {/* Your NFT Stakes */}
      <div>
        <h2 style={{ fontFamily: 'Cinzel, serif', color: theme.gold, marginBottom: '20px' }}>Your White Diamond NFTs</h2>
        
        {userStakes.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: theme.cardBg,
            borderRadius: '20px',
            border: `1px dashed ${theme.border}`,
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '10px', opacity: 0.3 }}>💎</div>
            <div style={{ fontSize: '1.1rem', color: theme.textMuted }}>No staked positions yet</div>
            <div style={{ fontSize: '0.85rem', color: theme.textMuted, marginTop: '5px' }}>Stake LP tokens to mint your first NFT</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {userStakes.map((stake) => {
              const isUnlocked = Date.now() >= stake.unlockTime;
              return (
                <div key={stake.tokenId} style={{
                  background: theme.cardBg,
                  borderRadius: '20px',
                  padding: '25px',
                  border: `2px solid ${theme.border}`,
                  boxShadow: '0 4px 20px rgba(212,175,55,0.2)',
                }}>
                  {/* NFT Card Header with Darth Vader Helmet */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '20px',
                  }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      background: 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '3rem',
                      boxShadow: '0 0 30px rgba(212,175,55,0.6)',
                    }}>
                      ⚔️
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        background: isUnlocked ? '#4CAF50' : '#FF9800',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        marginBottom: '5px',
                      }}>
                        {isUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
                      </div>
                      <div style={{
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        color: theme.gold,
                        fontFamily: 'Cinzel, serif',
                      }}>
                        NFT #{stake.tokenId}
                      </div>
                    </div>
                  </div>

                  {/* Stake Info */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      marginBottom: '12px',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>LP Staked</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: theme.gold }}>
                          {formatNumber(stake.amount)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>Pending Rewards</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#4CAF50' }}>
                          +{formatNumber(stake.rewards)}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>APR</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#4CAF50' }}>
                          70%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: theme.textMuted }}>Time Remaining</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: isUnlocked ? '#4CAF50' : '#FF9800' }}>
                          {formatTimeRemaining(stake.unlockTime)}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      marginTop: '12px',
                      fontSize: '0.7rem',
                      color: theme.textMuted,
                    }}>
                      📅 Unlocks: {new Date(stake.unlockTime).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleClaim(stake.tokenId)}
                      disabled={loading || parseFloat(stake.rewards) === 0}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: loading || parseFloat(stake.rewards) === 0
                          ? 'linear-gradient(135deg, #666 0%, #888 100%)'
                          : 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
                        border: 'none',
                        borderRadius: '10px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        cursor: loading || parseFloat(stake.rewards) === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      🎁 Claim
                    </button>
                    
                    {isUnlocked ? (
                      <button
                        onClick={() => handleWithdraw(stake.tokenId)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: loading
                            ? 'linear-gradient(135deg, #666 0%, #888 100%)'
                            : 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
                          border: 'none',
                          borderRadius: '10px',
                          color: '#000',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        💎 Withdraw
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEmergencyWithdraw(stake.tokenId)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '12px',
                          background: loading
                            ? 'linear-gradient(135deg, #666 0%, #888 100%)'
                            : 'linear-gradient(135deg, #F44336 0%, #E57373 100%)',
                          border: 'none',
                          borderRadius: '10px',
                          color: '#fff',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        🚨 Emergency
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WhiteDiamondStaking;
