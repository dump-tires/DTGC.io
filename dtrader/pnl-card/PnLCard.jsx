import React, { useRef } from 'react';

/**
 * DTRADER P&L Shareable Card
 *
 * Gold Mandalorian themed profit/loss card
 * - Gold for profits
 * - Red for losses
 * - White starlight text
 * - Mandalorian background
 */

const PnLCard = ({
  tokenName = "PEPE",
  contractAddress = "0x1234567890abcdef1234567890abcdef12345678",
  buyPrice = 0.00001,
  currentPrice = 0.000025,
  amount = 1000000,
  pnlPercent = null, // Auto-calculated if not provided
  backgroundImage = "./mando-bg.png"
}) => {
  const cardRef = useRef(null);

  // Calculate P&L
  const invested = buyPrice * amount;
  const currentValue = currentPrice * amount;
  const pnl = currentValue - invested;
  const pnlPercentage = pnlPercent ?? ((pnl / invested) * 100);
  const isProfit = pnl >= 0;

  // Format the last 4 of CA
  const caLast4 = contractAddress.slice(-4).toUpperCase();

  // Format numbers
  const formatPnL = (value) => {
    if (Math.abs(value) >= 1000000) {
      return (value / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(2) + 'K';
    }
    return value.toFixed(2);
  };

  const styles = {
    card: {
      width: '400px',
      height: '500px',
      position: 'relative',
      borderRadius: '20px',
      overflow: 'hidden',
      fontFamily: "'Orbitron', 'Segoe UI', sans-serif",
      boxShadow: '0 0 40px rgba(212, 175, 55, 0.5)',
      border: '2px solid rgba(212, 175, 55, 0.6)',
    },
    background: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundImage: `url(${backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center top',
      filter: 'brightness(0.7)',
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.9) 100%)',
    },
    starOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)',
      pointerEvents: 'none',
    },
    content: {
      position: 'relative',
      zIndex: 10,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      padding: '24px',
      color: '#fff',
    },
    header: {
      position: 'absolute',
      top: '20px',
      left: '20px',
      right: '20px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logo: {
      fontSize: '14px',
      fontWeight: '700',
      color: '#D4AF37',
      textShadow: '0 0 10px rgba(212, 175, 55, 0.8)',
      letterSpacing: '2px',
    },
    chain: {
      fontSize: '11px',
      color: 'rgba(255,255,255,0.7)',
      background: 'rgba(0,0,0,0.5)',
      padding: '4px 10px',
      borderRadius: '12px',
      border: '1px solid rgba(212, 175, 55, 0.3)',
    },
    tokenInfo: {
      marginBottom: '16px',
    },
    tokenName: {
      fontSize: '32px',
      fontWeight: '800',
      color: '#FFFFFF',
      textShadow: '0 0 20px rgba(255,255,255,0.5), 0 2px 4px rgba(0,0,0,0.8)',
      letterSpacing: '1px',
      marginBottom: '4px',
    },
    contractAddress: {
      fontSize: '13px',
      color: 'rgba(255,255,255,0.6)',
      fontFamily: 'monospace',
      letterSpacing: '1px',
    },
    pnlContainer: {
      background: 'rgba(0,0,0,0.6)',
      borderRadius: '16px',
      padding: '20px',
      border: `2px solid ${isProfit ? 'rgba(212, 175, 55, 0.5)' : 'rgba(255, 68, 68, 0.5)'}`,
      backdropFilter: 'blur(10px)',
    },
    pnlLabel: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.6)',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      marginBottom: '8px',
    },
    pnlValue: {
      fontSize: '42px',
      fontWeight: '800',
      color: isProfit ? '#D4AF37' : '#FF4444',
      textShadow: isProfit
        ? '0 0 30px rgba(212, 175, 55, 0.8), 0 0 60px rgba(212, 175, 55, 0.4)'
        : '0 0 30px rgba(255, 68, 68, 0.8), 0 0 60px rgba(255, 68, 68, 0.4)',
      lineHeight: 1,
      marginBottom: '4px',
    },
    pnlAmount: {
      fontSize: '18px',
      color: isProfit ? '#D4AF37' : '#FF4444',
      opacity: 0.9,
    },
    stats: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: '16px',
      paddingTop: '16px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
    },
    stat: {
      textAlign: 'center',
    },
    statLabel: {
      fontSize: '10px',
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
      letterSpacing: '1px',
    },
    statValue: {
      fontSize: '14px',
      color: '#FFFFFF',
      fontWeight: '600',
      marginTop: '4px',
    },
    footer: {
      marginTop: '16px',
      textAlign: 'center',
      fontSize: '11px',
      color: 'rgba(255,255,255,0.4)',
      letterSpacing: '1px',
    },
    watermark: {
      color: '#D4AF37',
      fontWeight: '600',
    },
  };

  return (
    <div ref={cardRef} style={styles.card}>
      {/* Background Image */}
      <div style={styles.background} />

      {/* Dark Overlay */}
      <div style={styles.overlay} />

      {/* Starlight Effect */}
      <div style={styles.starOverlay} />

      {/* Content */}
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>⚜️ DTRADER</span>
          <span style={styles.chain}>PulseChain</span>
        </div>

        {/* Token Info */}
        <div style={styles.tokenInfo}>
          <div style={styles.tokenName}>${tokenName}</div>
          <div style={styles.contractAddress}>
            CA: ...{caLast4}
          </div>
        </div>

        {/* P&L Display */}
        <div style={styles.pnlContainer}>
          <div style={styles.pnlLabel}>
            {isProfit ? '🏆 Profit' : '📉 Loss'}
          </div>
          <div style={styles.pnlValue}>
            {isProfit ? '+' : ''}{pnlPercentage.toFixed(1)}%
          </div>
          <div style={styles.pnlAmount}>
            {isProfit ? '+' : ''}{formatPnL(pnl)} PLS
          </div>

          {/* Stats Row */}
          <div style={styles.stats}>
            <div style={styles.stat}>
              <div style={styles.statLabel}>Entry</div>
              <div style={styles.statValue}>{buyPrice.toExponential(2)}</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statLabel}>Current</div>
              <div style={styles.statValue}>{currentPrice.toExponential(2)}</div>
            </div>
            <div style={styles.stat}>
              <div style={styles.statLabel}>Amount</div>
              <div style={styles.statValue}>{formatPnL(amount)}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          Powered by <span style={styles.watermark}>DTGC.io</span>
        </div>
      </div>
    </div>
  );
};

// Example Usage Component with Multiple Cards
const PnLCardDemo = () => {
  return (
    <div style={{
      display: 'flex',
      gap: '24px',
      padding: '40px',
      background: '#0a0a0a',
      minHeight: '100vh',
      flexWrap: 'wrap',
      justifyContent: 'center'
    }}>
      {/* Profit Example */}
      <PnLCard
        tokenName="HEX"
        contractAddress="0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39"
        buyPrice={0.003}
        currentPrice={0.0075}
        amount={500000}
      />

      {/* Loss Example */}
      <PnLCard
        tokenName="PLSX"
        contractAddress="0x95B303987A60C71504D99Aa1b13B4DA07b0790ab"
        buyPrice={0.00008}
        currentPrice={0.00005}
        amount={10000000}
      />

      {/* Big Win */}
      <PnLCard
        tokenName="PEPE"
        contractAddress="0x6982508145454Ce325dDbE47a25d4ec3d2311933"
        buyPrice={0.0000001}
        currentPrice={0.000001}
        amount={100000000}
        pnlPercent={900}
      />
    </div>
  );
};

export default PnLCard;
export { PnLCardDemo };
