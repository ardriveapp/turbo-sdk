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

import { InsufficientCreditsError } from '../../utils/errors.js';
import {
  ArNSPriceOptions,
  ArNSPurchaseOptions,
  ArNSPurchaseStatusOptions,
  RemoveArNSRecordOptions,
  SetArNSRecordOptions,
  TransferArNSAntOptions,
} from '../types.js';
import {
  ArNSCustodyClient,
  ArNSPriceClient,
  ArNSPurchaseClient,
  ArNSStatusClient,
  arnsPrice,
  arnsPriceParamsFromOptions,
  arnsPurchaseStatus,
  buyArNSName,
  extendArNSLease,
  increaseArNSUndernames,
  removeArNSRecord,
  setArNSRecord,
  transferArNSAnt,
  upgradeArNSName,
} from './arns.js';

// Records every call so tests can assert the exact SDK method + params the
// option->params mapping produced, without touching the network.
class FakeTurbo
  implements
    ArNSPriceClient,
    ArNSStatusClient,
    ArNSPurchaseClient,
    ArNSCustodyClient
{
  public calls: { method: string; params: unknown }[] = [];
  public error: unknown = undefined;
  private record<T>(method: string, params: unknown, response: T): Promise<T> {
    this.calls.push({ method, params });
    if (this.error) return Promise.reject(this.error);
    return Promise.resolve(response);
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }

  private purchaseResponse = {
    purchaseReceipt: { name: 'foo', nonce: 'srv-nonce' },
    arioWriteResult: { id: 'sol-tx' },
    nonce: 'nonce-123',
  } as unknown as Awaited<ReturnType<ArNSPurchaseClient['buyArNSName']>>;

  getArNSPriceForName(params: unknown) {
    return this.record('getArNSPriceForName', params, {
      winc: '1500000000000',
      mARIO: '2500',
    });
  }
  getArNSPurchaseStatus(params: unknown) {
    return this.record('getArNSPurchaseStatus', params, {
      name: 'foo',
      intent: 'Buy-Name',
      nonce: 'nonce-123',
      owner: 'owner-1',
      wincQty: '1',
      mARIOQty: '1',
      usdArRate: 1,
      usdArioRate: 1,
      paidBy: [],
      messageId: 'sol-tx-success',
    } as unknown as Awaited<
      ReturnType<ArNSStatusClient['getArNSPurchaseStatus']>
    >);
  }
  buyArNSName(params: unknown) {
    return this.record('buyArNSName', params, this.purchaseResponse);
  }
  extendArNSLease(params: unknown) {
    return this.record('extendArNSLease', params, this.purchaseResponse);
  }
  increaseArNSUndernameLimit(params: unknown) {
    return this.record(
      'increaseArNSUndernameLimit',
      params,
      this.purchaseResponse,
    );
  }
  upgradeArNSName(params: unknown) {
    return this.record('upgradeArNSName', params, this.purchaseResponse);
  }
  transferArNSAnt(params: unknown) {
    return this.record('transferArNSAnt', params, {
      antId: 'ant-1',
      target: 'tgt-1',
      messageId: 'm',
    });
  }
  setArNSRecord(params: unknown) {
    return this.record('setArNSRecord', params, {
      antId: 'ant-1',
      undername: '@',
      transactionId: 'tx-1',
      ttlSeconds: 900,
      messageId: 'm',
    });
  }
  removeArNSRecord(params: unknown) {
    return this.record('removeArNSRecord', params, {
      antId: 'ant-1',
      undername: 'docs',
      messageId: 'm',
    });
  }
}

const priceOptions = (o: Partial<ArNSPriceOptions>): ArNSPriceOptions =>
  ({ token: 'arweave', ...o }) as ArNSPriceOptions;
const purchaseOptions = (
  o: Partial<ArNSPurchaseOptions>,
): ArNSPurchaseOptions => ({ token: 'arweave', ...o }) as ArNSPurchaseOptions;

