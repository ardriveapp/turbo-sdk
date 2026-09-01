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
import { TurboFactory } from '../node/factory.js';
import { X402Funding } from '../types.js';
import { ChunkedUploader } from './chunked.js';
import { TurboHTTPService } from './http.js';
import { Logger } from './logger.js';

/**
 * An x402-paid chunked upload is paid for AT CREATE, so "how many times did we
 * call create" is literally "how many times did the customer pay".
 *
 * `uploadFile` retries a failed upload up to 6 times and a retry re-enters
 * `upload()` on the SAME uploader instance. Before the fix below, a 12 MiB
 * upload whose finalization timed out opened a new paid upload on every retry
 * and billed five separate payments of 369,798 USDC base units for one
 * upload — caught only by watching a real Base Sepolia balance, because every
 * individual request was perfectly well-formed.
 */
describe('x402-paid chunked uploads', () => {
  const originalFetch = globalThis.fetch;
  let createRequests: string[];
  let nextId: number;

  beforeEach(() => {
    createRequests = [];
    nextId = 0;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/-1/-1')) {
        createRequests.push(url);
      }
      return new Response(JSON.stringify({ id: `upload-${nextId++}` }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const uploader = (x402: boolean) =>
    new ChunkedUploader({
      http: new TurboHTTPService({
        url: 'https://upload.example.com/v1',
        logger: Logger.default,
        retryConfig: {
          retries: 1,
          retryDelay: () => 0,
          onRetry: () => undefined,
        },
      }),
      token: 'base-usdc',
      logger: Logger.default,
      dataItemByteCount: 12 * 1024 * 1024,
      chunkingMode: 'force',
      ...(x402
        ? {
            x402: { signer: {} as never, unsignedData: false },
            x402RefundIdentity: { address: '0xabc', signatureType: 3 },
          }
        : {}),
    });

  // The private init is the payment boundary, so the invariant is asserted
  // there rather than through a fully-stubbed upload().
  const init = (u: ChunkedUploader) =>
    (u as unknown as { initUpload(): Promise<string> }).initUpload();

  it('pays once, no matter how many times a retry re-enters the upload', async () => {
    const u = uploader(true);

    const first = await init(u);
    const second = await init(u);
    const third = await init(u);

    assert.equal(
      createRequests.length,
      1,
      `expected exactly one paid create, got ${createRequests.length} — each one is a separate charge`,
    );
    assert.equal(
      second,
      first,
      'a retry must resume the upload already paid for',
    );
    assert.equal(third, first);
  });

  it('declares the real byte count and a refund identity when it pays', async () => {
    await init(uploader(true));

    const url = createRequests[0];
    assert.ok(
      url.includes(`totalBytes=${12 * 1024 * 1024}`),
      `create must declare the size being paid for: ${url}`,
    );
    assert.ok(
      url.includes('address=0xabc'),
      `create must name the refund wallet: ${url}`,
    );
    assert.ok(url.includes('signatureType=3'), url);
  });

  it('refuses to pay without a refund identity, rather than stranding the money', async () => {
    const u = new ChunkedUploader({
      http: new TurboHTTPService({
        url: 'https://upload.example.com/v1',
        logger: Logger.default,
        retryConfig: {
          retries: 1,
          retryDelay: () => 0,
          onRetry: () => undefined,
        },
      }),
      token: 'base-usdc',
      logger: Logger.default,
      dataItemByteCount: 12 * 1024 * 1024,
      chunkingMode: 'force',
      x402: { signer: {} as never, unsignedData: false },
    });

    await assert.rejects(() => init(u), /refund identity/);
    assert.equal(createRequests.length, 0, 'must not have paid');
  });

  // The memo is specific to the paid path; an unpaid upload has no reason to
  // reuse a stale id and every reason to get a fresh one.
  it('does not reuse the upload id when the upload is not paid for', async () => {
    const u = uploader(false);

    const first = await init(u);
    const second = await init(u);

    assert.equal(createRequests.length, 2);
    assert.notEqual(second, first);
  });
});

/**
 * The regression this whole path exists for: `uploadFile` used to refuse to
 * chunk an x402 upload at all. It skipped the chunked branch whenever the
 * funding mode was `X402Funding`, and threw outright on `chunkingMode:
 * 'force'` — so an x402 upload was capped at a single request no matter how
 * the caller configured chunking. Nothing asserted the routing, only the
 * uploader internals, so removing the exclusion could silently regress.
 */
describe('x402 upload routing', () => {
  const originalFetch = globalThis.fetch;
  let paths: string[];

  beforeEach(() => {
    paths = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      paths.push(new URL(url).pathname + new URL(url).search);
      const body = url.includes('/status')
        ? {
            status: 'FINALIZED',
            receipt: { id: 'data-item-id', owner: 'owner' },
          }
        : { id: 'upload-1' };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends an x402 upload through the chunked path instead of a single request', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });

    await turbo.upload({
      data: Buffer.alloc(64),
      fundingMode: new X402Funding({}),
      chunkingMode: 'force',
    });

    const createdChunkedUpload = paths.some((p) => p.includes('/-1/-1'));
    assert.ok(
      createdChunkedUpload,
      `an x402 upload with chunkingMode 'force' must open a chunked upload; requests were:\n${paths.join(
        '\n',
      )}`,
    );

    const create = paths.find((p) => p.includes('/-1/-1')) as string;
    assert.ok(
      create.includes('totalBytes='),
      `the chunked create must declare the size being paid for: ${create}`,
    );
  });
});
