"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARIOToTokenAmount = exports.mARIOToTokenAmount = exports.ARIOToken = void 0;
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
const common_js_1 = require("../../utils/common.js");
const spl_js_1 = require("./spl.js");
const ARIO_SPL_MINT_ADDRESS = 'DcNnMuFxwhgV4WY1HVSaSEgr92bv2b1vUvEKiNxWqHdF';
const DEVNET_ARIO_SPL_MINT_ADDRESS = '6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN';
const ARIO_TOKEN_DECIMALS = 6;
class ARIOToken extends spl_js_1.SplToken {
    constructor({ gatewayUrl = common_js_1.defaultProdGatewayUrls.ario, ...config } = {}) {
        super({
            ...config,
            gatewayUrl,
            tokenName: 'ARIO',
            decimals: ARIO_TOKEN_DECIMALS,
            mintAddress: gatewayUrl.includes('devnet')
                ? DEVNET_ARIO_SPL_MINT_ADDRESS
                : ARIO_SPL_MINT_ADDRESS,
        });
    }
}
exports.ARIOToken = ARIOToken;
const mARIOToTokenAmount = (mARIO) => mARIO;
exports.mARIOToTokenAmount = mARIOToTokenAmount;
const ARIOToTokenAmount = (ario) => new bignumber_js_1.BigNumber(ario).times(1e6).valueOf();
exports.ARIOToTokenAmount = ARIOToTokenAmount;
