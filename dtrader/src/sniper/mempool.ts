import { ethers } from 'ethers';
import { config, PULSEX_FACTORY_ABI, PULSEX_PAIR_ABI } from '../config';
import { pulsex } from '../core/pulsex';
import { EventEmitter } from 'events';

/**
 * Mempool Sniper for PulseX
 *
 * Monitors the mempool and factory events for:
 * 1. New pair creations
 * 2. Liquidity additions (Mint events)
 * 3. Pending addLiquidity transactions
 */

interface LiquidityEvent {
  type: 'pairCreated' | 'liquidityAdded' | 'pendingAdd';
  token0: string;
  token1: string;
  pairAddress: string;
  liquidity0?: bigint;
  liquidity1?: bigint;
  txHash?: string;
  blockNumber?: number;
}

interface SnipeTarget {
  tokenAddress: string;
  amountPls: bigint;
  slippage: number;
  maxGasPrice: bigint;
  minLiquidityPls: bigint;
  userId: string;
}

export class MempoolSniper extends EventEmitter {
  private httpProvider: ethers.JsonRpcProvider;
  private wsProvider: ethers.WebSocketProvider | null = null;
  private factory: ethers.Contract;
  private targets: Map<string, SnipeTarget[]> = new Map(); // token -> snipe configs
  private isRunning: boolean = false;
  private processedPairs: Set<string> = new Set();

  constructor() {
    super();
    this.httpProvider = new ethers.JsonRpcProvider(config.rpc);
    this.factory = new ethers.Contract(config.pulsexFactory, PULSEX_FACTORY_ABI, this.httpProvider);
  }

  /**
   * Connect to WebSocket for real-time monitoring
   */
  async connect(): Promise<void> {
    try {
      this.wsProvider = new ethers.WebSocketProvider(config.wss);

      this.wsProvider.on('error', (error) => {
        console.error('WS Error:', error);
        this.reconnect();
      });

      console.log('🔌 Mempool sniper connected');
    } catch (error) {
      console.error('Connection failed:', error);
    }
  }

  private async reconnect(): Promise<void> {
    this.wsProvider = null;
    await new Promise((r) => setTimeout(r, 3000));
    await this.connect();
    if (this.isRunning) await this.start();
  }

  /**
   * Add a token to snipe when liquidity is added
   */
  addTarget(target: SnipeTarget): void {
    const key = target.tokenAddress.toLowerCase();
    const existing = this.targets.get(key) || [];
    existing.push(target);
    this.targets.set(key, existing);
    console.log(`🎯 Added snipe target: ${target.tokenAddress}`);
  }

  /**
   * Remove snipe target
   */
  removeTarget(tokenAddress: string, userId: string): boolean {
    const key = tokenAddress.toLowerCase();
    const targets = this.targets.get(key);
    if (!targets) return false;

    const filtered = targets.filter((t) => t.userId !== userId);
    if (filtered.length === 0) {
      this.targets.delete(key);
    } else {
      this.targets.set(key, filtered);
    }
    return true;
  }

  /**
   * Start monitoring
   */
  async start(): Promise<void> {
    if (!this.wsProvider) await this.connect();
    if (!this.wsProvider) {
      console.error('No WebSocket connection');
      return;
    }

    this.isRunning = true;

    // Method 1: Watch PairCreated events
    await this.watchPairCreated();

    // Method 2: Monitor pending transactions (mempool)
    await this.watchMempool();

    console.log('👀 Mempool sniper active');
  }

  /**
   * Watch for new pair creations on PulseX
   */
  private async watchPairCreated(): Promise<void> {
    const factoryWs = this.factory.connect(this.wsProvider!);

    factoryWs.on('PairCreated', async (token0: string, token1: string, pair: string) => {
      // Skip if already processed
      if (this.processedPairs.has(pair)) return;
      this.processedPairs.add(pair);

      console.log(`\n🆕 New Pair Created!`);
      console.log(`   Token0: ${token0}`);
      console.log(`   Token1: ${token1}`);
      console.log(`   Pair: ${pair}`);

      const event: LiquidityEvent = {
        type: 'pairCreated',
        token0,
        token1,
        pairAddress: pair,
      };

      this.emit('pairCreated', event);

      // Check if either token is a target
      await this.checkAndSnipe(token0, event);
      await this.checkAndSnipe(token1, event);
    });
  }

