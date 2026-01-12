import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const WhiteDiamondIcon = ({ provider, account, onNavigate }) => {
  const [nftCount, setNftCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const WHITE_DIAMOND_ADDRESS = '0x326F86e7d594B55B7BA08DFE5195b10b159033fD';

  useEffect(() => {
    const loadNFTCount = async () => {
      if (!provider || !account) {
        setNftCount(0);
        return;
      }

      setLoading(true);
      try {
        const contract = new ethers.Contract(
          WHITE_DIAMOND_ADDRESS,
          ['function getStakesByOwner(address) view returns (uint256[])'],
          provider
        );
        const tokenIds = await contract.getStakesByOwner(account);
        setNftCount(tokenIds.length);
      } catch (err) {
        console.error('Error loading White Diamond NFT count:', err);
        setNftCount(0);
      } finally {
        setLoading(false);
      }
    };

    loadNFTCount();
    const interval = setInterval(loadNFTCount, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [provider, account]);

  return (
    <div 
      onClick={onNavigate}
      style={{
        textAlign: 'center',
        padding: '10px 15px',
        background: nftCount > 0
          ? 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(212,175,55,0.2) 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(212,175,55,0.1) 100%)',
        borderRadius: '8px',
        border: nftCount > 0 
          ? '2px solid rgba(255,255,255,0.8)' 
          : '2px solid rgba(255,255,255,0.5)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        minWidth: '100px',
        boxShadow: nftCount > 0 
          ? '0 0 25px rgba(255,255,255,0.4)' 
          : '0 0 20px rgba(255,255,255,0.3)',
        position: 'relative',
      }}
      title={`White Diamond NFT Staking${nftCount > 0 ? ` - ${nftCount} Active` : ''}`}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = '0 0 35px rgba(255,255,255,0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = nftCount > 0 
          ? '0 0 25px rgba(255,255,255,0.4)' 
          : '0 0 20px rgba(255,255,255,0.3)';
      }}
    >
      {/* NFT Count Badge (only show if > 0) */}
      {nftCount > 0 && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
          color: '#fff',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.65rem',
          fontWeight: 900,
          border: '2px solid var(--bg-primary)',
          boxShadow: '0 0 15px rgba(76,175,80,0.6)',
          animation: 'pulse 2s ease-in-out infinite',
        }}>
          {nftCount}
        </div>
      )}
      
      {/* Diamond Icon with Darth Vader Helmet Effect */}
      <div style={{
        fontSize: '1.3rem',
        background: 'linear-gradient(135deg, #FFFFFF 0%, #D4AF37 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        fontWeight: 900,
        position: 'relative',
        filter: nftCount > 0 ? 'drop-shadow(0 0 8px rgba(255,255,255,0.8))' : 'drop-shadow(0 0 5px rgba(255,255,255,0.5))',
      }}>
        💎
      </div>
      
      {/* Label */}
      <div style={{
        fontSize: '0.5rem',
        color: '#FFFFFF',
        fontWeight: 700,
        textShadow: '0 0 10px rgba(255,255,255,0.5)',
        letterSpacing: '0.5px',
      }}>
        WHITE
      </div>
      
      {/* NFT Subtitle */}
      <div style={{
        fontSize: '0.45rem',
        color: '#D4AF37',
        fontWeight: 700,
        marginTop: '2px',
        letterSpacing: '0.5px',
      }}>
        {loading ? '...' : nftCount > 0 ? `${nftCount} NFT${nftCount > 1 ? 'S' : ''}` : 'NFT'}
      </div>
    </div>
  );
};

export default WhiteDiamondIcon;
