/**
 * ⚜️ DTRADER Mandalorian - Telegram Bot
 * PulseChain Sniper & Trading Bot
 *
 * Features:
 * - Token sniping (instant, limit, instabond)
 * - Multi-wallet system (6 wallets)
 * - P&L tracking & cards
 * - Token gate ($50 DTGC)
 * - 1% fees (0.5% buy & burn DTGC + 0.5% dev in PLS)
 *
 * Links back to: https://dtgc.io/pulsexgold
 */

import TelegramBot from 'node-telegram-bot-api';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

dotenv.config();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // PulseChain
  RPC_URL: 'https://rpc.pulsechain.com',
  CHAIN_ID: 369,
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',

  // PulseX Router
  ROUTER: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',

  // Token Gate
  DTGC_ADDRESS: '0xd0676b28a457371d58d47e5247b439114e40eb0f',
  DTGC_MIN_USD: 50,

  // Fees: 1% total (0.5% buy & burn DTGC + 0.5% dev in PLS)
  FEES: {
    BUY_BURN_BPS: 50,  // 0.5%
    DEV_BPS: 50,       // 0.5%
    TOTAL_BPS: 100,    // 1%
  },
  DEV_WALLET: '0xc1cd5a70815e2874d2db038f398f2d8939d8e87c',
  BURN_ADDRESS: '0x000000000000000000000000000000000000dEaD',

  // Links
  PULSEX_GOLD_URL: 'https://dtgc.io/pulsexgold',
  WEBSITE: 'https://dtgc.io',

  // Trading
  SLIPPAGE_BPS: 1000, // 10%
  DEADLINE_MINUTES: 20,
};

// Router ABI (minimal)
const ROUTER_ABI = [
  'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
  'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
];

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

// ═══════════════════════════════════════════════════════════════════════════
// BOT CLASS
// ═══════════════════════════════════════════════════════════════════════════

class DTRADERBot {
  private bot: TelegramBot;
  private provider: ethers.JsonRpcProvider;
  private userWallets: Map<string, { address: string; privateKey: string }[]> = new Map();
  private userSessions: Map<string, any> = new Map();

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN not set');

