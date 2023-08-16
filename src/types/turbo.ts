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
import { JWKInterface } from 'arbundles';
import { RetryConfig } from 'retry-axios';

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'NZD' | 'JPY';
export type TurboRates = Record<Currency, number>;

export type TurboRatesResponse = {
  winc: number;
  fiat: TurboRates;
  adjustments: any; // TODO: type this
};

export type TurboRequestHeaders = {
  'x-public-key': string;
  'x-nonce': string;
  'x-signature': string;
};

export type TurboAuthSettings = {
  jwk?: JWKInterface;
};

export type TurboConfiguration = {
  paymentUrl?: string;
  uploadUrl?: string;
  retryConfig?: RetryConfig;
} & TurboAuthSettings;

export interface AuthenticatedTurboPaymentService {
  getWincBalance: () => Promise<number>;
}

export interface UnauthenticatedTurboPaymentService {
  getRates(): Promise<TurboRatesResponse>;
}

export interface TurboPaymentService
  extends AuthenticatedTurboPaymentService,
    UnauthenticatedTurboPaymentService {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface TurboUploadService {}

export interface Turbo extends TurboPaymentService, TurboUploadService {}
