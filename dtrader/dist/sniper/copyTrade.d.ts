import { EventEmitter } from 'events';
/**
 * Copy Trade / Whale Tracker (JSON Storage)
 *
 * Monitor wallet addresses and copy their trades in real-time.
 * Features:
 * - Track up to 10 wallets per user
 * - Auto-copy buys/sells with configurable amounts
 * - Frontrun option for competitive advantage
 * - Filters for min/max trade size
 */
interface TrackedWallet {
    id: string;
    userId: string;
    address: string;
    label: string;
    copyBuys: boolean;
    copySells: boolean;
    copyAmountPls: string;
    copyPercentage: number;
    minTradePls: string;
    maxTradePls: string;
    frontrun: boolean;
    isActive: boolean;
    totalCopied: number;
    profitLoss: string;
    createdAt: number;
}
export declare class CopyTradeManager extends EventEmitter {
    private provider;
    private wsProvider;
    private walletStore;
    private historyStore;
    private trackedWalletsCache;
    private isRunning;
    constructor();
    private loadTrackedWallets;
    /**
     * Add wallet to track
     */
    addTrackedWallet(params: {
        userId: string;
        address: string;
        label?: string;
        copyBuys?: boolean;
        copySells?: boolean;
        copyAmountPls?: bigint;
        copyPercentage?: number;
        frontrun?: boolean;
    }): Promise<TrackedWallet>;
    /**
     * Remove tracked wallet
     */
    removeTrackedWallet(userId: string, walletId: string): boolean;
    /**
     * Get user's tracked wallets
     */
    getUserTrackedWallets(userId: string): TrackedWallet[];
    /**
     * Connect and start monitoring
     */
    connect(): Promise<void>;
    /**
     * Start monitoring tracked wallets
     */
    start(): Promise<void>;
    /**
     * Decode swap transaction
     */
    private decodeSwapTx;
    /**
     * Calculate copy amount based on config
     */
    calculateCopyAmount(tracker: TrackedWallet, originalAmount: bigint): bigint;
    /**
     * Record a copy trade in history
     */
    recordCopyTrade(params: {
        userId: string;
        trackedWallet: string;
        originalTx: string;
        copyTx?: string;
        tokenAddress: string;
        tradeType: string;
        amountPls: bigint;
        status: string;
    }): void;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Disconnect
     */
    disconnect(): Promise<void>;
    /**
     * Format tracked wallet for display
     */
    formatTrackedWallet(wallet: TrackedWallet): string;
}
export declare const copyTradeManager: CopyTradeManager;
export {};
//# sourceMappingURL=copyTrade.d.ts.map