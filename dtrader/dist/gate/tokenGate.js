"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenGate = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
// Direct RPC fallback list - no dependency on rpcManager
const RPC_ENDPOINTS = [
    'https://pulsechain.publicnode.com',
    'https://rpc.pulsechain.com',
    'https://rpc-pulsechain.g4mm4.io',
    'http://65.109.68.172:8545', // Hetzner
];
// DTGC/WPLS pair on PulseX V2
const DTGC_WPLS_PAIR = '0x48B837C6AA847D5147f4A44c71108f60dEa0f180';
// PLS price estimate (updated from external source or use DEX)
const PLS_PRICE_USD = 0.00002; // ~$0.00002 per PLS (fallback)
// Fallback DTGC price if we can't fetch from DEX
const FALLBACK_DTGC_PRICE_USD = 0.00001; // Conservative fallback
// PulseX Pair ABI for getting reserves
const PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
];
class TokenGate {
    cachedBalance = new Map();
    cachedPrice = null;
    CACHE_DURATION = 60000; // 1 minute cache
    PRICE_CACHE_DURATION = 300000; // 5 minute price cache
    /**
     * Get DTGC price in USD from PulseX pair
     */
    async getDtgcPriceUsd() {
        // Check price cache
        if (this.cachedPrice && Date.now() - this.cachedPrice.timestamp < this.PRICE_CACHE_DURATION) {
            return this.cachedPrice.price;
        }
        for (const rpcUrl of RPC_ENDPOINTS) {
            try {
                const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
                const pair = new ethers_1.ethers.Contract(DTGC_WPLS_PAIR, PAIR_ABI, provider);
                const [reserves, token0] = await Promise.all([
                    pair.getReserves(),
                    pair.token0(),
                ]);
                const [reserve0, reserve1] = reserves;
                // Figure out which reserve is DTGC and which is WPLS
                const dtgcAddress = config_1.config.tokenGate.dtgc.toLowerCase();
                const isDtgcToken0 = token0.toLowerCase() === dtgcAddress;
                const dtgcReserve = isDtgcToken0 ? reserve0 : reserve1;
                const plsReserve = isDtgcToken0 ? reserve1 : reserve0;
                // Price = PLS per DTGC
                const dtgcPriceInPls = Number(plsReserve) / Number(dtgcReserve);
                const dtgcPriceUsd = dtgcPriceInPls * PLS_PRICE_USD;
                console.log(`💵 DTGC Price: ${dtgcPriceInPls.toFixed(4)} PLS (~$${dtgcPriceUsd.toFixed(8)})`);
                // Cache the price
                this.cachedPrice = { price: dtgcPriceUsd, timestamp: Date.now() };
                return dtgcPriceUsd;
            }
            catch (e) {
                console.log(`⚠️ Price fetch failed from ${rpcUrl}: ${e.message}`);
                continue;
            }
        }
        // All failed - use fallback
        console.log(`⚠️ Using fallback DTGC price: $${FALLBACK_DTGC_PRICE_USD}`);
        return FALLBACK_DTGC_PRICE_USD;
    }
    /**
     * Try to get balance using multiple RPC endpoints
     */
    async getBalanceWithFallback(walletAddress) {
        const errors = [];
        for (const rpcUrl of RPC_ENDPOINTS) {
            try {
                console.log(`🔍 Trying RPC: ${rpcUrl}`);
                const provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl, undefined, {
                    staticNetwork: true,
                });
                // Set timeout
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 8000));
                const dtgcContract = new ethers_1.ethers.Contract(config_1.config.tokenGate.dtgc, config_1.ERC20_ABI, provider);
                // Get balance with timeout
                const balance = await Promise.race([
                    dtgcContract.balanceOf(walletAddress),
                    timeoutPromise
                ]);
                const balanceNum = parseFloat(ethers_1.ethers.formatUnits(balance, 18));
                console.log(`✅ Got balance from ${rpcUrl}: ${balanceNum.toLocaleString()} DTGC`);
                return balanceNum;
            }
            catch (e) {
                const errorMsg = e.message || 'Unknown error';
                console.log(`❌ RPC ${rpcUrl} failed: ${errorMsg}`);
                errors.push(`${rpcUrl}: ${errorMsg}`);
                continue;
            }
        }
        // All RPCs failed
        console.error('All RPC endpoints failed:', errors);
        throw new Error('Could not fetch balance from any RPC');
    }
    /**
     * Check if wallet has enough DTGC for access
     */
    async checkAccess(walletAddress) {
        try {
            // Check cache first
            const cached = this.cachedBalance.get(walletAddress.toLowerCase());
            let balanceNum;
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
                console.log(`📦 Using cached balance for ${walletAddress.slice(0, 8)}...`);
                balanceNum = cached.balance;
            }
            else {
                // Fetch fresh balance
                balanceNum = await this.getBalanceWithFallback(walletAddress);
                // Cache it
                this.cachedBalance.set(walletAddress.toLowerCase(), {
                    balance: balanceNum,
                    timestamp: Date.now()
                });
            }
            // Get live DTGC price and calculate USD value
            const dtgcPrice = await this.getDtgcPriceUsd();
            const balanceUsd = balanceNum * dtgcPrice;
            const required = config_1.config.tokenGate.minHoldUsd;
            console.log(`💰 Wallet ${walletAddress.slice(0, 8)}...: ${balanceNum.toLocaleString()} DTGC (~$${balanceUsd.toFixed(2)})`);
            if (balanceUsd >= required) {
                return {
                    allowed: true,
                    balance: BigInt(Math.floor(balanceNum)),
                    balanceUsd,
                    message: `✅ *Verified!* ${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})`
                };
            }
            const pct = Math.min(100, (balanceUsd / required) * 100);
            const bar = '🟨'.repeat(Math.floor(pct / 10)) + '⬜'.repeat(10 - Math.floor(pct / 10));
            return {
                allowed: false,
                balance: BigInt(Math.floor(balanceNum)),
                balanceUsd,
                message: `🔐 *Token Gate Required*\n━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Your Balance:*\n\`${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})\`\n\n${bar} ${pct.toFixed(0)}%\n\n💰 Required: \`$${required}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n\n⚜️ [Buy DTGC](https://dtgc.io/gold)\n\n📋 \`${config_1.config.tokenGate.dtgc}\`\n\n_Tap 🔄 Refresh after buying_`
            };
        }
        catch (e) {
            console.error('Token gate check failed:', e.message);
            return {
                allowed: false,
                balance: 0n,
                balanceUsd: 0,
                message: `⚠️ *Could not verify balance*\n\nRPC error - please try again in a moment.\n\n_Error: ${e.message?.slice(0, 50) || 'Unknown'}_`
            };
        }
    }
    /**
     * Force refresh balance for a wallet
     */
    async refreshBalance(walletAddress) {
        // Clear cache for this wallet
        this.cachedBalance.delete(walletAddress.toLowerCase());
        return this.checkAccess(walletAddress);
    }
    fmt(v) {
        if (v >= 1e9)
            return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6)
            return (v / 1e6).toFixed(2) + 'M';
        if (v >= 1e3)
            return (v / 1e3).toFixed(2) + 'K';
        return v.toFixed(2);
    }
    getGateKeyboard() {
        return {
            inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'gate_refresh' }],
                [{ text: '⚜️ Buy DTGC', url: 'https://dtgc.io/gold' }],
                [{ text: '🔙 Back', callback_data: 'main_menu' }]
            ]
        };
    }
}
exports.tokenGate = new TokenGate();
//# sourceMappingURL=tokenGate.js.map