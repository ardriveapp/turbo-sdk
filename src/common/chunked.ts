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

import {
  ByteCount,
  TurboChunkingMode,
  TurboLogger,
  TurboUploadDataItemResponse,
  UploadSignedDataItemParams,
  validChunkingModes,
} from '../types.js';
import { TurboEventEmitter, createStreamWithUploadEvents } from './events.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

const fiveMiB = 5 * 1024 * 1024; // 5 MiB
const fiveHundredMiB = fiveMiB * 100; // 500 MiB
export const defaultMaxChunkConcurrency = 5; // Default max chunk concurrency

export const maxChunkByteCount = fiveHundredMiB;
export const minChunkByteCount = fiveMiB;
export const defaultChunkByteCount = minChunkByteCount; // Default chunk size for uploads

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Events emitted during chunked upload.
 */
export interface ChunkingEvents {
  /** Fired after each successful chunk upload */
  onChunkUploaded: (info: {
    chunkPartNumber: number;
    chunkOffset: number;
    chunkByteCount: number;
    totalBytesUploaded: number;
  }) => void;
  /** Fired when a chunk upload fails */
  onChunkError: (info: {
    chunkPartNumber: number;
    chunkOffset: number;
    chunkByteCount: number;
    error: any;
  }) => void;
}

/**
 * Performs a chunked upload by splitting the stream into fixed-size buffers,
 * uploading them in parallel, and emitting progress/error events.
 */
export class ChunkedUploader {
  private readonly emitter = new TurboEventEmitter();
  private readonly chunkByteCount: number;
  private readonly maxChunkConcurrency: number;
  private readonly http: TurboHTTPService;
  private readonly token: string;
  private readonly logger: TurboLogger;

  constructor({
    http,
    token,
    maxChunkConcurrency = defaultMaxChunkConcurrency,
    chunkByteCount = defaultChunkByteCount,
    logger = TurboWinstonLogger.default,
  }: {
    http: TurboHTTPService;
    token: string;
    logger: TurboLogger;
    chunkByteCount?: number;
    maxChunkConcurrency?: number;
  }) {
    this.chunkByteCount = chunkByteCount;
    this.maxChunkConcurrency = maxChunkConcurrency;
    this.http = http;
    this.token = token;
    this.logger = logger;
  }

  static shouldUseChunkedUpload({
    chunkByteCount = defaultChunkByteCount,
    chunkingMode = 'auto',
    dataItemByteCount,
    maxChunkConcurrency = defaultMaxChunkConcurrency,
  }: {
    chunkByteCount?: ByteCount;
    chunkingMode?: TurboChunkingMode;
    dataItemByteCount: ByteCount;
    maxChunkConcurrency?: number;
  }): boolean {
    this.assertChunkParams({
      chunkByteCount,
      chunkingMode,
      maxChunkConcurrency,
    });

    if (chunkingMode === 'disabled') {
      return false;
    }
    if (chunkingMode === 'force') {
      return true;
    }

    const isMoreThanTwoChunksOfData = dataItemByteCount > chunkByteCount * 2;
    return isMoreThanTwoChunksOfData;
  }

