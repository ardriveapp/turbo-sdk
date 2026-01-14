"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChunkedUploader = exports.defaultChunkByteCount = exports.minChunkByteCount = exports.maxChunkByteCount = exports.defaultMaxChunkConcurrency = void 0;
exports.splitIntoChunks = splitIntoChunks;
exports.splitReadableIntoChunks = splitReadableIntoChunks;
exports.splitReadableStreamIntoChunks = splitReadableStreamIntoChunks;
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
const plimit_lit_1 = require("plimit-lit");
const types_js_1 = require("../types.js");
const common_js_1 = require("../utils/common.js");
const errors_js_1 = require("../utils/errors.js");
const errors_js_2 = require("../utils/errors.js");
const events_js_1 = require("./events.js");
const logger_js_1 = require("./logger.js");
const fiveMiB = 5 * 1024 * 1024; // 5 MiB
const fiveHundredMiB = fiveMiB * 100; // 500 MiB
exports.defaultMaxChunkConcurrency = 5;
// Limit uploaders to protect server
const absoluteMaxChunkConcurrency = 256;
exports.maxChunkByteCount = fiveHundredMiB;
exports.minChunkByteCount = fiveMiB;
exports.defaultChunkByteCount = exports.minChunkByteCount;
const backlogQueueFactor = 2;
const chunkingHeader = { 'x-chunking-version': '2' };
/**
 * Performs a chunked upload by splitting the stream into fixed-size buffers,
 * uploading them in parallel, and emitting progress/error events.
 */
