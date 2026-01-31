import { ethers } from 'ethers';
interface FeeBreakdown {
    originalAmount: bigint;
    feeAmount: bigint;
    burnAmount: bigint;
    walletAmount: bigint;
    netAmount: bigint;
}
interface FeeResult {
    success: boolean;
    burnTxHash?: string;
    feeTxHash?: string;
    dtgcBurned?: string;
    error?: string;
}
export declare class FeeManager {
    private provider;
    private router;
    constructor();
    /**
     * Calculate fee breakdown for a transaction
     */
    calculateFees(amountPls: bigint): FeeBreakdown;
    /**
     * Execute fee collection and DTGC burn
     * Call this before the actual trade
     */
    collectFees(wallet: ethers.Wallet, amountPls: bigint): Promise<FeeResult>;
    /**
     * Execute trade with fees (all-in-one)
     * Deducts fees first, then executes the actual swap
     */
    executeWithFees(wallet: ethers.Wallet, tokenAddress: string, amountPls: bigint, slippage: number, isBuy?: boolean): Promise<{
        feeResult: FeeResult;
        tradeResult?: any;
        netAmount: bigint;
    }>;
    /**
     * Get fee stats (total burned, total collected)
     */
    getFeeStats(): Promise<{
        totalDtgcBurned: string;
        burnAddressBalance: string;
    }>;
    /**
     * Format fee breakdown for display
     */
    formatFeeBreakdown(fees: FeeBreakdown): string;
    /**
     * Format fee result for display
     */
    formatFeeResult(result: FeeResult): string;
}
export declare const feeManager: FeeManager;
export {};
//# sourceMappingURL=feeManager.d.ts.map