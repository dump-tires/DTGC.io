import TelegramBot from 'node-telegram-bot-api';
/**
 * Enhanced Telegram Keyboard Layouts
 * Modeled after Maestro/Solid Trader bot structure
 */
export declare const mainMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const walletsMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const walletSelectKeyboard: (wallets: {
    index: number;
    label: string;
    isActive: boolean;
}[]) => TelegramBot.InlineKeyboardMarkup;
export declare const snipeMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
export declare const ordersMenuKeyboard: TelegramBot.InlineKeyboardMarkup;
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
export declare const quickActionsKeyboard: (tokenAddress: string) => TelegramBot.InlineKeyboardMarkup;
//# sourceMappingURL=keyboards.d.ts.map