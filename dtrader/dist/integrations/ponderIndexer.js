"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ponderIndexer = exports.PonderIndexer = void 0;
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
class PonderIndexer extends events_1.EventEmitter {
    config;
    pollingTimer = null;
    lastSeenOrderId = '';
    isRunning = false;
    constructor(config) {
        super();
        this.config = {
            apiUrl: config.apiUrl || 'http://localhost:42069',
            pollingInterval: config.pollingInterval || 2000, // 2 seconds
        };
    }
    /**
     * Get all indexed tokens
     */
    async getTokens(limit = 100, offset = 0) {
        try {
            const response = await axios_1.default.get(`${this.config.apiUrl}/tokens`, {
                params: { limit, offset },
            });
            return response.data.items || [];
        }
        catch (error) {
            console.error('Failed to fetch tokens:', error);
            return [];
        }
    }
    /**
     * Get token by address
     */
    async getToken(address) {
        try {
            const response = await axios_1.default.get(`${this.config.apiUrl}/tokens/${address}`);
            return response.data;
        }
        catch {
            return null;
        }
    }
    /**
     * Get recent ownership transfers (potential graduations)
     */
    async getOwnershipTransfers(limit = 50) {
        try {
            const response = await axios_1.default.get(`${this.config.apiUrl}/ownership-transfers`, {
                params: { limit },
            });
            return response.data.items || [];
        }
        catch (error) {
            console.error('Failed to fetch ownership transfers:', error);
            return [];
        }
    }
    /**
     * Get tokens that recently launched (have launchedTransactionHash)
     */
    async getRecentlyLaunchedTokens(limit = 20) {
        try {
            const response = await axios_1.default.get(`${this.config.apiUrl}/tokens`, {
                params: {
                    limit,
                    filter: 'launched',
                    orderBy: 'launchedOrderId',
                    order: 'desc',
                },
            });
            return response.data.items || [];
        }
        catch (error) {
            console.error('Failed to fetch launched tokens:', error);
            return [];
        }
    }
    /**
     * Get tokens about to graduate (based on ownership patterns)
     */
    async getTokensNearGraduation() {
        try {
            // Tokens that have been deployed but not yet launched
            const response = await axios_1.default.get(`${this.config.apiUrl}/tokens`, {
                params: {
                    filter: 'pending_launch',
                    orderBy: 'orderId',
                    order: 'desc',
                    limit: 50,
                },
            });
            return response.data.items || [];
        }
        catch (error) {
            console.error('Failed to fetch pending tokens:', error);
            return [];
        }
    }
    /**
     * Start polling for new tokens
     */
    async startPolling() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('📡 Starting Ponder indexer polling...');
        const poll = async () => {
            try {
                // Get latest ownership transfers
                const transfers = await this.getOwnershipTransfers(10);
                for (const transfer of transfers) {
                    // Skip already seen
                    if (transfer.orderId <= this.lastSeenOrderId)
                        continue;
                    // Check if this is a graduation (ownership to zero address)
                    const isGraduation = transfer.to.toLowerCase() === '0x0000000000000000000000000000000000000000';
                    if (isGraduation) {
                        console.log(`🎓 Graduation detected: ${transfer.tokenAddress}`);
                        // Get full token data
                        const token = await this.getToken(transfer.tokenAddress);
                        this.emit('graduation', {
                            transfer,
                            token,
                        });
                    }
                    // Check for new token launches
                    if (transfer.from.toLowerCase() === '0x0000000000000000000000000000000000000000') {
                        console.log(`🆕 New token: ${transfer.tokenAddress}`);
                        const token = await this.getToken(transfer.tokenAddress);
                        this.emit('newToken', {
                            transfer,
                            token,
                        });
                    }
                    this.lastSeenOrderId = transfer.orderId;
                }
                // Also poll for launched tokens
                const launchedTokens = await this.getRecentlyLaunchedTokens(5);
                for (const token of launchedTokens) {
                    if (token.launchedTransactionHash && token.orderId > this.lastSeenOrderId) {
                        this.emit('tokenLaunched', token);
                    }
                }
            }
            catch (error) {
                console.error('Polling error:', error);
            }
        };
        // Initial poll
        await poll();
        // Set up interval
        this.pollingTimer = setInterval(poll, this.config.pollingInterval);
    }
    /**
     * Stop polling
     */
    stopPolling() {
        this.isRunning = false;
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
    }
    /**
     * GraphQL query (if Ponder supports it)
     */
    async query(graphqlQuery, variables) {
        try {
            const response = await axios_1.default.post(`${this.config.apiUrl}/graphql`, {
                query: graphqlQuery,
                variables,
            });
            return response.data.data;
        }
        catch (error) {
            console.error('GraphQL query failed:', error);
            return null;
        }
    }
    /**
     * Get token with full details via GraphQL
     */
    async getTokenDetails(address) {
        const query = `
      query GetToken($address: String!) {
        token(address: $address) {
          chainId
          address
          name
          symbol
          decimals
          factoryAddress
          deployedTransactionHash
          launchedTransactionHash
          ownershipTransferreds {
            from
            to
            transactionHash
          }
        }
      }
    `;
        return this.query(query, { address });
    }
    /**
     * Subscribe to specific token updates
     */
    async watchToken(tokenAddress, callback) {
        // Poll for updates on this specific token
        const poll = async () => {
            const token = await this.getToken(tokenAddress);
            if (token) {
                callback(token);
            }
        };
        const timer = setInterval(poll, 3000);
        // Return cleanup function
        this.once('stop', () => clearInterval(timer));
    }
    /**
     * Health check
     */
    async isHealthy() {
        try {
            const response = await axios_1.default.get(`${this.config.apiUrl}/health`, {
                timeout: 5000,
            });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }
    /**
     * Format token for display
     */
    formatToken(token) {
        return `
🪙 **${token.name}** (${token.symbol})
\`${token.address}\`

📍 Factory: \`${token.factoryAddress.slice(0, 20)}...\`
${token.launchedTransactionHash ? '✅ Launched on PulseX' : '⏳ On bonding curve'}
    `.trim();
    }
}
exports.PonderIndexer = PonderIndexer;
// Default instance pointing to local indexer
exports.ponderIndexer = new PonderIndexer({
    apiUrl: process.env.PONDER_API_URL || 'http://localhost:42069',
});
//# sourceMappingURL=ponderIndexer.js.map