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
import {
  ArweaveSigner,
  DataItem,
  EthereumSigner,
  HexSolanaSigner,
} from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testEthWallet, testJwk, testSolWallet } from '../../tests/helpers.js';
import { TurboEventEmitter } from '../common/events.js';
import {
  readableStreamToAsyncIterable,
  streamSignerReadableStream,
} from './signer.js';

describe('readableStreamToAsyncIterable', () => {
  it('should convert a ReadableStream to an AsyncIterable', async () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const testStream = new ReadableStream({
      start(controller) {
        controller.enqueue(testData);
        controller.close();
      },
    });

    const asyncIterable = readableStreamToAsyncIterable(testStream);
    const chunks: Buffer[] = [];

    for await (const chunk of asyncIterable) {
      chunks.push(chunk);
    }

    assert.equal(chunks.length, 1);
    assert.deepEqual(chunks[0], Buffer.from(testData));
  });
});

describe('streamSignerReadableStream', async () => {
  const testData = 'test data for stream signing';
  const encoder = new TextEncoder();
  const testBuffer = encoder.encode(testData);

  function createTestStream(data: Uint8Array): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });
  }

  async function streamToBuffer(
    stream: ReadableStream<Uint8Array>,
  ): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return Buffer.from(result);
  }

  it('should return matching size for the data item stream', async () => {
    const signer = new ArweaveSigner(testJwk);
    const inputStream = createTestStream(testBuffer);

    const { signedDataItemFactory, signedDataItemSize } =
      await streamSignerReadableStream({
        streamFactory: () => inputStream,
        signer,
        fileSize: testBuffer.length,
        dataItemOpts: {},
      });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
    assert.equal(signedDataItemSize, signedBuffer.length);
  });

  it('should sign a ReadableStream with ArweaveSigner and return a valid signed stream', async () => {
    const signer = new ArweaveSigner(testJwk);
    const inputStream = createTestStream(testBuffer);

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => inputStream,
      signer,
      fileSize: testBuffer.length,
      dataItemOpts: {},
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
  });

  it('should sign a ReadableStream with EthereumSigner and return a valid signed stream', async () => {
    const signer = new EthereumSigner(testEthWallet);
    const inputStream = createTestStream(testBuffer);

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => inputStream,
      signer,
      fileSize: testBuffer.length,
      dataItemOpts: {},
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
  });

  it('should sign a ReadableStream with HexSolanaSigner and return a valid signed stream', async () => {
    const signer = new HexSolanaSigner(testSolWallet);
    const inputStream = createTestStream(testBuffer);

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => inputStream,
      signer,
      fileSize: testBuffer.length,
      dataItemOpts: {},
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
  });

  it('should sign a ReadableStream with custom DataItemCreateOptions', async () => {
    const signer = new ArweaveSigner(testJwk);
    const inputStream = createTestStream(testBuffer);
    const customOptions = {
      tags: [{ name: 'Content-Type', value: 'text/plain' }],
      target: '43-character-stub-arweave-address-000000000',
    };

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => inputStream,
      signer,
      fileSize: testBuffer.length,
      dataItemOpts: customOptions,
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    assert.ok(signedBuffer instanceof Buffer);
    assert.ok(signedBuffer.length > testBuffer.length);

    // The signed stream should contain the original data
    const originalDataIndex = signedBuffer.indexOf(testBuffer);
    assert.ok(originalDataIndex > -1);
  });

  it('should handle empty stream input', async () => {
    const signer = new ArweaveSigner(testJwk);
    const emptyStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => emptyStream,
      signer,
      fileSize: 0,
      dataItemOpts: {},
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
  });

  it('should handle large stream input', async () => {
    const signer = new ArweaveSigner(testJwk);
    const largeData = new Uint8Array(1024 * 1024 * 51); // 51MB ~ ideally this tests metamask limits but because its not injected we can't
    largeData.fill(65); // Fill with 'A' characters

    const largeStream = createTestStream(largeData);

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => largeStream,
      signer,
      fileSize: largeData.length,
      dataItemOpts: {},
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
  });

  it('should produce different signatures for different data', async () => {
    const signer = new ArweaveSigner(testJwk);
    const data1 = encoder.encode('first test data');
    const data2 = encoder.encode('second test data');

    const stream1 = createTestStream(data1);
    const stream2 = createTestStream(data2);

    const [signedDataItemFactory1, signedDataItemFactory2] = await Promise.all([
      streamSignerReadableStream({
        streamFactory: () => stream1,
        signer,
        fileSize: data1.length,
        dataItemOpts: {},
      }),
      streamSignerReadableStream({
        streamFactory: () => stream2,
        signer,
        fileSize: data2.length,
        dataItemOpts: {},
      }),
    ]);

    const [buffer1, buffer2] = await Promise.all([
      streamToBuffer(signedDataItemFactory1.signedDataItemFactory()),
      streamToBuffer(signedDataItemFactory2.signedDataItemFactory()),
    ]);

    assert.notDeepEqual(buffer1, buffer2);
    assert.ok(buffer1.indexOf(data1) > -1);
    assert.ok(buffer2.indexOf(data2) > -1);
  });

  it('should work with chunked stream input', async () => {
    const signer = new ArweaveSigner(testJwk);
    const chunks = [
      encoder.encode('chunk1'),
      encoder.encode('chunk2'),
      encoder.encode('chunk3'),
    ];

    const chunkedStream = new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    });

    const { signedDataItemFactory } = await streamSignerReadableStream({
      streamFactory: () => chunkedStream,
      signer,
      fileSize: chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      dataItemOpts: {},
    });
    const signedBuffer = await streamToBuffer(signedDataItemFactory());

    const isValidDataItem = await DataItem.verify(signedBuffer);
    assert.ok(isValidDataItem);
  });

  it('should emit all progress events and success event', async () => {
    const signer = new ArweaveSigner(testJwk);
    const inputStream = createTestStream(testBuffer);

    const emitter = new TurboEventEmitter();

    let signingProgress = 0;
    let totalSigningBytes = 0;
    let success = false;

    emitter.on('signing-progress', ({ processedBytes, totalBytes }) => {
      signingProgress = processedBytes;
      totalSigningBytes = totalBytes;
    });

    emitter.on('signing-success', () => {
      success = true;
    });

    await streamSignerReadableStream({
      streamFactory: () => inputStream,
      signer,
      fileSize: testBuffer.length,
      dataItemOpts: {},
      emitter,
    });

    assert.equal(
      signingProgress,
      totalSigningBytes,
      'Expected signing progress to match total signing bytes',
    );
    assert.ok(success);
  });

  it('should emit error event if signing fails', async () => {
    const signer = new ArweaveSigner(testJwk);
    signer.sign = () => {
      throw new Error('Signing failed');
    };
    const inputStream = createTestStream(testBuffer);

    const emitter = new TurboEventEmitter();

    let error = undefined;
    let success = false;

    emitter.on('signing-error', (e) => {
      error = e;
    });
    emitter.on('signing-success', () => {
      success = true;
    });

    await streamSignerReadableStream({
      streamFactory: () => inputStream,
      signer,
      fileSize: testBuffer.length,
      dataItemOpts: {},
      emitter,
    }).catch(() => void 0);

    assert.ok(error, 'Expected error to be defined');
    assert.ok(!success, 'Expected success to be false');
  });
});
