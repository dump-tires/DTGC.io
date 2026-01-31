interface GateResult {
    allowed: boolean;
    message: string;
    balance: bigint;
    balanceUsd: number;
}
declare class TokenGate {
    private cachedBalance;
    private cachedPrice;
    private readonly CACHE_DURATION;
    private readonly PRICE_CACHE_DURATION;
    /**
     * Get DTGC price in USD from PulseX pair
     */
    private getDtgcPriceUsd;
    /**
     * Try to get balance using multiple RPC endpoints
     */
    private getBalanceWithFallback;
    /**
     * Check if wallet has enough DTGC for access
     */
    checkAccess(walletAddress: string): Promise<GateResult>;
    /**
     * Force refresh balance for a wallet
     */
    refreshBalance(walletAddress: string): Promise<GateResult>;
    private fmt;
    getGateKeyboard(): {
        inline_keyboard: ({
            text: string;
            callback_data: string;
        }[] | {
            text: string;
            url: string;
        }[])[];
    };
}
export declare const tokenGate: TokenGate;
export {};
//# sourceMappingURL=tokenGate.d.ts.map