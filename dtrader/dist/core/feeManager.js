"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.feeManager = exports.FeeManager = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
/**
 * Fee Manager
 *
 * 1% total fee on every transaction:
 * - 0.5% Buy & Burn DTGC
 * - 0.5% PLS to fee wallet
 *
 * Fee is deducted from the transaction amount before swap.
 */
const FEE_WALLET = '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c';
const DTGC_TOKEN = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
// Fee percentages (basis points, 100 = 1%)
const TOTAL_FEE_BPS = 100; // 1%
const BURN_FEE_BPS = 50; // 0.5% for DTGC burn
const WALLET_FEE_BPS = 50; // 0.5% to fee wallet
class FeeManager {
    provider;
    router;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.router = new ethers_1.ethers.Contract(config_1.config.pulsexRouter, config_1.PULSEX_ROUTER_ABI, this.provider);
    }
    /**
     * Calculate fee breakdown for a transaction
     */
    calculateFees(amountPls) {
        const feeAmount = (amountPls * BigInt(TOTAL_FEE_BPS)) / 10000n;
        const burnAmount = (amountPls * BigInt(BURN_FEE_BPS)) / 10000n;
        const walletAmount = (amountPls * BigInt(WALLET_FEE_BPS)) / 10000n;
        const netAmount = amountPls - feeAmount;
        return {
            originalAmount: amountPls,
            feeAmount,
            burnAmount,
            walletAmount,
            netAmount,
        };
    }
    /**
     * Execute fee collection and DTGC burn
     * Call this before the actual trade
     */
    async collectFees(wallet, amountPls) {
        const fees = this.calculateFees(amountPls);
        const connectedWallet = wallet.connect(this.provider);
        try {
            // Step 1: Send 0.5% PLS to fee wallet
            const feeTx = await connectedWallet.sendTransaction({
                to: FEE_WALLET,
                value: fees.walletAmount,
                gasLimit: 21000,
            });
            await feeTx.wait();
            // Step 2: Buy DTGC with 0.5% and send to burn address
            const routerWithSigner = this.router.connect(connectedWallet);
            const path = [config_1.config.wpls, DTGC_TOKEN];
            const deadline = Math.floor(Date.now() / 1000) + 300;
            // Get expected DTGC output
            let dtgcAmount = 0n;
            try {
                const amounts = await this.router.getAmountsOut(fees.burnAmount, path);
                dtgcAmount = amounts[1];
            }
            catch {
                // If can't get quote, still proceed
            }
            // Buy DTGC and send directly to burn address
            const burnTx = await routerWithSigner.swapExactETHForTokensSupportingFeeOnTransferTokens(0, // Accept any amount (slippage for fee tx)
            path, BURN_ADDRESS, // Send directly to burn address
            deadline, {
                value: fees.burnAmount,
                gasLimit: 300000,
            });
            const burnReceipt = await burnTx.wait();
            // Parse DTGC amount from logs
            let dtgcBurned = '0';
            for (const log of burnReceipt.logs) {
                try {
                    const iface = new ethers_1.ethers.Interface(config_1.ERC20_ABI);
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    if (parsed?.name === 'Transfer' && log.address.toLowerCase() === DTGC_TOKEN.toLowerCase()) {
                        dtgcBurned = ethers_1.ethers.formatEther(parsed.args[2]);
                    }
                }
                catch { }
            }
            return {
                success: true,
                burnTxHash: burnReceipt.hash,
                feeTxHash: feeTx.hash,
                dtgcBurned,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
            };
        }
    }
    /**
     * Execute trade with fees (all-in-one)
     * Deducts fees first, then executes the actual swap
     */
    async executeWithFees(wallet, tokenAddress, amountPls, slippage, isBuy = true) {
        const fees = this.calculateFees(amountPls);
        // Collect fees first
        const feeResult = await this.collectFees(wallet, amountPls);
        if (!feeResult.success) {
            return {
                feeResult,
                netAmount: 0n,
            };
        }
        // Return net amount for the actual trade
        return {
            feeResult,
            netAmount: fees.netAmount,
        };
    }
    /**
     * Get fee stats (total burned, total collected)
     */
    async getFeeStats() {
        const dtgc = new ethers_1.ethers.Contract(DTGC_TOKEN, config_1.ERC20_ABI, this.provider);
        const burnBalance = await dtgc.balanceOf(BURN_ADDRESS);
        return {
            totalDtgcBurned: ethers_1.ethers.formatEther(burnBalance),
            burnAddressBalance: ethers_1.ethers.formatEther(burnBalance),
        };
    }
    /**
     * Format fee breakdown for display
     */
    formatFeeBreakdown(fees) {
        return `
💰 **Transaction Breakdown**

Original Amount: ${ethers_1.ethers.formatEther(fees.originalAmount)} PLS

**Fees (1% total):**
🔥 DTGC Burn: ${ethers_1.ethers.formatEther(fees.burnAmount)} PLS (0.5%)
💸 Platform Fee: ${ethers_1.ethers.formatEther(fees.walletAmount)} PLS (0.5%)

**Net Amount for Trade:**
${ethers_1.ethers.formatEther(fees.netAmount)} PLS (99%)
    `.trim();
    }
    /**
     * Format fee result for display
     */
    formatFeeResult(result) {
        if (!result.success) {
            return `❌ Fee collection failed: ${result.error}`;
        }
        return `
✅ **Fees Collected**

🔥 DTGC Burned: ${result.dtgcBurned} DTGC
📝 Burn TX: \`${result.burnTxHash?.slice(0, 20)}...\`
💸 Fee TX: \`${result.feeTxHash?.slice(0, 20)}...\`
    `.trim();
    }
}
exports.FeeManager = FeeManager;
exports.feeManager = new FeeManager();
//# sourceMappingURL=feeManager.js.map