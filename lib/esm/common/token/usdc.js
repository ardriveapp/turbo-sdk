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
import { BigNumber } from 'bignumber.js';
import { defaultProdGatewayUrls, tokenToDevGatewayMap, } from '../../utils/common.js';
import { defaultBaseNetworkPollingOptions } from './baseEth.js';
import { ERC20Token } from './erc20.js';
import { defaultEthereumPollingOptions } from './ethereum.js';
import { defaultPolygonPollingOptions } from './polygon.js';
/**
 * Known USDC contract addresses and default RPCs by network
 */
export const usdcNetworks = (useDevnet = false) => ({
    ethereum: {
        tokenContractAddress: useDevnet
            ? ethSepoliaUsdcAddress
            : ethMainnetUsdcAddress,
        rpcEndpoint: useDevnet
            ? tokenToDevGatewayMap.ethereum
            : defaultProdGatewayUrls.ethereum,
        defaultPollingOptions: defaultEthereumPollingOptions,
    },
    base: {
        tokenContractAddress: useDevnet
            ? baseSepoliaUsdcAddress
            : baseMainnetUsdcAddress,
        rpcEndpoint: useDevnet
            ? tokenToDevGatewayMap['base-eth']
            : defaultProdGatewayUrls['base-eth'],
        defaultPollingOptions: defaultBaseNetworkPollingOptions,
    },
    polygon: {
        tokenContractAddress: useDevnet
            ? polygonAmoyUsdcAddress
            : polygonMainnetUsdcAddress,
        rpcEndpoint: useDevnet
            ? tokenToDevGatewayMap.pol
            : defaultProdGatewayUrls.pol,
        defaultPollingOptions: defaultPolygonPollingOptions,
    },
});
const ethMainnetUsdcAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const baseMainnetUsdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const polygonMainnetUsdcAddress = '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359';
const ethSepoliaUsdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const baseSepoliaUsdcAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const polygonAmoyUsdcAddress = '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582';
export const mUSDCToTokenAmount = (mUSDC) => mUSDC;
export const USDCToTokenAmount = (usdc) => new BigNumber(usdc).times(1e6).valueOf();
export class USDCToken extends ERC20Token {
    constructor({ network = 'ethereum', logger, gatewayUrl, tokenContractAddress, pollingOptions, useDevnet, } = {}) {
        if (useDevnet === undefined) {
            const keywords = ['sepolia', 'amoy'];
            useDevnet = keywords.some((keyword) => (gatewayUrl ?? '').toLowerCase().includes(keyword));
        }
        const { tokenContractAddress: usdcContractAddress, rpcEndpoint, defaultPollingOptions, } = usdcNetworks(useDevnet)[network];
        super({
            tokenContractAddress: tokenContractAddress ?? usdcContractAddress,
            logger,
            gatewayUrl: gatewayUrl ?? rpcEndpoint,
            pollingOptions: pollingOptions ?? defaultPollingOptions,
        });
    }
}
