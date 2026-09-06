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
import { ArweaveSigner } from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

import { testJwk } from '../../tests/helpers.js';
import { TurboNodeSigner } from '../node/signer.js';
import { FailedRequestError } from '../utils/errors.js';
import { TurboAuthenticatedPaymentService } from './payment.js';

// getPaymentHistory signs the bare nonce, which defaults to randomBytes(16) hex.
const HEX_NONCE_RE = /^[0-9a-f]{32}$/i;

// Records the last get() call (including allowedStatuses) and returns a canned
// response, or throws `error` to exercise failure handling.
class FakeHttp {
  public calls: {
    endpoint: string;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
  }[] = [];
  public response: unknown = {};
  public error: unknown = undefined;
  async get(args: {
    endpoint: string;
    headers?: Record<string, string>;
    allowedStatuses?: number[];
  }) {
    this.calls.push(args);
    if (this.error) throw this.error;
    return this.response;
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

// Wraps a real signer to capture (nonce, additionalData) so we can prove the
// request signs the BARE nonce (no action-binding) as the service expects.
class RecordingSigner {
  public calls: { nonce?: string; additionalData?: string }[] = [];
  constructor(private readonly inner: TurboNodeSigner) {}
  async generateSignedRequestHeaders(nonce?: string, additionalData?: string) {
    this.calls.push({ nonce, additionalData });
    return this.inner.generateSignedRequestHeaders(nonce, additionalData);
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

const newSigner = () =>
  new TurboNodeSigner({ signer: new ArweaveSigner(testJwk), token: 'arweave' });

describe('getPaymentHistory', () => {
  let http: FakeHttp;

  const service = () => {
    const s = new TurboAuthenticatedPaymentService({ signer: newSigner() });
    (s as unknown as { httpService: FakeHttp }).httpService = http;
    return s;
  };

  beforeEach(() => {
    http = new FakeHttp();
    http.response = { payments: [], hasMore: false, cursor: null };
  });

  it('GETs /account/payments with signed headers and allowedStatuses [200]', async () => {
    await service().getPaymentHistory();
    assert.equal(http.last.endpoint, '/account/payments');
    assert.deepEqual(http.last.allowedStatuses, [200]);
    // Real signature headers must be attached (proof-of-ownership).
    assert.match(http.last.headers?.['x-nonce'] ?? '', HEX_NONCE_RE);
    assert.equal(http.last.headers?.['x-signature-type'], '1'); // arweave
    assert.ok((http.last.headers?.['x-public-key']?.length ?? 0) > 0);
    assert.ok((http.last.headers?.['x-signature']?.length ?? 0) > 0);
  });

  it('signs the BARE nonce (no limit/cursor action-binding) to match the service', async () => {
    const s = service();
    const rec = new RecordingSigner(
      (s as unknown as { signer: TurboNodeSigner }).signer,
    );
    (s as unknown as { signer: RecordingSigner }).signer = rec;

    await s.getPaymentHistory({ limit: 10, cursor: 'abc' });
    // Called with no args → inner signer generates the nonce, additionalData undefined.
    assert.equal(rec.last.nonce, undefined);
    assert.equal(rec.last.additionalData, undefined);
  });

  it('puts limit and cursor in the query string', async () => {
    await service().getPaymentHistory({ limit: 25, cursor: 'CURSOR123' });
    assert.equal(
      http.last.endpoint,
      '/account/payments?limit=25&cursor=CURSOR123',
    );
  });

  it('includes only the params provided', async () => {
    await service().getPaymentHistory({ limit: 5 });
    assert.equal(http.last.endpoint, '/account/payments?limit=5');

    await service().getPaymentHistory({ cursor: 'onlyCursor' });
    assert.equal(http.last.endpoint, '/account/payments?cursor=onlyCursor');
  });

  it('URL-encodes an opaque cursor', async () => {
    // Cursors are base64url so they never contain '+//=', but a defensive check
    // that URLSearchParams encoding is in effect (no raw injection into the path).
    await service().getPaymentHistory({ cursor: 'a b&c=d' });
    assert.equal(http.last.endpoint, '/account/payments?cursor=a+b%26c%3Dd');
  });

  it('forwards a real base64url cursor byte-for-byte (- and _ not percent-encoded)', async () => {
    // The service issues cursors via Buffer.toString('base64url'); its alphabet
    // is [A-Za-z0-9-_]. URLSearchParams must leave '-' and '_' untouched or a
    // round-tripped cursor would decode differently server-side and mis-paginate.
    const serverCursor = Buffer.from(
      JSON.stringify({
        d: '2026-01-02T03:04:05.678901Z',
        t: 'crypto',
        i: 'tx-1',
      }),
    ).toString('base64url');
    assert.ok(!/[+/=]/.test(serverCursor)); // sanity: genuinely base64url
    await service().getPaymentHistory({ cursor: serverCursor });
    assert.equal(
      http.last.endpoint,
      `/account/payments?cursor=${serverCursor}`,
    );
  });

  it('replays a prior page cursor unchanged (page-2 fetch)', async () => {
    http.response = { payments: [], hasMore: true, cursor: 'PAGE2CURSOR-_x' };
    const page1 = await service().getPaymentHistory({ limit: 2 });
    assert.equal(page1.hasMore, true);
    await service().getPaymentHistory({ limit: 2, cursor: page1.cursor ?? '' });
    assert.equal(
      http.last.endpoint,
      '/account/payments?limit=2&cursor=PAGE2CURSOR-_x',
    );
  });

  it('returns the service response unchanged', async () => {
    const page = {
      payments: [
        {
          type: 'crypto',
          date: '2026-01-02T00:00:00.000Z',
          wincCredited: '1000',
          tokenType: 'ethereum',
          tokenQuantity: '5793434082931',
          usdEquivalent: '0.010000',
          senderAddress: '0xSENDER',
          transactionId: 'tx-1',
          blockHeight: '25576712',
        },
        {
          type: 'fiat',
          date: '2026-01-01T00:00:00.000Z',
          wincCredited: '2000',
          paymentAmount: '1000',
          currencyType: 'usd',
          paymentProvider: 'stripe',
          receiptId: 'r-1',
          giftMessage: null,
        },
      ],
      hasMore: true,
      cursor: 'NEXT',
    };
    http.response = page;
    const res = await service().getPaymentHistory({ limit: 2 });
    assert.deepEqual(res, page);
  });

  it('propagates a service error (e.g. 401 unsigned/invalid)', async () => {
    http.error = new FailedRequestError('Signature required', 401);
    await assert.rejects(
      () => service().getPaymentHistory(),
      /Signature required/,
    );
  });
});
