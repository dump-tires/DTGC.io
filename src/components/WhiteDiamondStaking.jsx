/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💎 WHITE DIAMOND NFT STAKING COMPONENT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Full frontend for the WhiteDiamondNFT staking contract.
 * - Stake LP → Mint NFT
 * - View owned NFT positions
 * - Claim rewards
 * - Withdraw / Emergency withdraw
 * - Transfer stake (via NFT transfer)
 * 
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT CONFIG - UPDATE AFTER DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Contract addresses - LIVE ON PULSECHAIN
  WHITE_DIAMOND_NFT: '0x4424922Ee372268de9615b6e38E20cFD5e4b9D2D',
  LP_TOKEN: '0x0b0a8a0b7546ff180328aa155d2405882c7ac8c7', // DTGC/PLS LP
  REWARD_TOKEN: '0xD0676B28a457371D58d47E5247b439114e40Eb0F', // DTGC
  
  // Contract constants
  APR: 70,
  LOCK_DAYS: 90,
  ENTRY_FEE: 3.75,
  EXIT_FEE: 3.75,
  EARLY_PENALTY: 20,
  MIN_STAKE: 1000,
  
  // External links
  OPENSEA_BASE: 'https://opensea.io/assets/pulsechain/',
  EXPLORER: 'https://scan.pulsechain.com',
  
  // Documentation & Contract Links
  NFT_PAPER_URL: 'https://dtgc.io/docs/white-diamond-nft',
  CONTRACT_URL: 'https://scan.pulsechain.com/address/', // + contract address
  GITHUB_URL: 'https://github.com/dtgc-io/contracts',
};

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ABIs
// ═══════════════════════════════════════════════════════════════════════════

