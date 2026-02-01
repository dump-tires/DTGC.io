import TelegramBot from 'node-telegram-bot-api';

/**
 * Enhanced Telegram Keyboard Layouts
 * Modeled after Maestro/Solid Trader bot structure
 */

// ==================== MAIN MENUS ====================

export const mainMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🔄 Refresh', callback_data: 'refresh_balance' },
      { text: 'ℹ️ Help', callback_data: 'help_menu' },
    ],
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
      { text: '👛 Wallets', callback_data: 'wallets_menu' },
      { text: '📈 Portfolio', callback_data: 'portfolio' },
    ],
    [
      { text: '📋 Trade History', callback_data: 'history_menu' },
      { text: '⚙️ Settings', callback_data: 'settings' },
    ],
    [
      { text: '🛡️ Anti-Rug Check', callback_data: 'check_token' },
      { text: '🔗 Verify Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } },
    ],
    [
      { text: '⚜️ Gold Suite 📱', url: 'https://dtgc.io/gold' },
    ],
  ],
};

// ==================== HELP MENU ====================

export const helpMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '💰 Buy/Sell', callback_data: 'help_buy_sell' },
      { text: '🎯 Sniper', callback_data: 'help_sniper' },
    ],
    [
      { text: '🎓 InstaBond', callback_data: 'help_instabond' },
      { text: '📊 Limit Orders', callback_data: 'help_orders' },
    ],
    [
      { text: '🛡️ Anti-Rug', callback_data: 'help_antirug' },
      { text: '👛 Wallets', callback_data: 'help_wallets' },
    ],
    [
      { text: '⚜️ Token Gate', callback_data: 'help_gate' },
      { text: '📈 Portfolio', callback_data: 'help_portfolio' },
    ],
    [
      { text: '🔙 Main Menu', callback_data: 'main_menu' },
    ],
  ],
};

// ==================== WALLET MENUS ====================

export const walletsMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🔗 Verify & Link Wallet', web_app: { url: 'https://dtgc.io/tg-verify.html' } },
    ],
    [
      { text: '🆕 Generate 6 Snipe Wallets', callback_data: 'wallets_generate_6' },
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

export const walletSelectKeyboard = (wallets: { index: number; label: string; isActive: boolean }[]): TelegramBot.InlineKeyboardMarkup => {
  const buttons: TelegramBot.InlineKeyboardButton[][] = [];

  for (let i = 0; i < wallets.length; i += 2) {
    const row: TelegramBot.InlineKeyboardButton[] = [];
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

// ==================== LIMIT ORDER WALLET SELECTION ====================

export const orderWalletSelectKeyboard = (wallets: { index: number; label: string; isActive: boolean; selected?: boolean }[]): TelegramBot.InlineKeyboardMarkup => {
  const buttons: TelegramBot.InlineKeyboardButton[][] = [];

  for (const w of wallets) {
    const icon = w.selected ? '🟢' : '⚪';
    buttons.push([{
      text: `${icon} ${w.label} (#${w.index})`,
      callback_data: `order_wallet_${w.index}`,
    }]);
  }

  buttons.push([
    { text: '✅ All Wallets', callback_data: 'order_wallet_all' },
  ]);
  buttons.push([
    { text: '🚀 Confirm & Create Orders', callback_data: 'order_wallet_confirm' },
  ]);
  buttons.push([{ text: '❌ Cancel', callback_data: 'orders_menu' }]);

  return { inline_keyboard: buttons };
};

// ==================== SNIPE MENUS ====================

export const snipeMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
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

export const ordersMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
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

// ==================== TRADE MENU ====================

export const tradeMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '💰 Quick Buy', callback_data: 'action_buy' },
      { text: '💸 Quick Sell', callback_data: 'action_sell' },
    ],
    [
      { text: '🎯 Sniper', callback_data: 'snipe_menu' },
      { text: '📊 Limit Order', callback_data: 'orders_menu' },
    ],
    [
      { text: '🔙 Main Menu', callback_data: 'main_menu' },
    ],
  ],
};

// ==================== PUMP.TIRES MENU ====================

