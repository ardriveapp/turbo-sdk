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
import { AxiosInstance } from 'axios';
import { Readable } from 'node:stream';
import { TurboHTTPServiceInterface, TurboLogger, TurboSignedRequestHeaders, X402RequestCredentials } from '../types.js';
import { RetryConfig } from '../utils/axiosClient.js';
export declare class TurboHTTPService implements TurboHTTPServiceInterface {
    protected axios: AxiosInstance;
    protected logger: TurboLogger;
    protected retryConfig: RetryConfig;
    constructor({ url, logger, retryConfig, }: {
        url: string;
        retryConfig: RetryConfig;
        logger: TurboLogger;
    });
    get<T>({ endpoint, signal, allowedStatuses, headers, }: {
        endpoint: string;
        signal?: AbortSignal;
        allowedStatuses?: number[];
        headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    }): Promise<T>;
    post<T>({ endpoint, signal, allowedStatuses, headers, data, x402Options, }: {
        endpoint: string;
        signal?: AbortSignal;
        allowedStatuses?: number[];
        headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
        data: Readable | Buffer | ReadableStream | Uint8Array;
        x402Options?: X402RequestCredentials;
    }): Promise<T>;
    private tryRequest;
    private retryRequest;
}
type FetchBodyInput = ReadableStream<Uint8Array> | Readable | Buffer | Uint8Array;
/** Create a re-usable body for x402 fetch protocol */
export declare function toX402FetchBody(data: FetchBodyInput): Promise<{
    body: BodyInit;
    duplex?: 'half';
}>;
export {};
//# sourceMappingURL=http.d.ts.map