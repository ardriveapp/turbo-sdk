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
import { UserAddress, CurrencyType, PaymentAmount } from "../types/types";

export class UserNotFoundWarning extends Error {
  constructor(userAddress: UserAddress) {
    super(`No user found in database with address '${userAddress}'`);
    this.name = "UserNotFoundWarning";
  }
}

export class InsufficientBalance extends Error {
  constructor(userAddress: UserAddress) {
    super(`Insufficient balance for '${userAddress}'`);
    this.name = "InsufficientBalance";
  }
}

export abstract class PaymentValidationError extends Error {}

export class UnsupportedCurrencyType extends PaymentValidationError {
  constructor(currencyType: CurrencyType) {
    super(
      `The currency type '${currencyType}' is currently not supported by this API!`
    );
    this.name = "UnsupportedCurrencyType";
  }
}

export class InvalidPaymentAmount extends PaymentValidationError {
  constructor(paymentAmount: PaymentAmount) {
    super(
      `The provided payment amount (${paymentAmount}) is invalid; it must be a positive non-decimal integer!`
    );
    this.name = "InvalidPaymentAmount";
  }
}

export class PaymentAmountTooSmall extends PaymentValidationError {
  constructor(
    paymentAmount: PaymentAmount,
    currencyType: CurrencyType,
    minimumAllowedAmount: PaymentAmount
  ) {
    super(
      `The provided payment amount (${paymentAmount}) is too small for the currency type "${currencyType}"; it must be above ${minimumAllowedAmount}!`
    );
    this.name = "PaymentAmountTooSmall";
  }
}

export class PaymentAmountTooLarge extends PaymentValidationError {
  constructor(
    paymentAmount: PaymentAmount,
    currencyType: CurrencyType,
    maximumAllowedAmount: PaymentAmount
  ) {
    super(
      `The provided payment amount (${paymentAmount}) is too large for the currency type "${currencyType}"; it must be below or equal to ${maximumAllowedAmount}!`
    );
    this.name = "PaymentAmountTooLarge";
  }
}
