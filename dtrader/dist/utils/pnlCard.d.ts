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
export {};
//# sourceMappingURL=pnlCard.d.ts.map