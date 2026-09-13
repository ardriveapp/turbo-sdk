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

import { TurboFactory } from '../node/factory.js';
import { TurboLogger } from '../types.js';
import { X402Funding } from '../types.js';
import { ChunkedUploader } from './chunked.js';
import { TurboHTTPService } from './http.js';

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  setLogLevel: () => undefined,
  setLogFormat: () => undefined,
} as unknown as TurboLogger;

/**
 * An HTTP service that answers the paid-create call and counts how many times
 * it was asked to buy an upload. A create is the `/-1/-1` GET carrying
 * x402Options; everything else is irrelevant here.
 */
function countingHttp() {
  const creates: string[] = [];
  const http = {
    get: async ({
      endpoint,
      x402Options,
    }: {
      endpoint: string;
      x402Options?: unknown;
    }) => {
      if (endpoint.includes('/-1/-1') && x402Options !== undefined) {
        creates.push(endpoint);
        return { id: `paid-upload-${creates.length}` };
      }
      return {};
    },
  } as unknown as TurboHTTPService;
  return { http, creates };
}

const uploaderWith = (
  http: TurboHTTPService,
  paidUploadId?: string,
): ChunkedUploader =>
  new ChunkedUploader({
    http,
    token: 'arweave',
    logger: silentLogger,
    dataItemByteCount: 12 * 1024 * 1024,
    chunkingMode: 'force',
    x402: { signer: {}, maxMUSDCAmount: 1000n } as never,
    x402RefundIdentity: { address: 'refund-addr', signatureType: 1 },
    paidUploadId,
  });

/** `initPaidUpload` is private; the paid create is what we are counting. */
const initPaid = (u: ChunkedUploader): Promise<string> =>
  (
    u as unknown as {
      initUpload: () => Promise<string>;
    }
  ).initUpload();

describe('a paid chunked upload across uploadFile retries', () => {
  it('buys exactly one upload when the id is carried to the next attempt', async () => {
    const { http, creates } = countingHttp();

    // Attempt 1 pays, then fails somewhere after the create.
    const first = uploaderWith(http);
    const id1 = await initPaid(first);
    assert.equal(creates.length, 1);
    const carried = first.currentPaidUploadId;
    assert.equal(carried, id1);

    // Attempt 2 is a NEW uploader, which is what uploadFile builds per retry.
    // Handed the id, it must resume rather than buy again.
    const second = uploaderWith(http, carried);
    const id2 = await initPaid(second);

    assert.equal(
      creates.length,
      1,
      'a retry must resume the upload already paid for, not buy a second one',
    );
    assert.equal(id2, id1);
  });

  it('buys a second upload when the id is not carried: the regression', async () => {
    const { http, creates } = countingHttp();

    const first = uploaderWith(http);
    await initPaid(first);

    // No id handed over, which is what a fresh uploader per retry used to get.
    const second = uploaderWith(http);
    await initPaid(second);

    // Pinning the failure mode itself, so the cost of losing the carry is
    // visible rather than silent: this is the shape that billed a single
    // 12 MiB upload once per retry.
    assert.equal(creates.length, 2);
  });

  it('memoises within one instance too', async () => {
    const { http, creates } = countingHttp();
    const u = uploaderWith(http);

    await initPaid(u);
    await initPaid(u);
    await initPaid(u);

    assert.equal(creates.length, 1);
  });
});

/**
 * The same guarantee, through `uploadFile` rather than around it.
 *
 * The tests above prove `ChunkedUploader` resumes when it is HANDED an id. They
 * cannot prove the production code hands it over — that lives in `uploadFile`'s
 * `finally`, which reads `currentPaidUploadId` on the way out of a failed
 * attempt and passes it into the next uploader. Delete that block and every
 * test above still passes, which is the gap this closes: the fix IS the
 * carrying, so the carrying is what has to be tested.
 *
 * Reaching the outer retry takes some doing, and the failures that do not reach
 * it are worth recording because each looks like it should:
 *
 *   - a failed CHUNK is retried inside `ChunkedUploader`, so the attempt still
 *     succeeds and `uploadFile` never loops;
 *   - a 4xx anywhere aborts immediately — "Failed to upload file after 1
 *     attempts" — because `http.ts` treats 4xx as non-retryable;
 *   - a single 5xx finalize is likewise absorbed internally.
 *
 * Only exhausting the internal retries surfaces the error to `uploadFile`,
 * which then rebuilds the uploader — the exact moment a paid id is either
 * carried or lost. Verified to discriminate: with the `finally` removed this
 * buys TWO uploads, with it in place, one.
 */
describe('uploadFile carries the paid upload id across its own retries', () => {
  const originalFetch = globalThis.fetch;
  const ETH_KEY = `0x${'01'.repeat(32)}`;

  it('buys ONE upload when an attempt fails after paying and is retried', async () => {
    let creates = 0;
    let finalizes = 0;

    globalThis.fetch = (async (url: string | URL) => {
      const u = String(url);
      const json = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        });

      // The paid create. Counting these is the whole point.
      if (u.includes('/-1/-1')) {
        creates++;
        return json({
          id: `paid-upload-${creates}`,
          chunkSize: 5 * 1024 * 1024,
        });
      }
      /*
        Fail finalize until the uploader's own retries are spent, so the error
        reaches `uploadFile` and it rebuilds the uploader. Fewer failures are
        absorbed internally and the outer loop never runs — which is how the
        first version of this test passed with the fix removed.
      */
      if (u.includes('/finalize')) {
        finalizes++;
        return finalizes <= 5
          ? json({ error: 'transient' }, 500)
          : json({ id: 'data-item-id', winc: '0' });
      }
      if (u.includes('/status')) {
        return json({ status: 'FINALIZED', receipt: { id: 'data-item-id' } });
      }
      return json({});
    }) as typeof fetch;

    try {
      const turbo = TurboFactory.authenticated({
        privateKey: ETH_KEY,
        token: 'base-usdc',
        uploadServiceConfig: { url: 'https://upload.example.com' },
      });
      await turbo.uploadFile({
        fileStreamFactory: () =>
          Readable.from(Buffer.alloc(12 * 1024 * 1024, 1)),
        fileSizeFactory: () => 12 * 1024 * 1024,
        chunkingMode: 'force',
        fundingMode: new X402Funding({ signer: {} as never }),
      });

      // Guards the guard: if the retry stops happening this test would pass
      // for the wrong reason, exactly as its first version did.
      assert.ok(finalizes > 1, 'the attempt must actually have been retried');
      assert.equal(
        creates,
        1,
        `a retry must resume the upload already paid for, not buy a second one (bought ${creates})`,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
