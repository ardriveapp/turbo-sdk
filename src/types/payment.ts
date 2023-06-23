import {
  InvalidPaymentAmount,
  PaymentAmountTooLarge,
  PaymentAmountTooSmall,
} from "../utils/errors";
import { PaymentAmount, CurrencyType, CurrencyLimitations } from "./types";

interface PaymentConstructorParams {
  amount: PaymentAmount;
  type: CurrencyType;
  currencyLimitations?: CurrencyLimitations;
}

export class Payment {
  public readonly amount: PaymentAmount;
  public readonly type: CurrencyType;

  constructor({
    amount,
    type,
    currencyLimitations = undefined,
  }: PaymentConstructorParams) {
    amount = Number(amount);
    type = type.toLowerCase();

    if (
      !Number.isInteger(amount) ||
      amount < 0 ||
      amount > Number.MAX_SAFE_INTEGER
    ) {
      throw new InvalidPaymentAmount(amount);
    }

    if (currencyLimitations) {
      const maxAmountAllowed = currencyLimitations[type].maximumPaymentAmount;
      if (amount > maxAmountAllowed) {
        throw new PaymentAmountTooLarge(amount, type, maxAmountAllowed);
      }

      const minAmountAllowed = currencyLimitations[type].minimumPaymentAmount;
      if (amount < minAmountAllowed) {
        throw new PaymentAmountTooSmall(amount, type, minAmountAllowed);
      }
    }

    this.amount = amount;
    this.type = type;
  }
}

export const zeroDecimalCurrencyTypes = [
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
];
