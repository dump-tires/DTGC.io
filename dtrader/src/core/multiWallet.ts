import { ethers } from 'ethers';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';

/**
 * Multi-Wallet Manager (JSON Storage)
 */

interface WalletInfo {
  index: number;
  address: string;
  label: string;
  balance: bigint;
  isActive: boolean;
}

interface StoredWallet {
  userId: string;
  walletIndex: number;
  address: string;
  encryptedKey: string;
  label: string;
  isActive: boolean;
  createdAt: number;
  linkedWalletAddress?: string; // The gated wallet address that owns these wallets
  keyLast4?: string;            // Last 4 chars of private key for recovery
}

class MultiWalletStore {
  private filePath: string;
  private data: StoredWallet[];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'multiwallets.json');
    this.data = this.load();
  }

  private load(): StoredWallet[] {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
      }
    } catch {}
    return [];
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }

  findByUser(userId: string): StoredWallet[] {
    return this.data.filter(w => w.userId === userId).sort((a, b) => a.walletIndex - b.walletIndex);
  }

  findByUserAndIndex(userId: string, index: number): StoredWallet | undefined {
    return this.data.find(w => w.userId === userId && w.walletIndex === index);
  }

  findActiveByUser(userId: string): StoredWallet[] {
    return this.data.filter(w => w.userId === userId && w.isActive);
  }

  countByUser(userId: string): number {
    return this.data.filter(w => w.userId === userId).length;
  }

  findAll(): StoredWallet[] {
    return [...this.data];
  }

  insert(wallet: StoredWallet): void {
    this.data.push(wallet);
    this.save();
  }

  update(userId: string, index: number, updates: Partial<StoredWallet>): void {
    const idx = this.data.findIndex(w => w.userId === userId && w.walletIndex === index);
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...updates };
      this.save();
    }
  }

  toggleActive(userId: string, index: number): boolean {
    const wallet = this.findByUserAndIndex(userId, index);
    if (wallet) {
      wallet.isActive = !wallet.isActive;
      this.save();
      return true;
    }
    return false;
  }
}

export class MultiWalletManager {
  private provider: ethers.JsonRpcProvider;
  private store: MultiWalletStore;
  private encryptionKey: Buffer;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.store = new MultiWalletStore();
    const keyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
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

  async generateWallets(userId: string, linkedWalletAddress?: string): Promise<WalletInfo[]> {
    const existing = this.store.countByUser(userId);
    if (existing >= 6) throw new Error('Maximum 6 wallets already generated');

    const wallets: WalletInfo[] = [];

    for (let i = existing + 1; i <= 6; i++) {
      const hdWallet = ethers.Wallet.createRandom();
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
    return wallets;
  }

  getUserWalletCount(userId: string): number {
    return this.store.countByUser(userId);
  }

  /**
   * Link existing wallets to a gated wallet address (called after gate verification)
   */
  linkWalletsToGatedWallet(userId: string, gatedWalletAddress: string): void {
    const wallets = this.store.findByUser(userId);
    for (const w of wallets) {
      this.store.update(userId, w.walletIndex, {
        linkedWalletAddress: gatedWalletAddress.toLowerCase()
      });
    }
    console.log(`🔗 Linked ${wallets.length} wallets to gated wallet ${gatedWalletAddress.slice(0, 10)}...`);
  }

  /**
   * Recover wallets using gated wallet address + last 4 digits of any wallet's private key
   * Returns the userId if found, allowing the user to reclaim their wallets
   */
  recoverWallets(gatedWalletAddress: string, keyLast4: string): { userId: string; walletCount: number } | null {
    const normalizedAddress = gatedWalletAddress.toLowerCase();
    const normalizedKey = keyLast4.toLowerCase();

    // Find all wallets linked to this gated address
    const allWallets = this.store.findAll();
    const matchingWallet = allWallets.find(w =>
      w.linkedWalletAddress === normalizedAddress &&
      w.keyLast4?.toLowerCase() === normalizedKey
    );

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
  transferWallets(fromUserId: string, toUserId: string): number {
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
      (this.store as any).data = this.store.findAll();
      (this.store as any).save();
      console.log(`📦 Transferred ${transferred} wallets from ${fromUserId} to ${toUserId}`);
    }

    return transferred;
  }

  /**
   * Get wallets info for recovery display (shows addresses + last4 for verification)
   */
  getWalletsForRecovery(gatedWalletAddress: string): { address: string; keyLast4: string; index: number }[] {
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
  importWallet(userId: string, privateKey: string, label?: string, linkedWalletAddress?: string): WalletInfo {
    const wallet = new ethers.Wallet(privateKey);
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
  getWalletByAddress(userId: string, address: string): WalletInfo | null {
    const wallets = this.store.findByUser(userId);
    const found = wallets.find(w => w.address.toLowerCase() === address.toLowerCase());
    if (!found) return null;

    return {
      index: found.walletIndex,
      address: found.address,
      label: found.label,
      balance: 0n,
      isActive: found.isActive,
    };
  }

  async getUserWallets(userId: string): Promise<WalletInfo[]> {
    const rows = this.store.findByUser(userId);
    const wallets: WalletInfo[] = [];

    for (const row of rows) {
      let balance = 0n;
      try {
        balance = await this.provider.getBalance(row.address);
      } catch {}
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

  async getWalletSigner(userId: string, index: number): Promise<ethers.Wallet | null> {
    const row = this.store.findByUserAndIndex(userId, index);
    if (!row) return null;
    const privateKey = this.decrypt(row.encryptedKey);
    return new ethers.Wallet(privateKey, this.provider);
  }

  async getActiveWalletSigners(userId: string): Promise<ethers.Wallet[]> {
    const rows = this.store.findActiveByUser(userId);
    return rows.map(row => {
      const privateKey = this.decrypt(row.encryptedKey);
      return new ethers.Wallet(privateKey, this.provider);
    });
  }

  toggleWalletActive(userId: string, index: number): boolean {
    return this.store.toggleActive(userId, index);
  }

  setWalletLabel(userId: string, index: number, label: string): boolean {
    this.store.update(userId, index, { label });
    return true;
  }

  exportPrivateKey(userId: string, index: number): string | null {
    const row = this.store.findByUserAndIndex(userId, index);
    if (!row) return null;
    return this.decrypt(row.encryptedKey);
  }

  async getTotalBalance(userId: string): Promise<{ pls: bigint; wallets: WalletInfo[] }> {
    const wallets = await this.getUserWallets(userId);
    const totalPls = wallets.reduce((sum, w) => sum + w.balance, 0n);
    return { pls: totalPls, wallets };
  }

  formatWalletList(wallets: WalletInfo[]): string {
    if (wallets.length === 0) {
      return '❌ No wallets generated yet. Use /wallets to create 6 wallets.';
    }

    let output = '👛 **Your Wallets**\n\n';

    for (const w of wallets) {
      const activeIcon = w.isActive ? '✅' : '⬜';
      const balanceFormatted = ethers.formatEther(w.balance);
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

export const multiWallet = new MultiWalletManager();
