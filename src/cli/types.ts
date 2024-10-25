/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export type GlobalOptions = {
  dev: boolean;
  local: boolean;
  gateway: string | undefined;
  debug: boolean;
  quiet: boolean;
  skipConfirmation: boolean;
  token: string;
  paymentUrl: string | undefined;
  uploadUrl: string | undefined;
};

export type WalletOptions = GlobalOptions & {
  walletFile: string | undefined;
  mnemonic: string | undefined;
  privateKey: string | undefined;
};

export type AddressOptions = WalletOptions & {
  address: string | undefined;
};

export type TopUpOptions = AddressOptions & {
  value: string | undefined;
  currency: string | undefined;
};

export type UploadOptions = WalletOptions & {
  paidBy: string[];
  ignoreApprovals: boolean;
  useSignerBalanceFirst: boolean;
};

export type UploadFolderOptions = UploadOptions & {
  folderPath: string | undefined;
  indexFile: string | undefined;
  fallbackFile: string | undefined;
  manifest: boolean;
  maxConcurrency: number | undefined;
};

export type UploadFileOptions = UploadOptions & {
  filePath: string | undefined;
};

export type PriceOptions = GlobalOptions & {
  value: string | undefined;
  type: string | undefined;
};

export type CryptoFundOptions = WalletOptions & {
  value: string | undefined;
  txId: string | undefined;
};

export type CreateApprovalOptions = WalletOptions & {
  address: string | undefined;
  value: string | undefined;
  expiresBySeconds: number | undefined;
};

export type RevokeApprovalsOptions = WalletOptions & {
  address: string | undefined;
};

export type ListApprovalsOptions = RevokeApprovalsOptions;
