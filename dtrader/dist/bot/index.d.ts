export declare class DtraderBot {
    private bot;
    private sessions;
    constructor();
    private getSession;
    /**
     * Check token gate before allowing actions
     * Uses LINKED WALLET first (external MetaMask/Rabby), falls back to bot wallet
     */
    private checkGate;
    private setupHandlers;
    private handleCallback;
    private handleTextInput;
    private startBuyFlow;
    private executeBuy;
    private startSellFlow;
    private executeSell;
    private startSnipeFlow;
    private setupSnipe;
    private setupGraduationSnipe;
    private enableAutoSnipe;
    private createLimitOrder;
    private showUserOrders;
    private checkTokenSafety;
    private showBalance;
    /**
     * Show refreshed balance for both bot wallet and linked external wallet
     */
    private showRefreshedBalance;
    /**
     * Link an external wallet address for balance tracking
     */
    private linkExternalWallet;
    /**
     * Generate 6 snipe wallets for multi-wallet sniping
     */
    private generate6Wallets;
    /**
     * Show Top 10 tokens closest to graduation from pump.tires
     */
    private showNearGradTokens;
    /**
     * Make a text-based progress bar
     */
    private makeProgressBar;
    /**
     * Set up Insta-Snipe for a token (executes on graduation)
     */
    private setupInstaSnipe;
    private showFeeStats;
    private showHelp;
    private setupSniperEvents;
    private setupOrderEvents;
    /**
     * Start the bot
     */
    start(): Promise<void>;
    /**
     * Stop the bot
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map