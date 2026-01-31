import { ethers } from 'ethers';
import { config, ERC20_ABI } from '../config';

interface GateResult {
  allowed: boolean;
  message: string;
  balance: bigint;
  balanceUsd: number;
}

// Direct RPC fallback list - no dependency on rpcManager
const RPC_ENDPOINTS = [
  'https://pulsechain.publicnode.com',
  'https://rpc.pulsechain.com',
  'https://rpc-pulsechain.g4mm4.io',
  'http://65.109.68.172:8545', // Hetzner
];

// DexScreener API for accurate price
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex/tokens/0xD0676B28a457371D58d47E5247b439114e40Eb0F';

// Fallback DTGC price if API fails
const FALLBACK_DTGC_PRICE_USD = 0.0004; // ~$0.0004 per DTGC (conservative)

class TokenGate {
  private cachedBalance: Map<string, { balance: number; timestamp: number }> = new Map();
  private cachedPrice: { price: number; timestamp: number } | null = null;
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  private readonly PRICE_CACHE_DURATION = 300000; // 5 minute price cache

  /**
   * Get DTGC price in USD from DexScreener API
   */
  private async getDtgcPriceUsd(): Promise<number> {
    // Check price cache
    if (this.cachedPrice && Date.now() - this.cachedPrice.timestamp < this.PRICE_CACHE_DURATION) {
      console.log(`📦 Using cached DTGC price: $${this.cachedPrice.price.toFixed(6)}`);
      return this.cachedPrice.price;
    }

    try {
      // Fetch from DexScreener API
      const response = await fetch(DEXSCREENER_API);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data: any = await response.json();

      // Find the best pair (highest liquidity)
      if (data.pairs && data.pairs.length > 0) {
        // Sort by liquidity and get the best price
        const bestPair = data.pairs.sort((a: any, b: any) =>
          (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
        )[0];

        const priceUsd = parseFloat(bestPair.priceUsd || '0');

        if (priceUsd > 0) {
          console.log(`💵 DTGC Price from DexScreener: $${priceUsd.toFixed(6)} (${bestPair.pairAddress?.slice(0,10)}...)`);

          // Cache the price
          this.cachedPrice = { price: priceUsd, timestamp: Date.now() };
          return priceUsd;
        }
      }

      throw new Error('No valid price data');
    } catch (e: any) {
      console.log(`⚠️ DexScreener price fetch failed: ${e.message}`);
    }

    // Fallback
    console.log(`⚠️ Using fallback DTGC price: $${FALLBACK_DTGC_PRICE_USD}`);
    return FALLBACK_DTGC_PRICE_USD;
  }

  /**
   * Try to get balance using multiple RPC endpoints
   */
  private async getBalanceWithFallback(walletAddress: string): Promise<number> {
    const errors: string[] = [];

    for (const rpcUrl of RPC_ENDPOINTS) {
      try {
        console.log(`🔍 Trying RPC: ${rpcUrl}`);
        const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, {
          staticNetwork: true,
        });

        // Set timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 8000)
        );

        const dtgcContract = new ethers.Contract(config.tokenGate.dtgc, ERC20_ABI, provider);

        // Get balance with timeout
        const balance = await Promise.race([
          dtgcContract.balanceOf(walletAddress),
          timeoutPromise
        ]);

        const balanceNum = parseFloat(ethers.formatUnits(balance, 18));
        console.log(`✅ Got balance from ${rpcUrl}: ${balanceNum.toLocaleString()} DTGC`);

        return balanceNum;
      } catch (e: any) {
        const errorMsg = e.message || 'Unknown error';
        console.log(`❌ RPC ${rpcUrl} failed: ${errorMsg}`);
        errors.push(`${rpcUrl}: ${errorMsg}`);
        continue;
      }
    }

    // All RPCs failed
    console.error('All RPC endpoints failed:', errors);
    throw new Error('Could not fetch balance from any RPC');
  }

  /**
   * Check if wallet has enough DTGC for access
   */
  async checkAccess(walletAddress: string): Promise<GateResult> {
    try {
      // Check cache first
      const cached = this.cachedBalance.get(walletAddress.toLowerCase());
      let balanceNum: number;

      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        console.log(`📦 Using cached balance for ${walletAddress.slice(0, 8)}...`);
        balanceNum = cached.balance;
      } else {
        // Fetch fresh balance
        balanceNum = await this.getBalanceWithFallback(walletAddress);

        // Cache it
        this.cachedBalance.set(walletAddress.toLowerCase(), {
          balance: balanceNum,
          timestamp: Date.now()
        });
      }

      // Get live DTGC price and calculate USD value
      const dtgcPrice = await this.getDtgcPriceUsd();
      const balanceUsd = balanceNum * dtgcPrice;
      const required = config.tokenGate.minHoldUsd;

      console.log(`💰 Wallet ${walletAddress.slice(0, 8)}...: ${balanceNum.toLocaleString()} DTGC (~$${balanceUsd.toFixed(2)})`);

      if (balanceUsd >= required) {
        return {
          allowed: true,
          balance: BigInt(Math.floor(balanceNum)),
          balanceUsd,
          message: `✅ *Verified!* ${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})`
        };
      }

      const pct = Math.min(100, (balanceUsd / required) * 100);
      const bar = '🟨'.repeat(Math.floor(pct / 10)) + '⬜'.repeat(10 - Math.floor(pct / 10));

      return {
        allowed: false,
        balance: BigInt(Math.floor(balanceNum)),
        balanceUsd,
        message: `🔐 *Token Gate Required*\n━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Your Balance:*\n\`${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})\`\n\n${bar} ${pct.toFixed(0)}%\n\n💰 Required: \`$${required}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n\n⚜️ [Buy DTGC](https://dtgc.io/gold)\n\n📋 \`${config.tokenGate.dtgc}\`\n\n_Tap 🔄 Refresh after buying_`
      };
    } catch (e: any) {
      console.error('Token gate check failed:', e.message);
      return {
        allowed: false,
        balance: 0n,
        balanceUsd: 0,
        message: `⚠️ *Could not verify balance*\n\nRPC error - please try again in a moment.\n\n_Error: ${e.message?.slice(0, 50) || 'Unknown'}_`
      };
    }
  }

  /**
   * Force refresh balance for a wallet
   */
  async refreshBalance(walletAddress: string): Promise<GateResult> {
    // Clear cache for this wallet
    this.cachedBalance.delete(walletAddress.toLowerCase());
    return this.checkAccess(walletAddress);
  }

  private fmt(v: number): string {
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
  }

  getGateKeyboard() {
    return {
      inline_keyboard: [
        [{ text: '🔄 Refresh', callback_data: 'gate_refresh' }],
        [{ text: '⚜️ Buy DTGC', url: 'https://dtgc.io/gold' }],
        [{ text: '🔙 Back', callback_data: 'main_menu' }]
      ]
    };
  }
}

export const tokenGate = new TokenGate();
