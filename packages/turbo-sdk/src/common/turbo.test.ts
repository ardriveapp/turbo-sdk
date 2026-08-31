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

import {
  TurboAuthenticatedPaymentServiceInterface,
  TurboAuthenticatedUploadServiceInterface,
  TurboDataItemSigner,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboUnauthenticatedUploadServiceInterface,
} from '../types.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from './turbo.js';

// getArNSNames is the only piece of the delegation layer under test here --
// this file exists specifically to close the gap an adversarial review
// found: TurboUnauthenticatedClient/TurboAuthenticatedClient (the actual
// public API surface consumers call) had zero coverage of their own; only
// the underlying TurboUnauthenticatedPaymentService/
// TurboAuthenticatedPaymentService were unit-tested (see payment.test.ts).
// A typo delegating to the wrong service method would previously have
// shipped undetected.

describe('TurboUnauthenticatedClient', () => {
  describe('getArNSNames()', () => {
    it('delegates to paymentService.getArNSNames with the given address', async () => {
      const expectedResponse = { names: [] };
      let calledWith: unknown;
      const fakePaymentService = {
        getArNSNames: async (address: string) => {
          calledWith = address;
          return expectedResponse;
        },
      } as unknown as TurboUnauthenticatedPaymentServiceInterface;

      const client = new TurboUnauthenticatedClient({
        paymentService: fakePaymentService,
        uploadService:
          {} as unknown as TurboUnauthenticatedUploadServiceInterface,
      });

      const result = await client.getArNSNames('delegate-test-address');

      assert.deepEqual(result, expectedResponse);
      assert.equal(calledWith, 'delegate-test-address');
    });
  });
});

describe('TurboAuthenticatedClient', () => {
  describe('getArNSNames()', () => {
    it('delegates to paymentService.getArNSNames, passing userAddress through untouched', async () => {
      const expectedResponse = { names: [] };
      let calledWith: unknown;
      const fakePaymentService = {
        getArNSNames: async (userAddress?: string) => {
          calledWith = userAddress;
          return expectedResponse;
        },
      } as unknown as TurboAuthenticatedPaymentServiceInterface;

      const client = new TurboAuthenticatedClient({
        paymentService: fakePaymentService,
        uploadService:
          {} as unknown as TurboAuthenticatedUploadServiceInterface,
        signer: {} as unknown as TurboDataItemSigner,
      });

      const explicitResult = await client.getArNSNames('explicit-address');
      assert.deepEqual(explicitResult, expectedResponse);
      assert.equal(calledWith, 'explicit-address');

      // The client itself does not resolve a default address -- that
      // resolution lives one layer down, in
      // TurboAuthenticatedPaymentService.getArNSNames (see payment.test.ts).
      // Here we only assert the client passes `undefined` straight through
      // rather than substituting its own default.
      const omittedResult = await client.getArNSNames();
      assert.deepEqual(omittedResult, expectedResponse);
      assert.equal(calledWith, undefined);
    });
  });
});

describe('TurboAuthenticatedClient — ArNS action delegation', () => {
  // These are one-line pass-throughs, but "one line" is exactly where a wrong
  // param name or a dropped argument hides: nothing fails until the service
  // 400s at runtime. The unit suite otherwise drives the payment service
  // directly, so the client surface consumers actually call was untested.
  const forwarded: { method: string; params: unknown }[] = [];

  const recording = new Proxy({} as Record<string, unknown>, {
    get:
      (_t, method: string) =>
      async (...args: unknown[]) => {
        forwarded.push({ method, params: args[0] });
        return {
          nonce: 'n',
          action: method,
          status: 'completed',
          messageId: 'm',
        };
      },
  }) as unknown as TurboAuthenticatedPaymentServiceInterface;

  const client = new TurboAuthenticatedClient({
    paymentService: recording,
    uploadService: {} as unknown as TurboAuthenticatedUploadServiceInterface,
    signer: {} as unknown as TurboDataItemSigner,
  });

  const owner = { getAddress: () => 'OWNER' } as never;

  it('forwards every ArNS action to the payment service unchanged', async () => {
    const cases: [string, () => Promise<unknown>, Record<string, unknown>][] = [
      [
        'buyArNSName',
        () => client.buyArNSName({ name: 'n', owner, type: 'lease', years: 1 }),
        { name: 'n', owner, type: 'lease', years: 1 },
      ],
      [
        'extendArNSLease',
        () => client.extendArNSLease({ name: 'n', years: 2 }),
        { name: 'n', years: 2 },
      ],
      [
        'upgradeArNSName',
        () => client.upgradeArNSName({ name: 'n' }),
        { name: 'n' },
      ],
      [
        'increaseArNSUndernameLimit',
        () => client.increaseArNSUndernameLimit({ name: 'n', increaseQty: 5 }),
        { name: 'n', increaseQty: 5 },
      ],
      [
        'setArNSRecord',
        () => client.setArNSRecord({ antId: 'a', owner, transactionId: 't' }),
        { antId: 'a', owner, transactionId: 't' },
      ],
      [
        'removeArNSRecord',
        () => client.removeArNSRecord({ antId: 'a', owner, undername: 'u' }),
        { antId: 'a', owner, undername: 'u' },
      ],
      [
        'addArNSController',
        () => client.addArNSController({ antId: 'a', owner }),
        { antId: 'a', owner },
      ],
      [
        'removeArNSController',
        () => client.removeArNSController({ antId: 'a', owner }),
        { antId: 'a', owner },
      ],
      [
        'transferArNSAnt',
        () => client.transferArNSAnt({ antId: 'a', owner, target: 'd' }),
        { antId: 'a', owner, target: 'd' },
      ],
      [
        'setArNSRecordMetadata',
        () =>
          client.setArNSRecordMetadata({ antId: 'a', owner, displayName: 'D' }),
        { antId: 'a', owner, displayName: 'D' },
      ],
      [
        'removeArNSRecordMetadata',
        () =>
          client.removeArNSRecordMetadata({
            antId: 'a',
            owner,
            undername: 'u',
          }),
        { antId: 'a', owner, undername: 'u' },
      ],
      [
        'transferArNSRecord',
        () =>
          client.transferArNSRecord({
            antId: 'a',
            owner,
            undername: 'u',
            target: 'd',
          }),
        { antId: 'a', owner, undername: 'u', target: 'd' },
      ],
    ];

    for (const [method, call, expected] of cases) {
      forwarded.length = 0;
      await call();
      assert.equal(
        forwarded.length,
        1,
        `${method} called the service exactly once`,
      );
      assert.equal(
        forwarded[0].method,
        method,
        `${method} routed to the right service method`,
      );
      assert.deepEqual(
        forwarded[0].params,
        expected,
        `${method} forwarded its params unchanged`,
      );
    }
  });

  it('forwards the raw action trio too', async () => {
    forwarded.length = 0;
    await client.createArNSAction('buy-name', { name: 'n' });
    assert.equal(forwarded[0].method, 'createArNSAction');

    forwarded.length = 0;
    await client.signArNSAction('nonce-1', 'BASE64');
    assert.equal(forwarded[0].method, 'signArNSAction');
    assert.equal(forwarded[0].params, 'nonce-1');

    forwarded.length = 0;
    await client.getArNSActionStatus('nonce-1');
    assert.equal(forwarded[0].method, 'getArNSActionStatus');
    assert.equal(forwarded[0].params, 'nonce-1');
  });
});
