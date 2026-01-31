import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { config, ERC20_ABI, PULSEX_ROUTER_ABI } from '../config';
import { pulsex } from '../core/pulsex';
import { EventEmitter } from 'events';

/**
 * Copy Trade / Whale Tracker (JSON Storage)
 *
 * Monitor wallet addresses and copy their trades in real-time.
 * Features:
 * - Track up to 10 wallets per user
 * - Auto-copy buys/sells with configurable amounts
 * - Frontrun option for competitive advantage
 * - Filters for min/max trade size
 */

interface TrackedWallet {
  id: string;
  userId: string;
  address: string;
  label: string;
  copyBuys: boolean;
  copySells: boolean;
  copyAmountPls: string;      // Stored as string for JSON
  copyPercentage: number;     // Or percentage of tracked wallet's trade
  minTradePls: string;        // Min trade size to copy
  maxTradePls: string;        // Max trade size to copy
  frontrun: boolean;          // Try to frontrun the trade
  isActive: boolean;
  totalCopied: number;
  profitLoss: string;
  createdAt: number;
}

interface CopyTradeHistory {
  id: string;
  userId: string;
  trackedWallet: string;
  originalTx: string;
  copyTx?: string;
  tokenAddress: string;
  tradeType: string;
  amountPls: string;
  status: string;
  createdAt: number;
}

interface DetectedTrade {
  wallet: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amountIn: bigint;
  amountOut: bigint;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

// JSON Storage for Tracked Wallets
class TrackedWalletStore {
  private filePath: string;
  private data: TrackedWallet[];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'trackedWallets.json');
    this.data = this.load();
  }

  private load(): TrackedWallet[] {
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

  findByUser(userId: string): TrackedWallet[] {
    return this.data.filter(w => w.userId === userId && w.isActive);
  }

  findActive(): TrackedWallet[] {
    return this.data.filter(w => w.isActive);
  }

  findByAddress(address: string): TrackedWallet[] {
    return this.data.filter(w => w.address.toLowerCase() === address.toLowerCase() && w.isActive);
  }

  getActiveAddresses(): string[] {
    const addresses = new Set<string>();
    this.data.filter(w => w.isActive).forEach(w => addresses.add(w.address.toLowerCase()));
    return Array.from(addresses);
  }

  insert(wallet: TrackedWallet): void {
    this.data.push(wallet);
    this.save();
  }

  deactivate(walletId: string, userId: string): boolean {
    const idx = this.data.findIndex(w => w.id === walletId && w.userId === userId);
    if (idx !== -1) {
      this.data[idx].isActive = false;
      this.save();
      return true;
    }
    return false;
  }

  updateStats(walletId: string, updates: Partial<TrackedWallet>): void {
    const idx = this.data.findIndex(w => w.id === walletId);
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...updates };
      this.save();
    }
  }
}

