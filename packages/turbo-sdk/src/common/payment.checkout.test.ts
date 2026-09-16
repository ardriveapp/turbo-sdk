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
import { beforeEach, describe, it } from 'node:test';

import {
  testArweaveNativeB64Address,
  testSolNativeAddress,
  testSolWallet,
} from '../../tests/helpers.js';
// Through the package entry point: importing './payment.js' ahead of the
// factory enters the payment -> index -> turbo import cycle in an order that
// leaves module constants uninitialized.
import {
  TokenType,
  TopUpRawResponse,
  TurboFactory,
  TurboUnauthenticatedPaymentService,
  USD,
} from '../node/index.js';
import { isValidArweaveBase64URL } from '../utils/common.js';

// A base58 public key 43 characters long, which the payment service also
// accepts as an Arweave-shaped `ario` address.
const shortSolanaAddress = 'ktqKPuvBMLYoR3AkWLDZnPPgzLYProbvzkAjJ3F8FwU';

const checkoutResponse: TopUpRawResponse = {
  topUpQuote: {
    topUpQuoteId: 'quote-id',
    destinationAddressType: 'solana',
    paymentAmount: 1000,
    quotedPaymentAmount: 1000,
    winstonCreditAmount: '1000',
    destinationAddress: testSolNativeAddress,
    currencyType: 'usd',
    quoteExpirationDate: '2026-09-16T00:00:00.000Z',
    paymentProvider: 'stripe',
    adjustments: [],
  },
  paymentSession: { id: 'session-id', url: 'https://checkout.example.com' },
  adjustments: [],
  fees: [],
} as unknown as TopUpRawResponse;

class FakeHttp {
  public endpoints: string[] = [];
  async get({ endpoint }: { endpoint: string }) {
    this.endpoints.push(endpoint);
    return checkoutResponse;
  }
}

const query = (endpoint: string) => new URL(endpoint, 'https://x').searchParams;

describe('checkout address type', () => {
  let http: FakeHttp;

  beforeEach(() => {
    http = new FakeHttp();
  });

  const checkout = (token: TokenType, owner: string) => {
    const service = new TurboUnauthenticatedPaymentService({ token });
    (service as unknown as { httpService: FakeHttp }).httpService = http;
    return service.createCheckoutSession({ amount: USD(10), owner });
  };

  // The CLI's `top-up --token ario` path: a Solana key, and the owner the
  // client reports for itself. The service refuses this address as `ario`.
  it('credits the base58 account for an ario client with a Solana key', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testSolWallet,
      token: 'ario',
    });
    const payment = (turbo as unknown as { paymentService: object })
      .paymentService;
    (payment as { httpService: FakeHttp }).httpService = http;
    const owner = await turbo.signer.getNativeAddress();
    assert.ok(
      !isValidArweaveBase64URL(owner),
      'precondition: the service rejects this address as an ario address',
    );

    await turbo.createCheckoutSession({ amount: USD(10), owner });

    const [endpoint] = http.endpoints;
    assert.ok(
      endpoint.startsWith(
        `/top-up/checkout-session/${testSolNativeAddress}/usd/1000?`,
      ),
      endpoint,
    );
    assert.equal(query(endpoint).get('token'), 'ario');
    assert.equal(query(endpoint).get('destinationAddressType'), 'solana');
  });

  it('names the address type for a payment intent too', async () => {
    const service = new TurboUnauthenticatedPaymentService({ token: 'ario' });
    (service as unknown as { httpService: FakeHttp }).httpService = http;

    await service.createPaymentIntent({
      amount: USD(10),
      owner: testSolNativeAddress,
    });

    assert.ok(http.endpoints[0].startsWith('/top-up/payment-intent/'));
    assert.equal(
      query(http.endpoints[0]).get('destinationAddressType'),
      'solana',
    );
  });

  // Each of these already passes the service's address check, so the request
  // stays exactly as it was.
  for (const [token, owner, label] of [
    ['ario', shortSolanaAddress, 'a 43-character Solana address'],
    ['ario', testArweaveNativeB64Address, 'an Arweave address'],
    ['solana', testSolNativeAddress, 'a solana client'],
    ['arweave', testArweaveNativeB64Address, 'an arweave client'],
  ] as const) {
    it(`leaves the request unchanged for ${label} (token: ${token})`, async () => {
      await checkout(token, owner);

      assert.equal(query(http.endpoints[0]).get('token'), token);
      assert.equal(
        query(http.endpoints[0]).has('destinationAddressType'),
        false,
      );
    });
  }
});
