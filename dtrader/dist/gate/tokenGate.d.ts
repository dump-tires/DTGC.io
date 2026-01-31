interface GateResult {
    allowed: boolean;
    message: string;
    balance: bigint;
    balanceUsd: number;
}
declare class TokenGate {
    private provider;
    private dtgcContract;
    private router;
    private factory;
    private cachedDtgcPrice;
    private cacheTimestamp;
    private readonly CACHE_DURATION;
    constructor();
    /**
     * Get DTGC price in USD by checking PulseX pair
     * Uses: DTGC -> WPLS -> DAI/USDC path
     */
    getDtgcPriceUsd(): Promise<number>;
    checkAccess(walletAddress: string): Promise<GateResult>;
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