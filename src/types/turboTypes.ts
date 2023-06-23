import { TransactionInterface } from "arweave/node/lib/transaction";
import {
  ByteCount,
  TopUpQuote,
  TransactionId,
  UserAddress,
  Winc,
} from "./types";
import { JWKInterface } from "arbundles";
import { Payment } from "./payment";

export interface PaymentIntent {}

export interface TopUpCheckoutSession {
  checkoutUrl: string;
  topUpQuote: TopUpQuote;
}

export interface TopUpPaymentIntent {
  paymentIntent: PaymentIntent;
  topUpQuote: TopUpQuote;
}

export interface CardDetails {}

export interface PaymentConfirmation {
  newBalance: Winc;
}

export interface PaymentSessionParams {
  destinationAddress: UserAddress;
  payment: Payment;
}

export interface Turbo {
  getTopUpCheckoutSession: (
    p: PaymentSessionParams
  ) => Promise<TopUpCheckoutSession>;

  getTopUpPaymentIntent: (p: {
    destinationAddress: UserAddress;
    payment: Payment;
  }) => Promise<TopUpPaymentIntent>;

  confirmPaymentIntent: (
    cardDetails: CardDetails
  ) => Promise<PaymentConfirmation>;

  getWincEstimationForByteCount: (byteCount: ByteCount) => Promise<Winc>;

  getWincEstimationForPayment: (payment: Payment) => Promise<Winc>;
}

export interface AuthTurbo extends Turbo {
  getWincBalance: () => Promise<Winc>;
  upload: (files: UploadParams[]) => Promise<UploadResult>;
}

export interface UploadParams {
  filePath: string;
  options?: Partial<TransactionInterface>;
}

export interface UploadResult {
  dataItems: Record<
    TransactionId,
    {
      byteCount: number;
      dataCaches: string[];
      fastFinalityIndexes: string[];
    }
  >;
  ownerAddress: string;
}

export interface TurboSettings {
  paymentUrl?: string;
  uploadUrl?: string;
}

export interface AuthTurboSettings extends TurboSettings {
  jwk: JWKInterface;
}
