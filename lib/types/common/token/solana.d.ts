import { Connection } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { TokenConfig, TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger } from '../../types.js';
export declare const lamportToTokenAmount: (winston: BigNumber.Value) => BigNumber.Value;
export declare const SOLToTokenAmount: (sol: BigNumber.Value) => string;
export declare const memoProgramId = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export declare class SolanaToken implements TokenTools {
    protected logger: TurboLogger;
    protected connection: Connection;
    protected gatewayUrl: string;
    protected pollingOptions: TokenPollingOptions;
    constructor({ logger, gatewayUrl, pollingOptions, }?: TokenConfig);
    createAndSubmitTx({ target, tokenAmount, signer, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
    }>;
    private submitTx;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
}
//# sourceMappingURL=solana.d.ts.map