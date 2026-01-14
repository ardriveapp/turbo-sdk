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
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

import {
  bufferToReadableStream,
  createUint8ArrayReadableStreamFactory,
  ensureChunkedStream,
  readableStreamToBuffer,
  readableToReadableStream,
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
    let chunkByteCount = 0;
    const validationStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
        }
        if (!chunkByteCount) {
          chunkByteCount = value?.byteLength ?? 0;
        }

        controller.enqueue(value);
      },
    });

    const buffer = await readableStreamToBuffer({
      stream: validationStream,
      size: data.length,
    });

    assert.equal(chunkByteCount, 1, 'Expected one byte chunks');
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

describe('bufferToReadableStream', () => {
  it('should convert a Buffer to a ReadableStream', async () => {
    const data = Buffer.from('hello world');
    const stream = bufferToReadableStream(data);

    assert(stream instanceof ReadableStream, 'Expected ReadableStream');

    const buffer = await readableStreamToBuffer({
      stream,
      size: data.length,
    });

    assert.equal(buffer.toString(), data.toString());
  });

  it('should convert a Uint8Array to a ReadableStream', async () => {
    const data = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
    const stream = bufferToReadableStream(data);

    assert(stream instanceof ReadableStream, 'Expected ReadableStream');

    const buffer = await readableStreamToBuffer({
      stream,
      size: data.length,
    });

    assert.equal(buffer.toString(), Buffer.from(data).toString());
  });

  it('should create a single-chunk stream', async () => {
    const data = Buffer.from('test data');
    const stream = bufferToReadableStream(data);
    const reader = stream.getReader();

    const { value, done } = await reader.read();
    assert(!done, 'Should not be done after first read');
    assert(value instanceof Uint8Array, 'Value should be Uint8Array');
    assert.equal(value.length, data.length, 'Value length should match');
    assert.equal(
      Buffer.from(value).toString(),
      data.toString(),
      'Content should match',
    );

    const { done: secondDone } = await reader.read();
    assert(secondDone, 'Should be done after second read');
  });
});

describe('readableToReadableStream', () => {
  it('should convert a Node.js Readable to a ReadableStream', async () => {
    const data = Buffer.from('hello world');
    const readable = Readable.from([data]);
    const stream = readableToReadableStream(readable);

    assert(stream instanceof ReadableStream, 'Expected ReadableStream');

    const buffer = await readableStreamToBuffer({
      stream,
      size: data.length,
    });

    assert.equal(buffer.toString(), data.toString());
  });

  it('should handle multiple chunks', async () => {
    const chunks = [
      Buffer.from('hello'),
      Buffer.from(' '),
      Buffer.from('world'),
    ];
    const readable = Readable.from(chunks);
    const stream = readableToReadableStream(readable);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const buffer = await readableStreamToBuffer({
      stream,
      size: totalSize,
    });

    assert.equal(buffer.toString(), 'hello world');
  });

  it('should handle mixed chunk types', async () => {
    const chunks = [
      Buffer.from('buffer'),
      new Uint8Array([32]), // space
      'string',
    ];
    const readable = Readable.from(chunks);
    const stream = readableToReadableStream(readable);

    // Read all chunks
    const reader = stream.getReader();
    const result: any[] = [];

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      result.push(value);
    }

    assert.equal(result.length, 3, 'Expected 3 chunks');
    assert(
      result[0] instanceof Uint8Array,
      'First chunk should be Uint8Array (from Buffer)',
    );
    assert(
      result[1] instanceof Uint8Array,
      'Second chunk should be Uint8Array',
    );
    assert.equal(
      typeof result[2],
      'string',
      'Third chunk should remain a string',
    );

    // Convert all to buffers for comparison
    const buffers = result.map((chunk) =>
      chunk instanceof Uint8Array ? Buffer.from(chunk) : Buffer.from(chunk),
    );
    assert.equal(
      Buffer.concat(buffers).toString(),
      'buffer string',
      'Combined result should match input',
    );
  });

  it('should handle empty readable stream', async () => {
    const readable = Readable.from([]);
    const stream = readableToReadableStream(readable);
    const reader = stream.getReader();

    const { done } = await reader.read();
    assert(done, 'Should be done immediately for empty stream');
  });
});
