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
import { TurboFactory } from '../../node/index.js';
import { configFromOptions, currencyFromOptions, requiredByteCountFromOptions, } from '../utils.js';
export async function fiatEstimate(options) {
    const byteCount = requiredByteCountFromOptions(options);
    const currency = currencyFromOptions(options) ?? 'usd';
    const turbo = TurboFactory.unauthenticated(configFromOptions(options));
    const result = await turbo.getFiatEstimateForBytes({
        byteCount,
        currency,
    });
    const output = {
        ...result,
        message: `The current price estimate for ${byteCount} bytes is ${result.amount} ${currency}`,
    };
    console.log(JSON.stringify(output, null, 2));
}
