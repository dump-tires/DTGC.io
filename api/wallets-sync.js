/**
 * Wallet Sync API - Persistent storage for snipe wallets
 *
 * This is the SOURCE OF TRUTH for wallet data.
 * Railway bot syncs here on every wallet import/update.
 * Recovery pulls from here, not Railway's filesystem.
 *
 * POST: Save/update wallets for a user (keyed by gatedWallet)
 * GET: Retrieve wallets for a user
 */

import fs from 'fs';

// In-memory store with file backup
const walletsStore = new Map();

// Storage file for persistence across warm instances
const STORAGE_FILE = '/tmp/dtgc-wallets-sync.json';

// Load from file on cold start
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    Object.entries(data).forEach(([k, v]) => walletsStore.set(k, v));
    console.log(`[wallets-sync] Loaded wallets for ${walletsStore.size} users`);
  }
} catch (e) {
  console.log('[wallets-sync] No existing storage found');
}

// Save to file
function saveToStorage() {
  try {
    const data = Object.fromEntries(walletsStore);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[wallets-sync] Failed to save:', e);
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

    const userData = walletsStore.get(userKey);

    if (!userData) {
      return res.status(200).json({
        success: true,
        found: false,
        wallets: [],
        syncedAt: null,
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
    if (gated) walletsStore.set(gated.toLowerCase(), updated);
    if (tgId) walletsStore.set(tgId, updated);

    saveToStorage();

    console.log(`[wallets-sync] Saved ${updated.wallets.length} wallets for ${gated || tgId}`);

    return res.status(200).json({
      success: true,
      gatedWallet: gated,
      telegramUserId: tgId,
      walletCount: updated.wallets.length,
      syncedAt: updated.syncedAt,
    });
  }

  // DELETE: Clear wallets for a user
  if (req.method === 'DELETE') {
    if (!userKey) {
      return res.status(400).json({ error: 'gatedWallet or telegramUserId required' });
    }

    walletsStore.delete(userKey);
    saveToStorage();

    return res.status(200).json({
      success: true,
      message: `Wallets cleared for ${userKey}`,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
