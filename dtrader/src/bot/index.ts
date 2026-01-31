import TelegramBot from 'node-telegram-bot-api';
import { generatePnLMessage, positionStore, calculatePnL, formatNumber } from '../utils/pnlCard';
import { ethers } from 'ethers';
import { config } from '../config';
import { tokenGate } from '../gate/tokenGate';
import { walletManager } from '../core/wallet';
import { pulsex } from '../core/pulsex';
import { feeManager } from '../core/feeManager';
import { graduationSniper } from '../sniper/graduation';
import { mempoolSniper } from '../sniper/mempool';
import { limitOrderEngine } from '../orders/limitOrder';
import { antiRug } from '../security/antiRug';
import * as keyboards from './keyboards';

/**
 * ⚜️ DTRADER Mandalorian - PulseChain Telegram Trading Bot
 *
 * Features:
 * - Token Gate (DTGC $50 minimum)
 * - DEX Buy/Sell via PulseX
 * - Limit Orders (buy/sell)
 * - pump.tires Instabond Sniper
 * - Normal Token Sniper (new pairs)
 * - Anti-Rug Protection
 * - 1% Fee: 0.5% DTGC Burn + 0.5% Dev Wallet
 *
 * Web Interface: https://dtgc.io/gold
 */

interface UserSession {
  pendingAction?: string;
  pendingToken?: string;
  pendingAmount?: string;
  linkedWallet?: string; // External wallet address (MetaMask, Rabby, etc.)
  settings: {
    slippage: number;
    gasLimit: number;
    antiRug: boolean;
    alerts: boolean;
  };
  gateVerified: boolean;
  gateExpiry: number;
}

export class DtraderBot {
  private bot: TelegramBot;
  private sessions: Map<string, UserSession> = new Map();

  constructor() {
    // Validate token before starting
    if (!config.telegramToken) {
      throw new Error('❌ BOT_TOKEN environment variable is not set! Please set it in Railway.');
    }

    console.log('🔑 Bot token found, initializing...');
    this.bot = new TelegramBot(config.telegramToken, { polling: true });
    this.setupHandlers();
    this.setupSniperEvents();
    this.setupOrderEvents();
    console.log('✅ Bot handlers initialized');
  }

  private getSession(chatId: string): UserSession {
    if (!this.sessions.has(chatId)) {
      this.sessions.set(chatId, {
        settings: {
          slippage: 10,
          gasLimit: 500000,
          antiRug: true,
          alerts: true,
        },
        gateVerified: false,
        gateExpiry: 0,
      });
    }
    return this.sessions.get(chatId)!;
  }

  /**
   * Check token gate before allowing actions
   * Uses LINKED WALLET first (external MetaMask/Rabby), falls back to bot wallet
   */
  private async checkGate(chatId: string, userId: string): Promise<boolean> {
    const session = this.getSession(chatId);

    // Cache gate check for 5 minutes
    if (session.gateVerified && Date.now() < session.gateExpiry) {
      return true;
    }

    // Priority 1: Check linked external wallet (MetaMask/Rabby)
    if (session.linkedWallet) {
      const linkedGateResult = await tokenGate.checkAccess(session.linkedWallet);
      if (linkedGateResult.allowed) {
        session.gateVerified = true;
        session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
        return true;
      }
    }

    // Priority 2: Check bot wallet
    const wallet = await walletManager.getWallet(userId);
    if (wallet) {
      const gateResult = await tokenGate.checkAccess(wallet.address);
      if (gateResult.allowed) {
        session.gateVerified = true;
        session.gateExpiry = Date.now() + 5 * 60 * 1000; // 5 min cache
        return true;
      }
    }

    // Neither wallet passed - show helpful message
    const linkedAddr = session.linkedWallet ? `\n🔗 Linked: \`${session.linkedWallet.slice(0,8)}...\`` : '';
    const botAddr = wallet ? `\n🤖 Bot: \`${wallet.address.slice(0,8)}...\`` : '';

    await this.bot.sendMessage(chatId,
      `❌ **Gate Check Failed**\n\n` +
      `Hold $50+ of DTGC in your wallet to access PRO features.${linkedAddr}${botAddr}\n\n` +
      `⚜️ DTGC: \`${config.tokenGate.dtgc}\`\n\n` +
      `💡 _Link your wallet with DTGC using 🔗 Link Wallet_`,
      { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
    );
    return false;
  }

  private setupHandlers(): void {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';

      const { wallet, isNew } = await walletManager.getOrCreateWallet(userId);

      const welcomeMsg = `
⚜️ **DTRADER Mandalorian** - PulseChain Sniper

${isNew ? '✨ New wallet created!' : '👋 Welcome back, Mandalorian!'}

**Your Wallet:**
\`${wallet.address}\`

━━━━━━━━━━━━━━━━━━━━━

**Features:**
🎯 Instabond Sniper (pump.tires)
⚡ New Pair Sniper (PulseX)
📊 Limit Orders (Buy/Sell)
💱 DEX Trading via PulseX
🛡️ Anti-Rug Protection
🔥 Auto Buy & Burn DTGC

━━━━━━━━━━━━━━━━━━━━━

**Fee Structure (1% Total):**
🔥 0.5% → Buy & Burn DTGC
💰 0.5% → Dev Wallet (PLS)

**Token Gate Required:**
Hold $50+ of DTGC
⚜️ DTGC: \`${config.tokenGate.dtgc}\`

🌐 Web UI: dtgc.io/gold

${isNew ? '⚠️ Send PLS to your wallet to start trading!' : ''}
      `;

      await this.bot.sendMessage(chatId, welcomeMsg, {
        parse_mode: 'Markdown',
        reply_markup: keyboards.mainMenuKeyboard,
      });
    });

