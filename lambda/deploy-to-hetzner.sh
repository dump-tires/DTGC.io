#!/bin/bash
# Q7 Copy Trade Executor - Hetzner Deployment Script
# Run this from your local machine with access to Hetzner

HETZNER_IP="5.78.100.228"
HETZNER_USER="root"
APP_DIR="/root/q7-copy-trade"

echo "🚀 Deploying Q7 Copy Trade Executor to Hetzner..."

# 1. Create app directory on server
ssh ${HETZNER_USER}@${HETZNER_IP} "mkdir -p ${APP_DIR}"

# 2. Copy the executor file
scp q7-copy-trade-executor.js ${HETZNER_USER}@${HETZNER_IP}:${APP_DIR}/

# 3. Create package.json on server
ssh ${HETZNER_USER}@${HETZNER_IP} "cat > ${APP_DIR}/package.json << 'EOF'
{
  \"name\": \"q7-copy-trade-executor\",
  \"version\": \"1.0.0\",
  \"description\": \"Q7 Copy Trade Bot with 5% Growth Engine Flywheel\",
  \"main\": \"q7-copy-trade-executor.js\",
  \"scripts\": {
    \"start\": \"node q7-copy-trade-executor.js\",
    \"monitor\": \"pm2 start q7-copy-trade-executor.js --name q7-copy-trade\"
  },
  \"dependencies\": {
    \"ethers\": \"^5.7.2\"
  }
}
EOF"

# 4. Create .env file
ssh ${HETZNER_USER}@${HETZNER_IP} "cat > ${APP_DIR}/.env << 'EOF'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Bot Wallet (needs ARB for gas)
BOT_PRIVATE_KEY=your_private_key_here

# Scan interval in milliseconds (30 seconds)
SCAN_INTERVAL=30000
EOF"

# 5. Install dependencies
ssh ${HETZNER_USER}@${HETZNER_IP} "cd ${APP_DIR} && npm install"

# 6. Install PM2 if not present
ssh ${HETZNER_USER}@${HETZNER_IP} "npm install -g pm2 || true"

# 7. Create the continuous runner script
ssh ${HETZNER_USER}@${HETZNER_IP} "cat > ${APP_DIR}/runner.js << 'EOF'
// Q7 Copy Trade Runner - Continuous Monitoring Service
require('dotenv').config();
const executor = require('./q7-copy-trade-executor');

const SCAN_INTERVAL = parseInt(process.env.SCAN_INTERVAL) || 30000;

console.log('🤖 Q7 COPY TRADE SERVICE STARTING...');
console.log(\`📡 Scan interval: \${SCAN_INTERVAL / 1000}s\`);

// Run immediately on start
executor.handler({}).then(result => {
  console.log('Initial scan complete');
});

// Then run on interval
setInterval(async () => {
  try {
    const result = await executor.handler({});
    const body = JSON.parse(result.body);
    if (body.data?.newTrades?.length > 0) {
      console.log(\`🔔 \${body.data.newTrades.length} new trades detected!\`);
    }
  } catch (error) {
    console.error('Scan error:', error.message);
  }
}, SCAN_INTERVAL);

// Keep process alive
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down Q7 Copy Trade Service...');
  process.exit(0);
});
EOF"

# 8. Start with PM2
ssh ${HETZNER_USER}@${HETZNER_IP} "cd ${APP_DIR} && pm2 start runner.js --name q7-copy-trade && pm2 save && pm2 startup"

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "📍 App Location: ${HETZNER_IP}:${APP_DIR}"
echo ""
echo "🔧 NEXT STEPS:"
echo "1. SSH into your server: ssh ${HETZNER_USER}@${HETZNER_IP}"
echo "2. Edit the .env file: nano ${APP_DIR}/.env"
echo "3. Add your TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID"
echo "4. Restart the service: pm2 restart q7-copy-trade"
echo ""
echo "📊 MONITORING:"
echo "   pm2 logs q7-copy-trade    # View logs"
echo "   pm2 status                # Check status"
echo "   pm2 restart q7-copy-trade # Restart"
