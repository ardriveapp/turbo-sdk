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
