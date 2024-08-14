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
import {
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
  JWKInterface,
} from 'arbundles';

import { TurboBaseFactory } from '../common/factory.js';
import { defaultTokenMap } from '../common/index.js';
import { TurboAuthenticatedPaymentService } from '../common/payment.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import { TurboAuthenticatedClient } from '../common/turbo.js';
import {
  TokenType,
  TurboAuthenticatedConfiguration,
  TurboSigner,
  TurboWallet,
  isEthPrivateKey,
  isJWK,
} from '../types.js';
import { TurboNodeSigner } from './signer.js';
import { TurboAuthenticatedUploadService } from './upload.js';

export class TurboFactory extends TurboBaseFactory {
  protected static getSigner(
    providedSigner: TurboSigner | undefined,
    providedPrivateKey: TurboWallet | undefined,
    token: TokenType,
  ): TurboDataItemAbstractSigner {
    let signer: TurboSigner;

    if (providedSigner !== undefined) {
      signer = providedSigner;
    } else if (providedPrivateKey !== undefined) {
      if (token === 'solana') {
        signer = new HexSolanaSigner(providedPrivateKey);
      } else if (token === 'ethereum') {
        if (!isEthPrivateKey(providedPrivateKey)) {
          throw new Error(
            'An Ethereum private key must be provided for EthereumSigner.',
          );
        }
        signer = new EthereumSigner(providedPrivateKey);
      } else {
        if (!isJWK(providedPrivateKey)) {
          throw new Error('A JWK must be provided for ArweaveSigner.');
        }
        signer = new ArweaveSigner(providedPrivateKey as JWKInterface);
      }
    } else {
      throw new Error('A privateKey or signer must be provided.');
    }

    return new TurboNodeSigner({
      signer,
      logger: this.logger,
    });
  }

  static authenticated({
    privateKey,
    signer: providedSigner,
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    token,
    tokenMap,
    gatewayUrl,
    tokenTools,
  }: TurboAuthenticatedConfiguration) {
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
    });
  }
}
