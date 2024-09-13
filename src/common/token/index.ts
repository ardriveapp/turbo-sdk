/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { BigNumber } from 'bignumber.js';

import {
  TokenConfig,
  TokenFactory,
  TokenType,
  tokenTypes,
} from '../../types.js';
import { ARToTokenAmount, ArweaveToken } from './arweave.js';
import { ETHToTokenAmount, EthereumToken } from './ethereum.js';
import { KYVEToTokenAmount, KyveToken } from './kyve.js';
import { PolygonToken } from './polygon.js';
import { SOLToTokenAmount, SolanaToken } from './solana.js';

export const defaultTokenMap: TokenFactory = {
  arweave: (config: TokenConfig) => new ArweaveToken(config),
  solana: (config: TokenConfig) => new SolanaToken(config),
  ethereum: (config: TokenConfig) => new EthereumToken(config),
  kyve: (config: TokenConfig) => new KyveToken(config),
  matic: (config: TokenConfig) => new PolygonToken(config),
  pol: (config: TokenConfig) => new PolygonToken(config),
} as const;

export const tokenToBaseMap: Record<
  TokenType,
  (a: BigNumber.Value) => BigNumber.Value
> = {
  arweave: (a: BigNumber.Value) => ARToTokenAmount(a),
  solana: (a: BigNumber.Value) => SOLToTokenAmount(a),
  ethereum: (a: BigNumber.Value) => ETHToTokenAmount(a),
  kyve: (a: BigNumber.Value) => KYVEToTokenAmount(a),
  matic: (a: BigNumber.Value) => ETHToTokenAmount(a),
  pol: (a: BigNumber.Value) => ETHToTokenAmount(a),
} as const;

export function isTokenType(token: string): token is TokenType {
  return tokenTypes.includes(token as TokenType);
}

export * from './arweave.js';
export * from './solana.js';
export * from './ethereum.js';
export * from './kyve.js';
