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

import {
  Currency,
  TurboAuthenticatedPaymentServiceInterface,
  TurboAuthenticatedPaymentServiceInterfaceConfiguration,
  TurboBalanceResponse,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboFiatToArResponse,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboUnauthenticatedPaymentServiceInterfaceConfiguration,
  TurboWalletSigner,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import { FailedRequestError } from '../utils/errors.js';

export class TurboUnauthenticatedPaymentService
  implements TurboUnauthenticatedPaymentServiceInterface
{
  protected readonly axios: AxiosInstance;

  constructor({
    url = 'https://payment.ardrive.dev',
    retryConfig,
  }: TurboUnauthenticatedPaymentServiceInterfaceConfiguration) {
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

  async getUploadCosts({
    bytes,
  }: {
    bytes: number[];
  }): Promise<TurboPriceResponse[]> {
    const fetchPricePromises = bytes.map((byteCount: number) =>
      this.axios.get<TurboPriceResponse>(`/price/bytes/${byteCount}`),
    );
    const responses = await Promise.all(fetchPricePromises);
    const wincCostsForBytes = responses.map(
      ({
        status,
        statusText,
        data,
      }: {
        status: number;
        statusText: string;
        data: TurboPriceResponse;
      }) => {
        if (status !== 200) {
          throw new FailedRequestError(status, statusText);
        }
        return data;
      },
    );

    return wincCostsForBytes;
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
}

// NOTE: we could use an abstract class here, but for consistency sake we'll directly call the public payment service APIs
export class TurboAuthenticatedPaymentService
  implements TurboAuthenticatedPaymentServiceInterface
{
  protected readonly axios: AxiosInstance;
  protected readonly signer: TurboWalletSigner;
  protected readonly publicPaymentService: TurboUnauthenticatedPaymentServiceInterface;

  // TODO: replace private key with an internal signer interface
  constructor({
    url = 'https://payment.ardrive.dev',
    retryConfig,
    signer,
  }: TurboAuthenticatedPaymentServiceInterfaceConfiguration) {
    this.signer = signer;
    // TODO: abstract this away to TurboHTTPService class
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
    this.publicPaymentService = new TurboUnauthenticatedPaymentService({
      url,
      retryConfig,
    });
  }

  getFiatRates(): Promise<TurboRatesResponse> {
    return this.publicPaymentService.getFiatRates();
  }

  getFiatToAR({ currency }): Promise<TurboFiatToArResponse> {
    return this.publicPaymentService.getFiatToAR({ currency });
  }

  getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.publicPaymentService.getSupportedCountries();
  }

  getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.publicPaymentService.getSupportedCurrencies();
  }

  getUploadCosts({ bytes }): Promise<TurboPriceResponse[]> {
    return this.publicPaymentService.getUploadCosts({ bytes });
  }

  getWincForFiat({
    amount,
    currency,
  }): Promise<Omit<TurboPriceResponse, 'adjustments'>> {
    return this.publicPaymentService.getWincForFiat({ amount, currency });
  }

  async getBalance(): Promise<TurboBalanceResponse> {
    const headers = await this.signer.generateSignedRequestHeaders();

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
