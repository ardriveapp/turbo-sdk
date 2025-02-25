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
  TokenConfig,
  TokenFactory,
  TokenType,
  tokenTypes,
} from '../../types.js';
import { ARToTokenAmount, ArweaveToken } from './arweave.js';
import { BaseEthToken } from './baseEth.js';
import { ETHToTokenAmount, EthereumToken } from './ethereum.js';
import { KYVEToTokenAmount, KyveToken } from './kyve.js';
import { POLToTokenAmount, PolygonToken } from './polygon.js';
import { SOLToTokenAmount, SolanaToken } from './solana.js';

export const defaultTokenMap: TokenFactory = {
  arweave: (config: TokenConfig) => new ArweaveToken(config),
  solana: (config: TokenConfig) => new SolanaToken(config),
  ethereum: (config: TokenConfig) => new EthereumToken(config),
  'base-eth': (config: TokenConfig) => new BaseEthToken(config),
  kyve: (config: TokenConfig) => new KyveToken(config),
  matic: (config: TokenConfig) => new PolygonToken(config),
  pol: (config: TokenConfig) => new PolygonToken(config),
} as const;

const ethExponent = 18;

export const exponentMap: Record<TokenType, number> = {
  arweave: 12,
  solana: 9,
  ethereum: ethExponent,
  'base-eth': ethExponent,
  kyve: 6,
  matic: ethExponent,
  pol: ethExponent,
} as const;

export const tokenToBaseMap: Record<
  TokenType,
  (a: BigNumber.Value) => BigNumber.Value
> = {
  arweave: (a: BigNumber.Value) => ARToTokenAmount(a),
  solana: (a: BigNumber.Value) => SOLToTokenAmount(a),
  ethereum: (a: BigNumber.Value) => ETHToTokenAmount(a),
  'base-eth': (a: BigNumber.Value) => ETHToTokenAmount(a),
  kyve: (a: BigNumber.Value) => KYVEToTokenAmount(a),
  matic: (a: BigNumber.Value) => POLToTokenAmount(a),
  pol: (a: BigNumber.Value) => POLToTokenAmount(a),
} as const;

export function isTokenType(token: string): token is TokenType {
  return tokenTypes.includes(token as TokenType);
}

export * from './arweave.js';
export * from './solana.js';
export * from './ethereum.js';
export * from './baseEth.js';
export * from './polygon.js';
export * from './kyve.js';
