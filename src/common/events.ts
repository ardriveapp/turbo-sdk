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
  TurboSigningEmitterEventArgs,
  TurboSigningEventsAndPayloads,
  TurboTotalEmitterEventArgs,
  TurboTotalEventsAndPayloads,
  TurboUploadEmitterEventArgs,
  TurboUploadEventsAndPayloads,
} from '../types.js';

/**
 * Creates an eventing ReadableStream that emits progress and error events using the event names map.
 *
 * E.g.
 *
 * ```ts
 * const eventNamesMap = {
 *   'on-progress': 'signing-progress', // emits 'signing-progress' on event progress
 *   'on-error': 'signing-error', // emits 'signing-error' errors
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
function createReadableStreamWithEvents({
  data,
  dataSize,
  emitter,
  eventNamesMap,
}: {
  data: Buffer | ReadableStream;
  dataSize: number;
  emitter: EventEmitter;
  eventNamesMap: {
    'on-progress': string;
    'on-error': string;
    'on-end': string;
  };
}): ReadableStream {
  const originalStream =
    data instanceof ReadableStream
      ? data
      : new ReadableStream({
          start: (controller) => {
            controller.enqueue(data);
            controller.close();
          },
        });

  let processedBytes = 0;
  let reader;
  return new ReadableStream({
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

        processedBytes += value.length;
        emitter.emit(eventNamesMap['on-progress'], {
          processedBytes,
          totalBytes: dataSize,
        });

        controller.enqueue(value);
      } catch (error) {
        emitter.emit(eventNamesMap['on-error'], error);
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}

/**
 * Creates an eventing Readable stream that emits progress and error events
 */
function createReadableWithEvents({
  data,
  dataSize,
  emitter,
  eventNamesMap,
}: {
  data: Readable | Buffer;
  dataSize: number;
  emitter: EventEmitter;
  eventNamesMap: {
    'on-progress': string;
    'on-error': string;
    'on-end': string;
  };
}): Readable {
  const existingStream = data instanceof Readable ? data : Readable.from(data);
  const eventingStream = new PassThrough();

  // pause the stream to avoid emitting progress events until the stream is ready
  existingStream.pause();

  // add listener to emit progress events as the stream is read
  let processedBytes = 0;
  existingStream.on('data', (chunk) => {
    eventingStream.write(chunk);
    processedBytes += chunk.length;
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

  // resume the stream to start emitting progress events
  existingStream.resume();
  return eventingStream;
}

/**
 * Creates an eventing stream from the input data that emits progress and error events
 */
export function createStreamWithEvents({
  data,
  dataSize,
  emitter,
  eventNamesMap,
}: {
  data: Readable | Buffer | ReadableStream;
  dataSize: number;
  emitter: EventEmitter;
  eventNamesMap: {
    'on-progress': string;
    'on-error': string;
    'on-end': string;
  };
}): Readable | ReadableStream {
  if (
    data instanceof ReadableStream ||
    (typeof window !== 'undefined' && data instanceof Buffer)
  ) {
    return createReadableStreamWithEvents({
      data,
      dataSize,
      emitter,
      eventNamesMap,
    });
  }

  if (data instanceof Readable || data instanceof Buffer) {
    return createReadableWithEvents({
      data,
      dataSize,
      emitter,
      eventNamesMap,
    });
  }

  throw new Error('Invalid data or platform type');
}

// base class that extends EventEmitter with custom types for events and payloads
export abstract class TurboEmitter<
  T extends Record<string, unknown>,
> extends EventEmitter<Extract<keyof T, string>> {
  override on<K extends keyof T>(
    event: K,
    listener: (...args: any[]) => void,
  ): this {
    // @ts-expect-error - TODO: eventemitter3 has strict types
    return super.on(event, listener);
  }

  override emit<K extends keyof T>(event: K, ...args: any[]): boolean {
    // @ts-expect-error - TODO: eventemitter3 has strict types
    return super.emit(event, ...args);
  }
}

export type TurboEventEmitterEvents = TurboUploadEventsAndPayloads &
  TurboSigningEventsAndPayloads &
  TurboTotalEventsAndPayloads;
export type TurboEventEmitterEventArgs = TurboUploadEmitterEventArgs &
  TurboSigningEmitterEventArgs &
  TurboTotalEmitterEventArgs;

export class TurboEventEmitter extends TurboEmitter<TurboEventEmitterEvents> {
  constructor({
    onProgress,
    onError,
    onSuccess,
    onUploadProgress,
    onUploadError,
    onUploadSuccess,
    onSigningProgress,
    onSigningError,
    onSigningSuccess,
  }: TurboEventEmitterEventArgs = {}) {
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
    this.on('signing-error', (event) => {
      this.emit('overall-error', {
        ...event,
        step: 'signing',
      });
    });
    this.on('upload-progress', (event) => {
      this.emit('overall-progress', {
        ...event,
        processedBytes: event.totalBytes / 2 + event.processedBytes / 2, // Start at 50% since signing is done, then add half of upload progress
        totalBytes: event.totalBytes,
        step: 'upload',
      });
    });
    this.on('upload-error', (event) => {
      this.emit('overall-error', {
        ...event,
        step: 'upload',
      });
    });
  }
  override on<K extends keyof TurboEventEmitterEvents>(
    event: K,
    listener: (...args: any[]) => void,
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof TurboEventEmitterEvents>(
    event: K,
    ...args: any[]
  ): boolean {
    return super.emit(event, ...args);
  }
}

// TODO: any other emitters we want to add (e.g. upload file, total events, etc)
export function createStreamWithUploadEvents({
  data,
  dataSize,
  emitter = new TurboEventEmitter(),
}: {
  data: Readable | Buffer | ReadableStream;
  dataSize: number;
  emitter?: TurboEventEmitter;
}) {
  return createStreamWithEvents({
    data,
    dataSize,
    // @ts-expect-error TODO: fix this type issue
    emitter,
    eventNamesMap: {
      'on-progress': 'upload-progress',
      'on-error': 'upload-error',
      'on-end': 'upload-success',
    },
  });
}

export function createStreamWithSigningEvents({
  data,
  dataSize,
  emitter = new TurboEventEmitter(),
}: {
  data: Readable | Buffer | ReadableStream;
  dataSize: number;
  emitter?: TurboEventEmitter;
}): Readable | ReadableStream {
  return createStreamWithEvents({
    data,
    dataSize,
    // @ts-expect-error TODO: fix this type issue
    emitter,
    eventNamesMap: {
      'on-progress': 'signing-progress',
      'on-error': 'signing-error',
      'on-end': 'signing-success',
    },
  });
}