export const pumpMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🔥 TOP 10 NEAR GRADUATION', callback_data: 'pump_near_grad' },
    ],
    [
      { text: '🎓 Recently Bonded', callback_data: 'pump_graduated' },
      { text: '🆕 New Tokens', callback_data: 'pump_new' },
    ],
    [
      { text: '🤖 Auto-Snipe ALL Grads', callback_data: 'pump_auto_snipe' },
    ],
    [
      { text: '🎯 Snipe Specific CA', callback_data: 'pump_snipe_token' },
    ],
    [
      { text: '⚜️ Gold Suite InstaBond 📱', url: 'https://dtgc.io/gold' },
    ],
    [
      { text: '🔙 Back', callback_data: 'main_menu' },
    ],
  ],
};

// ==================== COPY TRADE MENU ====================

export const copyMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
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

export const settingsKeyboard: TelegramBot.InlineKeyboardMarkup = {
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

export const buyAmountKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '💰 1M PLS', callback_data: 'buy_1000000' },
      { text: '💰 5M PLS', callback_data: 'buy_5000000' },
      { text: '💰 10M PLS', callback_data: 'buy_10000000' },
    ],
    [
      { text: '💰 20M PLS', callback_data: 'buy_20000000' },
      { text: '💰 50M PLS', callback_data: 'buy_50000000' },
      { text: '💰 100M PLS', callback_data: 'buy_100000000' },
    ],
    [
      { text: '📝 Custom Amount', callback_data: 'buy_custom' },
    ],
    [
      { text: '━━━━━ OR SET LIMIT ORDER ━━━━━', callback_data: 'noop' },
    ],
    [
      { text: '🟢 Limit Buy (set target price)', callback_data: 'buy_limit_order' },
    ],
    [
      { text: '❌ Cancel', callback_data: 'main_menu' },
    ],
  ],
};

export const sellPercentKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '💸 10%', callback_data: 'sell_10' },
      { text: '💸 25%', callback_data: 'sell_25' },
      { text: '💸 33%', callback_data: 'sell_33' },
    ],
    [
      { text: '💸 50%', callback_data: 'sell_50' },
      { text: '💸 75%', callback_data: 'sell_75' },
      { text: '💸 100%', callback_data: 'sell_100' },
    ],
    [
      { text: '📝 Custom %', callback_data: 'sell_custom' },
    ],
    [
      { text: '━━━━━ OR SET LIMIT ORDER ━━━━━', callback_data: 'noop' },
    ],
    [
      { text: '🔴 Limit Sell (set target price)', callback_data: 'sell_limit_order' },
    ],
    [
      { text: '❌ Cancel', callback_data: 'main_menu' },
    ],
  ],
};

export const slippageKeyboard: TelegramBot.InlineKeyboardMarkup = {
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

export const confirmKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '✅ Confirm', callback_data: 'confirm_yes' },
      { text: '❌ Cancel', callback_data: 'confirm_no' },
    ],
  ],
};

export const confirmWithDetailsKeyboard = (action: string): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: `✅ Confirm ${action}`, callback_data: 'confirm_yes' },
    ],
    [
      { text: '❌ Cancel', callback_data: 'confirm_no' },
    ],
  ],
});

// ==================== TOKEN ACTIONS ====================

export const tokenActionKeyboard = (tokenAddress: string): TelegramBot.InlineKeyboardMarkup => ({
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

// ==================== MULTI-WALLET SNIPE ====================

export const multiWalletSnipeKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🎯 ALL 6 Wallets', callback_data: 'snipe_wallets_6' },
    ],
    [
      { text: '1 Wallet', callback_data: 'snipe_wallets_1' },
      { text: '2 Wallets', callback_data: 'snipe_wallets_2' },
      { text: '3 Wallets', callback_data: 'snipe_wallets_3' },
    ],
    [
      { text: '4 Wallets', callback_data: 'snipe_wallets_4' },
      { text: '5 Wallets', callback_data: 'snipe_wallets_5' },
    ],
    [
      { text: '❌ Cancel', callback_data: 'main_menu' },
    ],
  ],
};

// Snipe amount keyboard (per wallet)
export const snipeAmountKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '1M PLS', callback_data: 'snipe_amt_1000000' },
      { text: '5M PLS', callback_data: 'snipe_amt_5000000' },
      { text: '10M PLS', callback_data: 'snipe_amt_10000000' },
    ],
    [
      { text: '20M PLS', callback_data: 'snipe_amt_20000000' },
      { text: '50M PLS', callback_data: 'snipe_amt_50000000' },
      { text: '100M PLS', callback_data: 'snipe_amt_100000000' },
    ],
    [
      { text: '📝 Custom', callback_data: 'snipe_amt_custom' },
    ],
    [
      { text: '❌ Cancel', callback_data: 'main_menu' },
    ],
  ],
};

