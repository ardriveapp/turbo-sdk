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
  TurboAuthenticatedClientConfiguration,
  TurboAuthenticatedClientInterface,
  TurboAuthenticatedPaymentServiceInterface,
  TurboAuthenticatedUploadServiceInterface,
  TurboBalanceResponse,
  TurboCheckoutSessionParams,
  TurboCheckoutSessionResponse,
  TurboCountriesResponse,
  TurboCurrenciesResponse,
  TurboFiatToArResponse,
  TurboFileFactory,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedClientConfiguration,
  TurboUnauthenticatedClientInterface,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadDataItemResponse,
  TurboWincForFiatParams,
  TurboWincForFiatResponse,
} from '../types.js';
import {
  TurboUnauthenticatedPaymentService,
  defaultPaymentServiceURL,
  developmentPaymentServiceURL,
} from './payment.js';
import {
  TurboUnauthenticatedUploadService,
  defaultUploadServiceURL,
  developmentUploadServiceURL,
} from './upload.js';

/**
 * Testing configuration.
 */
export const developmentTurboConfiguration = {
  paymentServiceConfig: {
    url: developmentPaymentServiceURL,
  },
  uploadServiceConfig: {
    url: developmentUploadServiceURL,
  },
};

/**
 * Production configuration.
 */
export const defaultTurboConfiguration = {
  paymentServiceConfig: {
    url: defaultPaymentServiceURL,
  },
  uploadServiceConfig: {
    url: defaultUploadServiceURL,
  },
};

export class TurboUnauthenticatedClient
  implements TurboUnauthenticatedClientInterface
{
  protected paymentService: TurboUnauthenticatedPaymentServiceInterface;
  protected uploadService: TurboUnauthenticatedUploadServiceInterface;

  constructor({
    uploadService = new TurboUnauthenticatedUploadService({}),
    paymentService = new TurboUnauthenticatedPaymentService({}),
  }: TurboUnauthenticatedClientConfiguration) {
    this.paymentService = paymentService;
    this.uploadService = uploadService;
  }

  /**
   * Returns the supported fiat currency conversion rate for 1AR based on current market prices.
   */
  getFiatToAR({
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
  getFiatRates(): Promise<TurboRatesResponse> {
    return this.paymentService.getFiatRates();
  }

  /**
   * Returns a comprehensive list of supported countries that can purchase credits through the Turbo Payment Service.
   */
  getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.paymentService.getSupportedCountries();
  }

  /**
   * Returns a list of all supported fiat currencies.
   */
  getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.paymentService.getSupportedCurrencies();
  }

  /**
   * Determines the price in 'winc' to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
   */
  getUploadCosts({
    bytes,
  }: {
    bytes: number[];
  }): Promise<TurboPriceResponse[]> {
    return this.paymentService.getUploadCosts({ bytes });
  }

  /**
   * Determines the amount of 'winc' that would be returned for a given currency and amount, including all Turbo cost adjustments and fees.
   */
  getWincForFiat(
    params: TurboWincForFiatParams,
  ): Promise<TurboWincForFiatResponse> {
    return this.paymentService.getWincForFiat(params);
  }

  /**
   * Uploads a signed data item to the Turbo Upload Service.
   */
  uploadSignedDataItem({
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

  /**
   * Creates a Turbo Checkout Session for a given amount and currency.
   */
  createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse> {
    return this.paymentService.createCheckoutSession(params);
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
  }: TurboAuthenticatedClientConfiguration) {
    super({ paymentService, uploadService });
  }

  /**
   * Returns the current balance of the user's wallet in 'winc'.
   */
  getBalance(): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance();
  }

  /**
   * Signs and uploads raw data to the Turbo Upload Service.
   */
  uploadFile({
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
