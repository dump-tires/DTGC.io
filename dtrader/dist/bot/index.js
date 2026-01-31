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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DtraderBot = void 0;
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const pnlCard_1 = require("../utils/pnlCard");
const ethers_1 = require("ethers");
const config_1 = require("../config");
const tokenGate_1 = require("../gate/tokenGate");
const wallet_1 = require("../core/wallet");
const pulsex_1 = require("../core/pulsex");
const feeManager_1 = require("../core/feeManager");
const graduation_1 = require("../sniper/graduation");
const mempool_1 = require("../sniper/mempool");
const limitOrder_1 = require("../orders/limitOrder");
const antiRug_1 = require("../security/antiRug");
const keyboards = __importStar(require("./keyboards"));
class DtraderBot {
    bot;
    sessions = new Map();
    constructor() {
        // Validate token before starting
        if (!config_1.config.telegramToken) {
            throw new Error('❌ BOT_TOKEN environment variable is not set! Please set it in Railway.');
        }
        console.log('🔑 Bot token found, initializing...');
        this.bot = new node_telegram_bot_api_1.default(config_1.config.telegramToken, { polling: true });
        this.setupHandlers();
        this.setupSniperEvents();
        this.setupOrderEvents();
        console.log('✅ Bot handlers initialized');
    }
    getSession(chatId) {
        if (!this.sessions.has(chatId)) {
            this.sessions.set(chatId, {
                settings: {
                    slippage: 10,
                    gasLimit: 500000,
                    antiRug: true,
                    alerts: true,
                },
                gateVerified: false,
                gateExpiry: 0,
            });
        }
        return this.sessions.get(chatId);
    }
    /**
     * Check token gate before allowing actions
     */
    async checkGate(chatId, userId) {
        const session = this.getSession(chatId);
        // Cache gate check for 5 minutes
        if (session.gateVerified && Date.now() < session.gateExpiry) {
            return true;
        }
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet) {
            await this.bot.sendMessage(chatId, '❌ No wallet found. Use /start to create one first.');
            return false;
        }
        const gateResult = await tokenGate_1.tokenGate.checkAccess(wallet.address);
        if (gateResult.allowed) {
            session.gateVerified = true;
            session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
            return true;
        }
        await this.bot.sendMessage(chatId, gateResult.message);
        return false;
    }
    setupHandlers() {
        // /start command
        this.bot.onText(/\/start/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const { wallet, isNew } = await wallet_1.walletManager.getOrCreateWallet(userId);
            const welcomeMsg = `
⚜️ **DTRADER Mandalorian** - PulseChain Sniper

${isNew ? '✨ New wallet created!' : '👋 Welcome back, Mandalorian!'}

**Your Wallet:**
\`${wallet.address}\`

━━━━━━━━━━━━━━━━━━━━━

**Features:**
🎯 Instabond Sniper (pump.tires)
⚡ New Pair Sniper (PulseX)
📊 Limit Orders (Buy/Sell)
💱 DEX Trading via PulseX
🛡️ Anti-Rug Protection
🔥 Auto Buy & Burn DTGC

━━━━━━━━━━━━━━━━━━━━━

**Fee Structure (1% Total):**
🔥 0.5% → Buy & Burn DTGC
💰 0.5% → Dev Wallet (PLS)

**Token Gate Required:**
Hold $50+ of DTGC
⚜️ DTGC: \`${config_1.config.tokenGate.dtgc}\`

🌐 Web UI: dtgc.io/gold

${isNew ? '⚠️ Send PLS to your wallet to start trading!' : ''}
      `;
            await this.bot.sendMessage(chatId, welcomeMsg, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.mainMenuKeyboard,
            });
        });
        // Handle callback queries (button clicks)
        this.bot.on('callback_query', async (query) => {
            if (!query.message || !query.data)
                return;
            const chatId = query.message.chat.id.toString();
            const userId = query.from.id.toString();
            const data = query.data;
            await this.bot.answerCallbackQuery(query.id);
            // Route to handlers
            await this.handleCallback(chatId, userId, data, query.message.message_id);
        });
        // Handle text messages
        this.bot.on('message', async (msg) => {
            if (!msg.text || msg.text.startsWith('/'))
                return;
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const text = msg.text.trim();
            await this.handleTextInput(chatId, userId, text);
        });
        // Quick commands
        this.bot.onText(/\/buy (.+)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const tokenAddress = match?.[1];
            if (!tokenAddress)
                return;
            if (!await this.checkGate(chatId, userId))
                return;
            await this.startBuyFlow(chatId, userId, tokenAddress);
        });
        this.bot.onText(/\/sell (.+)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const tokenAddress = match?.[1];
            if (!tokenAddress)
                return;
            if (!await this.checkGate(chatId, userId))
                return;
            await this.startSellFlow(chatId, userId, tokenAddress);
        });
        this.bot.onText(/\/snipe (.+)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const tokenAddress = match?.[1];
            if (!tokenAddress)
                return;
            if (!await this.checkGate(chatId, userId))
                return;
            await this.startSnipeFlow(chatId, userId, tokenAddress);
        });
        this.bot.onText(/\/check (.+)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const tokenAddress = match?.[1];
            if (!tokenAddress)
                return;
            await this.checkTokenSafety(chatId, tokenAddress);
        });
        this.bot.onText(/\/balance/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            await this.showBalance(chatId, userId);
        });
        // /gold command - Open web UI (mobile-friendly)
        this.bot.onText(/\/gold/, async (msg) => {
            const chatId = msg.chat.id.toString();
            await this.bot.sendMessage(chatId, `⚜️ **DTGC Gold Suite**\n\n` +
                `📱 **Mobile-Optimized Trading**\n\n` +
                `Tap below to open in your browser and connect your wallet:\n\n` +
                `• 🔄 Swap any PulseChain token\n` +
                `• 🎯 Snipe with limit orders\n` +
                `• 🔥 InstaBond graduation sniper\n` +
                `• 📊 Portfolio tracker\n` +
                `• 💧 Create LP positions\n\n` +
                `_Opens in mobile browser for wallet connect!_`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                            { text: '📱 Open Gold Suite', url: 'https://dtgc.io/gold' }
                        ], [
                            { text: '🔙 Main Menu', callback_data: 'main_menu' }
                        ]]
                }
            });
        });
        // /fees command - Show fee statistics
        this.bot.onText(/\/fees/, async (msg) => {
            const chatId = msg.chat.id.toString();
            await this.showFeeStats(chatId);
        });
        // /pnl command - Show P&L for a token
        this.bot.onText(/\/pnl(?:@\w+)?\s*(.*)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const input = match?.[1]?.trim();
            const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
            if (!input) {
                const positions = pnlCard_1.positionStore.getPositions(userId);
                if (positions.length === 0) {
                    await this.bot.sendMessage(chatId, '📊 No positions tracked.\n\nBuy a token first, then use `/pnl <token_address>`', { parse_mode: 'Markdown' });
                    return;
                }
                // Show all positions summary
                let posMsg = '⚜️ *Your Positions*\n━━━━━━━━━━━━━━━━━━\n\n';
                for (const pos of positions) {
                    posMsg += `• *${pos.tokenName}* \`...${pos.tokenAddress.slice(-4)}\`\n`;
                }
                await this.bot.sendMessage(chatId, posMsg, { parse_mode: 'Markdown' });
                return;
            }
            if (!ethers_1.ethers.isAddress(input)) {
                await this.bot.sendMessage(chatId, '❌ Invalid token address');
                return;
            }
            const position = pnlCard_1.positionStore.getPosition(userId, input);
            if (!position) {
                await this.bot.sendMessage(chatId, '❌ No position found. Buy this token first!');
                return;
            }
            const pnlMsg = (0, pnlCard_1.generatePnLMessage)({
                tokenName: position.tokenName,
                contractAddress: input,
                buyPrice: position.buyPrice,
                currentPrice: position.buyPrice * 1.5, // TODO: fetch real price
                amount: position.amount,
            });
            await this.bot.sendMessage(chatId, pnlMsg, { parse_mode: 'Markdown' });
        });
    }
    async handleCallback(chatId, userId, data, messageId) {
        const session = this.getSession(chatId);
        // Main menu navigation
        switch (data) {
            case 'main_menu':
                await this.bot.editMessageReplyMarkup(keyboards.mainMenuKeyboard, {
                    chat_id: parseInt(chatId),
                    message_id: messageId,
                });
                return;
            case 'wallet_menu':
                await this.bot.editMessageReplyMarkup(keyboards.walletsMenuKeyboard, {
                    chat_id: parseInt(chatId),
                    message_id: messageId,
                });
                return;
            case 'snipe_menu':
                if (!await this.checkGate(chatId, userId))
                    return;
                await this.bot.editMessageReplyMarkup(keyboards.snipeMenuKeyboard, {
                    chat_id: parseInt(chatId),
                    message_id: messageId,
                });
                return;
            case 'orders_menu':
                if (!await this.checkGate(chatId, userId))
                    return;
                await this.bot.editMessageReplyMarkup(keyboards.ordersMenuKeyboard, {
                    chat_id: parseInt(chatId),
                    message_id: messageId,
                });
                return;
            case 'pump_menu':
                if (!await this.checkGate(chatId, userId))
                    return;
                await this.bot.editMessageReplyMarkup(keyboards.pumpMenuKeyboard, {
                    chat_id: parseInt(chatId),
                    message_id: messageId,
                });
                return;
            case 'settings':
                await this.bot.editMessageReplyMarkup(keyboards.settingsKeyboard, {
                    chat_id: parseInt(chatId),
                    message_id: messageId,
                });
                return;
        }
        // Actions
        if (data === 'action_buy') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'buy_token_address';
            await this.bot.sendMessage(chatId, '📝 Enter the token address to buy:');
            return;
        }
        if (data === 'action_sell') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'sell_token_address';
            await this.bot.sendMessage(chatId, '📝 Enter the token address to sell:');
            return;
        }
        if (data === 'check_token') {
            session.pendingAction = 'check_token_address';
            await this.bot.sendMessage(chatId, '📝 Enter the token address to check:');
            return;
        }
        // Wallet actions
        if (data === 'wallet_balance') {
            await this.showBalance(chatId, userId);
            return;
        }
        if (data === 'wallet_address') {
            const wallet = await wallet_1.walletManager.getWallet(userId);
            if (wallet) {
                await this.bot.sendMessage(chatId, `📋 Your wallet address:\n\`${wallet.address}\``, {
                    parse_mode: 'Markdown',
                });
            }
            return;
        }
        if (data === 'wallet_export') {
            const wallet = await wallet_1.walletManager.getWallet(userId);
            if (wallet) {
                const pk = await wallet_1.walletManager.exportPrivateKey(userId);
                await this.bot.sendMessage(chatId, `⚠️ **NEVER SHARE THIS!**\n\n🔑 Private Key:\n\`${pk}\`\n\n_Delete this message after saving!_`, { parse_mode: 'Markdown' });
            }
            return;
        }
        // Snipe actions
        if (data === 'snipe_new') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'snipe_token_address';
            await this.bot.sendMessage(chatId, '📝 Enter token address to snipe when liquidity is added:');
            return;
        }
        if (data === 'snipe_grad') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'snipe_grad_token';
            await this.bot.sendMessage(chatId, '📝 Enter pump.tires token address to snipe on graduation:');
            return;
        }
        if (data === 'pump_auto_snipe' || data === 'snipe_auto') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'auto_snipe_amount';
            await this.bot.sendMessage(chatId, '💰 Enter PLS amount to auto-snipe ALL graduating tokens:');
            return;
        }
        // Order actions
        if (data === 'order_limit_buy') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'limit_buy_token';
            await this.bot.sendMessage(chatId, '📝 Enter token address for limit buy:');
            return;
        }
        if (data === 'order_limit_sell') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'limit_sell_token';
            await this.bot.sendMessage(chatId, '📝 Enter token address for limit sell:');
            return;
        }
        if (data === 'order_stop_loss') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'stop_loss_token';
            await this.bot.sendMessage(chatId, '📝 Enter token address for stop loss:');
            return;
        }
        if (data === 'order_take_profit') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'take_profit_token';
            await this.bot.sendMessage(chatId, '📝 Enter token address for take profit:');
            return;
        }
        if (data === 'order_dca') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'dca_token';
            await this.bot.sendMessage(chatId, '📝 Enter token address for DCA:');
            return;
        }
        if (data === 'order_list') {
            await this.showUserOrders(chatId, userId);
            return;
        }
        // Buy amount selection
        if (data.startsWith('buy_') && !data.startsWith('buy_custom')) {
            const amount = data.replace('buy_', '');
            if (!isNaN(parseInt(amount))) {
                session.pendingAmount = amount;
                await this.executeBuy(chatId, userId);
            }
            return;
        }
        // Sell percentage
        if (data.startsWith('sell_') && !data.startsWith('sell_custom')) {
            const percent = parseInt(data.replace('sell_', ''));
            if (!isNaN(percent)) {
                await this.executeSell(chatId, userId, percent);
            }
            return;
        }
        // Help
        if (data === 'help') {
            await this.showHelp(chatId);
            return;
        }
        // Fee Stats
        if (data === 'fee_stats') {
            await this.showFeeStats(chatId);
            return;
        }
    }
    async handleTextInput(chatId, userId, text) {
        const session = this.getSession(chatId);
        if (!session.pendingAction)
            return;
        // Token address inputs
        if (session.pendingAction === 'buy_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            session.pendingAction = 'buy_amount';
            await this.bot.sendMessage(chatId, '💰 Select amount to buy:', {
                reply_markup: keyboards.buyAmountKeyboard,
            });
            return;
        }
        if (session.pendingAction === 'sell_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            session.pendingAction = 'sell_percent';
            await this.bot.sendMessage(chatId, '📊 Select percentage to sell:', {
                reply_markup: keyboards.sellPercentKeyboard,
            });
            return;
        }
        if (session.pendingAction === 'check_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingAction = undefined;
            await this.checkTokenSafety(chatId, text);
            return;
        }
        // Snipe inputs
        if (session.pendingAction === 'snipe_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            session.pendingAction = 'snipe_amount';
            await this.bot.sendMessage(chatId, '💰 Enter PLS amount to snipe with:');
            return;
        }
        if (session.pendingAction === 'snipe_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            await this.setupSnipe(chatId, userId, session.pendingToken, amount);
            session.pendingAction = undefined;
            session.pendingToken = undefined;
            return;
        }
        if (session.pendingAction === 'snipe_grad_token') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            session.pendingAction = 'snipe_grad_amount';
            await this.bot.sendMessage(chatId, '💰 Enter PLS amount to buy on graduation:');
            return;
        }
        if (session.pendingAction === 'snipe_grad_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            await this.setupGraduationSnipe(chatId, userId, session.pendingToken, amount);
            session.pendingAction = undefined;
            session.pendingToken = undefined;
            return;
        }
        if (session.pendingAction === 'auto_snipe_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            await this.enableAutoSnipe(chatId, userId, amount);
            session.pendingAction = undefined;
            return;
        }
        // Limit order inputs
        if (session.pendingAction === 'limit_buy_token') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            session.pendingAction = 'limit_buy_price';
            await this.bot.sendMessage(chatId, '📊 Enter target price in PLS (buy when price drops to this):');
            return;
        }
        if (session.pendingAction === 'limit_buy_price') {
            const price = parseFloat(text);
            if (isNaN(price) || price <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid price. Try again:');
                return;
            }
            session.pendingAmount = price.toString();
            session.pendingAction = 'limit_buy_amount';
            await this.bot.sendMessage(chatId, '💰 Enter PLS amount to spend:');
            return;
        }
        if (session.pendingAction === 'limit_buy_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            await this.createLimitOrder(chatId, userId, 'limit_buy', session.pendingToken, parseFloat(session.pendingAmount), amount);
            session.pendingAction = undefined;
            session.pendingToken = undefined;
            session.pendingAmount = undefined;
            return;
        }
        // Custom buy amount
        if (session.pendingAction === 'buy_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            session.pendingAmount = text;
            await this.executeBuy(chatId, userId);
            return;
        }
    }
    // ==================== TRADING FUNCTIONS ====================
    async startBuyFlow(chatId, userId, tokenAddress) {
        const session = this.getSession(chatId);
        // Check token safety if anti-rug is enabled
        if (session.settings.antiRug) {
            const safety = await antiRug_1.antiRug.checkToken(tokenAddress);
            if (safety.isHoneypot) {
                await this.bot.sendMessage(chatId, '🚨 **HONEYPOT DETECTED!** Cannot buy this token.', {
                    parse_mode: 'Markdown',
                });
                return;
            }
            if (safety.riskLevel === 'critical') {
                await this.bot.sendMessage(chatId, `⚠️ **HIGH RISK TOKEN**\n${safety.warnings.join('\n')}\n\nProceed anyway?`, { parse_mode: 'Markdown', reply_markup: keyboards.confirmKeyboard });
            }
        }
        session.pendingToken = tokenAddress;
        session.pendingAction = 'buy_amount';
        const tokenInfo = await pulsex_1.pulsex.getTokenInfo(tokenAddress);
        await this.bot.sendMessage(chatId, `💰 **Buy ${tokenInfo.symbol}**\n\nSelect amount (PLS):`, { parse_mode: 'Markdown', reply_markup: keyboards.buyAmountKeyboard });
    }
    async executeBuy(chatId, userId) {
        const session = this.getSession(chatId);
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet || !session.pendingToken || !session.pendingAmount) {
            await this.bot.sendMessage(chatId, '❌ Missing data. Try again.');
            return;
        }
        const amountPls = ethers_1.ethers.parseEther(session.pendingAmount);
        await this.bot.sendMessage(chatId, '⏳ Executing buy...');
        const result = await pulsex_1.pulsex.executeBuy(wallet, session.pendingToken, amountPls, session.settings.slippage, session.settings.gasLimit);
        if (result.success) {
            const feeMsg = result.feeCollected
                ? `\n🔥 DTGC Burned: ${result.dtgcBurned || '...'}`
                : '';
            await this.bot.sendMessage(chatId, `✅ **Buy Successful!**\n\n` +
                `Spent: ${result.amountIn} PLS\n` +
                `Received: ${result.amountOut} tokens${feeMsg}\n\n` +
                `🔗 [View TX](${config_1.config.explorerUrl}/tx/${result.txHash})`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
        else {
            await this.bot.sendMessage(chatId, `❌ **Buy Failed**\n\nError: ${result.error}`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
        session.pendingAction = undefined;
        session.pendingToken = undefined;
        session.pendingAmount = undefined;
    }
    async startSellFlow(chatId, userId, tokenAddress) {
        const session = this.getSession(chatId);
        session.pendingToken = tokenAddress;
        session.pendingAction = 'sell_percent';
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet)
            return;
        const balance = await wallet_1.walletManager.getTokenBalance(wallet.address, tokenAddress);
        await this.bot.sendMessage(chatId, `💸 **Sell ${balance.symbol}**\n\n` +
            `Balance: ${balance.balanceFormatted}\n\n` +
            `Select percentage to sell:`, { parse_mode: 'Markdown', reply_markup: keyboards.sellPercentKeyboard });
    }
    async executeSell(chatId, userId, percent) {
        const session = this.getSession(chatId);
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet || !session.pendingToken) {
            await this.bot.sendMessage(chatId, '❌ Missing data. Try again.');
            return;
        }
        const balance = await wallet_1.walletManager.getTokenBalance(wallet.address, session.pendingToken);
        const sellAmount = (balance.balance * BigInt(percent)) / 100n;
        await this.bot.sendMessage(chatId, '⏳ Executing sell...');
        const result = await pulsex_1.pulsex.executeSell(wallet, session.pendingToken, sellAmount, session.settings.slippage, session.settings.gasLimit);
        if (result.success) {
            const feeMsg = result.feeCollected
                ? `\n🔥 DTGC Burned: ${result.dtgcBurned || '...'}`
                : '';
            await this.bot.sendMessage(chatId, `✅ **Sell Successful!**\n\n` +
                `Sold: ${result.amountIn} tokens\n` +
                `Received: ${result.amountOut} PLS${feeMsg}\n\n` +
                `🔗 [View TX](${config_1.config.explorerUrl}/tx/${result.txHash})`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
        else {
            await this.bot.sendMessage(chatId, `❌ **Sell Failed**\n\nError: ${result.error}`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
        session.pendingAction = undefined;
        session.pendingToken = undefined;
    }
    // ==================== SNIPER FUNCTIONS ====================
    async startSnipeFlow(chatId, userId, tokenAddress) {
        const session = this.getSession(chatId);
        session.pendingToken = tokenAddress;
        session.pendingAction = 'snipe_amount';
        await this.bot.sendMessage(chatId, `🎯 **Snipe Setup**\n\n` +
            `Token: \`${tokenAddress}\`\n\n` +
            `Enter PLS amount to snipe with:`, { parse_mode: 'Markdown' });
    }
    async setupSnipe(chatId, userId, tokenAddress, amountPls) {
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet)
            return;
        const session = this.getSession(chatId);
        // Add to mempool sniper
        mempool_1.mempoolSniper.addTarget({
            tokenAddress,
            amountPls: ethers_1.ethers.parseEther(amountPls.toString()),
            slippage: session.settings.slippage,
            maxGasPrice: ethers_1.ethers.parseUnits('100', 'gwei'),
            minLiquidityPls: ethers_1.ethers.parseEther('1000'),
            userId,
        });
        await this.bot.sendMessage(chatId, `✅ **Snipe Set!**\n\n` +
            `Token: \`${tokenAddress}\`\n` +
            `Amount: ${amountPls} PLS\n` +
            `Slippage: ${session.settings.slippage}%\n\n` +
            `🎯 Will auto-buy when liquidity is added!`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
    }
    async setupGraduationSnipe(chatId, userId, tokenAddress, amountPls) {
        const session = this.getSession(chatId);
        // Add to graduation sniper
        graduation_1.graduationSniper.watchToken(tokenAddress, {
            amountPls: ethers_1.ethers.parseEther(amountPls.toString()),
            slippage: session.settings.slippage,
            gasLimit: session.settings.gasLimit,
            gasPriceMultiplier: 1.5,
        });
        // Get current state
        const state = await graduation_1.graduationSniper.getTokenState(tokenAddress);
        await this.bot.sendMessage(chatId, `✅ **Graduation Snipe Set!**\n\n` +
            (state ? graduation_1.graduationSniper.formatTokenState(state) + '\n\n' : '') +
            `Amount: ${amountPls} PLS\n` +
            `Slippage: ${session.settings.slippage}%\n\n` +
            `🎓 Will auto-buy on PulseX graduation!`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
    }
    async enableAutoSnipe(chatId, userId, amountPls) {
        const session = this.getSession(chatId);
        await graduation_1.graduationSniper.enableAutoSnipe({
            amountPls: ethers_1.ethers.parseEther(amountPls.toString()),
            slippage: session.settings.slippage,
            gasLimit: session.settings.gasLimit,
            gasPriceMultiplier: 1.5,
        });
        await this.bot.sendMessage(chatId, `🤖 **Auto-Snipe ENABLED!**\n\n` +
            `Amount per snipe: ${amountPls} PLS\n` +
            `Slippage: ${session.settings.slippage}%\n\n` +
            `⚠️ Will auto-buy ALL graduating tokens!\n` +
            `Use with caution!`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
    }
    // ==================== ORDER FUNCTIONS ====================
    async createLimitOrder(chatId, userId, orderType, tokenAddress, targetPrice, amount) {
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet)
            return;
        const session = this.getSession(chatId);
        const order = await limitOrder_1.limitOrderEngine.createOrder({
            userId,
            walletAddress: wallet.address,
            tokenAddress,
            orderType,
            targetPrice: ethers_1.ethers.parseEther(targetPrice.toString()),
            amount: ethers_1.ethers.parseEther(amount.toString()),
            slippage: session.settings.slippage,
        });
        await this.bot.sendMessage(chatId, `✅ **${orderType.replace('_', ' ').toUpperCase()} Created!**\n\n` +
            `Order ID: \`${order.id}\`\n` +
            `Token: \`${tokenAddress}\`\n` +
            `Target: ${targetPrice} PLS\n` +
            `Amount: ${amount} PLS\n\n` +
            `Will execute when price is reached!`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
    }
    async showUserOrders(chatId, userId) {
        const orders = limitOrder_1.limitOrderEngine.getUserOrders(userId);
        const dcaOrders = limitOrder_1.limitOrderEngine.getUserDCAOrders(userId);
        if (orders.length === 0 && dcaOrders.length === 0) {
            await this.bot.sendMessage(chatId, '📋 No active orders.', {
                reply_markup: keyboards.ordersMenuKeyboard,
            });
            return;
        }
        let msg = '📋 **Your Orders**\n\n';
        for (const order of orders.slice(0, 10)) {
            msg += limitOrder_1.limitOrderEngine.formatOrder(order) + '\n\n';
        }
        if (dcaOrders.length > 0) {
            msg += '\n📊 **DCA Orders**\n';
            for (const dca of dcaOrders.slice(0, 5)) {
                msg += `${dca.id}: ${dca.completedBuys}/${dca.totalBuys} buys\n`;
            }
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.ordersMenuKeyboard,
        });
    }
    // ==================== UTILITY FUNCTIONS ====================
    async checkTokenSafety(chatId, tokenAddress) {
        await this.bot.sendMessage(chatId, '🔍 Analyzing token...');
        const safety = await antiRug_1.antiRug.checkToken(tokenAddress);
        await this.bot.sendMessage(chatId, antiRug_1.antiRug.formatSafetyCheck(safety), {
            parse_mode: 'Markdown',
            reply_markup: keyboards.tokenActionKeyboard(tokenAddress),
        });
    }
    async showBalance(chatId, userId) {
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (!wallet) {
            await this.bot.sendMessage(chatId, '❌ No wallet found.');
            return;
        }
        const plsBalance = await wallet_1.walletManager.getPlsBalance(wallet.address);
        const gateCheck = await tokenGate_1.tokenGate.checkAccess(wallet.address);
        await this.bot.sendMessage(chatId, `👛 **Wallet Balance**\n\n` +
            `Address: \`${wallet.address}\`\n\n` +
            `💎 PLS: ${Number(plsBalance.formatted).toLocaleString()}\n\n` +
            `**Gate Status:**\n${gateCheck.message}`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
    }
    async showFeeStats(chatId) {
        try {
            const stats = await feeManager_1.feeManager.getFeeStats();
            await this.bot.sendMessage(chatId, `🔥 **DTGC Burn Statistics**\n\n` +
                `**Total DTGC Burned:**\n` +
                `${Number(stats.totalDtgcBurned).toLocaleString()} DTGC\n\n` +
                `**Fee Structure (1% per trade):**\n` +
                `🔥 0.5% → Buy & Burn DTGC\n` +
                `💰 0.5% → Dev Wallet (PLS)\n\n` +
                `_Every trade burns DTGC forever!_\n\n` +
                `🌐 View on PulseX Gold: dtgc.io/gold`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
        catch (error) {
            await this.bot.sendMessage(chatId, '❌ Could not fetch fee stats.');
        }
    }
    async showHelp(chatId) {
        await this.bot.sendMessage(chatId, `
⚜️ **DTRADER Mandalorian Help**

**Quick Commands:**
/buy <token> - Buy a token
/sell <token> - Sell a token
/snipe <token> - Set up snipe
/check <token> - Safety check
/balance - View balance
/gold - Open web UI
/fees - View burn stats

**Features:**

🎯 **Sniping**
• Instabond - Auto-buy pump.tires graduations
• New Pair - Snipe new PulseX listings

📊 **Orders**
• Limit Buy/Sell at target price
• Stop Loss protection
• Take Profit targets
• DCA (Dollar Cost Average)

🛡️ **Safety**
• Honeypot detection
• Tax analysis
• Liquidity checks
• Anti-rug protection

🔥 **Fees (1% per trade)**
• 0.5% Buy & Burn DTGC
• 0.5% Dev Wallet (PLS)

**Token Gate:**
Hold $50+ of DTGC to trade

🌐 Web: dtgc.io/gold
    `, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
    }
    // ==================== EVENT HANDLERS ====================
    setupSniperEvents() {
        // Graduation sniper events
        graduation_1.graduationSniper.on('graduation', async (data) => {
            // Notify all users with alerts enabled
            for (const [chatId, session] of this.sessions) {
                if (session.settings.alerts) {
                    await this.bot.sendMessage(chatId, `🎓 **Token Graduated!**\n\n` +
                        `Token: \`${data.token}\`\n` +
                        `Pair: \`${data.pair}\``, { parse_mode: 'Markdown' });
                }
            }
        });
        graduation_1.graduationSniper.on('snipeReady', async (data) => {
            // Execute the snipe for the user
            // This would need the user's wallet - handled by the watcher
        });
        // Mempool sniper events
        mempool_1.mempoolSniper.on('executeSnipe', async (data) => {
            const { target, pairInfo } = data;
            const wallet = await wallet_1.walletManager.getWallet(target.userId);
            if (!wallet)
                return;
            const result = await pulsex_1.pulsex.executeBuy(wallet, target.tokenAddress, target.amountPls, target.slippage, 500000);
            // Find user's chat
            for (const [chatId, session] of this.sessions) {
                if (session.gateVerified) {
                    const userWallet = await wallet_1.walletManager.getWallet(chatId);
                    if (userWallet?.address === wallet.address) {
                        if (result.success) {
                            await this.bot.sendMessage(chatId, `🎯 **SNIPE EXECUTED!**\n\n` +
                                `Token: \`${target.tokenAddress}\`\n` +
                                `Spent: ${result.amountIn} PLS\n` +
                                `Got: ${result.amountOut} tokens\n\n` +
                                `🔗 [TX](${config_1.config.explorerUrl}/tx/${result.txHash})`, { parse_mode: 'Markdown' });
                        }
                        else {
                            await this.bot.sendMessage(chatId, `❌ Snipe failed: ${result.error}`);
                        }
                    }
                }
            }
        });
        mempool_1.mempoolSniper.on('pairCreated', async (event) => {
            for (const [chatId, session] of this.sessions) {
                if (session.settings.alerts) {
                    await this.bot.sendMessage(chatId, `🆕 **New Pair Created!**\n\n` +
                        `Token0: \`${event.token0}\`\n` +
                        `Token1: \`${event.token1}\``, { parse_mode: 'Markdown' });
                }
            }
        });
    }
    setupOrderEvents() {
        limitOrder_1.limitOrderEngine.on('orderTriggered', async (data) => {
            const { order, priceData } = data;
            const wallet = await wallet_1.walletManager.getWallet(order.userId);
            if (!wallet)
                return;
            let result;
            if (order.orderType === 'limit_buy') {
                result = await pulsex_1.pulsex.executeBuy(wallet, order.tokenAddress, order.amount, order.slippage, 500000);
            }
            else {
                result = await pulsex_1.pulsex.executeSell(wallet, order.tokenAddress, order.amount, order.slippage, 500000);
            }
            if (result.success) {
                limitOrder_1.limitOrderEngine.markOrderFilled(order.id, result.txHash);
                for (const [chatId, _] of this.sessions) {
                    await this.bot.sendMessage(chatId, `✅ **Order Filled!**\n\n` +
                        `${order.orderType.replace('_', ' ').toUpperCase()}\n` +
                        `${result.amountIn} → ${result.amountOut}\n\n` +
                        `🔗 [TX](${config_1.config.explorerUrl}/tx/${result.txHash})`, { parse_mode: 'Markdown' });
                }
            }
            else {
                limitOrder_1.limitOrderEngine.markOrderFailed(order.id, result.error);
            }
        });
    }
    /**
     * Start the bot
     */
    async start() {
        console.log('🚀 Starting Dtrader bot...');
        // Connect snipers
        await graduation_1.graduationSniper.connect();
        await graduation_1.graduationSniper.startListening();
        await mempool_1.mempoolSniper.connect();
        await mempool_1.mempoolSniper.start();
        // Start order engine
        await limitOrder_1.limitOrderEngine.start();
        console.log('✅ Dtrader bot is running!');
    }
    /**
     * Stop the bot
     */
    async stop() {
        console.log('🛑 Stopping Dtrader bot...');
        await graduation_1.graduationSniper.disconnect();
        await mempool_1.mempoolSniper.disconnect();
        limitOrder_1.limitOrderEngine.stop();
        this.bot.stopPolling();
    }
}
exports.DtraderBot = DtraderBot;
//# sourceMappingURL=index.js.map