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
  TurboAbortSignal,
  TurboAuthenticatedClientInterface,
  TurboAuthenticatedPaymentServiceInterface,
  TurboAuthenticatedUploadServiceInterface,
  TurboBalanceResponse,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboFiatToArResponse,
  TurboFileFactory,
  TurboPriceResponse,
  TurboPrivateClientConfiguration,
  TurboPublicClientConfiguration,
  TurboRatesResponse,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedClientInterface,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadDataItemResponse,
} from '../types.js';
import { TurboUnauthenticatedPaymentService } from './payment.js';
import { TurboUnauthenticatedUploadService } from './upload.js';

export class TurboUnauthenticatedClient
  implements TurboUnauthenticatedClientInterface
{
  protected paymentService: TurboUnauthenticatedPaymentServiceInterface;
  protected uploadService: TurboUnauthenticatedUploadServiceInterface;

  constructor({
    uploadService = new TurboUnauthenticatedUploadService({}),
    paymentService = new TurboUnauthenticatedPaymentService({}),
  }: TurboPublicClientConfiguration) {
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
   * cost in 'winc' for a given number of bytes, use getUploadCosts.
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
  async getUploadCosts({
    bytes,
  }: {
    bytes: number[];
  }): Promise<TurboPriceResponse[]> {
    return this.paymentService.getUploadCosts({ bytes });
  }

  /**
   * Determines the amount of 'winc' that would be returned for a given currency and amount, including all Turbo cost adjustments and fees.
   */
  async getWincForFiat({
    amount,
    currency,
  }: {
    amount: number;
    currency: Currency;
  }): Promise<Omit<TurboPriceResponse, 'adjustments'>> {
    return this.paymentService.getWincForFiat({ amount, currency });
  }

  /**
   * Uploads a signed data item to the Turbo Upload Service.
   */
  async uploadSignedDataItem({
    dataItemStreamFactory,
    dataItemSizeFactory,
    signal,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadSignedDataItem({
      dataItemStreamFactory,
      dataItemSizeFactory,
      signal,
    });
  }
}

export class TurboAuthenticatedClient
  extends TurboUnauthenticatedClient
  implements TurboAuthenticatedClientInterface
{
  // override the parent classes for authenticated types
  protected paymentService: TurboAuthenticatedPaymentServiceInterface;
  protected uploadService: TurboAuthenticatedUploadServiceInterface;

  constructor({
    paymentService,
    uploadService,
  }: TurboPrivateClientConfiguration) {
    super({ paymentService, uploadService });
  }

  /**
   * Returns the current balance of the user's wallet in 'winc'.
   */
  async getBalance(): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance();
  }

  /**
   * Signs and uploads raw data to the Turbo Upload Service.
   */
  async uploadFile({
    fileStreamFactory,
    fileSizeFactory,
    signal,
  }: TurboFileFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadFile({
      fileStreamFactory,
      fileSizeFactory,
      signal,
    });
  }
}
