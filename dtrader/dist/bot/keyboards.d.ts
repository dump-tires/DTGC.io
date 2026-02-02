import TelegramBot from 'node-telegram-bot-api';
/**
 * Enhanced Telegram Keyboard Layouts
 * Modeled after Maestro/Solid Trader bot structure
 */
export declare const mainMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const helpMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const walletsMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const walletSelectKeyboard: (wallets: {
    index: number;
    label: string;
    isActive: boolean;
}[]) => TelegramBot.InlineKeyboardMarkup;
export declare const orderWalletSelectKeyboard: (wallets: {
    index: number;
    label: string;
    isActive: boolean;
    selected?: boolean;
}[]) => TelegramBot.InlineKeyboardMarkup;
export declare const snipeMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const ordersMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const tradeMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const pumpMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const copyMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const settingsKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const buyAmountKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const sellPercentKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const slippageKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const confirmKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const confirmWithDetailsKeyboard: (action: string) => TelegramBot.InlineKeyboardMarkup;
export declare const tokenActionKeyboard: (tokenAddress: string) => TelegramBot.InlineKeyboardMarkup;
export declare const multiWalletSnipeKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const snipeAmountKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const gasPriorityKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const quickActionsKeyboard: (tokenAddress: string) => TelegramBot.InlineKeyboardMarkup;
export declare const tradeHistoryKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const tradeHistoryEntryKeyboard: (orderId: string) => TelegramBot.InlineKeyboardMarkup;
export interface TokenPositionData {
    tokenAddress: string;
    tokenSymbol: string;
    walletIndex?: number;
    slippage?: string;
}
/**
 * Generate PulsonicBot-style token position keyboard
 * Mandalorian themed with clean, precise buttons
 */
export declare const tokenPositionKeyboard: (data: TokenPositionData) => TelegramBot.InlineKeyboardMarkup;
export interface SniperSettingsData {
    walletIndex: number;
    walletBalance: string;
    snipeAmount: string;
    gasIncrease: string;
    tickers: string[];
    maxSnipes: number | string;
    blacklistedDevs: number;
    maxDevSnipe: string;
    maxTokensDeployed: string;
    minBondedTokens: string;
    isActive: boolean;
}
/**
 * Generate pump.tires sniper settings keyboard (PulsonicBot style)
 */
export declare const pumpSniperSettingsKeyboard: (data: SniperSettingsData) => TelegramBot.InlineKeyboardMarkup;
export declare const positionsMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const quickSellMenuKeyboard: (tokenAddress: string, tokenSymbol: string) => TelegramBot.InlineKeyboardMarkup;
/**
 * Quick Limit Buy presets - set buy triggers at % below current price
 */
export declare const quickLimitBuyKeyboard: (tokenAddress: string) => TelegramBot.InlineKeyboardMarkup;
/**
 * Quick Limit Sell / Take Profit presets - set sell triggers at % above current price
 */
export declare const quickLimitSellKeyboard: (tokenAddress: string) => TelegramBot.InlineKeyboardMarkup;
/**
 * InstaBond Auto-Sell Settings - set take profit after bonding
 */
export declare const instabondAutoSellKeyboard: (tokenAddress?: string) => TelegramBot.InlineKeyboardMarkup;
/**
 * InstaBond Snipe Confirmation with auto-sell options
 */
export declare const instabondSnipeConfirmKeyboard: (tokenAddress: string, takeProfitPercent?: number) => TelegramBot.InlineKeyboardMarkup;
//# sourceMappingURL=keyboards.d.ts.map