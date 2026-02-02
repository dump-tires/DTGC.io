/**
 * InstaBond API for Web UI Integration
 *
 * Allows DTGC.io/Gold web users to:
 * - Create InstaBond orders (graduation snipe + auto take-profit)
 * - View their active orders
 * - Cancel orders
 * - Get order status updates
 */
declare const app: import("express-serve-static-core").Express;
interface WebInstaBondOrder {
    id: string;
    walletAddress: string;
    tokenAddress: string;
    tokenSymbol?: string;
    tokenName?: string;
    amountPls: string;
    takeProfitPercent: number;
    sellPercent: number;
    slippage: number;
    status: 'armed' | 'watching' | 'buying' | 'holding' | 'selling' | 'completed' | 'failed' | 'cancelled';
    createdAt: number;
    graduatedAt?: number;
    buyTxHash?: string;
    tokensReceived?: string;
    entryPrice?: number;
    sellTxHash?: string;
    tokensSold?: string;
    plsReceived?: string;
    profit?: number;
    error?: string;
}
declare const webOrders: Map<string, WebInstaBondOrder>;
export declare function updateWebOrder(orderId: string, updates: Partial<WebInstaBondOrder>): void;
export declare function getWebOrder(orderId: string): WebInstaBondOrder | undefined;
export declare function startInstaBondApi(port?: number): Promise<void>;
export { app, webOrders, WebInstaBondOrder };
//# sourceMappingURL=instabondApi.d.ts.map