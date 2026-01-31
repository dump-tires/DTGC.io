/**
 * RPC Configuration with Hetzner Primary + Public Fallbacks
 * Auto-failover for maximum reliability
 */

import { ethers } from 'ethers';

// Your Hetzner dedicated node (PRIMARY - fastest when synced)
const HETZNER_RPC = 'http://65.109.68.172:8545';
const HETZNER_WSS = 'ws://65.109.68.172:8546';

// Public fallback RPCs (in order of preference)
const PUBLIC_RPCS = [
  'https://rpc.pulsechain.com',
  'https://rpc-pulsechain.g4mm4.io',
  'https://pulsechain.publicnode.com',
];

const PUBLIC_WSS = [
  'wss://rpc.pulsechain.com',
  'wss://rpc-pulsechain.g4mm4.io',
];

interface RPCHealth {
  url: string;
  isHealthy: boolean;
  latency: number;
  lastCheck: number;
  blockNumber: number;
}

class RPCManager {
  private healthCache: Map<string, RPCHealth> = new Map();
  private currentProvider: ethers.JsonRpcProvider | null = null;
  private currentWsProvider: ethers.WebSocketProvider | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly REQUEST_TIMEOUT = 5000; // 5 second timeout

  /**
   * Check if an RPC endpoint is healthy and synced
   */
  async checkHealth(rpcUrl: string): Promise<RPCHealth> {
    const cached = this.healthCache.get(rpcUrl);
    if (cached && Date.now() - cached.lastCheck < this.HEALTH_CHECK_INTERVAL) {
      return cached;
    }

    const health: RPCHealth = {
      url: rpcUrl,
      isHealthy: false,
      latency: Infinity,
      lastCheck: Date.now(),
      blockNumber: 0,
    };

    try {
      const start = Date.now();
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Race against timeout
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.REQUEST_TIMEOUT)
        ),
      ]);

      health.latency = Date.now() - start;
      health.blockNumber = blockNumber;

      // Consider healthy if block > 1M (to filter out stuck/syncing nodes)
      health.isHealthy = blockNumber > 1000000;

      if (health.isHealthy) {
        console.log(`✅ RPC healthy: ${rpcUrl} (block ${blockNumber}, ${health.latency}ms)`);
      } else {
        console.log(`⚠️ RPC syncing: ${rpcUrl} (block ${blockNumber})`);
      }
    } catch (error: any) {
      console.log(`❌ RPC failed: ${rpcUrl} - ${error.message}`);
      health.isHealthy = false;
    }

    this.healthCache.set(rpcUrl, health);
    return health;
  }

  /**
   * Get the best available RPC provider
   * Prioritizes Hetzner, falls back to public RPCs
   */
  async getProvider(): Promise<ethers.JsonRpcProvider> {
    // Try Hetzner first (it's YOUR node - no rate limits!)
    const hetznerHealth = await this.checkHealth(HETZNER_RPC);
    if (hetznerHealth.isHealthy) {
      console.log('🚀 Using Hetzner dedicated RPC');
      this.currentProvider = new ethers.JsonRpcProvider(HETZNER_RPC);
      return this.currentProvider;
    }

    // Fallback to public RPCs
    for (const rpc of PUBLIC_RPCS) {
      const health = await this.checkHealth(rpc);
      if (health.isHealthy) {
        console.log(`📡 Fallback to public RPC: ${rpc}`);
        this.currentProvider = new ethers.JsonRpcProvider(rpc);
        return this.currentProvider;
      }
    }

    // Last resort - use first public RPC even if health check failed
    console.log('⚠️ All health checks failed, using default RPC');
    this.currentProvider = new ethers.JsonRpcProvider(PUBLIC_RPCS[0]);
    return this.currentProvider;
  }

  /**
   * Get WebSocket provider for real-time events (mempool, blocks)
   */
  async getWsProvider(): Promise<ethers.WebSocketProvider> {
    // Try Hetzner WebSocket first
    try {
      const wsProvider = new ethers.WebSocketProvider(HETZNER_WSS);
      await Promise.race([
        wsProvider.getBlockNumber(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.REQUEST_TIMEOUT)
        ),
      ]);
      console.log('🚀 Using Hetzner WebSocket');
      this.currentWsProvider = wsProvider;
      return wsProvider;
    } catch (e) {
      console.log('⚠️ Hetzner WebSocket unavailable, trying public...');
    }

    // Fallback to public WebSockets
    for (const wss of PUBLIC_WSS) {
      try {
        const wsProvider = new ethers.WebSocketProvider(wss);
        await Promise.race([
          wsProvider.getBlockNumber(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), this.REQUEST_TIMEOUT)
          ),
        ]);
        console.log(`📡 Using public WebSocket: ${wss}`);
        this.currentWsProvider = wsProvider;
        return wsProvider;
      } catch (e) {
        continue;
      }
    }

    throw new Error('No WebSocket providers available');
  }

  /**
   * Get current RPC URL (for display/logging)
   */
  getCurrentRpcUrl(): string {
    const hetznerCached = this.healthCache.get(HETZNER_RPC);
    if (hetznerCached?.isHealthy) {
      return HETZNER_RPC;
    }

    for (const rpc of PUBLIC_RPCS) {
      const cached = this.healthCache.get(rpc);
      if (cached?.isHealthy) {
        return rpc;
      }
    }

    return PUBLIC_RPCS[0];
  }

  /**
   * Force refresh health checks
   */
  async refreshHealth(): Promise<void> {
    this.healthCache.clear();
    await this.getProvider();
  }

  /**
   * Get Hetzner sync status
   */
  async getHetznerStatus(): Promise<{ synced: boolean; blockNumber: number; message: string }> {
    const health = await this.checkHealth(HETZNER_RPC);

    if (health.blockNumber === 0) {
      return { synced: false, blockNumber: 0, message: '🔄 Node syncing (block bodies)...' };
    }

    if (health.blockNumber < 1000000) {
      return { synced: false, blockNumber: health.blockNumber, message: `🔄 Syncing: block ${health.blockNumber.toLocaleString()}` };
    }

    return { synced: true, blockNumber: health.blockNumber, message: `✅ Synced: block ${health.blockNumber.toLocaleString()}` };
  }
}

// Singleton instance
export const rpcManager = new RPCManager();

// Convenience exports
export const getProvider = () => rpcManager.getProvider();
export const getWsProvider = () => rpcManager.getWsProvider();
export const HETZNER_ENDPOINTS = { http: HETZNER_RPC, wss: HETZNER_WSS };
export const PUBLIC_ENDPOINTS = { http: PUBLIC_RPCS, wss: PUBLIC_WSS };
