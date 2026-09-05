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
import { wrapFetchWithPayment } from 'x402-fetch';
import { sleep } from '../utils/common.js';
import { AbortError, FailedRequestError } from '../utils/errors.js';
import { readableToReadableStream } from '../utils/readableStream.js';
import { version } from '../version.js';
export const defaultRetryConfig = (logger) => ({
    retryDelay: (retryCount) => Math.min(1000 * 2 ** (retryCount - 1), 30 * 1000),
    retries: 5,
    onRetry: (retryCount, error) => {
        logger?.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
    },
});
const defaultHeaders = {
    'x-turbo-source-version': version,
    'x-turbo-source-identifier': 'turbo-sdk',
};
/**
 * Canonical x402 upload routes on the upload service.
 *
 * These were previously `/x402/data-item/{signed,unsigned}`. The service
 * renamed them to `/x402/upload/*` and kept a `data-item/signed` alias, but not
 * a `data-item/unsigned` one — so every unsigned x402 upload 404ed. Both
 * canonical paths are served by all released upload-service versions.
 */
export const x402UploadEndpoints = {
    signed: '/x402/upload/signed',
    unsigned: '/x402/upload/unsigned',
};
export class TurboHTTPService {
    constructor({ url, logger, retryConfig = defaultRetryConfig(logger), }) {
        this.logger = logger;
        this.baseURL = url;
        this.retryConfig = retryConfig;
    }
    async get({ endpoint, signal, allowedStatuses = [200, 202], headers, x402Options, }) {
        if (x402Options !== undefined) {
            const maxMUSDCAmount = x402Options.maxMUSDCAmount !== undefined
                ? BigInt(x402Options.maxMUSDCAmount.toString())
                : undefined;
            const fetchWithPay = wrapFetchWithPayment(fetch, x402Options.signer, maxMUSDCAmount);
            return this.tryRequest(async () => fetchWithPay(this.baseURL + endpoint, {
                method: 'GET',
                // This GET is not a read: it settles a payment and returns the
                // resulting upload id. Nothing between here and the service may
                // store or replay that response. Sent as a header rather than the
                // `cache` init option, which undici does not honour consistently.
                headers: {
                    ...defaultHeaders,
                    ...headers,
                    'Cache-Control': 'no-store',
                },
                signal,
            }), allowedStatuses);
        }
        return this.withRetry(() => fetch(this.baseURL + endpoint, {
            method: 'GET',
            headers: { ...defaultHeaders, ...headers },
            signal,
        }), allowedStatuses);
    }
    async post({ endpoint, signal, allowedStatuses = [200, 202], headers, data, x402Options, retry = true, }) {
        if (x402Options !== undefined) {
            return this.x402Post({
                signal,
                allowedStatuses,
                headers,
                data,
                x402Options,
            });
        }
        // Convert all data types to fetch-compatible body
        const { body, duplex } = await toFetchBody(data);
        // Use retry for Buffer/Uint8Array, tryRequest for streams. Callers can opt
        // out of retry for non-idempotent signed writes via `retry: false`.
        const isReusableData = data instanceof Buffer || data instanceof Uint8Array;
        const requestFn = isReusableData && retry
            ? this.withRetry.bind(this)
            : this.tryRequest.bind(this);
        return requestFn(() => fetch(this.baseURL + endpoint, {
            method: 'POST',
            headers: { ...defaultHeaders, ...headers },
            body,
            signal,
            ...(duplex ? { duplex } : {}),
        }), allowedStatuses);
    }
    async tryRequest(request, allowedStatuses) {
        try {
            const response = await request();
            const { status, statusText } = response;
            if (!allowedStatuses.includes(status)) {
                const errorText = await response.text();
                throw new FailedRequestError(errorText || statusText, status);
            }
            // check the content-type header to see if json
            const contentType = response.headers.get('content-type');
            if (contentType !== null && contentType.includes('application/json')) {
                return response.json();
            }
            return response.text();
        }
        catch (error) {
            if (error.name === 'AbortError' || error.message.includes('aborted')) {
                throw new AbortError('Request was aborted');
            }
            throw error;
        }
    }
    async withRetry(request, allowedStatuses) {
        let attempt = 0;
        let lastError;
        while (attempt < this.retryConfig.retries) {
            try {
                const resp = await this.tryRequest(request, allowedStatuses);
                return resp;
            }
            catch (error) {
                if (error instanceof FailedRequestError) {
                    lastError = error;
                    this.retryConfig.onRetry(attempt + 1, error);
                    if (error.status !== undefined &&
                        error.status >= 400 &&
                        error.status < 500) {
                        // If it's a client error, we can stop retrying
                        throw error;
                    }
                    await sleep(this.retryConfig.retryDelay(attempt + 1));
                    attempt++;
                }
                else {
                    throw error;
                }
            }
        }
        throw new FailedRequestError('Max retries reached - ' + lastError?.message, lastError?.status);
    }
    async x402Post({ signal, allowedStatuses, headers, data, x402Options, }) {
        const endpoint = x402Options.unsignedData
            ? x402UploadEndpoints.unsigned
            : x402UploadEndpoints.signed;
        this.logger.debug('Using X402 options for POST request', {
            endpoint,
            x402Options,
        });
        const { body, duplex } = await toFetchBody(data);
        return this.tryRequest(async () => {
            const maxMUSDCAmount = x402Options.maxMUSDCAmount !== undefined
                ? BigInt(x402Options.maxMUSDCAmount.toString())
                : undefined;
            const fetchWithPay = wrapFetchWithPayment(fetch, x402Options.signer, maxMUSDCAmount);
            const res = await fetchWithPay(this.baseURL + endpoint, {
                method: 'POST',
                headers: { ...defaultHeaders, ...headers },
                body,
                signal,
                ...(duplex ? { duplex } : {}),
            });
            return res;
        }, allowedStatuses);
    }
}
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
async function toFetchBody(data) {
    // Handle ReadableStream
    if (data instanceof ReadableStream) {
        if (isFirefoxOrSafari()) {
            // Convert stream to blob for Firefox/Safari
            const blob = await new Response(data).blob();
            return { body: blob };
        }
        // Chrome/Edge/Opera support streaming
        return { body: data, duplex: 'half' };
    }
    // Handle Node.js Readable
    if (data instanceof Readable) {
        const stream = readableToReadableStream(data);
        // recursively call toFetchBody to now hit the ReadableStream case
        return toFetchBody(stream);
    }
    // Handle Buffer or Uint8Array
    if (isBrowser) {
        return { body: new Blob([new Uint8Array(data)]) };
    }
    return { body: Uint8Array.from(data) };
}
function isFirefoxOrSafari() {
    if (!isBrowser)
        return false;
    const ua = navigator.userAgent;
    return (ua.includes('Firefox') ||
        (ua.includes('Safari') &&
            !ua.includes('Chrome') &&
            !ua.includes('Chromium')));
}
