import { ProvidedInputError } from '../utils/errors.js';
export class ZeroDecimalCurrency {
    constructor(amt, type) {
        this.amt = amt;
        this.type = type;
        if (amt < 0) {
            throw new ProvidedInputError(`${type} currency amount cannot be negative`);
        }
        this.assertDecimalPlaces(amt);
    }
    assertDecimalPlaces(a) {
        if (a % 1 !== 0) {
            throw new ProvidedInputError(`${this.type} currency amount must have zero decimal places`);
        }
    }
    get amount() {
        return this.amt;
    }
}
export class TwoDecimalCurrency extends ZeroDecimalCurrency {
    constructor(a, type) {
        super(a, type);
        this.a = a;
        this.type = type;
    }
    assertDecimalPlaces(a) {
        if ((a * 100) % 1 !== 0) {
            throw new ProvidedInputError(`${this.type} currency amount must have two decimal places`);
        }
    }
    get amount() {
        return this.a * 100;
    }
}
// Two decimal currencies that are supported by the Turbo API
export const USD = (usd) => new TwoDecimalCurrency(usd, 'usd');
export const EUR = (eur) => new TwoDecimalCurrency(eur, 'eur');
export const GBP = (gbp) => new TwoDecimalCurrency(gbp, 'gbp');
export const CAD = (cad) => new TwoDecimalCurrency(cad, 'cad');
export const AUD = (aud) => new TwoDecimalCurrency(aud, 'aud');
export const INR = (inr) => new TwoDecimalCurrency(inr, 'inr');
export const SGD = (sgd) => new TwoDecimalCurrency(sgd, 'sgd');
export const HKD = (hkd) => new TwoDecimalCurrency(hkd, 'hkd');
export const BRL = (brl) => new TwoDecimalCurrency(brl, 'brl');
// Zero decimal currencies that are supported by the Turbo API
export const JPY = (jpy) => new ZeroDecimalCurrency(jpy, 'jpy');
export const currencyMap = {
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
