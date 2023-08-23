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
import { JWKInterface } from '../types/index.js';
import {
  Currency,
  Turbo,
  TurboClientConfiguration,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboPaymentService,
  TurboPriceResponse,
  TurboRateResponse,
  TurboRatesResponse,
  TurboUploadService,
} from '../types/turbo.js';

export class TurboClient implements Turbo {
  protected readonly jwk: JWKInterface | undefined;
  protected readonly paymentService: TurboPaymentService;
  protected readonly uploadService: TurboUploadService;

  constructor({ uploadService, paymentService }: TurboClientConfiguration) {
    this.paymentService = paymentService;
    this.uploadService = uploadService;
  }

  /**
   * Returns the supported fiat currency conversion rate for 1AR based on current market prices.
   */
  async getRate({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboRateResponse> {
    return this.paymentService.getRate({ currency });
  }

  /**
   * Retrieves the latest conversion rates to purchase 1GiB of data for all supported currencies, including all adjustments and fees.
   */
  async getRates(): Promise<TurboRatesResponse> {
    return this.paymentService.getRates();
  }

  /**
   * Provides a comprehensive list of supported countries that can purchase credits through the Turbo Payment Service.
   */
  async getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.paymentService.getSupportedCountries();
  }

  /**
   * Fetches a list of all supported fiat currencies.
   */
  async getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.paymentService.getSupportedCurrencies();
  }

  /**
   * Determines the equivalent price in 'winc' for a specified number of bytes, including all adjustments and fees.
   */
  async getWincPriceForBytes({
    bytes,
  }: {
    bytes: number;
  }): Promise<TurboPriceResponse> {
    return this.paymentService.getWincPriceForBytes({ bytes });
  }

  /**
   * Calculates the corresponding price in 'winc' for a given fiat amount, including all adjustments and fees.
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
   * Fetches the present balance of the user's wallet, denominated in 'winc'. Requires privateKey be provided in the constructor to use.
   */
  async getBalance(): Promise<number> {
    return this.paymentService.getBalance();
  }
}
