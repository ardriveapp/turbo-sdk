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
import { IAxiosRetryConfig } from 'axios-retry';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import winston from 'winston';

import { JWKInterface } from './common/jwk.js';

export type Base64String = string;
export type PublicArweaveAddress = Base64String;
export type TransactionId = Base64String;
export type UserAddress = string | PublicArweaveAddress;
export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud' | 'nzd' | 'jpy'; // TODO: add full list
export type Country = 'United States' | 'United Kingdom' | 'Canada'; // TODO: add full list

export type CurrencyLimit = {
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
  suggestedPaymentAmount: number[];
  zeroDecimalCurrency: boolean;
};

export type TurboPriceResponse = {
  winc: string; // TODO: the service returns BigNumbers as strings
  adjustments: any; // TODO: type this
};

export type TurboBalanceResponse = Omit<TurboPriceResponse, 'adjustments'>;

export type TurboFiatToArResponse = {
  currency: Currency;
  rate: number;
};
export type TurboRatesResponse = TurboPriceResponse &
  Record<'fiat', Record<Currency, number>>;
export type TurboCountriesResponse = Country[];
export type TurboCurrenciesResponse = {
  supportedCurrencies: Currency[];
  limits: Record<Currency, CurrencyLimit>;
};
export type TurboUploadDataItemResponse = {
  dataCaches: string[];
  fastFinalityIndexes: string[];
  id: TransactionId;
  owner: PublicArweaveAddress;
};

export type TurboWallet = JWKInterface; // TODO: add other wallet types
export type TurboSignedRequestHeaders = {
  'x-public-key': string;
  'x-nonce': string;
  'x-signature': string;
};

type TurboAuthConfiguration = {
  signer: TurboWalletSigner; // TODO: make a class that implements various functions (sign, verify, etc.) and implement for various wallet types
};

type TurboServiceConfiguration = {
  url?: string;
  retryConfig?: IAxiosRetryConfig;
  logger?: winston.Logger;
};

export type TurboUnauthenticatedUploadServiceInterfaceConfiguration =
  TurboServiceConfiguration;
export type TurboAuthenticatedUploadServiceConfiguration =
  TurboUnauthenticatedUploadServiceInterfaceConfiguration &
    TurboAuthConfiguration;

export type TurboUnauthenticatedPaymentServiceInterfaceConfiguration =
  TurboServiceConfiguration;
export type TurboAuthenticatedPaymentServiceInterfaceConfiguration =
  TurboServiceConfiguration & TurboAuthConfiguration;

export type TurboPublicConfiguration = {
  paymentServiceConfig?: TurboUnauthenticatedPaymentServiceInterfaceConfiguration;
  uploadServiceConfig?: TurboUnauthenticatedUploadServiceInterfaceConfiguration;
};

export type TurboPrivateConfiguration = TurboPublicConfiguration & {
  privateKey: TurboWallet;
};

export type TurboPublicClientConfiguration = {
  paymentService: TurboUnauthenticatedPaymentServiceInterface;
  uploadService: TurboUnauthenticatedUploadServiceInterface;
};

export type TurboPrivateClientConfiguration = {
  paymentService: TurboAuthenticatedPaymentServiceInterface;
  uploadService: TurboAuthenticatedUploadServiceInterface;
};

export type FileStreamFactory =
  | (() => Readable)
  | (() => ReadableStream)
  | (() => Buffer);
export type SignedDataStreamFactory = FileStreamFactory;
export type TurboFileFactory = {
  fileStreamFactory: FileStreamFactory; // TODO: allow multiple files
  // bundle?: boolean; // TODO: add bundling into BDIs
};

export type TurboSignedDataItemFactory = {
  dataItemStreamFactory: SignedDataStreamFactory; // TODO: allow multiple data items
};

export type TurboAbortSignal = {
  signal?: AbortSignal;
};

export interface TurboHTTPServiceInterface {
  get<T>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    allowedStatuses?: number[];
  }): Promise<T>;
  post<T>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
    data,
  }: {
    endpoint: string;
    signal: AbortSignal;
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    allowedStatuses?: number[];
    data: Readable | ReadableStream | Buffer;
  }): Promise<T>;
}

export interface TurboWalletSigner {
  signDataItem({
    fileStreamFactory,
  }: TurboFileFactory): Promise<Readable> | Promise<Buffer>;
  generateSignedRequestHeaders(): Promise<TurboSignedRequestHeaders>;
}

export interface TurboUnauthenticatedPaymentServiceInterface {
  getSupportedCurrencies(): Promise<TurboCurrenciesResponse>;
  getSupportedCountries(): Promise<TurboCountriesResponse>;
  getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse>;
  getFiatRates(): Promise<TurboRatesResponse>;
  getWincForFiat({
    amount,
    currency,
  }: {
    amount: number;
    currency: Currency;
  }): Promise<Omit<TurboPriceResponse, 'adjustments'>>; // TODO: update once endpoint returns adjustments
  getUploadCosts({ bytes }: { bytes: number[] }): Promise<TurboPriceResponse[]>;
}

export interface TurboAuthenticatedPaymentServiceInterface
  extends TurboUnauthenticatedPaymentServiceInterface {
  getBalance: () => Promise<TurboBalanceResponse>;
}

export interface TurboUnauthenticatedUploadServiceInterface {
  uploadSignedDataItem({
    dataItemStreamFactory,
    signal,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse>;
}

export interface TurboAuthenticatedUploadServiceInterface
  extends TurboUnauthenticatedUploadServiceInterface {
  uploadFile({
    fileStreamFactory,
  }: TurboFileFactory & TurboAbortSignal): Promise<TurboUploadDataItemResponse>;
}

export interface TurboUnauthenticatedClientInterface
  extends TurboUnauthenticatedPaymentServiceInterface,
    TurboUnauthenticatedUploadServiceInterface {}
export interface TurboAuthenticatedClientInterface
  extends TurboAuthenticatedPaymentServiceInterface,
    TurboAuthenticatedUploadServiceInterface {}
