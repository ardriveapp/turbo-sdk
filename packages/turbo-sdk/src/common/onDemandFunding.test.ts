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
import { BigNumber } from 'bignumber.js';
import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';

// Through the package entry point: importing '../node/upload.js' first enters
// the upload -> index -> turbo import cycle in an order that leaves module
// constants uninitialized.
import {
  OnDemandFunding,
  TurboAuthenticatedUploadService,
  TurboCryptoFundResponse,
} from '../node/index.js';
import { Logger } from './logger.js';

/*
  The service prices an item as a per-byte rate plus a fixed per-item charge.
  These are the production figures measured on 2026-09-16: a zero-byte item
  costs 8,032,129 winc and a 1 GiB item costs 13,943,054,604,964 winc. The fake
  prices exactly that way, so the tests hold the estimate to what the service
  would actually charge.
*/
const fixedWinc = new BigNumber(8_032_129);
const gibibyteWinc = new BigNumber('13943054604964');
const perByteWinc = gibibyteWinc.minus(fixedWinc).dividedBy(2 ** 30);

const servicePrice = (bytes: number): BigNumber =>
  fixedWinc
    .plus(perByteWinc.multipliedBy(bytes))
    .integerValue(BigNumber.ROUND_UP);

/** What the SDK computed before this fix: the 1 GiB price scaled linearly. */
const linearEstimate = (bytes: number): BigNumber =>
  gibibyteWinc
    .multipliedBy(bytes)
    .dividedBy(2 ** 30)
    .integerValue(BigNumber.ROUND_UP);

class FakePaymentService {
  public balance = '0';
  public priceRequests: number[][] = [];
  public topUps: { tokenAmount: string }[] = [];

  async getBalance() {
    return { winc: this.balance, effectiveBalance: this.balance };
  }

  async getUploadCosts({ bytes }: { bytes: number[] }) {
    this.priceRequests.push(bytes);
    return bytes.map((n) => ({ winc: servicePrice(n).toFixed(0) }));
  }

  // One SOL (10^9 lamports) buys 10^9 winc, so a top-up's token amount in
  // lamports reads directly as the winc it was sized to buy.
  async getWincForToken() {
    return { winc: '1000000000' };
  }

  async topUpWithTokens(args: {
    tokenAmount: string;
  }): Promise<TurboCryptoFundResponse> {
    this.topUps.push(args);
    return {
      id: 'fund-tx',
      status: 'confirmed',
      winc: args.tokenAmount,
    } as TurboCryptoFundResponse;
  }
}

describe('on-demand funding estimate', () => {
  let payment: FakePaymentService;

  beforeEach(() => {
    payment = new FakePaymentService();
  });

  const onDemand = (
    itemByteCounts: number[],
    funding = new OnDemandFunding({}),
  ) => {
    const service = new TurboAuthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'solana',
      logger: Logger.default,
      signer: {} as never,
      paymentService: payment as never,
    });
    return (
      service as unknown as {
        onDemand(p: {
          itemByteCounts: number[];
          onDemandFunding: OnDemandFunding;
        }): Promise<TurboCryptoFundResponse | undefined>;
      }
    ).onDemand({ itemByteCounts, onDemandFunding: funding });
  };

  const toppedUpWinc = () =>
    payment.topUps.reduce(
      (sum, { tokenAmount }) => sum.plus(tokenAmount),
      new BigNumber(0),
    );

  it('quotes a single item exactly', async () => {
    await onDemand([1024], new OnDemandFunding({ topUpBufferMultiplier: 1 }));

    assert.deepEqual(payment.priceRequests, [[1024]]);
    assert.equal(toppedUpWinc().toFixed(0), servicePrice(1024).toFixed(0));
  });

  // Reported in #455: a 110,201 byte upload was under-funded by ~0.58%, so a
  // buffer of 1 failed every time.
  it('funds the full price with a buffer of 1', async () => {
    await onDemand([110201], new OnDemandFunding({ topUpBufferMultiplier: 1 }));

    assert.ok(toppedUpWinc().isGreaterThanOrEqualTo(servicePrice(110201)));
  });

  // The linear estimate says a 15M winc balance covers a 1 KiB item, which
  // really costs ~21.3M. The upload then failed with a 402.
  it('tops up a balance the linear estimate wrongly called sufficient', async () => {
    const bytes = 1024;
    payment.balance = '15000000';
    assert.ok(
      linearEstimate(bytes).isLessThan(payment.balance),
      'precondition: the old estimate treats this balance as enough',
    );

    await onDemand([bytes]);

    assert.equal(payment.topUps.length, 1, 'expected a top-up');
    assert.ok(
      toppedUpWinc()
        .plus(payment.balance)
        .isGreaterThanOrEqualTo(servicePrice(bytes)),
    );
  });

  it('does not top up when the balance covers the exact price', async () => {
    payment.balance = servicePrice(1024).toFixed(0);

    const result = await onDemand([1024]);

    assert.equal(result, undefined);
    assert.equal(payment.topUps.length, 0);
  });

  it('prices a folder the way the service charges each file', async () => {
    const itemByteCounts = Array.from(
      { length: 50 },
      (_, i) => 100 + i * 997 + 1200,
    );
    const actualCost = itemByteCounts.reduce(
      (sum, bytes) => sum.plus(servicePrice(bytes)),
      new BigNumber(0),
    );

    await onDemand(
      itemByteCounts,
      new OnDemandFunding({ topUpBufferMultiplier: 1 }),
    );

    const funded = toppedUpWinc();
    assert.ok(
      funded.isGreaterThanOrEqualTo(actualCost),
      `funded ${funded} is below the ${actualCost} the service charges`,
    );
    // Rounding up once per call keeps the estimate within a few winc.
    assert.ok(
      funded.minus(actualCost).isLessThanOrEqualTo(itemByteCounts.length),
    );
  });

  it('prices a folder with two requests, however many files it holds', async () => {
    await onDemand(Array.from({ length: 5000 }, () => 2048));

    assert.deepEqual(payment.priceRequests, [[1, 2 ** 30]]);
  });

  it('asks for no price and no top-up when nothing will be uploaded', async () => {
    const result = await onDemand([]);

    assert.equal(result, undefined);
    assert.deepEqual(payment.priceRequests, []);
    assert.equal(payment.topUps.length, 0);
  });
});
