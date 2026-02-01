import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { config, ERC20_ABI } from '../config';
import { pulsex } from '../core/pulsex';
import { EventEmitter } from 'events';

/**
 * Limit Order Engine (JSON Storage)
 *
 * Off-chain order book that monitors prices and executes
 * on-chain swaps when thresholds are met.
 *
 * Supports:
 * - Limit buys/sells at target price
 * - Stop-loss orders
 * - Take-profit orders
 * - DCA (Dollar Cost Averaging)
 * - Trailing stops
 */

type OrderType = 'limit_buy' | 'limit_sell' | 'stop_loss' | 'take_profit' | 'dca';
type OrderStatus = 'pending' | 'active' | 'filled' | 'cancelled' | 'expired' | 'failed';

interface LimitOrder {
  id: string;
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  orderType: OrderType;
  targetPrice: string;        // Stored as string for JSON
  amount: string;             // Stored as string for JSON
  slippage: number;
  status: OrderStatus;
  createdAt: number;
  expiresAt?: number;
  filledAt?: number;
  txHash?: string;
  error?: string;
}

interface DCAOrder {
  id: string;
  userId: string;
  walletAddress: string;
  tokenAddress: string;
  intervalSeconds: number;
  totalBuys: number;
  completedBuys: number;
  amountPerBuy: string;
  slippage: number;
  status: OrderStatus;
  nextBuyAt: number;
  minPrice?: string;
  maxPrice?: string;
  createdAt: number;
}

interface PriceData {
  token: string;
  priceInPls: bigint;
  liquidityPls: bigint;
  timestamp: number;
}

// JSON Storage for Limit Orders
class LimitOrderStore {
  private filePath: string;
  private data: LimitOrder[];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'limitOrders.json');
    this.data = this.load();
  }

  private load(): LimitOrder[] {
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

  findByUser(userId: string): LimitOrder[] {
    return this.data.filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }

  findActive(): LimitOrder[] {
    return this.data.filter(o => o.status === 'active');
  }

  findActiveByToken(tokenAddress: string): LimitOrder[] {
    return this.data.filter(o => o.status === 'active' && o.tokenAddress.toLowerCase() === tokenAddress.toLowerCase());
  }

  getDistinctActiveTokens(): string[] {
    const tokens = new Set<string>();
    this.data.filter(o => o.status === 'active').forEach(o => tokens.add(o.tokenAddress.toLowerCase()));
    return Array.from(tokens);
  }

  insert(order: LimitOrder): void {
    this.data.push(order);
    this.save();
  }

  update(orderId: string, updates: Partial<LimitOrder>): void {
    const idx = this.data.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...updates };
      this.save();
    }
  }

  cancel(orderId: string, userId: string): boolean {
    const idx = this.data.findIndex(o => o.id === orderId && o.userId === userId && o.status === 'active');
    if (idx !== -1) {
      this.data[idx].status = 'cancelled';
      this.save();
      return true;
    }
    return false;
  }

  findById(orderId: string): LimitOrder | undefined {
    return this.data.find(o => o.id === orderId);
  }

  // For Vercel sync - get all data
  getAllData(): LimitOrder[] {
    return [...this.data];
  }

  // For Vercel sync - import orders
  importOrders(orders: LimitOrder[]): number {
    let imported = 0;
    for (const order of orders) {
      if (!this.data.find(o => o.id === order.id)) {
        this.data.push(order);
        imported++;
      }
    }
    if (imported > 0) this.save();
    return imported;
  }
}

// JSON Storage for DCA Orders
class DCAOrderStore {
  private filePath: string;
  private data: DCAOrder[];

  constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    this.filePath = path.join(dataDir, 'dcaOrders.json');
    this.data = this.load();
  }

  private load(): DCAOrder[] {
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

  findByUser(userId: string): DCAOrder[] {
    return this.data.filter(o => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
  }

  findDue(now: number): DCAOrder[] {
    return this.data.filter(o => o.status === 'active' && o.nextBuyAt <= now);
  }

  findById(orderId: string): DCAOrder | undefined {
    return this.data.find(o => o.id === orderId);
  }

  insert(order: DCAOrder): void {
    this.data.push(order);
    this.save();
  }

  update(orderId: string, updates: Partial<DCAOrder>): void {
    const idx = this.data.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      this.data[idx] = { ...this.data[idx], ...updates };
      this.save();
    }
  }

  cancel(orderId: string, userId: string): boolean {
    const idx = this.data.findIndex(o => o.id === orderId && o.userId === userId && o.status === 'active');
    if (idx !== -1) {
      this.data[idx].status = 'cancelled';
      this.save();
      return true;
    }
    return false;
  }

  // For Vercel sync - get all data
  getAllData(): DCAOrder[] {
    return [...this.data];
  }

  // For Vercel sync - import orders
  importOrders(orders: DCAOrder[]): number {
    let imported = 0;
    for (const order of orders) {
      if (!this.data.find(o => o.id === order.id)) {
        this.data.push(order);
        imported++;
      }
    }
    if (imported > 0) this.save();
    return imported;
  }
}

