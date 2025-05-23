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
import { PassThrough, Readable } from 'stream';

import {
  TurboUploadEmitter,
  TurboUploadEmitterEventArgs,
  TurboUploadEventsAndPayloads,
} from '../types.js';

export class UploadEmitter
  extends EventEmitter<keyof TurboUploadEventsAndPayloads>
  implements TurboUploadEmitter
{
  constructor({ onUploadProgress }: TurboUploadEmitterEventArgs = {}) {
    super();
    if (onUploadProgress !== undefined) {
      this.on('upload-progress', onUploadProgress);
    }
  }

  on(
    event: keyof TurboUploadEventsAndPayloads,
    listener: (
      ctx: TurboUploadEventsAndPayloads[keyof TurboUploadEventsAndPayloads],
    ) => void,
  ): this {
    return super.on(event, listener);
  }

  emit(
    event: keyof TurboUploadEventsAndPayloads,
    ctx: TurboUploadEventsAndPayloads[keyof TurboUploadEventsAndPayloads],
  ): boolean {
    return super.emit(event, ctx);
  }

  createEventingStream({
    data,
    dataSize,
  }: {
    data: Readable | Buffer | ReadableStream;
    dataSize: number;
  }): Readable | ReadableStream {
    if (
      data instanceof ReadableStream ||
      (typeof window !== 'undefined' && data instanceof Buffer)
    ) {
      return this.createEventingReadableStream(data, dataSize);
    }

    if (data instanceof Readable || data instanceof Buffer) {
      return this.createEventingReadable(data, dataSize);
    }

    throw new Error('Invalid data or platform type');
  }

  private createEventingReadableStream(
    data: Buffer | ReadableStream,
    dataSize: number,
  ): ReadableStream {
    const originalStream =
      data instanceof ReadableStream
        ? data
        : new ReadableStream({
            start: (controller) => {
              controller.enqueue(data);
              controller.close();
            },
          });

    let uploadedBytes = 0;
    let reader;
    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    return new ReadableStream({
      start() {
        reader = originalStream.getReader();
      },
      async pull(controller) {
        try {
          const { value, done } = await reader.read();

          if (done) {
            controller.close();
            return;
          }

          uploadedBytes += value.length;
          self.emit('upload-progress', {
            uploadedBytes: uploadedBytes,
            totalBytes: dataSize,
          });

          controller.enqueue(value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
  }

  private createEventingReadable(
    data: Readable | Buffer,
    dataSize: number,
  ): Readable {
    const existingStream =
      data instanceof Readable ? data : Readable.from(data);
    const uploadStream = new PassThrough();

    // pause the stream to avoid emitting progress events until the stream is ready
    existingStream.pause();

    // add listener to emit progress events as the stream is read
    let uploadedBytes = 0;
    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    existingStream.on('data', (chunk) => {
      uploadStream.write(chunk);
      uploadedBytes += chunk.length;
      self.emit('upload-progress', {
        uploadedBytes,
        totalBytes: dataSize,
      });
    });

    existingStream.on('end', () => {
      uploadStream.end();
    });

    existingStream.on('error', (error) => {
      uploadStream.destroy(error);
    });

    // resume the stream to start emitting progress events
    existingStream.resume();
    return uploadStream;
  }
}
