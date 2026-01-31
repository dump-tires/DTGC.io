"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mempoolSniper = exports.MempoolSniper = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const pulsex_1 = require("../core/pulsex");
const events_1 = require("events");
class MempoolSniper extends events_1.EventEmitter {
    httpProvider;
    wsProvider = null;
    factory;
    targets = new Map(); // token -> snipe configs
    isRunning = false;
    processedPairs = new Set();
    constructor() {
        super();
        this.httpProvider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.factory = new ethers_1.ethers.Contract(config_1.config.pulsexFactory, config_1.PULSEX_FACTORY_ABI, this.httpProvider);
    }
    /**
     * Connect to WebSocket for real-time monitoring
     */
    async connect() {
        try {
            this.wsProvider = new ethers_1.ethers.WebSocketProvider(config_1.config.wss);
            this.wsProvider.on('error', (error) => {
                console.error('WS Error:', error);
                this.reconnect();
            });
            console.log('🔌 Mempool sniper connected');
        }
        catch (error) {
            console.error('Connection failed:', error);
        }
    }
    async reconnect() {
        this.wsProvider = null;
        await new Promise((r) => setTimeout(r, 3000));
        await this.connect();
        if (this.isRunning)
            await this.start();
    }
    /**
     * Add a token to snipe when liquidity is added
     */
    addTarget(target) {
        const key = target.tokenAddress.toLowerCase();
        const existing = this.targets.get(key) || [];
        existing.push(target);
        this.targets.set(key, existing);
        console.log(`🎯 Added snipe target: ${target.tokenAddress}`);
    }
    /**
     * Remove snipe target
     */
    removeTarget(tokenAddress, userId) {
        const key = tokenAddress.toLowerCase();
        const targets = this.targets.get(key);
        if (!targets)
            return false;
        const filtered = targets.filter((t) => t.userId !== userId);
        if (filtered.length === 0) {
            this.targets.delete(key);
        }
        else {
            this.targets.set(key, filtered);
        }
        return true;
    }
    /**
     * Start monitoring
     */
    async start() {
        if (!this.wsProvider)
            await this.connect();
        if (!this.wsProvider) {
            console.error('No WebSocket connection');
            return;
        }
        this.isRunning = true;
        // Method 1: Watch PairCreated events
        await this.watchPairCreated();
        // Method 2: Monitor pending transactions (mempool)
        await this.watchMempool();
        console.log('👀 Mempool sniper active');
    }
    /**
     * Watch for new pair creations on PulseX
     */
    async watchPairCreated() {
        const factoryWs = this.factory.connect(this.wsProvider);
        factoryWs.on('PairCreated', async (token0, token1, pair) => {
            // Skip if already processed
            if (this.processedPairs.has(pair))
                return;
            this.processedPairs.add(pair);
            console.log(`\n🆕 New Pair Created!`);
            console.log(`   Token0: ${token0}`);
            console.log(`   Token1: ${token1}`);
            console.log(`   Pair: ${pair}`);
            const event = {
                type: 'pairCreated',
                token0,
                token1,
                pairAddress: pair,
            };
            this.emit('pairCreated', event);
            // Check if either token is a target
            await this.checkAndSnipe(token0, event);
            await this.checkAndSnipe(token1, event);
        });
    }
    /**
     * Watch pending transactions for addLiquidity calls
     */
    async watchMempool() {
        // Subscribe to pending transactions
        this.wsProvider.on('pending', async (txHash) => {
            try {
                const tx = await this.httpProvider.getTransaction(txHash);
                if (!tx || !tx.to)
                    return;
                // Check if it's a router transaction
                if (tx.to.toLowerCase() !== config_1.config.pulsexRouter.toLowerCase())
                    return;
                // Decode the transaction data
                const decoded = this.decodeRouterTx(tx.data);
                if (!decoded)
                    return;
                if (decoded.method === 'addLiquidity' || decoded.method === 'addLiquidityETH') {
                    console.log(`\n⏳ Pending liquidity add detected!`);
                    console.log(`   TxHash: ${txHash}`);
                    console.log(`   Token: ${decoded.token}`);
                    this.emit('pendingLiquidity', {
                        txHash,
                        token: decoded.token,
                        amount: decoded.amount,
                    });
                    // Front-run opportunity - check if target
                    const targets = this.targets.get(decoded.token.toLowerCase());
                    if (targets && targets.length > 0) {
                        this.emit('snipeOpportunity', {
                            txHash,
                            token: decoded.token,
                            targets,
                        });
                    }
                }
            }
            catch {
                // Ignore decode errors
            }
        });
    }
    /**
     * Decode router transaction
     */
    decodeRouterTx(data) {
        try {
            const iface = new ethers_1.ethers.Interface([
                'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline)',
                'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline)',
            ]);
            const parsed = iface.parseTransaction({ data });
            if (!parsed)
                return null;
            if (parsed.name === 'addLiquidityETH') {
                return {
                    method: 'addLiquidityETH',
                    token: parsed.args[0],
                    amount: parsed.args[1],
                };
            }
            if (parsed.name === 'addLiquidity') {
                return {
                    method: 'addLiquidity',
                    token: parsed.args[0],
                    amount: parsed.args[2],
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Check if token is a target and trigger snipe
     */
    async checkAndSnipe(tokenAddress, event) {
        const key = tokenAddress.toLowerCase();
        const targets = this.targets.get(key);
        if (!targets || targets.length === 0)
            return;
        // Wait briefly for liquidity to be confirmed
        await new Promise((r) => setTimeout(r, 500));
        // Verify liquidity exists
        const pairInfo = await pulsex_1.pulsex.getPairInfo(tokenAddress);
        if (!pairInfo) {
            console.log(`⚠️ No liquidity found yet for ${tokenAddress}`);
            return;
        }
        // Check minimum liquidity requirement
        for (const target of targets) {
            if (pairInfo.liquidityPls >= target.minLiquidityPls) {
                console.log(`\n🎯 SNIPE TARGET DETECTED!`);
                console.log(`   Token: ${tokenAddress}`);
                console.log(`   Liquidity: ${ethers_1.ethers.formatEther(pairInfo.liquidityPls)} PLS`);
                this.emit('executeSnipe', {
                    target,
                    pairInfo,
                    event,
                });
            }
        }
    }
    /**
     * Monitor a specific pair for liquidity changes
     */
    async watchPair(pairAddress, callback) {
        const pair = new ethers_1.ethers.Contract(pairAddress, config_1.PULSEX_PAIR_ABI, this.wsProvider);
        pair.on('Sync', (reserve0, reserve1) => {
            callback(reserve0, reserve1);
        });
        pair.on('Mint', (sender, amount0, amount1) => {
            console.log(`💧 Liquidity added to ${pairAddress}`);
            this.emit('liquidityAdded', { pairAddress, amount0, amount1 });
        });
    }
    /**
     * Get recent pairs
     */
    async getRecentPairs(count = 10) {
        const totalPairs = await this.factory.allPairsLength();
        const pairs = [];
        for (let i = 0; i < Math.min(count, Number(totalPairs)); i++) {
            const pairAddress = await this.factory.allPairs(Number(totalPairs) - 1 - i);
            pairs.push(pairAddress);
        }
        return pairs;
    }
    /**
     * Stop monitoring
     */
    stop() {
        this.isRunning = false;
        this.factory.removeAllListeners();
        if (this.wsProvider) {
            this.wsProvider.removeAllListeners('pending');
        }
        console.log('🛑 Mempool sniper stopped');
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
}
exports.MempoolSniper = MempoolSniper;
exports.mempoolSniper = new MempoolSniper();
//# sourceMappingURL=mempool.js.map