import { BigNumber } from 'bignumber.js';
import { TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger } from '../../types.js';
export declare class ARIOToken implements TokenTools {
    protected logger: TurboLogger;
    private ao;
    private processId;
    private pollingOptions;
    constructor({ cuUrl, logger, pollingOptions, processId, }?: {
        cuUrl?: string;
        processId?: string;
        logger?: TurboLogger;
        pollingOptions?: TokenPollingOptions;
    });
    createAndSubmitTx({ target, signer: { signer }, tokenAmount, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
        reward: string;
    }>;
    pollTxAvailability(): Promise<void>;
}
export declare const mARIOToTokenAmount: (mARIO: BigNumber.Value) => BigNumber.Value;
export declare const ARIOToTokenAmount: (ario: BigNumber.Value) => string;
//# sourceMappingURL=ario.d.ts.map