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
import { DataItem } from '@dha-team/arbundles/web';
import { EventEmitter } from 'eventemitter3';
import { Readable } from 'stream';

import {
  TurboUploadEmitter,
  TurboUploadEmitterEvent,
  TurboUploadEmitterEventName,
  TurboUploadEmitterParams,
  TurboUploadProgressEvent,
} from '../types.js';
import { isTurboUploadEmitter } from '../utils/common.js';

export class UploadEmitter
  extends EventEmitter<TurboUploadEmitterEventName>
  implements TurboUploadEmitter
{
  private uploadedBytes = 0;
  private totalBytes = 0;
  constructor(params?: TurboUploadEmitterParams) {
    super();
    if (params?.onProgress !== undefined) {
      this.on('progress', params.onProgress);
    }
  }

  static from(
    params?: TurboUploadEmitterParams | TurboUploadEmitter,
  ): TurboUploadEmitter {
    if (isTurboUploadEmitter(params)) return params;
    return new UploadEmitter(params);
  }

  // todo: create listener params type
  on(
    event: 'progress',
    listener: (ctx: TurboUploadProgressEvent) => void,
  ): this;
  on(
    event: TurboUploadEmitterEventName,
    listener: (ctx: TurboUploadEmitterEvent) => void,
  ): this {
    return super.on(event, listener);
  }

  emit(event: 'progress', ctx: TurboUploadProgressEvent): boolean;
  emit(
    event: TurboUploadEmitterEventName,
    ctx: TurboUploadEmitterEvent,
  ): boolean {
    return super.emit(event, ctx);
  }

  createEventingStream(
    data: Readable | Buffer | ReadableStream,
    dataSize: number,
  ): Readable | ReadableStream {
    if (data instanceof ReadableStream || data instanceof Buffer) {
      return this.createEventingReadableStream(data, dataSize);
    }

    // if (data instanceof Readable || data instanceof Buffer) {
    //   return this.createEventingReadable(data, dataSize);
    // }
    throw new Error('Invalid data or platform type');
  }

  createEventingReadableStream(
    data: Buffer | ReadableStream,
    dataSize: number,
  ): ReadableStream {
    this.totalBytes = dataSize;

    // For debugging: If it's a Buffer, we can store the original data
    const originalBuffer = data instanceof Buffer ? data : null;

    const originalStream =
      data instanceof ReadableStream
        ? data
        : new ReadableStream({
            start: (controller) => {
              controller.enqueue(data);
              controller.close();
            },
          });

    const reader = originalStream.getReader();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    // For debugging: Store chunks for comparison
    const outputChunks: Uint8Array[] = [];
    let totalOutputBytes = 0;

    return new ReadableStream({
      async start(controller) {
        try {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { value, done } = await reader.read();
            console.log('value', value, 'done', done);
            if (done) {
              // Debug: Compare final output with input
              if (originalBuffer) {
                const outputBuffer = Buffer.concat(outputChunks);
                console.log('Input length:', originalBuffer.length);
                console.log('Output length:', outputBuffer.length);
                console.log(
                  'Lengths match:',
                  originalBuffer.length === outputBuffer.length,
                );
                console.log(
                  'Content matches:',
                  originalBuffer.equals(new Uint8Array(outputBuffer)),
                );
              }
              controller.close();
              break;
            }
            const item = new DataItem(Buffer.from(value));
            console.log('item is valid', await item.isValid());
            self.uploadedBytes += value.length;
            self.emit('progress', {
              chunk: value,
              uploadedBytes: self.uploadedBytes,
              totalBytes: self.totalBytes,
            });

            // Debug: Log chunk details
            console.log('Chunk size:', value.length);
            console.log('Total bytes so far:', totalOutputBytes + value.length);

            // Store chunk for comparison
            outputChunks.push(value);
            totalOutputBytes += value.length;

            await new Promise<void>((resolve) => {
              controller.enqueue(value);
              resolve();
            });
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          const item = new DataItem(Buffer.concat(outputChunks));
          console.log('item is valid', await item.isValid());
          reader.releaseLock();
        }
      },
      cancel(reason) {
        console.log('Stream cancelled:', reason);
        return reader.cancel(reason);
      },
    });
  }

  createEventingReadable(data: Readable | Buffer, dataSize: number): Readable {
    this.totalBytes = dataSize;
    const stream = data instanceof Readable ? data : Readable.from(data);
    stream.on('data', (chunk) => {
      this.uploadedBytes += chunk.length;
      this.emit('progress', {
        chunk,
        uploadedBytes: this.uploadedBytes,
        totalBytes: this.totalBytes,
      });
    });
    return stream;
  }
}
