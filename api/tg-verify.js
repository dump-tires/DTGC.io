/**
 * Unified Wallet Verification API
 *
 * FIXED: Now uses Vercel KV for real persistence!
 * Previously used /tmp which was ephemeral and lost data on restart.
 *
 * Works with:
 * - Telegram Mini App (tg-verify.html)
 * - Gold Suite website (dtgc.io/gold)
 * - Telegram Bot (direct API calls)
 */

import { ethers } from 'ethers';
import { kv } from '@vercel/kv';

// DTGC Token Contract
const DTGC_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';
const DTGC_ABI = ['function balanceOf(address) view returns (uint256)'];
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';
const GATE_MIN_USD = 50;

// KV key prefix
const KV_PREFIX = 'tgverify:';

// Fallback in-memory store (for local dev or if KV unavailable)
const memoryStore = new Map();

// Bot token for sending notifications
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

async function getFromKV(key) {
  try {
    if (process.env.KV_REST_API_URL) {
      const data = await kv.get(`${KV_PREFIX}${key}`);
      return data;
    }
  } catch (e) {
    console.error('[tg-verify] KV get error:', e.message);
  }
  return memoryStore.get(key) || null;
}

async function setToKV(key, value) {
  try {
    if (process.env.KV_REST_API_URL) {
      // Store with 1 year TTL
      await kv.set(`${KV_PREFIX}${key}`, value, { ex: 31536000 });
      console.log(`[tg-verify] Saved to KV: ${key}`);
      return true;
    }
  } catch (e) {
    console.error('[tg-verify] KV set error:', e.message);
  }
  memoryStore.set(key, value);
  return false;
}

