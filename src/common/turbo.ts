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
import { TurboNodeUploadService } from '../node/upload.js';
import { JWKInterface, TurboBalanceResponse } from '../types/index.js';
import {
  Currency,
  Turbo,
  TurboClientConfiguration,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboFiatToArResponse,
  TurboPaymentService,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboUploadService,
} from '../types/index.js';
import { TurboDefaultPaymentService } from './payment.js';

export class TurboClient implements Turbo {
  protected readonly jwk: JWKInterface | undefined;
  protected readonly paymentService: TurboPaymentService;
  protected readonly uploadService: TurboUploadService;

  constructor({
    uploadService = new TurboNodeUploadService({
      url: 'https://turbo.ardrive.dev',
    }),
    paymentService = new TurboDefaultPaymentService({
      url: 'https://payment.ardrive.dev',
    }),
  }: TurboClientConfiguration) {
    this.paymentService = paymentService;
    this.uploadService = uploadService;
  }

  /**
   * Returns the supported fiat currency conversion rate for 1AR based on current market prices.
   */
  async getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse> {
    return this.paymentService.getFiatToAR({ currency });
  }

  /**
   * Returns the latest conversion rates to purchase 1GiB of data for all supported currencies, including all adjustments and fees.
   *
   * Note: this does not take into account varying adjustments and promotions for different sizes of data. If you want to calculate the total
   * cost in 'winc' for a given number of bytes, use getWincPriceForBytes.
   */
  async getFiatRates(): Promise<TurboRatesResponse> {
    return this.paymentService.getFiatRates();
  }

  /**
   * Returns a comprehensive list of supported countries that can purchase credits through the Turbo Payment Service.
   */
  async getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.paymentService.getSupportedCountries();
  }

  /**
   * Returns a list of all supported fiat currencies.
   */
  async getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.paymentService.getSupportedCurrencies();
  }

  /**
   * Determines the price in 'winc' to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
   */
  async getWincPriceForBytes({
    bytes,
  }: {
    bytes: number;
  }): Promise<TurboPriceResponse> {
    return this.paymentService.getWincPriceForBytes({ bytes });
  }

  /**
   * Determines the amount of 'winc' that would be returned for a given currency and amount, including all Turbo cost adjustments and fees.
   */
  async getWincPriceForFiat({
    amount,
    currency,
  }: {
    amount: number;
    currency: Currency;
  }): Promise<Omit<TurboPriceResponse, 'adjustments'>> {
    return this.paymentService.getWincPriceForFiat({ amount, currency });
  }

  /**
   * Returns the current balance of the user's wallet in 'winc'.
   *
   * Note: 'privateKey' must be provided to use.
   */
  async getBalance(): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance();
  }
}
