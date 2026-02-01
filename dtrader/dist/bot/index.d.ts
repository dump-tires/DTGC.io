export declare class DtraderBot {
    private bot;
    private sessions;
    private pollingErrorCount;
    private maxPollingErrors;
    constructor();
    /**
     * Initialize bot commands menu, description, and menu button
     * This makes the bot more user-friendly before /start is pressed
     */
    private initializeBotMenu;
    private getSession;
    /**
     * Check token gate before allowing actions
     * Uses LINKED WALLET first (external MetaMask/Rabby), falls back to bot wallet
     * NOW WITH MINI APP VERIFICATION + PERSISTENT STORAGE
     */
    private checkGate;
    /**
     * Handle web verification deep link from dtgc.io/gold
     * Token format: base64url_payload.signature
     */
    private handleWebVerification;
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
     * Shows address AND private key for each wallet
     */
    private generate6Wallets;
    /**
     * Export all wallet keys (addresses + private keys)
     */
    private exportAllWallets;
    /**
     * Show all wallet balances
     */
    private showWalletBalances;
    /**
     * Show all wallet addresses (quick view)
     */
    private showAllWalletAddresses;
    /**
     * Show portfolio with all positions and P&L
     */
    private showPortfolio;
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
     * Mandalorian-style alpha receipt with gas priority for first-mover advantage
     */
    private setupInstaSnipe;
    /**
     * Show all snipe orders for user
     */
    private showSnipeOrders;
    /**
     * Cancel a snipe order
     */
    private cancelSnipe;
    /**
     * Set up Limit Bond Sell (Take Profit) for a snipe order
     * Automatically sells a percentage of tokens when price increases by target %
     */
    private setupLimitBondSell;
    private showFeeStats;
    private showHelp;
    private setupSniperEvents;
    private setupOrderEvents;
    /**
     * Start the bot
     */
    start(): Promise<void>;
    /**
     * Show trade history main menu
     */
    private showTradeHistory;
    /**
     * Show active (pending/watching) orders
     */
    private showActiveOrders;
    /**
     * Show completed trades
     */
    private showCompletedTrades;
    /**
     * Show InstaBond snipe history
     */
    private showInstaBondHistory;
    /**
     * Show limit order history
     */
    private showLimitOrderHistory;
    /**
     * Show PnL summary
     */
    private showPnLSummary;
    /**
     * Generate and send P&L card image
     * Uses Mando sniper image as background
     */
    private generatePnLCard;
    /**
     * Show positions menu (tracked tokens)
     */
    private showPositionsMenu;
    /**
     * Show pump.tires sniper settings (PulsonicBot style)
     */
    private showPumpSniperSettings;
    /**
     * Show quick sell menu for a token (PulsonicBot style)
     */
    private showQuickSellMenu;
    /**
     * Show token position details (PulsonicBot style)
     */
    private showTokenPosition;
    /**
     * Stop the bot
     */
    stop(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map