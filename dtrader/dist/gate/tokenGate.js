"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenGate = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
class TokenGate {
    provider;
    dtgcContract;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.dtgcContract = new ethers_1.ethers.Contract(config_1.config.tokenGate.dtgc, config_1.ERC20_ABI, this.provider);
    }
    async checkAccess(walletAddress) {
        try {
            const balance = await this.dtgcContract.balanceOf(walletAddress);
            const decimals = await this.dtgcContract.decimals();
            const balanceNum = parseFloat(ethers_1.ethers.formatUnits(balance, decimals));
            const price = 0.001; // DTGC price estimate
            const balanceUsd = balanceNum * price;
            const required = config_1.config.tokenGate.minHoldUsd;
            if (balanceUsd >= required) {
                return { allowed: true, balance, balanceUsd, message: `✅ *Verified!* ${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})` };
            }
            const pct = Math.min(100, (balanceUsd / required) * 100);
            const bar = '🟨'.repeat(Math.floor(pct / 10)) + '⬜'.repeat(10 - Math.floor(pct / 10));
            return { allowed: false, balance, balanceUsd, message: `🔐 *Token Gate Required*\n━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Your Balance:*\n\`${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})\`\n\n${bar} ${pct.toFixed(0)}%\n\n💰 Required: \`$${required}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n\n⚜️ [Buy DTGC](https://dtgc.io/gold)\n\n📋 \`${config_1.config.tokenGate.dtgc}\`\n\n_Tap 🔄 Refresh after buying_` };
        }
        catch (e) {
            return { allowed: false, balance: 0n, balanceUsd: 0, message: '❌ Verification failed. Try again.' };
        }
    }
    fmt(v) {
        if (v >= 1e9)
            return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6)
            return (v / 1e6).toFixed(2) + 'M';
        if (v >= 1e3)
            return (v / 1e3).toFixed(2) + 'K';
        return v.toFixed(2);
    }
    getGateKeyboard() {
        return { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'gate_refresh' }], [{ text: '⚜️ Buy DTGC', url: 'https://dtgc.io/gold' }], [{ text: '🔙 Back', callback_data: 'main_menu' }]] };
    }
}
exports.tokenGate = new TokenGate();
//# sourceMappingURL=tokenGate.js.map