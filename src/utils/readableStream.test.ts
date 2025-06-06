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
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  createUint8ArrayReadableStreamFactory,
  ensureChunkedStream,
  readableStreamToBuffer,
} from './readableStream.js';

describe('readableStreamToBuffer', () => {
  it('should convert a readable stream to a buffer', async () => {
    const data = new Uint8Array([1, 2, 3]);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const buffer = await readableStreamToBuffer({
      stream,
      size: data.length,
    });
    assert.equal(buffer.toString(), Buffer.from(data).toString());
  });
});

describe('createUint8ArrayReadableStreamFactory', () => {
  it('should convert a string to a readable stream', async () => {
    const data = 'hello world';
    const streamFactory = createUint8ArrayReadableStreamFactory({
      data,
    });
    const buffer = await readableStreamToBuffer({
      stream: streamFactory(),
      size: data.length,
    });
    assert.equal(buffer.toString(), Buffer.from(data).toString());
  });

  it('should convert a Uint8Array to a readable stream', async () => {
    const data = new Uint8Array([
      104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100,
    ]);
    const streamFactory = createUint8ArrayReadableStreamFactory({ data });
    const buffer = await readableStreamToBuffer({
      stream: streamFactory(),
      size: data.length,
    });
    assert.equal(buffer.toString(), Buffer.from(data).toString());
  });

  it('should convert a Blob to a readable stream', async () => {
    const data = new Blob([
      new Uint8Array([104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100]),
    ]);
    const dataArrayBuffer = await data.arrayBuffer();
    const streamFactory = createUint8ArrayReadableStreamFactory({ data });
    const buffer = await readableStreamToBuffer({
      stream: streamFactory(),
      size: dataArrayBuffer.byteLength,
    });

    assert.equal(buffer.toString(), Buffer.from(dataArrayBuffer).toString());
  });

  it('should convert an ArrayBuffer to a ReadableStream<Uint8Array>', async () => {
    const data = new Uint8Array([
      104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100,
    ]);
    const streamFactory = createUint8ArrayReadableStreamFactory({
      data: data.buffer,
    });
    const buffer = await readableStreamToBuffer({
      stream: streamFactory(),
      size: data.length,
    });

    assert.equal(buffer.toString(), Buffer.from(data).toString());
  });

  it('should convert a ReadableStream to a readable stream', async () => {
    const data = new Uint8Array([
      104, 101, 108, 108, 111, 32, 119, 111, 114, 108, 100,
    ]);
    const streamFactory = createUint8ArrayReadableStreamFactory({ data });
    const stream = streamFactory();
    assert(
      stream instanceof ReadableStream,
      'Expected stream to be a ReadableStream',
    );
    const buffer = await readableStreamToBuffer({
      stream,
      size: data.length,
    });

    assert.equal(buffer.toString(), Buffer.from(data).toString());
  });
});

describe('ensureChunkedStream', () => {
  it('should chunk a stream with target size', async () => {
    const data = new Uint8Array(1000);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
    const chunkedStream = ensureChunkedStream(stream, 1); // 1 byte chunks

    assert(
      chunkedStream instanceof ReadableStream,
      'Expected chunked stream to be a ReadableStream',
    );

    const reader = chunkedStream.getReader();
    let chunkSize = 0;
    const validationStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
        }
        if (!chunkSize) {
          chunkSize = value?.byteLength ?? 0;
        }

        controller.enqueue(value);
      },
    });

    const buffer = await readableStreamToBuffer({
      stream: validationStream,
      size: data.length,
    });

    assert.equal(chunkSize, 1, 'Expected one byte chunks');
    assert.equal(buffer.length, data.length, 'Expected full buffer');
    assert.equal(
      buffer.toString(),
      Buffer.from(data).toString(),
      'Expected matching buffer',
    );
  });

  it('should throw if the stream is not a Uint8Array', async () => {
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('hello world');
        controller.close();
      },
    });
    const chunkedStream = ensureChunkedStream(stream as ReadableStream);

    let error = undefined;
    try {
      const reader = chunkedStream.getReader();
      await reader.read();
    } catch (e) {
      error = e;
    }

    assert(error, 'Expected error when reading from stream');
  });
});