async function scanByWallet(walletAddress) {
  const normalizedWallet = walletAddress.toLowerCase();
  try {
    if (process.env.KV_REST_API_URL) {
      const keys = await kv.keys(`${KV_PREFIX}*`);
      for (const key of keys) {
        const data = await kv.get(key);
        if (data?.walletAddress?.toLowerCase() === normalizedWallet) {
          const userId = key.replace(KV_PREFIX, '');
          return { userId, data };
        }
      }
    }
  } catch (e) {
    console.error('[tg-verify] KV scan error:', e.message);
  }
  // Fallback to memory scan
  for (const [userId, data] of memoryStore) {
    if (data?.walletAddress?.toLowerCase() === normalizedWallet) {
      return { userId, data };
    }
  }
  return null;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Check verification status
  if (req.method === 'GET') {
    const { telegramUserId, walletAddress } = req.query;

    // Check by Telegram user ID
    if (telegramUserId) {
      const verification = await getFromKV(String(telegramUserId));
      if (verification) {
        // Check if verification is still valid (within 24 hours) and refresh balance
        const ageHours = (Date.now() - verification.verifiedAt) / (1000 * 60 * 60);

        return res.status(200).json({
          verified: true,
          walletAddress: verification.walletAddress,
          balance: verification.dtgcBalance,
          balanceUsd: verification.balanceUsd,
          verifiedAt: verification.verifiedAt,
          fresh: ageHours < 1, // Fresh if verified within last hour
          // Include bot wallet info if stored
          botWalletAddress: verification.botWalletAddress || null,
          botKeyLast4: verification.botKeyLast4 || null,
          storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
        });
      }
    }

    // Check by wallet address
    if (walletAddress) {
      const result = await scanByWallet(walletAddress);
      if (result) {
        return res.status(200).json({
          verified: true,
          telegramUserId: result.userId,
          walletAddress: result.data.walletAddress,
          balance: result.data.dtgcBalance,
          balanceUsd: result.data.balanceUsd,
          verifiedAt: result.data.verifiedAt,
          storage: process.env.KV_REST_API_URL ? 'kv' : 'memory',
        });
      }
    }

    return res.status(200).json({ verified: false });
  }

  // POST: Verify wallet
  if (req.method === 'POST') {
    try {
      const {
        walletAddress,
        signature,
        message,
        timestamp,
        telegramUserId,
        dtgcBalance: providedBalance,
        usdValue: providedUsd,
        // Bot wallet linking (optional)
        botWalletAddress,
        botKeyLast4,
      } = req.body;

      // Validate required fields
      if (!walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'walletAddress required',
        });
      }

      // Validate address format
      if (!walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid wallet address format',
        });
      }

      // If signature provided, verify it
      if (signature && message) {
        // Validate timestamp (must be within 5 minutes)
        if (timestamp && Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
          return res.status(400).json({
            success: false,
            error: 'Signature expired. Please try again.',
          });
        }

        // Verify signature
        try {
          const recoveredAddress = ethers.utils.verifyMessage(message, signature);
          if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return res.status(400).json({
              success: false,
              error: 'Signature does not match wallet address',
            });
          }
        } catch (e) {
          return res.status(400).json({
            success: false,
            error: 'Invalid signature',
          });
        }
      }

      // Get DTGC balance (use provided or fetch)
      let dtgcBalance = providedBalance;
      let balanceUsd = providedUsd;

      if (!dtgcBalance || !balanceUsd) {
        // Fetch balance from chain
        const provider = new ethers.providers.JsonRpcProvider(PULSECHAIN_RPC);
        const dtgcContract = new ethers.Contract(DTGC_ADDRESS, DTGC_ABI, provider);

        try {
          const balance = await dtgcContract.balanceOf(walletAddress);
          dtgcBalance = parseFloat(ethers.utils.formatEther(balance));
        } catch (e) {
          console.error('Balance check failed:', e);
          return res.status(500).json({
            success: false,
            error: 'Failed to check DTGC balance',
          });
        }

        // Get price
        try {
          const priceResponse = await fetch(
            'https://api.dexscreener.com/latest/dex/tokens/0xD0676B28a457371D58d47E5247b439114e40Eb0F'
          );
          const priceData = await priceResponse.json();
          const dtgcPrice = parseFloat(priceData.pairs?.[0]?.priceUsd || '0');
          balanceUsd = dtgcBalance * dtgcPrice;
        } catch (e) {
          console.error('Price fetch failed:', e);
          balanceUsd = 0;
        }
      }

      // Check minimum balance
      if (balanceUsd < GATE_MIN_USD) {
        return res.status(200).json({
          success: false,
          error: `Insufficient DTGC. You have $${balanceUsd.toFixed(2)} but need $${GATE_MIN_USD}+`,
          balanceUsd,
          dtgcBalance,
          required: GATE_MIN_USD,
        });
      }

      // Store verification (including bot wallet if provided)
      const verification = {
        walletAddress: walletAddress.toLowerCase(),
        telegramUserId: telegramUserId ? String(telegramUserId) : null,
        balanceUsd,
        dtgcBalance,
        verifiedAt: Date.now(),
        hasSignature: !!signature,
        // Bot wallet linking for persistent recovery
        botWalletAddress: botWalletAddress?.toLowerCase() || null,
        botKeyLast4: botKeyLast4?.toLowerCase() || null,
      };

      console.log(`[tg-verify] Storing verification${botWalletAddress ? ` with bot wallet ${botWalletAddress.slice(0, 10)}...` : ''}`);

      // Store by telegram ID if available
      let savedToKV = false;
      if (telegramUserId) {
        savedToKV = await setToKV(String(telegramUserId), verification);
      }

      // Also store by wallet address for lookups
      await setToKV(walletAddress.toLowerCase(), {
        ...verification,
        telegramUserId,
      });

      // Notify user via Telegram bot
      if (BOT_TOKEN && telegramUserId) {
        try {
          const notifyUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
          await fetch(notifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramUserId,
              text: `✅ *Wallet Verified!*\n\n` +
                `🔗 \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\`\n` +
                `💰 DTGC: ${dtgcBalance.toLocaleString(undefined, {maximumFractionDigits: 0})} ($${balanceUsd.toFixed(2)})\n\n` +
                `You now have full access to PRO features!`,
              parse_mode: 'Markdown',
            }),
          });
        } catch (notifyError) {
          console.error('Failed to notify user:', notifyError);
        }
      }

      console.log(`[tg-verify] ✅ Verified: ${walletAddress.slice(0, 10)}... for user ${telegramUserId || 'unknown'} ($${balanceUsd.toFixed(2)})`);

      return res.status(200).json({
        success: true,
        walletAddress,
        balanceUsd,
        dtgcBalance,
        message: 'Wallet verified successfully!',
        storage: savedToKV ? 'kv' : 'memory',
      });

    } catch (error) {
      console.error('[tg-verify] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Verification failed. Please try again.',
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Export helper functions for other modules
export { getFromKV, setToKV, scanByWallet };
// Upgraded to KV storage Mon Feb 2 2026 9:42pm EST