// JSON Storage for Copy Trade History
class CopyTradeHistoryStore {
  private filePath: string;
  private data: CopyTradeHistory[];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'copyTradeHistory.json');
    this.data = this.load();
  }

  private load(): CopyTradeHistory[] {
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

  insert(trade: CopyTradeHistory): void {
    this.data.push(trade);
    this.save();
  }

  findByUser(userId: string): CopyTradeHistory[] {
    return this.data.filter(t => t.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }
}

export class CopyTradeManager extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private walletStore: TrackedWalletStore;
  private historyStore: CopyTradeHistoryStore;
  private trackedWalletsCache: Map<string, TrackedWallet[]> = new Map(); // address -> configs
  private isRunning: boolean = false;

  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.walletStore = new TrackedWalletStore();
    this.historyStore = new CopyTradeHistoryStore();
    this.loadTrackedWallets();
  }

  private loadTrackedWallets(): void {
    this.trackedWalletsCache.clear();
    const wallets = this.walletStore.findActive();

    for (const wallet of wallets) {
      const address = wallet.address.toLowerCase();
      if (!this.trackedWalletsCache.has(address)) {
        this.trackedWalletsCache.set(address, []);
      }
      this.trackedWalletsCache.get(address)!.push(wallet);
    }
  }

  /**
   * Add wallet to track
   */
  async addTrackedWallet(params: {
    userId: string;
    address: string;
    label?: string;
    copyBuys?: boolean;
    copySells?: boolean;
    copyAmountPls?: bigint;
    copyPercentage?: number;
    frontrun?: boolean;
  }): Promise<TrackedWallet> {
    const id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const wallet: TrackedWallet = {
      id,
      userId: params.userId,
      address: params.address.toLowerCase(),
      label: params.label || 'Whale',
      copyBuys: params.copyBuys ?? true,
      copySells: params.copySells ?? false,
      copyAmountPls: (params.copyAmountPls || 0n).toString(),
      copyPercentage: params.copyPercentage || 10,
      minTradePls: ethers.parseEther('100000').toString(),  // 100k PLS min
      maxTradePls: ethers.parseEther('10000000').toString(), // 10M PLS max
      frontrun: params.frontrun ?? false,
      isActive: true,
      totalCopied: 0,
      profitLoss: '0',
      createdAt: Date.now(),
    };

    this.walletStore.insert(wallet);

    // Add to cache
    if (!this.trackedWalletsCache.has(wallet.address)) {
      this.trackedWalletsCache.set(wallet.address, []);
    }
    this.trackedWalletsCache.get(wallet.address)!.push(wallet);

    return wallet;
  }

  /**
   * Remove tracked wallet
   */
  removeTrackedWallet(userId: string, walletId: string): boolean {
    const result = this.walletStore.deactivate(walletId, userId);
    if (result) {
      this.loadTrackedWallets(); // Reload cache
    }
    return result;
  }

  /**
   * Get user's tracked wallets
   */
  getUserTrackedWallets(userId: string): TrackedWallet[] {
    return this.walletStore.findByUser(userId);
  }

  /**
   * Connect and start monitoring
   */
  async connect(): Promise<void> {
    try {
      this.wsProvider = new ethers.WebSocketProvider(config.wss);
      console.log('🔌 Copy trade monitor connected');
    } catch (error) {
      console.error('Copy trade connection failed:', error);
    }
  }

  /**
   * Start monitoring tracked wallets
   */
  async start(): Promise<void> {
    if (!this.wsProvider) await this.connect();
    if (!this.wsProvider) return;

    this.isRunning = true;

    // Monitor pending transactions from tracked wallets
    this.wsProvider.on('pending', async (txHash: string) => {
      try {
        const tx = await this.provider.getTransaction(txHash);
        if (!tx || !tx.from) return;

        const fromAddress = tx.from.toLowerCase();

        // Check if this is a tracked wallet
        if (!this.trackedWalletsCache.has(fromAddress)) return;

        // Check if it's a router transaction (swap)
        if (tx.to?.toLowerCase() !== config.pulsexRouter.toLowerCase()) return;

        // Decode the swap
        const trade = await this.decodeSwapTx(tx);
        if (!trade) return;

        console.log(`🐋 Whale trade detected: ${fromAddress}`);
        console.log(`   ${trade.type.toUpperCase()} ${trade.tokenSymbol}`);

        // Emit for each user tracking this wallet
        const trackers = this.trackedWalletsCache.get(fromAddress) || [];
        for (const tracker of trackers) {
          // Check if trade matches filters
          if (trade.type === 'buy' && !tracker.copyBuys) continue;
          if (trade.type === 'sell' && !tracker.copySells) continue;
          if (trade.amountIn < BigInt(tracker.minTradePls)) continue;
          if (trade.amountIn > BigInt(tracker.maxTradePls)) continue;

          this.emit('copyTrade', {
            tracker,
            trade,
            txHash,
          });
        }
      } catch {
        // Ignore decode errors
      }
    });

    console.log(`👀 Monitoring ${this.trackedWalletsCache.size} whale wallets`);
  }

  /**
   * Decode swap transaction
   */
  private async decodeSwapTx(tx: ethers.TransactionResponse): Promise<DetectedTrade | null> {
    try {
      const iface = new ethers.Interface(PULSEX_ROUTER_ABI);
      const parsed = iface.parseTransaction({ data: tx.data, value: tx.value });

      if (!parsed) return null;

      let type: 'buy' | 'sell' = 'buy';
      let tokenAddress = '';
      let amountIn = 0n;

      if (parsed.name.includes('swapExactETHForTokens')) {
        type = 'buy';
        const pathArg = parsed.args.path || parsed.args[1];
        tokenAddress = pathArg[pathArg.length - 1];
        amountIn = tx.value;
      } else if (parsed.name.includes('swapExactTokensForETH')) {
        type = 'sell';
        const pathArg = parsed.args.path || parsed.args[2];
        tokenAddress = pathArg[0];
        amountIn = parsed.args.amountIn || parsed.args[0];
      } else {
        return null;
      }

      // Get token symbol
      let tokenSymbol = '???';
      try {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
        tokenSymbol = await token.symbol();
      } catch {}

      return {
        wallet: tx.from!,
        type,
        tokenAddress,
        tokenSymbol,
        amountIn,
        amountOut: 0n,
        txHash: tx.hash,
        blockNumber: 0,
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Calculate copy amount based on config
   */
  calculateCopyAmount(tracker: TrackedWallet, originalAmount: bigint): bigint {
    const copyAmountPls = BigInt(tracker.copyAmountPls);
    if (copyAmountPls > 0n) {
      return copyAmountPls;
    }

    // Use percentage of original trade
    return (originalAmount * BigInt(Math.floor(tracker.copyPercentage * 100))) / 10000n;
  }

  /**
   * Record a copy trade in history
   */
  recordCopyTrade(params: {
    userId: string;
    trackedWallet: string;
    originalTx: string;
    copyTx?: string;
    tokenAddress: string;
    tradeType: string;
    amountPls: bigint;
    status: string;
  }): void {
    const id = `copy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.historyStore.insert({
      id,
      userId: params.userId,
      trackedWallet: params.trackedWallet,
      originalTx: params.originalTx,
      copyTx: params.copyTx,
      tokenAddress: params.tokenAddress,
      tradeType: params.tradeType,
      amountPls: params.amountPls.toString(),
      status: params.status,
      createdAt: Date.now(),
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners('pending');
    }
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    this.stop();
    if (this.wsProvider) {
      await this.wsProvider.destroy();
      this.wsProvider = null;
    }
  }

  /**
   * Format tracked wallet for display
   */
  formatTrackedWallet(wallet: TrackedWallet): string {
    const copyAmount = BigInt(wallet.copyAmountPls);
    return `
🐋 **${wallet.label}**
\`${wallet.address}\`

📊 Copy: ${wallet.copyBuys ? '✅ Buys' : '❌ Buys'} | ${wallet.copySells ? '✅ Sells' : '❌ Sells'}
💰 Amount: ${copyAmount > 0n ? ethers.formatEther(copyAmount) + ' PLS' : wallet.copyPercentage + '%'}
⚡ Frontrun: ${wallet.frontrun ? '✅ Yes' : '❌ No'}
📈 Copied: ${wallet.totalCopied} trades
    `.trim();
  }
}

export const copyTradeManager = new CopyTradeManager();
