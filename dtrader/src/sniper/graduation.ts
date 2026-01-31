import { ethers } from 'ethers';
import { config } from '../config';
import { pulsex } from '../core/pulsex';
import { EventEmitter } from 'events';

/**
 * pump.tires Graduation Sniper
 *
 * Monitors tokens on the bonding curve and automatically buys when they
 * graduate to PulseX (at 200M PLS liquidity threshold).
 *
 * Two sniping strategies:
 * 1. Pre-graduation: Watch specific tokens approaching graduation
 * 2. Instant-bond: Catch any token that graduates (instabonds)
 */

// pump.tires bonding curve ABI (partial - adjust based on actual contract)
const PUMP_TIRES_ABI = [
  'event TokenCreated(address indexed token, address indexed creator, string name, string symbol)',
  'event TokenGraduated(address indexed token, address indexed pair, uint256 liquidity)',
  'event Trade(address indexed token, address indexed trader, bool isBuy, uint256 plsAmount, uint256 tokenAmount, uint256 newPrice)',
  'function getTokenState(address token) view returns (uint256 plsRaised, uint256 tokensSold, bool graduated, address pair)',
  'function graduationThreshold() view returns (uint256)',
];

interface TokenState {
  address: string;
  name: string;
  symbol: string;
  plsRaised: bigint;
  percentToGraduation: number;
  graduated: boolean;
  pairAddress?: string;
}

interface SnipeConfig {
  tokenAddress?: string;        // Specific token to watch (optional)
  amountPls: bigint;            // Amount to buy
  slippage: number;             // Slippage tolerance
  gasLimit: number;             // Gas limit
  gasPriceMultiplier: number;   // Gas price multiplier for priority
  autoSellPercent?: number;     // Auto-sell at X% profit (optional)
  maxBuyTax?: number;           // Max acceptable buy tax
}

interface SnipeResult {
  success: boolean;
  tokenAddress: string;
  txHash?: string;
  amountPls?: string;
  amountTokens?: string;
  error?: string;
}

export class GraduationSniper extends EventEmitter {
  private provider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private pumpTiresContract: ethers.Contract | null = null;
  private watchedTokens: Map<string, SnipeConfig> = new Map();
  private isListening: boolean = false;
  private graduationThreshold: bigint = BigInt('200000000000000000000000000'); // 200M PLS default

  constructor() {
    super();
    this.provider = new ethers.JsonRpcProvider(config.rpc);

    if (config.pumpTires.contract) {
      this.pumpTiresContract = new ethers.Contract(
        config.pumpTires.contract,
        PUMP_TIRES_ABI,
        this.provider
      );
    }
  }

  /**
   * Initialize WebSocket connection for real-time events
   */
  async connect(): Promise<void> {
    if (this.wsProvider) return;

    try {
      this.wsProvider = new ethers.WebSocketProvider(config.wss);
      console.log('🔌 Connected to PulseChain WebSocket');

      // Reconnect on disconnect
      this.wsProvider.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.reconnect();
      });

