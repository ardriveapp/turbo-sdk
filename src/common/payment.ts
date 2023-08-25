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
  TurboBalanceResponse,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboFiatToArResponse,
  TurboPaymentService,
  TurboPaymentServiceConfiguration,
  TurboPriceResponse,
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
    const {
      status,
      statusText,
      data: rates,
    } = await this.axios.get<TurboRatesResponse>('/rates');

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    // TODO: should we return just the fiat rates instead of the whole response?
    return rates;
  }

  async getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse> {
    const {
      status,
      statusText,
      data: rate,
    } = await this.axios.get<TurboFiatToArResponse>(`/rates/${currency}`);

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return rate;
  }

  async getSupportedCountries(): Promise<TurboCountriesResponse> {
    const {
      status,
      statusText,
      data: countries,
    } = await this.axios.get<TurboCountriesResponse>('/countries');

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return countries;
  }

  async getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    const {
      status,
      statusText,
      data: currencies,
    } = await this.axios.get<TurboCurrenciesResponse>('/currencies');

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return currencies;
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
    } = await this.axios.get<TurboPriceResponse>(`/price/bytes/${bytes}`);

    if (status !== 200) {
      throw new Error(`Status: ${status} ${statusText}`);
    }

    return wincForBytes;
  }

  async getWincForFiat({ amount, currency }): Promise<TurboPriceResponse> {
    const {
      status,
      statusText,
      data: wincForFiat,
    } = await this.axios.get<TurboPriceResponse>(
      `/price/${currency}/${amount}`,
    );

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return wincForFiat;
  }

  async getBalance(): Promise<TurboBalanceResponse> {
    if (!this.privateKey) {
      throw new UnauthenticatedRequestError();
    }

    const headers = await signedRequestHeadersFromJwk(this.privateKey);

    const {
      status,
      statusText,
      data: balance,
    } = await this.axios.get<TurboBalanceResponse>('/balance', {
      headers,
    });

    if (status === 404) {
      return {
        winc: '0',
      };
    }

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return balance;
  }
}
