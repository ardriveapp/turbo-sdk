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
import { AxiosInstance } from "axios";

export interface PaymentIntent {
  id: string;
}

export interface TopUpCheckoutSession {
  checkoutUrl: string;
  topUpQuote: TopUpQuote;
}

export interface TopUpPaymentIntent {
  paymentIntent: PaymentIntent;
  topUpQuote: TopUpQuote;
}

export interface CardDetails {
  cardNumber: string;
}

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
  data: ReadableStream | Blob;
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
  axiosClient?: AxiosInstance;
}

export interface AuthTurboSettings extends TurboSettings {
  jwk: JWKInterface;
}
