import { BigNumber } from "bignumber.js";

export class Winc {
  private amount: BigNumber;
  constructor(amount: BigNumber.Value) {
    this.amount = new BigNumber(amount);
    if (this.amount.isLessThan(0) || !this.amount.isInteger()) {
      throw new Error("Winc value should be a non-negative integer!");
    }
  }

  plus(Winc: Winc): Winc {
    return W(this.amount.plus(Winc.amount));
  }

  minus(Winc: Winc): Winc {
    return W(this.amount.minus(Winc.amount));
  }

  times(multiplier: BigNumber.Value): Winc {
    return W(
      this.amount.times(multiplier).decimalPlaces(0, BigNumber.ROUND_DOWN)
    );
  }

  dividedBy(
    divisor: BigNumber.Value,
    round: "ROUND_DOWN" | "ROUND_CEIL" = "ROUND_CEIL"
  ): Winc {
    // TODO: Best rounding strategy? Up or down?
    return W(
      this.amount
        .dividedBy(divisor)
        .decimalPlaces(
          0,
          round === "ROUND_DOWN" ? BigNumber.ROUND_DOWN : BigNumber.ROUND_CEIL
        )
    );
  }

  isGreaterThan(Winc: Winc): boolean {
    return this.amount.isGreaterThan(Winc.amount);
  }

  isGreaterThanOrEqualTo(Winc: Winc): boolean {
    return this.amount.isGreaterThanOrEqualTo(Winc.amount);
  }

  static difference(a: Winc, b: Winc): string {
    return a.amount.minus(b.amount).toString();
  }

  toString(): string {
    return this.amount.toFixed();
  }

  valueOf(): string {
    return this.amount.toFixed();
  }

  toJSON(): string {
    return this.toString();
  }

  static max(...Wincs: Winc[]): Winc {
    BigNumber.max();
    return Wincs.reduce((max, next) =>
      next.amount.isGreaterThan(max.amount) ? next : max
    );
  }
}

export function W(amount: BigNumber.Value): Winc {
  return new Winc(amount);
}
