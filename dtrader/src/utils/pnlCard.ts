import * as fs from 'fs';
import * as path from 'path';

export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toFixed(2);
}

export function generatePnLMessage(data: { tokenName: string; contractAddress: string; buyPrice: number; currentPrice: number; amount: number }): string {
  const invested = data.buyPrice * data.amount;
  const current = data.currentPrice * data.amount;
  const pnl = current - invested;
  const pct = invested > 0 ? (pnl / invested) * 100 : 0;
  const isProfit = pnl >= 0;
  const sign = isProfit ? '+' : '';
  const emoji = isProfit ? '🏆' : '📉';
  return `⚜️ *DTRADER P&L*\n━━━━━━━━━━━━━━━━━━\n\n${isProfit ? '🟢' : '🔴'} *$${data.tokenName}* \`...${data.contractAddress.slice(-4)}\`\n\n${emoji} *${isProfit ? 'PROFIT' : 'LOSS'}*\n\`${sign}${pct.toFixed(1)}%\`\n\`${sign}${formatNumber(pnl)} PLS\`\n\n_Powered by DTGC.io_`;
}

export function calculatePnL(d: { buyPrice: number; currentPrice: number; amount: number }) {
  const inv = d.buyPrice * d.amount;
  const cur = d.currentPrice * d.amount;
  return { isProfit: cur >= inv, pnlPercent: inv > 0 ? ((cur - inv) / inv) * 100 : 0, pnlAmount: cur - inv };
}

interface Position { tokenAddress: string; tokenName: string; buyPrice: number; amount: number; timestamp: number; }

class PositionStore {
  private filePath: string;
  private data: Map<string, Position[]>;
  constructor() {
    const dir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, 'positions.json');
    this.data = this.load();
  }
  private load(): Map<string, Position[]> {
    try { if (fs.existsSync(this.filePath)) return new Map(Object.entries(JSON.parse(fs.readFileSync(this.filePath, 'utf-8')))); } catch {}
    return new Map();
  }
  private save(): void { fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.data), null, 2)); }
  getPositions(userId: string): Position[] { return this.data.get(userId) || []; }
  getPosition(userId: string, addr: string): Position | undefined { return this.getPositions(userId).find(p => p.tokenAddress.toLowerCase() === addr.toLowerCase()); }
  addPosition(userId: string, pos: Position): void { if (!this.data.has(userId)) this.data.set(userId, []); this.data.get(userId)!.push(pos); this.save(); }
}

export const positionStore = new PositionStore();
