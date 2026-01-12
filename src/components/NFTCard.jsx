import React, { useRef } from 'react';
import html2canvas from 'html2canvas';

/**
 * NFTCard Component - Generates shareable NFT card images
 * Usage: <NFTCard stake={stakeData} onClose={() => setShowCard(false)} />
 */
const NFTCard = ({ stake, isDark = true, onClose }) => {
  const cardRef = useRef(null);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2, // Higher quality
      });
      
      const link = document.createElement('a');
      link.download = `white-diamond-nft-${stake.tokenId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating NFT card:', error);
      alert('Failed to generate card. Try screenshot instead!');
    }
  };

  const shareCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      
      canvas.toBlob(async (blob) => {
        if (navigator.share && navigator.canShare) {
          try {
            const file = new File([blob], `white-diamond-${stake.tokenId}.png`, { type: 'image/png' });
            await navigator.share({
              title: 'White Diamond NFT',
              text: `My White Diamond NFT #${stake.tokenId} - ${stake.amount} LP Staked`,
              files: [file],
            });
          } catch (err) {
            console.log('Share cancelled or failed:', err);
          }
        } else {
          // Fallback: download
          downloadCard();
        }
      });
    } catch (error) {
      console.error('Error sharing card:', error);
    }
  };

  const isUnlocked = Date.now() >= stake.unlockTime;
  
  return (
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
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}>
        
        {/* NFT Card */}
        <div ref={cardRef} style={{
          width: '400px',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
          borderRadius: '30px',
          padding: '40px',
          border: '3px solid #D4AF37',
          boxShadow: '0 20px 60px rgba(212,175,55,0.4), inset 0 0 50px rgba(212,175,55,0.1)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          
          {/* Background Pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 20%, rgba(212,175,55,0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(255,255,255,0.05) 0%, transparent 50%)
            `,
            pointerEvents: 'none',
          }}/>
          
          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '30px',
            }}>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '1.5rem',
                fontWeight: 900,
                color: '#D4AF37',
                textShadow: '0 0 20px rgba(212,175,55,0.8)',
                letterSpacing: '3px',
              }}>
                WHITE DIAMOND
              </div>
              <div style={{
                background: isUnlocked ? '#4CAF50' : '#FF9800',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.7rem',
                fontWeight: 900,
                letterSpacing: '1px',
              }}>
                {isUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED'}
              </div>
            </div>

            {/* Darth Vader Helmet */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '30px',
            }}>
              <div style={{
                width: '150px',
                height: '150px',
                background: 'linear-gradient(135deg, #D4AF37 0%, #F4E5C3 50%, #D4AF37 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '5rem',
                boxShadow: '0 0 60px rgba(212,175,55,0.8), inset 0 0 30px rgba(255,255,255,0.3)',
                position: 'relative',
                border: '4px solid rgba(255,255,255,0.2)',
              }}>
                {/* Glow effect */}
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%)',
                }}/>
                <div style={{ position: 'relative', zIndex: 1 }}>⚔️</div>
              </div>
            </div>

            {/* NFT Number */}
            <div style={{
              textAlign: 'center',
              fontSize: '1.2rem',
              fontWeight: 900,
              color: '#FFFFFF',
              fontFamily: 'Cinzel, serif',
              marginBottom: '30px',
              letterSpacing: '2px',
            }}>
              NFT #{stake.tokenId}
            </div>

            {/* Divider */}
            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent 0%, #D4AF37 50%, transparent 100%)',
              marginBottom: '25px',
            }}/>

            {/* Stats Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '20px',
              marginBottom: '25px',
            }}>
              <div style={{
                background: 'rgba(212,175,55,0.1)',
                padding: '15px',
                borderRadius: '12px',
                border: '1px solid rgba(212,175,55,0.3)',
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  marginBottom: '5px',
                  letterSpacing: '1px',
                }}>
                  LP STAKED
                </div>
                <div style={{
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  color: '#D4AF37',
                  wordBreak: 'break-all',
                }}>
                  {parseFloat(stake.amount).toFixed(2)}
                </div>
              </div>

              <div style={{
                background: 'rgba(76,175,80,0.1)',
                padding: '15px',
                borderRadius: '12px',
                border: '1px solid rgba(76,175,80,0.3)',
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  marginBottom: '5px',
                  letterSpacing: '1px',
                }}>
                  USD VALUE
                </div>
                <div style={{
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  color: '#4CAF50',
                }}>
                  ${parseFloat(stake.lpValueUSD || 0).toFixed(2)}
                </div>
              </div>

              <div style={{
                background: 'rgba(76,175,80,0.1)',
                padding: '15px',
                borderRadius: '12px',
                border: '1px solid rgba(76,175,80,0.3)',
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  marginBottom: '5px',
                  letterSpacing: '1px',
                }}>
                  REWARDS
                </div>
                <div style={{
                  fontSize: '1.3rem',
                  fontWeight: 900,
                  color: '#4CAF50',
                }}>
                  +{parseFloat(stake.rewards || 0).toFixed(2)}
                </div>
              </div>

              <div style={{
                background: isUnlocked ? 'rgba(76,175,80,0.1)' : 'rgba(255,152,0,0.1)',
                padding: '15px',
                borderRadius: '12px',
                border: `1px solid ${isUnlocked ? 'rgba(76,175,80,0.3)' : 'rgba(255,152,0,0.3)'}`,
              }}>
                <div style={{
                  fontSize: '0.7rem',
                  color: '#888',
                  marginBottom: '5px',
                  letterSpacing: '1px',
                }}>
                  {isUnlocked ? 'UNLOCKED' : 'UNLOCKS IN'}
                </div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 900,
                  color: isUnlocked ? '#4CAF50' : '#FF9800',
                }}>
                  {isUnlocked ? '✓' : (() => {
                    const diff = stake.unlockTime - Date.now();
                    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
                    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
                    return `${days}d ${hours}h`;
                  })()}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{
              height: '2px',
              background: 'linear-gradient(90deg, transparent 0%, #D4AF37 50%, transparent 100%)',
              marginBottom: '20px',
            }}/>

            {/* Footer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{
                fontSize: '0.65rem',
                color: '#666',
                letterSpacing: '1px',
              }}>
                70% APR • 90 DAYS
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: '#D4AF37',
                fontWeight: 700,
                fontFamily: 'Cinzel, serif',
                letterSpacing: '2px',
              }}>
                DTGC.IO
              </div>
            </div>

            {/* Watermark */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: '0.5rem',
              color: 'rgba(255,255,255,0.2)',
              letterSpacing: '1px',
            }}>
              Minted on PulseChain
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <button
            onClick={downloadCard}
            style={{
              padding: '15px 30px',
              background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
              border: 'none',
              borderRadius: '25px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '1px',
              boxShadow: '0 4px 15px rgba(76,175,80,0.4)',
            }}
          >
            💾 Download Card
          </button>
          
          <button
            onClick={shareCard}
            style={{
              padding: '15px 30px',
              background: 'linear-gradient(135deg, #2196F3 0%, #42A5F5 100%)',
              border: 'none',
              borderRadius: '25px',
              color: '#fff',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '1px',
              boxShadow: '0 4px 15px rgba(33,150,243,0.4)',
            }}
          >
            📤 Share Card
          </button>

          <button
            onClick={onClose}
            style={{
              padding: '15px 30px',
              background: 'transparent',
              border: '2px solid #D4AF37',
              borderRadius: '25px',
              color: '#D4AF37',
              fontSize: '1rem',
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '1px',
            }}
          >
            Close
          </button>
        </div>

        {/* Install Prompt */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.85rem',
          color: '#888',
          maxWidth: '400px',
        }}>
          💡 <strong>Pro Tip:</strong> Right-click the card to save, or use the Download button for high-quality PNG
        </div>
      </div>
    </div>
  );
};

export default NFTCard;