  static assertChunkParams({
    chunkByteCount,
    chunkingMode,
    maxChunkConcurrency,
  }: {
    chunkByteCount: number;
    chunkingMode: TurboChunkingMode;
    maxChunkConcurrency: number;
  }): void {
    if (
      Number.isNaN(maxChunkConcurrency) ||
      !Number.isInteger(maxChunkConcurrency) ||
      maxChunkConcurrency < 1
    ) {
      throw new Error(
        'Invalid max chunk concurrency. Must be an integer of at least 1.',
      );
    }

    if (
      Number.isNaN(maxChunkConcurrency) ||
      !Number.isInteger(maxChunkConcurrency) ||
      chunkByteCount < fiveMiB ||
      chunkByteCount > fiveHundredMiB
    ) {
      throw new Error(
        'Invalid chunk size. Must be an integer between 5 MiB and 500 MiB.',
      );
    }

    if (
      typeof chunkingMode !== 'string' ||
      !validChunkingModes.includes(chunkingMode)
    ) {
      throw new Error(
        `Invalid chunking mode. Must be one of: ${validChunkingModes.join(
          ', ',
        )}`,
      );
    }
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
      chunkSize: number;
    }>({
      endpoint: `/chunks/${this.token}/-1/-1?chunkSize=${this.chunkByteCount}`,
      headers: this.chunkingVersionHeader,
    });
    return res.id;
  }

  public async upload({
    dataItemSizeFactory,
    dataItemStreamFactory,
    dataItemOpts,
    signal,
    events,
  }: UploadSignedDataItemParams): Promise<TurboUploadDataItemResponse> {
    const uploadId = await this.initUpload();
    const dataItemByteCount = dataItemSizeFactory();

    // create the tapped stream with events
    const emitter = new TurboEventEmitter(events);

    // create the stream with upload events
    const { stream, resume } = createStreamWithUploadEvents({
      data: dataItemStreamFactory(),
      dataSize: dataItemByteCount,
      emitter,
    });

    this.on('onChunkUploaded', ({ totalBytesUploaded }) => {
      emitter.emit('upload-progress', {
        processedBytes: totalBytesUploaded,
        totalBytes: dataItemByteCount,
      });
      if (totalBytesUploaded === dataItemByteCount) {
        emitter.emit('upload-success');
      }
    });
    this.on('onChunkError', ({ error }) => emitter.emit('upload-error', error));

    this.logger.debug(`Starting chunked upload`, {
      token: this.token,
      uploadId,
      totalSize: dataItemByteCount,
      chunkByteCount: this.chunkByteCount,
      maxChunkConcurrency: this.maxChunkConcurrency,
      inputStreamType:
        stream instanceof ReadableStream ? 'ReadableStream' : 'Readable',
    });

    const limit = pLimit(this.maxChunkConcurrency);
    let offset = 0;
    let chunkId = 0;
    const tasks: Promise<any>[] = [];

    const chunks = splitIntoChunks(stream, this.chunkByteCount);

    resume();
    for await (const chunk of chunks) {
      const chunkPartNumber = ++chunkId;
      const chunkByteCount = chunk.length;
      const chunkOffset = offset;
      const newOffset = offset + chunkByteCount;
      offset = newOffset;

      this.logger.debug('Queueing chunk', {
        chunkPartNumber,
        chunkOffset,
        chunkByteCount,
      });

      tasks.push(
        limit(async () => {
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
              ...this.chunkingVersionHeader,
            },
            signal,
          });
          this.logger.debug('Chunk uploaded', {
            chunkPartNumber,
            chunkOffset,
            chunkByteCount,
          });
          this.emit('onChunkUploaded', {
            chunkPartNumber,
            chunkOffset,
            chunkByteCount,
            totalBytesUploaded: newOffset,
          });
        }).catch((err) => {
          this.logger.error('Chunk upload failed', {
            id: chunkPartNumber,
            offset: chunkOffset,
            size: chunkByteCount,
            err,
          });
          this.emit('onChunkError', {
            chunkPartNumber,
            chunkOffset,
            chunkByteCount,
            error: err,
          });
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
 * Yield Buffers of up to `chunkByteCount`, coalescing whatever small pieces
 * the source produces into proper slices.
 */
export async function* splitIntoChunks(
  source: Readable | ReadableStream<Uint8Array>,
  chunkByteCount: number,
): AsyncGenerator<Buffer, void, unknown> {
  if (source instanceof Readable) {
    yield* splitReadableIntoChunks(source, chunkByteCount);
  } else if (source instanceof ReadableStream) {
    yield* splitReadableStreamIntoChunks(source, chunkByteCount);
  } else {
    throw new Error('Unsupported source type for chunking');
  }
}

export async function* splitReadableIntoChunks(
  source: Readable,
  chunkByteCount: number,
): AsyncGenerator<Buffer, void, unknown> {
  let acc = Buffer.alloc(0);

  for await (const piece of source) {
    acc = Buffer.concat([acc, piece]);

    while (acc.length >= chunkByteCount) {
      yield acc.subarray(0, chunkByteCount);
      acc = acc.subarray(chunkByteCount);
    }
  }

  // yield the final piece
  if (acc.length > 0) {
    yield acc;
  }
}

export async function* splitReadableStreamIntoChunks(
  source: ReadableStream<Uint8Array>,
  chunkByteCount: number,
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
      while (acc.length >= chunkByteCount) {
        yield Buffer.from(acc.subarray(0, chunkByteCount));
        acc = acc.subarray(chunkByteCount);
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
