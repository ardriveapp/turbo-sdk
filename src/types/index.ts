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
export * from "./positiveFiniteInteger.js";
export * from "./equatable.js";
export * from "./credits.js";
export * from "./winc.js";
export * from "./byteCount.js";

export type Base64String = string;
export type PublicArweaveAddress = Base64String;
export type TransactionId = Base64String;

export type UserAddress = string | PublicArweaveAddress;
export type UserAddressType = string | "arweave";

export type PaymentAmount = number;
export type CurrencyType = string | "usd";
export type PaymentProvider = string | "stripe";

export interface CurrencyLimitation {
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
  suggestedPaymentAmounts: readonly [number, number, number];
}

export type CurrencyLimitations = Record<CurrencyType, CurrencyLimitation>;

export interface TopUpQuote {
  destinationAddress: UserAddress;
  paymentAmount: PaymentAmount;
}
