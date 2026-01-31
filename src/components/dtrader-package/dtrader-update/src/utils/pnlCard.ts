import * as fs from 'fs';
import * as path from 'path';

/**
 * P&L Card Generator for Telegram
 *
 * Generates HTML that can be converted to image
 * Uses the Gold Mando theme with starlight effects
 */

interface PnLData {
  tokenName: string;
  contractAddress: string;
  buyPrice: number;
  currentPrice: number;
  amount: number;
  walletAddress?: string;
}

interface PnLResult {
  isProfit: boolean;
  pnlPercent: number;
  pnlAmount: number;
  invested: number;
  currentValue: number;
}

export function calculatePnL(data: PnLData): PnLResult {
  const invested = data.buyPrice * data.amount;
  const currentValue = data.currentPrice * data.amount;
  const pnlAmount = currentValue - invested;
  const pnlPercent = invested > 0 ? ((pnlAmount / invested) * 100) : 0;

  return {
    isProfit: pnlAmount >= 0,
    pnlPercent,
    pnlAmount,
    invested,
    currentValue,
  };
}

export function formatNumber(value: number): string {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  } else if (absValue >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  }
  return value.toFixed(2);
}

export function formatPrice(value: number): string {
  if (value < 0.0001) {
    return value.toExponential(2);
  } else if (value < 1) {
    return value.toFixed(6);
  }
  return value.toFixed(4);
}

/**
 * Generate P&L message for Telegram (text version)
 */
export function generatePnLMessage(data: PnLData): string {
  const pnl = calculatePnL(data);
  const caShort = data.contractAddress.slice(-4).toUpperCase();
  const sign = pnl.isProfit ? '+' : '';
  const emoji = pnl.isProfit ? '🏆' : '📉';
  const statusEmoji = pnl.isProfit ? '🟢' : '🔴';

  return `
⚜️ *DTRADER P&L CARD*
━━━━━━━━━━━━━━━━━━━━━

${statusEmoji} *$${data.tokenName.toUpperCase()}*
\`CA: ...${caShort}\`

${emoji} *${pnl.isProfit ? 'PROFIT' : 'LOSS'}*
\`\`\`
${sign}${pnl.pnlPercent.toFixed(1)}%
${sign}${formatNumber(pnl.pnlAmount)} PLS
\`\`\`

📊 *Stats:*
▸ Entry: \`${formatPrice(data.buyPrice)}\`
▸ Current: \`${formatPrice(data.currentPrice)}\`
▸ Amount: \`${formatNumber(data.amount)}\`
▸ Invested: \`${formatNumber(pnl.invested)} PLS\`
▸ Value: \`${formatNumber(pnl.currentValue)} PLS\`

━━━━━━━━━━━━━━━━━━━━━
_Powered by DTGC.io_
  `.trim();
}

/**
 * Generate HTML for P&L card (for image generation)
 */
