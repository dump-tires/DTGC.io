"use strict";
/**
 * Simple JSON File Storage
 * Replaces better-sqlite3 for compatibility
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeHistory = exports.tradeHistoryStore = exports.LinkedWallets = exports.linkedWalletsStore = exports.snipeTargetsStore = exports.tradesStore = exports.ordersStore = exports.walletsStore = exports.usersStore = void 0;
exports.createStore = createStore;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
// Ensure data directory exists
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
function createStore(name) {
    const filePath = path_1.default.join(DATA_DIR, `${name}.json`);
    // Load existing data
    let data = [];
    if (fs_1.default.existsSync(filePath)) {
        try {
            const content = fs_1.default.readFileSync(filePath, 'utf-8');
            data = JSON.parse(content);
        }
        catch {
            data = [];
        }
    }
    const save = () => {
        fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2));
    };
    return {
        data,
        save,
        findAll: () => [...data],
        findOne: (predicate) => data.find(predicate),
        findMany: (predicate) => data.filter(predicate),
        insert: (item) => {
            if (!item.id) {
                item.id = Date.now().toString();
            }
            data.push(item);
            save();
            return item;
        },
        update: (predicate, updates) => {
            const index = data.findIndex(predicate);
            if (index !== -1) {
                data[index] = { ...data[index], ...updates };
                save();
            }
        },
        delete: (predicate) => {
            const index = data.findIndex(predicate);
            if (index !== -1) {
                data.splice(index, 1);
                save();
            }
        }
    };
}
// Pre-defined stores
exports.usersStore = createStore('users');
exports.walletsStore = createStore('wallets');
exports.ordersStore = createStore('orders');
exports.tradesStore = createStore('trades');
exports.snipeTargetsStore = createStore('snipeTargets');
exports.linkedWalletsStore = createStore('linkedWallets');
// Vercel sync for permanent persistence
async function syncVerificationToVercel(entry) {
    try {
        const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
        const response = await fetch('https://dtgc.io/api/verification-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                telegramUserId: entry.id,
                chatId: entry.chatId,
                walletAddress: entry.walletAddress,
                balanceUsd: entry.balanceUsd,
                username: entry.username || null,
                botWalletAddress: entry.botWalletAddress,
                botKeyLast4: entry.botKeyLast4,
            }),
        });
        if (response.ok) {
            console.log(`☁️ [VERCEL] Synced verification for user ${entry.id}`);
            return true;
        }
        return false;
    }
    catch (e) {
        console.error(`❌ [VERCEL] Failed to sync verification:`, e);
        return false;
    }
}
async function recoverVerificationFromVercel(vistoId, gatedWallet) {
    try {
        const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
        const queryParam = gatedWallet
            ? `gatedWallet=${gatedWallet.toLowerCase()}`
            : `telegramUserId=${vistoId}`;
        const response = await fetch(`https://dtgc.io/api/verification-sync?${queryParam}`, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok)
            return null;
        const data = await response.json();
        if (!data.found || !data.verification)
            return null;
        const v = data.verification;
        const entry = {
            id: v.telegramUserId,
            chatId: v.chatId,
            walletAddress: v.walletAddress,
            balanceUsd: v.balanceUsd,
            botWalletAddress: v.botWalletAddress,
            botKeyLast4: v.botKeyLast4,
            verifiedAt: v.verifiedAt,
            expiresAt: v.expiresAt,
        };
        // Save to local store
        exports.linkedWalletsStore.delete((e) => e.id === entry.id);
        exports.linkedWalletsStore.insert(entry);
        console.log(`☁️ [VERCEL] Recovered verification for user ${entry.id}: ${entry.walletAddress.slice(0, 10)}...`);
        return entry;
    }
    catch (e) {
        console.error(`❌ [VERCEL] Failed to recover verification:`, e);
        return null;
    }
}
exports.LinkedWallets = {
    /**
     * Save a linked wallet (with optional bot wallet linking)
     * ALSO syncs to Vercel for permanent persistence!
     */
    link: (vistoId, chatId, walletAddress, balanceUsd, botWalletAddress, botKeyLast4, username) => {
        // Remove any existing entry for this user
        exports.linkedWalletsStore.delete((e) => e.id === vistoId);
        const entry = {
            id: vistoId,
            chatId,
            walletAddress: walletAddress.toLowerCase(),
            balanceUsd,
            verifiedAt: Date.now(),
            expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 365 days - permanent for practical purposes
            botWalletAddress: botWalletAddress?.toLowerCase(),
            botKeyLast4: botKeyLast4?.toLowerCase(),
        };
        exports.linkedWalletsStore.insert(entry);
        console.log(`🔗 Linked wallet for user ${vistoId}: ${walletAddress.slice(0, 10)}...${botWalletAddress ? ` + bot wallet ${botWalletAddress.slice(0, 10)}...` : ''}`);
        // Sync to Vercel for permanent persistence (non-blocking)
        syncVerificationToVercel({ ...entry, username }).catch(() => { });
        return entry;
    },
    /**
     * Recover verification from Vercel cloud backup
     */
    recoverFromVercel: recoverVerificationFromVercel,
    /**
     * Get bot wallet for a user
     */
    getBotWallet: (vistoId) => {
        const entry = exports.linkedWalletsStore.findOne((e) => e.id === vistoId);
        if (entry?.botWalletAddress && entry?.botKeyLast4) {
            return { address: entry.botWalletAddress, keyLast4: entry.botKeyLast4 };
        }
        return undefined;
    },
    /**
     * Get linked wallet for a user (sync version - checks local only)
     */
    get: (vistoId) => {
        const entry = exports.linkedWalletsStore.findOne((e) => e.id === vistoId);
        if (entry && entry.expiresAt > Date.now()) {
            return entry;
        }
        // Expired or not found locally
        return undefined;
    },
    /**
     * Get linked wallet with Vercel recovery if missing locally
     * Use this for critical verification checks!
     */
    getWithRecovery: async (vistoId) => {
        // First check local
        const localEntry = exports.linkedWalletsStore.findOne((e) => e.id === vistoId);
        if (localEntry && localEntry.expiresAt > Date.now()) {
            return localEntry;
        }
        // Try Vercel recovery
        console.log(`🔍 Local verification missing for ${vistoId}, trying Vercel...`);
        const recovered = await recoverVerificationFromVercel(vistoId);
        if (recovered && recovered.expiresAt > Date.now()) {
            return recovered;
        }
        return undefined;
    },
    /**
     * Check if a user has a valid linked wallet
     */
    hasValidLink: (vistoId) => {
        const entry = exports.LinkedWallets.get(vistoId);
        return !!entry;
    },
    /**
     * Check with Vercel recovery - async version for critical checks
     */
    hasValidLinkAsync: async (vistoId) => {
        const entry = await exports.LinkedWallets.getWithRecovery(vistoId);
        return !!entry;
    },
    /**
     * Remove linked wallet
     */
    unlink: (vistoId) => {
        exports.linkedWalletsStore.delete((e) => e.id === vistoId);
        console.log(`🔓 Unlinked wallet for user ${vistoId}`);
    },
    /**
     * Get wallet address for a user
     */
    getAddress: (vistoId) => {
        const entry = exports.LinkedWallets.get(vistoId);
        return entry?.walletAddress;
    },
};
exports.tradeHistoryStore = createStore('tradeHistory');
// ═══════════════════════════════════════════════════════════════════════════
// TRADE HISTORY HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
exports.TradeHistory = {
    /**
     * Log a new InstaBond snipe order
     */
    logInstaBondSnipe: (vistoId, chatId, tokenAddress, tokenSymbol, amountPls, sellPercent, sellMultiplier) => {
        const entry = {
            id: `ib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            vistoId,
            chatId,
            type: 'instabond_snipe',
            status: 'watching',
            tokenAddress,
            tokenSymbol,
            amountPls,
            triggerCondition: 'graduation (200M PLS bonding curve)',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            notes: sellPercent && sellMultiplier
                ? `Auto-sell ${sellPercent}% at ${sellMultiplier}x`
                : undefined,
        };
        exports.tradeHistoryStore.insert(entry);
        return entry;
    },
    /**
     * Log a limit order (buy/sell/take profit/stop loss)
     */
    logLimitOrder: (vistoId, chatId, type, tokenAddress, tokenSymbol, amountPls, targetPrice, linkedOrderId) => {
        const entry = {
            id: `lo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            vistoId,
            chatId,
            type,
            status: 'watching',
            tokenAddress,
            tokenSymbol,
            amountPls,
            targetPrice,
            linkedOrderId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        exports.tradeHistoryStore.insert(entry);
        return entry;
    },
    /**
     * Update order status
     */
    updateStatus: (orderId, status, executionDetails) => {
        exports.tradeHistoryStore.update((e) => e.id === orderId, {
            status,
            updatedAt: Date.now(),
            executedAt: status === 'completed' || status === 'failed' ? Date.now() : undefined,
            ...executionDetails,
        });
    },
    /**
     * Get all orders for a user
     */
    getUserHistory: (vistoId, limit = 20) => {
        return exports.tradeHistoryStore
            .findMany((e) => e.vistoId === vistoId)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, limit);
    },
    /**
     * Get active (pending/watching) orders for a user
     */
    getActiveOrders: (vistoId) => {
        return exports.tradeHistoryStore
            .findMany((e) => e.vistoId === vistoId &&
            (e.status === 'pending' || e.status === 'watching' || e.status === 'executing'))
            .sort((a, b) => b.createdAt - a.createdAt);
    },
    /**
     * Get completed trades for PnL summary
     */
    getCompletedTrades: (vistoId, limit = 50) => {
        return exports.tradeHistoryStore
            .findMany((e) => e.vistoId === vistoId &&
            (e.status === 'completed' || e.status === 'failed'))
            .sort((a, b) => b.executedAt - a.executedAt)
            .slice(0, limit);
    },
    /**
     * Cancel an order
     */
    cancelOrder: (orderId) => {
        const order = exports.tradeHistoryStore.findOne((e) => e.id === orderId);
        if (order && (order.status === 'pending' || order.status === 'watching')) {
            exports.tradeHistoryStore.update((e) => e.id === orderId, { status: 'cancelled', updatedAt: Date.now() });
            return true;
        }
        return false;
    },
    /**
     * Format order for Telegram display
     */
    formatForTelegram: (entry) => {
        const typeEmoji = {
            instabond_snipe: '🎓',
            limit_buy: '🟢',
            limit_sell: '🔴',
            stop_loss: '🛑',
            take_profit: '💰',
            market_buy: '💰',
            market_sell: '💸',
            dca: '📊',
            copy_trade: '🐋',
        };
        const statusEmoji = {
            pending: '⏳',
            watching: '👁️',
            executing: '⚡',
            completed: '✅',
            failed: '❌',
            cancelled: '🚫',
        };
        const typeName = {
            instabond_snipe: 'InstaBond Snipe',
            limit_buy: 'Limit Buy',
            limit_sell: 'Limit Sell',
            stop_loss: 'Stop Loss',
            take_profit: 'Take Profit',
            market_buy: 'Market Buy',
            market_sell: 'Market Sell',
            dca: 'DCA Order',
            copy_trade: 'Copy Trade',
        };
        const date = new Date(entry.createdAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        let msg = `${typeEmoji[entry.type]} **${typeName[entry.type]}**\n`;
        msg += `${statusEmoji[entry.status]} ${entry.status.toUpperCase()}\n`;
        msg += `🪙 ${entry.tokenSymbol || entry.tokenAddress.slice(0, 8)}\n`;
        msg += `💰 ${formatPls(entry.amountPls)} PLS\n`;
        if (entry.targetPrice) {
            msg += `🎯 Target: ${entry.targetPrice}\n`;
        }
        if (entry.executedPrice) {
            msg += `📈 Executed @ ${entry.executedPrice}\n`;
        }
        if (entry.pnlPercent !== undefined) {
            const sign = entry.pnlPercent >= 0 ? '+' : '';
            msg += `📊 PnL: ${sign}${entry.pnlPercent.toFixed(2)}%\n`;
        }
        if (entry.txHash) {
            msg += `🔗 [Tx](https://scan.pulsechain.com/tx/${entry.txHash})\n`;
        }
        msg += `📅 ${date}`;
        return msg;
    },
};
// Helper to format PLS numbers
function formatPls(value) {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1e9)
        return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6)
        return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3)
        return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}
//# sourceMappingURL=jsonStore.js.map