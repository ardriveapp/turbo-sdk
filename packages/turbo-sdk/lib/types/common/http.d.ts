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
import { Readable } from 'node:stream';
import { TurboHTTPServiceInterface, TurboLogger, TurboSignedRequestHeaders, X402RequestCredentials } from '../types.js';
export interface RetryConfig {
    retryDelay: (retryCount: number) => number;
    retries: number;
    onRetry: (retryCount: number, error: unknown) => void;
}
export declare const defaultRetryConfig: (logger?: TurboLogger) => RetryConfig;
/**
 * Canonical x402 upload routes on the upload service.
 *
 * These were previously `/x402/data-item/{signed,unsigned}`. The service
 * renamed them to `/x402/upload/*` and kept a `data-item/signed` alias, but not
 * a `data-item/unsigned` one — so every unsigned x402 upload 404ed. Both
 * canonical paths are served by all released upload-service versions.
 */
export declare const x402UploadEndpoints: {
    readonly signed: "/x402/upload/signed";
    readonly unsigned: "/x402/upload/unsigned";
};
export declare class TurboHTTPService implements TurboHTTPServiceInterface {
    protected baseURL: string;
    protected logger: TurboLogger;
    protected retryConfig: RetryConfig;
    constructor({ url, logger, retryConfig, }: {
        url: string;
        retryConfig: RetryConfig;
        logger: TurboLogger;
    });
    get<T>({ endpoint, signal, allowedStatuses, headers, x402Options, }: {
        endpoint: `/${string}`;
        signal?: AbortSignal;
        allowedStatuses?: number[];
        headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
        /**
         * Pay for this GET with x402. Used by the chunked uploader's create call,
         * which the bundler answers with a 402 because a multipart upload is paid
         * for BEFORE any chunk is accepted.
         *
         * Delegates to the same `wrapFetchWithPayment` the POST path uses, so the
         * signer, the spend cap and the retry semantics are identical rather than
         * a second implementation that can drift.
         */
        x402Options?: X402RequestCredentials;
    }): Promise<T>;
    post<T>({ endpoint, signal, allowedStatuses, headers, data, x402Options, retry, }: {
        endpoint: `/${string}`;
        signal?: AbortSignal;
        allowedStatuses?: number[];
        headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
        data: Readable | Buffer | ReadableStream | Uint8Array;
        x402Options?: X402RequestCredentials;
        retry?: boolean;
    }): Promise<T>;
    private tryRequest;
    private withRetry;
    private x402Post;
}
//# sourceMappingURL=http.d.ts.map