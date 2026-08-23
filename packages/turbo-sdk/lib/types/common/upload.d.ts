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