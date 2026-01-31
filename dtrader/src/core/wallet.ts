import { ethers } from 'ethers';
import { config, ERC20_ABI } from '../config';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

interface WalletData {
  id: string;
  telegramId: string;
  address: string;
  encryptedKey: string;
  createdAt: number;
}

interface TokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  balanceFormatted: string;
}

// Simple JSON file storage
class WalletStore {
  private filePath: string;
  private data: WalletData[];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.filePath = path.join(dataDir, 'wallets.json');
    this.data = this.load();
  }

  private load(): WalletData[] {
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

  findByTelegramId(telegramId: string): WalletData | undefined {
    return this.data.find(w => w.telegramId === telegramId);
  }

  insert(wallet: Omit<WalletData, 'id'>): WalletData {
    const newWallet: WalletData = { ...wallet, id: Date.now().toString() };
    this.data.push(newWallet);
    this.save();
    return newWallet;
  }

  upsert(telegramId: string, walletData: Omit<WalletData, 'id' | 'telegramId'>): void {
    const index = this.data.findIndex(w => w.telegramId === telegramId);
    if (index !== -1) {
      this.data[index] = { ...this.data[index], ...walletData };
    } else {
      this.data.push({ id: Date.now().toString(), telegramId, ...walletData });
    }
    this.save();
  }
}

export class WalletManager {
  private provider: ethers.JsonRpcProvider;
  private store: WalletStore;
  private encryptionKey: Buffer;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.store = new WalletStore();

    // Encryption key from env or generate (store this securely!)
    const keyHex = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
    this.encryptionKey = Buffer.from(keyHex, 'hex');
  }

  /**
   * Encrypt private key for storage
   */
  private encrypt(text: string): string {
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

  /**
   * Create or get existing wallet for user
   */
  async getOrCreateWallet(telegramId: string): Promise<{ wallet: ethers.Wallet; isNew: boolean }> {
    const existing = this.store.findByTelegramId(telegramId);

    if (existing) {
      try {
        const privateKey = this.decrypt(existing.encryptedKey);
        const wallet = new ethers.Wallet(privateKey, this.provider);
        return { wallet, isNew: false };
      } catch (err) {
        // Decryption failed - encryption key changed or data corrupted
        // Create new wallet for this user
        console.log(`⚠️ Wallet decryption failed for user ${telegramId}, creating new wallet`);
      }
    }

    // Create new wallet
    const hdWallet = ethers.Wallet.createRandom();
    const wallet = new ethers.Wallet(hdWallet.privateKey, this.provider);
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
  async importWallet(telegramId: string, privateKey: string): Promise<ethers.Wallet> {
    const wallet = new ethers.Wallet(privateKey, this.provider);
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
  async getWallet(telegramId: string): Promise<ethers.Wallet | null> {
    const existing = this.store.findByTelegramId(telegramId);

    if (!existing) return null;

    try {
      const privateKey = this.decrypt(existing.encryptedKey);
      return new ethers.Wallet(privateKey, this.provider);
    } catch (err) {
      console.log(`⚠️ Wallet decryption failed for user ${telegramId}`);
      return null;
    }
  }

  /**
   * Export private key (user must confirm)
   */
  async exportPrivateKey(telegramId: string): Promise<string | null> {
    const existing = this.store.findByTelegramId(telegramId);
    if (!existing) return null;
    return this.decrypt(existing.encryptedKey);
  }

  /**
   * Get PLS balance
   */
  async getPlsBalance(address: string): Promise<{ balance: bigint; formatted: string }> {
    const balance = await this.provider.getBalance(address);
    return {
      balance,
      formatted: ethers.formatEther(balance),
    };
  }

  /**
   * Get token balance
   */
  async getTokenBalance(walletAddress: string, tokenAddress: string): Promise<TokenBalance> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

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
      balanceFormatted: ethers.formatUnits(balance, decimals),
    };
  }

  /**
   * Get multiple token balances
   */
  async getTokenBalances(walletAddress: string, tokenAddresses: string[]): Promise<TokenBalance[]> {
    return Promise.all(
      tokenAddresses.map((addr) => this.getTokenBalance(walletAddress, addr))
    );
  }

  /**
   * Format balance for display
   */
  formatBalance(balance: string, symbol: string, usdValue?: number): string {
    const formatted = Number(balance).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
    if (usdValue !== undefined) {
      return `${formatted} ${symbol} ($${usdValue.toFixed(2)})`;
    }
    return `${formatted} ${symbol}`;
  }
}

export const walletManager = new WalletManager();
