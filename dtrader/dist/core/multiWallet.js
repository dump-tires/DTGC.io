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
    findAll() {
        return [...this.data];
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
    /**
     * Sync wallets to Vercel for persistent backup
     * Called after every wallet import/generate/update
     */
    async syncToVercel(userId, gatedWalletAddress) {
        try {
            const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
            const wallets = this.store.findByUser(userId);
            if (wallets.length === 0)
                return true;
            // Get the gated wallet from first wallet if not provided
            const gatedWallet = gatedWalletAddress || wallets[0]?.linkedWalletAddress;
            const response = await fetch(`https://dtgc.io/api/wallets-sync?telegramUserId=${userId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    gatedWallet,
                    telegramUserId: userId,
                    wallets: wallets.map(w => ({
                        index: w.walletIndex,
                        address: w.address,
                        encryptedKey: w.encryptedKey,
                        keyLast4: w.keyLast4,
                        label: w.label,
                        isActive: w.isActive,
                        createdAt: w.createdAt,
                    })),
                }),
            });
            if (response.ok) {
                console.log(`☁️ [VERCEL] Synced ${wallets.length} wallets for user ${userId}`);
                return true;
            }
            return false;
        }
        catch (e) {
            console.error(`❌ [VERCEL] Failed to sync wallets:`, e);
            return false;
        }
    }
    /**
     * Recover wallets from Vercel backup
     * Returns true if wallets were recovered
     */
    async recoverFromVercel(userId, gatedWalletAddress) {
        try {
            const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
            const queryParam = gatedWalletAddress
                ? `gatedWallet=${gatedWalletAddress.toLowerCase()}`
                : `telegramUserId=${userId}`;
            const response = await fetch(`https://dtgc.io/api/wallets-sync?${queryParam}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
            });
            if (!response.ok) {
                return { recovered: 0, wallets: [] };
            }
            const data = await response.json();
            if (!data.found || !data.wallets || data.wallets.length === 0) {
                return { recovered: 0, wallets: [] };
            }
            // Import wallets from Vercel into local store
            let recovered = 0;
            const walletInfos = [];
            for (const w of data.wallets) {
                // Check if already exists locally
                const existing = this.store.findByUserAndIndex(userId, w.index);
                if (!existing) {
                    this.store.insert({
                        userId,
                        walletIndex: w.index,
                        address: w.address,
                        encryptedKey: w.encryptedKey,
                        label: w.label,
                        isActive: w.isActive,
                        createdAt: w.createdAt,
                        linkedWalletAddress: gatedWalletAddress?.toLowerCase(),
                        keyLast4: w.keyLast4,
                    });
                    recovered++;
                }
                walletInfos.push({
                    index: w.index,
                    address: w.address,
                    label: w.label,
                    balance: 0n,
                    isActive: w.isActive,
                });
            }
            if (recovered > 0) {
                console.log(`☁️ [VERCEL] Recovered ${recovered} wallets for user ${userId}`);
            }
            return { recovered, wallets: walletInfos };
        }
        catch (e) {
            console.error(`❌ [VERCEL] Failed to recover wallets:`, e);
            return { recovered: 0, wallets: [] };
        }
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
    async generateWallets(userId, linkedWalletAddress) {
        const existing = this.store.countByUser(userId);
        if (existing >= 6)
            throw new Error('Maximum 6 wallets already generated');
        const wallets = [];
        for (let i = existing + 1; i <= 6; i++) {
            const hdWallet = ethers_1.ethers.Wallet.createRandom();
            const encryptedKey = this.encrypt(hdWallet.privateKey);
            const keyLast4 = hdWallet.privateKey.slice(-4); // Last 4 chars for recovery
            this.store.insert({
                userId,
                walletIndex: i,
                address: hdWallet.address,
                encryptedKey,
                label: `Sniper ${i}`,
                isActive: true,
                createdAt: Date.now(),
                linkedWalletAddress: linkedWalletAddress?.toLowerCase(),
                keyLast4
            });
            wallets.push({
                index: i,
                address: hdWallet.address,
                label: `Sniper ${i}`,
                balance: 0n,
                isActive: true,
            });
        }
        console.log(`🔐 Generated ${wallets.length} wallets for user ${userId}${linkedWalletAddress ? ` linked to ${linkedWalletAddress.slice(0, 10)}...` : ''}`);
        // Auto-sync to Vercel for backup persistence
        this.syncToVercel(userId, linkedWalletAddress).catch(() => { });
        return wallets;
    }
    /**
     * Generate a specific number of new wallets (up to 6 total)
     * Used for "Option B: Generate New Setup" after gate verification
     */
    async generateMultiple(userId, count, linkedWalletAddress) {
        const existing = this.store.countByUser(userId);
        const toGenerate = Math.min(count, 6 - existing);
        if (toGenerate <= 0) {
            // Return existing wallets if already at max
            return this.getUserWallets(userId);
        }
        const wallets = [];
        for (let i = 0; i < toGenerate; i++) {
            const walletIndex = existing + i; // 0-indexed
            const hdWallet = ethers_1.ethers.Wallet.createRandom();
            const encryptedKey = this.encrypt(hdWallet.privateKey);
            const keyLast4 = hdWallet.privateKey.slice(-4);
            this.store.insert({
                userId,
                walletIndex,
                address: hdWallet.address,
                encryptedKey,
                label: `Sniper ${walletIndex + 1}`,
                isActive: true,
                createdAt: Date.now(),
                linkedWalletAddress: linkedWalletAddress?.toLowerCase(),
                keyLast4
            });
            wallets.push({
                index: walletIndex,
                address: hdWallet.address,
                label: `Sniper ${walletIndex + 1}`,
                balance: 0n,
                isActive: true,
            });
        }
        console.log(`🔐 Generated ${wallets.length} new wallets for user ${userId}${linkedWalletAddress ? ` linked to ${linkedWalletAddress.slice(0, 10)}...` : ''}`);
        // Auto-sync to Vercel for backup persistence
        this.syncToVercel(userId, linkedWalletAddress).catch(() => { });
        return wallets;
    }
    getUserWalletCount(userId) {
        return this.store.countByUser(userId);
    }
    /**
     * Link existing wallets to a gated wallet address (called after gate verification)
     */
    linkWalletsToGatedWallet(userId, gatedWalletAddress) {
        const wallets = this.store.findByUser(userId);
        for (const w of wallets) {
            this.store.update(userId, w.walletIndex, {
                linkedWalletAddress: gatedWalletAddress.toLowerCase()
            });
        }
        console.log(`🔗 Linked ${wallets.length} wallets to gated wallet ${gatedWalletAddress.slice(0, 10)}...`);
        // Auto-sync to Vercel after linking (userId comes from function parameter)
        this.syncToVercel(userId, gatedWalletAddress).catch(() => { });
    }
    /**
     * Recover wallets using gated wallet address + last 4 digits of any wallet's private key
     * Returns the userId if found, allowing the user to reclaim their wallets
     */
    recoverWallets(gatedWalletAddress, keyLast4) {
        const normalizedAddress = gatedWalletAddress.toLowerCase();
        const normalizedKey = keyLast4.toLowerCase();
        // Find all wallets linked to this gated address
        const allWallets = this.store.findAll();
        const matchingWallet = allWallets.find(w => w.linkedWalletAddress === normalizedAddress &&
            w.keyLast4?.toLowerCase() === normalizedKey);
        if (matchingWallet) {
            const userId = matchingWallet.userId;
            const walletCount = this.store.countByUser(userId);
            console.log(`🔓 Recovery successful for ${gatedWalletAddress.slice(0, 10)}... - Found ${walletCount} wallets`);
            return { userId, walletCount };
        }
        return null;
    }
    /**
     * Transfer wallet ownership to a new userId (for recovery)
     */
    transferWallets(fromUserId, toUserId) {
        const wallets = this.store.findByUser(fromUserId);
        let transferred = 0;
        for (const w of wallets) {
            // Update the userId while keeping everything else
            const allData = this.store.findAll();
            const idx = allData.findIndex(wd => wd.userId === fromUserId && wd.walletIndex === w.walletIndex);
            if (idx !== -1) {
                allData[idx].userId = toUserId;
                transferred++;
            }
        }
        if (transferred > 0) {
            // Force save
            this.store.data = this.store.findAll();
            this.store.save();
            console.log(`📦 Transferred ${transferred} wallets from ${fromUserId} to ${toUserId}`);
        }
        return transferred;
    }
    /**
     * Get wallets info for recovery display (shows addresses + last4 for verification)
     */
    getWalletsForRecovery(gatedWalletAddress) {
        const normalizedAddress = gatedWalletAddress.toLowerCase();
        const allWallets = this.store.findAll();
        return allWallets
            .filter(w => w.linkedWalletAddress === normalizedAddress)
            .map(w => ({
            address: w.address,
            keyLast4: w.keyLast4 || '????',
            index: w.walletIndex
        }));
    }
    /**
     * Import an external wallet by private key
     * Returns the wallet info with assigned index
     */
    importWallet(userId, privateKey, label, linkedWalletAddress) {
        const wallet = new ethers_1.ethers.Wallet(privateKey);
        const encryptedKey = this.encrypt(privateKey);
        const keyLast4 = privateKey.slice(-4);
        // Find next available index
        const existing = this.store.findByUser(userId);
        const nextIndex = existing.length > 0
            ? Math.max(...existing.map(w => w.walletIndex)) + 1
            : 1;
        // Check if wallet already exists for this user
        const existingWallet = existing.find(w => w.address.toLowerCase() === wallet.address.toLowerCase());
        if (existingWallet) {
            // Update existing wallet's label if provided
            if (label) {
                this.store.update(userId, existingWallet.walletIndex, { label });
            }
            return {
                index: existingWallet.walletIndex,
                address: existingWallet.address,
                label: label || existingWallet.label,
                balance: 0n,
                isActive: existingWallet.isActive,
            };
        }
        this.store.insert({
            userId,
            walletIndex: nextIndex,
            address: wallet.address,
            encryptedKey,
            label: label || `Imported ${nextIndex}`,
            isActive: true,
            createdAt: Date.now(),
            linkedWalletAddress: linkedWalletAddress?.toLowerCase(),
            keyLast4
        });
        console.log(`📥 Imported wallet for user ${userId}: ${wallet.address.slice(0, 10)}... as #${nextIndex}`);
        // Auto-sync to Vercel for backup persistence
        this.syncToVercel(userId, linkedWalletAddress).catch(() => { });
        return {
            index: nextIndex,
            address: wallet.address,
            label: label || `Imported ${nextIndex}`,
            balance: 0n,
            isActive: true,
        };
    }
    /**
     * Get wallet by address (for imported wallet lookup)
     */
    getWalletByAddress(userId, address) {
        const wallets = this.store.findByUser(userId);
        const found = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
        if (!found)
            return null;
        return {
            index: found.walletIndex,
            address: found.address,
            label: found.label,
            balance: 0n,
            isActive: found.isActive,
        };
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