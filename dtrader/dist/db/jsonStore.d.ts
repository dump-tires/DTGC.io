/**
 * Simple JSON File Storage
 * Replaces better-sqlite3 for compatibility
 */
interface Store<T> {
    data: T[];
    save: () => void;
    findAll: () => T[];
    findOne: (predicate: (item: T) => boolean) => T | undefined;
    findMany: (predicate: (item: T) => boolean) => T[];
    insert: (item: T) => T;
    update: (predicate: (item: T) => boolean, updates: Partial<T>) => void;
    delete: (predicate: (item: T) => boolean) => void;
}
export declare function createStore<T extends {
    id?: string | number;
}>(name: string): Store<T>;
export declare const usersStore: Store<{
    id: string;
    vistoId: string;
    walletAddress?: string;
    encryptedKey?: string;
    createdAt: number;
}>;
export declare const walletsStore: Store<{
    id: string;
    vistoId: string;
    address: string;
    encryptedKey: string;
    walletIndex: number;
    isActive: boolean;
}>;
export declare const ordersStore: Store<{
    id: string;
    vistoId: string;
    tokenAddress: string;
    orderType: string;
    amount: string;
    targetPrice: string;
    slippage: number;
    gasGwei: number;
    status: string;
    source: string;
    createdAt: number;
    executedAt?: number;
    txHash?: string;
}>;
export declare const tradesStore: Store<{
    id: string;
    vistoId: string;
    tokenAddress: string;
    tokenSymbol: string;
    entryPrice: string;
    exitPrice: string;
    invested: string;
    received: string;
    pnl: string;
    pnlPercent: number;
    timestamp: number;
}>;
export declare const snipeTargetsStore: Store<{
    id: string;
    vistoId: string;
    tokenAddress: string;
    tokenSymbol: string;
    mode: string;
    amount: string;
    limitPrice?: string;
    walletsActive: string;
    status: string;
    source: string;
    createdAt: number;
}>;
export interface LinkedWalletEntry {
    id: string;
    chatId: string;
    walletAddress: string;
    balanceUsd: number;
    verifiedAt: number;
    expiresAt: number;
    botWalletAddress?: string;
    botKeyLast4?: string;
}
export declare const linkedWalletsStore: Store<LinkedWalletEntry>;
declare function recoverVerificationFromVercel(vistoId: string, gatedWallet?: string): Promise<LinkedWalletEntry | null>;
export declare const LinkedWallets: {
    /**
     * Save a linked wallet (with optional bot wallet linking)
     * ALSO syncs to Vercel for permanent persistence!
     */
    link: (vistoId: string, chatId: string, walletAddress: string, balanceUsd: number, botWalletAddress?: string, botKeyLast4?: string, username?: string) => LinkedWalletEntry;
    /**
     * Recover verification from Vercel cloud backup
     */
    recoverFromVercel: typeof recoverVerificationFromVercel;
    /**
     * Get bot wallet for a user
     */
    getBotWallet: (vistoId: string) => {
        address: string;
        keyLast4: string;
    } | undefined;
    /**
     * Get linked wallet for a user (sync version - checks local only)
     */
    get: (vistoId: string) => LinkedWalletEntry | undefined;
    /**
     * Get linked wallet with Vercel recovery if missing locally
     * Use this for critical verification checks!
     */
    getWithRecovery: (vistoId: string) => Promise<LinkedWalletEntry | undefined>;
    /**
     * Check if a user has a valid linked wallet
     */
    hasValidLink: (vistoId: string) => boolean;
    /**
     * Check with Vercel recovery - async version for critical checks
     */
    hasValidLinkAsync: (vistoId: string) => Promise<boolean>;
    /**
     * Remove linked wallet
     */
    unlink: (vistoId: string) => void;
    /**
     * Get wallet address for a user
     */
    getAddress: (vistoId: string) => string | undefined;
};
export type TradeHistoryType = 'instabond_snipe' | 'limit_buy' | 'limit_sell' | 'stop_loss' | 'take_profit' | 'market_buy' | 'market_sell' | 'dca' | 'copy_trade';
export type TradeHistoryStatus = 'pending' | 'watching' | 'executing' | 'completed' | 'failed' | 'cancelled';
export interface TradeHistoryEntry {
    id: string;
    vistoId: string;
    chatId: string;
    type: TradeHistoryType;
    status: TradeHistoryStatus;
    gatedWalletAddress?: string;
    snipeWalletAddress?: string;
    snipeWalletIndex?: number;
    tokenAddress: string;
    tokenSymbol: string;
    tokenName?: string;
    amountPls: string;
    amountUsd?: string;
    targetPrice?: string;
    triggerCondition?: string;
    executedPrice?: string;
    tokensReceived?: string;
    txHash?: string;
    gasCost?: string;
    slippage?: number;
    entryPrice?: string;
    currentPrice?: string;
    pnlPls?: string;
    pnlPercent?: number;
    linkedOrderId?: string;
    createdAt: number;
    updatedAt: number;
    executedAt?: number;
    notes?: string;
}
export declare const tradeHistoryStore: Store<TradeHistoryEntry>;
export declare const TradeHistory: {
    /**
     * Log a new InstaBond snipe order
     */
    logInstaBondSnipe: (vistoId: string, chatId: string, tokenAddress: string, tokenSymbol: string, amountPls: string, sellPercent?: number, sellMultiplier?: number) => TradeHistoryEntry;
    /**
     * Log a limit order (buy/sell/take profit/stop loss)
     */
    logLimitOrder: (vistoId: string, chatId: string, type: "limit_buy" | "limit_sell" | "stop_loss" | "take_profit", tokenAddress: string, tokenSymbol: string, amountPls: string, targetPrice: string, linkedOrderId?: string) => TradeHistoryEntry;
    /**
     * Update order status
     */
    updateStatus: (orderId: string, status: TradeHistoryStatus, executionDetails?: {
        executedPrice?: string;
        tokensReceived?: string;
        txHash?: string;
        gasCost?: string;
        pnlPls?: string;
        pnlPercent?: number;
    }) => void;
    /**
     * Get all orders for a user
     */
    getUserHistory: (vistoId: string, limit?: number) => TradeHistoryEntry[];
    /**
     * Get active (pending/watching) orders for a user
     */
    getActiveOrders: (vistoId: string) => TradeHistoryEntry[];
    /**
     * Get completed trades for PnL summary
     */
    getCompletedTrades: (vistoId: string, limit?: number) => TradeHistoryEntry[];
    /**
     * Cancel an order
     */
    cancelOrder: (orderId: string) => boolean;
    /**
     * Format order for Telegram display
     */
    formatForTelegram: (entry: TradeHistoryEntry) => string;
};
export interface PersistentSnipeOrder {
    id: string;
    vistoId: string;
    chatId: string;
    tokenAddress: string;
    tokenName?: string;
    tokenSymbol?: string;
    walletId: string;
    walletAddress: string;
    amountPls: string;
    gasPriority: 'normal' | 'fast' | 'turbo' | 'max';
    gasGwei: number;
    status: 'pending' | 'triggered' | 'filled' | 'cancelled' | 'failed';
    createdAt: number;
    filledAt?: number;
    txHash?: string;
    tokensReceived?: string;
    entryPrice?: number;
    takeProfitEnabled: boolean;
    takeProfitPercent?: number;
    sellPercent?: number;
    takeProfitStatus?: 'active' | 'triggered' | 'filled' | 'cancelled';
    sellTxHash?: string;
    tokensSold?: string;
    sellProfitPls?: number;
    error?: string;
    retryCount?: number;
}
export declare const snipeOrdersStore: Store<PersistentSnipeOrder>;
export declare const SnipeOrders: {
    /**
     * Create a new snipe order (PERSISTED!)
     */
    create: (order: Omit<PersistentSnipeOrder, "id" | "createdAt" | "status">) => PersistentSnipeOrder;
    /**
     * Get order by ID
     */
    get: (orderId: string) => PersistentSnipeOrder | undefined;
    /**
     * Get all pending orders for a user
     */
    getPending: (vistoId: string) => PersistentSnipeOrder[];
    /**
     * Get all orders for a user
     */
    getAll: (vistoId: string) => PersistentSnipeOrder[];
    /**
     * Get ALL pending orders (for graduation sniper to load on startup)
     */
    getAllPending: () => PersistentSnipeOrder[];
    /**
     * Update order status
     */
    updateStatus: (orderId: string, status: PersistentSnipeOrder["status"], details?: Partial<PersistentSnipeOrder>) => void;
    /**
     * Mark as filled with execution details
     */
    markFilled: (orderId: string, txHash: string, tokensReceived: string, entryPrice?: number) => void;
    /**
     * Mark take profit as triggered/filled
     */
    markTakeProfitFilled: (orderId: string, sellTxHash: string, tokensSold: string, profitPls: number) => void;
    /**
     * Cancel an order
     */
    cancel: (orderId: string) => boolean;
    /**
     * Mark as failed with error
     */
    markFailed: (orderId: string, error: string) => void;
    /**
     * Get stats for a user
     */
    getStats: (vistoId: string) => {
        pending: number;
        filled: number;
        cancelled: number;
        failed: number;
    };
    /**
     * Recover orders into graduation sniper on startup
     */
    recoverToSniper: (graduationSniper: any) => Promise<number>;
};
export {};
//# sourceMappingURL=jsonStore.d.ts.map