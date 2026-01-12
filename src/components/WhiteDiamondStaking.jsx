import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const CONFIG = {
  WHITE_DIAMOND_NFT: '0x326F86e7d594B55B7BA08DFE5195b10b159033fD',
  LP_TOKEN: '0x670c972Bb5388E087a2934a063064d97278e01F3', // URMOM/DTGC LP
  REWARD_TOKEN: '0xD0676B28a457371D58d47E5247b439114e40Eb0F', // DTGC
  MIN_STAKE: '1000000000000000000000', // 1000 LP
  APR: 70,
  LOCK_DAYS: 90,
  ENTRY_FEE: 3.75,
  EXIT_FEE: 3.75,
};

const WHITE_DIAMOND_ABI = [
  "function stake(uint256 amount) external returns (uint256)",
  "function withdraw(uint256 tokenId) external",
  "function claimRewards(uint256 tokenId) external",
  "function emergencyWithdraw(uint256 tokenId) external",
  "function getStakesByOwner(address user) external view returns (uint256[])",
  "function getPosition(uint256 tokenId) external view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 lastClaimTime, uint256 pending, bool isActive, uint256 timeRemaining)",
  "function getStats() external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function pendingRewards(uint256 tokenId) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)"
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

const WhiteDiamondStaking = ({ provider, account }) => {
  const [lpBalance, setLpBalance] = useState('0');
  const [dtgcBalance, setDtgcBalance] = useState('0');
  const [stakeAmount, setStakeAmount] = useState('');
  const [userStakes, setUserStakes] = useState([]);
  const [contractStats, setContractStats] = useState({
    totalStaked: '0',
    totalNFTs: '0',
    totalRewardsPaid: '0'
  });
  const [isApproved, setIsApproved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDiamondPaper, setShowDiamondPaper] = useState(false);

  useEffect(() => {
    if (provider && account) {
      loadBalances();
      loadUserStakes();
      loadContractStats();
      checkApproval();
    }
  }, [provider, account]);

  const loadBalances = async () => {
    try {
      const lpContract = new ethers.Contract(CONFIG.LP_TOKEN, ERC20_ABI, provider);
      const dtgcContract = new ethers.Contract(CONFIG.REWARD_TOKEN, ERC20_ABI, provider);
      
      const lpBal = await lpContract.balanceOf(account);
      const dtgcBal = await dtgcContract.balanceOf(account);
      
      setLpBalance(ethers.utils.formatEther(lpBal));
      setDtgcBalance(ethers.utils.formatEther(dtgcBal));
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  const loadUserStakes = async () => {
    try {
      const contract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, provider);
      const tokenIds = await contract.getStakesByOwner(account);
      
      const stakesData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const position = await contract.getPosition(tokenId);
          return {
            tokenId: tokenId.toString(),
            amount: ethers.utils.formatEther(position.amount),
            startTime: position.startTime.toNumber(),
            unlockTime: position.unlockTime.toNumber(),
            pending: ethers.utils.formatEther(position.pending),
            isActive: position.isActive,
            timeRemaining: position.timeRemaining.toNumber()
          };
        })
      );
      
      setUserStakes(stakesData.filter(s => s.isActive));
    } catch (error) {
      console.error('Error loading stakes:', error);
      setUserStakes([]);
    }
  };

  const loadContractStats = async () => {
    try {
      const contract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, provider);
      const stats = await contract.getStats();
      
      setContractStats({
        totalStaked: ethers.utils.formatEther(stats[0]),
        totalNFTs: stats[1].toString(),
        totalRewardsPaid: ethers.utils.formatEther(stats[2])
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const checkApproval = async () => {
    try {
      const lpContract = new ethers.Contract(CONFIG.LP_TOKEN, ERC20_ABI, provider);
      const allowance = await lpContract.allowance(account, CONFIG.WHITE_DIAMOND_NFT);
      setIsApproved(allowance.gt(ethers.utils.parseEther('1000')));
    } catch (error) {
      console.error('Error checking approval:', error);
    }
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const lpContract = new ethers.Contract(CONFIG.LP_TOKEN, ERC20_ABI, signer);
      const tx = await lpContract.approve(
        CONFIG.WHITE_DIAMOND_NFT,
        ethers.constants.MaxUint256
      );
      await tx.wait();
      setIsApproved(true);
      alert('✅ LP tokens approved!');
    } catch (error) {
      console.error('Approval error:', error);
      alert('❌ Approval failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleStake = async () => {
    if (!stakeAmount || parseFloat(stakeAmount) < 1000) {
      alert('Minimum stake is 1,000 LP tokens');
      return;
    }

    setLoading(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);
      const amount = ethers.utils.parseEther(stakeAmount);
      
      const tx = await contract.stake(amount);
      await tx.wait();
      
      alert('✅ Stake successful! NFT minted to your wallet.');
      setStakeAmount('');
      loadBalances();
      loadUserStakes();
      loadContractStats();
    } catch (error) {
      console.error('Stake error:', error);
      alert('❌ Stake failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleClaim = async (tokenId) => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.claimRewards(tokenId);
      await tx.wait();
      
      alert('✅ Rewards claimed!');
      loadBalances();
      loadUserStakes();
      loadContractStats();
    } catch (error) {
      console.error('Claim error:', error);
      alert('❌ Claim failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleWithdraw = async (tokenId) => {
    setLoading(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.withdraw(tokenId);
      await tx.wait();
      
      alert('✅ Withdrawn successfully! NFT burned.');
      loadBalances();
      loadUserStakes();
      loadContractStats();
    } catch (error) {
      console.error('Withdraw error:', error);
      alert('❌ Withdraw failed: ' + error.message);
    }
    setLoading(false);
  };

  const handleEmergencyWithdraw = async (tokenId) => {
    if (!confirm('⚠️ Emergency withdraw will forfeit 20% of rewards + exit fees. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONFIG.WHITE_DIAMOND_NFT, WHITE_DIAMOND_ABI, signer);
      const tx = await contract.emergencyWithdraw(tokenId);
      await tx.wait();
      
      alert('✅ Emergency withdrawal complete.');
      loadBalances();
      loadUserStakes();
      loadContractStats();
    } catch (error) {
      console.error('Emergency withdraw error:', error);
      alert('❌ Emergency withdraw failed: ' + error.message);
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
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
    return n.toFixed(2);
  };

  return (
    <div className="white-diamond-container">
      <style>{`
        .white-diamond-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Arial, sans-serif;
        }

        .diamond-header {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 30px;
          border: 2px solid #FFD700;
          position: relative;
          overflow: hidden;
        }

        .diamond-header::before {
          content: '💎';
          position: absolute;
          font-size: 120px;
          opacity: 0.1;
          right: -20px;
          top: -20px;
        }

        .header-content {
          position: relative;
          z-index: 1;
        }

        .tier-title {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 15px;
        }

        .tier-title h2 {
          color: #FFD700;
          font-size: 36px;
          margin: 0;
          font-weight: bold;
        }

        .nft-badge {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: transform 0.2s;
        }

        .nft-badge:hover {
          transform: scale(1.05);
        }

        .nft-star {
          font-size: 18px;
        }

        .tier-subtitle {
          color: #888;
          font-size: 18px;
          margin-bottom: 20px;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .stat-box {
          background: rgba(255, 255, 255, 0.05);
          padding: 15px;
          border-radius: 12px;
          border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .stat-label {
          color: #888;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 5px;
        }

        .stat-value {
          color: #FFD700;
          font-size: 24px;
          font-weight: bold;
        }

        .staking-section {
          background: #1e1e1e;
          border-radius: 20px;
          padding: 30px;
          margin-bottom: 30px;
          border: 1px solid #333;
        }

        .section-title {
          color: #FFD700;
          font-size: 24px;
          margin-bottom: 20px;
          font-weight: bold;
        }

        .balance-display {
          background: rgba(255, 255, 255, 0.05);
          padding: 15px;
          border-radius: 12px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .balance-label {
          color: #888;
          font-size: 14px;
        }

        .balance-value {
          color: #fff;
          font-size: 18px;
          font-weight: bold;
        }

        .input-group {
          margin-bottom: 20px;
        }

        .input-label {
          color: #888;
          font-size: 14px;
          margin-bottom: 8px;
          display: block;
        }

        .stake-input-wrapper {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .stake-input {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #444;
          border-radius: 12px;
          padding: 15px;
          color: #fff;
          font-size: 18px;
          outline: none;
        }

        .stake-input:focus {
          border-color: #FFD700;
        }

        .max-button {
          background: rgba(255, 215, 0, 0.2);
          border: 1px solid #FFD700;
          color: #FFD700;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          transition: all 0.2s;
        }

        .max-button:hover {
          background: rgba(255, 215, 0, 0.3);
        }

        .button-primary {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          border: none;
          padding: 15px 30px;
          border-radius: 12px;
          font-size: 18px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          transition: transform 0.2s;
        }

        .button-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(255, 215, 0, 0.3);
        }

        .button-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .stakes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }

        .stake-card {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid #FFD700;
          border-radius: 16px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .stake-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .stake-nft-id {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .vader-helmet {
          font-size: 32px;
          filter: drop-shadow(0 0 8px #FFD700);
        }

        .nft-id-text {
          color: #FFD700;
          font-size: 18px;
          font-weight: bold;
        }

        .stake-status {
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
        }

        .status-active {
          background: rgba(76, 175, 80, 0.2);
          color: #4CAF50;
          border: 1px solid #4CAF50;
        }

        .status-locked {
          background: rgba(255, 152, 0, 0.2);
          color: #FF9800;
          border: 1px solid #FF9800;
        }

        .status-unlocked {
          background: rgba(33, 150, 243, 0.2);
          color: #2196F3;
          border: 1px solid #2196F3;
        }

        .stake-detail {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .stake-detail:last-child {
          border-bottom: none;
          margin-bottom: 20px;
        }

        .detail-label {
          color: #888;
          font-size: 14px;
        }

        .detail-value {
          color: #fff;
          font-size: 14px;
          font-weight: bold;
        }

        .rewards-highlight {
          color: #FFD700 !important;
        }

        .stake-actions {
          display: flex;
          gap: 10px;
        }

        .action-button {
          flex: 1;
          background: rgba(255, 215, 0, 0.1);
          border: 1px solid #FFD700;
          color: #FFD700;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.2s;
        }

        .action-button:hover:not(:disabled) {
          background: rgba(255, 215, 0, 0.2);
          transform: translateY(-1px);
        }

        .action-button:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .action-button.danger {
          border-color: #f44336;
          color: #f44336;
          background: rgba(244, 67, 54, 0.1);
        }

        .action-button.danger:hover:not(:disabled) {
          background: rgba(244, 67, 54, 0.2);
        }

        .no-stakes {
          text-align: center;
          padding: 60px 20px;
          color: #888;
        }

        .no-stakes-icon {
          font-size: 64px;
          margin-bottom: 20px;
          opacity: 0.3;
        }

        .info-box {
          background: rgba(33, 150, 243, 0.1);
          border: 1px solid #2196F3;
          border-radius: 12px;
          padding: 15px;
          margin-top: 20px;
        }

        .info-box-title {
          color: #2196F3;
          font-weight: bold;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .info-list {
          color: #ccc;
          font-size: 14px;
          line-height: 1.8;
        }

        .info-list li {
          margin-bottom: 5px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: #1e1e1e;
          border: 2px solid #FFD700;
          border-radius: 20px;
          padding: 30px;
          max-width: 600px;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }

        .modal-close {
          position: absolute;
          top: 15px;
          right: 15px;
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          color: #fff;
        }

        @media (max-width: 768px) {
          .stakes-grid {
            grid-template-columns: 1fr;
          }

          .tier-title h2 {
            font-size: 28px;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* Header */}
      <div className="diamond-header">
        <div className="header-content">
          <div className="tier-title">
            <h2>💎 WHITE DIAMOND</h2>
            <div className="nft-badge" onClick={() => setShowDiamondPaper(true)}>
              <span className="nft-star">⭐</span>
              <span>NFT</span>
            </div>
          </div>
          <div className="tier-subtitle">
            URMOM/DTGC LP Staking | 70% APR | 90-Day Lock | NFT-Based Ownership
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <div className="stat-label">Total Staked</div>
              <div className="stat-value">{formatNumber(contractStats.totalStaked)} LP</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total NFTs</div>
              <div className="stat-value">{contractStats.totalNFTs}</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">APR</div>
              <div className="stat-value">{CONFIG.APR}%</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Lock Period</div>
              <div className="stat-value">{CONFIG.LOCK_DAYS} Days</div>
            </div>
            <div className="stat-box">
              <div className="stat-label">Total Rewards Paid</div>
              <div className="stat-value">{formatNumber(contractStats.totalRewardsPaid)} DTGC</div>
            </div>
          </div>
        </div>
      </div>

      {/* Staking Section */}
      <div className="staking-section">
        <h3 className="section-title">Create New Stake</h3>

        <div className="balance-display">
          <span className="balance-label">URMOM/DTGC LP Balance:</span>
          <span className="balance-value">{formatNumber(lpBalance)} LP</span>
        </div>

        <div className="balance-display">
          <span className="balance-label">DTGC Balance:</span>
          <span className="balance-value">{formatNumber(dtgcBalance)} DTGC</span>
        </div>

        <div className="input-group">
          <label className="input-label">Stake Amount (Min: 1,000 LP)</label>
          <div className="stake-input-wrapper">
            <input
              type="number"
              className="stake-input"
              placeholder="0.00"
              value={stakeAmount}
              onChange={(e) => setStakeAmount(e.target.value)}
              disabled={loading}
            />
            <button
              className="max-button"
              onClick={() => setStakeAmount(lpBalance)}
              disabled={loading}
            >
              MAX
            </button>
          </div>
        </div>

        {!isApproved ? (
          <button
            className="button-primary"
            onClick={handleApprove}
            disabled={loading}
          >
            {loading ? '⏳ Approving...' : '🔓 Approve LP Tokens'}
          </button>
        ) : (
          <button
            className="button-primary"
            onClick={handleStake}
            disabled={loading || !stakeAmount || parseFloat(stakeAmount) < 1000}
          >
            {loading ? '⏳ Staking...' : '💎 Stake & Mint NFT'}
          </button>
        )}

        <div className="info-box">
          <div className="info-box-title">
            <span>ℹ️</span>
            <span>How It Works</span>
          </div>
          <ul className="info-list">
            <li>• Each stake creates a unique transferable NFT</li>
            <li>• Entry Fee: {CONFIG.ENTRY_FEE}% (collected in LP)</li>
            <li>• Exit Fee: {CONFIG.EXIT_FEE}% (collected in LP)</li>
            <li>• Early Exit Penalty: 20% of rewards forfeited</li>
            <li>• Rewards accrue per-second at {CONFIG.APR}% APR</li>
            <li>• NFTs can be traded or transferred to other wallets</li>
          </ul>
        </div>
      </div>

      {/* Your Stakes Section */}
      <div className="staking-section">
        <h3 className="section-title">Your Stakes ({userStakes.length})</h3>

        {userStakes.length === 0 ? (
          <div className="no-stakes">
            <div className="no-stakes-icon">💎</div>
            <p>No active stakes yet. Create your first White Diamond NFT stake above!</p>
          </div>
        ) : (
          <div className="stakes-grid">
            {userStakes.map((stake) => {
              const isUnlocked = stake.timeRemaining === 0;
              const statusClass = isUnlocked ? 'status-unlocked' : 'status-locked';
              const statusText = isUnlocked ? 'Unlocked' : 'Locked';

              return (
                <div key={stake.tokenId} className="stake-card">
                  <div className="stake-card-header">
                    <div className="stake-nft-id">
                      <span className="vader-helmet">⚔️</span>
                      <span className="nft-id-text">NFT #{stake.tokenId}</span>
                    </div>
                    <div className={`stake-status ${statusClass}`}>
                      {statusText}
                    </div>
                  </div>

                  <div className="stake-detail">
                    <span className="detail-label">Staked Amount</span>
                    <span className="detail-value">{formatNumber(stake.amount)} LP</span>
                  </div>

                  <div className="stake-detail">
                    <span className="detail-label">Pending Rewards</span>
                    <span className="detail-value rewards-highlight">
                      {formatNumber(stake.pending)} DTGC
                    </span>
                  </div>

                  <div className="stake-detail">
                    <span className="detail-label">Time Remaining</span>
                    <span className="detail-value">
                      {isUnlocked ? 'Ready!' : formatTime(stake.timeRemaining)}
                    </span>
                  </div>

                  <div className="stake-detail">
                    <span className="detail-label">Unlock Date</span>
                    <span className="detail-value">
                      {new Date(stake.unlockTime * 1000).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="stake-actions">
                    <button
                      className="action-button"
                      onClick={() => handleClaim(stake.tokenId)}
                      disabled={loading || parseFloat(stake.pending) === 0}
                    >
                      Claim
                    </button>
                    <button
                      className="action-button"
                      onClick={() => handleWithdraw(stake.tokenId)}
                      disabled={loading || !isUnlocked}
                    >
                      Withdraw
                    </button>
                    <button
                      className="action-button danger"
                      onClick={() => handleEmergencyWithdraw(stake.tokenId)}
                      disabled={loading || isUnlocked}
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
        <div className="modal-overlay" onClick={() => setShowDiamondPaper(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDiamondPaper(false)}>
              ×
            </button>
            <h2 style={{ color: '#FFD700', marginBottom: '20px' }}>
              💎 About White Diamond NFT Stakes
            </h2>
            <div style={{ color: '#ccc', lineHeight: '1.8' }}>
              <p>
                White Diamond implements a revolutionary NFT-based staking system where each stake
                position is represented as a unique ERC-721 token.
              </p>
              <h3 style={{ color: '#FFD700', marginTop: '20px' }}>Key Features:</h3>
              <ul>
                <li>Each stake = Unique transferable NFT</li>
                <li>NFTs can be sold on secondary markets</li>
                <li>Transfer ownership between wallets</li>
                <li>Use as collateral in DeFi lending</li>
                <li>Rewards transfer with NFT ownership</li>
              </ul>
              <h3 style={{ color: '#FFD700', marginTop: '20px' }}>Economics:</h3>
              <ul>
                <li>70% APR on URMOM/DTGC LP tokens</li>
                <li>90-day lock period with 3.75% entry/exit fees</li>
                <li>Non-inflationary: rewards from pre-funded treasury</li>
                <li>Early exit penalty: 20% of accrued rewards</li>
              </ul>
              <p style={{ marginTop: '20px' }}>
                <a
                  href="/White_Diamond_Paper.pdf"
                  target="_blank"
                  style={{ color: '#FFD700', textDecoration: 'underline' }}
                >
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
