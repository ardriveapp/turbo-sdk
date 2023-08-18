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
import { AxiosInstance } from 'axios';
import winston from 'winston';

import { JWKInterface } from '../types/index.js';
import {
  Turbo,
  TurboConfiguration,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboPriceResponse,
  TurboRateResponse,
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

    // TODO: should we return just the fiat rates instead of the whole response?
    return rates as TurboRatesResponse;
  }

  async getRate(currency: string): Promise<TurboRateResponse> {
    const {
      status,
      statusText,
      data: rate,
    } = await this.paymentService.get(`/rates/${currency}`);

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }

    // TODO: should we return just the fiat rates instead of the whole response?
    return rate as TurboRateResponse;
  }

  async getCountries(): Promise<TurboCountriesResponse> {
    const {
      status,
      statusText,
      data: countries,
    } = await this.paymentService.get('/countries');

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }

    return countries as TurboCountriesResponse;
  }

  async getCurrencies(): Promise<TurboCurrenciesResponse> {
    const {
      status,
      statusText,
      data: currencies,
    } = await this.paymentService.get('/currencies');

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }

    return currencies as TurboCurrenciesResponse;
  }

  async getWincPriceForBytes(bytes: number): Promise<TurboPriceResponse> {
    const {
      status,
      statusText,
      data: wincForBytes,
    } = await this.paymentService.get(`/price/bytes/${bytes}`);

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }

    return wincForBytes as TurboPriceResponse;
  }

  async getWincPriceForFiat({ amount, currency }): Promise<TurboPriceResponse> {
    const {
      status,
      statusText,
      data: wincForFiat,
    } = await this.paymentService.get(`/price/${currency}/${amount}`);

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }

    return wincForFiat as TurboPriceResponse;
  }

  async getBalance(): Promise<number> {
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
