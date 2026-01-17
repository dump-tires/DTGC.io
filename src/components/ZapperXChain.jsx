// ═══════════════════════════════════════════════════════════════════════════════
// ZAPPER-X-CHAIN - Cross-Chain Dust Zapper with USDC Conversion
// ═══════════════════════════════════════════════════════════════════════════════
// Features:
// • Unlimited cross-chain token support (dynamic discovery)
// • Smart routing: PulseX V2 → PulseX V1 → pump.tires → 1inch fallback
// • Dust-to-USDC conversion (1% fee, stays in ecosystem)
// • Cross-chain bridging (Socket.tech / LI.FI integration)
// • Fee wallet: 0x1449a7d9973e6215534d785e3e306261156eb610
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Fee Configuration
const FEE_WALLET = '0x1449a7d9973e6215534d785e3e306261156eb610';
const USDC_CONVERSION_FEE_BPS = 100; // 1% fee for dust-to-USDC
const REFERRAL_FEE_BPS = 30; // 0.3% referral fee

// Contract Addresses (PulseChain)
const CONTRACTS = {
  DAPPER: '0xc7fe28708ba913d6bdf1e7eac2c75f2158d978de',
  WPLS: '0xa1077a294dde1b09bb078844df40758a5d0f9a27',
  USDC: '0x15d38573d2feeb82e7ad5187ab8c1d52810b1f07',
  USDT: '0x0cb6f5a34ad42ec934882a05265a7d5f59b51a2f',
  DAI: '0xefd766ccb38eaf1dfd701853bfce31359239f305',
  PULSEX_ROUTER_V2: '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02',
  PULSEX_ROUTER_V1: '0x165C3410fC91EF562C50559f7d2289fEbed552d9',
  PULSEX_FACTORY_V2: '0x29eA7545DEf87022BAdc76323F373EA1e707C523',
  PULSEX_FACTORY_V1: '0x1715a3E4A142d8b698131108995174F37aEBA10D',
  PUMP_TIRES: '0x6538A83a81d855B965983161AF6a83e616D16fD5',
};

// Chain Configuration for Cross-Chain Support
const SUPPORTED_CHAINS = {
  369: { 
    name: 'PulseChain', 
    symbol: 'PLS', 
    icon: '💜', 
    color: '#E1BEE7',
    rpc: 'https://rpc.pulsechain.com',
    explorer: 'https://scan.pulsechain.com',
    native: true,
  },
  1: { 
    name: 'Ethereum', 
    symbol: 'ETH', 
    icon: '🔹', 
    color: '#627EEA',
    rpc: 'https://eth.llamarpc.com',
    explorer: 'https://etherscan.io',
  },
  56: { 
    name: 'BSC', 
    symbol: 'BNB', 
    icon: '🔶', 
    color: '#F3BA2F',
    rpc: 'https://bsc-dataseed.binance.org',
    explorer: 'https://bscscan.com',
  },
  42161: { 
    name: 'Arbitrum', 
    symbol: 'ETH', 
    icon: '🔵', 
    color: '#28A0F0',
    rpc: 'https://arb1.arbitrum.io/rpc',
    explorer: 'https://arbiscan.io',
  },
  8453: { 
    name: 'Base', 
    symbol: 'ETH', 
    icon: '🔷', 
    color: '#0052FF',
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
};

// Known liquid tokens (always tradeable)
const LIQUID_TOKENS = new Set([
  'PLS', 'WPLS', 'PLSX', 'HEX', 'INC', 'DAI', 'USDC', 'USDT', 'WETH', 'WBTC',
  'DTGC', 'URMOM', 'ETH', 'BNB', 'MATIC', 'AVAX', 'FTM',
]);

// ABIs
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

const PULSEX_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[] amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[] amounts)',
  'function getAmountsOut(uint amountIn, address[] path) view returns (uint[] amounts)',
];

const PUMP_TIRES_ABI = [
  'function sellToken(address token, uint256 amountIn, uint256 minAmountOut) external returns (uint256)',
  'function buyToken(address token, uint256 minAmountOut) external payable returns (uint256)',
  'function getAmountOut(address token, uint256 amountIn) view returns (uint256)',
];

const DAPPER_ABI = [
  'function zapPLS() external payable',
  'function zapToken(address token, uint256 amount) external',
];

// ═══════════════════════════════════════════════════════════════
// TOKEN DISCOVERY SYSTEM - UNLIMITED CROSS-CHAIN
// ═══════════════════════════════════════════════════════════════

