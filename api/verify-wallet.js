// api/verify-wallet.js
// Web3 wallet verification for Telegram bot Gold Suite access
// Signs a verification token that the bot can trust

import { ethers } from 'ethers';
import crypto from 'crypto';

// DTGC token on PulseChain
const DTGC_ADDRESS = '0xD0676B28a457371D58d47E5247b439114e40Eb0F';
const MIN_HOLD_USD = 50;

// ERC20 ABI for balance check
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// PulseChain RPC endpoints
const RPC_ENDPOINTS = [
  'https://pulsechain.publicnode.com',
  'https://rpc.pulsechain.com',
  'https://rpc-pulsechain.g4mm4.io'
];

// Verification secret (in production, use env var)
const VERIFY_SECRET = process.env.VERIFY_SECRET || 'dtgc-gold-suite-verification-2024';

// Bot username for deep links
const BOT_USERNAME = 'DTGBondBot';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { address, signature, message, telegramId } = req.body;

    if (!address || !signature || !message) {
      return res.status(400).json({ error: 'Missing required fields: address, signature, message' });
    }

    // Verify the signature matches the claimed address
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Get DTGC balance
    const balanceResult = await getDtgcBalance(address);
    if (!balanceResult.success) {
      return res.status(500).json({ error: 'Failed to fetch balance', details: balanceResult.error });
    }

    // Get DTGC price (use existing price API or hardcode for now)
    const dtgcPrice = await getDtgcPrice();
    const balanceUsd = balanceResult.balance * dtgcPrice;

    // Check if balance meets minimum
    if (balanceUsd < MIN_HOLD_USD) {
      return res.status(200).json({
        verified: false,
        balance: balanceResult.balance,
        balanceUsd: balanceUsd,
        required: MIN_HOLD_USD,
        message: `Insufficient DTGC. You have $${balanceUsd.toFixed(2)}, need $${MIN_HOLD_USD}`
      });
    }

    // Generate verification token
    const timestamp = Date.now();
    const expiresAt = timestamp + (24 * 60 * 60 * 1000); // 24 hour validity

    // Create payload
    const payload = {
      a: address.toLowerCase(),  // address
      b: Math.floor(balanceResult.balance), // balance (whole tokens)
      u: Math.floor(balanceUsd), // USD value
      t: timestamp, // timestamp
      e: expiresAt, // expires
    };

    // Sign the payload
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr).toString('base64url');
    const signature_hash = crypto
      .createHmac('sha256', VERIFY_SECRET)
      .update(payloadB64)
      .digest('hex')
      .substring(0, 16); // Short signature for URL

    // Token format: payload.signature
    const token = `${payloadB64}.${signature_hash}`;

    // Generate Telegram deep link
    const telegramLink = `https://t.me/${BOT_USERNAME}?start=verify_${token}`;

    return res.status(200).json({
      verified: true,
      balance: balanceResult.balance,
      balanceUsd: balanceUsd,
      token: token,
      telegramLink: telegramLink,
      expiresAt: expiresAt,
      message: `✅ Verified! ${formatNumber(balanceResult.balance)} DTGC (~$${balanceUsd.toFixed(2)})`
    });

  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).json({ error: 'Verification failed', details: error.message });
  }
}

// Get DTGC balance with RPC failover
async function getDtgcBalance(address) {
  for (const rpc of RPC_ENDPOINTS) {
    try {
      const provider = new ethers.JsonRpcProvider(rpc);
      const dtgc = new ethers.Contract(DTGC_ADDRESS, ERC20_ABI, provider);

      const [balance, decimals] = await Promise.all([
        dtgc.balanceOf(address),
        dtgc.decimals()
      ]);

      const balanceNum = parseFloat(ethers.formatUnits(balance, decimals));
      console.log(`✅ Got DTGC balance from ${rpc}: ${balanceNum}`);

      return { success: true, balance: balanceNum };
    } catch (e) {
      console.log(`❌ RPC ${rpc} failed:`, e.message);
      continue;
    }
  }

  return { success: false, error: 'All RPC endpoints failed' };
}

// DexScreener API for accurate DTGC price
const DEXSCREENER_API = `https://api.dexscreener.com/latest/dex/tokens/${DTGC_ADDRESS}`;

// Get DTGC price in USD from DexScreener
async function getDtgcPrice() {
  try {
    const response = await fetch(DEXSCREENER_API);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.pairs && data.pairs.length > 0) {
      // Sort by liquidity and get the best price
      const bestPair = data.pairs.sort((a, b) =>
        (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];

      const priceUsd = parseFloat(bestPair.priceUsd || '0');

      if (priceUsd > 0) {
        console.log(`💵 DTGC Price from DexScreener: $${priceUsd.toFixed(6)}`);
        return priceUsd;
      }
    }

    throw new Error('No valid price data');
  } catch (e) {
    console.log('DexScreener price fetch failed:', e.message);
  }

  // Fallback price
  console.log('Using fallback DTGC price: $0.0004');
  return 0.0004;
}

function formatNumber(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
  return v.toFixed(2);
}
