#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# DTRADER SNIPER - Hetzner Deployment Script
# Run this on your Hetzner server to deploy the bot
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "   DTRADER SNIPER - Hetzner Deployment"
echo "═══════════════════════════════════════════════════════════════"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo)"
  exit 1
fi

echo -e "${YELLOW}Step 1: Installing dependencies...${NC}"
apt-get update
apt-get install -y curl git nodejs npm

# Install Node.js 20 if not present
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo -e "${GREEN}Node version: $(node -v)${NC}"
echo -e "${GREEN}NPM version: $(npm -v)${NC}"

# Create app directory
APP_DIR="/opt/dtrader"
echo -e "${YELLOW}Step 2: Setting up app directory at ${APP_DIR}...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or pull the repo
if [ -d ".git" ]; then
  echo "Updating existing repo..."
  git pull
else
  echo "Cloning repository..."
  git clone https://github.com/dump-tires/DTGC.io.git .
fi

# Navigate to dtrader
cd dtrader

echo -e "${YELLOW}Step 3: Installing npm dependencies...${NC}"
npm install

echo -e "${YELLOW}Step 4: Building TypeScript...${NC}"
npm run build

# Create .env file if not exists
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}Step 5: Creating .env file...${NC}"
  cat > .env << 'ENVEOF'
# Telegram Bot Token (get from @BotFather)
BOT_TOKEN=your_telegram_bot_token_here

# PulseChain RPC - Use localhost if running node on same server!
PULSECHAIN_RPC=http://localhost:8545
# Or use public: https://rpc.pulsechain.com

# Encryption key for wallet storage (generate a random 64-char hex)
ENCRYPTION_KEY=your_64_char_hex_key_here

# Optional: DexScreener API for price data
DEXSCREENER_API=https://api.dexscreener.com
ENVEOF
  echo -e "${YELLOW}⚠️  IMPORTANT: Edit /opt/dtrader/dtrader/.env with your actual values!${NC}"
fi

# Create systemd service
echo -e "${YELLOW}Step 6: Creating systemd service...${NC}"
cat > /etc/systemd/system/dtrader.service << 'SERVICEEOF'
[Unit]
Description=DTrader Sniper Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dtrader/dtrader
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dtrader

[Install]
WantedBy=multi-user.target
SERVICEEOF

# Reload systemd
systemctl daemon-reload

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo -e "${GREEN}   DEPLOYMENT COMPLETE!${NC}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Edit the .env file:"
echo "     nano /opt/dtrader/dtrader/.env"
echo ""
echo "  2. Start the bot:"
echo "     systemctl start dtrader"
echo ""
echo "  3. Enable auto-start on boot:"
echo "     systemctl enable dtrader"
echo ""
echo "  4. View logs:"
echo "     journalctl -u dtrader -f"
echo ""
echo "  5. Check status:"
echo "     systemctl status dtrader"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "If your PulseChain node is on this server, set:"
echo "  PULSECHAIN_RPC=http://localhost:8545"
echo "This gives you ZERO LATENCY for trades!"
echo "═══════════════════════════════════════════════════════════════"
