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
import { pLimit } from 'plimit-lit';
import { Readable } from 'stream';

import type {
  TurboLogger,
  TurboUploadDataItemResponse,
  UploadSignedDataItemParams,
} from '../types.js';
import { TurboEventEmitter } from './events.js';
import { TurboHTTPService } from './http.js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Events emitted during chunked upload.
 */
export interface ChunkingEvents {
  /** Fired after each successful chunk upload */
  chunkUpload: (info: {
    id: number;
    offset: number;
    size: number;
    totalUploaded: number;
  }) => void;
  /** Fired when a chunk upload fails */
  chunkError: (info: {
    id: number;
    offset: number;
    size: number;
    res: any;
  }) => void;
}

export type ChunkedUploaderParams = {
  http: TurboHTTPService;
  token: string;
  logger: TurboLogger;
  chunkSize?: number;
  maxChunkConcurrency?: number;
};

/**
 * Performs a chunked upload by splitting the stream into fixed-size buffers,
 * uploading them in parallel, and emitting progress/error events.
 */
export class ChunkedUploader {
  private readonly emitter = new TurboEventEmitter();
  private readonly chunkSize: number;
  private readonly maxChunkConcurrency: number;
  private readonly http: TurboHTTPService;
  private readonly token: string;
  private readonly logger: TurboLogger;

  constructor({
    http,
    token,
    maxChunkConcurrency,
    chunkSize,
    logger,
  }: ChunkedUploaderParams) {
    this.chunkSize = chunkSize ?? 5 * 1024 * 1024; // 5 MiB
    this.maxChunkConcurrency = maxChunkConcurrency ?? 5;
    this.http = http;
    this.token = token;
    this.logger = logger;
  }

  /**
   * Subscribe to chunking events.
   */
  public on<E extends keyof ChunkingEvents>(
    event: E,
    listener: ChunkingEvents[E],
  ): this {
    // TurboEventEmitter is not generic, so cast to any
    (this.emitter as any).on(event, listener);
    return this;
  }

  private emit<E extends keyof ChunkingEvents>(
    event: E,
    payload: Parameters<ChunkingEvents[E]>[0],
  ) {
    (this.emitter as any).emit(event, payload);
  }

  private get chunkingVersionHeader(): Record<string, string> {
    return { 'x-chunking-version': '2' };
  }

  /**
   * Initialize or resume an upload session, returning the upload ID.
   */
  private async initUpload(): Promise<string> {
    const res = await this.http.get<{
      id: string;
      min: number;
      max: number;
    }>({
      endpoint: `/chunks/${this.token}/-1/-1`,
      headers: this.chunkingVersionHeader,
    });
    return res.id;
  }

  public async upload({
    dataItemSizeFactory,
    dataItemStreamFactory,
    dataItemOpts,
    signal, // events, // TODO: use events within this class context to emit progress
  }: UploadSignedDataItemParams): Promise<TurboUploadDataItemResponse> {
    const uploadId = await this.initUpload();
    const size = dataItemSizeFactory();
    let stream = dataItemStreamFactory();

    this.logger.debug(`Starting chunked upload`, {
      token: this.token,
      uploadId,
      totalSize: size,
      chunkSize: this.chunkSize,
      maxChunkConcurrency: this.maxChunkConcurrency,
      inputStreamType:
        stream instanceof ReadableStream
          ? 'ReadableStream'
          : stream instanceof Readable
          ? 'Readable'
          : stream instanceof Buffer
          ? 'Buffer'
          : typeof stream,
    });

    if (stream instanceof Buffer) {
      stream = Readable.from(stream);
    }

    const limit = pLimit(this.maxChunkConcurrency);
    let offset = 0;
    let chunkId = 0;
    const tasks: Promise<any>[] = [];

    const chunks = splitIntoChunks(stream, this.chunkSize);

    for await (const chunk of chunks) {
      const id = ++chunkId;
      const len = chunk.length;
      const off = offset;
      offset += len;

      this.logger.debug('Queueing chunk', { id, offset: off, size: len });

      tasks.push(
        limit(async () => {
          this.logger.debug('Uploading chunk', { id, offset: off, size: len });
          await this.http.post({
            endpoint: `/chunks/${this.token}/${uploadId}/${off}`,
            data: chunk,
            headers: {
              'Content-Type': 'application/octet-stream',
              ...this.chunkingVersionHeader,
            },
            signal,
          });
          this.logger.debug('Chunk uploaded', { id, offset: off, size: len });
          this.emit('chunkUpload', {
            id,
            offset: off,
            size: len,
            totalUploaded: offset,
          });
        }).catch((err) => {
          this.logger.error('Chunk upload failed', {
            id,
            offset: off,
            size: len,
            err,
          });
          this.emit('chunkError', { id, offset: off, size: len, res: err });
          throw err;
        }),
      );
    }

    await Promise.all(tasks);

    const paidByHeader: Record<string, string> = {};
    if (dataItemOpts?.paidBy !== undefined) {
      paidByHeader['x-paid-by'] = Array.isArray(dataItemOpts.paidBy)
        ? dataItemOpts.paidBy.join(',')
        : dataItemOpts.paidBy;
    }

    // TODO: Async Finalize
    // Finalize and reconstruct server-side
    const finalizeResponse = await this.http.post<TurboUploadDataItemResponse>({
      endpoint: `/chunks/${this.token}/${uploadId}/-1`,
      data: Buffer.alloc(0),
      headers: {
        'Content-Type': 'application/octet-stream',
        ...paidByHeader,
        ...this.chunkingVersionHeader,
      },
      signal,
    });

    return finalizeResponse;
  }
}

/**
 * Yield Buffers of up to `chunkSize`, coalescing whatever small pieces
 * the source produces into proper slices.
 */
export async function* splitIntoChunks(
  source: Readable | ReadableStream<Uint8Array>,
  chunkSize: number,
): AsyncGenerator<Buffer, void, unknown> {
  if (source instanceof Readable) {
    yield* splitReadableIntoChunks(source, chunkSize);
  } else if (source instanceof ReadableStream) {
    yield* splitReadableStreamIntoChunks(source, chunkSize);
  } else {
    throw new Error('Unsupported source type for chunking');
  }
}

export async function* splitReadableIntoChunks(
  source: Readable,
  chunkSize: number,
): AsyncGenerator<Buffer, void, unknown> {
  let acc = Buffer.alloc(0);

  for await (const piece of source) {
    acc = Buffer.concat([acc, piece]);

    while (acc.length >= chunkSize) {
      yield acc.subarray(0, chunkSize);
      acc = acc.subarray(chunkSize);
    }
  }

  // yield the final piece
  if (acc.length > 0) {
    yield acc;
  }
}

export async function* splitReadableStreamIntoChunks(
  source: ReadableStream<Uint8Array>,
  chunkSize: number,
): AsyncGenerator<Buffer, void, unknown> {
  const reader = source.getReader();
  let acc = new Uint8Array(0);

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // Append to accumulator
      const merged = new Uint8Array(acc.length + value.length);
      merged.set(acc);
      merged.set(value, acc.length);
      acc = merged;

      // Yield full chunks
      while (acc.length >= chunkSize) {
        yield Buffer.from(acc.subarray(0, chunkSize));
        acc = acc.subarray(chunkSize);
      }
    }

    // Yield the remainder
    if (acc.length > 0) {
      yield Buffer.from(acc);
    }
  } finally {
    reader.releaseLock();
  }
}
