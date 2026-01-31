import { ethers } from 'ethers';
interface SwapQuote {
    amountIn: bigint;
    amountOut: bigint;
    amountOutMin: bigint;
    path: string[];
    priceImpact: number;
}
interface SwapResult {
    success: boolean;
    txHash?: string;
    amountIn?: string;
    amountOut?: string;
    error?: string;
    feeCollected?: boolean;
    dtgcBurned?: string;
}
interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: bigint;
}
interface PairInfo {
    pairAddress: string;
    token0: string;
    token1: string;
    reserve0: bigint;
    reserve1: bigint;
    liquidityPls: bigint;
}
export declare class PulseXService {
    private provider;
    private router;
    private factory;
    constructor();
    /**
     * Get token info
     */
    getTokenInfo(tokenAddress: string): Promise<TokenInfo>;
    /**
     * Get pair address for two tokens
     */
    getPairAddress(tokenA: string, tokenB: string): Promise<string | null>;
    /**
     * Get pair info including reserves
     */
    getPairInfo(tokenAddress: string): Promise<PairInfo | null>;
    /**
     * Get swap quote (PLS -> Token)
     */
    getQuoteBuy(tokenAddress: string, amountInPls: bigint, slippagePercent?: number): Promise<SwapQuote>;
    /**
     * Get swap quote (Token -> PLS)
     */
    getQuoteSell(tokenAddress: string, amountInTokens: bigint, slippagePercent?: number): Promise<SwapQuote>;
    /**
     * Execute buy (PLS -> Token)
     * Collects 1% fee: 0.5% DTGC burn + 0.5% dev wallet
     */
    executeBuy(wallet: ethers.Wallet, tokenAddress: string, amountInPls: bigint, slippagePercent?: number, gasLimit?: number, useAntiMev?: boolean): Promise<SwapResult>;
    /**
     * Execute sell (Token -> PLS)
     * Collects 1% fee from proceeds: 0.5% DTGC burn + 0.5% dev wallet
     */
    executeSell(wallet: ethers.Wallet, tokenAddress: string, amountInTokens: bigint, slippagePercent?: number, gasLimit?: number): Promise<SwapResult>;
    /**
     * Format price for display
     */
    formatPrice(amountIn: bigint, amountOut: bigint, decimalsIn: number, decimalsOut: number): string;
}
export declare const pulsex: PulseXService;
export {};
//# sourceMappingURL=pulsex.d.ts.map