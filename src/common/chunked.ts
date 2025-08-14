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
import { CanceledError } from 'axios';
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

const backlogQueueFactor = 2;
const chunkingHeader = { 'x-chunking-version': '2' } as const;

/**
 * Performs a chunked upload by splitting the stream into fixed-size buffers,
 * uploading them in parallel, and emitting progress/error events.
 */
export class ChunkedUploader {
  private chunkByteCount: number;
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
    ChunkedUploader.assertChunkParams({
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
    chunkByteCount = defaultChunkByteCount,
    chunkingMode = 'auto',
    maxChunkConcurrency = defaultMaxChunkConcurrency,
  }: {
    chunkByteCount?: number;
    chunkingMode?: TurboChunkingMode;
    maxChunkConcurrency?: number;
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
      Number.isNaN(chunkByteCount) ||
      !Number.isInteger(chunkByteCount) ||
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
      headers: chunkingHeader,
    });

    if (res.chunkSize !== this.chunkByteCount) {
      this.logger.warn('Chunk size mismatch! Overriding with server value.', {
        expected: this.chunkByteCount,
        actual: res.chunkSize,
      });
      this.chunkByteCount = res.chunkSize;
    }
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

    const emitter = new TurboEventEmitter(events);
    const { stream, resume } = createStreamWithUploadEvents({
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

    const inFlight = new Set<Promise<void>>();

    const internalAbort = new AbortController();
    const combinedSignal = combineAbortSignals([internalAbort.signal, signal]);

    const limit = pLimit(this.maxChunkConcurrency);
    let currentOffset = 0;
    let currentChunkPartNumber = 0;
    let uploadedBytes = 0;

    const chunks = splitIntoChunks(stream, this.chunkByteCount);

    resume();
    for await (const chunk of chunks) {
      if (combinedSignal?.aborted) {
        throw new CanceledError();
      }

      const chunkPartNumber = ++currentChunkPartNumber;
      const chunkByteCount = chunk.length;
      const chunkOffset = currentOffset;
      currentOffset += chunkByteCount;

      this.logger.debug('Queueing chunk', {
        chunkPartNumber,
        chunkOffset,
        chunkByteCount,
      });

      const promise = limit(async () => {
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
        throw err;
      });

      inFlight.add(promise);
      promise.finally(() => inFlight.delete(promise));

      // bounded backlog
      const maxQueued = this.maxChunkConcurrency * backlogQueueFactor;
      if (inFlight.size >= maxQueued) {
        await Promise.race(inFlight);
        if (combinedSignal?.aborted) {
          throw new CanceledError();
        }
      }
    }

    await Promise.all(inFlight);

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
        ...chunkingHeader,
      },
      signal: combinedSignal,
    });

    emitter.emit('upload-success');
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
  if (isReadableStream(source)) {
    yield* splitReadableStreamIntoChunks(source, chunkByteCount);
  } else {
    yield* splitReadableIntoChunks(source, chunkByteCount);
  }
}
export async function* splitReadableIntoChunks(
  source: Readable,
  chunkByteCount: number,
): AsyncGenerator<Buffer, void, unknown> {
  const queue: Uint8Array[] = [];
  let total = 0;

  for await (const piece of source) {
    queue.push(piece);
    total += piece.length;

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
        } else {
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
      const head = queue.shift();
      /* c8 ignore next -- this is a guard clause */
      if (!head) break;
      out.set(head, off);
      off += head.length;
    }
    yield Buffer.from(out.buffer, out.byteOffset, out.byteLength);
  }
}

export async function* splitReadableStreamIntoChunks(
  source: ReadableStream<Uint8Array>,
  chunkByteCount: number,
): AsyncGenerator<Buffer, void, unknown> {
  const reader = source.getReader();
  const queue: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      // Ensure we keep a plain view (avoids surprises if the producer reuses buffers)
      const u8 = new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength,
      );
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
          } else {
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
        const head = queue.shift();
        /* c8 ignore next -- this is a guard clause */
        if (!head) break;
        out.set(head, off);
        off += head.length;
      }
      yield Buffer.from(out.buffer, out.byteOffset, out.byteLength);
    }
  } finally {
    reader.releaseLock();
  }
}

function isReadableStream(
  source: unknown,
): source is ReadableStream<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (source as any).getReader === 'function';
}

type AbortSignalWithReason = AbortSignal & { reason?: unknown };
type AbortSignalStatic = typeof AbortSignal & {
  // Node 20+: static AbortSignal.any
  any?: (signals: readonly AbortSignal[]) => AbortSignal;
};

function combineAbortSignals(
  signals: readonly (AbortSignal | undefined)[],
): AbortSignal | undefined {
  const real = signals.filter(Boolean) as AbortSignal[];
  if (real.length === 0) return undefined;

  const anyFn = (AbortSignal as AbortSignalStatic).any;
  if (typeof anyFn === 'function') {
    return anyFn(real);
  }

  const controller = new AbortController();

  for (const s of real) {
    const sig = s as AbortSignalWithReason;
    if (sig.aborted) {
      controller.abort(sig.reason);
      break;
    }
    const onAbort = () => controller.abort(sig.reason);
    s.addEventListener('abort', onAbort, { once: true });
  }

  return controller.signal;
}
