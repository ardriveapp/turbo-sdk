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
import { ArweaveManifest, CreditShareApproval, FundingOptions, TokenType, TurboAbortSignal, TurboAuthenticatedUploadServiceConfiguration, TurboAuthenticatedUploadServiceInterface, TurboChunkingParams, TurboCreateCreditShareApprovalParams, TurboDataItemSigner, TurboFileFactory, TurboLogger, TurboRevokeCreditsParams, TurboUnauthenticatedUploadServiceConfiguration, TurboUnauthenticatedUploadServiceInterface, TurboUploadAndSigningEmitterEvents, TurboUploadDataItemResponse, TurboUploadEmitterEvents, TurboUploadFileParams, TurboUploadFolderParams, TurboUploadFolderResponse, UploadDataInput, UploadDataType, UploadSignedDataItemParams } from '../types.js';
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
export declare const developmentUploadServiceURL = "https://upload.ardrive.dev";
export declare const defaultUploadServiceURL = "https://upload.ardrive.io";
export declare class TurboUnauthenticatedUploadService implements TurboUnauthenticatedUploadServiceInterface {
    protected httpService: TurboHTTPService;
    protected logger: TurboLogger;
    protected token: TokenType;
    protected x402EnabledTokens: TokenType[];
    protected retryConfig: RetryConfig;
    constructor({ url, logger, retryConfig, token, }: TurboUnauthenticatedUploadServiceConfiguration);
    uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, dataItemOpts, signal, events, x402Options, }: UploadSignedDataItemParams): Promise<TurboUploadDataItemResponse>;
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