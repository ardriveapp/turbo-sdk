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
    token = token === 'pol' ? 'matic' : token;

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
