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
import { readableStreamToBuffer } from '../utils/readableStream.js';
import { TurboEventEmitter } from './events.js';
import { TurboHTTPService } from './http.js';

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
  batchSize?: number;
};

/**
 * Performs a chunked upload by splitting the stream into fixed-size buffers,
 * uploading them in parallel, and emitting progress/error events.
 */
export class ChunkedUploader {
  private readonly emitter = new TurboEventEmitter();
  private readonly chunkSize: number;
  private readonly batchSize: number;
  private readonly http: TurboHTTPService;
  private readonly token: string;
  private readonly logger: TurboLogger;

  constructor({
    http,
    token,
    batchSize,
    chunkSize,
    logger,
  }: ChunkedUploaderParams) {
    this.chunkSize = chunkSize ?? 5 * 1024 * 1024; // 5 MiB
    this.batchSize = batchSize ?? 5;
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
      batchSize: this.batchSize,
      inputStreamType:
        stream instanceof ReadableStream
          ? 'ReadableStream'
          : stream instanceof Readable
          ? 'Readable'
          : stream instanceof Buffer
          ? 'Buffer'
          : typeof stream,
    });

    if (stream instanceof ReadableStream) {
      // TODO: Dont do this, keep as stream for chunked upload
      stream = await readableStreamToBuffer({ stream, size });
    }

    // build your stream (from Buffer, or whatever):
    if (stream instanceof Buffer) {
      stream = Readable.from(stream, { highWaterMark: this.chunkSize });
    }

    // Validate stream
    if (!(stream instanceof Readable)) {
      throw new Error('Data item stream must be a Readable stream or Buffer');
    }

    // Validate size
    if (size <= 0) {
      throw new Error('Data item size must be greater than 0');
    }

    const limit = pLimit(this.batchSize);
    let offset = 0;
    let chunkId = 0;
    const tasks: Promise<any>[] = [];

    const chunks =
      stream.readableHighWaterMark === this.chunkSize
        ? stream
        : splitIntoChunks(stream, this.chunkSize);

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

    // Finalize and reconstruct server-side
    const finish = await this.http.post<TurboUploadDataItemResponse>({
      endpoint: `/chunks/${this.token}/${uploadId}/-1`,
      data: Buffer.alloc(0),
      headers: {
        'Content-Type': 'application/octet-stream',
        ...paidByHeader,
        ...this.chunkingVersionHeader,
      },
      signal,
    });

    return finish;
  }
}
/**
 * Yield Buffers of up to `chunkSize`, coalescing whatever small pieces
 * the source produces into proper slices.
 */
export async function* splitIntoChunks(
  source: Readable,
  chunkSize: number,
): AsyncGenerator<Buffer, void, unknown> {
  let acc = Buffer.alloc(0);

  for await (const piece of source) {
    const buf = piece;
    acc = Buffer.concat([acc, buf]);

    while (acc.length >= chunkSize) {
      yield acc.slice(0, chunkSize);
      acc = acc.slice(chunkSize);
    }
  }

  // final tail
  if (acc.length > 0) {
    yield acc;
  }
}
