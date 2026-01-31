import { ethers } from 'ethers';
import { config, ERC20_ABI } from '../config';

/**
 * Token Gate - DTGC Holder Verification
 *
 * Users must hold $50+ of DTGC to access trading features.
 * Buy DTGC at: dtgc.io/pulsexgold
 */

interface GateResult {
  allowed: boolean;
  message: string;
  balance: bigint;
  balanceFormatted: string;
  balanceUsd: number;
  requiredUsd: number;
  shortfall: number;
}

class TokenGate {
  private provider: ethers.JsonRpcProvider;
  private dtgcContract: ethers.Contract;
  private priceCache: { price: number; timestamp: number } = { price: 0, timestamp: 0 };

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.dtgcContract = new ethers.Contract(
      config.tokenGate.dtgc,
      ERC20_ABI,
      this.provider
    );
  }

  /**
   * Get DTGC price in USD (via PLS price)
   */
  private async getDtgcPrice(): Promise<number> {
    // Cache price for 5 minutes
    if (Date.now() - this.priceCache.timestamp < 300000 && this.priceCache.price > 0) {
      return this.priceCache.price;
    }

    try {
      // For now, use a rough estimate - in production, fetch from DEX
      // DTGC price approximately $0.001 per token (adjust as needed)
      const price = 0.001;
      this.priceCache = { price, timestamp: Date.now() };
      return price;
    } catch (error) {
      console.error('Failed to get DTGC price:', error);
      return 0.001; // Fallback
    }
  }

  /**
   * Check if wallet has sufficient DTGC holdings
   */
  async checkAccess(walletAddress: string): Promise<GateResult> {
    try {
      const balance = await this.dtgcContract.balanceOf(walletAddress);
      const decimals = await this.dtgcContract.decimals();
      const balanceFormatted = ethers.formatUnits(balance, decimals);
      const balanceNum = parseFloat(balanceFormatted);

      const price = await this.getDtgcPrice();
      const balanceUsd = balanceNum * price;
      const requiredUsd = config.tokenGate.minHoldUsd;
      const shortfall = Math.max(0, requiredUsd - balanceUsd);

      if (balanceUsd >= requiredUsd) {
        return {
          allowed: true,
          message: this.formatSuccessMessage(balanceNum, balanceUsd),
          balance,
          balanceFormatted,
          balanceUsd,
          requiredUsd,
          shortfall: 0,
        };
      }

      return {
        allowed: false,
        message: this.formatGateMessage(balanceNum, balanceUsd, requiredUsd, shortfall),
        balance,
        balanceFormatted,
        balanceUsd,
        requiredUsd,
        shortfall,
      };
    } catch (error) {
      console.error('Token gate check failed:', error);
      return {
        allowed: false,
        message: '❌ Failed to verify holdings. Please try again.',
        balance: 0n,
        balanceFormatted: '0',
        balanceUsd: 0,
        requiredUsd: config.tokenGate.minHoldUsd,
        shortfall: config.tokenGate.minHoldUsd,
      };
    }
  }

  /**
   * Format the gate required message
   */
  private formatGateMessage(balance: number, balanceUsd: number, requiredUsd: number, shortfall: number): string {
    const progressBar = this.getProgressBar(balanceUsd, requiredUsd);
    const shortfallTokens = shortfall / 0.001; // Rough estimate

    return `
🔐 *Token Gate Required*
━━━━━━━━━━━━━━━━━━━━━

📊 *Your DTGC Balance:*
\`${this.formatNumber(balance)} DTGC\`
≈ \`$${balanceUsd.toFixed(2)} USD\`

${progressBar}

💰 *Required:* \`$${requiredUsd} USD\`
📉 *Need:* \`~${this.formatNumber(shortfallTokens)} more DTGC\`

━━━━━━━━━━━━━━━━━━━━━

⚜️ *Get DTGC:*
▸ [Buy on PulseX Gold](https://dtgc.io/pulsexgold)

📋 *Contract:*
\`${config.tokenGate.dtgc}\`

━━━━━━━━━━━━━━━━━━━━━
_Tap 🔄 Refresh after buying_
    `.trim();
  }

  /**
   * Format success message
   */
  private formatSuccessMessage(balance: number, balanceUsd: number): string {
    return `
✅ *Token Gate Verified!*
━━━━━━━━━━━━━━━━━━━━━

⚜️ *DTGC Balance:*
\`${this.formatNumber(balance)} DTGC\`
≈ \`$${balanceUsd.toFixed(2)} USD\`

🎯 All features unlocked!
    `.trim();
  }

  /**
   * Generate progress bar
   */
  private getProgressBar(current: number, required: number): string {
    const percent = Math.min(100, (current / required) * 100);
    const filled = Math.floor(percent / 10);
    const empty = 10 - filled;
    const bar = '🟨'.repeat(filled) + '⬜'.repeat(empty);
    return `${bar} ${percent.toFixed(0)}%`;
  }

  /**
   * Format large numbers
   */
  private formatNumber(value: number): string {
    if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
    if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
    if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
    return value.toFixed(2);
  }

  /**
   * Get inline keyboard for gate message
   */
  getGateKeyboard() {
    return {
      inline_keyboard: [
        [
          { text: '🔄 Refresh Balance', callback_data: 'gate_refresh' },
        ],
        [
          { text: '⚜️ Buy DTGC', url: 'https://dtgc.io/pulsexgold' },
        ],
        [
          { text: '🔙 Back', callback_data: 'main_menu' },
        ],
      ],
    };
  }
}

export const tokenGate = new TokenGate();
