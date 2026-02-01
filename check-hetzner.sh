#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# HETZNER STATUS CHECK - Run this first to see what's on your server
# ═══════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════"
echo "   HETZNER SERVER STATUS CHECK"
echo "═══════════════════════════════════════════════════════════════"

echo ""
echo "📊 SYSTEM INFO:"
echo "───────────────────────────────────────────────────────────────"
uname -a
echo ""

echo "💾 MEMORY:"
echo "───────────────────────────────────────────────────────────────"
free -h
echo ""

echo "💿 DISK SPACE:"
echo "───────────────────────────────────────────────────────────────"
df -h | grep -E '^/dev|Filesystem'
echo ""

echo "🔧 CPU:"
echo "───────────────────────────────────────────────────────────────"
lscpu | grep -E 'Model name|CPU\(s\)|Thread|Core'
echo ""

echo "🐳 DOCKER CONTAINERS:"
echo "───────────────────────────────────────────────────────────────"
if command -v docker &> /dev/null; then
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "Docker not running"
else
  echo "Docker not installed"
fi
echo ""

echo "⛓️  PULSECHAIN NODE CHECK:"
echo "───────────────────────────────────────────────────────────────"
# Check common ports
if nc -z localhost 8545 2>/dev/null; then
  echo "✅ Port 8545 (HTTP RPC) - OPEN"
  # Try to get sync status
  curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' \
    http://localhost:8545 2>/dev/null | head -c 200
  echo ""
else
  echo "❌ Port 8545 (HTTP RPC) - CLOSED"
fi

if nc -z localhost 8546 2>/dev/null; then
  echo "✅ Port 8546 (WebSocket) - OPEN"
else
  echo "❌ Port 8546 (WebSocket) - CLOSED"
fi

if nc -z localhost 30303 2>/dev/null; then
  echo "✅ Port 30303 (P2P) - OPEN"
else
  echo "❌ Port 30303 (P2P) - CLOSED"
fi
echo ""

echo "🖥️  RUNNING SERVICES:"
echo "───────────────────────────────────────────────────────────────"
systemctl list-units --type=service --state=running | grep -E 'geth|pulse|erigon|lighthouse|prysm|docker|node' || echo "No blockchain services detected"
echo ""

echo "📁 COMMON DIRECTORIES:"
echo "───────────────────────────────────────────────────────────────"
ls -la /opt/ 2>/dev/null | head -10 || echo "/opt not found"
echo ""
ls -la ~/pulse* 2>/dev/null || echo "No ~/pulse* directories"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "   STATUS CHECK COMPLETE"
echo "═══════════════════════════════════════════════════════════════"
