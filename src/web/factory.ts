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
import { EthereumSigner, HexSolanaSigner } from '@ar.io/arbundles';

import { TurboBaseFactory } from '../common/factory.js';
import {
  TurboAuthenticatedClient,
  TurboAuthenticatedPaymentService,
  defaultTokenMap,
} from '../common/index.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import {
  TokenType,
  TurboAuthenticatedConfiguration,
  TurboSigner,
  TurboWallet,
} from '../types.js';
import { createTurboSigner } from '../utils/common.js';
import { TurboWebArweaveSigner } from './signer.js';
import { TurboAuthenticatedUploadService } from './upload.js';

export class TurboFactory extends TurboBaseFactory {
  protected static getSigner(
    providedSigner: TurboSigner | undefined,
    providedPrivateKey: TurboWallet | undefined,
    token: TokenType,
  ): TurboDataItemAbstractSigner {
    return new TurboWebArweaveSigner({
      signer: createTurboSigner({
        signer: providedSigner,
        privateKey: providedPrivateKey,
        token,
      }),
      logger: this.logger,
      token,
    });
  }

  static authenticated({
    privateKey,
    signer: providedSigner,
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    token,
    gatewayUrl,
    tokenMap,
    tokenTools,
  }: TurboAuthenticatedConfiguration) {
    token = token === 'pol' ? 'matic' : token;

    if (!token) {
      if (providedSigner) {
        // Derive token from signer if not provided
        if (providedSigner instanceof EthereumSigner) {
          token = 'ethereum';
        } else if (providedSigner instanceof HexSolanaSigner) {
          token = 'solana';
        } else {
          token = 'arweave';
        }
      } else {
        token = 'arweave';
      }
    }

    const turboSigner = this.getSigner(providedSigner, privateKey, token);

    token ??= 'arweave'; // default to arweave if token is not provided
    if (!tokenTools) {
      if (tokenMap && token === 'arweave') {
        tokenTools = tokenMap.arweave;
      }
      tokenTools = defaultTokenMap[token]?.({
        gatewayUrl,
        logger: this.logger,
      });
    }

    const paymentService = new TurboAuthenticatedPaymentService({
      ...paymentServiceConfig,
      signer: turboSigner,
      logger: this.logger,
      token,
      tokenTools,
    });
    const uploadService = new TurboAuthenticatedUploadService({
      ...uploadServiceConfig,
      signer: turboSigner,
      logger: this.logger,
      token,
    });
    return new TurboAuthenticatedClient({
      uploadService,
      paymentService,
      signer: turboSigner,
    });
  }
}
