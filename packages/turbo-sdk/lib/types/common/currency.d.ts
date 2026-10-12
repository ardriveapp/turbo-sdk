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
export interface CurrencyMap {
    amount: number;
    type: Currency;
}
export declare class ZeroDecimalCurrency implements CurrencyMap {
    private readonly amt;
    readonly type: Currency;
    constructor(amt: number, type: Currency);
    protected assertDecimalPlaces(a: number): void;
    get amount(): number;
}
export declare class TwoDecimalCurrency extends ZeroDecimalCurrency {
    private readonly a;
    readonly type: Currency;
    constructor(a: number, type: Currency);
    protected assertDecimalPlaces(a: number): void;
    get amount(): number;
}
export declare const USD: (usd: number) => TwoDecimalCurrency;
export declare const EUR: (eur: number) => TwoDecimalCurrency;
export declare const GBP: (gbp: number) => TwoDecimalCurrency;
export declare const CAD: (cad: number) => TwoDecimalCurrency;
export declare const AUD: (aud: number) => TwoDecimalCurrency;
export declare const INR: (inr: number) => TwoDecimalCurrency;
export declare const SGD: (sgd: number) => TwoDecimalCurrency;
export declare const HKD: (hkd: number) => TwoDecimalCurrency;
export declare const BRL: (brl: number) => TwoDecimalCurrency;
export declare const JPY: (jpy: number) => ZeroDecimalCurrency;
export declare const currencyMap: Record<Currency, (amount: number) => CurrencyMap>;
//# sourceMappingURL=currency.d.ts.map