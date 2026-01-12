import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

/**
 * WhiteDiamondNFTViewer - Shows all White Diamond NFTs in PulseX Gold Suite
 * Add this component to your V4DeFiGoldSuite.jsx or token scanner
 */
const WhiteDiamondNFTViewer = ({ provider, userAddress, isDark, onViewNFT }) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);

  const WHITE_DIAMOND_CONTRACT = '0x326F86e7d594B55B7BA08DFE5195b10b159033fD'; // Update with your contract
  
  const WHITE_DIAMOND_ABI = [
    'function getStakesByOwner(address owner) view returns (uint256[])',
    'function getPosition(uint256 tokenId) view returns (uint256 amount, uint256 startTime, uint256 unlockTime, uint256 rewards, uint256 lpValueUSD, bool active)',
    'function calculateRewards(uint256 tokenId) view returns (uint256)',
  ];

  useEffect(() => {
    if (provider && userAddress) {
      loadNFTs();
    }
  }, [provider, userAddress]);

  const loadNFTs = async () => {
    setLoading(true);
    try {
      const contract = new ethers.Contract(WHITE_DIAMOND_CONTRACT, WHITE_DIAMOND_ABI, provider);
      const tokenIds = await contract.getStakesByOwner(userAddress);
      
      const nftData = await Promise.all(
        tokenIds.map(async (tokenId) => {
          const position = await contract.getPosition(tokenId);
          const rewards = await contract.calculateRewards(tokenId);
          
          return {
            tokenId: tokenId.toString(),
            amount: ethers.formatEther(position[0]),
            startTime: Number(position[1]) * 1000,
            unlockTime: Number(position[2]) * 1000,
            rewards: ethers.formatEther(rewards),
            lpValueUSD: ethers.formatEther(position[4]),
            active: position[5],
          };
        })
      );
      
      setNfts(nftData.filter(n => n.active));
    } catch (error) {
      console.error('Error loading White Diamond NFTs:', error);
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

  const theme = {
    bg: isDark ? '#1a1a1a' : '#ffffff',
    cardBg: isDark ? '#2a2a2a' : '#f5f5f5',
    text: isDark ? '#ffffff' : '#000000',
    textMuted: isDark ? '#888888' : '#666666',
    border: '#D4AF37',
  };

  if (loading) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: theme.textMuted,
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⏳</div>
        <div>Loading White Diamond NFTs...</div>
      </div>
    );
  }

  if (nfts.length === 0) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        background: theme.cardBg,
        borderRadius: '20px',
        border: `1px dashed ${theme.border}`,
        margin: '20px 0',
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '10px', opacity: 0.3 }}>💎</div>
        <div style={{ fontSize: '1.1rem', color: theme.textMuted, marginBottom: '5px' }}>
          No White Diamond NFTs Found
        </div>
        <div style={{ fontSize: '0.85rem', color: theme.textMuted }}>
          Stake URMOM/DTGC LP to mint your first NFT
        </div>
      </div>
    );
  }

  return (
    <div style={{ margin: '20px 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        padding: '20px',
        background: `linear-gradient(135deg, ${isDark ? 'rgba(212,175,55,0.1)' : 'rgba(212,175,55,0.2)'} 0%, transparent 100%)`,
        borderRadius: '15px',
        border: `1px solid ${theme.border}`,
      }}>
        <div>
          <h3 style={{
            fontFamily: 'Cinzel, serif',
            color: theme.border,
            fontSize: '1.5rem',
            marginBottom: '5px',
            letterSpacing: '2px',
          }}>
            💎 White Diamond NFTs
          </h3>
          <div style={{
            fontSize: '0.85rem',
            color: theme.textMuted,
          }}>
            {nfts.length} Active Position{nfts.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{
          fontSize: '3rem',
          opacity: 0.2,
        }}>
          ⚔️
        </div>
      </div>

      {/* NFT Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {nfts.map((nft) => {
          const isUnlocked = Date.now() >= nft.unlockTime;
          const daysRemaining = Math.ceil((nft.unlockTime - Date.now()) / (24 * 60 * 60 * 1000));
          
          return (
            <div
              key={nft.tokenId}
              onClick={() => onViewNFT && onViewNFT(nft)}
              style={{
                background: theme.cardBg,
                borderRadius: '20px',
                padding: '25px',
                border: `2px solid ${theme.border}`,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-5px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(212,175,55,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Darth Vader Helmet Thumbnail */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  background: 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '3.5rem',
                  boxShadow: '0 0 40px rgba(212,175,55,0.6)',
                  position: 'relative',
                  border: '3px solid rgba(255,255,255,0.2)',
                }}>
                  <div style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)',
                  }}/>
                  <div style={{ position: 'relative', zIndex: 1 }}>⚔️</div>
                </div>
              </div>

              {/* NFT ID & Status */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px',
              }}>
                <div style={{
                  fontFamily: 'Cinzel, serif',
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  color: theme.border,
                  letterSpacing: '1px',
                }}>
                  NFT #{nft.tokenId}
                </div>
                <div style={{
                  background: isUnlocked ? '#4CAF50' : '#FF9800',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                }}>
                  {isUnlocked ? '🔓' : '🔒'}
                </div>
              </div>

              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '15px',
              }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>LP Staked</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: theme.border }}>
                    {formatNumber(nft.amount)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>USD Value</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4CAF50' }}>
                    ${formatNumber(nft.lpValueUSD)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>Rewards</div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: '#4CAF50' }}>
                    +{formatNumber(nft.rewards)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', color: theme.textMuted }}>
                    {isUnlocked ? 'Status' : 'Unlocks'}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: isUnlocked ? '#4CAF50' : '#FF9800',
                  }}>
                    {isUnlocked ? 'Ready!' : `${daysRemaining}d`}
                  </div>
                </div>
              </div>

              {/* View Details Button */}
              <div style={{
                padding: '10px',
                background: `linear-gradient(135deg, ${theme.border} 0%, #F4E5C3 100%)`,
                borderRadius: '10px',
                textAlign: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#000',
                letterSpacing: '1px',
              }}>
                👁️ View Details
              </div>

              {/* Glow effect on hover */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 50% 50%, rgba(212,175,55,0.1) 0%, transparent 70%)',
                opacity: 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              }}/>
            </div>
          );
        })}
      </div>

      {/* View All Link */}
      <div style={{
        textAlign: 'center',
        marginTop: '30px',
      }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'whitediamond' }))}
          style={{
            padding: '15px 35px',
            background: 'transparent',
            border: `2px solid ${theme.border}`,
            borderRadius: '25px',
            color: theme.border,
            fontSize: '1rem',
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '1px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = theme.border;
            e.currentTarget.style.color = '#000';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = theme.border;
          }}
        >
          💎 Manage All NFTs
        </button>
      </div>
    </div>
  );
};

export default WhiteDiamondNFTViewer;

// ============================================
// HOW TO INTEGRATE INTO PULSEX GOLD SUITE:
// ============================================

/*

1. Import the component in your V4DeFiGoldSuite.jsx or token scanner:

import WhiteDiamondNFTViewer from './WhiteDiamondNFTViewer';

2. Add it to your render, typically after the main token list:

return (
  <div>
    {/* Your existing token scanner *\/}
    <div>...tokens here...</div>
    
    {/* White Diamond NFTs Section *\/}
    <WhiteDiamondNFTViewer 
      provider={provider}
      userAddress={account}
      isDark={isDark}
      onViewNFT={(nft) => {
        // Navigate to White Diamond tab
        setActiveTab('whitediamond');
        // Or show NFT card modal
        setShowNFTCard(nft);
      }}
    />
  </div>
);

3. Result:
   Users will see a beautiful grid of their White Diamond NFTs
   Each shows the Darth Vader helmet, NFT#, LP amount, USD value, and status
   Clicking opens full details in White Diamond tab

*/
