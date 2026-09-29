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
import { BigNumber } from 'bignumber.js';
import { ethers } from 'ethers';
import { TokenConfig, TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger, UserAddress } from '../../types.js';
export declare const weiToTokenAmount: (wei: BigNumber.Value) => BigNumber.Value;
export declare const ETHToTokenAmount: (eth: BigNumber.Value) => string;
export declare const defaultEthereumPollingOptions: TokenPollingOptions;
export declare class EthereumToken implements TokenTools {
    protected logger: TurboLogger;
    protected gatewayUrl: string;
    protected pollingOptions: TokenPollingOptions;
    protected rpcProvider: ethers.JsonRpcProvider;
    constructor({ logger, gatewayUrl, pollingOptions, }?: TokenConfig);
    createAndSubmitTx({ target, tokenAmount, signer, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
    }>;
    protected getTxAvailability(txId: string): Promise<boolean>;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
}
export declare function ethDataFromTurboCreditDestinationAddress(turboCreditDestinationAddress: UserAddress | undefined): string | undefined;
//# sourceMappingURL=ethereum.d.ts.map