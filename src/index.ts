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
import {
  TurboAuthenticatedClient,
  TurboAuthenticatedPaymentService,
  TurboAuthenticatedUploadService,
  TurboUnauthenticatedClient,
  TurboUnauthenticatedPaymentService,
  TurboUnauthenticatedUploadService,
} from './common/index.js';
import { TurboNodeDataItemSigner } from './node/signer.js';
import {
  TurboPrivateConfiguration,
  TurboPublicConfiguration,
} from './types/index.js';
import { isBrowser } from './utils/browser.js';
import { TurboWebDataItemSigner } from './web/signer.js';

export class TurboFactory {
  static public({
    paymentServiceConfig = {},
    uploadServiceConfig = {},
  }: TurboPublicConfiguration = {}) {
    const paymentService = new TurboUnauthenticatedPaymentService({
      ...paymentServiceConfig,
    });
    const uploadService = new TurboUnauthenticatedUploadService({
      ...uploadServiceConfig,
    });
    return new TurboUnauthenticatedClient({
      uploadService,
      paymentService,
    });
  }

  static private({
    privateKey,
    paymentServiceConfig = {},
    uploadServiceConfig = {},
  }: TurboPrivateConfiguration) {
    let dataItemSigner: TurboWebDataItemSigner | TurboNodeDataItemSigner;

    if (isBrowser()) {
      dataItemSigner = new TurboWebDataItemSigner({ privateKey });
    } else {
      dataItemSigner = new TurboNodeDataItemSigner({ privateKey });
    }

    const paymentService = new TurboAuthenticatedPaymentService({
      ...paymentServiceConfig,
      privateKey,
    });
    const uploadService = new TurboAuthenticatedUploadService({
      ...uploadServiceConfig,
      dataItemSigner,
      privateKey,
    });
    return new TurboAuthenticatedClient({
      privateKey,
      uploadService,
      paymentService,
    });
  }
}

// additionally export classes
export * from './common/index.js';
