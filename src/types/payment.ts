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
  InvalidPaymentAmount,
  PaymentAmountTooLarge,
  PaymentAmountTooSmall,
} from "../utils/errors";
import { PaymentAmount, CurrencyType, CurrencyLimitations } from "./types";

interface PaymentConstructorParams {
  amount: PaymentAmount;
  type: CurrencyType;
  currencyLimitations?: CurrencyLimitations;
}

export class Payment {
  public readonly amount: PaymentAmount;
  public readonly type: CurrencyType;

  constructor({
    amount,
    type,
    currencyLimitations = undefined,
  }: PaymentConstructorParams) {
    amount = Number(amount);
    type = type.toLowerCase();

    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > Number.MAX_SAFE_INTEGER
    ) {
      throw new InvalidPaymentAmount(amount);
    }

    if (currencyLimitations) {
      const maxAmountAllowed = currencyLimitations[type].maximumPaymentAmount;
      if (amount > maxAmountAllowed) {
        throw new PaymentAmountTooLarge(amount, type, maxAmountAllowed);
      }

      const minAmountAllowed = currencyLimitations[type].minimumPaymentAmount;
      if (amount < minAmountAllowed) {
        throw new PaymentAmountTooSmall(amount, type, minAmountAllowed);
      }
    }

    this.amount = amount;
    this.type = type;
  }
}

export const zeroDecimalCurrencyTypes = [
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
];
