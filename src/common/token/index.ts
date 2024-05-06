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
import { TokenConfig, TokenFactory } from '../../types.js';
import { ArweaveToken } from './arweave.js';
import { EthereumToken } from './ethereum.js';
import { SolanaToken } from './solana.js';

export const defaultTokenMap: TokenFactory = {
  arweave: (config: TokenConfig) => new ArweaveToken(config),
  solana: (config: TokenConfig) => new SolanaToken(config),
  ethereum: (config: TokenConfig) => new EthereumToken(config),
} as const;

export * from './arweave.js';
export * from './solana.js';
export * from './ethereum.js';
