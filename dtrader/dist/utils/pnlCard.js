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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
//# sourceMappingURL=pnlCard.js.map