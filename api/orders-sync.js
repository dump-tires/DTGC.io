/**
 * Order Sync API - Backup persistence for limit orders
 *
 * FIXED: Now uses Vercel KV for real persistence!
 * Previously used /tmp which was ephemeral and lost data on restart.
 *
 * Syncs orders between Railway/Hetzner bot and Vercel for redundancy.
 * If the bot restarts, orders can be recovered from Vercel KV.
 *
 * POST: Save/update orders for a user
 * GET: Retrieve orders for a user
 * DELETE: Remove orders for a user
 */

import { kv } from '@vercel/kv';

// KV key prefix
const KV_PREFIX = 'orders:';

// Fallback in-memory store (for local dev or if KV unavailable)
const memoryStore = new Map();

async function getFromKV(key) {
  try {
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get(`${KV_PREFIX}${key}`);
      return data;
    }
  } catch (e) {
    console.error('[orders-sync] KV get error:', e.message);
  }
  // Fallback to memory
  return memoryStore.get(key) || null;
}

async function setToKV(key, value) {
  try {
    if (process.env.KV_REST_API_URL) {
      // Store with 1 year TTL
      await kv.set(`${KV_PREFIX}${key}`, value, { ex: 31536000 });
      console.log(`[orders-sync] Saved to KV: ${key}`);
      return true;
    }
  } catch (e) {
    console.error('[orders-sync] KV set error:', e.message);
  }
  // Fallback to memory
  memoryStore.set(key, value);
  return false;
}

async function deleteFromKV(key) {
  try {
    if (process.env.KV_REST_API_URL) {
      await kv.del(`${KV_PREFIX}${key}`);
      return true;
    }
  } catch (e) {
    console.error('[orders-sync] KV delete error:', e.message);
  }
  memoryStore.delete(key);
  return false;
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

    const userOrders = await getFromKV(userId);

    return res.status(200).json({
      success: true,
      userId,
      orders: userOrders?.limitOrders || [],
      dcaOrders: userOrders?.dcaOrders || [],
      tradeHistory: userOrders?.tradeHistory || [],
      syncedAt: userOrders?.syncedAt || null,
      storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
    });
  }

  // POST: Save orders for a user
  if (req.method === 'POST') {
    const { limitOrders, dcaOrders, tradeHistory } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Merge with existing data
    const existing = await getFromKV(userId) || {};

    const updated = {
      limitOrders: limitOrders || existing.limitOrders || [],
      dcaOrders: dcaOrders || existing.dcaOrders || [],
      tradeHistory: tradeHistory || existing.tradeHistory || [],
      syncedAt: Date.now(),
    };

    const savedToKV = await setToKV(userId, updated);

    console.log(`[orders-sync] Saved ${updated.limitOrders.length} orders for user ${userId} (KV: ${savedToKV})`);

    return res.status(200).json({
      success: true,
      userId,
      orderCount: updated.limitOrders.length,
      dcaCount: updated.dcaOrders.length,
      historyCount: updated.tradeHistory.length,
      syncedAt: updated.syncedAt,
      storage: savedToKV ? 'kv' : 'memory',
    });
  }

  // DELETE: Clear orders for a user
  if (req.method === 'DELETE') {
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    await deleteFromKV(userId);

    return res.status(200).json({
      success: true,
      message: `Orders cleared for user ${userId}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
// Upgraded to KV storage Mon Feb 3 2026
