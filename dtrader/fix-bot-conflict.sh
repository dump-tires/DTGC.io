#!/bin/bash
# =============================================================================
# DTRADER BOT CONFLICT FIX SCRIPT
# Run this on Hetzner to resolve the "Another bot instance detected" error
# =============================================================================

echo "🔧 DTRADER Bot Conflict Fix Script"
echo "=================================="

# Step 1: Stop all PM2 processes
echo ""
echo "📍 Step 1: Stopping all PM2 processes..."
pm2 stop all 2>/dev/null
pm2 delete all 2>/dev/null
echo "   ✅ PM2 processes stopped"

# Step 2: Kill ALL node processes
echo ""
echo "📍 Step 2: Killing ALL node processes..."
pkill -9 node 2>/dev/null
pkill -9 ts-node 2>/dev/null
sleep 2
echo "   ✅ Node processes killed"

# Step 3: Verify no node processes remain
echo ""
echo "📍 Step 3: Verifying no node processes remain..."
NODE_COUNT=$(pgrep -c node 2>/dev/null || echo "0")
if [ "$NODE_COUNT" -gt "0" ]; then
    echo "   ⚠️  Found $NODE_COUNT lingering node processes, force killing..."
    pkill -9 -f node
    sleep 2
fi
echo "   ✅ All node processes cleared"

# Step 4: Delete Telegram webhook (uses curl)
echo ""
echo "📍 Step 4: Deleting Telegram webhook..."
BOT_TOKEN=${BOT_TOKEN:-"8490910976:AAGo6NrFksg0xllf2tJPGD9BQze6h8SjKG0"}
WEBHOOK_RESULT=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook")
echo "   Result: $WEBHOOK_RESULT"

# Step 5: Check current webhook status
echo ""
echo "📍 Step 5: Checking webhook status..."
WEBHOOK_INFO=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo")
echo "   $WEBHOOK_INFO"

# Step 6: Check for other dtrader directories that might be running
echo ""
echo "📍 Step 6: Checking for backup/duplicate bot directories..."
if [ -d "/root/DTGC.io/Dtrader-Backup-GateUI-Update" ]; then
    echo "   ⚠️  Found backup directory: /root/DTGC.io/Dtrader-Backup-GateUI-Update"
    echo "   This could cause conflicts if accidentally started!"
fi

# Step 7: Clear PM2 logs to start fresh
echo ""
echo "📍 Step 7: Clearing PM2 logs..."
pm2 flush 2>/dev/null
echo "   ✅ PM2 logs cleared"

# Step 8: Rebuild the bot
echo ""
echo "📍 Step 8: Rebuilding dtrader..."
cd /root/DTGC.io/dtrader
npm run build
echo "   ✅ Build complete"

# Step 9: Start the bot fresh
echo ""
echo "📍 Step 9: Starting dtrader bot fresh..."
pm2 start dist/index.js --name dtrader --cwd /root/DTGC.io/dtrader
sleep 3

# Step 10: Check status
echo ""
echo "📍 Step 10: Final Status Check..."
echo ""
pm2 list
echo ""
echo "📍 Recent logs:"
pm2 logs dtrader --lines 15 --nostream

echo ""
echo "=============================================="
echo "✅ Bot conflict fix complete!"
echo ""
echo "If you still see 'Another bot instance detected':"
echo "1. Check if bot is running on another server/machine"
echo "2. Check your local dev machine for running instances"
echo "3. The 409 error from Telegram can take a few minutes to clear"
echo ""
echo "To monitor: pm2 logs dtrader"
echo "=============================================="
