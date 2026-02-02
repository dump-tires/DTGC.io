/**
 * Vercel API: Verification Sync
 * Stores LinkedWallets verification data persistently
 *
 * FIXED: Now uses Vercel KV for real persistence!
 * Previously used /tmp which was ephemeral.
 */

import { kv } from '@vercel/kv';

// KV key prefix
const KV_PREFIX = 'verification:';

// Fallback in-memory cache (for local dev or if KV unavailable)
const memoryCache = {};

async function getFromKV(key) {
  try {
    if (process.env.KV_REST_API_URL) {
      return await kv.get(`${KV_PREFIX}${key}`);
    }
  } catch (e) {
    console.error('[verification-sync] KV get error:', e.message);
  }
  return memoryCache[key] || null;
}

async function setToKV(key, value) {
  try {
    if (process.env.KV_REST_API_URL) {
      // Store with 1 year TTL
      await kv.set(`${KV_PREFIX}${key}`, value, { ex: 31536000 });
      console.log(`[verification-sync] Saved to KV: ${key}`);
      return true;
    }
  } catch (e) {
    console.error('[verification-sync] KV set error:', e.message);
  }
  memoryCache[key] = value;
  return false;
}

async function deleteFromKV(key) {
  try {
    if (process.env.KV_REST_API_URL) {
      await kv.del(`${KV_PREFIX}${key}`);
      return true;
    }
  } catch (e) {
    console.error('[verification-sync] KV delete error:', e.message);
  }
  delete memoryCache[key];
  return false;
}

// Scan for verification by wallet address (KV pattern scan)
async function findByWallet(walletAddress) {
  const normalizedWallet = walletAddress.toLowerCase();

  try {
    if (process.env.KV_REST_API_URL) {
      // Scan all verification keys (not ideal but works for small datasets)
      const keys = await kv.keys(`${KV_PREFIX}*`);
      for (const key of keys) {
        const data = await kv.get(key);
        if (data?.walletAddress?.toLowerCase() === normalizedWallet) {
          const telegramUserId = key.replace(KV_PREFIX, '');
          return { telegramUserId, verification: data };
        }
      }
    }
  } catch (e) {
    console.error('[verification-sync] KV scan error:', e.message);
  }

  // Fallback to memory scan
  for (const [userId, data] of Object.entries(memoryCache)) {
    if (data?.walletAddress?.toLowerCase() === normalizedWallet) {
      return { telegramUserId: userId, verification: data };
    }
  }

  return null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple auth check
  const authHeader = req.headers.authorization;
  const expectedKey = process.env.BOT_TOKEN?.slice(-20) || '';
  if (!authHeader || !authHeader.includes(expectedKey)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // GET - Retrieve verification by telegramUserId or gatedWallet
  if (req.method === 'GET') {
    const { telegramUserId, gatedWallet } = req.query;

    if (telegramUserId) {
      const verification = await getFromKV(telegramUserId);
      if (verification) {
        return res.json({
          success: true,
          found: true,
          verification,
          storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
        });
      }
      return res.json({ success: true, found: false });
    }

    if (gatedWallet) {
      const result = await findByWallet(gatedWallet);
      if (result) {
        return res.json({
          success: true,
          found: true,
          telegramUserId: result.telegramUserId,
          verification: result.verification,
          storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
        });
      }
      return res.json({ success: true, found: false });
    }

    return res.status(400).json({ error: 'Provide telegramUserId or gatedWallet' });
  }

  // POST - Save verification
  if (req.method === 'POST') {
    const { telegramUserId, chatId, walletAddress, balanceUsd, username, botWalletAddress, botKeyLast4 } = req.body;

    if (!telegramUserId || !walletAddress) {
      return res.status(400).json({ error: 'telegramUserId and walletAddress required' });
    }

    const verificationData = {
      telegramUserId,
      chatId: chatId || telegramUserId,
      walletAddress: walletAddress.toLowerCase(),
      balanceUsd: balanceUsd || 0,
      username: username || null,
      botWalletAddress: botWalletAddress?.toLowerCase() || null,
      botKeyLast4: botKeyLast4?.toLowerCase() || null,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    };

    const savedToKV = await setToKV(telegramUserId, verificationData);

    // Also store by wallet address for reverse lookup
    if (savedToKV) {
      await kv.set(`${KV_PREFIX}wallet:${walletAddress.toLowerCase()}`, telegramUserId, { ex: 31536000 });
    }

    console.log(`☁️ [VERCEL] Saved verification for ${telegramUserId}: ${walletAddress.slice(0, 10)}... (KV: ${savedToKV})`);

    return res.json({
      success: true,
      saved: true,
      storage: savedToKV ? 'kv' : 'memory',
    });
  }

  // DELETE - Remove verification
  if (req.method === 'DELETE') {
    const { telegramUserId } = req.query;

    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId required' });
    }

    const existing = await getFromKV(telegramUserId);
    if (existing) {
      await deleteFromKV(telegramUserId);
      // Also delete wallet reverse lookup
      if (existing.walletAddress && process.env.KV_REST_API_URL) {
        await kv.del(`${KV_PREFIX}wallet:${existing.walletAddress}`);
      }
      return res.json({ success: true, deleted: true });
    }

    return res.json({ success: true, deleted: false, message: 'Not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
