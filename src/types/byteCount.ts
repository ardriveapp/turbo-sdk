import { PositiveFiniteInteger } from "./positiveFiniteInteger";

export function ByteCount(value: number): PositiveFiniteInteger {
  return new PositiveFiniteInteger(value);
}

export type ByteCount = PositiveFiniteInteger;
