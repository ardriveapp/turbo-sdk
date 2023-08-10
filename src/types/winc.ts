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
import { BigNumber } from "bignumber.js";

export class Winc {
  private readonly amount: BigNumber;
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
