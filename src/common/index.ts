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
import { JWKInterface } from 'arbundles';
import { AxiosInstance } from 'axios';
import winston from 'winston';

import {
  Turbo,
  TurboConfiguration,
  TurboRatesResponse,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import {
  FailedRequestError,
  UnauthenticatedRequestError,
} from '../utils/errors.js';
import { signedRequestHeadersFromJwk } from '../utils/signData.js';

export abstract class TurboClient implements Turbo {
  readonly jwk: JWKInterface | undefined;
  readonly paymentService: AxiosInstance;
  readonly uploadService: AxiosInstance;
  readonly logger = winston.createLogger({
    level: 'info', // TODO: this could be a flag
    defaultMeta: { service: 'turbo-client' },
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
  });

  constructor({
    paymentUrl = 'https://payment.ardrive.dev',
    uploadUrl = 'https://upload.ardrive.dev',
    retryConfig,
    jwk,
  }: TurboConfiguration) {
    this.paymentService = createAxiosInstance({
      logger: this.logger.child({ service: 'payment-service' }),
      axiosConfig: {
        baseURL: `${paymentUrl}/v1`,
      },
      retryConfig,
    });
    this.uploadService = createAxiosInstance({
      logger: this.logger.child({ service: 'upload-service' }),
      axiosConfig: {
        baseURL: `${uploadUrl}/v1`,
      },
      retryConfig,
    });
    this.jwk = jwk;
  }

  async getRates(): Promise<TurboRatesResponse> {
    const {
      status,
      statusText,
      data: rates,
    } = await this.paymentService.get('/rates');

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }
    return rates as TurboRatesResponse;
  }

  async getWincBalance(): Promise<number> {
    if (!this.jwk) {
      throw new UnauthenticatedRequestError();
    }

    const headers = await signedRequestHeadersFromJwk(this.jwk);

    const {
      status,
      statusText,
      data: balance,
    } = await this.paymentService.get('/balance', {
      headers,
    });

    if (status === 404) {
      return 0;
    }

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return +balance;
  }
}
