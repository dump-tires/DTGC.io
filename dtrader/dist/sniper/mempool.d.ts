import { EventEmitter } from 'events';
interface SnipeTarget {
    tokenAddress: string;
    amountPls: bigint;
    slippage: number;
    maxGasPrice: bigint;
    minLiquidityPls: bigint;
    userId: string;
}
export declare class MempoolSniper extends EventEmitter {
    private httpProvider;
    private wsProvider;
    private factory;
    private targets;
    private isRunning;
    private processedPairs;
    constructor();
    /**
     * Connect to WebSocket for real-time monitoring
     */
    connect(): Promise<void>;
    private reconnect;
    /**
     * Add a token to snipe when liquidity is added
     */
    addTarget(target: SnipeTarget): void;
    /**
     * Remove snipe target
     */
    removeTarget(tokenAddress: string, userId: string): boolean;
    /**
     * Start monitoring
     */
    start(): Promise<void>;
    /**
     * Watch for new pair creations on PulseX
     */
    private watchPairCreated;
    /**
     * Watch pending transactions for addLiquidity calls
     */
    private watchMempool;
    /**
     * Decode router transaction
     */
    private decodeRouterTx;
    /**
     * Check if token is a target and trigger snipe
     */
    private checkAndSnipe;
    /**
     * Monitor a specific pair for liquidity changes
     */
    watchPair(pairAddress: string, callback: (reserve0: bigint, reserve1: bigint) => void): Promise<void>;
    /**
     * Get recent pairs
     */
    getRecentPairs(count?: number): Promise<string[]>;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Disconnect
     */
    disconnect(): Promise<void>;
}
export declare const mempoolSniper: MempoolSniper;
export {};
//# sourceMappingURL=mempool.d.ts.map