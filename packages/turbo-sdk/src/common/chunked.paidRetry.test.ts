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

import { TurboLogger } from '../types.js';
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
