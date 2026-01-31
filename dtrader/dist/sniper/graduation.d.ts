import { EventEmitter } from 'events';
interface TokenState {
    address: string;
    name: string;
    symbol: string;
    plsRaised: bigint;
    percentToGraduation: number;
    graduated: boolean;
    pairAddress?: string;
}
interface SnipeConfig {
    tokenAddress?: string;
    amountPls: bigint;
    slippage: number;
    gasLimit: number;
    gasPriceMultiplier: number;
    autoSellPercent?: number;
    maxBuyTax?: number;
}
interface SnipeResult {
    success: boolean;
    tokenAddress: string;
    txHash?: string;
    amountPls?: string;
    amountTokens?: string;
    error?: string;
}
export declare class GraduationSniper extends EventEmitter {
    private provider;
    private wsProvider;
    private pumpTiresContract;
    private watchedTokens;
    private isListening;
    private graduationThreshold;
    constructor();
    /**
     * Initialize WebSocket connection for real-time events
     */
    connect(): Promise<void>;
    private reconnect;
    /**
     * Get current state of a token on the bonding curve
     */
    getTokenState(tokenAddress: string): Promise<TokenState | null>;
    /**
     * Watch a specific token for graduation
     */
    watchToken(tokenAddress: string, config: SnipeConfig): void;
    /**
     * Stop watching a token
     */
    unwatchToken(tokenAddress: string): void;
    /**
     * Start listening for graduation events
     */
    startListening(): Promise<void>;
    /**
     * Stop listening
     */
    stopListening(): void;
    /**
     * Execute snipe buy on graduation
     */
    executeSnipe(tokenAddress: string, snipeConfig: SnipeConfig): Promise<SnipeResult>;
    /**
     * Snipe all graduating tokens (aggressive mode)
     */
    enableAutoSnipe(defaultConfig: SnipeConfig): Promise<void>;
    /**
     * Format token state for display
     */
    formatTokenState(state: TokenState): string;
    private createProgressBar;
    /**
     * Fallback polling mode when WebSocket is unavailable
     * Checks watched tokens periodically for graduation
     */
    private pollingInterval;
    private startPollingMode;
    private stopPollingMode;
    /**
     * Close connections
     */
    disconnect(): Promise<void>;
}
export declare const graduationSniper: GraduationSniper;
export {};
//# sourceMappingURL=graduation.d.ts.map