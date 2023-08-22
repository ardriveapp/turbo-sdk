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
  winc: string;
  adjustments: any; // TODO: type this
};
export type TurboRateResponse = {
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

export type TurboSignedRequestHeaders = {
  'x-public-key': string;
  'x-nonce': string;
  'x-signature': string;
};

// TODO: integration with arconnect will likely require different auth settings
export type TurboAuthSettings = {
  jwk?: JWKInterface;
};

export type TurboConfiguration = {
  paymentUrl?: string;
  uploadUrl?: string;
  retryConfig?: RetryConfig;
} & TurboAuthSettings;

export interface AuthenticatedTurboPaymentService {
  getBalance: () => Promise<number>;
}

export interface UnauthenticatedTurboPaymentService {
  getCurrencies(): Promise<TurboCurrenciesResponse>;
  getCountries(): Promise<TurboCountriesResponse>;
  getRate(currency: Currency): Promise<TurboRateResponse>;
  getRates(): Promise<TurboRatesResponse>;
  getWincPriceForFiat({
    amount,
    currency,
  }): Promise<Omit<TurboPriceResponse, 'adjustments'>>; // TODO: update once endpoint returns adjustments
  getWincPriceForBytes(bytes: number): Promise<TurboPriceResponse>;
}

export interface TurboPaymentService
  extends AuthenticatedTurboPaymentService,
    UnauthenticatedTurboPaymentService {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TurboUploadService {}

export interface Turbo extends TurboPaymentService, TurboUploadService {}
