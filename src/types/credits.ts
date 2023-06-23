import { BigNumber } from "bignumber.js";

import { W, Winc } from "./winc";

export class AR {
  constructor(readonly winc: Winc) {}

  static from(arValue: BigNumber.Value): AR {
    const bigWinc = new BigNumber(arValue).shiftedBy(12);
    const numDecimalPlaces = bigWinc.decimalPlaces() ?? 0;
    if (numDecimalPlaces > 0) {
      throw new Error(
        `The AR amount must have a maximum of 12 digits of precision, but got ${
          numDecimalPlaces + 12
        }`
      );
    }
    return new AR(W(bigWinc));
  }

  toString(): string {
    BigNumber.config({ DECIMAL_PLACES: 12 });
    const w = new BigNumber(this.winc.toString(), 10);
    return w.shiftedBy(-12).toFixed();
  }

  valueOf(): string {
    return this.toString();
  }

  toWinc(): Winc {
    return this.winc;
  }

  toJSON(): string {
    return this.toString();
  }
}
