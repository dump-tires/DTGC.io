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
export {};
//# sourceMappingURL=jsonStore.d.ts.map