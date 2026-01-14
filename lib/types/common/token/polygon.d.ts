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
import { TokenConfig } from '../../types.js';
import { EthereumToken } from './ethereum.js';
export declare const POLToTokenAmount: (eth: import("bignumber.js").BigNumber.Value) => string;
export declare const defaultPolygonPollingOptions: {
    maxAttempts: number;
    initialBackoffMs: number;
    pollingIntervalMs: number;
};
export declare class PolygonToken extends EthereumToken {
    constructor({ logger, gatewayUrl, pollingOptions, }?: TokenConfig);
}
//# sourceMappingURL=polygon.d.ts.map