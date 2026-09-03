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
};
export type WalletOptions = GlobalOptions & {
    walletFile: string | undefined;
    mnemonic: string | undefined;
    privateKey: string | undefined;
};
export type AddressOptions = WalletOptions & {
    address: string | undefined;
};
export type PaymentHistoryOptions = WalletOptions & {
    limit: string | undefined;
    cursor: string | undefined;
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
export type ArNSPriceOptions = GlobalOptions & {
    name: string | undefined;
    type: string | undefined;
    years: string | undefined;
    increaseQty: string | undefined;
    processId: string | undefined;
};
export type ArNSFiatQuoteOptions = ArNSPriceOptions & {
    address: string | undefined;
    currency: string | undefined;
    method: string | undefined;
    promoCode: string[] | undefined;
};
/** Base58 Solana secret key that will OWN the ANT — separate from the payer. */
export type ArNSOwnerKeyOption = {
    ownerKey?: string;
};
export type ArNSPurchaseOptions = ArNSOwnerKeyOption & WalletOptions & ArNSPriceOptions & {
    paidBy: string[] | undefined;
};
export type ArNSPurchaseStatusOptions = GlobalOptions & {
    nonce: string | undefined;
};
export type TransferArNSAntOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    target: string | undefined;
};
export type SetArNSRecordOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    undername: string | undefined;
    transactionId: string | undefined;
    ttlSeconds: string | undefined;
};
export type RemoveArNSRecordOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    undername: string | undefined;
};
export type AddArNSControllerOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    target: string | undefined;
};
export type RemoveArNSControllerOptions = AddArNSControllerOptions;
export type TransferArNSRecordOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    undername: string | undefined;
    target: string | undefined;
};
export type SetArNSRecordMetadataOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    undername: string | undefined;
    displayName: string | undefined;
    clearDisplayName: boolean;
    recordLogo: string | undefined;
    clearRecordLogo: boolean;
    recordDescription: string | undefined;
    clearRecordDescription: boolean;
    recordKeywords: string[] | undefined;
    clearRecordKeywords: boolean;
};
export type RemoveArNSRecordMetadataOptions = ArNSOwnerKeyOption & WalletOptions & {
    antId: string | undefined;
    undername: string | undefined;
};
/** `--action` names one of the eight non-purchase actions to price. */
export type ArNSActionPriceOptions = GlobalOptions & {
    action: string | undefined;
};
//# sourceMappingURL=types.d.ts.map