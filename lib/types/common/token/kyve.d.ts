import { BigNumber } from 'bignumber.js';
import { TokenConfig, TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger, TurboSigner } from '../../types.js';
export declare const ukyveToTokenAmount: (winston: BigNumber.Value) => BigNumber.Value;
export declare const KYVEToTokenAmount: (sol: BigNumber.Value) => string;
export declare class KyveToken implements TokenTools {
    protected logger: TurboLogger;
    protected gatewayUrl: string;
    protected pollingOptions: TokenPollingOptions;
    constructor({ logger, gatewayUrl, pollingOptions, }: TokenConfig);
    createAndSubmitTx({ target, tokenAmount, signer, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
    }>;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
    private sendTokens;
}
export declare function signerFromKyvePrivateKey(privateKey: string): TurboSigner;
export declare function privateKeyFromKyveMnemonic(mnemonic: string): Promise<string>;
export declare function signerFromKyveMnemonic(mnemonic: string): Promise<TurboSigner>;
export declare const SUPPORTED_CHAIN_CONFIGS: {
    'kyve-1': {
        chainId: string;
        chainName: string;
        rpc: string;
        rest: string;
        coin: string;
        coinDenom: string;
        coinDecimals: number;
        gasPrice: number;
    };
    'kaon-1': {
        chainId: string;
        chainName: string;
        rpc: string;
        rest: string;
        coin: string;
        coinDenom: string;
        coinDecimals: number;
        gasPrice: number;
    };
    'korellia-2': {
        chainId: string;
        chainName: string;
        rpc: string;
        rest: string;
        coin: string;
        coinDenom: string;
        coinDecimals: number;
        gasPrice: number;
    };
    'kyve-beta': {
        chainId: string;
        chainName: string;
        rpc: string;
        rest: string;
        coin: string;
        coinDenom: string;
        coinDecimals: number;
        gasPrice: number;
    };
    'kyve-alpha': {
        chainId: string;
        chainName: string;
        rpc: string;
        rest: string;
        coin: string;
        coinDenom: string;
        coinDecimals: number;
        gasPrice: number;
    };
    'kyve-local': {
        chainId: string;
        chainName: string;
        rpc: string;
        rest: string;
        coin: string;
        coinDenom: string;
        coinDecimals: number;
        gasPrice: number;
    };
};
//# sourceMappingURL=kyve.d.ts.map