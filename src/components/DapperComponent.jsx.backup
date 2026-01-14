import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 💎⚡ DAPPER COMPONENT - ONE-CLICK LP ZAPPER ⚡💎
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Pink box component for DTGC.io
 * Requires $1,000+ Diamond+ LP staked to access
 */

// Contract addresses - DEPLOYED ON PULSECHAIN
const DAPPER_ADDRESS = '0xc7fe28708ba913d6bdf1e7eac2c75f2158d978de';
const FLEX_STAKING_ADDRESS = '0x5ccea11cab6a17659ce1860f5b0b6e4a8cea54d6';

// Common tokens on PulseChain
const TOKENS = {
  PLS: { symbol: 'PLS', address: null, decimals: 18, name: 'PulseChain' },
  WPLS: { symbol: 'WPLS', address: '0xa1077a294dde1b09bb078844df40758a5d0f9a27', decimals: 18, name: 'Wrapped PLS' },
  PLSX: { symbol: 'PLSX', address: '0x95b303987a60c71504d99aa1b13b4da07b0790ab', decimals: 18, name: 'PulseX' },
  HEX: { symbol: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', decimals: 8, name: 'HEX' },
  INC: { symbol: 'INC', address: '0x2fa878ab3f87cc1c9737fc071108f904c0b0c95d', decimals: 18, name: 'Incentive' },
  DTGC: { symbol: 'DTGC', address: '0xd0676b28a457371d58d47e5247b439114e40eb0f', decimals: 18, name: 'DTGC' },
};

// ABIs
const DAPPER_ABI = [
  'function zapPLS() external payable',
  'function zapToken(address token, uint256 amount) external',
  'function checkAccess(address user) external view returns (bool canAccess, uint256 userValueUSD, uint256 requiredValueUSD)',
  'function estimateZapPLS(uint256 plsAmount) external view returns (uint256 estimatedLP, uint256 feeAmount)',
  'function getStats() external view returns (uint256 totalZaps, uint256 totalPLSProcessed, uint256 totalFeesCollected, uint256 totalLPCreated)',
];

const FLEX_STAKING_ABI = [
  'function getUserInfo(address user) external view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 stakeCount)',
  'function withdraw(uint256 stakeIndex) external',
  'function claimAllRewards() external',
  'function exitAll() external',
  'function getGlobalStats() external view returns (uint256 totalStaked, uint256 totalStakers, uint256 totalRewardsPaid, uint256 rewardPool, uint256 aprBps, uint256 exitFeeBps, uint256 totalExitFeesCollected)',
  'function getActiveStakeCount(address user) external view returns (uint256)',
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// Styles
const styles = {
  container: {
    background: 'linear-gradient(135deg, #ff1493 0%, #ff69b4 50%, #ffb6c1 100%)',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 8px 32px rgba(255, 20, 147, 0.3)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    maxWidth: '480px',
    margin: '20px auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    color: '#fff',
    fontSize: '24px',
    fontWeight: 'bold',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
    margin: 0,
  },
  infoLink: {
    color: '#fff',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: 0.9,
  },
  accessBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  accessGranted: {
    background: 'rgba(0, 255, 0, 0.2)',
    color: '#90EE90',
    border: '1px solid #90EE90',
  },
  accessDenied: {
    background: 'rgba(255, 0, 0, 0.2)',
    color: '#FFB6C1',
    border: '1px solid #FFB6C1',
  },
  inputGroup: {
    marginBottom: '16px',
  },
  label: {
    color: '#fff',
    fontSize: '14px',
    marginBottom: '8px',
    display: 'block',
    fontWeight: '500',
  },
  selectWrapper: {
    position: 'relative',
    marginBottom: '12px',
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.15)',
    color: '#fff',
    fontSize: '16px',
    cursor: 'pointer',
    outline: 'none',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    paddingRight: '80px',
    borderRadius: '12px',
    border: 'none',
    background: 'rgba(255, 255, 255, 0.15)',
    color: '#fff',
    fontSize: '18px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  maxButton: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 12px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  balance: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: '13px',
    marginTop: '8px',
    display: 'flex',
    justifyContent: 'space-between',
  },
  feeInfo: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '16px',
  },
  feeRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#fff',
    fontSize: '14px',
    marginBottom: '8px',
  },
  feeLabel: {
    opacity: 0.8,
  },
  feeValue: {
    fontWeight: 'bold',
  },
  zapButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '12px',
    border: 'none',
    background: '#fff',
    color: '#ff1493',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
  },
  zapButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  zapButtonHover: {
    transform: 'translateY(-2px)',
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.3)',
  },
  statsContainer: {
    marginTop: '20px',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.15)',
    borderRadius: '12px',
  },
  statsTitle: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '13px',
    marginBottom: '6px',
  },
  positionContainer: {
    marginTop: '20px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  positionTitle: {
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
  },
  actionButtons: {
    display: 'flex',
    gap: '12px',
    marginTop: '12px',
  },
  actionButton: {
    flex: 1,
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    background: 'linear-gradient(135deg, #ff1493 0%, #ff69b4 100%)',
    borderRadius: '20px',
    padding: '24px',
    maxWidth: '400px',
    maxHeight: '80vh',
    overflow: 'auto',
    color: '#fff',
  },
  modalClose: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '16px',
  },
};

