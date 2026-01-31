import { ethers } from 'ethers';
interface TokenBalance {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    balance: bigint;
    balanceFormatted: string;
}
export declare class WalletManager {
    private provider;
    private store;
    private encryptionKey;
    constructor();
    /**
     * Encrypt private key for storage
     */
    private encrypt;
    /**
     * Decrypt private key
     */
    private decrypt;
    /**
     * Create or get existing wallet for user
     */
    getOrCreateWallet(telegramId: string): Promise<{
        wallet: ethers.Wallet;
        isNew: boolean;
    }>;
    /**
     * Import existing wallet
     */
    importWallet(telegramId: string, privateKey: string): Promise<ethers.Wallet>;
    /**
     * Get wallet for user
     */
    getWallet(telegramId: string): Promise<ethers.Wallet | null>;
    /**
     * Export private key (user must confirm)
     */
    exportPrivateKey(telegramId: string): Promise<string | null>;
    /**
     * Get PLS balance
     */
    getPlsBalance(address: string): Promise<{
        balance: bigint;
        formatted: string;
    }>;
    /**
     * Get token balance
     */
    getTokenBalance(walletAddress: string, tokenAddress: string): Promise<TokenBalance>;
    /**
     * Get multiple token balances
     */
    getTokenBalances(walletAddress: string, tokenAddresses: string[]): Promise<TokenBalance[]>;
    /**
     * Format balance for display
     */
    formatBalance(balance: string, symbol: string, usdValue?: number): string;
}
export declare const walletManager: WalletManager;
export {};
//# sourceMappingURL=wallet.d.ts.map