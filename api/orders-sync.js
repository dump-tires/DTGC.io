/**
 * Order Sync API - Backup persistence for limit orders
 *
 * Syncs orders between Railway bot and Vercel for redundancy.
 * If Railway restarts, orders can be recovered from Vercel.
 *
 * POST: Save/update orders for a user
 * GET: Retrieve orders for a user
 * DELETE: Remove orders for a user
 */

import fs from 'fs';

// In-memory store with file backup
const ordersStore = new Map();

// Storage file for persistence across warm instances
const STORAGE_FILE = '/tmp/dtgc-orders-sync.json';

// Load from file on cold start
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    Object.entries(data).forEach(([k, v]) => ordersStore.set(k, v));
    console.log(`[orders-sync] Loaded orders for ${ordersStore.size} users`);
  }
} catch (e) {
  console.log('[orders-sync] No existing storage found');
}

// Save to file
function saveToStorage() {
  try {
    const data = Object.fromEntries(ordersStore);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[orders-sync] Failed to save:', e);
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple API key auth (use BOT_TOKEN as shared secret)
  const authHeader = req.headers.authorization;
  const apiKey = process.env.ORDERS_SYNC_KEY || process.env.BOT_TOKEN?.slice(-20);

  if (authHeader !== `Bearer ${apiKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId } = req.query;

  // GET: Retrieve orders for a user
  if (req.method === 'GET') {
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const userOrders = ordersStore.get(userId);

    return res.status(200).json({
      success: true,
      userId,
      orders: userOrders?.limitOrders || [],
      dcaOrders: userOrders?.dcaOrders || [],
      tradeHistory: userOrders?.tradeHistory || [],
      syncedAt: userOrders?.syncedAt || null,
    });
  }

  // POST: Save orders for a user
  if (req.method === 'POST') {
    const { limitOrders, dcaOrders, tradeHistory } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Merge with existing data
    const existing = ordersStore.get(userId) || {};

    const updated = {
      limitOrders: limitOrders || existing.limitOrders || [],
      dcaOrders: dcaOrders || existing.dcaOrders || [],
      tradeHistory: tradeHistory || existing.tradeHistory || [],
      syncedAt: Date.now(),
    };

    ordersStore.set(userId, updated);
    saveToStorage();

    console.log(`[orders-sync] Saved ${updated.limitOrders.length} orders for user ${userId}`);

    return res.status(200).json({
      success: true,
      userId,
      orderCount: updated.limitOrders.length,
      dcaCount: updated.dcaOrders.length,
      historyCount: updated.tradeHistory.length,
      syncedAt: updated.syncedAt,
    });
  }

  // DELETE: Clear orders for a user
  if (req.method === 'DELETE') {
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    ordersStore.delete(userId);
    saveToStorage();

    return res.status(200).json({
      success: true,
      message: `Orders cleared for user ${userId}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
