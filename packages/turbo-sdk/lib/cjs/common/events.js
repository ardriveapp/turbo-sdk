"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboEventEmitter = void 0;
exports.createStreamWithEvents = createStreamWithEvents;
exports.createStreamWithUploadEvents = createStreamWithUploadEvents;
exports.createStreamWithSigningEvents = createStreamWithSigningEvents;
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
const eventemitter3_1 = require("eventemitter3");
const stream_1 = require("stream");
/**
 * Creates a ReadableStream with events that emits progress and error events using the event names map.
 *
 * E.g.
 *
 * ```ts
 * const eventNamesMap = {
 *   'on-progress': 'signing-progress', // emits 'signing-progress' on event progress
 *   'on-error': 'signing-error', // emits 'signing-error' errors
 *   'on-end': 'signing-success', // emits 'signing-success' on end
 * };
 *
 * const streamWithEvents = createStreamWithEvents({
 *   data,
 *   dataSize,
 *   emitter,
 *   eventNamesMap,
 * });
 * ```
 */
function createReadableStreamWithEvents({ data, dataSize, emitter, eventNamesMap, }) {
    const originalStream = data instanceof ReadableStream
        ? data
        : new ReadableStream({
            start: (controller) => {
                controller.enqueue(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                controller.close();
            },
        });
    let processedBytes = 0;
    let reader;
    const stream = new ReadableStream({
        start() {
            reader = originalStream.getReader();
        },
        async pull(controller) {
            try {
                const { value, done } = await reader.read();
                if (done) {
                    emitter.emit(eventNamesMap['on-end']);
                    controller.close();
                    return;
                }
                processedBytes += value.byteLength;
                emitter.emit(eventNamesMap['on-progress'], {
                    processedBytes,
                    totalBytes: dataSize,
                });
                controller.enqueue(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
            }
            catch (error) {
                emitter.emit(eventNamesMap['on-error'], error);
                controller.error(error);
            }
        },
        cancel(reason) {
            return reader.cancel(reason);
        },
    });
    return {
        stream,
        resume: () => void 0, // not needed for ReadableStreams but stubbed out for type compatibility
    };
}
/**
 * Creates an eventing Readable stream that emits progress and error events.
 *
 * NOTE: When dealing ith Readable streams, any downstream consumer stream will need to call `resume()` once the consumer is properly set up.
 * If we were to call it internally here, bytes would start flowing due to the configured 'data' event listener.
 * For ReadableStreams, this is not a concern, so we stub out the resume function
 *
 * Example usage:
 *
 * ```ts
 * const { stream, resume } = createReadableWithEvents({
 *   data,
 *   dataSize,
 *   emitter,
 *   eventNamesMap,
 * });
 *
 * // setup any promise that will consume the stream (e.g. a POST request)
 * const promise = new Promise((resolve, reject) => {
 *   stream.on('data', (chunk) => {
 *     resolve(chunk);
 *   });
 * });
 *
 * // allow bytes to start flowing so the promise gets the data
 * resume();
 *
 * // wait for the promise to resolve
 * const result = await promise;
 * ```
 */
function createReadableWithEvents({ data, dataSize, emitter, eventNamesMap, }) {
    const existingStream = data instanceof stream_1.Readable ? data : stream_1.Readable.from(data);
    const eventingStream = new stream_1.PassThrough();
    // pause the stream to avoid emitting progress events until the stream is ready
    existingStream.pause();
    // add listener to emit progress events as the stream is read
    let processedBytes = 0;
    existingStream.on('data', (chunk) => {
        eventingStream.write(chunk);
        processedBytes += chunk.byteLength;
        emitter.emit(eventNamesMap['on-progress'], {
            processedBytes,
            totalBytes: dataSize,
        });
    });
    existingStream.on('end', () => {
        emitter.emit(eventNamesMap['on-end']);
        eventingStream.end();
    });
    existingStream.on('error', (error) => {
        emitter.emit(eventNamesMap['on-error'], error);
        eventingStream.destroy(error);
    });
    return {
        stream: eventingStream,
        // allows bytes to start flowing from the original stream when the consumer is ready
        resume: () => existingStream.resume(),
    };
}
/**
 * Creates an eventing stream from the input data that emits progress and error events
 */
function createStreamWithEvents({ data, dataSize, emitter, eventNamesMap, }) {
    if (data instanceof ReadableStream ||
        (typeof window !== 'undefined' && data instanceof Buffer)) {
        return createReadableStreamWithEvents({
            data,
            dataSize,
            emitter,
            eventNamesMap,
        });
    }
    if (data instanceof stream_1.Readable || data instanceof Buffer) {
        return createReadableWithEvents({
            data,
            dataSize,
            emitter,
            eventNamesMap,
        });
    }
    throw new Error('Invalid data or platform type');
}
class TurboEventEmitter extends eventemitter3_1.EventEmitter {
    constructor({ onProgress, onError, onSuccess, onUploadProgress, onUploadError, onUploadSuccess, onSigningProgress, onSigningError, onSigningSuccess, onFileStart, onFileProgress, onFileComplete, onFileError, onFolderProgress, onFolderError, onFolderSuccess, } = {}) {
        super();
        if (onUploadProgress !== undefined) {
            this.on('upload-progress', onUploadProgress);
        }
        if (onUploadError !== undefined) {
            this.on('upload-error', onUploadError);
        }
        if (onUploadSuccess !== undefined) {
            this.on('upload-success', onUploadSuccess);
        }
        if (onSigningProgress !== undefined) {
            this.on('signing-progress', onSigningProgress);
        }
        if (onSigningError !== undefined) {
            this.on('signing-error', onSigningError);
        }
        if (onSigningSuccess !== undefined) {
            this.on('signing-success', onSigningSuccess);
        }
        if (onProgress !== undefined) {
            this.on('overall-progress', onProgress);
        }
        if (onError !== undefined) {
            this.on('overall-error', onError);
        }
        if (onSuccess !== undefined) {
            this.on('overall-success', onSuccess);
        }
        // emit listeners for total events
        this.on('signing-progress', (event) => {
            this.emit('overall-progress', {
                ...event,
                processedBytes: event.processedBytes / 2, // since the total progress requires 2 passes through the stream, signing progress is only half of the total progress
                totalBytes: event.totalBytes,
                step: 'signing',
            });
        });
        this.on('signing-error', (error) => {
            this.emit('overall-error', error);
        });
        this.on('upload-progress', (event) => {
            this.emit('overall-progress', {
                ...event,
                processedBytes: event.totalBytes / 2 + event.processedBytes / 2, // Start at 50% since signing is done, then add half of upload progress
                totalBytes: event.totalBytes,
                step: 'upload',
            });
        });
        this.on('upload-error', (error) => {
            this.emit('overall-error', error);
        });
        // NOTE: this is the last event emitted for successful upload,
        // if another step was added (e.g. verifying optimistic caching)
        // then this overall-success event will be emitted after that step
        this.on('upload-success', () => {
            this.emit('overall-success');
        });
        // folder upload event handlers
        if (onFileStart !== undefined) {
            this.on('file-upload-start', onFileStart);
        }
        if (onFileProgress !== undefined) {
            this.on('file-upload-progress', onFileProgress);
        }
        if (onFileComplete !== undefined) {
            this.on('file-upload-complete', onFileComplete);
        }
        if (onFileError !== undefined) {
            this.on('file-upload-error', onFileError);
        }
        if (onFolderProgress !== undefined) {
            this.on('folder-progress', onFolderProgress);
        }
        if (onFolderError !== undefined) {
            this.on('folder-error', onFolderError);
        }
        if (onFolderSuccess !== undefined) {
            this.on('folder-success', onFolderSuccess);
        }
    }
}
exports.TurboEventEmitter = TurboEventEmitter;
function createStreamWithUploadEvents({ data, dataSize, emitter = new TurboEventEmitter(), }) {
    return createStreamWithEvents({
        data,
        dataSize,
        emitter,
        eventNamesMap: {
            'on-progress': 'upload-progress',
            'on-error': 'upload-error',
            'on-end': 'upload-success',
        },
    });
}
function createStreamWithSigningEvents({ data, dataSize, emitter = new TurboEventEmitter(), }) {
    return createStreamWithEvents({
        data,
        dataSize,
        emitter,
        eventNamesMap: {
            'on-progress': 'signing-progress',
            'on-error': 'signing-error',
            'on-end': 'signing-success',
        },
    });
}
