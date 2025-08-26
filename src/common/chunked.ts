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
  TurboMultiPartStatusResponse,
  TurboUploadDataItemResponse,
  UploadSignedDataItemParams,
  validChunkingModes,
} from '../types.js';
import { FailedRequestError } from '../utils/errors.js';
import { TurboEventEmitter, createStreamWithUploadEvents } from './events.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

const fiveMiB = 5 * 1024 * 1024; // 5 MiB
const fiveHundredMiB = fiveMiB * 100; // 500 MiB
export const defaultMaxChunkConcurrency = 5;

export const maxChunkByteCount = fiveHundredMiB;
export const minChunkByteCount = fiveMiB;
export const defaultChunkByteCount = minChunkByteCount;

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

  public readonly shouldUseChunkUploader: boolean;
  private maxBacklogQueue: number;

  constructor({
    http,
    token,
    maxChunkConcurrency = defaultMaxChunkConcurrency,
    chunkByteCount = defaultChunkByteCount,
    logger = TurboWinstonLogger.default,
    chunkingMode = 'auto',
    dataItemByteCount,
  }: {
    http: TurboHTTPService;
    token: string;
    logger: TurboLogger;
    chunkByteCount?: number;
    maxChunkConcurrency?: number;
    chunkingMode?: TurboChunkingMode;
    dataItemByteCount: ByteCount;
  }) {
    this.chunkByteCount = chunkByteCount;
    this.maxChunkConcurrency = maxChunkConcurrency;
    this.http = http;
    this.token = token;
    this.logger = logger;
    this.assertChunkParams({
      chunkByteCount,
      chunkingMode,
      maxChunkConcurrency,
    });
    this.shouldUseChunkUploader = this.shouldChunkUpload({
      chunkByteCount,
      chunkingMode,
      dataItemByteCount,
    });
    this.maxBacklogQueue = this.maxChunkConcurrency * backlogQueueFactor;
  }

  private shouldChunkUpload({
    chunkByteCount,
    chunkingMode,
    dataItemByteCount,
  }: {
    chunkByteCount: ByteCount;
    chunkingMode: TurboChunkingMode;
    dataItemByteCount: ByteCount;
  }): boolean {
    if (chunkingMode === 'disabled') {
      return false;
    }
    if (chunkingMode === 'force') {
      return true;
    }

    const isMoreThanTwoChunksOfData = dataItemByteCount > chunkByteCount * 2;
    return isMoreThanTwoChunksOfData;
  }

  private assertChunkParams({
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
        clientExpected: this.chunkByteCount,
        serverReturned: res.chunkSize,
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

    let firstError: undefined | Error;
    let uploadedBytes = 0;

    const chunks = splitIntoChunks(stream, this.chunkByteCount);

    resume();
    for await (const chunk of chunks) {
      if (combinedSignal?.aborted) {
        internalAbort.abort();
        await Promise.allSettled(inFlight);
        firstError ??= new CanceledError();
        break;
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
          firstError ??= new CanceledError();
          break;
        }
      }
    }

    await Promise.all(inFlight);

    if (firstError !== undefined) {
      throw firstError;
    }

    const finalizeResponse = await this.finalizeUpload(
      uploadId,
      dataItemByteCount,
      dataItemOpts?.paidBy,
      combinedSignal,
    );

    emitter.emit('upload-success');
    return finalizeResponse;
  }

  private toGiB(bytes: ByteCount): ByteCount {
    return bytes / 1024 ** 3;
  }

  private async finalizeUpload(
    uploadId: string,
    dataItemByteCount: ByteCount,
    paidBy?: string | string[],
    signal?: AbortSignal,
  ): Promise<TurboUploadDataItemResponse> {
    // Wait up to 1 minute per GiB of data for the upload to finalize
    const fileSizeInGiB = Math.ceil(this.toGiB(dataItemByteCount));
    const maxWaitTime = fileSizeInGiB;

    const paidByHeader: Record<string, string> = {};
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

    this.logger.debug(
      `Confirming upload to Turbo with uploadId ${uploadId} for up to ${maxWaitTime} minutes.`,
    );

    const startTime = Date.now();
    const cutoffTime = startTime + maxWaitTime * 60 * 1000;
    let attemptCount = 0;

    while (Date.now() < cutoffTime) {
      if (signal?.aborted) {
        this.logger.warn(`Upload finalization aborted by signal.`);
        throw new CanceledError();
      }

      const response = await this.http.get<TurboMultiPartStatusResponse>({
        endpoint: `/chunks/${this.token}/${uploadId}/status`,
        signal,
      });

      if (response.status === 'FINALIZED') {
        this.logger.debug(`Upload finalized successfully.`);
        return response.receipt;
      }

      if (response.status === 'UNDERFUNDED') {
        throw new FailedRequestError(
          `Upload failed due to Insufficient Balance`,
        );
      }

      this.logger.debug(`Upload status: ${response.status}`);

      await new Promise((resolve) =>
        setTimeout(resolve, attemptCount++ * 2000),
      );
    }

    throw new Error(`Upload multi-part finalization has timed out.`);
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
  let encoder: TextEncoder | undefined;
  for await (const piece of source) {
    const u8 =
      piece instanceof Uint8Array
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
      const head = queue.shift() as Uint8Array; // safe due to loop condition
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
        const head = queue.shift() as Uint8Array; // safe due to loop condition
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
  // Prefer instanceof if available, otherwise use a safe duck-typing check
  if (
    typeof ReadableStream !== 'undefined' &&
    source instanceof ReadableStream
  ) {
    return true;
  }
  return (
    source !== null &&
    typeof source === 'object' &&
    'getReader' in source &&
    typeof (source as ReadableStream<Uint8Array>).getReader === 'function'
  );
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
