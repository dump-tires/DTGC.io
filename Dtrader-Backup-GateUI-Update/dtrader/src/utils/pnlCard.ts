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
 * Mando image collection for P&L cards
 * Images are stored in public/images/mando/ folder
 */
const MANDO_IMAGES = [
  'mando-sniper.png',
  'mando-hallway.jpg',
  'mando-gold-aim.jpg',
  'mando-lava.jpg',
  'mando-gold-lava.jpg',
  'mando-watercolor.jpg',
  'mando-aiming.jpg',
  'mando-desert.jpg',
];

/**
 * Find the Mando sniper image (randomly selects from collection)
 */
function findMandoImage(): string | null {
  const basePaths = [
    path.join(process.cwd(), '..', 'public', 'images'),
    path.join(process.cwd(), 'public', 'images'),
    '/app/public/images',
    path.join(__dirname, '..', '..', '..', 'public', 'images'),
  ];

  // First check for mando subfolder with multiple images
  for (const basePath of basePaths) {
    const mandoFolder = path.join(basePath, 'mando');
    if (fs.existsSync(mandoFolder)) {
      // Get all images in mando folder
      try {
        const files = fs.readdirSync(mandoFolder).filter(f =>
          f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
        );
        if (files.length > 0) {
          // Random selection
          const randomFile = files[Math.floor(Math.random() * files.length)];
          return path.join(mandoFolder, randomFile);
        }
      } catch {}
    }

    // Fall back to single mando-sniper.png
    const singlePath = path.join(basePath, 'mando-sniper.png');
    if (fs.existsSync(singlePath)) {
      return singlePath;
    }
  }
  return null;
}

/**
 * Get a specific Mando image by type
 */
