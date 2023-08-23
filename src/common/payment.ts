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

import { JWKInterface } from '../types/arweave.js';
import {
  Currency,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboPaymentService,
  TurboPaymentServiceConfiguration,
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

export class TurboDefaultPaymentService implements TurboPaymentService {
  protected readonly axios: AxiosInstance;
  protected readonly privateKey: JWKInterface | undefined;

  constructor({
    url = 'https://payment.ardrive.dev',
    retryConfig,
    privateKey,
  }: TurboPaymentServiceConfiguration) {
    this.privateKey = privateKey;
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
  }

  async getFiatRates(): Promise<TurboRatesResponse> {
    const { status, statusText, data: rates } = await this.axios.get('/rates');

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    // TODO: should we return just the fiat rates instead of the whole response?
    return rates as TurboRatesResponse;
  }

  async getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboRateResponse> {
    const {
      status,
      statusText,
      data: rate,
    } = await this.axios.get(`/rates/${currency}`);

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return rate as TurboRateResponse;
  }

  async getSupportedCountries(): Promise<TurboCountriesResponse> {
    const {
      status,
      statusText,
      data: countries,
    } = await this.axios.get('/countries');

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return countries as TurboCountriesResponse;
  }

  async getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    const {
      status,
      statusText,
      data: currencies,
    } = await this.axios.get('/currencies');

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return currencies as TurboCurrenciesResponse;
  }

  async getWincPriceForBytes({
    bytes,
  }: {
    bytes: number;
  }): Promise<TurboPriceResponse> {
    const {
      status,
      statusText,
      data: wincForBytes,
    } = await this.axios.get(`/price/bytes/${bytes}`);

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
    } = await this.axios.get(`/price/${currency}/${amount}`);

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return wincForFiat as TurboPriceResponse;
  }

  async getBalance(): Promise<number> {
    if (!this.privateKey) {
      throw new UnauthenticatedRequestError();
    }

    const headers = await signedRequestHeadersFromJwk(this.privateKey);

    const {
      status,
      statusText,
      data: balance,
    } = await this.axios.get('/balance', {
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