class ChunkedUploader {
    constructor({ http, token, maxChunkConcurrency = exports.defaultMaxChunkConcurrency, maxFinalizeMs, chunkByteCount = exports.defaultChunkByteCount, logger = logger_js_1.Logger.default, chunkingMode = 'auto', dataItemByteCount, }) {
        this.assertChunkParams({
            chunkByteCount,
            chunkingMode,
            maxChunkConcurrency,
            maxFinalizeMs,
        });
        this.chunkByteCount = chunkByteCount;
        this.maxChunkConcurrency = maxChunkConcurrency;
        this.maxFinalizeMs = maxFinalizeMs;
        this.http = http;
        this.token = token;
        this.logger = logger;
        this.shouldUseChunkUploader = this.shouldChunkUpload({
            chunkByteCount,
            chunkingMode,
            dataItemByteCount,
        });
        this.maxBacklogQueue = this.maxChunkConcurrency * backlogQueueFactor;
    }
    shouldChunkUpload({ chunkByteCount, chunkingMode, dataItemByteCount, }) {
        if (chunkingMode === 'disabled') {
            return false;
        }
        if (chunkingMode === 'force') {
            return true;
        }
        const isMoreThanTwoChunksOfData = dataItemByteCount > chunkByteCount * 2;
        return isMoreThanTwoChunksOfData;
    }
    assertChunkParams({ chunkByteCount, chunkingMode, maxChunkConcurrency, maxFinalizeMs, }) {
        if (maxFinalizeMs !== undefined &&
            (Number.isNaN(maxFinalizeMs) ||
                !Number.isInteger(maxFinalizeMs) ||
                maxFinalizeMs < 0)) {
            throw new Error('Invalid max finalization wait time. Must be a non-negative integer.');
        }
        if (Number.isNaN(maxChunkConcurrency) ||
            !Number.isInteger(maxChunkConcurrency) ||
            maxChunkConcurrency < 1 ||
            maxChunkConcurrency > absoluteMaxChunkConcurrency) {
            throw new Error('Invalid max chunk concurrency. Must be an integer of at least 1 and at most 256.');
        }
        if (Number.isNaN(chunkByteCount) ||
            !Number.isInteger(chunkByteCount) ||
            chunkByteCount < fiveMiB ||
            chunkByteCount > fiveHundredMiB) {
            throw new Error('Invalid chunk size. Must be an integer between 5 MiB and 500 MiB.');
        }
        if (typeof chunkingMode !== 'string' ||
            !types_js_1.validChunkingModes.includes(chunkingMode)) {
            throw new Error(`Invalid chunking mode. Must be one of: ${types_js_1.validChunkingModes.join(', ')}`);
        }
    }
    /**
     * Initialize or resume an upload session, returning the upload ID.
     */
    async initUpload() {
        const res = await this.http.get({
            endpoint: `/chunks/${this.token}/-1/-1?chunkSize=${this.chunkByteCount}`,
            headers: chunkingHeader,
        });
        if (res.chunkSize !== this.chunkByteCount) {
            this.logger.warn('Chunk size mismatch! Overriding with server value.', {
                clientExpected: this.chunkByteCount,
                serverReturned: res.chunkSize,
            });
            this.chunkByteCount = res.chunkSize;
        }
        return res.id;
    }
    async upload({ dataItemSizeFactory, dataItemStreamFactory, dataItemOpts, signal, events, }) {
        const uploadId = await this.initUpload();
        const dataItemByteCount = dataItemSizeFactory();
        const emitter = new events_js_1.TurboEventEmitter(events);
        const { stream, resume } = (0, events_js_1.createStreamWithUploadEvents)({
            data: dataItemStreamFactory(),
            dataSize: dataItemByteCount,
            emitter,
        });
        this.logger.debug(`Starting chunked upload`, {
            token: this.token,
            uploadId,
            totalSize: dataItemByteCount,
            chunkByteCount: this.chunkByteCount,
            maxChunkConcurrency: this.maxChunkConcurrency,
            inputStreamType: isReadableStream(stream) ? 'ReadableStream' : 'Readable',
        });
        const inFlight = new Set();
        const internalAbort = new AbortController();
        const combinedSignal = combineAbortSignals([internalAbort.signal, signal]);
        const limit = (0, plimit_lit_1.pLimit)(this.maxChunkConcurrency);
        let currentOffset = 0;
        let currentChunkPartNumber = 0;
        let firstError;
        let uploadedBytes = 0;
        const chunks = splitIntoChunks(stream, this.chunkByteCount);
        resume();
        for await (const chunk of chunks) {
            if (combinedSignal?.aborted) {
                internalAbort.abort();
                await Promise.allSettled(inFlight);
                firstError ??= new errors_js_1.AbortError();
                break;
            }
            const chunkPartNumber = ++currentChunkPartNumber;
            const chunkByteCount = chunk.length;
            const chunkOffset = currentOffset;
            currentOffset += chunkByteCount;
            const promise = limit(async () => {
                if (firstError !== undefined) {
                    return;
                }
                this.logger.debug('Uploading chunk', {
                    chunkPartNumber,
                    chunkOffset,
                    chunkByteCount,
                });
                await this.http.post({
                    endpoint: `/chunks/${this.token}/${uploadId}/${chunkOffset}`,
                    data: chunk,
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        ...chunkingHeader,
                    },
                    signal: combinedSignal,
                });
                uploadedBytes += chunkByteCount;
                this.logger.debug('Chunk uploaded', {
                    chunkPartNumber,
                    chunkOffset,
                    chunkByteCount,
                });
                emitter.emit('upload-progress', {
                    processedBytes: uploadedBytes,
                    totalBytes: dataItemByteCount,
                });
            }).catch((err) => {
                this.logger.error('Chunk upload failed', {
                    id: chunkPartNumber,
                    offset: chunkOffset,
                    size: chunkByteCount,
                    err,
                });
                emitter.emit('upload-error', err);
                internalAbort.abort(err);
                firstError = firstError ?? err;
            });
            inFlight.add(promise);
            promise.finally(() => inFlight.delete(promise));
            if (inFlight.size >= this.maxBacklogQueue) {
                await Promise.race(inFlight);
                if (combinedSignal?.aborted) {
                    internalAbort.abort();
                    await Promise.allSettled(inFlight);
                    firstError ??= new errors_js_1.AbortError();
                    break;
                }
            }
        }
        await Promise.all(inFlight);
        if (firstError !== undefined) {
            throw firstError;
        }
        const finalizeResponse = await this.finalizeUpload(uploadId, dataItemByteCount, dataItemOpts?.paidBy, combinedSignal);
        emitter.emit('upload-success');
        return finalizeResponse;
    }
    toGiB(bytes) {
        return bytes / 1024 ** 3;
    }
    async finalizeUpload(uploadId, dataItemByteCount, paidBy, signal) {
        // Wait up to 1 minute per GiB of data for the upload to finalize
        const fileSizeInGiB = Math.ceil(this.toGiB(dataItemByteCount));
        const defaultMaxWaitTimeMins = fileSizeInGiB * 2.5;
        const maxWaitTimeMs = this.maxFinalizeMs ?? Math.floor(defaultMaxWaitTimeMins * 60 * 1000);
        const minimumWaitPerStepMs = 
        // Per step, files smaller than 100MB will wait 2 second,
        dataItemByteCount < 1024 * 1024 * 100
            ? 2000
            : // files smaller than 3 GiB will wait 4 seconds,
                dataItemByteCount < 1024 * 1024 * 1024 * 3
                    ? 4000
                    : // and larger files will wait 1.5 second per GiB with max of 15 seconds
                        Math.max(1500 * fileSizeInGiB, 15000);
        const paidByHeader = {};
        if (paidBy !== undefined) {
            paidByHeader['x-paid-by'] = Array.isArray(paidBy)
                ? paidBy.join(',')
                : paidBy;
        }
        await this.http.post({
            endpoint: `/chunks/${this.token}/${uploadId}/finalize`,
            data: Buffer.alloc(0),
            headers: {
                'Content-Type': 'application/octet-stream',
                ...paidByHeader,
                ...chunkingHeader,
            },
            signal,
        });
        this.logger.debug(`Confirming upload to Turbo with uploadId ${uploadId} for up to ${maxWaitTimeMs / 1000 / 60} minutes.`);
        const startTime = Date.now();
        const cutoffTime = startTime + maxWaitTimeMs;
        let attempts = 0;
        while (Date.now() < cutoffTime) {
            // Wait for 3/4 of the time remaining per attempt or minimum step
            const waitTimeMs = Math.min(Math.floor((cutoffTime - Date.now()) * (3 / 4)), minimumWaitPerStepMs);
            await (0, common_js_1.sleep)(waitTimeMs);
            if (signal?.aborted) {
                this.logger.warn(`Upload finalization aborted by signal.`);
                throw new errors_js_1.AbortError();
            }
            const response = await this.http.get({
                endpoint: `/chunks/${this.token}/${uploadId}/status`,
                signal,
            });
            this.logger.debug(`Upload status found: ${response.status}`, {
                status: response.status,
                attempts: attempts++,
                maxWaitTimeMs,
                minimumWaitPerStepMs,
                waitTimeMs,
                elapsedMs: Date.now() - startTime,
            });
            if (response.status === 'FINALIZED') {
                this.logger.debug(`Upload finalized successfully.`);
                return response.receipt;
            }
            if (response.status === 'UNDERFUNDED') {
                throw new errors_js_2.FailedRequestError(`Insufficient balance`, 402);
            }
            if (types_js_1.multipartFailedStatus.includes(response.status)) {
                throw new errors_js_2.FailedRequestError(`Upload failed with multi-part status ${response.status}`);
            }
        }
        throw new Error(`Upload multi-part finalization has timed out for Upload ID ${uploadId}`);
    }
}
exports.ChunkedUploader = ChunkedUploader;
/**
 * Yield Buffers of up to `chunkByteCount`, coalescing whatever small pieces
 * the source produces into proper slices.
 */
