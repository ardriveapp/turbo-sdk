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
import { ArweaveSigner } from 'arbundles';

import { TurboBaseFactory } from '../common/factory.js';
import {
  TurboAuthenticatedClient,
  TurboAuthenticatedPaymentService,
  TurboAuthenticatedUploadService,
} from '../common/index.js';
import { TurboAuthenticatedConfiguration, TurboSigner } from '../types.js';
import { TurboWebArweaveSigner } from './signer.js';

export class TurboFactory extends TurboBaseFactory {
  static authenticated({
    privateKey,
    signer: providedSigner,
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    tokenMap,
    token,
  }: TurboAuthenticatedConfiguration) {
    let signer: TurboSigner;

    if (providedSigner) {
      signer = providedSigner;
    } else if (privateKey) {
      signer = new ArweaveSigner(privateKey);
    } else {
      throw new Error('A privateKey or signer must be provided.');
    }

    const turboSigner = new TurboWebArweaveSigner({
      signer,
      logger: this.logger,
    });
    const paymentService = new TurboAuthenticatedPaymentService({
      ...paymentServiceConfig,
      signer: turboSigner,
      logger: this.logger,
      tokenMap,
      token,
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
