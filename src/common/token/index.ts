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

import {
  AoProcessConfig,
  TokenConfig,
  TokenFactory,
  TokenType,
  tokenTypes,
} from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { ARIOToTokenAmount, ARIOToken } from './ario.js';
import { ARToTokenAmount, ArweaveToken } from './arweave.js';
import { BaseEthToken, defaultBaseNetworkPollingOptions } from './baseEth.js';
import { ERC20Token } from './erc20.js';
import { ETHToTokenAmount, EthereumToken } from './ethereum.js';
import { KYVEToTokenAmount, KyveToken } from './kyve.js';
import { POLToTokenAmount, PolygonToken } from './polygon.js';
import { SOLToTokenAmount, SolanaToken } from './solana.js';
import { USDCToTokenAmount, USDCToken } from './usdc.js';

const baseARIOContractAddress = '0x138746adfA52909E5920def027f5a8dc1C7EfFb6';

export const defaultTokenMap: TokenFactory = {
  arweave: (config: TokenConfig) => new ArweaveToken(config),
  ario: (config: AoProcessConfig) => new ARIOToken(config),
  solana: (config: TokenConfig) => new SolanaToken(config),
  ethereum: (config: TokenConfig) => new EthereumToken(config),
  'base-eth': (config: TokenConfig) => new BaseEthToken(config),
  kyve: (config: TokenConfig) => new KyveToken(config),
  matic: (config: TokenConfig) => new PolygonToken(config),
  pol: (config: TokenConfig) => new PolygonToken(config),
  usdc: (config: TokenConfig) =>
    new USDCToken({ network: 'ethereum', ...config }),
  'base-usdc': (config: TokenConfig) =>
    new USDCToken({ network: 'base', ...config }),
  'polygon-usdc': (config: TokenConfig) =>
    new USDCToken({ network: 'polygon', ...config }),
  'base-ario': (config: TokenConfig) =>
    new ERC20Token({
      ...config,
      pollingOptions: config.pollingOptions ?? defaultBaseNetworkPollingOptions,
      tokenContractAddress: baseARIOContractAddress,
      gatewayUrl: config.gatewayUrl ?? defaultProdGatewayUrls['base-ario'],
    }),
} as const;

const ethExponent = 18;
const usdcExponent = 6;
const arioExponent = 6;

export const exponentMap: Record<TokenType, number> = {
  arweave: 12,
  ario: arioExponent,
  'base-ario': arioExponent,
  solana: 9,
  ethereum: ethExponent,
  'base-eth': ethExponent,
  kyve: 6,
  matic: ethExponent,
  pol: ethExponent,
  usdc: usdcExponent,
  'base-usdc': usdcExponent,
  'polygon-usdc': usdcExponent,
} as const;

export const tokenToBaseMap: Record<
  TokenType,
  (a: BigNumber.Value) => BigNumber.Value
> = {
  arweave: (a: BigNumber.Value) => ARToTokenAmount(a),
  ario: (a: BigNumber.Value) => ARIOToTokenAmount(a),
  'base-ario': (a: BigNumber.Value) => USDCToTokenAmount(a),
  solana: (a: BigNumber.Value) => SOLToTokenAmount(a),
  ethereum: (a: BigNumber.Value) => ETHToTokenAmount(a),
  'base-eth': (a: BigNumber.Value) => ETHToTokenAmount(a),
  kyve: (a: BigNumber.Value) => KYVEToTokenAmount(a),
  matic: (a: BigNumber.Value) => POLToTokenAmount(a),
  pol: (a: BigNumber.Value) => POLToTokenAmount(a),
  usdc: (a: BigNumber.Value) => USDCToTokenAmount(a),
  'base-usdc': (a: BigNumber.Value) => USDCToTokenAmount(a),
  'polygon-usdc': (a: BigNumber.Value) => USDCToTokenAmount(a),
} as const;

export function isTokenType(token: string): token is TokenType {
  return tokenTypes.includes(token as TokenType);
}

export * from './arweave.js';
export * from './ario.js';
export * from './solana.js';
export * from './ethereum.js';
export * from './baseEth.js';
export * from './polygon.js';
export * from './kyve.js';
