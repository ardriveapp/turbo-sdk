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
export declare const DEFAULT_STREAM_CHUNK_SIZE: number;
export declare function readableStreamToBuffer({ stream, size, }: {
    stream: ReadableStream;
    size: number;
}): Promise<Buffer>;
export declare function ensureChunkedStream(input: ReadableStream<Uint8Array>, maxChunkSize?: number): ReadableStream<Uint8Array>;
export declare function bufferToReadableStream(data: Buffer | Uint8Array): ReadableStream;
export declare function readableToReadableStream(readable: import('stream').Readable): ReadableStream;
export declare function createUint8ArrayReadableStreamFactory({ data, maxChunkSize, }: {
    data: string | Uint8Array | ArrayBuffer | Buffer | SharedArrayBuffer | Blob | ReadableStream;
    maxChunkSize?: number;
}): () => ReadableStream<Uint8Array>;
//# sourceMappingURL=readableStream.d.ts.map