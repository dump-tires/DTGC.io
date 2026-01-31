"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graduationSniper = exports.GraduationSniper = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const pulsex_1 = require("../core/pulsex");
const events_1 = require("events");
/**
 * pump.tires Graduation Sniper
 *
 * Monitors tokens on the bonding curve and automatically buys when they
 * graduate to PulseX (at 200M PLS liquidity threshold).
 *
 * Two sniping strategies:
 * 1. Pre-graduation: Watch specific tokens approaching graduation
 * 2. Instant-bond: Catch any token that graduates (instabonds)
 */
// pump.tires bonding curve ABI (partial - adjust based on actual contract)
const PUMP_TIRES_ABI = [
    'event TokenCreated(address indexed token, address indexed creator, string name, string symbol)',
    'event TokenGraduated(address indexed token, address indexed pair, uint256 liquidity)',
    'event Trade(address indexed token, address indexed trader, bool isBuy, uint256 plsAmount, uint256 tokenAmount, uint256 newPrice)',
    'function getTokenState(address token) view returns (uint256 plsRaised, uint256 tokensSold, bool graduated, address pair)',
    'function graduationThreshold() view returns (uint256)',
];
class GraduationSniper extends events_1.EventEmitter {
    provider;
    wsProvider = null;
    pumpTiresContract = null;
    watchedTokens = new Map();
    isListening = false;
    graduationThreshold = BigInt('200000000000000000000000000'); // 200M PLS default
    constructor() {
        super();
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        if (config_1.config.pumpTires.contract) {
            this.pumpTiresContract = new ethers_1.ethers.Contract(config_1.config.pumpTires.contract, PUMP_TIRES_ABI, this.provider);
        }
    }
    /**
     * Initialize WebSocket connection for real-time events
     */
    async connect() {
        if (this.wsProvider)
            return;
        try {
            this.wsProvider = new ethers_1.ethers.WebSocketProvider(config_1.config.wss);
            console.log('🔌 Connected to PulseChain WebSocket');
            // Reconnect on disconnect
            this.wsProvider.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.reconnect();
            });
            if (this.pumpTiresContract) {
                // Get graduation threshold
                try {
                    this.graduationThreshold = await this.pumpTiresContract.graduationThreshold();
                }
                catch {
                    console.log('Using default graduation threshold');
                }
            }
        }
        catch (error) {
            console.error('Failed to connect WebSocket:', error);
        }
    }
    async reconnect() {
        this.wsProvider = null;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        await this.connect();
        if (this.isListening) {
            await this.startListening();
        }
    }
    /**
     * Get current state of a token on the bonding curve
     */
    async getTokenState(tokenAddress) {
        if (!this.pumpTiresContract)
            return null;
        try {
            const [plsRaised, tokensSold, graduated, pair] = await this.pumpTiresContract.getTokenState(tokenAddress);
            const token = new ethers_1.ethers.Contract(tokenAddress, [
                'function name() view returns (string)',
                'function symbol() view returns (string)',
            ], this.provider);
            const [name, symbol] = await Promise.all([token.name(), token.symbol()]);
            const percentToGraduation = Number(plsRaised * 100n / this.graduationThreshold);
            return {
                address: tokenAddress,
                name,
                symbol,
                plsRaised,
                percentToGraduation: Math.min(percentToGraduation, 100),
                graduated,
                pairAddress: pair !== ethers_1.ethers.ZeroAddress ? pair : undefined,
            };
        }
        catch (error) {
            console.error('Failed to get token state:', error);
            return null;
        }
    }
    /**
     * Watch a specific token for graduation
     */
    watchToken(tokenAddress, config) {
        this.watchedTokens.set(tokenAddress.toLowerCase(), {
            ...config,
            tokenAddress,
        });
        this.emit('tokenWatched', tokenAddress);
    }
    /**
     * Stop watching a token
     */
    unwatchToken(tokenAddress) {
        this.watchedTokens.delete(tokenAddress.toLowerCase());
    }
    /**
     * Start listening for graduation events
     */
    async startListening() {
        if (!this.wsProvider) {
            console.log('⚠️ WebSocket not connected - graduation sniper will use polling mode');
            // Start polling mode as fallback
            this.startPollingMode();
            return;
        }
        if (!this.pumpTiresContract) {
            console.log('⚠️ pump.tires contract not configured - set PUMP_TIRES_CONTRACT env var');
            return;
        }
        this.isListening = true;
        const contractWithWs = this.pumpTiresContract.connect(this.wsProvider);
        // Listen for graduation events (tokens hitting 200M PLS and going to PulseX)
        contractWithWs.on('TokenGraduated', async (token, pair, liquidity) => {
            console.log(`🎓 Token graduated: ${token} -> Pair: ${pair}`);
            this.emit('graduation', { token, pair, liquidity });
            // Check if we're watching this token
            const watchConfig = this.watchedTokens.get(token.toLowerCase());
            if (watchConfig) {
                await this.executeSnipe(token, watchConfig);
            }
        });
        // Listen for new token creations (for auto-snipe all graduations mode)
        contractWithWs.on('TokenCreated', async (token, creator, name, symbol) => {
            console.log(`🆕 New token: ${name} (${symbol}) - ${token}`);
            this.emit('newToken', { token, creator, name, symbol });
        });
        // Listen for trades to track tokens approaching graduation
        contractWithWs.on('Trade', async (token, trader, isBuy, plsAmount) => {
            const state = await this.getTokenState(token);
            if (state && state.percentToGraduation >= 90) {
                console.log(`🔥 Token ${state.symbol} at ${state.percentToGraduation}% to graduation!`);
                this.emit('nearGraduation', state);
            }
        });
        console.log('👀 Listening for pump.tires graduations...');
    }
    /**
     * Stop listening
     */
    stopListening() {
        this.isListening = false;
        if (this.pumpTiresContract) {
            this.pumpTiresContract.removeAllListeners();
        }
    }
    /**
     * Execute snipe buy on graduation
     */
    async executeSnipe(tokenAddress, snipeConfig) {
        try {
            console.log(`🎯 Sniping ${tokenAddress}...`);
            this.emit('sniping', tokenAddress);
            // Wait a tiny bit for liquidity to be fully added
            await new Promise((resolve) => setTimeout(resolve, 100));
            // Get pair info to confirm liquidity exists
            const pairInfo = await pulsex_1.pulsex.getPairInfo(tokenAddress);
            if (!pairInfo) {
                return {
                    success: false,
                    tokenAddress,
                    error: 'No liquidity pair found',
                };
            }
            // Execute the buy
            // Note: We need the wallet here - this will be passed from the bot
            this.emit('snipeReady', {
                tokenAddress,
                pairInfo,
                config: snipeConfig,
            });
            return {
                success: true,
                tokenAddress,
                amountPls: ethers_1.ethers.formatEther(snipeConfig.amountPls),
            };
        }
        catch (error) {
            return {
                success: false,
                tokenAddress,
                error: error.message,
            };
        }
    }
    /**
     * Snipe all graduating tokens (aggressive mode)
     */
    async enableAutoSnipe(defaultConfig) {
        if (!this.wsProvider || !this.pumpTiresContract) {
            await this.connect();
        }
        const contractWithWs = this.pumpTiresContract.connect(this.wsProvider);
        contractWithWs.on('TokenGraduated', async (token, pair) => {
            console.log(`🚀 Auto-sniping graduated token: ${token}`);
            await this.executeSnipe(token, defaultConfig);
        });
        console.log('🤖 Auto-snipe mode enabled for all graduating tokens');
    }
    /**
     * Format token state for display
     */
    formatTokenState(state) {
        const plsFormatted = ethers_1.ethers.formatEther(state.plsRaised);
        const progressBar = this.createProgressBar(state.percentToGraduation);
        return `
🪙 ${state.name} (${state.symbol})
📍 ${state.address}

💰 Raised: ${Number(plsFormatted).toLocaleString()} PLS
📊 Progress: ${progressBar} ${state.percentToGraduation.toFixed(1)}%
${state.graduated ? '✅ GRADUATED' : '⏳ On bonding curve'}
${state.pairAddress ? `🔗 Pair: ${state.pairAddress}` : ''}
    `.trim();
    }
    createProgressBar(percent) {
        const filled = Math.floor(percent / 10);
        const empty = 10 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    /**
     * Fallback polling mode when WebSocket is unavailable
     * Checks watched tokens periodically for graduation
     */
    pollingInterval = null;
    startPollingMode() {
        if (this.pollingInterval)
            return;
        console.log('📊 Starting graduation sniper in polling mode (every 10s)');
        this.pollingInterval = setInterval(async () => {
            for (const [tokenAddress, config] of this.watchedTokens) {
                try {
                    const state = await this.getTokenState(tokenAddress);
                    if (state && state.graduated && state.pairAddress) {
                        console.log(`🎓 Token graduated (polling): ${state.symbol}`);
                        this.emit('graduation', {
                            token: tokenAddress,
                            pair: state.pairAddress,
                            liquidity: state.plsRaised,
                        });
                        await this.executeSnipe(tokenAddress, config);
                    }
                    else if (state && state.percentToGraduation >= 90) {
                        this.emit('nearGraduation', state);
                    }
                }
                catch (error) {
                    // Silently continue on individual token errors
                }
            }
        }, 10000);
    }
    stopPollingMode() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    /**
     * Close connections
     */
    async disconnect() {
        this.stopListening();
        this.stopPollingMode();
        if (this.wsProvider) {
            await this.wsProvider.destroy();
            this.wsProvider = null;
        }
    }
}
exports.GraduationSniper = GraduationSniper;
exports.graduationSniper = new GraduationSniper();
//# sourceMappingURL=graduation.js.map