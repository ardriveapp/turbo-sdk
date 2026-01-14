"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenPrice = tokenPrice;
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
const index_js_1 = require("../../common/index.js");
const factory_js_1 = require("../../node/factory.js");
const types_js_1 = require("../../types.js");
const utils_js_1 = require("../utils.js");
async function tokenPrice(options) {
    const byteCount = (0, utils_js_1.requiredByteCountFromOptions)(options);
    const token = options.token;
    if (!(0, index_js_1.isTokenType)(token)) {
        throw new Error(`Invalid token type ${token}. Must be one of ${types_js_1.tokenTypes.join(', ')}`);
    }
    const turbo = factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
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
