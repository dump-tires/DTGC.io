import * as fs from 'fs';
import * as path from 'path';

// Try to load Jimp for image generation
let Jimp: any = null;
try {
  Jimp = require('jimp');
} catch (e) {
  console.log('Jimp not available - P&L cards will be text-only');
}

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

// ═══════════════════════════════════════════════════════════════════════════
// P&L CARD IMAGE GENERATOR
// Uses Mando sniper image as background with P&L overlay
// ═══════════════════════════════════════════════════════════════════════════

export interface PnLSummary {
  totalTrades: number;
  wins: number;
  losses: number;
  totalPnlPls: number;
  totalPnlPercent: number;
  bestTrade: {
    symbol: string;
    pnlPercent: number;
  } | null;
  worstTrade: {
    symbol: string;
    pnlPercent: number;
  } | null;
}

export interface TradeForCard {
  symbol: string;
  amountPls: number;
  pnlPls: number;
  pnlPercent: number;
  isWin: boolean;
}

/**
 * Check if image generation is available
 */
export function canGenerateImages(): boolean {
  return Jimp !== null;
}

/**
 * Find the Mando sniper image
 */
function findMandoImage(): string | null {
  const possiblePaths = [
    path.join(process.cwd(), '..', 'public', 'images', 'mando-sniper.png'),
    path.join(process.cwd(), 'public', 'images', 'mando-sniper.png'),
    '/app/public/images/mando-sniper.png',
    path.join(__dirname, '..', '..', '..', 'public', 'images', 'mando-sniper.png'),
  ];

  for (const imgPath of possiblePaths) {
    if (fs.existsSync(imgPath)) {
      return imgPath;
    }
  }
  return null;
}

/**
 * Generate a P&L card image with Mando background
 * Returns the image as a Buffer (PNG)
 */
