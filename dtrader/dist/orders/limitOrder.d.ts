import { EventEmitter } from 'events';
/**
 * Limit Order Engine (JSON Storage)
 *
 * Off-chain order book that monitors prices and executes
 * on-chain swaps when thresholds are met.
 *
 * Supports:
 * - Limit buys/sells at target price
 * - Stop-loss orders
 * - Take-profit orders
 * - DCA (Dollar Cost Averaging)
 * - Trailing stops
 */
type OrderType = 'limit_buy' | 'limit_sell' | 'stop_loss' | 'take_profit' | 'dca';
type OrderStatus = 'pending' | 'active' | 'filled' | 'cancelled' | 'expired' | 'failed';
interface LimitOrder {
    id: string;
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    orderType: OrderType;
    targetPrice: string;
    amount: string;
    slippage: number;
    status: OrderStatus;
    createdAt: number;
    expiresAt?: number;
    filledAt?: number;
    txHash?: string;
    error?: string;
}
interface DCAOrder {
    id: string;
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    intervalSeconds: number;
    totalBuys: number;
    completedBuys: number;
    amountPerBuy: string;
    slippage: number;
    status: OrderStatus;
    nextBuyAt: number;
    minPrice?: string;
    maxPrice?: string;
    createdAt: number;
}
interface PriceData {
    token: string;
    priceInPls: bigint;
    liquidityPls: bigint;
    timestamp: number;
}
export declare class LimitOrderEngine extends EventEmitter {
    private provider;
    private orderStore;
    private dcaStore;
    private isRunning;
    private priceCheckInterval;
    private dcaCheckInterval;
    private priceCache;
    constructor();
    /**
     * Create a limit order
     */
    createOrder(params: {
        userId: string;
        walletAddress: string;
        tokenAddress: string;
        orderType: OrderType;
        targetPrice: bigint;
        amount: bigint;
        slippage: number;
        expiresAt?: number;
    }): Promise<LimitOrder>;
    /**
     * Create a DCA order
     */
    createDCAOrder(params: {
        userId: string;
        walletAddress: string;
        tokenAddress: string;
        totalAmountPls: bigint;
        numberOfBuys: number;
        intervalSeconds: number;
        slippage: number;
        minPrice?: bigint;
        maxPrice?: bigint;
    }): Promise<DCAOrder>;
    /**
     * Cancel an order
     */
    cancelOrder(orderId: string, userId: string): boolean;
    /**
     * Cancel DCA order
     */
    cancelDCAOrder(orderId: string, userId: string): boolean;
    /**
     * Get user's orders
     */
    getUserOrders(userId: string): LimitOrder[];
    /**
     * Get user's DCA orders
     */
    getUserDCAOrders(userId: string): DCAOrder[];
    /**
     * Get current token price
     */
    getTokenPrice(tokenAddress: string): Promise<PriceData | null>;
    /**
     * Check if order should execute
     */
    private shouldExecute;
    /**
     * Start the order engine
     */
    start(): Promise<void>;
    /**
     * Check prices and execute orders
     */
    private checkPrices;
    /**
     * Check and execute DCA orders
     */
    private checkDCAOrders;
    /**
     * Mark order as filled
     */
    markOrderFilled(orderId: string, txHash: string): void;
    /**
     * Mark order as failed
     */
    markOrderFailed(orderId: string, error: string): void;
    /**
     * Update DCA after successful buy
     */
    updateDCAAfterBuy(orderId: string): void;
    /**
     * Stop the engine
     */
    stop(): void;
    /**
     * Format order for display
     */
    formatOrder(order: LimitOrder): string;
}
export declare const limitOrderEngine: LimitOrderEngine;
export {};
//# sourceMappingURL=limitOrder.d.ts.map