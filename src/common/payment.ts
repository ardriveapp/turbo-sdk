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
} from '../types.js';
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

// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
export class TurboAuthenticatedPaymentService
  extends TurboUnauthenticatedPaymentService
  implements TurboAuthenticatedPaymentServiceInterface
{
  protected readonly signer: TurboWalletSigner;

  constructor({
    url = 'https://payment.ardrive.dev',
    retryConfig,
    signer,
  }: TurboAuthenticatedPaymentServiceInterfaceConfiguration) {
    super({ url, retryConfig });
    this.signer = signer;
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