export function generatePnLCardHTML(data: PnLData, backgroundBase64?: string): string {
  const pnl = calculatePnL(data);
  const caShort = data.contractAddress.slice(-4).toUpperCase();
  const sign = pnl.isProfit ? '+' : '';

  const profitColor = '#D4AF37';
  const lossColor = '#FF4444';
  const mainColor = pnl.isProfit ? profitColor : lossColor;

  // Generate random stars
  let starsHTML = '';
  for (let i = 0; i < 25; i++) {
    const left = Math.random() * 100;
    const top = Math.random() * 50;
    const delay = Math.random() * 2;
    const opacity = Math.random() * 0.5 + 0.3;
    starsHTML += `<div class="star" style="left:${left}%;top:${top}%;animation-delay:${delay}s;opacity:${opacity}"></div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      width: 400px;
      height: 520px;
      font-family: 'Orbitron', sans-serif;
      overflow: hidden;
    }

    .card {
      width: 400px;
      height: 520px;
      position: relative;
      background: #0a0a0a;
    }

    .bg {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background-image: url('${backgroundBase64 || 'mando-bg.png'}');
      background-size: cover;
      background-position: center top;
      filter: brightness(0.65);
    }

    .overlay {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: linear-gradient(180deg,
        rgba(0,0,0,0.2) 0%,
        rgba(0,0,0,0.5) 50%,
        rgba(0,0,0,0.9) 100%);
    }

    .star-glow {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: radial-gradient(ellipse at 50% 20%, rgba(255,255,255,0.08) 0%, transparent 50%);
    }

    .stars { position: absolute; top: 0; left: 0; width: 100%; height: 60%; }

    .star {
      position: absolute;
      width: 2px; height: 2px;
      background: #fff;
      border-radius: 50%;
      animation: twinkle 2s ease-in-out infinite;
    }

    @keyframes twinkle {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 1; }
    }

    .content {
      position: relative;
      z-index: 10;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 24px;
      color: #fff;
    }

    .header {
      position: absolute;
      top: 20px; left: 20px; right: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .logo {
      font-size: 14px;
      font-weight: 700;
      color: #D4AF37;
      text-shadow: 0 0 15px rgba(212,175,55,0.8);
      letter-spacing: 3px;
    }

    .chain {
      font-size: 11px;
      color: rgba(255,255,255,0.8);
      background: rgba(0,0,0,0.6);
      padding: 5px 12px;
      border-radius: 12px;
      border: 1px solid rgba(212,175,55,0.4);
    }

    .token-name {
      font-size: 36px;
      font-weight: 900;
      color: #fff;
      text-shadow: 0 0 30px rgba(255,255,255,0.6), 0 3px 6px rgba(0,0,0,0.9);
      letter-spacing: 2px;
      margin-bottom: 6px;
    }

    .ca {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
      font-family: monospace;
      letter-spacing: 2px;
      margin-bottom: 16px;
    }

    .pnl-box {
      background: rgba(0,0,0,0.7);
      border-radius: 16px;
      padding: 20px;
      border: 2px solid ${mainColor}80;
      box-shadow: 0 0 30px ${mainColor}33;
    }

    .pnl-label {
      font-size: 12px;
      color: rgba(255,255,255,0.6);
      text-transform: uppercase;
      letter-spacing: 3px;
      margin-bottom: 8px;
    }

    .pnl-value {
      font-size: 48px;
      font-weight: 900;
      color: ${mainColor};
      text-shadow: 0 0 40px ${mainColor}, 0 0 80px ${mainColor}80;
      line-height: 1;
      margin-bottom: 6px;
    }

    .pnl-amount {
      font-size: 18px;
      color: ${mainColor};
    }

    .stats {
      display: flex;
      justify-content: space-between;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.15);
    }

    .stat { text-align: center; }

    .stat-label {
      font-size: 10px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .stat-value {
      font-size: 14px;
      color: #fff;
      font-weight: 600;
      margin-top: 4px;
    }

    .footer {
      margin-top: 16px;
      text-align: center;
      font-size: 11px;
      color: rgba(255,255,255,0.4);
      letter-spacing: 1px;
    }

    .footer .gold { color: #D4AF37; font-weight: 700; }
  </style>
</head>
<body>
  <div class="card">
    <div class="bg"></div>
    <div class="overlay"></div>
    <div class="star-glow"></div>
    <div class="stars">${starsHTML}</div>

    <div class="content">
      <div class="header">
        <span class="logo">⚜️ DTRADER</span>
        <span class="chain">PulseChain</span>
      </div>

      <div class="token-name">$${data.tokenName.toUpperCase()}</div>
      <div class="ca">CA: ...${caShort}</div>

      <div class="pnl-box">
        <div class="pnl-label">${pnl.isProfit ? '🏆 Profit' : '📉 Loss'}</div>
        <div class="pnl-value">${sign}${pnl.pnlPercent.toFixed(1)}%</div>
        <div class="pnl-amount">${sign}${formatNumber(pnl.pnlAmount)} PLS</div>

        <div class="stats">
          <div class="stat">
            <div class="stat-label">Entry</div>
            <div class="stat-value">${formatPrice(data.buyPrice)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Current</div>
            <div class="stat-value">${formatPrice(data.currentPrice)}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Amount</div>
            <div class="stat-value">${formatNumber(data.amount)}</div>
          </div>
        </div>
      </div>

      <div class="footer">Powered by <span class="gold">DTGC.io</span></div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Store for tracking user positions (for P&L calculation)
 */
interface Position {
  tokenAddress: string;
  tokenName: string;
  buyPrice: number;
  amount: number;
  timestamp: number;
}

class PositionStore {
  private filePath: string;
  private data: Map<string, Position[]>; // userId -> positions

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'positions.json');
    this.data = this.load();
  }

  private load(): Map<string, Position[]> {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        return new Map(Object.entries(raw));
      }
    } catch {}
    return new Map();
  }

  private save(): void {
    const obj = Object.fromEntries(this.data);
    fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
  }

  addPosition(userId: string, position: Position): void {
    if (!this.data.has(userId)) {
      this.data.set(userId, []);
    }
    this.data.get(userId)!.push(position);
    this.save();
  }

  getPositions(userId: string): Position[] {
    return this.data.get(userId) || [];
  }

  getPosition(userId: string, tokenAddress: string): Position | undefined {
    const positions = this.data.get(userId) || [];
    return positions.find(p => p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
  }

  updatePosition(userId: string, tokenAddress: string, updates: Partial<Position>): void {
    const positions = this.data.get(userId) || [];
    const idx = positions.findIndex(p => p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
    if (idx !== -1) {
      positions[idx] = { ...positions[idx], ...updates };
      this.save();
    }
  }

  removePosition(userId: string, tokenAddress: string): void {
    const positions = this.data.get(userId) || [];
    const filtered = positions.filter(p => p.tokenAddress.toLowerCase() !== tokenAddress.toLowerCase());
    this.data.set(userId, filtered);
    this.save();
  }
}

export const positionStore = new PositionStore();
