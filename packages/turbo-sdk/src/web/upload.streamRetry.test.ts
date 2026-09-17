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
import { afterEach, beforeEach, describe, it } from 'node:test';

import { testEthWallet } from '../../tests/helpers.js';
import { TurboFactory } from './index.js';

/*
  Issue #396: a browser upload failed with "The provided ReadableStream is
  disturbed".

  A fetch refuses a body stream that something already read or locked. The
  stub below enforces that rule the way Chrome does: undici's Request
  constructor throws on a disturbed or locked body. It fails the first
  attempt, so `uploadFile` has to retry, and a retry calls the caller's
  `fileStreamFactory` again and signs again.
*/
describe('web uploadFile retries with a streamed body', () => {
  const originalFetch = globalThis.fetch;
  const payload = new Uint8Array(4096).fill(7);
  let sentByteCounts: number[];
  let failuresLeft: number;

  beforeEach(() => {
    sentByteCounts = [];
    failuresLeft = 1;
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const request = new Request(input, init);
      sentByteCounts.push((await request.arrayBuffer()).byteLength);
      if (failuresLeft-- > 0) {
        return new Response('unavailable', { status: 503 });
      }
      return new Response(JSON.stringify({ id: 'stub-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const turbo = () =>
    TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'ethereum',
      uploadServiceConfig: {
        url: 'https://upload.example.com',
        retryConfig: {
          retries: 3,
          retryDelay: () => 0,
          onRetry: () => undefined,
        },
      },
    });

  const newStream = () =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload.slice());
        controller.close();
      },
    });

  const assertSentTwiceInFull = () => {
    assert.equal(sentByteCounts.length, 2);
    assert.equal(sentByteCounts[0], sentByteCounts[1]);
    assert.ok(sentByteCounts[0] > payload.byteLength);
  };

  it('sends the whole item again when uploadFile is given a File', async () => {
    const res = await turbo().uploadFile({
      file: new File([payload], 'a.bin'),
    });
    assert.equal(res.id, 'stub-id');
    assertSentTwiceInFull();
  });

  it('sends the whole item again when upload is given a Blob', async () => {
    const res = await turbo().upload({ data: new Blob([payload]) });
    assert.equal(res.id, 'stub-id');
    assertSentTwiceInFull();
  });

  it('sends the whole item again when the factory returns a new stream', async () => {
    const res = await turbo().uploadFile({
      fileStreamFactory: newStream,
      fileSizeFactory: () => payload.byteLength,
    });
    assert.equal(res.id, 'stub-id');
    assertSentTwiceInFull();
  });

  /*
    A factory that returns one stream instance works on the first attempt in
    the browser, because the web signer reads the stream once per attempt. The
    retry then gets a stream the first attempt already read. That surfaced as
    a bare "ReadableStream is locked" TypeError, and the reason the first
    attempt failed was lost.
  */
  it('names the factory, and the first failure, when it returns a used stream', async () => {
    const stream = newStream();
    await assert.rejects(
      turbo().uploadFile({
        fileStreamFactory: () => stream,
        fileSizeFactory: () => payload.byteLength,
      }),
      (error: Error) => {
        assert.match(error.message, /fileStreamFactory/);
        assert.match(error.message, /new stream on every call/);
        assert.match(error.message, /unavailable/);
        return true;
      },
    );
    assert.equal(sentByteCounts.length, 1, 'only the first attempt is sent');
  });

  // The same misuse on the very first attempt: nothing has failed yet, so the
  // message names the factory alone.
  it('names the factory when the first attempt is handed a locked stream', async () => {
    const stream = newStream();
    const reader = stream.getReader();

    await assert.rejects(
      turbo().uploadFile({
        fileStreamFactory: () => stream,
        fileSizeFactory: () => payload.byteLength,
      }),
      (error: Error) => {
        assert.match(error.message, /fileStreamFactory/);
        assert.match(error.message, /new stream on every call/);
        assert.doesNotMatch(error.message, /previous attempt/);
        assert.equal(error.cause, undefined);
        return true;
      },
    );
    assert.deepEqual(sentByteCounts, [], 'nothing is sent');
    reader.releaseLock();
  });
});
