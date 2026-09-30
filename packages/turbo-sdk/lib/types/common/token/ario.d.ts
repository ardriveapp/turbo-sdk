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
import { AoProcessConfig, TokenConfig } from '../../types.js';
import { SplToken } from './spl.js';
export declare class ARIOToken extends SplToken {
    constructor({ gatewayUrl, ...config }?: Partial<AoProcessConfig> & TokenConfig);
}
export declare const mARIOToTokenAmount: (mARIO: BigNumber.Value) => BigNumber.Value;
export declare const ARIOToTokenAmount: (ario: BigNumber.Value) => string;
//# sourceMappingURL=ario.d.ts.map