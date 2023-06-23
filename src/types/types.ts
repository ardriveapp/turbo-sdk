export * from "./positiveFiniteInteger";
export * from "./equatable";
export * from "./credits";
export * from "./winc";
export * from "./byteCount";

export type Base64String = string;
export type PublicArweaveAddress = Base64String;
export type TransactionId = Base64String;

export type UserAddress = string | PublicArweaveAddress;
export type UserAddressType = string | "arweave";

export type PaymentAmount = number;
export type CurrencyType = string | "usd";
export type PaymentProvider = string | "stripe";

export interface CurrencyLimitation {
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
  suggestedPaymentAmounts: readonly [number, number, number];
}

export type CurrencyLimitations = Record<CurrencyType, CurrencyLimitation>;

export interface TopUpQuote {
  destinationAddress: UserAddress;
  paymentAmount: PaymentAmount;
}
