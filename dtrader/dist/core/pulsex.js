"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pulsex = exports.PulseXService = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const feeManager_1 = require("./feeManager");
class PulseXService {
    provider;
    router;
    factory;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.router = new ethers_1.ethers.Contract(config_1.config.pulsexRouter, config_1.PULSEX_ROUTER_ABI, this.provider);
        this.factory = new ethers_1.ethers.Contract(config_1.config.pulsexFactory, config_1.PULSEX_FACTORY_ABI, this.provider);
    }
    /**
     * Get token info
     */
    async getTokenInfo(tokenAddress) {
        const token = new ethers_1.ethers.Contract(tokenAddress, config_1.ERC20_ABI, this.provider);
        const [name, symbol, decimals, totalSupply] = await Promise.all([
            token.name(),
            token.symbol(),
            token.decimals(),
            token.totalSupply(),
        ]);
        return { address: tokenAddress, name, symbol, decimals, totalSupply };
    }
    /**
     * Get pair address for two tokens
     */
    async getPairAddress(tokenA, tokenB) {
        const pairAddress = await this.factory.getPair(tokenA, tokenB);
        if (pairAddress === ethers_1.ethers.ZeroAddress)
            return null;
        return pairAddress;
    }
    /**
     * Get pair info including reserves
     */
    async getPairInfo(tokenAddress) {
        const pairAddress = await this.getPairAddress(tokenAddress, config_1.config.wpls);
        if (!pairAddress)
            return null;
        const pair = new ethers_1.ethers.Contract(pairAddress, config_1.PULSEX_PAIR_ABI, this.provider);
        const [token0, token1, reserves] = await Promise.all([
            pair.token0(),
            pair.token1(),
            pair.getReserves(),
        ]);
        // Determine which reserve is PLS
        const isToken0Wpls = token0.toLowerCase() === config_1.config.wpls.toLowerCase();
        const liquidityPls = isToken0Wpls ? reserves[0] : reserves[1];
        return {
            pairAddress,
            token0,
            token1,
            reserve0: reserves[0],
            reserve1: reserves[1],
            liquidityPls,
        };
    }
    /**
     * Get swap quote (PLS -> Token)
     */
    async getQuoteBuy(tokenAddress, amountInPls, slippagePercent = 10) {
        const path = [config_1.config.wpls, tokenAddress];
        const amounts = await this.router.getAmountsOut(amountInPls, path);
        const amountOut = amounts[1];
        const slippageMultiplier = BigInt(100 - slippagePercent);
        const amountOutMin = (amountOut * slippageMultiplier) / 100n;
        // Calculate price impact
        const pairInfo = await this.getPairInfo(tokenAddress);
        let priceImpact = 0;
        if (pairInfo) {
            priceImpact = Number(amountInPls * 100n / pairInfo.liquidityPls);
        }
        return {
            amountIn: amountInPls,
            amountOut,
            amountOutMin,
            path,
            priceImpact,
        };
    }
    /**
     * Get swap quote (Token -> PLS)
     */
    async getQuoteSell(tokenAddress, amountInTokens, slippagePercent = 10) {
        const path = [tokenAddress, config_1.config.wpls];
        const amounts = await this.router.getAmountsOut(amountInTokens, path);
        const amountOut = amounts[1];
        const slippageMultiplier = BigInt(100 - slippagePercent);
        const amountOutMin = (amountOut * slippageMultiplier) / 100n;
        return {
            amountIn: amountInTokens,
            amountOut,
            amountOutMin,
            path,
            priceImpact: 0,
        };
    }
    /**
     * Execute buy (PLS -> Token)
     * Collects 1% fee: 0.5% DTGC burn + 0.5% dev wallet
     */
    async executeBuy(wallet, tokenAddress, amountInPls, slippagePercent = 10, gasLimit = config_1.config.trading.defaultGasLimit, useAntiMev = true) {
        try {
            const connectedWallet = wallet.connect(this.provider);
            // Step 1: Collect 1% fee (0.5% burn + 0.5% dev)
            const feeResult = await feeManager_1.feeManager.collectFees(wallet, amountInPls);
            const feeBreakdown = feeManager_1.feeManager.calculateFees(amountInPls);
            const netAmount = feeBreakdown.netAmount; // 99% for actual trade
            if (!feeResult.success) {
                console.log('⚠️ Fee collection failed, proceeding with trade:', feeResult.error);
                // Continue with original amount if fee collection fails
            }
            const tradeAmount = feeResult.success ? netAmount : amountInPls;
            const quote = await this.getQuoteBuy(tokenAddress, tradeAmount, slippagePercent);
            const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
            const routerWithSigner = this.router.connect(connectedWallet);
            // Use fee-on-transfer support for tax tokens
            const tx = await routerWithSigner.swapExactETHForTokensSupportingFeeOnTransferTokens(quote.amountOutMin, quote.path, wallet.address, deadline, {
                value: tradeAmount,
                gasLimit,
            });
            const receipt = await tx.wait();
            return {
                success: true,
                txHash: receipt.hash,
                amountIn: ethers_1.ethers.formatEther(tradeAmount),
                amountOut: ethers_1.ethers.formatUnits(quote.amountOut, 18),
                feeCollected: feeResult.success,
                dtgcBurned: feeResult.dtgcBurned,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Swap failed',
            };
        }
    }
    /**
     * Execute sell (Token -> PLS)
     * Collects 1% fee from proceeds: 0.5% DTGC burn + 0.5% dev wallet
     */
    async executeSell(wallet, tokenAddress, amountInTokens, slippagePercent = 10, gasLimit = config_1.config.trading.defaultGasLimit) {
        try {
            const connectedWallet = wallet.connect(this.provider);
            const quote = await this.getQuoteSell(tokenAddress, amountInTokens, slippagePercent);
            const deadline = Math.floor(Date.now() / 1000) + 300;
            // First approve router
            const token = new ethers_1.ethers.Contract(tokenAddress, config_1.ERC20_ABI, connectedWallet);
            const allowance = await token.allowance(wallet.address, config_1.config.pulsexRouter);
            if (allowance < amountInTokens) {
                const approveTx = await token.approve(config_1.config.pulsexRouter, ethers_1.ethers.MaxUint256);
                await approveTx.wait();
            }
            const routerWithSigner = this.router.connect(connectedWallet);
            const tx = await routerWithSigner.swapExactTokensForETHSupportingFeeOnTransferTokens(amountInTokens, quote.amountOutMin, quote.path, wallet.address, deadline, { gasLimit });
            const receipt = await tx.wait();
            // Get actual PLS received from the swap
            const plsReceived = quote.amountOut; // Estimated, actual may vary
            // Step 2: Collect 1% fee from PLS proceeds (0.5% burn + 0.5% dev)
            let feeCollected = false;
            let dtgcBurned = '0';
            try {
                const feeResult = await feeManager_1.feeManager.collectFees(wallet, plsReceived);
                feeCollected = feeResult.success;
                dtgcBurned = feeResult.dtgcBurned || '0';
            }
            catch (feeError) {
                console.log('⚠️ Fee collection failed on sell:', feeError);
            }
            return {
                success: true,
                txHash: receipt.hash,
                amountIn: ethers_1.ethers.formatUnits(amountInTokens, 18),
                amountOut: ethers_1.ethers.formatEther(quote.amountOut),
                feeCollected,
                dtgcBurned,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Swap failed',
            };
        }
    }
    /**
     * Format price for display
     */
    formatPrice(amountIn, amountOut, decimalsIn, decimalsOut) {
        const price = Number(ethers_1.ethers.formatUnits(amountOut, decimalsOut)) /
            Number(ethers_1.ethers.formatUnits(amountIn, decimalsIn));
        return price.toLocaleString(undefined, { maximumFractionDigits: 8 });
    }
}
exports.PulseXService = PulseXService;
exports.pulsex = new PulseXService();
//# sourceMappingURL=pulsex.js.map