// Info Modal Component
const InfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  
  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginTop: 0 }}>⚡ What is Dapper?</h2>
        
        <p><strong>One-Click LP Zapping</strong></p>
        <p>
          Dapper lets you convert ANY PulseChain token into staked DTGC/PLS LP 
          in a single transaction. No more manual swapping, adding liquidity, 
          and staking separately!
        </p>
        
        <p><strong>💎 Diamond+ Exclusive</strong></p>
        <p>
          This feature is exclusively available to users with $1,000+ worth of 
          Diamond+ LP staked. It's our way of rewarding loyal Diamond hands!
        </p>
        
        <p><strong>📊 Fees</strong></p>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>1% Entry Fee</strong> - Goes to Growth Engine for calculated DTGC buybacks</li>
          <li><strong>1% Exit Fee</strong> - Applies when you unstake from Flex tier</li>
        </ul>
        
        <p><strong>🔓 Flex Tier Benefits</strong></p>
        <ul style={{ paddingLeft: '20px' }}>
          <li>10% APR on your LP</li>
          <li>No lockup - withdraw anytime</li>
          <li>Earn DTGC rewards</li>
        </ul>
        
        <p><strong>🔄 The Flywheel</strong></p>
        <p>
          Every zap creates DTGC buy pressure and deepens liquidity. 
          The 1% fee goes to our Growth Engine which makes calculated 
          DTGC/URMOM purchases over time.
        </p>
        
        <button style={styles.modalClose} onClick={onClose}>
          Got it! 💎
        </button>
      </div>
    </div>
  );
};

