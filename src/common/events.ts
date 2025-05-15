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
    if (typeof window !== 'undefined' && !(data instanceof Readable)) {
      return this.createEventingReadableStream(data, dataSize);
    }
    if (!(data instanceof ReadableStream)) {
      return this.createEventingReadable(data, dataSize);
    }
    throw new Error('Invalid data or platform type');
  }

  createEventingReadableStream(
    data: Buffer | ReadableStream,
    dataSize: number,
  ): ReadableStream {
    this.totalBytes = dataSize;
    // ReadableStream do not emit events, so we need to wrap it in a new ReadableStream with eventing in the hooks
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

    return new ReadableStream({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        this.uploadedBytes += value.length;
        this.emit('progress', {
          chunk: value,
          uploadedBytes: this.uploadedBytes,
          totalBytes: this.totalBytes,
        });
        controller.enqueue(value);
      },
      cancel(reason) {
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
