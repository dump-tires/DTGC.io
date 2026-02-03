/**
 * Simple JSON File Storage
 * Replaces better-sqlite3 for compatibility
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface Store<T> {
  data: T[];
  save: () => void;
  findAll: () => T[];
  findOne: (predicate: (item: T) => boolean) => T | undefined;
  findMany: (predicate: (item: T) => boolean) => T[];
  insert: (item: T) => T;
  update: (predicate: (item: T) => boolean, updates: Partial<T>) => void;
  delete: (predicate: (item: T) => boolean) => void;
}

export function createStore<T extends { id?: string | number }>(name: string): Store<T> {
  const filePath = path.join(DATA_DIR, `${name}.json`);

  // Load existing data
  let data: T[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      data = JSON.parse(content);
    } catch {
      data = [];
    }
  }

  const save = () => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  };

  return {
    data,
    save,
    findAll: () => [...data],
    findOne: (predicate) => data.find(predicate),
    findMany: (predicate) => data.filter(predicate),
    insert: (item) => {
      if (!item.id) {
        (item as any).id = Date.now().toString();
      }
      data.push(item);
      save();
      return item;
    },
    update: (predicate, updates) => {
      const index = data.findIndex(predicate);
      if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        save();
      }
    },
    delete: (predicate) => {
      const index = data.findIndex(predicate);
      if (index !== -1) {
        data.splice(index, 1);
        save();
      }
    }
  };
}

// Pre-defined stores
export const usersStore = createStore<{
  id: string;
  vistoId: string;
  walletAddress?: string;
  encryptedKey?: string;
  createdAt: number;
}>('users');

export const walletsStore = createStore<{
  id: string;
  vistoId: string;
  address: string;
  encryptedKey: string;
  walletIndex: number;
  isActive: boolean;
}>('wallets');

export const ordersStore = createStore<{
  id: string;
  vistoId: string;
  tokenAddress: string;
  orderType: string;
  amount: string;
  targetPrice: string;
  slippage: number;
  gasGwei: number;
  status: string;
  source: string;
  createdAt: number;
  executedAt?: number;
  txHash?: string;
}>('orders');

export const tradesStore = createStore<{
  id: string;
  vistoId: string;
  tokenAddress: string;
  tokenSymbol: string;
  entryPrice: string;
  exitPrice: string;
  invested: string;
  received: string;
  pnl: string;
  pnlPercent: number;
  timestamp: number;
}>('trades');

export const snipeTargetsStore = createStore<{
  id: string;
  vistoId: string;
  tokenAddress: string;
  tokenSymbol: string;
  mode: string;
  amount: string;
  limitPrice?: string;
  walletsActive: string;
  status: string;
  source: string;
  createdAt: number;
}>('snipeTargets');

// ═══════════════════════════════════════════════════════════════════════════
// LINKED WALLETS - Persistent storage for linked external wallets
// ═══════════════════════════════════════════════════════════════════════════

export interface LinkedWalletEntry {
  id: string;           // vistoId (Telegram user ID)
  chatId: string;       // Telegram chat ID
  walletAddress: string; // Linked external wallet address (DTGC gate wallet)
  balanceUsd: number;   // USD balance at time of verification
  verifiedAt: number;   // Timestamp of verification
  expiresAt: number;    // When verification expires (24 hours)
  // Bot wallet linking (optional - for wallet recovery/linking)
  botWalletAddress?: string;  // Bot wallet address linked during verification
  botKeyLast4?: string;       // Last 4 chars of bot wallet key for verification
}

export const linkedWalletsStore = createStore<LinkedWalletEntry>('linkedWallets');

// Vercel sync for permanent persistence
async function syncVerificationToVercel(entry: LinkedWalletEntry & { username?: string }): Promise<boolean> {
  try {
    const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
    const response = await fetch('https://dtgc.io/api/verification-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        telegramUserId: entry.id,
        chatId: entry.chatId,
        walletAddress: entry.walletAddress,
        balanceUsd: entry.balanceUsd,
        username: entry.username || null,
        botWalletAddress: entry.botWalletAddress,
        botKeyLast4: entry.botKeyLast4,
      }),
    });
    if (response.ok) {
      console.log(`☁️ [VERCEL] Synced verification for user ${entry.id}`);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`❌ [VERCEL] Failed to sync verification:`, e);
    return false;
  }
}

async function recoverVerificationFromVercel(vistoId: string, gatedWallet?: string): Promise<LinkedWalletEntry | null> {
  try {
    const apiKey = process.env.BOT_TOKEN?.slice(-20) || '';
    const queryParam = gatedWallet
      ? `gatedWallet=${gatedWallet.toLowerCase()}`
      : `telegramUserId=${vistoId}`;

    const response = await fetch(`https://dtgc.io/api/verification-sync?${queryParam}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) return null;

    const data = await response.json() as {
      success: boolean;
      found: boolean;
      telegramUserId?: string;
      verification?: {
        telegramUserId: string;
        chatId: string;
        walletAddress: string;
        balanceUsd: number;
        botWalletAddress?: string;
        botKeyLast4?: string;
        verifiedAt: number;
        expiresAt: number;
      };
    };

    if (!data.found || !data.verification) return null;

    const v = data.verification;
    const entry: LinkedWalletEntry = {
      id: v.telegramUserId,
      chatId: v.chatId,
      walletAddress: v.walletAddress,
      balanceUsd: v.balanceUsd,
      botWalletAddress: v.botWalletAddress,
      botKeyLast4: v.botKeyLast4,
      verifiedAt: v.verifiedAt,
      expiresAt: v.expiresAt,
    };

    // Save to local store
    linkedWalletsStore.delete((e) => e.id === entry.id);
    linkedWalletsStore.insert(entry);
    console.log(`☁️ [VERCEL] Recovered verification for user ${entry.id}: ${entry.walletAddress.slice(0, 10)}...`);

    return entry;
  } catch (e) {
    console.error(`❌ [VERCEL] Failed to recover verification:`, e);
    return null;
  }
}

export const LinkedWallets = {
  /**
   * Save a linked wallet (with optional bot wallet linking)
   * ALSO syncs to Vercel for permanent persistence!
   */
  link: (
    vistoId: string,
    chatId: string,
    walletAddress: string,
    balanceUsd: number,
    botWalletAddress?: string,
    botKeyLast4?: string,
    username?: string
  ): LinkedWalletEntry => {
    // Remove any existing entry for this user
    linkedWalletsStore.delete((e) => e.id === vistoId);

    const entry: LinkedWalletEntry = {
      id: vistoId,
      chatId,
      walletAddress: walletAddress.toLowerCase(),
      balanceUsd,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 365 days - permanent for practical purposes
      botWalletAddress: botWalletAddress?.toLowerCase(),
      botKeyLast4: botKeyLast4?.toLowerCase(),
    };

    linkedWalletsStore.insert(entry);
    console.log(`🔗 Linked wallet for user ${vistoId}: ${walletAddress.slice(0, 10)}...${botWalletAddress ? ` + bot wallet ${botWalletAddress.slice(0, 10)}...` : ''}`);

    // Sync to Vercel for permanent persistence (non-blocking)
    syncVerificationToVercel({ ...entry, username }).catch(() => {});

    return entry;
  },

  /**
   * Recover verification from Vercel cloud backup
   */
  recoverFromVercel: recoverVerificationFromVercel,

  /**
   * Get bot wallet for a user
   */
  getBotWallet: (vistoId: string): { address: string; keyLast4: string } | undefined => {
    const entry = linkedWalletsStore.findOne((e) => e.id === vistoId);
    if (entry?.botWalletAddress && entry?.botKeyLast4) {
      return { address: entry.botWalletAddress, keyLast4: entry.botKeyLast4 };
    }
    return undefined;
  },

  /**
   * Get linked wallet for a user (sync version - checks local only)
   */
  get: (vistoId: string): LinkedWalletEntry | undefined => {
    const entry = linkedWalletsStore.findOne((e) => e.id === vistoId);
    if (entry && entry.expiresAt > Date.now()) {
      return entry;
    }
    // Expired or not found locally
    return undefined;
  },

  /**
   * Get linked wallet with Vercel recovery if missing locally
   * Use this for critical verification checks!
   */
  getWithRecovery: async (vistoId: string): Promise<LinkedWalletEntry | undefined> => {
    // First check local
    const localEntry = linkedWalletsStore.findOne((e) => e.id === vistoId);
    if (localEntry && localEntry.expiresAt > Date.now()) {
      return localEntry;
    }

    // Try Vercel recovery
    console.log(`🔍 Local verification missing for ${vistoId}, trying Vercel...`);
    const recovered = await recoverVerificationFromVercel(vistoId);
    if (recovered && recovered.expiresAt > Date.now()) {
      return recovered;
    }

    return undefined;
  },

  /**
   * Check if a user has a valid linked wallet
   */
  hasValidLink: (vistoId: string): boolean => {
    const entry = LinkedWallets.get(vistoId);
    return !!entry;
  },

  /**
   * Check with Vercel recovery - async version for critical checks
   */
  hasValidLinkAsync: async (vistoId: string): Promise<boolean> => {
    const entry = await LinkedWallets.getWithRecovery(vistoId);
    return !!entry;
  },

  /**
   * Remove linked wallet
   */
  unlink: (vistoId: string): void => {
    linkedWalletsStore.delete((e) => e.id === vistoId);
    console.log(`🔓 Unlinked wallet for user ${vistoId}`);
  },

  /**
   * Get wallet address for a user
   */
  getAddress: (vistoId: string): string | undefined => {
    const entry = LinkedWallets.get(vistoId);
    return entry?.walletAddress;
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// TRADE HISTORY - Complete record of all trades, snipes, and limit orders
// ═══════════════════════════════════════════════════════════════════════════

export type TradeHistoryType =
  | 'instabond_snipe'  // InstaBond graduation snipe order
  | 'limit_buy'        // Limit buy order
  | 'limit_sell'       // Limit sell order
  | 'stop_loss'        // Stop loss order
  | 'take_profit'      // Take profit order
  | 'market_buy'       // Instant market buy
  | 'market_sell'      // Instant market sell
  | 'dca'              // DCA order
  | 'copy_trade';      // Copy trade execution

export type TradeHistoryStatus =
  | 'pending'          // Order placed, waiting
  | 'watching'         // Watching for trigger
  | 'executing'        // Currently executing
  | 'completed'        // Successfully executed
  | 'failed'           // Execution failed
  | 'cancelled';       // User cancelled

export interface TradeHistoryEntry {
  id: string;
  vistoId: string;           // User ID
  chatId: string;            // Telegram chat ID for notifications
  type: TradeHistoryType;
  status: TradeHistoryStatus;

  // Wallet linking - ties history to verification wallet
  gatedWalletAddress?: string;  // $50 DTGC verification wallet
  snipeWalletAddress?: string;  // Which snipe wallet executed the trade
  snipeWalletIndex?: number;    // Snipe wallet index (1-6)

  // Token info
  tokenAddress: string;
  tokenSymbol: string;
  tokenName?: string;

  // Order details
  amountPls: string;         // Amount in PLS
  amountUsd?: string;        // USD value at time of order
  targetPrice?: string;      // Target price for limit orders
  triggerCondition?: string; // What triggers execution (e.g., "graduation", "price < 0.001")

  // Execution details
  executedPrice?: string;
  tokensReceived?: string;
  txHash?: string;
  gasCost?: string;
  slippage?: number;

  // PnL tracking
  entryPrice?: string;
  currentPrice?: string;
  pnlPls?: string;
  pnlPercent?: number;

  // Sell order linked (for take profit/stop loss)
  linkedOrderId?: string;

  // Timestamps
  createdAt: number;
  updatedAt: number;
  executedAt?: number;

  // Notes
  notes?: string;
}

export const tradeHistoryStore = createStore<TradeHistoryEntry>('tradeHistory');

// ═══════════════════════════════════════════════════════════════════════════
// TRADE HISTORY HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export const TradeHistory = {
  /**
   * Log a new InstaBond snipe order
   * @param gatedWalletAddress - The verified $50 DTGC wallet address that authorized this trade
   * @param snipeWalletAddress - The bot wallet address executing the trade
   * @param snipeWalletIndex - The wallet slot (1-6)
   */
  logInstaBondSnipe: (
    vistoId: string,
    chatId: string,
    tokenAddress: string,
    tokenSymbol: string,
    amountPls: string,
    sellPercent?: number,
    sellMultiplier?: number,
    gatedWalletAddress?: string,
    snipeWalletAddress?: string,
    snipeWalletIndex?: number
  ): TradeHistoryEntry => {
    const entry: TradeHistoryEntry = {
      id: `ib_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      vistoId,
      chatId,
      type: 'instabond_snipe',
      status: 'watching',
      tokenAddress,
      tokenSymbol,
      amountPls,
      triggerCondition: 'graduation (200M PLS bonding curve)',
      // Link to verification wallet for audit trail
      gatedWalletAddress: gatedWalletAddress?.toLowerCase(),
      snipeWalletAddress: snipeWalletAddress?.toLowerCase(),
      snipeWalletIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notes: sellPercent && sellMultiplier
        ? `Auto-sell ${sellPercent}% at ${sellMultiplier}x`
        : undefined,
    };

    tradeHistoryStore.insert(entry);
    return entry;
  },

  /**
   * Log a limit order (buy/sell/take profit/stop loss)
   * @param gatedWalletAddress - The verified $50 DTGC wallet address that authorized this trade
   * @param snipeWalletAddress - The bot wallet address executing the trade
   * @param snipeWalletIndex - The wallet slot (1-6)
   */
  logLimitOrder: (
    vistoId: string,
    chatId: string,
    type: 'limit_buy' | 'limit_sell' | 'stop_loss' | 'take_profit',
    tokenAddress: string,
    tokenSymbol: string,
    amountPls: string,
    targetPrice: string,
    linkedOrderId?: string,
    gatedWalletAddress?: string,
    snipeWalletAddress?: string,
    snipeWalletIndex?: number
  ): TradeHistoryEntry => {
    const entry: TradeHistoryEntry = {
      id: `lo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      vistoId,
      chatId,
      type,
      status: 'watching',
      tokenAddress,
      tokenSymbol,
      amountPls,
      targetPrice,
      linkedOrderId,
      // Link to verification wallet for audit trail
      gatedWalletAddress: gatedWalletAddress?.toLowerCase(),
      snipeWalletAddress: snipeWalletAddress?.toLowerCase(),
      snipeWalletIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    tradeHistoryStore.insert(entry);
    return entry;
  },

  /**
   * Update order status
   */
  updateStatus: (
    orderId: string,
    status: TradeHistoryStatus,
    executionDetails?: {
      executedPrice?: string;
      tokensReceived?: string;
      txHash?: string;
      gasCost?: string;
      pnlPls?: string;
      pnlPercent?: number;
    }
  ): void => {
    tradeHistoryStore.update(
      (e) => e.id === orderId,
      {
        status,
        updatedAt: Date.now(),
        executedAt: status === 'completed' || status === 'failed' ? Date.now() : undefined,
        ...executionDetails,
      }
    );
  },

  /**
   * Get all orders for a user
   */
  getUserHistory: (vistoId: string, limit: number = 20): TradeHistoryEntry[] => {
    return tradeHistoryStore
      .findMany((e) => e.vistoId === vistoId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /**
   * Get active (pending/watching) orders for a user
   */
  getActiveOrders: (vistoId: string): TradeHistoryEntry[] => {
    return tradeHistoryStore
      .findMany((e) =>
        e.vistoId === vistoId &&
        (e.status === 'pending' || e.status === 'watching' || e.status === 'executing')
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Get completed trades for PnL summary
   */
  getCompletedTrades: (vistoId: string, limit: number = 50): TradeHistoryEntry[] => {
    return tradeHistoryStore
      .findMany((e) =>
        e.vistoId === vistoId &&
        (e.status === 'completed' || e.status === 'failed')
      )
      .sort((a, b) => b.executedAt! - a.executedAt!)
      .slice(0, limit);
  },

  /**
   * Cancel an order
   */
  cancelOrder: (orderId: string): boolean => {
    const order = tradeHistoryStore.findOne((e) => e.id === orderId);
    if (order && (order.status === 'pending' || order.status === 'watching')) {
      tradeHistoryStore.update(
        (e) => e.id === orderId,
        { status: 'cancelled', updatedAt: Date.now() }
      );
      return true;
    }
    return false;
  },

  /**
   * Format order for Telegram display
   */
  formatForTelegram: (entry: TradeHistoryEntry): string => {
    const typeEmoji: Record<TradeHistoryType, string> = {
      instabond_snipe: '🎓',
      limit_buy: '🟢',
      limit_sell: '🔴',
      stop_loss: '🛑',
      take_profit: '💰',
      market_buy: '💰',
      market_sell: '💸',
      dca: '📊',
      copy_trade: '🐋',
    };

    const statusEmoji: Record<TradeHistoryStatus, string> = {
      pending: '⏳',
      watching: '👁️',
      executing: '⚡',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    };

    const typeName: Record<TradeHistoryType, string> = {
      instabond_snipe: 'InstaBond Snipe',
      limit_buy: 'Limit Buy',
      limit_sell: 'Limit Sell',
      stop_loss: 'Stop Loss',
      take_profit: 'Take Profit',
      market_buy: 'Market Buy',
      market_sell: 'Market Sell',
      dca: 'DCA Order',
      copy_trade: 'Copy Trade',
    };

    const date = new Date(entry.createdAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let msg = `${typeEmoji[entry.type]} **${typeName[entry.type]}**\n`;
    msg += `${statusEmoji[entry.status]} ${entry.status.toUpperCase()}\n`;
    msg += `🪙 ${entry.tokenSymbol || entry.tokenAddress.slice(0, 8)}\n`;
    msg += `💰 ${formatPls(entry.amountPls)} PLS\n`;

    if (entry.targetPrice) {
      msg += `🎯 Target: ${entry.targetPrice}\n`;
    }

    if (entry.executedPrice) {
      msg += `📈 Executed @ ${entry.executedPrice}\n`;
    }

    if (entry.pnlPercent !== undefined) {
      const sign = entry.pnlPercent >= 0 ? '+' : '';
      msg += `📊 PnL: ${sign}${entry.pnlPercent.toFixed(2)}%\n`;
    }

    if (entry.txHash) {
      msg += `🔗 [Tx](https://scan.pulsechain.com/tx/${entry.txHash})\n`;
    }

    msg += `📅 ${date}`;

    return msg;
  },

  /**
   * Log a market trade (direct buy/sell)
   * @param gatedWalletAddress - The verified $50 DTGC wallet address that authorized this trade
   */
  logMarketTrade: (
    vistoId: string,
    chatId: string,
    type: 'market_buy' | 'market_sell',
    tokenAddress: string,
    tokenSymbol: string,
    amountPls: string,
    executedPrice?: string,
    txHash?: string,
    gatedWalletAddress?: string,
    snipeWalletAddress?: string,
    snipeWalletIndex?: number
  ): TradeHistoryEntry => {
    const entry: TradeHistoryEntry = {
      id: `mt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      vistoId,
      chatId,
      type,
      status: txHash ? 'completed' : 'pending',
      tokenAddress,
      tokenSymbol,
      amountPls,
      executedPrice,
      txHash,
      gatedWalletAddress: gatedWalletAddress?.toLowerCase(),
      snipeWalletAddress: snipeWalletAddress?.toLowerCase(),
      snipeWalletIndex,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      executedAt: txHash ? Date.now() : undefined,
    };

    tradeHistoryStore.insert(entry);
    return entry;
  },

  /**
   * Get trade history by gated wallet address (for auditing)
   * Returns all trades authorized by a specific verification wallet
   */
  getByGatedWallet: (gatedWalletAddress: string, limit: number = 100): TradeHistoryEntry[] => {
    const normalizedAddress = gatedWalletAddress.toLowerCase();
    return tradeHistoryStore
      .findMany((e) => e.gatedWalletAddress === normalizedAddress)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /**
   * Get trade history by snipe wallet address
   * Returns all trades executed by a specific snipe wallet
   */
  getBySnipeWallet: (snipeWalletAddress: string, limit: number = 100): TradeHistoryEntry[] => {
    const normalizedAddress = snipeWalletAddress.toLowerCase();
    return tradeHistoryStore
      .findMany((e) => e.snipeWalletAddress === normalizedAddress)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },

  /**
   * Link existing trades to a gated wallet (migration helper)
   * Useful for associating older trades with newly verified wallets
   */
  linkTradesToGatedWallet: (vistoId: string, gatedWalletAddress: string): number => {
    const normalizedAddress = gatedWalletAddress.toLowerCase();
    const unlinkedTrades = tradeHistoryStore.findMany(
      (e) => e.vistoId === vistoId && !e.gatedWalletAddress
    );

    let count = 0;
    for (const trade of unlinkedTrades) {
      tradeHistoryStore.update(
        (e) => e.id === trade.id,
        { gatedWalletAddress: normalizedAddress, updatedAt: Date.now() }
      );
      count++;
    }

    console.log(`[TradeHistory] Linked ${count} trades to gated wallet ${normalizedAddress.slice(0, 10)}...`);
    return count;
  },
};

// Helper to format PLS numbers
function formatPls(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTABOND SNIPE ORDERS - PERSISTENT STORAGE (survives bot restarts!)
// ═══════════════════════════════════════════════════════════════════════════

export interface PersistentSnipeOrder {
  id: string;
  vistoId: string;              // Telegram user ID
  chatId: string;               // Telegram chat ID
  tokenAddress: string;
  tokenName?: string;
  tokenSymbol?: string;
  walletId: string;
  walletAddress: string;
  amountPls: string;            // Stored as string for BigInt compat
  gasPriority: 'normal' | 'fast' | 'turbo' | 'max';
  gasGwei: number;
  status: 'pending' | 'triggered' | 'filled' | 'cancelled' | 'failed';
  createdAt: number;
  filledAt?: number;
  txHash?: string;
  tokensReceived?: string;
  entryPrice?: number;
  // Wallet linking - ties order to verification wallet for audit
  gatedWalletAddress?: string;  // $50 DTGC verification wallet
  snipeWalletIndex?: number;    // Which slot (1-6)
  // Take Profit settings
  takeProfitEnabled: boolean;
  takeProfitPercent?: number;
  sellPercent?: number;
  takeProfitStatus?: 'active' | 'triggered' | 'filled' | 'cancelled';
  sellTxHash?: string;
  tokensSold?: string;
  sellProfitPls?: number;
  // Error tracking
  error?: string;
  retryCount?: number;
}

export const snipeOrdersStore = createStore<PersistentSnipeOrder>('snipeOrders');

export const SnipeOrders = {
  /**
   * Create a new snipe order (PERSISTED!)
   */
  create: (order: Omit<PersistentSnipeOrder, 'id' | 'createdAt' | 'status'>): PersistentSnipeOrder => {
    const newOrder: PersistentSnipeOrder = {
      ...order,
      id: `SNP-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      status: 'pending',
      createdAt: Date.now(),
    };
    snipeOrdersStore.insert(newOrder);
    console.log(`💾 [PERSIST] Created snipe order ${newOrder.id} for ${order.tokenSymbol || order.tokenAddress.slice(0, 10)}`);
    return newOrder;
  },

  /**
   * Get order by ID
   */
  get: (orderId: string): PersistentSnipeOrder | undefined => {
    return snipeOrdersStore.findOne((o) => o.id === orderId);
  },

  /**
   * Get all pending orders for a user
   */
  getPending: (vistoId: string): PersistentSnipeOrder[] => {
    return snipeOrdersStore.findMany((o) =>
      o.vistoId === vistoId && o.status === 'pending'
    ).sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Get all orders for a user
   */
  getAll: (vistoId: string): PersistentSnipeOrder[] => {
    return snipeOrdersStore.findMany((o) => o.vistoId === vistoId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /**
   * Get ALL pending orders (for graduation sniper to load on startup)
   */
  getAllPending: (): PersistentSnipeOrder[] => {
    return snipeOrdersStore.findMany((o) => o.status === 'pending');
  },

  /**
   * Update order status
   */
  updateStatus: (
    orderId: string,
    status: PersistentSnipeOrder['status'],
    details?: Partial<PersistentSnipeOrder>
  ): void => {
    snipeOrdersStore.update(
      (o) => o.id === orderId,
      { status, ...details }
    );
    console.log(`💾 [PERSIST] Updated order ${orderId} -> ${status}`);
  },

  /**
   * Mark as filled with execution details
   */
  markFilled: (
    orderId: string,
    txHash: string,
    tokensReceived: string,
    entryPrice?: number
  ): void => {
    snipeOrdersStore.update(
      (o) => o.id === orderId,
      {
        status: 'filled',
        filledAt: Date.now(),
        txHash,
        tokensReceived,
        entryPrice,
        takeProfitStatus: 'active', // Activate take profit monitoring
      }
    );
    console.log(`💾 [PERSIST] Order ${orderId} FILLED! TX: ${txHash.slice(0, 12)}...`);
  },

  /**
   * Mark take profit as triggered/filled
   */
  markTakeProfitFilled: (
    orderId: string,
    sellTxHash: string,
    tokensSold: string,
    profitPls: number
  ): void => {
    snipeOrdersStore.update(
      (o) => o.id === orderId,
      {
        takeProfitStatus: 'filled',
        sellTxHash,
        tokensSold,
        sellProfitPls: profitPls,
      }
    );
    console.log(`💾 [PERSIST] Order ${orderId} Take Profit FILLED! Profit: ${profitPls} PLS`);
  },

  /**
   * Cancel an order
   */
  cancel: (orderId: string): boolean => {
    const order = snipeOrdersStore.findOne((o) => o.id === orderId);
    if (order && order.status === 'pending') {
      snipeOrdersStore.update(
        (o) => o.id === orderId,
        { status: 'cancelled' }
      );
      console.log(`💾 [PERSIST] Order ${orderId} CANCELLED`);
      return true;
    }
    return false;
  },

  /**
   * Mark as failed with error
   */
  markFailed: (orderId: string, error: string): void => {
    snipeOrdersStore.update(
      (o) => o.id === orderId,
      { status: 'failed', error }
    );
    console.log(`💾 [PERSIST] Order ${orderId} FAILED: ${error}`);
  },

  /**
   * Get stats for a user
   */
  getStats: (vistoId: string): { pending: number; filled: number; cancelled: number; failed: number } => {
    const orders = snipeOrdersStore.findMany((o) => o.vistoId === vistoId);
    return {
      pending: orders.filter(o => o.status === 'pending').length,
      filled: orders.filter(o => o.status === 'filled').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      failed: orders.filter(o => o.status === 'failed').length,
    };
  },

  /**
   * Recover orders into graduation sniper on startup
   */
  recoverToSniper: async (graduationSniper: any): Promise<number> => {
    const pendingOrders = SnipeOrders.getAllPending();
    let recovered = 0;

    for (const order of pendingOrders) {
      try {
        const { ethers } = await import('ethers');
        graduationSniper.watchToken(order.tokenAddress, {
          amountPls: ethers.parseEther(order.amountPls),
          slippage: 15,
          gasLimit: 500000,
          gasPriceMultiplier: order.gasGwei / 0.01,
          autoSellPercent: order.sellPercent,
          userId: order.vistoId,
          chatId: order.chatId,
          orderId: order.id,
        });
        recovered++;
        console.log(`🔄 [RECOVER] Restored order ${order.id} for ${order.tokenSymbol || order.tokenAddress.slice(0, 10)}`);
      } catch (e) {
        console.error(`❌ [RECOVER] Failed to restore order ${order.id}:`, e);
      }
    }

    if (recovered > 0) {
      console.log(`✅ [RECOVER] Restored ${recovered} pending snipe orders from disk`);
    }

    return recovered;
  },
};
