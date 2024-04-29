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
import { ArweaveSigner, EthereumSigner, HexSolanaSigner } from 'arbundles/node';

import { TurboNodeSigner } from '../node/signer.js';
import {
  TurboAuthenticatedConfiguration,
  TurboSigner,
  TurboUnauthenticatedConfiguration,
} from '../types.js';
import { TurboWebArweaveSigner } from '../web/signer.js';
import { TurboWinstonLogger } from './logger.js';
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';
import { tokenMap } from './token.js';
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

  static authenticated({
    privateKey,
    signer: providedSigner,
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    token = 'arweave',
    gatewayUrl,
    tokenTools,
  }: TurboAuthenticatedConfiguration) {
    let signer: TurboSigner;

    if (providedSigner) {
      signer = providedSigner;

      // Derive token from signer if not provided
      if (!token) {
        if (signer instanceof EthereumSigner) {
          token = 'ethereum';
        } else if (signer instanceof HexSolanaSigner) {
          token = 'solana';
        }
      }
    } else if (privateKey) {
      if (token === 'solana') {
        // TODO: test wallet creation
        signer = new HexSolanaSigner(privateKey);
      } else {
        signer = new ArweaveSigner(privateKey);
      }
    } else {
      throw new Error('A privateKey or signer must be provided.');
    }

    // when in browser, we use TurboWebArweaveSigner
    const turboSigner =
      typeof window !== 'undefined'
        ? new TurboWebArweaveSigner({
            signer,
            logger: this.logger,
          })
        : new TurboNodeSigner({
            signer,
            logger: this.logger,
          });

    if (!tokenTools) {
      tokenTools = tokenMap[token]?.({
        gatewayUrl,
        logger: this.logger,
      });
    }

    const paymentService = new TurboAuthenticatedPaymentService({
      ...paymentServiceConfig,
      signer: turboSigner,
      logger: this.logger,
      tokenTools,
    });
    const uploadService = new TurboAuthenticatedUploadService({
      ...uploadServiceConfig,
      signer: turboSigner,
      logger: this.logger,
    });
    return new TurboAuthenticatedClient({
      uploadService,
      paymentService,
    });
  }
}
