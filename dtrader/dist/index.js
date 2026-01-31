"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const bot_1 = require("./bot");
console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   ⚜️  DTRADER Mandalorian - PulseChain v2.0      ║
║                                                   ║
║   Features:                                       ║
║   • Instabond Sniper (pump.tires)                ║
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
║   Web UI: dtgc.io/gold                     ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
`);
const bot = new bot_1.DtraderBot();
// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await bot.stop();
    process.exit(0);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason);
    // Don't exit - keep running
});
process.on('uncaughtException', (error) => {
    console.error('⚠️ Uncaught Exception:', error.message);
    // Don't exit for WebSocket errors
    if (!error.message.includes('401') && !error.message.includes('WebSocket')) {
        process.exit(1);
    }
});
bot.start().then(() => {
    console.log('\n✅ Bot is live! Send /start to your Telegram bot.');
    console.log('   Press Ctrl+C to stop.\n');
}).catch((err) => {
    console.error('❌ Failed to start:', err);
});
//# sourceMappingURL=index.js.map