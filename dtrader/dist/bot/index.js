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
const GAS_GWEI = {
    normal: 0.01,
    fast: 0.1,
    turbo: 1,
    max: 10,
};
const GAS_LABELS = {
    normal: '🐢 Normal',
    fast: '⚡ Fast',
    turbo: '🚀 TURBO',
    max: '💎 MAX SPEED',
};
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
                snipeOrders: [],
                settings: {
                    slippage: 10,
                    gasLimit: 500000,
                    gasPriority: 'turbo', // Default to TURBO for speed
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
     * Uses LINKED WALLET first (external MetaMask/Rabby), falls back to bot wallet
     */
    async checkGate(chatId, userId) {
        const session = this.getSession(chatId);
        // Cache gate check for 5 minutes
        if (session.gateVerified && Date.now() < session.gateExpiry) {
            return true;
        }
        // Priority 1: Check linked external wallet (MetaMask/Rabby)
        if (session.linkedWallet) {
            const linkedGateResult = await tokenGate_1.tokenGate.checkAccess(session.linkedWallet);
            if (linkedGateResult.allowed) {
                session.gateVerified = true;
                session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
                return true;
            }
        }
        // Priority 2: Check bot wallet
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (wallet) {
            const gateResult = await tokenGate_1.tokenGate.checkAccess(wallet.address);
            if (gateResult.allowed) {
                session.gateVerified = true;
                session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
                return true;
            }
        }
        // Neither wallet passed - show helpful message
        const linkedAddr = session.linkedWallet ? `\n🔗 Linked: \`${session.linkedWallet.slice(0, 8)}...\`` : '';
        const botAddr = wallet ? `\n🤖 Bot: \`${wallet.address.slice(0, 8)}...\`` : '';
        await this.bot.sendMessage(chatId, `❌ **Gate Check Failed**\n\n` +
            `Hold $50+ of DTGC in your wallet to access PRO features.${linkedAddr}${botAddr}\n\n` +
            `⚜️ DTGC: \`${config_1.config.tokenGate.dtgc}\`\n\n` +
            `💡 _Link your wallet with DTGC using 🔗 Link Wallet_`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
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
        // Refresh balance - rescan wallet and show updated DTGC balance
        if (data === 'refresh_balance') {
            await this.showRefreshedBalance(chatId, userId);
            return;
        }
        // Link external wallet - allows users to track their MetaMask/Rabby wallet
        if (data === 'link_wallet') {
            session.pendingAction = 'link_wallet_address';
            await this.bot.sendMessage(chatId, `🔗 **Link External Wallet**\n\n` +
                `Paste your wallet address (from MetaMask, Rabby, etc.) to track your DTGC balance and use the Gold Suite seamlessly.\n\n` +
                `📝 Enter your wallet address (0x...):`, { parse_mode: 'Markdown' });
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
        // Generate 6 snipe wallets
        if (data === 'wallets_generate_6') {
            if (!await this.checkGate(chatId, userId))
                return;
            await this.generate6Wallets(chatId, userId);
            return;
        }
        // Wallets menu
        if (data === 'wallets_menu') {
            await this.bot.editMessageReplyMarkup(keyboards.walletsMenuKeyboard, {
                chat_id: parseInt(chatId),
                message_id: messageId,
            });
            return;
        }
        // Export all wallet keys
        if (data === 'wallets_export') {
            await this.exportAllWallets(chatId, userId);
            return;
        }
        // View wallet balances
        if (data === 'wallets_balance') {
            await this.showWalletBalances(chatId, userId);
            return;
        }
        // View all wallet addresses
        if (data === 'wallets_addresses') {
            await this.showAllWalletAddresses(chatId, userId);
            return;
        }
        // Multi-wallet snipe selection
        if (data.startsWith('snipe_wallets_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const numWallets = parseInt(data.replace('snipe_wallets_', ''));
            session.pendingAction = `snipe_multi_${numWallets}`;
            await this.bot.sendMessage(chatId, `🎯 **Multi-Wallet Snipe Setup**\n\n` +
                `Sniping with **${numWallets} wallet${numWallets > 1 ? 's' : ''}**\n\n` +
                `Select PLS amount **per wallet**:`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeAmountKeyboard });
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
        // Top 10 Near Graduation tokens
        if (data === 'pump_near_grad') {
            if (!await this.checkGate(chatId, userId))
                return;
            await this.showNearGradTokens(chatId);
            return;
        }
        // Insta-snipe a specific token from the list
        if (data.startsWith('instasnipe_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const tokenAddress = data.replace('instasnipe_', '');
            session.pendingToken = tokenAddress;
            session.pendingAction = 'instasnipe_amount';
            await this.bot.sendMessage(chatId, `🎯 **Insta-Snipe Setup**\n\n` +
                `Token: \`${tokenAddress.slice(0, 10)}...${tokenAddress.slice(-8)}\`\n\n` +
                `Select PLS amount per wallet:`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeAmountKeyboard });
            return;
        }
        // Snipe amount selection for insta-snipe -> then gas priority
        if (data.startsWith('snipe_amt_') && session.pendingAction === 'instasnipe_amount') {
            const amount = parseInt(data.replace('snipe_amt_', ''));
            if (!isNaN(amount) && session.pendingToken) {
                session.pendingAmount = amount.toString();
                session.pendingAction = 'instasnipe_gas';
                await this.bot.sendMessage(chatId, `⛽ **Select Gas Priority**\n\n` +
                    `Higher gas = faster execution = first-mover advantage!\n\n` +
                    `💰 Amount: ${(amount / 1_000_000).toFixed(0)}M PLS\n` +
                    `🎯 Token: \`${session.pendingToken.slice(0, 12)}...\``, { parse_mode: 'Markdown', reply_markup: keyboards.gasPriorityKeyboard });
            }
            return;
        }
        // Gas priority selection for insta-snipe
        if (data.startsWith('gas_') && session.pendingAction === 'instasnipe_gas') {
            const gasPriority = data.replace('gas_', '');
            if (session.pendingToken && session.pendingAmount) {
                session.pendingGas = gasPriority;
                await this.setupInstaSnipe(chatId, userId, session.pendingToken, parseInt(session.pendingAmount), gasPriority);
                session.pendingAction = undefined;
                session.pendingToken = undefined;
                session.pendingAmount = undefined;
                session.pendingGas = undefined;
            }
            return;
        }
        // Snipe list - show all pending snipes
        if (data === 'snipe_list') {
            await this.showSnipeOrders(chatId, userId);
            return;
        }
        // Cancel a specific snipe
        if (data.startsWith('cancel_snipe_')) {
            const orderId = data.replace('cancel_snipe_', '');
            await this.cancelSnipe(chatId, orderId);
            return;
        }
        // Quick sell from filled snipe
        if (data.startsWith('quick_sell_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const tokenAddress = data.replace('quick_sell_', '');
            session.pendingToken = tokenAddress;
            session.pendingAction = 'sell_percent';
            await this.bot.sendMessage(chatId, '📊 Select percentage to sell:', {
                reply_markup: keyboards.sellPercentKeyboard,
            });
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
        // Link external wallet
        if (session.pendingAction === 'link_wallet_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid wallet address. Try again:');
                return;
            }
            session.pendingAction = undefined;
            await this.linkExternalWallet(chatId, userId, text);
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
    /**
     * Show refreshed balance for both bot wallet and linked external wallet
     */
    async showRefreshedBalance(chatId, userId) {
        const session = this.getSession(chatId.toString());
        const wallet = await wallet_1.walletManager.getWallet(userId);
        let msg = `🔄 **Balance Refreshed**\n\n`;
        // Bot wallet balance
        if (wallet) {
            const plsBalance = await wallet_1.walletManager.getPlsBalance(wallet.address);
            const gateCheck = await tokenGate_1.tokenGate.checkAccess(wallet.address);
            msg += `**🤖 Bot Wallet:**\n`;
            msg += `\`${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}\`\n`;
            msg += `💎 ${Number(plsBalance.formatted).toLocaleString()} PLS\n`;
            msg += `${gateCheck.allowed ? '✅' : '❌'} Gate: ${gateCheck.allowed ? 'PASS' : 'Need $50 DTGC'}\n\n`;
        }
        // Linked external wallet balance
        if (session.linkedWallet) {
            try {
                const extPlsBalance = await wallet_1.walletManager.getPlsBalance(session.linkedWallet);
                const extGateCheck = await tokenGate_1.tokenGate.checkAccess(session.linkedWallet);
                const dtgcBalance = await wallet_1.walletManager.getTokenBalance(session.linkedWallet, config_1.config.tokenGate.dtgc);
                msg += `**🔗 Linked Wallet:**\n`;
                msg += `\`${session.linkedWallet.slice(0, 8)}...${session.linkedWallet.slice(-6)}\`\n`;
                msg += `💎 ${Number(extPlsBalance.formatted).toLocaleString()} PLS\n`;
                msg += `⚜️ ${Number(dtgcBalance.balanceFormatted).toLocaleString()} DTGC\n`;
                msg += `${extGateCheck.allowed ? '✅' : '❌'} Gate: ${extGateCheck.allowed ? 'PASS' : 'Need $50 DTGC'}\n\n`;
            }
            catch (err) {
                msg += `**🔗 Linked Wallet:** Error fetching\n\n`;
            }
        }
        else {
            msg += `💡 _Tip: Link your MetaMask/Rabby wallet for seamless tracking!_\n`;
        }
        msg += `_Last updated: ${new Date().toLocaleTimeString()}_`;
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.mainMenuKeyboard,
        });
    }
    /**
     * Link an external wallet address for balance tracking
     */
    async linkExternalWallet(chatId, userId, address) {
        const session = this.getSession(chatId.toString());
        session.linkedWallet = address;
        try {
            const plsBalance = await wallet_1.walletManager.getPlsBalance(address);
            const gateCheck = await tokenGate_1.tokenGate.checkAccess(address);
            const dtgcBalance = await wallet_1.walletManager.getTokenBalance(address, config_1.config.tokenGate.dtgc);
            await this.bot.sendMessage(chatId, `✅ **Wallet Linked Successfully!**\n\n` +
                `**Address:**\n\`${address}\`\n\n` +
                `**Balances:**\n` +
                `💎 ${Number(plsBalance.formatted).toLocaleString()} PLS\n` +
                `⚜️ ${Number(dtgcBalance.balanceFormatted).toLocaleString()} DTGC\n\n` +
                `**Gate Status:**\n${gateCheck.message}\n\n` +
                `_Use 🔄 Refresh to update balances anytime!_\n` +
                `_Open Gold Suite with same wallet to trade!_`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.mainMenuKeyboard,
            });
        }
        catch (err) {
            await this.bot.sendMessage(chatId, `✅ **Wallet Linked:** \`${address}\`\n\n` +
                `⚠️ Could not fetch balance. Will retry on refresh.`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.mainMenuKeyboard,
            });
        }
    }
    /**
     * Generate 6 snipe wallets for multi-wallet sniping
     * Shows address AND private key for each wallet
     */
    async generate6Wallets(chatId, userId) {
        await this.bot.sendMessage(chatId, '🔄 Generating 6 snipe wallets...');
        const wallets = [];
        for (let i = 1; i <= 6; i++) {
            const walletId = `${userId}_snipe_${i}`;
            const { wallet, isNew } = await wallet_1.walletManager.getOrCreateWallet(walletId);
            wallets.push({
                index: i,
                address: wallet.address,
                privateKey: wallet.privateKey,
            });
        }
        // Send header message
        let headerMsg = `✅ **6 SNIPE WALLETS GENERATED** ⚜️\n`;
        headerMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        headerMsg += `⚠️ **KEEP THESE PRIVATE KEYS SAFE!**\n`;
        headerMsg += `_Anyone with your key can access your funds._\n\n`;
        await this.bot.sendMessage(chatId, headerMsg, { parse_mode: 'Markdown' });
        // Send each wallet separately for easy copying
        for (const w of wallets) {
            const walletMsg = `**━━━ WALLET ${w.index} ━━━**\n\n` +
                `📍 **Address:**\n\`${w.address}\`\n\n` +
                `🔑 **Private Key:**\n\`${w.privateKey}\`\n`;
            await this.bot.sendMessage(chatId, walletMsg, { parse_mode: 'Markdown' });
        }
        // Send footer with tips
        let footerMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        footerMsg += `💡 **Tips:**\n`;
        footerMsg += `• Send PLS to each wallet you want to snipe with\n`;
        footerMsg += `• Use 🎯 Sniper to multi-wallet snipe!\n`;
        footerMsg += `• Import keys into MetaMask/Rabby for recovery\n\n`;
        footerMsg += `⚜️ _This is the way._`;
        await this.bot.sendMessage(chatId, footerMsg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.multiWalletSnipeKeyboard,
        });
    }
    /**
     * Export all wallet keys (addresses + private keys)
     */
    async exportAllWallets(chatId, userId) {
        await this.bot.sendMessage(chatId, '🔑 Exporting your wallets...');
        const session = this.getSession(chatId);
        const wallets = [];
        // Get linked wallet (user's external wallet - no private key)
        if (session.linkedWallet) {
            wallets.push({
                label: '🔗 Linked Wallet',
                address: session.linkedWallet,
                privateKey: 'N/A (External wallet - managed by you)',
            });
        }
        // Get bot wallet
        try {
            const { wallet } = await wallet_1.walletManager.getOrCreateWallet(userId);
            wallets.push({
                label: '🤖 Bot Wallet',
                address: wallet.address,
                privateKey: wallet.privateKey,
            });
        }
        catch { }
        // Get 6 snipe wallets
        for (let i = 1; i <= 6; i++) {
            try {
                const walletId = `${userId}_snipe_${i}`;
                const { wallet } = await wallet_1.walletManager.getOrCreateWallet(walletId);
                wallets.push({
                    label: `🎯 Snipe Wallet ${i}`,
                    address: wallet.address,
                    privateKey: wallet.privateKey,
                });
            }
            catch { }
        }
        // Send header
        let headerMsg = `🔑 **YOUR WALLET KEYS** ⚜️\n`;
        headerMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        headerMsg += `⚠️ **NEVER SHARE YOUR PRIVATE KEYS!**\n`;
        headerMsg += `_Import into MetaMask/Rabby for recovery_\n\n`;
        await this.bot.sendMessage(chatId, headerMsg, { parse_mode: 'Markdown' });
        // Send each wallet separately
        for (const w of wallets) {
            const walletMsg = `**${w.label}**\n\n` +
                `📍 **Address:**\n\`${w.address}\`\n\n` +
                `🔑 **Private Key:**\n\`${w.privateKey}\`\n`;
            await this.bot.sendMessage(chatId, walletMsg, { parse_mode: 'Markdown' });
        }
        await this.bot.sendMessage(chatId, `⚜️ _This is the way._`, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.walletsMenuKeyboard,
        });
    }
    /**
     * Show all wallet balances
     */
    async showWalletBalances(chatId, userId) {
        await this.bot.sendMessage(chatId, '💰 Fetching wallet balances...');
        const session = this.getSession(chatId);
        let msg = `💰 **WALLET BALANCES** ⚜️\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        // Get linked wallet balance
        if (session.linkedWallet) {
            try {
                const { formatted } = await wallet_1.walletManager.getPlsBalance(session.linkedWallet);
                msg += `🔗 **Linked Wallet**\n`;
                msg += `\`${session.linkedWallet.slice(0, 10)}...${session.linkedWallet.slice(-6)}\`\n`;
                msg += `💎 ${parseFloat(formatted).toFixed(2)} PLS\n\n`;
            }
            catch { }
        }
        // Get bot wallet balance
        try {
            const { wallet } = await wallet_1.walletManager.getOrCreateWallet(userId);
            const { formatted } = await wallet_1.walletManager.getPlsBalance(wallet.address);
            msg += `🤖 **Bot Wallet**\n`;
            msg += `\`${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}\`\n`;
            msg += `💎 ${parseFloat(formatted).toFixed(2)} PLS\n\n`;
        }
        catch { }
        // Get 6 snipe wallet balances
        for (let i = 1; i <= 6; i++) {
            try {
                const walletId = `${userId}_snipe_${i}`;
                const { wallet } = await wallet_1.walletManager.getOrCreateWallet(walletId);
                const { formatted } = await wallet_1.walletManager.getPlsBalance(wallet.address);
                msg += `🎯 **Snipe W${i}**\n`;
                msg += `\`${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}\`\n`;
                msg += `💎 ${parseFloat(formatted).toFixed(2)} PLS\n\n`;
            }
            catch { }
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.walletsMenuKeyboard,
        });
    }
    /**
     * Show all wallet addresses (quick view)
     */
    async showAllWalletAddresses(chatId, userId) {
        const session = this.getSession(chatId);
        let msg = `📋 **ALL WALLET ADDRESSES** ⚜️\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        // Linked wallet
        if (session.linkedWallet) {
            msg += `🔗 Linked: \`${session.linkedWallet}\`\n\n`;
        }
        // Bot wallet
        try {
            const { wallet } = await wallet_1.walletManager.getOrCreateWallet(userId);
            msg += `🤖 Bot: \`${wallet.address}\`\n\n`;
        }
        catch { }
        // 6 snipe wallets
        for (let i = 1; i <= 6; i++) {
            try {
                const walletId = `${userId}_snipe_${i}`;
                const { wallet } = await wallet_1.walletManager.getOrCreateWallet(walletId);
                msg += `🎯 W${i}: \`${wallet.address}\`\n`;
            }
            catch { }
        }
        msg += `\n_Click to copy, send PLS to fund._`;
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.walletsMenuKeyboard,
        });
    }
    /**
     * Show Top 10 tokens closest to graduation from pump.tires
     */
    async showNearGradTokens(chatId) {
        await this.bot.sendMessage(chatId, '🔄 Fetching top 10 near-graduation tokens...');
        try {
            // Fetch from our API proxy (same as UI uses)
            const response = await fetch('https://dtgc.io/api/pump-tokens');
            const data = await response.json();
            if (!data.tokens || data.tokens.length === 0) {
                await this.bot.sendMessage(chatId, '❌ No tokens found. Try again later.');
                return;
            }
            // API already returns sorted by closest to graduation, just take top 10
            const TARGET = 800_000_000;
            const sorted = data.tokens.slice(0, 10);
            if (sorted.length === 0) {
                await this.bot.sendMessage(chatId, '❌ No tokens approaching graduation right now.');
                return;
            }
            let msg = `🔥 **Top ${sorted.length} Near Graduation**\n\n`;
            const buttons = [];
            for (let i = 0; i < sorted.length; i++) {
                const token = sorted[i];
                const tokensSold = token.tokens_sold || 0;
                const progress = ((tokensSold / TARGET) * 100).toFixed(1);
                const progressBar = this.makeProgressBar(parseFloat(progress));
                msg += `**${i + 1}. ${token.name || 'Unknown'}** (${token.symbol || '???'})\n`;
                msg += `${progressBar} ${progress}%\n`;
                msg += `📊 ${(tokensSold / 1_000_000).toFixed(1)}M / 800M sold\n`;
                msg += `\`${token.address.slice(0, 12)}...${token.address.slice(-8)}\`\n\n`;
                // Add snipe button for each token (2 per row)
                if (i % 2 === 0) {
                    buttons.push([{ text: `🎯 ${i + 1}. ${token.symbol || 'Snipe'}`, callback_data: `instasnipe_${token.address}` }]);
                }
                else {
                    buttons[buttons.length - 1].push({ text: `🎯 ${i + 1}. ${token.symbol || 'Snipe'}`, callback_data: `instasnipe_${token.address}` });
                }
            }
            buttons.push([{ text: '🔄 Refresh List', callback_data: 'pump_near_grad' }]);
            buttons.push([{ text: '🔙 Back', callback_data: 'pump_menu' }]);
            msg += `\n_Tap any token to set up Insta-Snipe!_\n`;
            msg += `_Snipe executes automatically on graduation._`;
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons },
            });
        }
        catch (error) {
            console.error('Failed to fetch near-grad tokens:', error);
            await this.bot.sendMessage(chatId, '❌ Failed to fetch tokens. Try again later.');
        }
    }
    /**
     * Make a text-based progress bar
     */
    makeProgressBar(percent) {
        const filled = Math.round(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    /**
     * Set up Insta-Snipe for a token (executes on graduation)
     * Mandalorian-style alpha receipt with gas priority for first-mover advantage
     */
    async setupInstaSnipe(chatId, userId, tokenAddress, plsAmount, gasPriority = 'turbo') {
        const session = this.getSession(chatId);
        try {
            // Get wallet info
            const walletId = session.linkedWallet ? userId : `${userId}_snipe_1`;
            const wallet = await wallet_1.walletManager.getWallet(walletId);
            const walletAddress = session.linkedWallet || wallet?.address || 'Unknown';
            const walletLabel = session.linkedWallet ? 'Linked' : 'Snipe W1';
            // Gas settings for speed
            const gasGwei = GAS_GWEI[gasPriority];
            const gasLabel = GAS_LABELS[gasPriority];
            const gasPriceWei = BigInt(Math.floor(gasGwei * 1e9)); // Convert Gwei to Wei
            // Create snipe order ticket
            const orderId = `SNP-${Date.now().toString(36).toUpperCase()}`;
            const snipeOrder = {
                id: orderId,
                tokenAddress,
                walletId,
                walletAddress: walletAddress.slice(0, 10) + '...' + walletAddress.slice(-6),
                amountPls: plsAmount,
                gasPriority,
                gasGwei,
                status: 'pending',
                createdAt: Date.now(),
            };
            // Store the order
            session.snipeOrders.push(snipeOrder);
            // Set up graduation snipe using watchToken with gas priority
            graduation_1.graduationSniper.watchToken(tokenAddress, {
                amountPls: BigInt(plsAmount) * BigInt(10 ** 18),
                slippage: session.settings.slippage,
                gasLimit: session.settings.gasLimit,
                gasPriceMultiplier: gasGwei >= 1 ? 10 : gasGwei >= 0.1 ? 5 : 2, // Higher multiplier for speed
            });
            // Format amount display
            const amountDisplay = plsAmount >= 1_000_000
                ? `${(plsAmount / 1_000_000).toFixed(0)}M PLS`
                : `${(plsAmount / 1_000).toFixed(0)}K PLS`;
            // Mandalorian Alpha Receipt with Gold Mando image
            const mandoImageUrl = 'https://dtgc.io/images/mando-sniper.png';
            const receiptCaption = `⚜️ *MANDALORIAN ALPHA RECEIPT* ⚜️\n\n` +
                `🆔 \`${orderId}\`\n` +
                `📊 Status: 🟡 *ARMED & WAITING*\n\n` +
                `━━━ TARGET ━━━\n` +
                `\`${tokenAddress}\`\n\n` +
                `━━━ PAYLOAD ━━━\n` +
                `💰 *Bullet:* ${amountDisplay}\n` +
                `👛 *Wallet:* ${walletLabel}\n` +
                `\`${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}\`\n\n` +
                `━━━ SPEED CONFIG ━━━\n` +
                `⛽ *Gas:* ${gasLabel}\n` +
                `⚡ *Gwei:* ${gasGwei}\n` +
                `🔧 *Slippage:* ${session.settings.slippage}%\n\n` +
                `⚜️ *THIS IS THE WAY* ⚜️\n` +
                `_Auto-executes on graduation._`;
            // Send photo with receipt as caption
            await this.bot.sendPhoto(chatId, mandoImageUrl, {
                caption: receiptCaption,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 My Orders', callback_data: 'snipe_list' }],
                        [{ text: '❌ Cancel This Snipe', callback_data: `cancel_snipe_${orderId}` }],
                        [{ text: '🔥 Snipe Another', callback_data: 'pump_near_grad' }],
                        [{ text: '⚜️ Gold Suite P&L', url: 'https://dtgc.io/gold' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
        }
        catch (error) {
            console.error('Failed to setup insta-snipe:', error);
            await this.bot.sendMessage(chatId, `❌ Failed to set up snipe. Try again.`, { reply_markup: keyboards.mainMenuKeyboard });
        }
    }
    /**
     * Show all snipe orders for user
     */
    async showSnipeOrders(chatId, userId) {
        const session = this.getSession(chatId);
        const orders = session.snipeOrders || [];
        if (orders.length === 0) {
            await this.bot.sendMessage(chatId, `📋 **My Snipe Orders**\n\n` +
                `_No active snipes. Set one up!_`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔥 TOP 10 Near Graduation', callback_data: 'pump_near_grad' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
            return;
        }
        let msg = `📋 **MY SNIPE ORDERS**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        const buttons = [];
        for (const order of orders) {
            const statusEmoji = order.status === 'pending' ? '🟡' :
                order.status === 'triggered' ? '🟠' :
                    order.status === 'filled' ? '🟢' : '🔴';
            const statusText = order.status.toUpperCase();
            const amountDisplay = order.amountPls >= 1_000_000
                ? `${(order.amountPls / 1_000_000).toFixed(0)}M`
                : `${(order.amountPls / 1_000).toFixed(0)}K`;
            msg += `${statusEmoji} **${order.id}** - ${statusText}\n`;
            msg += `Token: \`${order.tokenAddress.slice(0, 8)}...${order.tokenAddress.slice(-6)}\`\n`;
            msg += `💰 ${amountDisplay} PLS → ${order.walletAddress}\n`;
            if (order.status === 'filled' && order.tokensReceived) {
                msg += `✅ Got: ${order.tokensReceived} tokens\n`;
                // Add quick sell button for filled orders
                buttons.push([
                    { text: `💸 Sell ${order.id}`, callback_data: `quick_sell_${order.tokenAddress}` },
                    { text: `❌ Remove`, callback_data: `cancel_snipe_${order.id}` },
                ]);
            }
            else if (order.status === 'pending') {
                buttons.push([
                    { text: `❌ Cancel ${order.id}`, callback_data: `cancel_snipe_${order.id}` },
                ]);
            }
            msg += `\n`;
        }
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `_${orders.filter(o => o.status === 'pending').length} pending, `;
        msg += `${orders.filter(o => o.status === 'filled').length} filled_`;
        buttons.push([{ text: '🔥 Add New Snipe', callback_data: 'pump_near_grad' }]);
        buttons.push([{ text: '⚜️ Gold Suite P&L', url: 'https://dtgc.io/gold' }]);
        buttons.push([{ text: '🔙 Main Menu', callback_data: 'main_menu' }]);
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons },
        });
    }
    /**
     * Cancel a snipe order
     */
    async cancelSnipe(chatId, orderId) {
        const session = this.getSession(chatId);
        const orderIndex = session.snipeOrders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) {
            await this.bot.sendMessage(chatId, `❌ Order ${orderId} not found.`);
            return;
        }
        const order = session.snipeOrders[orderIndex];
        // Remove from watchlist
        try {
            graduation_1.graduationSniper.unwatchToken(order.tokenAddress);
        }
        catch (e) {
            // May not be watching, that's ok
        }
        // Remove from session
        session.snipeOrders.splice(orderIndex, 1);
        await this.bot.sendMessage(chatId, `✅ **Order Cancelled**\n\n` +
            `🆔 ${orderId}\n` +
            `Token: \`${order.tokenAddress.slice(0, 12)}...${order.tokenAddress.slice(-6)}\`\n\n` +
            `💰 ${(order.amountPls / 1_000_000).toFixed(0)}M PLS returned to wallet.`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 My Orders', callback_data: 'snipe_list' }],
                    [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                ],
            },
        });
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