// Main Component
const DapperComponent = ({ provider, account }) => {
  // State
  const [selectedToken, setSelectedToken] = useState('PLS');
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0');
  const [hasAccess, setHasAccess] = useState(false);
  const [userDiamondValue, setUserDiamondValue] = useState('0');
  const [requiredValue, setRequiredValue] = useState('1000');
  const [estimatedLP, setEstimatedLP] = useState('0');
  const [feeAmount, setFeeAmount] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  
  // User position in Flex staking
  const [userPosition, setUserPosition] = useState({
    stakedLP: '0',
    pendingRewards: '0',
  });
  
  // Global stats
  const [globalStats, setGlobalStats] = useState({
    totalZaps: '0',
    totalLPCreated: '0',
    apr: '10',
    exitFee: '1',
  });

  // Check access and load data
  const loadData = useCallback(async () => {
    if (!provider || !account) return;
    
    try {
      const signer = await provider.getSigner();
      const dapper = new ethers.Contract(DAPPER_ADDRESS, DAPPER_ABI, signer);
      const flexStaking = new ethers.Contract(FLEX_STAKING_ADDRESS, FLEX_STAKING_ABI, signer);
      
      // Check access
      const [canAccess, userValue, required] = await dapper.checkAccess(account);
      setHasAccess(canAccess);
      setUserDiamondValue(ethers.formatEther(userValue));
      setRequiredValue(ethers.formatEther(required));
      
      // Get user position
      const [stakedAmount, pendingRewards] = await flexStaking.getUserInfo(account);
      setUserPosition({
        stakedLP: ethers.formatEther(stakedAmount),
        pendingRewards: ethers.formatEther(pendingRewards),
      });
      
      // Get global stats
      const stats = await dapper.getStats();
      const flexStats = await flexStaking.getGlobalStats();
      setGlobalStats({
        totalZaps: stats[0].toString(),
        totalLPCreated: ethers.formatEther(stats[3]),
        apr: (Number(flexStats[4]) / 100).toString(),
        exitFee: (Number(flexStats[5]) / 100).toString(),
      });
      
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }, [provider, account]);

  // Load token balance
  const loadBalance = useCallback(async () => {
    if (!provider || !account) return;
    
    try {
      const token = TOKENS[selectedToken];
      
      if (selectedToken === 'PLS') {
        const bal = await provider.getBalance(account);
        setBalance(ethers.formatEther(bal));
      } else {
        const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
        const bal = await contract.balanceOf(account);
        setBalance(ethers.formatUnits(bal, token.decimals));
        
        // Check approval
        const allowance = await contract.allowance(account, DAPPER_ADDRESS);
        const amountWei = amount ? ethers.parseUnits(amount, token.decimals) : 0n;
        setNeedsApproval(allowance < amountWei);
      }
    } catch (err) {
      console.error('Error loading balance:', err);
    }
  }, [provider, account, selectedToken, amount]);

  // Estimate output
  const estimateOutput = useCallback(async () => {
    if (!provider || !amount || parseFloat(amount) <= 0) {
      setEstimatedLP('0');
      setFeeAmount('0');
      return;
    }
    
    try {
      const dapper = new ethers.Contract(DAPPER_ADDRESS, DAPPER_ABI, provider);
      
      // For simplicity, estimate based on PLS value
      // In production, you'd want to get actual quotes for each token
      const amountWei = ethers.parseEther(amount);
      const [estLP, fee] = await dapper.estimateZapPLS(amountWei);
      
      setEstimatedLP(ethers.formatEther(estLP));
      setFeeAmount(ethers.formatEther(fee));
    } catch (err) {
      console.error('Error estimating:', err);
    }
  }, [provider, amount]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useEffect(() => {
    const timer = setTimeout(() => {
      estimateOutput();
    }, 500);
    return () => clearTimeout(timer);
  }, [estimateOutput]);

  // Handle approve
  const handleApprove = async () => {
    if (!provider || !account) return;
    
    try {
      setIsApproving(true);
      const signer = await provider.getSigner();
      const token = TOKENS[selectedToken];
      const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
      
      const tx = await contract.approve(DAPPER_ADDRESS, ethers.MaxUint256);
      await tx.wait();
      
      setNeedsApproval(false);
    } catch (err) {
      console.error('Approve error:', err);
    } finally {
      setIsApproving(false);
    }
  };

  // Handle zap
  const handleZap = async () => {
    if (!provider || !account || !amount || parseFloat(amount) <= 0) return;
    
    try {
      setIsLoading(true);
      setTxHash('');
      
      const signer = await provider.getSigner();
      const dapper = new ethers.Contract(DAPPER_ADDRESS, DAPPER_ABI, signer);
      
      let tx;
      if (selectedToken === 'PLS') {
        const amountWei = ethers.parseEther(amount);
        tx = await dapper.zapPLS({ value: amountWei });
      } else {
        const token = TOKENS[selectedToken];
        const amountWei = ethers.parseUnits(amount, token.decimals);
        tx = await dapper.zapToken(token.address, amountWei);
      }
      
      setTxHash(tx.hash);
      await tx.wait();
      
      // Refresh data
      setAmount('');
      loadData();
      loadBalance();
      
    } catch (err) {
      console.error('Zap error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle claim rewards
  const handleClaim = async () => {
    if (!provider || !account) return;
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const flexStaking = new ethers.Contract(FLEX_STAKING_ADDRESS, FLEX_STAKING_ABI, signer);
      
      const tx = await flexStaking.claimAllRewards();
      await tx.wait();
      
      loadData();
    } catch (err) {
      console.error('Claim error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle exit (withdraw all + claim all)
  const handleExit = async () => {
    if (!provider || !account) return;
    
    if (!window.confirm('Exit will unstake all LP and claim rewards. A 1% exit fee applies. Continue?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      const signer = await provider.getSigner();
      const flexStaking = new ethers.Contract(FLEX_STAKING_ADDRESS, FLEX_STAKING_ABI, signer);
      
      const tx = await flexStaking.exitAll();
      await tx.wait();
      
      loadData();
    } catch (err) {
      console.error('Exit error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const canZap = hasAccess && amount && parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(balance);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h2 style={styles.title}>⚡ Dapper</h2>
        <span 
          style={styles.infoLink}
          onClick={() => setShowInfoModal(true)}
        >
          What is this? →
        </span>
      </div>

      {/* Access Badge */}
      <div style={{
        ...styles.accessBadge,
        ...(hasAccess ? styles.accessGranted : styles.accessDenied)
      }}>
        {hasAccess ? (
          <>💎 Diamond+ Access Granted</>
        ) : (
          <>🔒 Requires ${requiredValue} Diamond+ LP (You: ${parseFloat(userDiamondValue).toFixed(2)})</>
        )}
      </div>

      {/* Token Selection */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Zap From</label>
        <div style={styles.selectWrapper}>
          <select 
            style={styles.select}
            value={selectedToken}
            onChange={(e) => setSelectedToken(e.target.value)}
            disabled={!hasAccess}
          >
            {Object.entries(TOKENS).map(([key, token]) => (
              <option key={key} value={key} style={{ color: '#000' }}>
                {token.symbol} - {token.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Amount Input */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Amount</label>
        <div style={styles.inputWrapper}>
          <input
            style={styles.input}
            type="number"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!hasAccess}
          />
          <button 
            style={styles.maxButton}
            onClick={() => setAmount(balance)}
            disabled={!hasAccess}
          >
            MAX
          </button>
        </div>
        <div style={styles.balance}>
          <span>Balance: {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} {selectedToken}</span>
        </div>
      </div>

      {/* Fee Info */}
      <div style={styles.feeInfo}>
        <div style={styles.feeRow}>
          <span style={styles.feeLabel}>Entry Fee (1%)</span>
          <span style={styles.feeValue}>{parseFloat(feeAmount).toFixed(4)} PLS</span>
        </div>
        <div style={styles.feeRow}>
          <span style={styles.feeLabel}>Estimated LP</span>
          <span style={styles.feeValue}>{parseFloat(estimatedLP).toFixed(4)} LP</span>
        </div>
        <div style={styles.feeRow}>
          <span style={styles.feeLabel}>APR</span>
          <span style={styles.feeValue}>{globalStats.apr}%</span>
        </div>
        <div style={styles.feeRow}>
          <span style={styles.feeLabel}>Exit Fee</span>
          <span style={styles.feeValue}>{globalStats.exitFee}%</span>
        </div>
      </div>

      {/* Action Button */}
      {needsApproval && selectedToken !== 'PLS' ? (
        <button
          style={{
            ...styles.zapButton,
            ...(isApproving ? styles.zapButtonDisabled : {})
          }}
          onClick={handleApprove}
          disabled={isApproving || !hasAccess}
        >
          {isApproving ? 'Approving...' : `Approve ${selectedToken}`}
        </button>
      ) : (
        <button
          style={{
            ...styles.zapButton,
            ...(!canZap || isLoading ? styles.zapButtonDisabled : {})
          }}
          onClick={handleZap}
          disabled={!canZap || isLoading}
        >
          {isLoading ? 'Zapping...' : hasAccess ? '⚡ Zap & Stake' : '🔒 Diamond+ Required'}
        </button>
      )}

      {/* TX Hash */}
      {txHash && (
        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <a 
            href={`https://scan.pulsechain.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#fff', fontSize: '14px' }}
          >
            View Transaction →
          </a>
        </div>
      )}

      {/* User Position */}
      {parseFloat(userPosition.stakedLP) > 0 && (
        <div style={styles.positionContainer}>
          <div style={styles.positionTitle}>Your Flex Position</div>
          <div style={styles.statRow}>
            <span>Staked LP</span>
            <span>{parseFloat(userPosition.stakedLP).toFixed(4)}</span>
          </div>
          <div style={styles.statRow}>
            <span>Pending DTGC</span>
            <span>{parseFloat(userPosition.pendingRewards).toFixed(4)}</span>
          </div>
          <div style={styles.actionButtons}>
            <button 
              style={styles.actionButton}
              onClick={handleClaim}
              disabled={isLoading || parseFloat(userPosition.pendingRewards) <= 0}
            >
              Claim
            </button>
            <button 
              style={styles.actionButton}
              onClick={handleExit}
              disabled={isLoading}
            >
              Exit (1% fee)
            </button>
          </div>
        </div>
      )}

      {/* Global Stats */}
      <div style={styles.statsContainer}>
        <div style={styles.statsTitle}>📊 Dapper Stats</div>
        <div style={styles.statRow}>
          <span>Total Zaps</span>
          <span>{globalStats.totalZaps}</span>
        </div>
        <div style={styles.statRow}>
          <span>Total LP Created</span>
          <span>{parseFloat(globalStats.totalLPCreated).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Info Modal */}
      <InfoModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />
    </div>
  );
};

export default DapperComponent;

