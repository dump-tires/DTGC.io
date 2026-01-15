import React, { useState, useEffect } from 'react';

// ============================================
// DAPPER FLEX V6 - Multi-Chain Scanner + Zap + Referrals
// Scan → Zap dust to USDC → Bridge via Liberty Swap
// ============================================

const TEST_WALLETS = {
  vitalik: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
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

const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const CHAIN_CONFIG = {
  ethereum: {
    name: 'Ethereum', chainId: 1, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#627EEA',
    rpcs: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
    tokens: [
      { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18, coingeckoId: 'maker' },
      { symbol: 'SNX', address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', decimals: 18, coingeckoId: 'havven' },
      { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', decimals: 18, coingeckoId: 'curve-dao-token' },
      { symbol: 'LDO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', decimals: 18, coingeckoId: 'lido-dao' },
      { symbol: 'APE', address: '0x4d224452801ACEd8B2F0aebE155379bb5D594381', decimals: 18, coingeckoId: 'apecoin' },
      { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'MATIC', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', decimals: 18, coingeckoId: 'matic-network' },
      { symbol: 'FTM', address: '0x4E15361FD6b4BB609Fa63C81A2be19d873717870', decimals: 18, coingeckoId: 'fantom' },
      { symbol: 'SAND', address: '0x3845badAde8e6dFF049820680d1F14bD3903a5d0', decimals: 18, coingeckoId: 'the-sandbox' },
      { symbol: 'MANA', address: '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', decimals: 18, coingeckoId: 'decentraland' },
      { symbol: 'GRT', address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', decimals: 18, coingeckoId: 'the-graph' },
      { symbol: '1INCH', address: '0x111111111117dC0aa78b770fA6A738034120C302', decimals: 18, coingeckoId: '1inch' },
      { symbol: 'ENS', address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72', decimals: 18, coingeckoId: 'ethereum-name-service' },
      { symbol: 'COMP', address: '0xc00e94Cb662C3520282E6f5717214004A7f26888', decimals: 18, coingeckoId: 'compound-governance-token' },
      { symbol: 'BAT', address: '0x0D8775F648430679A709E98d2b0Cb6250d2887EF', decimals: 18, coingeckoId: 'basic-attention-token' },
      { symbol: 'SUSHI', address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2', decimals: 18, coingeckoId: 'sushi' },
    ]
  },
  bsc: {
    name: 'BNB Chain', chainId: 56, symbol: 'BNB', decimals: 18, coingeckoId: 'binancecoin', color: '#F3BA2F',
    rpcs: ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.binance.org', 'https://bsc-dataseed2.binance.org'],
    tokens: [
      { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'WBNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, coingeckoId: 'binancecoin' },
      { symbol: 'CAKE', address: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'ETH', address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'XRP', address: '0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE', decimals: 18, coingeckoId: 'ripple' },
      { symbol: 'ADA', address: '0x3EE2200Efb3400fAbB9AacF31297cBdD1d435D47', decimals: 18, coingeckoId: 'cardano' },
      { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', decimals: 8, coingeckoId: 'dogecoin' },
      { symbol: 'DOT', address: '0x7083609fCE4d1d8Dc0C979AAb8c869Ea2C873402', decimals: 18, coingeckoId: 'polkadot' },
      { symbol: 'LINK', address: '0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0xBf5140A22578168FD562DCcF235E5D43A02ce9B1', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'ATOM', address: '0x0Eb3a705fc54725037CC9e008bDede697f62F335', decimals: 18, coingeckoId: 'cosmos' },
      { symbol: 'LTC', address: '0x4338665CBB7B2485A8855A139b75D5e34AB0DB94', decimals: 18, coingeckoId: 'litecoin' },
      { symbol: 'FIL', address: '0x0D8Ce2A99Bb6e3B7Db580eD848240e4a0F9aE153', decimals: 18, coingeckoId: 'filecoin' },
      { symbol: 'FLOKI', address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', decimals: 9, coingeckoId: 'floki' },
      { symbol: 'BABYDOGE', address: '0xc748673057861a797275CD8A068AbB95A902e8de', decimals: 9, coingeckoId: 'baby-doge-coin' },
    ]
  },
  polygon: {
    name: 'Polygon', chainId: 137, symbol: 'MATIC', decimals: 18, coingeckoId: 'matic-network', color: '#8247E5',
    rpcs: ['https://polygon-rpc.com', 'https://polygon.llamarpc.com', 'https://1rpc.io/matic'],
    tokens: [
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, coingeckoId: 'matic-network' },
      { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK', address: '0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'AAVE', address: '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'CRV', address: '0x172370d5Cd63279eFa6d502DAB29171933a610AF', decimals: 18, coingeckoId: 'curve-dao-token' },
      { symbol: 'SUSHI', address: '0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a', decimals: 18, coingeckoId: 'sushi' },
      { symbol: 'GRT', address: '0x5fe2B58c013d7601147DcdD68C143A77499f5531', decimals: 18, coingeckoId: 'the-graph' },
      { symbol: 'SAND', address: '0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683', decimals: 18, coingeckoId: 'the-sandbox' },
      { symbol: 'MANA', address: '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4', decimals: 18, coingeckoId: 'decentraland' },
      { symbol: 'BAL', address: '0x9a71012B13CA4d3D0Cdc72A177DF3ef03b0E76A3', decimals: 18, coingeckoId: 'balancer' },
    ]
  },
  arbitrum: {
    name: 'Arbitrum', chainId: 42161, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#28A0F0',
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com', 'https://1rpc.io/arb'],
    tokens: [
      { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'ARB', address: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'GMX', address: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' },
      { symbol: 'LINK', address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'UNI', address: '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'CRV', address: '0x11cDb42B0EB46D95f990BeDD4695A6e3fA034978', decimals: 18, coingeckoId: 'curve-dao-token' },
      { symbol: 'RDNT', address: '0x3082CC23568eA640225c2467653dB90e9250AaA0', decimals: 18, coingeckoId: 'radiant-capital' },
      { symbol: 'MAGIC', address: '0x539bdE0d7Dbd336b79148AA742883198BBF60342', decimals: 18, coingeckoId: 'magic' },
      { symbol: 'PENDLE', address: '0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8', decimals: 18, coingeckoId: 'pendle' },
      { symbol: 'GNS', address: '0x18c11FD286C5EC11c3b683Caa813B77f5163A122', decimals: 18, coingeckoId: 'gains-network' },
    ]
  },
  avalanche: {
    name: 'Avalanche', chainId: 43114, symbol: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2', color: '#E84142',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com', 'https://1rpc.io/avax/c'],
    tokens: [
      { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDT.e', address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WAVAX', address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', decimals: 18, coingeckoId: 'avalanche-2' },
      { symbol: 'WETH.e', address: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC.e', address: '0x50b7545627a5162F82A992c33b87aDc75187B218', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'DAI.e', address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK.e', address: '0x5947BB275c521040051D82396192181b413227A3', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'AAVE.e', address: '0x63a72806098Bd3D9520cC43356dD78afe5D386D9', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'JOE', address: '0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd', decimals: 18, coingeckoId: 'joe' },
      { symbol: 'PNG', address: '0x60781C2586D68229fde47564546784ab3fACA982', decimals: 18, coingeckoId: 'pangolin' },
      { symbol: 'GMX', address: '0x62edc0692BD897D2295872a9FFCac5425011c661', decimals: 18, coingeckoId: 'gmx' },
    ]
  },
  optimism: {
    name: 'Optimism', chainId: 10, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#FF0420',
    rpcs: ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com', 'https://1rpc.io/op'],
    tokens: [
      { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDC.e', address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'WBTC', address: '0x68f180fcCe6836688e9084f035309E29Bf0A2095', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
      { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'LINK', address: '0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'SNX', address: '0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4', decimals: 18, coingeckoId: 'havven' },
      { symbol: 'AAVE', address: '0x76FB31fb4af56892A25e32cFC43De717950c9278', decimals: 18, coingeckoId: 'aave' },
      { symbol: 'CRV', address: '0x0994206dfE8De6Ec6920FF4D779B0d950605Fb53', decimals: 18, coingeckoId: 'curve-dao-token' },
      { symbol: 'VELO', address: '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db', decimals: 18, coingeckoId: 'velodrome-finance' },
      { symbol: 'PERP', address: '0x9e1028F5F1D5eDE59748FFceE5532509976840E0', decimals: 18, coingeckoId: 'perpetual-protocol' },
    ]
  },
  base: {
    name: 'Base', chainId: 8453, symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum', color: '#0052FF',
    rpcs: ['https://mainnet.base.org', 'https://base.llamarpc.com', 'https://1rpc.io/base'],
    tokens: [
      { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDbC', address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18, coingeckoId: 'ethereum' },
      { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18, coingeckoId: 'coinbase-wrapped-staked-eth' },
      { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
      { symbol: 'BRETT', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, coingeckoId: 'brett' },
      { symbol: 'TOSHI', address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', decimals: 18, coingeckoId: 'toshi' },
      { symbol: 'DEGEN', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, coingeckoId: 'degen-base' },
      { symbol: 'HIGHER', address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', decimals: 18, coingeckoId: 'higher' },
    ]
  }
};

// RPC helpers
const rpcCall = async (rpcUrl, method, params) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

const tryRpcs = async (rpcs, method, params) => {
  for (const rpc of rpcs) {
    try { return await rpcCall(rpc, method, params); } catch (e) { continue; }
  }
  throw new Error('All RPCs failed');
};

const BALANCE_OF_SELECTOR = '0x70a08231';

const DapperFlexV6 = ({ connectedAddress: propAddress }) => {
  // Core state
  const [activeTab, setActiveTab] = useState('crosschain');
  const [assets, setAssets] = useState([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, chain: '' });
  const [minValue, setMinValue] = useState(0);
  const [prices, setPrices] = useState({});
  const [walletAddress, setWalletAddress] = useState(propAddress || null);
  const [scanLog, setScanLog] = useState([]);
  const [swapStatus, setSwapStatus] = useState({});
  const [selectedAssets, setSelectedAssets] = useState(new Set());
  
  // Referral state
  const [referrer, setReferrer] = useState(null);
  const [referralStats, setReferralStats] = useState({ totalReferrals: 0, volumeGenerated: 0, earnings: 0 });
  const [copySuccess, setCopySuccess] = useState(false);

  // Detect referral from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref && ref.startsWith('0x') && ref.length === 42) {
      setReferrer(ref);
      localStorage.setItem('dapperflexReferrer', ref);
      // Track click
      const clicks = parseInt(localStorage.getItem(`dapperflex_clicks_${ref}`) || '0');
      localStorage.setItem(`dapperflex_clicks_${ref}`, (clicks + 1).toString());
      console.log('🎁 Referrer detected:', ref);
    } else {
      const storedRef = localStorage.getItem('dapperflexReferrer');
      if (storedRef) setReferrer(storedRef);
    }
  }, []);

  // Load referral stats
  useEffect(() => {
    if (walletAddress) {
      const stats = {
        totalReferrals: parseInt(localStorage.getItem(`dapperflex_signups_${walletAddress}`) || '0'),
        clicks: parseInt(localStorage.getItem(`dapperflex_clicks_${walletAddress}`) || '0'),
        volumeGenerated: parseFloat(localStorage.getItem(`dapperflex_volume_${walletAddress}`) || '0'),
        earnings: parseFloat(localStorage.getItem(`dapperflex_earnings_${walletAddress}`) || '0')
      };
      setReferralStats(stats);
    }
  }, [walletAddress]);

  // Track referral action (call when user bridges/zaps)
  const trackReferralAction = (volumeUsd) => {
    if (referrer && walletAddress && referrer.toLowerCase() !== walletAddress.toLowerCase()) {
      // Track signup (first action)
      const hasSignedUp = localStorage.getItem(`dapperflex_signedup_${walletAddress}`);
      if (!hasSignedUp) {
        const signups = parseInt(localStorage.getItem(`dapperflex_signups_${referrer}`) || '0');
        localStorage.setItem(`dapperflex_signups_${referrer}`, (signups + 1).toString());
        localStorage.setItem(`dapperflex_signedup_${walletAddress}`, 'true');
      }
      
      // Track volume & earnings (5% of volume)
      const currentVolume = parseFloat(localStorage.getItem(`dapperflex_volume_${referrer}`) || '0');
      const currentEarnings = parseFloat(localStorage.getItem(`dapperflex_earnings_${referrer}`) || '0');
      localStorage.setItem(`dapperflex_volume_${referrer}`, (currentVolume + volumeUsd).toString());
      localStorage.setItem(`dapperflex_earnings_${referrer}`, (currentEarnings + volumeUsd * 0.05).toString());
      
      console.log('📊 Referral action tracked:', { referrer, volume: volumeUsd, earning: volumeUsd * 0.05 });
    }
  };

  // Detect wallet
  useEffect(() => {
    const detectWallet = async () => {
      if (propAddress) { setWalletAddress(propAddress); return; }
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts?.[0]) setWalletAddress(accounts[0]);
        } catch (e) {}
      }
    };
    detectWallet();
  }, [propAddress]);

  // Fetch prices
  const fetchPrices = async () => {
    try {
      const ids = 'ethereum,binancecoin,matic-network,avalanche-2,optimism,arbitrum,tether,usd-coin,chainlink,uniswap,shiba-inu,pancakeswap-token,wrapped-bitcoin,dai,aave,maker,havven,curve-dao-token,lido-dao,apecoin,pepe,fantom,the-sandbox,decentraland,the-graph,1inch,ethereum-name-service,compound-governance-token,basic-attention-token,sushi,binance-usd,ripple,cardano,dogecoin,polkadot,cosmos,litecoin,filecoin,floki,baby-doge-coin,balancer,gmx,radiant-capital,magic,pendle,gains-network,joe,pangolin,velodrome-finance,perpetual-protocol,coinbase-wrapped-staked-eth,aerodrome-finance,brett,toshi,degen-base,higher';
      const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);
      if (response.ok) { const data = await response.json(); setPrices(data); return data; }
    } catch (e) { console.log('Price fetch error, using fallbacks'); }
    return { 
      'ethereum': { usd: 3300 }, 'binancecoin': { usd: 650 }, 'matic-network': { usd: 0.5 }, 
      'avalanche-2': { usd: 35 }, 'optimism': { usd: 2 }, 'arbitrum': { usd: 1 },
      'tether': { usd: 1 }, 'usd-coin': { usd: 1 }, 'dai': { usd: 1 }, 'binance-usd': { usd: 1 },
      'wrapped-bitcoin': { usd: 95000 }, 'chainlink': { usd: 15 }, 'uniswap': { usd: 8 },
      'aave': { usd: 180 }, 'maker': { usd: 1500 }, 'curve-dao-token': { usd: 0.5 },
      'shiba-inu': { usd: 0.00001 }, 'pepe': { usd: 0.00001 }, 'dogecoin': { usd: 0.08 },
      'pancakeswap-token': { usd: 2 }, 'gmx': { usd: 30 }, 'sushi': { usd: 1 }
    };
  };

  // Get balances
  const getNativeBalance = async (chain, address) => {
    try {
      const result = await tryRpcs(chain.rpcs, 'eth_getBalance', [address, 'latest']);
      if (!result || result === '0x0') return 0;
      return Number(BigInt(result)) / Math.pow(10, chain.decimals);
    } catch (e) { return 0; }
  };

  const getTokenBalance = async (chain, tokenAddress, walletAddr, decimals) => {
    try {
      const paddedAddress = walletAddr.slice(2).toLowerCase().padStart(64, '0');
      const result = await tryRpcs(chain.rpcs, 'eth_call', [{ to: tokenAddress, data: BALANCE_OF_SELECTOR + paddedAddress }, 'latest']);
      if (!result || result === '0x') return 0;
      return Number(BigInt(result)) / Math.pow(10, decimals);
    } catch (e) { return 0; }
  };

  // Scan chain
  const scanChain = async (chainKey, address, currentPrices) => {
    const chain = CHAIN_CONFIG[chainKey];
    const foundAssets = [];
    
    const nativeBalance = await getNativeBalance(chain, address);
    if (nativeBalance > 0.000001) {
      const price = currentPrices[chain.coingeckoId]?.usd || 0;
      foundAssets.push({
        chain: chain.name, chainKey, symbol: chain.symbol, balance: nativeBalance,
        value: nativeBalance * price, price, isNative: true, color: chain.color,
        decimals: chain.decimals, tokenAddress: NATIVE_TOKEN, chainId: chain.chainId
      });
    }

    for (const token of chain.tokens) {
      const balance = await getTokenBalance(chain, token.address, address, token.decimals);
      if (balance > 0.000001) {
        const price = currentPrices[token.coingeckoId]?.usd || 0;
        foundAssets.push({
          chain: chain.name, chainKey, symbol: token.symbol, balance,
          value: balance * price, price, isNative: false, color: chain.color,
          address: token.address, decimals: token.decimals, tokenAddress: token.address,
          chainId: chain.chainId
        });
      }
    }
    return foundAssets;
  };

  // Main scan
  const scanAllChains = async (testAddress = null) => {
    let addressToScan = testAddress || walletAddress;
    if (!addressToScan && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts?.[0]) { addressToScan = accounts[0]; setWalletAddress(accounts[0]); }
      } catch (e) {}
    }
    if (!addressToScan) { setScanError('Please connect your wallet'); return; }

    setIsScanning(true);
    setScanError(null);
    setAssets([]);
    setTotalValue(0);
    setScanLog(['Starting scan...']);
    setSelectedAssets(new Set());

    const chains = Object.keys(CHAIN_CONFIG);
    setScanProgress({ current: 0, total: chains.length, chain: 'Loading prices...' });

    try {
      const currentPrices = await fetchPrices();
      const allAssets = [];
      
      for (let i = 0; i < chains.length; i++) {
        const chainKey = chains[i];
        const chain = CHAIN_CONFIG[chainKey];
        setScanProgress({ current: i + 1, total: chains.length, chain: chain.name });
        setScanLog(prev => [...prev.slice(-5), `🔍 ${chain.name}...`]);
        
        try {
          const chainAssets = await scanChain(chainKey, addressToScan, currentPrices);
          if (chainAssets.length > 0) {
            allAssets.push(...chainAssets);
            setScanLog(prev => [...prev.slice(-5), `✅ ${chain.name}: ${chainAssets.length}`]);
          }
        } catch (error) {
          setScanLog(prev => [...prev.slice(-5), `⚠️ ${chain.name}: error`]);
        }
        
        setAssets([...allAssets].sort((a, b) => b.value - a.value));
        setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      }

      setAssets(allAssets.sort((a, b) => b.value - a.value));
      setTotalValue(allAssets.reduce((s, a) => s + a.value, 0));
      setScanLog(prev => [...prev, `🎉 Found ${allAssets.length} assets`]);
    } catch (error) {
      setScanError('Scan failed: ' + error.message);
    } finally {
      setIsScanning(false);
    }
  };

  // Switch network
  const switchNetwork = async (chainId) => {
    if (!window.ethereum) throw new Error('No wallet');
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x' + chainId.toString(16) }]
    });
  };

  // Zap to USDC via 1inch
  const zapToUsdc = async (asset) => {
    if (['USDC', 'USDC.e', 'USDbC'].includes(asset.symbol)) {
      alert('Already USDC! Just bridge it via Liberty Swap.');
      return;
    }

    try {
      const chain = CHAIN_CONFIG[asset.chainKey];
      const usdcAddress = USDC_ADDRESSES[asset.chainKey];
      
      await switchNetwork(chain.chainId);
      
      const fromToken = asset.isNative ? 'ETH' : asset.tokenAddress;
      const oneInchUrl = `https://app.1inch.io/#/${chain.chainId}/simple/swap/${fromToken}/${usdcAddress}`;
      
      // Track referral
      trackReferralAction(asset.value);
      
      window.open(oneInchUrl, '_blank');
      alert(`Opening 1inch to swap ${asset.balance.toFixed(4)} ${asset.symbol} to USDC.\n\nAfter swapping, bridge via Liberty Swap!`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  // Toggle selection
  const toggleAssetSelection = (assetKey) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetKey)) newSet.delete(assetKey);
      else newSet.add(assetKey);
      return newSet;
    });
  };

  // Batch zap
  const batchZapToUsdc = () => {
    if (selectedAssets.size === 0) { alert('Select assets first'); return; }
    
    const selectedList = assets.filter(a => selectedAssets.has(`${a.chainKey}-${a.symbol}`));
    const byChain = {};
    selectedList.forEach(asset => {
      if (!byChain[asset.chainKey]) byChain[asset.chainKey] = [];
      byChain[asset.chainKey].push(asset);
    });

    Object.keys(byChain).forEach(chainKey => {
      const chain = CHAIN_CONFIG[chainKey];
      const largest = byChain[chainKey].sort((a, b) => b.value - a.value)[0];
      const fromToken = largest.isNative ? 'ETH' : largest.tokenAddress;
      window.open(`https://app.1inch.io/#/${chain.chainId}/simple/swap/${fromToken}/${USDC_ADDRESSES[chainKey]}`, '_blank');
    });

    // Track referral
    const totalVol = selectedList.reduce((s, a) => s + a.value, 0);
    trackReferralAction(totalVol);
    
    alert(`Opened 1inch for ${Object.keys(byChain).length} chain(s).`);
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const isUsdcToken = (symbol) => ['USDC', 'USDC.e', 'USDbC'].includes(symbol);
  const filteredAssets = assets.filter(a => a.value >= minValue);
  const nonUsdcAssets = filteredAssets.filter(a => !isUsdcToken(a.symbol));
  const usdcAssets = filteredAssets.filter(a => isUsdcToken(a.symbol));
  const totalUsdcValue = usdcAssets.reduce((s, a) => s + a.value, 0);
  const uniqueChains = [...new Set(filteredAssets.map(a => a.chain))].length;

  const formatNumber = (num, decimals = 2) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    if (num < 0.01 && num > 0) return num.toFixed(6);
    return num.toFixed(decimals);
  };

  const referralLink = walletAddress ? `${window.location.origin}/dapperflex?ref=${walletAddress}` : '';

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30,20,40,0.95) 0%, rgba(20,10,30,0.98) 100%)',
      borderRadius: '20px', padding: '30px', maxWidth: '900px', margin: '0 auto',
      border: '2px solid rgba(255,215,0,0.3)', boxShadow: '0 0 40px rgba(255,215,0,0.1)'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '25px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
          <span style={{ fontSize: '2.5rem' }}>⭐</span>
          <h2 style={{
            fontSize: '2rem', fontWeight: 'bold',
            background: 'linear-gradient(90deg, #FFD700, #FFA500, #FFD700)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0
          }}>DAPPER FLEX V6</h2>
          <span style={{ fontSize: '2.5rem' }}>⭐</span>
        </div>
        <p style={{ color: '#aaa', marginTop: '8px' }}>💜⭐ Scan → Zap to USDC → Bridge to PulseChain ⭐💜</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
        {[
          { label: 'Total Found', value: `$${formatNumber(totalValue)}`, color: '#4ade80' },
          { label: 'Ready (USDC)', value: `$${formatNumber(totalUsdcValue)}`, color: '#60a5fa' },
          { label: 'Need Zap', value: nonUsdcAssets.length.toString(), color: '#fbbf24' },
          { label: 'Chains', value: uniqueChains.toString(), color: '#f87171' }
        ].map((stat, i) => (
          <div key={i} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '15px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '5px' }}>{stat.label}</div>
            <div style={{ color: stat.color, fontSize: '1.2rem', fontWeight: 'bold' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {[
          { id: 'crosschain', label: '🌐 Cross-Chain', color: '#4ade80' },
          { id: 'pulsechain', label: '💜 PulseChain', color: '#9333ea' },
          { id: 'stakes', label: '📊 Stakes', color: '#60a5fa' },
          { id: 'refer', label: '💝 Refer', color: '#f472b6' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px', borderRadius: '10px',
            border: activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
            background: activeTab === tab.id ? `${tab.color}22` : 'rgba(0,0,0,0.3)',
            color: activeTab === tab.id ? tab.color : '#888', cursor: 'pointer', fontWeight: 'bold'
          }}>{tab.label}</button>
        ))}
      </div>

      {scanError && (
        <div style={{ background: 'rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px', marginBottom: '20px', color: '#fca5a5', textAlign: 'center' }}>
          {scanError}
        </div>
      )}

      {/* Cross-Chain Tab */}
      {activeTab === 'crosschain' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '20px', border: '1px solid rgba(255,215,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ color: '#FFD700', margin: 0 }}>⭐ OFF-CHAIN ASSETS</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { alert('🔬 Vitalik Wallet Scan\n\nScanning Vitalik\'s wallet to demonstrate the cross-chain scanner capabilities!'); scanAllChains(TEST_WALLETS.vitalik); }} disabled={isScanning} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #666', background: 'rgba(0,0,0,0.5)', color: '#888', cursor: 'pointer', fontSize: '0.8rem' }}>🧪 Test Vitalik</button>
              <button onClick={() => scanAllChains()} disabled={isScanning} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: isScanning ? 'rgba(255,215,0,0.3)' : 'linear-gradient(90deg, #FFD700, #FFA500)', color: isScanning ? '#FFD700' : '#000', cursor: isScanning ? 'wait' : 'pointer', fontWeight: 'bold' }}>
                {isScanning ? '🔄 Scanning...' : '🔄 Rescan All'}
              </button>
            </div>
          </div>

          {walletAddress && <div style={{ fontSize: '0.8rem', color: '#4ade80', marginBottom: '15px' }}>✅ {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</div>}

          {isScanning && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#888' }}>
                <span>{scanProgress.chain}</span>
                <span>{scanProgress.current}/{scanProgress.total}</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden', marginTop: '5px' }}>
                <div style={{ height: '100%', width: `${(scanProgress.current / scanProgress.total) * 100}%`, background: 'linear-gradient(90deg, #FFD700, #FFA500)' }} />
              </div>
            </div>
          )}

          {nonUsdcAssets.length > 0 && (
            <div style={{ background: 'rgba(255,215,0,0.1)', borderRadius: '10px', padding: '15px', marginBottom: '20px', border: '1px solid rgba(255,215,0,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ color: '#FFD700', fontWeight: 'bold' }}>⚡ Zap Dust to USDC</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>{selectedAssets.size > 0 ? `${selectedAssets.size} selected` : 'Select tokens or zap individually'}</div>
                </div>
                <button onClick={batchZapToUsdc} disabled={selectedAssets.size === 0} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: selectedAssets.size > 0 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'rgba(100,100,100,0.3)', color: selectedAssets.size > 0 ? '#000' : '#666', cursor: selectedAssets.size > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}>
                  ⚡ Zap Selected ({selectedAssets.size})
                </button>
              </div>
            </div>
          )}

          {/* USDC Ready */}
          {usdcAssets.length > 0 && (
            <>
              <div style={{ color: '#4ade80', fontWeight: 'bold', marginBottom: '10px' }}>✅ READY TO BRIDGE (${formatNumber(totalUsdcValue)})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {usdcAssets.map((asset, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(74,222,128,0.1)', borderRadius: '10px', border: '1px solid rgba(74,222,128,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: '#4ade8022', border: '2px solid #4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4ade80', fontWeight: 'bold' }}>$</div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{asset.symbol} ✓</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{asset.chain}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: '#4ade80' }}>${formatNumber(asset.value)}</div>
                      </div>
                      <a href="https://libertyswap.finance" target="_blank" rel="noopener noreferrer" onClick={() => trackReferralAction(asset.value)} style={{ padding: '8px 12px', borderRadius: '8px', background: 'linear-gradient(90deg, #4ade80, #22c55e)', color: '#000', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold' }}>Bridge →</a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Needs Zap */}
          {nonUsdcAssets.length > 0 && (
            <>
              <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '10px' }}>⚡ NEEDS ZAP ({nonUsdcAssets.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nonUsdcAssets.map((asset, i) => {
                  const assetKey = `${asset.chainKey}-${asset.symbol}`;
                  const isSelected = selectedAssets.has(assetKey);
                  return (
                    <div key={i} onClick={() => toggleAssetSelection(assetKey)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: isSelected ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.3)', borderRadius: '10px', border: isSelected ? '2px solid #fbbf24' : `1px solid ${asset.color}33`, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', border: '2px solid #fbbf24', background: isSelected ? '#fbbf24' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>{isSelected && '✓'}</div>
                        <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: `${asset.color}22`, border: `2px solid ${asset.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: asset.color, fontWeight: 'bold' }}>{asset.symbol.charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>{asset.symbol} {asset.isNative && <span style={{ fontSize: '0.7rem', background: asset.color, color: '#000', padding: '2px 6px', borderRadius: '4px' }}>NATIVE</span>}</div>
                          <div style={{ fontSize: '0.8rem', color: '#888' }}>{asset.chain}</div>
                          {asset.address && <div style={{ fontSize: '0.7rem', color: '#666', fontFamily: 'monospace' }}>{asset.address.slice(0,6)}...{asset.address.slice(-4)}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold', color: '#fbbf24' }}>${formatNumber(asset.value)}</div>
                          <div style={{ fontSize: '0.8rem', color: '#888' }}>{formatNumber(asset.balance, 6)}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); zapToUsdc(asset); }} style={{ padding: '8px 12px', borderRadius: '8px', background: 'linear-gradient(90deg, #f59e0b, #d97706)', color: '#000', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>⚡ Zap</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {filteredAssets.length === 0 && !isScanning && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '15px', opacity: 0.5 }}>🌐</div>
              <div style={{ fontSize: '1.1rem' }}>No off-chain assets found</div>
              <div style={{ fontSize: '0.9rem' }}>Click "Rescan All" or test with Vitalik's wallet</div>
            </div>
          )}
        </div>
      )}

      {/* PulseChain Tab */}
      {activeTab === 'pulsechain' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px solid rgba(147,51,234,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>💜</div>
          <h3 style={{ color: '#9333ea', marginBottom: '10px' }}>PulseChain Assets</h3>
          <p style={{ color: '#888' }}>Your PulseChain tokens are on the main dashboard</p>
        </div>
      )}

      {/* Stakes Tab */}
      {activeTab === 'stakes' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '40px', textAlign: 'center', border: '1px solid rgba(96,165,250,0.3)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📊</div>
          <h3 style={{ color: '#60a5fa', marginBottom: '10px' }}>Flex Stakes</h3>
          <p style={{ color: '#888' }}>Stake cross-chain LP for 10% APR</p>
        </div>
      )}

      {/* Referral Tab */}
      {activeTab === 'refer' && (
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '25px', border: '1px solid rgba(244,114,182,0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <div style={{ fontSize: '3rem', marginBottom: '10px' }}>💝</div>
            <h3 style={{ color: '#f472b6', marginBottom: '5px', fontSize: '1.5rem' }}>Referral Program</h3>
            <p style={{ color: '#888', fontSize: '0.9rem' }}>Earn 5% of fees from users you refer!</p>
          </div>

          {walletAddress ? (
            <>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
                <div style={{ background: 'rgba(244,114,182,0.1)', borderRadius: '12px', padding: '20px', textAlign: 'center', border: '1px solid rgba(244,114,182,0.3)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f472b6' }}>{referralStats.clicks || 0}</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>Link Clicks</div>
                </div>
                <div style={{ background: 'rgba(74,222,128,0.1)', borderRadius: '12px', padding: '20px', textAlign: 'center', border: '1px solid rgba(74,222,128,0.3)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4ade80' }}>{referralStats.totalReferrals || 0}</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>Signups</div>
                </div>
                <div style={{ background: 'rgba(255,215,0,0.1)', borderRadius: '12px', padding: '20px', textAlign: 'center', border: '1px solid rgba(255,215,0,0.3)' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FFD700' }}>${(referralStats.earnings || 0).toFixed(2)}</div>
                  <div style={{ color: '#888', fontSize: '0.85rem' }}>Earnings</div>
                </div>
              </div>

              {/* Referral Link */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ color: '#f472b6', fontWeight: 'bold', marginBottom: '10px' }}>🔗 Your Referral Link</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="text" readOnly value={referralLink} style={{ flex: 1, minWidth: '200px', padding: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(244,114,182,0.3)', color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace' }} />
                  <button onClick={() => copyToClipboard(referralLink)} style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', background: copySuccess ? '#4ade80' : 'linear-gradient(90deg, #f472b6, #ec4899)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>
                    {copySuccess ? '✓ Copied!' : '📋 Copy'}
                  </button>
                </div>
                
                {/* Share buttons */}
                <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <a href={`https://twitter.com/intent/tweet?text=Scan%20%26%20bridge%20dust%20to%20PulseChain%20with%20Dapper%20Flex%20V6!&url=${encodeURIComponent(referralLink)}`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 15px', borderRadius: '8px', background: '#000', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #333' }}>𝕏 Share</a>
                  <a href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Scan%20%26%20bridge%20dust%20to%20PulseChain!`} target="_blank" rel="noopener noreferrer" style={{ padding: '10px 15px', borderRadius: '8px', background: '#0088cc', color: '#fff', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold' }}>✈️ Telegram</a>
                </div>
              </div>

              {/* Referral Code */}
              <div style={{ background: 'rgba(255,215,0,0.1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid rgba(255,215,0,0.3)' }}>
                <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '10px' }}>🎫 Your Referral Code</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ padding: '15px 25px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '2px dashed #FFD700', fontFamily: 'monospace', fontSize: '1.3rem', color: '#FFD700', letterSpacing: '3px' }}>
                    {walletAddress.slice(2, 10).toUpperCase()}
                  </div>
                  <button onClick={() => copyToClipboard(walletAddress.slice(2, 10).toUpperCase())} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #FFD700', background: 'transparent', color: '#FFD700', cursor: 'pointer' }}>📋</button>
                </div>
              </div>

              {/* Claim Button */}
              {referralStats.earnings > 0 && (
                <button onClick={() => alert('Claiming coming soon! Earnings will be claimable when referral contract is deployed.')} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: 'linear-gradient(90deg, #4ade80, #22c55e)', color: '#000', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '20px' }}>
                  💰 Claim ${(referralStats.earnings || 0).toFixed(2)}
                </button>
              )}

              {/* How It Works */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px' }}>
                <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '15px' }}>📖 How It Works</div>
                {[
                  { icon: '🔗', text: 'Share your unique referral link with friends' },
                  { icon: '💰', text: 'When they scan & bridge, you earn 5% of fees' },
                  { icon: '📈', text: 'Track clicks, signups & earnings in real-time' },
                  { icon: '💎', text: 'Claim rewards directly to your wallet' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                    <span style={{ color: '#ccc', fontSize: '0.9rem' }}>{item.text}</span>
                  </div>
                ))}
              </div>

              {/* Tiers */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '12px', padding: '20px', marginTop: '20px' }}>
                <div style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '15px' }}>🏆 Referral Tiers</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {[
                    { tier: 'Bronze', refs: '1-10', bonus: '5%', color: '#cd7f32' },
                    { tier: 'Silver', refs: '11-50', bonus: '7%', color: '#c0c0c0' },
                    { tier: 'Gold', refs: '50+', bonus: '10%', color: '#FFD700' },
                  ].map((t, i) => (
                    <div key={i} style={{ background: `${t.color}11`, borderRadius: '10px', padding: '15px', textAlign: 'center', border: `1px solid ${t.color}44` }}>
                      <div style={{ color: t.color, fontWeight: 'bold' }}>{t.tier}</div>
                      <div style={{ color: '#888', fontSize: '0.75rem' }}>{t.refs} refs</div>
                      <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '0.9rem' }}>{t.bonus}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px' }}>
              <div style={{ color: '#888', marginBottom: '10px' }}>Connect your wallet to generate a referral link</div>
              <div style={{ color: '#666', fontSize: '0.85rem' }}>Your wallet address = your unique referral code</div>
            </div>
          )}

          {/* Referred By */}
          {referrer && (
            <div style={{ background: 'rgba(74,222,128,0.1)', borderRadius: '12px', padding: '15px', marginTop: '20px', border: '1px solid rgba(74,222,128,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.2rem' }}>🤝</span>
                <div>
                  <div style={{ color: '#4ade80', fontWeight: 'bold' }}>You were referred by</div>
                  <div style={{ color: '#888', fontSize: '0.85rem', fontFamily: 'monospace' }}>{referrer.slice(0, 6)}...{referrer.slice(-4)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bridge Section */}
      <div style={{ marginTop: '25px', background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '25px', textAlign: 'center', border: '1px solid rgba(255,215,0,0.2)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>🌉</div>
        <h3 style={{ color: '#FFD700', marginBottom: '8px' }}>Bridge USDC via Liberty Swap</h3>
        <p style={{ color: '#888', marginBottom: '15px', fontSize: '0.9rem' }}>After zapping to USDC, bridge to PulseChain</p>
        <a href="https://libertyswap.finance" target="_blank" rel="noopener noreferrer" onClick={() => trackReferralAction(0)} style={{ display: 'inline-block', padding: '12px 30px', background: 'linear-gradient(90deg, #FFD700, #FFA500)', color: '#000', borderRadius: '10px', textDecoration: 'none', fontWeight: 'bold' }}>Open Liberty Swap →</a>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-emoji { display: inline-block; animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
};

export default DapperFlexV6;
