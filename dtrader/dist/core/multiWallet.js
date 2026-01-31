"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiWallet = exports.MultiWalletManager = void 0;
const ethers_1 = require("ethers");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config");
class MultiWalletStore {
    filePath;
    data;
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir))
            fs.mkdirSync(dataDir, { recursive: true });
        this.filePath = path.join(dataDir, 'multiwallets.json');
        this.data = this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.filePath)) {
                return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
            }
        }
        catch { }
        return [];
    }
    save() {
        fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    }
    findByUser(userId) {
        return this.data.filter(w => w.userId === userId).sort((a, b) => a.walletIndex - b.walletIndex);
    }
    findByUserAndIndex(userId, index) {
        return this.data.find(w => w.userId === userId && w.walletIndex === index);
    }
    findActiveByUser(userId) {
        return this.data.filter(w => w.userId === userId && w.isActive);
    }
    countByUser(userId) {
        return this.data.filter(w => w.userId === userId).length;
    }
    insert(wallet) {
        this.data.push(wallet);
        this.save();
    }
    update(userId, index, updates) {
        const idx = this.data.findIndex(w => w.userId === userId && w.walletIndex === index);
        if (idx !== -1) {
            this.data[idx] = { ...this.data[idx], ...updates };
            this.save();
        }
    }
    toggleActive(userId, index) {
        const wallet = this.findByUserAndIndex(userId, index);
        if (wallet) {
            wallet.isActive = !wallet.isActive;
            this.save();
            return true;
        }
        return false;
    }
}
class MultiWalletManager {
    provider;
    store;
    encryptionKey;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.store = new MultiWalletStore();
        const keyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.encryptionKey = Buffer.from(keyHex, 'hex');
    }
    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    decrypt(encryptedText) {
        const parts = encryptedText.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = parts[2];
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    async generateWallets(userId) {
        const existing = this.store.countByUser(userId);
        if (existing >= 6)
            throw new Error('Maximum 6 wallets already generated');
        const wallets = [];
        for (let i = existing + 1; i <= 6; i++) {
            const hdWallet = ethers_1.ethers.Wallet.createRandom();
            const encryptedKey = this.encrypt(hdWallet.privateKey);
            this.store.insert({
                userId,
                walletIndex: i,
                address: hdWallet.address,
                encryptedKey,
                label: `Wallet ${i}`,
                isActive: true,
                createdAt: Date.now()
            });
            wallets.push({
                index: i,
                address: hdWallet.address,
                label: `Wallet ${i}`,
                balance: 0n,
                isActive: true,
            });
        }
        return wallets;
    }
    getUserWalletCount(userId) {
        return this.store.countByUser(userId);
    }
    async getUserWallets(userId) {
        const rows = this.store.findByUser(userId);
        const wallets = [];
        for (const row of rows) {
            let balance = 0n;
            try {
                balance = await this.provider.getBalance(row.address);
            }
            catch { }
            wallets.push({
                index: row.walletIndex,
                address: row.address,
                label: row.label,
                balance,
                isActive: row.isActive,
            });
        }
        return wallets;
    }
    async getWalletSigner(userId, index) {
        const row = this.store.findByUserAndIndex(userId, index);
        if (!row)
            return null;
        const privateKey = this.decrypt(row.encryptedKey);
        return new ethers_1.ethers.Wallet(privateKey, this.provider);
    }
    async getActiveWalletSigners(userId) {
        const rows = this.store.findActiveByUser(userId);
        return rows.map(row => {
            const privateKey = this.decrypt(row.encryptedKey);
            return new ethers_1.ethers.Wallet(privateKey, this.provider);
        });
    }
    toggleWalletActive(userId, index) {
        return this.store.toggleActive(userId, index);
    }
    setWalletLabel(userId, index, label) {
        this.store.update(userId, index, { label });
        return true;
    }
    exportPrivateKey(userId, index) {
        const row = this.store.findByUserAndIndex(userId, index);
        if (!row)
            return null;
        return this.decrypt(row.encryptedKey);
    }
    async getTotalBalance(userId) {
        const wallets = await this.getUserWallets(userId);
        const totalPls = wallets.reduce((sum, w) => sum + w.balance, 0n);
        return { pls: totalPls, wallets };
    }
    formatWalletList(wallets) {
        if (wallets.length === 0) {
            return '❌ No wallets generated yet. Use /wallets to create 6 wallets.';
        }
        let output = '👛 **Your Wallets**\n\n';
        for (const w of wallets) {
            const activeIcon = w.isActive ? '✅' : '⬜';
            const balanceFormatted = ethers_1.ethers.formatEther(w.balance);
            output += `${activeIcon} **${w.label}** (#${w.index})\n`;
            output += `   \`${w.address}\`\n`;
            output += `   💎 ${Number(balanceFormatted).toLocaleString()} PLS\n\n`;
        }
        const activeCount = wallets.filter(w => w.isActive).length;
        output += `━━━━━━━━━━━━━━━━━━━━━\n`;
        output += `🎯 Active for sniping: ${activeCount}/6 wallets`;
        return output;
    }
}
exports.MultiWalletManager = MultiWalletManager;
exports.multiWallet = new MultiWalletManager();
//# sourceMappingURL=multiWallet.js.map