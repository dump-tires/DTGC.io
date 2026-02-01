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
const jsonStore_1 = require("../db/jsonStore");
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
    pollingErrorCount = 0;
    maxPollingErrors = 10;
    constructor() {
        // Validate token before starting
        if (!config_1.config.telegramToken) {
            throw new Error('❌ BOT_TOKEN environment variable is not set! Please set it in Railway.');
        }
        console.log('🔑 Bot token found, initializing...');
        this.bot = new node_telegram_bot_api_1.default(config_1.config.telegramToken, {
            polling: {
                interval: 300,
                autoStart: true,
                params: {
                    timeout: 10,
                },
            },
        });
        // Handle polling errors (409 conflicts from multiple instances)
        this.bot.on('polling_error', (error) => {
            this.pollingErrorCount++;
            if (error.code === 'ETELEGRAM' && error.message.includes('409')) {
                // 409 Conflict - another bot instance is running
                if (this.pollingErrorCount === 1) {
                    console.log('⚠️ Another bot instance detected. Waiting for it to stop...');
                }
                // After too many errors, restart polling
                if (this.pollingErrorCount >= this.maxPollingErrors) {
                    console.log('🔄 Restarting polling after conflict resolution...');
                    this.pollingErrorCount = 0;
                    this.bot.stopPolling().then(() => {
                        setTimeout(() => {
                            this.bot.startPolling();
                        }, 5000);
                    });
                }
            }
            else {
                console.error('⚠️ Polling error:', error.message);
            }
        });
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
     * NOW WITH MINI APP VERIFICATION + PERSISTENT STORAGE
     */
    async checkGate(chatId, userId) {
        const session = this.getSession(chatId);
        // Cache gate check for 5 minutes
        if (session.gateVerified && Date.now() < session.gateExpiry) {
            return true;
        }
        // Priority 0: Check Mini App verification API first
        try {
            const verifyResponse = await fetch(`https://dtgc.io/api/tg-verify?telegramUserId=${userId}`);
            const verifyData = await verifyResponse.json();
            if (verifyData.verified && verifyData.balanceUsd && verifyData.balanceUsd >= 50 && verifyData.walletAddress) {
                console.log(`✅ Mini App verified wallet for user ${userId}: $${verifyData.balanceUsd}`);
                session.linkedWallet = verifyData.walletAddress;
                session.gateVerified = true;
                session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
                // Also persist to local storage
                jsonStore_1.LinkedWallets.link(userId, chatId, verifyData.walletAddress, verifyData.balanceUsd);
                return true;
            }
        }
        catch (e) {
            console.log(`[checkGate] Mini App API check failed, continuing with fallbacks`);
        }
        // Priority 1: Restore linked wallet from persistent storage if not in session
        if (!session.linkedWallet) {
            const persistedLink = jsonStore_1.LinkedWallets.get(userId);
            if (persistedLink) {
                console.log(`🔗 Restored linked wallet from storage for user ${userId}`);
                session.linkedWallet = persistedLink.walletAddress;
            }
        }
        // Priority 2: Check linked external wallet (MetaMask/Rabby)
        if (session.linkedWallet) {
            console.log(`🔍 Checking linked wallet: ${session.linkedWallet.slice(0, 10)}...`);
            const linkedGateResult = await tokenGate_1.tokenGate.checkAccess(session.linkedWallet);
            console.log(`💰 Gate result: allowed=${linkedGateResult.allowed}, balance=$${linkedGateResult.balanceUsd.toFixed(2)}`);
            if (linkedGateResult.allowed) {
                session.gateVerified = true;
                session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
                return true;
            }
        }
        // Priority 3: Check bot wallet
        const wallet = await wallet_1.walletManager.getWallet(userId);
        if (wallet) {
            console.log(`🔍 Checking bot wallet: ${wallet.address.slice(0, 10)}...`);
            const gateResult = await tokenGate_1.tokenGate.checkAccess(wallet.address);
            console.log(`💰 Bot wallet result: allowed=${gateResult.allowed}, balance=$${gateResult.balanceUsd.toFixed(2)}`);
            if (gateResult.allowed) {
                session.gateVerified = true;
                session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
                return true;
            }
        }
        // Neither wallet passed - show Mini App verification button
        const linkedAddr = session.linkedWallet ? `\n🔗 Linked: \`${session.linkedWallet.slice(0, 8)}...\`` : '';
        const botAddr = wallet ? `\n🤖 Bot: \`${wallet.address.slice(0, 8)}...\`` : '';
        await this.bot.sendMessage(chatId, `❌ **Gate Check Failed**\n\n` +
            `Hold $50+ of DTGC in your wallet to access PRO features.${linkedAddr}${botAddr}\n\n` +
            `⚜️ DTGC: \`${config_1.config.tokenGate.dtgc}\`\n\n` +
            `👇 **Tap below to verify your wallet**`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } }],
                    [{ text: '🔄 Refresh', callback_data: 'refresh_balance' }],
                ],
            },
        });
        return false;
    }
    /**
     * Handle web verification deep link from dtgc.io/gold
     * Token format: base64url_payload.signature
     */
    async handleWebVerification(chatId, userId, token) {
        try {
            // Parse the token
            const [payloadB64, signature] = token.split('.');
            if (!payloadB64 || !signature) {
                await this.bot.sendMessage(chatId, '❌ Invalid verification link. Please try again from dtgc.io/gold');
                return;
            }
            // Decode payload
            let payload;
            try {
                const payloadStr = Buffer.from(payloadB64, 'base64url').toString();
                payload = JSON.parse(payloadStr);
            }
            catch (e) {
                await this.bot.sendMessage(chatId, '❌ Invalid verification token. Please get a new link from dtgc.io/gold');
                return;
            }
            // Verify token signature (simple HMAC check)
            const crypto = require('crypto');
            const VERIFY_SECRET = process.env.VERIFY_SECRET || 'dtgc-gold-suite-verification-2024';
            const expectedSig = crypto
                .createHmac('sha256', VERIFY_SECRET)
                .update(payloadB64)
                .digest('hex')
                .substring(0, 16);
            if (signature !== expectedSig) {
                await this.bot.sendMessage(chatId, '❌ Verification failed - invalid signature. Please try again.');
                return;
            }
            // Check expiry
            if (payload.e && Date.now() > payload.e) {
                await this.bot.sendMessage(chatId, '❌ Verification link expired. Please get a new link from dtgc.io/gold');
                return;
            }
            // Check balance requirement (payload.u = USD value)
            if (payload.u < config_1.config.tokenGate.minHoldUsd) {
                await this.bot.sendMessage(chatId, `❌ Insufficient balance. You need $${config_1.config.tokenGate.minHoldUsd}+ of DTGC.\n\nYour balance: $${payload.u}`, { parse_mode: 'Markdown' });
                return;
            }
            // SUCCESS! Link the wallet
            const walletAddress = payload.a;
            const session = this.getSession(chatId);
            session.linkedWallet = walletAddress;
            session.gateVerified = true;
            session.gateExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hour verification
            // PERSIST the linked wallet so it survives bot restarts
            jsonStore_1.LinkedWallets.link(userId, chatId, walletAddress, payload.u);
            console.log(`✅ Wallet verified and persisted for user ${userId}: ${walletAddress.slice(0, 10)}...`);
            // Format balance
            const formatNumber = (v) => {
                if (v >= 1e9)
                    return (v / 1e9).toFixed(2) + 'B';
                if (v >= 1e6)
                    return (v / 1e6).toFixed(2) + 'M';
                if (v >= 1e3)
                    return (v / 1e3).toFixed(2) + 'K';
                return v.toFixed(0);
            };
            await this.bot.sendMessage(chatId, `✅ **Wallet Verified!**\n\n` +
                `🔗 **Linked Wallet:**\n\`${walletAddress}\`\n\n` +
                `💰 **DTGC Balance:** ${formatNumber(payload.b)} (~$${payload.u})\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎉 **Gold Suite Unlocked!**\n` +
                `You now have full access to all PRO features:\n\n` +
                `🎯 Instabond Sniper\n` +
                `⚡ New Pair Sniper\n` +
                `📊 Limit Orders\n` +
                `💱 DEX Trading\n` +
                `🛡️ Anti-Rug Protection\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `_Verification valid for 24 hours_`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
        catch (error) {
            console.error('Web verification error:', error);
            await this.bot.sendMessage(chatId, '❌ Verification failed. Please try again from dtgc.io/gold');
        }
    }
    setupHandlers() {
        // /start command - handles both normal start and verification deep links
        this.bot.onText(/\/start\s*(.*)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const param = match?.[1]?.trim() || '';
            // Check if this is a web verification deep link
            if (param.startsWith('verify_')) {
                const token = param.replace('verify_', '');
                await this.handleWebVerification(chatId, userId, token);
                return;
            }
            // Handle get_wallet deep link - show wallet address for funding
            if (param === 'get_wallet') {
                const wallet = await wallet_1.walletManager.getWallet(userId);
                if (wallet) {
                    await this.bot.sendMessage(chatId, `👛 **Your Bot Wallet**\n\n` +
                        `📋 **Address (tap to copy):**\n\`${wallet.address}\`\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `💡 **To fund your bot:**\n` +
                        `1. Copy the address above\n` +
                        `2. Send PLS from your main wallet\n` +
                        `3. Start trading!\n\n` +
                        `_Your DTGC-holding wallet stays safe_`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💰 Check Balance', callback_data: 'wallet_balance' }],
                                [{ text: '🔑 Export Private Key', callback_data: 'wallet_export' }],
                                [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                            ],
                        },
                    });
                }
                return;
            }
            // Handle P&L card deep link from Gold Suite
            if (param === 'pnl_card') {
                await this.bot.sendMessage(chatId, `📊 **Generate P&L Card**\n\n` +
                    `Share your trading performance with a beautiful P&L card!\n\n` +
                    `_Generating your card..._`);
                await this.generatePnLCard(chatId, userId);
                return;
            }
            const { wallet, isNew } = await wallet_1.walletManager.getOrCreateWallet(userId);
            // Check if user has linked wallet from persistent storage
            const persistedLink = jsonStore_1.LinkedWallets.get(userId);
            const hasLinkedWallet = !!persistedLink;
            // Show compact welcome with menu immediately visible
            let welcomeMsg = `⚜️ **DTG BOND BOT**\n`;
            welcomeMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            if (isNew) {
                welcomeMsg += `✨ **Welcome!** Your bot wallet:\n`;
                welcomeMsg += `\`${wallet.address}\`\n\n`;
                welcomeMsg += `⚠️ **Fund this wallet with PLS to trade!**\n\n`;
            }
            else {
                welcomeMsg += `👋 **Welcome back!**\n\n`;
            }
            if (hasLinkedWallet) {
                welcomeMsg += `✅ **Wallet Linked:** \`${persistedLink.walletAddress.slice(0, 8)}...\`\n`;
                welcomeMsg += `💰 Balance: ~$${persistedLink.balanceUsd}\n\n`;
            }
            else {
                welcomeMsg += `🔗 **Link your DTGC wallet** to unlock all features\n`;
                welcomeMsg += `⚜️ Hold $50+ DTGC for PRO access\n\n`;
            }
            welcomeMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            welcomeMsg += `📱 **Select an option below:**\n`;
            welcomeMsg += `ℹ️ Tap **Help** for feature explanations`;
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
            // Fetch real current price from PulseX
            let currentPrice = position.buyPrice; // Default to buy price
            try {
                const pairInfo = await pulsex_1.pulsex.getPairInfo(input);
                if (pairInfo && pairInfo.reserve0 > 0n && pairInfo.reserve1 > 0n) {
                    // Calculate price: PLS reserve / token reserve (assuming token1 is WPLS)
                    const priceInPls = Number(pairInfo.reserve1) / Number(pairInfo.reserve0);
                    if (priceInPls > 0) {
                        currentPrice = priceInPls;
                    }
                }
            }
            catch (e) {
                console.log('Could not fetch current price, using buy price');
            }
            const pnlMsg = (0, pnlCard_1.generatePnLMessage)({
                tokenName: position.tokenName,
                contractAddress: input,
                buyPrice: position.buyPrice,
                currentPrice: currentPrice,
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
        // Link external wallet - directs users to dtgc.io/gold for secure wallet verification
        if (data === 'link_wallet') {
            await this.bot.sendMessage(chatId, `🔗 **Link Your Wallet**\n\n` +
                `To verify your DTGC holdings, connect your wallet on our web app:\n\n` +
                `1️⃣ Go to **dtgc.io/gold**\n` +
                `2️⃣ Connect your wallet (MetaMask, Rabby, etc.)\n` +
                `3️⃣ Click **"🤖 Link TG Bot"** button\n` +
                `4️⃣ Sign the verification message\n` +
                `5️⃣ Click the Telegram link to verify!\n\n` +
                `✅ This securely proves you own $50+ DTGC`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🌐 Open dtgc.io/gold', url: 'https://dtgc.io/gold' }],
                        [{ text: '🔙 Back', callback_data: 'main_menu' }],
                    ],
                },
            });
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
        // Wallets menu - show wallet info with copy-friendly display
        if (data === 'wallets_menu') {
            const wallet = await wallet_1.walletManager.getWallet(userId);
            if (wallet) {
                await this.bot.sendMessage(chatId, `👛 **Your Bot Wallet**\n\n` +
                    `📋 **Address (tap to copy):**\n\`${wallet.address}\`\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `💡 **How to use:**\n` +
                    `1. Copy address above\n` +
                    `2. Send PLS from your main wallet\n` +
                    `3. Link DTGC wallet via Gold Suite\n` +
                    `4. Start trading!\n\n` +
                    `🔗 **Link your DTGC wallet:** dtgc.io/gold`, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.walletsMenuKeyboard,
                });
            }
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
        // Snipe specific CA from pump.tires
        if (data === 'pump_snipe_token') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'pump_snipe_ca';
            await this.bot.sendMessage(chatId, `🎯 **Snipe Specific Token**\n\n` +
                `Enter the pump.tires token contract address:`, { parse_mode: 'Markdown' });
            return;
        }
        // Cancel all snipes
        if (data === 'snipe_cancel_all') {
            const cancelled = session.snipeOrders.filter(o => o.status === 'pending').length;
            session.snipeOrders = session.snipeOrders.filter(o => o.status !== 'pending');
            await this.bot.sendMessage(chatId, `✅ Cancelled ${cancelled} pending snipes.`, { reply_markup: keyboards.snipeMenuKeyboard });
            return;
        }
        // Delete all pending snipes
        if (data === 'snipe_delete_pending') {
            const pending = session.snipeOrders.filter(o => o.status === 'pending');
            // Unwatch all pending tokens
            for (const order of pending) {
                try {
                    graduation_1.graduationSniper.unwatchToken(order.tokenAddress);
                }
                catch { }
            }
            session.snipeOrders = session.snipeOrders.filter(o => o.status !== 'pending');
            await this.bot.sendMessage(chatId, `🗑️ **Deleted ${pending.length} pending snipes**\n\n_All pending orders removed._`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeMenuKeyboard });
            return;
        }
        // Clear completed/filled snipes (keep pending)
        if (data === 'snipe_clear_completed') {
            const cleared = session.snipeOrders.filter(o => o.status !== 'pending').length;
            session.snipeOrders = session.snipeOrders.filter(o => o.status === 'pending');
            await this.bot.sendMessage(chatId, `🧹 **Cleared ${cleared} completed orders**\n\n_History cleaned. Pending orders kept._`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeMenuKeyboard });
            return;
        }
        // Delete ALL snipes
        if (data === 'snipe_delete_all') {
            const total = session.snipeOrders.length;
            // Unwatch all tokens
            for (const order of session.snipeOrders) {
                try {
                    graduation_1.graduationSniper.unwatchToken(order.tokenAddress);
                }
                catch { }
            }
            session.snipeOrders = [];
            await this.bot.sendMessage(chatId, `🗑️ **Deleted ALL ${total} snipe orders**\n\n_Clean slate!_`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeMenuKeyboard });
            return;
        }
        // Generate P&L Card
        if (data === 'generate_pnl_card') {
            await this.generatePnLCard(chatId, userId);
            return;
        }
        // Portfolio view
        if (data === 'portfolio') {
            await this.showPortfolio(chatId, userId);
            return;
        }
        // Settings toggles
        if (data === 'toggle_antirug') {
            session.settings.antiRug = !session.settings.antiRug;
            await this.bot.sendMessage(chatId, `🛡️ Anti-Rug Protection: ${session.settings.antiRug ? '**ON** ✅' : '**OFF** ❌'}`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        if (data === 'toggle_alerts') {
            session.settings.alerts = !session.settings.alerts;
            await this.bot.sendMessage(chatId, `🔔 Trade Alerts: ${session.settings.alerts ? '**ON** ✅' : '**OFF** ❌'}`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        if (data === 'set_slippage') {
            await this.bot.sendMessage(chatId, `📊 Current slippage: **${session.settings.slippage}%**\n\nSelect new slippage:`, { parse_mode: 'Markdown', reply_markup: keyboards.slippageKeyboard });
            return;
        }
        // Slippage selection
        if (data.startsWith('slip_')) {
            const slip = data.replace('slip_', '');
            if (slip === 'custom') {
                session.pendingAction = 'set_custom_slippage';
                await this.bot.sendMessage(chatId, '📝 Enter custom slippage percentage (1-100):');
            }
            else {
                session.settings.slippage = parseInt(slip);
                await this.bot.sendMessage(chatId, `✅ Slippage set to **${slip}%**`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            }
            return;
        }
        // Gas settings
        if (data === 'set_gas') {
            session.pendingAction = 'set_custom_gas';
            await this.bot.sendMessage(chatId, `⛽ Current gas limit: **${session.settings.gasLimit}**\n\nEnter new gas limit (e.g., 500000):`, { parse_mode: 'Markdown' });
            return;
        }
        // Toggle frontrun protection
        if (data === 'toggle_frontrun') {
            const frontrun = !session.settings.frontrun;
            session.settings.frontrun = frontrun;
            await this.bot.sendMessage(chatId, `⚡ Frontrun Protection: ${frontrun ? '**ON** ✅' : '**OFF** ❌'}`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        // Toggle auto-sell
        if (data === 'toggle_autosell') {
            const autosell = !session.settings.autosell;
            session.settings.autosell = autosell;
            await this.bot.sendMessage(chatId, `🤖 Auto-Sell: ${autosell ? '**ON** ✅' : '**OFF** ❌'}`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        // Set default buy amount
        if (data === 'set_default_buy') {
            session.pendingAction = 'set_default_buy_amount';
            await this.bot.sendMessage(chatId, '💰 Enter default buy amount in PLS:');
            return;
        }
        // Copy Trade menu (placeholder - feature coming soon)
        if (data === 'copy_menu') {
            await this.bot.sendMessage(chatId, `🐋 **Copy Trade** ⚜️\n\n` +
                `_This feature is coming soon!_\n\n` +
                `Copy whale wallets automatically.`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // ℹ️ HELP MENU - Feature explanations
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'help_menu') {
            await this.bot.sendMessage(chatId, `ℹ️ **DTG BOND BOT - Help Center**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Select a feature to learn more:\n\n` +
                `💰 **Buy/Sell** - Instant DEX trading\n` +
                `🎯 **Sniper** - New pair sniper\n` +
                `🎓 **InstaBond** - pump.tires graduation sniper\n` +
                `📊 **Limit Orders** - Set buy/sell targets\n` +
                `🛡️ **Anti-Rug** - Token safety check\n` +
                `👛 **Wallets** - Multi-wallet management\n` +
                `⚜️ **Token Gate** - DTGC holder access\n` +
                `📈 **Portfolio** - Track your holdings\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_buy_sell') {
            await this.bot.sendMessage(chatId, `💰 **BUY / SELL**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**How it works:**\n` +
                `• Paste any token contract address\n` +
                `• Enter the amount in PLS to spend\n` +
                `• Swap executes via PulseX DEX\n\n` +
                `**Features:**\n` +
                `✅ Best route finding (multi-hop)\n` +
                `✅ Slippage protection (configurable)\n` +
                `✅ Gas priority options\n` +
                `✅ 1% fee (0.5% DTGC burn + 0.5% dev)\n\n` +
                `**Tips:**\n` +
                `• Set slippage higher for volatile tokens\n` +
                `• Use TURBO gas for fast execution\n` +
                `• Check Anti-Rug before buying!`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_sniper') {
            await this.bot.sendMessage(chatId, `🎯 **SNIPER**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**New Pair Sniper:**\n` +
                `• Detects new token launches on PulseX\n` +
                `• Auto-executes buy on liquidity add\n` +
                `• Configurable amount and gas priority\n\n` +
                `**How to use:**\n` +
                `1. Go to Sniper menu\n` +
                `2. Select "Snipe New Pair"\n` +
                `3. Paste token CA\n` +
                `4. Set amount and gas priority\n` +
                `5. Bot watches for liquidity\n\n` +
                `**Tips:**\n` +
                `• Use high gas (TURBO) to beat others\n` +
                `• Set stop loss to protect profits\n` +
                `• DYOR - sniping is risky!`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_instabond') {
            await this.bot.sendMessage(chatId, `🎓 **INSTABOND SNIPER (pump.tires)**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**What is InstaBond?**\n` +
                `pump.tires tokens "graduate" when they hit\n` +
                `200M PLS in their bonding curve. When they\n` +
                `graduate, liquidity is added to PulseX.\n\n` +
                `**How InstaBond works:**\n` +
                `1. Browse "Top 10 Near Graduation"\n` +
                `2. Select a token close to 200M PLS\n` +
                `3. Set your snipe amount\n` +
                `4. Bot watches for graduation event\n` +
                `5. Auto-buys FIRST on PulseX! 🚀\n\n` +
                `**Breakeven Math:**\n` +
                `• Entry at 1x → Sell 100% at 2x to breakeven\n` +
                `• Entry at 2x → Sell 50% at 2x to breakeven\n\n` +
                `**Tips:**\n` +
                `• Set Take Profit right after snipe\n` +
                `• Higher bonding = safer but less upside`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_orders') {
            await this.bot.sendMessage(chatId, `📊 **LIMIT ORDERS**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**Order Types:**\n` +
                `• **Limit Buy** - Buy when price drops to target\n` +
                `• **Limit Sell** - Sell when price rises to target\n` +
                `• **Take Profit** - Auto-sell at profit target\n` +
                `• **Stop Loss** - Auto-sell if price drops\n\n` +
                `**How it works:**\n` +
                `1. Set your target price\n` +
                `2. Bot monitors price continuously\n` +
                `3. Executes when target is hit\n\n` +
                `**Tips:**\n` +
                `• Always set stop loss on risky trades\n` +
                `• Take Profit secures your gains\n` +
                `• Orders stay active until executed or cancelled`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_antirug') {
            await this.bot.sendMessage(chatId, `🛡️ **ANTI-RUG PROTECTION**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**What it checks:**\n` +
                `✅ Honeypot detection\n` +
                `✅ Ownership renounced?\n` +
                `✅ Liquidity locked?\n` +
                `✅ Contract verified?\n` +
                `✅ Buy/Sell tax analysis\n` +
                `✅ Holder distribution\n` +
                `✅ Top holder concentration\n\n` +
                `**Risk Levels:**\n` +
                `🟢 LOW - Generally safe\n` +
                `🟡 MEDIUM - Proceed with caution\n` +
                `🔴 HIGH - Likely scam, avoid!\n\n` +
                `**How to use:**\n` +
                `1. Tap "🛡️ Anti-Rug Check"\n` +
                `2. Paste any token CA\n` +
                `3. Get instant safety report\n\n` +
                `⚠️ **ALWAYS check before buying!**`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_wallets') {
            await this.bot.sendMessage(chatId, `👛 **WALLETS**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**Wallet Types:**\n\n` +
                `🔗 **Linked Wallet (External)**\n` +
                `• Your main wallet (MetaMask, Rabby, etc.)\n` +
                `• Holds your DTGC for gate access\n` +
                `• Verified via dtgc.io/gold\n` +
                `• Safe - never shares private keys\n\n` +
                `🤖 **Bot Wallet (Internal)**\n` +
                `• Auto-generated for trading\n` +
                `• Fund with PLS for quick trades\n` +
                `• Can generate up to 6 snipe wallets\n` +
                `• Export keys anytime\n\n` +
                `**Best Practice:**\n` +
                `• Keep DTGC in your main wallet\n` +
                `• Send only trading PLS to bot wallet\n` +
                `• Never put large amounts in bot wallet`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_gate') {
            await this.bot.sendMessage(chatId, `⚜️ **TOKEN GATE**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**What is the Gate?**\n` +
                `To access PRO features, you need to hold\n` +
                `at least **$50 worth of DTGC** tokens.\n\n` +
                `**How to verify:**\n` +
                `1. Buy DTGC on PulseX\n` +
                `2. Go to dtgc.io/gold\n` +
                `3. Connect your wallet\n` +
                `4. Click "Link TG Bot"\n` +
                `5. Sign the verification message\n\n` +
                `**DTGC Contract:**\n` +
                `\`0xD0676B28a457371D58d47E5247b439114e40Eb0F\`\n\n` +
                `**Benefits:**\n` +
                `✅ Access all sniper features\n` +
                `✅ Limit orders\n` +
                `✅ InstaBond graduation sniper\n` +
                `✅ Anti-Rug protection\n` +
                `✅ Portfolio tracking`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        if (data === 'help_portfolio') {
            await this.bot.sendMessage(chatId, `📈 **PORTFOLIO**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**Features:**\n` +
                `• View all token holdings\n` +
                `• Real-time USD values\n` +
                `• P&L tracking per trade\n` +
                `• Historical performance\n\n` +
                `**Gold Suite (dtgc.io/gold):**\n` +
                `• Enhanced portfolio view\n` +
                `• Interactive charts\n` +
                `• Trade directly from UI\n` +
                `• Mobile-optimized\n\n` +
                `**Tips:**\n` +
                `• Refresh to update balances\n` +
                `• Use Trade History for records\n` +
                `• Gold Suite has more features!`, { parse_mode: 'Markdown', reply_markup: keyboards.helpMenuKeyboard });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // 📋 TRADE HISTORY MENU
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'history_menu') {
            await this.showTradeHistory(chatId, userId);
            return;
        }
        if (data === 'history_active') {
            await this.showActiveOrders(chatId, userId);
            return;
        }
        if (data === 'history_completed') {
            await this.showCompletedTrades(chatId, userId);
            return;
        }
        if (data === 'history_instabond') {
            await this.showInstaBondHistory(chatId, userId);
            return;
        }
        if (data === 'history_limits') {
            await this.showLimitOrderHistory(chatId, userId);
            return;
        }
        if (data === 'history_pnl') {
            await this.showPnLSummary(chatId, userId);
            return;
        }
        if (data.startsWith('history_cancel_')) {
            const orderId = data.replace('history_cancel_', '');
            const cancelled = jsonStore_1.TradeHistory.cancelOrder(orderId);
            if (cancelled) {
                await this.bot.sendMessage(chatId, `✅ Order \`${orderId}\` cancelled successfully.`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            }
            else {
                await this.bot.sendMessage(chatId, `❌ Could not cancel order \`${orderId}\`. It may already be executed or cancelled.`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            }
            return;
        }
        // Snipe menu items
        if (data === 'snipe_instabond') {
            // Same as pump_near_grad - show top 10 near graduation
            if (!await this.checkGate(chatId, userId))
                return;
            await this.showNearGradTokens(chatId);
            return;
        }
        if (data === 'snipe_new_pair') {
            // Same as snipe_new
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'snipe_token_address';
            await this.bot.sendMessage(chatId, '📝 Enter token address to snipe when liquidity is added:');
            return;
        }
        if (data === 'snipe_watch') {
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'watch_token_address';
            await this.bot.sendMessage(chatId, '👀 Enter token address to watch:');
            return;
        }
        if (data === 'snipe_auto_grad') {
            // Same as pump_auto_snipe
            if (!await this.checkGate(chatId, userId))
                return;
            session.pendingAction = 'auto_snipe_amount';
            await this.bot.sendMessage(chatId, '💰 Enter PLS amount to auto-snipe ALL graduating tokens:');
            return;
        }
        // Pump menu items
        if (data === 'pump_graduated') {
            await this.bot.sendMessage(chatId, `🎓 **Recently Bonded Tokens**\n\n` +
                `_Fetching recently graduated tokens..._\n\n` +
                `Check https://pump.tires for the full list.`, { parse_mode: 'Markdown', reply_markup: keyboards.pumpMenuKeyboard });
            return;
        }
        if (data === 'pump_new') {
            await this.bot.sendMessage(chatId, `🆕 **New Tokens**\n\n` +
                `_Check https://pump.tires for new launches._`, { parse_mode: 'Markdown', reply_markup: keyboards.pumpMenuKeyboard });
            return;
        }
        // Wallet management
        if (data === 'wallets_toggle') {
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n\n` +
                `_Wallet toggle coming soon._`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            return;
        }
        if (data === 'wallets_labels') {
            await this.bot.sendMessage(chatId, `🏷️ **Set Wallet Labels**\n\n` +
                `_Wallet labels coming soon._`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            return;
        }
        if (data === 'wallets_import') {
            session.pendingAction = 'import_wallet_key';
            await this.bot.sendMessage(chatId, `📥 **Import Wallet**\n\n` +
                `⚠️ Enter your private key (64 hex chars):`, { parse_mode: 'Markdown' });
            return;
        }
        // Order trailing stop
        if (data === 'order_trailing') {
            await this.bot.sendMessage(chatId, `📈 **Trailing Stop**\n\n` +
                `_Trailing stop orders coming soon._`, { parse_mode: 'Markdown', reply_markup: keyboards.ordersMenuKeyboard });
            return;
        }
        // Order cancel all
        if (data === 'order_cancel_all') {
            await this.bot.sendMessage(chatId, `❌ All pending orders cancelled.`, { reply_markup: keyboards.ordersMenuKeyboard });
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
        // Custom snipe amount - prompt user to enter amount
        if (data === 'snipe_amt_custom' && session.pendingAction === 'instasnipe_amount') {
            session.pendingAction = 'instasnipe_custom_amount';
            await this.bot.sendMessage(chatId, `📝 **Enter Custom PLS Amount**\n\n` +
                `Token: \`${session.pendingToken?.slice(0, 12)}...\`\n\n` +
                `Enter amount in PLS (e.g., 2500000 for 2.5M):`, { parse_mode: 'Markdown' });
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
        // ===== LIMIT BOND SELL (Take Profit) Setup =====
        if (data.startsWith('set_tp_')) {
            const orderId = data.replace('set_tp_', '');
            session.pendingAction = 'limit_bond_sell_percent';
            session.pendingToken = orderId; // Store orderId temporarily
            await this.bot.sendMessage(chatId, `📈 **LIMIT BOND SELL - Breakeven Initials**\n\n` +
                `Set auto-sell after price increase.\n\n` +
                `📊 **Select price increase % to trigger:**\n\n` +
                `_Example: 100% = 2x, 50% = 1.5x, 200% = 3x_`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '50% (1.5x)', callback_data: `tp_percent_50_${orderId}` },
                            { text: '100% (2x)', callback_data: `tp_percent_100_${orderId}` },
                        ],
                        [
                            { text: '150% (2.5x)', callback_data: `tp_percent_150_${orderId}` },
                            { text: '200% (3x)', callback_data: `tp_percent_200_${orderId}` },
                        ],
                        [
                            { text: '300% (4x)', callback_data: `tp_percent_300_${orderId}` },
                            { text: '500% (6x)', callback_data: `tp_percent_500_${orderId}` },
                        ],
                        [{ text: '✏️ Custom %', callback_data: `tp_custom_${orderId}` }],
                        [{ text: '🔙 Cancel', callback_data: 'snipe_list' }],
                    ],
                },
            });
            return;
        }
        // Handle take profit percent selection
        if (data.startsWith('tp_percent_')) {
            const parts = data.replace('tp_percent_', '').split('_');
            const percent = parseInt(parts[0]);
            const orderId = parts.slice(1).join('_');
            session.pendingAction = 'limit_bond_sell_amount';
            session.pendingToken = orderId;
            session.pendingAmount = percent.toString();
            await this.bot.sendMessage(chatId, `📊 **Sell % of Tokens at ${percent}% Gain:**\n\n` +
                `How much of your position to sell when target is hit?\n\n` +
                `💡 _50% = "Breakeven Initials" (recover investment)_`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '25%', callback_data: `tp_sell_25_${percent}_${orderId}` },
                            { text: '50% ⭐', callback_data: `tp_sell_50_${percent}_${orderId}` },
                        ],
                        [
                            { text: '75%', callback_data: `tp_sell_75_${percent}_${orderId}` },
                            { text: '100%', callback_data: `tp_sell_100_${percent}_${orderId}` },
                        ],
                        [{ text: '🔙 Back', callback_data: `set_tp_${orderId}` }],
                    ],
                },
            });
            return;
        }
        // Handle custom TP percent input
        if (data.startsWith('tp_custom_')) {
            const orderId = data.replace('tp_custom_', '');
            session.pendingAction = 'limit_bond_custom_percent';
            session.pendingToken = orderId;
            await this.bot.sendMessage(chatId, `✏️ Enter custom price increase % (e.g., 75 for 75%):`, { parse_mode: 'Markdown' });
            return;
        }
        // Final confirmation - set up the limit bond sell
        if (data.startsWith('tp_sell_')) {
            const parts = data.replace('tp_sell_', '').split('_');
            const sellPercent = parseInt(parts[0]);
            const tpPercent = parseInt(parts[1]);
            const orderId = parts.slice(2).join('_');
            await this.setupLimitBondSell(chatId, orderId, tpPercent, sellPercent);
            return;
        }
        // Cancel take profit
        if (data.startsWith('cancel_tp_')) {
            const orderId = data.replace('cancel_tp_', '');
            const order = session.snipeOrders.find(o => o.id === orderId);
            if (order) {
                order.takeProfitEnabled = false;
                order.takeProfitStatus = 'cancelled';
                await this.bot.sendMessage(chatId, `✅ **Take Profit Cancelled**\n\nOrder: ${orderId}`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '📋 My Orders', callback_data: 'snipe_list' }]] } });
            }
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
        // Pump.tires snipe specific CA
        if (session.pendingAction === 'pump_snipe_ca') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid contract address. Try again:');
                return;
            }
            session.pendingToken = text;
            session.pendingAction = 'instasnipe_amount';
            await this.bot.sendMessage(chatId, `🎯 **Insta-Snipe Setup**\n\n` +
                `Token: \`${text.slice(0, 10)}...${text.slice(-8)}\`\n\n` +
                `Select PLS amount per wallet:`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeAmountKeyboard });
            return;
        }
        // Custom slippage setting
        if (session.pendingAction === 'set_custom_slippage') {
            const slippage = parseFloat(text);
            if (isNaN(slippage) || slippage < 1 || slippage > 100) {
                await this.bot.sendMessage(chatId, '❌ Invalid slippage. Enter 1-100:');
                return;
            }
            session.settings.slippage = Math.floor(slippage);
            session.pendingAction = undefined;
            await this.bot.sendMessage(chatId, `✅ Slippage set to **${session.settings.slippage}%**`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        // Custom gas limit setting
        if (session.pendingAction === 'set_custom_gas') {
            const gasLimit = parseInt(text);
            if (isNaN(gasLimit) || gasLimit < 21000 || gasLimit > 10000000) {
                await this.bot.sendMessage(chatId, '❌ Invalid gas limit. Enter 21000-10000000:');
                return;
            }
            session.settings.gasLimit = gasLimit;
            session.pendingAction = undefined;
            await this.bot.sendMessage(chatId, `✅ Gas limit set to **${gasLimit}**`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        // Default buy amount setting
        if (session.pendingAction === 'set_default_buy_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Enter a positive number:');
                return;
            }
            session.settings.defaultBuy = amount;
            session.pendingAction = undefined;
            await this.bot.sendMessage(chatId, `✅ Default buy set to **${amount} PLS**`, { parse_mode: 'Markdown', reply_markup: keyboards.settingsKeyboard });
            return;
        }
        // Watch token address
        if (session.pendingAction === 'watch_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingAction = undefined;
            await this.bot.sendMessage(chatId, `👀 **Watching Token**\n\n` +
                `\`${text}\`\n\n` +
                `_You'll be notified of price changes._`, { parse_mode: 'Markdown', reply_markup: keyboards.snipeMenuKeyboard });
            return;
        }
        // Import wallet private key
        if (session.pendingAction === 'import_wallet_key') {
            // Validate private key format (64 hex chars, optionally with 0x prefix)
            const cleanKey = text.startsWith('0x') ? text.slice(2) : text;
            if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
                await this.bot.sendMessage(chatId, '❌ Invalid private key format. Must be 64 hex characters:');
                return;
            }
            try {
                const wallet = new ethers_1.ethers.Wallet(text);
                session.pendingAction = undefined;
                await this.bot.sendMessage(chatId, `✅ **Wallet Imported**\n\n` +
                    `Address: \`${wallet.address}\`\n\n` +
                    `⚠️ _Private key stored securely._`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            }
            catch (e) {
                await this.bot.sendMessage(chatId, '❌ Invalid private key. Try again:');
            }
            return;
        }
        // Custom insta-snipe amount -> then gas priority
        if (session.pendingAction === 'instasnipe_custom_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Enter a positive number:');
                return;
            }
            session.pendingAmount = Math.floor(amount).toString();
            session.pendingAction = 'instasnipe_gas';
            const amountDisplay = amount >= 1_000_000
                ? `${(amount / 1_000_000).toFixed(1)}M`
                : amount >= 1_000
                    ? `${(amount / 1_000).toFixed(0)}K`
                    : amount.toString();
            await this.bot.sendMessage(chatId, `⛽ **Select Gas Priority**\n\n` +
                `Higher gas = faster execution = first-mover advantage!\n\n` +
                `💰 Amount: ${amountDisplay} PLS\n` +
                `🎯 Token: \`${session.pendingToken?.slice(0, 12)}...\``, { parse_mode: 'Markdown', reply_markup: keyboards.gasPriorityKeyboard });
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
     * Show portfolio with all positions and P&L
     */
    async showPortfolio(chatId, userId) {
        await this.bot.sendMessage(chatId, '📊 Loading portfolio...');
        const session = this.getSession(chatId);
        const positions = pnlCard_1.positionStore.getPositions(userId);
        if (!positions || positions.length === 0) {
            await this.bot.sendMessage(chatId, `📈 **Portfolio** ⚜️\n\n` +
                `_No positions yet. Start trading!_`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.mainMenuKeyboard,
            });
            return;
        }
        let msg = `📈 **PORTFOLIO** ⚜️\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        let totalInvested = 0;
        let totalValue = 0;
        for (const pos of positions) {
            // Get current price
            let currentPrice = pos.buyPrice;
            try {
                const pairInfo = await pulsex_1.pulsex.getPairInfo(pos.tokenAddress);
                if (pairInfo && pairInfo.reserve0 > 0n && pairInfo.reserve1 > 0n) {
                    const priceInPls = Number(pairInfo.reserve1) / Number(pairInfo.reserve0);
                    if (priceInPls > 0)
                        currentPrice = priceInPls;
                }
            }
            catch { }
            const invested = pos.amount * pos.buyPrice;
            const value = pos.amount * currentPrice;
            const pnlPct = ((currentPrice - pos.buyPrice) / pos.buyPrice) * 100;
            const pnlEmoji = pnlPct >= 0 ? '🟢' : '🔴';
            totalInvested += invested;
            totalValue += value;
            msg += `${pnlEmoji} **${pos.tokenName || 'Unknown'}**\n`;
            msg += `Amt: ${pos.amount.toFixed(2)} | P&L: ${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%\n\n`;
        }
        const totalPnlPct = totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `💰 **Total P&L:** ${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%\n`;
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.mainMenuKeyboard,
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
            // Log to trade history for persistent record
            jsonStore_1.TradeHistory.logInstaBondSnipe(userId, chatId, tokenAddress, snipeOrder.id, // Use order ID as symbol for now
            plsAmount.toString());
            // Set up graduation snipe using watchToken with gas priority and user info
            graduation_1.graduationSniper.watchToken(tokenAddress, {
                amountPls: BigInt(plsAmount) * BigInt(10 ** 18),
                slippage: session.settings.slippage,
                gasLimit: session.settings.gasLimit,
                gasPriceMultiplier: gasGwei >= 1 ? 10 : gasGwei >= 0.1 ? 5 : 2, // Higher multiplier for speed
                userId: userId, // For wallet lookup
                chatId: chatId, // For notifications
                orderId: orderId, // For tracking
            });
            // Format amount display
            const amountDisplay = plsAmount >= 1_000_000
                ? `${(plsAmount / 1_000_000).toFixed(0)}M PLS`
                : `${(plsAmount / 1_000).toFixed(0)}K PLS`;
            // InstaBond Snipe Receipt
            const receiptMsg = `✅ **INSTABOND SNIPE ARMED!**\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `🆔 Order: \`${orderId}\`\n` +
                `📊 Status: 🟡 **WAITING FOR GRADUATION**\n\n` +
                `━━━ TARGET ━━━\n` +
                `📋 \`${tokenAddress}\`\n\n` +
                `━━━ CONFIG ━━━\n` +
                `💰 Amount: **${amountDisplay}**\n` +
                `👛 Wallet: ${walletLabel}\n` +
                `⛽ Gas: ${gasLabel} (${gasGwei} Gwei)\n` +
                `🔧 Slippage: ${session.settings.slippage}%\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚜️ **Auto-executes when token graduates to PulseX!**\n\n` +
                `💡 Set a **Limit Bond Sell** below to auto-take profit!`;
            // Send receipt message
            await this.bot.sendMessage(chatId, receiptMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📈 Set Limit Bond Sell (Take Profit)', callback_data: `set_tp_${orderId}` }],
                        [{ text: '📋 My Orders', callback_data: 'snipe_list' }],
                        [{ text: '❌ Cancel Snipe', callback_data: `cancel_snipe_${orderId}` }],
                        [{ text: '🔥 Snipe Another', callback_data: 'pump_near_grad' }],
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
            // Show take profit status if enabled
            if (order.takeProfitEnabled && order.takeProfitPercent && order.sellPercent) {
                const tpEmoji = order.takeProfitStatus === 'filled' ? '✅' :
                    order.takeProfitStatus === 'active' ? '🎯' : '⏸️';
                msg += `${tpEmoji} TP: ${order.takeProfitPercent}% → Sell ${order.sellPercent}%\n`;
            }
            if (order.status === 'filled' && order.tokensReceived) {
                msg += `✅ Got: ${order.tokensReceived} tokens\n`;
                // Add buttons for filled orders
                const filledButtons = [
                    { text: `💸 Sell`, callback_data: `quick_sell_${order.tokenAddress}` },
                ];
                if (!order.takeProfitEnabled) {
                    filledButtons.push({ text: `📈 Set TP`, callback_data: `set_tp_${order.id}` });
                }
                filledButtons.push({ text: `❌`, callback_data: `cancel_snipe_${order.id}` });
                buttons.push(filledButtons);
            }
            else if (order.status === 'pending') {
                const pendingButtons = [];
                if (!order.takeProfitEnabled) {
                    pendingButtons.push({ text: `📈 Set TP`, callback_data: `set_tp_${order.id}` });
                }
                pendingButtons.push({ text: `❌ Cancel`, callback_data: `cancel_snipe_${order.id}` });
                buttons.push(pendingButtons);
            }
            msg += `\n`;
        }
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `_${orders.filter(o => o.status === 'pending').length} pending, `;
        msg += `${orders.filter(o => o.status === 'filled').length} filled_`;
        // Add bulk action buttons
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        const completedCount = orders.filter(o => o.status !== 'pending').length;
        if (pendingCount > 0) {
            buttons.push([{ text: `🗑️ Delete All Pending (${pendingCount})`, callback_data: 'snipe_delete_pending' }]);
        }
        if (completedCount > 0) {
            buttons.push([{ text: `🧹 Clear Completed (${completedCount})`, callback_data: 'snipe_clear_completed' }]);
        }
        if (orders.length > 0) {
            buttons.push([{ text: '🗑️ Delete ALL Snipes', callback_data: 'snipe_delete_all' }]);
        }
        buttons.push([{ text: '🔥 Add New Snipe', callback_data: 'pump_near_grad' }]);
        buttons.push([{ text: '📊 Generate P&L Card', callback_data: 'generate_pnl_card' }]);
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
    /**
     * Set up Limit Bond Sell (Take Profit) for a snipe order
     * Automatically sells a percentage of tokens when price increases by target %
     */
    async setupLimitBondSell(chatId, orderId, tpPercent, sellPercent) {
        const session = this.getSession(chatId);
        const order = session.snipeOrders.find(o => o.id === orderId);
        if (!order) {
            await this.bot.sendMessage(chatId, `❌ Order ${orderId} not found.`);
            return;
        }
        // Set take profit params on the order
        order.takeProfitEnabled = true;
        order.takeProfitPercent = tpPercent;
        order.sellPercent = sellPercent;
        order.takeProfitStatus = 'active';
        const multiplier = (100 + tpPercent) / 100;
        await this.bot.sendMessage(chatId, `✅ **LIMIT BOND SELL ARMED**\n\n` +
            `━━━ ORDER: ${orderId} ━━━\n\n` +
            `🎯 **Trigger:** ${tpPercent}% price increase (${multiplier}x)\n` +
            `📊 **Sell:** ${sellPercent}% of tokens\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `💡 **Breakeven Strategy:**\n` +
            `At ${multiplier}x, selling ${sellPercent}% recovers ` +
            `${Math.floor((sellPercent * multiplier / 100) * 100)}% of initial!\n\n` +
            `⚜️ *Auto-executes when target is hit*`, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 My Orders', callback_data: 'snipe_list' }],
                    [{ text: '❌ Cancel TP', callback_data: `cancel_tp_${orderId}` }],
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
⚜️ **DTG BOND BOT Help**

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
• InstaBond - Auto-buy pump.tires graduations
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
            const { tokenAddress, pairInfo, userId, chatId, orderId, amountPls, slippage, gasLimit } = data;
            console.log(`🎯 snipeReady event received for ${tokenAddress}`);
            console.log(`   User: ${userId}, Chat: ${chatId}, Amount: ${amountPls ? ethers_1.ethers.formatEther(amountPls) : '?'} PLS`);
            if (!userId || !chatId) {
                console.log('❌ Missing user info in snipeReady event');
                return;
            }
            // Get user's wallet
            const wallet = await wallet_1.walletManager.getWallet(userId);
            if (!wallet) {
                console.log(`❌ No wallet found for user ${userId}`);
                await this.bot.sendMessage(chatId, `❌ **Snipe Failed**\n\nNo wallet found. Generate one with /start first.`, { parse_mode: 'Markdown' });
                return;
            }
            // Notify user that snipe is executing
            await this.bot.sendMessage(chatId, `🚀 **EXECUTING SNIPE!**\n\n` +
                `🎓 Token graduated to PulseX!\n` +
                `📋 \`${tokenAddress.slice(0, 12)}...${tokenAddress.slice(-8)}\`\n\n` +
                `⏳ Buying now...`, { parse_mode: 'Markdown' });
            try {
                // Execute the buy
                const result = await pulsex_1.pulsex.executeBuy(wallet, tokenAddress, amountPls || BigInt(0), slippage || 15, // Higher default slippage for graduation snipes
                gasLimit || 500000);
                // Update order status
                const session = this.getSession(chatId);
                const order = session.snipeOrders.find(o => o.id === orderId);
                if (order) {
                    order.status = 'filled';
                    order.filledAt = Date.now();
                    order.txHash = result.txHash;
                }
                // Success message
                await this.bot.sendMessage(chatId, `✅ **SNIPE SUCCESSFUL!**\n\n` +
                    `🆔 Order: \`${orderId}\`\n` +
                    `📋 Token: \`${tokenAddress.slice(0, 12)}...${tokenAddress.slice(-8)}\`\n` +
                    `💰 Spent: ${ethers_1.ethers.formatEther(amountPls || BigInt(0))} PLS\n` +
                    `🔗 [View TX](https://scan.pulsechain.com/tx/${result.txHash})\n\n` +
                    `🎉 You're in early!`, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.mainMenuKeyboard,
                });
                // Trade is already logged via the order tracking system
                console.log(`📝 InstaBond snipe completed: ${orderId}, tx: ${result.txHash}`);
            }
            catch (error) {
                console.error(`❌ Snipe execution failed:`, error);
                // Update order status
                const session = this.getSession(chatId);
                const order = session.snipeOrders.find(o => o.id === orderId);
                if (order) {
                    order.status = 'cancelled';
                }
                await this.bot.sendMessage(chatId, `❌ **SNIPE FAILED**\n\n` +
                    `🆔 Order: \`${orderId}\`\n` +
                    `Error: ${error.message || 'Unknown error'}\n\n` +
                    `_The token may have graduated but the buy failed. Try buying manually!_`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
            }
        });
        // Handle snipe failures
        graduation_1.graduationSniper.on('snipeFailed', async (data) => {
            const { tokenAddress, userId, chatId, orderId, error } = data;
            if (chatId) {
                await this.bot.sendMessage(chatId, `❌ **Snipe Setup Failed**\n\n` +
                    `Order: \`${orderId}\`\n` +
                    `Token: \`${tokenAddress?.slice(0, 12)}...${tokenAddress?.slice(-8)}\`\n` +
                    `Error: ${error}`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
            }
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
        console.log('🚀 Starting @DTGBondBot...');
        // Connect snipers
        await graduation_1.graduationSniper.connect();
        await graduation_1.graduationSniper.startListening();
        await mempool_1.mempoolSniper.connect();
        await mempool_1.mempoolSniper.start();
        // Start order engine
        await limitOrder_1.limitOrderEngine.start();
        console.log('✅ @DTGBondBot is running!');
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // 📋 TRADE HISTORY HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Show trade history main menu
     */
    async showTradeHistory(chatId, userId) {
        const allHistory = jsonStore_1.TradeHistory.getUserHistory(userId, 50);
        const active = allHistory.filter(e => e.status === 'pending' || e.status === 'watching' || e.status === 'executing');
        const completed = allHistory.filter(e => e.status === 'completed');
        const failed = allHistory.filter(e => e.status === 'failed' || e.status === 'cancelled');
        let msg = `📋 **TRADE HISTORY**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `👁️ Active Orders: **${active.length}**\n`;
        msg += `✅ Completed: **${completed.length}**\n`;
        msg += `❌ Failed/Cancelled: **${failed.length}**\n\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `_All trades and orders are saved here for your records._`;
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.tradeHistoryKeyboard,
        });
    }
    /**
     * Show active (pending/watching) orders
     */
    async showActiveOrders(chatId, userId) {
        const active = jsonStore_1.TradeHistory.getActiveOrders(userId);
        if (active.length === 0) {
            await this.bot.sendMessage(chatId, `👁️ **ACTIVE ORDERS**\n\n_No active orders right now._`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            return;
        }
        let msg = `👁️ **ACTIVE ORDERS** (${active.length})\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        for (const entry of active.slice(0, 10)) {
            msg += jsonStore_1.TradeHistory.formatForTelegram(entry);
            msg += `\n\n`;
        }
        if (active.length > 10) {
            msg += `_...and ${active.length - 10} more_\n`;
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.tradeHistoryKeyboard,
        });
    }
    /**
     * Show completed trades
     */
    async showCompletedTrades(chatId, userId) {
        const completed = jsonStore_1.TradeHistory.getCompletedTrades(userId, 10);
        if (completed.length === 0) {
            await this.bot.sendMessage(chatId, `✅ **COMPLETED TRADES**\n\n_No completed trades yet. Start trading!_`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            return;
        }
        let msg = `✅ **COMPLETED TRADES**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        for (const entry of completed) {
            msg += jsonStore_1.TradeHistory.formatForTelegram(entry);
            msg += `\n\n`;
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.tradeHistoryKeyboard,
        });
    }
    /**
     * Show InstaBond snipe history
     */
    async showInstaBondHistory(chatId, userId) {
        const all = jsonStore_1.TradeHistory.getUserHistory(userId, 50);
        const instabond = all.filter(e => e.type === 'instabond_snipe');
        if (instabond.length === 0) {
            await this.bot.sendMessage(chatId, `🎓 **INSTABOND SNIPES**\n\n_No InstaBond snipes yet._\n\nUse the pump.tires menu to snipe graduating tokens!`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            return;
        }
        let msg = `🎓 **INSTABOND SNIPES** (${instabond.length})\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        for (const entry of instabond.slice(0, 10)) {
            msg += jsonStore_1.TradeHistory.formatForTelegram(entry);
            msg += `\n\n`;
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.tradeHistoryKeyboard,
        });
    }
    /**
     * Show limit order history
     */
    async showLimitOrderHistory(chatId, userId) {
        const all = jsonStore_1.TradeHistory.getUserHistory(userId, 50);
        const limits = all.filter(e => e.type === 'limit_buy' || e.type === 'limit_sell' ||
            e.type === 'stop_loss' || e.type === 'take_profit');
        if (limits.length === 0) {
            await this.bot.sendMessage(chatId, `📊 **LIMIT ORDERS**\n\n_No limit orders yet._\n\nSet up limit buys, sells, stop losses, and take profits!`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            return;
        }
        let msg = `📊 **LIMIT ORDERS** (${limits.length})\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        for (const entry of limits.slice(0, 10)) {
            msg += jsonStore_1.TradeHistory.formatForTelegram(entry);
            msg += `\n\n`;
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.tradeHistoryKeyboard,
        });
    }
    /**
     * Show PnL summary
     */
    async showPnLSummary(chatId, userId) {
        const completed = jsonStore_1.TradeHistory.getCompletedTrades(userId, 100);
        if (completed.length === 0) {
            await this.bot.sendMessage(chatId, `📈 **PNL SUMMARY**\n\n_No completed trades to calculate PnL._`, { parse_mode: 'Markdown', reply_markup: keyboards.tradeHistoryKeyboard });
            return;
        }
        let totalPnlPercent = 0;
        let wins = 0;
        let losses = 0;
        for (const entry of completed) {
            if (entry.pnlPercent !== undefined) {
                totalPnlPercent += entry.pnlPercent;
                if (entry.pnlPercent > 0)
                    wins++;
                else if (entry.pnlPercent < 0)
                    losses++;
            }
        }
        const avgPnl = totalPnlPercent / completed.length;
        const winRate = (wins / (wins + losses) * 100) || 0;
        let msg = `📈 **PNL SUMMARY**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `📊 Total Trades: **${completed.length}**\n`;
        msg += `✅ Wins: **${wins}**\n`;
        msg += `❌ Losses: **${losses}**\n`;
        msg += `🎯 Win Rate: **${winRate.toFixed(1)}%**\n\n`;
        msg += `📈 Avg PnL: **${avgPnl >= 0 ? '+' : ''}${avgPnl.toFixed(2)}%**\n\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `⚜️ _View detailed P&L in Gold Suite_`;
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⚜️ Open Gold Suite', url: 'https://dtgc.io/gold' }],
                    [{ text: '🔙 Back to History', callback_data: 'history_menu' }],
                ],
            },
        });
    }
    /**
     * Generate and send P&L card image
     * Uses Mando sniper image as background
     */
    async generatePnLCard(chatId, userId) {
        try {
            await this.bot.sendMessage(chatId, '⏳ Generating your P&L card...');
            const session = this.getSession(chatId);
            // Gather data from snipe orders
            const filledOrders = session.snipeOrders.filter(o => o.status === 'filled');
            const cancelledOrders = session.snipeOrders.filter(o => o.status === 'cancelled');
            // Also get from trade history
            const completedTrades = jsonStore_1.TradeHistory.getCompletedTrades(userId, 50);
            // Build trades array for the card
            const trades = [];
            let totalPnlPls = 0;
            let totalInvested = 0;
            let wins = 0;
            let losses = 0;
            let bestTrade = null;
            let worstTrade = null;
            // Add from completed trade history
            for (const entry of completedTrades) {
                const pnlPls = parseFloat(entry.pnlPls || '0');
                const amountPls = parseFloat(entry.amountPls || '0');
                const pnlPercent = entry.pnlPercent || 0;
                const isWin = pnlPercent > 0;
                trades.push({
                    symbol: entry.tokenSymbol || entry.tokenAddress.slice(0, 8),
                    amountPls,
                    pnlPls,
                    pnlPercent,
                    isWin,
                });
                totalPnlPls += pnlPls;
                totalInvested += amountPls;
                if (isWin)
                    wins++;
                else if (pnlPercent < 0)
                    losses++;
                if (!bestTrade || pnlPercent > bestTrade.pnlPercent) {
                    bestTrade = { symbol: entry.tokenSymbol || '???', pnlPercent };
                }
                if (!worstTrade || pnlPercent < worstTrade.pnlPercent) {
                    worstTrade = { symbol: entry.tokenSymbol || '???', pnlPercent };
                }
            }
            // Add from filled snipe orders if they have entry/exit info
            for (const order of filledOrders) {
                if (order.entryPrice && order.tokensReceived) {
                    const amountPls = order.amountPls;
                    // Estimate current value (would need price check for accuracy)
                    const pnlPercent = order.sellProfitPls
                        ? ((order.sellProfitPls - amountPls) / amountPls) * 100
                        : 0;
                    const pnlPls = order.sellProfitPls ? order.sellProfitPls - amountPls : 0;
                    const isWin = pnlPercent > 0;
                    if (pnlPercent !== 0) {
                        trades.push({
                            symbol: order.tokenSymbol || order.tokenAddress.slice(0, 8),
                            amountPls,
                            pnlPls,
                            pnlPercent,
                            isWin,
                        });
                        totalPnlPls += pnlPls;
                        totalInvested += amountPls;
                        if (isWin)
                            wins++;
                        else
                            losses++;
                        if (!bestTrade || pnlPercent > bestTrade.pnlPercent) {
                            bestTrade = { symbol: order.tokenSymbol || '???', pnlPercent };
                        }
                        if (!worstTrade || pnlPercent < worstTrade.pnlPercent) {
                            worstTrade = { symbol: order.tokenSymbol || '???', pnlPercent };
                        }
                    }
                }
            }
            // Calculate overall percentage
            const totalPnlPercent = totalInvested > 0 ? (totalPnlPls / totalInvested) * 100 : 0;
            // Build summary
            const summary = {
                totalTrades: wins + losses,
                wins,
                losses,
                totalPnlPls,
                totalPnlPercent,
                bestTrade,
                worstTrade,
            };
            // Get username if available
            let username;
            try {
                const chatInfo = await this.bot.getChat(chatId);
                username = chatInfo.username;
            }
            catch (e) {
                // Username not available
            }
            // Try to generate image, fall back to text
            if ((0, pnlCard_1.canGenerateImages)()) {
                try {
                    const imageBuffer = await (0, pnlCard_1.generatePnLCardImage)(summary, trades, username);
                    // Send as photo
                    await this.bot.sendPhoto(chatId, imageBuffer, {
                        caption: `⚜️ **Your P&L Card**\n\n` +
                            `📊 ${summary.totalTrades} trades | ` +
                            `${summary.wins} wins | ${summary.losses} losses\n` +
                            `💰 Total P&L: ${totalPnlPls >= 0 ? '+' : ''}${(0, pnlCard_1.formatNumber)(totalPnlPls)} PLS\n\n` +
                            `_Share this card to flex your gains!_\n` +
                            `🌐 dtgc.io/gold`,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Refresh Card', callback_data: 'generate_pnl_card' }],
                                [{ text: '📋 My Orders', callback_data: 'snipe_list' }],
                                [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                            ],
                        },
                    });
                    return;
                }
                catch (imgError) {
                    console.log('Image generation failed, falling back to text:', imgError);
                }
            }
            // Fall back to text-based P&L card
            const textCard = (0, pnlCard_1.generatePnLTextCard)(summary, trades, username);
            await this.bot.sendMessage(chatId, textCard, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh Card', callback_data: 'generate_pnl_card' }],
                        [{ text: '📋 My Orders', callback_data: 'snipe_list' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
        }
        catch (error) {
            console.error('Failed to generate P&L card:', error);
            await this.bot.sendMessage(chatId, `❌ Failed to generate P&L card: ${error.message}\n\n` +
                `Try again or view your P&L in Gold Suite.`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⚜️ Open Gold Suite', url: 'https://dtgc.io/gold' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
        }
    }
    /**
     * Stop the bot
     */
    async stop() {
        console.log('🛑 Stopping @DTGBondBot...');
        await graduation_1.graduationSniper.disconnect();
        await mempool_1.mempoolSniper.disconnect();
        limitOrder_1.limitOrderEngine.stop();
        this.bot.stopPolling();
    }
}
exports.DtraderBot = DtraderBot;
// Trigger deploy 1769910879
//# sourceMappingURL=index.js.map