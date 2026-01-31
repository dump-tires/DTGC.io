/**
 * Anti-Rug Protection System
 *
 * Checks for common rug pull indicators:
 * - Honeypot detection (can't sell)
 * - High buy/sell taxes
 * - Liquidity lock status
 * - Owner privileges (mint, blacklist)
 * - Max wallet/tx limits
 * - Suspicious contract patterns
 */
interface TokenSafetyCheck {
    token: string;
    symbol: string;
    name: string;
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    hasMaxWallet: boolean;
    maxWalletPercent?: number;
    hasMaxTx: boolean;
    maxTxPercent?: number;
    isOwnerRenounced: boolean;
    ownerAddress?: string;
    canMint: boolean;
    hasBlacklist: boolean;
    liquidityLocked: boolean;
    liquidityLockEndTime?: number;
    liquidityPls: bigint;
    totalSupply: bigint;
    holders?: number;
    riskScore: number;
    riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
    warnings: string[];
}
export declare class AntiRugChecker {
    private provider;
    constructor();
    /**
     * Run full safety check on a token
     */
    checkToken(tokenAddress: string): Promise<TokenSafetyCheck>;
    /**
     * Simulate buy/sell to detect honeypot and taxes
     */
    checkHoneypot(tokenAddress: string): Promise<{
        isHoneypot: boolean;
        buyTax: number;
        sellTax: number;
        error?: string;
    }>;
    /**
     * Check if liquidity is locked
     */
    checkLiquidityLocked(pairAddress: string): Promise<boolean>;
    /**
     * Try different max wallet function names
     */
    private tryGetMaxWallet;
    /**
     * Try different max tx function names
     */
    private tryGetMaxTx;
    /**
     * Quick honeypot check (faster, less thorough)
     */
    quickHoneypotCheck(tokenAddress: string): Promise<boolean>;
    /**
     * Format safety check for display
     */
    formatSafetyCheck(check: TokenSafetyCheck): string;
}
export declare const antiRug: AntiRugChecker;
export {};
//# sourceMappingURL=antiRug.d.ts.map