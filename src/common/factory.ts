/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { ArweaveSigner, EthereumSigner, HexSolanaSigner } from 'arbundles';

import { TurboNodeSigner } from '../node/signer.js';
import {
  TokenType,
  TurboAuthenticatedConfiguration,
  TurboSigner,
  TurboUnauthenticatedConfiguration,
  TurboWallet,
  isEthPrivateKey,
  isJWK,
} from '../types.js';
import { TurboWebArweaveSigner } from '../web/signer.js';
import { JWKInterface } from './jwk.js';
import { TurboWinstonLogger } from './logger.js';
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';
import { TurboDataItemAbstractSigner } from './signer.js';
import { defaultTokenMap } from './token/index.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from './turbo.js';
import {
  TurboAuthenticatedUploadService,
  TurboUnauthenticatedUploadService,
} from './upload.js';

export class TurboBaseFactory {
  protected static logger = new TurboWinstonLogger();

  static setLogLevel(level: string) {
    this.logger.setLogLevel(level);
  }

  static setLogFormat(format: string) {
    this.logger.setLogFormat(format);
  }

  static unauthenticated({
    paymentServiceConfig = {},
    uploadServiceConfig = {},
  }: TurboUnauthenticatedConfiguration = {}) {
    const paymentService = new TurboUnauthenticatedPaymentService({
      ...paymentServiceConfig,
      logger: this.logger,
    });
    const uploadService = new TurboUnauthenticatedUploadService({
      ...uploadServiceConfig,
      logger: this.logger,
    });
    return new TurboUnauthenticatedClient({
      uploadService,
      paymentService,
    });
  }

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

    if (typeof window !== 'undefined') {
      return new TurboWebArweaveSigner({
        signer,
        logger: this.logger,
      });
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
