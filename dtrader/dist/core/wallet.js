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
exports.walletManager = exports.WalletManager = void 0;
const ethers_1 = require("ethers");
const config_1 = require("../config");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Simple JSON file storage
class WalletStore {
    filePath;
    data;
    constructor() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        this.filePath = path.join(dataDir, 'wallets.json');
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
    findByTelegramId(telegramId) {
        return this.data.find(w => w.telegramId === telegramId);
    }
    insert(wallet) {
        const newWallet = { ...wallet, id: Date.now().toString() };
        this.data.push(newWallet);
        this.save();
        return newWallet;
    }
    upsert(telegramId, walletData) {
        const index = this.data.findIndex(w => w.telegramId === telegramId);
        if (index !== -1) {
            this.data[index] = { ...this.data[index], ...walletData };
        }
        else {
            this.data.push({ id: Date.now().toString(), telegramId, ...walletData });
        }
        this.save();
    }
}
class WalletManager {
    provider;
    store;
    encryptionKey;
    constructor() {
        this.provider = new ethers_1.ethers.JsonRpcProvider(config_1.config.rpc);
        this.store = new WalletStore();
        // Encryption key from env or generate (store this securely!)
        const keyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.encryptionKey = Buffer.from(keyHex, 'hex');
    }
    /**
     * Encrypt private key for storage
     */
    encrypt(text) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag();
        return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    }
    /**
     * Decrypt private key
     */
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
    /**
     * Create or get existing wallet for user
     */
    async getOrCreateWallet(telegramId) {
        const existing = this.store.findByTelegramId(telegramId);
        if (existing) {
            try {
                const privateKey = this.decrypt(existing.encryptedKey);
                const wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
                return { wallet, isNew: false };
            }
            catch (err) {
                // Decryption failed - encryption key changed or data corrupted
                // Create new wallet for this user
                console.log(`⚠️ Wallet decryption failed for user ${telegramId}, creating new wallet`);
            }
        }
        // Create new wallet
        const hdWallet = ethers_1.ethers.Wallet.createRandom();
        const wallet = new ethers_1.ethers.Wallet(hdWallet.privateKey, this.provider);
        const encryptedKey = this.encrypt(hdWallet.privateKey);
        // Use upsert to replace old wallet if it exists
        this.store.upsert(telegramId, {
            address: wallet.address,
            encryptedKey,
            createdAt: Date.now()
        });
        return { wallet, isNew: true };
    }
    /**
     * Import existing wallet
     */
    async importWallet(telegramId, privateKey) {
        const wallet = new ethers_1.ethers.Wallet(privateKey, this.provider);
        const encryptedKey = this.encrypt(privateKey);
        this.store.upsert(telegramId, {
            address: wallet.address,
            encryptedKey,
            createdAt: Date.now()
        });
        return wallet;
    }
    /**
     * Get wallet for user
     */
    async getWallet(telegramId) {
        const existing = this.store.findByTelegramId(telegramId);
        if (!existing)
            return null;
        try {
            const privateKey = this.decrypt(existing.encryptedKey);
            return new ethers_1.ethers.Wallet(privateKey, this.provider);
        }
        catch (err) {
            console.log(`⚠️ Wallet decryption failed for user ${telegramId}`);
            return null;
        }
    }
    /**
     * Export private key (user must confirm)
     */
    async exportPrivateKey(telegramId) {
        const existing = this.store.findByTelegramId(telegramId);
        if (!existing)
            return null;
        return this.decrypt(existing.encryptedKey);
    }
    /**
     * Get PLS balance
     */
    async getPlsBalance(address) {
        const balance = await this.provider.getBalance(address);
        return {
            balance,
            formatted: ethers_1.ethers.formatEther(balance),
        };
    }
    /**
     * Get token balance
     */
    async getTokenBalance(walletAddress, tokenAddress) {
        const token = new ethers_1.ethers.Contract(tokenAddress, config_1.ERC20_ABI, this.provider);
        const [name, symbol, decimals, balance] = await Promise.all([
            token.name(),
            token.symbol(),
            token.decimals(),
            token.balanceOf(walletAddress),
        ]);
        return {
            address: tokenAddress,
            name,
            symbol,
            decimals,
            balance,
            balanceFormatted: ethers_1.ethers.formatUnits(balance, decimals),
        };
    }
    /**
     * Get multiple token balances
     */
    async getTokenBalances(walletAddress, tokenAddresses) {
        return Promise.all(tokenAddresses.map((addr) => this.getTokenBalance(walletAddress, addr)));
    }
    /**
     * Format balance for display
     */
    formatBalance(balance, symbol, usdValue) {
        const formatted = Number(balance).toLocaleString(undefined, {
            maximumFractionDigits: 4,
        });
        if (usdValue !== undefined) {
            return `${formatted} ${symbol} ($${usdValue.toFixed(2)})`;
        }
        return `${formatted} ${symbol}`;
    }
}
exports.WalletManager = WalletManager;
exports.walletManager = new WalletManager();
//# sourceMappingURL=wallet.js.map