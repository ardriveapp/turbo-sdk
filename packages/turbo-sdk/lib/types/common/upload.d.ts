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
import { BigNumber } from 'bignumber.js';
import { Readable } from 'node:stream';
import { ArweaveManifest, CreditShareApproval, FundingOptions, TokenType, TurboAbortSignal, TurboAuthenticatedUploadServiceConfiguration, TurboAuthenticatedUploadServiceInterface, TurboChunkingParams, TurboCreateCreditShareApprovalParams, TurboDataItemSigner, TurboFileFactory, TurboLogger, TurboRevokeCreditsParams, TurboUnauthenticatedUploadServiceConfiguration, TurboUnauthenticatedUploadServiceInterface, TurboUploadAndSigningEmitterEvents, TurboUploadDataItemResponse, TurboUploadEmitterEvents, TurboUploadFileParams, TurboUploadFolderParams, TurboUploadFolderResponse, TurboX402DataItemPriceParams, TurboX402DataItemPriceResponse, TurboX402RawDataPriceParams, TurboX402RawDataPriceResponse, UploadDataInput, UploadDataType, UploadSignedDataItemParams } from '../types.js';
import { RetryConfig } from './http.js';
import { TurboHTTPService } from './http.js';
import { TurboAuthenticatedPaymentService } from './payment.js';
export type TurboUploadConfig = TurboFileFactory & TurboAbortSignal & TurboUploadEmitterEvents;
export declare const creditSharingTagNames: {
    shareCredits: string;
    sharedWincAmount: string;
    approvalExpiresBySeconds: string;
    revokeCredits: string;
};
export declare const developmentUploadServiceURL = "https://upload.services.ar-io.dev";
export declare const defaultUploadServiceURL = "https://upload.ardrive.io";
export declare class TurboUnauthenticatedUploadService implements TurboUnauthenticatedUploadServiceInterface {
    protected httpService: TurboHTTPService;
    protected logger: TurboLogger;
    protected token: TokenType;
    protected x402EnabledTokens: TokenType[];
    protected retryConfig: RetryConfig;
    constructor({ url, logger, retryConfig, token, }: TurboUnauthenticatedUploadServiceConfiguration);
    uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, dataItemOpts, signal, events, x402Options, }: UploadSignedDataItemParams): Promise<TurboUploadDataItemResponse>;
    /**
     * Price a SIGNED data item for an x402 upload, without sending it.
     *
     * The only other way to learn an x402 price is to POST the payload and read
     * the 402 challenge, which means transmitting it to find out what it costs.
     *
     * `byteCount` is the size of the signed data item — what
     * `dataItemSizeFactory()` returns — not the payload inside it. Use
     * `getX402PriceForRawData` when the service does the wrapping.
     *
     * `network` names the x402 network, not the SDK token: the route builds its
     * token as `usdc-{network}`. `base-usdc` is accepted on mainnet only because
     * the network there is literally `base`, so a testnet caller must pass
     * `base-sepolia` explicitly.
     */
    getX402PriceForDataItem({ byteCount, network, }: TurboX402DataItemPriceParams): Promise<TurboX402DataItemPriceResponse>;
    /**
     * Price RAW data for an x402 upload, where the service wraps it into a data
     * item itself.
     *
     * Also reports the wrapping overhead — a data item is larger than its
     * payload by its header, signature and tags — which the caller has no way to
     * compute. `tagCount` and `contentType` feed that estimate, so pass what the
     * upload will actually carry or the quote will read low.
     */
    getX402PriceForRawData({ byteCount, network, tagCount, contentType, }: TurboX402RawDataPriceParams): Promise<TurboX402RawDataPriceResponse>;
    uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, signer, }: {
        data: UploadDataType;
        signal?: AbortSignal;
        tags?: {
            name: string;
            value: string;
        }[];
        maxMUSDCAmount?: BigNumber;
        signer?: TurboDataItemSigner;
    }): Promise<TurboUploadDataItemResponse>;
}
export declare abstract class TurboAuthenticatedBaseUploadService extends TurboUnauthenticatedUploadService implements TurboAuthenticatedUploadServiceInterface {
    protected signer: TurboDataItemSigner;
    protected paymentService: TurboAuthenticatedPaymentService;
    constructor({ url, retryConfig, signer, logger, token, paymentService, }: TurboAuthenticatedUploadServiceConfiguration & {
        paymentService: TurboAuthenticatedPaymentService;
    });
    /**
     * Signs and uploads raw data to the Turbo Upload Service.
     */
    upload({ data, dataItemOpts, signal, events, chunkByteCount, chunkingMode, maxChunkConcurrency, fundingMode, maxFinalizeMs, }: UploadDataInput & TurboAbortSignal & TurboUploadAndSigningEmitterEvents & TurboChunkingParams & FundingOptions): Promise<TurboUploadDataItemResponse>;
    private resolveUploadFileConfig;
    uploadFile(params: TurboUploadFileParams): Promise<TurboUploadDataItemResponse>;
    /**
     * Returns an upper bound on the bytes in a folder's manifest, if every file
     * lands. Data item ids are always 43 characters, so placeholder ids give the
     * real length, except for the index path: without an index file, the
     * manifest indexes whichever file finished first, so the estimate allows for
     * the longest path there.
     */
    private plannedManifestByteCount;
    protected generateManifest({ paths, indexFile, fallbackFile, }: {
        paths: Record<string, {
            id: string;
        }>;
        indexFile?: string;
        fallbackFile?: string;
    }): Promise<ArweaveManifest>;
    abstract getFiles(params: TurboUploadFolderParams): Promise<(File | string)[]>;
    abstract contentTypeFromFile(file: File | string): string;
    abstract getFileStreamForFile(file: string | File): Readable | ReadableStream;
    abstract getFileSize(file: string | File): number;
    abstract getFileName(file: string | File): string;
    abstract getRelativePath(file: string | File, params: TurboUploadFolderParams): string;
    abstract createManifestStream(manifestBuffer: Buffer): Readable | ReadableStream;
    /**
     * The sha-256 of a file's bytes, as lowercase hex. The key of a
     * {@link TurboFolderUploadIndex}.
     *
     * This default consumes the file's stream and digests it with the platform
     * WebCrypto implementation, which serves the browser. NodeJS overrides it
     * with a streaming digest so a large file is never held in memory.
     */
    protected computeContentHash(file: string | File): Promise<string>;
    /**
     * The exact tag set a folder upload writes for one file. Shared by the
     * planner and the uploader, so that the tags a folder index key is computed
     * from are, without question, the tags the data item ends up carrying.
     */
    private folderFileTags;
    /**
     * A folder index is a cache, so a layer that is unreachable must mean a miss
     * and not an aborted deploy. The write side is forgiving for the same reason.
     */
    private readFolderIndex;
    /**
     * Hashes every file and derives its folder index key, then works out which of
     * those keys already have a data item id -- from the index, or from an
     * identical file earlier in this same folder.
     */
    private planFolderIndex;
    /**
     * A key covers the tags on a file as well as its bytes, so a tag in
     * `dataItemOpts` that changes between deploys re-uploads the whole folder at
     * full price. That is the right answer -- a reused data item is never one
     * this call would not have made -- but on its own it is a silent cost cliff:
     * a successful deploy, a full bill, and nothing saying why.
     *
     * The signature of that mistake is exact, and it is already in hand. A key is
     * `<bytes>.<tags>`, so a file whose *bytes half* the index knows under some
     * other tags half is a file whose content is already paid for and whose tags
     * moved. Nothing else produces that: a folder the index has never seen has
     * unknown bytes, and a layer that could not be reached reports nothing known.
     * It also catches one file in a hundred, not just all of them.
     */
    private warnOnStaleTagMisses;
    private getContentType;
    uploadFolder(params: TurboUploadFolderParams): Promise<TurboUploadFolderResponse>;
    shareCredits({ approvedAddress, approvedWincAmount, expiresBySeconds, }: TurboCreateCreditShareApprovalParams): Promise<CreditShareApproval>;
    revokeCredits({ revokedAddress, }: TurboRevokeCreditsParams): Promise<CreditShareApproval[]>;
    private enabledOnDemandTokens;
    /**
     * The winc the service will charge for the given items. Never less.
     *
     * The service prices an item as a per-byte rate plus a fixed per-item
     * charge, rounded up per item: a zero-byte item costs about 8M winc. Scaling
     * the 1 GiB price down to the item size dropped that fixed part, so a small
     * upload was under funded by up to ~38%, a folder by roughly the fixed charge
     * per file, and `topUpBufferMultiplier: 1` could never succeed.
     *
     * Items from 1 byte to 1 GiB are priced from two quotes, at 1 byte and 1 GiB.
     * The line through those two (already rounded up) prices never falls below
     * the service's unrounded price anywhere between them, so rounding each item
     * up keeps every estimate, and their sum, at or above what the service
     * charges. Rounding only the total could not promise that. Anything the line
     * would have to extrapolate to, and a lone item, is quoted exactly.
     *
     * The two quotes are made once per estimate. Each file of a folder still
     * checks its own price when it uploads.
     */
    private estimateUploadWinc;
    /**
     * Triggers an upload that will top-up the wallet with Credits for the amount before uploading.
     * First, it calculates the expected cost of the upload. Next, it checks the wallet for existing
     * balance. If the balance is insufficient, it will attempt the top-up with the wallet in the specified `token`
     * and await for the balance to be credited.
     * Note: Only `ario`, `solana`, and `base-eth` tokens are currently supported for on-demand uploads.
     */
    private onDemand;
    uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, }: {
        data: UploadDataType;
        signal?: AbortSignal;
        tags?: {
            name: string;
            value: string;
        }[];
        maxMUSDCAmount?: BigNumber;
    }): Promise<TurboUploadDataItemResponse>;
}
//# sourceMappingURL=upload.d.ts.map