"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topUp = topUp;
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
const child_process_1 = require("child_process");
const currency_js_1 = require("../../common/currency.js");
const factory_js_1 = require("../../node/factory.js");
const common_js_1 = require("../../utils/common.js");
const utils_js_1 = require("../utils.js");
function openUrl(url) {
    if (process.platform === 'darwin') {
        // macOS
        (0, child_process_1.exec)(`open ${url}`);
    }
    else if (process.platform === 'win32') {
        // Windows
        (0, child_process_1.exec)(`start "" "${url}"`, { windowsHide: true });
    }
    else {
        // Linux/Unix
        open(url);
    }
}
async function topUp(options) {
    const config = (0, utils_js_1.configFromOptions)(options);
    const { address, privateKey } = await (0, utils_js_1.addressOrPrivateKeyFromOptions)(options);
    const value = options.value;
    if (value === undefined) {
        throw new Error('Must provide a --value to top up');
    }
    const currency = (0, utils_js_1.currencyFromOptions)(options) ?? 'usd';
    // TODO: Pay in CLI prompts via --cli options
    const { url, paymentAmount, winc } = await (async () => {
        const amount = currency_js_1.currencyMap[currency](+value);
        if (address !== undefined) {
            const turbo = factory_js_1.TurboFactory.unauthenticated(config);
            return turbo.createCheckoutSession({
                amount,
                owner: address,
            });
        }
        if (privateKey === undefined) {
            throw new Error('Must provide a wallet to top up');
        }
        const turbo = factory_js_1.TurboFactory.authenticated({
            ...config,
            privateKey,
        });
        return turbo.createCheckoutSession({
            amount,
            owner: await turbo.signer.getNativeAddress(),
        });
    })();
    if (url === undefined) {
        throw new Error('Failed to create checkout session');
    }
    console.log('Got Checkout Session\n' + JSON.stringify({ url, paymentAmount, winc }));
    console.log('Opening checkout session in browser...');
    await (0, common_js_1.sleep)(2000);
    openUrl(url);
}