describe('ArNS CLI commands', () => {
  let turbo: FakeTurbo;
  beforeEach(() => {
    turbo = new FakeTurbo();
  });

  describe('arnsPriceParamsFromOptions (intent inference)', () => {
    it('infers Buy-Name lease from --type lease (with years + processId)', () => {
      assert.deepEqual(
        arnsPriceParamsFromOptions(
          priceOptions({
            name: 'foo',
            type: 'lease',
            years: '2',
            processId: 'ant-1',
          }),
        ),
        {
          intent: 'Buy-Name',
          name: 'foo',
          type: 'lease',
          years: 2,
          processId: 'ant-1',
        },
      );
    });

    it('infers Buy-Name permabuy from --type permabuy (no years)', () => {
      assert.deepEqual(
        arnsPriceParamsFromOptions(
          priceOptions({ name: 'foo', type: 'permabuy', processId: 'ant-1' }),
        ),
        {
          intent: 'Buy-Name',
          name: 'foo',
          type: 'permabuy',
          processId: 'ant-1',
        },
      );
    });

    it('infers Increase-Undername-Limit from --increase-qty', () => {
      assert.deepEqual(
        arnsPriceParamsFromOptions(
          priceOptions({ name: 'foo', increaseQty: '5' }),
        ),
        { intent: 'Increase-Undername-Limit', name: 'foo', increaseQty: 5 },
      );
    });

    it('infers Extend-Lease from --years (no --type)', () => {
      assert.deepEqual(
        arnsPriceParamsFromOptions(priceOptions({ name: 'foo', years: '3' })),
        { intent: 'Extend-Lease', name: 'foo', years: 3 },
      );
    });

    it('infers Upgrade-Name when only --name is given', () => {
      assert.deepEqual(
        arnsPriceParamsFromOptions(priceOptions({ name: 'foo' })),
        { intent: 'Upgrade-Name', name: 'foo' },
      );
    });

    it('requires --name', () => {
      assert.throws(() => arnsPriceParamsFromOptions(priceOptions({})), /name/);
    });

    it('rejects an invalid --type', () => {
      assert.throws(
        () =>
          arnsPriceParamsFromOptions(
            priceOptions({ name: 'foo', type: 'rental', processId: 'a' }),
          ),
        /type/,
      );
    });

    it('does NOT require --process-id for pricing a Buy-Name (uses a placeholder)', () => {
      const params = arnsPriceParamsFromOptions(
        priceOptions({ name: 'foo', type: 'permabuy' }),
      );
      assert.equal(params.intent, 'Buy-Name');
      assert.equal(params.name, 'foo');
      // a non-empty processId is substituted so the SDK's Buy-Name validation passes
      assert.ok(
        (params as { processId: string }).processId.length > 0,
        'a placeholder processId should be supplied for pricing',
      );
    });

    it('requires a positive --years for a lease Buy-Name', () => {
      assert.throws(
        () =>
          arnsPriceParamsFromOptions(
            priceOptions({
              name: 'foo',
              type: 'lease',
              years: '0',
              processId: 'a',
            }),
          ),
        /years/,
      );
    });
  });

  describe('arnsPrice', () => {
    it('calls getArNSPriceForName with the inferred params', async () => {
      await arnsPrice(
        priceOptions({ name: 'foo', type: 'permabuy', processId: 'ant-1' }),
        turbo,
      );
      assert.equal(turbo.last.method, 'getArNSPriceForName');
      assert.deepEqual(turbo.last.params, {
        intent: 'Buy-Name',
        name: 'foo',
        type: 'permabuy',
        processId: 'ant-1',
      });
    });
  });

  describe('buyArNSName', () => {
    it('buys a lease with the right params', async () => {
      await buyArNSName(
        purchaseOptions({
          name: 'foo',
          type: 'lease',
          years: '1',
          processId: 'ant-1',
        }),
        turbo,
      );
      assert.equal(turbo.last.method, 'buyArNSName');
      assert.deepEqual(turbo.last.params, {
        name: 'foo',
        type: 'lease',
        years: 1,
        processId: 'ant-1',
        paidBy: undefined,
      });
    });

    it('buys a permabuy (no years) and forwards paidBy', async () => {
      await buyArNSName(
        purchaseOptions({
          name: 'foo',
          type: 'permabuy',
          processId: 'ant-1',
          paidBy: ['payer-a', 'payer-b'],
        }),
        turbo,
      );
      assert.deepEqual(turbo.last.params, {
        name: 'foo',
        type: 'permabuy',
        processId: 'ant-1',
        paidBy: ['payer-a', 'payer-b'],
      });
    });

    it('requires --process-id', async () => {
      await assert.rejects(
        () =>
          buyArNSName(
            purchaseOptions({ name: 'foo', type: 'permabuy' }),
            turbo,
          ),
        /process-id/,
      );
      assert.equal(turbo.calls.length, 0);
    });

    it('requires a valid --type', async () => {
      await assert.rejects(
        () => buyArNSName(purchaseOptions({ name: 'foo' }), turbo),
        /type/,
      );
    });

    it('maps a 402 to an actionable top-up error', async () => {
      turbo.error = new InsufficientCreditsError();
      await assert.rejects(
        () =>
          buyArNSName(
            purchaseOptions({
              name: 'foo',
              type: 'permabuy',
              processId: 'ant-1',
            }),
            turbo,
          ),
        /Top up your balance/,
      );
    });
  });

  describe('extendArNSLease', () => {
    it('extends with the right params', async () => {
      await extendArNSLease(
        purchaseOptions({ name: 'foo', years: '2' }),
        turbo,
      );
      assert.equal(turbo.last.method, 'extendArNSLease');
      assert.deepEqual(turbo.last.params, {
        name: 'foo',
        years: 2,
        paidBy: undefined,
      });
    });

    it('requires a positive --years', async () => {
      await assert.rejects(
        () => extendArNSLease(purchaseOptions({ name: 'foo' }), turbo),
        /years/,
      );
    });
  });

  describe('increaseArNSUndernames', () => {
    it('increases with the right params', async () => {
      await increaseArNSUndernames(
        purchaseOptions({ name: 'foo', increaseQty: '10' }),
        turbo,
      );
      assert.equal(turbo.last.method, 'increaseArNSUndernameLimit');
      assert.deepEqual(turbo.last.params, {
        name: 'foo',
        increaseQty: 10,
        paidBy: undefined,
      });
    });

    it('requires a positive --increase-qty', async () => {
      await assert.rejects(
        () => increaseArNSUndernames(purchaseOptions({ name: 'foo' }), turbo),
        /increase-qty/,
      );
    });
  });

  describe('upgradeArNSName', () => {
    it('upgrades with the right params', async () => {
      await upgradeArNSName(purchaseOptions({ name: 'foo' }), turbo);
      assert.equal(turbo.last.method, 'upgradeArNSName');
      assert.deepEqual(turbo.last.params, { name: 'foo', paidBy: undefined });
    });
  });

  describe('arnsPurchaseStatus', () => {
    it('looks up the status by nonce', async () => {
      await arnsPurchaseStatus(
        { token: 'arweave', nonce: 'nonce-123' } as ArNSPurchaseStatusOptions,
        turbo,
      );
      assert.equal(turbo.last.method, 'getArNSPurchaseStatus');
      assert.deepEqual(turbo.last.params, { nonce: 'nonce-123' });
    });

    it('requires a --nonce', async () => {
      await assert.rejects(
        () =>
          arnsPurchaseStatus(
            { token: 'arweave' } as ArNSPurchaseStatusOptions,
            turbo,
          ),
        /nonce/,
      );
    });
  });

  describe('transferArNSAnt', () => {
    it('transfers with the right params', async () => {
      await transferArNSAnt(
        {
          token: 'arweave',
          antId: 'ant-1',
          target: 'tgt-1',
        } as TransferArNSAntOptions,
        turbo,
      );
      assert.equal(turbo.last.method, 'transferArNSAnt');
      assert.deepEqual(turbo.last.params, { antId: 'ant-1', target: 'tgt-1' });
    });

    it('requires --ant-id and --target', async () => {
      await assert.rejects(
        () =>
          transferArNSAnt(
            { token: 'arweave', target: 'tgt-1' } as TransferArNSAntOptions,
            turbo,
          ),
        /ant-id/,
      );
      await assert.rejects(
        () =>
          transferArNSAnt(
            { token: 'arweave', antId: 'ant-1' } as TransferArNSAntOptions,
            turbo,
          ),
        /target/,
      );
    });
  });

  describe('setArNSRecord', () => {
    it('sets a record with the right params', async () => {
      await setArNSRecord(
        {
          token: 'arweave',
          antId: 'ant-1',
          undername: 'docs',
          transactionId: 'tx-1',
          ttlSeconds: '900',
        } as SetArNSRecordOptions,
        turbo,
      );
      assert.equal(turbo.last.method, 'setArNSRecord');
      assert.deepEqual(turbo.last.params, {
        antId: 'ant-1',
        undername: 'docs',
        transactionId: 'tx-1',
        ttlSeconds: 900,
      });
    });

    it("defaults --undername to '@'", async () => {
      await setArNSRecord(
        {
          token: 'arweave',
          antId: 'ant-1',
          transactionId: 'tx-1',
          ttlSeconds: '900',
        } as SetArNSRecordOptions,
        turbo,
      );
      assert.equal((turbo.last.params as { undername: string }).undername, '@');
    });

    it('requires --transaction-id and a positive --ttl-seconds', async () => {
      await assert.rejects(
        () =>
          setArNSRecord(
            {
              token: 'arweave',
              antId: 'ant-1',
              ttlSeconds: '900',
            } as SetArNSRecordOptions,
            turbo,
          ),
        /transaction-id/,
      );
      await assert.rejects(
        () =>
          setArNSRecord(
            {
              token: 'arweave',
              antId: 'ant-1',
              transactionId: 'tx-1',
              ttlSeconds: '0',
            } as SetArNSRecordOptions,
            turbo,
          ),
        /ttl-seconds/,
      );
    });
  });

  describe('removeArNSRecord', () => {
    it('removes a record with the right params', async () => {
      await removeArNSRecord(
        {
          token: 'arweave',
          antId: 'ant-1',
          undername: 'docs',
        } as RemoveArNSRecordOptions,
        turbo,
      );
      assert.equal(turbo.last.method, 'removeArNSRecord');
      assert.deepEqual(turbo.last.params, {
        antId: 'ant-1',
        undername: 'docs',
      });
    });

    it('requires --ant-id and --undername', async () => {
      await assert.rejects(
        () =>
          removeArNSRecord(
            { token: 'arweave', undername: 'docs' } as RemoveArNSRecordOptions,
            turbo,
          ),
        /ant-id/,
      );
      await assert.rejects(
        () =>
          removeArNSRecord(
            { token: 'arweave', antId: 'ant-1' } as RemoveArNSRecordOptions,
            turbo,
          ),
        /undername/,
      );
    });
  });
});
