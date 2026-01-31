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