  /**
   * Watch pending transactions for addLiquidity calls
   */
  private async watchMempool(): Promise<void> {
    // Subscribe to pending transactions
    this.wsProvider!.on('pending', async (txHash: string) => {
      try {
        const tx = await this.httpProvider.getTransaction(txHash);
        if (!tx || !tx.to) return;

        // Check if it's a router transaction
        if (tx.to.toLowerCase() !== config.pulsexRouter.toLowerCase()) return;

        // Decode the transaction data
        const decoded = this.decodeRouterTx(tx.data);
        if (!decoded) return;

        if (decoded.method === 'addLiquidity' || decoded.method === 'addLiquidityETH') {
          console.log(`\n⏳ Pending liquidity add detected!`);
          console.log(`   TxHash: ${txHash}`);
          console.log(`   Token: ${decoded.token}`);

          this.emit('pendingLiquidity', {
            txHash,
            token: decoded.token,
            amount: decoded.amount,
          });

          // Front-run opportunity - check if target
          const targets = this.targets.get(decoded.token.toLowerCase());
          if (targets && targets.length > 0) {
            this.emit('snipeOpportunity', {
              txHash,
              token: decoded.token,
              targets,
            });
          }
        }
      } catch {
        // Ignore decode errors
      }
    });
  }

  /**
   * Decode router transaction
   */
  private decodeRouterTx(data: string): { method: string; token: string; amount: bigint } | null {
    try {
      const iface = new ethers.Interface([
        'function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline)',
        'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline)',
      ]);

      const parsed = iface.parseTransaction({ data });
      if (!parsed) return null;

      if (parsed.name === 'addLiquidityETH') {
        return {
          method: 'addLiquidityETH',
          token: parsed.args[0],
          amount: parsed.args[1],
        };
      }

      if (parsed.name === 'addLiquidity') {
        return {
          method: 'addLiquidity',
          token: parsed.args[0],
          amount: parsed.args[2],
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if token is a target and trigger snipe
   */
  private async checkAndSnipe(tokenAddress: string, event: LiquidityEvent): Promise<void> {
    const key = tokenAddress.toLowerCase();
    const targets = this.targets.get(key);

    if (!targets || targets.length === 0) return;

    // Wait briefly for liquidity to be confirmed
    await new Promise((r) => setTimeout(r, 500));

    // Verify liquidity exists
    const pairInfo = await pulsex.getPairInfo(tokenAddress);
    if (!pairInfo) {
      console.log(`⚠️ No liquidity found yet for ${tokenAddress}`);
      return;
    }

    // Check minimum liquidity requirement
    for (const target of targets) {
      if (pairInfo.liquidityPls >= target.minLiquidityPls) {
        console.log(`\n🎯 SNIPE TARGET DETECTED!`);
        console.log(`   Token: ${tokenAddress}`);
        console.log(`   Liquidity: ${ethers.formatEther(pairInfo.liquidityPls)} PLS`);

        this.emit('executeSnipe', {
          target,
          pairInfo,
          event,
        });
      }
    }
  }

  /**
   * Monitor a specific pair for liquidity changes
   */
  async watchPair(pairAddress: string, callback: (reserve0: bigint, reserve1: bigint) => void): Promise<void> {
    const pair = new ethers.Contract(pairAddress, PULSEX_PAIR_ABI, this.wsProvider!);

    pair.on('Sync', (reserve0: bigint, reserve1: bigint) => {
      callback(reserve0, reserve1);
    });

    pair.on('Mint', (sender: string, amount0: bigint, amount1: bigint) => {
      console.log(`💧 Liquidity added to ${pairAddress}`);
      this.emit('liquidityAdded', { pairAddress, amount0, amount1 });
    });
  }

  /**
   * Get recent pairs
   */
  async getRecentPairs(count: number = 10): Promise<string[]> {
    const totalPairs = await this.factory.allPairsLength();
    const pairs: string[] = [];

    for (let i = 0; i < Math.min(count, Number(totalPairs)); i++) {
      const pairAddress = await this.factory.allPairs(Number(totalPairs) - 1 - i);
      pairs.push(pairAddress);
    }

    return pairs;
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.isRunning = false;
    this.factory.removeAllListeners();
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners('pending');
    }
    console.log('🛑 Mempool sniper stopped');
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    this.stop();
    if (this.wsProvider) {
      await this.wsProvider.destroy();
      this.wsProvider = null;
    }
  }
}

export const mempoolSniper = new MempoolSniper();
