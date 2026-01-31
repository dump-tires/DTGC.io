export declare class DtraderBot {
    private bot;
    private sessions;
    constructor();
    private getSession;
    /**
     * Check token gate before allowing actions
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