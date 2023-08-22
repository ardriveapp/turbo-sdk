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
   * Fetches the latest conversion rate for a specified currency. The returned rate includes
   * all related fees and adjustments. For example, if 'USD' is specified, it will return the
   * most recent rate of converting USD to the platform's primary currency.
   */
  async getRate({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboRateResponse> {
    return this.paymentService.getRate({ currency });
  }

  /**
   * Retrieves the latest conversion rates for all the fiat currencies that the platform
   * supports. This provides an overview of the conversion values, inclusive of any associated
   * fees and adjustments.
   */
  async getRates(): Promise<TurboRatesResponse> {
    return this.paymentService.getRates();
  }

  /**
   * Provides a comprehensive list of countries that the platform recognizes and supports.
   * This is useful to understand the geographic reach and limitations of the platform.
   */
  async getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.paymentService.getSupportedCountries();
  }

  /**
   * Fetches a list of all fiat currencies recognized and supported by the platform.
   * This gives an idea about the platform's versatility in handling various currency types.
   */
  async getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.paymentService.getSupportedCurrencies();
  }

  /**
   * Determines the equivalent price in 'winc' for a specified number of bytes.
   * This conversion will factor in all relevant fees and adjustments to give an accurate pricing.
   */
  async getWincPriceForBytes({
    bytes,
  }: {
    bytes: number;
  }): Promise<TurboPriceResponse> {
    return this.paymentService.getWincPriceForBytes({ bytes });
  }

  /**
   * Calculates the corresponding price in 'winc' for a given fiat amount. The result offers
   * a clear understanding of how much 'winc' a specific fiat value can fetch, after considering
   * all related fees and adjustments.
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
   * Fetches the present balance of the user's wallet, denominated in 'winc'. This allows users
   * to stay updated about their financial standing within the platform.
   */
  async getBalance(): Promise<number> {
    return this.paymentService.getBalance();
  }
}
