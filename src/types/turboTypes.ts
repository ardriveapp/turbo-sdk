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

export interface PaymentIntent {
  id: string;
}

export interface PaymentConfirmation {
  newBalance: Winc;
}

export interface PaymentSessionParams {
  destinationAddress: UserAddress;
  payment: Payment;
}

export type TopUpResponse = {
  paymentIntent: PaymentIntent;
  status: "success" | "failed";
  error?: string;
} & PaymentSessionParams;

export interface AuthenticatedTurboPaymentService {
  getWincBalance: () => Promise<Winc>;
}

export interface UnauthenticatedTurboPaymentService {
  topUp: (topUpQuote: TopUpQuote) => Promise<TopUpResponse>;
  getWincEstimationForByteCount: (byteCount: ByteCount) => Promise<Winc>;
  getWincEstimationForPayment: (payment: Payment) => Promise<Winc>;
}

export interface TurboPaymentService
  extends AuthenticatedTurboPaymentService,
    UnauthenticatedTurboPaymentService {}

export interface TurboUploadService {
  upload: (files: TurboFileUpload[]) => Promise<UploadDataItemsResult>;
}

export interface TurboService extends TurboPaymentService, TurboUploadService {}

export type TurboFilePath = {
  filePath: string;
};

export type TurboRawData = {
  data: ReadableStream | Blob;
};

export type TurboUploadOptions = {
  options: Partial<TransactionInterface>;
};

export type TurboFileUpload = TurboFilePath & Partial<TurboUploadOptions>;
export type TurboBlobUpload = TurboRawData & Partial<TurboUploadOptions>;

export type TurboRequestHeaders = {
  "x-public-key": string;
  "x-nonce": string;
  "x-signature": string;
};

export type DataItemCacheResult = {
  byteCount: number;
  dataCaches: string[];
  fastFinalityIndexes: string[];
};

export type UploadDataItemResponse = Record<"id", TransactionId> &
  DataItemCacheResult;
export type UploadDataItemResultMap = Record<
  TransactionId,
  DataItemCacheResult
>;

export type UploadDataItemsResult = {
  dataItems: UploadDataItemResultMap;
  ownerAddress: string;
};

export type AuthTurboSettings = {
  jwk: JWKInterface;
};

export type TurboSettings = Partial<{
  paymentUrl: string;
  uploadUrl: string;
  retries: number;
}> &
  Partial<AuthTurboSettings>;