export async function generatePnLCardImage(
  summary: PnLSummary,
  trades: TradeForCard[],
  username?: string
): Promise<Buffer> {
  if (!Jimp) {
    throw new Error('Image generation not available');
  }

  // Card dimensions
  const width = 800;
  const height = 600;

  // Create base image
  let image: any;
  const mandoPath = findMandoImage();

  if (mandoPath) {
    try {
      // Load Mando background
      image = await Jimp.read(mandoPath);
      image.resize(width, height);
      // Add dark overlay
      const overlay = new Jimp(width, height, 0x000000B3); // Black with 70% opacity
      image.composite(overlay, 0, 0);
    } catch (e) {
      console.log('Could not load Mando image, using gradient');
      image = new Jimp(width, height, 0x1a1a2eFF);
    }
  } else {
    // Create gradient-like background
    image = new Jimp(width, height, 0x1a1a2eFF);
  }

  // Load font - Jimp has built-in fonts
  const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

  // Header
  image.print(
    fontWhite,
    0, 20,
    {
      text: '⚜️ DTG BOND BOT ⚜️',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    },
    width, 50
  );

  // Username
  if (username) {
    image.print(
      fontSmall,
      0, 60,
      {
        text: `@${username}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      width, 30
    );
  }

  // Main P&L
  const isProfit = summary.totalPnlPls >= 0;
  const sign = isProfit ? '+' : '';
  const pnlText = `${sign}${formatNumber(summary.totalPnlPls)} PLS`;
  const pnlPercentText = `${sign}${summary.totalPnlPercent.toFixed(2)}%`;

  image.print(
    fontLarge,
    0, 120,
    {
      text: pnlText,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    },
    width, 80
  );

  image.print(
    fontWhite,
    0, 200,
    {
      text: pnlPercentText,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    },
    width, 50
  );

  // Stats
  const winRate = summary.totalTrades > 0 ? (summary.wins / summary.totalTrades * 100) : 0;
  const statsText = `Trades: ${summary.totalTrades} | Wins: ${summary.wins} | Losses: ${summary.losses} | Win Rate: ${winRate.toFixed(1)}%`;
  image.print(
    fontSmall,
    0, 270,
    {
      text: statsText,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    },
    width, 30
  );

  // Best/Worst
  if (summary.bestTrade) {
    image.print(
      fontSmall,
      50, 320,
      {
        text: `🏆 Best: ${summary.bestTrade.symbol} (+${summary.bestTrade.pnlPercent.toFixed(1)}%)`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      width / 2, 30
    );
  }

  if (summary.worstTrade) {
    image.print(
      fontSmall,
      width / 2, 320,
      {
        text: `📉 Worst: ${summary.worstTrade.symbol} (${summary.worstTrade.pnlPercent.toFixed(1)}%)`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      width / 2 - 50, 30
    );
  }

  // Recent trades header
  image.print(
    fontWhite,
    0, 370,
    {
      text: '━━━ Recent Trades ━━━',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    },
    width, 40
  );

  // List trades
  const displayTrades = trades.slice(0, 4);
  displayTrades.forEach((trade, i) => {
    const y = 410 + (i * 35);
    const tradeSign = trade.isWin ? '+' : '';
    const emoji = trade.isWin ? '🟢' : '🔴';
    const tradeText = `${emoji} ${trade.symbol}: ${tradeSign}${trade.pnlPercent.toFixed(1)}% (${tradeSign}${formatNumber(trade.pnlPls)} PLS)`;

    image.print(
      fontSmall,
      0, y,
      {
        text: tradeText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      width, 35
    );
  });

  if (trades.length === 0) {
    image.print(
      fontSmall,
      0, 440,
      {
        text: 'No trades yet',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
      },
      width, 30
    );
  }

  // Footer
  const now = new Date();
  const dateStr = now.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  image.print(
    fontSmall,
    0, height - 40,
    {
      text: `dtgc.io/gold | @DTGBondBot | ${dateStr}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    },
    width, 30
  );

  // Return as buffer
  return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * Generate a text-based P&L summary when images aren't available
 */
export function generatePnLTextCard(
  summary: PnLSummary,
  trades: TradeForCard[],
  username?: string
): string {
  const isProfit = summary.totalPnlPls >= 0;
  const sign = isProfit ? '+' : '';
  const winRate = summary.totalTrades > 0 ? (summary.wins / summary.totalTrades * 100) : 0;

  let text = `⚜️ **DTG BOND BOT P&L CARD** ⚜️\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  if (username) {
    text += `👤 @${username}\n\n`;
  }

  // Main P&L
  text += `${isProfit ? '🟢' : '🔴'} **${sign}${formatNumber(summary.totalPnlPls)} PLS**\n`;
  text += `📊 ${sign}${summary.totalPnlPercent.toFixed(2)}%\n\n`;

  // Stats
  text += `━━━ Statistics ━━━\n`;
  text += `📈 Total Trades: **${summary.totalTrades}**\n`;
  text += `✅ Wins: **${summary.wins}**\n`;
  text += `❌ Losses: **${summary.losses}**\n`;
  text += `🎯 Win Rate: **${winRate.toFixed(1)}%**\n\n`;

  // Best/Worst
  if (summary.bestTrade) {
    text += `🏆 Best: ${summary.bestTrade.symbol} (+${summary.bestTrade.pnlPercent.toFixed(1)}%)\n`;
  }
  if (summary.worstTrade) {
    text += `📉 Worst: ${summary.worstTrade.symbol} (${summary.worstTrade.pnlPercent.toFixed(1)}%)\n`;
  }

  // Recent trades
  if (trades.length > 0) {
    text += `\n━━━ Recent Trades ━━━\n`;
    const displayTrades = trades.slice(0, 5);
    displayTrades.forEach(trade => {
      const tradeSign = trade.isWin ? '+' : '';
      const emoji = trade.isWin ? '🟢' : '🔴';
      text += `${emoji} ${trade.symbol}: ${tradeSign}${trade.pnlPercent.toFixed(1)}% (${tradeSign}${formatNumber(trade.pnlPls)} PLS)\n`;
    });
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🌐 dtgc.io/gold | @DTGBondBot`;

  return text;
}

/**
 * Generate a simple single-trade P&L card
 */
export async function generateSingleTradeCard(
  symbol: string,
  entryPls: number,
  exitPls: number,
  tokensAmount: number,
  txHash?: string
): Promise<Buffer | null> {
  if (!Jimp) {
    return null;
  }

  const width = 600;
  const height = 400;

  const pnl = exitPls - entryPls;
  const pnlPercent = entryPls > 0 ? (pnl / entryPls) * 100 : 0;
  const isProfit = pnl >= 0;

  // Create background
  const bgColor = isProfit ? 0x0a2e1aFF : 0x2e0a0aFF;
  const image = new Jimp(width, height, bgColor);

  const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
  const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);

  // Header
  image.print(
    fontWhite,
    0, 20,
    {
      text: '⚜️ DTG BOND BOT',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 50
  );

  // Token
  image.print(
    fontWhite,
    0, 80,
    {
      text: `$${symbol}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 50
  );

  // P&L
  const sign = isProfit ? '+' : '';
  image.print(
    fontLarge,
    0, 140,
    {
      text: `${sign}${pnlPercent.toFixed(1)}%`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 80
  );

  image.print(
    fontWhite,
    0, 220,
    {
      text: `${sign}${formatNumber(pnl)} PLS`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 50
  );

  // Details
  image.print(
    fontSmall,
    0, 290,
    {
      text: `Entry: ${formatNumber(entryPls)} PLS → Exit: ${formatNumber(exitPls)} PLS`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 30
  );

  image.print(
    fontSmall,
    0, 320,
    {
      text: `Tokens: ${formatNumber(tokensAmount)}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 30
  );

  // Footer
  image.print(
    fontSmall,
    0, height - 30,
    {
      text: 'dtgc.io/gold | @DTGBondBot',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 30
  );

  return image.getBufferAsync(Jimp.MIME_PNG);
}
