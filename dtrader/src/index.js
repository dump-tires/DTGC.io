/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚜️ DTRADER MANDALORIAN - PulseChain Sniper Bot
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Powered by DTGC.io | Congruent with PulseXGold
 *
 * Features:
 * - 🎯 Token Sniping (new launches)
 * - 🔥 pump.tires Bond Tracking
 * - 📈 Limit Orders
 * - 💼 Multi-Wallet Support (6 wallets)
 * - 🔐 $50 DTGC Token Gate for PRO
 *
 * Fee Structure:
 * - 0.5% Buy & Burn DTGC
 * - 0.5% Dev Wallet (PLS)
 *
 * @version 1.0.0
 */

const TelegramBot = require('node-telegram-bot-api');
const { ethers } = require('ethers');
const config = require('./config');

// Initialize provider
const provider = new ethers.JsonRpcProvider(config.RPC_URL);

// Initialize bot
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });

console.log('⚜️ DTRADER Mandalorian starting...');

// ═══════════════════════════════════════════════════════════════════════════
// WELCOME MESSAGE
// ═══════════════════════════════════════════════════════════════════════════

const WELCOME_MESSAGE = `
⚜️ *DTRADER MANDALORIAN* ⚜️
_PulseChain's Premier Sniper Bot_

━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Features:*
• Token Sniping (new launches)
• pump.tires Bond Tracking
• Limit Orders & DCA
• Multi-Wallet Support (6 wallets)
• Portfolio Scanner

💰 *Fee Structure:*
• 0.5% Buy & Burn DTGC 🔥
• 0.5% Dev Wallet (PLS)
• 1% Total per trade

🔐 *PRO Access:*
Hold $50+ DTGC to unlock all features

━━━━━━━━━━━━━━━━━━━━━━━
🌐 *Web Interface:*
[PulseX Gold](${config.LINKS.PULSEX_GOLD})

📊 *DTGC Token:*
\`0xD0676B28a457371D58d47E5247b439114e40Eb0F\`
━━━━━━━━━━━━━━━━━━━━━━━
`;

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════════

const mainKeyboard = {
  inline_keyboard: [
    [
      { text: '⚡ Swap', callback_data: 'swap' },
      { text: '🎯 Sniper', callback_data: 'sniper' },
    ],
    [
      { text: '🔥 Bonds', callback_data: 'bonds' },
      { text: '📈 Orders', callback_data: 'orders' },
    ],
    [
      { text: '👛 Portfolio', callback_data: 'portfolio' },
      { text: '⚙️ Settings', callback_data: 'settings' },
    ],
    [
      { text: '🌐 PulseX Gold Web App', url: config.LINKS.PULSEX_GOLD },
    ],
    [
      { text: '📊 Buy DTGC', url: `${config.LINKS.DEXSCREENER}/${config.DTGC_ADDRESS}` },
    ],
  ],
};

const backKeyboard = {
  inline_keyboard: [
    [{ text: '⬅️ Back to Menu', callback_data: 'menu' }],
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// COMMANDS
// ═══════════════════════════════════════════════════════════════════════════

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, WELCOME_MESSAGE, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard,
    disable_web_page_preview: true,
  });
});

