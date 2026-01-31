export declare const config: {
    telegramToken: string;
    rpc: string;
    rpcFallbacks: string[];
    wss: string;
    wssFallbacks: string[];
    hetzner: {
        rpc: string;
        wss: string;
    };
    chainId: number;
    nativeSymbol: string;
    explorerUrl: string;
    pulsexRouter: string;
    pulsexFactory: string;
    wpls: string;
    tokenGate: {
        dtgc: string;
        minHoldUsd: number;
    };
    pumpTires: {
        contract: string;
        graduationThreshold: bigint;
    };
    trading: {
        defaultSlippage: number;
        defaultGasLimit: number;
        maxGasPriceGwei: number;
    };
};
export declare const ERC20_ABI: string[];
export declare const PULSEX_ROUTER_ABI: string[];
export declare const PULSEX_FACTORY_ABI: string[];
export declare const PULSEX_PAIR_ABI: string[];
//# sourceMappingURL=index.d.ts.map