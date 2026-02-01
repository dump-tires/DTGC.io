/**
 * DEXScreener API Integration
 * Fetches token data, prices, and top tokens for PulseChain
 */
export interface TokenPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        h24: {
            buys: number;
            sells: number;
        };
        h6: {
            buys: number;
            sells: number;
        };
        h1: {
            buys: number;
            sells: number;
        };
        m5: {
            buys: number;
            sells: number;
        };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    liquidity: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv: number;
    marketCap: number;
    pairCreatedAt: number;
    info?: {
        imageUrl?: string;
        websites?: {
            url: string;
        }[];
        socials?: {
            type: string;
            url: string;
        }[];
    };
}
export interface TokenInfo {
    address: string;
    name: string;
    symbol: string;
    priceUsd: number;
    pricePls: number;
    priceChange24h: number;
    priceChange1h: number;
    volume24h: number;
    liquidity: number;
    marketCap: number;
    fdv: number;
    pairAddress: string;
    dexScreenerUrl: string;
    txns24h: {
        buys: number;
        sells: number;
    };
    pairCreatedAt: number;
    ageHours: number;
}
export interface ProbableWin {
    token: TokenInfo;
    score: number;
    reasons: string[];
}
declare class DexScreenerService {
    private cache;
    private cacheDuration;
    /**
     * Get token info by contract address
     */
    getTokenInfo(tokenAddress: string): Promise<TokenInfo | null>;
    /**
     * Get top tokens on PulseChain by volume
     */
    getTopTokens(limit?: number): Promise<TokenInfo[]>;
    /**
     * Calculate "Probable Wins" score for a token
     * Higher score = better opportunity
     */
    calculateScore(token: TokenInfo): {
        score: number;
        reasons: string[];
    };
    /**
     * Get "Probable Wins" - tokens with high opportunity scores
     */
    getProbableWins(limit?: number): Promise<ProbableWin[]>;
    /**
     * Format token info for Telegram message
     */
    formatTokenInfo(token: TokenInfo): string;
    /**
     * Format number with K/M/B suffixes
     */
    formatNumber(num: number): string;
    /**
     * Format age in hours to human readable
     */
    formatAge(hours: number): string;
}
export declare const dexScreener: DexScreenerService;
export {};
//# sourceMappingURL=dexscreener.d.ts.map