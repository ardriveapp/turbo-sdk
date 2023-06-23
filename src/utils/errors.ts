import { UserAddress, CurrencyType, PaymentAmount } from "../types/types";

export class UserNotFoundWarning extends Error {
  constructor(userAddress: UserAddress) {
    super(`No user found in database with address '${userAddress}'`);
    this.name = "UserNotFoundWarning";
  }
}

export class InsufficientBalance extends Error {
  constructor(userAddress: UserAddress) {
    super(`Insufficient balance for '${userAddress}'`);
    this.name = "InsufficientBalance";
  }
}

export abstract class PaymentValidationError extends Error {}

export class UnsupportedCurrencyType extends PaymentValidationError {
  constructor(currencyType: CurrencyType) {
    super(
      `The currency type '${currencyType}' is currently not supported by this API!`
    );
    this.name = "UnsupportedCurrencyType";
  }
}

export class InvalidPaymentAmount extends PaymentValidationError {
  constructor(paymentAmount: PaymentAmount) {
    super(
      `The provided payment amount (${paymentAmount}) is invalid; it must be a positive non-decimal integer!`
    );
    this.name = "InvalidPaymentAmount";
  }
}

export class PaymentAmountTooSmall extends PaymentValidationError {
  constructor(
    paymentAmount: PaymentAmount,
    currencyType: CurrencyType,
    minimumAllowedAmount: PaymentAmount
  ) {
    super(
      `The provided payment amount (${paymentAmount}) is too small for the currency type "${currencyType}"; it must be above ${minimumAllowedAmount}!`
    );
    this.name = "PaymentAmountTooSmall";
  }
}

export class PaymentAmountTooLarge extends PaymentValidationError {
  constructor(
    paymentAmount: PaymentAmount,
    currencyType: CurrencyType,
    maximumAllowedAmount: PaymentAmount
  ) {
    super(
      `The provided payment amount (${paymentAmount}) is too large for the currency type "${currencyType}"; it must be below or equal to ${maximumAllowedAmount}!`
    );
    this.name = "PaymentAmountTooLarge";
  }
}
