import { Connection } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import { AoProcessConfig, TokenConfig, TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger } from '../../types.js';
export declare class ARIOToken implements TokenTools {
    protected logger: TurboLogger;
    protected connection: Connection;
    protected gatewayUrl: string;
    private pollingOptions;
    private mintAddress;
    constructor({ gatewayUrl, logger, pollingOptions, }?: {
        gatewayUrl?: string;
        logger?: TurboLogger;
        pollingOptions?: TokenPollingOptions;
    } & Partial<AoProcessConfig> & TokenConfig);
    createAndSubmitTx({ target, signer, tokenAmount, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
        reward: string;
    }>;
    private submitTx;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
}
export declare const mARIOToTokenAmount: (mARIO: BigNumber.Value) => BigNumber.Value;
export declare const ARIOToTokenAmount: (ario: BigNumber.Value) => string;
//# sourceMappingURL=ario.d.ts.map