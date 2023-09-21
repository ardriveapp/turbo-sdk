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
import { Currency } from '../types.js';

export interface AmountMapper {
  amount: number;
  type: Currency;
}

export class ZeroDecimalCurrency implements AmountMapper {
  constructor(
    public readonly amount: number,
    public readonly type: Currency,
  ) {}
}

export class TwoDecimalCurrency implements AmountMapper {
  constructor(
    private a: number,
    public readonly type: Currency,
  ) {}

  get amount() {
    return this.a * 100;
  }
}

export const USD = (usd: number) => new TwoDecimalCurrency(usd, 'usd');
export const EUR = (eur: number) => new TwoDecimalCurrency(eur, 'eur');
export const GBP = (gbp: number) => new TwoDecimalCurrency(gbp, 'gbp');
export const CAD = (cad: number) => new TwoDecimalCurrency(cad, 'cad');
export const AUD = (aud: number) => new TwoDecimalCurrency(aud, 'aud');
export const INR = (inr: number) => new TwoDecimalCurrency(inr, 'inr');
export const SGD = (sgd: number) => new TwoDecimalCurrency(sgd, 'sgd');
export const HKD = (hkd: number) => new TwoDecimalCurrency(hkd, 'hkd');
export const BRL = (brl: number) => new TwoDecimalCurrency(brl, 'brl');

export const JPY = (jpy: number) => new ZeroDecimalCurrency(jpy, 'jpy');
