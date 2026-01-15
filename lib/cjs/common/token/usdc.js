"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USDCToken = exports.USDCToTokenAmount = exports.mUSDCToTokenAmount = exports.usdcNetworks = void 0;
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
const baseEth_js_1 = require("./baseEth.js");
const erc20_js_1 = require("./erc20.js");
const ethereum_js_1 = require("./ethereum.js");
const polygon_js_1 = require("./polygon.js");
/**
 * Known USDC contract addresses and default RPCs by network
 */
const usdcNetworks = (useDevnet = false) => ({
    ethereum: {
        tokenContractAddress: useDevnet
            ? ethSepoliaUsdcAddress
            : ethMainnetUsdcAddress,
        rpcEndpoint: useDevnet
            ? common_js_1.tokenToDevGatewayMap.ethereum
            : common_js_1.defaultProdGatewayUrls.ethereum,
        defaultPollingOptions: ethereum_js_1.defaultEthereumPollingOptions,
    },
    base: {
        tokenContractAddress: useDevnet
            ? baseSepoliaUsdcAddress
            : baseMainnetUsdcAddress,
        rpcEndpoint: useDevnet
            ? common_js_1.tokenToDevGatewayMap['base-eth']
            : common_js_1.defaultProdGatewayUrls['base-eth'],
        defaultPollingOptions: baseEth_js_1.defaultBaseNetworkPollingOptions,
    },
    polygon: {
        tokenContractAddress: useDevnet
            ? polygonAmoyUsdcAddress
            : polygonMainnetUsdcAddress,
        rpcEndpoint: useDevnet
            ? common_js_1.tokenToDevGatewayMap.pol
            : common_js_1.defaultProdGatewayUrls.pol,
        defaultPollingOptions: polygon_js_1.defaultPolygonPollingOptions,
    },
});
exports.usdcNetworks = usdcNetworks;
const ethMainnetUsdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const baseMainnetUsdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const polygonMainnetUsdcAddress = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
const ethSepoliaUsdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const baseSepoliaUsdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const polygonAmoyUsdcAddress = '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582';
const mUSDCToTokenAmount = (mUSDC) => mUSDC;
exports.mUSDCToTokenAmount = mUSDCToTokenAmount;
const USDCToTokenAmount = (usdc) => new bignumber_js_1.BigNumber(usdc).times(1e6).valueOf();
exports.USDCToTokenAmount = USDCToTokenAmount;
class USDCToken extends erc20_js_1.ERC20Token {
    constructor({ network = 'ethereum', logger, gatewayUrl, tokenContractAddress, pollingOptions, useDevnet, } = {}) {
        if (useDevnet === undefined) {
            const keywords = ['sepolia', 'amoy'];
            useDevnet = keywords.some((keyword) => (gatewayUrl ?? '').toLowerCase().includes(keyword));
        }
        const { tokenContractAddress: usdcContractAddress, rpcEndpoint, defaultPollingOptions, } = (0, exports.usdcNetworks)(useDevnet)[network];
        super({
            tokenContractAddress: tokenContractAddress ?? usdcContractAddress,
            logger,
            gatewayUrl: gatewayUrl ?? rpcEndpoint,
            pollingOptions: pollingOptions ?? defaultPollingOptions,
        });
    }
}
exports.USDCToken = USDCToken;
