"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.positionStore = void 0;
exports.formatNumber = formatNumber;
exports.generatePnLMessage = generatePnLMessage;
exports.calculatePnL = calculatePnL;
exports.canGenerateImages = canGenerateImages;
exports.generatePnLCardImage = generatePnLCardImage;
exports.generatePnLTextCard = generatePnLTextCard;
exports.generateSingleTradeCard = generateSingleTradeCard;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Try to load Jimp for image generation
let Jimp = null;
try {
    Jimp = require('jimp');
}
catch (e) {
    console.log('Jimp not available - P&L cards will be text-only');
}
function formatNumber(value) {
    const abs = Math.abs(value);
    if (abs >= 1e6)
        return (value / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3)
        return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
}
function generatePnLMessage(data) {
    const invested = data.buyPrice * data.amount;
    const current = data.currentPrice * data.amount;
    const pnl = current - invested;
    const pct = invested > 0 ? (pnl / invested) * 100 : 0;
    const isProfit = pnl >= 0;
    const sign = isProfit ? '+' : '';
    const emoji = isProfit ? '🏆' : '📉';
    return `⚜️ *DTRADER P&L*\n━━━━━━━━━━━━━━━━━━\n\n${isProfit ? '🟢' : '🔴'} *$${data.tokenName}* \`...${data.contractAddress.slice(-4)}\`\n\n${emoji} *${isProfit ? 'PROFIT' : 'LOSS'}*\n\`${sign}${pct.toFixed(1)}%\`\n\`${sign}${formatNumber(pnl)} PLS\`\n\n_Powered by DTGC.io_`;
}
function calculatePnL(d) {
    const inv = d.buyPrice * d.amount;
    const cur = d.currentPrice * d.amount;
    return { isProfit: cur >= inv, pnlPercent: inv > 0 ? ((cur - inv) / inv) * 100 : 0, pnlAmount: cur - inv };
}
class PositionStore {
    filePath;
    data;
    constructor() {
        const dir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        this.filePath = path.join(dir, 'positions.json');
        this.data = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath))
                return new Map(Object.entries(JSON.parse(fs.readFileSync(this.filePath, 'utf-8'))));
        }
        catch { }
        return new Map();
    }
    save() { fs.writeFileSync(this.filePath, JSON.stringify(Object.fromEntries(this.data), null, 2)); }
    getPositions(userId) { return this.data.get(userId) || []; }
    getPosition(userId, addr) { return this.getPositions(userId).find(p => p.tokenAddress.toLowerCase() === addr.toLowerCase()); }
    addPosition(userId, pos) { if (!this.data.has(userId))
        this.data.set(userId, []); this.data.get(userId).push(pos); this.save(); }
}
exports.positionStore = new PositionStore();
/**
 * Check if image generation is available
 */
function canGenerateImages() {
    return Jimp !== null;
}
/**
 * Find the Mando sniper image
 */
