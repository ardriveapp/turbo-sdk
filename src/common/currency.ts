/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { Currency } from '../types.js';
import { ProvidedInputError } from '../utils/errors.js';

export interface CurrencyMap {
  amount: number;
  type: Currency;
}

export class ZeroDecimalCurrency implements CurrencyMap {
  constructor(
    private readonly amt: number,
    public readonly type: Currency,
  ) {
    if (amt < 0) {
      throw new ProvidedInputError(
        `${type} currency amount cannot be negative`,
      );
    }
    this.assertDecimalPlaces(amt);
  }

  protected assertDecimalPlaces(a: number) {
    if (a % 1 !== 0) {
      throw new ProvidedInputError(
        `${this.type} currency amount must have zero decimal places`,
      );
    }
  }

  public get amount() {
    return this.amt;
  }
}

export class TwoDecimalCurrency extends ZeroDecimalCurrency {
  constructor(
    private readonly a: number,
    public readonly type: Currency,
  ) {
    super(a, type);
  }

  protected assertDecimalPlaces(a: number) {
    if ((a * 100) % 1 !== 0) {
      throw new ProvidedInputError(
        `${this.type} currency amount must have two decimal places`,
      );
    }
  }

  get amount() {
    return this.a * 100;
  }
}

// Two decimal currencies that are supported by the Turbo API
export const USD = (usd: number) => new TwoDecimalCurrency(usd, 'usd');
export const EUR = (eur: number) => new TwoDecimalCurrency(eur, 'eur');
export const GBP = (gbp: number) => new TwoDecimalCurrency(gbp, 'gbp');
export const CAD = (cad: number) => new TwoDecimalCurrency(cad, 'cad');
export const AUD = (aud: number) => new TwoDecimalCurrency(aud, 'aud');
export const INR = (inr: number) => new TwoDecimalCurrency(inr, 'inr');
export const SGD = (sgd: number) => new TwoDecimalCurrency(sgd, 'sgd');
export const HKD = (hkd: number) => new TwoDecimalCurrency(hkd, 'hkd');
export const BRL = (brl: number) => new TwoDecimalCurrency(brl, 'brl');

// Zero decimal currencies that are supported by the Turbo API
export const JPY = (jpy: number) => new ZeroDecimalCurrency(jpy, 'jpy');

export const currencyMap: Record<Currency, (amount: number) => CurrencyMap> = {
  usd: USD,
  eur: EUR,
  gbp: GBP,
  cad: CAD,
  aud: AUD,
  inr: INR,
  sgd: SGD,
  hkd: HKD,
  brl: BRL,
  jpy: JPY,
};
