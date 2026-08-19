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

import { TurboArNSNamesResponse, TurboDataItemSigner } from '../types.js';
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
  });
});
