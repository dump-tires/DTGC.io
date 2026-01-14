import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import WhiteDiamondNFTActions from './WhiteDiamondNFTActions';

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
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
];

// ✅ FIXED: Added onClose to props destructuring
const WhiteDiamondStaking = ({ provider, signer, userAddress, livePrices, onStakesUpdate, onClose }) => {
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
      
      // Get total NFTs minted from contract
      const totalSupply = await contract.totalSupply();
      const totalMinted = Number(totalSupply);
      console.log('📋 Total NFTs minted:', totalMinted);
      
      // Contract enumeration is broken, so check each token ID directly
      const stakes = [];
      
      // Check token IDs 0 through totalMinted
      for (let tokenId = 0; tokenId <= Math.max(totalMinted, 10); tokenId++) {
        try {
          // Check if user owns this token
          const owner = await contract.ownerOf(tokenId);
          
          if (owner.toLowerCase() === userAddress.toLowerCase()) {
            console.log(`✅ User owns NFT #${tokenId}`);
            
            // Get position data
            const position = await contract.getPosition(tokenId);
            const amountFormatted = ethers.formatEther(position[0]);
            
            console.log(`   Amount: ${amountFormatted} LP`);
            console.log(`   Active: ${position[5]}`);
            
            if (position[5] && Number(position[0]) > 0) {
              stakes.push({
                tokenId: tokenId.toString(),
                amount: ethers.formatEther(position[0]),
                startTime: Number(position[1]) * 1000,
                unlockTime: Number(position[2]) * 1000,
                rewards: ethers.formatEther(position[4]),
                active: position[5],
              });
              console.log(`✅ NFT #${tokenId}: ${amountFormatted} LP - ACTIVE`);
            }
          }
        } catch (err) {
          // Token doesn't exist or user doesn't own it - skip
          if (!err.message.includes('ERC721: invalid token ID') && 
              !err.message.includes('owner query for nonexistent token')) {
            console.error(`Error checking token #${tokenId}:`, err.message);
          }
        }
      }
      
      console.log(`✅ Found ${stakes.length} active NFTs`);
      setUserStakes(stakes);
      if (onStakesUpdate) onStakesUpdate(stakes);
    } catch (error) {
      console.error('❌ Error loading stakes:', error.message);
      setUserStakes([]);
      if (onStakesUpdate) onStakesUpdate([]);
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

  const handleClaimRewards = async (tokenId) => {
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

  const handleEmergencyWithdraw = async (tokenId) => {
    if (!window.confirm('⚠️ Emergency withdraw incurs a 20% penalty. Continue?')) return;
    
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

  const handleTransferNFT = async (tokenId, recipient) => {
    if (!recipient || !ethers.isAddress(recipient)) {
      alert('Invalid recipient address');
      return;
    }
    if (!window.confirm(`Transfer NFT #${tokenId} to ${recipient}?\n\n⚠️ This will transfer your staked position.`)) return;
    
    setLoading(true);
    try {
      if (!signer) {
        alert('Please connect wallet');
        setLoading(false);
        return;
      }
      const contract = new ethers.Contract(
        WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS,
        ['function transferFrom(address from, address to, uint256 tokenId) external'],
        signer
      );
      const tx = await contract.transferFrom(userAddress, recipient, tokenId);
      await tx.wait();
      alert(`✅ NFT #${tokenId} transferred successfully!`);
      await loadData();
    } catch (error) {
      console.error('❌ Transfer error:', error);
      alert('❌ Transfer failed: ' + error.message);
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

  // Calculate USD value for LP and DTGC tokens
  const calculateUsdValue = (amount, tokenType) => {
    if (!livePrices) {
      console.log('⚠️ livePrices not available yet');
      return 0;
    }
    
    console.log('💰 Calculating USD value:', { amount, tokenType, dtgcPrice: livePrices.dtgc });
    
    if (tokenType === 'LP') {
      // LP tokens are URMOM/DTGC pair - estimate based on DTGC price
      const dtgcPrice = livePrices.dtgc || 0;
      // Each LP token represents roughly 2x DTGC value (simplified)
      return parseFloat(amount) * dtgcPrice * 2;
    } else if (tokenType === 'DTGC') {
      const dtgcPrice = livePrices.dtgc || 0;
      return parseFloat(amount) * dtgcPrice;
    }
    return 0;
  };

  const formatUsd = (value) => {
    if (!livePrices) return '...'; // Loading state
    if (value === 0) return '$0.00';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
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

  // ═══════════════════════════════════════════════════════════════
  // ✅ NEW: Connect Wallet UI - Shows when wallet not connected
  // This is the ONLY addition to the original component
  // ═══════════════════════════════════════════════════════════════
  if (!provider || !userAddress) {
    return (
      <div style={{ 
        fontFamily: 'Montserrat, sans-serif', 
        color: theme.text, 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '40px 20px',
        minHeight: '60vh',
      }}>
        {/* Header - Same style as main component */}
        <div style={{
          background: theme.gradient,
          borderRadius: '20px',
          padding: '60px 20px',
          marginBottom: '30px',
          border: `1px solid ${theme.border}`,
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '15rem',
            opacity: 0.03,
          }}>💎</div>
          
          <div style={{ position: 'relative', zIndex: 1 }}>
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
            
            <p style={{ 
              color: theme.textMuted, 
              fontSize: '1.1rem',
              marginBottom: '30px'
            }}>
              Transferable NFT Staking Positions
            </p>
            
            {/* Connect Wallet Card */}
            <div style={{
              background: isDark 
                ? 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(212,175,55,0.1) 100%)'
                : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(212,175,55,0.15) 100%)',
              border: '2px dashed #D4AF37',
              borderRadius: '20px',
              padding: '40px',
              maxWidth: '500px',
              margin: '0 auto',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔗</div>
              
              <p style={{ 
                color: '#D4AF37', 
                fontSize: '1.3rem',
                fontWeight: 700,
                marginBottom: '12px'
              }}>
                Connect Your Wallet
              </p>
              
              <p style={{ 
                color: theme.textMuted, 
                fontSize: '0.95rem',
                lineHeight: '1.6',
                marginBottom: '24px'
              }}>
                Stake DTGC/URMOM LP tokens to mint transferable NFT positions
              </p>
              
              {/* Features Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                textAlign: 'left',
                marginBottom: '20px'
              }}>
                <div style={{ 
                  background: 'rgba(212,175,55,0.15)', 
                  padding: '12px 16px', 
                  borderRadius: '10px',
                  border: '1px solid rgba(212,175,55,0.3)'
                }}>
                  <div style={{ color: '#4CAF50', fontWeight: 800, fontSize: '1.2rem' }}>70%</div>
                  <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>APR</div>
                </div>
                <div style={{ 
                  background: 'rgba(212,175,55,0.15)', 
                  padding: '12px 16px', 
                  borderRadius: '10px',
                  border: '1px solid rgba(212,175,55,0.3)'
                }}>
                  <div style={{ color: theme.gold, fontWeight: 800, fontSize: '1.2rem' }}>90</div>
                  <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>Days Lock</div>
                </div>
                <div style={{ 
                  background: 'rgba(212,175,55,0.15)', 
                  padding: '12px 16px', 
                  borderRadius: '10px',
                  border: '1px solid rgba(212,175,55,0.3)'
                }}>
                  <div style={{ color: theme.gold, fontWeight: 800, fontSize: '1.2rem' }}>NFT</div>
                  <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>Position</div>
                </div>
                <div style={{ 
                  background: 'rgba(212,175,55,0.15)', 
                  padding: '12px 16px', 
                  borderRadius: '10px',
                  border: '1px solid rgba(212,175,55,0.3)'
                }}>
                  <div style={{ color: theme.gold, fontWeight: 800, fontSize: '1.2rem' }}>✓</div>
                  <div style={{ color: theme.textMuted, fontSize: '0.75rem' }}>Transferable</div>
                </div>
              </div>
              
              {/* Contract Link */}
              <a 
                href={`https://scan.pulsechain.com/address/${WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 
                  color: theme.textMuted,
                  fontSize: '0.75rem',
                  textDecoration: 'none'
                }}
              >
                Contract: {WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS.slice(0,6)}...{WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS.slice(-4)} ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ═══════════════════════════════════════════════════════════════
  // END OF NEW CODE - Everything below is your original component
  // ═══════════════════════════════════════════════════════════════

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
          </div>
        </div>
      </div>

      {/* Diamond Paper Modal */}
      {showDiamondPaper && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
        }} onClick={() => setShowDiamondPaper(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: theme.cardBg,
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: `2px solid ${theme.border}`,
          }}>
            <h2 style={{ color: theme.gold, marginBottom: '20px', textAlign: 'center' }}>💎 White Diamond NFT System</h2>
            
            <div style={{ color: theme.text, lineHeight: '1.8' }}>
              <h3 style={{ color: theme.gold }}>How It Works:</h3>
              <ol style={{ paddingLeft: '20px' }}>
                <li>Stake DTGC/URMOM LP tokens</li>
                <li>Receive an NFT representing your position</li>
                <li>Earn 70% APR rewards in DTGC</li>
                <li>After 90 days, withdraw or keep earning</li>
                <li>NFT is transferable - sell your position!</li>
              </ol>
              
              <h3 style={{ color: theme.gold, marginTop: '20px' }}>Key Features:</h3>
              <ul style={{ paddingLeft: '20px' }}>
                <li>✅ Transferable staking positions</li>
                <li>✅ 70% APR rewards</li>
                <li>✅ 90 day lock period</li>
                <li>✅ Claim rewards anytime</li>
                <li>✅ Emergency exit with 20% penalty</li>
              </ul>
              
              <h3 style={{ color: theme.gold, marginTop: '20px' }}>Contract:</h3>
              <a 
                href={`https://scan.pulsechain.com/address/${WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: theme.gold, wordBreak: 'break-all' }}
              >
                {WHITE_DIAMOND_CONFIG.CONTRACT_ADDRESS}
              </a>
            </div>
            
            <button
              onClick={() => setShowDiamondPaper(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                background: theme.gold,
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Wrap Guide Modal */}
      {showWrapGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px',
        }} onClick={() => setShowWrapGuide(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: theme.cardBg,
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            border: `2px solid ${theme.border}`,
          }}>
            <h2 style={{ color: theme.gold, marginBottom: '20px', textAlign: 'center' }}>🔄 How to Get LP Tokens</h2>
            
            <div style={{ color: theme.text, lineHeight: '1.8' }}>
              <h3 style={{ color: theme.gold }}>Step 1: Go to PulseX</h3>
              <p>Visit <a href="https://pulsex.com" target="_blank" rel="noopener noreferrer" style={{ color: theme.gold }}>pulsex.com</a></p>
              
              <h3 style={{ color: theme.gold, marginTop: '20px' }}>Step 2: Add Liquidity</h3>
              <p>Click "Liquidity" → "Add Liquidity"</p>
              <p>Select DTGC and URMOM tokens</p>
              <p>Enter equal USD value of each token</p>
              
              <h3 style={{ color: theme.gold, marginTop: '20px' }}>Step 3: Receive LP</h3>
              <p>Confirm the transaction</p>
              <p>You'll receive DTGC/URMOM LP tokens</p>
              
              <h3 style={{ color: theme.gold, marginTop: '20px' }}>Step 4: Stake Here</h3>
              <p>Come back and stake your LP tokens!</p>
              
              <div style={{
                background: 'rgba(212,175,55,0.1)',
                padding: '15px',
                borderRadius: '10px',
                marginTop: '20px',
                border: `1px solid ${theme.border}`,
              }}>
                <strong style={{ color: theme.gold }}>💡 Tip:</strong>
                <p style={{ marginTop: '5px' }}>LP Token Address:</p>
                <code style={{ 
                  fontSize: '0.75rem', 
                  wordBreak: 'break-all',
                  color: theme.textMuted 
                }}>
                  {WHITE_DIAMOND_CONFIG.LP_TOKEN}
                </code>
              </div>
            </div>
            
            <button
              onClick={() => setShowWrapGuide(false)}
              style={{
                marginTop: '20px',
                width: '100%',
                padding: '12px',
                background: theme.gold,
                border: 'none',
                borderRadius: '10px',
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '20px',
      }}>
        
        {/* Stake Panel */}
        <div style={{
          background: theme.cardBg,
          borderRadius: '20px',
          padding: '25px',
          border: `1px solid ${theme.border}`,
        }}>
          <h2 style={{ color: theme.gold, marginBottom: '20px' }}>⚔️ Stake LP → Mint NFT</h2>
          
          {/* Balances */}
          <div style={{
            background: theme.gradient,
            borderRadius: '12px',
            padding: '15px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: theme.textMuted }}>Your LP Balance:</span>
              <span style={{ color: theme.gold, fontWeight: 700 }}>{formatNumber(lpBalance)} LP</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: theme.textMuted }}>Your DTGC Balance:</span>
              <span style={{ color: theme.gold, fontWeight: 700 }}>{formatNumber(dtgcBalance)} DTGC</span>
            </div>
          </div>
          
          {/* Need LP? */}
          <button
            onClick={() => setShowWrapGuide(true)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'transparent',
              border: `1px dashed ${theme.border}`,
              borderRadius: '10px',
              color: theme.gold,
              fontSize: '0.85rem',
              cursor: 'pointer',
              marginBottom: '15px',
            }}
          >
            🔄 Need LP tokens? Click here for guide
          </button>
          
          {/* Stake Input */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ color: theme.textMuted, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
              Amount to Stake (Min: {WHITE_DIAMOND_CONFIG.MIN_STAKE} LP)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                placeholder="0.0"
                style={{
                  width: '100%',
                  padding: '15px',
                  paddingRight: '80px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bg,
                  color: theme.text,
                  fontSize: '1.1rem',
                }}
              />
              <button
                onClick={() => setStakeAmount(lpBalance)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '8px 12px',
                  background: theme.gold,
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                MAX
              </button>
            </div>
            {usdValue > 0 && (
              <div style={{ color: theme.textMuted, fontSize: '0.85rem', marginTop: '5px' }}>
                ≈ ${usdValue.toFixed(2)} USD
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          {!isApproved ? (
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                width: '100%',
                padding: '15px',
                background: loading ? '#666' : 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#000',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⏳ Approving...' : '✅ Approve LP Token'}
            </button>
          ) : (
            <button
              onClick={handleStake}
              disabled={loading || !stakeAmount}
              style={{
                width: '100%',
                padding: '15px',
                background: loading || !stakeAmount ? '#666' : 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#000',
                fontWeight: 700,
                fontSize: '1rem',
                cursor: loading || !stakeAmount ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '⏳ Staking...' : '💎 Stake & Mint NFT'}
            </button>
          )}
        </div>

        {/* Your NFTs Panel */}
        <div style={{
          background: theme.cardBg,
          borderRadius: '20px',
          padding: '20px',
          border: `1px solid ${theme.border}`,
        }}>
          <h2 style={{ color: theme.gold, marginBottom: '15px', fontSize: '1.1rem' }}>🎴 Your White Diamond NFTs ({userStakes.length})</h2>
          
          {userStakes.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '30px 15px',
              color: theme.textMuted,
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '10px', opacity: 0.3 }}>💎</div>
              <p>No NFTs yet. Stake LP to mint your first!</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '12px',
              maxHeight: '500px',
              overflowY: 'auto',
            }}>
            {userStakes.map((stake, index) => {
              const isUnlocked = Date.now() >= stake.unlockTime;
              const lpValueUsd = calculateUsdValue(stake.amount, 'LP');
              const rewardsValueUsd = calculateUsdValue(stake.rewards, 'DTGC');
              
              return (
                <div key={index} style={{
                  background: theme.gradient,
                  borderRadius: '12px',
                  padding: '12px',
                  border: `1px solid ${theme.border}`,
                }}>
                  {/* NFT Header - Compact */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.3rem' }}>⚔️</span>
                      <div>
                        <div style={{ color: theme.gold, fontWeight: 800, fontSize: '0.9rem' }}>NFT #{stake.tokenId}</div>
                      </div>
                    </div>
                    <div style={{
                      background: isUnlocked ? '#4CAF50' : '#FF9800',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '0.6rem',
                      fontWeight: 700,
                    }}>
                      {isUnlocked ? '🔓' : `🔒 ${formatTimeRemaining(stake.unlockTime)}`}
                    </div>
                  </div>
                  
                  {/* Stats - Compact */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    marginBottom: '10px',
                  }}>
                    <div>
                      <div style={{ color: theme.textMuted, fontSize: '0.6rem' }}>LP Staked</div>
                      <div style={{ color: theme.text, fontWeight: 700, fontSize: '0.85rem' }}>{formatNumber(stake.amount)}</div>
                      <div style={{ color: theme.textMuted, fontSize: '0.55rem' }}>{formatUsd(lpValueUsd)}</div>
                    </div>
                    <div>
                      <div style={{ color: theme.textMuted, fontSize: '0.6rem' }}>Rewards</div>
                      <div style={{ color: '#4CAF50', fontWeight: 700, fontSize: '0.85rem' }}>+{formatNumber(stake.rewards)}</div>
                      <div style={{ color: theme.textMuted, fontSize: '0.55rem' }}>{formatUsd(rewardsValueUsd)}</div>
                    </div>
                  </div>
                  
                  {/* Actions - Compact row */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                    <button
                      onClick={() => handleClaimRewards(stake.tokenId)}
                      disabled={loading || parseFloat(stake.rewards) === 0}
                      style={{
                        flex: 1,
                        padding: '6px',
                        background: loading || parseFloat(stake.rewards) === 0 ? '#444' : '#4CAF50',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        cursor: loading || parseFloat(stake.rewards) === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      💰 Claim
                    </button>
                    
                    {isUnlocked ? (
                      <button
                        onClick={() => handleWithdraw(stake.tokenId)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: loading ? '#444' : theme.gold,
                          border: 'none',
                          borderRadius: '6px',
                          color: '#000',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        📤 Withdraw
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEmergencyWithdraw(stake.tokenId)}
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: '6px',
                          background: loading ? '#444' : '#ff5252',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        ⚠️ Emergency
                      </button>
                    )}
                  </div>
                  
                  {/* Transfer Button - Compact */}
                  <button
                    onClick={() => {
                      const recipient = prompt('Enter recipient address for NFT #' + stake.tokenId);
                      if (recipient && recipient.startsWith('0x')) {
                        handleTransferNFT(stake.tokenId, recipient);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '6px',
                      background: 'transparent',
                      border: `1px solid ${theme.border}`,
                      borderRadius: '6px',
                      color: theme.gold,
                      fontWeight: 600,
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                    }}
                  >
                    📤 Transfer to Wallet
                  </button>
                </div>
              );
            })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhiteDiamondStaking;
