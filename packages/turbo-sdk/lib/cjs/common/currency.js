"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currencyMap = exports.JPY = exports.BRL = exports.HKD = exports.SGD = exports.INR = exports.AUD = exports.CAD = exports.GBP = exports.EUR = exports.USD = exports.TwoDecimalCurrency = exports.ZeroDecimalCurrency = void 0;
const errors_js_1 = require("../utils/errors.js");
class ZeroDecimalCurrency {
    constructor(amt, type) {
        this.amt = amt;
        this.type = type;
        if (amt < 0) {
            throw new errors_js_1.ProvidedInputError(`${type} currency amount cannot be negative`);
        }
        this.assertDecimalPlaces(amt);
    }
    assertDecimalPlaces(a) {
        if (a % 1 !== 0) {
            throw new errors_js_1.ProvidedInputError(`${this.type} currency amount must have zero decimal places`);
        }
    }
    get amount() {
        return this.amt;
    }
}
exports.ZeroDecimalCurrency = ZeroDecimalCurrency;
class TwoDecimalCurrency extends ZeroDecimalCurrency {
    constructor(a, type) {
        super(a, type);
        this.a = a;
        this.type = type;
    }
    assertDecimalPlaces(a) {
        if ((a * 100) % 1 !== 0) {
            throw new errors_js_1.ProvidedInputError(`${this.type} currency amount must have two decimal places`);
        }
    }
    get amount() {
        return this.a * 100;
    }
}
exports.TwoDecimalCurrency = TwoDecimalCurrency;
// Two decimal currencies that are supported by the Turbo API
const USD = (usd) => new TwoDecimalCurrency(usd, 'usd');
exports.USD = USD;
const EUR = (eur) => new TwoDecimalCurrency(eur, 'eur');
exports.EUR = EUR;
const GBP = (gbp) => new TwoDecimalCurrency(gbp, 'gbp');
exports.GBP = GBP;
const CAD = (cad) => new TwoDecimalCurrency(cad, 'cad');
exports.CAD = CAD;
const AUD = (aud) => new TwoDecimalCurrency(aud, 'aud');
exports.AUD = AUD;
const INR = (inr) => new TwoDecimalCurrency(inr, 'inr');
exports.INR = INR;
const SGD = (sgd) => new TwoDecimalCurrency(sgd, 'sgd');
exports.SGD = SGD;
const HKD = (hkd) => new TwoDecimalCurrency(hkd, 'hkd');
exports.HKD = HKD;
const BRL = (brl) => new TwoDecimalCurrency(brl, 'brl');
exports.BRL = BRL;
// Zero decimal currencies that are supported by the Turbo API
const JPY = (jpy) => new ZeroDecimalCurrency(jpy, 'jpy');
exports.JPY = JPY;
exports.currencyMap = {
    usd: exports.USD,
    eur: exports.EUR,
    gbp: exports.GBP,
    cad: exports.CAD,
    aud: exports.AUD,
    inr: exports.INR,
    sgd: exports.SGD,
    hkd: exports.HKD,
    brl: exports.BRL,
    jpy: exports.JPY,
};
