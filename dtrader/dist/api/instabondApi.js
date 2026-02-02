"use strict";
/**
 * InstaBond API for Web UI Integration
 *
 * Allows DTGC.io/Gold web users to:
 * - Create InstaBond orders (graduation snipe + auto take-profit)
 * - View their active orders
 * - Cancel orders
 * - Get order status updates
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webOrders = exports.app = void 0;
exports.updateWebOrder = updateWebOrder;
exports.getWebOrder = getWebOrder;
exports.startInstaBondApi = startInstaBondApi;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const ethers_1 = require("ethers");
const graduation_1 = require("../sniper/graduation");
const app = (0, express_1.default)();
exports.app = app;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// In-memory store (will persist to file for reliability)
const webOrders = new Map();
exports.webOrders = webOrders;
const ordersByWallet = new Map();
// Load orders from file on startup
const fs_1 = __importDefault(require("fs"));
const ORDERS_FILE = './data/web-instabond-orders.json';
function loadOrders() {
    try {
        if (fs_1.default.existsSync(ORDERS_FILE)) {
            const data = JSON.parse(fs_1.default.readFileSync(ORDERS_FILE, 'utf-8'));
            for (const order of data) {
                webOrders.set(order.id, order);
                if (!ordersByWallet.has(order.walletAddress.toLowerCase())) {
                    ordersByWallet.set(order.walletAddress.toLowerCase(), new Set());
                }
                ordersByWallet.get(order.walletAddress.toLowerCase()).add(order.id);
            }
            console.log(`📂 Loaded ${webOrders.size} web InstaBond orders`);
        }
    }
    catch (e) {
        console.error('Failed to load web orders:', e);
    }
}
function saveOrders() {
    try {
        fs_1.default.mkdirSync('./data', { recursive: true });
        fs_1.default.writeFileSync(ORDERS_FILE, JSON.stringify(Array.from(webOrders.values()), null, 2));
    }
    catch (e) {
        console.error('Failed to save web orders:', e);
    }
}
loadOrders();
/**
 * Create new InstaBond order
 * POST /api/instabond
 */
app.post('/api/instabond', async (req, res) => {
    try {
        const { walletAddress, tokenAddress, tokenSymbol, tokenName, amountPls, takeProfitPercent, slippage = 10, signature, // Wallet signature for auth
        message, // Signed message
         } = req.body;
        // Validate required fields
        if (!walletAddress || !tokenAddress || !amountPls || !takeProfitPercent) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Verify signature (proves wallet ownership)
        if (signature && message) {
            try {
                const recoveredAddress = ethers_1.ethers.verifyMessage(message, signature);
                if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
                    return res.status(401).json({ error: 'Invalid signature' });
                }
            }
            catch (e) {
                return res.status(401).json({ error: 'Signature verification failed' });
            }
        }
        // Calculate sell percent for breakeven (sell portion that returns initial investment)
        const sellPercent = 100 / (1 + takeProfitPercent / 100);
        // Create order
        const order = {
            id: `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            walletAddress: walletAddress.toLowerCase(),
            tokenAddress: tokenAddress.toLowerCase(),
            tokenSymbol,
            tokenName,
            amountPls,
            takeProfitPercent,
            sellPercent,
            slippage,
            status: 'armed',
            createdAt: Date.now(),
        };
        // Store order
        webOrders.set(order.id, order);
        if (!ordersByWallet.has(order.walletAddress)) {
            ordersByWallet.set(order.walletAddress, new Set());
        }
        ordersByWallet.get(order.walletAddress).add(order.id);
        saveOrders();
        // Register with graduation sniper
        graduation_1.graduationSniper.watchToken(tokenAddress, {
            amountPls: ethers_1.ethers.parseEther(amountPls),
            slippage,
            gasLimit: 500000,
            gasPriceMultiplier: 1.5,
            autoSellPercent: sellPercent,
            orderId: order.id,
        });
        // Update status to watching
        order.status = 'watching';
        saveOrders();
        console.log(`🎯 [WEB] InstaBond armed: ${order.id} - ${tokenSymbol || tokenAddress.slice(0, 10)} - ${amountPls} PLS - TP: +${takeProfitPercent}%`);
        res.json({
            success: true,
            order: {
                id: order.id,
                status: order.status,
                tokenAddress: order.tokenAddress,
                amountPls: order.amountPls,
                takeProfitPercent: order.takeProfitPercent,
                sellPercent: order.sellPercent,
            }
        });
    }
    catch (error) {
        console.error('InstaBond API error:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get orders for a wallet
 * GET /api/instabond/:wallet
 */
app.get('/api/instabond/:wallet', (req, res) => {
    try {
        const wallet = req.params.wallet.toLowerCase();
        const orderIds = ordersByWallet.get(wallet) || new Set();
        const orders = Array.from(orderIds)
            .map(id => webOrders.get(id))
            .filter(Boolean)
            .sort((a, b) => (b?.createdAt || 0) - (a?.createdAt || 0));
        res.json({ orders });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Get single order status
 * GET /api/instabond/order/:orderId
 */
app.get('/api/instabond/order/:orderId', (req, res) => {
    try {
        const order = webOrders.get(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ order });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Cancel an order
 * DELETE /api/instabond/:orderId
 */
app.delete('/api/instabond/:orderId', (req, res) => {
    try {
        const order = webOrders.get(req.params.orderId);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        // Can only cancel if not already executing
        if (['buying', 'selling'].includes(order.status)) {
            return res.status(400).json({ error: 'Cannot cancel order in progress' });
        }
        // Remove from graduation sniper
        graduation_1.graduationSniper.unwatchToken(order.tokenAddress);
        // Update status
        order.status = 'cancelled';
        saveOrders();
        console.log(`❌ [WEB] InstaBond cancelled: ${order.id}`);
        res.json({ success: true, order });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
/**
 * Health check
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        activeOrders: webOrders.size,
        graduationSniperConnected: true,
    });
});
// Handle graduation events from sniper
graduation_1.graduationSniper.on('graduation', async (data) => {
    console.log(`🎓 [WEB] Graduation detected: ${data.token}`);
    // Find all web orders for this token
    for (const [id, order] of webOrders) {
        if (order.tokenAddress === data.token.toLowerCase() && order.status === 'watching') {
            order.status = 'buying';
            order.graduatedAt = Date.now();
            saveOrders();
            console.log(`🎯 [WEB] Order ${id} triggered by graduation!`);
        }
    }
});
graduation_1.graduationSniper.on('snipeReady', async (data) => {
    const order = webOrders.get(data.orderId);
    if (!order)
        return;
    console.log(`💰 [WEB] Snipe ready for order ${order.id}`);
    // The actual execution happens via the user's wallet in the web UI
    // We just track the status here
});
graduation_1.graduationSniper.on('snipeFailed', async (data) => {
    const order = webOrders.get(data.orderId);
    if (!order)
        return;
    order.status = 'failed';
    order.error = data.error;
    saveOrders();
    console.log(`❌ [WEB] Snipe failed for order ${order.id}: ${data.error}`);
});
// Export for integration with main bot
function updateWebOrder(orderId, updates) {
    const order = webOrders.get(orderId);
    if (order) {
        Object.assign(order, updates);
        saveOrders();
    }
}
function getWebOrder(orderId) {
    return webOrders.get(orderId);
}
function startInstaBondApi(port = 3847) {
    return new Promise((resolve) => {
        app.listen(port, () => {
            console.log(`🌐 InstaBond API running on port ${port}`);
            resolve();
        });
    });
}
//# sourceMappingURL=instabondApi.js.map