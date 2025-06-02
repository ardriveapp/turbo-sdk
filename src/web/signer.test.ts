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
import { ArweaveSigner, DataItem } from '@dha-team/arbundles/node';
import Arweave from 'arweave';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { readableStreamToBuffer } from '../utils/readableStream.js';
import {
  readableStreamToAsyncIterable,
  streamSignerReadableStream,
} from './signer.js';

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});

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

describe('streamSignerReadableStream', () => {
  it('should sign a data item from a ReadableStream', async () => {
    const testData = new Uint8Array([1, 2, 3, 4, 5]);
    const testStream = new ReadableStream({
      start(controller) {
        controller.enqueue(testData);
        controller.close();
      },
    });

    const wallet = await arweave.wallets.generate();
    const signer = new ArweaveSigner(wallet);

    const { signedDataItemFactory, signedDataItemSize } =
      await streamSignerReadableStream({
        streamFactory: () => testStream,
        signer,
        fileSize: testData.length,
      });

    const signedDataItemBuffer = await readableStreamToBuffer({
      stream: signedDataItemFactory(),
      size: signedDataItemSize,
    });

    const signedDataItem = new DataItem(signedDataItemBuffer);

    assert.equal(await signedDataItem.isValid(), true);
  });
});