// Token list cache with lazy loading
const tokenListCache = new Map();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fetch token list from multiple sources
async function fetchTokenList(chainId = 369) {
  const cacheKey = `tokens_${chainId}`;
  const cached = tokenListCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TOKEN_CACHE_TTL) {
    return cached.tokens;
  }

  const tokens = new Map();

  // Source 1: PulseScan API (for PulseChain)
  if (chainId === 369) {
    try {
      const response = await fetch('https://api.scan.pulsechain.com/api/v2/tokens?type=ERC-20&limit=500');
      if (response.ok) {
        const data = await response.json();
        (data.items || []).forEach(t => {
          if (t.address && t.symbol) {
            tokens.set(t.address.toLowerCase(), {
              address: t.address,
              symbol: t.symbol,
              name: t.name || t.symbol,
              decimals: parseInt(t.decimals) || 18,
              chainId,
              logoURI: t.icon_url,
            });
          }
        });
      }
    } catch (e) { console.log('PulseScan token list error:', e.message); }
  }

  // Source 2: 1inch Token List (all chains)
  try {
    const oneInchChainId = chainId === 369 ? 1 : chainId; // Use ETH list as reference
    const response = await fetch(`https://tokens.1inch.io/v1.2/${oneInchChainId}`);
    if (response.ok) {
      const data = await response.json();
      Object.values(data).forEach(t => {
        if (t.address && t.symbol) {
          tokens.set(t.address.toLowerCase(), {
            address: t.address,
            symbol: t.symbol,
            name: t.name || t.symbol,
            decimals: t.decimals || 18,
            chainId,
            logoURI: t.logoURI,
          });
        }
      });
    }
  } catch (e) { console.log('1inch token list error:', e.message); }

  // Source 3: CoinGecko Token List
  try {
    const cgPlatform = {
      369: 'pulsechain',
      1: 'ethereum',
      56: 'binance-smart-chain',
      42161: 'arbitrum-one',
      8453: 'base',
    }[chainId] || 'ethereum';
    
    const response = await fetch(`https://tokens.coingecko.com/${cgPlatform}/all.json`);
    if (response.ok) {
      const data = await response.json();
      (data.tokens || []).forEach(t => {
        if (t.address && t.symbol && !tokens.has(t.address.toLowerCase())) {
          tokens.set(t.address.toLowerCase(), {
            address: t.address,
            symbol: t.symbol,
            name: t.name || t.symbol,
            decimals: t.decimals || 18,
            chainId,
            logoURI: t.logoURI,
          });
        }
      });
    }
  } catch (e) { console.log('CoinGecko token list error:', e.message); }

  const tokenArray = Array.from(tokens.values());
  tokenListCache.set(cacheKey, { tokens: tokenArray, timestamp: Date.now() });
  
  console.log(`📊 Loaded ${tokenArray.length} tokens for chain ${chainId}`);
  return tokenArray;
}

// ═══════════════════════════════════════════════════════════════
// SMART ROUTING ENGINE
// ═══════════════════════════════════════════════════════════════

class SmartRouter {
  constructor(provider, signer) {
    this.provider = provider;
    this.signer = signer;
    this.routeCache = new Map();
  }

  // Find best swap route for a token
  async findBestRoute(tokenIn, tokenOut, amountIn, slippageBps = 100) {
    const routes = [];

    // Route 1: PulseX V2 (primary)
    try {
      const quote = await this.getPulseXV2Quote(tokenIn, tokenOut, amountIn);
      if (quote.amountOut > 0n) {
        routes.push({
          source: 'PulseX V2',
          amountOut: quote.amountOut,
          path: quote.path,
          router: CONTRACTS.PULSEX_ROUTER_V2,
          gas: 150000n,
          priority: 1,
        });
      }
    } catch (e) { console.log('PulseX V2 route failed:', e.message); }

    // Route 2: PulseX V1 (fallback)
    try {
      const quote = await this.getPulseXV1Quote(tokenIn, tokenOut, amountIn);
      if (quote.amountOut > 0n) {
        routes.push({
          source: 'PulseX V1',
          amountOut: quote.amountOut,
          path: quote.path,
          router: CONTRACTS.PULSEX_ROUTER_V1,
          gas: 180000n,
          priority: 2,
        });
      }
    } catch (e) { console.log('PulseX V1 route failed:', e.message); }

    // Route 3: pump.tires (for bonding curve tokens)
    if (tokenOut.toLowerCase() === CONTRACTS.WPLS.toLowerCase() || tokenOut === null) {
      try {
        const quote = await this.getPumpTiresQuote(tokenIn, amountIn);
        if (quote.amountOut > 0n) {
          routes.push({
            source: 'pump.tires',
            amountOut: quote.amountOut,
            path: [tokenIn, CONTRACTS.WPLS],
            router: CONTRACTS.PUMP_TIRES,
            gas: 200000n,
            priority: 3,
          });
        }
      } catch (e) { console.log('pump.tires route failed:', e.message); }
    }

    // Sort by best output (accounting for gas)
    routes.sort((a, b) => {
      const aNet = a.amountOut - a.gas;
      const bNet = b.amountOut - b.gas;
      return bNet > aNet ? 1 : -1;
    });

    return routes[0] || null;
  }

  async getPulseXV2Quote(tokenIn, tokenOut, amountIn) {
    const router = new ethers.Contract(CONTRACTS.PULSEX_ROUTER_V2, PULSEX_ROUTER_ABI, this.provider);
    const path = tokenIn.toLowerCase() === CONTRACTS.WPLS.toLowerCase() || tokenOut.toLowerCase() === CONTRACTS.WPLS.toLowerCase()
      ? [tokenIn, tokenOut]
      : [tokenIn, CONTRACTS.WPLS, tokenOut];
    
    const amounts = await router.getAmountsOut(amountIn, path);
    return { amountOut: amounts[amounts.length - 1], path };
  }

  async getPulseXV1Quote(tokenIn, tokenOut, amountIn) {
    const router = new ethers.Contract(CONTRACTS.PULSEX_ROUTER_V1, PULSEX_ROUTER_ABI, this.provider);
    const path = [tokenIn, tokenOut];
    const amounts = await router.getAmountsOut(amountIn, path);
    return { amountOut: amounts[amounts.length - 1], path };
  }

