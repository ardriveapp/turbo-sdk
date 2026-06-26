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
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Records the last get/post call and returns a canned response.
class FakeHttp {
  public calls: {
    method: string;
    endpoint: string;
    headers?: any;
    data?: any;
  }[] = [];
  public response: unknown = {};
  async get(args: { endpoint: string; headers?: any }) {
    this.calls.push({ method: 'GET', ...args });
    return this.response;
  }
  async post(args: { endpoint: string; headers?: any; data?: any }) {
    this.calls.push({ method: 'POST', ...args });
    return this.response;
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

const newSigner = () =>
  new TurboNodeSigner({ signer: new ArweaveSigner(testJwk), token: 'arweave' });

describe('ArNS purchase client', () => {
  let http: FakeHttp;

  beforeEach(() => {
    http = new FakeHttp();
  });

  describe('unauthenticated', () => {
    const service = () => {
      const s = new TurboUnauthenticatedPaymentService({});
      (s as unknown as { httpService: FakeHttp }).httpService = http;
      return s;
    };

    it('getArNSPriceForName builds the price endpoint + query', async () => {
      http.response = { winc: '5', mARIO: '10' };
      const res = await service().getArNSPriceForName({
        intent: 'Buy-Name',
        name: 'my-name',
        type: 'lease',
        years: 1,
        processId: 'ant-123',
      });
      assert.equal(http.last.method, 'GET');
      assert.equal(
        http.last.endpoint,
        '/arns/price/buy-name/my-name?type=lease&years=1&processId=ant-123',
      );
      assert.deepEqual(res, { winc: '5', mARIO: '10' });
    });

    it('getArNSPurchaseStatus uses the nonce path', async () => {
      await service().getArNSPurchaseStatus({ nonce: 'abc-nonce' });
      assert.equal(http.last.endpoint, '/arns/purchase/abc-nonce');
    });
  });

  describe('authenticated', () => {
    const service = () => {
      const s = new TurboAuthenticatedPaymentService({ signer: newSigner() });
      (s as unknown as { httpService: FakeHttp }).httpService = http;
      return s;
    };

    it('purchaseArNSName signs a UUID nonce + sends signature-type, returns the nonce', async () => {
      http.response = {
        purchaseReceipt: { name: 'foo', nonce: 'ignored' },
        arioWriteResult: { id: 'sol-tx' },
      };
      const res = await service().purchaseArNSName({
        intent: 'Buy-Name',
        name: 'foo',
        type: 'lease',
        years: 1,
        processId: 'ant-xyz',
      });

      assert.equal(http.last.method, 'POST');
      assert.equal(
        http.last.endpoint,
        '/arns/purchase/buy-name/foo?type=lease&years=1&processId=ant-xyz',
      );
      // UUID nonce, signed, with signature type advertised
      assert.match(http.last.headers['x-nonce'], UUID_RE);
      assert.equal(http.last.headers['x-signature-type'], '1'); // arweave
      assert.ok(http.last.headers['x-public-key']?.length > 0);
      assert.ok(http.last.headers['x-signature']?.length > 0);
      assert.ok(Buffer.isBuffer(http.last.data));
      // returned nonce is the one that was signed/sent
      assert.equal(res.nonce, http.last.headers['x-nonce']);
      assert.match(res.nonce, UUID_RE);
    });

    it('per-intent wrappers set the correct intent in the path', async () => {
      const s = service();
      await s.extendArNSLease({ name: 'foo', years: 2 });
      assert.ok(
        http.last.endpoint.startsWith('/arns/purchase/extend-lease/foo'),
      );
      assert.ok(http.last.endpoint.includes('years=2'));

      await s.increaseArNSUndernameLimit({ name: 'foo', increaseQty: 5 });
      assert.ok(
        http.last.endpoint.startsWith(
          '/arns/purchase/increase-undername-limit/foo',
        ),
      );
      assert.ok(http.last.endpoint.includes('increaseQty=5'));

      await s.upgradeArNSName({ name: 'foo' });
      assert.ok(
        http.last.endpoint.startsWith('/arns/purchase/upgrade-name/foo'),
      );
    });

    it('appends paidBy delegated payers as repeated params', async () => {
      await service().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant',
        paidBy: ['payer-a', 'payer-b'],
      });
      assert.ok(http.last.endpoint.includes('paidBy=payer-a'));
      assert.ok(http.last.endpoint.includes('paidBy=payer-b'));
    });
  });
});
