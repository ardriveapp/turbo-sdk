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
import { TurboHTTPService } from './http.js';

export class TurboUnauthenticatedPaymentService
  implements TurboUnauthenticatedPaymentServiceInterface
{
  protected readonly httpService: TurboHTTPService;

  constructor({
    url = 'https://payment.ardrive.dev',
    retryConfig,
  }: TurboUnauthenticatedPaymentServiceInterfaceConfiguration) {
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
    });
  }

  async getFiatRates(): Promise<TurboRatesResponse> {
    return this.httpService.get<TurboRatesResponse>({
      endpoint: '/rates',
    });
  }

  async getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse> {
    return this.httpService.get<TurboFiatToArResponse>({
      endpoint: `/rates/${currency}`,
    });
  }

  async getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.httpService.get<TurboCountriesResponse>({
      endpoint: '/countries',
    });
  }

  async getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.httpService.get<TurboCurrenciesResponse>({
      endpoint: '/currencies',
    });
  }

  async getUploadCosts({
    bytes,
  }: {
    bytes: number[];
  }): Promise<TurboPriceResponse[]> {
    const fetchPricePromises = bytes.map((byteCount: number) =>
      this.httpService.get<TurboPriceResponse>({
        endpoint: `/price/bytes/${byteCount}`,
      }),
    );
    const wincCostsForBytes: TurboPriceResponse[] =
      await Promise.all(fetchPricePromises);
    return wincCostsForBytes;
  }

  async getWincForFiat({ amount, currency }): Promise<TurboPriceResponse> {
    return this.httpService.get<TurboPriceResponse>({
      endpoint: `/price/${currency}/${amount}`,
    });
  }
}

// NOTE: we could use an abstract class here, but for consistency sake we'll directly call the public payment service APIs
export class TurboAuthenticatedPaymentService
  implements TurboAuthenticatedPaymentServiceInterface
{
  protected readonly httpService: TurboHTTPService;
  protected readonly signer: TurboWalletSigner;
  protected readonly publicPaymentService: TurboUnauthenticatedPaymentServiceInterface;

  constructor({
    url = 'https://payment.ardrive.dev',
    retryConfig,
    signer,
  }: TurboAuthenticatedPaymentServiceInterfaceConfiguration) {
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
    });
    this.publicPaymentService = new TurboUnauthenticatedPaymentService({
      url,
      retryConfig,
    });
    this.signer = signer;
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
    const balance = await this.httpService.get<TurboBalanceResponse>({
      endpoint: '/balance',
      headers,
      allowedStatuses: [200, 404],
    });

    // 404's don't return a balance, so default to 0
    return balance.winc ? balance : { winc: '0' };
  }
}
