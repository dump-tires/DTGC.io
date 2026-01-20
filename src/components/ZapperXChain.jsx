import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// ============================================
// ZAPPER-X-CHAIN - OPTIMIZED EDITION WITH TOKEN LOGOS
// Multicall3 Parallel Scanning • Gasless Zaps • 1% Fee
// Token logos via gib.show API
// Fee Wallet: 0x1449a7d9973e6215534d785e3e306261156eb610
// ============================================

const FEE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';
const FEE_PERCENT = 1;
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = ['function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) external payable returns (tuple(bool success, bytes returnData)[])'];

// ============================================
// GIB.SHOW TOKEN LOGO HELPER
// Format: https://gib.show/image/{chainId}/{tokenAddress}
// ============================================
const getTokenLogo = (chainId, tokenAddress) => {
  if (!tokenAddress) return null;
  return `https://gib.show/image/${chainId}/${tokenAddress.toLowerCase()}`;
};

// Native token logos (special cases)
const NATIVE_LOGOS = {
  ethereum: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
  bsc: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/info/logo.png',
  polygon: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
  arbitrum: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
  optimism: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
  base: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
  avalanche: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
};

// Token Icon Component with fallback
const TokenIcon = ({ logo, symbol, chainColor, size = 28 }) => {
  const [imgError, setImgError] = useState(false);
  
  if (logo && !imgError) {
    return (
      <img 
        src={logo} 
        alt={symbol}
        style={{ 
          width: size, 
          height: size, 
          borderRadius: '50%',
          objectFit: 'cover',
          border: `2px solid ${chainColor}40`,
          background: '#1a1a2e',
        }}
        onError={() => setImgError(true)}
      />
    );
  }
  
  // Fallback to symbol initial with chain color
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${chainColor}40, ${chainColor}20)`,
      border: `2px solid ${chainColor}60`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: size * 0.4,
      color: chainColor,
    }}>
      {symbol?.charAt(0) || '?'}
    </div>
  );
};

const TOKEN_SCAN_CONFIG = {
  ethereum: { quickTokens: 500, deepTokens: 5000 },
  bsc: { quickTokens: 400, deepTokens: 4000 },
  polygon: { quickTokens: 300, deepTokens: 3000 },
  arbitrum: { quickTokens: 300, deepTokens: 2000 },
  optimism: { quickTokens: 200, deepTokens: 1500 },
  base: { quickTokens: 200, deepTokens: 1500 },
  avalanche: { quickTokens: 200, deepTokens: 1500 },
};

const USDC_ADDRESSES = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  bsc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

const WRAPPED_NATIVE = {
  ethereum: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  bsc: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  polygon: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  arbitrum: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  avalanche: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
  optimism: '0x4200000000000000000000000000000000000006',
  base: '0x4200000000000000000000000000000000000006',
};

const DEX_ROUTERS = {
  ethereum: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  bsc: { address: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4', name: 'PancakeSwap V3' },
  polygon: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  arbitrum: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  avalanche: { address: '0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE', name: 'TraderJoe V2' },
  optimism: { address: '0xE592427A0AEce92De3Edee1F18E0157C05861564', name: 'Uniswap V3' },
  base: { address: '0x2626664c2603336E57B271c5C0b26F421741e481', name: 'Uniswap V3' },
};

// ============================================
// CHAIN CONFIG WITH TOKEN LOGOS
// All tokens now include logo URLs via gib.show
// ============================================
const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum',
    chainId: 1,
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#627EEA',
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'HEX', address: '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39', decimals: 8, coingeckoId: 'hex' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdecB2BB92BcD5c', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18, coingeckoId: 'maker' },
      { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', decimals: 18, coingeckoId: 'curve-dao-token' },
    ].map(t => ({ ...t, logo: getTokenLogo(1, t.address) }))
  },
  bsc: {
    name: 'BNB Chain',
    chainId: 56,
    symbol: 'BNB',
    decimals: 18,
    coingeckoId: 'binancecoin',
    color: '#F3BA2F',
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc.publicnode.com'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, coingeckoId: 'bitcoin-bep2' },
      { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'XRP', address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18, coingeckoId: 'ripple' },
      { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8, coingeckoId: 'dogecoin' },
    ].map(t => ({ ...t, logo: getTokenLogo(56, t.address) }))
  },
  polygon: {
    name: 'Polygon',
    chainId: 137,
    symbol: 'MATIC',
    decimals: 18,
    coingeckoId: 'matic-network',
    color: '#8247E5',
    rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'AAVE', address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'LINK', address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'CRV', address: '0x172370d5Cd63279eFa6d502DAB29171933a610AF', decimals: 18, coingeckoId: 'curve-dao-token' },
    ].map(t => ({ ...t, logo: getTokenLogo(137, t.address) }))
  },
  arbitrum: {
    name: 'Arbitrum',
    chainId: 42161,
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#28A0F0',
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
      { symbol: 'WBTC', address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'LINK', address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'MAGIC', address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342', decimals: 18, coingeckoId: 'magic' },
    ].map(t => ({ ...t, logo: getTokenLogo(42161, t.address) }))
  },
  optimism: {
    name: 'Optimism',
    chainId: 10,
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#FF0420',
    rpcs: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WBTC', address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'SNX', address: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4', decimals: 18, coingeckoId: 'synthetix-network-token' },
      { symbol: 'LINK', address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6', decimals: 18, coingeckoId: 'chainlink' },
    ].map(t => ({ ...t, logo: getTokenLogo(10, t.address) }))
  },
  base: {
    name: 'Base',
    chainId: 8453,
    symbol: 'ETH',
    decimals: 18,
    coingeckoId: 'ethereum',
    color: '#0052FF',
    rpcs: ['https://base.llamarpc.com', 'https://mainnet.base.org'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
      { symbol: 'BRETT', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, coingeckoId: 'based-brett' },
      { symbol: 'TOSHI', address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', decimals: 18, coingeckoId: 'toshi' },
      { symbol: 'DEGEN', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, coingeckoId: 'degen-base' },
    ].map(t => ({ ...t, logo: getTokenLogo(8453, t.address) }))
  },
  avalanche: {
    name: 'Avalanche',
    chainId: 43114,
    symbol: 'AVAX',
    decimals: 18,
    coingeckoId: 'avalanche-2',
    color: '#E84142',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.publicnode.com'],
    fallbackTokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18, coingeckoId: 'joe' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WBTC.e', address: '0x50b7545627a5162F82A992c33b87aDc75187B218', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'WETH.e', address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'LINK.e', address: '0x5947BB275c521040051D82396192181b413227A3', decimals: 18, coingeckoId: 'chainlink' },
    ].map(t => ({ ...t, logo: getTokenLogo(43114, t.address) }))
  }
};

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external',
  'function nonces(address owner) external view returns (uint256)',
  'function name() external view returns (string)',
];

const SWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  'function exactInput((bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external payable returns (uint256 amountOut)',
];

const WETH_ABI = ['function deposit() external payable'];

// RPC helpers
const rpcCall = async (rpcUrl, method, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
};

const tryRpcs = async (rpcs, method, params) => {
  for (const rpc of rpcs) {
    try {
      return await rpcCall(rpc, method, params);
    } catch (e) {
      continue;
    }
  }
  throw new Error('All RPCs failed');
};

const BALANCE_OF_SELECTOR = '0x70a08231';

const multicallBalances = async (rpcUrl, tokens, walletAddr) => {
  const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
  const calls = tokens.map(token => ({
    target: token.address,
    allowFailure: true,
    callData: BALANCE_OF_SELECTOR + paddedAddress
  }));
  
  const iface = new ethers.Interface(MULTICALL3_ABI);
  const calldata = iface.encodeFunctionData('aggregate3', [calls]);
  
  try {
    const result = await rpcCall(rpcUrl, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: calldata }, 'latest']);
    const decoded = iface.decodeFunctionResult('aggregate3', result);
    const results = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const { success, returnData } = decoded[0][i];
      if (success && returnData && returnData !== '0x' && returnData.length >= 66) {
        try {
          const balance = BigInt(returnData);
          if (balance > 0n) {
            const balanceNum = Number(balance) / Math.pow(10, tokens[i].decimals || 18);
            if (balanceNum > 0.0001) results.push({ ...tokens[i], balance: balanceNum });
          }
        } catch (e) {}
      }
    }
    return results;
  } catch (error) {
    return fallbackBatchBalances(rpcUrl, tokens, walletAddr);
  }
};

const fallbackBatchBalances = async (rpcUrl, tokens, walletAddr) => {
  const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
  const results = [];
  
  const body = tokens.map((token, idx) => ({
    jsonrpc: '2.0',
    id: idx + 1,
    method: 'eth_call',
    params: [{ to: token.address, data: BALANCE_OF_SELECTOR + paddedAddress }, 'latest']
  }));
  
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const batchResults = await response.json();
    const resultsArray = Array.isArray(batchResults) ? batchResults : [batchResults];
    
    for (let i = 0; i < tokens.length; i++) {
      const result = resultsArray.find(r => r.id === i + 1)?.result;
      if (result && result !== '0x' && result !== '0x0') {
        try {
          const balance = Number(BigInt(result)) / Math.pow(10, tokens[i].decimals || 18);
          if (balance > 0.0001) results.push({ ...tokens[i], balance });
        } catch (e) {}
      }
    }
  } catch (e) {}
  return results;
};

const tokenListCache = {};

const fetchTokenList = async (chainKey, limit) => {
  const chainId = CHAIN_CONFIG[chainKey]?.chainId;
  if (!chainId) return [];
  
  const cacheKey = `${chainKey}_${limit}`;
  if (tokenListCache[cacheKey] && Date.now() - tokenListCache[cacheKey].timestamp < 3600000) {
    return tokenListCache[cacheKey].tokens;
  }
  
  const urls = {
    1: 'https://tokens.coingecko.com/ethereum/all.json',
    56: 'https://tokens.coingecko.com/binance-smart-chain/all.json',
    137: 'https://tokens.coingecko.com/polygon-pos/all.json',
    42161: 'https://tokens.coingecko.com/arbitrum-one/all.json',
    10: 'https://tokens.coingecko.com/optimistic-ethereum/all.json',
    8453: 'https://tokens.coingecko.com/base/all.json',
    43114: 'https://tokens.coingecko.com/avalanche/all.json'
  };
  
  try {
    const response = await fetch(urls[chainId]);
    if (!response.ok) throw new Error();
    const data = await response.json();
    const tokens = (data.tokens || []).slice(0, limit).map(t => ({
      symbol: t.symbol,
      address: t.address,
      decimals: t.decimals || 18,
      coingeckoId: t.extensions?.coingeckoId || t.symbol?.toLowerCase(),
      logo: getTokenLogo(chainId, t.address) // Add gib.show logo
    }));
    tokenListCache[cacheKey] = { tokens, timestamp: Date.now() };
    return tokens;
  } catch (e) {
    return CHAIN_CONFIG[chainKey].fallbackTokens || [];
  }
};

// ============================================
// MAIN COMPONENT
// ============================================
const ZapperXChain = ({ connectedAddress: propAddress }) => {
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ chain: '', tokensScanned: 0, tokensFound: 0 });
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanMode, setScanMode] = useState('quick');
  const [deepScanAvailable, setDeepScanAvailable] = useState(false);
  const [gaslessMode, setGaslessMode] = useState(false);
  const [zapAmounts, setZapAmounts] = useState({});
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  const [isZapping, setIsZapping] = useState(false);
  const [zapProgress, setZapProgress] = useState({ current: 0, total: 0, status: '', asset: null });
  const [zapResults, setZapResults] = useState([]);
  const [bridgeReady, setBridgeReady] = useState({});
  const [bridgeStatus, setBridgeStatus] = useState('');
  const [totalFeesCollected, setTotalFeesCollected] = useState(0);
  const [copySuccess, setCopySuccess] = useState(false);

  const getProvider = useCallback(() => {
    let p = window.ethereum;
    if (window.ethereum?.isRabby) p = window.ethereum;
    else if (window.ethereum?.providers?.length) {
      const r = window.ethereum.providers.find(x => x.isRabby);
      if (r) p = r;
    }
    return p;
  }, []);

  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) {
        setWalletAddress(propAddress);
        return;
      }
      const p = getProvider();
      if (p) {
        try {
          const a = await p.request({ method: 'eth_accounts' });
          if (a?.[0]) setWalletAddress(a[0]);
        } catch (e) {}
      }
    };
    detectWallet();
  }, [propAddress, getProvider]);

  const fetchPrices = async () => {
    try {
      const ids = 'ethereum,binancecoin,matic-network,avalanche-2,tether,usd-coin,chainlink,uniswap,shiba-inu,pancakeswap-token,wrapped-bitcoin,aave,pepe,gmx,joe,aerodrome-finance,arbitrum,optimism,hex,dai,maker,curve-dao-token,synthetix-network-token,magic,based-brett,degen-base';
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (r.ok) {
        const d = await r.json();
        setPrices(d);
        return d;
      }
    } catch (e) {}
    return { ethereum: { usd: 3300 }, binancecoin: { usd: 650 }, 'matic-network': { usd: 0.5 }, 'avalanche-2': { usd: 35 }, tether: { usd: 1 }, 'usd-coin': { usd: 1 } };
  };

  const getNativeBalance = async (chain, address) => {
    try {
      const r = await tryRpcs(chain.rpcs, 'eth_getBalance', [address, 'latest']);
      if (!r || r === '0x0') return 0;
      return Number(BigInt(r)) / Math.pow(10, chain.decimals);
    } catch (e) {
      return 0;
    }
  };

  const scanChainOptimized = async (chainKey, address, currentPrices, tokenLimit) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    const nativeBalance = await getNativeBalance(chain, address);
    if (nativeBalance > 0.0001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      foundAssets.push({
        chain: chain.name,
        chainKey,
        symbol: chain.symbol,
        balance: nativeBalance,
        value: nativeBalance * price,
        price,
        isNative: true,
        color: chain.color,
        decimals: chain.decimals,
        chainId: chain.chainId,
        logo: NATIVE_LOGOS[chainKey] // Native token logo
      });
    }
    
    let tokenList = await fetchTokenList(chainKey, tokenLimit);
    if (tokenList.length === 0) tokenList = chain.fallbackTokens || [];
    
    const BATCH_SIZE = 500;
    for (let i = 0; i < tokenList.length; i += BATCH_SIZE) {
      const batch = tokenList.slice(i, i + BATCH_SIZE);
      try {
        const tokensWithBalances = await multicallBalances(chain.rpcs[0], batch, address);
        for (const token of tokensWithBalances) {
          const price = currentPrices[token.coingeckoId]?.usd || 0;
          foundAssets.push({
            chain: chain.name,
            chainKey,
            symbol: token.symbol,
            balance: token.balance,
            value: token.balance * price,
            price,
            isNative: false,
            color: chain.color,
            address: token.address,
            decimals: token.decimals,
            chainId: chain.chainId,
            logo: token.logo || getTokenLogo(chain.chainId, token.address)
          });
        }
      } catch (e) {}
    }
    
    return { assets: foundAssets, tokensScanned: tokenList.length };
  };

  const scanAllChains = async (testAddress = null) => {
    let addressToScan = testAddress || walletAddress;
    
    const p = getProvider();
    if (!addressToScan && p) {
      try {
        const a = await p.request({ method: 'eth_accounts' });
        if (a?.[0]) {
          addressToScan = a[0];
          setWalletAddress(a[0]);
        }
      } catch (e) {}
    }
    
    if (!addressToScan) {
      setScanError('Please connect wallet');
      return;
    }
    
    setIsScanning(true);
    setScanError(null);
    setAssets([]);
    setTotalValue(0);
    setSelectedAssets(new Set());
    setZapAmounts({});
    setBridgeReady({});
    setDeepScanAvailable(false);
    
    const chains = Object.keys(CHAIN_CONFIG);
    const isQuickScan = scanMode === 'quick';
    
    setScanProgress({ chain: 'Loading prices...', tokensScanned: 0, tokensFound: 0 });
    
    try {
      const currentPrices = await fetchPrices();
      setScanProgress(prev => ({ ...prev, chain: `⚡ Scanning ${chains.length} chains in parallel...` }));
      
      const scanPromises = chains.map(async (chainKey) => {
        const config = TOKEN_SCAN_CONFIG[chainKey];
        const limit = isQuickScan ? config.quickTokens : config.deepTokens;
        try {
          return await scanChainOptimized(chainKey, addressToScan, currentPrices, limit);
        } catch (e) {
          return { assets: [], tokensScanned: 0 };
        }
      });
      
      const results = await Promise.all(scanPromises);
      
      const allAssets = [];
      const newZapAmounts = {};
      let totalTokensScanned = 0;
      
      for (const result of results) {
        totalTokensScanned += result.tokensScanned;
        for (const asset of result.assets) {
          allAssets.push(asset);
          const key = `${asset.chainKey}-${asset.symbol}`;
          newZapAmounts[key] = asset.isNative ? Math.max(0, asset.value * 0.85) : asset.value;
        }
      }
      
      allAssets.sort((a, b) => b.value - a.value);
      setAssets(allAssets);
      setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      setZapAmounts(newZapAmounts);
      setScanProgress({ chain: '✅ Complete!', tokensScanned: totalTokensScanned, tokensFound: allAssets.length });
      
      if (isQuickScan) setDeepScanAvailable(true);
      
      const ready = {};
      for (const asset of allAssets) {
        if (isUsdcToken(asset.symbol)) ready[asset.chainKey] = (ready[asset.chainKey] || 0) + asset.value;
      }
      setBridgeReady(ready);
      
    } catch (e) {
      setScanError('Scan failed: ' + e.message);
    } finally {
      setIsScanning(false);
    }
  };

  const extendDeepScan = async () => {
    setScanMode('deep');
    setDeepScanAvailable(false);
    await scanAllChains();
  };

  const switchNetwork = async (chainId) => {
    const p = getProvider();
    if (!p) throw new Error('No wallet');
    try {
      await p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] });
    } catch (e) {
      if (e.code === 4902) {
        const c = Object.values(CHAIN_CONFIG).find(x => x.chainId === chainId);
        if (c) await p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x' + chainId.toString(16), chainName: c.name, nativeCurrency: { name: c.symbol, symbol: c.symbol, decimals: 18 }, rpcUrls: c.rpcs }] });
      } else throw e;
    }
    await new Promise(r => setTimeout(r, 1000));
  };

  const executeSwapWithFee = async (asset, dollarAmount) => {
    const p = getProvider();
    if (!p) throw new Error('No wallet');
    
    const tokenAmount = dollarAmount / asset.price;
    const amountWei = BigInt(Math.floor(tokenAmount * Math.pow(10, asset.decimals)));
    if (amountWei <= 0n) throw new Error('Amount too small');
    
    await switchNetwork(asset.chainId);
    
    const provider = new ethers.BrowserProvider(p);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    const chainKey = asset.chainKey;
    const usdcAddress = USDC_ADDRESSES[chainKey];
    const routerAddress = DEX_ROUTERS[chainKey]?.address;
    if (!routerAddress) throw new Error('No DEX router');
    
    let swapResult;
    if (asset.isNative) {
      const wrappedAddress = WRAPPED_NATIVE[chainKey];
      setZapProgress(prev => ({ ...prev, status: `Wrapping ${asset.symbol}...` }));
      const wethContract = new ethers.Contract(wrappedAddress, WETH_ABI, signer);
      const wrapTx = await wethContract.deposit({ value: amountWei });
      await wrapTx.wait();
      swapResult = await swapTokenToUsdc(signer, wrappedAddress, usdcAddress, amountWei, routerAddress, chainKey, userAddress);
    } else {
      swapResult = await swapTokenToUsdc(signer, asset.address, usdcAddress, amountWei, routerAddress, chainKey, userAddress);
    }
    
    if (swapResult.success) await sendFeeToGrowthEngine(signer, usdcAddress, chainKey, dollarAmount);
    
    return swapResult;
  };

  const sendFeeToGrowthEngine = async (signer, usdcAddress, chainKey, dollarAmount) => {
    try {
      setZapProgress(prev => ({ ...prev, status: '💰 Sending 1% fee to Growth Engine...' }));
      const usdcContract = new ethers.Contract(usdcAddress, ERC20_ABI, signer);
      const decimals = chainKey === 'bsc' ? 18 : 6;
      const feeAmount = BigInt(Math.floor((dollarAmount * FEE_PERCENT / 100) * Math.pow(10, decimals)));
      
      if (feeAmount > 0n) {
        const feeTx = await usdcContract.transfer(FEE_WALLET, feeAmount);
        await feeTx.wait();
        const feeUsd = Number(feeAmount) / Math.pow(10, decimals);
        setTotalFeesCollected(prev => prev + feeUsd);
      }
    } catch (e) {
      console.log('Fee transfer failed:', e.message);
    }
  };

  const swapTokenToUsdc = async (signer, tokenIn, tokenOut, amountIn, routerAddress, chainKey, userAddress) => {
    setZapProgress(prev => ({ ...prev, status: 'Checking approval...' }));
    const tokenContract = new ethers.Contract(tokenIn, ERC20_ABI, signer);
    const currentAllowance = await tokenContract.allowance(userAddress, routerAddress);
    
    if (currentAllowance < amountIn) {
      if (gaslessMode) {
        try {
          setZapProgress(prev => ({ ...prev, status: '✨ Gasless signature...' }));
          await signPermit(signer, tokenContract, routerAddress, amountIn, userAddress);
        } catch (e) {
          setZapProgress(prev => ({ ...prev, status: 'Approving token...' }));
          const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
          await approveTx.wait();
        }
      } else {
        setZapProgress(prev => ({ ...prev, status: 'Approving token...' }));
        const approveTx = await tokenContract.approve(routerAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
    }
    
    setZapProgress(prev => ({ ...prev, status: 'Swapping to USDC...' }));
    const router = new ethers.Contract(routerAddress, SWAP_ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    
    try {
      const params = { tokenIn, tokenOut, fee: 3000, recipient: userAddress, deadline, amountIn, amountOutMinimum: 0, sqrtPriceLimitX96: 0 };
      const tx = await router.exactInputSingle(params);
      const receipt = await tx.wait();
      return { success: true, hash: receipt.hash };
    } catch (e) {
      try {
        const path = ethers.solidityPacked(['address', 'uint24', 'address'], [tokenIn, 3000, tokenOut]);
        const params = { path, recipient: userAddress, deadline, amountIn, amountOutMinimum: 0 };
        const tx = await router.exactInput(params);
        const receipt = await tx.wait();
        return { success: true, hash: receipt.hash };
      } catch (e2) {
        throw new Error('Swap failed: ' + e2.message);
      }
    }
  };

  const signPermit = async (signer, tokenContract, spender, amount, owner) => {
    try {
      const nonce = await tokenContract.nonces(owner);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const name = await tokenContract.name();
      const domain = { name, version: '1', chainId: (await signer.provider.getNetwork()).chainId, verifyingContract: await tokenContract.getAddress() };
      const types = { Permit: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] };
      const value = { owner, spender, value: amount, nonce, deadline };
      const signature = await signer.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(signature);
      await tokenContract.permit(owner, spender, amount, deadline, v, r, s);
      return true;
    } catch (e) {
      throw new Error('Permit not supported');
    }
  };

  const zapChain = async (chainKey) => {
    const chainAssets = assets.filter(a => a.chainKey === chainKey && selectedAssets.has(`${a.chainKey}-${a.symbol}`) && !isUsdcToken(a.symbol));
    if (chainAssets.length === 0) return;
    
    setIsZapping(true);
    setZapResults([]);
    const results = [];
    
    try {
      for (let i = 0; i < chainAssets.length; i++) {
        const asset = chainAssets[i];
        const key = `${asset.chainKey}-${asset.symbol}`;
        const dollarAmount = zapAmounts[key] || 0;
        
        if (dollarAmount < 0.01) {
          results.push({ asset, success: false, error: 'Too small' });
          continue;
        }
        
        setZapProgress({ current: i + 1, total: chainAssets.length, status: `Zapping ${asset.symbol}...`, asset });
        
        try {
          const result = await executeSwapWithFee(asset, dollarAmount);
          results.push({ asset, ...result });
        } catch (e) {
          results.push({ asset, success: false, error: e.message });
        }
        
        if (i < chainAssets.length - 1) await new Promise(r => setTimeout(r, 2000));
      }
    } finally {
      setZapProgress({ current: 0, total: 0, status: '', asset: null });
      setIsZapping(false);
      setZapResults(results);
      
      const successCount = results.filter(r => r.success).length;
      if (successCount > 0) {
        setBridgeReady(prev => ({
          ...prev,
          [chainKey]: (prev[chainKey] || 0) + results.filter(r => r.success).reduce((s, r) => {
            const amt = zapAmounts[`${r.asset.chainKey}-${r.asset.symbol}`] || 0;
            return s + (amt * (100 - FEE_PERCENT) / 100);
          }, 0)
        }));
      }
    }
  };

  const updateZapAmount = (k, v) => setZapAmounts(prev => ({ ...prev, [k]: parseFloat(v) || 0 }));
  const toggleAssetSelection = (k) => {
    setSelectedAssets(prev => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };
  
  const selectAllOnChain = (chainKey) => {
    const ca = assets.filter(a => a.chainKey === chainKey && !isUsdcToken(a.symbol));
    setSelectedAssets(prev => {
      const n = new Set(prev);
      ca.forEach(a => n.add(`${a.chainKey}-${a.symbol}`));
      return n;
    });
  };

  const openBridge = (chainKey) => {
    window.open(`https://libertyswap.finance/#/bridge?fromChain=${CHAIN_CONFIG[chainKey].chainId}&toChain=369`, '_blank');
    setBridgeStatus(`🌉 Opening Liberty Swap for ${CHAIN_CONFIG[chainKey].name}...`);
  };

  const copyToClipboard = (t) => {
    navigator.clipboard.writeText(t);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isUsdcToken = (s) => ['USDC', 'USDC.e', 'USDbC', 'USDT', 'DAI', 'BUSD'].includes(s);
  
  const formatNumber = (n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(2);
  };

  const assetsByChain = assets.reduce((acc, a) => {
    if (!acc[a.chainKey]) acc[a.chainKey] = [];
    acc[a.chainKey].push(a);
    return acc;
  }, {});
  
  const chainsWithAssets = Object.keys(assetsByChain).sort((a, b) => 
    assetsByChain[b].reduce((s, x) => s + x.value, 0) - assetsByChain[a].reduce((s, x) => s + x.value, 0)
  );
  
  const referralLink = walletAddress ? `${window.location.origin}${window.location.pathname}?ref=${walletAddress}` : '';
  const quickTokenCount = Object.values(TOKEN_SCAN_CONFIG).reduce((s, c) => s + c.quickTokens, 0);
  const deepTokenCount = Object.values(TOKEN_SCAN_CONFIG).reduce((s, c) => s + c.deepTokens, 0);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '25px', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderRadius: '15px', padding: '25px', border: '2px solid #FFD700' }}>
        <h1 style={{ color: '#FFD700', marginBottom: '10px', fontSize: '2rem', textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>⚡ ZAPPER-X-CHAIN ⚡</h1>
        <p style={{ color: '#aaa', marginBottom: '15px' }}>Multicall3 Parallel Scanning • ~10 seconds for {quickTokenCount.toLocaleString()}+ tokens</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
          <button onClick={() => setScanMode('quick')} style={{ padding: '8px 20px', borderRadius: '20px', border: scanMode === 'quick' ? '2px solid #FFD700' : '1px solid #666', background: scanMode === 'quick' ? 'rgba(255,215,0,0.2)' : 'transparent', color: scanMode === 'quick' ? '#FFD700' : '#888', cursor: 'pointer', fontWeight: 'bold' }}>⚡ Quick ({quickTokenCount.toLocaleString()})</button>
          <button onClick={() => setScanMode('deep')} style={{ padding: '8px 20px', borderRadius: '20px', border: scanMode === 'deep' ? '2px solid #4ade80' : '1px solid #666', background: scanMode === 'deep' ? 'rgba(74,222,128,0.2)' : 'transparent', color: scanMode === 'deep' ? '#4ade80' : '#888', cursor: 'pointer', fontWeight: 'bold' }}>🔍 Deep ({deepTokenCount.toLocaleString()})</button>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>Gasless (EIP-2612):</span>
          <button onClick={() => setGaslessMode(!gaslessMode)} style={{ padding: '6px 15px', borderRadius: '15px', border: gaslessMode ? '2px solid #a855f7' : '1px solid #666', background: gaslessMode ? 'rgba(168,85,247,0.2)' : 'transparent', color: gaslessMode ? '#a855f7' : '#888', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>{gaslessMode ? '✅ ON' : '❌ OFF'}</button>
        </div>
        
        {walletAddress && <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '20px', color: '#4ade80', fontSize: '0.9rem', marginBottom: '10px' }}>🔗 {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>}
        
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { alert('🔬 Scanning Vitalik...'); scanAllChains('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); }} disabled={isScanning} style={{ padding: '15px 25px', fontSize: '1rem', fontWeight: 'bold', borderRadius: '25px', border: '2px solid #666', background: 'rgba(0,0,0,0.5)', color: '#888', cursor: isScanning ? 'not-allowed' : 'pointer' }}>🧪 Test Vitalik</button>
          <button onClick={() => scanAllChains()} disabled={isScanning} style={{ padding: '15px 40px', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '25px', border: 'none', background: isScanning ? '#666' : 'linear-gradient(90deg, #FFD700, #FFA500)', color: '#000', cursor: isScanning ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)' }}>{isScanning ? <span className="zap-spinner">⚡</span> : '🔍 Scan All Chains'}</button>
        </div>
        
        {isScanning && (
          <div style={{ marginTop: '15px', color: '#888' }}>
            <div>{scanProgress.chain}</div>
            <div style={{ fontSize: '0.85rem', color: '#4ade80' }}>📊 {scanProgress.tokensScanned?.toLocaleString() || 0} tokens | Found: {scanProgress.tokensFound || 0}</div>
            <div style={{ width: '100%', height: '4px', background: '#333', borderRadius: '2px', marginTop: '10px' }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #FFD700, #4ade80)', animation: 'pulse 1.5s infinite' }} />
            </div>
          </div>
        )}
        
        {deepScanAvailable && !isScanning && (
          <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(168,85,247,0.1)', border: '1px solid #a855f7', borderRadius: '10px' }}>
            <div style={{ color: '#a855f7', fontWeight: 'bold', marginBottom: '8px' }}>🔍 Extend Deep Scan</div>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '10px' }}>Scan {deepTokenCount.toLocaleString()} tokens for hidden dust</div>
            <button onClick={extendDeepScan} style={{ padding: '10px 25px', borderRadius: '20px', border: 'none', background: 'linear-gradient(90deg, #a855f7, #6366f1)', color: '#fff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>🔬 Run Deep Scan</button>
          </div>
        )}
        
        {scanError && <div style={{ color: '#f87171', marginTop: '15px', padding: '10px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px' }}>⚠️ {scanError}</div>}
      </div>

      {/* Fee Notice */}
      <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '10px', padding: '10px 15px', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ color: '#4ade80', fontSize: '0.85rem' }}>💰 {FEE_PERCENT}% fee on ALL zaps → DTGC Growth Engine</div>
        {totalFeesCollected > 0 && <div style={{ color: '#FFD700', fontSize: '0.85rem', fontWeight: 'bold' }}>Session: ${totalFeesCollected.toFixed(4)}</div>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', justifyContent: 'center' }}>
        {[{ id: 'crosschain', label: '⚡ Zapper', color: '#FFD700' }, { id: 'bridge', label: '🌉 Bridge', color: '#4ade80' }, { id: 'referral', label: '🎁 Referral', color: '#FF69B4' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '12px 20px', borderRadius: '10px', border: activeTab === tab.id ? `2px solid ${tab.color}` : '1px solid #333', background: activeTab === tab.id ? `rgba(${tab.color === '#FFD700' ? '255,215,0' : tab.color === '#4ade80' ? '74,222,128' : '255,105,180'},0.15)` : 'transparent', color: activeTab === tab.id ? tab.color : '#888', cursor: 'pointer', fontWeight: 'bold' }}>{tab.label}</button>
        ))}
      </div>

      {/* Stats */}
      {assets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' }}>
          {[{ label: 'Total', value: `$${formatNumber(totalValue)}`, color: '#FFD700' }, { label: 'Assets', value: assets.length, color: '#4ade80' }, { label: 'Chains', value: chainsWithAssets.length, color: '#60a5fa' }, { label: 'Scanned', value: scanProgress.tokensScanned?.toLocaleString() || '0', color: '#a855f7' }].map((s, i) => (
            <div key={i} style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '10px', padding: '15px', textAlign: 'center', border: '1px solid #333' }}>
              <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '5px' }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: '1.3rem', fontWeight: 'bold' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Zapper Tab - WITH TOKEN LOGOS */}
      {activeTab === 'crosschain' && (
        <div>
          {chainsWithAssets.length === 0 && !isScanning && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', border: '1px solid #333' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🔍</div>
              <div>Click "Scan All Chains" to find your tokens</div>
            </div>
          )}
          
          {chainsWithAssets.map(chainKey => {
            const chain = CHAIN_CONFIG[chainKey];
            const chainAssets = assetsByChain[chainKey];
            const chainTotal = chainAssets.reduce((s, a) => s + a.value, 0);
            const zappable = chainAssets.filter(a => !isUsdcToken(a.symbol));
            const selected = zappable.filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`));
            
            return (
              <div key={chainKey} style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '20px', marginBottom: '15px', border: `2px solid ${chain.color}30` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {/* Chain Logo */}
                    <TokenIcon logo={NATIVE_LOGOS[chainKey]} symbol={chain.symbol} chainColor={chain.color} size={36} />
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold' }}>{chain.name}</div>
                      <div style={{ color: '#888', fontSize: '0.8rem' }}>{chainAssets.length} • ${formatNumber(chainTotal)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {zappable.length > 0 && (
                      <>
                        <button onClick={() => selectAllOnChain(chainKey)} style={{ padding: '8px 15px', borderRadius: '8px', border: '1px solid #666', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.85rem' }}>Select All</button>
                        <button onClick={() => zapChain(chainKey)} disabled={isZapping || selected.length === 0} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: selected.length > 0 ? 'linear-gradient(90deg, #FFD700, #FFA500)' : '#333', color: selected.length > 0 ? '#000' : '#666', cursor: selected.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '0.85rem' }}>⚡ Zap {selected.length} → USDC</button>
                      </>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chainAssets.map(asset => {
                    const key = `${asset.chainKey}-${asset.symbol}`;
                    const isUsdc = isUsdcToken(asset.symbol);
                    const isSel = selectedAssets.has(key);
                    const zapAmt = zapAmounts[key] || 0;
                    const feeAmt = zapAmt * FEE_PERCENT / 100;
                    
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: isSel ? 'rgba(255,215,0,0.1)' : 'rgba(0,0,0,0.2)', borderRadius: '10px', border: isSel ? '1px solid rgba(255,215,0,0.3)' : '1px solid transparent', flexWrap: 'wrap' }}>
                        {!isUsdc && <input type="checkbox" checked={isSel} onChange={() => toggleAssetSelection(key)} style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#FFD700' }} />}
                        
                        {/* TOKEN LOGO */}
                        <TokenIcon logo={asset.logo} symbol={asset.symbol} chainColor={asset.color} size={32} />
                        
                        <div style={{ flex: '1', minWidth: '120px' }}>
                          <div style={{ color: isUsdc ? '#4ade80' : '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {asset.symbol}
                            {asset.isNative && <span style={{ fontSize: '0.7rem', color: '#888' }}>(native)</span>}
                            {isUsdc && <span style={{ fontSize: '0.7rem', color: '#4ade80' }}>✓</span>}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.8rem' }}>{asset.balance.toFixed(asset.balance < 0.01 ? 6 : 4)} • ${asset.value.toFixed(2)}</div>
                        </div>
                        
                        {!isUsdc && isSel && (
                          <div style={{ flex: '2', minWidth: '200px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input type="range" min="0" max={asset.value} step={asset.value / 100} value={zapAmt} onChange={(e) => updateZapAmount(key, e.target.value)} style={{ flex: 1 }} />
                            <div style={{ minWidth: '90px', textAlign: 'right' }}>
                              <div style={{ color: '#FFD700', fontWeight: 'bold' }}>${zapAmt.toFixed(2)}</div>
                              <div style={{ color: '#888', fontSize: '0.7rem' }}>Fee: ${feeAmt.toFixed(2)}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bridge Tab */}
      {activeTab === 'bridge' && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '25px', border: '2px solid #4ade80' }}>
          <h2 style={{ color: '#4ade80', marginBottom: '20px', textAlign: 'center' }}>🌉 Bridge to PulseChain</h2>
          {bridgeStatus && <div style={{ padding: '15px', background: 'rgba(74,222,128,0.1)', borderRadius: '10px', marginBottom: '20px', color: '#4ade80', textAlign: 'center' }}>{bridgeStatus}</div>}
          {Object.keys(bridgeReady).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '2rem', marginBottom: '10px' }}>💫</div>
              <div>Zap tokens first!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.entries(bridgeReady).map(([chainKey, amount]) => {
                const chain = CHAIN_CONFIG[chainKey];
                return (
                  <div key={chainKey} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: `1px solid ${chain.color}50` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <TokenIcon logo={NATIVE_LOGOS[chainKey]} symbol={chain.symbol} chainColor={chain.color} size={36} />
                      <div>
                        <div style={{ color: '#fff', fontWeight: 'bold' }}>{chain.name}</div>
                        <div style={{ color: '#4ade80', fontSize: '0.9rem' }}>${formatNumber(amount)} USDC</div>
                      </div>
                    </div>
                    <button onClick={() => openBridge(chainKey)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #4ade80, #22c55e)', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>🌉 Bridge</button>
                  </div>
                );
              })}
            </div>
          )}
          <div style={{ marginTop: '20px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>💡 Liberty Swap • PulseChain (369)</div>
        </div>
      )}

      {/* Referral Tab */}
      {activeTab === 'referral' && (
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '25px', border: '2px solid #FF69B4' }}>
          <h2 style={{ color: '#FF69B4', marginBottom: '20px', textAlign: 'center' }}>🎁 Referral Program</h2>
          {walletAddress ? (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ color: '#FF69B4', fontWeight: 'bold', marginBottom: '8px' }}>🔗 Your Link</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" value={referralLink} readOnly style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '8px', border: '1px solid #FF69B4', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '0.8rem' }} />
                <button onClick={() => copyToClipboard(referralLink)} style={{ padding: '10px 15px', borderRadius: '8px', border: 'none', background: copySuccess ? '#4ade80' : 'linear-gradient(90deg, #FF69B4, #FFD700)', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>{copySuccess ? '✓ Copied!' : '📋 Copy'}</button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px', color: '#888' }}>Connect wallet for referral link</div>
          )}
        </div>
      )}

      {/* Zap Results */}
      {zapResults.length > 0 && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '25px', maxWidth: '400px', width: '100%', border: '2px solid #FFD700', maxHeight: '80vh', overflow: 'auto' }}>
            <h3 style={{ color: '#FFD700', marginBottom: '15px', textAlign: 'center' }}>⚡ Zap Results</h3>
            {zapResults.map((r, i) => (
              <div key={i} style={{ padding: '10px', borderRadius: '8px', marginBottom: '8px', background: r.success ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${r.success ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <TokenIcon logo={r.asset.logo} symbol={r.asset.symbol} chainColor={r.asset.color} size={24} />
                <span style={{ color: '#fff', flex: 1 }}>{r.asset.symbol}</span>
                <span style={{ color: r.success ? '#4ade80' : '#f87171', fontSize: '0.85rem' }}>{r.success ? '✅' : '❌'}</span>
              </div>
            ))}
            <div style={{ padding: '10px', background: 'rgba(74,222,128,0.1)', borderRadius: '8px', marginBottom: '15px', textAlign: 'center' }}>
              <div style={{ color: '#4ade80', fontSize: '0.85rem' }}>💰 {FEE_PERCENT}% fee → Growth Engine</div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setZapResults([])} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #666', background: 'transparent', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>Close</button>
              {zapResults.some(r => r.success) && (
                <button onClick={() => { setZapResults([]); setActiveTab('bridge'); }} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'linear-gradient(90deg, #4ade80, #22c55e)', color: '#000', cursor: 'pointer', fontWeight: 'bold' }}>🌉 Bridge</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zapping Overlay */}
      {isZapping && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: '15px', padding: '30px', textAlign: 'center', border: '2px solid #FFD700', maxWidth: '350px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }} className="zap-spinner">⚡</div>
            <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '10px' }}>Zapping {zapProgress.current}/{zapProgress.total}</div>
            {zapProgress.asset && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                <TokenIcon logo={zapProgress.asset.logo} symbol={zapProgress.asset.symbol} chainColor={zapProgress.asset.color} size={32} />
                <span style={{ color: '#fff' }}>{zapProgress.asset.symbol}</span>
              </div>
            )}
            <div style={{ color: '#888', fontSize: '0.9rem' }}>{zapProgress.status}</div>
            <div style={{ color: '#4ade80', fontSize: '0.8rem', marginTop: '10px' }}>{FEE_PERCENT}% → Growth Engine</div>
          </div>
        </div>
      )}

      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fbbf24;
          cursor: pointer;
          border: 2px solid #000;
        }
        @keyframes zapSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .zap-spinner {
          display: inline-block;
          animation: zapSpin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default ZapperXChain;