export class LimitOrderEngine extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private orderStore: LimitOrderStore;
  private dcaStore: DCAOrderStore;
  private isRunning: boolean = false;
  private priceCheckInterval: NodeJS.Timeout | null = null;
  private dcaCheckInterval: NodeJS.Timeout | null = null;
  private priceCache: Map<string, PriceData> = new Map();

  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.orderStore = new LimitOrderStore();
    this.dcaStore = new DCAOrderStore();
  }

  /**
   * Create a limit order
   */
  async createOrder(params: {
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    orderType: OrderType;
    targetPrice: bigint;
    amount: bigint;
    slippage: number;
    expiresAt?: number;
  }): Promise<LimitOrder> {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: LimitOrder = {
      id,
      userId: params.userId,
      walletAddress: params.walletAddress,
      tokenAddress: params.tokenAddress,
      orderType: params.orderType,
      targetPrice: params.targetPrice.toString(),
      amount: params.amount.toString(),
      slippage: params.slippage,
      status: 'active',
      createdAt: Date.now(),
      expiresAt: params.expiresAt,
    };

    this.orderStore.insert(newOrder);
    this.emit('orderCreated', newOrder);

    // Auto-sync to Vercel backup (non-blocking)
    this.syncToVercel(params.userId).catch(() => {});

    return newOrder;
  }

  /**
   * Create a DCA order
   */
  async createDCAOrder(params: {
    userId: string;
    walletAddress: string;
    tokenAddress: string;
    totalAmountPls: bigint;
    numberOfBuys: number;
    intervalSeconds: number;
    slippage: number;
    minPrice?: bigint;
    maxPrice?: bigint;
  }): Promise<DCAOrder> {
    const id = `dca_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const amountPerBuy = params.totalAmountPls / BigInt(params.numberOfBuys);

    const order: DCAOrder = {
      id,
      userId: params.userId,
      walletAddress: params.walletAddress,
      tokenAddress: params.tokenAddress,
      intervalSeconds: params.intervalSeconds,
      totalBuys: params.numberOfBuys,
      completedBuys: 0,
      amountPerBuy: amountPerBuy.toString(),
      slippage: params.slippage,
      status: 'active',
      nextBuyAt: Date.now(),
      minPrice: params.minPrice?.toString(),
      maxPrice: params.maxPrice?.toString(),
      createdAt: Date.now(),
    };

    this.dcaStore.insert(order);
    this.emit('dcaCreated', order);

    // Auto-sync to Vercel backup (non-blocking)
    this.syncToVercel(params.userId).catch(() => {});

    return order;
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string, userId: string): boolean {
    const result = this.orderStore.cancel(orderId, userId);
    if (result) {
      this.emit('orderCancelled', orderId);
      // Sync to Vercel backup (non-blocking)
      this.syncToVercel(userId).catch(() => {});
    }
    return result;
  }

  /**
   * Cancel DCA order
   */
  cancelDCAOrder(orderId: string, userId: string): boolean {
    const result = this.dcaStore.cancel(orderId, userId);
    if (result) {
      // Sync to Vercel backup (non-blocking)
      this.syncToVercel(userId).catch(() => {});
    }
    return result;
  }

  /**
   * Get user's orders
   */
  getUserOrders(userId: string): LimitOrder[] {
    return this.orderStore.findByUser(userId);
  }

  /**
   * Get user's DCA orders
   */
  getUserDCAOrders(userId: string): DCAOrder[] {
    return this.dcaStore.findByUser(userId);
  }

  /**
   * Get current token price
   */
  async getTokenPrice(tokenAddress: string): Promise<PriceData | null> {
    try {
      const pairInfo = await pulsex.getPairInfo(tokenAddress);
      if (!pairInfo) return null;

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const decimals = await token.decimals();

      // Get price of 1 token in PLS
      const oneToken = ethers.parseUnits('1', decimals);
      const quote = await pulsex.getQuoteSell(tokenAddress, oneToken, 0);

      const priceData: PriceData = {
        token: tokenAddress,
        priceInPls: quote.amountOut,
        liquidityPls: pairInfo.liquidityPls,
        timestamp: Date.now(),
      };

      this.priceCache.set(tokenAddress.toLowerCase(), priceData);
      return priceData;
    } catch (error) {
      console.error(`Failed to get price for ${tokenAddress}:`, error);
      return null;
    }
  }

  /**
   * Check if order should execute
   */
  private shouldExecute(order: LimitOrder, currentPrice: bigint): boolean {
    const targetPrice = BigInt(order.targetPrice);

    switch (order.orderType) {
      case 'limit_buy':
        // Buy when price drops to or below target
        return currentPrice <= targetPrice;

      case 'limit_sell':
        // Sell when price rises to or above target
        return currentPrice >= targetPrice;

      case 'stop_loss':
        // Sell when price drops to or below target
        return currentPrice <= targetPrice;

      case 'take_profit':
        // Sell when price rises to or above target
        return currentPrice >= targetPrice;

      default:
        return false;
    }
  }

  /**
   * Start the order engine
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('⚡ Limit order engine started');

    // Check prices every 5 seconds
    this.priceCheckInterval = setInterval(() => this.checkPrices(), 5000);

    // Check DCA orders every 10 seconds
    this.dcaCheckInterval = setInterval(() => this.checkDCAOrders(), 10000);

    // Initial check
    await this.checkPrices();
    await this.checkDCAOrders();
  }

  /**
   * Check prices and execute orders
   */
  private async checkPrices(): Promise<void> {
    const activeTokens = this.orderStore.getDistinctActiveTokens();

    if (activeTokens.length > 0) {
      console.log(`🔍 [LIMIT] Checking ${activeTokens.length} tokens with active orders...`);
    }

    for (const tokenAddress of activeTokens) {
      const priceData = await this.getTokenPrice(tokenAddress);
      if (!priceData) {
        console.log(`⚠️ [LIMIT] Could not get price for ${tokenAddress.slice(0, 12)}...`);
        continue;
      }

      const ordersForToken = this.orderStore.findActiveByToken(tokenAddress);
      const currentPriceStr = ethers.formatEther(priceData.priceInPls);

      for (const order of ordersForToken) {
        const targetPriceStr = ethers.formatEther(BigInt(order.targetPrice));

        // Check expiry
        if (order.expiresAt && Date.now() > order.expiresAt) {
          console.log(`⏰ [LIMIT] Order ${order.id.slice(0, 15)}... expired`);
          this.orderStore.update(order.id, { status: 'expired' });
          this.emit('orderExpired', order);
          continue;
        }

        // Log price comparison
        console.log(`📊 [LIMIT] ${order.orderType.toUpperCase()} ${order.id.slice(0, 15)}...`);
        console.log(`   Current: ${currentPriceStr} PLS | Target: ${targetPriceStr} PLS`);

        const shouldExec = this.shouldExecute(order, priceData.priceInPls);
        console.log(`   Should execute: ${shouldExec ? '✅ YES' : '❌ NO'}`);

        if (shouldExec) {
          console.log(`🎯 [LIMIT] TRIGGERING order ${order.id}!`);
          this.emit('orderTriggered', { order, priceData });
        }
      }
    }
  }

  /**
   * Check and execute DCA orders
   */
  private async checkDCAOrders(): Promise<void> {
    const now = Date.now();
    const dueOrders = this.dcaStore.findDue(now);

    for (const order of dueOrders) {
      // Check price bounds if set
      const priceData = await this.getTokenPrice(order.tokenAddress);
      if (priceData) {
        if (order.minPrice && priceData.priceInPls < BigInt(order.minPrice)) {
          console.log(`DCA ${order.id}: Price below min, skipping`);
          continue;
        }
        if (order.maxPrice && priceData.priceInPls > BigInt(order.maxPrice)) {
          console.log(`DCA ${order.id}: Price above max, skipping`);
          continue;
        }
      }

      this.emit('dcaTriggered', order);
    }
  }

  /**
   * Mark order as filled
   */
  markOrderFilled(orderId: string, txHash: string): void {
    const order = this.orderStore.findById(orderId);
    this.orderStore.update(orderId, { status: 'filled', filledAt: Date.now(), txHash });
    // Sync to Vercel backup
    if (order) this.syncToVercel(order.userId).catch(() => {});
  }

  /**
   * Mark order as failed
   */
  markOrderFailed(orderId: string, error: string): void {
    const order = this.orderStore.findById(orderId);
    this.orderStore.update(orderId, { status: 'failed', error });
    // Sync to Vercel backup
    if (order) this.syncToVercel(order.userId).catch(() => {});
  }

  /**
   * Update DCA after successful buy
   */
  updateDCAAfterBuy(orderId: string): void {
    const order = this.dcaStore.findById(orderId);
    if (!order) return;

    const newCompletedBuys = order.completedBuys + 1;
    const isComplete = newCompletedBuys >= order.totalBuys;

    this.dcaStore.update(orderId, {
      completedBuys: newCompletedBuys,
      nextBuyAt: Date.now() + (order.intervalSeconds * 1000),
      status: isComplete ? 'filled' : 'active',
    });

    // Sync to Vercel backup
    this.syncToVercel(order.userId).catch(() => {});
  }

  /**
   * Stop the engine
   */
  stop(): void {
    this.isRunning = false;
    if (this.priceCheckInterval) {
      clearInterval(this.priceCheckInterval);
      this.priceCheckInterval = null;
    }
    if (this.dcaCheckInterval) {
      clearInterval(this.dcaCheckInterval);
      this.dcaCheckInterval = null;
    }
    console.log('🛑 Limit order engine stopped');
  }

  /**
   * Sync orders to Vercel for backup persistence
   */
  async syncToVercel(userId: string): Promise<boolean> {
    try {
      const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
      const limitOrders = this.orderStore.findByUser(userId);
      const dcaOrders = this.dcaStore.findByUser(userId);

      const response = await fetch(`https://dtgc.io/api/orders-sync?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ limitOrders, dcaOrders }),
      });

      if (response.ok) {
        console.log(`☁️ [SYNC] Synced ${limitOrders.length} orders to Vercel for user ${userId}`);
        return true;
      }
      return false;
    } catch (e) {
      console.error(`❌ [SYNC] Failed to sync to Vercel:`, e);
      return false;
    }
  }

  /**
   * Recover orders from Vercel backup
   */
  async syncFromVercel(userId: string): Promise<{ limitOrders: number; dcaOrders: number }> {
    try {
      const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
      const response = await fetch(`https://dtgc.io/api/orders-sync?userId=${userId}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        return { limitOrders: 0, dcaOrders: 0 };
      }

      const data = await response.json() as { orders?: LimitOrder[]; dcaOrders?: DCAOrder[] };

      // Import orders that don't already exist locally using public methods
      const importedLimitOrders = this.orderStore.importOrders(data.orders || []);
      const importedDcaOrders = this.dcaStore.importOrders(data.dcaOrders || []);

      if (importedLimitOrders > 0 || importedDcaOrders > 0) {
        console.log(`☁️ [SYNC] Recovered ${importedLimitOrders} limit orders, ${importedDcaOrders} DCA orders from Vercel`);
      }

      return { limitOrders: importedLimitOrders, dcaOrders: importedDcaOrders };
    } catch (e) {
      console.error(`❌ [SYNC] Failed to recover from Vercel:`, e);
      return { limitOrders: 0, dcaOrders: 0 };
    }
  }

  /**
   * Format order for display
   */
  formatOrder(order: LimitOrder): string {
    const typeEmoji = {
      limit_buy: '🟢',
      limit_sell: '🔴',
      stop_loss: '🛑',
      take_profit: '💰',
      dca: '📊',
    };

    return `
${typeEmoji[order.orderType]} ${order.orderType.replace('_', ' ').toUpperCase()}
Token: ${order.tokenAddress.slice(0, 10)}...
Target: ${ethers.formatEther(BigInt(order.targetPrice))} PLS
Amount: ${ethers.formatEther(BigInt(order.amount))}
Status: ${order.status}
    `.trim();
  }
}

export const limitOrderEngine = new LimitOrderEngine();
