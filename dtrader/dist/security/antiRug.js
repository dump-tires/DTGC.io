"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.antiRug = exports.AntiRugChecker = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const pulsex_1 = require("../core/pulsex");
// Common locker contracts on PulseChain
const KNOWN_LOCKERS = [
    '0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214', // Team Finance
    '0xc77aab3c6d7dab46248f3cc3033c856171878e60', // Unicrypt
    '0x000000000000000000000000000000000000dead', // Burn address
    '0x0000000000000000000000000000000000000000', // Zero address
];
// Extended ERC20 ABI to check for common rug patterns
const EXTENDED_TOKEN_ABI = [
    ...config_1.ERC20_ABI,
    'function owner() view returns (address)',
    'function getOwner() view returns (address)',
    'function maxWallet() view returns (uint256)',
    'function maxTransaction() view returns (uint256)',
    'function maxTxAmount() view returns (uint256)',
    'function _maxWalletAmount() view returns (uint256)',
    'function _maxTxAmount() view returns (uint256)',
    'function buyTax() view returns (uint256)',
    'function sellTax() view returns (uint256)',
    'function buyFee() view returns (uint256)',
    'function sellFee() view returns (uint256)',
    'function isBlacklisted(address) view returns (bool)',
    'function blacklist(address) view returns (bool)',
    'function mint(address,uint256)',
    'function renounceOwnership()',
];
class AntiRugChecker {
    provider;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
    }
    /**
     * Run full safety check on a token
     */
    async checkToken(tokenAddress) {
        const warnings = [];
        let riskScore = 0;
        const token = new ethers_1.ethers.Contract(tokenAddress, EXTENDED_TOKEN_ABI, this.provider);
        // Get basic info
        const [name, symbol, totalSupply, decimals] = await Promise.all([
            token.name().catch(() => 'Unknown'),
            token.symbol().catch(() => '???'),
            token.totalSupply().catch(() => 0n),
            token.decimals().catch(() => 18),
        ]);
        // Check owner
        let owner;
        let isOwnerRenounced = false;
        try {
            owner = await token.owner();
            if (!owner)
                owner = await token.getOwner();
        }
        catch {
            // No owner function - could be good or bad
        }
        if (owner) {
            isOwnerRenounced = owner === ethers_1.ethers.ZeroAddress ||
                owner.toLowerCase() === '0x000000000000000000000000000000000000dead';
            if (!isOwnerRenounced) {
                warnings.push('⚠️ Owner not renounced');
                riskScore += 15;
            }
        }
        // Check for honeypot via simulation
        const honeypotResult = await this.checkHoneypot(tokenAddress);
        const isHoneypot = honeypotResult.isHoneypot;
        const buyTax = honeypotResult.buyTax;
        const sellTax = honeypotResult.sellTax;
        if (isHoneypot) {
            warnings.push('🚨 HONEYPOT DETECTED - Cannot sell!');
            riskScore += 100;
        }
        if (buyTax > 10) {
            warnings.push(`⚠️ High buy tax: ${buyTax}%`);
            riskScore += buyTax;
        }
        if (sellTax > 10) {
            warnings.push(`⚠️ High sell tax: ${sellTax}%`);
            riskScore += sellTax;
        }
        // Check max wallet/tx
        let hasMaxWallet = false;
        let maxWalletPercent;
        let hasMaxTx = false;
        let maxTxPercent;
        try {
            const maxWallet = await this.tryGetMaxWallet(token);
            if (maxWallet && maxWallet > 0n) {
                hasMaxWallet = true;
                maxWalletPercent = Number((maxWallet * 100n) / totalSupply);
                if (maxWalletPercent < 1) {
                    warnings.push(`⚠️ Very low max wallet: ${maxWalletPercent}%`);
                    riskScore += 10;
                }
            }
        }
        catch { }
        try {
            const maxTx = await this.tryGetMaxTx(token);
            if (maxTx && maxTx > 0n) {
                hasMaxTx = true;
                maxTxPercent = Number((maxTx * 100n) / totalSupply);
                if (maxTxPercent < 1) {
                    warnings.push(`⚠️ Very low max tx: ${maxTxPercent}%`);
                    riskScore += 10;
                }
            }
        }
        catch { }
        // Check mint capability
        let canMint = false;
        try {
            // Check if mint function exists and owner can call it
            const mintFunc = token.interface.getFunction('mint');
            if (mintFunc) {
                canMint = true;
                if (!isOwnerRenounced) {
                    warnings.push('⚠️ Token has mint function and owner not renounced');
                    riskScore += 20;
                }
            }
        }
        catch { }
        // Check blacklist capability
        let hasBlacklist = false;
        try {
            await token.isBlacklisted(ethers_1.ethers.ZeroAddress);
            hasBlacklist = true;
            if (!isOwnerRenounced) {
                warnings.push('⚠️ Token has blacklist function');
                riskScore += 15;
            }
        }
        catch { }
        // Check liquidity
        const pairInfo = await pulsex_1.pulsex.getPairInfo(tokenAddress);
        const liquidityPls = pairInfo?.liquidityPls || 0n;
        if (liquidityPls < ethers_1.ethers.parseEther('1000')) {
            warnings.push('⚠️ Very low liquidity');
            riskScore += 20;
        }
        // Check if LP is locked
        const liquidityLocked = pairInfo
            ? await this.checkLiquidityLocked(pairInfo.pairAddress)
            : false;
        if (!liquidityLocked && pairInfo) {
            warnings.push('⚠️ Liquidity not locked');
            riskScore += 25;
        }
        // Calculate risk level
        riskScore = Math.min(riskScore, 100);
        let riskLevel;
        if (riskScore <= 10)
            riskLevel = 'safe';
        else if (riskScore <= 25)
            riskLevel = 'low';
        else if (riskScore <= 50)
            riskLevel = 'medium';
        else if (riskScore <= 75)
            riskLevel = 'high';
        else
            riskLevel = 'critical';
        return {
            token: tokenAddress,
            symbol,
            name,
            isHoneypot,
            buyTax,
            sellTax,
            hasMaxWallet,
            maxWalletPercent,
            hasMaxTx,
            maxTxPercent,
            isOwnerRenounced,
            ownerAddress: owner,
            canMint,
            hasBlacklist,
            liquidityLocked,
            liquidityPls,
            totalSupply,
            riskScore,
            riskLevel,
            warnings,
        };
    }
    /**
     * Simulate buy/sell to detect honeypot and taxes
     */
    async checkHoneypot(tokenAddress) {
        try {
            // Get test amount (0.1 PLS)
            const testAmountPls = ethers_1.ethers.parseEther('0.1');
            // Simulate buy
            const buyQuote = await pulsex_1.pulsex.getQuoteBuy(tokenAddress, testAmountPls, 50);
            if (buyQuote.amountOut === 0n) {
                return { isHoneypot: true, buyTax: 100, sellTax: 100, error: 'Cannot buy' };
            }
            // Simulate sell of received tokens
            try {
                const sellQuote = await pulsex_1.pulsex.getQuoteSell(tokenAddress, buyQuote.amountOut, 50);
                if (sellQuote.amountOut === 0n) {
                    return { isHoneypot: true, buyTax: 0, sellTax: 100, error: 'Cannot sell' };
                }
                // Calculate taxes
                // If we buy X PLS worth, and sell immediately, we should get ~X back
                // Any difference is the combined tax
                const expectedReturn = testAmountPls;
                const actualReturn = sellQuote.amountOut;
                const totalTax = Number((expectedReturn - actualReturn) * 100n / expectedReturn);
                // Estimate individual taxes (rough approximation)
                const buyTax = Math.max(0, Math.floor(totalTax / 2));
                const sellTax = Math.max(0, totalTax - buyTax);
                return {
                    isHoneypot: false,
                    buyTax,
                    sellTax,
                };
            }
            catch (error) {
                // Sell simulation failed = likely honeypot
                return {
                    isHoneypot: true,
                    buyTax: 0,
                    sellTax: 100,
                    error: 'Sell simulation failed',
                };
            }
        }
        catch (error) {
            return {
                isHoneypot: true,
                buyTax: 100,
                sellTax: 100,
                error: error.message,
            };
        }
    }
    /**
     * Check if liquidity is locked
     */
    async checkLiquidityLocked(pairAddress) {
        try {
            const pair = new ethers_1.ethers.Contract(pairAddress, [
                'function balanceOf(address) view returns (uint256)',
                'function totalSupply() view returns (uint256)',
            ], this.provider);
            const totalSupply = await pair.totalSupply();
            // Check balances of known lockers
            let lockedAmount = 0n;
            for (const locker of KNOWN_LOCKERS) {
                try {
                    const balance = await pair.balanceOf(locker);
                    lockedAmount += balance;
                }
                catch { }
            }
            // Consider locked if >50% of LP is in locker/burn addresses
            return lockedAmount > (totalSupply / 2n);
        }
        catch {
            return false;
        }
    }
    /**
     * Try different max wallet function names
     */
    async tryGetMaxWallet(token) {
        for (const fn of ['maxWallet', '_maxWalletAmount', 'maxWalletAmount']) {
            try {
                return await token[fn]();
            }
            catch { }
        }
        return null;
    }
    /**
     * Try different max tx function names
     */
    async tryGetMaxTx(token) {
        for (const fn of ['maxTransaction', 'maxTxAmount', '_maxTxAmount', 'maxTransactionAmount']) {
            try {
                return await token[fn]();
            }
            catch { }
        }
        return null;
    }
    /**
     * Quick honeypot check (faster, less thorough)
     */
    async quickHoneypotCheck(tokenAddress) {
        const result = await this.checkHoneypot(tokenAddress);
        return result.isHoneypot;
    }
    /**
     * Format safety check for display
     */
    formatSafetyCheck(check) {
        const riskEmoji = {
            safe: '✅',
            low: '🟢',
            medium: '🟡',
            high: '🟠',
            critical: '🔴',
        };
        let output = `
${riskEmoji[check.riskLevel]} **${check.name}** (${check.symbol})
━━━━━━━━━━━━━━━━━━━━━

📊 **Risk Assessment**
Risk Score: ${check.riskScore}/100 (${check.riskLevel.toUpperCase()})

💰 **Taxes**
Buy Tax: ${check.buyTax}%
Sell Tax: ${check.sellTax}%

🔒 **Security**
Honeypot: ${check.isHoneypot ? '🚨 YES' : '✅ No'}
Owner Renounced: ${check.isOwnerRenounced ? '✅ Yes' : '⚠️ No'}
Can Mint: ${check.canMint ? '⚠️ Yes' : '✅ No'}
Has Blacklist: ${check.hasBlacklist ? '⚠️ Yes' : '✅ No'}
LP Locked: ${check.liquidityLocked ? '✅ Yes' : '⚠️ No'}

💧 **Liquidity**
${ethers_1.ethers.formatEther(check.liquidityPls)} PLS
    `.trim();
        if (check.warnings.length > 0) {
            output += '\n\n⚠️ **Warnings**\n' + check.warnings.join('\n');
        }
        return output;
    }
}
exports.AntiRugChecker = AntiRugChecker;
exports.antiRug = new AntiRugChecker();
//# sourceMappingURL=antiRug.js.map