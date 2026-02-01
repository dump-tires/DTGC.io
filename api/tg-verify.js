/**
 * Telegram Mini App Wallet Verification API
 *
 * Verifies wallet ownership via signature and checks DTGC balance.
 * Stores verified wallets for the Telegram bot to access.
 */

import { ethers } from 'ethers';
import crypto from 'crypto';

// DTGC Token Contract
const DTGC_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';
const DTGC_ABI = ['function balanceOf(address) view returns (uint256)'];
const PULSECHAIN_RPC = 'https://rpc.pulsechain.com';
const GATE_MIN_USD = 50;

// In-memory store for verified wallets (in production, use Redis/DB)
// This will be replaced with a proper database
const verifiedWallets = new Map();

// Bot token for sending notifications
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

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
    const { telegramUserId } = req.query;

    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId required' });
    }

    // Check our store and also try to read from the shared file
    const verification = verifiedWallets.get(telegramUserId);

    if (verification) {
      return res.status(200).json({
        verified: true,
        walletAddress: verification.walletAddress,
        balanceUsd: verification.balanceUsd,
        verifiedAt: verification.verifiedAt,
      });
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
        telegramInitData,
      } = req.body;

      // Validate required fields
      if (!walletAddress || !signature || !message || !telegramUserId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: walletAddress, signature, message, telegramUserId',
        });
      }

      // Validate timestamp (must be within 5 minutes)
      const now = Date.now();
      if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
        return res.status(400).json({
          success: false,
          error: 'Signature expired. Please try again.',
        });
      }

      // Verify signature
      let recoveredAddress;
      try {
        recoveredAddress = ethers.utils.verifyMessage(message, signature);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature',
        });
      }

      // Check that recovered address matches claimed address
      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Signature does not match wallet address',
        });
      }

      // Check DTGC balance
      const provider = new ethers.providers.JsonRpcProvider(PULSECHAIN_RPC);
      const dtgcContract = new ethers.Contract(DTGC_ADDRESS, DTGC_ABI, provider);

      let dtgcBalance;
      try {
        const balance = await dtgcContract.balanceOf(walletAddress);
        dtgcBalance = parseFloat(ethers.utils.formatEther(balance));
      } catch (e) {
        console.error('Balance check failed:', e);
        return res.status(500).json({
          success: false,
          error: 'Failed to check DTGC balance. Please try again.',
        });
      }

      // Get DTGC price from DexScreener
      let dtgcPrice = 0;
      try {
        const priceResponse = await fetch(
          'https://api.dexscreener.com/latest/dex/tokens/0xD0676B28a457371D58d47E5247b439114e40Eb0F'
        );
        const priceData = await priceResponse.json();
        dtgcPrice = parseFloat(priceData.pairs?.[0]?.priceUsd || '0');
      } catch (e) {
        console.error('Price fetch failed:', e);
        // Use a fallback price or continue without
      }

      const balanceUsd = dtgcBalance * dtgcPrice;

      // Check minimum balance
      if (balanceUsd < GATE_MIN_USD) {
        return res.status(400).json({
          success: false,
          error: `Insufficient DTGC balance. You have $${balanceUsd.toFixed(2)} but need $${GATE_MIN_USD}+`,
          balanceUsd,
          required: GATE_MIN_USD,
        });
      }

      // Store verification
      const verification = {
        walletAddress: walletAddress.toLowerCase(),
        telegramUserId,
        balanceUsd,
        dtgcBalance,
        verifiedAt: now,
        signature: signature.slice(0, 20) + '...', // Store partial for reference
      };

      verifiedWallets.set(telegramUserId, verification);

      // Try to notify the user via Telegram bot
      if (BOT_TOKEN) {
        try {
          const notifyUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
          await fetch(notifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramUserId,
              text: `✅ **Wallet Verified!**\n\n` +
                `🔗 \`${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}\`\n` +
                `💰 DTGC Balance: ${dtgcBalance.toLocaleString()} ($${balanceUsd.toFixed(2)})\n\n` +
                `You now have full access to all PRO features!`,
              parse_mode: 'Markdown',
            }),
          });
        } catch (notifyError) {
          console.error('Failed to notify user:', notifyError);
          // Don't fail the verification if notification fails
        }
      }

      console.log(`[tg-verify] Verified wallet ${walletAddress} for user ${telegramUserId} with $${balanceUsd.toFixed(2)} DTGC`);

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

// Export verified wallets for other modules (if needed)
export { verifiedWallets };
