"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.price = price;
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
const currency_js_1 = require("../../common/currency.js");
const index_js_1 = require("../../common/index.js");
const factory_js_1 = require("../../node/factory.js");
const types_js_1 = require("../../types.js");
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils.js");
const fiatEstimate_js_1 = require("./fiatEstimate.js");
async function price(options) {
    const value = options.value;
    if (value === undefined || +value <= 0 || isNaN(+value)) {
        throw new Error('Must provide a positive number --value to get price');
    }
    const type = options.type ?? 'bytes';
    const currency = (0, utils_js_1.currencyFromOptions)(options);
    if (currency !== undefined && type === 'bytes') {
        // User supplied --type bytes --currency <currency> --value <bytes>
        // This is a special case where we will provide a fiat estimate for the bytes value
        return (0, fiatEstimate_js_1.fiatEstimate)({ ...options, byteCount: value });
    }
    const winc = await (async () => {
        if ((0, index_js_1.isTokenType)(type)) {
            const turbo = factory_js_1.TurboFactory.unauthenticated({
                ...(0, utils_js_1.configFromOptions)(options),
                token: type,
            });
            return (await turbo.getWincForToken({
                tokenAmount: index_js_1.tokenToBaseMap[type](value),
            })).winc;
        }
        const turbo = factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
        if (type === 'bytes') {
            return (await turbo.getUploadCosts({ bytes: [+value] }))[0].winc;
        }
        if ((0, types_js_1.isCurrency)(type)) {
            return (await turbo.getWincForFiat({
                amount: currency_js_1.currencyMap[type](+value),
            })).winc;
        }
        throw new Error(`Invalid price type!\nMust be one of: bytes, ${types_js_1.fiatCurrencyTypes.join(', ') + ' ' + types_js_1.tokenTypes.join(', ')}`);
    })();
    console.log(`Current price estimate for ${value} ${type} is ~${(+winc / constants_js_1.wincPerCredit).toFixed(12)} Credits`);
}
