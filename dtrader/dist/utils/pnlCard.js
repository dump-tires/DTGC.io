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
exports.generateVictoryCard = generateVictoryCard;
exports.generateVictoryTextCard = generateVictoryTextCard;
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
    return `⚜️ *DTRADER SNIPER P&L*\n━━━━━━━━━━━━━━━━━━\n\n${isProfit ? '🟢' : '🔴'} *$${data.tokenName}* \`...${data.contractAddress.slice(-4)}\`\n\n${emoji} *${isProfit ? 'PROFIT' : 'LOSS'}*\n\`${sign}${pct.toFixed(1)}%\`\n\`${sign}${formatNumber(pnl)} PLS\`\n\n_Powered by dtgc.io | @DTraderSniper_`;
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
 * Mando image collection for P&L cards
 * Images are stored in dtrader/public/images/mando/ folder
 * Bright, golden aesthetic images preferred - 13 total images!
 */
const MANDO_IMAGES = [
    // Original images
    'mando-sniper.png', // Gold moon sniper (original)
    'mando-hallway-gold.jpg', // Gold armor, marble hallway - VERY BRIGHT
    'mando-hallway-bright.jpg', // Silver armor, bright marble - BRIGHTEST
    'mando-gold-lava.jpg', // Gold armor, volcanic background
    'mando-silver-lava.jpg', // Silver armor, lava scene
    'mando-watercolor.jpg', // Watercolor artistic style
    'mando-watercolor-lava.jpg', // Watercolor with red lava
    // Split from collages - desert series
    'mando-desert-1.jpg', // Gold armor, orange desert
    'mando-desert-2.jpg', // Silver armor aiming, red sky
    'mando-desert-3.jpg', // Planet background, bronze armor
    'mando-desert-4.jpg', // Gold armor, dark lava scene
    // Split from collages - action series
    'mando-action-1.jpg', // Gold armor aiming, red planet
    'mando-action-3.jpg', // Forest background, action pose
];
/**
 * Find the Mando sniper image (randomly selects from collection)
 * Prefers bright gold images for best aesthetic
 */
