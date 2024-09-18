/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  Currency,
  NativeAddress,
  TokenType,
  TurboAbortSignal,
  TurboAuthenticatedClientConfiguration,
  TurboAuthenticatedClientInterface,
  TurboAuthenticatedPaymentServiceInterface,
  TurboAuthenticatedUploadServiceInterface,
  TurboBalanceResponse,
  TurboCheckoutSessionParams,
  TurboCheckoutSessionResponse,
  TurboCountriesResponse,
  TurboCryptoFundResponse,
  TurboCurrenciesResponse,
  TurboDataItemSigner,
  TurboFiatToArResponse,
  TurboFileFactory,
  TurboFundWithTokensParams,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboSignedDataItemFactory,
  TurboSubmitFundTxResponse,
  TurboUnauthenticatedClientConfiguration,
  TurboUnauthenticatedClientInterface,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadDataItemResponse,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
  TurboWincForFiatParams,
  TurboWincForFiatResponse,
  TurboWincForTokenParams,
  TurboWincForTokenResponse,
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

  getBalance(address: NativeAddress): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance(address);
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
   * Determines the amount of 'winc' that would be returned for a given token and amount, including all Turbo cost adjustments and fees.
   */
  getWincForToken(
    params: TurboWincForTokenParams,
  ): Promise<TurboWincForTokenResponse> {
    return this.paymentService.getWincForToken(params);
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

  /**
   * Submits a transaction ID to the Turbo Payment Service for processing.
   */
  submitFundTransaction(p: {
    txId: string;
  }): Promise<TurboSubmitFundTxResponse> {
    return this.paymentService.submitFundTransaction(p);
  }

  /**
   * Returns the connected target Turbo wallet addresses for all supported tokens.
   */
  async getTurboCryptoWallets(): Promise<Record<TokenType, string>> {
    const wallets = await this.paymentService.getTurboCryptoWallets();
    wallets.pol = wallets.matic;
    return wallets;
  }
}

export class TurboAuthenticatedClient
  extends TurboUnauthenticatedClient
  implements TurboAuthenticatedClientInterface
{
  // override the parent classes for authenticated types
  protected paymentService: TurboAuthenticatedPaymentServiceInterface;
  protected uploadService: TurboAuthenticatedUploadServiceInterface;
  public signer: TurboDataItemSigner;

  constructor({
    paymentService,
    uploadService,
    signer,
  }: TurboAuthenticatedClientConfiguration) {
    super({ paymentService, uploadService });
    this.signer = signer;
  }

  /**
   * Returns the current balance of the user's wallet in 'winc'.
   */
  getBalance(address?: NativeAddress): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance(address);
  }

  /**
   * Signs and uploads raw data to the Turbo Upload Service.
   */
  uploadFile({
    fileStreamFactory,
    fileSizeFactory,
    signal,
    dataItemOpts,
  }: TurboFileFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadFile({
      fileStreamFactory,
      fileSizeFactory,
      signal,
      dataItemOpts,
    });
  }

  uploadFolder(p: TurboUploadFolderParams): Promise<TurboUploadFolderResponse> {
    return this.uploadService.uploadFolder(p);
  }

  /**
   * Submits fund transaction to the token's blockchain then sends
   * the transaction ID to the Turbo Payment Service for processing.
   */
  topUpWithTokens(
    p: TurboFundWithTokensParams,
  ): Promise<TurboCryptoFundResponse> {
    return this.paymentService.topUpWithTokens(p);
  }
}