    // Handle callback queries (button clicks)
    this.bot.on('callback_query', async (query) => {
      if (!query.message || !query.data) return;

      const chatId = query.message.chat.id.toString();
      const userId = query.from.id.toString();
      const data = query.data;

      await this.bot.answerCallbackQuery(query.id);

      // Route to handlers
      await this.handleCallback(chatId, userId, data, query.message.message_id);
    });

    // Handle text messages
    this.bot.on('message', async (msg) => {
      if (!msg.text || msg.text.startsWith('/')) return;

      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';
      const text = msg.text.trim();

      await this.handleTextInput(chatId, userId, text);
    });

    // Quick commands
    this.bot.onText(/\/buy (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';
      const tokenAddress = match?.[1];

      if (!tokenAddress) return;
      if (!await this.checkGate(chatId, userId)) return;

      await this.startBuyFlow(chatId, userId, tokenAddress);
    });

    this.bot.onText(/\/sell (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';
      const tokenAddress = match?.[1];

      if (!tokenAddress) return;
      if (!await this.checkGate(chatId, userId)) return;

      await this.startSellFlow(chatId, userId, tokenAddress);
    });

    this.bot.onText(/\/snipe (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';
      const tokenAddress = match?.[1];

      if (!tokenAddress) return;
      if (!await this.checkGate(chatId, userId)) return;

      await this.startSnipeFlow(chatId, userId, tokenAddress);
    });

