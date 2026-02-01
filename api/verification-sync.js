/**
 * Vercel API: Verification Sync
 * Stores LinkedWallets verification data persistently
 * This survives Railway restarts!
 */

// In-memory store (Vercel serverless maintains state for ~15 min between calls)
// For true persistence, this should use Vercel KV or a database
// But for now, we use a simple JSON approach with Vercel's /tmp directory
const fs = require('fs');
const path = require('path');

const DATA_FILE = '/tmp/verifications.json';

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load verifications:', e);
  }
  return { verifications: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save verifications:', e);
  }
}

// Global in-memory cache (survives between requests in same instance)
let verificationCache = null;

function getCache() {
  if (!verificationCache) {
    verificationCache = loadData();
  }
  return verificationCache;
}

module.exports = async (req, res) => {
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

  const cache = getCache();

  // GET - Retrieve verification by telegramUserId or gatedWallet
  if (req.method === 'GET') {
    const { telegramUserId, gatedWallet } = req.query;

    if (telegramUserId) {
      const verification = cache.verifications[telegramUserId];
      if (verification) {
        return res.json({ success: true, found: true, verification });
      }
      return res.json({ success: true, found: false });
    }

    if (gatedWallet) {
      const normalizedWallet = gatedWallet.toLowerCase();
      // Find by gated wallet address
      const entry = Object.entries(cache.verifications).find(
        ([_, v]) => v.walletAddress?.toLowerCase() === normalizedWallet
      );
      if (entry) {
        return res.json({ success: true, found: true, telegramUserId: entry[0], verification: entry[1] });
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

    cache.verifications[telegramUserId] = {
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

    saveData(cache);
    console.log(`☁️ [VERCEL] Saved verification for ${telegramUserId}: ${walletAddress.slice(0, 10)}...`);

    return res.json({ success: true, saved: true });
  }

  // DELETE - Remove verification
  if (req.method === 'DELETE') {
    const { telegramUserId } = req.query;

    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId required' });
    }

    if (cache.verifications[telegramUserId]) {
      delete cache.verifications[telegramUserId];
      saveData(cache);
      return res.json({ success: true, deleted: true });
    }

    return res.json({ success: true, deleted: false, message: 'Not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