async function* splitIntoChunks(source, chunkByteCount) {
    if (isReadableStream(source)) {
        yield* splitReadableStreamIntoChunks(source, chunkByteCount);
    }
    else {
        yield* splitReadableIntoChunks(source, chunkByteCount);
    }
}
async function* splitReadableIntoChunks(source, chunkByteCount) {
    const queue = [];
    let total = 0;
    let encoder;
    for await (const piece of source) {
        const u8 = piece instanceof Uint8Array
            ? new Uint8Array(piece.buffer, piece.byteOffset, piece.byteLength)
            : (encoder ??= new TextEncoder()).encode(String(piece));
        queue.push(u8);
        total += u8.length;
        // Emit full chunks
        while (total >= chunkByteCount) {
            const out = new Uint8Array(chunkByteCount);
            let remaining = out.length;
            let off = 0;
            while (remaining > 0) {
                const head = queue[0];
                const take = Math.min(remaining, head.length);
                out.set(head.subarray(0, take), off);
                off += take;
                remaining -= take;
                if (take === head.length) {
                    queue.shift();
                }
                else {
                    queue[0] = head.subarray(take);
                }
            }
            total -= chunkByteCount;
            // Yield a Buffer view (no copy)
            yield Buffer.from(out.buffer, out.byteOffset, out.byteLength);
        }
    }
    // Remainder
    if (total > 0) {
        const out = new Uint8Array(total);
        let off = 0;
        while (queue.length > 0) {
            const head = queue.shift(); // safe due to loop condition
            out.set(head, off);
            off += head.length;
        }
        yield Buffer.from(out.buffer, out.byteOffset, out.byteLength);
    }
}
async function* splitReadableStreamIntoChunks(source, chunkByteCount) {
    const reader = source.getReader();
    const queue = [];
    let total = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            // Ensure we keep a plain view (avoids surprises if the producer reuses buffers)
            const u8 = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
            queue.push(u8);
            total += u8.length;
            while (total >= chunkByteCount) {
                const out = new Uint8Array(chunkByteCount);
                let remaining = out.length;
                let off = 0;
                while (remaining > 0) {
                    const head = queue[0];
                    const take = Math.min(remaining, head.length);
                    out.set(head.subarray(0, take), off);
                    off += take;
                    remaining -= take;
                    if (take === head.length) {
                        queue.shift();
                    }
                    else {
                        queue[0] = head.subarray(take);
                    }
                }
                total -= chunkByteCount;
                yield Buffer.from(out.buffer, out.byteOffset, out.byteLength);
            }
        }
        if (total > 0) {
            const out = new Uint8Array(total);
            let off = 0;
            while (queue.length > 0) {
                const head = queue.shift(); // safe due to loop condition
                out.set(head, off);
                off += head.length;
            }
            yield Buffer.from(out.buffer, out.byteOffset, out.byteLength);
        }
    }
    finally {
        reader.releaseLock();
    }
}
function isReadableStream(source) {
    // Prefer instanceof if available, otherwise use a safe duck-typing check
    if (typeof ReadableStream !== 'undefined' &&
        source instanceof ReadableStream) {
        return true;
    }
    return (source !== null &&
        typeof source === 'object' &&
        'getReader' in source &&
        typeof source.getReader === 'function');
}
function combineAbortSignals(signals) {
    const real = signals.filter(Boolean);
    if (real.length === 0)
        return undefined;
    const anyFn = AbortSignal.any;
    if (typeof anyFn === 'function') {
        return anyFn(real);
    }
    const controller = new AbortController();
    for (const s of real) {
        const sig = s;
        if (sig.aborted) {
            controller.abort(sig.reason);
            break;
        }
        const onAbort = () => controller.abort(sig.reason);
        s.addEventListener('abort', onAbort, { once: true });
    }
    return controller.signal;
}
