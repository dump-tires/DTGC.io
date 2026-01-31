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
exports.copyTradeManager = exports.CopyTradeManager = void 0;
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config");
const events_1 = require("events");
// JSON Storage for Tracked Wallets
class TrackedWalletStore {
    filePath;
    data;
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, 'trackedWallets.json');
        this.data = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            }
        }
        catch { }
        return [];
    }
    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
    findByUser(userId) {
        return this.data.filter(w => w.userId === userId && w.isActive);
    }
    findActive() {
        return this.data.filter(w => w.isActive);
    }
    findByAddress(address) {
        return this.data.filter(w => w.address.toLowerCase() === address.toLowerCase() && w.isActive);
    }
    getActiveAddresses() {
        const addresses = new Set();
        this.data.filter(w => w.isActive).forEach(w => addresses.add(w.address.toLowerCase()));
        return Array.from(addresses);
    }
    insert(wallet) {
        this.data.push(wallet);
        this.save();
    }
    deactivate(walletId, userId) {
        const idx = this.data.findIndex(w => w.id === walletId && w.userId === userId);
        if (idx !== -1) {
            this.data[idx].isActive = false;
            this.save();
            return true;
        }
        return false;
    }
    updateStats(walletId, updates) {
        const idx = this.data.findIndex(w => w.id === walletId);
        if (idx !== -1) {
            this.data[idx] = { ...this.data[idx], ...updates };
            this.save();
        }
    }
}
// JSON Storage for Copy Trade History
class CopyTradeHistoryStore {
    filePath;
    data;
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, 'copyTradeHistory.json');
        this.data = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            }
        }
        catch { }
        return [];
    }
    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
    insert(trade) {
        this.data.push(trade);
        this.save();
    }
    findByUser(userId) {
        return this.data.filter(t => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    }
}
class CopyTradeManager extends events_1.EventEmitter {
    provider;
    wsProvider = null;
    walletStore;
    historyStore;
    trackedWalletsCache = new Map(); // address -> configs
    isRunning = false;
    constructor() {
        super();
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.walletStore = new TrackedWalletStore();
        this.historyStore = new CopyTradeHistoryStore();
        this.loadTrackedWallets();
    }
    loadTrackedWallets() {
        this.trackedWalletsCache.clear();
        const wallets = this.walletStore.findActive();
        for (const wallet of wallets) {
            const address = wallet.address.toLowerCase();
            if (!this.trackedWalletsCache.has(address)) {
                this.trackedWalletsCache.set(address, []);
            }
            this.trackedWalletsCache.get(address).push(wallet);
        }
    }
    /**
     * Add wallet to track
     */
    async addTrackedWallet(params) {
        const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const wallet = {
            id,
            userId: params.userId,
            address: params.address.toLowerCase(),
            label: params.label || 'Whale',
            copyBuys: params.copyBuys ?? true,
            copySells: params.copySells ?? false,
            copyAmountPls: (params.copyAmountPls || 0n).toString(),
            copyPercentage: params.copyPercentage || 10,
            minTradePls: ethers_1.ethers.parseEther('100000').toString(), // 100k PLS min
            maxTradePls: ethers_1.ethers.parseEther('10000000').toString(), // 10M PLS max
            frontrun: params.frontrun ?? false,
            isActive: true,
            totalCopied: 0,
            profitLoss: '0',
            createdAt: Date.now(),
        };
        this.walletStore.insert(wallet);
        // Add to cache
        if (!this.trackedWalletsCache.has(wallet.address)) {
            this.trackedWalletsCache.set(wallet.address, []);
        }
        this.trackedWalletsCache.get(wallet.address).push(wallet);
        return wallet;
    }
    /**
     * Remove tracked wallet
     */
    removeTrackedWallet(userId, walletId) {
        const result = this.walletStore.deactivate(walletId, userId);
        if (result) {
            this.loadTrackedWallets(); // Reload cache
        }
        return result;
    }
    /**
     * Get user's tracked wallets
     */
    getUserTrackedWallets(userId) {
        return this.walletStore.findByUser(userId);
    }
    /**
     * Connect and start monitoring
     */
    async connect() {
        try {
            this.wsProvider = new ethers_1.ethers.WebSocketProvider(config_1.config.wss);
            console.log('🔌 Copy trade monitor connected');
        }
        catch (error) {
            console.error('Copy trade connection failed:', error);
        }
    }
    /**
     * Start monitoring tracked wallets
     */
    async start() {
        if (!this.wsProvider)
            await this.connect();
        if (!this.wsProvider)
            return;
        this.isRunning = true;
        // Monitor pending transactions from tracked wallets
        this.wsProvider.on('pending', async (txHash) => {
            try {
                const tx = await this.provider.getTransaction(txHash);
                if (!tx || !tx.from)
                    return;
                const fromAddress = tx.from.toLowerCase();
                // Check if this is a tracked wallet
                if (!this.trackedWalletsCache.has(fromAddress))
                    return;
                // Check if it's a router transaction (swap)
                if (tx.to?.toLowerCase() !== config_1.config.pulsexRouter.toLowerCase())
                    return;
                // Decode the swap
                const trade = await this.decodeSwapTx(tx);
                if (!trade)
                    return;
                console.log(`🐋 Whale trade detected: ${fromAddress}`);
                console.log(`   ${trade.type.toUpperCase()} ${trade.tokenSymbol}`);
                // Emit for each user tracking this wallet
                const trackers = this.trackedWalletsCache.get(fromAddress) || [];
                for (const tracker of trackers) {
                    // Check if trade matches filters
                    if (trade.type === 'buy' && !tracker.copyBuys)
                        continue;
                    if (trade.type === 'sell' && !tracker.copySells)
                        continue;
                    if (trade.amountIn < BigInt(tracker.minTradePls))
                        continue;
                    if (trade.amountIn > BigInt(tracker.maxTradePls))
                        continue;
                    this.emit('copyTrade', {
                        tracker,
                        trade,
                        txHash,
                    });
                }
            }
            catch {
                // Ignore decode errors
            }
        });
        console.log(`👀 Monitoring ${this.trackedWalletsCache.size} whale wallets`);
    }
    /**
     * Decode swap transaction
     */
    async decodeSwapTx(tx) {
        try {
            const iface = new ethers_1.ethers.Interface(config_1.PULSEX_ROUTER_ABI);
            const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });
            if (!parsed)
                return null;
            let type = 'buy';
            let tokenAddress = '';
            let amountIn = 0n;
            if (parsed.name.includes('swapExactETHForTokens')) {
                type = 'buy';
                const pathArg = parsed.args.path || parsed.args[1];
                tokenAddress = pathArg[pathArg.length - 1];
                amountIn = tx.value;
            }
            else if (parsed.name.includes('swapExactTokensForETH')) {
                type = 'sell';
                const pathArg = parsed.args.path || parsed.args[2];
                tokenAddress = pathArg[0];
                amountIn = parsed.args.amountIn || parsed.args[0];
            }
            else {
                return null;
            }
            // Get token symbol
            let tokenSymbol = '???';
            try {
                const token = new ethers_1.ethers.Contract(tokenAddress, config_1.ERC20_ABI, this.provider);
                tokenSymbol = await token.symbol();
            }
            catch { }
            return {
                wallet: tx.from,
                type,
                tokenAddress,
                tokenSymbol,
                amountIn,
                amountOut: 0n,
                txHash: tx.hash,
                blockNumber: 0,
                timestamp: Date.now(),
            };
        }
        catch {
            return null;
        }
    }
    /**
     * Calculate copy amount based on config
     */
    calculateCopyAmount(tracker, originalAmount) {
        const copyAmountPls = BigInt(tracker.copyAmountPls);
        if (copyAmountPls > 0n) {
            return copyAmountPls;
        }
        // Use percentage of original trade
        return (originalAmount * BigInt(Math.floor(tracker.copyPercentage * 100))) / 10000n;
    }
    /**
     * Record a copy trade in history
     */
    recordCopyTrade(params) {
        const id = `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.historyStore.insert({
            id,
            userId: params.userId,
            trackedWallet: params.trackedWallet,
            originalTx: params.originalTx,
            copyTx: params.copyTx,
            tokenAddress: params.tokenAddress,
            tradeType: params.tradeType,
            amountPls: params.amountPls.toString(),
            status: params.status,
            createdAt: Date.now(),
        });
    }
    /**
     * Stop monitoring
     */
    stop() {
        this.isRunning = false;
        if (this.wsProvider) {
            this.wsProvider.removeAllListeners('pending');
        }
    }
    /**
     * Disconnect
     */
    async disconnect() {
        this.stop();
        if (this.wsProvider) {
            await this.wsProvider.destroy();
            this.wsProvider = null;
        }
    }
    /**
     * Format tracked wallet for display
     */
    formatTrackedWallet(wallet) {
        const copyAmount = BigInt(wallet.copyAmountPls);
        return `
🐋 **${wallet.label}**
\`${wallet.address}\`

📊 Copy: ${wallet.copyBuys ? '✅ Buys' : '❌ Buys'} | ${wallet.copySells ? '✅ Sells' : '❌ Sells'}
💰 Amount: ${copyAmount > 0n ? ethers_1.ethers.formatEther(copyAmount) + ' PLS' : wallet.copyPercentage + '%'}
⚡ Frontrun: ${wallet.frontrun ? '✅ Yes' : '❌ No'}
📈 Copied: ${wallet.totalCopied} trades
    `.trim();
    }
}
exports.CopyTradeManager = CopyTradeManager;
exports.copyTradeManager = new CopyTradeManager();
//# sourceMappingURL=copyTrade.js.map