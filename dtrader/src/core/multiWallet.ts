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

  async generateWallets(userId: string): Promise<WalletInfo[]> {
    const existing = this.store.countByUser(userId);
    if (existing >= 6) throw new Error('Maximum 6 wallets already generated');

    const wallets: WalletInfo[] = [];

    for (let i = existing + 1; i <= 6; i++) {
      const hdWallet = ethers.Wallet.createRandom();
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

  getUserWalletCount(userId: string): number {
    return this.store.countByUser(userId);
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
