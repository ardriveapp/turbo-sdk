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

// Records the last GET and returns a canned response.
class FakeHttp {
  public calls: { endpoint: string; allowedStatuses?: number[] }[] = [];
  public response: unknown = {};
  async get(args: { endpoint: string; allowedStatuses?: number[] }) {
    this.calls.push(args);
    return this.response;
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

const newSigner = () =>
  new TurboNodeSigner({ signer: new ArweaveSigner(testJwk), token: 'arweave' });

describe('getFreeStatus', () => {
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

    it('builds /account/free?address= and returns bytesRemaining', async () => {
      http.response = { bytesRemaining: 7340032 };
      const res = await service().getFreeStatus('wallet-abc');
      assert.equal(http.last.endpoint, '/account/free?address=wallet-abc');
      assert.deepEqual(res, { bytesRemaining: 7340032 });
    });

    it('preserves 0 (free tier disabled) and null (unlimited/exempt)', async () => {
      http.response = { bytesRemaining: 0 };
      assert.deepEqual(await service().getFreeStatus('w'), {
        bytesRemaining: 0,
      });
      http.response = { bytesRemaining: null };
      assert.deepEqual(await service().getFreeStatus('w'), {
        bytesRemaining: null,
      });
    });

    it('coerces a missing field (e.g. a 404 body) to null', async () => {
      http.response = 'Not Found';
      assert.deepEqual(await service().getFreeStatus('w'), {
        bytesRemaining: null,
      });
    });

    it('tolerates a 404 via allowedStatuses', async () => {
      http.response = { bytesRemaining: 10485760 };
      await service().getFreeStatus('w');
      assert.deepEqual(http.last.allowedStatuses, [200, 404]);
    });
  });

  describe('authenticated', () => {
    const service = () => {
      const s = new TurboAuthenticatedPaymentService({ signer: newSigner() });
      (s as unknown as { httpService: FakeHttp }).httpService = http;
      return s;
    };

    it('defaults the address from the signer when none is given', async () => {
      http.response = { bytesRemaining: 5 };
      const nativeAddress = await newSigner().getNativeAddress();
      const res = await service().getFreeStatus();
      assert.equal(
        http.last.endpoint,
        `/account/free?address=${nativeAddress}`,
      );
      assert.deepEqual(res, { bytesRemaining: 5 });
    });
  });
});
