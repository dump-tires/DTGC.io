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
exports.limitOrderEngine = exports.LimitOrderEngine = void 0;
const ethers_1 = require("ethers");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config");
const pulsex_1 = require("../core/pulsex");
const events_1 = require("events");
// JSON Storage for Limit Orders
class LimitOrderStore {
    filePath;
    data;
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, 'limitOrders.json');
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
        return this.data.filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    }
    findActive() {
        return this.data.filter(o => o.status === 'active');
    }
    findActiveByToken(tokenAddress) {
        return this.data.filter(o => o.status === 'active' && o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
    }
    getDistinctActiveTokens() {
        const tokens = new Set();
        this.data.filter(o => o.status === 'active').forEach(o => tokens.add(o.tokenAddress.toLowerCase()));
        return Array.from(tokens);
    }
    insert(order) {
        this.data.push(order);
        this.save();
    }
    update(orderId, updates) {
        const idx = this.data.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            this.data[idx] = { ...this.data[idx], ...updates };
            this.save();
        }
    }
    cancel(orderId, userId) {
        const idx = this.data.findIndex(o => o.id === orderId && o.userId === userId && o.status === 'active');
        if (idx !== -1) {
            this.data[idx].status = 'cancelled';
            this.save();
            return true;
        }
        return false;
    }
}
// JSON Storage for DCA Orders
class DCAOrderStore {
    filePath;
    data;
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, 'dcaOrders.json');
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
        return this.data.filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
    }
    findDue(now) {
        return this.data.filter(o => o.status === 'active' && o.nextBuyAt <= now);
    }
    findById(orderId) {
        return this.data.find(o => o.id === orderId);
    }
    insert(order) {
        this.data.push(order);
        this.save();
    }
    update(orderId, updates) {
        const idx = this.data.findIndex(o => o.id === orderId);
        if (idx !== -1) {
            this.data[idx] = { ...this.data[idx], ...updates };
            this.save();
        }
    }
    cancel(orderId, userId) {
        const idx = this.data.findIndex(o => o.id === orderId && o.userId === userId && o.status === 'active');
        if (idx !== -1) {
            this.data[idx].status = 'cancelled';
            this.save();
            return true;
        }
        return false;
    }
}
class LimitOrderEngine extends events_1.EventEmitter {
    provider;
    orderStore;
    dcaStore;
    isRunning = false;
    priceCheckInterval = null;
    dcaCheckInterval = null;
    priceCache = new Map();
    constructor() {
        super();
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.orderStore = new LimitOrderStore();
        this.dcaStore = new DCAOrderStore();
    }
    /**
     * Create a limit order
     */
    async createOrder(params) {
        const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newOrder = {
            id,
            userId: params.userId,
            walletAddress: params.walletAddress,
            tokenAddress: params.tokenAddress,
            orderType: params.orderType,
            targetPrice: params.targetPrice.toString(),
            amount: params.amount.toString(),
            slippage: params.slippage,
            status: 'active',
            createdAt: Date.now(),
            expiresAt: params.expiresAt,
        };
        this.orderStore.insert(newOrder);
        this.emit('orderCreated', newOrder);
        return newOrder;
    }
    /**
     * Create a DCA order
     */
    async createDCAOrder(params) {
        const id = `dca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const amountPerBuy = params.totalAmountPls / BigInt(params.numberOfBuys);
        const order = {
            id,
            userId: params.userId,
            walletAddress: params.walletAddress,
            tokenAddress: params.tokenAddress,
            intervalSeconds: params.intervalSeconds,
            totalBuys: params.numberOfBuys,
            completedBuys: 0,
            amountPerBuy: amountPerBuy.toString(),
            slippage: params.slippage,
            status: 'active',
            nextBuyAt: Date.now(),
            minPrice: params.minPrice?.toString(),
            maxPrice: params.maxPrice?.toString(),
            createdAt: Date.now(),
        };
        this.dcaStore.insert(order);
        this.emit('dcaCreated', order);
        return order;
    }
    /**
     * Cancel an order
     */
    cancelOrder(orderId, userId) {
        const result = this.orderStore.cancel(orderId, userId);
        if (result) {
            this.emit('orderCancelled', orderId);
        }
        return result;
    }
    /**
     * Cancel DCA order
     */
    cancelDCAOrder(orderId, userId) {
        return this.dcaStore.cancel(orderId, userId);
    }
    /**
     * Get user's orders
     */
    getUserOrders(userId) {
        return this.orderStore.findByUser(userId);
    }
    /**
     * Get user's DCA orders
     */
    getUserDCAOrders(userId) {
        return this.dcaStore.findByUser(userId);
    }
    /**
     * Get current token price
     */
    async getTokenPrice(tokenAddress) {
        try {
            const pairInfo = await pulsex_1.pulsex.getPairInfo(tokenAddress);
            if (!pairInfo)
                return null;
            const token = new ethers_1.ethers.Contract(tokenAddress, config_1.ERC20_ABI, this.provider);
            const decimals = await token.decimals();
            // Get price of 1 token in PLS
            const oneToken = ethers_1.ethers.parseUnits('1', decimals);
            const quote = await pulsex_1.pulsex.getQuoteSell(tokenAddress, oneToken, 0);
            const priceData = {
                token: tokenAddress,
                priceInPls: quote.amountOut,
                liquidityPls: pairInfo.liquidityPls,
                timestamp: Date.now(),
            };
            this.priceCache.set(tokenAddress.toLowerCase(), priceData);
            return priceData;
        }
        catch (error) {
            console.error(`Failed to get price for ${tokenAddress}:`, error);
            return null;
        }
    }
    /**
     * Check if order should execute
     */
    shouldExecute(order, currentPrice) {
        const targetPrice = BigInt(order.targetPrice);
        switch (order.orderType) {
            case 'limit_buy':
                // Buy when price drops to or below target
                return currentPrice <= targetPrice;
            case 'limit_sell':
                // Sell when price rises to or above target
                return currentPrice >= targetPrice;
            case 'stop_loss':
                // Sell when price drops to or below target
                return currentPrice <= targetPrice;
            case 'take_profit':
                // Sell when price rises to or above target
                return currentPrice >= targetPrice;
            default:
                return false;
        }
    }
    /**
     * Start the order engine
     */
    async start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('⚡ Limit order engine started');
        // Check prices every 5 seconds
        this.priceCheckInterval = setInterval(() => this.checkPrices(), 5000);
        // Check DCA orders every 10 seconds
        this.dcaCheckInterval = setInterval(() => this.checkDCAOrders(), 10000);
        // Initial check
        await this.checkPrices();
        await this.checkDCAOrders();
    }
    /**
     * Check prices and execute orders
     */
    async checkPrices() {
        const activeTokens = this.orderStore.getDistinctActiveTokens();
        for (const tokenAddress of activeTokens) {
            const priceData = await this.getTokenPrice(tokenAddress);
            if (!priceData)
                continue;
            const ordersForToken = this.orderStore.findActiveByToken(tokenAddress);
            for (const order of ordersForToken) {
                // Check expiry
                if (order.expiresAt && Date.now() > order.expiresAt) {
                    this.orderStore.update(order.id, { status: 'expired' });
                    this.emit('orderExpired', order);
                    continue;
                }
                if (this.shouldExecute(order, priceData.priceInPls)) {
                    this.emit('orderTriggered', { order, priceData });
                }
            }
        }
    }
    /**
     * Check and execute DCA orders
     */
    async checkDCAOrders() {
        const now = Date.now();
        const dueOrders = this.dcaStore.findDue(now);
        for (const order of dueOrders) {
            // Check price bounds if set
            const priceData = await this.getTokenPrice(order.tokenAddress);
            if (priceData) {
                if (order.minPrice && priceData.priceInPls < BigInt(order.minPrice)) {
                    console.log(`DCA ${order.id}: Price below min, skipping`);
                    continue;
                }
                if (order.maxPrice && priceData.priceInPls > BigInt(order.maxPrice)) {
                    console.log(`DCA ${order.id}: Price above max, skipping`);
                    continue;
                }
            }
            this.emit('dcaTriggered', order);
        }
    }
    /**
     * Mark order as filled
     */
    markOrderFilled(orderId, txHash) {
        this.orderStore.update(orderId, { status: 'filled', filledAt: Date.now(), txHash });
    }
    /**
     * Mark order as failed
     */
    markOrderFailed(orderId, error) {
        this.orderStore.update(orderId, { status: 'failed', error });
    }
    /**
     * Update DCA after successful buy
     */
    updateDCAAfterBuy(orderId) {
        const order = this.dcaStore.findById(orderId);
        if (!order)
            return;
        const newCompletedBuys = order.completedBuys + 1;
        const isComplete = newCompletedBuys >= order.totalBuys;
        this.dcaStore.update(orderId, {
            completedBuys: newCompletedBuys,
            nextBuyAt: Date.now() + (order.intervalSeconds * 1000),
            status: isComplete ? 'filled' : 'active',
        });
    }
    /**
     * Stop the engine
     */
    stop() {
        this.isRunning = false;
        if (this.priceCheckInterval) {
            clearInterval(this.priceCheckInterval);
            this.priceCheckInterval = null;
        }
        if (this.dcaCheckInterval) {
            clearInterval(this.dcaCheckInterval);
            this.dcaCheckInterval = null;
        }
        console.log('🛑 Limit order engine stopped');
    }
    /**
     * Format order for display
     */
    formatOrder(order) {
        const typeEmoji = {
            limit_buy: '🟢',
            limit_sell: '🔴',
            stop_loss: '🛑',
            take_profit: '💰',
            dca: '📊',
        };
        return `
${typeEmoji[order.orderType]} ${order.orderType.replace('_', ' ').toUpperCase()}
Token: ${order.tokenAddress.slice(0, 10)}...
Target: ${ethers_1.ethers.formatEther(BigInt(order.targetPrice))} PLS
Amount: ${ethers_1.ethers.formatEther(BigInt(order.amount))}
Status: ${order.status}
    `.trim();
    }
}
exports.LimitOrderEngine = LimitOrderEngine;
exports.limitOrderEngine = new LimitOrderEngine();
//# sourceMappingURL=limitOrder.js.map