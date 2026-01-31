/**
 * ADD THESE TO YOUR src/bot/index.ts
 *
 * 1. Add import at top
 * 2. Add the /pnl command handler
 * 3. Add group chat support
 */

// ============================================
// 1. ADD THIS IMPORT AT THE TOP OF THE FILE
// ============================================

import {
  generatePnLMessage,
  positionStore,
  calculatePnL,
  formatNumber
} from '../utils/pnlCard';


// ============================================
// 2. ADD THESE COMMAND HANDLERS IN setupHandlers()
// ============================================

// /pnl command - Show P&L for a token
this.bot.onText(/\/pnl(?:@\w+)?\s*(.*)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id.toString() || '';
  const input = match?.[1]?.trim();

  // Check if it's a group chat - respond with username mention
  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  const userName = msg.from?.first_name || 'Trader';

  if (!input) {
    // Show all positions
    const positions = positionStore.getPositions(userId);
    if (positions.length === 0) {
      await this.bot.sendMessage(chatId,
        `${isGroup ? `@${userName} ` : ''}📊 No positions tracked.\n\nUse \`/pnl <token_address>\` after buying to track.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let msg = `⚜️ *Your Positions*\n━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const pos of positions) {
      // Get current price
      const currentPrice = await this.getCurrentPrice(pos.tokenAddress);
      const pnl = calculatePnL({
        tokenName: pos.tokenName,
        contractAddress: pos.tokenAddress,
        buyPrice: pos.buyPrice,
        currentPrice,
        amount: pos.amount,
      });

      const emoji = pnl.isProfit ? '🟢' : '🔴';
      const sign = pnl.isProfit ? '+' : '';

      msg += `${emoji} *${pos.tokenName}* \`...${pos.tokenAddress.slice(-4)}\`\n`;
      msg += `   ${sign}${pnl.pnlPercent.toFixed(1)}% (${sign}${formatNumber(pnl.pnlAmount)} PLS)\n\n`;
    }

    msg += `\n_Use /pnl <address> for detailed card_`;

    await this.bot.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
    return;
  }

  // Check if input is a token address
  if (!ethers.isAddress(input)) {
    await this.bot.sendMessage(chatId, '❌ Invalid token address.');
    return;
  }

  await this.bot.sendMessage(chatId, '📊 Generating P&L card...');

  try {
    // Get position or fetch current data
    let position = positionStore.getPosition(userId, input);
    const currentPrice = await this.getCurrentPrice(input);

    if (!position) {
      // Get token info
      const tokenInfo = await pulsex.getTokenInfo(input);

      // No tracked position - show current price only
      await this.bot.sendMessage(chatId,
        `⚜️ *${tokenInfo.symbol}*\n` +
        `\`${input}\`\n\n` +
        `💰 Current Price: \`${currentPrice.toExponential(4)} PLS\`\n\n` +
        `_No buy position tracked. Buy first to track P&L._`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Generate P&L message
    const pnlMessage = generatePnLMessage({
      tokenName: position.tokenName,
      contractAddress: input,
      buyPrice: position.buyPrice,
      currentPrice,
      amount: position.amount,
    });

    // Create inline keyboard for sharing
    const shareKeyboard = {
      inline_keyboard: [
        [
          { text: '🔄 Refresh', callback_data: `pnl_refresh_${input}` },
          { text: '📤 Share', switch_inline_query: pnlMessage.replace(/[*_`]/g, '') },
        ],
        [
          { text: '💰 Buy More', callback_data: `buy_${input}` },
          { text: '💸 Sell', callback_data: `sell_${input}` },
        ],
        [
          { text: '🔙 Menu', callback_data: 'main_menu' },
        ],
      ],
    };

    await this.bot.sendMessage(chatId, pnlMessage, {
      parse_mode: 'Markdown',
      reply_markup: shareKeyboard,
    });

  } catch (error) {
    console.error('P&L error:', error);
    await this.bot.sendMessage(chatId, '❌ Failed to generate P&L. Token may not have liquidity.');
  }
});


// /share command - Share a P&L card to the group
this.bot.onText(/\/share(?:@\w+)?\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id.toString() || '';
  const tokenAddress = match?.[1]?.trim();

  if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
    await this.bot.sendMessage(chatId, '❌ Usage: `/share <token_address>`', { parse_mode: 'Markdown' });
    return;
  }

  const position = positionStore.getPosition(userId, tokenAddress);
  if (!position) {
    await this.bot.sendMessage(chatId, '❌ No position found for this token.');
    return;
  }

  const currentPrice = await this.getCurrentPrice(tokenAddress);
  const pnlMessage = generatePnLMessage({
    tokenName: position.tokenName,
    contractAddress: tokenAddress,
    buyPrice: position.buyPrice,
    currentPrice,
    amount: position.amount,
  });

  // Send as a shareable message
  const userName = msg.from?.first_name || 'A trader';
  await this.bot.sendMessage(chatId,
    `📢 *${userName} shared their position:*\n\n${pnlMessage}`,
    { parse_mode: 'Markdown' }
  );
});


// ============================================
// 3. ADD THIS HELPER METHOD TO THE CLASS
// ============================================

/**
 * Get current token price in PLS
 */
private async getCurrentPrice(tokenAddress: string): Promise<number> {
  try {
    const quote = await pulsex.getQuoteSell(tokenAddress, ethers.parseUnits('1', 18), 0);
    return parseFloat(ethers.formatEther(quote.amountOut));
  } catch {
    return 0;
  }
}


// ============================================
// 4. ADD THIS TO TRACK POSITIONS AFTER BUYS
//    (In the executeBuy function, after success)
// ============================================

// After successful buy, track the position:
if (result.success) {
  // ... existing success message code ...

  // Track position for P&L
  const tokenInfo = await pulsex.getTokenInfo(session.pendingToken);
  positionStore.addPosition(userId, {
    tokenAddress: session.pendingToken,
    tokenName: tokenInfo.symbol,
    buyPrice: parseFloat(result.amountIn) / parseFloat(result.amountOut),
    amount: parseFloat(result.amountOut),
    timestamp: Date.now(),
  });
}


// ============================================
// 5. ADD GROUP CHAT DETECTION TO MAIN HANDLERS
// ============================================

// In handleCallback, add this at the start:
const isGroup = query.message.chat.type === 'group' || query.message.chat.type === 'supergroup';

// When sending messages in groups, optionally mention the user:
// `${isGroup ? `@${query.from.first_name} ` : ''}Your message here`


// ============================================
// 6. ADD P&L REFRESH HANDLER IN handleCallback
// ============================================

// Add this case in handleCallback:
if (data.startsWith('pnl_refresh_')) {
  const tokenAddress = data.replace('pnl_refresh_', '');
  const position = positionStore.getPosition(userId, tokenAddress);

  if (position) {
    const currentPrice = await this.getCurrentPrice(tokenAddress);
    const pnlMessage = generatePnLMessage({
      tokenName: position.tokenName,
      contractAddress: tokenAddress,
      buyPrice: position.buyPrice,
      currentPrice,
      amount: position.amount,
    });

    await this.bot.editMessageText(pnlMessage, {
      chat_id: parseInt(chatId),
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh', callback_data: `pnl_refresh_${tokenAddress}` },
            { text: '📤 Share', switch_inline_query: pnlMessage.replace(/[*_`]/g, '') },
          ],
          [
            { text: '💰 Buy More', callback_data: `buy_${tokenAddress}` },
            { text: '💸 Sell', callback_data: `sell_${tokenAddress}` },
          ],
          [
            { text: '🔙 Menu', callback_data: 'main_menu' },
          ],
        ],
      },
    });
  }
  return;
}
