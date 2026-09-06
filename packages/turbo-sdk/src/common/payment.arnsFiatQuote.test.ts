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
import type { ArNSFiatPurchaseQuoteResponse } from '../types.js';
import {
  FailedRequestError,
  FiatPaymentsDisabledError,
  ProvidedInputError,
} from '../utils/errors.js';
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';

class FakeHttp {
  public calls: { endpoint: string }[] = [];
  public response: unknown = { purchaseQuote: {}, paymentSession: {} };
  public error: unknown = undefined;
  async get(args: { endpoint: string }) {
    this.calls.push(args);
    if (this.error) throw this.error;
    return this.response;
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

const baseParams = {
  intent: 'Buy-Name',
  name: 'my-name',
  type: 'lease',
  years: 1,
  currency: 'usd',
  address: 'arweave-destination-address',
} as const;

describe('getArNSFiatPurchaseQuote', () => {
  let http: FakeHttp;
  beforeEach(() => {
    http = new FakeHttp();
  });

  const service = () => {
    const s = new TurboUnauthenticatedPaymentService({});
    (s as unknown as { httpService: FakeHttp }).httpService = http;
    return s;
  };

  const authService = () => {
    const s = new TurboAuthenticatedPaymentService({
      signer: new TurboNodeSigner({
        signer: new ArweaveSigner(testJwk),
        token: 'arweave',
      }),
    });
    (s as unknown as { httpService: FakeHttp }).httpService = http;
    return s;
  };

  it('builds the five-segment path and defaults to payment-intent', async () => {
    await service().getArNSFiatPurchaseQuote({ ...baseParams });
    const [path] = http.last.endpoint.split('?');
    assert.equal(
      path,
      '/arns/quote/payment-intent/arweave-destination-address/usd/Buy-Name/my-name',
    );
  });

  it('honors an explicit checkout-session method', async () => {
    await service().getArNSFiatPurchaseQuote({
      ...baseParams,
      method: 'checkout-session',
    });
    assert.ok(http.last.endpoint.startsWith('/arns/quote/checkout-session/'));
  });

  // uiMode 'hosted' pairs with success/cancel URLs; 'embedded' with returnUrl.
  it('sends hosted uiMode with its success and cancel urls', async () => {
    await service().getArNSFiatPurchaseQuote({
      ...baseParams,
      uiMode: 'hosted',
      successUrl: 'https://example.com/ok',
      cancelUrl: 'https://example.com/no',
    });
    const q = new URLSearchParams(http.last.endpoint.split('?')[1]);
    assert.equal(q.get('uiMode'), 'hosted');
    assert.equal(q.get('successUrl'), 'https://example.com/ok');
    assert.equal(q.get('cancelUrl'), 'https://example.com/no');
    assert.equal(q.get('returnUrl'), null);
  });

  it('sends embedded uiMode with returnUrl and no hosted urls', async () => {
    await service().getArNSFiatPurchaseQuote({
      ...baseParams,
      uiMode: 'embedded',
      returnUrl: 'https://example.com/back',
    });
    const q = new URLSearchParams(http.last.endpoint.split('?')[1]);
    assert.equal(q.get('uiMode'), 'embedded');
    assert.equal(q.get('returnUrl'), 'https://example.com/back');
    assert.equal(q.get('successUrl'), null);
    assert.equal(q.get('cancelUrl'), null);
  });

  // The service reads promo codes with parseQueryParams, which treats a
  // comma-joined string as ONE code. They must be repeated params.
  it('repeats promoCode rather than comma-joining multiple codes', async () => {
    await service().getArNSFiatPurchaseQuote({
      ...baseParams,
      promoCodes: ['FIRST', 'SECOND'],
    });
    const q = new URLSearchParams(http.last.endpoint.split('?')[1]);
    assert.deepEqual(q.getAll('promoCode'), ['FIRST', 'SECOND']);
    assert.ok(!http.last.endpoint.includes('FIRST%2CSECOND'));
  });

  it('passes intent-specific params through the query', async () => {
    await service().getArNSFiatPurchaseQuote({
      intent: 'Increase-Undername-Limit',
      name: 'my-name',
      increaseQty: 5,
      currency: 'eur',
      address: 'addr',
    });
    const q = new URLSearchParams(http.last.endpoint.split('?')[1]);
    assert.equal(q.get('increaseQty'), '5');
  });

  // Regression guard: five user-controlled values land in the path. An
  // unencoded `../` would silently retarget the request at another route.
  it('encodes every interpolated path segment', async () => {
    await service().getArNSFiatPurchaseQuote({
      ...baseParams,
      address: '../../account/balance/arweave',
      name: 'a/../../evil name',
    });
    const [path] = http.last.endpoint.split('?');
    assert.ok(
      !path.includes('../'),
      `path traversal survived encoding: ${path}`,
    );
    assert.ok(path.includes('..%2F..%2Faccount%2Fbalance%2Farweave'));
    assert.ok(path.includes('a%2F..%2F..%2Fevil%20name'));
  });

  it('maps the disabled-Stripe 503 to FiatPaymentsDisabledError', async () => {
    http.error = new FailedRequestError(
      'Fiat (Stripe) ArNS payments are disabled',
      503,
    );
    await assert.rejects(
      () => service().getArNSFiatPurchaseQuote({ ...baseParams }),
      FiatPaymentsDisabledError,
    );
  });

  // The same status is used for internal errors, so only the disabled body maps.
  it('leaves a generic 503 as a FailedRequestError', async () => {
    http.error = new FailedRequestError('Internal Server Error: boom', 503);
    await assert.rejects(
      () => service().getArNSFiatPurchaseQuote({ ...baseParams }),
      (e: unknown) =>
        e instanceof FailedRequestError &&
        !(e instanceof FiatPaymentsDisabledError),
    );
  });

  it('rejects an unsupported currency before making a request', async () => {
    await assert.rejects(
      () =>
        service().getArNSFiatPurchaseQuote({
          ...baseParams,
          currency: 'xyz' as never,
        }),
      ProvidedInputError,
    );
    assert.equal(http.calls.length, 0);
  });

  it('defaults address to the signer on the authenticated client', async () => {
    const s = authService();
    const expected = await (
      s as unknown as { signer: { getNativeAddress(): Promise<string> } }
    ).signer.getNativeAddress();
    await s.getArNSFiatPurchaseQuote({
      intent: 'Buy-Name',
      name: 'my-name',
      type: 'permabuy',
      currency: 'usd',
    });
    const [path] = http.last.endpoint.split('?');
    assert.equal(
      path,
      `/arns/quote/payment-intent/${expected}/usd/Buy-Name/my-name`,
    );
  });

  // Fixture captured from the LIVE payment service. Source-reading alone got
  // three of these wrong: mARIOQty serializes as a number (unlike wincQty),
  // usdArRate/usdArioRate serialize as strings, and quoteCreationDate exists.
  // Typing this fixture as the response type is the regression guard.
  it('matches the shape the live service actually returns', async () => {
    const live: ArNSFiatPurchaseQuoteResponse = {
      purchaseQuote: {
        nonce: '6287906b-b1cd-4a89-a3a8-89925b027a7c',
        name: 'verify-types-xyz',
        intent: 'Buy-Name',
        owner: 'sYFSpEH7Gls-5Spq5FjuP85JCZj6QYzNvCm9BdKEJs4',
        wincQty: '704714789010',
        mARIOQty: 1000000,
        paymentAmount: 1234,
        quotedPaymentAmount: 1234,
        currencyType: 'usd',
        quoteCreationDate: '2026-08-22T18:00:00.000Z',
        quoteExpirationDate: '2026-08-22T18:30:00.000Z',
        paymentProvider: 'stripe',
        excessWincAmount: '0',
        usdArRate: '5.55',
        usdArioRate: '0.01',
        type: 'lease',
        years: 1,
        // increaseQty and processId are OMITTED for this intent, not null.
      },
      paymentSession: {
        id: 'pi_123',
        client_secret: 'pi_123_secret',
        object: 'payment_intent',
      },
      adjustments: [],
      fees: [],
    };

    http.response = live;
    const res = await service().getArNSFiatPurchaseQuote({ ...baseParams });

    assert.equal(res.purchaseQuote.nonce, live.purchaseQuote.nonce);
    assert.equal(typeof res.purchaseQuote.mARIOQty, 'number');
    assert.equal(typeof res.purchaseQuote.wincQty, 'string');
    assert.equal(typeof res.purchaseQuote.usdArRate, 'string');
    assert.equal(res.purchaseQuote.increaseQty, undefined);
    assert.equal(res.purchaseQuote.processId, undefined);
    assert.ok(Array.isArray(res.fees));
    assert.equal(res.paymentSession.client_secret, 'pi_123_secret');
  });

  it('lets the authenticated caller override the destination address', async () => {
    await authService().getArNSFiatPurchaseQuote({
      ...baseParams,
      address: 'someone-else',
    });
    assert.ok(http.last.endpoint.includes('/someone-else/'));
  });
});
