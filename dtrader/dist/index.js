"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bot_1 = require("./bot");
const instabondApi_1 = require("./api/instabondApi");
console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   ⚜️  DTG BOND BOT - PulseChain v2.0             ║
║   @DTGBondBot                                     ║
║                                                   ║
║   Features:                                       ║
║   • InstaBond Sniper (pump.tires)                ║
║   • New Pair Sniper                              ║
║   • Limit Orders (Buy/Sell)                      ║
║   • Stop Loss & Take Profit                      ║
║   • DCA Orders                                   ║
║   • Anti-Rug Protection                          ║
║                                                   ║
║   Fee Structure (1% per trade):                  ║
║   • 0.5% → Buy & Burn DTGC                       ║
║   • 0.5% → Dev Wallet (PLS)                      ║
║                                                   ║
║   Token Gate: $50 DTGC                           ║
║   Web UI: dtgc.io/gold                           ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);
// Wait for old deployment to release polling lock
// Railway blue-green deployments can cause 409 conflicts
const STARTUP_DELAY = parseInt(process.env.STARTUP_DELAY_MS || '5000');
console.log(`⏳ Waiting ${STARTUP_DELAY / 1000}s for clean startup...`);
setTimeout(() => {
    const bot = new bot_1.DtraderBot();
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down...');
        await bot.stop();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        console.log('\n🛑 SIGTERM received, shutting down...');
        await bot.stop();
        process.exit(0);
    });
    process.on('unhandledRejection', (reason, promise) => {
        console.error('⚠️ Unhandled Rejection:', reason);
        // Don't exit - keep running
    });
    process.on('uncaughtException', (error) => {
        console.error('⚠️ Uncaught Exception:', error.message);
        // Don't exit for WebSocket or polling errors
        if (!error.message.includes('401') &&
            !error.message.includes('WebSocket') &&
            !error.message.includes('409') &&
            !error.message.includes('ETELEGRAM')) {
            process.exit(1);
        }
    });
    // Start the InstaBond API for web UI integration
    const API_PORT = parseInt(process.env.INSTABOND_API_PORT || '3847');
    (0, instabondApi_1.startInstaBondApi)(API_PORT).then(() => {
        console.log(`🌐 InstaBond Web API: http://localhost:${API_PORT}/api/instabond`);
    });
    bot.start().then(() => {
        console.log('\n✅ Bot is live! Send /start to your Telegram bot.');
        console.log('   Press Ctrl+C to stop.\n');
    }).catch((err) => {
        console.error('❌ Failed to start:', err);
    });
}, STARTUP_DELAY);
//# sourceMappingURL=index.js.map