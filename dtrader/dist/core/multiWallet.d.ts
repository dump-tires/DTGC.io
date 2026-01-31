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
    generateWallets(userId: string): Promise<WalletInfo[]>;
    getUserWalletCount(userId: string): number;
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