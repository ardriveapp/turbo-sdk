"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_STREAM_CHUNK_SIZE = void 0;
exports.readableStreamToBuffer = readableStreamToBuffer;
exports.ensureChunkedStream = ensureChunkedStream;
exports.bufferToReadableStream = bufferToReadableStream;
exports.readableToReadableStream = readableToReadableStream;
exports.createUint8ArrayReadableStreamFactory = createUint8ArrayReadableStreamFactory;
exports.DEFAULT_STREAM_CHUNK_SIZE = 20 * 1024 * 1024; // 20mb
async function readableStreamToBuffer({ stream, size, }) {
    const reader = stream.getReader();
    const buffer = Buffer.alloc(size);
    let offset = 0;
    let done = false;
    while (!done) {
        const { done: streamDone, value } = await reader.read();
        done = streamDone;
        if (!done) {
            buffer.set(value, offset);
            offset += value.byteLength;
        }
    }
    return buffer;
}
function ensureChunkedStream(input, maxChunkSize = exports.DEFAULT_STREAM_CHUNK_SIZE) {
    const reader = input.getReader();
    let leftover = null;
    return new ReadableStream({
        async pull(controller) {
            // If we have leftover from a previous large chunk, continue slicing it
            if (leftover) {
                const chunk = leftover.subarray(0, maxChunkSize);
                leftover = leftover.subarray(chunk.length);
                if (leftover.length === 0)
                    leftover = null;
                controller.enqueue(chunk);
                return;
            }
            const { value, done } = await reader.read();
            if (done) {
                controller.close();
                return;
            }
            // Runtime check because ReadableStream defaults to <any> and can be abused
            if (!(value instanceof Uint8Array)) {
                throw new TypeError('Expected Uint8Array from source stream');
            }
            if (value.byteLength <= maxChunkSize) {
                controller.enqueue(value);
            }
            else {
                // Slice and enqueue one piece now, keep the rest
                // subarray is the new view with the same buffer (not copy)
                controller.enqueue(value.subarray(0, maxChunkSize));
                leftover = value.subarray(maxChunkSize);
            }
        },
    });
}
function bufferToReadableStream(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    return new ReadableStream({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });
}
function readableToReadableStream(readable) {
    return new ReadableStream({
        async start(controller) {
            for await (const chunk of readable) {
                controller.enqueue(Buffer.isBuffer(chunk) ? new Uint8Array(chunk) : chunk);
            }
            controller.close();
        },
    });
}
function createUint8ArrayReadableStreamFactory({ data, maxChunkSize = exports.DEFAULT_STREAM_CHUNK_SIZE, }) {
    // Blob streams are already ReadableStream<Uint8Array>
    if (data instanceof Blob) {
        return () => ensureChunkedStream(data.stream());
    }
    // We need to handle the case where the data is a ReadableStream that is not a Uint8Array
    // This is to ensure downstream code can handle the data as a Uint8Array
    if (data instanceof ReadableStream) {
        return () => {
            const reader = data.getReader();
            const stream = new ReadableStream({
                async pull(controller) {
                    const { value, done } = await reader.read();
                    if (done) {
                        controller.close();
                        return;
                    }
                    if (ArrayBuffer.isView(value)) {
                        // specifying offset and length is required to ensure chunks remain within their slice of the buffer
                        controller.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
                    }
                    else if (value instanceof ArrayBuffer ||
                        value instanceof SharedArrayBuffer) {
                        controller.enqueue(new Uint8Array(value));
                    }
                    else {
                        throw new TypeError('Unsupported chunk type in ReadableStream');
                    }
                },
            });
            return ensureChunkedStream(stream, maxChunkSize);
        };
    }
    return () => {
        let uint8;
        if (typeof data === 'string') {
            uint8 = new TextEncoder().encode(data);
        }
        else if (ArrayBuffer.isView(data)) {
            // In theory we could use the view directly, but that might allow other typed arrays like BigInt64Array to be used which could behave unexpectedly downstream
            // specifying offset and length is required to ensure chunks remain within their slice of the buffer
            uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
        else if (data instanceof ArrayBuffer ||
            data instanceof SharedArrayBuffer) {
            uint8 = new Uint8Array(data);
        }
        else {
            throw new TypeError('Unsupported input type for stream');
        }
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(uint8);
                controller.close();
            },
        });
        return ensureChunkedStream(stream, maxChunkSize);
    };
}
