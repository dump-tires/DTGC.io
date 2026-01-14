import React, { useState } from 'react';
import { ethers } from 'ethers';

/**
 * WhiteDiamondNFTActions - Trading controls for White Diamond NFTs
 * Features: Transfer, OpenSea listing, Gift, Wrap
 */
const WhiteDiamondNFTActions = ({ nft, provider, signer, userAddress, onActionComplete, isDark }) => {
  const [showTransfer, setShowTransfer] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferring, setTransferring] = useState(false);

  const WHITE_DIAMOND_ADDRESS = '0x326F86e7d594B55B7BA08DFE5195b10b159033fD';
  const OPENSEA_BASE_URL = 'https://opensea.io/assets/pulsechain';
  
  const theme = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    cardBg: isDark ? '#2a2a2a' : '#f5f5f5',
    text: isDark ? '#ffffff' : '#000000',
    textMuted: isDark ? '#888888' : '#666666',
    border: '#D4AF37',
    gold: '#D4AF37',
    buttonBg: isDark ? '#3a3a3a' : '#e5e5e5',
    buttonHover: isDark ? '#4a4a4a' : '#d5d5d5',
  };

  // Transfer NFT to another address
  const handleTransfer = async () => {
    if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
      alert('Please enter a valid PulseChain address');
      return;
    }

    if (recipientAddress.toLowerCase() === userAddress.toLowerCase()) {
      alert('Cannot transfer to yourself');
      return;
    }

    try {
      setTransferring(true);
      const contract = new ethers.Contract(
        WHITE_DIAMOND_ADDRESS,
        ['function transferFrom(address from, address to, uint256 tokenId) external'],
        signer
      );

      console.log(`📤 Transferring NFT #${nft.tokenId} to ${recipientAddress}...`);
      const tx = await contract.transferFrom(userAddress, recipientAddress, nft.tokenId);
      
      console.log('⏳ Waiting for confirmation...');
      await tx.wait();
      
      console.log('✅ Transfer complete!');
      alert(`Successfully transferred White Diamond NFT #${nft.tokenId}`);
      
      setShowTransfer(false);
      setRecipientAddress('');
      if (onActionComplete) onActionComplete();
    } catch (error) {
      console.error('❌ Transfer failed:', error);
      alert('Transfer failed: ' + (error.reason || error.message));
    } finally {
      setTransferring(false);
    }
  };

  // Open OpenSea for this NFT (with pending approval notice)
  const handleOpenSea = () => {
    alert('⏳ Waiting on OpenSea to approve PulseChain NFTs\n\nFor now, use Transfer to send directly to buyers or verify ownership on PulseScan.');
    // const url = `${OPENSEA_BASE_URL}/${WHITE_DIAMOND_ADDRESS}/${nft.tokenId}`;
    // window.open(url, '_blank');
  };

  // View on PulseScan
  const handleViewExplorer = () => {
    const url = `https://scan.pulsechain.com/token/${WHITE_DIAMOND_ADDRESS}?a=${nft.tokenId}`;
    window.open(url, '_blank');
  };

  // Copy shareable link
  const handleCopyLink = () => {
    const url = `https://dtgc.io/white-diamond/${nft.tokenId}`;
    navigator.clipboard.writeText(url);
    alert('Shareable link copied!');
  };

  return (
    <div style={{
      background: theme.cardBg,
      borderRadius: '12px',
      padding: '16px',
      border: `1px solid ${theme.border}`,
      marginTop: '12px'
    }}>
      {/* Action Buttons Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: showTransfer ? '16px' : '0'
      }}>
        {/* Transfer Button */}
        <button
          onClick={() => setShowTransfer(!showTransfer)}
          style={{
            padding: '10px',
            background: theme.buttonBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            color: theme.text,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => e.target.style.background = theme.buttonHover}
          onMouseOut={e => e.target.style.background = theme.buttonBg}
        >
          <span>📤</span>
          <span>Transfer</span>
        </button>

        {/* OpenSea Button (Pending) */}
        <button
          onClick={handleOpenSea}
          style={{
            padding: '10px',
            background: theme.buttonBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            color: theme.text,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s',
            opacity: 0.7,
          }}
          onMouseOver={e => e.target.style.background = theme.buttonHover}
          onMouseOut={e => e.target.style.background = theme.buttonBg}
          title="Waiting on OpenSea to approve PulseChain NFTs"
        >
          <span>⏳</span>
          <span>OpenSea</span>
        </button>

        {/* View on Explorer */}
        <button
          onClick={handleViewExplorer}
          style={{
            padding: '10px',
            background: theme.buttonBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            color: theme.text,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => e.target.style.background = theme.buttonHover}
          onMouseOut={e => e.target.style.background = theme.buttonBg}
        >
          <span>🔍</span>
          <span>Explorer</span>
        </button>

        {/* Copy Link Button */}
        <button
          onClick={handleCopyLink}
          style={{
            padding: '10px',
            background: theme.buttonBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '8px',
            color: theme.text,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => e.target.style.background = theme.buttonHover}
          onMouseOut={e => e.target.style.background = theme.buttonBg}
        >
          <span>🔗</span>
          <span>Copy Link</span>
        </button>
      </div>

      {/* P2P Trading Guide */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.15)',
        borderRadius: '8px',
        border: `1px solid ${theme.border}`,
        fontSize: '0.8rem',
        lineHeight: '1.5',
      }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: theme.gold }}>
          💡 How to Trade Your NFT:
        </div>
        <div style={{ color: theme.text, marginBottom: '8px' }}>
          1. Find a buyer (Telegram, Discord, etc.)<br/>
          2. Use Transfer button to send directly<br/>
          3. Buyer verifies ownership on PulseScan
        </div>
        <a
          href={`https://scan.pulsechain.com/token/${WHITE_DIAMOND_ADDRESS}?a=${nft.tokenId}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '6px 12px',
            background: theme.buttonBg,
            border: `1px solid ${theme.border}`,
            borderRadius: '6px',
            color: theme.gold,
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          🔍 Verify on PulseScan →
        </a>
      </div>

      {/* Transfer Form (shown when Transfer clicked) */}
      {showTransfer && (
        <div style={{
          background: isDark ? '#1a1a1a' : '#f9f9f9',
          borderRadius: '8px',
          padding: '16px',
          border: `1px solid ${theme.border}`
        }}>
          <div style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            marginBottom: '12px',
            color: theme.text
          }}>
            Transfer NFT #{nft.tokenId}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.85rem',
              color: theme.textMuted,
              marginBottom: '6px'
            }}>
              Recipient Address
            </label>
            <input
              type="text"
              value={recipientAddress}
              onChange={e => setRecipientAddress(e.target.value)}
              placeholder="0x..."
              disabled={transferring}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: `1px solid ${theme.border}`,
                background: theme.bg,
                color: theme.text,
                fontSize: '0.9rem',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            <button
              onClick={handleTransfer}
              disabled={transferring || !recipientAddress}
              style={{
                flex: 1,
                padding: '10px',
                background: transferring ? '#666' : '#D4AF37',
                border: 'none',
                borderRadius: '6px',
                color: '#000',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: transferring ? 'not-allowed' : 'pointer',
                opacity: transferring || !recipientAddress ? 0.6 : 1
              }}
            >
              {transferring ? '⏳ Transferring...' : '✅ Confirm Transfer'}
            </button>
            <button
              onClick={() => {
                setShowTransfer(false);
                setRecipientAddress('');
              }}
              disabled={transferring}
              style={{
                padding: '10px 20px',
                background: theme.buttonBg,
                border: `1px solid ${theme.border}`,
                borderRadius: '6px',
                color: theme.text,
                fontSize: '0.9rem',
                cursor: transferring ? 'not-allowed' : 'pointer'
              }}
            >
              Cancel
            </button>
          </div>

          <div style={{
            marginTop: '12px',
            fontSize: '0.75rem',
            color: theme.textMuted,
            padding: '8px',
            background: isDark ? '#2a2a2a' : '#f0f0f0',
            borderRadius: '4px',
            border: `1px solid ${isDark ? '#3a3a3a' : '#e0e0e0'}`
          }}>
            ⚠️ Warning: This will transfer your staked position. You will lose access to this NFT and its rewards.
          </div>
        </div>
      )}

      {/* NFT Details Summary */}
      <div style={{
        marginTop: '12px',
        padding: '12px',
        background: isDark ? '#1a1a1a' : '#f9f9f9',
        borderRadius: '6px',
        fontSize: '0.85rem',
        color: theme.textMuted
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Token ID:</span>
          <span style={{ fontFamily: 'monospace', color: theme.text }}>#{nft.tokenId}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Staked:</span>
          <span style={{ color: theme.text }}>{parseFloat(nft.amount).toLocaleString()} LP</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Rewards:</span>
          <span style={{ color: '#4CAF50' }}>+{parseFloat(nft.rewards).toLocaleString()} DTGC</span>
        </div>
      </div>
    </div>
  );
};

export default WhiteDiamondNFTActions;