function findMandoImage() {
    const basePaths = [
        path.join(process.cwd(), 'public', 'images'), // dtrader/public/images
        path.join(process.cwd(), '..', 'public', 'images'),
        '/app/public/images',
        '/app/dtrader/public/images',
        path.join(__dirname, '..', '..', 'public', 'images'),
        path.join(__dirname, '..', '..', '..', 'public', 'images'),
    ];
    // First check for mando subfolder with multiple images
    for (const basePath of basePaths) {
        const mandoFolder = path.join(basePath, 'mando');
        if (fs.existsSync(mandoFolder)) {
            // Get all images in mando folder
            try {
                const files = fs.readdirSync(mandoFolder).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
                if (files.length > 0) {
                    // Random selection
                    const randomFile = files[Math.floor(Math.random() * files.length)];
                    return path.join(mandoFolder, randomFile);
                }
            }
            catch { }
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
 * Uses BRIGHT images for best gold glow aesthetic
 */
function getMandoImageByType(type) {
    const basePaths = [
        path.join(process.cwd(), 'public', 'images'), // dtrader/public/images
        path.join(process.cwd(), '..', 'public', 'images'),
        '/app/public/images',
        '/app/dtrader/public/images',
        path.join(__dirname, '..', '..', 'public', 'images'),
        path.join(__dirname, '..', '..', '..', 'public', 'images'),
    ];
    // Map types to preferred images - BRIGHT images first!
    const typePreferences = {
        victory: ['mando-hallway-gold.jpg', 'mando-hallway-bright.jpg', 'mando-gold-lava.jpg', 'mando-desert-4.jpg', 'mando-sniper.png'],
        pnl: ['mando-hallway-bright.jpg', 'mando-hallway-gold.jpg', 'mando-desert-1.jpg', 'mando-sniper.png', 'mando-gold-lava.jpg'],
        snipe: ['mando-action-1.jpg', 'mando-desert-2.jpg', 'mando-gold-lava.jpg', 'mando-silver-lava.jpg', 'mando-watercolor-lava.jpg'],
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
                const files = fs.readdirSync(mandoFolder).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'));
                if (files.length > 0) {
                    return path.join(mandoFolder, files[Math.floor(Math.random() * files.length)]);
                }
            }
            catch { }
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
 * Find gold bar image for decorating cards
 */
function findGoldBarImage() {
    const basePaths = [
        path.join(process.cwd(), 'public', 'images'), // dtrader/public/images
        path.join(process.cwd(), '..', 'public', 'images'),
        '/app/public/images',
        '/app/dtrader/public/images',
        path.join(__dirname, '..', '..', 'public', 'images'),
        path.join(__dirname, '..', '..', '..', 'public', 'images'),
    ];
    for (const basePath of basePaths) {
        const goldBarPath = path.join(basePath, 'gold_bar.png');
        if (fs.existsSync(goldBarPath)) {
            return goldBarPath;
        }
    }
    return null;
}
/**
 * Calculate how many gold bars to show based on PLS surplus
 * 0 PLS = 0 bars, 10K+ = 1, 50K+ = 2, 100K+ = 3, 500K+ = 4, 1M+ = 5
 */
function getGoldBarCount(plsAmount) {
    const abs = Math.abs(plsAmount);
    if (abs >= 1000000)
        return 5; // 1M+
    if (abs >= 500000)
        return 4; // 500K+
    if (abs >= 100000)
        return 3; // 100K+
    if (abs >= 50000)
        return 2; // 50K+
    if (abs >= 10000)
        return 1; // 10K+
    return 0;
}
/**
 * Generate a P&L card image with Mando background - ENHANCED VERSION
 * Bright gold glow aesthetic with gold bars based on surplus
 * Returns the image as a Buffer (PNG)
 */
async function generatePnLCardImage(summary, trades, username) {
    if (!Jimp) {
        throw new Error('Image generation not available');
    }
    // Card dimensions - wider for better aesthetics
    const width = 900;
    const height = 700;
    // Create base image
    let image;
    const mandoPath = findMandoImage();
    if (mandoPath) {
        try {
            // Load Mando background
            image = await Jimp.read(mandoPath);
            // Calculate scale to cover the card
            const scaleX = width / image.getWidth();
            const scaleY = height / image.getHeight();
            const scale = Math.max(scaleX, scaleY);
            image.scale(scale);
            // Center crop to exact dimensions
            const cropX = Math.max(0, (image.getWidth() - width) / 2);
            const cropY = Math.max(0, (image.getHeight() - height) / 2);
            image.crop(cropX, cropY, width, height);
            // BRIGHTEN the image - make it pop!
            image.brightness(0.15); // Boost brightness
            image.contrast(0.1); // Slight contrast increase
            // Add GOLDEN GLOW overlay (warm gold tint instead of dark black)
            const goldOverlay = new Jimp(width, height, 0x00000000);
            // Create a radial golden glow from center
            const centerX = width / 2;
            const centerY = height / 2;
            const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                    const ratio = dist / maxDist;
                    // Gold-tinted vignette: darker at edges, golden glow in center
                    // Less intense - 40% max opacity at edges
                    const goldR = 255; // Gold
                    const goldG = 215;
                    const goldB = 0;
                    const alpha = Math.floor(100 * ratio); // Subtle vignette
                    goldOverlay.setPixelColor(Jimp.rgbaToInt(0, 0, 0, alpha), x, y);
                }
            }
            image.composite(goldOverlay, 0, 0);
            // Add subtle golden tint to entire image
            const goldTint = new Jimp(width, height, 0xFFD70020); // Gold with 12% opacity
            image.composite(goldTint, 0, 0);
        }
        catch (e) {
            console.log('Could not load Mando image, using golden gradient');
            image = new Jimp(width, height, 0x1a150aFF); // Dark gold base
        }
    }
    else {
        // Create golden gradient background
        image = new Jimp(width, height, 0x1a150aFF);
    }
    // Load fonts
    const fontWhite = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontXL = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
    // Add text shadow effect by drawing header bar at top
    const headerBar = new Jimp(width, 90, 0x00000080); // Semi-transparent black
    image.composite(headerBar, 0, 0);
    // Header - Gold styling
    image.print(fontWhite, 0, 15, {
        text: '=== DTRADER SNIPER ===',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 50);
    // Username
    if (username) {
        image.print(fontSmall, 0, 55, {
            text: `@${username}`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width, 30);
    }
    // Main P&L - HUGE and prominent with text background
    const isProfit = summary.totalPnlPls >= 0;
    const sign = isProfit ? '+' : '';
    const pnlText = `${sign}${formatNumber(summary.totalPnlPls)} PLS`;
    const pnlPercentText = `${sign}${summary.totalPnlPercent.toFixed(2)}%`;
    // P&L background box
    const pnlBgColor = isProfit ? 0x1a4d1a99 : 0x4d1a1a99; // Green or red tint
    const pnlBg = new Jimp(width - 100, 150, pnlBgColor);
    image.composite(pnlBg, 50, 100);
    // Main PLS amount - Large
    image.print(fontLarge, 0, 110, {
        text: pnlText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 80);
    // Percentage below
    image.print(fontWhite, 0, 180, {
        text: pnlPercentText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 50);
    // === GOLD BAR DECORATIONS based on surplus ===
    const goldBarPath = findGoldBarImage();
    const goldBarCount = getGoldBarCount(summary.totalPnlPls);
    if (goldBarPath && goldBarCount > 0) {
        try {
            const goldBar = await Jimp.read(goldBarPath);
            // Resize gold bar to fit nicely
            const barWidth = 60;
            const barHeight = Math.floor(goldBar.getHeight() * (barWidth / goldBar.getWidth()));
            goldBar.resize(barWidth, barHeight);
            // Position gold bars in a row below the P&L
            const totalBarsWidth = goldBarCount * (barWidth + 10) - 10;
            const startX = (width - totalBarsWidth) / 2;
            for (let i = 0; i < goldBarCount; i++) {
                const barX = startX + i * (barWidth + 10);
                image.composite(goldBar.clone(), barX, 255);
            }
        }
        catch (e) {
            console.log('Could not load gold bar image');
        }
    }
    // Stats bar
    const statsBarY = goldBarCount > 0 ? 310 : 270;
    const statsBar = new Jimp(width, 35, 0x00000060);
    image.composite(statsBar, 0, statsBarY);
    const winRate = summary.totalTrades > 0 ? (summary.wins / summary.totalTrades * 100) : 0;
    const statsText = `Trades: ${summary.totalTrades} | Wins: ${summary.wins} | Losses: ${summary.losses} | Win Rate: ${winRate.toFixed(1)}%`;
    image.print(fontSmall, 0, statsBarY + 8, {
        text: statsText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 30);
    // Best/Worst trades
    const bestWorstY = statsBarY + 50;
    if (summary.bestTrade) {
        image.print(fontSmall, 60, bestWorstY, {
            text: `[+] Best: ${summary.bestTrade.symbol} (+${summary.bestTrade.pnlPercent.toFixed(1)}%)`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width / 2, 30);
    }
    if (summary.worstTrade) {
        image.print(fontSmall, width / 2, bestWorstY, {
            text: `[-] Worst: ${summary.worstTrade.symbol} (${summary.worstTrade.pnlPercent.toFixed(1)}%)`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_RIGHT,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width / 2 - 60, 30);
    }
    // Recent trades section with background
    const tradesY = bestWorstY + 50;
    const tradesBox = new Jimp(width - 80, 180, 0x00000050);
    image.composite(tradesBox, 40, tradesY);
    image.print(fontWhite, 0, tradesY + 10, {
        text: '--- Recent Trades ---',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP,
    }, width, 40);
    // List trades
    const displayTrades = trades.slice(0, 4);
    displayTrades.forEach((trade, i) => {
        const y = tradesY + 50 + (i * 32);
        const tradeSign = trade.isWin ? '+' : '';
        const marker = trade.isWin ? '[W]' : '[L]';
        const tradeText = `${marker} ${trade.symbol}: ${tradeSign}${trade.pnlPercent.toFixed(1)}% (${tradeSign}${formatNumber(trade.pnlPls)} PLS)`;
        image.print(fontSmall, 0, y, {
            text: tradeText,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width, 32);
    });
    if (trades.length === 0) {
        image.print(fontSmall, 0, tradesY + 80, {
            text: 'No trades yet',
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
            alignmentY: Jimp.VERTICAL_ALIGN_TOP,
        }, width, 30);
    }
    // Footer bar
    const footerBar = new Jimp(width, 45, 0x00000090);
    image.composite(footerBar, 0, height - 45);
    const now = new Date();
    const dateStr = now.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    image.print(fontSmall, 0, height - 35, {
        text: `dtgc.io | @DTraderSniper | ${dateStr}`,
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
    let text = `⚜️ **DTRADER SNIPER P&L** ⚜️\n`;
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
    text += `🌐 dtgc.io | @DTraderSniper`;
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
    // Header - ASCII safe
    image.print(fontWhite, 0, 20, {
        text: ':: DTRADER SNIPER ::',
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
        text: 'dtgc.io | @DTraderSniper',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 30);
    return image.getBufferAsync(Jimp.MIME_PNG);
}
/**
 * Generate a beautiful Victory Card with Mando background
 * ENHANCED: Bright gold glow aesthetic with gold bars
 */
async function generateVictoryCard(data) {
    if (!Jimp) {
        throw new Error('Image generation not available');
    }
    const width = 800;
    const height = 1000;
    // Load Mando background
    let image;
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
            // BRIGHTEN the image - make it pop!
            image.brightness(0.12);
            image.contrast(0.08);
            // Add GOLDEN GLOW gradient overlay (subtle at edges, golden center)
            const overlay = new Jimp(width, height, 0x00000000);
            // Top gradient - lighter now
            for (let y = 0; y < 200; y++) {
                const opacity = Math.floor(130 * (1 - y / 200)); // Reduced from 200
                for (let x = 0; x < width; x++) {
                    overlay.setPixelColor(Jimp.rgbaToInt(0, 0, 0, opacity), x, y);
                }
            }
            // Bottom gradient - lighter now
            for (let y = height - 350; y < height; y++) {
                const opacity = Math.floor(150 * ((y - (height - 350)) / 350)); // Reduced from 220
                for (let x = 0; x < width; x++) {
                    overlay.setPixelColor(Jimp.rgbaToInt(0, 0, 0, opacity), x, y);
                }
            }
            image.composite(overlay, 0, 0);
            // Add subtle golden tint to entire image
            const goldTint = new Jimp(width, height, 0xFFD70018); // Gold with 10% opacity
            image.composite(goldTint, 0, 0);
        }
        catch (e) {
            console.log('Could not load Mando image, using golden background');
            image = new Jimp(width, height, 0x1a150aFF);
        }
    }
    else {
        image = new Jimp(width, height, 0x1a150aFF);
    }
    // Load fonts
    const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_64_WHITE);
    const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
    // Type markers - ASCII safe (no emojis)
    const typeConfig = {
        snipe: { marker: '[>]', title: 'SNIPE VICTORY' },
        instabond: { marker: '[*]', title: 'INSTABOND WIN' },
        limit_buy: { marker: '[+]', title: 'LIMIT BUY FILLED' },
        limit_sell: { marker: '[-]', title: 'LIMIT SELL FILLED' },
        take_profit: { marker: '[$]', title: 'TAKE PROFIT HIT' },
    };
    const config = typeConfig[data.type] || typeConfig.snipe;
    // Header - "laser etched" style - ASCII safe
    image.print(fontMedium, 0, 30, {
        text: ':: DTRADER SNIPER ::',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 50);
    // Victory type - ASCII safe
    image.print(fontLarge, 0, 90, {
        text: `${config.marker} ${config.title}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 80);
    // Token symbol (large)
    image.print(fontLarge, 0, 180, {
        text: `$${data.tokenSymbol}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 80);
    // === GOLD BAR DECORATIONS based on invested amount ===
    const goldBarPath = findGoldBarImage();
    const goldBarCount = getGoldBarCount(data.amountPls);
    if (goldBarPath && goldBarCount > 0) {
        try {
            const goldBar = await Jimp.read(goldBarPath);
            // Resize gold bar to fit nicely
            const barWidth = 50;
            const barHeight = Math.floor(goldBar.getHeight() * (barWidth / goldBar.getWidth()));
            goldBar.resize(barWidth, barHeight);
            // Position gold bars in a row below the token symbol
            const totalBarsWidth = goldBarCount * (barWidth + 8) - 8;
            const startX = (width - totalBarsWidth) / 2;
            for (let i = 0; i < goldBarCount; i++) {
                const barX = startX + i * (barWidth + 8);
                image.composite(goldBar.clone(), barX, 270);
            }
        }
        catch (e) {
            console.log('Could not load gold bar for victory card');
        }
    }
    // Stats section - bottom portion with dark overlay
    const statsY = height - 380;
    // Draw "laser etched" line - ASCII safe
    image.print(fontSmall, 0, statsY, {
        text: '--------- TRADE STATS ---------',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 30);
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
        image.print(fontSmall, x, y, { text: stat.label }, width / 2 - 100, 25);
        // Value
        image.print(fontMedium, x, y + 20, { text: stat.value }, width / 2 - 100, 40);
    });
    // Contract address (abbreviated)
    image.print(fontSmall, 0, height - 130, {
        text: `CA: ${data.tokenAddress.slice(0, 10)}...${data.tokenAddress.slice(-8)}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 25);
    // Pair address if available
    if (data.pairAddress) {
        image.print(fontSmall, 0, height - 105, {
            text: `Pair: ${data.pairAddress.slice(0, 10)}...${data.pairAddress.slice(-8)}`,
            alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
        }, width, 25);
    }
    // Footer
    const now = new Date();
    const dateStr = now.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    image.print(fontSmall, 0, height - 60, {
        text: '================================',
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 20);
    image.print(fontSmall, 0, height - 35, {
        text: `dtgc.io | @DTraderSniper | ${dateStr}`,
        alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
    }, width, 30);
    // Username watermark if provided
    if (data.username) {
        image.print(fontSmall, width - 150, 10, { text: `@${data.username}` }, 140, 25);
    }
    return image.getBufferAsync(Jimp.MIME_PNG);
}
/**
 * Generate a text-based victory card when images aren't available
 */
function generateVictoryTextCard(data) {
    const typeConfig = {
        snipe: { emoji: '🎯', title: 'SNIPE VICTORY' },
        instabond: { emoji: '🔥', title: 'INSTABOND WIN' },
        limit_buy: { emoji: '📈', title: 'LIMIT BUY FILLED' },
        limit_sell: { emoji: '📉', title: 'LIMIT SELL FILLED' },
        take_profit: { emoji: '💰', title: 'TAKE PROFIT HIT' },
    };
    const config = typeConfig[data.type] || typeConfig.snipe;
    let text = `🏆🎊 **${config.emoji} ${config.title}** 🎊🏆\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
    text += `⚜️ **DTRADER SNIPER** ⚜️\n\n`;
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
    text += `🌐 dtgc.io | @DTraderSniper`;
    return text;
}
//# sourceMappingURL=pnlCard.js.map