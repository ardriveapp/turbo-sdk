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

import { testEthWallet } from '../../tests/helpers.js';
import { TurboFactory } from '../node/factory.js';
import { TurboAuthenticatedUploadService } from '../node/index.js';
import { ExistingBalanceFunding, X402Funding } from '../types.js';
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

describe('x402 with chunking disabled', () => {
  const originalFetch = globalThis.fetch;
  let requests: number;

  beforeEach(() => {
    requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return new Response(JSON.stringify({ id: 'stub-id', winc: '0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  /*
    Buffering the single request is only safe because anything larger chunks.
    Disabling chunking removes that guarantee, so an oversized item must be
    refused up front rather than pulled into memory and then rejected by the
    service for exceeding its single-item limit.
  */
  it('refuses an oversized item instead of buffering it', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });

    await assert.rejects(
      turbo.uploadFile({
        fileStreamFactory: () => Readable.from(Buffer.alloc(64)),
        fileSizeFactory: () => 200 * 1024 * 1024,
        chunkingMode: 'disabled',
        fundingMode: new X402Funding({ signer: {} as never }),
      }),
      /must be chunked/,
    );
    assert.equal(requests, 0, 'nothing should be sent');
  });

  /*
    The limit governs the SIGNED item, not the file. A file just under the cap
    still exceeds it once ANS-104 headers, the signature and the caller's tags
    are added — and the guard used to compare the raw size, so such a file was
    signed and buffered before the service refused it. That wastes the exact
    step the guard exists to skip.
  */
  it('refuses a file that only exceeds the cap once signed', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });

    await assert.rejects(
      turbo.uploadFile({
        fileStreamFactory: () => Readable.from(Buffer.alloc(64)),
        // Inside the cap by 100 bytes, outside it once signed.
        fileSizeFactory: () => 100 * 1024 * 1024 - 100,
        chunkingMode: 'disabled',
        fundingMode: new X402Funding({ signer: {} as never }),
      }),
      /must be chunked/,
    );
    assert.equal(requests, 0, 'nothing should be sent, and nothing signed');
  });

  it('leaves a normally-sized item alone', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });

    const res = await turbo.uploadFile({
      fileStreamFactory: () => Readable.from(Buffer.alloc(1024, 3)),
      fileSizeFactory: () => 1024,
      chunkingMode: 'disabled',
      fundingMode: new X402Funding({ signer: {} as never }),
    });
    assert.equal(res.id, 'stub-id');
  });
});

describe('x402 buffering of a web ReadableStream', () => {
  const originalFetch = globalThis.fetch;
  let sent: number[];

  beforeEach(() => {
    sent = [];
    globalThis.fetch = (async (_i: RequestInfo | URL, init?: RequestInit) => {
      const b = init?.body;
      if (b instanceof Uint8Array) sent.push(b.byteLength);
      else if (b instanceof Blob) sent.push(b.size);
      return new Response(JSON.stringify({ id: 'stub-id', winc: '0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const webStream = (payload: Buffer, chunkSize = 1024) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (let o = 0; o < payload.length; o += chunkSize) {
          controller.enqueue(
            new Uint8Array(payload.subarray(o, o + chunkSize)),
          );
        }
        controller.close();
      },
    });

  const service = () =>
    new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: Logger.default,
    });

  // The browser build hands a web ReadableStream rather than a Node Readable,
  // and it is drained by a different branch.
  it('buffers a multi-chunk web stream to exactly the declared size', async () => {
    const payload = Buffer.alloc(4096, 9);
    await service().uploadSignedDataItem({
      dataItemStreamFactory: () => webStream(payload) as never,
      dataItemSizeFactory: () => payload.byteLength,
      x402Options: { signer: {} as never },
    });
    assert.deepEqual(sent, [4096]);
  });

  it('rejects a web stream that overruns its declared size', async () => {
    await assert.rejects(
      service().uploadSignedDataItem({
        dataItemStreamFactory: () => webStream(Buffer.alloc(4096, 9)) as never,
        dataItemSizeFactory: () => 1024,
        x402Options: { signer: {} as never },
      }),
      /exceeded its declared size of 1024 bytes/,
    );
    assert.deepEqual(sent, [], 'nothing should be sent');
  });

  it('cancels a web stream when the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      service().uploadSignedDataItem({
        dataItemStreamFactory: () => webStream(Buffer.alloc(4096, 9)) as never,
        dataItemSizeFactory: () => 4096,
        signal: controller.signal,
        x402Options: { signer: {} as never },
      }),
      (e: Error) => /abort/i.test(e.name) || /abort/i.test(e.message),
    );
    assert.deepEqual(sent, []);
  });
});

