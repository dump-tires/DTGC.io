"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenGate = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
// Stablecoin addresses on PulseChain for PLS/USD price
const DAI_ADDRESS = '0xefD766cCb38EaF1dfd701853BFCe31359239F305'; // DAI on PulseChain
const USDC_ADDRESS = '0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07'; // USDC on PulseChain
class TokenGate {
    provider;
    dtgcContract;
    router;
    factory;
    cachedDtgcPrice = 0;
    cacheTimestamp = 0;
    CACHE_DURATION = 60000; // 1 minute cache
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.dtgcContract = new ethers_1.ethers.Contract(config_1.config.tokenGate.dtgc, config_1.ERC20_ABI, this.provider);
        this.router = new ethers_1.ethers.Contract(config_1.config.pulsexRouter, config_1.PULSEX_ROUTER_ABI, this.provider);
        this.factory = new ethers_1.ethers.Contract(config_1.config.pulsexFactory, config_1.PULSEX_FACTORY_ABI, this.provider);
    }
    /**
     * Get DTGC price in USD by checking PulseX pair
     * Uses: DTGC -> WPLS -> DAI/USDC path
     */
    async getDtgcPriceUsd() {
        // Return cached price if still valid
        if (this.cachedDtgcPrice > 0 && Date.now() - this.cacheTimestamp < this.CACHE_DURATION) {
            return this.cachedDtgcPrice;
        }
        try {
            // Get DTGC price in PLS first
            const oneDtgc = ethers_1.ethers.parseUnits('1', 18); // 1 DTGC
            // Try to get DTGC -> WPLS quote
            let dtgcPriceInPls = 0;
            try {
                const dtgcToPlsPath = [config_1.config.tokenGate.dtgc, config_1.config.wpls];
                const amounts = await this.router.getAmountsOut(oneDtgc, dtgcToPlsPath);
                dtgcPriceInPls = parseFloat(ethers_1.ethers.formatEther(amounts[1]));
            }
            catch (e) {
                console.log('DTGC->PLS direct path failed, trying pair reserves...');
                // Fallback: Use pair reserves
                const pairAddress = await this.factory.getPair(config_1.config.tokenGate.dtgc, config_1.config.wpls);
                if (pairAddress && pairAddress !== ethers_1.ethers.ZeroAddress) {
                    const pair = new ethers_1.ethers.Contract(pairAddress, config_1.PULSEX_PAIR_ABI, this.provider);
                    const [token0, reserves] = await Promise.all([pair.token0(), pair.getReserves()]);
                    const isDtgcToken0 = token0.toLowerCase() === config_1.config.tokenGate.dtgc.toLowerCase();
                    const dtgcReserve = isDtgcToken0 ? reserves[0] : reserves[1];
                    const plsReserve = isDtgcToken0 ? reserves[1] : reserves[0];
                    dtgcPriceInPls = parseFloat(ethers_1.ethers.formatEther(plsReserve)) / parseFloat(ethers_1.ethers.formatEther(dtgcReserve));
                }
            }
            if (dtgcPriceInPls <= 0) {
                console.log('Could not get DTGC/PLS price, using fallback');
                return 0.0004; // Fallback estimate
            }
            // Now get PLS price in USD using DAI or USDC pair
            let plsPriceUsd = 0;
            const onePls = ethers_1.ethers.parseEther('1000000'); // Use 1M PLS for better precision
            // Try DAI first
            try {
                const plsToDaiPath = [config_1.config.wpls, DAI_ADDRESS];
                const daiAmounts = await this.router.getAmountsOut(onePls, plsToDaiPath);
                plsPriceUsd = parseFloat(ethers_1.ethers.formatUnits(daiAmounts[1], 18)) / 1000000; // Price per 1 PLS
            }
            catch (e) {
                // Try USDC
                try {
                    const plsToUsdcPath = [config_1.config.wpls, USDC_ADDRESS];
                    const usdcAmounts = await this.router.getAmountsOut(onePls, plsToUsdcPath);
                    plsPriceUsd = parseFloat(ethers_1.ethers.formatUnits(usdcAmounts[1], 6)) / 1000000; // USDC has 6 decimals
                }
                catch (e2) {
                    console.log('Could not get PLS/USD price, using fallback');
                    plsPriceUsd = 0.000018; // Fallback PLS price estimate
                }
            }
            // Calculate DTGC price in USD
            const dtgcPriceUsd = dtgcPriceInPls * plsPriceUsd;
            // Cache the result
            this.cachedDtgcPrice = dtgcPriceUsd;
            this.cacheTimestamp = Date.now();
            console.log(`📊 DTGC Price: $${dtgcPriceUsd.toFixed(8)} (${dtgcPriceInPls.toFixed(4)} PLS @ $${plsPriceUsd.toFixed(8)}/PLS)`);
            return dtgcPriceUsd;
        }
        catch (error) {
            console.error('Error fetching DTGC price:', error);
            return 0.0004; // Fallback
        }
    }
    async checkAccess(walletAddress) {
        try {
            const balance = await this.dtgcContract.balanceOf(walletAddress);
            const decimals = await this.dtgcContract.decimals();
            const balanceNum = parseFloat(ethers_1.ethers.formatUnits(balance, decimals));
            // Fetch REAL price from PulseX instead of hardcoded
            const price = await this.getDtgcPriceUsd();
            const balanceUsd = balanceNum * price;
            const required = config_1.config.tokenGate.minHoldUsd;
            if (balanceUsd >= required) {
                return { allowed: true, balance, balanceUsd, message: `✅ *Verified!* ${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})` };
            }
            const pct = Math.min(100, (balanceUsd / required) * 100);
            const bar = '🟨'.repeat(Math.floor(pct / 10)) + '⬜'.repeat(10 - Math.floor(pct / 10));
            return { allowed: false, balance, balanceUsd, message: `🔐 *Token Gate Required*\n━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Your Balance:*\n\`${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})\`\n\n${bar} ${pct.toFixed(0)}%\n\n💰 Required: \`$${required}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n\n⚜️ [Buy DTGC](https://dtgc.io/gold)\n\n📋 \`${config_1.config.tokenGate.dtgc}\`\n\n_Tap 🔄 Refresh after buying_` };
        }
        catch (e) {
            return { allowed: false, balance: 0n, balanceUsd: 0, message: '❌ Verification failed. Try again.' };
        }
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
        return { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'gate_refresh' }], [{ text: '⚜️ Buy DTGC', url: 'https://dtgc.io/gold' }], [{ text: '🔙 Back', callback_data: 'main_menu' }]] };
    }
}
exports.tokenGate = new TokenGate();
//# sourceMappingURL=tokenGate.js.map