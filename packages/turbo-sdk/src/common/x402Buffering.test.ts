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
import { afterEach, beforeEach, describe, it } from 'node:test';

import { TurboUnauthenticatedUploadService } from './index.js';
import { Logger } from './logger.js';

/*
  The single-request x402 path buffers its body.

  It has to: `content-length` is a forbidden fetch header, so a streamed body
  goes out chunked with no length, the service cannot price it, and the
  protocol's paid retry has a spent stream to replay. Buffering declares the
  length and makes the body re-sendable.
*/
describe('x402 single-request buffering', () => {
  const originalFetch = globalThis.fetch;
  let sentBodyLengths: number[];

  beforeEach(() => {
    sentBodyLengths = [];
    globalThis.fetch = (async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const body = init?.body ?? (_input as Request)?.body;
      if (body instanceof Uint8Array) sentBodyLengths.push(body.byteLength);
      else if (body instanceof Blob) sentBodyLengths.push(body.size);
      return new Response(JSON.stringify({ id: 'stub-id', winc: '0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const service = () =>
    new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: Logger.default,
    });

  const upload = (
    payload: Buffer,
    declaredSize: number,
    signal?: AbortSignal,
  ) =>
    service().uploadSignedDataItem({
      dataItemStreamFactory: () => Readable.from(payload),
      dataItemSizeFactory: () => declaredSize,
      signal,
      x402Options: { signer: {} as never },
    });

  it('sends a measurable body of exactly the declared size', async () => {
    const payload = Buffer.alloc(4096, 7);
    await upload(payload, payload.byteLength);
    // A buffered body: fetch can set Content-Length from it.
    assert.deepEqual(sentBodyLengths, [4096]);
  });

  it('rejects a stream that overruns its declared size', async () => {
    // Caught while filling, not after the whole overrun is in memory.
    await assert.rejects(
      upload(Buffer.alloc(4096, 7), 1024),
      /exceeded its declared size of 1024 bytes/,
    );
  });

  it('rejects a stream that under-runs its declared size', async () => {
    await assert.rejects(
      upload(Buffer.alloc(512, 7), 4096),
      /produced 512 bytes, expected 4096/,
    );
  });

  it('refuses to buffer, or pay, once the caller has aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      upload(Buffer.alloc(4096, 7), 4096, controller.signal),
      (e: Error) => /abort/i.test(e.name) || /abort/i.test(e.message),
    );
    // Nothing was sent, so nothing could have been paid for.
    assert.deepEqual(sentBodyLengths, []);
  });
});
