/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚜️ DTRADER MANDALORIAN - PulseChain Sniper Bot
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Powered by DTGC.io | Congruent with DTGC Gold
 *
 * Features:
 * - 🎯 Token Sniping (new launches)
 * - 🔥 InstaBondSnipe (pump.tires)
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
🚀 *GET STARTED:*
1️⃣ Connect wallet → ${config.LINKS.GOLD}
2️⃣ Buy $50 in DTGC
3️⃣ Create up to 6 sniper wallets
4️⃣ Start sniping! 🎯

━━━━━━━━━━━━━━━━━━━━━━━
🎯 *Features:*
• Token Sniper (new launches)
• InstaBondSnipe (pump.tires)
• Limit Orders & DCA
• 6 Multi-Wallet Support

💰 *Fees:* 1% total
• 0.5% Buy & Burn DTGC 🔥
• 0.5% Dev Wallet (PLS)

━━━━━━━━━━━━━━━━━━━━━━━
🌐 *Open Sniper Interface:*
${config.LINKS.GOLD}
━━━━━━━━━━━━━━━━━━━━━━━
`;

// ═══════════════════════════════════════════════════════════════════════════
// KEYBOARDS
// ═══════════════════════════════════════════════════════════════════════════

const mainKeyboard = {
  inline_keyboard: [
    [
      { text: '🎯 OPEN SNIPER', url: config.LINKS.GOLD },
    ],
    [
      { text: '⚡ Swap', callback_data: 'swap' },
      { text: '🔥 InstaBondSnipe', callback_data: 'bonds' },
    ],
    [
      { text: '📈 Limit Orders', callback_data: 'orders' },
      { text: '👛 Portfolio', callback_data: 'portfolio' },
    ],
    [
      { text: '💰 Buy $50 DTGC', url: `${config.LINKS.DEXSCREENER}/${config.DTGC_ADDRESS}` },
    ],
    [
      { text: 'ℹ️ How It Works', callback_data: 'howto' },
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

// /sniper - Direct to sniper
bot.onText(/\/sniper/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `🎯 *SNIPER INTERFACE*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ Connect wallet to:\n${config.LINKS.GOLD}\n\n` +
    `2️⃣ Buy $50 in DTGC to unlock\n\n` +
    `3️⃣ Create up to 6 wallets\n\n` +
    `4️⃣ Start sniping tokens!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `_Features: Sniper • Limit Orders • InstaBondSnipe_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🎯 OPEN SNIPER NOW', url: config.LINKS.GOLD }],
          [{ text: '⬅️ Back', callback_data: 'menu' }],
        ],
      },
    }
  );
});

// /gold - Direct link to web app
bot.onText(/\/gold/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId,
    `🌐 *DTGC Gold Interface*\n\n` +
    `Open the full trading suite:\n${config.LINKS.GOLD}\n\n` +
    `_Connect wallet • Buy $50 DTGC • Start trading!_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🌐 Open DTGC Gold', url: config.LINKS.GOLD }],
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
    `🔐 *Token Gate:* Hold $50+ to unlock:\n` +
    `• 6 Sniper Wallets\n` +
    `• Limit Orders\n` +
    `• InstaBondSnipe\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Buy DTGC', url: `${config.LINKS.DEXSCREENER}/${config.DTGC_ADDRESS}` }],
          [{ text: '🔍 PulseScan', url: `${config.LINKS.PULSESCAN}/token/${config.DTGC_ADDRESS}` }],
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
    `/sniper - Open sniper interface\n` +
    `/gold - DTGC Gold web app\n` +
    `/dtgc - Token info\n` +
    `/fees - Fee structure\n` +
    `/help - This message\n\n` +
    `🌐 *Full Interface:*\n` +
    `${config.LINKS.GOLD}`,
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

      case 'howto':
        await bot.editMessageText(
          `ℹ️ *HOW TO USE DTRADER*\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*Step 1:* Connect Wallet\n` +
          `Go to ${config.LINKS.GOLD}\n\n` +
          `*Step 2:* Buy $50 DTGC\n` +
          `This unlocks all PRO features\n\n` +
          `*Step 3:* Create Wallets\n` +
          `Set up to 6 sniper wallets\n\n` +
          `*Step 4:* Start Trading!\n` +
          `• 🎯 Sniper - new token launches\n` +
          `• 📈 Limit Orders - set targets\n` +
          `• 🔥 InstaBondSnipe - pump.tires\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🚀 GET STARTED', url: config.LINKS.GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'swap':
        await bot.editMessageText(
          `⚡ *Token Swap*\n\n` +
          `Swap any PulseChain token!\n\n` +
          `🌐 Connect wallet & swap at:\n` +
          `${config.LINKS.GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '⚡ Open Swap', url: config.LINKS.GOLD }],
                [{ text: '⬅️ Back', callback_data: 'menu' }],
              ],
            },
          }
        );
        break;

      case 'bonds':
        await bot.editMessageText(
          `🔥 *InstaBondSnipe*\n\n` +
          `Snipe pump.tires tokens at graduation!\n\n` +
          `📊 800M tokens = Graduation\n` +
          `💎 Auto-LP created → You snipe first!\n\n` +
          `*How to use:*\n` +
          `1️⃣ Connect wallet → ${config.LINKS.GOLD}\n` +
          `2️⃣ Hold $50 DTGC\n` +
          `3️⃣ Enable InstaBondSnipe\n` +
          `4️⃣ Auto-snipe at graduation! 🚀`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔥 Open InstaBondSnipe', url: config.LINKS.GOLD }],
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
          `*Requires:* $50 DTGC\n\n` +
          `🌐 Set orders at:\n` +
          `${config.LINKS.GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '📈 Open Limit Orders', url: config.LINKS.GOLD }],
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
          `🌐 Scan wallet at:\n` +
          `${config.LINKS.GOLD}`,
          {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '👛 Open Portfolio', url: config.LINKS.GOLD }],
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
console.log(`🌐 Web: ${config.LINKS.GOLD}`);