/*
  The body is buffered before the request is sent, and the payment happens
  after that. A drained stream is therefore not a finished upload: reporting
  success there told an app the upload was done before the wallet prompt, and
  a request that then failed threw after success had already been reported.
*/
describe('x402 single-request upload events', () => {
  const originalFetch = globalThis.fetch;
  let seen: string[];
  let status: number;

  beforeEach(() => {
    seen = [];
    status = 200;
    globalThis.fetch = (async () => {
      seen.push('request');
      return status === 200
        ? new Response(JSON.stringify({ id: 'stub-id', winc: '0' }), {
            status,
            headers: { 'content-type': 'application/json' },
          })
        : new Response('bundler unavailable', { status });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const upload = () =>
    new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: Logger.default,
    }).uploadSignedDataItem({
      dataItemStreamFactory: () => Readable.from(Buffer.alloc(4096, 5)),
      dataItemSizeFactory: () => 4096,
      x402Options: { signer: {} as never },
      events: {
        onUploadProgress: ({ processedBytes, totalBytes }) =>
          seen.push(`progress ${processedBytes}/${totalBytes}`),
        onUploadSuccess: () => seen.push('upload-success'),
        onUploadError: () => seen.push('upload-error'),
      },
    });

  it('reports success only after the request has succeeded', async () => {
    await upload();
    // Progress still tracks the buffering, so it comes first.
    assert.deepEqual(seen, ['progress 4096/4096', 'request', 'upload-success']);
  });

  it('reports a failed request as an error, never as a success', async () => {
    status = 500;
    await assert.rejects(upload(), /bundler unavailable/);
    assert.deepEqual(seen, ['progress 4096/4096', 'request', 'upload-error']);
  });
});

/*
  Auto mode sends an item in one request when it fits in two chunks, and x402
  buffers that request. The cap on that buffer applied only with chunking
  disabled, so a large `chunkByteCount` let an x402 item of up to 1 GiB be
  pulled into memory. Over the cap, an x402 item now chunks.
*/
describe('x402 in auto mode with a large chunk size', () => {
  const originalFetch = globalThis.fetch;
  const cap = 100 * 1024 * 1024;
  let requestedUrls: string[];
  let streamOpened: boolean;

  beforeEach(() => {
    requestedUrls = [];
    streamOpened = false;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      // Stop at the paid create: which request comes first is the point.
      return url.includes('/-1/-1')
        ? new Response('stop here', { status: 400 })
        : new Response(JSON.stringify({ id: 'stub-id', winc: '0' }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Signing is stubbed: routing needs only the signed size, and an empty
  // stream shows whether anything tried to buffer the item.
  const uploadItemOf = (
    signedByteCount: number,
    fundingMode: X402Funding | ExistingBalanceFunding,
  ) =>
    new TurboAuthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: Logger.default,
      retryConfig: {
        retries: 1,
        retryDelay: () => 0,
        onRetry: () => undefined,
      },
      paymentService: {} as never,
      signer: {
        signer: { signatureType: 3 },
        getNativeAddress: async () => '0xrefund',
        signDataItem: async () => ({
          dataItemStreamFactory: () => {
            streamOpened = true;
            return Readable.from(Buffer.alloc(0));
          },
          dataItemSizeFactory: () => signedByteCount,
        }),
      } as never,
    }).uploadFile({
      fileStreamFactory: () => Readable.from(Buffer.alloc(0)),
      fileSizeFactory: () => signedByteCount,
      chunkByteCount: 500 * 1024 * 1024,
      fundingMode,
    });

  it('chunks an x402 item over the cap instead of buffering it', async () => {
    await assert.rejects(
      uploadItemOf(cap + 1, new X402Funding({ signer: {} as never })),
      /stop here/,
    );
    assert.equal(streamOpened, false, 'nothing should be buffered');
    assert.equal(requestedUrls.length, 1);
    assert.match(requestedUrls[0], /\/v1\/chunks\/base-usdc\/-1\/-1\?/);
  });

  it('still sends an x402 item at the cap in one request', async () => {
    // The empty stream fails the size check, which proves the item reached
    // the single-request buffer without allocating 100 MiB here.
    await assert.rejects(
      uploadItemOf(cap, new X402Funding({ signer: {} as never })),
      /produced 0 bytes, expected 104857600/,
    );
    assert.equal(streamOpened, true);
    assert.deepEqual(requestedUrls, []);
  });

  it('leaves a credit-funded item in one request', async () => {
    await uploadItemOf(cap + 1, new ExistingBalanceFunding());
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/tx/base-usdc',
    ]);
  });
});

/*
  Review of #500 found both of these: a settled x402 payment must not be
  undone by the caller's own event listener, and the size guard before signing
  works from an estimate, so the exact signed size still needs checking where
  there is no chunked path to fall back to.
*/
describe('x402 single-request safeguards', () => {
  const originalFetch = globalThis.fetch;
  let requests: number;

  beforeEach(() => {
    requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return new Response(JSON.stringify({ id: 'stub-id', winc: '0' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('keeps a settled payment settled when an upload-success listener throws', async () => {
    const service = new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: Logger.default,
    });
    const payload = Buffer.alloc(512, 3);

    const response = await service.uploadSignedDataItem({
      dataItemStreamFactory: () => Readable.from(payload),
      dataItemSizeFactory: () => payload.byteLength,
      x402Options: { signer: {} as never },
      events: {
        onUploadSuccess: () => {
          throw new Error('listener blew up');
        },
      },
    });

    assert.equal(response.id, 'stub-id');
    assert.equal(requests, 1, 'the request is not sent twice');
  });

  it('refuses an oversized signed item when chunking is disabled', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });
    const overTheCap = 100 * 1024 * 1024 + 1;
    // Signs to more than the cap while the payload stays under it, which is
    // what large tags do to the estimate the pre-signing guard uses.
    (
      turbo as unknown as {
        signer: { signDataItem: (p: unknown) => Promise<unknown> };
      }
    ).signer.signDataItem = async () => ({
      dataItemStreamFactory: () => Readable.from(Buffer.alloc(1024)),
      dataItemSizeFactory: () => overTheCap,
    });

    await assert.rejects(
      turbo.uploadFile({
        fileStreamFactory: () => Readable.from(Buffer.alloc(1024)),
        fileSizeFactory: () => 1024,
        chunkingMode: 'disabled',
        fundingMode: new X402Funding({}),
      }),
      (error: Error) => {
        assert.match(error.message, /signed x402 item is \d+ bytes/);
        return true;
      },
    );
    assert.equal(requests, 0, 'nothing was sent');
  });
});