    this.bot = new TelegramBot(token, { polling: true });
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);

    this.setupHandlers();
    console.log('⚜️ DTRADER Mandalorian Bot Started!');
  }

  private setupHandlers() {
    // /start command
    this.bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendMainMenu(chatId);
    });

    // /snipe command
    this.bot.onText(/\/snipe(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString() || '';
      const tokenAddress = match?.[1]?.trim();

      if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
        await this.bot.sendMessage(chatId,
          '🎯 *Sniper*\n\n' +
          'Usage: `/snipe <token_address>`\n\n' +
          'Or use PulseX Gold for the full experience:\n' +
          `👉 ${CONFIG.PULSEX_GOLD_URL}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Check token gate
      const isUnlocked = await this.checkTokenGate(userId);
      if (!isUnlocked) {
        await this.sendTokenGateMessage(chatId);
        return;
      }

      await this.showSnipeMenu(chatId, tokenAddress);
    });

    // /buy command
    this.bot.onText(/\/buy(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const input = match?.[1]?.trim();

      if (!input) {
        await this.bot.sendMessage(chatId,
          '💰 *Quick Buy*\n\n' +
          'Usage: `/buy <token_address> <amount_pls>`\n' +
          'Example: `/buy 0x... 1000`\n\n' +
          '1% fee applies (0.5% buy & burn DTGC + 0.5% dev)',
          { parse_mode: 'Markdown' }
        );
        return;
      }

      const [tokenAddress, amountStr] = input.split(/\s+/);
      if (!ethers.isAddress(tokenAddress)) {
        await this.bot.sendMessage(chatId, '❌ Invalid token address');
        return;
      }

      const amount = parseFloat(amountStr) || 0;
      if (amount <= 0) {
        await this.bot.sendMessage(chatId, '❌ Invalid amount');
        return;
      }

      await this.executeBuy(chatId, msg.from?.id.toString() || '', tokenAddress, amount);
    });

    // /balance command
    this.bot.onText(/\/balance/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString() || '';

      const wallets = this.userWallets.get(userId) || [];
      if (wallets.length === 0) {
        await this.bot.sendMessage(chatId,
          '👛 *No Wallets*\n\n' +
          'Use `/generate` to create sniper wallets\n' +
          `Or use PulseX Gold: ${CONFIG.PULSEX_GOLD_URL}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      let msg_text = '👛 *Your Wallets*\n━━━━━━━━━━━━━━━━━\n\n';
      for (let i = 0; i < wallets.length; i++) {
        const balance = await this.provider.getBalance(wallets[i].address);
        const plsBalance = parseFloat(ethers.formatEther(balance));
        msg_text += `*Wallet ${i + 1}:* \`${wallets[i].address.slice(0, 6)}...${wallets[i].address.slice(-4)}\`\n`;
        msg_text += `   💎 ${this.formatNumber(plsBalance)} PLS\n\n`;
      }

      await this.bot.sendMessage(chatId, msg_text, { parse_mode: 'Markdown' });
    });

    // /generate command
    this.bot.onText(/\/generate/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString() || '';

      const wallets: { address: string; privateKey: string }[] = [];
      for (let i = 0; i < 6; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
          address: wallet.address,
          privateKey: wallet.privateKey,
        });
      }

      this.userWallets.set(userId, wallets);

      let msg_text = '✅ *Generated 6 Sniper Wallets*\n━━━━━━━━━━━━━━━━━━━━━\n\n';
      wallets.forEach((w, i) => {
        msg_text += `*Wallet ${i + 1}:* \`${w.address}\`\n`;
      });
      msg_text += '\n⚠️ *IMPORTANT:* Use `/export` to save your private keys!';

      await this.bot.sendMessage(chatId, msg_text, { parse_mode: 'Markdown' });
    });

    // /export command
    this.bot.onText(/\/export/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from?.id.toString() || '';

      const wallets = this.userWallets.get(userId) || [];
      if (wallets.length === 0) {
        await this.bot.sendMessage(chatId, '❌ No wallets to export. Use `/generate` first.');
        return;
      }

      // Send in private message only
      if (msg.chat.type !== 'private') {
        await this.bot.sendMessage(chatId, '⚠️ Private keys can only be exported in DM. Message me directly!');
        return;
      }

      let exportText = '🔐 *YOUR PRIVATE KEYS*\n━━━━━━━━━━━━━━━━━\n\n';
      exportText += '⚠️ *NEVER SHARE THESE!*\n\n';

      wallets.forEach((w, i) => {
        exportText += `*Wallet ${i + 1}*\n`;
        exportText += `Address: \`${w.address}\`\n`;
        exportText += `Key: \`${w.privateKey}\`\n\n`;
      });

      await this.bot.sendMessage(chatId, exportText, { parse_mode: 'Markdown' });
    });

    // /pulsexgold command - Link to web
    this.bot.onText(/\/pulsexgold|\/web|\/gold/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId,
        '⚜️ *PulseX Gold*\n\n' +
        'The ultimate PulseChain trading interface!\n\n' +
        '✨ Features:\n' +
        '• ⚡ Swap any token\n' +
        '• 🎯 Multi-wallet sniper\n' +
        '• 🔥 pump.tires bond sniper\n' +
        '• 📈 Limit orders\n' +
        '• 📊 P&L tracking\n\n' +
        `👉 *Open Now:* ${CONFIG.PULSEX_GOLD_URL}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🌐 Open PulseX Gold', url: CONFIG.PULSEX_GOLD_URL }
            ]]
          }
        }
      );
    });

    // Callback queries
    this.bot.on('callback_query', async (query) => {
      await this.handleCallback(query);
    });
  }

  private async sendMainMenu(chatId: number) {
    await this.bot.sendMessage(chatId,
      '⚜️ *DTRADER Mandalorian*\n' +
      '━━━━━━━━━━━━━━━━━━━━━\n\n' +
      'Welcome to the ultimate PulseChain trading bot!\n\n' +
      '*Commands:*\n' +
      '• `/snipe <token>` - Snipe a token\n' +
      '• `/buy <token> <amount>` - Quick buy\n' +
      '• `/balance` - View wallet balances\n' +
      '• `/generate` - Create 6 sniper wallets\n' +
      '• `/export` - Export private keys (DM only)\n' +
      '• `/pulsexgold` - Open web interface\n\n' +
      '💎 *Fee:* 1% (0.5% buy & burn DTGC + 0.5% dev)\n' +
      '🔐 *PRO Features:* Hold $50 DTGC\n\n' +
      `🌐 *Web:* ${CONFIG.PULSEX_GOLD_URL}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🎯 Snipe', callback_data: 'snipe' }, { text: '💰 Buy', callback_data: 'buy' }],
            [{ text: '👛 Balance', callback_data: 'balance' }, { text: '🌐 PulseX Gold', url: CONFIG.PULSEX_GOLD_URL }],
          ]
        }
      }
    );
  }

  private async showSnipeMenu(chatId: number, tokenAddress: string) {
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);

      await this.bot.sendMessage(chatId,
        `🎯 *Snipe Setup*\n━━━━━━━━━━━━━━━━━\n\n` +
        `*Token:* ${tokenInfo.symbol}\n` +
        `*Name:* ${tokenInfo.name}\n` +
        `*CA:* \`${tokenAddress}\`\n\n` +
        `Select snipe amount:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '100 PLS', callback_data: `snipe_${tokenAddress}_100` },
                { text: '500 PLS', callback_data: `snipe_${tokenAddress}_500` },
              ],
              [
                { text: '1000 PLS', callback_data: `snipe_${tokenAddress}_1000` },
                { text: '5000 PLS', callback_data: `snipe_${tokenAddress}_5000` },
              ],
              [
                { text: '🌐 Use PulseX Gold', url: `${CONFIG.PULSEX_GOLD_URL}?token=${tokenAddress}` }
              ],
            ]
          }
        }
      );
    } catch (e) {
      await this.bot.sendMessage(chatId, '❌ Failed to fetch token info. Check address and try again.');
    }
  }

  private async handleCallback(query: TelegramBot.CallbackQuery) {
    const chatId = query.message?.chat.id;
    const userId = query.from.id.toString();
    const data = query.data || '';

    if (!chatId) return;

    if (data.startsWith('snipe_')) {
      const parts = data.split('_');
      const tokenAddress = parts[1];
      const amount = parseInt(parts[2]) || 1000;

      await this.bot.answerCallbackQuery(query.id, { text: '🎯 Sniping...' });
      await this.executeBuy(chatId, userId, tokenAddress, amount);
    }

    if (data === 'balance') {
      await this.bot.answerCallbackQuery(query.id);
      // Trigger balance command
      this.bot.emit('text', { ...query.message, text: '/balance', from: query.from });
    }

    if (data === 'snipe') {
      await this.bot.answerCallbackQuery(query.id);
      await this.bot.sendMessage(chatId,
        '🎯 *Sniper*\n\n' +
        'Send token address to snipe:\n' +
        '`/snipe <token_address>`\n\n' +
        `Or use the full interface:\n${CONFIG.PULSEX_GOLD_URL}`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async executeBuy(chatId: number, userId: string, tokenAddress: string, amountPLS: number) {
    try {
      await this.bot.sendMessage(chatId, '⏳ Executing buy with 1% fee...');

      const wallets = this.userWallets.get(userId);
      if (!wallets || wallets.length === 0) {
        await this.bot.sendMessage(chatId,
          '❌ No wallets found!\n\n' +
          'Use `/generate` to create wallets, or\n' +
          `Use PulseX Gold: ${CONFIG.PULSEX_GOLD_URL}`,
          { parse_mode: 'Markdown' }
        );
        return;
      }

      // Use first wallet with balance
      let activeWallet: ethers.Wallet | null = null;
      for (const w of wallets) {
        const balance = await this.provider.getBalance(w.address);
        if (balance > ethers.parseEther(amountPLS.toString())) {
          activeWallet = new ethers.Wallet(w.privateKey, this.provider);
          break;
        }
      }

      if (!activeWallet) {
        await this.bot.sendMessage(chatId,
          '❌ No wallet has enough PLS!\n\n' +
          'Fund your wallets first. Use `/balance` to see addresses.'
        );
        return;
      }

      const router = new ethers.Contract(CONFIG.ROUTER, ROUTER_ABI, activeWallet);
      const amountIn = ethers.parseEther(amountPLS.toString());
      const deadline = Math.floor(Date.now() / 1000) + CONFIG.DEADLINE_MINUTES * 60;

      // Calculate fees: 0.5% buy & burn + 0.5% dev
      const totalFee = amountIn * BigInt(CONFIG.FEES.TOTAL_BPS) / 10000n;
      const buyBurnFee = totalFee / 2n;
      const devFee = totalFee - buyBurnFee;
      const swapAmount = amountIn - totalFee;

      // 1. Buy & burn DTGC (0.5%)
      await this.bot.sendMessage(chatId, '🔥 Processing 0.5% buy & burn DTGC...');
      try {
        const dtgcPath = [CONFIG.WPLS, CONFIG.DTGC_ADDRESS];
        const burnTx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
          0n, dtgcPath, CONFIG.BURN_ADDRESS, deadline, { value: buyBurnFee }
        );
        await burnTx.wait();
      } catch (e) {
        console.error('Burn failed:', e);
      }

      // 2. Send 0.5% to dev
      await this.bot.sendMessage(chatId, '💰 Sending 0.5% to dev...');
      const devTx = await activeWallet.sendTransaction({
        to: CONFIG.DEV_WALLET,
        value: devFee,
      });
      await devTx.wait();

      // 3. Execute main buy
      await this.bot.sendMessage(chatId, '⚡ Executing swap...');
      const path = [CONFIG.WPLS, tokenAddress];
      const tx = await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
        0n, path, activeWallet.address, deadline, { value: swapAmount }
      );
      await tx.wait();

      const tokenInfo = await this.getTokenInfo(tokenAddress);
      await this.bot.sendMessage(chatId,
        `✅ *Buy Successful!*\n\n` +
        `*Token:* ${tokenInfo.symbol}\n` +
        `*Amount:* ${amountPLS} PLS\n` +
        `*Fee:* ${(parseFloat(amountPLS.toString()) * 0.01).toFixed(2)} PLS\n` +
        `*Tx:* [View](https://scan.pulsechain.com/tx/${tx.hash})\n\n` +
        `Track your position on PulseX Gold:\n${CONFIG.PULSEX_GOLD_URL}`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
      );

    } catch (error: any) {
      console.error('Buy error:', error);
      await this.bot.sendMessage(chatId,
        `❌ *Buy Failed*\n\n${error.reason || error.message || 'Unknown error'}\n\n` +
        `Try using PulseX Gold instead:\n${CONFIG.PULSEX_GOLD_URL}`,
        { parse_mode: 'Markdown' }
      );
    }
  }

  private async checkTokenGate(userId: string): Promise<boolean> {
    const wallets = this.userWallets.get(userId);
    if (!wallets || wallets.length === 0) return false;

    const dtgc = new ethers.Contract(CONFIG.DTGC_ADDRESS, ERC20_ABI, this.provider);

    let totalDtgc = 0n;
    for (const w of wallets) {
      try {
        const balance = await dtgc.balanceOf(w.address);
        totalDtgc += balance;
      } catch {}
    }

    // Simple price estimation - in production, fetch from DEX
    const dtgcPrice = 0.0007; // USD per DTGC
    const dtgcValue = parseFloat(ethers.formatEther(totalDtgc)) * dtgcPrice;

    return dtgcValue >= CONFIG.DTGC_MIN_USD;
  }

  private async sendTokenGateMessage(chatId: number) {
    await this.bot.sendMessage(chatId,
      '🔒 *PRO Features Locked*\n\n' +
      `Hold $${CONFIG.DTGC_MIN_USD}+ worth of DTGC to unlock:\n` +
      '• 🎯 Instabond Sniper\n' +
      '• ⚡ New Pair Sniper\n' +
      '• 📈 Limit Orders\n' +
      '• 👛 Multi-Wallet System\n\n' +
      `*Get DTGC:* ${CONFIG.PULSEX_GOLD_URL}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '💎 Get DTGC', url: CONFIG.PULSEX_GOLD_URL }
          ]]
        }
      }
    );
  }

  private async getTokenInfo(address: string) {
    const contract = new ethers.Contract(address, ERC20_ABI, this.provider);
    const [name, symbol, decimals] = await Promise.all([
      contract.name().catch(() => 'Unknown'),
      contract.symbol().catch(() => '???'),
      contract.decimals().catch(() => 18),
    ]);
    return { name, symbol, decimals: Number(decimals) };
  }

  private formatNumber(n: number): string {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(2);
  }
}

// Start bot
new DTRADERBot();