function findMandoImage() {
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
async function generatePnLCardImage(summary, trades, username) {
    if (!Jimp) {
        throw new Error('Image generation not available');
    }
    // Card dimensions
    const width = 800;
    const height = 600;
    // Create base image
    let image;
    const mandoPath = findMandoImage();
    if (mandoPath) {
        try {
            // Load Mando background
            image = await Jimp.read(mandoPath);
            image.resize(width, height);
            // Add dark overlay
            const overlay = new Jimp(width, height, 0x000000B3); // Black with 70% opacity
            image.composite(overlay, 0, 0);
        }
        catch (e) {
            console.log('Could not load Mando image, using gradient');
            image = new Jimp(width, height, 0x1a1a2eFF);
        }
    }
    else {
        // Create gradient-like background
        image = new Jimp(width, height, 0x1a1a2eFF);
    }
    // Load font - Jimp has built-in fonts
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    // Header
    image.print(fontWhite, 0, 20, {
        text: '⚜️ DTG BOND BOT ⚜️',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 50);
    // Username
    if (username) {
        image.print(fontSmall, 0, 60, {
            text: `@${username}`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width, 30);
    }
    // Main P&L
    const isProfit = summary.totalPnlPls >= 0;
    const sign = isProfit ? '+' : '';
    const pnlText = `${sign}${formatNumber(summary.totalPnlPls)} PLS`;
    const pnlPercentText = `${sign}${summary.totalPnlPercent.toFixed(2)}%`;
    image.print(fontLarge, 0, 120, {
        text: pnlText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 80);
    image.print(fontWhite, 0, 200, {
        text: pnlPercentText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 50);
    // Stats
    const winRate = summary.totalTrades > 0 ? (summary.wins / summary.totalTrades * 100) : 0;
    const statsText = `Trades: ${summary.totalTrades} | Wins: ${summary.wins} | Losses: ${summary.losses} | Win Rate: ${winRate.toFixed(1)}%`;
    image.print(fontSmall, 0, 270, {
        text: statsText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 30);
    // Best/Worst
    if (summary.bestTrade) {
        image.print(fontSmall, 50, 320, {
            text: `🏆 Best: ${summary.bestTrade.symbol} (+${summary.bestTrade.pnlPercent.toFixed(1)}%)`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width / 2, 30);
    }
    if (summary.worstTrade) {
        image.print(fontSmall, width / 2, 320, {
            text: `📉 Worst: ${summary.worstTrade.symbol} (${summary.worstTrade.pnlPercent.toFixed(1)}%)`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width / 2 - 50, 30);
    }
    // Recent trades header
    image.print(fontWhite, 0, 370, {
        text: '━━━ Recent Trades ━━━',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 40);
    // List trades
    const displayTrades = trades.slice(0, 4);
    displayTrades.forEach((trade, i) => {
        const y = 410 + (i * 35);
        const tradeSign = trade.isWin ? '+' : '';
        const emoji = trade.isWin ? '🟢' : '🔴';
        const tradeText = `${emoji} ${trade.symbol}: ${tradeSign}${trade.pnlPercent.toFixed(1)}% (${tradeSign}${formatNumber(trade.pnlPls)} PLS)`;
        image.print(fontSmall, 0, y, {
            text: tradeText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width, 35);
    });
    if (trades.length === 0) {
        image.print(fontSmall, 0, 440, {
            text: 'No trades yet',
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width, 30);
    }
    // Footer
    const now = new Date();
    const dateStr = now.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    image.print(fontSmall, 0, height - 40, {
        text: `dtgc.io/gold | @DTGBondBot | ${dateStr}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 30);
    // Return as buffer
    return image.getBufferAsync(Jimp.MIME_PNG);
}
/**
 * Generate a text-based P&L summary when images aren't available
 */
function generatePnLTextCard(summary, trades, username) {
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
async function generateSingleTradeCard(symbol, entryPls, exitPls, tokensAmount, txHash) {
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
    image.print(fontWhite, 0, 20, {
        text: '⚜️ DTG BOND BOT',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 50);
    // Token
    image.print(fontWhite, 0, 80, {
        text: `$${symbol}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 50);
    // P&L
    const sign = isProfit ? '+' : '';
    image.print(fontLarge, 0, 140, {
        text: `${sign}${pnlPercent.toFixed(1)}%`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 80);
    image.print(fontWhite, 0, 220, {
        text: `${sign}${formatNumber(pnl)} PLS`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 50);
    // Details
    image.print(fontSmall, 0, 290, {
        text: `Entry: ${formatNumber(entryPls)} PLS → Exit: ${formatNumber(exitPls)} PLS`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 30);
    image.print(fontSmall, 0, 320, {
        text: `Tokens: ${formatNumber(tokensAmount)}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 30);
    // Footer
    image.print(fontSmall, 0, height - 30, {
        text: 'dtgc.io/gold | @DTGBondBot',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 30);
    return image.getBufferAsync(Jimp.MIME_PNG);
}
//# sourceMappingURL=pnlCard.js.map