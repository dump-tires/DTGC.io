interface GateResult {
    allowed: boolean;
    message: string;
    balance: bigint;
    balanceUsd: number;
}
declare class TokenGate {
    private provider;
    private dtgcContract;
    constructor();
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