// Gas priority for first-mover advantage
export const gasPriorityKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🐢 Normal (0.01 Gwei)', callback_data: 'gas_normal' },
    ],
    [
      { text: '⚡ Fast (0.1 Gwei)', callback_data: 'gas_fast' },
    ],
    [
      { text: '🚀 TURBO (1 Gwei)', callback_data: 'gas_turbo' },
    ],
    [
      { text: '💎 MAX SPEED (10 Gwei)', callback_data: 'gas_max' },
    ],
    [
      { text: '🔙 Back', callback_data: 'main_menu' },
    ],
  ],
};

// ==================== QUICK ACTIONS ====================

export const quickActionsKeyboard = (tokenAddress: string): TelegramBot.InlineKeyboardMarkup => ({
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

// ==================== TRADE HISTORY ====================

export const tradeHistoryKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '👁️ Active Orders', callback_data: 'history_active' },
      { text: '✅ Completed', callback_data: 'history_completed' },
    ],
    [
      { text: '🎓 InstaBond Snipes', callback_data: 'history_instabond' },
      { text: '📊 Limit Orders', callback_data: 'history_limits' },
    ],
    [
      { text: '📈 PnL Summary', callback_data: 'history_pnl' },
    ],
    [
      { text: '🔙 Back', callback_data: 'main_menu' },
    ],
  ],
};

export const tradeHistoryEntryKeyboard = (orderId: string): TelegramBot.InlineKeyboardMarkup => ({
  inline_keyboard: [
    [
      { text: '❌ Cancel Order', callback_data: `history_cancel_${orderId}` },
    ],
    [
      { text: '🔙 Back to History', callback_data: 'history_menu' },
    ],
  ],
});

