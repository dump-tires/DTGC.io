import { ethers } from 'ethers';
import { config, ERC20_ABI } from '../config';

interface GateResult {
  allowed: boolean;
  message: string;
  balance: bigint;
  balanceUsd: number;
}

class TokenGate {
  private provider: ethers.JsonRpcProvider;
  private dtgcContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.dtgcContract = new ethers.Contract(config.tokenGate.dtgc, ERC20_ABI, this.provider);
  }

  async checkAccess(walletAddress: string): Promise<GateResult> {
    try {
      const balance = await this.dtgcContract.balanceOf(walletAddress);
      const decimals = await this.dtgcContract.decimals();
      const balanceNum = parseFloat(ethers.formatUnits(balance, decimals));
      const price = 0.001; // DTGC price estimate
      const balanceUsd = balanceNum * price;
      const required = config.tokenGate.minHoldUsd;

      if (balanceUsd >= required) {
        return { allowed: true, balance, balanceUsd, message: `✅ *Verified!* ${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})` };
      }

      const pct = Math.min(100, (balanceUsd / required) * 100);
      const bar = '🟨'.repeat(Math.floor(pct/10)) + '⬜'.repeat(10 - Math.floor(pct/10));

      return { allowed: false, balance, balanceUsd, message: `🔐 *Token Gate Required*\n━━━━━━━━━━━━━━━━━━━━━\n\n📊 *Your Balance:*\n\`${this.fmt(balanceNum)} DTGC (~$${balanceUsd.toFixed(2)})\`\n\n${bar} ${pct.toFixed(0)}%\n\n💰 Required: \`$${required}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n\n⚜️ [Buy DTGC](https://dtgc.io/gold)\n\n📋 \`${config.tokenGate.dtgc}\`\n\n_Tap 🔄 Refresh after buying_` };
    } catch (e) {
      return { allowed: false, balance: 0n, balanceUsd: 0, message: '❌ Verification failed. Try again.' };
    }
  }

  private fmt(v: number): string {
    if (v >= 1e9) return (v/1e9).toFixed(2)+'B';
    if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
    if (v >= 1e3) return (v/1e3).toFixed(2)+'K';
    return v.toFixed(2);
  }

  getGateKeyboard() {
    return { inline_keyboard: [[{ text: '🔄 Refresh', callback_data: 'gate_refresh' }], [{ text: '⚜️ Buy DTGC', url: 'https://dtgc.io/gold' }], [{ text: '🔙 Back', callback_data: 'main_menu' }]] };
  }
}

export const tokenGate = new TokenGate();
