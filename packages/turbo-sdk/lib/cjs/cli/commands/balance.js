"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.balance = balance;
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
const bignumber_js_1 = require("bignumber.js");
const factory_js_1 = require("../../node/factory.js");
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils.js");
async function balance(options) {
    const config = (0, utils_js_1.configFromOptions)(options);
    const { address, privateKey } = await (0, utils_js_1.addressOrPrivateKeyFromOptions)(options);
    const { effectiveBalance, nativeAddress, winc, controlledWinc } = await (async () => {
        if (address !== undefined) {
            return {
                ...(await factory_js_1.TurboFactory.unauthenticated(config).getBalance(address)),
                nativeAddress: address,
            };
        }
        if (privateKey === undefined) {
            throw new Error('Must provide an (--address) or use a valid wallet');
        }
        const turbo = factory_js_1.TurboFactory.authenticated({
            ...config,
            privateKey,
        });
        return {
            ...(await turbo.getBalance()),
            nativeAddress: await turbo.signer.getNativeAddress(),
        };
    })();
    console.log(`Turbo Balance for Native Address "${nativeAddress}"\nEffective Credits: ${+effectiveBalance / constants_js_1.wincPerCredit}${winc === controlledWinc
        ? ''
        : `\nCredits Shared to Other Wallets: ${(0, bignumber_js_1.BigNumber)(controlledWinc)
            .minus(winc)
            .div(constants_js_1.wincPerCredit)}`}`);
}
