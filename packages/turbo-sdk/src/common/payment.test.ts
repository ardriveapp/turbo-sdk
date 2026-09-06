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
import { afterEach, describe, it } from 'node:test';
import { restore, stub } from 'sinon';

import type {
  ArNSFiatPurchaseMethod,
  TurboArNSName,
  TurboArNSNamesResponse,
  TurboDataItemSigner,
} from '../types.js';
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';

describe('TurboUnauthenticatedPaymentService', () => {
  afterEach(() => {
    restore();
  });

  describe('getArNSNames()', () => {
    it('GETs /v1/arns/my-names/:address and returns the parsed response', async () => {
      const paymentService = new TurboUnauthenticatedPaymentService({});

      const expectedResponse: TurboArNSNamesResponse = {
        names: [
          {
            name: 'ardrive',
            antId: 'test-ant-id',
            intent: 'Buy-Name',
            type: 'lease',
            years: 1,
            purchaseDate: '2026-01-01T00:00:00.000Z',
            custodial: true,
          },
        ],
      };

      const getStub = stub(
        (paymentService as any)['httpService'],
        'get',
      ).resolves(expectedResponse);

      const result = await paymentService.getArNSNames('test-address');

      assert.deepEqual(result, expectedResponse);
      assert.equal(getStub.calledOnce, true);
      assert.equal(
        getStub.firstCall.args[0].endpoint,
        '/arns/my-names/test-address',
      );
      // The endpoint itself never carries '/v1' -- it's baked into the
      // httpService's baseURL at construction time. Assert that directly
      // rather than trusting the test title's claim.
      assert.equal(
        (paymentService as any)['httpService']['baseURL'].endsWith('/v1'),
        true,
      );
    });

    it('URL-encodes the address so a caller-controlled value cannot alter the request path', async () => {
      const paymentService = new TurboUnauthenticatedPaymentService({});

      const getStub = stub(
        (paymentService as any)['httpService'],
        'get',
      ).resolves({ names: [] });

      await paymentService.getArNSNames('../../account/balance/arweave');

      assert.equal(
        getStub.firstCall.args[0].endpoint,
        '/arns/my-names/..%2F..%2Faccount%2Fbalance%2Farweave',
      );
    });

    it('propagates a rejection from the underlying HTTP call', async () => {
      const paymentService = new TurboUnauthenticatedPaymentService({});

      const expectedError = new Error('network unreachable');
      stub((paymentService as any)['httpService'], 'get').rejects(
        expectedError,
      );

      await assert.rejects(
        () => paymentService.getArNSNames('test-address'),
        expectedError,
      );
    });
  });
});

describe('TurboAuthenticatedPaymentService', () => {
  afterEach(() => {
    restore();
  });

  const stubSigner = {
    getNativeAddress: async () => 'signer-native-address',
  } as unknown as TurboDataItemSigner;

  describe('getArNSNames()', () => {
    it('uses the provided address without consulting the signer', async () => {
      const paymentService = new TurboAuthenticatedPaymentService({
        signer: stubSigner,
      });

      const expectedResponse: TurboArNSNamesResponse = { names: [] };
      const getStub = stub(
        (paymentService as any)['httpService'],
        'get',
      ).resolves(expectedResponse);

      const result = await paymentService.getArNSNames('explicit-address');

      assert.deepEqual(result, expectedResponse);
      assert.equal(
        getStub.firstCall.args[0].endpoint,
        '/arns/my-names/explicit-address',
      );
    });

    it('falls back to the signer native address when none is provided', async () => {
      const paymentService = new TurboAuthenticatedPaymentService({
        signer: stubSigner,
      });

      const expectedResponse: TurboArNSNamesResponse = { names: [] };
      const getStub = stub(
        (paymentService as any)['httpService'],
        'get',
      ).resolves(expectedResponse);

      const result = await paymentService.getArNSNames();

      assert.deepEqual(result, expectedResponse);
      assert.equal(
        getStub.firstCall.args[0].endpoint,
        '/arns/my-names/signer-native-address',
      );
    });

    it('does NOT fall back to the signer when an empty string is provided (matches getBalance)', async () => {
      const paymentService = new TurboAuthenticatedPaymentService({
        signer: stubSigner,
      });

      const getStub = stub(
        (paymentService as any)['httpService'],
        'get',
      ).resolves({ names: [] });

      await paymentService.getArNSNames('');

      assert.equal(getStub.firstCall.args[0].endpoint, '/arns/my-names/');
    });

    it('propagates a rejection when the signer fails to resolve a native address', async () => {
      const failingSigner = {
        getNativeAddress: async () => {
          throw new Error('wallet locked');
        },
      } as unknown as TurboDataItemSigner;
      const paymentService = new TurboAuthenticatedPaymentService({
        signer: failingSigner,
      });

      await assert.rejects(
        () => paymentService.getArNSNames(),
        /wallet locked/,
      );
    });
  });
});

// Regression: the `intent` and `ArNSFiatPurchaseMethod` unions are widened so a
// value added service-side stays assignable without an SDK bump. `string & {}`
// is the usual idiom but trips `ban-types`; `Record<string, never>` looks
// equivalent and is NOT — it rejects arbitrary strings, silently collapsing the
// union to its literals. Only `Record<never, never>` actually widens.
describe('forward-compatible string unions', () => {
  it('accepts an intent the SDK does not know about', () => {
    const futureIntent: TurboArNSName['intent'] = 'Transfer-Name';
    assert.equal(futureIntent, 'Transfer-Name');
  });

  it('accepts a stripe method the SDK does not know about', () => {
    const futureMethod: ArNSFiatPurchaseMethod = 'some-future-method';
    assert.equal(futureMethod, 'some-future-method');
  });
});
