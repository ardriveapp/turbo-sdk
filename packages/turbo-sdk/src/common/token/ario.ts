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

import { AoProcessConfig, TokenConfig } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { SplToken } from './spl.js';

const ARIO_SPL_MINT_ADDRESS = 'DcNnMuFxwhgV4WY1HVSaSEgr92bv2b1vUvEKiNxWqHdF';
const DEVNET_ARIO_SPL_MINT_ADDRESS =
  '6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN';
const ARIO_TOKEN_DECIMALS = 6;

export class ARIOToken extends SplToken {
  constructor({
    gatewayUrl = defaultProdGatewayUrls.ario,
    ...config
  }: Partial<AoProcessConfig> & TokenConfig = {}) {
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

export const mARIOToTokenAmount = (mARIO: BigNumber.Value) => mARIO;
export const ARIOToTokenAmount = (ario: BigNumber.Value) =>
  new BigNumber(ario).times(1e6).valueOf();
