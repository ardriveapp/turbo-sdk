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
