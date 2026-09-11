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
import { TokenConfig, TokenPollingOptions } from '../../types.js';
import { ERC20Token } from './erc20.js';
/**
 * Known USDC contract addresses and default RPCs by network
 */
export declare const usdcNetworks: (useDevnet?: boolean) => Record<string, {
    tokenContractAddress: string;
    rpcEndpoint: string;
    defaultPollingOptions: TokenPollingOptions;
}>;
export declare const mUSDCToTokenAmount: (mUSDC: BigNumber.Value) => BigNumber.Value;
export declare const USDCToTokenAmount: (usdc: BigNumber.Value) => string;
export declare class USDCToken extends ERC20Token {
    constructor({ network, logger, gatewayUrl, tokenContractAddress, pollingOptions, useDevnet, }?: TokenConfig & {
        network?: 'ethereum' | 'base' | 'polygon';
        useDevnet?: boolean;
        tokenContractAddress?: string;
    });
}
//# sourceMappingURL=usdc.d.ts.map