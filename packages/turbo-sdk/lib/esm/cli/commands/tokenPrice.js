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
import { isTokenType } from '../../common/index.js';
import { TurboFactory } from '../../node/factory.js';
import { tokenTypes } from '../../types.js';
import { configFromOptions, requiredByteCountFromOptions } from '../utils.js';
export async function tokenPrice(options) {
    const byteCount = requiredByteCountFromOptions(options);
    const token = options.token;
    if (!isTokenType(token)) {
        throw new Error(`Invalid token type ${token}. Must be one of ${tokenTypes.join(', ')}`);
    }
    const turbo = TurboFactory.unauthenticated(configFromOptions(options));
    const { tokenPrice } = await turbo.getTokenPriceForBytes({
        byteCount: +byteCount,
    });
    const output = {
        tokenPrice,
        byteCount,
        message: `The current price estimate for ${byteCount} bytes is ${tokenPrice} ${token}`,
    };
    console.log(JSON.stringify(output, null, 2));
}
