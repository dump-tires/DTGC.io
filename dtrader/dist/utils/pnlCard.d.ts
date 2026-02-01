export declare function formatNumber(value: number): string;
export declare function generatePnLMessage(data: {
    tokenName: string;
    contractAddress: string;
    buyPrice: number;
    currentPrice: number;
    amount: number;
}): string;
export declare function calculatePnL(d: {
    buyPrice: number;
    currentPrice: number;
    amount: number;
}): {
    isProfit: boolean;
    pnlPercent: number;
    pnlAmount: number;
};
interface Position {
    tokenAddress: string;
    tokenName: string;
    buyPrice: number;
    amount: number;
    timestamp: number;
}
declare class PositionStore {
    private filePath;
    private data;
    constructor();
    private load;
    private save;
    getPositions(userId: string): Position[];
    getPosition(userId: string, addr: string): Position | undefined;
    addPosition(userId: string, pos: Position): void;
}
export declare const positionStore: PositionStore;
export interface PnLSummary {
    totalTrades: number;
    wins: number;
    losses: number;
    totalPnlPls: number;
    totalPnlPercent: number;
    bestTrade: {
        symbol: string;
        pnlPercent: number;
    } | null;
    worstTrade: {
        symbol: string;
        pnlPercent: number;
    } | null;
}
export interface TradeForCard {
    symbol: string;
    amountPls: number;
    pnlPls: number;
    pnlPercent: number;
    isWin: boolean;
}
/**
 * Check if image generation is available
 */
export declare function canGenerateImages(): boolean;
/**
 * Generate a P&L card image with Mando background - ENHANCED VERSION
 * Bright gold glow aesthetic with gold bars based on surplus
 * Returns the image as a Buffer (PNG)
 */
export declare function generatePnLCardImage(summary: PnLSummary, trades: TradeForCard[], username?: string): Promise<Buffer>;
/**
 * Generate a text-based P&L summary when images aren't available
 */
export declare function generatePnLTextCard(summary: PnLSummary, trades: TradeForCard[], username?: string): string;
/**
 * Generate a simple single-trade P&L card
 */
export declare function generateSingleTradeCard(symbol: string, entryPls: number, exitPls: number, tokensAmount: number, txHash?: string): Promise<Buffer | null>;
export interface VictoryCardData {
    type: 'snipe' | 'limit_buy' | 'limit_sell' | 'take_profit' | 'instabond';
    tokenSymbol: string;
    tokenAddress: string;
    amountPls: number;
    tokensReceived?: number;
    pnlPls?: number;
    pnlPercent?: number;
    txHash?: string;
    pairAddress?: string;
    username?: string;
}
/**
 * Generate a beautiful Victory Card with Mando background
 * ENHANCED: Bright gold glow aesthetic with gold bars
 */
export declare function generateVictoryCard(data: VictoryCardData): Promise<Buffer>;
/**
 * Generate a text-based victory card when images aren't available
 */
export declare function generateVictoryTextCard(data: VictoryCardData): string;
export {};
//# sourceMappingURL=pnlCard.d.ts.map