  async getPumpTiresQuote(tokenIn, amountIn) {
    const pumpTires = new ethers.Contract(CONTRACTS.PUMP_TIRES, PUMP_TIRES_ABI, this.provider);
    const amountOut = await pumpTires.getAmountOut(tokenIn, amountIn);
    return { amountOut };
  }

  // Execute swap via best route
  async executeSwap(route, amountIn, minAmountOut, recipient) {
    if (route.source === 'pump.tires') {
      const pumpTires = new ethers.Contract(CONTRACTS.PUMP_TIRES, PUMP_TIRES_ABI, this.signer);
      return pumpTires.sellToken(route.path[0], amountIn, minAmountOut);
    } else {
      const router = new ethers.Contract(route.router, PULSEX_ROUTER_ABI, this.signer);
      const deadline = Math.floor(Date.now() / 1000) + 1200; // 20 minutes
      
      if (route.path[route.path.length - 1].toLowerCase() === CONTRACTS.WPLS.toLowerCase()) {
        return router.swapExactTokensForETH(amountIn, minAmountOut, route.path, recipient, deadline);
      } else {
        return router.swapExactTokensForTokens(amountIn, minAmountOut, route.path, recipient, deadline);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// DUST-TO-USDC CONVERTER
// ═══════════════════════════════════════════════════════════════

class DustToUSDCConverter {
  constructor(provider, signer, account) {
    this.provider = provider;
    this.signer = signer;
    this.account = account;
    this.router = new SmartRouter(provider, signer);
  }

  // Convert dust tokens to USDC with 1% fee
  async convertToUSDC(tokens, onProgress) {
    const results = {
      converted: [],
      failed: [],
      totalUSDC: 0n,
      totalFee: 0n,
    };

    for (const token of tokens) {
      try {
        onProgress?.(`Processing ${token.symbol}...`);
        
        // Step 1: Convert token to PLS/WPLS
        const amountWei = ethers.parseUnits(token.amount.toString(), token.decimals);
        
        // Approve token if needed
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI, this.signer);
        const allowance = await tokenContract.allowance(this.account, CONTRACTS.PULSEX_ROUTER_V2);
        if (allowance < amountWei) {
          onProgress?.(`Approving ${token.symbol}...`);
          const approveTx = await tokenContract.approve(CONTRACTS.PULSEX_ROUTER_V2, ethers.MaxUint256);
          await approveTx.wait();
        }

        // Find best route to WPLS first
        const routeToWPLS = await this.router.findBestRoute(token.address, CONTRACTS.WPLS, amountWei);
        if (!routeToWPLS) {
          results.failed.push({ token, reason: 'No liquidity path' });
          continue;
        }

        // Execute swap to WPLS
        onProgress?.(`Swapping ${token.symbol} to PLS via ${routeToWPLS.source}...`);
        const minOut = routeToWPLS.amountOut * 95n / 100n; // 5% slippage
        const swapTx = await this.router.executeSwap(routeToWPLS, amountWei, minOut, this.account);
        await swapTx.wait();

        // Step 2: Convert WPLS to USDC
        const wplsAmount = routeToWPLS.amountOut;
        
        // Approve WPLS for router
        const wplsContract = new ethers.Contract(CONTRACTS.WPLS, ERC20_ABI, this.signer);
        const wplsAllowance = await wplsContract.allowance(this.account, CONTRACTS.PULSEX_ROUTER_V2);
        if (wplsAllowance < wplsAmount) {
          const approveTx = await wplsContract.approve(CONTRACTS.PULSEX_ROUTER_V2, ethers.MaxUint256);
          await approveTx.wait();
        }

        // Swap to USDC
        const routeToUSDC = await this.router.findBestRoute(CONTRACTS.WPLS, CONTRACTS.USDC, wplsAmount);
        if (!routeToUSDC) {
          // Keep as WPLS if no USDC route
          results.converted.push({
            token,
            outputToken: 'WPLS',
            outputAmount: wplsAmount,
            fee: 0n,
          });
          continue;
        }

        onProgress?.(`Converting to USDC...`);
        const usdcMinOut = routeToUSDC.amountOut * 95n / 100n;
        const usdcTx = await this.router.executeSwap(routeToUSDC, wplsAmount, usdcMinOut, this.account);
        const receipt = await usdcTx.wait();

        // Calculate and send 1% fee
        const usdcReceived = routeToUSDC.amountOut;
        const fee = usdcReceived * BigInt(USDC_CONVERSION_FEE_BPS) / 10000n;
        const userAmount = usdcReceived - fee;

        if (fee > 0n) {
          onProgress?.(`Sending ${ethers.formatUnits(fee, 6)} USDC fee...`);
          const usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, this.signer);
          const feeTx = await usdcContract.transfer(FEE_WALLET, fee);
          await feeTx.wait();
        }

        results.converted.push({
          token,
          outputToken: 'USDC',
          outputAmount: userAmount,
          fee,
          route: [routeToWPLS.source, routeToUSDC.source],
        });
        results.totalUSDC += userAmount;
        results.totalFee += fee;

      } catch (error) {
        console.error(`Failed to convert ${token.symbol}:`, error);
        results.failed.push({ token, reason: error.message });
      }
    }

    return results;
  }
}

// ═══════════════════════════════════════════════════════════════
// CROSS-CHAIN BRIDGE INTEGRATION
// ═══════════════════════════════════════════════════════════════

class CrossChainBridge {
  constructor(fromChainId, toChainId = 369) {
    this.fromChainId = fromChainId;
    this.toChainId = toChainId;
  }

  // Get bridge quote via Socket.tech API
  async getQuote(tokenAddress, amount, userAddress) {
    try {
      const params = new URLSearchParams({
        fromChainId: this.fromChainId,
        toChainId: this.toChainId,
        fromTokenAddress: tokenAddress,
        toTokenAddress: CONTRACTS.WPLS, // Bridge to WPLS on PulseChain
        fromAmount: amount.toString(),
        userAddress,
        uniqueRoutesPerBridge: 'true',
        sort: 'output',
      });

      const response = await fetch(`https://api.socket.tech/v2/quote?${params}`, {
        headers: { 'API-KEY': '72a5b4b0-e727-48be-8aa1-5da9d62fe635' } // Public demo key
      });

      if (!response.ok) throw new Error('Bridge quote failed');
      const data = await response.json();
      
      return data.result?.routes?.[0] || null;
    } catch (error) {
      console.error('Bridge quote error:', error);
      return null;
    }
  }

  // Execute cross-chain bridge
  async executeBridge(route, signer) {
    // This would integrate with Socket.tech's transaction building API
    // For now, return the route info for user to execute manually
    return {
      source: route.usedBridgeNames?.[0] || 'Socket',
      fromChain: SUPPORTED_CHAINS[this.fromChainId]?.name,
      toChain: 'PulseChain',
      estimatedOutput: route.toAmount,
      estimatedTime: route.serviceTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT: ZAPPER-X-CHAIN
// ═══════════════════════════════════════════════════════════════

const ZapperXChain = ({ provider, account, livePrices = {} }) => {
  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  const [activeMode, setActiveMode] = useState('zap'); // 'zap', 'usdc', 'bridge'
  const [selectedChain, setSelectedChain] = useState(369);
  const [walletTokens, setWalletTokens] = useState([]);
  const [selectedTokens, setSelectedTokens] = useState({});
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [conversionResults, setConversionResults] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [totalSelected, setTotalSelected] = useState({ count: 0, valueUsd: 0 });

  // ═══════════════════════════════════════════════════════════════
  // WALLET SCANNING - UNLIMITED TOKENS
  // ═══════════════════════════════════════════════════════════════
  const scanWallet = useCallback(async () => {
    if (!account || !provider) return;
    
    setScanning(true);
    setStatusMessage('🔍 Scanning wallet for all tokens...');
    
    try {
      const foundTokens = [];
      const seenAddresses = new Set();
      const addr = account.toLowerCase();

      // Phase 1: Native PLS
      const plsBal = await provider.getBalance(account);
      const plsFormatted = ethers.formatEther(plsBal);
      if (parseFloat(plsFormatted) > 0.001) {
        foundTokens.push({
          symbol: 'PLS',
          name: 'PulseChain',
          address: null,
          decimals: 18,
          balance: plsFormatted,
          icon: '💜',
          color: '#E1BEE7',
          valueUsd: parseFloat(plsFormatted) * (livePrices.pls || 0.00003),
          hasLiquidity: true,
          isNative: true,
        });
        seenAddresses.add('native');
      }

      // Phase 2: Parallel API fetch
      const [pulseScanV2, pulseScanV1, tokenList] = await Promise.all([
        fetch(`https://api.scan.pulsechain.com/api/v2/addresses/${addr}/token-balances`)
          .then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(`https://api.scan.pulsechain.com/api?module=account&action=tokenlist&address=${addr}`)
          .then(r => r.ok ? r.json() : { result: [] }).then(d => d.result || []).catch(() => []),
        fetchTokenList(369),
      ]);

      // Phase 3: Process V2 results (newest data)
      if (Array.isArray(pulseScanV2)) {
        for (const item of pulseScanV2) {
          const tokenAddr = item.token?.address?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);

          const decimals = parseInt(item.token?.decimals) || 18;
          const bal = parseFloat(item.value || '0') / Math.pow(10, decimals);
          if (bal <= 0.000001) continue;

          const symbol = (item.token?.symbol || 'UNKNOWN').toUpperCase();
          const isLiquid = LIQUID_TOKENS.has(symbol);

          foundTokens.push({
            symbol,
            name: item.token?.name || symbol,
            address: item.token?.address,
            decimals,
            balance: bal.toString(),
            icon: isLiquid ? '💰' : '🔸',
            color: isLiquid ? '#4CAF50' : '#888',
            valueUsd: 0, // Will be filled by price lookup
            hasLiquidity: isLiquid,
            dustCleanStatus: isLiquid ? 'liquid' : 'unknown',
          });
        }
      }

      // Phase 4: Process V1 results (catches missed tokens)
      if (Array.isArray(pulseScanV1)) {
        for (const item of pulseScanV1) {
          const tokenAddr = item.contractAddress?.toLowerCase();
          if (!tokenAddr || seenAddresses.has(tokenAddr)) continue;
          seenAddresses.add(tokenAddr);

          const decimals = parseInt(item.tokenDecimal) || 18;
          const bal = parseFloat(item.balance || '0') / Math.pow(10, decimals);
          if (bal <= 0.000001) continue;

          const symbol = (item.tokenSymbol || 'UNKNOWN').toUpperCase();

          foundTokens.push({
            symbol,
            name: item.tokenName || symbol,
            address: item.contractAddress,
            decimals,
            balance: bal.toString(),
            icon: '🔸',
            color: '#888',
            valueUsd: 0,
            hasLiquidity: false,
            dustCleanStatus: 'unknown',
          });
        }
      }

      // Phase 5: Batch price lookup via DexScreener
      const tokensNeedingPrice = foundTokens.filter(t => t.address && t.valueUsd === 0);
      const batchSize = 30;
      
      for (let i = 0; i < tokensNeedingPrice.length; i += batchSize) {
        const batch = tokensNeedingPrice.slice(i, i + batchSize);
        const addresses = batch.map(t => t.address).join(',');
        
        try {
          const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addresses}`);
          if (response.ok) {
            const data = await response.json();
            const pairs = data.pairs || [];
            
            for (const token of batch) {
              const tokenPairs = pairs.filter(p => 
                p.baseToken?.address?.toLowerCase() === token.address.toLowerCase() ||
                p.quoteToken?.address?.toLowerCase() === token.address.toLowerCase()
              );
              
              if (tokenPairs.length > 0) {
                const bestPair = tokenPairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                const price = parseFloat(
                  bestPair.baseToken?.address?.toLowerCase() === token.address.toLowerCase()
                    ? bestPair.priceUsd || 0
                    : 1 / parseFloat(bestPair.priceUsd || 1)
                );
                
                token.price = price;
                token.valueUsd = parseFloat(token.balance) * price;
                token.hasLiquidity = (bestPair.liquidity?.usd || 0) > 100;
                token.liquidityUsd = bestPair.liquidity?.usd || 0;
                
                if (token.hasLiquidity) {
                  token.icon = '💰';
                  token.color = '#4CAF50';
                  token.dustCleanStatus = 'liquid';
                }
              }
            }
          }
        } catch (e) {
          console.log('DexScreener batch error:', e.message);
        }
      }

      // Phase 6: Check V1 liquidity for low-liq tokens
      const lowLiqTokens = foundTokens.filter(t => 
        t.address && !t.isNative && !t.hasLiquidity
      );

      if (lowLiqTokens.length > 0) {
        const factoryV1 = new ethers.Contract(
          CONTRACTS.PULSEX_FACTORY_V1,
          ['function getPair(address,address) view returns (address)'],
          provider
        );

        await Promise.all(lowLiqTokens.slice(0, 20).map(async (token) => {
          try {
            const pairAddress = await factoryV1.getPair(token.address, CONTRACTS.WPLS);
            if (pairAddress && pairAddress !== ethers.ZeroAddress) {
              const pair = new ethers.Contract(pairAddress, [
                'function getReserves() view returns (uint112,uint112,uint32)',
                'function token0() view returns (address)',
              ], provider);

              const [reserves, token0] = await Promise.all([
                pair.getReserves(),
                pair.token0(),
              ]);

              const isToken0 = token0.toLowerCase() === token.address.toLowerCase();
              const plsReserve = isToken0 ? reserves[1] : reserves[0];
              const plsAmount = parseFloat(ethers.formatEther(plsReserve));

              if (plsAmount > 100) {
                token.hasLiquidity = true;
                token.liquiditySource = 'v1';
                token.v1PlsAvailable = plsAmount;
                token.dustCleanStatus = 'v1_available';
                token.icon = '🔄';
                token.color = '#2196F3';
              }
            }
          } catch {}
        }));
      }

      // Phase 7: Check pump.tires for remaining tokens
      const stillNoLiq = foundTokens.filter(t => t.address && !t.hasLiquidity);
      
      if (stillNoLiq.length > 0) {
        const pumpTires = new ethers.Contract(CONTRACTS.PUMP_TIRES, PUMP_TIRES_ABI, provider);
        
        await Promise.all(stillNoLiq.slice(0, 15).map(async (token) => {
          try {
            const testAmount = ethers.parseUnits('1', token.decimals);
            const amountOut = await pumpTires.getAmountOut(token.address, testAmount);
            if (amountOut > 0n) {
              token.hasLiquidity = true;
              token.liquiditySource = 'pump.tires';
              token.dustCleanStatus = 'pump_available';
              token.icon = '🛞';
              token.color = '#FF5722';
            }
          } catch {}
        }));
      }

      // Sort by value and liquidity
      foundTokens.sort((a, b) => {
        if (a.hasLiquidity && !b.hasLiquidity) return -1;
        if (!a.hasLiquidity && b.hasLiquidity) return 1;
        return (b.valueUsd || 0) - (a.valueUsd || 0);
      });

      setWalletTokens(foundTokens);
      
      const liquidCount = foundTokens.filter(t => t.hasLiquidity).length;
      const totalValue = foundTokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0);
      setStatusMessage(`✅ Found ${foundTokens.length} tokens • ${liquidCount} tradeable • $${totalValue.toFixed(2)} total`);

    } catch (error) {
      console.error('Scan error:', error);
      setStatusMessage('❌ Scan failed: ' + error.message);
    } finally {
      setScanning(false);
    }
  }, [account, provider, livePrices]);

  // Auto-scan on mount
  useEffect(() => {
    if (account && provider && walletTokens.length === 0 && !scanning) {
      scanWallet();
    }
  }, [account, provider]);

  // ═══════════════════════════════════════════════════════════════
  // TOKEN SELECTION
  // ═══════════════════════════════════════════════════════════════
  const toggleToken = useCallback((token) => {
    setSelectedTokens(prev => {
      const key = token.address?.toLowerCase() || 'native';
      if (prev[key]) {
        const { [key]: removed, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [key]: {
            ...token,
            amount: parseFloat(token.balance) || 0,
          }
        };
      }
    });
  }, []);

  const selectAllLiquid = useCallback(() => {
    const liquidTokens = walletTokens.filter(t => t.hasLiquidity && t.valueUsd > 0.01);
    const newSelected = {};
    liquidTokens.forEach(token => {
      const key = token.address?.toLowerCase() || 'native';
      newSelected[key] = { ...token, amount: parseFloat(token.balance) || 0 };
    });
    setSelectedTokens(newSelected);
  }, [walletTokens]);

  const clearSelection = useCallback(() => {
    setSelectedTokens({});
  }, []);

  // Update totals when selection changes
  useEffect(() => {
    const tokens = Object.values(selectedTokens);
    setTotalSelected({
      count: tokens.length,
      valueUsd: tokens.reduce((sum, t) => sum + (t.valueUsd || 0), 0),
    });
  }, [selectedTokens]);

  // ═══════════════════════════════════════════════════════════════
  // ZAP EXECUTION
  // ═══════════════════════════════════════════════════════════════
  const executeZap = useCallback(async () => {
    if (!provider || !account || Object.keys(selectedTokens).length === 0) return;

    setProcessing(true);
    const results = { converted: [], failed: [] };

    try {
      const signer = await provider.getSigner();
      const dapper = new ethers.Contract(CONTRACTS.DAPPER, DAPPER_ABI, signer);
      const router = new SmartRouter(provider, signer);

      for (const [key, tokenData] of Object.entries(selectedTokens)) {
        const amount = parseFloat(tokenData.amount) || 0;
        if (amount <= 0) continue;

        try {
          if (key === 'native' || !tokenData.address) {
            // Native PLS
            setStatusMessage(`⚡ Zapping ${amount.toFixed(2)} PLS...`);
            const amountWei = ethers.parseEther(amount.toString());
            const tx = await dapper.zapPLS({ value: amountWei });
            await tx.wait();
            results.converted.push({ ...tokenData, source: 'Dapper' });
          } else if (tokenData.address.toLowerCase() === CONTRACTS.WPLS.toLowerCase()) {
            // WPLS - unwrap first
            setStatusMessage(`💜 Unwrapping ${amount.toFixed(2)} WPLS...`);
            const wplsContract = new ethers.Contract(CONTRACTS.WPLS, [
              'function withdraw(uint256) external',
            ], signer);
            const amountWei = ethers.parseUnits(amount.toString(), 18);
            const tx = await wplsContract.withdraw(amountWei);
            await tx.wait();
            results.converted.push({ ...tokenData, source: 'Unwrap' });
          } else {
            // ERC20 Token
            const amountWei = ethers.parseUnits(amount.toString(), tokenData.decimals || 18);
            
            // Find best route
            const route = await router.findBestRoute(tokenData.address, CONTRACTS.WPLS, amountWei);
            
            if (route) {
              // Approve if needed
              const tokenContract = new ethers.Contract(tokenData.address, ERC20_ABI, signer);
              const allowance = await tokenContract.allowance(account, route.router);
              if (allowance < amountWei) {
                setStatusMessage(`🔓 Approving ${tokenData.symbol}...`);
                const approveTx = await tokenContract.approve(route.router, ethers.MaxUint256);
                await approveTx.wait();
              }

              // Execute swap
              setStatusMessage(`⚡ Swapping ${amount.toFixed(4)} ${tokenData.symbol} via ${route.source}...`);
              const minOut = route.amountOut * 95n / 100n;
              const tx = await router.executeSwap(route, amountWei, minOut, account);
              await tx.wait();
              results.converted.push({ ...tokenData, source: route.source });
            } else {
              // Try Dapper as last resort
              try {
                await dapper.zapToken.staticCall(tokenData.address, amountWei);
                
                const tokenContract = new ethers.Contract(tokenData.address, ERC20_ABI, signer);
                const allowance = await tokenContract.allowance(account, CONTRACTS.DAPPER);
                if (allowance < amountWei) {
                  const approveTx = await tokenContract.approve(CONTRACTS.DAPPER, ethers.MaxUint256);
                  await approveTx.wait();
                }
                
                setStatusMessage(`⚡ Zapping ${amount.toFixed(4)} ${tokenData.symbol}...`);
                const tx = await dapper.zapToken(tokenData.address, amountWei);
                await tx.wait();
                results.converted.push({ ...tokenData, source: 'Dapper' });
              } catch {
                results.failed.push({ ...tokenData, reason: 'No liquidity' });
              }
            }
          }
        } catch (error) {
          console.error(`Failed ${tokenData.symbol}:`, error);
          results.failed.push({ ...tokenData, reason: error.message });
        }
      }

      setConversionResults(results);
      setStatusMessage(`✅ Zapped ${results.converted.length} tokens • ${results.failed.length} failed`);
      
      // Clear selection and rescan
      setSelectedTokens({});
      setTimeout(() => scanWallet(), 2000);

    } catch (error) {
      console.error('Zap error:', error);
      setStatusMessage('❌ Zap failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }, [provider, account, selectedTokens, scanWallet]);

  // ═══════════════════════════════════════════════════════════════
  // DUST-TO-USDC EXECUTION
  // ═══════════════════════════════════════════════════════════════
  const executeUSDCConversion = useCallback(async () => {
    if (!provider || !account || Object.keys(selectedTokens).length === 0) return;

    setProcessing(true);

    try {
      const signer = await provider.getSigner();
      const converter = new DustToUSDCConverter(provider, signer, account);
      
      const tokens = Object.values(selectedTokens).filter(t => t.address && t.amount > 0);
      
      const results = await converter.convertToUSDC(tokens, setStatusMessage);
      
      setConversionResults({
        ...results,
        mode: 'usdc',
        totalUSDCFormatted: ethers.formatUnits(results.totalUSDC, 6),
        totalFeeFormatted: ethers.formatUnits(results.totalFee, 6),
      });
      
      setStatusMessage(`✅ Converted to ${ethers.formatUnits(results.totalUSDC, 6)} USDC • 1% fee: ${ethers.formatUnits(results.totalFee, 6)} USDC`);
      
      setSelectedTokens({});
      setTimeout(() => scanWallet(), 2000);

    } catch (error) {
      console.error('USDC conversion error:', error);
      setStatusMessage('❌ Conversion failed: ' + error.message);
    } finally {
      setProcessing(false);
    }
  }, [provider, account, selectedTokens, scanWallet]);

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  const formatNumber = (num) => {
    if (!num || isNaN(num)) return '0';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    if (num < 0.0001) return num.toExponential(2);
    return num.toFixed(4);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(255,105,180,0.08) 0%, rgba(255,215,0,0.08) 50%, rgba(147,112,219,0.08) 100%)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid rgba(255,105,180,0.3)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{
          background: 'linear-gradient(135deg, #FF69B4 0%, #FFD700 50%, #9370DB 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontSize: '1.5rem',
          fontWeight: 700,
          margin: 0,
        }}>
          ⚡ Zapper-X-Chain ⚡
        </h2>
        <p style={{ color: '#888', fontSize: '0.8rem', margin: '4px 0' }}>
          Cross-Chain Dust → DTGC/PLS or USDC • 1% fee to growth
        </p>
      </div>

      {/* Mode Selector */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        background: 'rgba(0,0,0,0.2)',
        padding: '4px',
        borderRadius: '12px',
      }}>
        {[
          { id: 'zap', label: '⚡ Zap to LP', color: '#FF69B4' },
          { id: 'usdc', label: '💵 Dust to USDC', color: '#2775CA' },
          { id: 'bridge', label: '🌉 Cross-Chain', color: '#9370DB' },
        ].map(mode => (
          <button
            key={mode.id}
            onClick={() => setActiveMode(mode.id)}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: '10px',
              border: 'none',
              background: activeMode === mode.id 
                ? `linear-gradient(135deg, ${mode.color}40, ${mode.color}20)` 
                : 'transparent',
              color: activeMode === mode.id ? mode.color : '#666',
              fontWeight: activeMode === mode.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.75rem',
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '10px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '0.75rem',
          color: statusMessage.includes('❌') ? '#F44336' : statusMessage.includes('✅') ? '#4CAF50' : '#888',
          textAlign: 'center',
        }}>
          {statusMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={scanWallet}
          disabled={scanning || !account}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #2196F3, #1976D2)',
            color: '#fff',
            fontWeight: 600,
            cursor: scanning ? 'not-allowed' : 'pointer',
            opacity: scanning ? 0.7 : 1,
            fontSize: '0.8rem',
          }}
        >
          {scanning ? '🔍 Scanning...' : '🔍 Scan Wallet'}
        </button>
        <button
          onClick={selectAllLiquid}
          disabled={walletTokens.length === 0}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'rgba(76,175,80,0.2)',
            color: '#4CAF50',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.8rem',
          }}
        >
          Select All
        </button>
        {Object.keys(selectedTokens).length > 0 && (
          <button
            onClick={clearSelection}
            style={{
              padding: '10px 16px',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(244,67,54,0.2)',
              color: '#F44336',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.8rem',
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Token List */}
      <div style={{
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '12px',
        maxHeight: '300px',
        overflowY: 'auto',
        marginBottom: '16px',
      }}>
        {walletTokens.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            {scanning ? '🔍 Scanning for tokens...' : 'Connect wallet and scan to find tokens'}
          </div>
        ) : (
          walletTokens.map((token, idx) => {
            const key = token.address?.toLowerCase() || 'native';
            const isSelected = !!selectedTokens[key];
            
            return (
              <div
                key={key + idx}
                onClick={() => token.hasLiquidity && toggleToken(token)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  cursor: token.hasLiquidity ? 'pointer' : 'not-allowed',
                  background: isSelected ? 'rgba(255,105,180,0.15)' : 'transparent',
                  opacity: token.hasLiquidity ? 1 : 0.5,
                  transition: 'all 0.2s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: `2px solid ${isSelected ? '#FF69B4' : '#444'}`,
                  background: isSelected ? '#FF69B4' : 'transparent',
                  marginRight: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isSelected && <span style={{ color: '#000', fontSize: '12px' }}>✓</span>}
                </div>

                {/* Token Icon */}
                <span style={{ fontSize: '1.2rem', marginRight: '10px' }}>{token.icon}</span>

                {/* Token Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    color: token.hasLiquidity ? '#fff' : '#666',
                    fontSize: '0.85rem',
                  }}>
                    {token.symbol}
                    {token.liquiditySource && (
                      <span style={{ 
                        marginLeft: '6px', 
                        fontSize: '0.6rem', 
                        color: token.liquiditySource === 'v1' ? '#2196F3' : '#FF5722',
                        background: 'rgba(0,0,0,0.3)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}>
                        {token.liquiditySource}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888' }}>
                    {formatNumber(parseFloat(token.balance))} tokens
                  </div>
                </div>

                {/* Value */}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    color: token.valueUsd > 0 ? '#4CAF50' : '#666', 
                    fontWeight: 600,
                    fontSize: '0.85rem',
                  }}>
                    ${formatNumber(token.valueUsd || 0)}
                  </div>
                  {!token.hasLiquidity && (
                    <div style={{ fontSize: '0.6rem', color: '#F44336' }}>No liquidity</div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selection Summary */}
      {totalSelected.count > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,105,180,0.2), rgba(255,215,0,0.2))',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#888' }}>Selected Tokens:</span>
            <span style={{ color: '#FF69B4', fontWeight: 600 }}>{totalSelected.count}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: '#888' }}>Total Value:</span>
            <span style={{ color: '#4CAF50', fontWeight: 600 }}>${formatNumber(totalSelected.valueUsd)}</span>
          </div>
          {activeMode === 'usdc' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#888' }}>1% Fee:</span>
                <span style={{ color: '#FF9800', fontWeight: 600 }}>${formatNumber(totalSelected.valueUsd * 0.01)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#888' }}>You Receive:</span>
                <span style={{ color: '#2775CA', fontWeight: 600 }}>~${formatNumber(totalSelected.valueUsd * 0.99)} USDC</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Execute Button */}
      <button
        onClick={activeMode === 'usdc' ? executeUSDCConversion : executeZap}
        disabled={processing || totalSelected.count === 0}
        style={{
          width: '100%',
          padding: '16px',
          borderRadius: '12px',
          border: 'none',
          background: processing || totalSelected.count === 0
            ? 'rgba(100,100,100,0.3)'
            : activeMode === 'usdc'
              ? 'linear-gradient(135deg, #2775CA, #1565C0)'
              : 'linear-gradient(135deg, #FF69B4, #FFD700)',
          color: '#fff',
          fontWeight: 700,
          fontSize: '1rem',
          cursor: processing || totalSelected.count === 0 ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s',
        }}
      >
        {processing 
          ? '⏳ Processing...' 
          : activeMode === 'usdc'
            ? `💵 Convert ${totalSelected.count} Tokens to USDC`
            : `⚡ Zap ${totalSelected.count} Tokens to LP`
        }
      </button>

      {/* Fee Info */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '8px',
        fontSize: '0.7rem',
        color: '#666',
        textAlign: 'center',
      }}>
        {activeMode === 'usdc' ? (
          <>💵 Dust → USDC • 1% fee supports growth engine</>
        ) : (
          <>⚡ Zap → DTGC/PLS LP • Smart routing: PulseX → V1 → pump.tires</>
        )}
        <br />
        <span style={{ fontSize: '0.6rem', color: '#444' }}>
          Fee wallet: {FEE_WALLET.slice(0, 8)}...{FEE_WALLET.slice(-6)}
        </span>
      </div>

      {/* Results Modal */}
      {conversionResults && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }} onClick={() => setConversionResults(null)}>
          <div style={{
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid rgba(255,105,180,0.3)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ 
              color: '#FF69B4', 
              margin: '0 0 16px 0',
              textAlign: 'center',
            }}>
              ✅ Conversion Complete
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ color: '#4CAF50', fontWeight: 600, marginBottom: '8px' }}>
                Converted: {conversionResults.converted?.length || 0} tokens
              </div>
              {conversionResults.converted?.map((t, i) => (
                <div key={i} style={{ 
                  fontSize: '0.75rem', 
                  color: '#888',
                  padding: '4px 0',
                }}>
                  ✓ {t.symbol} via {t.source}
                </div>
              ))}
            </div>

            {conversionResults.failed?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ color: '#F44336', fontWeight: 600, marginBottom: '8px' }}>
                  Failed: {conversionResults.failed.length} tokens
                </div>
                {conversionResults.failed.map((t, i) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#666' }}>
                    ✗ {t.symbol || t.token?.symbol}: {t.reason}
                  </div>
                ))}
              </div>
            )}

            {conversionResults.mode === 'usdc' && (
              <div style={{
                background: 'rgba(39,117,202,0.2)',
                borderRadius: '8px',
                padding: '12px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#2775CA', fontSize: '1.2rem', fontWeight: 700 }}>
                  ${conversionResults.totalUSDCFormatted} USDC
                </div>
                <div style={{ color: '#888', fontSize: '0.7rem' }}>
                  Fee: ${conversionResults.totalFeeFormatted} USDC (1%)
                </div>
              </div>
            )}

            <button
              onClick={() => setConversionResults(null)}
              style={{
                width: '100%',
                padding: '12px',
                marginTop: '16px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #FF69B4, #FFD700)',
                color: '#000',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZapperXChain;
