/**
 * RPC Configuration with Hetzner Primary + Public Fallbacks
 * Auto-failover for maximum reliability
 */
import { ethers } from 'ethers';
interface RPCHealth {
    url: string;
    isHealthy: boolean;
    latency: number;
    lastCheck: number;
    blockNumber: number;
}
declare class RPCManager {
    private healthCache;
    private currentProvider;
    private currentWsProvider;
    private readonly HEALTH_CHECK_INTERVAL;
    private readonly REQUEST_TIMEOUT;
    /**
     * Check if an RPC endpoint is healthy and synced
     */
    checkHealth(rpcUrl: string): Promise<RPCHealth>;
    /**
     * Get the best available RPC provider
     * Prioritizes Hetzner, falls back to public RPCs
     */
    getProvider(): Promise<ethers.JsonRpcProvider>;
    /**
     * Get WebSocket provider for real-time events (mempool, blocks)
     */
    getWsProvider(): Promise<ethers.WebSocketProvider>;
    /**
     * Get current RPC URL (for display/logging)
     */
    getCurrentRpcUrl(): string;
    /**
     * Force refresh health checks
     */
    refreshHealth(): Promise<void>;
    /**
     * Get Hetzner sync status
     */
    getHetznerStatus(): Promise<{
        synced: boolean;
        blockNumber: number;
        message: string;
    }>;
}
export declare const rpcManager: RPCManager;
export declare const getProvider: () => Promise<ethers.JsonRpcProvider>;
export declare const getWsProvider: () => Promise<ethers.WebSocketProvider>;
export declare const HETZNER_ENDPOINTS: {
    http: string;
    wss: string;
};
export declare const PUBLIC_ENDPOINTS: {
    http: string[];
    wss: string[];
};
export {};
//# sourceMappingURL=rpc.d.ts.map