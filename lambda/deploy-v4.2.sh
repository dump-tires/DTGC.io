#!/bin/bash
# Q7 Lambda v4.2 + Copy Trade Server v2.2 Deployment
# ════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🚀 Q7 DEPLOYMENT SCRIPT"
echo "═══════════════════════════════════════════════════════════════"

# ════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ════════════════════════════════════════════════════════════════════════
HETZNER_IP="${HETZNER_IP:-65.109.68.172}"
HETZNER_USER="${HETZNER_USER:-root}"
AWS_LAMBDA_NAME="${AWS_LAMBDA_NAME:-q7-autotrade}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# ════════════════════════════════════════════════════════════════════════
# 1. DEPLOY Q7 LAMBDA v4.2 TO AWS
# ════════════════════════════════════════════════════════════════════════
deploy_lambda() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "📦 DEPLOYING Q7 LAMBDA v4.2 TO AWS"
    echo "════════════════════════════════════════════════════════════════"

    # Create deployment package
    LAMBDA_DIR="$(dirname "$0")"
    cd "$LAMBDA_DIR"

    # Create temp directory for deployment
    rm -rf /tmp/lambda-deploy
    mkdir -p /tmp/lambda-deploy

    # Copy Lambda code
    cp q7-autotrade-v4.2.js /tmp/lambda-deploy/index.js

    # Create package.json
    cat > /tmp/lambda-deploy/package.json << 'EOF'
{
  "name": "q7-autotrade",
  "version": "4.2.0",
  "main": "index.js",
  "dependencies": {
    "ethers": "^6.8.0"
  }
}
EOF

    # Install dependencies
    cd /tmp/lambda-deploy
    npm install --production

    # Create zip
    zip -r lambda-v4.2.zip .

    # Deploy to AWS
    echo "📤 Uploading to AWS Lambda: $AWS_LAMBDA_NAME"
    aws lambda update-function-code \
        --function-name "$AWS_LAMBDA_NAME" \
        --zip-file fileb://lambda-v4.2.zip \
        --region "$AWS_REGION"

    echo "✅ Lambda v4.2 deployed successfully!"

    # Create EventBridge rule for MANAGE_PORTFOLIO if it doesn't exist
    echo ""
    echo "📅 Creating MANAGE_PORTFOLIO EventBridge trigger (every 5 minutes)..."

    aws events put-rule \
        --name "q7-manage-portfolio" \
        --schedule-expression "rate(5 minutes)" \
        --region "$AWS_REGION" 2>/dev/null || true

    aws events put-targets \
        --rule "q7-manage-portfolio" \
        --targets "Id"="1","Arn"="arn:aws:lambda:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):function:${AWS_LAMBDA_NAME}","Input"='{"action":"MANAGE_PORTFOLIO"}' \
        --region "$AWS_REGION" 2>/dev/null || true

    echo "✅ EventBridge trigger configured!"
}

# ════════════════════════════════════════════════════════════════════════
# 2. DEPLOY COPY TRADE SERVER v2.2 TO HETZNER
# ════════════════════════════════════════════════════════════════════════
deploy_hetzner() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "🖥️  DEPLOYING COPY TRADE SERVER v2.2 TO HETZNER"
    echo "════════════════════════════════════════════════════════════════"

    LAMBDA_DIR="$(dirname "$0")"
    APP_DIR="/root/q7-copy-trade"

    echo "📡 Connecting to Hetzner: $HETZNER_IP"

    # Create/update directory
    ssh ${HETZNER_USER}@${HETZNER_IP} "mkdir -p ${APP_DIR}"

    # Copy server file
    echo "📤 Uploading q7-copy-trade-server.js..."
    scp "$LAMBDA_DIR/q7-copy-trade-server.js" ${HETZNER_USER}@${HETZNER_IP}:${APP_DIR}/

    # Update package.json
    ssh ${HETZNER_USER}@${HETZNER_IP} "cat > ${APP_DIR}/package.json << 'EOF'
{
  \"name\": \"q7-copy-trade-server\",
  \"version\": \"2.2.0\",
  \"description\": \"Q7 Copy Trade Server with Smart Filtering\",
  \"main\": \"q7-copy-trade-server.js\",
  \"scripts\": {
    \"start\": \"node q7-copy-trade-server.js\"
  },
  \"dependencies\": {
    \"express\": \"^4.18.2\",
    \"cors\": \"^2.8.5\",
    \"ethers\": \"^5.7.2\"
  }
}
EOF"

    # Install dependencies
    echo "📦 Installing dependencies..."
    ssh ${HETZNER_USER}@${HETZNER_IP} "cd ${APP_DIR} && npm install"

    # Restart with PM2
    echo "🔄 Restarting service with PM2..."
    ssh ${HETZNER_USER}@${HETZNER_IP} "cd ${APP_DIR} && (pm2 delete q7-copy-server 2>/dev/null || true) && pm2 start q7-copy-trade-server.js --name q7-copy-server && pm2 save"

    echo "✅ Copy Trade Server v2.2 deployed!"
    echo ""
    echo "📊 Check status:"
    echo "   ssh root@${HETZNER_IP} 'pm2 logs q7-copy-server'"
    echo "   curl http://${HETZNER_IP}:3001/health"
}

# ════════════════════════════════════════════════════════════════════════
# 3. TEST CLUSTER GUARD (DRY RUN)
# ════════════════════════════════════════════════════════════════════════
test_cluster_guard() {
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "🧪 TESTING CLUSTER GUARD (DRY RUN)"
    echo "════════════════════════════════════════════════════════════════"

    # Invoke Lambda with dry run
    aws lambda invoke \
        --function-name "$AWS_LAMBDA_NAME" \
        --payload '{"action":"MANAGE_PORTFOLIO","dryRun":true}' \
        --region "$AWS_REGION" \
        /tmp/cluster-guard-test.json

    echo "📋 Test Result:"
    cat /tmp/cluster-guard-test.json | jq .
}

# ════════════════════════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════════════════════════
case "${1:-all}" in
    lambda)
        deploy_lambda
        ;;
    hetzner)
        deploy_hetzner
        ;;
    test)
        test_cluster_guard
        ;;
    all)
        deploy_lambda
        deploy_hetzner
        test_cluster_guard
        ;;
    *)
        echo "Usage: $0 [lambda|hetzner|test|all]"
        echo ""
        echo "  lambda  - Deploy Q7 Lambda v4.2 to AWS"
        echo "  hetzner - Deploy Copy Trade Server v2.2 to Hetzner"
        echo "  test    - Test Cluster Guard with dry run"
        echo "  all     - Deploy everything (default)"
        exit 1
        ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "═══════════════════════════════════════════════════════════════"
