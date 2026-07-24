/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import ArweaveModule from 'arweave';
import { BigNumber } from 'bignumber.js';
import { TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger } from '../../types.js';
export declare class ArweaveToken implements TokenTools {
    protected logger: TurboLogger;
    protected arweave: ArweaveModule;
    protected mintU: boolean;
    protected pollingOptions: TokenPollingOptions;
    constructor({ gatewayUrl, arweave, logger, mintU, pollingOptions, }?: {
        gatewayUrl?: string;
        arweave?: ArweaveModule;
        logger?: TurboLogger;
        mintU?: boolean;
        pollingOptions?: TokenPollingOptions;
    });
    createAndSubmitTx({ feeMultiplier, target, tokenAmount, signer, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
        reward: string;
    }>;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
    submitTx(tx: any): Promise<void>;
}
export declare const WinstonToTokenAmount: (winston: BigNumber.Value) => BigNumber.Value;
export declare const ARToTokenAmount: (ar: BigNumber.Value) => string;
//# sourceMappingURL=arweave.d.ts.map