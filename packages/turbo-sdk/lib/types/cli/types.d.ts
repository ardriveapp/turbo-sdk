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
import { TurboChunkingMode } from '../types.js';
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
    processId: string | undefined;
    cuUrl: string | undefined;
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
    tags: string[] | undefined;
    maxChunkConcurrency: string | undefined;
    maxFinalizeMs: string | undefined;
    chunkByteCount: string | undefined;
    chunkingMode: TurboChunkingMode | undefined;
    showProgress: boolean;
    onDemand: boolean;
    x402: boolean;
    maxCryptoTopUpValue: string | undefined;
    topUpBufferMultiplier: number | undefined;
    feeMultiplier: number | undefined;
};
export type UploadFolderOptions = UploadOptions & {
    folderPath: string | undefined;
    indexFile: string | undefined;
    fallbackFile: string | undefined;
    manifest: boolean;
    maxConcurrency: string | undefined;
};
export type UploadFileOptions = UploadOptions & {
    filePath: string | undefined;
    tags: string[] | undefined;
};
export type TokenPriceOptions = GlobalOptions & {
    byteCount: string | undefined;
};
export type FiatEstimateOptions = TokenPriceOptions & {
    currency: string | undefined;
};
export type PriceOptions = TokenPriceOptions & {
    value: string | undefined;
    currency: string | undefined;
    type: string | undefined;
};
export type CryptoFundOptions = WalletOptions & {
    value: string | undefined;
    txId: string | undefined;
    address: string | undefined;
};
export type ShareCreditsOptions = WalletOptions & {
    address: string | undefined;
    value: string | undefined;
    expiresBySeconds: string | undefined;
};
export type RevokeCreditsOptions = WalletOptions & {
    address: string | undefined;
};
export type ListSharesOptions = RevokeCreditsOptions;
//# sourceMappingURL=types.d.ts.map