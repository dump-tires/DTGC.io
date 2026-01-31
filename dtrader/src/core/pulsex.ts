import { ethers } from 'ethers';
import { config, ERC20_ABI, PULSEX_ROUTER_ABI, PULSEX_FACTORY_ABI, PULSEX_PAIR_ABI } from '../config';
import { feeManager } from './feeManager';

interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutMin: bigint;
  path: string[];
  priceImpact: number;
}

interface SwapResult {
  success: boolean;
  txHash?: string;
  amountIn?: string;
  amountOut?: string;
  error?: string;
  feeCollected?: boolean;
  dtgcBurned?: string;
}

interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
}

interface PairInfo {
  pairAddress: string;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  liquidityPls: bigint;
}

export class PulseXService {
  private provider: ethers.JsonRpcProvider;
  private router: ethers.Contract;
  private factory: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpc);
    this.router = new ethers.Contract(config.pulsexRouter, PULSEX_ROUTER_ABI, this.provider);
    this.factory = new ethers.Contract(config.pulsexFactory, PULSEX_FACTORY_ABI, this.provider);
  }

  /**
   * Get token info
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
      token.totalSupply(),
    ]);
    return { address: tokenAddress, name, symbol, decimals, totalSupply };
  }

  /**
   * Get pair address for two tokens
   */
  async getPairAddress(tokenA: string, tokenB: string): Promise<string | null> {
    const pairAddress = await this.factory.getPair(tokenA, tokenB);
    if (pairAddress === ethers.ZeroAddress) return null;
    return pairAddress;
  }

  /**
   * Get pair info including reserves
   */
  async getPairInfo(tokenAddress: string): Promise<PairInfo | null> {
    const pairAddress = await this.getPairAddress(tokenAddress, config.wpls);
    if (!pairAddress) return null;

    const pair = new ethers.Contract(pairAddress, PULSEX_PAIR_ABI, this.provider);
    const [token0, token1, reserves] = await Promise.all([
      pair.token0(),
      pair.token1(),
      pair.getReserves(),
    ]);

    // Determine which reserve is PLS
    const isToken0Wpls = token0.toLowerCase() === config.wpls.toLowerCase();
    const liquidityPls = isToken0Wpls ? reserves[0] : reserves[1];

    return {
      pairAddress,
      token0,
      token1,
      reserve0: reserves[0],
      reserve1: reserves[1],
      liquidityPls,
    };
  }

  /**
   * Get swap quote (PLS -> Token)
   */
  async getQuoteBuy(tokenAddress: string, amountInPls: bigint, slippagePercent: number = 10): Promise<SwapQuote> {
    const path = [config.wpls, tokenAddress];
    const amounts = await this.router.getAmountsOut(amountInPls, path);
    const amountOut = amounts[1];
    const slippageMultiplier = BigInt(100 - slippagePercent);
    const amountOutMin = (amountOut * slippageMultiplier) / 100n;

    // Calculate price impact
    const pairInfo = await this.getPairInfo(tokenAddress);
    let priceImpact = 0;
    if (pairInfo) {
      priceImpact = Number(amountInPls * 100n / pairInfo.liquidityPls);
    }

    return {
      amountIn: amountInPls,
      amountOut,
      amountOutMin,
      path,
      priceImpact,
    };
  }

  /**
   * Get swap quote (Token -> PLS)
   */
  async getQuoteSell(tokenAddress: string, amountInTokens: bigint, slippagePercent: number = 10): Promise<SwapQuote> {
    const path = [tokenAddress, config.wpls];
    const amounts = await this.router.getAmountsOut(amountInTokens, path);
    const amountOut = amounts[1];
    const slippageMultiplier = BigInt(100 - slippagePercent);
    const amountOutMin = (amountOut * slippageMultiplier) / 100n;

    return {
      amountIn: amountInTokens,
      amountOut,
      amountOutMin,
      path,
      priceImpact: 0,
    };
  }

  /**
   * Execute buy (PLS -> Token)
   * Collects 1% fee: 0.5% DTGC burn + 0.5% dev wallet
   */
  async executeBuy(
    wallet: ethers.Wallet,
    tokenAddress: string,
    amountInPls: bigint,
    slippagePercent: number = 10,
    gasLimit: number = config.trading.defaultGasLimit,
    useAntiMev: boolean = true
  ): Promise<SwapResult> {
    try {
      const connectedWallet = wallet.connect(this.provider);

      // Step 1: Collect 1% fee (0.5% burn + 0.5% dev)
      const feeResult = await feeManager.collectFees(wallet, amountInPls);
      const feeBreakdown = feeManager.calculateFees(amountInPls);
      const netAmount = feeBreakdown.netAmount; // 99% for actual trade

      if (!feeResult.success) {
        console.log('⚠️ Fee collection failed, proceeding with trade:', feeResult.error);
        // Continue with original amount if fee collection fails
      }

      const tradeAmount = feeResult.success ? netAmount : amountInPls;
      const quote = await this.getQuoteBuy(tokenAddress, tradeAmount, slippagePercent);
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      const routerWithSigner = this.router.connect(connectedWallet) as ethers.Contract;

      // Use fee-on-transfer support for tax tokens
      const tx = await routerWithSigner.swapExactETHForTokensSupportingFeeOnTransferTokens(
        quote.amountOutMin,
        quote.path,
        wallet.address,
        deadline,
        {
          value: tradeAmount,
          gasLimit,
        }
      );

      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        amountIn: ethers.formatEther(tradeAmount),
        amountOut: ethers.formatUnits(quote.amountOut, 18),
        feeCollected: feeResult.success,
        dtgcBurned: feeResult.dtgcBurned,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Swap failed',
      };
    }
  }

  /**
   * Execute sell (Token -> PLS)
   * Collects 1% fee from proceeds: 0.5% DTGC burn + 0.5% dev wallet
   */
  async executeSell(
    wallet: ethers.Wallet,
    tokenAddress: string,
    amountInTokens: bigint,
    slippagePercent: number = 10,
    gasLimit: number = config.trading.defaultGasLimit
  ): Promise<SwapResult> {
    try {
      const connectedWallet = wallet.connect(this.provider);
      const quote = await this.getQuoteSell(tokenAddress, amountInTokens, slippagePercent);
      const deadline = Math.floor(Date.now() / 1000) + 300;

      // First approve router
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, connectedWallet);
      const allowance = await token.allowance(wallet.address, config.pulsexRouter);

      if (allowance < amountInTokens) {
        const approveTx = await token.approve(config.pulsexRouter, ethers.MaxUint256);
        await approveTx.wait();
      }

      const routerWithSigner = this.router.connect(connectedWallet) as ethers.Contract;

      const tx = await routerWithSigner.swapExactTokensForETHSupportingFeeOnTransferTokens(
        amountInTokens,
        quote.amountOutMin,
        quote.path,
        wallet.address,
        deadline,
        { gasLimit }
      );

      const receipt = await tx.wait();

      // Get actual PLS received from the swap
      const plsReceived = quote.amountOut; // Estimated, actual may vary

      // Step 2: Collect 1% fee from PLS proceeds (0.5% burn + 0.5% dev)
      let feeCollected = false;
      let dtgcBurned = '0';
      try {
        const feeResult = await feeManager.collectFees(wallet, plsReceived);
        feeCollected = feeResult.success;
        dtgcBurned = feeResult.dtgcBurned || '0';
      } catch (feeError) {
        console.log('⚠️ Fee collection failed on sell:', feeError);
      }

      return {
        success: true,
        txHash: receipt.hash,
        amountIn: ethers.formatUnits(amountInTokens, 18),
        amountOut: ethers.formatEther(quote.amountOut),
        feeCollected,
        dtgcBurned,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Swap failed',
      };
    }
  }

  /**
   * Format price for display
   */
  formatPrice(amountIn: bigint, amountOut: bigint, decimalsIn: number, decimalsOut: number): string {
    const price = Number(ethers.formatUnits(amountOut, decimalsOut)) /
                  Number(ethers.formatUnits(amountIn, decimalsIn));
    return price.toLocaleString(undefined, { maximumFractionDigits: 8 });
  }
}

export const pulsex = new PulseXService();
