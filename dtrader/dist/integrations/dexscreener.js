"use strict";
/**
 * DEXScreener API Integration
 * Fetches token data, prices, and top tokens for PulseChain
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dexScreener = void 0;
// DEXScreener API base URL
const DEXSCREENER_API = 'https://api.dexscreener.com/latest';
class DexScreenerService {
    cache = new Map();
    cacheDuration = 60000; // 1 minute cache
    /**
     * Get token info by contract address
     */
    async getTokenInfo(tokenAddress) {
        try {
            // Check cache first
            const cacheKey = `token_${tokenAddress.toLowerCase()}`;
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
                return cached.data;
            }
            const response = await fetch(`${DEXSCREENER_API}/dex/tokens/${tokenAddress}`);
            if (!response.ok) {
                console.log(`DEXScreener API error: ${response.status}`);
                return null;
            }
            const data = await response.json();
            // Find PulseChain pairs
            const pulsePairs = (data.pairs || []).filter((p) => p.chainId === 'pulsechain');
            if (pulsePairs.length === 0) {
                return null;
            }
            // Get the pair with highest liquidity
            const bestPair = pulsePairs.reduce((best, current) => (current.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? current : best);
            const tokenInfo = {
                address: tokenAddress,
                name: bestPair.baseToken.name,
                symbol: bestPair.baseToken.symbol,
                priceUsd: parseFloat(bestPair.priceUsd || '0'),
                pricePls: parseFloat(bestPair.priceNative || '0'),
                priceChange24h: bestPair.priceChange?.h24 || 0,
                priceChange1h: bestPair.priceChange?.h1 || 0,
                volume24h: bestPair.volume?.h24 || 0,
                liquidity: bestPair.liquidity?.usd || 0,
                marketCap: bestPair.marketCap || 0,
                fdv: bestPair.fdv || 0,
                pairAddress: bestPair.pairAddress,
                dexScreenerUrl: bestPair.url,
                txns24h: bestPair.txns?.h24 || { buys: 0, sells: 0 },
                pairCreatedAt: bestPair.pairCreatedAt || 0,
                ageHours: bestPair.pairCreatedAt
                    ? (Date.now() - bestPair.pairCreatedAt) / (1000 * 60 * 60)
                    : 0,
            };
            // Cache the result
            this.cache.set(cacheKey, { data: tokenInfo, timestamp: Date.now() });
            return tokenInfo;
        }
        catch (error) {
            console.error('DEXScreener getTokenInfo error:', error);
            return null;
        }
    }
    /**
     * Get top tokens on PulseChain by volume
     */
    async getTopTokens(limit = 30) {
        try {
            // Check cache
            const cacheKey = 'top_tokens';
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheDuration * 2) {
                return cached.data.slice(0, limit);
            }
            // DEXScreener search endpoint for PulseChain
            const response = await fetch(`${DEXSCREENER_API}/dex/search?q=pulsechain`);
            if (!response.ok) {
                console.log(`DEXScreener API error: ${response.status}`);
                return [];
            }
            const data = await response.json();
            const pairs = (data.pairs || []).filter((p) => p.chainId === 'pulsechain' && p.liquidity?.usd > 10000);
            // Sort by 24h volume
            pairs.sort((a, b) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0));
            // Convert to TokenInfo and deduplicate by token address
            const seen = new Set();
            const tokens = [];
            for (const pair of pairs) {
                const addr = pair.baseToken.address.toLowerCase();
                if (seen.has(addr))
                    continue;
                seen.add(addr);
                tokens.push({
                    address: pair.baseToken.address,
                    name: pair.baseToken.name,
                    symbol: pair.baseToken.symbol,
                    priceUsd: parseFloat(pair.priceUsd || '0'),
                    pricePls: parseFloat(pair.priceNative || '0'),
                    priceChange24h: pair.priceChange?.h24 || 0,
                    priceChange1h: pair.priceChange?.h1 || 0,
                    volume24h: pair.volume?.h24 || 0,
                    liquidity: pair.liquidity?.usd || 0,
                    marketCap: pair.marketCap || 0,
                    fdv: pair.fdv || 0,
                    pairAddress: pair.pairAddress,
                    dexScreenerUrl: pair.url,
                    txns24h: pair.txns?.h24 || { buys: 0, sells: 0 },
                    pairCreatedAt: pair.pairCreatedAt || 0,
                    ageHours: pair.pairCreatedAt
                        ? (Date.now() - pair.pairCreatedAt) / (1000 * 60 * 60)
                        : 0,
                });
                if (tokens.length >= 50)
                    break; // Get more than needed for filtering
            }
            this.cache.set(cacheKey, { data: tokens, timestamp: Date.now() });
            return tokens.slice(0, limit);
        }
        catch (error) {
            console.error('DEXScreener getTopTokens error:', error);
            return [];
        }
    }
    /**
     * Calculate "Probable Wins" score for a token
     * Higher score = better opportunity
     */
    calculateScore(token) {
        let score = 50; // Base score
        const reasons = [];
        // Volume momentum (24h volume vs liquidity ratio)
        const volumeToLiq = token.volume24h / (token.liquidity || 1);
        if (volumeToLiq > 2) {
            score += 15;
            reasons.push('🔥 High volume momentum');
        }
        else if (volumeToLiq > 1) {
            score += 10;
            reasons.push('📊 Good trading activity');
        }
        else if (volumeToLiq > 0.5) {
            score += 5;
        }
        // Liquidity safety
        if (token.liquidity > 500000) {
            score += 15;
            reasons.push('💧 Deep liquidity');
        }
        else if (token.liquidity > 100000) {
            score += 10;
            reasons.push('💧 Solid liquidity');
        }
        else if (token.liquidity > 50000) {
            score += 5;
        }
        else if (token.liquidity < 20000) {
            score -= 10;
            reasons.push('⚠️ Low liquidity risk');
        }
        // Price action - look for healthy patterns
        const h24 = token.priceChange24h;
        const h1 = token.priceChange1h;
        // Consolidating after pump (good entry)
        if (h24 > 20 && h1 < 5 && h1 > -5) {
            score += 15;
            reasons.push('📈 Consolidating after pump');
        }
        // Steady growth
        else if (h24 > 5 && h24 < 30 && h1 > 0) {
            score += 12;
            reasons.push('📈 Steady uptrend');
        }
        // Dip buying opportunity
        else if (h24 < -10 && h1 > 2) {
            score += 10;
            reasons.push('🔄 Potential reversal');
        }
        // Overextended pump (risky)
        else if (h24 > 100) {
            score -= 10;
            reasons.push('⚠️ Overextended - wait for pullback');
        }
        // Heavy dump
        else if (h24 < -30) {
            score -= 15;
            reasons.push('⚠️ Heavy selling pressure');
        }
        // Buy/Sell ratio
        const buyRatio = token.txns24h.buys / (token.txns24h.buys + token.txns24h.sells || 1);
        if (buyRatio > 0.6) {
            score += 10;
            reasons.push('🟢 More buyers than sellers');
        }
        else if (buyRatio < 0.4) {
            score -= 5;
            reasons.push('🔴 More sellers than buyers');
        }
        // Token age - sweet spot
        if (token.ageHours > 24 && token.ageHours < 168) { // 1-7 days
            score += 10;
            reasons.push('⏰ Good token age');
        }
        else if (token.ageHours < 6) {
            score += 5;
            reasons.push('🆕 Very new - high risk/reward');
        }
        else if (token.ageHours > 720) { // > 30 days
            score += 5;
            reasons.push('🏛️ Established token');
        }
        // Market cap to liquidity ratio (healthy is 3-10x)
        const mcToLiq = token.marketCap / (token.liquidity || 1);
        if (mcToLiq > 3 && mcToLiq < 10) {
            score += 5;
        }
        else if (mcToLiq > 20) {
            score -= 5;
            reasons.push('⚠️ High MC/Liq ratio');
        }
        // Cap score at 0-100
        score = Math.max(0, Math.min(100, score));
        return { score, reasons };
    }
    /**
     * Get "Probable Wins" - tokens with high opportunity scores
     */
    async getProbableWins(limit = 10) {
        const tokens = await this.getTopTokens(50);
        const scored = tokens.map(token => {
            const { score, reasons } = this.calculateScore(token);
            return { token, score, reasons };
        });
        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit);
    }
    /**
     * Format token info for Telegram message
     */
    formatTokenInfo(token) {
        const priceChangeEmoji = token.priceChange24h >= 0 ? '🟢' : '🔴';
        const priceChangeSign = token.priceChange24h >= 0 ? '+' : '';
        return `🪙 **${token.name}** ($${token.symbol})
━━━━━━━━━━━━━━━━━━━━━
📋 \`${token.address}\`

💵 **Price:** $${token.priceUsd.toFixed(8)}
💰 **Price (PLS):** ${token.pricePls.toFixed(12)} PLS
${priceChangeEmoji} **24h:** ${priceChangeSign}${token.priceChange24h.toFixed(2)}%
📊 **1h:** ${token.priceChange1h >= 0 ? '+' : ''}${token.priceChange1h.toFixed(2)}%

📈 **Volume 24h:** $${this.formatNumber(token.volume24h)}
💧 **Liquidity:** $${this.formatNumber(token.liquidity)}
🏦 **Market Cap:** $${this.formatNumber(token.marketCap)}

📊 **24h Txns:** ${token.txns24h.buys} buys / ${token.txns24h.sells} sells
⏰ **Age:** ${this.formatAge(token.ageHours)}

🔗 [DEXScreener](${token.dexScreenerUrl}) • [PulseScan](https://scan.pulsechain.com/token/${token.address})
━━━━━━━━━━━━━━━━━━━━━`;
    }
    /**
     * Format number with K/M/B suffixes
     */
    formatNumber(num) {
        if (num >= 1e9)
            return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6)
            return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3)
            return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
    }
    /**
     * Format age in hours to human readable
     */
    formatAge(hours) {
        if (hours < 1)
            return `${Math.round(hours * 60)}m`;
        if (hours < 24)
            return `${Math.round(hours)}h`;
        if (hours < 168)
            return `${Math.round(hours / 24)}d`;
        if (hours < 720)
            return `${Math.round(hours / 168)}w`;
        return `${Math.round(hours / 720)}mo`;
    }
}
exports.dexScreener = new DexScreenerService();
//# sourceMappingURL=dexscreener.js.map