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
import { currencyMap } from '../../common/currency.js';
import { isTokenType, tokenToBaseMap } from '../../common/index.js';
import { TurboFactory } from '../../node/factory.js';
import { fiatCurrencyTypes, isCurrency, tokenTypes } from '../../types.js';
import { wincPerCredit } from '../constants.js';
import { configFromOptions, currencyFromOptions } from '../utils.js';
import { fiatEstimate } from './fiatEstimate.js';
export async function price(options) {
    const value = options.value;
    if (value === undefined || +value <= 0 || isNaN(+value)) {
        throw new Error('Must provide a positive number --value to get price');
    }
    const type = options.type ?? 'bytes';
    const currency = currencyFromOptions(options);
    if (currency !== undefined && type === 'bytes') {
        // User supplied --type bytes --currency <currency> --value <bytes>
        // This is a special case where we will provide a fiat estimate for the bytes value
        return fiatEstimate({ ...options, byteCount: value });
    }
    const winc = await (async () => {
        if (isTokenType(type)) {
            const turbo = TurboFactory.unauthenticated({
                ...configFromOptions(options),
                token: type,
            });
            return (await turbo.getWincForToken({
                tokenAmount: tokenToBaseMap[type](value),
            })).winc;
        }
        const turbo = TurboFactory.unauthenticated(configFromOptions(options));
        if (type === 'bytes') {
            return (await turbo.getUploadCosts({ bytes: [+value] }))[0].winc;
        }
        if (isCurrency(type)) {
            return (await turbo.getWincForFiat({
                amount: currencyMap[type](+value),
            })).winc;
        }
        throw new Error(`Invalid price type!\nMust be one of: bytes, ${fiatCurrencyTypes.join(', ') + ' ' + tokenTypes.join(', ')}`);
    })();
    console.log(`Current price estimate for ${value} ${type} is ~${(+winc / wincPerCredit).toFixed(12)} Credits`);
}