// ═══════════════════════════════════════════════════════════════════════════
// ⚜️ MANDO BOT - PULSONIC-STYLE TOKEN POSITION KEYBOARD
// Clean, precise layout with sell percentages and quick actions
// ═══════════════════════════════════════════════════════════════════════════

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
export const tokenPositionKeyboard = (data: TokenPositionData): TelegramBot.InlineKeyboardMarkup => {
  const { tokenAddress, tokenSymbol, walletIndex = 1, slippage = 'auto' } = data;
  const shortAddr = tokenAddress.slice(0, 8);

  return {
    inline_keyboard: [
      // Row 1: Refresh
      [
        { text: '🔄 Refresh', callback_data: `pos_refresh_${shortAddr}` },
      ],
      // Row 2: Wallet & Slippage
      [
        { text: `⚜️ Wallet - #${walletIndex}`, callback_data: `pos_wallet_${shortAddr}` },
      ],
      [
        { text: `🎯 Slippage - ${slippage}`, callback_data: `pos_slip_${shortAddr}` },
      ],
      // Row 3-4: Sell Percentages (Mando style)
      [
        { text: '💰 Sell 10%', callback_data: `pos_sell_10_${shortAddr}` },
        { text: '💰 Sell 25%', callback_data: `pos_sell_25_${shortAddr}` },
        { text: '💰 Sell 33%', callback_data: `pos_sell_33_${shortAddr}` },
      ],
      [
        { text: '💰 Sell 50%', callback_data: `pos_sell_50_${shortAddr}` },
        { text: '💰 Sell 75%', callback_data: `pos_sell_75_${shortAddr}` },
        { text: '💰 Sell 100%', callback_data: `pos_sell_100_${shortAddr}` },
      ],
      // Row 5: Custom sell
      [
        { text: `💰 Sell X ${tokenSymbol}`, callback_data: `pos_sell_x_${shortAddr}` },
      ],
      // Row 6: Limit Orders
      [
        { text: '🔴 Limit Sell', callback_data: `pos_limit_sell_${shortAddr}` },
        { text: '🟢 Limit Buy', callback_data: `pos_limit_buy_${shortAddr}` },
      ],
      // Row 7: Buy more
      [
        { text: `📈 Buy more ${tokenSymbol}`, callback_data: `pos_buy_${shortAddr}` },
      ],
      // Row 8: Share & Ignore
      [
        { text: '📤 Share', callback_data: `pos_share_${shortAddr}` },
      ],
      [
        { text: '🚫 Ignore forever', callback_data: `pos_ignore_${shortAddr}` },
      ],
      // Row 9: Back
      [
        { text: '🔙 Back to Positions', callback_data: 'positions_menu' },
      ],
    ],
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 PUMP.TIRES SNIPER SETTINGS KEYBOARD (PulsonicBot style)
// ═══════════════════════════════════════════════════════════════════════════

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
export const pumpSniperSettingsKeyboard = (data: SniperSettingsData): TelegramBot.InlineKeyboardMarkup => {
  const tickerStr = data.tickers.length > 0 ? data.tickers.map(t => `$${t}`).join(' ') : 'Any';

  return {
    inline_keyboard: [
      // Wallet selection
      [
        { text: `⚜️ Wallet - #${data.walletIndex}`, callback_data: 'pump_snipe_wallet' },
      ],
      // Snipe amount
      [
        { text: `💰 Snipe Amount - ${data.snipeAmount}`, callback_data: 'pump_snipe_amount' },
      ],
      // Ticker filter
      [
        { text: `🏷️ Snipe Ticker(s) - ${tickerStr}`, callback_data: 'pump_snipe_tickers' },
      ],
      // Max snipes
      [
        { text: `🎯 Max Snipes - ${data.maxSnipes}`, callback_data: 'pump_snipe_max' },
      ],
      // Dev filters
      [
        { text: `🎯 Max Dev Snipe - ${data.maxDevSnipe}`, callback_data: 'pump_snipe_dev_max' },
      ],
      [
        { text: `🪙 Max Tokens Deployed - ${data.maxTokensDeployed}`, callback_data: 'pump_snipe_tokens_max' },
      ],
      [
        { text: `⭐ Min Bonded Tokens - ${data.minBondedTokens}`, callback_data: 'pump_snipe_bonded_min' },
      ],
      // Gas
      [
        { text: `⛽ Gas Increase - ${data.gasIncrease}`, callback_data: 'pump_snipe_gas' },
      ],
      // Blacklist
      [
        { text: `🚫 Blacklisted - ${data.blacklistedDevs}`, callback_data: 'pump_snipe_blacklist' },
        { text: '➕ Add', callback_data: 'pump_snipe_blacklist_add' },
        { text: '➖ Remove', callback_data: 'pump_snipe_blacklist_remove' },
      ],
      // Enable/Disable
      [
        { text: data.isActive ? '✅ Enabled' : '❌ Disabled', callback_data: 'pump_snipe_toggle' },
      ],
      // Back
      [
        { text: '🔙 Back to Pump.tires Menu', callback_data: 'pump_menu' },
      ],
    ],
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// 📊 POSITIONS MENU (List all held tokens)
// ═══════════════════════════════════════════════════════════════════════════

export const positionsMenuKeyboard: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [
    [
      { text: '🔄 Refresh All', callback_data: 'positions_refresh' },
    ],
    [
      { text: '📊 Sort by P&L', callback_data: 'positions_sort_pnl' },
      { text: '📈 Sort by Value', callback_data: 'positions_sort_value' },
    ],
    [
      { text: '🗂️ Regroup Messages', callback_data: 'positions_regroup' },
    ],
    [
      { text: '🔙 Main Menu', callback_data: 'main_menu' },
    ],
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 🔄 QUICK SELL MENU (for /sellmenu command)
// ═══════════════════════════════════════════════════════════════════════════

export const quickSellMenuKeyboard = (tokenAddress: string, tokenSymbol: string): TelegramBot.InlineKeyboardMarkup => {
  const shortAddr = tokenAddress.slice(0, 8);

  return {
    inline_keyboard: [
      [
        { text: '💰 10%', callback_data: `qsell_10_${shortAddr}` },
        { text: '💰 25%', callback_data: `qsell_25_${shortAddr}` },
        { text: '💰 33%', callback_data: `qsell_33_${shortAddr}` },
      ],
      [
        { text: '💰 50%', callback_data: `qsell_50_${shortAddr}` },
        { text: '💰 75%', callback_data: `qsell_75_${shortAddr}` },
        { text: '💰 100%', callback_data: `qsell_100_${shortAddr}` },
      ],
      [
        { text: `📝 Sell X ${tokenSymbol}`, callback_data: `qsell_x_${shortAddr}` },
      ],
      [
        { text: '🔴 Set Limit Sell', callback_data: `qlimit_sell_${shortAddr}` },
      ],
      [
        { text: '❌ Cancel', callback_data: 'main_menu' },
      ],
    ],
  };
};
