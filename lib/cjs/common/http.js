"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboHTTPService = exports.defaultRetryConfig = void 0;
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
const node_stream_1 = require("node:stream");
const x402_fetch_1 = require("x402-fetch");
const common_js_1 = require("../utils/common.js");
const errors_js_1 = require("../utils/errors.js");
const readableStream_js_1 = require("../utils/readableStream.js");
const version_js_1 = require("../version.js");
const defaultRetryConfig = (logger) => ({
    retryDelay: (retryCount) => Math.min(1000 * 2 ** (retryCount - 1), 30 * 1000),
    retries: 5,
    onRetry: (retryCount, error) => {
        logger?.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
    },
});
exports.defaultRetryConfig = defaultRetryConfig;
const defaultHeaders = {
    'x-turbo-source-version': version_js_1.version,
    'x-turbo-source-identifier': 'turbo-sdk',
};
class TurboHTTPService {
    constructor({ url, logger, retryConfig = (0, exports.defaultRetryConfig)(logger), }) {
        this.logger = logger;
        this.baseURL = url;
        this.retryConfig = retryConfig;
    }
    async get({ endpoint, signal, allowedStatuses = [200, 202], headers, }) {
        return this.withRetry(() => fetch(this.baseURL + endpoint, {
            method: 'GET',
            headers: { ...defaultHeaders, ...headers },
            signal,
        }), allowedStatuses);
    }
    async post({ endpoint, signal, allowedStatuses = [200, 202], headers, data, x402Options, }) {
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
        // Use retry for Buffer/Uint8Array, tryRequest for streams
        const isReusableData = data instanceof Buffer || data instanceof Uint8Array;
        const requestFn = isReusableData
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
                throw new errors_js_1.FailedRequestError(errorText || statusText, status);
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
                throw new errors_js_1.AbortError('Request was aborted');
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
                if (error instanceof errors_js_1.FailedRequestError) {
                    lastError = error;
                    this.retryConfig.onRetry(attempt + 1, error);
                    if (error.status !== undefined &&
                        error.status >= 400 &&
                        error.status < 500) {
                        // If it's a client error, we can stop retrying
                        throw error;
                    }
                    await (0, common_js_1.sleep)(this.retryConfig.retryDelay(attempt + 1));
                    attempt++;
                }
                else {
                    throw error;
                }
            }
        }
        throw new errors_js_1.FailedRequestError('Max retries reached - ' + lastError?.message, lastError?.status);
    }
    async x402Post({ signal, allowedStatuses, headers, data, x402Options, }) {
        const endpoint = '/x402/data-item/' + (x402Options.unsignedData ? 'unsigned' : 'signed');
        this.logger.debug('Using X402 options for POST request', {
            endpoint,
            x402Options,
        });
        const { body, duplex } = await toFetchBody(data);
        return this.tryRequest(async () => {
            const maxMUSDCAmount = x402Options.maxMUSDCAmount !== undefined
                ? BigInt(x402Options.maxMUSDCAmount.toString())
                : undefined;
            const fetchWithPay = (0, x402_fetch_1.wrapFetchWithPayment)(fetch, x402Options.signer, maxMUSDCAmount);
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
exports.TurboHTTPService = TurboHTTPService;
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
    if (data instanceof node_stream_1.Readable) {
        const stream = (0, readableStream_js_1.readableToReadableStream)(data);
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
