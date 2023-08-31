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
import { RetryConfig } from 'retry-axios';
import { Readable } from 'stream';
import winston from 'winston';

import { JWKInterface } from './arweave.js';

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
  byteCount: number;
  dataCaches: string[];
  fastFinalityIndexes: string[];
  id: TransactionId;
};

export type TurboUploadDataItemsResponse = {
  ownerAddress: UserAddress;
  dataItems: Record<string, Omit<TurboUploadDataItemResponse, 'id'>>;
};

export type TurboSignedRequestHeaders = {
  'x-public-key': string;
  'x-nonce': string;
  'x-signature': string;
};

type TurboAuthConfiguration = {
  privateKey: JWKInterface; // TODO: make a class that implements various functions (sign, verify, etc.) and implement for various wallet types
};

type TurboServiceConfiguration = {
  url?: string;
  retryConfig?: RetryConfig;
  logger?: winston.Logger;
  dataItemSigner?: TurboDataItemSigner;
  dataItemVerifier?: TurboDataItemVerifier;
};

export type TurboPublicUploadServiceConfiguration = TurboServiceConfiguration;
export type TurboPrivateUploadServiceConfiguration =
  TurboPublicUploadServiceConfiguration & TurboAuthConfiguration;

export type TurboPublicPaymentServiceConfiguration = TurboServiceConfiguration;
export type TurboPrivatePaymentServiceConfiguration =
  TurboServiceConfiguration & TurboAuthConfiguration;

export type TurboPublicConfiguration = {
  paymentServiceConfig?: TurboPublicPaymentServiceConfiguration;
  uploadServiceConfig?: TurboPublicUploadServiceConfiguration;
};

export type TurboPrivateConfiguration = TurboPublicConfiguration &
  TurboAuthConfiguration;

export type TurboPublicClientConfiguration = {
  paymentService: TurboPublicPaymentService;
  uploadService: TurboPublicUploadService;
};

export type TurboPrivateClientConfiguration = {
  paymentService: TurboPrivatePaymentService;
  uploadService: TurboPrivateUploadService;
} & TurboAuthConfiguration;

export type TurboFileFactory = {
  fileStreamGenerator: (() => Readable)[] | (() => ReadableStream)[];
  bundle?: boolean;
  // TODO: add payload size
};

// TODO: add web one for ReadableStream or Buffer depending on how best to implement
export type TurboSignedDataItemFactory = {
  dataItemGenerator: (() => Readable)[];
  publicKey: string; // TODO: add type
  signature: Buffer; // TODO: could also be a buffer
};

export interface TurboDataItemVerifier {
  verifySignedDataItems({
    dataItemGenerator,
    signature,
    publicKey,
  }: TurboSignedDataItemFactory): Promise<boolean>;
}

export interface TurboDataItemSigner {
  signDataItems({
    fileStreamGenerator,
    bundle,
  }: TurboFileFactory): Promise<Readable>[] | Promise<Buffer>[];
}

export interface TurboPublicPaymentService {
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

export interface TurboPrivatePaymentService extends TurboPublicPaymentService {
  getBalance: () => Promise<TurboBalanceResponse>;
}

export interface TurboPublicUploadService {
  uploadSignedDataItems({
    dataItemGenerator,
    signature,
    publicKey,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemsResponse>;
}

export interface TurboPrivateUploadService extends TurboPublicUploadService {
  uploadFiles({
    fileStreamGenerator,
    bundle,
  }: TurboFileFactory): Promise<TurboUploadDataItemsResponse>;
}

export interface TurboPublicClient
  extends TurboPublicPaymentService,
    TurboPublicUploadService {}
export interface TurboPrivateClient
  extends TurboPrivatePaymentService,
    TurboPrivateUploadService {}
