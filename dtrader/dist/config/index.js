"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PULSEX_PAIR_ABI = exports.PULSEX_FACTORY_ABI = exports.PULSEX_ROUTER_ABI = exports.ERC20_ABI = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    // Telegram - accepts both BOT_TOKEN and TELEGRAM_BOT_TOKEN
    telegramToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
    // PulseChain Network
    rpc: process.env.PULSECHAIN_RPC || 'https://rpc.pulsechain.com',
    wss: process.env.PULSECHAIN_WSS || 'wss://rpc.pulsechain.com',
    chainId: 369,
    nativeSymbol: 'PLS',
    explorerUrl: 'https://scan.pulsechain.com',
    // PulseX DEX
    pulsexRouter: process.env.PULSEX_ROUTER_V2 || '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
    pulsexFactory: process.env.PULSEX_FACTORY_V2 || '0x29eA7545DEf87022BAdc76323F373EA1e707C523',
    wpls: '0xA1077a294dDE1B09bB078844df40758a5D0f9a27', // Wrapped PLS
    // Token Gate - Must hold $50+ of DTGC to access features
    tokenGate: {
        dtgc: process.env.DTGC_TOKEN || '0xD0676B28a457371D58d47E5247b439114e40Eb0F',
        minHoldUsd: Number(process.env.MIN_HOLD_USD) || 50,
    },
    // pump.tires Integration
    pumpTires: {
        contract: process.env.PUMP_TIRES_CONTRACT || '',
        graduationThreshold: BigInt(process.env.GRADUATION_THRESHOLD || '200000000000000000000000000'), // 200M PLS
    },
    // Trading Defaults
    trading: {
        defaultSlippage: Number(process.env.DEFAULT_SLIPPAGE) || 10,
        defaultGasLimit: Number(process.env.DEFAULT_GAS_LIMIT) || 500000,
        maxGasPriceGwei: Number(process.env.MAX_GAS_PRICE_GWEI) || 100,
    },
};
// ABIs
exports.ERC20_ABI = [
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transfer(address to, uint256 amount) returns (bool)',
];
exports.PULSEX_ROUTER_ABI = [
    'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
    'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)',
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
    'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
    'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
    'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
];
exports.PULSEX_FACTORY_ABI = [
    'function getPair(address tokenA, address tokenB) external view returns (address pair)',
    'function allPairs(uint) external view returns (address pair)',
    'function allPairsLength() external view returns (uint)',
    'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
];
exports.PULSEX_PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'event Sync(uint112 reserve0, uint112 reserve1)',
    'event Mint(address indexed sender, uint amount0, uint amount1)',
    'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
];
//# sourceMappingURL=index.js.map