// /pulsexgold - Direct link to web app
bot.onText(/\/pulsexgold/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `🌐 *PulseX Gold Web Interface*\n\n` +
    `Access the full trading suite at:\n${config.LINKS.PULSEX_GOLD}\n\n` +
    `_Same features, beautiful web UI!_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Open PulseX Gold', url: config.LINKS.PULSEX_GOLD }],
          [{ text: '⬅️ Back', callback_data: 'menu' }],
        ],
      },
    }
  );
});

// /fees - Show fee structure
bot.onText(/\/fees/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `💰 *DTRADER Fee Structure*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 *0.5%* - Buy & Burn DTGC\n` +
    `💎 *0.5%* - Dev Wallet (PLS)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Total: 1% per trade*\n\n` +
    `_Every trade burns DTGC, reducing supply!_`,
    {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard,
    }
  );
});

// /dtgc - DTGC token info
bot.onText(/\/dtgc/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `⚜️ *DTGC - DT Gold Coin*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📍 *Contract:*\n` +
    `\`0xD0676B28a457371D58d47E5247b439114e40Eb0F\`\n\n` +
    `🔗 *Chain:* PulseChain (369)\n` +
    `💎 *Decimals:* 18\n\n` +
    `🔐 *Token Gate:* Hold $50+ for PRO\n` +
    `🔥 *Deflationary:* 0.5% of all trades burned\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📊 View on DexScreener', url: `${config.LINKS.DEXSCREENER}/${config.DTGC_ADDRESS}` }],
          [{ text: '🔍 View on PulseScan', url: `${config.LINKS.PULSESCAN}/token/${config.DTGC_ADDRESS}` }],
          [{ text: '⬅️ Back', callback_data: 'menu' }],
        ],
      },
    }
  );
});

// /bonds - pump.tires bonds
bot.onText(/\/bonds/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `🔥 *pump.tires Bond Tracker*\n\n` +
    `Track tokens approaching graduation!\n\n` +
    `📊 *Graduation:* 800M tokens sold\n` +
    `💎 *Auto-LP:* Created at graduation\n\n` +
    `_Use PulseX Gold for real-time tracking:_\n` +
    `${config.LINKS.PULSEX_GOLD}`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 View Bonds on Web', url: config.LINKS.PULSEX_GOLD }],
          [{ text: '🌐 pump.tires', url: config.LINKS.PUMP_TIRES }],
          [{ text: '⬅️ Back', callback_data: 'menu' }],
        ],
      },
    }
  );
});

// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `📖 *DTRADER Commands*\n\n` +
    `/start - Main menu\n` +
    `/pulsexgold - Web interface\n` +
    `/dtgc - DTGC token info\n` +
    `/fees - Fee structure\n` +
    `/bonds - pump.tires tracker\n` +
    `/help - This message\n\n` +
    `🌐 *Full Features:*\n` +
    `${config.LINKS.PULSEX_GOLD}`,
    {
      parse_mode: 'Markdown',
      reply_markup: backKeyboard,
    }
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// CALLBACK HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  try {
    switch (data) {
      case 'menu':
        await bot.editMessageText(WELCOME_MESSAGE, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'Markdown',
          reply_markup: mainKeyboard,
          disable_web_page_preview: true,
        });
        break;

      case 'swap':
        await bot.editMessageText(
          `⚡ *Token Swap*\n\n` +
          `Swap any PulseChain token with best routing!\n\n` +
          `🌐 _Use PulseX Gold for the full swap interface:_\n` +
          `${config.LINKS.PULSEX_GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚡ Open Swap', url: config.LINKS.PULSEX_GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'sniper':
        await bot.editMessageText(
          `🎯 *Token Sniper*\n\n` +
          `Snipe new token launches instantly!\n\n` +
          `✅ Multi-wallet support (6 wallets)\n` +
          `✅ Custom gas & slippage\n` +
          `✅ Anti-rug protection\n\n` +
          `🌐 _Configure sniping on PulseX Gold:_\n` +
          `${config.LINKS.PULSEX_GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🎯 Open Sniper', url: config.LINKS.PULSEX_GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'bonds':
        await bot.editMessageText(
          `🔥 *pump.tires Bonds*\n\n` +
          `Track tokens approaching graduation!\n\n` +
          `📊 800M tokens = Graduation\n` +
          `💎 Auto-LP creation at graduation\n\n` +
          `🌐 _Real-time tracking on PulseX Gold:_\n` +
          `${config.LINKS.PULSEX_GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔥 View Bonds', url: config.LINKS.PULSEX_GOLD }],
                [{ text: '🌐 pump.tires', url: config.LINKS.PUMP_TIRES }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'orders':
        await bot.editMessageText(
          `📈 *Limit Orders*\n\n` +
          `Set buy/sell orders at target prices!\n\n` +
          `✅ Limit Buy Orders\n` +
          `✅ Limit Sell Orders\n` +
          `✅ DCA Automation\n\n` +
          `🌐 _Set orders on PulseX Gold:_\n` +
          `${config.LINKS.PULSEX_GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📈 Open Orders', url: config.LINKS.PULSEX_GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'portfolio':
        await bot.editMessageText(
          `👛 *Portfolio Scanner*\n\n` +
          `View all your PulseChain holdings!\n\n` +
          `✅ Token balances\n` +
          `✅ USD values\n` +
          `✅ P&L tracking\n\n` +
          `🌐 _Full scanner on PulseX Gold:_\n` +
          `${config.LINKS.PULSEX_GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '👛 Open Portfolio', url: config.LINKS.PULSEX_GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'settings':
        await bot.editMessageText(
          `⚙️ *Settings*\n\n` +
          `Configure your trading preferences:\n\n` +
          `• Slippage: 3% default\n` +
          `• Gas: Auto\n` +
          `• Token Gate: $50 DTGC\n\n` +
          `🌐 _Full settings on PulseX Gold:_\n` +
          `${config.LINKS.PULSEX_GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚙️ Open Settings', url: config.LINKS.PULSEX_GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;
    }

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Callback error:', error);
    await bot.answerCallbackQuery(query.id, { text: 'Error occurred' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

console.log('⚜️ DTRADER Mandalorian is running!');
console.log(`🌐 Web: ${config.LINKS.PULSEX_GOLD}`);
