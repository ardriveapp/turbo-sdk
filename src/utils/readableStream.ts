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
export async function readableStreamToBuffer({
  stream,
  size,
}: {
  stream: ReadableStream;
  size: number;
}): Promise<Buffer> {
  const reader = stream.getReader();
  const buffer = Buffer.alloc(size);
  let offset = 0;

  let done = false;
  while (!done) {
    const { done: streamDone, value } = await reader.read();
    done = streamDone;
    if (!done) {
      buffer.set(value, offset);
      offset += value.byteLength;
    }
  }
  return buffer;
}

export function createUint8ArrayReadableStreamFactory(
  data:
    | string
    | Uint8Array
    | ArrayBuffer
    | Buffer
    | SharedArrayBuffer
    | Blob
    | ReadableStream,
): () => ReadableStream<Uint8Array> {
  // Blob streams are already ReadableStream<Uint8Array>
  if (data instanceof Blob) {
    return () => data.stream();
  }
  // We need to handle the case where the data is a ReadableStream that is not a Uint8Array
  // This is to ensure downstream code can handle the data as a Uint8Array
  if (data instanceof ReadableStream) {
    return () => {
      const reader = data.getReader();
      return new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { value, done } = await reader.read();
          if (done) {
            controller.close();
            return;
          }

          if (ArrayBuffer.isView(value)) {
            // specifying offset and length is required to ensure chunks remain within their slice of the buffer
            controller.enqueue(
              new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
            );
          } else if (
            value instanceof ArrayBuffer ||
            value instanceof SharedArrayBuffer
          ) {
            controller.enqueue(new Uint8Array(value));
          } else {
            throw new TypeError('Unsupported chunk type in ReadableStream');
          }
        },
      });
    };
  }

  return () => {
    let uint8: Uint8Array;
    if (typeof data === 'string') {
      uint8 = new TextEncoder().encode(data);
    } else if (ArrayBuffer.isView(data)) {
      // In theory we could use the view directly, but that might allow other typed arrays like BigInt64Array to be used which could behave unexpectedly downstream
      // specifying offset and length is required to ensure chunks remain within their slice of the buffer
      uint8 = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (
      data instanceof ArrayBuffer ||
      data instanceof SharedArrayBuffer
    ) {
      uint8 = new Uint8Array(data);
    } else {
      throw new TypeError(
        'Unsupported input type for createBufferReadableStream',
      );
    }
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(uint8);
        controller.close();
      },
    });
  };
}
