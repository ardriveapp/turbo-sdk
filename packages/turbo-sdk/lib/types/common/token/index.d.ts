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
import { TokenFactory, TokenType } from '../../types.js';
export declare const defaultTokenMap: TokenFactory;
export declare const exponentMap: Record<TokenType, number>;
export declare const tokenToBaseMap: Record<TokenType, (a: BigNumber.Value) => BigNumber.Value>;
export declare function isTokenType(token: string): token is TokenType;
export * from './arweave.js';
export * from './ario.js';
export * from './solana.js';
export * from './ethereum.js';
export * from './baseEth.js';
export * from './polygon.js';
export * from './kyve.js';
//# sourceMappingURL=index.d.ts.map