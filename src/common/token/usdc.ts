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

import { TokenPollingOptions, TurboLogger } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { ERC20Token } from './erc20.js';

/**
 * Known USDC contract addresses and default RPCs by network
 */
export const usdcNetworks: Record<
  string,
  {
    tokenAddress: string;
    endpoint: string;
  }
> = {
  ethereum: {
    tokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    endpoint: defaultProdGatewayUrls.ethereum,
  },
  base: {
    tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    endpoint: defaultProdGatewayUrls['base-eth'],
  },
  polygon: {
    tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    endpoint: defaultProdGatewayUrls.pol,
  },
};

export const mUSDCToTokenAmount = (mUSDC: BigNumber.Value) => mUSDC;
export const USDCToTokenAmount = (usdc: BigNumber.Value) =>
  new BigNumber(usdc).times(1e6).valueOf();

// TODO: Check for testnet RPCs and use the correct token addresses

export class USDCToken extends ERC20Token {
  constructor({
    network = 'ethereum',
    logger,
    gatewayUrl,
    pollingOptions,
  }: {
    network?: 'ethereum' | 'base' | 'polygon';
    logger?: TurboLogger;
    gatewayUrl?: string;
    pollingOptions?: TokenPollingOptions;
  } = {}) {
    const { tokenAddress, endpoint } = usdcNetworks[network];
    super({
      tokenAddress,
      logger,
      gatewayUrl: gatewayUrl ?? endpoint,
      pollingOptions,
    });
  }
}
