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
const multiWallet_1 = require("../core/multiWallet");
const pulsex_1 = require("../core/pulsex");
const feeManager_1 = require("../core/feeManager");
const graduation_1 = require("../sniper/graduation");
const mempool_1 = require("../sniper/mempool");
const limitOrder_1 = require("../orders/limitOrder");
const antiRug_1 = require("../security/antiRug");
const jsonStore_1 = require("../db/jsonStore");
const dexscreener_1 = require("../integrations/dexscreener");
const keyboards = __importStar(require("./keyboards"));
// ═══════════════════════════════════════════════════════════════════════════════
// TIMEZONE HELPERS - US Eastern Time (Miami)
// ═══════════════════════════════════════════════════════════════════════════════
const TIMEZONE = 'America/New_York'; // EST/EDT
const formatTimestamp = (date = new Date()) => {
    return date.toLocaleString('en-US', {
        timeZone: TIMEZONE,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};
const formatTime = (date = new Date()) => {
    return date.toLocaleTimeString('en-US', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
};
const formatDateShort = (date = new Date()) => {
    return date.toLocaleDateString('en-US', {
        timeZone: TIMEZONE,
        month: 'short',
        day: 'numeric'
    });
};
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
        this.initializeBotMenu();
        console.log('✅ Bot handlers initialized');
    }
    /**
     * Initialize bot commands menu, description, and menu button
     * This makes the bot more user-friendly before /start is pressed
     */
    async initializeBotMenu() {
        try {
            // Set bot commands - creates the menu button (PulsonicBot style)
            await this.bot.setMyCommands([
                { command: 'start', description: 'Main Menu' },
                { command: 'wins', description: '🏆 Probable Wins - Top Opportunities' },
                { command: 'buy', description: 'Buy a token (DEX)' },
                { command: 'sell', description: 'Sell a token (DEX)' },
                { command: 'wallets', description: 'Manage your wallets' },
                { command: 'recover', description: '🔐 Recover wallets (address + last4)' },
                { command: 'positions', description: 'Manage your positions' },
                { command: 'pumptire', description: 'Go to pump.tires menu' },
                { command: 'pumpsnipe', description: 'Go to pump.tires sniper menu' },
                { command: 'pnl', description: 'Generate P&L card' },
                { command: 'settings', description: 'Bot settings' },
            ]);
            console.log('✅ Bot commands menu set');
            // Set bot description - shown BEFORE user presses START
            // This is what appears in the bot's profile/bio area
            const description = `⚜️ DTRADER SNIPER - PulseChain Trading Power

🎯 InstaBond Sniper - Auto-buy at pump.tires graduation
👛 6 Wallet Slots - Manage multiple trading wallets
💱 Quick Trade - Buy/Sell any PulseChain token
📈 Limit Orders - Set take profit & stop loss
📊 P&L Cards - Share your trading wins

💰 Hold $50+ DTGC for PRO access
🌐 Web: dtgc.io/gold`;
            await this.bot.setMyDescription({ description });
            console.log('✅ Bot description set');
            // Set short description (shown in search results & forwarded messages)
            await this.bot.setMyShortDescription({
                short_description: '⚜️ PulseChain Trading Bot | InstaBond Sniper | 6 Wallets | P&L Cards'
            });
            console.log('✅ Bot short description set');
        }
        catch (error) {
            console.log('⚠️ Could not set bot menu/description:', error);
        }
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
                console.log(`✅ Mini App verified wallet for user ${userId}: $${verifyData.balanceUsd}${verifyData.botWalletAddress ? ` + bot wallet` : ''}`);
                session.linkedWallet = verifyData.walletAddress;
                session.gateVerified = true;
                session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
                // Store bot wallet in session if provided
                if (verifyData.botWalletAddress) {
                    session.botWalletAddress = verifyData.botWalletAddress;
                    session.botKeyLast4 = verifyData.botKeyLast4;
                }
                // Persist to local storage with bot wallet info
                jsonStore_1.LinkedWallets.link(userId, chatId, verifyData.walletAddress, verifyData.balanceUsd, verifyData.botWalletAddress, verifyData.botKeyLast4);
                // If bot wallet was provided, link snipe wallets to gated wallet
                if (verifyData.botWalletAddress) {
                    multiWallet_1.multiWallet.linkWalletsToGatedWallet(userId, verifyData.walletAddress);
                }
                return true;
            }
        }
        catch (e) {
            console.log(`[checkGate] Mini App API check failed, continuing with fallbacks`);
        }
        // Priority 1: Restore linked wallet from persistent storage if not in session
        // CRITICAL: Try Vercel cloud backup if local storage is empty (Railway restart recovery)
        if (!session.linkedWallet) {
            let persistedLink = jsonStore_1.LinkedWallets.get(userId);
            // If local is empty, try Vercel cloud backup
            if (!persistedLink) {
                console.log(`🔍 Local verification missing for ${userId}, trying Vercel cloud backup...`);
                persistedLink = await jsonStore_1.LinkedWallets.recoverFromVercel(userId) || undefined;
            }
            if (persistedLink) {
                console.log(`🔗 Restored linked wallet for user ${userId}: ${persistedLink.walletAddress.slice(0, 10)}...`);
                session.linkedWallet = persistedLink.walletAddress;
                session.botWalletAddress = persistedLink.botWalletAddress;
                // Also recover multiwallets from Vercel if missing
                const existingWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
                if (existingWallets.length === 0 && persistedLink.walletAddress) {
                    console.log(`🔍 Recovering snipe wallets from Vercel cloud backup...`);
                    await multiWallet_1.multiWallet.recoverFromVercel(userId, persistedLink.walletAddress);
                }
                // REVERSE SYNC: Push local data back to Vercel API if it lost memory
                // This ensures Vercel always has the latest data even after cold starts
                try {
                    const pushResponse = await fetch('https://dtgc.io/api/tg-verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            walletAddress: persistedLink.walletAddress,
                            telegramUserId: userId,
                            dtgcBalance: persistedLink.balanceUsd / 0.0001, // Approximate balance
                            usdValue: persistedLink.balanceUsd,
                            botWalletAddress: persistedLink.botWalletAddress,
                            botKeyLast4: persistedLink.botKeyLast4,
                        }),
                    });
                    const pushResult = await pushResponse.json();
                    console.log(`🔄 Reverse sync to Vercel: ${pushResult.success ? 'SUCCESS' : 'FAILED'}`);
                }
                catch (syncErr) {
                    console.log(`[checkGate] Reverse sync failed:`, syncErr);
                }
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
            // Link any existing wallets to this gated wallet
            multiWallet_1.multiWallet.linkWalletsToGatedWallet(userId, walletAddress);
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
            // Check if user has existing wallets already linked in this session
            const existingWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            if (existingWallets.length > 0) {
                // User already has wallets in current session - show success with linked count
                await this.bot.sendMessage(chatId, `✅ **Wallet Verified!**\n\n` +
                    `🔗 **DTGC Gate Wallet:**\n\`${walletAddress}\`\n\n` +
                    `💰 **DTGC Balance:** ${formatNumber(payload.b)} (~$${payload.u})\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `👛 **${existingWallets.length} Snipe Wallets Linked!**\n\n` +
                    `🎉 Gold Suite Unlocked - Full access enabled!\n\n` +
                    `_Verification valid for 24 hours_`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
            }
            else {
                // ═══════════════════════════════════════════════════════════════════════════
                // CRITICAL POST-VERIFICATION WALLET SETUP FLOW
                // Two options: A) Link existing wallets  B) Generate fresh wallets
                // ═══════════════════════════════════════════════════════════════════════════
                await this.bot.sendMessage(chatId, `✅ **$50 DTGC Verified!**\n\n` +
                    `🔗 **DTGC Gate Wallet:**\n\`${walletAddress}\`\n\n` +
                    `💰 **Balance:** ${formatNumber(payload.b)} DTGC (~$${payload.u})\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `⚜️ **WALLET SETUP REQUIRED**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Choose how to set up your trading wallets:\n\n` +
                    `**🅰️ LINK EXISTING WALLETS**\n` +
                    `_Already have a bot wallet & snipe wallets?_\n` +
                    `Recover them and link to this gate wallet.\n\n` +
                    `**🅱️ GENERATE NEW WALLETS**\n` +
                    `_Fresh start?_\n` +
                    `Create new bot wallet + 6 snipe wallets.\n` +
                    `All permanently linked to your gate wallet.`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🅰️ LINK OLD WALLETS', callback_data: 'setup_link_existing' }],
                            [{ text: '🅱️ GENERATE NEW SETUP', callback_data: 'setup_generate_new' }],
                        ]
                    }
                });
            }
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
            // Handle sniper deep link from Gold Suite
            if (param === 'sniper') {
                // Check gate first
                const gateOk = await this.checkGate(chatId, userId);
                if (!gateOk) {
                    await this.bot.sendMessage(chatId, `🔒 **Token Gate Required**\n\n` +
                        `Hold $50+ worth of DTGC to access the sniper.\n\n` +
                        `_Tap below to verify your wallet._`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } }],
                                [{ text: '💰 Buy DTGC', url: 'https://dtgc.io/gold' }],
                            ],
                        },
                    });
                    return;
                }
                await this.bot.sendMessage(chatId, `🎯 **DTRADER Sniper** ⚜️\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Set up your InstaBond snipe with automatic take profit!\n\n` +
                    `🔥 **InstaBond** - Auto-buy at pump.tires graduation\n` +
                    `📈 **Take Profit** - Auto-sell at your target %\n` +
                    `💰 **Breakeven** - Recover your initial investment\n\n` +
                    `_Select an option below:_`, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.snipeMenuKeyboard,
                });
                return;
            }
            // Handle limit buy deep link from Gold Suite
            if (param === 'limit_buy') {
                const gateOk = await this.checkGate(chatId, userId);
                if (!gateOk) {
                    await this.bot.sendMessage(chatId, `🔒 **Token Gate Required**\n\nHold $50+ DTGC to access limit orders.`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } }],
                            ],
                        },
                    });
                    return;
                }
                const session = this.getSession(chatId);
                session.pendingAction = 'limit_buy_token';
                await this.bot.sendMessage(chatId, `📈 **LIMIT BUY ORDER**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Create a limit buy order that executes when price drops to your target.\n\n` +
                    `👛 **Multi-Wallet Support**: Use multiple wallets for coordinated buys!\n\n` +
                    `📝 **Enter token address:**`, { parse_mode: 'Markdown' });
                return;
            }
            // Handle limit sell deep link from Gold Suite
            if (param === 'limit_sell') {
                const gateOk = await this.checkGate(chatId, userId);
                if (!gateOk) {
                    await this.bot.sendMessage(chatId, `🔒 **Token Gate Required**\n\nHold $50+ DTGC to access limit orders.`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } }],
                            ],
                        },
                    });
                    return;
                }
                const session = this.getSession(chatId);
                session.pendingAction = 'limit_sell_token';
                await this.bot.sendMessage(chatId, `📉 **LIMIT SELL ORDER**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `Create a limit sell order that executes when price rises to your target.\n\n` +
                    `👛 **Multi-Wallet Support**: Sell from multiple wallets at once!\n\n` +
                    `📝 **Enter token address:**`, { parse_mode: 'Markdown' });
                return;
            }
            const { wallet, isNew } = await wallet_1.walletManager.getOrCreateWallet(userId);
            // Check if user has linked wallet from persistent storage
            // CRITICAL: Try Vercel recovery if local is empty (Railway restart)
            let persistedLink = jsonStore_1.LinkedWallets.get(userId);
            if (!persistedLink) {
                console.log(`🔍 [/start] Local verification missing for ${userId}, trying Vercel...`);
                persistedLink = await jsonStore_1.LinkedWallets.recoverFromVercel(userId) || undefined;
                // Also recover multiwallets if verification recovered
                if (persistedLink) {
                    const existingWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
                    if (existingWallets.length === 0) {
                        console.log(`🔍 [/start] Recovering snipe wallets from Vercel...`);
                        await multiWallet_1.multiWallet.recoverFromVercel(userId, persistedLink.walletAddress);
                    }
                }
            }
            const hasLinkedWallet = !!persistedLink;
            // For new users, show simple welcome first
            if (isNew || !hasLinkedWallet) {
                let welcomeMsg = `⚜️ **DTRADER SNIPER**\n`;
                welcomeMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                if (isNew) {
                    welcomeMsg += `✨ **Welcome!** Your bot wallet:\n`;
                    welcomeMsg += `\`${wallet.address}\`\n\n`;
                    welcomeMsg += `⚠️ **Fund this wallet with PLS to trade!**\n\n`;
                }
                if (!hasLinkedWallet) {
                    welcomeMsg += `🔗 **Link your DTGC wallet** to unlock all features\n`;
                    welcomeMsg += `⚜️ Hold $50+ DTGC for PRO access\n\n`;
                }
                welcomeMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
                welcomeMsg += `📱 **Select an option below:**`;
                await this.bot.sendMessage(chatId, welcomeMsg, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.mainMenuKeyboard,
                });
            }
            else {
                // For returning verified users, show comprehensive dashboard
                await this.showDashboard(chatId, userId);
            }
        });
        // ═══════════════════════════════════════════════════════════════════════════
        // QUICK MENU COMMANDS - Direct access without parameters
        // ═══════════════════════════════════════════════════════════════════════════
        // /help command - Feature overview
        this.bot.onText(/\/help/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const helpMsg = `⚜️ **DTRADER SNIPER** - Feature Guide\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🎯 **INSTABOND SNIPER**\n` +
                `Auto-buy tokens when they graduate from pump.tires bonding curve (200M PLS). ` +
                `Set take-profit % to auto-sell at your target!\n\n` +
                `👛 **6 WALLET SLOTS**\n` +
                `Generate up to 6 hot wallets for trading. Your main DTGC wallet stays safe - ` +
                `just fund these bot wallets with PLS to trade.\n\n` +
                `💱 **QUICK TRADE**\n` +
                `Buy or sell any PulseChain token via PulseX. ` +
                `Use /buy <token> or /sell <token> for quick access.\n\n` +
                `📈 **LIMIT ORDERS**\n` +
                `Set buy orders at target prices, take-profit levels, or stop-loss protection.\n\n` +
                `📊 **P&L CARDS**\n` +
                `Generate shareable cards showing your trading performance. Perfect for flexing wins!\n\n` +
                `🔗 **WALLET LINKING**\n` +
                `Link your DTGC-holding wallet (MetaMask/Rabby) via dtgc.io to unlock features. ` +
                `Hold $50+ DTGC for PRO access.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `💡 **HOW TO START:**\n` +
                `1. Generate a bot wallet (/wallet)\n` +
                `2. Fund it with PLS from your main wallet\n` +
                `3. Start trading!\n\n` +
                `🌐 **Web Interface:** dtgc.io/gold`;
            await this.bot.sendMessage(chatId, helpMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🚀 Main Menu', callback_data: 'main_menu' }],
                        [{ text: '🌐 Open Website', url: 'https://dtgc.io/gold' }],
                    ],
                },
            });
        });
        // /wallet command - Quick wallet access
        this.bot.onText(/\/wallet/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const { wallet, isNew } = await wallet_1.walletManager.getOrCreateWallet(userId);
            let walletMsg = `👛 **Your Bot Wallet**\n`;
            walletMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            if (isNew) {
                walletMsg += `✨ **New wallet created!**\n\n`;
            }
            walletMsg += `📋 **Address (tap to copy):**\n`;
            walletMsg += `\`${wallet.address}\`\n\n`;
            walletMsg += `💡 **To fund:** Send PLS from your main wallet to this address\n\n`;
            walletMsg += `_Your DTGC-holding wallet stays safe!_`;
            await this.bot.sendMessage(chatId, walletMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '💰 Check Balance', callback_data: 'wallet_balance' }],
                        [{ text: '🔑 Export Key', callback_data: 'wallet_export' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
        });
        // /snipe command (no params) - Open sniper menu
        this.bot.onText(/^\/snipe$/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId)) {
                await this.bot.sendMessage(chatId, `🔒 **Token Gate Required**\n\nHold $50+ DTGC to access the sniper.\n`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } }],
                            [{ text: '💰 Buy DTGC', url: 'https://dtgc.io/gold' }],
                        ],
                    },
                });
                return;
            }
            await this.bot.sendMessage(chatId, `🎯 **DTRADER Sniper** ⚜️\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🔥 **InstaBond** - Auto-buy at pump.tires graduation\n` +
                `📈 **Take Profit** - Auto-sell at your target %\n\n` +
                `_Paste a token address or select an option:_`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.snipeMenuKeyboard,
            });
        });
        // /trade command - Quick trade menu
        this.bot.onText(/\/trade/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId)) {
                await this.bot.sendMessage(chatId, `🔒 **Token Gate Required**\n\nHold $50+ DTGC to trade.\n`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } }],
                        ],
                    },
                });
                return;
            }
            await this.bot.sendMessage(chatId, `💱 **Quick Trade**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Paste any PulseChain token address to trade,\nor use these quick commands:\n\n` +
                `• \`/buy <token>\` - Buy token\n` +
                `• \`/sell <token>\` - Sell token\n`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.tradeMenuKeyboard,
            });
        });
        // /orders command - Show active orders
        this.bot.onText(/\/orders/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const activeOrders = jsonStore_1.TradeHistory.getActiveOrders(userId);
            if (activeOrders.length === 0) {
                await this.bot.sendMessage(chatId, `📋 **No Active Orders**\n\nYou don't have any pending limit orders or snipes.\n`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🎯 Set Up Snipe', callback_data: 'snipe_menu' }],
                            [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                        ],
                    },
                });
                return;
            }
            let ordersMsg = `📋 **Active Orders** (${activeOrders.length})\n`;
            ordersMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            for (const order of activeOrders.slice(0, 5)) {
                ordersMsg += jsonStore_1.TradeHistory.formatForTelegram(order) + '\n\n';
            }
            if (activeOrders.length > 5) {
                ordersMsg += `_...and ${activeOrders.length - 5} more orders_`;
            }
            await this.bot.sendMessage(chatId, ordersMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🗑 Cancel All', callback_data: 'cancel_all_orders' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
        });
        // /orderstatus command - Live status of limit orders with USD pricing
        this.bot.onText(/\/orderstatus/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            const orders = limitOrder_1.limitOrderEngine.getUserOrders(userId);
            const activeOrders = orders.filter(o => o.status === 'active');
            if (activeOrders.length === 0) {
                await this.bot.sendMessage(chatId, `📊 **No Active Limit Orders**\n\n` +
                    `You don't have any pending limit orders.\n\n` +
                    `Use 📊 Orders menu to create one!`, {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.ordersMenuKeyboard,
                });
                return;
            }
            await this.bot.sendMessage(chatId, `🔍 Fetching live prices for ${activeOrders.length} orders...`);
            let statusMsg = `📊 **LIVE ORDER STATUS**\n`;
            statusMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            statusMsg += `🟢 Engine: **RUNNING** (checks every 5s)\n\n`;
            for (const order of activeOrders) {
                const targetPrice = parseFloat(ethers_1.ethers.formatEther(BigInt(order.targetPrice)));
                const amount = parseFloat(ethers_1.ethers.formatEther(BigInt(order.amount)));
                const createdAgo = Math.floor((Date.now() - order.createdAt) / 60000);
                // Fetch current price with USD
                let currentPrice = 0;
                let currentUsd = 0;
                let targetUsd = 0;
                let tokenSymbol = 'TOKEN';
                try {
                    const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(order.tokenAddress);
                    if (tokenInfo) {
                        currentPrice = tokenInfo.pricePls || 0;
                        currentUsd = tokenInfo.priceUsd || 0;
                        tokenSymbol = tokenInfo.symbol || 'TOKEN';
                        // Calculate target USD (ratio-based)
                        if (currentPrice > 0) {
                            targetUsd = (targetPrice / currentPrice) * currentUsd;
                        }
                    }
                }
                catch { }
                const priceChange = currentPrice > 0 ? ((currentPrice / targetPrice - 1) * 100).toFixed(2) : '?';
                const orderEmoji = order.orderType === 'limit_buy' ? '🟢' : order.orderType === 'limit_sell' ? '🔴' : '🔶';
                statusMsg += `${orderEmoji} **${order.orderType.toUpperCase().replace('_', ' ')}**\n`;
                statusMsg += `🪙 ${tokenSymbol}: \`${order.tokenAddress.slice(0, 10)}...${order.tokenAddress.slice(-6)}\`\n`;
                statusMsg += `👛 \`${order.walletAddress.slice(0, 8)}...${order.walletAddress.slice(-4)}\`\n`;
                statusMsg += `━━━━━━━━━━━━━━━\n`;
                statusMsg += `📈 **Current:** ${currentPrice.toFixed(12)} PLS\n`;
                statusMsg += `   ≈ $${currentUsd.toFixed(10)}\n`;
                statusMsg += `🎯 **Target:** ${targetPrice.toFixed(12)} PLS\n`;
                statusMsg += `   ≈ $${targetUsd.toFixed(10)}\n`;
                statusMsg += `📊 **Gap:** ${priceChange}% away\n`;
                statusMsg += `💰 **Amount:** ${amount >= 1000000 ? (amount / 1000000).toFixed(2) + 'M' : amount.toLocaleString()} PLS\n`;
                statusMsg += `⏱️ **Created:** ${createdAgo} min ago\n`;
                statusMsg += `🆔 \`${order.id.slice(0, 20)}...\`\n\n`;
            }
            statusMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            statusMsg += `💡 _Orders execute automatically when price hits target_`;
            await this.bot.sendMessage(chatId, statusMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh Status', callback_data: 'refresh_order_status' }],
                        [{ text: '❌ Cancel All Orders', callback_data: 'order_cancel_all' }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
        });
        // /pnl command (no params) - Generate P&L card
        this.bot.onText(/^\/pnl$/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            await this.bot.sendMessage(chatId, `📊 **P&L Card Generator**\n\nGenerating your trading performance card...`);
            await this.generatePnLCard(chatId, userId);
        });
        // /settings command - Bot settings
        this.bot.onText(/\/settings/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const session = this.getSession(chatId);
            const settingsMsg = `⚙️ **Bot Settings**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📊 **Slippage:** ${session.settings.slippage}%\n` +
                `⛽ **Gas Priority:** ${GAS_LABELS[session.settings.gasPriority]}\n` +
                `🛡 **Anti-Rug:** ${session.settings.antiRug ? '✅ ON' : '❌ OFF'}\n` +
                `🔔 **Alerts:** ${session.settings.alerts ? '✅ ON' : '❌ OFF'}\n`;
            await this.bot.sendMessage(chatId, settingsMsg, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.settingsKeyboard,
            });
        });
        // ═══════════════════════════════════════════════════════════════════════
        // 🎯 PULSONIC-STYLE COMMANDS - Quick access from command menu
        // ═══════════════════════════════════════════════════════════════════════
        // /positions - Manage your positions (tracked tokens)
        this.bot.onText(/\/positions/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            await this.showPositionsMenu(chatId, userId);
        });
        // /wallets - Manage your wallets (alias for /wallet)
        this.bot.onText(/\/wallets/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            const session = this.getSession(chatId);
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const walletList = wallets.length > 0
                ? wallets.map((w, i) => `${w.isActive ? '✅' : '⬜'} **#${i + 1}** ${w.label || `Wallet ${i + 1}`}\n   \`${w.address.slice(0, 10)}...${w.address.slice(-8)}\``).join('\n')
                : '_No wallets generated yet_';
            await this.bot.sendMessage(chatId, `⚜️ **MANDO WALLETS**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `${walletList}\n\n` +
                `_Generate up to 6 snipe wallets for multi-wallet trading_`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
        });
        // /pumptire - Go to pump.tires menu
        this.bot.onText(/\/pumptire/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            await this.bot.sendMessage(chatId, `🎓 **PUMP.TIRES - InstaBond**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚜️ _This is the way to catch graduations._\n\n` +
                `🔥 **Top Near Graduation** - Tokens close to bonding\n` +
                `🎓 **Recently Bonded** - Just graduated tokens\n` +
                `🤖 **Auto-Snipe** - Auto-buy all graduations\n` +
                `🎯 **Snipe Specific** - Target a token CA`, { parse_mode: 'Markdown', reply_markup: keyboards.pumpMenuKeyboard });
        });
        // /pumpsnipe - Go to pump.tires sniper settings
        this.bot.onText(/\/pumpsnipe/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            await this.showPumpSniperSettings(chatId, userId);
        });
        // /checkgrad <token> - Check graduation progress of a pump.tires token
        this.bot.onText(/\/checkgrad\s*(.*)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            let tokenAddress = match?.[1]?.trim();
            if (!await this.checkGate(chatId, userId))
                return;
            // If no token provided, check user's pending orders
            if (!tokenAddress) {
                const pendingOrders = jsonStore_1.SnipeOrders.getPending(userId);
                if (pendingOrders.length === 0) {
                    await this.bot.sendMessage(chatId, `📊 **Check Graduation Progress**\n\n` +
                        `Usage: \`/checkgrad <token_address>\`\n\n` +
                        `You have no pending InstaBond orders.\n` +
                        `Use /snipe to create one!`, { parse_mode: 'Markdown' });
                    return;
                }
                // Show all pending orders with check buttons
                let msg = `📊 **Your Pending InstaBonds**\n`;
                msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                const buttons = [];
                for (const order of pendingOrders.slice(0, 5)) {
                    msg += `🎯 **${order.id}**\n`;
                    msg += `📋 \`${order.tokenAddress.slice(0, 12)}...${order.tokenAddress.slice(-6)}\`\n`;
                    msg += `💰 ${order.amountPls} PLS → TP: +${order.takeProfitPercent || 0}%\n\n`;
                    buttons.push([
                        { text: `📊 Check ${order.id}`, callback_data: `checkgrad_${order.tokenAddress}` }
                    ]);
                }
                msg += `\n_Click to check graduation progress:_`;
                await this.bot.sendMessage(chatId, msg, {
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: buttons },
                });
                return;
            }
            // Clean token address
            if (tokenAddress.startsWith('0x') && tokenAddress.length >= 40) {
                tokenAddress = tokenAddress.slice(0, 42);
            }
            else {
                await this.bot.sendMessage(chatId, `❌ Invalid token address. Use format: \`0x...\``, { parse_mode: 'Markdown' });
                return;
            }
            await this.checkGraduationProgress(chatId, tokenAddress);
        });
        // /regroup - Moves tracked tokens to recent messages
        this.bot.onText(/\/regroup/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            await this.bot.sendMessage(chatId, `🔄 **Regrouping Positions...**\n\n` +
                `_Moving all your tracked tokens to recent messages._`, { parse_mode: 'Markdown' });
            // Re-send all positions
            await this.showPositionsMenu(chatId, userId);
        });
        // /sellmenu <token> - Quick sell menu for a token
        this.bot.onText(/\/sellmenu\s*(.*)/, async (msg, match) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            const tokenAddress = match?.[1]?.trim();
            if (!await this.checkGate(chatId, userId))
                return;
            if (!tokenAddress) {
                const session = this.getSession(chatId);
                await this.bot.sendMessage(chatId, `💰 **Quick Sell Menu**\n\n` +
                    `Usage: \`/sellmenu <token_address>\`\n\n` +
                    `Or paste a token address to see the sell menu.`, { parse_mode: 'Markdown' });
                session.pendingAction = 'sellmenu_token';
                return;
            }
            await this.showQuickSellMenu(chatId, userId, tokenAddress);
        });
        // /buy - Buy a token (DEX)
        this.bot.onText(/^\/buy$/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            const session = this.getSession(chatId);
            session.pendingAction = 'buy_token_address';
            await this.bot.sendMessage(chatId, `💰 **Buy Token (DEX)**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📋 Send the token contract address:\n\n` +
                `_After entering the address, you can choose:_\n` +
                `• Instant buy at market price\n` +
                `• Limit buy at your target price`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'main_menu' }]]
                }
            });
        });
        // /sell - Sell a token (DEX)
        this.bot.onText(/^\/sell$/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            const session = this.getSession(chatId);
            session.pendingAction = 'sell_token_address';
            await this.bot.sendMessage(chatId, `💸 **Sell Token (DEX)**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📋 Send the token contract address:\n\n` +
                `_After entering the address, you can choose:_\n` +
                `• Instant sell at market price\n` +
                `• Limit sell at your target price`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'main_menu' }]]
                }
            });
        });
        // /wins - Probable Wins (AI-scored top opportunities)
        this.bot.onText(/\/wins/, async (msg) => {
            const chatId = msg.chat.id.toString();
            const userId = msg.from?.id.toString() || '';
            if (!await this.checkGate(chatId, userId))
                return;
            await this.showProbableWins(chatId, userId);
        });
        // /recover - Recover wallets using gated wallet address + last 4 of private key
        this.bot.onText(/\/recover/, async (msg) => {
            const chatId = msg.chat.id.toString();
            await this.bot.sendMessage(chatId, `🔐 **WALLET RECOVERY**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Choose your recovery method:`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🤖 Bot Gated Wallet + Last 4', callback_data: 'recover_bot_wallet' }],
                        [{ text: '⚜️ DTGC Gold Verified Wallet + Last 4', callback_data: 'recover_gold_wallet' }],
                        [{ text: '❌ Cancel', callback_data: 'main_menu' }],
                    ]
                }
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
            case 'wins_menu':
                if (!await this.checkGate(chatId, userId))
                    return;
                await this.showProbableWins(chatId, userId);
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
        // Export ALL wallet keys for backup
        if (data === 'wallet_export_all') {
            const botWallet = await wallet_1.walletManager.getWallet(userId);
            const snipeWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            let msg = `🔐 **WALLET BACKUP - SAVE SECURELY**\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `⚠️ **NEVER SHARE THESE KEYS!**\n\n`;
            if (botWallet) {
                const botPk = await wallet_1.walletManager.exportPrivateKey(userId);
                msg += `**🤖 Bot Wallet:**\n`;
                msg += `Address: \`${botWallet.address}\`\n`;
                msg += `Key: \`${botPk}\`\n\n`;
            }
            if (snipeWallets.length > 0) {
                msg += `**🎯 DTrader Wallets (${snipeWallets.length}):**\n\n`;
                for (const w of snipeWallets) {
                    const pk = multiWallet_1.multiWallet.exportPrivateKey(userId, w.index);
                    msg += `#${w.index} ${w.label || 'DTrader ' + w.index}:\n`;
                    msg += `Addr: \`${w.address}\`\n`;
                    msg += `Key: \`${pk || 'N/A'}\`\n\n`;
                }
            }
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💾 **Save these in a secure location**\n`;
            msg += `🗑️ _Delete this message after saving!_`;
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🗑️ Delete This Message', callback_data: 'delete_message' }],
                        [{ text: '🔙 Back to Dashboard', callback_data: 'main_menu' }],
                    ],
                },
            });
            return;
        }
        // Backup info - show what's being stored
        if (data === 'backup_info') {
            const linkedWallet = jsonStore_1.LinkedWallets.get(userId);
            const snipeWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const activeOrders = limitOrder_1.limitOrderEngine.getUserOrders(userId).filter(o => o.status === 'pending');
            const pendingSnipes = session.snipeOrders.filter(o => o.status === 'pending');
            let msg = `💾 **YOUR DATA BACKUP STATUS**\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `**🔒 What's Saved:**\n`;
            msg += `• ✅ Bot wallet (encrypted)\n`;
            msg += `• ✅ ${snipeWallets.length} DTrader wallets\n`;
            msg += `• ✅ ${activeOrders.length} active limit orders\n`;
            msg += `• ✅ ${pendingSnipes.length} pending snipes\n`;
            if (linkedWallet)
                msg += `• ✅ Gold wallet link\n`;
            msg += `\n`;
            msg += `**🌐 Sync Status:**\n`;
            msg += `• 💾 Local: Saved to disk\n`;
            msg += `• ☁️ Vercel: Backed up online\n`;
            msg += `• 🔄 Last sync: ${formatTimestamp()}\n\n`;
            msg += `**🛡️ Security:**\n`;
            msg += `• Keys encrypted at rest\n`;
            msg += `• Data survives bot restarts\n`;
            msg += `• Settings persist forever\n\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `⚜️ _Your setup is safe with DTRADER_`;
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔑 Export All Keys', callback_data: 'wallet_export_all' }],
                        [{ text: '🔙 Back to Dashboard', callback_data: 'main_menu' }],
                    ],
                },
            });
            return;
        }
        // Delete message (for sensitive info)
        if (data === 'delete_message') {
            try {
                await this.bot.deleteMessage(parseInt(chatId), messageId);
            }
            catch (e) {
                console.log('Could not delete message:', e);
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
        // Wallets menu - show wallet info with import options
        if (data === 'wallets_menu') {
            // First try to sync from Vercel API if no local gate wallet
            let gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            let botWallet = jsonStore_1.LinkedWallets.get(userId)?.botWalletAddress || session.botWalletAddress;
            // If no local data, fetch from Vercel API
            if (!gatedWallet) {
                try {
                    const verifyResponse = await fetch(`https://dtgc.io/api/tg-verify?telegramUserId=${userId}`);
                    const verifyData = await verifyResponse.json();
                    if (verifyData.verified && verifyData.walletAddress) {
                        gatedWallet = verifyData.walletAddress;
                        session.linkedWallet = gatedWallet;
                        session.gateVerified = true;
                        if (verifyData.botWalletAddress) {
                            botWallet = verifyData.botWalletAddress;
                            session.botWalletAddress = botWallet;
                        }
                        // Persist locally so we don't need to fetch again
                        jsonStore_1.LinkedWallets.link(userId, chatId, gatedWallet, verifyData.balanceUsd || 0, verifyData.botWalletAddress, verifyData.botKeyLast4);
                        // Also link any existing wallets to this gated wallet
                        multiWallet_1.multiWallet.linkWalletsToGatedWallet(userId, gatedWallet);
                        console.log(`🔗 Synced wallet from API: ${gatedWallet.slice(0, 10)}...${botWallet ? ` + bot ${botWallet.slice(0, 10)}...` : ''}`);
                    }
                }
                catch (e) {
                    console.log(`[wallets_menu] API sync failed`);
                }
            }
            const snipeWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            let msg = `👛 **Wallet Management**\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            if (gatedWallet) {
                msg += `🔗 **Gate Wallet:** \`${gatedWallet.slice(0, 10)}...${gatedWallet.slice(-6)}\`\n`;
            }
            else {
                msg += `⚠️ **No Gate Wallet Linked**\n`;
                msg += `Verify your $50 DTGC wallet first!\n`;
            }
            if (botWallet) {
                msg += `🤖 **Bot Wallet:** \`${botWallet.slice(0, 10)}...${botWallet.slice(-6)}\`\n`;
            }
            msg += `\n`;
            if (snipeWallets.length > 0) {
                msg += `👛 **${snipeWallets.length} Snipe Wallets:**\n`;
                for (const w of snipeWallets) {
                    const status = w.isActive ? '✅' : '⬜';
                    msg += `${status} #${w.index + 1} ${w.label}: \`${w.address.slice(0, 8)}...${w.address.slice(-4)}\`\n`;
                }
                msg += `\n`;
            }
            else {
                msg += `📥 **No Snipe Wallets Yet**\n`;
                msg += `Import your existing wallets or generate new ones!\n\n`;
            }
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `💡 **Tap "Import All 6" to paste all your private keys at once with labels!**`;
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📥 IMPORT ALL 6 WALLETS', callback_data: 'bulk_import_wallets' }],
                        [{ text: '🔐 Recover Wallets', callback_data: 'post_verify_recover' },
                            { text: '🆕 Generate 6', callback_data: 'wallets_generate_6' }],
                        [{ text: '💰 Balances', callback_data: 'wallets_balance' },
                            { text: '📋 Addresses', callback_data: 'wallets_addresses' }],
                        [{ text: '✅ Toggle Active', callback_data: 'wallets_toggle' },
                            { text: '🏷️ Labels', callback_data: 'wallets_labels' }],
                        [{ text: '🔑 Export Keys', callback_data: 'wallets_export' }],
                        [{ text: '🔙 Main Menu', callback_data: 'main_menu' }],
                    ]
                }
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
        // Check graduation progress callback
        if (data.startsWith('checkgrad_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const tokenAddress = data.replace('checkgrad_', '');
            await this.checkGraduationProgress(chatId, tokenAddress);
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
        // Positions menu actions
        if (data === 'positions_menu') {
            await this.showPositionsMenu(chatId, userId);
            return;
        }
        if (data === 'positions_refresh') {
            await this.bot.sendMessage(chatId, '🔄 Refreshing positions...');
            await this.showPositionsMenu(chatId, userId);
            return;
        }
        if (data === 'positions_sort_pnl') {
            await this.bot.sendMessage(chatId, '📊 Sorting by P&L...');
            await this.showPositionsMenu(chatId, userId);
            return;
        }
        if (data === 'positions_sort_value') {
            await this.bot.sendMessage(chatId, '📈 Sorting by value...');
            await this.showPositionsMenu(chatId, userId);
            return;
        }
        if (data === 'positions_regroup') {
            await this.bot.sendMessage(chatId, '🗂️ Regrouping messages...');
            await this.showPositionsMenu(chatId, userId);
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
                `Copy whale wallets automatically.`, { parse_mode: 'Markdown', reply_markup: keyboards.copyMenuKeyboard });
            return;
        }
        // Copy Trade sub-menus (coming soon placeholders)
        if (data === 'copy_add' || data === 'copy_list' || data === 'copy_settings' || data === 'copy_history') {
            await this.bot.sendMessage(chatId, `🐋 **Copy Trade**\n\n` +
                `_This feature is coming soon!_\n\n` +
                `Stay tuned for whale wallet copying!`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // ℹ️ HELP MENU - Feature explanations
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'help_menu') {
            await this.bot.sendMessage(chatId, `ℹ️ **DTRADER SNIPER - Help Center**\n\n` +
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
        // Wallet management - Toggle active wallets
        if (data === 'wallets_toggle') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            if (wallets.length === 0) {
                await this.bot.sendMessage(chatId, `❌ No wallets yet. Generate them first!`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
                return;
            }
            const activeCount = wallets.filter(w => w.isActive).length;
            const buttons = [];
            // Quick toggle buttons at top
            buttons.push([
                { text: '✅ ALL ON', callback_data: 'toggle_all_on' },
                { text: '⬜ ALL OFF', callback_data: 'toggle_all_off' }
            ]);
            // Group toggles if 4+ wallets
            if (wallets.length >= 4) {
                buttons.push([
                    { text: '🔄 Toggle 1-3', callback_data: 'toggle_group_1' },
                    { text: '🔄 Toggle 4-6', callback_data: 'toggle_group_2' }
                ]);
            }
            buttons.push([{ text: '━━━━━━━━━━━━━━', callback_data: 'noop' }]);
            // Individual wallet toggles
            for (const w of wallets) {
                const icon = w.isActive ? '✅' : '⬜';
                buttons.push([{
                        text: `${icon} ${w.label} (${w.address.slice(0, 8)}...)`,
                        callback_data: `toggle_wallet_${w.index}`
                    }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**${activeCount}/${wallets.length}** wallets active\n\n` +
                `✅ = Active (used for trades)\n` +
                `⬜ = Inactive (skipped)\n`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // Bulk toggle - All ON
        if (data === 'toggle_all_on') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            for (const w of wallets) {
                if (!w.isActive)
                    multiWallet_1.multiWallet.toggleWalletActive(userId, w.index);
            }
            await this.bot.sendMessage(chatId, `✅ **All ${wallets.length} wallets activated!**`, { parse_mode: 'Markdown' });
            // Refresh toggle menu
            const buttons = [
                [{ text: '✅ ALL ON', callback_data: 'toggle_all_on' }, { text: '⬜ ALL OFF', callback_data: 'toggle_all_off' }]
            ];
            if (wallets.length >= 4) {
                buttons.push([{ text: '🔄 Toggle 1-3', callback_data: 'toggle_group_1' }, { text: '🔄 Toggle 4-6', callback_data: 'toggle_group_2' }]);
            }
            buttons.push([{ text: '━━━━━━━━━━━━━━', callback_data: 'noop' }]);
            const refreshedWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            for (const w of refreshedWallets) {
                buttons.push([{ text: `✅ ${w.label} (${w.address.slice(0, 8)}...)`, callback_data: `toggle_wallet_${w.index}` }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n\n**${wallets.length}/${wallets.length}** active`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // Bulk toggle - All OFF
        if (data === 'toggle_all_off') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            for (const w of wallets) {
                if (w.isActive)
                    multiWallet_1.multiWallet.toggleWalletActive(userId, w.index);
            }
            await this.bot.sendMessage(chatId, `⬜ **All ${wallets.length} wallets deactivated!**`, { parse_mode: 'Markdown' });
            // Refresh toggle menu
            const buttons = [
                [{ text: '✅ ALL ON', callback_data: 'toggle_all_on' }, { text: '⬜ ALL OFF', callback_data: 'toggle_all_off' }]
            ];
            if (wallets.length >= 4) {
                buttons.push([{ text: '🔄 Toggle 1-3', callback_data: 'toggle_group_1' }, { text: '🔄 Toggle 4-6', callback_data: 'toggle_group_2' }]);
            }
            buttons.push([{ text: '━━━━━━━━━━━━━━', callback_data: 'noop' }]);
            const refreshedWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            for (const w of refreshedWallets) {
                buttons.push([{ text: `⬜ ${w.label} (${w.address.slice(0, 8)}...)`, callback_data: `toggle_wallet_${w.index}` }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n\n**0/${wallets.length}** active`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // Group toggle - wallets 1-3
        if (data === 'toggle_group_1') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const group = wallets.filter(w => w.index <= 2); // 0, 1, 2
            for (const w of group) {
                multiWallet_1.multiWallet.toggleWalletActive(userId, w.index);
            }
            await this.bot.sendMessage(chatId, `🔄 Toggled wallets 1-3`, { parse_mode: 'Markdown' });
            // Refresh - reuse toggle menu logic
            const refreshedWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const activeCount = refreshedWallets.filter(w => w.isActive).length;
            const buttons = [
                [{ text: '✅ ALL ON', callback_data: 'toggle_all_on' }, { text: '⬜ ALL OFF', callback_data: 'toggle_all_off' }],
                [{ text: '🔄 Toggle 1-3', callback_data: 'toggle_group_1' }, { text: '🔄 Toggle 4-6', callback_data: 'toggle_group_2' }],
                [{ text: '━━━━━━━━━━━━━━', callback_data: 'noop' }]
            ];
            for (const w of refreshedWallets) {
                const icon = w.isActive ? '✅' : '⬜';
                buttons.push([{ text: `${icon} ${w.label} (${w.address.slice(0, 8)}...)`, callback_data: `toggle_wallet_${w.index}` }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n\n**${activeCount}/${refreshedWallets.length}** active`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // Group toggle - wallets 4-6
        if (data === 'toggle_group_2') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const group = wallets.filter(w => w.index >= 3); // 3, 4, 5
            for (const w of group) {
                multiWallet_1.multiWallet.toggleWalletActive(userId, w.index);
            }
            await this.bot.sendMessage(chatId, `🔄 Toggled wallets 4-6`, { parse_mode: 'Markdown' });
            // Refresh
            const refreshedWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const activeCount = refreshedWallets.filter(w => w.isActive).length;
            const buttons = [
                [{ text: '✅ ALL ON', callback_data: 'toggle_all_on' }, { text: '⬜ ALL OFF', callback_data: 'toggle_all_off' }],
                [{ text: '🔄 Toggle 1-3', callback_data: 'toggle_group_1' }, { text: '🔄 Toggle 4-6', callback_data: 'toggle_group_2' }],
                [{ text: '━━━━━━━━━━━━━━', callback_data: 'noop' }]
            ];
            for (const w of refreshedWallets) {
                const icon = w.isActive ? '✅' : '⬜';
                buttons.push([{ text: `${icon} ${w.label} (${w.address.slice(0, 8)}...)`, callback_data: `toggle_wallet_${w.index}` }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n\n**${activeCount}/${refreshedWallets.length}** active`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // No-op for separator
        if (data === 'noop') {
            return;
        }
        // Handle wallet toggle
        if (data.startsWith('toggle_wallet_')) {
            const index = parseInt(data.replace('toggle_wallet_', ''));
            multiWallet_1.multiWallet.toggleWalletActive(userId, index);
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const toggled = wallets.find(w => w.index === index);
            await this.bot.sendMessage(chatId, `${toggled?.isActive ? '✅' : '⬜'} **${toggled?.label}** is now ${toggled?.isActive ? 'ACTIVE' : 'INACTIVE'}`, { parse_mode: 'Markdown' });
            // Refresh the toggle menu
            const buttons = [];
            for (const w of wallets) {
                const icon = w.isActive ? '✅' : '⬜';
                buttons.push([{
                        text: `${icon} ${w.label} (${w.address.slice(0, 8)}...)`,
                        callback_data: `toggle_wallet_${w.index}`
                    }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `✅ **Toggle Active Wallets**\n\nTap to toggle:`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // Wallet labels menu
        if (data === 'wallets_labels') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            if (wallets.length === 0) {
                await this.bot.sendMessage(chatId, `❌ No wallets yet. Generate them first!`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
                return;
            }
            const buttons = [];
            for (const w of wallets) {
                buttons.push([{
                        text: `🏷️ ${w.label} → Rename`,
                        callback_data: `rename_wallet_${w.index}`
                    }]);
            }
            buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
            await this.bot.sendMessage(chatId, `🏷️ **Set Wallet Labels**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Tap a wallet to rename it:\n`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: buttons } });
            return;
        }
        // Handle wallet rename
        if (data.startsWith('rename_wallet_')) {
            const index = parseInt(data.replace('rename_wallet_', ''));
            session.pendingAction = `rename_wallet_${index}`;
            await this.bot.sendMessage(chatId, `🏷️ **Rename Wallet #${index}**\n\n` +
                `Enter a new label (e.g., "Snipe Main", "DCA Wallet", "Moon Bag"):`, { parse_mode: 'Markdown' });
            return;
        }
        if (data === 'wallets_import') {
            session.pendingAction = 'import_wallet_key';
            await this.bot.sendMessage(chatId, `📥 **Import Wallet**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Enter your private key followed by a label:\n\n` +
                `**Format:** \`<private_key> <label>\`\n\n` +
                `**Example:**\n` +
                `\`0x1234...abcd My Sniper\`\n\n` +
                `_Label is optional - just paste key for default name._`, { parse_mode: 'Markdown' });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // WALLET RECOVERY OPTIONS
        // ═══════════════════════════════════════════════════════════════════════════
        // Post-verification wallet recovery (uses already-linked gated wallet)
        // ═══════════════════════════════════════════════════════════════════════════
        // OPTION A: LINK EXISTING WALLETS (Post-Verification Setup)
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'setup_link_existing') {
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            if (!gatedWallet) {
                await this.bot.sendMessage(chatId, '❌ Please verify your $50 DTGC wallet first.');
                return;
            }
            session.pendingAction = 'link_gate_wallet';
            await this.bot.sendMessage(chatId, `🅰️ **LINK EXISTING WALLETS**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**Step 1 of 3: Verify Gate Wallet Ownership**\n\n` +
                `🔗 Your DTGC Gate Wallet:\n\`${gatedWallet}\`\n\n` +
                `Enter the **last 4 characters** of this\ngate wallet's private key:\n\n` +
                `**Example:** \`a1b2\`\n\n` +
                `_This proves you own the gate wallet._`, { parse_mode: 'Markdown' });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // OPTION B: GENERATE NEW WALLET SETUP (Post-Verification Setup)
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'setup_generate_new') {
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            if (!gatedWallet) {
                await this.bot.sendMessage(chatId, '❌ Please verify your $50 DTGC wallet first.');
                return;
            }
            await this.bot.sendMessage(chatId, `🅱️ **GENERATING NEW WALLET SETUP**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⏳ Creating your trading wallets...\n\n` +
                `🔗 Linked to Gate: \`${gatedWallet.slice(0, 12)}...\``);
            try {
                // Generate 6 new snipe wallets
                const newWallets = await multiWallet_1.multiWallet.generateMultiple(userId, 6, gatedWallet);
                // Format wallet info with keys
                let walletInfo = '';
                for (const w of newWallets) {
                    const privateKey = await multiWallet_1.multiWallet.exportPrivateKey(userId, w.index);
                    const keyLast4 = privateKey ? privateKey.slice(-4) : '????';
                    walletInfo += `\n**Wallet ${w.index + 1}:** \`${w.address.slice(0, 10)}...${w.address.slice(-6)}\`\n`;
                    walletInfo += `🔑 Key ends: \`...${keyLast4}\`\n`;
                }
                await this.bot.sendMessage(chatId, `✅ **NEW WALLETS GENERATED!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🔗 **Gate Wallet:**\n\`${gatedWallet}\`\n\n` +
                    `👛 **6 Snipe Wallets Created:**\n` +
                    `${walletInfo}\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `⚠️ **SAVE YOUR PRIVATE KEYS!**\n` +
                    `Use 👛 Wallets → Export to backup each key.\n\n` +
                    `💰 **Next:** Fund wallets with PLS to trade!\n\n` +
                    `_All wallets permanently linked to gate wallet._`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '👛 View & Export Wallets', callback_data: 'wallets_menu' }],
                            [{ text: '💰 Check Balances', callback_data: 'wallet_balance' }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                        ]
                    }
                });
            }
            catch (error) {
                console.error('Generate new setup error:', error);
                await this.bot.sendMessage(chatId, '❌ Error generating wallets. Please try again.');
            }
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // WALLET RECOVERY & LINKING OPTIONS
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'post_verify_recover') {
            session.pendingAction = 'post_verify_recover';
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            if (!gatedWallet) {
                await this.bot.sendMessage(chatId, '❌ No gated wallet found. Please verify first.');
                return;
            }
            await this.bot.sendMessage(chatId, `🔐 **Recover Your Wallets**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🔗 Gated Wallet: \`${gatedWallet.slice(0, 12)}...${gatedWallet.slice(-6)}\`\n\n` +
                `Enter the **last 4 characters** of any\nsnipe wallet's private key:\n\n` +
                `**Example:** \`f3e9\`\n\n` +
                `_Your wallets are linked to your gated wallet._`, { parse_mode: 'Markdown' });
            return;
        }
        // Bulk import wallets (up to 6)
        if (data === 'bulk_import_wallets') {
            session.pendingAction = 'bulk_import_wallets';
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            let headerMsg = `📥 **IMPORT YOUR 6 WALLETS**\n`;
            headerMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            if (gatedWallet) {
                headerMsg += `🔗 Linking to: \`${gatedWallet.slice(0, 10)}...${gatedWallet.slice(-6)}\`\n\n`;
            }
            headerMsg += `Paste your **private keys** below, one per line.\n`;
            headerMsg += `Add a **label** after each key (optional):\n\n`;
            headerMsg += `**Format:**\n`;
            headerMsg += `\`0xKEY1... Sniper 1\`\n`;
            headerMsg += `\`0xKEY2... DCA Bot\`\n`;
            headerMsg += `\`0xKEY3... Moon Bag\`\n`;
            headerMsg += `\`0xKEY4...\`\n`;
            headerMsg += `\`0xKEY5...\`\n`;
            headerMsg += `\`0xKEY6...\`\n\n`;
            headerMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            headerMsg += `⚠️ **Paste ALL your keys now** (up to 6)\n`;
            headerMsg += `_All wallets will be permanently saved!_`;
            await this.bot.sendMessage(chatId, headerMsg, { parse_mode: 'Markdown' });
            return;
        }
        // OLD bulk import message backup - keep for reference
        if (data === 'bulk_import_wallets_old') {
            session.pendingAction = 'bulk_import_wallets';
            await this.bot.sendMessage(chatId, `📥 **Bulk Import Wallets**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Enter up to **6 private keys**, one per line.\n` +
                `Optionally add a label after each key:\n\n` +
                `**Format:**\n` +
                `\`\`\`\n` +
                `<private_key1> Label1\n` +
                `<private_key2> Label2\n` +
                `<private_key3>\n` +
                `...\n` +
                `\`\`\`\n\n` +
                `**Example:**\n` +
                `\`\`\`\n` +
                `0x123...abc Sniper Main\n` +
                `0x456...def DCA Wallet\n` +
                `0x789...ghi Moon Bag\n` +
                `\`\`\`\n\n` +
                `_All wallets will be linked to your gated wallet._`, { parse_mode: 'Markdown' });
            return;
        }
        if (data === 'recover_bot_wallet') {
            session.pendingAction = 'recover_bot_wallet';
            await this.bot.sendMessage(chatId, `🤖 **Recovery via Bot Gated Wallet**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Enter your **Bot Gated Wallet address** and the\n` +
                `**last 4 characters** of any snipe wallet's private key:\n\n` +
                `**Format:** \`<wallet_address> <last4>\`\n\n` +
                `**Example:**\n` +
                `\`0x1234567890abcdef... f3e9\`\n\n` +
                `_This is the wallet you verified with $50+ DTGC._`, { parse_mode: 'Markdown' });
            return;
        }
        if (data === 'recover_gold_wallet') {
            session.pendingAction = 'recover_gold_wallet';
            await this.bot.sendMessage(chatId, `⚜️ **Recovery via DTGC Gold Wallet**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Enter your **DTGC Gold Suite verified wallet** and the\n` +
                `**last 4 characters** of any snipe wallet's private key:\n\n` +
                `**Format:** \`<wallet_address> <last4>\`\n\n` +
                `**Example:**\n` +
                `\`0x1234567890abcdef... f3e9\`\n\n` +
                `_This is the wallet you connected at dtgc.io/gold._`, { parse_mode: 'Markdown' });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // MULTI-WALLET ORDER SELECTION
        // ═══════════════════════════════════════════════════════════════════════════
        // Toggle wallet selection for orders
        if (data.startsWith('order_wallet_') && !data.includes('confirm') && !data.includes('all')) {
            const index = parseInt(data.replace('order_wallet_', ''));
            if (!session.selectedWallets)
                session.selectedWallets = [];
            if (session.selectedWallets.includes(index)) {
                session.selectedWallets = session.selectedWallets.filter(i => i !== index);
            }
            else {
                session.selectedWallets.push(index);
            }
            // Refresh keyboard
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const walletList = wallets.map(w => ({
                ...w,
                selected: session.selectedWallets?.includes(w.index)
            }));
            await this.bot.editMessageReplyMarkup(keyboards.orderWalletSelectKeyboard(walletList), { chat_id: parseInt(chatId), message_id: messageId });
            return;
        }
        // Select all wallets for order
        if (data === 'order_wallet_all') {
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            session.selectedWallets = wallets.map(w => w.index);
            const walletList = wallets.map(w => ({ ...w, selected: true }));
            await this.bot.editMessageReplyMarkup(keyboards.orderWalletSelectKeyboard(walletList), { chat_id: parseInt(chatId), message_id: messageId });
            return;
        }
        // Confirm and create multi-wallet orders
        if (data === 'order_wallet_confirm') {
            if (!session.selectedWallets || session.selectedWallets.length === 0) {
                await this.bot.sendMessage(chatId, '❌ Please select at least one wallet!');
                return;
            }
            const orderType = session.pendingOrderType;
            const tokenAddress = session.pendingToken;
            const targetPrice = parseFloat(session.pendingPrice);
            const amount = parseFloat(session.pendingAmount);
            await this.bot.sendMessage(chatId, `⏳ Creating ${session.selectedWallets.length} limit orders...`);
            let successCount = 0;
            const orderIds = [];
            for (const walletIndex of session.selectedWallets) {
                try {
                    const wallet = await multiWallet_1.multiWallet.getWalletSigner(userId, walletIndex);
                    if (wallet) {
                        const order = await limitOrder_1.limitOrderEngine.createOrder({
                            userId,
                            walletAddress: wallet.address,
                            tokenAddress,
                            orderType,
                            targetPrice: ethers_1.ethers.parseEther(targetPrice.toString()),
                            amount: ethers_1.ethers.parseEther(amount.toString()),
                            slippage: session.settings.slippage,
                        });
                        orderIds.push(order.id);
                        successCount++;
                    }
                }
                catch (e) {
                    console.error(`Failed to create order for wallet ${walletIndex}:`, e);
                }
            }
            // Get token info for receipt
            const tokenSymbol = session.tokenInfo?.symbol || tokenAddress.slice(0, 10) + '...';
            const currentPrice = session.tokenInfo?.pricePls || 0;
            const priceChangePercent = currentPrice ? ((targetPrice / currentPrice - 1) * 100).toFixed(1) : '?';
            // Get selected wallets info
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const selectedWalletList = session.selectedWallets
                .map(idx => wallets.find(w => w.index === idx))
                .filter(w => w)
                .map(w => `  • ${w.label || 'Wallet ' + w.index}: \`${w.address.slice(0, 8)}...${w.address.slice(-4)}\``)
                .join('\n');
            // Calculate totals
            const totalPls = amount * session.selectedWallets.length;
            const totalPlsFormatted = totalPls >= 1000000
                ? (totalPls / 1000000).toFixed(2) + 'M'
                : totalPls >= 1000
                    ? (totalPls / 1000).toFixed(1) + 'K'
                    : totalPls.toFixed(0);
            // Clear session
            session.pendingAction = undefined;
            session.pendingToken = undefined;
            session.pendingAmount = undefined;
            session.pendingPrice = undefined;
            session.pendingOrderType = undefined;
            session.selectedWallets = undefined;
            // Generate receipt timestamp (EST)
            const timestamp = formatTimestamp();
            // Order type emoji and name
            const orderTypeEmoji = {
                limit_buy: '🟢',
                limit_sell: '🔴',
                stop_loss: '🛑',
                take_profit: '💰'
            };
            const orderTypeName = {
                limit_buy: 'LIMIT BUY',
                limit_sell: 'LIMIT SELL',
                stop_loss: 'STOP LOSS',
                take_profit: 'TAKE PROFIT'
            };
            await this.bot.sendMessage(chatId, `╔══════════════════════════════╗\n` +
                `║  ${orderTypeEmoji[orderType] || '📊'} **LIMIT ORDER RECEIPT**    ║\n` +
                `╠══════════════════════════════╣\n` +
                `║  📋 **Order Details**               ║\n` +
                `╚══════════════════════════════╝\n\n` +
                `📊 **Type:** ${orderTypeName[orderType] || orderType.toUpperCase()}\n` +
                `🪙 **Token:** ${tokenSymbol}\n` +
                `📍 **Contract:** \`${tokenAddress.slice(0, 12)}...${tokenAddress.slice(-8)}\`\n\n` +
                `━━━ **Price Target** ━━━\n` +
                `${currentPrice ? `📈 Current: ${currentPrice.toFixed(12)} PLS\n` : ''}` +
                `🎯 Target: **${targetPrice.toFixed(12)} PLS**\n` +
                `${currentPrice ? `📊 Change: ${priceChangePercent}%\n` : ''}\n` +
                `━━━ **Investment** ━━━\n` +
                `💵 Per Wallet: **${amount.toLocaleString()} PLS**\n` +
                `👛 Wallets: **${successCount}**\n` +
                `💰 Total: **${totalPlsFormatted} PLS**\n\n` +
                `━━━ **Wallets** ━━━\n` +
                `${selectedWalletList}\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `✅ **${successCount} orders watching!**\n` +
                `🕐 Created: ${timestamp}\n` +
                `🆔 IDs: \`${orderIds.slice(0, 3).join(', ')}${orderIds.length > 3 ? '...' : ''}\``, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📋 View Active Orders', callback_data: 'orders_active' }],
                        [{ text: '➕ New Limit Order', callback_data: 'order_limit' }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                    ]
                }
            });
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
        // ═══════════════════════════════════════════════════════════════════════════
        // 📋 VIEW ACTIVE ORDERS - Enhanced with limit sell options
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'orders_active') {
            if (!await this.checkGate(chatId, userId))
                return;
            await this.showEnhancedActiveOrders(chatId, userId);
            return;
        }
        // Refresh order status - shows live prices
        if (data === 'refresh_order_status') {
            if (!await this.checkGate(chatId, userId))
                return;
            const orders = limitOrder_1.limitOrderEngine.getUserOrders(userId);
            const activeOrders = orders.filter(o => o.status === 'active');
            if (activeOrders.length === 0) {
                await this.bot.sendMessage(chatId, `📊 No active limit orders.`, { reply_markup: keyboards.ordersMenuKeyboard });
                return;
            }
            await this.bot.sendMessage(chatId, `🔄 Refreshing ${activeOrders.length} orders...`);
            let statusMsg = `📊 **LIVE ORDER STATUS** (Refreshed)\n`;
            statusMsg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            statusMsg += `🟢 Engine: **RUNNING**\n\n`;
            for (const order of activeOrders) {
                const targetPrice = parseFloat(ethers_1.ethers.formatEther(BigInt(order.targetPrice)));
                const amount = parseFloat(ethers_1.ethers.formatEther(BigInt(order.amount)));
                let currentPrice = 0;
                let currentUsd = 0;
                let targetUsd = 0;
                let tokenSymbol = 'TOKEN';
                try {
                    const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(order.tokenAddress);
                    if (tokenInfo) {
                        currentPrice = tokenInfo.pricePls || 0;
                        currentUsd = tokenInfo.priceUsd || 0;
                        tokenSymbol = tokenInfo.symbol || 'TOKEN';
                        if (currentPrice > 0)
                            targetUsd = (targetPrice / currentPrice) * currentUsd;
                    }
                }
                catch { }
                const priceChange = currentPrice > 0 ? ((currentPrice / targetPrice - 1) * 100).toFixed(2) : '?';
                const orderEmoji = order.orderType === 'limit_buy' ? '🟢' : '🔴';
                statusMsg += `${orderEmoji} **${tokenSymbol}** - ${order.orderType.replace('_', ' ').toUpperCase()}\n`;
                statusMsg += `📈 Current: ${currentPrice.toFixed(12)} PLS (~$${currentUsd.toFixed(10)})\n`;
                statusMsg += `🎯 Target: ${targetPrice.toFixed(12)} PLS (~$${targetUsd.toFixed(10)})\n`;
                statusMsg += `📊 Gap: **${priceChange}%** | 💰 ${amount >= 1000000 ? (amount / 1000000).toFixed(1) + 'M' : amount.toLocaleString()} PLS\n\n`;
            }
            await this.bot.sendMessage(chatId, statusMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Refresh Again', callback_data: 'refresh_order_status' }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                    ],
                },
            });
            return;
        }
        // Set limit sell on an existing order/position
        if (data.startsWith('order_limit_sell_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const orderId = data.replace('order_limit_sell_', '');
            session.pendingOrderIdForSell = orderId;
            session.pendingAction = 'order_limit_sell_price';
            // Get order info
            const activeOrders = jsonStore_1.TradeHistory.getActiveOrders(userId);
            const order = activeOrders.find(o => o.id === orderId);
            if (!order) {
                await this.bot.sendMessage(chatId, '❌ Order not found.');
                return;
            }
            // Fetch current price
            try {
                const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(order.tokenAddress);
                session.tokenInfo = tokenInfo || undefined;
                session.pendingToken = order.tokenAddress;
                const currentPrice = tokenInfo?.pricePls || 0;
                await this.bot.sendMessage(chatId, `🔴 **SET LIMIT SELL**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🪙 Token: **${order.tokenSymbol || 'TOKEN'}**\n` +
                    `📍 \`${order.tokenAddress.slice(0, 12)}...${order.tokenAddress.slice(-8)}\`\n\n` +
                    `📈 **Current Price:** ${currentPrice > 0 ? currentPrice.toFixed(12) + ' PLS' : 'Unknown'}\n\n` +
                    `Enter your sell target:\n` +
                    `• Direct price: \`0.00002\`\n` +
                    `• Percentage: \`+50%\` (50% above current)\n` +
                    `• Multiplier: \`2x\` or \`3x\``, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'orders_active' }]] } });
            }
            catch (e) {
                await this.bot.sendMessage(chatId, `🔴 **SET LIMIT SELL**\n\n` +
                    `Token: \`${order.tokenAddress}\`\n\n` +
                    `Enter sell target price in PLS or percentage (+50%):`, { parse_mode: 'Markdown' });
            }
            return;
        }
        // Cancel specific order
        if (data.startsWith('order_cancel_')) {
            const orderId = data.replace('order_cancel_', '');
            const cancelled = jsonStore_1.TradeHistory.cancelOrder(orderId);
            if (cancelled) {
                await this.bot.sendMessage(chatId, `✅ Order cancelled: \`${orderId.slice(0, 20)}...\``, { parse_mode: 'Markdown' });
            }
            else {
                await this.bot.sendMessage(chatId, '❌ Could not cancel order.');
            }
            // Refresh active orders
            await this.showEnhancedActiveOrders(chatId, userId);
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // 📊 P&L CARD GENERATOR - Mandalorian themed
        // ═══════════════════════════════════════════════════════════════════════════
        if (data === 'generate_pnl_card' || data === 'pnl_card') {
            if (!await this.checkGate(chatId, userId))
                return;
            await this.generatePnLCard(chatId, userId);
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
        // ═══════════════════════════════════════════════════════════════════════
        // 🎯 QUICK LIMIT ORDER PRESETS - Fast limit order creation
        // ═══════════════════════════════════════════════════════════════════════
        // Quick Limit Buy at X% below current price (e.g., qlimit_buy_10_0x95B3...)
        if (data.startsWith('qlimit_buy_') && !data.includes('custom')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const parts = data.replace('qlimit_buy_', '').split('_');
            const percent = parseInt(parts[0]);
            const shortAddr = parts[1];
            // Find full token address from session or recent activity
            const tokenAddress = session.pendingToken ||
                session.snipeOrders.find(o => o.tokenAddress.startsWith(shortAddr))?.tokenAddress || '';
            if (!tokenAddress) {
                await this.bot.sendMessage(chatId, '❌ Token not found. Please start from token menu.');
                return;
            }
            // Get current price using limit order engine (it has priceInPls)
            const priceData = await limitOrder_1.limitOrderEngine.getTokenPrice(tokenAddress);
            if (!priceData || !priceData.priceInPls) {
                await this.bot.sendMessage(chatId, '❌ Could not get token price. Try again.');
                return;
            }
            const currentPrice = priceData.priceInPls;
            const targetPrice = currentPrice - (currentPrice * BigInt(percent) / BigInt(100));
            session.pendingToken = tokenAddress;
            session.pendingPrice = targetPrice.toString();
            session.pendingAction = 'limit_buy_amount';
            session.pendingOrderType = 'limit_buy';
            const currentPriceStr = ethers_1.ethers.formatEther(currentPrice);
            const targetPriceStr = ethers_1.ethers.formatEther(targetPrice);
            await this.bot.sendMessage(chatId, `✅ **Limit Buy Target Set**\n\n` +
                `📊 Current: ${parseFloat(currentPriceStr).toFixed(12)} PLS\n` +
                `🎯 Target: ${parseFloat(targetPriceStr).toFixed(12)} PLS (-${percent}%)\n\n` +
                `💰 Enter PLS amount to spend (per wallet):`, { parse_mode: 'Markdown' });
            return;
        }
        // Quick Limit Sell / Take Profit at X% above current price
        if (data.startsWith('qlimit_sell_') && !data.includes('custom')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const parts = data.replace('qlimit_sell_', '').split('_');
            const percent = parseInt(parts[0]);
            const shortAddr = parts[1];
            const tokenAddress = session.pendingToken ||
                session.snipeOrders.find(o => o.tokenAddress.startsWith(shortAddr))?.tokenAddress || '';
            if (!tokenAddress) {
                await this.bot.sendMessage(chatId, '❌ Token not found. Please start from token menu.');
                return;
            }
            const priceData = await limitOrder_1.limitOrderEngine.getTokenPrice(tokenAddress);
            if (!priceData || !priceData.priceInPls) {
                await this.bot.sendMessage(chatId, '❌ Could not get token price. Try again.');
                return;
            }
            const currentPrice = priceData.priceInPls;
            const targetPrice = currentPrice + (currentPrice * BigInt(percent) / BigInt(100));
            session.pendingToken = tokenAddress;
            session.pendingPrice = targetPrice.toString();
            session.pendingAction = 'limit_sell_amount';
            session.pendingOrderType = 'limit_sell';
            const currentPriceStr = ethers_1.ethers.formatEther(currentPrice);
            const targetPriceStr = ethers_1.ethers.formatEther(targetPrice);
            const multiplier = (100 + percent) / 100;
            await this.bot.sendMessage(chatId, `✅ **Limit Sell / Take Profit Target Set**\n\n` +
                `📊 Current: ${parseFloat(currentPriceStr).toFixed(12)} PLS\n` +
                `🎯 Target: ${parseFloat(targetPriceStr).toFixed(12)} PLS (+${percent}% = ${multiplier.toFixed(1)}x)\n\n` +
                `💰 Enter token amount to sell (or % like "50%"):`, { parse_mode: 'Markdown' });
            return;
        }
        // InstaBond Take Profit preset (set auto-sell % for snipes)
        if (data.startsWith('instabond_tp_') && !data.includes('custom') && !data.includes('none')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const parts = data.replace('instabond_tp_', '').split('_');
            const percent = parseInt(parts[0]);
            const shortAddr = parts[1];
            // Store take profit setting in session for next snipe
            session.settings.defaultTakeProfit = percent;
            session.settings.defaultSellPercent = percent >= 100 ? 50 : 100; // Sell 50% at 2x+, 100% at lower
            await this.bot.sendMessage(chatId, `✅ **InstaBond Take-Profit Set**\n\n` +
                `🎯 Auto-sell at: **+${percent}%** (${((100 + percent) / 100).toFixed(1)}x)\n` +
                `💰 Sell amount: ${session.settings.defaultSellPercent}% of tokens\n\n` +
                `_All future InstaBond snipes will auto-set this take profit!_\n\n` +
                `💡 At +100% (2x), selling 50% recovers your initial investment!`, { parse_mode: 'Markdown', reply_markup: keyboards.pumpMenuKeyboard });
            return;
        }
        // Disable InstaBond auto take-profit
        if (data.startsWith('instabond_tp_none_')) {
            session.settings.defaultTakeProfit = undefined;
            await this.bot.sendMessage(chatId, `❌ **Auto Take-Profit Disabled**\n\n_You'll set take profit manually after each snipe._`, { parse_mode: 'Markdown', reply_markup: keyboards.pumpMenuKeyboard });
            return;
        }
        // Show quick limit buy keyboard for a token (from position keyboard)
        if (data.startsWith('pos_limit_buy_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const shortAddr = data.replace('pos_limit_buy_', '');
            const tokenAddress = session.pendingToken ||
                session.snipeOrders.find(o => o.tokenAddress.slice(0, 8) === shortAddr)?.tokenAddress || '';
            if (tokenAddress) {
                session.pendingToken = tokenAddress;
                await this.bot.sendMessage(chatId, '🟢 **Quick Limit Buy**\n\n_Select target price below current:_', {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.quickLimitBuyKeyboard(tokenAddress),
                });
            }
            return;
        }
        // Show quick limit sell keyboard for a token (from position keyboard)
        if (data.startsWith('pos_limit_sell_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const shortAddr = data.replace('pos_limit_sell_', '');
            const tokenAddress = session.pendingToken ||
                session.snipeOrders.find(o => o.tokenAddress.slice(0, 8) === shortAddr)?.tokenAddress || '';
            if (tokenAddress) {
                session.pendingToken = tokenAddress;
                await this.bot.sendMessage(chatId, '🔴 **Quick Limit Sell / Take Profit**\n\n_Select target price above current:_', {
                    parse_mode: 'Markdown',
                    reply_markup: keyboards.quickLimitSellKeyboard(tokenAddress),
                });
            }
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
        // ➕ New Limit Order - show buy/sell options
        if (data === 'order_limit') {
            if (!await this.checkGate(chatId, userId))
                return;
            await this.bot.sendMessage(chatId, `➕ **NEW LIMIT ORDER**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Choose your order type:`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🟢 Limit Buy (buy when price drops)', callback_data: 'order_limit_buy' }],
                        [{ text: '🔴 Limit Sell (sell when price rises)', callback_data: 'order_limit_sell' }],
                        [{ text: '🛑 Stop Loss', callback_data: 'order_stop_loss' }],
                        [{ text: '💰 Take Profit', callback_data: 'order_take_profit' }],
                        [{ text: '🔙 Back', callback_data: 'orders_menu' }],
                    ]
                }
            });
            return;
        }
        // Limit order from buy/sell flow
        if (data === 'buy_limit_order') {
            if (!await this.checkGate(chatId, userId))
                return;
            // User already has a token selected, go straight to price entry
            if (session.pendingToken) {
                session.pendingAction = 'limit_buy_price';
                session.pendingOrderType = 'limit_buy';
                await this.bot.sendMessage(chatId, `🟢 **LIMIT BUY ORDER**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📋 Token: \`${session.pendingToken.slice(0, 12)}...${session.pendingToken.slice(-8)}\`\n\n` +
                    `Enter your target buy price in PLS:\n` +
                    `_Example: 0.00001 or 1000000_\n\n` +
                    `Or enter a percentage below current price:\n` +
                    `_Example: -10% or -25%_`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'main_menu' }]] } });
            }
            else {
                session.pendingAction = 'limit_buy_token';
                await this.bot.sendMessage(chatId, '📝 Enter token address for limit buy:');
            }
            return;
        }
        if (data === 'sell_limit_order') {
            if (!await this.checkGate(chatId, userId))
                return;
            // User already has a token selected, go straight to price entry
            if (session.pendingToken) {
                session.pendingAction = 'limit_sell_price';
                session.pendingOrderType = 'limit_sell';
                await this.bot.sendMessage(chatId, `🔴 **LIMIT SELL ORDER**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📋 Token: \`${session.pendingToken.slice(0, 12)}...${session.pendingToken.slice(-8)}\`\n\n` +
                    `Enter your target sell price in PLS:\n` +
                    `_Example: 0.00002 or 2000000_\n\n` +
                    `Or enter a percentage above current price:\n` +
                    `_Example: +50% or +100%_`, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'main_menu' }]] } });
            }
            else {
                session.pendingAction = 'limit_sell_token';
                await this.bot.sendMessage(chatId, '📝 Enter token address for limit sell:');
            }
            return;
        }
        // noop for separator buttons
        if (data === 'noop') {
            return;
        }
        // Probable Wins quick buy
        if (data.startsWith('wins_buy_')) {
            if (!await this.checkGate(chatId, userId))
                return;
            const partialAddr = data.replace('wins_buy_', '');
            // Find full address from recent wins
            const wins = await dexscreener_1.dexScreener.getProbableWins(15);
            const token = wins.find(w => w.token.address.startsWith(partialAddr));
            if (token) {
                session.pendingToken = token.token.address;
                session.tokenInfo = token.token;
                // Show token info and buy options
                const msg = dexscreener_1.dexScreener.formatTokenInfo(token.token) + `\n\n⚜️ _Select buy amount:_`;
                session.pendingAction = 'buy_amount';
                await this.bot.sendMessage(chatId, msg, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: keyboards.buyAmountKeyboard,
                });
            }
            else {
                await this.bot.sendMessage(chatId, '❌ Token not found. Try refreshing Probable Wins.');
            }
            return;
        }
        // Probable Wins details
        if (data.startsWith('wins_details_')) {
            const partialAddr = data.replace('wins_details_', '');
            const wins = await dexscreener_1.dexScreener.getProbableWins(15);
            const win = wins.find(w => w.token.address.startsWith(partialAddr));
            if (win) {
                let msg = dexscreener_1.dexScreener.formatTokenInfo(win.token);
                msg += `\n\n🏆 **Score: ${win.score}%**\n`;
                msg += `📋 **Analysis:**\n`;
                for (const reason of win.reasons) {
                    msg += `• ${reason}\n`;
                }
                await this.bot.sendMessage(chatId, msg, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: `💰 Buy $${win.token.symbol}`, callback_data: `wins_buy_${partialAddr}` }],
                            [{ text: '🔙 Back to Probable Wins', callback_data: 'wins_menu' }],
                        ]
                    },
                });
            }
            else {
                await this.bot.sendMessage(chatId, '❌ Token not found. Try refreshing.');
            }
            return;
        }
        // Custom buy amount - prompt user
        if (data === 'buy_custom') {
            if (!await this.checkGate(chatId, userId))
                return;
            if (!session.pendingToken) {
                await this.bot.sendMessage(chatId, '❌ No token selected. Start a new buy flow.');
                return;
            }
            session.pendingAction = 'buy_amount';
            await this.bot.sendMessage(chatId, `📝 **Custom Buy Amount**\n\n` +
                `Token: \`${session.pendingToken.slice(0, 12)}...${session.pendingToken.slice(-8)}\`\n\n` +
                `Enter PLS amount to spend:`, { parse_mode: 'Markdown' });
            return;
        }
        // Custom sell percentage - prompt user
        if (data === 'sell_custom') {
            if (!await this.checkGate(chatId, userId))
                return;
            if (!session.pendingToken) {
                await this.bot.sendMessage(chatId, '❌ No token selected. Start a new sell flow.');
                return;
            }
            session.pendingAction = 'sell_custom_percent';
            await this.bot.sendMessage(chatId, `📝 **Custom Sell Percentage**\n\n` +
                `Token: \`${session.pendingToken.slice(0, 12)}...${session.pendingToken.slice(-8)}\`\n\n` +
                `Enter percentage to sell (1-100):`, { parse_mode: 'Markdown' });
            return;
        }
        // Confirmation handlers
        if (data === 'confirm_yes') {
            // Handle various pending confirmations
            if (session.pendingAction === 'confirm_risky_buy') {
                // User confirmed buying risky token
                session.pendingAction = 'buy_amount';
                await this.bot.sendMessage(chatId, `⚠️ Proceeding with risky token...\n\nSelect buy amount:`, { reply_markup: keyboards.buyAmountKeyboard });
            }
            else {
                await this.bot.sendMessage(chatId, '✅ Confirmed!');
            }
            return;
        }
        if (data === 'confirm_no') {
            session.pendingAction = undefined;
            session.pendingToken = undefined;
            session.pendingAmount = undefined;
            await this.bot.sendMessage(chatId, `❌ Cancelled.`, { reply_markup: keyboards.mainMenuKeyboard });
            return;
        }
        // Buy amount selection
        if (data.startsWith('buy_') && !data.startsWith('buy_custom') && !data.startsWith('buy_limit')) {
            const amount = data.replace('buy_', '');
            if (!isNaN(parseInt(amount))) {
                session.pendingAmount = amount;
                await this.executeBuy(chatId, userId);
            }
            return;
        }
        // Sell percentage
        if (data.startsWith('sell_') && !data.startsWith('sell_custom') && !data.startsWith('sell_limit')) {
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
        // ═══════════════════════════════════════════════════════════════════════════
        // STEP 1: Verify Gate Wallet Ownership (Option A flow)
        // ═══════════════════════════════════════════════════════════════════════════
        if (session.pendingAction === 'link_gate_wallet') {
            const keyLast4 = text.trim();
            if (keyLast4.length !== 4) {
                await this.bot.sendMessage(chatId, `❌ Please enter exactly 4 characters.\n\n` +
                    `Example: \`a1b2\``, { parse_mode: 'Markdown' });
                return;
            }
            // Store the gate wallet key verification for later use
            session.gateKeyLast4 = keyLast4;
            session.pendingAction = 'link_bot_wallet';
            await this.bot.sendMessage(chatId, `✅ **Gate Wallet Verified!**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `**Step 2 of 3: Link Your Bot Wallet**\n\n` +
                `Enter your **Bot Wallet address** and the\n**last 4 characters** of its private key:\n\n` +
                `**Format:** \`<address> <last4>\`\n\n` +
                `**Example:**\n` +
                `\`0x1234567890abcdef1234567890abcdef12345678 c3d4\`\n\n` +
                `_This is the bot wallet you previously used._`, { parse_mode: 'Markdown' });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // STEP 2: Link Bot Wallet (Option A flow)
        // ═══════════════════════════════════════════════════════════════════════════
        if (session.pendingAction === 'link_bot_wallet') {
            const parts = text.trim().split(/\s+/);
            if (parts.length < 2) {
                await this.bot.sendMessage(chatId, `❌ Invalid format. Please provide:\n\n\`<bot_wallet_address> <last4>\`\n\n` +
                    `Example: \`0x1234...abcd c3d4\``, { parse_mode: 'Markdown' });
                return;
            }
            const botWalletAddress = parts[0];
            const botKeyLast4 = parts[1];
            if (!ethers_1.ethers.isAddress(botWalletAddress)) {
                await this.bot.sendMessage(chatId, '❌ Invalid wallet address. Please try again.');
                return;
            }
            if (botKeyLast4.length !== 4) {
                await this.bot.sendMessage(chatId, '❌ Please provide exactly 4 characters from the private key.');
                return;
            }
            // Store bot wallet info
            session.botWalletAddress = botWalletAddress;
            session.botKeyLast4 = botKeyLast4;
            session.pendingAction = 'link_import_snipe_wallets';
            await this.bot.sendMessage(chatId, `✅ **Bot Wallet Linked!**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🤖 Bot: \`${botWalletAddress.slice(0, 12)}...${botWalletAddress.slice(-6)}\`\n\n` +
                `**Step 3 of 3: Import Snipe Wallets**\n\n` +
                `Enter up to **6 private keys**, one per line.\n` +
                `Optionally add a label after each key:\n\n` +
                `**Format:**\n` +
                `\`\`\`\n` +
                `<private_key1> Sniper 1\n` +
                `<private_key2> DCA Bot\n` +
                `<private_key3>\n` +
                `...\n` +
                `\`\`\`\n\n` +
                `_All wallets will be permanently linked to your gate wallet._`, { parse_mode: 'Markdown' });
            return;
        }
        // ═══════════════════════════════════════════════════════════════════════════
        // STEP 3: Import Snipe Wallets (Option A flow - Final Step)
        // ═══════════════════════════════════════════════════════════════════════════
        if (session.pendingAction === 'link_import_snipe_wallets') {
            session.pendingAction = undefined;
            const lines = text.trim().split('\n').filter(l => l.trim());
            if (lines.length === 0) {
                await this.bot.sendMessage(chatId, '❌ No private keys found. Try again.');
                return;
            }
            if (lines.length > 6) {
                await this.bot.sendMessage(chatId, `❌ Maximum 6 wallets allowed. You provided ${lines.length}.`);
                return;
            }
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            await this.bot.sendMessage(chatId, `📥 Importing ${lines.length} snipe wallets...`);
            const imported = [];
            const failed = [];
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const keyPart = parts[0];
                const labelPart = parts.slice(1).join(' ').slice(0, 20) || undefined;
                const cleanKey = keyPart.startsWith('0x') ? keyPart.slice(2) : keyPart;
                if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
                    failed.push(keyPart.slice(0, 10) + '...');
                    continue;
                }
                try {
                    const fullKey = keyPart.startsWith('0x') ? keyPart : `0x${keyPart}`;
                    const wallet = multiWallet_1.multiWallet.importWallet(userId, fullKey, labelPart, gatedWallet);
                    imported.push({ address: wallet.address, label: wallet.label, index: wallet.index });
                }
                catch (e) {
                    failed.push(keyPart.slice(0, 10) + '...');
                }
            }
            // Build success message
            let resultMsg = `✅ **WALLET SETUP COMPLETE!**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            if (gatedWallet) {
                resultMsg += `🔗 **Gate Wallet:**\n\`${gatedWallet}\`\n\n`;
            }
            if (session.botWalletAddress) {
                resultMsg += `🤖 **Bot Wallet:**\n\`${session.botWalletAddress}\`\n\n`;
            }
            if (imported.length > 0) {
                resultMsg += `👛 **${imported.length} Snipe Wallets Linked:**\n\n`;
                for (const w of imported) {
                    resultMsg += `✅ #${w.index + 1} ${w.label}\n\`${w.address.slice(0, 12)}...${w.address.slice(-6)}\`\n\n`;
                }
            }
            if (failed.length > 0) {
                resultMsg += `\n❌ **${failed.length} Failed:** Invalid keys\n`;
            }
            resultMsg += `\n━━━━━━━━━━━━━━━━━━━━━\n`;
            resultMsg += `🎉 **All wallets permanently linked!**\n`;
            resultMsg += `_Your trade history will be saved to this setup._`;
            // Clear session data
            delete session.gateKeyLast4;
            delete session.botWalletAddress;
            delete session.botKeyLast4;
            await this.bot.sendMessage(chatId, resultMsg, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '👛 View Wallets', callback_data: 'wallets_menu' }],
                        [{ text: '💰 Check Balances', callback_data: 'wallet_balance' }],
                        [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                    ]
                }
            });
            return;
        }
        // Post-verification recovery - just needs last 4 chars (gated wallet already known)
        if (session.pendingAction === 'post_verify_recover') {
            session.pendingAction = undefined;
            const keyLast4 = text.trim();
            if (keyLast4.length !== 4) {
                await this.bot.sendMessage(chatId, `❌ Please enter exactly 4 characters.\n\nTry again or use /recover for full recovery options.`, { parse_mode: 'Markdown' });
                return;
            }
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            if (!gatedWallet) {
                await this.bot.sendMessage(chatId, '❌ No gated wallet found. Please verify first with /start');
                return;
            }
            await this.bot.sendMessage(chatId, '🔍 Searching for your wallets...');
            // 1. Try Vercel backup first (more reliable than local file)
            const vercelResult = await multiWallet_1.multiWallet.recoverFromVercel(userId, gatedWallet);
            if (vercelResult.recovered > 0) {
                await this.bot.sendMessage(chatId, `✅ **WALLETS RECOVERED FROM CLOUD!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `☁️ Found **${vercelResult.wallets.length} wallets** in cloud backup!\n\n` +
                    `All wallets are now accessible.\n\n` +
                    `Use /wallets to view and manage them.`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
                return;
            }
            // 2. Fall back to local store recovery
            const result = multiWallet_1.multiWallet.recoverWallets(gatedWallet, keyLast4);
            if (result) {
                if (result.userId !== userId) {
                    multiWallet_1.multiWallet.transferWallets(result.userId, userId);
                }
                // Sync recovered wallets to Vercel for future
                multiWallet_1.multiWallet.syncToVercel(userId, gatedWallet).catch(() => { });
                await this.bot.sendMessage(chatId, `✅ **WALLETS RECOVERED!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🔐 Found **${result.walletCount} wallets** linked to your gated wallet!\n\n` +
                    `All wallets are now accessible.\n\n` +
                    `Use /wallets to view and manage them.`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            }
            else {
                await this.bot.sendMessage(chatId, `❌ **No match found**\n\n` +
                    `The last 4 characters don't match any wallet linked to your gated address.\n\n` +
                    `💡 Try a different wallet's private key, or use /recover for more options.`, { parse_mode: 'Markdown' });
            }
            return;
        }
        // Bulk import wallets - multiple private keys at once
        if (session.pendingAction === 'bulk_import_wallets') {
            session.pendingAction = undefined;
            const lines = text.trim().split('\n').filter(l => l.trim());
            if (lines.length === 0) {
                await this.bot.sendMessage(chatId, '❌ No private keys found. Try again.');
                return;
            }
            if (lines.length > 6) {
                await this.bot.sendMessage(chatId, `❌ Maximum 6 wallets allowed. You provided ${lines.length}.`);
                return;
            }
            const gatedWallet = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
            await this.bot.sendMessage(chatId, `📥 Importing ${lines.length} wallets...`);
            const imported = [];
            const failed = [];
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const keyPart = parts[0];
                const labelPart = parts.slice(1).join(' ').slice(0, 20) || undefined;
                const cleanKey = keyPart.startsWith('0x') ? keyPart.slice(2) : keyPart;
                if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
                    failed.push(keyPart.slice(0, 10) + '...');
                    continue;
                }
                try {
                    const fullKey = keyPart.startsWith('0x') ? keyPart : `0x${keyPart}`;
                    const wallet = multiWallet_1.multiWallet.importWallet(userId, fullKey, labelPart, gatedWallet);
                    imported.push({ address: wallet.address, label: wallet.label, index: wallet.index });
                }
                catch (e) {
                    failed.push(keyPart.slice(0, 10) + '...');
                }
            }
            let resultMsg = `✅ **Import Complete!**\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
            if (imported.length > 0) {
                resultMsg += `**${imported.length} Wallets Imported:**\n\n`;
                for (const w of imported) {
                    resultMsg += `✅ #${w.index} ${w.label}\n\`${w.address.slice(0, 12)}...${w.address.slice(-6)}\`\n\n`;
                }
            }
            if (failed.length > 0) {
                resultMsg += `\n❌ **${failed.length} Failed:** Invalid keys\n`;
            }
            if (gatedWallet) {
                resultMsg += `\n🔗 All wallets linked to:\n\`${gatedWallet.slice(0, 12)}...${gatedWallet.slice(-6)}\``;
            }
            await this.bot.sendMessage(chatId, resultMsg, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.walletsMenuKeyboard
            });
            return;
        }
        // Wallet Recovery - parse address + last4 of private key (both methods)
        if (session.pendingAction === 'recover_bot_wallet' || session.pendingAction === 'recover_gold_wallet') {
            const recoveryType = session.pendingAction === 'recover_bot_wallet' ? 'Bot Gated' : 'DTGC Gold';
            session.pendingAction = undefined;
            // Parse input: "0x1234...abcd f3e9" or "0x1234abcd f3e9"
            const parts = text.trim().split(/\s+/);
            if (parts.length < 2) {
                await this.bot.sendMessage(chatId, `❌ Invalid format. Please provide:\n\n\`<wallet_address> <last4>\`\n\nExample: \`0x1234...abcd f3e9\`\n\nTry /recover again.`, { parse_mode: 'Markdown' });
                return;
            }
            const walletAddress = parts[0];
            const keyLast4 = parts[1];
            if (!ethers_1.ethers.isAddress(walletAddress)) {
                await this.bot.sendMessage(chatId, '❌ Invalid wallet address. Try /recover again.');
                return;
            }
            if (keyLast4.length !== 4) {
                await this.bot.sendMessage(chatId, '❌ Please provide exactly 4 characters from your private key. Try /recover again.');
                return;
            }
            await this.bot.sendMessage(chatId, `🔍 Searching via ${recoveryType} wallet...`);
            // 1. Try Vercel cloud backup first (most reliable)
            const vercelResult = await multiWallet_1.multiWallet.recoverFromVercel(userId, walletAddress);
            if (vercelResult.recovered > 0 || vercelResult.wallets.length > 0) {
                // Link the gated wallet to current session
                session.linkedWallet = walletAddress.toLowerCase();
                jsonStore_1.LinkedWallets.link(userId, chatId, walletAddress, 0);
                await this.bot.sendMessage(chatId, `✅ **WALLETS RECOVERED FROM CLOUD!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `☁️ Found **${vercelResult.wallets.length} wallets** via ${recoveryType}:\n` +
                    `\`${walletAddress.slice(0, 12)}...${walletAddress.slice(-8)}\`\n\n` +
                    `Your snipe wallets are now accessible!\n\n` +
                    `Use /wallets to view and manage them.`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
                return;
            }
            // 2. Fall back to local store recovery
            const result = multiWallet_1.multiWallet.recoverWallets(walletAddress, keyLast4);
            if (result) {
                // Transfer ownership to current user
                if (result.userId !== userId) {
                    multiWallet_1.multiWallet.transferWallets(result.userId, userId);
                }
                // Link the gated wallet to current session
                session.linkedWallet = walletAddress.toLowerCase();
                jsonStore_1.LinkedWallets.link(userId, chatId, walletAddress, 0);
                // Sync recovered wallets to Vercel for future
                multiWallet_1.multiWallet.syncToVercel(userId, walletAddress).catch(() => { });
                await this.bot.sendMessage(chatId, `✅ **WALLETS RECOVERED!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `🔐 Found **${result.walletCount} wallets** via ${recoveryType}:\n` +
                    `\`${walletAddress.slice(0, 12)}...${walletAddress.slice(-8)}\`\n\n` +
                    `Your snipe wallets are now accessible!\n\n` +
                    `Use /wallets to view and rename them.`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            }
            else {
                // Check Vercel one more time for any wallets (maybe different key last4)
                const vercelCheck = await multiWallet_1.multiWallet.recoverFromVercel(userId, walletAddress);
                if (vercelCheck.wallets.length > 0) {
                    session.linkedWallet = walletAddress.toLowerCase();
                    jsonStore_1.LinkedWallets.link(userId, chatId, walletAddress, 0);
                    await this.bot.sendMessage(chatId, `✅ **WALLETS RECOVERED FROM CLOUD!**\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `☁️ Found **${vercelCheck.wallets.length} wallets** in cloud backup!\n\n` +
                        `Your snipe wallets are now accessible!\n\n` +
                        `Use /wallets to view and manage them.`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
                    return;
                }
                // Show what wallets exist for this address locally
                const existingWallets = multiWallet_1.multiWallet.getWalletsForRecovery(walletAddress);
                if (existingWallets.length > 0) {
                    await this.bot.sendMessage(chatId, `❌ **Recovery code doesn't match**\n\n` +
                        `Found ${existingWallets.length} wallets linked to this ${recoveryType} address, but the last 4 characters don't match.\n\n` +
                        `💡 Try the last 4 chars of a different wallet's private key.\n\n` +
                        `Use /recover to try again.`, { parse_mode: 'Markdown' });
                }
                else {
                    await this.bot.sendMessage(chatId, `❌ **No wallets found**\n\n` +
                        `No snipe wallets are linked to this ${recoveryType} address (checked both local & cloud).\n\n` +
                        `💡 Try the other recovery option:\n` +
                        `• /recover → Choose different method\n\n` +
                        `Make sure you're using the correct wallet address.`, { parse_mode: 'Markdown' });
                }
            }
            return;
        }
        // Token address inputs - with full DEXScreener breakdown
        if (session.pendingAction === 'buy_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            // Fetch token info from DEXScreener
            await this.bot.sendMessage(chatId, '⏳ Fetching token data...');
            const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(text);
            // Get user's wallets with balances
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            let walletInfo = '';
            if (wallets.length > 0) {
                walletInfo = '\n\n👛 **Your Wallets:**\n';
                for (const w of wallets) {
                    const balPls = parseFloat(ethers_1.ethers.formatEther(w.balance));
                    const icon = w.isActive ? '✅' : '⬜';
                    walletInfo += `${icon} #${w.index} ${w.label}: **${(0, pnlCard_1.formatNumber)(balPls)} PLS**\n`;
                }
            }
            if (tokenInfo) {
                // Store token info in session for later use
                session.tokenInfo = tokenInfo;
                const msg = dexscreener_1.dexScreener.formatTokenInfo(tokenInfo) + walletInfo + `\n\n⚜️ _Select buy amount or set a limit order:_`;
                session.pendingAction = 'buy_amount';
                await this.bot.sendMessage(chatId, msg, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: keyboards.buyAmountKeyboard,
                });
            }
            else {
                // Token not found on DEXScreener, proceed anyway
                session.pendingAction = 'buy_amount';
                await this.bot.sendMessage(chatId, `📋 Token: \`${text}\`\n\n` +
                    `⚠️ _Token not found on DEXScreener. Proceed with caution._` + walletInfo + `\n\n💰 Select amount to buy:`, { parse_mode: 'Markdown', reply_markup: keyboards.buyAmountKeyboard });
            }
            return;
        }
        if (session.pendingAction === 'sell_token_address') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            // Fetch token info from DEXScreener
            await this.bot.sendMessage(chatId, '⏳ Fetching token data...');
            const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(text);
            // Get user's wallets with balances
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            let walletInfo = '';
            if (wallets.length > 0) {
                walletInfo = '\n\n👛 **Your Wallets:**\n';
                for (const w of wallets) {
                    const balPls = parseFloat(ethers_1.ethers.formatEther(w.balance));
                    const icon = w.isActive ? '✅' : '⬜';
                    walletInfo += `${icon} #${w.index} ${w.label}: **${(0, pnlCard_1.formatNumber)(balPls)} PLS**\n`;
                }
            }
            if (tokenInfo) {
                session.tokenInfo = tokenInfo;
                const msg = dexscreener_1.dexScreener.formatTokenInfo(tokenInfo) + walletInfo + `\n\n⚜️ _Select sell percentage or set a limit order:_`;
                session.pendingAction = 'sell_percent';
                await this.bot.sendMessage(chatId, msg, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    reply_markup: keyboards.sellPercentKeyboard,
                });
            }
            else {
                session.pendingAction = 'sell_percent';
                await this.bot.sendMessage(chatId, `📋 Token: \`${text}\`\n\n` +
                    `⚠️ _Token not found on DEXScreener._` + walletInfo + `\n\n📊 Select percentage to sell:`, { parse_mode: 'Markdown', reply_markup: keyboards.sellPercentKeyboard });
            }
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
        // Import wallet private key with optional label
        if (session.pendingAction === 'import_wallet_key') {
            // Parse input: "0x1234...abcd My Label" or just "0x1234...abcd"
            const parts = text.trim().split(/\s+/);
            const keyPart = parts[0];
            const labelPart = parts.slice(1).join(' ').slice(0, 20) || undefined; // Max 20 chars
            // Validate private key format (64 hex chars, optionally with 0x prefix)
            const cleanKey = keyPart.startsWith('0x') ? keyPart.slice(2) : keyPart;
            if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
                await this.bot.sendMessage(chatId, `❌ Invalid private key format.\n\n` +
                    `Must be 64 hex characters (with or without 0x prefix).\n\n` +
                    `Try again with: \`<private_key> <label>\``, { parse_mode: 'Markdown' });
                return;
            }
            try {
                // Get linked wallet address for this user
                const linkedWalletAddress = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
                // Import and save to multiWallet store
                const fullKey = keyPart.startsWith('0x') ? keyPart : `0x${keyPart}`;
                const importedWallet = multiWallet_1.multiWallet.importWallet(userId, fullKey, labelPart, linkedWalletAddress);
                session.pendingAction = undefined;
                await this.bot.sendMessage(chatId, `✅ **Wallet Imported & Saved!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `📍 **Address:**\n\`${importedWallet.address}\`\n\n` +
                    `🏷️ **Label:** ${importedWallet.label}\n` +
                    `🔢 **Index:** #${importedWallet.index}\n` +
                    `🔐 **Recovery Code:** \`${fullKey.slice(-4)}\`\n\n` +
                    `${linkedWalletAddress ? `🔗 Linked to: \`${linkedWalletAddress.slice(0, 10)}...\`` : '⚠️ Not linked to a gated wallet yet'}\n\n` +
                    `_Use /wallets to view all wallets or rename._`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            }
            catch (e) {
                await this.bot.sendMessage(chatId, '❌ Invalid private key. Try again:');
            }
            return;
        }
        // Rename wallet label
        if (session.pendingAction?.startsWith('rename_wallet_')) {
            const index = parseInt(session.pendingAction.replace('rename_wallet_', ''));
            const label = text.slice(0, 20); // Max 20 chars
            multiWallet_1.multiWallet.setWalletLabel(userId, index, label);
            session.pendingAction = undefined;
            await this.bot.sendMessage(chatId, `✅ **Wallet #${index} renamed to "${label}"**`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
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
            // Fetch token info to get current price
            await this.bot.sendMessage(chatId, '🔍 Fetching token price...');
            try {
                const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(text);
                if (tokenInfo) {
                    session.tokenInfo = tokenInfo;
                    const priceDisplay = tokenInfo.pricePls
                        ? `${tokenInfo.pricePls.toFixed(12)} PLS (~$${tokenInfo.priceUsd?.toFixed(8) || '?'})`
                        : 'Unknown';
                    session.pendingAction = 'limit_buy_price';
                    await this.bot.sendMessage(chatId, `📊 **LIMIT BUY - Set Target Price**\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `🪙 **${tokenInfo.symbol || 'Token'}**\n` +
                        `📋 \`${text.slice(0, 12)}...${text.slice(-8)}\`\n\n` +
                        `💵 **Current Price:** ${priceDisplay}\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `Enter your target buy price:\n\n` +
                        `• **Direct price:** \`0.00000001\`\n` +
                        `• **Percentage:** \`-5%\` or \`-10%\` (below current)\n\n` +
                        `_Order triggers when price drops to target._`, { parse_mode: 'Markdown' });
                }
                else {
                    session.pendingAction = 'limit_buy_price';
                    await this.bot.sendMessage(chatId, `⚠️ Could not fetch price data.\n\n` +
                        `📋 Token: \`${text.slice(0, 12)}...${text.slice(-8)}\`\n\n` +
                        `Enter target price in PLS directly:`, { parse_mode: 'Markdown' });
                }
            }
            catch (e) {
                session.pendingAction = 'limit_buy_price';
                await this.bot.sendMessage(chatId, `📊 Enter target price in PLS (buy when price drops to this):`);
            }
            return;
        }
        if (session.pendingAction === 'limit_sell_token') {
            if (!ethers_1.ethers.isAddress(text)) {
                await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
                return;
            }
            session.pendingToken = text;
            // Fetch token info to get current price
            await this.bot.sendMessage(chatId, '🔍 Fetching token price...');
            try {
                const tokenInfo = await dexscreener_1.dexScreener.getTokenInfo(text);
                if (tokenInfo) {
                    session.tokenInfo = tokenInfo;
                    const priceDisplay = tokenInfo.pricePls
                        ? `${tokenInfo.pricePls.toFixed(12)} PLS (~$${tokenInfo.priceUsd?.toFixed(8) || '?'})`
                        : 'Unknown';
                    session.pendingAction = 'limit_sell_price';
                    await this.bot.sendMessage(chatId, `📊 **LIMIT SELL - Set Target Price**\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `🪙 **${tokenInfo.symbol || 'Token'}**\n` +
                        `📋 \`${text.slice(0, 12)}...${text.slice(-8)}\`\n\n` +
                        `💵 **Current Price:** ${priceDisplay}\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `Enter your target sell price:\n\n` +
                        `• **Direct price:** \`0.00000005\`\n` +
                        `• **Percentage:** \`+50%\` or \`+100%\` (above current)\n\n` +
                        `_Order triggers when price rises to target._`, { parse_mode: 'Markdown' });
                }
                else {
                    session.pendingAction = 'limit_sell_price';
                    await this.bot.sendMessage(chatId, `⚠️ Could not fetch price data.\n\n` +
                        `📋 Token: \`${text.slice(0, 12)}...${text.slice(-8)}\`\n\n` +
                        `Enter target price in PLS directly:`, { parse_mode: 'Markdown' });
                }
            }
            catch (e) {
                session.pendingAction = 'limit_sell_price';
                await this.bot.sendMessage(chatId, `📊 Enter target price in PLS (sell when price rises to this):`);
            }
            return;
        }
        if (session.pendingAction === 'limit_buy_price') {
            let targetPrice;
            let currentPrice = session.tokenInfo?.pricePls || 0;
            // If no price data but we have token, try to re-fetch
            if (!currentPrice && session.pendingToken) {
                console.log(`[limit_buy_price] No cached price, re-fetching for ${session.pendingToken.slice(0, 10)}...`);
                try {
                    const freshInfo = await dexscreener_1.dexScreener.getTokenInfo(session.pendingToken);
                    if (freshInfo?.pricePls) {
                        currentPrice = freshInfo.pricePls;
                        session.tokenInfo = freshInfo;
                    }
                }
                catch (e) {
                    console.log('[limit_buy_price] Price fetch failed:', e);
                }
            }
            // Check if input is a percentage (e.g., -1%, -10%, -25%, 0.1%)
            if (text.includes('%')) {
                const percentMatch = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
                if (!percentMatch) {
                    await this.bot.sendMessage(chatId, `❌ Invalid percentage format.\n\n` +
                        `Examples: \`-10%\`, \`-5%\`, \`0.5%\`\n\n` +
                        `Try again or enter a direct price in PLS:`);
                    return;
                }
                if (!currentPrice) {
                    await this.bot.sendMessage(chatId, `❌ No price data available for percentage calculation.\n\n` +
                        `Please enter a direct price in PLS instead:\n` +
                        `Example: \`0.0000001\``);
                    return;
                }
                const percent = parseFloat(percentMatch[1]);
                // For limit BUY, negative % means buy BELOW current price
                // Positive % means buy ABOVE current (unusual but allowed)
                targetPrice = currentPrice * (1 + percent / 100);
                console.log(`[limit_buy_price] Percent: ${percent}%, Current: ${currentPrice}, Target: ${targetPrice}`);
            }
            else {
                targetPrice = parseFloat(text);
            }
            if (isNaN(targetPrice) || targetPrice <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid price. Try again with a number or percentage (e.g., -10%):');
                return;
            }
            session.pendingPrice = targetPrice.toString();
            session.pendingAction = 'limit_buy_amount';
            // Show confirmation with calculated price
            const priceMsg = currentPrice
                ? `\n📊 Current: ${currentPrice.toFixed(12)} PLS\n🎯 Target: ${targetPrice.toFixed(12)} PLS (${((targetPrice / currentPrice - 1) * 100).toFixed(1)}%)\n`
                : `\n🎯 Target: ${targetPrice.toFixed(12)} PLS\n`;
            await this.bot.sendMessage(chatId, `✅ **Target Price Set**${priceMsg}\n💰 Enter PLS amount to spend (per wallet):`, { parse_mode: 'Markdown' });
            return;
        }
        if (session.pendingAction === 'limit_buy_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            session.pendingAmount = amount.toString();
            session.pendingOrderType = 'limit_buy';
            // ALWAYS show wallet selection with balances
            let wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            // If no local wallets, try to recover from Vercel cloud backup
            if (wallets.length === 0) {
                console.log(`🔍 [LIMIT] No local wallets for ${userId}, trying Vercel recovery...`);
                const linkedWallet = session.linkedWallet;
                const recovery = await multiWallet_1.multiWallet.recoverFromVercel(userId, linkedWallet);
                if (recovery.recovered > 0) {
                    console.log(`✅ [LIMIT] Recovered ${recovery.recovered} wallets from Vercel for ${userId}`);
                    wallets = recovery.wallets;
                }
            }
            if (wallets.length === 0) {
                await this.bot.sendMessage(chatId, `❌ No wallets found!\n\nPlease generate wallets first using /wallets`, { parse_mode: 'Markdown' });
                return;
            }
            // Fetch balances for all wallets
            const walletsWithBalance = await Promise.all(wallets.map(async (w) => {
                try {
                    const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
                    const balance = await provider.getBalance(w.address);
                    const balancePls = parseFloat(ethers_1.ethers.formatEther(balance));
                    return {
                        ...w,
                        balance: balancePls,
                        balanceFormatted: balancePls >= 1000000
                            ? (balancePls / 1000000).toFixed(2) + 'M'
                            : balancePls >= 1000
                                ? (balancePls / 1000).toFixed(1) + 'K'
                                : balancePls.toFixed(0),
                        selected: w.isActive
                    };
                }
                catch {
                    return { ...w, balance: 0, balanceFormatted: '?', selected: w.isActive };
                }
            }));
            session.selectedWallets = walletsWithBalance.filter(w => w.selected).map(w => w.index);
            session.pendingAction = 'limit_order_wallets';
            // Build wallet list message with balances
            const walletListStr = walletsWithBalance.map(w => `${w.selected ? '🟢' : '⚪'} #${w.index} ${w.label || 'Wallet ' + w.index}: **${w.balanceFormatted} PLS**`).join('\n');
            await this.bot.sendMessage(chatId, `👛 **Select Wallet(s) for Limit Order**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📊 Order: **LIMIT BUY**\n` +
                `🪙 Token: \`${session.pendingToken?.slice(0, 12)}...\`\n` +
                `🎯 Target: ${parseFloat(session.pendingPrice).toFixed(12)} PLS\n` +
                `💵 Amount: ${amount.toLocaleString()} PLS per wallet\n\n` +
                `**Your Wallets:**\n${walletListStr}\n\n` +
                `_Tap wallets to toggle selection, then confirm:_`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.orderWalletSelectKeyboard(walletsWithBalance.map(w => ({
                    index: w.index,
                    label: `${w.label || 'W' + w.index} (${w.balanceFormatted})`,
                    isActive: w.isActive,
                    selected: w.selected
                })))
            });
            return;
        }
        // Limit sell price - supports percentages like +50%, +100%
        if (session.pendingAction === 'limit_sell_price') {
            let targetPrice;
            let currentPrice = session.tokenInfo?.pricePls || 0;
            // If no price data but we have token, try to re-fetch
            if (!currentPrice && session.pendingToken) {
                console.log(`[limit_sell_price] No cached price, re-fetching for ${session.pendingToken.slice(0, 10)}...`);
                try {
                    const freshInfo = await dexscreener_1.dexScreener.getTokenInfo(session.pendingToken);
                    if (freshInfo?.pricePls) {
                        currentPrice = freshInfo.pricePls;
                        session.tokenInfo = freshInfo;
                    }
                }
                catch (e) {
                    console.log('[limit_sell_price] Price fetch failed:', e);
                }
            }
            // Check if input is a percentage (e.g., +50%, +100%, +25%)
            if (text.includes('%')) {
                const percentMatch = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
                if (!percentMatch) {
                    await this.bot.sendMessage(chatId, `❌ Invalid percentage format.\n\n` +
                        `Examples: \`+50%\`, \`+100%\`, \`25%\`\n\n` +
                        `Try again or enter a direct price in PLS:`);
                    return;
                }
                if (!currentPrice) {
                    await this.bot.sendMessage(chatId, `❌ No price data available for percentage calculation.\n\n` +
                        `Please enter a direct price in PLS instead:\n` +
                        `Example: \`0.0000001\``);
                    return;
                }
                const percent = parseFloat(percentMatch[1]);
                // For limit SELL, positive % means sell ABOVE current price (take profit)
                targetPrice = currentPrice * (1 + percent / 100);
                console.log(`[limit_sell_price] Percent: ${percent}%, Current: ${currentPrice}, Target: ${targetPrice}`);
            }
            else {
                targetPrice = parseFloat(text);
            }
            if (isNaN(targetPrice) || targetPrice <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid price. Try again with a number or percentage (e.g., +50%):');
                return;
            }
            session.pendingPrice = targetPrice.toString();
            session.pendingAction = 'limit_sell_amount';
            // Show confirmation with calculated price
            const priceMsg = currentPrice
                ? `\n📊 Current: ${currentPrice.toFixed(12)} PLS\n🎯 Target: ${targetPrice.toFixed(12)} PLS (${((targetPrice / currentPrice - 1) * 100).toFixed(1)}%)\n`
                : `\n🎯 Target: ${targetPrice.toFixed(12)} PLS\n`;
            await this.bot.sendMessage(chatId, `✅ **Target Price Set**${priceMsg}\n💰 Enter token amount to sell (per wallet):`, { parse_mode: 'Markdown' });
            return;
        }
        // Handle limit sell price from active orders page (with orderId context)
        if (session.pendingAction === 'order_limit_sell_price') {
            let targetPrice;
            const currentPrice = session.tokenInfo?.pricePls || 0;
            // Support multipliers like 2x, 3x
            if (text.toLowerCase().includes('x')) {
                const multiplierMatch = text.match(/(\d+(?:\.\d+)?)\s*x/i);
                if (!multiplierMatch || !currentPrice) {
                    await this.bot.sendMessage(chatId, `❌ Invalid multiplier. Current price needed.\n\nTry: +50%, 2x, or a direct price`);
                    return;
                }
                const multiplier = parseFloat(multiplierMatch[1]);
                targetPrice = currentPrice * multiplier;
            }
            // Support percentages like +50%, +100%
            else if (text.includes('%')) {
                const percentMatch = text.match(/([+-]?\d+(?:\.\d+)?)\s*%/);
                if (!percentMatch || !currentPrice) {
                    await this.bot.sendMessage(chatId, `❌ Invalid percentage or no price data.\n\nCurrent: ${currentPrice ? currentPrice.toFixed(12) + ' PLS' : 'Unknown'}\n\nTry again:`);
                    return;
                }
                const percent = parseFloat(percentMatch[1]);
                targetPrice = currentPrice * (1 + percent / 100);
            }
            else {
                targetPrice = parseFloat(text);
            }
            if (isNaN(targetPrice) || targetPrice <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid price. Try: +50%, 2x, or direct price');
                return;
            }
            // Get the original order to link to
            const orderId = session.pendingOrderIdForSell;
            const activeOrders = jsonStore_1.TradeHistory.getActiveOrders(userId);
            const originalOrder = activeOrders.find(o => o.id === orderId);
            if (!originalOrder) {
                await this.bot.sendMessage(chatId, '❌ Original order not found.');
                session.pendingAction = undefined;
                return;
            }
            session.pendingPrice = targetPrice.toString();
            session.pendingAction = 'order_limit_sell_amount';
            // Calculate percentage change
            const priceMsg = currentPrice
                ? `📊 Current: ${currentPrice.toFixed(12)} PLS\n🎯 Target: ${targetPrice.toFixed(12)} PLS (${((targetPrice / currentPrice - 1) * 100).toFixed(1)}%)`
                : `🎯 Target: ${targetPrice.toFixed(12)} PLS`;
            await this.bot.sendMessage(chatId, `✅ **Sell Target Set!**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🪙 Token: **${originalOrder.tokenSymbol || 'TOKEN'}**\n` +
                `${priceMsg}\n\n` +
                `💰 Enter token amount to sell (or "all" for 100%):`, { parse_mode: 'Markdown' });
            return;
        }
        // Handle limit sell amount from active orders page
        if (session.pendingAction === 'order_limit_sell_amount') {
            let amount;
            const text_lower = text.toLowerCase().trim();
            if (text_lower === 'all' || text_lower === '100%' || text_lower === 'max') {
                // TODO: Get actual token balance - for now use a placeholder
                amount = 0; // Will be handled as "sell all" in the order
                session.sellAll = true;
            }
            else {
                amount = parseFloat(text);
                session.sellAll = false;
            }
            if (text_lower !== 'all' && text_lower !== '100%' && text_lower !== 'max' && (isNaN(amount) || amount <= 0)) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Enter a number or "all":');
                return;
            }
            const orderId = session.pendingOrderIdForSell;
            const tokenAddress = session.pendingToken;
            const targetPrice = parseFloat(session.pendingPrice);
            const currentPrice = session.tokenInfo?.pricePls || 0;
            // Get original order info
            const activeOrders = jsonStore_1.TradeHistory.getActiveOrders(userId);
            const originalOrder = activeOrders.find(o => o.id === orderId);
            const tokenSymbol = originalOrder?.tokenSymbol || 'TOKEN';
            // Create the limit sell order
            const wallet = await wallet_1.walletManager.getWallet(userId);
            if (!wallet) {
                await this.bot.sendMessage(chatId, '❌ No wallet found.');
                return;
            }
            try {
                const order = await limitOrder_1.limitOrderEngine.createOrder({
                    userId,
                    walletAddress: wallet.address,
                    tokenAddress,
                    orderType: 'limit_sell',
                    targetPrice: ethers_1.ethers.parseEther(targetPrice.toString()),
                    amount: session.sellAll ? BigInt(0) : ethers_1.ethers.parseEther(amount.toString()),
                    slippage: session.settings.slippage,
                });
                // Log to trade history
                jsonStore_1.TradeHistory.logLimitOrder(userId, chatId, 'limit_sell', tokenAddress, tokenSymbol, session.sellAll ? 'ALL' : amount.toString(), targetPrice.toString(), orderId // Link to original buy order
                );
                // Clear session
                session.pendingAction = undefined;
                session.pendingOrderIdForSell = undefined;
                session.pendingToken = undefined;
                session.pendingPrice = undefined;
                session.sellAll = undefined;
                // Show receipt
                const priceChange = currentPrice ? ((targetPrice / currentPrice - 1) * 100).toFixed(1) : '?';
                await this.bot.sendMessage(chatId, `╔══════════════════════════════╗\n` +
                    `║  🔴 **LIMIT SELL SET!**       ║\n` +
                    `╠══════════════════════════════╣\n\n` +
                    `🪙 **Token:** ${tokenSymbol}\n` +
                    `📍 \`${tokenAddress.slice(0, 12)}...${tokenAddress.slice(-8)}\`\n\n` +
                    `━━━ **Price Target** ━━━\n` +
                    `${currentPrice ? `📈 Current: ${currentPrice.toFixed(12)} PLS\n` : ''}` +
                    `🎯 Sell At: **${targetPrice.toFixed(12)} PLS**\n` +
                    `📊 Change: **${priceChange}%**\n\n` +
                    `━━━ **Order Details** ━━━\n` +
                    `💰 Amount: **${session.sellAll ? 'ALL' : amount.toLocaleString()}**\n` +
                    `🆔 Order: \`${order.id}\`\n` +
                    `🔗 Linked to: \`${orderId?.slice(0, 15)}...\`\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `✅ **Watching for target!** 👁️`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📋 View Active Orders', callback_data: 'orders_active' }],
                            [{ text: '📊 P&L Card', callback_data: 'pnl_card' }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                        ]
                    }
                });
            }
            catch (e) {
                console.error('Failed to create limit sell:', e);
                await this.bot.sendMessage(chatId, '❌ Failed to create limit sell order. Try again.');
            }
            return;
        }
        if (session.pendingAction === 'limit_sell_amount') {
            const amount = parseFloat(text);
            if (isNaN(amount) || amount <= 0) {
                await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
                return;
            }
            session.pendingAmount = amount.toString();
            session.pendingOrderType = 'limit_sell';
            // ALWAYS show wallet selection with balances
            let wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            // If no local wallets, try to recover from Vercel cloud backup
            if (wallets.length === 0) {
                console.log(`🔍 [LIMIT] No local wallets for ${userId}, trying Vercel recovery...`);
                const linkedWallet = session.linkedWallet;
                const recovery = await multiWallet_1.multiWallet.recoverFromVercel(userId, linkedWallet);
                if (recovery.recovered > 0) {
                    console.log(`✅ [LIMIT] Recovered ${recovery.recovered} wallets from Vercel for ${userId}`);
                    wallets = recovery.wallets;
                }
            }
            if (wallets.length === 0) {
                await this.bot.sendMessage(chatId, `❌ No wallets found!\n\nPlease generate wallets first using /wallets`, { parse_mode: 'Markdown' });
                return;
            }
            // Fetch PLS balances for all wallets
            const walletsWithBalance = await Promise.all(wallets.map(async (w) => {
                try {
                    const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
                    const balance = await provider.getBalance(w.address);
                    const balancePls = parseFloat(ethers_1.ethers.formatEther(balance));
                    return {
                        ...w,
                        balance: balancePls,
                        balanceFormatted: balancePls >= 1000000
                            ? (balancePls / 1000000).toFixed(2) + 'M'
                            : balancePls >= 1000
                                ? (balancePls / 1000).toFixed(1) + 'K'
                                : balancePls.toFixed(0),
                        selected: w.isActive
                    };
                }
                catch {
                    return { ...w, balance: 0, balanceFormatted: '?', selected: w.isActive };
                }
            }));
            session.selectedWallets = walletsWithBalance.filter(w => w.selected).map(w => w.index);
            session.pendingAction = 'limit_order_wallets';
            // Build wallet list message with balances
            const walletListStr = walletsWithBalance.map(w => `${w.selected ? '🟢' : '⚪'} #${w.index} ${w.label || 'Wallet ' + w.index}: **${w.balanceFormatted} PLS**`).join('\n');
            await this.bot.sendMessage(chatId, `👛 **Select Wallet(s) for Limit Order**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📊 Order: **LIMIT SELL**\n` +
                `🪙 Token: \`${session.pendingToken?.slice(0, 12)}...\`\n` +
                `🎯 Target: ${parseFloat(session.pendingPrice).toFixed(12)} PLS\n` +
                `💵 Amount: ${amount.toLocaleString()} tokens per wallet\n\n` +
                `**Your Wallets:**\n${walletListStr}\n\n` +
                `_Tap wallets to toggle selection, then confirm:_`, {
                parse_mode: 'Markdown',
                reply_markup: keyboards.orderWalletSelectKeyboard(walletsWithBalance.map(w => ({
                    index: w.index,
                    label: `${w.label || 'W' + w.index} (${w.balanceFormatted})`,
                    isActive: w.isActive,
                    selected: w.selected
                })))
            });
            return;
        }
        // Custom sell percentage
        if (session.pendingAction === 'sell_custom_percent') {
            const percent = parseFloat(text);
            if (isNaN(percent) || percent <= 0 || percent > 100) {
                await this.bot.sendMessage(chatId, '❌ Invalid percentage. Enter 1-100:');
                return;
            }
            session.pendingAction = undefined;
            await this.executeSell(chatId, userId, Math.floor(percent));
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
        msg += `_Last updated: ${formatTime()}_`;
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
     * Links wallets to the user's gated wallet for recovery
     */
    async generate6Wallets(chatId, userId) {
        await this.bot.sendMessage(chatId, '🔄 Generating 6 snipe wallets...');
        // Get linked/gated wallet address
        const session = this.getSession(chatId);
        const linkedWalletAddress = session.linkedWallet || jsonStore_1.LinkedWallets.getAddress(userId);
        // Check if user already has wallets
        const existingCount = multiWallet_1.multiWallet.getUserWalletCount(userId);
        if (existingCount >= 6) {
            await this.bot.sendMessage(chatId, `⚠️ You already have 6 wallets generated!\n\nUse /wallets to view them.`, { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard });
            return;
        }
        // Generate wallets linked to gated wallet
        const newWallets = await multiWallet_1.multiWallet.generateWallets(userId, linkedWalletAddress);
        // Get private keys for display
        const wallets = [];
        for (const w of newWallets) {
            const pk = multiWallet_1.multiWallet.exportPrivateKey(userId, w.index);
            if (pk) {
                wallets.push({
                    index: w.index,
                    address: w.address,
                    privateKey: pk,
                    keyLast4: pk.slice(-4),
                });
            }
        }
        // Send header message
        let headerMsg = `✅ **6 SNIPE WALLETS GENERATED** ⚜️\n`;
        headerMsg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        if (linkedWalletAddress) {
            headerMsg += `🔗 **Linked to:** \`${linkedWalletAddress.slice(0, 10)}...${linkedWalletAddress.slice(-6)}\`\n\n`;
        }
        headerMsg += `⚠️ **KEEP THESE PRIVATE KEYS SAFE!**\n`;
        headerMsg += `_Anyone with your key can access your funds._\n\n`;
        await this.bot.sendMessage(chatId, headerMsg, { parse_mode: 'Markdown' });
        // Send each wallet separately for easy copying
        for (const w of wallets) {
            const walletMsg = `**━━━ SNIPER ${w.index} ━━━**\n\n` +
                `📍 **Address:**\n\`${w.address}\`\n\n` +
                `🔑 **Private Key:**\n\`${w.privateKey}\`\n\n` +
                `🔐 **Recovery Code:** \`${w.keyLast4}\`\n`;
            await this.bot.sendMessage(chatId, walletMsg, { parse_mode: 'Markdown' });
        }
        // Send footer with tips and recovery info
        let footerMsg = `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        footerMsg += `💡 **Tips:**\n`;
        footerMsg += `• Send PLS to each wallet you want to snipe with\n`;
        footerMsg += `• Use 🎯 Sniper to multi-wallet snipe!\n`;
        footerMsg += `• Import keys into MetaMask/Rabby for backup\n\n`;
        footerMsg += `🔐 **WALLET RECOVERY:**\n`;
        footerMsg += `_If you lose access, use /recover with:_\n`;
        footerMsg += `• Your gated wallet address\n`;
        footerMsg += `• Last 4 chars of any private key\n\n`;
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
     * Show all wallet balances (FIXED: Uses multiWallet system, shows DTGC + pending orders)
     */
    async showWalletBalances(chatId, userId) {
        await this.bot.sendMessage(chatId, '💰 Fetching wallet balances...');
        const session = this.getSession(chatId);
        const DTGC_TOKEN = config_1.config.tokenGate.dtgc;
        // Get pending orders count per wallet
        const pendingOrders = jsonStore_1.SnipeOrders.getPending(userId);
        const ordersByWallet = {};
        for (const order of pendingOrders) {
            const addr = order.walletAddress?.toLowerCase() || '';
            ordersByWallet[addr] = (ordersByWallet[addr] || 0) + 1;
        }
        let msg = `💰 **WALLET BALANCES** ⚜️\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        // ═══════════════════════════════════════════════════════════════
        // GOLD GATE WALLET (Linked Wallet with $50 DTGC)
        // ═══════════════════════════════════════════════════════════════
        if (session.linkedWallet) {
            try {
                const { formatted: plsBal } = await wallet_1.walletManager.getPlsBalance(session.linkedWallet);
                const { balanceFormatted: dtgcBal } = await wallet_1.walletManager.getTokenBalance(session.linkedWallet, DTGC_TOKEN);
                const orders = ordersByWallet[session.linkedWallet.toLowerCase()] || 0;
                msg += `🔗 **Gold Gate Wallet**\n`;
                msg += `\`${session.linkedWallet.slice(0, 10)}...${session.linkedWallet.slice(-6)}\`\n`;
                msg += `💎 ${parseFloat(plsBal).toLocaleString(undefined, { maximumFractionDigits: 0 })} PLS\n`;
                msg += `🪙 ${parseFloat(dtgcBal).toLocaleString(undefined, { maximumFractionDigits: 0 })} DTGC\n`;
                if (orders > 0)
                    msg += `📋 ${orders} pending order${orders > 1 ? 's' : ''}\n`;
                msg += `\n`;
            }
            catch (e) {
                console.log('[Balances] Gold wallet error:', e);
            }
        }
        // ═══════════════════════════════════════════════════════════════
        // SNIPE WALLETS (from multiWallet system - the CORRECT wallets)
        // ═══════════════════════════════════════════════════════════════
        try {
            const snipeWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            if (snipeWallets.length === 0) {
                msg += `⚠️ No snipe wallets found.\n`;
                msg += `Use "Generate 6 New" to create wallets.\n\n`;
            }
            else {
                for (const w of snipeWallets) {
                    try {
                        const { formatted: plsBal } = await wallet_1.walletManager.getPlsBalance(w.address);
                        const { balanceFormatted: dtgcBal } = await wallet_1.walletManager.getTokenBalance(w.address, DTGC_TOKEN);
                        const orders = ordersByWallet[w.address.toLowerCase()] || 0;
                        const activeIcon = w.isActive ? '✅' : '⬜';
                        msg += `${activeIcon} **${w.label || `Snipe W${w.index}`}**\n`;
                        msg += `\`${w.address.slice(0, 10)}...${w.address.slice(-6)}\`\n`;
                        msg += `💎 ${parseFloat(plsBal).toLocaleString(undefined, { maximumFractionDigits: 0 })} PLS`;
                        const dtgcNum = parseFloat(dtgcBal);
                        if (dtgcNum > 0) {
                            msg += ` | 🪙 ${dtgcNum.toLocaleString(undefined, { maximumFractionDigits: 0 })} DTGC`;
                        }
                        if (orders > 0) {
                            msg += ` | 📋 ${orders}`;
                        }
                        msg += `\n\n`;
                    }
                    catch (e) {
                        msg += `🎯 **${w.label || `Snipe W${w.index}`}** - ⚠️ Error\n\n`;
                    }
                }
            }
        }
        catch (e) {
            console.log('[Balances] Snipe wallets error:', e);
            msg += `⚠️ Could not load snipe wallets\n\n`;
        }
        // Summary
        const totalOrders = pendingOrders.length;
        if (totalOrders > 0) {
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `📊 **${totalOrders} total pending order${totalOrders > 1 ? 's' : ''}**\n`;
        }
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.walletsMenuKeyboard,
        });
    }
    /**
     * Show all wallet addresses (quick view) - FIXED: Uses multiWallet system
     */
    async showAllWalletAddresses(chatId, userId) {
        const session = this.getSession(chatId);
        let msg = `📋 **ALL WALLET ADDRESSES** ⚜️\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        // Gold Gate Wallet (Linked wallet)
        if (session.linkedWallet) {
            msg += `🔗 **Gold Gate:** \`${session.linkedWallet}\`\n\n`;
        }
        // Snipe wallets from multiWallet system (CORRECT wallets)
        try {
            const snipeWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            if (snipeWallets.length === 0) {
                msg += `⚠️ No snipe wallets. Use "Generate 6 New".\n`;
            }
            else {
                for (const w of snipeWallets) {
                    const activeIcon = w.isActive ? '✅' : '⬜';
                    msg += `${activeIcon} **${w.label || `W${w.index}`}:** \`${w.address}\`\n`;
                }
            }
        }
        catch (e) {
            msg += `⚠️ Could not load wallets\n`;
        }
        msg += `\n_Tap address to copy, send PLS to fund._`;
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
            // Create snipe order ticket with auto take-profit if configured
            const orderId = `SNP-${Date.now().toString(36).toUpperCase()}`;
            const hasTakeProfit = !!(session.settings.defaultTakeProfit && session.settings.defaultTakeProfit > 0);
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
                // Auto take-profit settings (if configured)
                takeProfitEnabled: hasTakeProfit,
                takeProfitPercent: session.settings.defaultTakeProfit,
                sellPercent: session.settings.defaultSellPercent || (hasTakeProfit && session.settings.defaultTakeProfit >= 100 ? 50 : 100),
                takeProfitStatus: hasTakeProfit ? 'active' : undefined,
            };
            // Store the order in session (for quick access)
            session.snipeOrders.push(snipeOrder);
            // 💾 PERSIST to disk (survives bot restarts!)
            jsonStore_1.SnipeOrders.create({
                vistoId: userId,
                chatId: chatId,
                tokenAddress,
                tokenName: snipeOrder.tokenName,
                tokenSymbol: snipeOrder.tokenSymbol,
                walletId,
                walletAddress,
                amountPls: plsAmount.toString(),
                gasPriority,
                gasGwei,
                takeProfitEnabled: hasTakeProfit,
                takeProfitPercent: snipeOrder.takeProfitPercent,
                sellPercent: snipeOrder.sellPercent,
            });
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
            // Take profit info for receipt
            const tpInfo = hasTakeProfit
                ? `\n━━━ TAKE PROFIT ━━━\n` +
                    `🎯 Trigger: **+${snipeOrder.takeProfitPercent}%** (${((100 + (snipeOrder.takeProfitPercent || 0)) / 100).toFixed(1)}x)\n` +
                    `💰 Sell: ${snipeOrder.sellPercent}% of tokens\n`
                : '';
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
                `🔧 Slippage: ${session.settings.slippage}%\n` +
                tpInfo +
                `\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `⚜️ **Auto-executes when token graduates to PulseX!**` +
                (hasTakeProfit ? `\n📈 **Auto take-profit will trigger at +${snipeOrder.takeProfitPercent}%!**` : `\n\n💡 Set a **Limit Bond Sell** below to auto-take profit!`);
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
⚜️ **DTRADER SNIPER Help**

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
            // ═══════════════════════════════════════════════════════════════
            // FIXED: Use multiWallet system (correct wallets) instead of old walletManager
            // ═══════════════════════════════════════════════════════════════
            const userWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const activeWallet = userWallets.find(w => w.isActive) || userWallets[0];
            if (!activeWallet) {
                console.log(`❌ No snipe wallet found for user ${userId}`);
                await this.bot.sendMessage(chatId, `❌ **Snipe Failed**\n\nNo snipe wallet found. Generate wallets first with /wallets → Generate 6 New.`, { parse_mode: 'Markdown' });
                return;
            }
            // Get the wallet signer
            const wallet = await multiWallet_1.multiWallet.getWalletSigner(userId, activeWallet.index);
            if (!wallet) {
                console.log(`❌ Could not get signer for wallet ${activeWallet.index}`);
                await this.bot.sendMessage(chatId, `❌ **Snipe Failed**\n\nCould not access wallet ${activeWallet.label}.`, { parse_mode: 'Markdown' });
                return;
            }
            // Notify user that snipe is executing
            await this.bot.sendMessage(chatId, `🚀 **EXECUTING SNIPE!**\n\n` +
                `🎓 Token graduated to PulseX!\n` +
                `📋 \`${tokenAddress.slice(0, 12)}...${tokenAddress.slice(-8)}\`\n` +
                `👛 Using: **${activeWallet.label}**\n\n` +
                `⏳ Buying now...`, { parse_mode: 'Markdown' });
            try {
                // Execute the buy using the correct snipe wallet
                const result = await pulsex_1.pulsex.executeBuy(wallet, tokenAddress, amountPls || BigInt(0), slippage || 15, // Higher default slippage for graduation snipes
                gasLimit || 500000);
                // Update order status
                const session = this.getSession(chatId);
                const order = session.snipeOrders.find(o => o.id === orderId);
                if (order) {
                    order.status = 'filled';
                    order.filledAt = Date.now();
                    order.txHash = result.txHash;
                    order.tokensReceived = result.amountOut || '0';
                }
                // Get pair info if available
                const pairAddress = pairInfo?.pairAddress || 'Check PulseX';
                // 🎉 VICTORY NOTIFICATION - Send celebration message with Take Profit option
                await this.bot.sendMessage(chatId, `🏆🎊 **SNIPE VICTORY!** 🎊🏆\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `⚜️ **DTRADER SNIPER STRIKES!** ⚜️\n\n` +
                    `🎓 **Token Graduated & Sniped!**\n\n` +
                    `📋 **Token CA:**\n\`${tokenAddress}\`\n\n` +
                    `🔗 **NEW PulseX Pair:**\n\`${pairAddress}\`\n\n` +
                    `💰 **Invested:** ${ethers_1.ethers.formatEther(amountPls || BigInt(0))} PLS\n` +
                    `🪙 **Tokens:** ${result.amountOut || 'Pending...'}\n\n` +
                    `🔗 [View TX](https://scan.pulsechain.com/tx/${result.txHash})\n` +
                    `📊 [Trade on PulseX](https://app.pulsex.com/swap?outputCurrency=${tokenAddress})\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━━\n` +
                    `💡 **Set a Take Profit** to auto-sell at target %!\n` +
                    `_Secure gains & recover initial investment._`, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📈 SET TAKE PROFIT (Auto-Sell)', callback_data: `set_tp_${orderId}` }],
                            [{ text: '🔴 Quick Sell 50%', callback_data: `quick_sell_${tokenAddress}` }],
                            [{ text: '📊 P&L Card', callback_data: 'generate_pnl_card' }, { text: '📋 Orders', callback_data: 'snipe_list' }],
                            [{ text: '🎯 Snipe Another', callback_data: 'pump_near_grad' }],
                            [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                        ],
                    },
                });
                // 🎨 Generate and send Victory Card
                try {
                    const victoryData = {
                        type: 'instabond',
                        tokenSymbol: order?.tokenSymbol || 'TOKEN',
                        tokenAddress,
                        amountPls: parseFloat(ethers_1.ethers.formatEther(amountPls || BigInt(0))),
                        tokensReceived: parseFloat(result.amountOut || '0'),
                        pairAddress,
                        txHash: result.txHash,
                    };
                    if ((0, pnlCard_1.canGenerateImages)()) {
                        const cardBuffer = await (0, pnlCard_1.generateVictoryCard)(victoryData);
                        await this.bot.sendPhoto(chatId, cardBuffer, {
                            caption: '🏆 **Victory Card** - Share your win! _This is the way._',
                            parse_mode: 'Markdown',
                        });
                    }
                    else {
                        // Fallback to text card
                        const textCard = (0, pnlCard_1.generateVictoryTextCard)(victoryData);
                        await this.bot.sendMessage(chatId, textCard, { parse_mode: 'Markdown' });
                    }
                }
                catch (cardError) {
                    console.log('Could not generate victory card:', cardError);
                    // Send sticker as fallback
                    try {
                        await this.bot.sendSticker(chatId, 'CAACAgIAAxkBAAEBBQZj9Z-xT0UAAe_qAAGzNl8HNlDjlxAAAj8AA0G1Vg7TZwq7GwABAdQfBA');
                    }
                    catch {
                        await this.bot.sendMessage(chatId, '🏆🎉🚀');
                    }
                }
                // Trade is already logged via the order tracking system
                console.log(`📝 InstaBond snipe completed: ${orderId}, tx: ${result.txHash}, pair: ${pairAddress}`);
                // 🎯 AUTO TAKE-PROFIT: Create limit sell order if configured
                if (order?.takeProfitEnabled && order.takeProfitPercent && order.takeProfitPercent > 0) {
                    try {
                        // Get current price as entry price using limit order engine
                        const priceData = await limitOrder_1.limitOrderEngine.getTokenPrice(tokenAddress);
                        if (priceData && result.amountOut) {
                            const entryPrice = priceData.priceInPls || BigInt(0);
                            const targetPrice = entryPrice + (entryPrice * BigInt(order.takeProfitPercent) / BigInt(100));
                            const sellAmount = BigInt(Math.floor(parseFloat(result.amountOut) * (order.sellPercent || 100) / 100));
                            // Create limit sell order for take profit
                            const tpOrder = await limitOrder_1.limitOrderEngine.createOrder({
                                userId,
                                walletAddress: wallet.address,
                                tokenAddress,
                                orderType: 'take_profit',
                                targetPrice,
                                amount: sellAmount,
                                slippage: session.settings.slippage,
                            });
                            console.log(`🎯 Auto Take-Profit created: ${tpOrder.id} at +${order.takeProfitPercent}%`);
                            await this.bot.sendMessage(chatId, `📈 **Auto Take-Profit Set!**\n\n` +
                                `🎯 Trigger: +${order.takeProfitPercent}% (${((order.takeProfitPercent + 100) / 100).toFixed(1)}x)\n` +
                                `💰 Sell: ${order.sellPercent || 100}% of tokens\n` +
                                `🆔 Order: \`${tpOrder.id}\`\n\n` +
                                `_Will auto-sell when price reaches target!_`, { parse_mode: 'Markdown' });
                        }
                    }
                    catch (tpError) {
                        console.error('Failed to create auto take-profit:', tpError);
                    }
                }
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
        // Mempool sniper events - FIXED: Use multiWallet system
        mempool_1.mempoolSniper.on('executeSnipe', async (data) => {
            const { target, pairInfo } = data;
            // Get user's snipe wallet from multiWallet (correct system)
            const userWallets = await multiWallet_1.multiWallet.getUserWallets(target.userId);
            const activeWallet = userWallets.find(w => w.isActive) || userWallets[0];
            if (!activeWallet)
                return;
            const wallet = await multiWallet_1.multiWallet.getWalletSigner(target.userId, activeWallet.index);
            if (!wallet)
                return;
            const result = await pulsex_1.pulsex.executeBuy(wallet, target.tokenAddress, target.amountPls, target.slippage, 500000);
            // Find user's chat
            for (const [chatId, session] of this.sessions) {
                if (session.gateVerified) {
                    const chatWallets = await multiWallet_1.multiWallet.getUserWallets(chatId);
                    const chatActiveWallet = chatWallets.find(w => w.isActive) || chatWallets[0];
                    if (chatActiveWallet?.address === activeWallet.address) {
                        if (result.success) {
                            await this.bot.sendMessage(chatId, `🎯 **SNIPE EXECUTED!**\n\n` +
                                `Token: \`${target.tokenAddress}\`\n` +
                                `Spent: ${result.amountIn} PLS\n` +
                                `Got: ${result.amountOut} tokens\n\n` +
                                `🔗 [TX](${config_1.config.explorerUrl}/tx/${result.txHash})`, { parse_mode: 'Markdown' });
                            // 🎨 Generate and send Victory Card
                            try {
                                const victoryData = {
                                    type: 'snipe',
                                    tokenSymbol: 'NEW',
                                    tokenAddress: target.tokenAddress,
                                    amountPls: parseFloat(ethers_1.ethers.formatEther(target.amountPls)),
                                    tokensReceived: result.amountOut ? parseFloat(result.amountOut) : undefined,
                                    txHash: result.txHash,
                                };
                                if ((0, pnlCard_1.canGenerateImages)()) {
                                    const cardBuffer = await (0, pnlCard_1.generateVictoryCard)(victoryData);
                                    await this.bot.sendPhoto(chatId, cardBuffer, {
                                        caption: '🏆 **Snipe Victory** - First in! _This is the way._',
                                        parse_mode: 'Markdown',
                                    });
                                }
                            }
                            catch (cardError) {
                                console.log('Could not generate victory card for mempool snipe:', cardError);
                            }
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
            console.log(`🎯 [LIMIT ORDER] Triggered: ${order.orderType} for ${order.tokenAddress.slice(0, 12)}...`);
            console.log(`   Target: ${ethers_1.ethers.formatEther(BigInt(order.targetPrice))} PLS`);
            console.log(`   Current: ${ethers_1.ethers.formatEther(priceData.priceInPls)} PLS`);
            console.log(`   Wallet: ${order.walletAddress}`);
            console.log(`   Amount: ${ethers_1.ethers.formatEther(BigInt(order.amount))} PLS`);
            // Get the correct wallet signer - use the wallet address stored in the order
            // First try multi-wallet, then fall back to main wallet
            let walletSigner = null;
            // Try to find the wallet in multi-wallet by address
            const userWallets = await multiWallet_1.multiWallet.getUserWallets(order.userId);
            const matchingWallet = userWallets.find(w => w.address.toLowerCase() === order.walletAddress.toLowerCase());
            if (matchingWallet) {
                walletSigner = await multiWallet_1.multiWallet.getWalletSigner(order.userId, matchingWallet.index);
                console.log(`   Using multi-wallet #${matchingWallet.index}: ${matchingWallet.address.slice(0, 12)}...`);
            }
            // Fall back to main bot wallet if multi-wallet not found
            if (!walletSigner) {
                const mainWallet = await wallet_1.walletManager.getWallet(order.userId);
                if (mainWallet && mainWallet.address.toLowerCase() === order.walletAddress.toLowerCase()) {
                    walletSigner = mainWallet;
                    console.log(`   Using main bot wallet: ${mainWallet.address.slice(0, 12)}...`);
                }
            }
            if (!walletSigner) {
                console.error(`❌ [LIMIT ORDER] Wallet not found for order ${order.id}! Address: ${order.walletAddress}`);
                limitOrder_1.limitOrderEngine.markOrderFailed(order.id, 'Wallet not found');
                return;
            }
            // Find the chat ID for this user
            let userChatId = null;
            for (const [chatId, session] of this.sessions) {
                if (session.linkedWallet === walletSigner.address || chatId === order.userId) {
                    userChatId = chatId;
                    break;
                }
            }
            // Also try using userId directly as chatId (common pattern)
            if (!userChatId) {
                userChatId = order.userId;
            }
            // Notify user that order is triggering
            if (userChatId) {
                await this.bot.sendMessage(userChatId, `⚡ **LIMIT ORDER TRIGGERED!**\n\n` +
                    `📊 ${order.orderType.replace('_', ' ').toUpperCase()}\n` +
                    `🪙 Token: \`${order.tokenAddress.slice(0, 12)}...\`\n` +
                    `💰 Target hit: ${ethers_1.ethers.formatEther(BigInt(order.targetPrice))} PLS\n` +
                    `📈 Current: ${ethers_1.ethers.formatEther(priceData.priceInPls)} PLS\n\n` +
                    `⏳ Executing trade with wallet ${order.walletAddress.slice(0, 8)}...`, { parse_mode: 'Markdown' });
            }
            let result;
            try {
                if (order.orderType === 'limit_buy') {
                    console.log(`   Executing BUY: ${ethers_1.ethers.formatEther(BigInt(order.amount))} PLS for token`);
                    result = await pulsex_1.pulsex.executeBuy(walletSigner, order.tokenAddress, BigInt(order.amount), order.slippage, 500000);
                }
                else {
                    console.log(`   Executing SELL: ${ethers_1.ethers.formatEther(BigInt(order.amount))} tokens for PLS`);
                    result = await pulsex_1.pulsex.executeSell(walletSigner, order.tokenAddress, BigInt(order.amount), order.slippage, 500000);
                }
            }
            catch (execError) {
                console.error(`❌ [LIMIT ORDER] Execution error:`, execError);
                limitOrder_1.limitOrderEngine.markOrderFailed(order.id, String(execError));
                if (userChatId) {
                    await this.bot.sendMessage(userChatId, `❌ **Limit order failed!**\n\nError: ${String(execError).slice(0, 200)}`, { parse_mode: 'Markdown' });
                }
                return;
            }
            if (result.success) {
                limitOrder_1.limitOrderEngine.markOrderFilled(order.id, result.txHash);
                // 🏆 VICTORY NOTIFICATION with P&L Card
                if (userChatId) {
                    const typeEmoji = order.orderType === 'limit_buy' ? '🟢' :
                        order.orderType === 'limit_sell' ? '🔴' :
                            order.orderType === 'take_profit' ? '💰' : '🛑';
                    await this.bot.sendMessage(userChatId, `🏆🎊 **LIMIT ORDER VICTORY!** 🎊🏆\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                        `⚜️ **MANDO BOT EXECUTED!** ⚜️\n\n` +
                        `${typeEmoji} **${order.orderType.replace('_', ' ').toUpperCase()}**\n\n` +
                        `📋 **Token:**\n\`${order.tokenAddress}\`\n\n` +
                        `💰 **Trade:**\n` +
                        `${result.amountIn} → ${result.amountOut}\n\n` +
                        `${result.feeCollected ? `🔥 **DTGC Burned:** ${result.dtgcBurned}\n\n` : ''}` +
                        `🔗 [View TX on PulseScan](${config_1.config.explorerUrl}/tx/${result.txHash})\n` +
                        `📊 [View on PulseX](https://app.pulsex.com/swap?outputCurrency=${order.tokenAddress})\n\n` +
                        `━━━━━━━━━━━━━━━━━━━━━\n` +
                        `_Your limit order hit the target! 🎯_`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📊 Generate P&L Card', callback_data: 'generate_pnl_card' }],
                                [{ text: '📋 My Orders', callback_data: 'order_list' }],
                                [{ text: '🎯 New Order', callback_data: 'orders_menu' }],
                                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                            ],
                        },
                    });
                    // 🎨 Generate and send Victory Card
                    try {
                        const victoryData = {
                            type: order.orderType,
                            tokenSymbol: order.tokenSymbol || 'TOKEN',
                            tokenAddress: order.tokenAddress,
                            amountPls: parseFloat(ethers_1.ethers.formatEther(BigInt(order.amount))),
                            tokensReceived: result.amountOut ? parseFloat(result.amountOut) : undefined,
                            txHash: result.txHash,
                        };
                        if ((0, pnlCard_1.canGenerateImages)()) {
                            const cardBuffer = await (0, pnlCard_1.generateVictoryCard)(victoryData);
                            await this.bot.sendPhoto(userChatId, cardBuffer, {
                                caption: '🏆 **Victory Card** - Share your win! _This is the way._',
                                parse_mode: 'Markdown',
                            });
                        }
                        else {
                            // Fallback to text card
                            const textCard = (0, pnlCard_1.generateVictoryTextCard)(victoryData);
                            await this.bot.sendMessage(userChatId, textCard, { parse_mode: 'Markdown' });
                        }
                    }
                    catch (cardError) {
                        console.log('Could not generate victory card for limit order:', cardError);
                        // Fallback to sticker
                        try {
                            await this.bot.sendSticker(userChatId, 'CAACAgIAAxkBAAEBBQZj9Z-xT0UAAe_qAAGzNl8HNlDjlxAAAj8AA0G1Vg7TZwq7GwABAdQfBA');
                        }
                        catch {
                            await this.bot.sendMessage(userChatId, '🏆💰🚀');
                        }
                    }
                }
            }
            else {
                limitOrder_1.limitOrderEngine.markOrderFailed(order.id, result.error);
                if (userChatId) {
                    await this.bot.sendMessage(userChatId, `❌ **LIMIT ORDER FAILED**\n\n` +
                        `Order: \`${order.id}\`\n` +
                        `Error: ${result.error}\n\n` +
                        `_The price was reached but execution failed._`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
                }
            }
        });
    }
    /**
     * Start the bot
     */
    // ═══════════════════════════════════════════════════════════════════════════
    // 📊 GRADUATION PROGRESS CHECKER
    // ═══════════════════════════════════════════════════════════════════════════
    async checkGraduationProgress(chatId, tokenAddress) {
        try {
            await this.bot.sendMessage(chatId, `🔍 **Checking graduation progress...**\n\n` +
                `📋 \`${tokenAddress}\``, { parse_mode: 'Markdown' });
            // Get token state from graduation sniper
            const state = await graduation_1.graduationSniper.getTokenState(tokenAddress);
            if (!state) {
                // Token might not be on pump.tires or already graduated
                // Check if it has a PulseX pair
                const pairInfo = await pulsex_1.pulsex.getPairInfo(tokenAddress);
                if (pairInfo && pairInfo.pairAddress !== ethers_1.ethers.ZeroAddress) {
                    await this.bot.sendMessage(chatId, `✅ **Token Already Graduated!**\n\n` +
                        `📋 \`${tokenAddress}\`\n\n` +
                        `🎓 This token is already on PulseX!\n` +
                        `🔗 Pair: \`${pairInfo.pairAddress.slice(0, 12)}...\`\n\n` +
                        `_You can trade it directly on PulseX or use /buy_`, {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '💰 Buy Now', callback_data: `buy_token_${tokenAddress}` }],
                                [{ text: '📊 Trade on PulseX', url: `https://app.pulsex.com/swap?outputCurrency=${tokenAddress}` }],
                                [{ text: '🏠 Main Menu', callback_data: 'main_menu' }],
                            ],
                        },
                    });
                    return;
                }
                await this.bot.sendMessage(chatId, `❌ **Token Not Found on Bonding Curve**\n\n` +
                    `📋 \`${tokenAddress}\`\n\n` +
                    `This token is not on pump.tires bonding curve.\n` +
                    `It may be on a different platform or already graduated.\n\n` +
                    `_Try checking the token address or use /buy for direct purchase._`, { parse_mode: 'Markdown' });
                return;
            }
            // Format graduation progress
            const progressBar = this.createProgressBar(state.percentToGraduation);
            const plsRaisedFormatted = (Number(state.plsRaised) / 1e18).toLocaleString();
            const threshold = 200_000_000; // 200M PLS
            const remaining = threshold - (Number(state.plsRaised) / 1e18);
            const remainingFormatted = remaining > 0 ? remaining.toLocaleString() : '0';
            let statusEmoji = '⏳';
            let statusText = 'On Bonding Curve';
            if (state.graduated) {
                statusEmoji = '🎓';
                statusText = 'GRADUATED!';
            }
            else if (state.percentToGraduation >= 90) {
                statusEmoji = '🔥';
                statusText = 'ALMOST THERE!';
            }
            else if (state.percentToGraduation >= 50) {
                statusEmoji = '📈';
                statusText = 'Halfway There';
            }
            let msg = `📊 **GRADUATION PROGRESS**\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
            msg += `🪙 **${state.name}** (${state.symbol})\n`;
            msg += `📋 \`${state.address.slice(0, 16)}...${state.address.slice(-8)}\`\n\n`;
            msg += `${progressBar}\n`;
            msg += `📊 **${state.percentToGraduation.toFixed(2)}%** to graduation\n\n`;
            msg += `💰 Raised: **${plsRaisedFormatted} PLS**\n`;
            msg += `🎯 Target: **200,000,000 PLS**\n`;
            msg += `📉 Remaining: **${remainingFormatted} PLS**\n\n`;
            msg += `${statusEmoji} Status: **${statusText}**\n`;
            if (state.pairAddress) {
                msg += `\n🔗 Pair: \`${state.pairAddress.slice(0, 16)}...\``;
            }
            const buttons = [];
            if (state.graduated) {
                buttons.push([{ text: '💰 Buy Now!', callback_data: `buy_token_${tokenAddress}` }]);
                buttons.push([{ text: '📊 Trade on PulseX', url: `https://app.pulsex.com/swap?outputCurrency=${tokenAddress}` }]);
            }
            else {
                // Check if user has a pending order for this token
                const existingOrder = jsonStore_1.SnipeOrders.getAllPending().find(o => o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
                if (existingOrder) {
                    buttons.push([{ text: `✅ InstaBond Armed (${existingOrder.id})`, callback_data: 'snipe_list' }]);
                }
                else {
                    buttons.push([{ text: '🎯 Arm InstaBond Snipe', callback_data: `snipe_create_${tokenAddress}` }]);
                }
            }
            buttons.push([{ text: '🔄 Refresh', callback_data: `checkgrad_${tokenAddress}` }]);
            buttons.push([{ text: '🏠 Main Menu', callback_data: 'main_menu' }]);
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons },
            });
        }
        catch (error) {
            console.error('Check graduation error:', error);
            await this.bot.sendMessage(chatId, `❌ **Error checking graduation**\n\n${error.message}`, { parse_mode: 'Markdown' });
        }
    }
    createProgressBar(percent) {
        const filled = Math.floor(percent / 5);
        const empty = 20 - filled;
        const filledChar = '█';
        const emptyChar = '░';
        return `\`[${filledChar.repeat(filled)}${emptyChar.repeat(empty)}]\``;
    }
    async start() {
        console.log('🚀 Starting @DTGBondBot...');
        // Connect snipers
        await graduation_1.graduationSniper.connect();
        await graduation_1.graduationSniper.startListening();
        // 🔄 RECOVER PENDING SNIPE ORDERS FROM DISK (survives restarts!)
        const recoveredCount = await jsonStore_1.SnipeOrders.recoverToSniper(graduation_1.graduationSniper);
        if (recoveredCount > 0) {
            console.log(`🔄 Recovered ${recoveredCount} pending InstaBond orders from disk!`);
        }
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
     * Enhanced Active Orders View - with limit sell options and details
     */
    async showEnhancedActiveOrders(chatId, userId) {
        // Get both TradeHistory orders and LimitOrderEngine orders
        const historyOrders = jsonStore_1.TradeHistory.getActiveOrders(userId);
        const limitOrders = limitOrder_1.limitOrderEngine.getUserOrders(userId);
        // Get completed for summary
        const completedOrders = jsonStore_1.TradeHistory.getCompletedTrades(userId, 20);
        if (historyOrders.length === 0 && limitOrders.length === 0) {
            await this.bot.sendMessage(chatId, `📋 **ACTIVE ORDERS**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `👁️ **Pending:** 0\n` +
                `✅ **Executed:** ${completedOrders.length}\n\n` +
                `_No active orders right now._\n\n` +
                `Create a new order to get started!`, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🟢 New Limit Buy', callback_data: 'order_limit_buy' }],
                        [{ text: '🔴 New Limit Sell', callback_data: 'order_limit_sell' }],
                        [{ text: '💰 Take Profit', callback_data: 'order_take_profit' }],
                        [{ text: '🛑 Stop Loss', callback_data: 'order_stop_loss' }],
                        [{ text: '📊 P&L Card', callback_data: 'pnl_card' }],
                        [{ text: '🔙 Back', callback_data: 'orders_menu' }],
                    ]
                }
            });
            return;
        }
        // Build detailed order list with action buttons
        let msg = `📋 **ACTIVE ORDERS**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        msg += `👁️ **Pending:** ${historyOrders.length + limitOrders.length}\n`;
        msg += `✅ **Executed (recent):** ${completedOrders.length}\n\n`;
        // Type emojis
        const typeEmoji = {
            instabond_snipe: '🎓',
            limit_buy: '🟢',
            limit_sell: '🔴',
            stop_loss: '🛑',
            take_profit: '💰',
            market_buy: '💰',
            market_sell: '💸',
            dca: '📊',
        };
        const statusEmoji = {
            pending: '⏳',
            watching: '👁️',
            executing: '⚡',
            completed: '✅',
            failed: '❌',
            cancelled: '🚫',
        };
        msg += `━━━ **WATCHING** ━━━\n\n`;
        // Build buttons for each order
        const buttons = [];
        // Show history orders
        for (const order of historyOrders.slice(0, 8)) {
            const emoji = typeEmoji[order.type] || '📊';
            const status = statusEmoji[order.status] || '⏳';
            const symbol = order.tokenSymbol || order.tokenAddress.slice(0, 8);
            const amount = parseFloat(order.amountPls);
            const amountStr = amount >= 1000000 ? (amount / 1000000).toFixed(1) + 'M' : amount >= 1000 ? (amount / 1000).toFixed(0) + 'K' : amount.toFixed(0);
            msg += `${emoji} ${status} **${symbol}**\n`;
            msg += `   ${order.type.replace('_', ' ').toUpperCase()}\n`;
            msg += `   💰 ${amountStr} PLS`;
            if (order.targetPrice)
                msg += ` @ ${order.targetPrice}`;
            msg += `\n\n`;
            // Add action buttons for this order
            if (order.type === 'limit_buy' || order.type === 'instabond_snipe') {
                buttons.push([
                    { text: `🔴 Set Sell for ${symbol}`, callback_data: `order_limit_sell_${order.id}` },
                    { text: `❌ Cancel`, callback_data: `order_cancel_${order.id}` },
                ]);
            }
            else {
                buttons.push([
                    { text: `❌ Cancel ${symbol}`, callback_data: `order_cancel_${order.id}` },
                ]);
            }
        }
        // Recent completed section
        if (completedOrders.length > 0) {
            msg += `━━━ **RECENTLY EXECUTED** ━━━\n\n`;
            for (const order of completedOrders.slice(0, 3)) {
                const emoji = typeEmoji[order.type] || '📊';
                const symbol = order.tokenSymbol || order.tokenAddress.slice(0, 8);
                msg += `${emoji} ✅ **${symbol}** - ${order.type.replace('_', ' ')}\n`;
            }
            msg += `\n`;
        }
        // Add navigation buttons
        buttons.push([{ text: '━━━━━━━━━━━━━━━━━━━━━', callback_data: 'noop' }]);
        buttons.push([
            { text: '🟢 New Limit Buy', callback_data: 'order_limit_buy' },
            { text: '🔴 New Limit Sell', callback_data: 'order_limit_sell' },
        ]);
        buttons.push([
            { text: '📊 P&L Card', callback_data: 'pnl_card' },
        ]);
        buttons.push([
            { text: '🔙 Orders Menu', callback_data: 'orders_menu' },
            { text: '🏠 Main', callback_data: 'main_menu' },
        ]);
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: buttons },
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
     * ═══════════════════════════════════════════════════════════════════════════════
     * COMPREHENSIVE DASHBOARD - Shows complete status on login
     * Wallets, P&L, Orders, Snipes, Probable Wins - all in one place
     * ═══════════════════════════════════════════════════════════════════════════════
     */
    async showDashboard(chatId, userId) {
        const session = this.getSession(chatId);
        const now = formatTimestamp();
        // Get wallet data
        const botWallet = await wallet_1.walletManager.getWallet(userId);
        const linkedWallet = jsonStore_1.LinkedWallets.get(userId);
        const snipeWallets = await multiWallet_1.multiWallet.getUserWallets(userId);
        // Get orders and snipes
        const activeOrders = limitOrder_1.limitOrderEngine.getUserOrders(userId).filter(o => o.status === 'pending');
        const pendingSnipes = session.snipeOrders.filter(o => o.status === 'pending');
        const filledSnipes = session.snipeOrders.filter(o => o.status === 'filled');
        const failedSnipes = session.snipeOrders.filter(o => o.status === 'cancelled');
        const completedTrades = jsonStore_1.TradeHistory.getCompletedTrades(userId, 50);
        // Calculate P&L
        let totalPnlPls = 0, totalInvested = 0, wins = 0, losses = 0;
        for (const entry of completedTrades) {
            const pnl = parseFloat(entry.pnlPls || '0');
            const amt = parseFloat(entry.amountPls || '0');
            totalPnlPls += pnl;
            totalInvested += amt;
            if ((entry.pnlPercent || 0) > 0)
                wins++;
            else if ((entry.pnlPercent || 0) < 0)
                losses++;
        }
        const winRate = wins + losses > 0 ? (wins / (wins + losses) * 100) : 0;
        const pnlPercent = totalInvested > 0 ? (totalPnlPls / totalInvested * 100) : 0;
        // Build dashboard message
        let msg = `╔════════════════════════════════════╗\n`;
        msg += `║   ⚜️  **DTRADER DASHBOARD**  ⚜️   ║\n`;
        msg += `╠════════════════════════════════════╣\n`;
        msg += `║  🕐 ${now} (EST)                ║\n`;
        msg += `╚════════════════════════════════════╝\n\n`;
        // ══════ WALLETS SECTION ══════
        msg += `**━━━ 👛 YOUR WALLETS ━━━**\n\n`;
        // Gold Wallet (Linked DTGC holder)
        if (linkedWallet) {
            msg += `🏆 **Gold Wallet** (DTGC Gate)\n`;
            msg += `   \`${linkedWallet.walletAddress.slice(0, 10)}...${linkedWallet.walletAddress.slice(-6)}\`\n`;
            msg += `   💰 ~$${linkedWallet.balanceUsd.toFixed(0)} | ⚜️ DTGC Verified\n\n`;
        }
        // Bot Wallet
        if (botWallet) {
            msg += `🤖 **Bot Wallet**\n`;
            msg += `   \`${botWallet.address.slice(0, 10)}...${botWallet.address.slice(-6)}\`\n\n`;
        }
        // Snipe Wallets (DTrader 1-6)
        if (snipeWallets.length > 0) {
            msg += `🎯 **DTrader Wallets** (${snipeWallets.length})\n`;
            for (const w of snipeWallets.slice(0, 6)) {
                const activeIcon = w.isActive ? '✅' : '⬜';
                msg += `   ${activeIcon} #${w.index} ${w.label || 'DTrader ' + w.index}: \`${w.address.slice(0, 8)}...\`\n`;
            }
            msg += `\n`;
        }
        // ══════ P&L SECTION ══════
        msg += `**━━━ 📊 P&L SUMMARY ━━━**\n\n`;
        const pnlEmoji = pnlPercent >= 0 ? '📈' : '📉';
        const pnlSign = pnlPercent >= 0 ? '+' : '';
        msg += `${pnlEmoji} **Total P&L:** ${pnlSign}${pnlPercent.toFixed(2)}%\n`;
        msg += `✅ Wins: ${wins} | ❌ Losses: ${losses}\n`;
        msg += `🎯 **Win Rate:** ${winRate.toFixed(1)}%\n\n`;
        // ══════ ACTIVE ORDERS ══════
        msg += `**━━━ 📋 ACTIVE ORDERS ━━━**\n\n`;
        if (activeOrders.length > 0) {
            for (const order of activeOrders.slice(0, 5)) {
                const typeEmoji = order.orderType === 'limit_buy' ? '🟢' : order.orderType === 'limit_sell' ? '🔴' : '📊';
                msg += `${typeEmoji} ${order.tokenSymbol || 'TOKEN'} @ ${parseFloat(order.targetPrice).toExponential(2)} PLS\n`;
            }
            if (activeOrders.length > 5)
                msg += `   _...and ${activeOrders.length - 5} more_\n`;
        }
        else {
            msg += `   _No active limit orders_\n`;
        }
        msg += `\n`;
        // ══════ ACTIVE SNIPES ══════
        msg += `**━━━ 🎯 ACTIVE SNIPES ━━━**\n\n`;
        if (pendingSnipes.length > 0) {
            for (const snipe of pendingSnipes.slice(0, 5)) {
                msg += `🔥 ${snipe.tokenSymbol || snipe.tokenAddress?.slice(0, 8) || 'Unknown'} | ${snipe.amountPls.toLocaleString()} PLS\n`;
                if (snipe.takeProfitPercent)
                    msg += `   TP: +${snipe.takeProfitPercent}%\n`;
            }
            if (pendingSnipes.length > 5)
                msg += `   _...and ${pendingSnipes.length - 5} more_\n`;
        }
        else {
            msg += `   _No pending snipes_\n`;
        }
        msg += `\n`;
        // ══════ FAILED/CANCELLED ══════
        if (failedSnipes.length > 0) {
            msg += `**━━━ ❌ FAILED (${failedSnipes.length}) ━━━**\n\n`;
            for (const fail of failedSnipes.slice(0, 3)) {
                msg += `⚠️ ${fail.tokenSymbol || 'Unknown'} - Cancelled\n`;
            }
            msg += `\n`;
        }
        // ══════ FOOTER ══════
        msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `💾 **All data synced & backed up**\n`;
        msg += `🔒 Keys encrypted on server\n`;
        msg += `⚜️ _Memory persists across restarts_`;
        // Send dashboard with action buttons
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🏆 Probable Wins', callback_data: 'wins_menu' },
                        { text: '📊 Full P&L', callback_data: 'history_pnl' },
                    ],
                    [
                        { text: '👛 Wallet Details', callback_data: 'wallet_menu' },
                        { text: '📋 All Orders', callback_data: 'orders_menu' },
                    ],
                    [
                        { text: '🔑 Export Keys', callback_data: 'wallet_export_all' },
                        { text: '💾 Backup Info', callback_data: 'backup_info' },
                    ],
                    [
                        { text: '🎯 New Snipe', callback_data: 'snipe_menu' },
                        { text: '💰 Buy/Sell', callback_data: 'buy_menu' },
                    ],
                    [{ text: '⚙️ Settings', callback_data: 'settings_menu' }],
                ],
            },
        });
        // Also show top 3 Probable Wins summary
        try {
            const probableWins = await dexscreener_1.dexScreener.getProbableWins(5);
            if (probableWins.length > 0) {
                let winsMsg = `\n🏆 **TODAY'S TOP OPPORTUNITIES**\n`;
                winsMsg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
                for (let i = 0; i < Math.min(3, probableWins.length); i++) {
                    const pw = probableWins[i];
                    const t = pw.token;
                    const scoreEmoji = pw.score >= 70 ? '🟢' : pw.score >= 50 ? '🟡' : '🟠';
                    winsMsg += `${i + 1}. ${scoreEmoji} **$${t.symbol}** (${pw.score}/100)\n`;
                    winsMsg += `   💧 $${dexscreener_1.dexScreener.formatNumber(t.liquidity)} | ${t.priceChange24h >= 0 ? '📈' : '📉'} ${t.priceChange24h >= 0 ? '+' : ''}${t.priceChange24h.toFixed(1)}%\n`;
                }
                winsMsg += `\n_Tap "Probable Wins" for more_`;
                await this.bot.sendMessage(chatId, winsMsg, {
                    parse_mode: 'Markdown',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🏆 See All Probable Wins', callback_data: 'wins_menu' }],
                        ],
                    },
                });
            }
        }
        catch (e) {
            console.log('Could not load Probable Wins for dashboard:', e);
        }
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
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎯 PULSONIC-STYLE MENU HANDLERS
    // ═══════════════════════════════════════════════════════════════════════════
    /**
     * Show positions menu (tracked tokens)
     */
    async showPositionsMenu(chatId, userId) {
        const session = this.getSession(chatId);
        // Get tracked tokens from snipe orders and trade history
        const snipeOrders = session.snipeOrders.filter(o => o.status === 'filled');
        const trades = jsonStore_1.TradeHistory.getCompletedTrades(userId, 20);
        // Collect unique token addresses
        const tokenSet = new Set();
        for (const o of snipeOrders)
            tokenSet.add(o.tokenAddress.toLowerCase());
        for (const t of trades)
            if (t.tokenAddress)
                tokenSet.add(t.tokenAddress.toLowerCase());
        if (tokenSet.size === 0) {
            await this.bot.sendMessage(chatId, `📊 **YOUR POSITIONS**\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `_No tracked positions yet._\n\n` +
                `Start trading or sniping to see your positions here.\n\n` +
                `⚜️ _This is the way._`, { parse_mode: 'Markdown', reply_markup: keyboards.positionsMenuKeyboard });
            return;
        }
        let msg = `📊 **YOUR POSITIONS** (${tokenSet.size})\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        let count = 0;
        for (const addr of Array.from(tokenSet).slice(0, 10)) {
            count++;
            const order = snipeOrders.find(o => o.tokenAddress.toLowerCase() === addr);
            const symbol = order?.tokenSymbol || 'TOKEN';
            msg += `${count}. **$${symbol}**\n`;
            msg += `   \`${addr.slice(0, 10)}...${addr.slice(-8)}\`\n\n`;
        }
        if (tokenSet.size > 10) {
            msg += `_...and ${tokenSet.size - 10} more_\n\n`;
        }
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `⚜️ _Send a token address to view details_`;
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboards.positionsMenuKeyboard,
        });
    }
    /**
     * Show pump.tires sniper settings (PulsonicBot style)
     */
    async showPumpSniperSettings(chatId, userId) {
        const session = this.getSession(chatId);
        const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
        const activeWallet = wallets.find(w => w.isActive) || wallets[0];
        const walletIndex = activeWallet ? wallets.indexOf(activeWallet) + 1 : 1;
        // Get wallet balance
        let balanceStr = '0';
        if (activeWallet) {
            try {
                const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
                const balance = await provider.getBalance(activeWallet.address);
                const formatted = parseFloat(ethers_1.ethers.formatEther(balance));
                balanceStr = formatted > 1000 ? `${(formatted / 1000).toFixed(2)}K` : formatted.toFixed(2);
            }
            catch { }
        }
        // Sniper settings from session
        const sniperSettings = session.sniperSettings || {
            snipeAmount: '1M PLS',
            gasIncrease: '+90%',
            tickers: [],
            maxSnipes: 'Any',
            maxDevSnipe: 'Any',
            maxTokensDeployed: 'Any',
            minBondedTokens: 'Any',
            blacklistedDevs: 0,
            isActive: false,
        };
        // Build the PulsonicBot-style display message
        const tickerStr = sniperSettings.tickers?.length > 0
            ? sniperSettings.tickers.map((t) => `$${t.toUpperCase()}`).join(' ')
            : 'Any';
        let msg = `🎯 **PUMP.Tires - Sniper Menu**\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `Welcome to sniper menu where you can easily setup and activate your sniper to snipe newly deployed tokens on PUMP.Tires\n\n`;
        msg += `**Current sniper settings:**\n\n`;
        msg += `💰 Wallet: **#${walletIndex} (${balanceStr})**\n`;
        msg += `💵 Snipe Amount: **${sniperSettings.snipeAmount}**\n`;
        msg += `⛽ Gas Increase: **${sniperSettings.gasIncrease}**\n\n`;
        msg += `🏷️ Ticker(s): **${tickerStr}**\n\n`;
        msg += `🎯 Max Snipes: **${sniperSettings.maxSnipes}**\n`;
        msg += `🚫 Blacklisted Devs: **${sniperSettings.blacklistedDevs}**\n\n`;
        msg += `🎯 Max Dev Snipe: **${sniperSettings.maxDevSnipe}**\n`;
        msg += `🪙 Max Tokens Deployed: **${sniperSettings.maxTokensDeployed}**\n`;
        msg += `⭐ Min Bonded Tokens: **${sniperSettings.minBondedTokens}**\n\n`;
        msg += `🤖 Is Active: ${sniperSettings.isActive ? '✅ **Yes**' : '❌ **No**'}`;
        const keyboard = keyboards.pumpSniperSettingsKeyboard({
            walletIndex,
            walletBalance: balanceStr,
            snipeAmount: sniperSettings.snipeAmount,
            gasIncrease: sniperSettings.gasIncrease,
            tickers: sniperSettings.tickers || [],
            maxSnipes: sniperSettings.maxSnipes,
            blacklistedDevs: sniperSettings.blacklistedDevs,
            maxDevSnipe: sniperSettings.maxDevSnipe,
            maxTokensDeployed: sniperSettings.maxTokensDeployed,
            minBondedTokens: sniperSettings.minBondedTokens,
            isActive: sniperSettings.isActive,
        });
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
    }
    /**
     * Show Probable Wins - AI-scored top opportunities
     */
    async showProbableWins(chatId, userId) {
        await this.bot.sendMessage(chatId, '⏳ **Analyzing PulseChain tokens...**\n_Scoring opportunities based on volume, liquidity, and price action._', { parse_mode: 'Markdown' });
        try {
            const probableWins = await dexscreener_1.dexScreener.getProbableWins(15);
            if (probableWins.length === 0) {
                await this.bot.sendMessage(chatId, `🏆 **PROBABLE WINS**\n━━━━━━━━━━━━━━━━━━━━━\n\n` +
                    `No qualifying tokens found.\n\n` +
                    `_Try again in a few minutes._`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
                return;
            }
            let msg = `🏆 **PROBABLE WINS** - Top Opportunities\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
            for (let i = 0; i < Math.min(probableWins.length, 10); i++) {
                const pw = probableWins[i];
                const t = pw.token;
                const scoreEmoji = pw.score >= 80 ? '🟢' : pw.score >= 60 ? '🟡' : '🟠';
                const priceChangeEmoji = t.priceChange24h >= 0 ? '📈' : '📉';
                const priceChangeSign = t.priceChange24h >= 0 ? '+' : '';
                msg += `**${i + 1}. ${scoreEmoji} $${t.symbol}** (${pw.score}% score)\n`;
                msg += `   💧 $${dexscreener_1.dexScreener.formatNumber(t.liquidity)} Liq | `;
                msg += `📊 $${dexscreener_1.dexScreener.formatNumber(t.volume24h)} Vol | `;
                msg += `${priceChangeEmoji} ${priceChangeSign}${t.priceChange24h.toFixed(1)}%\n`;
                if (pw.reasons.length > 0) {
                    msg += `   ${pw.reasons.slice(0, 2).join(' • ')}\n`;
                }
                msg += `   \`${t.address.slice(0, 8)}...${t.address.slice(-6)}\`\n\n`;
            }
            msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `⚜️ _Scores based on volume momentum, liquidity,_\n`;
            msg += `_price action, and trading activity._`;
            // Build keyboard with quick buy buttons for top 5
            const buttons = [];
            for (let i = 0; i < Math.min(probableWins.length, 5); i++) {
                const pw = probableWins[i];
                buttons.push([
                    { text: `💰 Buy $${pw.token.symbol}`, callback_data: `wins_buy_${pw.token.address.slice(0, 16)}` },
                    { text: `📊 Details`, callback_data: `wins_details_${pw.token.address.slice(0, 16)}` },
                ]);
            }
            buttons.push([{ text: '🔄 Refresh', callback_data: 'wins_menu' }]);
            buttons.push([{ text: '🔙 Main Menu', callback_data: 'main_menu' }]);
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons },
            });
        }
        catch (error) {
            console.error('Probable Wins error:', error);
            await this.bot.sendMessage(chatId, `❌ Failed to load Probable Wins.\n\nError: ${error.message}`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
        }
    }
    /**
     * Show quick sell menu for a token (PulsonicBot style)
     */
    async showQuickSellMenu(chatId, userId, tokenAddress) {
        // Get token info
        let tokenSymbol = 'TOKEN';
        let pnlPercent = 0;
        let worth = 0;
        let cost = 0;
        let tokens = 0;
        try {
            // Try to get token symbol from contract
            const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
            const tokenContract = new ethers_1.ethers.Contract(tokenAddress, [
                'function symbol() view returns (string)',
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
            ], provider);
            tokenSymbol = await tokenContract.symbol().catch(() => 'TOKEN');
            // Get user's wallet balance of this token
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const activeWallet = wallets.find(w => w.isActive) || wallets[0];
            if (activeWallet) {
                const balance = await tokenContract.balanceOf(activeWallet.address);
                const decimals = await tokenContract.decimals().catch(() => 18);
                tokens = parseFloat(ethers_1.ethers.formatUnits(balance, decimals));
            }
            // Try to get price and calculate worth
            // (simplified - actual implementation would use price oracle)
        }
        catch (e) {
            console.log('Error getting token info:', e);
        }
        // Build message
        let msg = `🪙 **Token: ${tokenSymbol}**\n`;
        msg += `📋 \`${tokenAddress}\`\n`;
        msg += `📊 PNL: ${pnlPercent >= 0 ? '🟢' : '🔴'} **${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%**\n\n`;
        msg += `💰 Worth: **${(0, pnlCard_1.formatNumber)(worth)} PLS**\n`;
        msg += `💵 Cost: **${(0, pnlCard_1.formatNumber)(cost)} PLS**\n`;
        msg += `🪙 Tokens: **${(0, pnlCard_1.formatNumber)(tokens)}**\n\n`;
        msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
        msg += `⚜️ _Select sell percentage:_`;
        const keyboard = keyboards.quickSellMenuKeyboard(tokenAddress, tokenSymbol);
        await this.bot.sendMessage(chatId, msg, {
            parse_mode: 'Markdown',
            reply_markup: keyboard,
        });
    }
    /**
     * Show token position details (PulsonicBot style)
     */
    async showTokenPosition(chatId, userId, tokenAddress) {
        // Get token info
        let tokenSymbol = 'TOKEN';
        let marketCap = 0;
        let liquidity = 0;
        let pnlPercent = 0;
        let worth = 0;
        let cost = 0;
        let tokens = 0;
        let supply = 0;
        try {
            const provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
            const tokenContract = new ethers_1.ethers.Contract(tokenAddress, [
                'function symbol() view returns (string)',
                'function name() view returns (string)',
                'function balanceOf(address) view returns (uint256)',
                'function decimals() view returns (uint8)',
                'function totalSupply() view returns (uint256)',
            ], provider);
            tokenSymbol = await tokenContract.symbol().catch(() => 'TOKEN');
            const decimals = await tokenContract.decimals().catch(() => 18);
            const totalSupply = await tokenContract.totalSupply().catch(() => BigInt(0));
            supply = parseFloat(ethers_1.ethers.formatUnits(totalSupply, decimals));
            // Get user's wallet balance
            const wallets = await multiWallet_1.multiWallet.getUserWallets(userId);
            const activeWallet = wallets.find(w => w.isActive) || wallets[0];
            const walletIndex = activeWallet ? wallets.indexOf(activeWallet) + 1 : 1;
            if (activeWallet) {
                const balance = await tokenContract.balanceOf(activeWallet.address);
                tokens = parseFloat(ethers_1.ethers.formatUnits(balance, decimals));
            }
            const supplyPercent = supply > 0 ? (tokens / supply * 100) : 0;
            // Build PulsonicBot-style message
            let msg = `➡️ **Token: ${tokenSymbol}**\n`;
            msg += `📋 \`${tokenAddress}\`\n`;
            msg += `📊 PNL: ${pnlPercent >= 0 ? '🟢' : '🔴'} **${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%**\n`;
            msg += `📦 Total supply: **${supplyPercent.toFixed(2)}%**\n\n`;
            msg += `📈 Market cap: **$${(0, pnlCard_1.formatNumber)(marketCap)}**\n`;
            msg += `💧 Liquidity: **${(0, pnlCard_1.formatNumber)(liquidity)} PLS**\n\n`;
            msg += `💰 **[${walletIndex}]** ${pnlPercent >= 0 ? '🟢' : '🔴'} **${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%**\n`;
            msg += `Worth: **${(0, pnlCard_1.formatNumber)(worth)} PLS** Cost: **${(0, pnlCard_1.formatNumber)(cost)} PLS**\n`;
            msg += `Tokens: **${(0, pnlCard_1.formatNumber)(tokens)}** (${supplyPercent.toFixed(2)}%)\n\n`;
            msg += `[Contract](${config_1.config.explorerUrl}/address/${tokenAddress}) • [DEXScreener](https://dexscreener.com/pulsechain/${tokenAddress}) • [DEXTools](https://www.dextools.io/app/en/pulse/pair-explorer/${tokenAddress})\n`;
            msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
            msg += `🕐 ${formatTimestamp()}`;
            const keyboard = keyboards.tokenPositionKeyboard({
                tokenAddress,
                tokenSymbol,
                walletIndex,
                slippage: 'auto',
            });
            await this.bot.sendMessage(chatId, msg, {
                parse_mode: 'Markdown',
                reply_markup: keyboard,
                disable_web_page_preview: true,
            });
        }
        catch (error) {
            console.error('Error showing token position:', error);
            await this.bot.sendMessage(chatId, `❌ Could not load token details.\n\nError: ${error.message}`, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
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