    this.bot.onText(/\/check (.+)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const tokenAddress = match?.[1];

      if (!tokenAddress) return;

      await this.checkTokenSafety(chatId, tokenAddress);
    });

    this.bot.onText(/\/balance/, async (msg) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';

      await this.showBalance(chatId, userId);
    });

    // /gold command - Open web UI (mobile-friendly)
    this.bot.onText(/\/gold/, async (msg) => {
      const chatId = msg.chat.id.toString();

      await this.bot.sendMessage(chatId,
        `⚜️ **DTGC Gold Suite**\n\n` +
        `📱 **Mobile-Optimized Trading**\n\n` +
        `Tap below to open in your browser and connect your wallet:\n\n` +
        `• 🔄 Swap any PulseChain token\n` +
        `• 🎯 Snipe with limit orders\n` +
        `• 🔥 InstaBond graduation sniper\n` +
        `• 📊 Portfolio tracker\n` +
        `• 💧 Create LP positions\n\n` +
        `_Opens in mobile browser for wallet connect!_`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📱 Open Gold Suite', url: 'https://dtgc.io/gold' }
            ], [
              { text: '🔙 Main Menu', callback_data: 'main_menu' }
            ]]
          }
        }
      );
    });

    // /fees command - Show fee statistics
    this.bot.onText(/\/fees/, async (msg) => {
      const chatId = msg.chat.id.toString();
      await this.showFeeStats(chatId);
    });

    // /pnl command - Show P&L for a token
    this.bot.onText(/\/pnl(?:@\w+)?\s*(.*)/, async (msg, match) => {
      const chatId = msg.chat.id.toString();
      const userId = msg.from?.id.toString() || '';
      const input = match?.[1]?.trim();
      const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';

      if (!input) {
        const positions = positionStore.getPositions(userId);
        if (positions.length === 0) {
          await this.bot.sendMessage(chatId, '📊 No positions tracked.\n\nBuy a token first, then use `/pnl <token_address>`', { parse_mode: 'Markdown' });
          return;
        }
        // Show all positions summary
        let posMsg = '⚜️ *Your Positions*\n━━━━━━━━━━━━━━━━━━\n\n';
        for (const pos of positions) {
          posMsg += `• *${pos.tokenName}* \`...${pos.tokenAddress.slice(-4)}\`\n`;
        }
        await this.bot.sendMessage(chatId, posMsg, { parse_mode: 'Markdown' });
        return;
      }

      if (!ethers.isAddress(input)) {
        await this.bot.sendMessage(chatId, '❌ Invalid token address');
        return;
      }

      const position = positionStore.getPosition(userId, input);
      if (!position) {
        await this.bot.sendMessage(chatId, '❌ No position found. Buy this token first!');
        return;
      }

      const pnlMsg = generatePnLMessage({
        tokenName: position.tokenName,
        contractAddress: input,
        buyPrice: position.buyPrice,
        currentPrice: position.buyPrice * 1.5, // TODO: fetch real price
        amount: position.amount,
      });

      await this.bot.sendMessage(chatId, pnlMsg, { parse_mode: 'Markdown' });
    });
  }

  private async handleCallback(chatId: string, userId: string, data: string, messageId: number): Promise<void> {
    const session = this.getSession(chatId);

    // Main menu navigation
    switch (data) {
      case 'main_menu':
        await this.bot.editMessageReplyMarkup(keyboards.mainMenuKeyboard, {
          chat_id: parseInt(chatId),
          message_id: messageId,
        });
        return;

      case 'wallet_menu':
        await this.bot.editMessageReplyMarkup(keyboards.walletsMenuKeyboard, {
          chat_id: parseInt(chatId),
          message_id: messageId,
        });
        return;

      case 'snipe_menu':
        if (!await this.checkGate(chatId, userId)) return;
        await this.bot.editMessageReplyMarkup(keyboards.snipeMenuKeyboard, {
          chat_id: parseInt(chatId),
          message_id: messageId,
        });
        return;

      case 'orders_menu':
        if (!await this.checkGate(chatId, userId)) return;
        await this.bot.editMessageReplyMarkup(keyboards.ordersMenuKeyboard, {
          chat_id: parseInt(chatId),
          message_id: messageId,
        });
        return;

      case 'pump_menu':
        if (!await this.checkGate(chatId, userId)) return;
        await this.bot.editMessageReplyMarkup(keyboards.pumpMenuKeyboard, {
          chat_id: parseInt(chatId),
          message_id: messageId,
        });
        return;

      case 'settings':
        await this.bot.editMessageReplyMarkup(keyboards.settingsKeyboard, {
          chat_id: parseInt(chatId),
          message_id: messageId,
        });
        return;
    }

    // Actions
    if (data === 'action_buy') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'buy_token_address';
      await this.bot.sendMessage(chatId, '📝 Enter the token address to buy:');
      return;
    }

    if (data === 'action_sell') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'sell_token_address';
      await this.bot.sendMessage(chatId, '📝 Enter the token address to sell:');
      return;
    }

    // Refresh balance - rescan wallet and show updated DTGC balance
    if (data === 'refresh_balance') {
      await this.showRefreshedBalance(chatId, userId);
      return;
    }

    // Link external wallet - allows users to track their MetaMask/Rabby wallet
    if (data === 'link_wallet') {
      session.pendingAction = 'link_wallet_address';
      await this.bot.sendMessage(chatId,
        `🔗 **Link External Wallet**\n\n` +
        `Paste your wallet address (from MetaMask, Rabby, etc.) to track your DTGC balance and use the Gold Suite seamlessly.\n\n` +
        `📝 Enter your wallet address (0x...):`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    if (data === 'check_token') {
      session.pendingAction = 'check_token_address';
      await this.bot.sendMessage(chatId, '📝 Enter the token address to check:');
      return;
    }

    // Wallet actions
    if (data === 'wallet_balance') {
      await this.showBalance(chatId, userId);
      return;
    }

    if (data === 'wallet_address') {
      const wallet = await walletManager.getWallet(userId);
      if (wallet) {
        await this.bot.sendMessage(chatId, `📋 Your wallet address:\n\`${wallet.address}\``, {
          parse_mode: 'Markdown',
        });
      }
      return;
    }

    if (data === 'wallet_export') {
      const wallet = await walletManager.getWallet(userId);
      if (wallet) {
        const pk = await walletManager.exportPrivateKey(userId);
        await this.bot.sendMessage(chatId,
          `⚠️ **NEVER SHARE THIS!**\n\n🔑 Private Key:\n\`${pk}\`\n\n_Delete this message after saving!_`,
          { parse_mode: 'Markdown' }
        );
      }
      return;
    }

    // Generate 6 snipe wallets
    if (data === 'wallets_generate_6') {
      if (!await this.checkGate(chatId, userId)) return;
      await this.generate6Wallets(chatId, userId);
      return;
    }

    // Wallets menu
    if (data === 'wallets_menu') {
      await this.bot.editMessageReplyMarkup(keyboards.walletsMenuKeyboard, {
        chat_id: parseInt(chatId),
        message_id: messageId,
      });
      return;
    }

    // Multi-wallet snipe selection
    if (data.startsWith('snipe_wallets_')) {
      if (!await this.checkGate(chatId, userId)) return;
      const numWallets = parseInt(data.replace('snipe_wallets_', ''));
      session.pendingAction = `snipe_multi_${numWallets}`;
      await this.bot.sendMessage(chatId,
        `🎯 **Multi-Wallet Snipe Setup**\n\n` +
        `Sniping with **${numWallets} wallet${numWallets > 1 ? 's' : ''}**\n\n` +
        `Select PLS amount **per wallet**:`,
        { parse_mode: 'Markdown', reply_markup: keyboards.snipeAmountKeyboard }
      );
      return;
    }

    // Snipe actions
    if (data === 'snipe_new') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'snipe_token_address';
      await this.bot.sendMessage(chatId, '📝 Enter token address to snipe when liquidity is added:');
      return;
    }

    if (data === 'snipe_grad') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'snipe_grad_token';
      await this.bot.sendMessage(chatId, '📝 Enter pump.tires token address to snipe on graduation:');
      return;
    }

    if (data === 'pump_auto_snipe' || data === 'snipe_auto') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'auto_snipe_amount';
      await this.bot.sendMessage(chatId, '💰 Enter PLS amount to auto-snipe ALL graduating tokens:');
      return;
    }

    // Order actions
    if (data === 'order_limit_buy') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'limit_buy_token';
      await this.bot.sendMessage(chatId, '📝 Enter token address for limit buy:');
      return;
    }

    if (data === 'order_limit_sell') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'limit_sell_token';
      await this.bot.sendMessage(chatId, '📝 Enter token address for limit sell:');
      return;
    }

    if (data === 'order_stop_loss') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'stop_loss_token';
      await this.bot.sendMessage(chatId, '📝 Enter token address for stop loss:');
      return;
    }

    if (data === 'order_take_profit') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'take_profit_token';
      await this.bot.sendMessage(chatId, '📝 Enter token address for take profit:');
      return;
    }

    if (data === 'order_dca') {
      if (!await this.checkGate(chatId, userId)) return;
      session.pendingAction = 'dca_token';
      await this.bot.sendMessage(chatId, '📝 Enter token address for DCA:');
      return;
    }

    if (data === 'order_list') {
      await this.showUserOrders(chatId, userId);
      return;
    }

    // Buy amount selection
    if (data.startsWith('buy_') && !data.startsWith('buy_custom')) {
      const amount = data.replace('buy_', '');
      if (!isNaN(parseInt(amount))) {
        session.pendingAmount = amount;
        await this.executeBuy(chatId, userId);
      }
      return;
    }

    // Sell percentage
    if (data.startsWith('sell_') && !data.startsWith('sell_custom')) {
      const percent = parseInt(data.replace('sell_', ''));
      if (!isNaN(percent)) {
        await this.executeSell(chatId, userId, percent);
      }
      return;
    }

    // Help
    if (data === 'help') {
      await this.showHelp(chatId);
      return;
    }

    // Fee Stats
    if (data === 'fee_stats') {
      await this.showFeeStats(chatId);
      return;
    }
  }

  private async handleTextInput(chatId: string, userId: string, text: string): Promise<void> {
    const session = this.getSession(chatId);

    if (!session.pendingAction) return;

    // Token address inputs
    if (session.pendingAction === 'buy_token_address') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
        return;
      }
      session.pendingToken = text;
      session.pendingAction = 'buy_amount';
      await this.bot.sendMessage(chatId, '💰 Select amount to buy:', {
        reply_markup: keyboards.buyAmountKeyboard,
      });
      return;
    }

    if (session.pendingAction === 'sell_token_address') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
        return;
      }
      session.pendingToken = text;
      session.pendingAction = 'sell_percent';
      await this.bot.sendMessage(chatId, '📊 Select percentage to sell:', {
        reply_markup: keyboards.sellPercentKeyboard,
      });
      return;
    }

    if (session.pendingAction === 'check_token_address') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
        return;
      }
      session.pendingAction = undefined;
      await this.checkTokenSafety(chatId, text);
      return;
    }

    // Link external wallet
    if (session.pendingAction === 'link_wallet_address') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid wallet address. Try again:');
        return;
      }
      session.pendingAction = undefined;
      await this.linkExternalWallet(chatId, userId, text);
      return;
    }

    // Snipe inputs
    if (session.pendingAction === 'snipe_token_address') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
        return;
      }
      session.pendingToken = text;
      session.pendingAction = 'snipe_amount';
      await this.bot.sendMessage(chatId, '💰 Enter PLS amount to snipe with:');
      return;
    }

    if (session.pendingAction === 'snipe_amount') {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
        return;
      }

      await this.setupSnipe(chatId, userId, session.pendingToken!, amount);
      session.pendingAction = undefined;
      session.pendingToken = undefined;
      return;
    }

    if (session.pendingAction === 'snipe_grad_token') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
        return;
      }
      session.pendingToken = text;
      session.pendingAction = 'snipe_grad_amount';
      await this.bot.sendMessage(chatId, '💰 Enter PLS amount to buy on graduation:');
      return;
    }

    if (session.pendingAction === 'snipe_grad_amount') {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
        return;
      }

      await this.setupGraduationSnipe(chatId, userId, session.pendingToken!, amount);
      session.pendingAction = undefined;
      session.pendingToken = undefined;
      return;
    }

    if (session.pendingAction === 'auto_snipe_amount') {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
        return;
      }

      await this.enableAutoSnipe(chatId, userId, amount);
      session.pendingAction = undefined;
      return;
    }

    // Limit order inputs
    if (session.pendingAction === 'limit_buy_token') {
      if (!ethers.isAddress(text)) {
        await this.bot.sendMessage(chatId, '❌ Invalid address. Try again:');
        return;
      }
      session.pendingToken = text;
      session.pendingAction = 'limit_buy_price';
      await this.bot.sendMessage(chatId, '📊 Enter target price in PLS (buy when price drops to this):');
      return;
    }

    if (session.pendingAction === 'limit_buy_price') {
      const price = parseFloat(text);
      if (isNaN(price) || price <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid price. Try again:');
        return;
      }
      session.pendingAmount = price.toString();
      session.pendingAction = 'limit_buy_amount';
      await this.bot.sendMessage(chatId, '💰 Enter PLS amount to spend:');
      return;
    }

    if (session.pendingAction === 'limit_buy_amount') {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
        return;
      }

      await this.createLimitOrder(chatId, userId, 'limit_buy', session.pendingToken!,
        parseFloat(session.pendingAmount!), amount);
      session.pendingAction = undefined;
      session.pendingToken = undefined;
      session.pendingAmount = undefined;
      return;
    }

    // Custom buy amount
    if (session.pendingAction === 'buy_amount') {
      const amount = parseFloat(text);
      if (isNaN(amount) || amount <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid amount. Try again:');
        return;
      }
      session.pendingAmount = text;
      await this.executeBuy(chatId, userId);
      return;
    }
  }

  // ==================== TRADING FUNCTIONS ====================

  private async startBuyFlow(chatId: string, userId: string, tokenAddress: string): Promise<void> {
    const session = this.getSession(chatId);

    // Check token safety if anti-rug is enabled
    if (session.settings.antiRug) {
      const safety = await antiRug.checkToken(tokenAddress);
      if (safety.isHoneypot) {
        await this.bot.sendMessage(chatId, '🚨 **HONEYPOT DETECTED!** Cannot buy this token.', {
          parse_mode: 'Markdown',
        });
        return;
      }
      if (safety.riskLevel === 'critical') {
        await this.bot.sendMessage(chatId,
          `⚠️ **HIGH RISK TOKEN**\n${safety.warnings.join('\n')}\n\nProceed anyway?`,
          { parse_mode: 'Markdown', reply_markup: keyboards.confirmKeyboard }
        );
      }
    }

    session.pendingToken = tokenAddress;
    session.pendingAction = 'buy_amount';

    const tokenInfo = await pulsex.getTokenInfo(tokenAddress);

    await this.bot.sendMessage(chatId,
      `💰 **Buy ${tokenInfo.symbol}**\n\nSelect amount (PLS):`,
      { parse_mode: 'Markdown', reply_markup: keyboards.buyAmountKeyboard }
    );
  }

  private async executeBuy(chatId: string, userId: string): Promise<void> {
    const session = this.getSession(chatId);
    const wallet = await walletManager.getWallet(userId);

    if (!wallet || !session.pendingToken || !session.pendingAmount) {
      await this.bot.sendMessage(chatId, '❌ Missing data. Try again.');
      return;
    }

    const amountPls = ethers.parseEther(session.pendingAmount);

    await this.bot.sendMessage(chatId, '⏳ Executing buy...');

    const result = await pulsex.executeBuy(
      wallet,
      session.pendingToken,
      amountPls,
      session.settings.slippage,
      session.settings.gasLimit
    );

    if (result.success) {
      const feeMsg = result.feeCollected
        ? `\n🔥 DTGC Burned: ${result.dtgcBurned || '...'}`
        : '';

      await this.bot.sendMessage(chatId,
        `✅ **Buy Successful!**\n\n` +
        `Spent: ${result.amountIn} PLS\n` +
        `Received: ${result.amountOut} tokens${feeMsg}\n\n` +
        `🔗 [View TX](${config.explorerUrl}/tx/${result.txHash})`,
        { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
      );
    } else {
      await this.bot.sendMessage(chatId,
        `❌ **Buy Failed**\n\nError: ${result.error}`,
        { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
      );
    }

    session.pendingAction = undefined;
    session.pendingToken = undefined;
    session.pendingAmount = undefined;
  }

  private async startSellFlow(chatId: string, userId: string, tokenAddress: string): Promise<void> {
    const session = this.getSession(chatId);
    session.pendingToken = tokenAddress;
    session.pendingAction = 'sell_percent';

    const wallet = await walletManager.getWallet(userId);
    if (!wallet) return;

    const balance = await walletManager.getTokenBalance(wallet.address, tokenAddress);

    await this.bot.sendMessage(chatId,
      `💸 **Sell ${balance.symbol}**\n\n` +
      `Balance: ${balance.balanceFormatted}\n\n` +
      `Select percentage to sell:`,
      { parse_mode: 'Markdown', reply_markup: keyboards.sellPercentKeyboard }
    );
  }

  private async executeSell(chatId: string, userId: string, percent: number): Promise<void> {
    const session = this.getSession(chatId);
    const wallet = await walletManager.getWallet(userId);

    if (!wallet || !session.pendingToken) {
      await this.bot.sendMessage(chatId, '❌ Missing data. Try again.');
      return;
    }

    const balance = await walletManager.getTokenBalance(wallet.address, session.pendingToken);
    const sellAmount = (balance.balance * BigInt(percent)) / 100n;

    await this.bot.sendMessage(chatId, '⏳ Executing sell...');

    const result = await pulsex.executeSell(
      wallet,
      session.pendingToken,
      sellAmount,
      session.settings.slippage,
      session.settings.gasLimit
    );

    if (result.success) {
      const feeMsg = result.feeCollected
        ? `\n🔥 DTGC Burned: ${result.dtgcBurned || '...'}`
        : '';

      await this.bot.sendMessage(chatId,
        `✅ **Sell Successful!**\n\n` +
        `Sold: ${result.amountIn} tokens\n` +
        `Received: ${result.amountOut} PLS${feeMsg}\n\n` +
        `🔗 [View TX](${config.explorerUrl}/tx/${result.txHash})`,
        { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
      );
    } else {
      await this.bot.sendMessage(chatId,
        `❌ **Sell Failed**\n\nError: ${result.error}`,
        { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
      );
    }

    session.pendingAction = undefined;
    session.pendingToken = undefined;
  }

  // ==================== SNIPER FUNCTIONS ====================

  private async startSnipeFlow(chatId: string, userId: string, tokenAddress: string): Promise<void> {
    const session = this.getSession(chatId);
    session.pendingToken = tokenAddress;
    session.pendingAction = 'snipe_amount';

    await this.bot.sendMessage(chatId,
      `🎯 **Snipe Setup**\n\n` +
      `Token: \`${tokenAddress}\`\n\n` +
      `Enter PLS amount to snipe with:`,
      { parse_mode: 'Markdown' }
    );
  }

  private async setupSnipe(chatId: string, userId: string, tokenAddress: string, amountPls: number): Promise<void> {
    const wallet = await walletManager.getWallet(userId);
    if (!wallet) return;

    const session = this.getSession(chatId);

    // Add to mempool sniper
    mempoolSniper.addTarget({
      tokenAddress,
      amountPls: ethers.parseEther(amountPls.toString()),
      slippage: session.settings.slippage,
      maxGasPrice: ethers.parseUnits('100', 'gwei'),
      minLiquidityPls: ethers.parseEther('1000'),
      userId,
    });

    await this.bot.sendMessage(chatId,
      `✅ **Snipe Set!**\n\n` +
      `Token: \`${tokenAddress}\`\n` +
      `Amount: ${amountPls} PLS\n` +
      `Slippage: ${session.settings.slippage}%\n\n` +
      `🎯 Will auto-buy when liquidity is added!`,
      { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
    );
  }

  private async setupGraduationSnipe(chatId: string, userId: string, tokenAddress: string, amountPls: number): Promise<void> {
    const session = this.getSession(chatId);

    // Add to graduation sniper
    graduationSniper.watchToken(tokenAddress, {
      amountPls: ethers.parseEther(amountPls.toString()),
      slippage: session.settings.slippage,
      gasLimit: session.settings.gasLimit,
      gasPriceMultiplier: 1.5,
    });

    // Get current state
    const state = await graduationSniper.getTokenState(tokenAddress);

    await this.bot.sendMessage(chatId,
      `✅ **Graduation Snipe Set!**\n\n` +
      (state ? graduationSniper.formatTokenState(state) + '\n\n' : '') +
      `Amount: ${amountPls} PLS\n` +
      `Slippage: ${session.settings.slippage}%\n\n` +
      `🎓 Will auto-buy on PulseX graduation!`,
      { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
    );
  }

  private async enableAutoSnipe(chatId: string, userId: string, amountPls: number): Promise<void> {
    const session = this.getSession(chatId);

    await graduationSniper.enableAutoSnipe({
      amountPls: ethers.parseEther(amountPls.toString()),
      slippage: session.settings.slippage,
      gasLimit: session.settings.gasLimit,
      gasPriceMultiplier: 1.5,
    });

    await this.bot.sendMessage(chatId,
      `🤖 **Auto-Snipe ENABLED!**\n\n` +
      `Amount per snipe: ${amountPls} PLS\n` +
      `Slippage: ${session.settings.slippage}%\n\n` +
      `⚠️ Will auto-buy ALL graduating tokens!\n` +
      `Use with caution!`,
      { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
    );
  }

  // ==================== ORDER FUNCTIONS ====================

  private async createLimitOrder(
    chatId: string,
    userId: string,
    orderType: 'limit_buy' | 'limit_sell' | 'stop_loss' | 'take_profit',
    tokenAddress: string,
    targetPrice: number,
    amount: number
  ): Promise<void> {
    const wallet = await walletManager.getWallet(userId);
    if (!wallet) return;

    const session = this.getSession(chatId);

    const order = await limitOrderEngine.createOrder({
      userId,
      walletAddress: wallet.address,
      tokenAddress,
      orderType,
      targetPrice: ethers.parseEther(targetPrice.toString()),
      amount: ethers.parseEther(amount.toString()),
      slippage: session.settings.slippage,
    });

    await this.bot.sendMessage(chatId,
      `✅ **${orderType.replace('_', ' ').toUpperCase()} Created!**\n\n` +
      `Order ID: \`${order.id}\`\n` +
      `Token: \`${tokenAddress}\`\n` +
      `Target: ${targetPrice} PLS\n` +
      `Amount: ${amount} PLS\n\n` +
      `Will execute when price is reached!`,
      { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
    );
  }

  private async showUserOrders(chatId: string, userId: string): Promise<void> {
    const orders = limitOrderEngine.getUserOrders(userId);
    const dcaOrders = limitOrderEngine.getUserDCAOrders(userId);

    if (orders.length === 0 && dcaOrders.length === 0) {
      await this.bot.sendMessage(chatId, '📋 No active orders.', {
        reply_markup: keyboards.ordersMenuKeyboard,
      });
      return;
    }

    let msg = '📋 **Your Orders**\n\n';

    for (const order of orders.slice(0, 10)) {
      msg += limitOrderEngine.formatOrder(order) + '\n\n';
    }

    if (dcaOrders.length > 0) {
      msg += '\n📊 **DCA Orders**\n';
      for (const dca of dcaOrders.slice(0, 5)) {
        msg += `${dca.id}: ${dca.completedBuys}/${dca.totalBuys} buys\n`;
      }
    }

    await this.bot.sendMessage(chatId, msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboards.ordersMenuKeyboard,
    });
  }

  // ==================== UTILITY FUNCTIONS ====================

  private async checkTokenSafety(chatId: string, tokenAddress: string): Promise<void> {
    await this.bot.sendMessage(chatId, '🔍 Analyzing token...');

    const safety = await antiRug.checkToken(tokenAddress);
    await this.bot.sendMessage(chatId, antiRug.formatSafetyCheck(safety), {
      parse_mode: 'Markdown',
      reply_markup: keyboards.tokenActionKeyboard(tokenAddress),
    });
  }

  private async showBalance(chatId: string, userId: string): Promise<void> {
    const wallet = await walletManager.getWallet(userId);
    if (!wallet) {
      await this.bot.sendMessage(chatId, '❌ No wallet found.');
      return;
    }

    const plsBalance = await walletManager.getPlsBalance(wallet.address);
    const gateCheck = await tokenGate.checkAccess(wallet.address);

    await this.bot.sendMessage(chatId,
      `👛 **Wallet Balance**\n\n` +
      `Address: \`${wallet.address}\`\n\n` +
      `💎 PLS: ${Number(plsBalance.formatted).toLocaleString()}\n\n` +
      `**Gate Status:**\n${gateCheck.message}`,
      { parse_mode: 'Markdown', reply_markup: keyboards.walletsMenuKeyboard }
    );
  }

  /**
   * Show refreshed balance for both bot wallet and linked external wallet
   */
  private async showRefreshedBalance(chatId: string, userId: string): Promise<void> {
    const session = this.getSession(chatId.toString());
    const wallet = await walletManager.getWallet(userId);

    let msg = `🔄 **Balance Refreshed**\n\n`;

    // Bot wallet balance
    if (wallet) {
      const plsBalance = await walletManager.getPlsBalance(wallet.address);
      const gateCheck = await tokenGate.checkAccess(wallet.address);
      msg += `**🤖 Bot Wallet:**\n`;
      msg += `\`${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}\`\n`;
      msg += `💎 ${Number(plsBalance.formatted).toLocaleString()} PLS\n`;
      msg += `${gateCheck.allowed ? '✅' : '❌'} Gate: ${gateCheck.allowed ? 'PASS' : 'Need $50 DTGC'}\n\n`;
    }

    // Linked external wallet balance
    if (session.linkedWallet) {
      try {
        const extPlsBalance = await walletManager.getPlsBalance(session.linkedWallet);
        const extGateCheck = await tokenGate.checkAccess(session.linkedWallet);
        const dtgcBalance = await walletManager.getTokenBalance(session.linkedWallet, config.tokenGate.dtgc);

        msg += `**🔗 Linked Wallet:**\n`;
        msg += `\`${session.linkedWallet.slice(0, 8)}...${session.linkedWallet.slice(-6)}\`\n`;
        msg += `💎 ${Number(extPlsBalance.formatted).toLocaleString()} PLS\n`;
        msg += `⚜️ ${Number(dtgcBalance.balanceFormatted).toLocaleString()} DTGC\n`;
        msg += `${extGateCheck.allowed ? '✅' : '❌'} Gate: ${extGateCheck.allowed ? 'PASS' : 'Need $50 DTGC'}\n\n`;
      } catch (err) {
        msg += `**🔗 Linked Wallet:** Error fetching\n\n`;
      }
    } else {
      msg += `💡 _Tip: Link your MetaMask/Rabby wallet for seamless tracking!_\n`;
    }

    msg += `_Last updated: ${new Date().toLocaleTimeString()}_`;

    await this.bot.sendMessage(chatId, msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboards.mainMenuKeyboard,
    });
  }

  /**
   * Link an external wallet address for balance tracking
   */
  private async linkExternalWallet(chatId: string, userId: string, address: string): Promise<void> {
    const session = this.getSession(chatId.toString());
    session.linkedWallet = address;

    try {
      const plsBalance = await walletManager.getPlsBalance(address);
      const gateCheck = await tokenGate.checkAccess(address);
      const dtgcBalance = await walletManager.getTokenBalance(address, config.tokenGate.dtgc);

      await this.bot.sendMessage(chatId,
        `✅ **Wallet Linked Successfully!**\n\n` +
        `**Address:**\n\`${address}\`\n\n` +
        `**Balances:**\n` +
        `💎 ${Number(plsBalance.formatted).toLocaleString()} PLS\n` +
        `⚜️ ${Number(dtgcBalance.balanceFormatted).toLocaleString()} DTGC\n\n` +
        `**Gate Status:**\n${gateCheck.message}\n\n` +
        `_Use 🔄 Refresh to update balances anytime!_\n` +
        `_Open Gold Suite with same wallet to trade!_`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboards.mainMenuKeyboard,
        }
      );
    } catch (err) {
      await this.bot.sendMessage(chatId,
        `✅ **Wallet Linked:** \`${address}\`\n\n` +
        `⚠️ Could not fetch balance. Will retry on refresh.`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboards.mainMenuKeyboard,
        }
      );
    }
  }

  /**
   * Generate 6 snipe wallets for multi-wallet sniping
   */
  private async generate6Wallets(chatId: string, userId: string): Promise<void> {
    await this.bot.sendMessage(chatId, '🔄 Generating 6 snipe wallets...');

    const wallets: { index: number; address: string }[] = [];

    for (let i = 1; i <= 6; i++) {
      const walletId = `${userId}_snipe_${i}`;
      const { wallet, isNew } = await walletManager.getOrCreateWallet(walletId);
      wallets.push({ index: i, address: wallet.address });
    }

    let msg = `✅ **6 Snipe Wallets Ready!**\n\n`;
    msg += `Fund these wallets with PLS to snipe:\n\n`;

    for (const w of wallets) {
      msg += `**Wallet ${w.index}:**\n\`${w.address}\`\n\n`;
    }

    msg += `💡 _Tip: Send PLS to each wallet you want to snipe with._\n`;
    msg += `_Use 🎯 Sniper to multi-wallet snipe!_`;

    await this.bot.sendMessage(chatId, msg, {
      parse_mode: 'Markdown',
      reply_markup: keyboards.multiWalletSnipeKeyboard,
    });
  }

  private async showFeeStats(chatId: string): Promise<void> {
    try {
      const stats = await feeManager.getFeeStats();

      await this.bot.sendMessage(chatId,
        `🔥 **DTGC Burn Statistics**\n\n` +
        `**Total DTGC Burned:**\n` +
        `${Number(stats.totalDtgcBurned).toLocaleString()} DTGC\n\n` +
        `**Fee Structure (1% per trade):**\n` +
        `🔥 0.5% → Buy & Burn DTGC\n` +
        `💰 0.5% → Dev Wallet (PLS)\n\n` +
        `_Every trade burns DTGC forever!_\n\n` +
        `🌐 View on PulseX Gold: dtgc.io/gold`,
        { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard }
      );
    } catch (error) {
      await this.bot.sendMessage(chatId, '❌ Could not fetch fee stats.');
    }
  }

  private async showHelp(chatId: string): Promise<void> {
    await this.bot.sendMessage(chatId, `
⚜️ **DTRADER Mandalorian Help**

**Quick Commands:**
/buy <token> - Buy a token
/sell <token> - Sell a token
/snipe <token> - Set up snipe
/check <token> - Safety check
/balance - View balance
/gold - Open web UI
/fees - View burn stats

**Features:**

🎯 **Sniping**
• Instabond - Auto-buy pump.tires graduations
• New Pair - Snipe new PulseX listings

📊 **Orders**
• Limit Buy/Sell at target price
• Stop Loss protection
• Take Profit targets
• DCA (Dollar Cost Average)

🛡️ **Safety**
• Honeypot detection
• Tax analysis
• Liquidity checks
• Anti-rug protection

🔥 **Fees (1% per trade)**
• 0.5% Buy & Burn DTGC
• 0.5% Dev Wallet (PLS)

**Token Gate:**
Hold $50+ of DTGC to trade

🌐 Web: dtgc.io/gold
    `, { parse_mode: 'Markdown', reply_markup: keyboards.mainMenuKeyboard });
  }

  // ==================== EVENT HANDLERS ====================

  private setupSniperEvents(): void {
    // Graduation sniper events
    graduationSniper.on('graduation', async (data) => {
      // Notify all users with alerts enabled
      for (const [chatId, session] of this.sessions) {
        if (session.settings.alerts) {
          await this.bot.sendMessage(chatId,
            `🎓 **Token Graduated!**\n\n` +
            `Token: \`${data.token}\`\n` +
            `Pair: \`${data.pair}\``,
            { parse_mode: 'Markdown' }
          );
        }
      }
    });

    graduationSniper.on('snipeReady', async (data) => {
      // Execute the snipe for the user
      // This would need the user's wallet - handled by the watcher
    });

    // Mempool sniper events
    mempoolSniper.on('executeSnipe', async (data) => {
      const { target, pairInfo } = data;
      const wallet = await walletManager.getWallet(target.userId);
      if (!wallet) return;

      const result = await pulsex.executeBuy(
        wallet,
        target.tokenAddress,
        target.amountPls,
        target.slippage,
        500000
      );

      // Find user's chat
      for (const [chatId, session] of this.sessions) {
        if (session.gateVerified) {
          const userWallet = await walletManager.getWallet(chatId);
          if (userWallet?.address === wallet.address) {
            if (result.success) {
              await this.bot.sendMessage(chatId,
                `🎯 **SNIPE EXECUTED!**\n\n` +
                `Token: \`${target.tokenAddress}\`\n` +
                `Spent: ${result.amountIn} PLS\n` +
                `Got: ${result.amountOut} tokens\n\n` +
                `🔗 [TX](${config.explorerUrl}/tx/${result.txHash})`,
                { parse_mode: 'Markdown' }
              );
            } else {
              await this.bot.sendMessage(chatId,
                `❌ Snipe failed: ${result.error}`
              );
            }
          }
        }
      }
    });

    mempoolSniper.on('pairCreated', async (event) => {
      for (const [chatId, session] of this.sessions) {
        if (session.settings.alerts) {
          await this.bot.sendMessage(chatId,
            `🆕 **New Pair Created!**\n\n` +
            `Token0: \`${event.token0}\`\n` +
            `Token1: \`${event.token1}\``,
            { parse_mode: 'Markdown' }
          );
        }
      }
    });
  }

  private setupOrderEvents(): void {
    limitOrderEngine.on('orderTriggered', async (data) => {
      const { order, priceData } = data;
      const wallet = await walletManager.getWallet(order.userId);
      if (!wallet) return;

      let result;
      if (order.orderType === 'limit_buy') {
        result = await pulsex.executeBuy(wallet, order.tokenAddress, order.amount, order.slippage, 500000);
      } else {
        result = await pulsex.executeSell(wallet, order.tokenAddress, order.amount, order.slippage, 500000);
      }

      if (result.success) {
        limitOrderEngine.markOrderFilled(order.id, result.txHash!);

        for (const [chatId, _] of this.sessions) {
          await this.bot.sendMessage(chatId,
            `✅ **Order Filled!**\n\n` +
            `${order.orderType.replace('_', ' ').toUpperCase()}\n` +
            `${result.amountIn} → ${result.amountOut}\n\n` +
            `🔗 [TX](${config.explorerUrl}/tx/${result.txHash})`,
            { parse_mode: 'Markdown' }
          );
        }
      } else {
        limitOrderEngine.markOrderFailed(order.id, result.error!);
      }
    });
  }

  /**
   * Start the bot
   */
  async start(): Promise<void> {
    console.log('🚀 Starting Dtrader bot...');

    // Connect snipers
    await graduationSniper.connect();
    await graduationSniper.startListening();

    await mempoolSniper.connect();
    await mempoolSniper.start();

    // Start order engine
    await limitOrderEngine.start();

    console.log('✅ Dtrader bot is running!');
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping Dtrader bot...');
    await graduationSniper.disconnect();
    await mempoolSniper.disconnect();
    limitOrderEngine.stop();
    this.bot.stopPolling();
  }
}
