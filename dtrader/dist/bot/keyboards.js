"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickActionsKeyboard = exports.multiWalletSnipeKeyboard = exports.tokenActionKeyboard = exports.confirmWithDetailsKeyboard = exports.confirmKeyboard = exports.slippageKeyboard = exports.sellPercentKeyboard = exports.buyAmountKeyboard = exports.settingsKeyboard = exports.copyMenuKeyboard = exports.pumpMenuKeyboard = exports.ordersMenuKeyboard = exports.snipeMenuKeyboard = exports.walletSelectKeyboard = exports.walletsMenuKeyboard = exports.mainMenuKeyboard = void 0;
/**
 * Enhanced Telegram Keyboard Layouts
 * Modeled after Maestro/Solid Trader bot structure
 */
// ==================== MAIN MENUS ====================
exports.mainMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '💰 Buy', callback_data: 'action_buy' },
            { text: '💸 Sell', callback_data: 'action_sell' },
        ],
        [
            { text: '🎯 Sniper', callback_data: 'snipe_menu' },
            { text: '📊 Orders', callback_data: 'orders_menu' },
        ],
        [
            { text: '🎓 pump.tires', callback_data: 'pump_menu' },
            { text: '🐋 Copy Trade', callback_data: 'copy_menu' },
        ],
        [
            { text: '👛 Wallets (6)', callback_data: 'wallets_menu' },
            { text: '📈 Portfolio', callback_data: 'portfolio' },
        ],
        [
            { text: '🛡️ Check Token', callback_data: 'check_token' },
            { text: '⚙️ Settings', callback_data: 'settings' },
        ],
        [
            { text: '🔥 Fee Stats', callback_data: 'fee_stats' },
            { text: '❓ Help', callback_data: 'help' },
        ],
        [
            { text: '⚜️ Open PulseX Gold', url: 'https://dtgc.io/gold' },
        ],
    ],
};
// ==================== WALLET MENUS ====================
exports.walletsMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🆕 Generate 6 Wallets', callback_data: 'wallets_generate' },
        ],
        [
            { text: '💰 View Balances', callback_data: 'wallets_balance' },
            { text: '📋 All Addresses', callback_data: 'wallets_addresses' },
        ],
        [
            { text: '✅ Toggle Active', callback_data: 'wallets_toggle' },
            { text: '🏷️ Set Labels', callback_data: 'wallets_labels' },
        ],
        [
            { text: '🔑 Export Keys', callback_data: 'wallets_export' },
            { text: '📥 Import Wallet', callback_data: 'wallets_import' },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
};
const walletSelectKeyboard = (wallets) => {
    const buttons = [];
    for (let i = 0; i < wallets.length; i += 2) {
        const row = [];
        for (let j = i; j < Math.min(i + 2, wallets.length); j++) {
            const w = wallets[j];
            const icon = w.isActive ? '✅' : '⬜';
            row.push({
                text: `${icon} ${w.label}`,
                callback_data: `wallet_select_${w.index}`,
            });
        }
        buttons.push(row);
    }
    buttons.push([
        { text: '✅ Select All', callback_data: 'wallet_select_all' },
        { text: '❌ Select None', callback_data: 'wallet_select_none' },
    ]);
    buttons.push([{ text: '🔙 Back', callback_data: 'wallets_menu' }]);
    return { inline_keyboard: buttons };
};
exports.walletSelectKeyboard = walletSelectKeyboard;
// ==================== SNIPE MENUS ====================
exports.snipeMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🎓 Instabond Snipe', callback_data: 'snipe_instabond' },
        ],
        [
            { text: '⚡ New Pair Snipe', callback_data: 'snipe_new_pair' },
            { text: '👀 Watch Token', callback_data: 'snipe_watch' },
        ],
        [
            { text: '🤖 Auto-Snipe All Grads', callback_data: 'snipe_auto_grad' },
        ],
        [
            { text: '📋 My Snipes', callback_data: 'snipe_list' },
            { text: '❌ Cancel All', callback_data: 'snipe_cancel_all' },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
};
// ==================== ORDER MENUS ====================
exports.ordersMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🟢 Limit Buy', callback_data: 'order_limit_buy' },
            { text: '🔴 Limit Sell', callback_data: 'order_limit_sell' },
        ],
        [
            { text: '🛑 Stop Loss', callback_data: 'order_stop_loss' },
            { text: '💰 Take Profit', callback_data: 'order_take_profit' },
        ],
        [
            { text: '📊 DCA Order', callback_data: 'order_dca' },
            { text: '📈 Trailing Stop', callback_data: 'order_trailing' },
        ],
        [
            { text: '📋 My Orders', callback_data: 'order_list' },
            { text: '❌ Cancel All', callback_data: 'order_cancel_all' },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
};
// ==================== PUMP.TIRES MENU ====================
exports.pumpMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '🔥 Trending', callback_data: 'pump_trending' },
            { text: '🆕 New Tokens', callback_data: 'pump_new' },
        ],
        [
            { text: '📈 Near Graduation', callback_data: 'pump_near_grad' },
            { text: '🎓 Recently Graduated', callback_data: 'pump_graduated' },
        ],
        [
            { text: '🎯 Snipe Specific Token', callback_data: 'pump_snipe_token' },
        ],
        [
            { text: '🤖 Auto-Snipe Mode', callback_data: 'pump_auto_snipe' },
        ],
        [
            { text: '⚜️ Bonds UI (Web)', url: 'https://dtgc.io/gold#bonds' },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
};
// ==================== COPY TRADE MENU ====================
exports.copyMenuKeyboard = {
    inline_keyboard: [
        [
            { text: '➕ Add Whale', callback_data: 'copy_add' },
            { text: '📋 My Whales', callback_data: 'copy_list' },
        ],
        [
            { text: '⚙️ Copy Settings', callback_data: 'copy_settings' },
        ],
        [
            { text: '📊 Copy History', callback_data: 'copy_history' },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
};
// ==================== SETTINGS MENU ====================
exports.settingsKeyboard = {
    inline_keyboard: [
        [
            { text: '📊 Slippage: 10%', callback_data: 'set_slippage' },
            { text: '⛽ Gas: 500k', callback_data: 'set_gas' },
        ],
        [
            { text: '🛡️ Anti-Rug: ON', callback_data: 'toggle_antirug' },
            { text: '⚡ Frontrun: OFF', callback_data: 'toggle_frontrun' },
        ],
        [
            { text: '🔔 Alerts: ON', callback_data: 'toggle_alerts' },
            { text: '🤖 Auto-Sell: OFF', callback_data: 'toggle_autosell' },
        ],
        [
            { text: '💰 Default Buy: 1M PLS', callback_data: 'set_default_buy' },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
};
// ==================== AMOUNT KEYBOARDS ====================
exports.buyAmountKeyboard = {
    inline_keyboard: [
        [
            { text: '100k PLS', callback_data: 'buy_100000' },
            { text: '500k PLS', callback_data: 'buy_500000' },
            { text: '1M PLS', callback_data: 'buy_1000000' },
        ],
        [
            { text: '2M PLS', callback_data: 'buy_2000000' },
            { text: '5M PLS', callback_data: 'buy_5000000' },
            { text: '10M PLS', callback_data: 'buy_10000000' },
        ],
        [
            { text: '📝 Custom Amount', callback_data: 'buy_custom' },
        ],
        [
            { text: '❌ Cancel', callback_data: 'main_menu' },
        ],
    ],
};
exports.sellPercentKeyboard = {
    inline_keyboard: [
        [
            { text: '25%', callback_data: 'sell_25' },
            { text: '50%', callback_data: 'sell_50' },
            { text: '75%', callback_data: 'sell_75' },
            { text: '100%', callback_data: 'sell_100' },
        ],
        [
            { text: '📝 Custom %', callback_data: 'sell_custom' },
        ],
        [
            { text: '❌ Cancel', callback_data: 'main_menu' },
        ],
    ],
};
exports.slippageKeyboard = {
    inline_keyboard: [
        [
            { text: '5%', callback_data: 'slip_5' },
            { text: '10%', callback_data: 'slip_10' },
            { text: '15%', callback_data: 'slip_15' },
            { text: '20%', callback_data: 'slip_20' },
        ],
        [
            { text: '30%', callback_data: 'slip_30' },
            { text: '50%', callback_data: 'slip_50' },
            { text: '📝 Custom', callback_data: 'slip_custom' },
        ],
        [
            { text: '🔙 Back', callback_data: 'settings' },
        ],
    ],
};
// ==================== CONFIRMATION ====================
exports.confirmKeyboard = {
    inline_keyboard: [
        [
            { text: '✅ Confirm', callback_data: 'confirm_yes' },
            { text: '❌ Cancel', callback_data: 'confirm_no' },
        ],
    ],
};
const confirmWithDetailsKeyboard = (action) => ({
    inline_keyboard: [
        [
            { text: `✅ Confirm ${action}`, callback_data: 'confirm_yes' },
        ],
        [
            { text: '❌ Cancel', callback_data: 'confirm_no' },
        ],
    ],
});
exports.confirmWithDetailsKeyboard = confirmWithDetailsKeyboard;
// ==================== TOKEN ACTIONS ====================
const tokenActionKeyboard = (tokenAddress) => ({
    inline_keyboard: [
        [
            { text: '💰 Buy', callback_data: `buy_${tokenAddress}` },
            { text: '💸 Sell', callback_data: `sell_${tokenAddress}` },
        ],
        [
            { text: '🎯 Snipe', callback_data: `snipe_${tokenAddress}` },
            { text: '📊 Limit Order', callback_data: `limit_${tokenAddress}` },
        ],
        [
            { text: '🐋 Track Devs', callback_data: `track_${tokenAddress}` },
        ],
        [
            { text: '🛡️ Refresh Safety', callback_data: `check_${tokenAddress}` },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
});
exports.tokenActionKeyboard = tokenActionKeyboard;
// ==================== MULTI-WALLET SNIPE ====================
exports.multiWalletSnipeKeyboard = {
    inline_keyboard: [
        [
            { text: '🎯 Snipe with ALL Active', callback_data: 'snipe_all_wallets' },
        ],
        [
            { text: '1️⃣ Wallet 1', callback_data: 'snipe_wallet_1' },
            { text: '2️⃣ Wallet 2', callback_data: 'snipe_wallet_2' },
            { text: '3️⃣ Wallet 3', callback_data: 'snipe_wallet_3' },
        ],
        [
            { text: '4️⃣ Wallet 4', callback_data: 'snipe_wallet_4' },
            { text: '5️⃣ Wallet 5', callback_data: 'snipe_wallet_5' },
            { text: '6️⃣ Wallet 6', callback_data: 'snipe_wallet_6' },
        ],
        [
            { text: '⚙️ Select Specific', callback_data: 'snipe_select_wallets' },
        ],
        [
            { text: '❌ Cancel', callback_data: 'main_menu' },
        ],
    ],
};
// ==================== QUICK ACTIONS ====================
const quickActionsKeyboard = (tokenAddress) => ({
    inline_keyboard: [
        [
            { text: '💰 Quick Buy 1M', callback_data: `qbuy_1m_${tokenAddress}` },
            { text: '💸 Sell 100%', callback_data: `qsell_100_${tokenAddress}` },
        ],
        [
            { text: '🛑 Set Stop Loss', callback_data: `sl_${tokenAddress}` },
            { text: '💰 Set Take Profit', callback_data: `tp_${tokenAddress}` },
        ],
        [
            { text: '🔙 Back', callback_data: 'main_menu' },
        ],
    ],
});
exports.quickActionsKeyboard = quickActionsKeyboard;
//# sourceMappingURL=keyboards.js.map