      if (this.pumpTiresContract) {
        // Get graduation threshold
        try {
          this.graduationThreshold = await this.pumpTiresContract.graduationThreshold();
        } catch {
          console.log('Using default graduation threshold');
        }
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  private async reconnect(): Promise<void> {
    this.wsProvider = null;
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await this.connect();
    if (this.isListening) {
      await this.startListening();
    }
  }

  /**
   * Get current state of a token on the bonding curve
   */
  async getTokenState(tokenAddress: string): Promise<TokenState | null> {
    if (!this.pumpTiresContract) return null;

    try {
      const [plsRaised, tokensSold, graduated, pair] =
        await this.pumpTiresContract.getTokenState(tokenAddress);

      const token = new ethers.Contract(tokenAddress, [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
      ], this.provider);

      const [name, symbol] = await Promise.all([token.name(), token.symbol()]);

      const percentToGraduation = Number(plsRaised * 100n / this.graduationThreshold);

      return {
        address: tokenAddress,
        name,
        symbol,
        plsRaised,
        percentToGraduation: Math.min(percentToGraduation, 100),
        graduated,
        pairAddress: pair !== ethers.ZeroAddress ? pair : undefined,
      };
    } catch (error) {
      console.error('Failed to get token state:', error);
      return null;
    }
  }

  /**
   * Watch a specific token for graduation
   */
  watchToken(tokenAddress: string, config: SnipeConfig): void {
    this.watchedTokens.set(tokenAddress.toLowerCase(), {
      ...config,
      tokenAddress,
    });
    this.emit('tokenWatched', tokenAddress);
  }

  /**
   * Stop watching a token
   */
  unwatchToken(tokenAddress: string): void {
    this.watchedTokens.delete(tokenAddress.toLowerCase());
  }

  /**
   * Start listening for graduation events
   */
  async startListening(): Promise<void> {
    if (!this.wsProvider || !this.pumpTiresContract) {
      console.error('WebSocket or contract not initialized');
      return;
    }

    this.isListening = true;
    const contractWithWs = this.pumpTiresContract.connect(this.wsProvider);

    // Listen for graduation events (tokens hitting 200M PLS and going to PulseX)
    contractWithWs.on('TokenGraduated', async (token: string, pair: string, liquidity: bigint) => {
      console.log(`🎓 Token graduated: ${token} -> Pair: ${pair}`);
      this.emit('graduation', { token, pair, liquidity });

      // Check if we're watching this token
      const watchConfig = this.watchedTokens.get(token.toLowerCase());
      if (watchConfig) {
        await this.executeSnipe(token, watchConfig);
      }
    });

    // Listen for new token creations (for auto-snipe all graduations mode)
    contractWithWs.on('TokenCreated', async (token: string, creator: string, name: string, symbol: string) => {
      console.log(`🆕 New token: ${name} (${symbol}) - ${token}`);
      this.emit('newToken', { token, creator, name, symbol });
    });

    // Listen for trades to track tokens approaching graduation
    contractWithWs.on('Trade', async (token: string, trader: string, isBuy: boolean, plsAmount: bigint) => {
      const state = await this.getTokenState(token);
      if (state && state.percentToGraduation >= 90) {
        console.log(`🔥 Token ${state.symbol} at ${state.percentToGraduation}% to graduation!`);
        this.emit('nearGraduation', state);
      }
    });

    console.log('👀 Listening for pump.tires graduations...');
  }

  /**
   * Stop listening
   */
  stopListening(): void {
    this.isListening = false;
    if (this.pumpTiresContract) {
      this.pumpTiresContract.removeAllListeners();
    }
  }

  /**
   * Execute snipe buy on graduation
   */
  async executeSnipe(tokenAddress: string, snipeConfig: SnipeConfig): Promise<SnipeResult> {
    try {
      console.log(`🎯 Sniping ${tokenAddress}...`);
      this.emit('sniping', tokenAddress);

      // Wait a tiny bit for liquidity to be fully added
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get pair info to confirm liquidity exists
      const pairInfo = await pulsex.getPairInfo(tokenAddress);
      if (!pairInfo) {
        return {
          success: false,
          tokenAddress,
          error: 'No liquidity pair found',
        };
      }

      // Execute the buy
      // Note: We need the wallet here - this will be passed from the bot
      this.emit('snipeReady', {
        tokenAddress,
        pairInfo,
        config: snipeConfig,
      });

      return {
        success: true,
        tokenAddress,
        amountPls: ethers.formatEther(snipeConfig.amountPls),
      };
    } catch (error: any) {
      return {
        success: false,
        tokenAddress,
        error: error.message,
      };
    }
  }

  /**
   * Snipe all graduating tokens (aggressive mode)
   */
  async enableAutoSnipe(defaultConfig: SnipeConfig): Promise<void> {
    if (!this.wsProvider || !this.pumpTiresContract) {
      await this.connect();
    }

    const contractWithWs = this.pumpTiresContract!.connect(this.wsProvider!);

    contractWithWs.on('TokenGraduated', async (token: string, pair: string) => {
      console.log(`🚀 Auto-sniping graduated token: ${token}`);
      await this.executeSnipe(token, defaultConfig);
    });

    console.log('🤖 Auto-snipe mode enabled for all graduating tokens');
  }

  /**
   * Format token state for display
   */
  formatTokenState(state: TokenState): string {
    const plsFormatted = ethers.formatEther(state.plsRaised);
    const progressBar = this.createProgressBar(state.percentToGraduation);

    return `
🪙 ${state.name} (${state.symbol})
📍 ${state.address}

💰 Raised: ${Number(plsFormatted).toLocaleString()} PLS
📊 Progress: ${progressBar} ${state.percentToGraduation.toFixed(1)}%
${state.graduated ? '✅ GRADUATED' : '⏳ On bonding curve'}
${state.pairAddress ? `🔗 Pair: ${state.pairAddress}` : ''}
    `.trim();
  }

  private createProgressBar(percent: number): string {
    const filled = Math.floor(percent / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Close connections
   */
  async disconnect(): Promise<void> {
    this.stopListening();
    if (this.wsProvider) {
      await this.wsProvider.destroy();
      this.wsProvider = null;
    }
  }
}

export const graduationSniper = new GraduationSniper();
