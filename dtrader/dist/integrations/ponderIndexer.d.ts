import { EventEmitter } from 'events';
/**
 * Ponder Indexer Integration
 *
 * Connects to dump.tires Ponder indexer for real-time token data:
 * - New token creations on pump.tires
 * - Ownership transfers (graduation events)
 * - Token metadata
 * - Historical trades
 */
interface TokenData {
    chainId: number;
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    factoryAddress: string;
    deployedTransactionHash: string;
    launchedTransactionHash?: string;
    blockHash: string;
    orderId: string;
}
interface OwnershipTransfer {
    chainId: number;
    tokenAddress: string;
    from: string;
    to: string;
    transactionHash: string;
    blockHash: string;
    orderId: string;
}
interface PonderConfig {
    apiUrl: string;
    wsUrl?: string;
    pollingInterval?: number;
}
export declare class PonderIndexer extends EventEmitter {
    private config;
    private pollingTimer;
    private lastSeenOrderId;
    private isRunning;
    constructor(config: PonderConfig);
    /**
     * Get all indexed tokens
     */
    getTokens(limit?: number, offset?: number): Promise<TokenData[]>;
    /**
     * Get token by address
     */
    getToken(address: string): Promise<TokenData | null>;
    /**
     * Get recent ownership transfers (potential graduations)
     */
    getOwnershipTransfers(limit?: number): Promise<OwnershipTransfer[]>;
    /**
     * Get tokens that recently launched (have launchedTransactionHash)
     */
    getRecentlyLaunchedTokens(limit?: number): Promise<TokenData[]>;
    /**
     * Get tokens about to graduate (based on ownership patterns)
     */
    getTokensNearGraduation(): Promise<TokenData[]>;
    /**
     * Start polling for new tokens
     */
    startPolling(): Promise<void>;
    /**
     * Stop polling
     */
    stopPolling(): void;
    /**
     * GraphQL query (if Ponder supports it)
     */
    query(graphqlQuery: string, variables?: Record<string, any>): Promise<any>;
    /**
     * Get token with full details via GraphQL
     */
    getTokenDetails(address: string): Promise<any>;
    /**
     * Subscribe to specific token updates
     */
    watchToken(tokenAddress: string, callback: (update: any) => void): Promise<void>;
    /**
     * Health check
     */
    isHealthy(): Promise<boolean>;
    /**
     * Format token for display
     */
    formatToken(token: TokenData): string;
}
export declare const ponderIndexer: PonderIndexer;
export {};
//# sourceMappingURL=ponderIndexer.d.ts.map