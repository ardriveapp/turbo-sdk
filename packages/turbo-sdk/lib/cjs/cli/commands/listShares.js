"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listShares = listShares;
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
const factory_js_1 = require("../../node/factory.js");
const utils_js_1 = require("../utils.js");
async function listShares(options) {
    const config = (0, utils_js_1.configFromOptions)(options);
    const { address, privateKey } = await (0, utils_js_1.addressOrPrivateKeyFromOptions)(options);
    const { givenApprovals, receivedApprovals, nativeAddress } = await (async () => {
        if (address !== undefined) {
            const approvals = await factory_js_1.TurboFactory.unauthenticated(config).getCreditShareApprovals({
                userAddress: address,
            });
            return { ...approvals, nativeAddress: address };
        }
        if (privateKey === undefined) {
            throw new Error('Must provide an (--address) or use a valid wallet');
        }
        const turbo = factory_js_1.TurboFactory.authenticated({
            ...config,
            privateKey,
        });
        const approvals = await turbo.getCreditShareApprovals();
        return {
            ...approvals,
            nativeAddress: await turbo.signer.getNativeAddress(),
        };
    })();
    const hasApprovals = givenApprovals?.length === 0 && receivedApprovals?.length === 0;
    const body = {
        message: `${hasApprovals ? 'No ' : ''}` +
            `Credit Share Approvals found for native address '${nativeAddress}'`,
        givenApprovals,
        receivedApprovals,
    };
    if (givenApprovals?.length > 0) {
        body['givenApprovals'] = givenApprovals;
    }
    if (receivedApprovals?.length > 0) {
        body['receivedApprovals'] = receivedApprovals;
    }
    console.log(JSON.stringify(body, null, 2));
}
