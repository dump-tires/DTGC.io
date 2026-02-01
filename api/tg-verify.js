/**
 * Unified Wallet Verification API
 *
 * Works with:
 * - Telegram Mini App (tg-verify.html)
 * - Gold Suite website (dtgc.io/gold)
 * - Telegram Bot (direct API calls)
 *
 * Stores verified wallets in memory with file backup.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

// DTGC Token Contract
const DTGC_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';
const DTGC_ABI = ['function balanceOf(address) view returns (uint256)'];
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';
const GATE_MIN_USD = 50;

// In-memory store
const verifiedWallets = new Map();

// Bot token for sending notifications
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

// Try to load from file on cold start
const STORAGE_FILE = '/tmp/dtgc-verified-wallets.json';
try {
  if (fs.existsSync(STORAGE_FILE)) {
    const data = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
    Object.entries(data).forEach(([k, v]) => verifiedWallets.set(k, v));
    console.log(`[tg-verify] Loaded ${verifiedWallets.size} verified wallets from storage`);
  }
} catch (e) {
  console.log('[tg-verify] No existing storage found');
}

// Save to file
function saveToStorage() {
  try {
    const data = Object.fromEntries(verifiedWallets);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('[tg-verify] Failed to save storage:', e);
  }
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
      const verification = verifiedWallets.get(String(telegramUserId));
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
        });
      }
    }

    // Check by wallet address
    if (walletAddress) {
      for (const [userId, v] of verifiedWallets) {
        if (v.walletAddress.toLowerCase() === walletAddress.toLowerCase()) {
          return res.status(200).json({
            verified: true,
            telegramUserId: userId,
            walletAddress: v.walletAddress,
            balance: v.dtgcBalance,
            balanceUsd: v.balanceUsd,
            verifiedAt: v.verifiedAt,
          });
        }
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
      if (telegramUserId) {
        verifiedWallets.set(String(telegramUserId), verification);
        saveToStorage();
      }

      // Also store by wallet address for lookups
      verifiedWallets.set(walletAddress.toLowerCase(), {
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

// Export for other modules
export { verifiedWallets };