const WHITE_DIAMOND_ABI = [
  // Read functions
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getPosition(uint256 tokenId) view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lastClaimTime, uint256 pending, bool isActive, uint256 timeRemaining)',
  'function getStakesByOwner(address owner) view returns (uint256[])',
  'function getStats() view returns (uint256 totalStaked, uint256 totalStakers, uint256 totalRewardsPaid, uint256 apr, uint256 lockPeriod)',
  'function pendingRewards(uint256 tokenId) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  
  // Write functions
  'function stake(uint256 amount) returns (uint256 tokenId)',
  'function claimRewards(uint256 tokenId)',
  'function withdraw(uint256 tokenId)',
  'function emergencyWithdraw(uint256 tokenId)',
  'function transferFrom(address from, address to, uint256 tokenId)',
  'function approve(address to, uint256 tokenId)',
  'function setApprovalForAll(address operator, bool approved)',
  
  // Events
  'event Staked(address indexed user, uint256 indexed tokenId, uint256 amount, uint256 unlockTime)',
  'event RewardsClaimed(address indexed user, uint256 indexed tokenId, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 indexed tokenId, uint256 principal, uint256 rewards)',
  'event EmergencyWithdrawn(address indexed user, uint256 indexed tokenId, uint256 amountAfterPenalty)',
  'event StakeTransferred(uint256 indexed tokenId, address indexed from, address indexed to)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8E8 50%, #B8B8B8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '10px',
  },
  subtitle: {
    color: '#888',
    fontSize: '1rem',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px',
    marginBottom: '30px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#FFF',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#888',
    marginTop: '4px',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '24px',
    justifyContent: 'center',
  },
  tab: {
    padding: '12px 24px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
    transition: 'all 0.3s ease',
  },
  tabActive: {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(200,200,200,0.1) 100%)',
    borderColor: '#FFF',
    color: '#FFF',
  },
  card: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '20px',
  },
  input: {
    width: '100%',
    padding: '16px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#FFF',
    fontSize: '1.2rem',
    outline: 'none',
    marginBottom: '12px',
  },
  button: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #FFFFFF 0%, #E8E8E8 50%, #B8B8B8 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#000',
    fontSize: '1rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  buttonSecondary: {
    background: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    border: '1px solid rgba(255,255,255,0.2)',
  },
  buttonDanger: {
    background: 'linear-gradient(135deg, #F44336 0%, #D32F2F 100%)',
    color: '#FFF',
  },
  buttonSuccess: {
    background: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
    color: '#FFF',
  },
  nftGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  nftCard: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '2px solid transparent',
    position: 'relative',
    transition: 'all 0.3s ease',
  },
  nftCardHover: {
    borderColor: 'rgba(255,255,255,0.3)',
    transform: 'translateY(-4px)',
    boxShadow: '0 10px 40px rgba(255,255,255,0.1)',
  },
  nftImage: {
    width: '100%',
    aspectRatio: '4/5',
    background: '#0a0a0a',
  },
  nftActions: {
    padding: '16px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  actionBtn: {
    flex: 1,
    minWidth: '80px',
    padding: '10px',
    borderRadius: '8px',
    border: 'none',
    fontWeight: '600',
    fontSize: '0.8rem',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    fontSize: '0.9rem',
  },
  toast: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '8px',
    color: '#FFF',
    fontWeight: '500',
    zIndex: 10000,
    maxWidth: '90%',
    textAlign: 'center',
  },
  toastSuccess: { background: 'rgba(76, 175, 80, 0.95)' },
  toastError: { background: 'rgba(244, 67, 54, 0.95)' },
  toastInfo: { background: 'rgba(33, 150, 243, 0.95)' },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#888',
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '20px',
  },
  modalContent: {
    background: 'linear-gradient(135deg, #1a1a2e 0%, #0d0d1a 100%)',
    borderRadius: '20px',
    padding: '30px',
    maxWidth: '400px',
    width: '100%',
    border: '1px solid rgba(255,255,255,0.1)',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// NFT CARD COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

const WhiteDiamondNFTCard = ({ 
  tokenId, 
  position, 
  onClaim, 
  onWithdraw, 
  onEmergencyWithdraw,
  onTransfer,
  loading 
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const formatAmount = (amount) => {
    const num = parseFloat(ethers.formatEther(amount || '0'));
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };
  
  const daysRemaining = Math.max(0, Math.floor((position?.timeRemaining || 0) / 86400));
  const isUnlocked = daysRemaining === 0;
  const pendingRewards = formatAmount(position?.pending);
  
  return (
    <div 
      style={{ ...styles.nftCard, ...(isHovered ? styles.nftCardHover : {}) }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* NFT Visual */}
      <div style={styles.nftImage}>
        <svg viewBox="0 0 400 500" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id={`diamondGrad-${tokenId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#FFFFFF' }} />
              <stop offset="50%" style={{ stopColor: '#E8E8E8' }} />
              <stop offset="100%" style={{ stopColor: '#B8B8B8' }} />
            </linearGradient>
            <linearGradient id={`bgGrad-${tokenId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#1a1a2e' }} />
              <stop offset="100%" style={{ stopColor: '#0d0d1a' }} />
            </linearGradient>
            <filter id={`glow-${tokenId}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          <rect width="400" height="500" fill={`url(#bgGrad-${tokenId})`} />
          <rect x="10" y="10" width="380" height="480" rx="20" fill="none" stroke={`url(#diamondGrad-${tokenId})`} strokeWidth="2" />
          
          {/* Diamond icon */}
          <polygon points="200,60 240,120 200,180 160,120" fill={`url(#diamondGrad-${tokenId})`} filter={`url(#glow-${tokenId})`} />
          <polygon points="200,60 220,120 200,140 180,120" fill="#FFFFFF" opacity="0.3" />
          
          {/* Title */}
          <text x="200" y="220" textAnchor="middle" fill={`url(#diamondGrad-${tokenId})`} fontFamily="Arial" fontSize="24" fontWeight="bold">WHITE DIAMOND</text>
          <text x="200" y="245" textAnchor="middle" fill="#888" fontFamily="Arial" fontSize="12">STAKE POSITION #{tokenId}</text>
          
          {/* Stats box */}
          <rect x="30" y="270" width="340" height="180" rx="12" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" />
          
          <text x="50" y="305" fill="#888" fontFamily="Arial" fontSize="11">STAKED LP</text>
          <text x="350" y="305" textAnchor="end" fill="#FFF" fontFamily="Arial" fontSize="14" fontWeight="bold">{formatAmount(position?.amount)}</text>
          
          <text x="50" y="340" fill="#888" fontFamily="Arial" fontSize="11">APR</text>
          <text x="350" y="340" textAnchor="end" fill="#4CAF50" fontFamily="Arial" fontSize="14" fontWeight="bold">70%</text>
          
          <text x="50" y="375" fill="#888" fontFamily="Arial" fontSize="11">PENDING REWARDS</text>
          <text x="350" y="375" textAnchor="end" fill="#FFD700" fontFamily="Arial" fontSize="14" fontWeight="bold">{pendingRewards} DTGC</text>
          
          <text x="50" y="410" fill="#888" fontFamily="Arial" fontSize="11">DAYS REMAINING</text>
          <text x="350" y="410" textAnchor="end" fill="#FFF" fontFamily="Arial" fontSize="14" fontWeight="bold">{daysRemaining}</text>
          
          <text x="50" y="445" fill="#888" fontFamily="Arial" fontSize="11">STATUS</text>
          <text x="350" y="445" textAnchor="end" fill={isUnlocked ? '#4CAF50' : '#FF9800'} fontFamily="Arial" fontSize="14" fontWeight="bold">
            {isUnlocked ? 'UNLOCKED' : 'LOCKED'}
          </text>
          
          <text x="200" y="480" textAnchor="middle" fill="#444" fontFamily="Arial" fontSize="10">DTGC.io</text>
        </svg>
      </div>
      
      {/* Action Buttons */}
      <div style={styles.nftActions}>
        <button
          onClick={() => onClaim(tokenId)}
          disabled={loading || parseFloat(ethers.formatEther(position?.pending || '0')) === 0}
          style={{
            ...styles.actionBtn,
            ...styles.buttonSuccess,
            ...(loading ? styles.buttonDisabled : {}),
          }}
        >
          💰 Claim
        </button>
        
        {isUnlocked ? (
          <button
            onClick={() => onWithdraw(tokenId)}
            disabled={loading}
            style={{
              ...styles.actionBtn,
              background: 'linear-gradient(135deg, #FFFFFF 0%, #B8B8B8 100%)',
              color: '#000',
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            ✓ Withdraw
          </button>
        ) : (
          <button
            onClick={() => onEmergencyWithdraw(tokenId)}
            disabled={loading}
            style={{
              ...styles.actionBtn,
              ...styles.buttonDanger,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            ⚠️ Early Exit
          </button>
        )}
        
        <button
          onClick={() => onTransfer(tokenId)}
          disabled={loading}
          style={{
            ...styles.actionBtn,
            ...styles.buttonSecondary,
            ...(loading ? styles.buttonDisabled : {}),
          }}
        >
          📤 Transfer
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function WhiteDiamondStaking({ provider, signer, userAddress, onClose }) {
  // State
  const [activeTab, setActiveTab] = useState('stake');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Stake state
  const [stakeAmount, setStakeAmount] = useState('');
  const [lpBalance, setLpBalance] = useState('0');
  
  // NFT state
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [positions, setPositions] = useState({});
  
  // Protocol stats
  const [stats, setStats] = useState({
    totalStaked: '0',
    totalStakers: '0',
    totalRewardsPaid: '0',
  });
  
  // Transfer modal
  const [transferModal, setTransferModal] = useState({ open: false, tokenId: null });
  const [transferTo, setTransferTo] = useState('');

  // Toast helper
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Format helper
  const formatAmount = (amount) => {
    const num = parseFloat(ethers.formatEther(amount || '0'));
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════

  const fetchData = useCallback(async () => {
    if (!provider || !userAddress || CONFIG.WHITE_DIAMOND_NFT === '0x0000000000000000000000000000000000000000') {
      return;
    }

    try {
      const nftContract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, provider);
      const lpContract = new ethers.Contract(CONFIG.LP_TOKEN, ERC20_ABI, provider);

      // Fetch LP balance
      const balance = await lpContract.balanceOf(userAddress);
      setLpBalance(balance.toString());

      // Fetch protocol stats
      const protocolStats = await nftContract.getStats();
      setStats({
        totalStaked: protocolStats[0].toString(),
        totalStakers: protocolStats[1].toString(),
        totalRewardsPaid: protocolStats[2].toString(),
      });

      // Fetch owned NFTs
      const tokenIds = await nftContract.getStakesByOwner(userAddress);
      setOwnedNFTs(tokenIds.map(id => id.toString()));

      // Fetch position details for each NFT
      const positionData = {};
      for (const tokenId of tokenIds) {
        const pos = await nftContract.getPosition(tokenId);
        positionData[tokenId.toString()] = {
          amount: pos[0].toString(),
          startTime: pos[1].toString(),
          unlockTime: pos[2].toString(),
          lastClaimTime: pos[3].toString(),
          pending: pos[4].toString(),
          isActive: pos[5],
          timeRemaining: Number(pos[6]),
        };
      }
      setPositions(positionData);

    } catch (err) {
      console.error('Fetch error:', err);
    }
  }, [provider, userAddress]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ═══════════════════════════════════════════════════════════════════════
  // STAKE FUNCTION
  // ═══════════════════════════════════════════════════════════════════════

  const handleStake = async () => {
    if (!signer || !stakeAmount || parseFloat(stakeAmount) < CONFIG.MIN_STAKE) {
      showToast(`Minimum stake is ${CONFIG.MIN_STAKE} LP`, 'error');
      return;
    }

    setLoading(true);
    try {
      const nftContract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);
      const lpContract = new ethers.Contract(CONFIG.LP_TOKEN, ERC20_ABI, signer);

      const amount = ethers.parseEther(stakeAmount);

      // Check allowance
      const allowance = await lpContract.allowance(userAddress, CONFIG.WHITE_DIAMOND_NFT);
      if (allowance < amount) {
        showToast('Approving LP tokens...', 'info');
        const approveTx = await lpContract.approve(CONFIG.WHITE_DIAMOND_NFT, ethers.MaxUint256);
        await approveTx.wait();
      }

      // Stake
      showToast('Minting White Diamond NFT...', 'info');
      const tx = await nftContract.stake(amount);
      const receipt = await tx.wait();

      // Find tokenId from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = nftContract.interface.parseLog(log);
          return parsed?.name === 'Staked';
        } catch { return false; }
      });

      const tokenId = event ? nftContract.interface.parseLog(event).args.tokenId : 'New';

      showToast(`✅ White Diamond #${tokenId} minted!`, 'success');
      setStakeAmount('');
      fetchData();

    } catch (err) {
      console.error('Stake error:', err);
      showToast(err.reason || err.message || 'Stake failed', 'error');
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // CLAIM REWARDS
  // ═══════════════════════════════════════════════════════════════════════

  const handleClaim = async (tokenId) => {
    if (!signer) return;

    setLoading(true);
    try {
      const nftContract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);

      showToast('Claiming rewards...', 'info');
      const tx = await nftContract.claimRewards(tokenId);
      await tx.wait();

      showToast('✅ Rewards claimed!', 'success');
      fetchData();

    } catch (err) {
      console.error('Claim error:', err);
      showToast(err.reason || err.message || 'Claim failed', 'error');
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // WITHDRAW
  // ═══════════════════════════════════════════════════════════════════════

  const handleWithdraw = async (tokenId) => {
    if (!signer) return;

    setLoading(true);
    try {
      const nftContract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);

      showToast('Withdrawing stake...', 'info');
      const tx = await nftContract.withdraw(tokenId);
      await tx.wait();

      showToast('✅ Stake withdrawn! NFT burned.', 'success');
      fetchData();

    } catch (err) {
      console.error('Withdraw error:', err);
      showToast(err.reason || err.message || 'Withdraw failed', 'error');
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // EMERGENCY WITHDRAW
  // ═══════════════════════════════════════════════════════════════════════

  const handleEmergencyWithdraw = async (tokenId) => {
    if (!signer) return;

    if (!window.confirm(`⚠️ Early withdrawal will cost you ${CONFIG.EARLY_PENALTY}% penalty + ${CONFIG.EXIT_FEE}% fee. Are you sure?`)) {
      return;
    }

    setLoading(true);
    try {
      const nftContract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);

      showToast('Processing emergency withdrawal...', 'info');
      const tx = await nftContract.emergencyWithdraw(tokenId);
      await tx.wait();

      showToast('✅ Emergency withdrawal complete. NFT burned.', 'success');
      fetchData();

    } catch (err) {
      console.error('Emergency withdraw error:', err);
      showToast(err.reason || err.message || 'Emergency withdraw failed', 'error');
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TRANSFER NFT
  // ═══════════════════════════════════════════════════════════════════════

  const handleTransfer = async () => {
    if (!signer || !transferTo || !transferModal.tokenId) return;

    if (!ethers.isAddress(transferTo)) {
      showToast('Invalid address', 'error');
      return;
    }

    setLoading(true);
    try {
      const nftContract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);

      showToast('Transferring NFT stake...', 'info');
      const tx = await nftContract.transferFrom(userAddress, transferTo, transferModal.tokenId);
      await tx.wait();

      showToast('✅ Stake transferred to new owner!', 'success');
      setTransferModal({ open: false, tokenId: null });
      setTransferTo('');
      fetchData();

    } catch (err) {
      console.error('Transfer error:', err);
      showToast(err.reason || err.message || 'Transfer failed', 'error');
    }
    setLoading(false);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  const isContractDeployed = CONFIG.WHITE_DIAMOND_NFT !== '0x0000000000000000000000000000000000000000';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>💎 WHITE DIAMOND</h1>
        <p style={styles.subtitle}>NFT Staking • Transfer Your Stake • 70% APR</p>
        
        {/* Quick Links */}
        <div style={{
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          marginTop: '16px',
          flexWrap: 'wrap',
        }}>
          <a 
            href={CONFIG.NFT_PAPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              color: '#FFF',
              textDecoration: 'none',
              fontSize: '0.85rem',
              transition: 'all 0.3s ease',
            }}
          >
            📄 NFT Paper
          </a>
          
          {isContractDeployed && (
            <a 
              href={`${CONFIG.CONTRACT_URL}${CONFIG.WHITE_DIAMOND_NFT}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#FFF',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'all 0.3s ease',
              }}
            >
              🔍 Contract
            </a>
          )}
          
          {isContractDeployed && (
            <a 
              href={`${CONFIG.OPENSEA_BASE}${CONFIG.WHITE_DIAMOND_NFT}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                color: '#FFF',
                textDecoration: 'none',
                fontSize: '0.85rem',
                transition: 'all 0.3s ease',
              }}
            >
              🛒 OpenSea
            </a>
          )}
        </div>
      </div>

      {!isContractDeployed && (
        <div style={{ ...styles.card, textAlign: 'center', background: 'rgba(255,152,0,0.1)', borderColor: '#FF9800' }}>
          <h3 style={{ color: '#FF9800', marginBottom: '10px' }}>🚧 Coming Soon</h3>
          <p style={{ color: '#888' }}>White Diamond NFT contract is being deployed. Check back soon!</p>
        </div>
      )}

      {/* Protocol Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{formatAmount(stats.totalStaked)}</div>
          <div style={styles.statLabel}>TOTAL STAKED LP</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{stats.totalStakers}</div>
          <div style={styles.statLabel}>TOTAL STAKERS</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#4CAF50' }}>{CONFIG.APR}%</div>
          <div style={styles.statLabel}>APR</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{CONFIG.LOCK_DAYS}</div>
          <div style={styles.statLabel}>LOCK DAYS</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          onClick={() => setActiveTab('stake')}
          style={{ ...styles.tab, ...(activeTab === 'stake' ? styles.tabActive : {}) }}
        >
          ➕ Stake LP
        </button>
        <button
          onClick={() => setActiveTab('nfts')}
          style={{ ...styles.tab, ...(activeTab === 'nfts' ? styles.tabActive : {}) }}
        >
          💎 My NFTs ({ownedNFTs.length})
        </button>
      </div>

      {/* Stake Tab */}
      {activeTab === 'stake' && (
        <div style={styles.card}>
          <h3 style={{ color: '#FFF', marginBottom: '20px' }}>Stake LP → Mint NFT</h3>
          
          <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.85rem' }}>
            <span>Amount to Stake</span>
            <span>Balance: {formatAmount(lpBalance)} LP</span>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              type="number"
              placeholder="0.0"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              style={{ ...styles.input, marginBottom: 0, flex: 1 }}
              disabled={!isContractDeployed}
            />
            <button
              onClick={() => {
                // Use 99.8% to leave room for gas/rounding
                const maxBalance = parseFloat(ethers.formatEther(lpBalance)) || 0;
                setStakeAmount((maxBalance * 0.998).toFixed(6));
              }}
              style={{
                padding: '0 20px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: '#FFF',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              MAX
            </button>
          </div>

          {/* Fee breakdown */}
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
            <div style={styles.infoRow}>
              <span style={{ color: '#888' }}>Entry Fee</span>
              <span style={{ color: '#FF9800' }}>{CONFIG.ENTRY_FEE}%</span>
            </div>
            <div style={styles.infoRow}>
              <span style={{ color: '#888' }}>Lock Period</span>
              <span style={{ color: '#FFF' }}>{CONFIG.LOCK_DAYS} days</span>
            </div>
            <div style={styles.infoRow}>
              <span style={{ color: '#888' }}>Exit Fee</span>
              <span style={{ color: '#FF9800' }}>{CONFIG.EXIT_FEE}%</span>
            </div>
            <div style={{ ...styles.infoRow, borderBottom: 'none' }}>
              <span style={{ color: '#888' }}>Early Exit Penalty</span>
              <span style={{ color: '#F44336' }}>{CONFIG.EARLY_PENALTY}%</span>
            </div>
          </div>

          <button
            onClick={handleStake}
            disabled={loading || !isContractDeployed || !stakeAmount}
            style={{
              ...styles.button,
              ...(loading || !isContractDeployed || !stakeAmount ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? '⏳ Minting...' : '💎 Mint White Diamond NFT'}
          </button>

          <p style={{ color: '#888', fontSize: '0.8rem', textAlign: 'center', marginTop: '16px' }}>
            Each stake becomes an NFT. Transfer the NFT = Transfer the stake!
          </p>
        </div>
      )}

      {/* My NFTs Tab */}
      {activeTab === 'nfts' && (
        <>
          {ownedNFTs.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>💎</div>
              <h3 style={{ color: '#FFF', marginBottom: '10px' }}>No White Diamond NFTs</h3>
              <p>Stake LP tokens to mint your first White Diamond NFT!</p>
              <button
                onClick={() => setActiveTab('stake')}
                style={{ ...styles.button, maxWidth: '200px', marginTop: '20px' }}
              >
                Stake Now
              </button>
            </div>
          ) : (
            <div style={styles.nftGrid}>
              {ownedNFTs.map(tokenId => (
                <WhiteDiamondNFTCard
                  key={tokenId}
                  tokenId={tokenId}
                  position={positions[tokenId]}
                  onClaim={handleClaim}
                  onWithdraw={handleWithdraw}
                  onEmergencyWithdraw={handleEmergencyWithdraw}
                  onTransfer={(id) => setTransferModal({ open: true, tokenId: id })}
                  loading={loading}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Transfer Modal */}
      {transferModal.open && (
        <div style={styles.modal} onClick={() => setTransferModal({ open: false, tokenId: null })}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#FFF', marginBottom: '20px' }}>📤 Transfer White Diamond #{transferModal.tokenId}</h3>
            
            <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>
              Transferring this NFT will transfer ownership of the entire stake position to the recipient.
            </p>
            
            <input
              type="text"
              placeholder="Recipient address (0x...)"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              style={styles.input}
            />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setTransferModal({ open: false, tokenId: null })}
                style={{ ...styles.button, ...styles.buttonSecondary, flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={loading || !transferTo}
                style={{
                  ...styles.button,
                  flex: 1,
                  ...(loading || !transferTo ? styles.buttonDisabled : {}),
                }}
              >
                {loading ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            ...styles.button,
            ...styles.buttonSecondary,
            marginTop: '30px',
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
