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
import { TurboPaymentServiceClient } from './common/payment.js';
import { TurboClient } from './common/turbo.js';
import { TurboNodeUploadService } from './node/upload.js';
import { TurboConfiguration } from './types/turbo.js';
import { TurboWebUploadService } from './web/upload.js';

export class TurboFactory {
  static init(config: TurboConfiguration) {
    const { privateKey, paymentServiceConfig, uploadServiceConfig } = config;
    const paymentService = new TurboPaymentServiceClient({
      ...paymentServiceConfig,
      privateKey,
    });
    if (
      typeof window !== 'undefined' &&
      typeof window.document !== 'undefined'
    ) {
      const uploadService = new TurboWebUploadService({
        ...uploadServiceConfig,
        privateKey,
      });
      return new TurboClient({ uploadService, paymentService });
    } else if (typeof global !== 'undefined' && global.process.versions.node) {
      const uploadService = new TurboNodeUploadService({
        ...uploadServiceConfig,
        privateKey,
      });
      return new TurboClient({ uploadService, paymentService });
    } else {
      throw new Error('Unknown environment.');
    }
  }
}
