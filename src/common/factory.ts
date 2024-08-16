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
import { TurboUnauthenticatedConfiguration } from '../types.js';
import { TurboWinstonLogger } from './logger.js';
import { TurboUnauthenticatedPaymentService } from './payment.js';
import { TurboUnauthenticatedClient } from './turbo.js';
import { TurboUnauthenticatedUploadService } from './upload.js';

export abstract class TurboBaseFactory {
  protected static logger = TurboWinstonLogger.default;

  /* @deprecated - use TurboWinstonLogger directly */
  static setLogLevel(level: string) {
    this.logger.setLogLevel(level);
  }

  /* @deprecated - use TurboWinstonLogger directly */
  static setLogFormat(format: string) {
    this.logger.setLogFormat(format);
  }

  static unauthenticated({
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    token,
  }: TurboUnauthenticatedConfiguration = {}) {
    const paymentService = new TurboUnauthenticatedPaymentService({
      ...paymentServiceConfig,
      logger: this.logger,
      token,
    });
    const uploadService = new TurboUnauthenticatedUploadService({
      ...uploadServiceConfig,
      logger: this.logger,
      token,
    });
    return new TurboUnauthenticatedClient({
      uploadService,
      paymentService,
    });
  }
}
