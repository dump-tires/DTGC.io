import { ethers } from 'ethers';
/**
 * Multi-Wallet Manager (JSON Storage)
 */
interface WalletInfo {
    index: number;
    address: string;
    label: string;
    balance: bigint;
    isActive: boolean;
}
export declare class MultiWalletManager {
    private provider;
    private store;
    private encryptionKey;
    constructor();
    private encrypt;
    private decrypt;
    generateWallets(userId: string, linkedWalletAddress?: string): Promise<WalletInfo[]>;
    getUserWalletCount(userId: string): number;
    /**
     * Link existing wallets to a gated wallet address (called after gate verification)
     */
    linkWalletsToGatedWallet(userId: string, gatedWalletAddress: string): void;
    /**
     * Recover wallets using gated wallet address + last 4 digits of any wallet's private key
     * Returns the userId if found, allowing the user to reclaim their wallets
     */
    recoverWallets(gatedWalletAddress: string, keyLast4: string): {
        userId: string;
        walletCount: number;
    } | null;
    /**
     * Transfer wallet ownership to a new userId (for recovery)
     */
    transferWallets(fromUserId: string, toUserId: string): number;
    /**
     * Get wallets info for recovery display (shows addresses + last4 for verification)
     */
    getWalletsForRecovery(gatedWalletAddress: string): {
        address: string;
        keyLast4: string;
        index: number;
    }[];
    /**
     * Import an external wallet by private key
     * Returns the wallet info with assigned index
     */
    importWallet(userId: string, privateKey: string, label?: string, linkedWalletAddress?: string): WalletInfo;
    /**
     * Get wallet by address (for imported wallet lookup)
     */
    getWalletByAddress(userId: string, address: string): WalletInfo | null;
    getUserWallets(userId: string): Promise<WalletInfo[]>;
    getWalletSigner(userId: string, index: number): Promise<ethers.Wallet | null>;
    getActiveWalletSigners(userId: string): Promise<ethers.Wallet[]>;
    toggleWalletActive(userId: string, index: number): boolean;
    setWalletLabel(userId: string, index: number, label: string): boolean;
    exportPrivateKey(userId: string, index: number): string | null;
    getTotalBalance(userId: string): Promise<{
        pls: bigint;
        wallets: WalletInfo[];
    }>;
    formatWalletList(wallets: WalletInfo[]): string;
}
export declare const multiWallet: MultiWalletManager;
export {};
//# sourceMappingURL=multiWallet.d.ts.map