function getMandoImageByType(type: 'victory' | 'pnl' | 'snipe'): string | null {
  const basePaths = [
    path.join(process.cwd(), '..', 'public', 'images'),
    path.join(process.cwd(), 'public', 'images'),
    '/app/public/images',
    path.join(__dirname, '..', '..', '..', 'public', 'images'),
  ];

  // Map types to preferred images
  const typePreferences: Record<string, string[]> = {
    victory: ['mando-gold-aim.jpg', 'mando-hallway.jpg', 'mando-gold-lava.jpg'],
    pnl: ['mando-sniper.png', 'mando-aiming.jpg', 'mando-desert.jpg'],
    snipe: ['mando-lava.jpg', 'mando-aiming.jpg', 'mando-watercolor.jpg'],
  };

  const preferred = typePreferences[type] || MANDO_IMAGES;

  for (const basePath of basePaths) {
    const mandoFolder = path.join(basePath, 'mando');

    // Check preferred images first
    for (const imgName of preferred) {
      const imgPath = path.join(mandoFolder, imgName);
      if (fs.existsSync(imgPath)) {
        return imgPath;
      }
    }

    // Check any image in folder
    if (fs.existsSync(mandoFolder)) {
      try {
        const files = fs.readdirSync(mandoFolder).filter(f =>
          f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')
        );
        if (files.length > 0) {
          return path.join(mandoFolder, files[Math.floor(Math.random() * files.length)]);
        }
      } catch {}
    }

    // Fall back to single image
    const singlePath = path.join(basePath, 'mando-sniper.png');
    if (fs.existsSync(singlePath)) {
      return singlePath;
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

// ═══════════════════════════════════════════════════════════════════════════
// 🏆 VICTORY CARD GENERATOR - For Snipe/Limit Order Fills
// Uses Mando images with laser-etched stats overlay
// ═══════════════════════════════════════════════════════════════════════════

export interface VictoryCardData {
  type: 'snipe' | 'limit_buy' | 'limit_sell' | 'take_profit' | 'instabond';
  tokenSymbol: string;
  tokenAddress: string;
  amountPls: number;
  tokensReceived?: number;
  pnlPls?: number;
  pnlPercent?: number;
  txHash?: string;
  pairAddress?: string;
  username?: string;
}

/**
 * Generate a beautiful Victory Card with Mando background
 * Laser-etched stats style overlay
 */
export async function generateVictoryCard(data: VictoryCardData): Promise<Buffer> {
  if (!Jimp) {
    throw new Error('Image generation not available');
  }

  const width = 800;
  const height = 1000;

  // Load Mando background
  let image: any;
  const mandoPath = getMandoImageByType('victory');

  if (mandoPath) {
    try {
      image = await Jimp.read(mandoPath);
      // Resize to fit card - cover mode
      const scaleX = width / image.getWidth();
      const scaleY = height / image.getHeight();
      const scale = Math.max(scaleX, scaleY);
      image.scale(scale);
      // Center crop
      const cropX = (image.getWidth() - width) / 2;
      const cropY = (image.getHeight() - height) / 2;
      image.crop(Math.max(0, cropX), Math.max(0, cropY), width, height);

      // Add gradient overlay (darker at top and bottom for text)
      const overlay = new Jimp(width, height, 0x00000000);
      // Top gradient
      for (let y = 0; y < 250; y++) {
        const opacity = Math.floor(200 * (1 - y / 250));
        for (let x = 0; x < width; x++) {
          overlay.setPixelColor(Jimp.rgbaToInt(0, 0, 0, opacity), x, y);
        }
      }
      // Bottom gradient
      for (let y = height - 300; y < height; y++) {
        const opacity = Math.floor(220 * ((y - (height - 300)) / 300));
        for (let x = 0; x < width; x++) {
          overlay.setPixelColor(Jimp.rgbaToInt(0, 0, 0, opacity), x, y);
        }
      }
      image.composite(overlay, 0, 0);
    } catch (e) {
      console.log('Could not load Mando image, using dark background');
      image = new Jimp(width, height, 0x0a0a14FF);
    }
  } else {
    image = new Jimp(width, height, 0x0a0a14FF);
  }

  // Load fonts
  const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
  const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
  const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

  // Type emoji and text
  const typeConfig: Record<string, { emoji: string; title: string }> = {
    snipe: { emoji: '🎯', title: 'SNIPE VICTORY' },
    instabond: { emoji: '🔥', title: 'INSTABOND WIN' },
    limit_buy: { emoji: '📈', title: 'LIMIT BUY FILLED' },
    limit_sell: { emoji: '📉', title: 'LIMIT SELL FILLED' },
    take_profit: { emoji: '💰', title: 'TAKE PROFIT HIT' },
  };

  const config = typeConfig[data.type] || typeConfig.snipe;

  // Header - "laser etched" style
  image.print(
    fontMedium,
    0, 30,
    {
      text: '⚜️ DTG BOND BOT ⚜️',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 50
  );

  // Victory type
  image.print(
    fontLarge,
    0, 90,
    {
      text: `${config.emoji} ${config.title}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 80
  );

  // Token symbol (large)
  image.print(
    fontLarge,
    0, 180,
    {
      text: `$${data.tokenSymbol}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 80
  );

  // Stats section - bottom portion with dark overlay
  const statsY = height - 380;

  // Draw "laser etched" line
  image.print(
    fontSmall,
    0, statsY,
    {
      text: '━━━━━━━━━ TRADE STATS ━━━━━━━━━',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 30
  );

  // Stats grid
  const statItems = [
    { label: 'INVESTED', value: `${formatNumber(data.amountPls)} PLS` },
    { label: 'TOKENS', value: data.tokensReceived ? formatNumber(data.tokensReceived) : 'Pending' },
  ];

  if (data.pnlPls !== undefined) {
    const sign = data.pnlPls >= 0 ? '+' : '';
    statItems.push({ label: 'P&L', value: `${sign}${formatNumber(data.pnlPls)} PLS` });
  }

  if (data.pnlPercent !== undefined) {
    const sign = data.pnlPercent >= 0 ? '+' : '';
    statItems.push({ label: 'GAIN', value: `${sign}${data.pnlPercent.toFixed(1)}%` });
  }

  // Print stats in a grid
  statItems.forEach((stat, i) => {
    const x = i % 2 === 0 ? 50 : width / 2 + 50;
    const y = statsY + 40 + Math.floor(i / 2) * 70;

    // Label
    image.print(
      fontSmall,
      x, y,
      { text: stat.label },
      width / 2 - 100, 25
    );

    // Value
    image.print(
      fontMedium,
      x, y + 20,
      { text: stat.value },
      width / 2 - 100, 40
    );
  });

  // Contract address (abbreviated)
  image.print(
    fontSmall,
    0, height - 130,
    {
      text: `CA: ${data.tokenAddress.slice(0, 10)}...${data.tokenAddress.slice(-8)}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 25
  );

  // Pair address if available
  if (data.pairAddress) {
    image.print(
      fontSmall,
      0, height - 105,
      {
        text: `Pair: ${data.pairAddress.slice(0, 10)}...${data.pairAddress.slice(-8)}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
      },
      width, 25
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
    0, height - 60,
    {
      text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 20
  );

  image.print(
    fontSmall,
    0, height - 35,
    {
      text: `dtgc.io/gold | @DTGBondBot | ${dateStr}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    },
    width, 30
  );

  // Username watermark if provided
  if (data.username) {
    image.print(
      fontSmall,
      width - 150, 10,
      { text: `@${data.username}` },
      140, 25
    );
  }

  return image.getBufferAsync(Jimp.MIME_PNG);
}

/**
 * Generate a text-based victory card when images aren't available
 */
export function generateVictoryTextCard(data: VictoryCardData): string {
  const typeConfig: Record<string, { emoji: string; title: string }> = {
    snipe: { emoji: '🎯', title: 'SNIPE VICTORY' },
    instabond: { emoji: '🔥', title: 'INSTABOND WIN' },
    limit_buy: { emoji: '📈', title: 'LIMIT BUY FILLED' },
    limit_sell: { emoji: '📉', title: 'LIMIT SELL FILLED' },
    take_profit: { emoji: '💰', title: 'TAKE PROFIT HIT' },
  };

  const config = typeConfig[data.type] || typeConfig.snipe;

  let text = `🏆🎊 **${config.emoji} ${config.title}** 🎊🏆\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  text += `⚜️ **DTG BOND BOT** ⚜️\n\n`;

  text += `🪙 **$${data.tokenSymbol}**\n`;
  text += `📋 \`${data.tokenAddress}\`\n\n`;

  text += `━━━ TRADE STATS ━━━\n`;
  text += `💰 Invested: **${formatNumber(data.amountPls)} PLS**\n`;

  if (data.tokensReceived) {
    text += `🪙 Tokens: **${formatNumber(data.tokensReceived)}**\n`;
  }

  if (data.pnlPls !== undefined) {
    const sign = data.pnlPls >= 0 ? '+' : '';
    text += `📊 P&L: **${sign}${formatNumber(data.pnlPls)} PLS**\n`;
  }

  if (data.pnlPercent !== undefined) {
    const sign = data.pnlPercent >= 0 ? '+' : '';
    text += `📈 Gain: **${sign}${data.pnlPercent.toFixed(1)}%**\n`;
  }

  if (data.pairAddress) {
    text += `\n🔗 Pair: \`${data.pairAddress}\`\n`;
  }

  if (data.txHash) {
    text += `\n🔗 [View TX](https://scan.pulsechain.com/tx/${data.txHash})\n`;
  }

  text += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `🌐 dtgc.io/gold | @DTGBondBot`;

  return text;
}
