/**
 * Wallet Sync API - Persistent storage for snipe wallets
 *
 * FIXED: Now uses Vercel KV for real persistence!
 * Previously used /tmp which was ephemeral.
 *
 * POST: Save/update wallets for a user (keyed by gatedWallet)
 * GET: Retrieve wallets for a user
 */

import { kv } from '@vercel/kv';

// Fallback in-memory store (for local dev or if KV unavailable)
const memoryStore = new Map();

// KV key prefix
const KV_PREFIX = 'wallets:';

async function getFromKV(key) {
  try {
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get(`${KV_PREFIX}${key}`);
      return data;
    }
  } catch (e) {
    console.error('[wallets-sync] KV get error:', e.message);
  }
  // Fallback to memory
  return memoryStore.get(key) || null;
}

async function setToKV(key, value) {
  try {
    if (process.env.KV_REST_API_URL) {
      // Store with 1 year TTL (can be extended)
      await kv.set(`${KV_PREFIX}${key}`, value, { ex: 31536000 });
      console.log(`[wallets-sync] Saved to KV: ${key}`);
      return true;
    }
  } catch (e) {
    console.error('[wallets-sync] KV set error:', e.message);
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
    console.error('[wallets-sync] KV delete error:', e.message);
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

  // Simple API key auth
  const authHeader = req.headers.authorization;
  const apiKey = process.env.ORDERS_SYNC_KEY || process.env.BOT_TOKEN?.slice(-20);

  if (authHeader !== `Bearer ${apiKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Can use either gatedWallet address or telegramUserId as key
  const { gatedWallet, telegramUserId } = req.query;
  const userKey = gatedWallet?.toLowerCase() || telegramUserId;

  // GET: Retrieve wallets for a user
  if (req.method === 'GET') {
    if (!userKey) {
      return res.status(400).json({ error: 'gatedWallet or telegramUserId required' });
    }

    const userData = await getFromKV(userKey);

    if (!userData) {
      return res.status(200).json({
        success: true,
        found: false,
        wallets: [],
        syncedAt: null,
        storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
      });
    }

    return res.status(200).json({
      success: true,
      found: true,
      gatedWallet: userData.gatedWallet,
      telegramUserId: userData.telegramUserId,
      wallets: userData.wallets || [],
      walletCount: userData.wallets?.length || 0,
      syncedAt: userData.syncedAt,
      storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
    });
  }

  // POST: Save wallets for a user
  if (req.method === 'POST') {
    const { wallets, gatedWallet: bodyGatedWallet, telegramUserId: bodyTgId } = req.body;

    const gated = bodyGatedWallet || gatedWallet;
    const tgId = bodyTgId || telegramUserId;

    if (!gated && !tgId) {
      return res.status(400).json({ error: 'gatedWallet or telegramUserId required' });
    }

    if (!wallets || !Array.isArray(wallets)) {
      return res.status(400).json({ error: 'wallets array required' });
    }

    // Store by gatedWallet (primary) and also by telegramUserId for lookup
    const updated = {
      gatedWallet: gated,
      telegramUserId: tgId,
      wallets: wallets.map(w => ({
        index: w.index,
        address: w.address,
        encryptedKey: w.encryptedKey, // Store encrypted private key
        keyLast4: w.keyLast4,         // Last 4 chars for recovery matching
        label: w.label || `Wallet ${w.index + 1}`,
        isActive: w.isActive !== false,
        createdAt: w.createdAt || Date.now(),
      })),
      syncedAt: Date.now(),
    };

    // Store by both keys for easy lookup
    let savedToKV = false;
    if (gated) savedToKV = await setToKV(gated.toLowerCase(), updated) || savedToKV;
    if (tgId) savedToKV = await setToKV(tgId, updated) || savedToKV;

    console.log(`[wallets-sync] Saved ${updated.wallets.length} wallets for ${gated || tgId} (KV: ${savedToKV})`);

    return res.status(200).json({
      success: true,
      gatedWallet: gated,
      telegramUserId: tgId,
      walletCount: updated.wallets.length,
      syncedAt: updated.syncedAt,
      storage: savedToKV ? 'kv' : 'memory',
    });
  }

  // DELETE: Clear wallets for a user
  if (req.method === 'DELETE') {
    if (!userKey) {
      return res.status(400).json({ error: 'gatedWallet or telegramUserId required' });
    }

    await deleteFromKV(userKey);

    return res.status(200).json({
      success: true,
      message: `Wallets cleared for ${userKey}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
