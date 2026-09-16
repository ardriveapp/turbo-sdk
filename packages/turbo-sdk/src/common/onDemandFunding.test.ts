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
import { HexSolanaSigner } from '@dha-team/arbundles';
import { BigNumber } from 'bignumber.js';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { testSolWallet } from '../../tests/helpers.js';
// Through the package entry point: importing '../node/upload.js' first enters
// the upload -> index -> turbo import cycle in an order that leaves module
// constants uninitialized.
import {
  FailedRequestError,
  OnDemandFunding,
  TurboAuthenticatedUploadService,
  TurboCryptoFundResponse,
  TurboNodeSigner,
  TurboUploadDataItemResponse,
  TurboUploadFolderParams,
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

  // A folder's estimate must never come in under the service price, or a
  // balance equal to the estimate skips a top-up the upload needs.
  it('never prices a folder below the service, including items over 1 GiB', async () => {
    const itemByteCounts = [2 ** 31, 2 ** 31, 3 * 2 ** 30, 1200, 2 ** 30];
    const actualCost = itemByteCounts.reduce(
      (sum, bytes) => sum.plus(servicePrice(bytes)),
      new BigNumber(0),
    );

    await onDemand(
      itemByteCounts,
      new OnDemandFunding({ topUpBufferMultiplier: 1 }),
    );

    assert.ok(
      toppedUpWinc().isGreaterThanOrEqualTo(actualCost),
      `funded ${toppedUpWinc()} is below the ${actualCost} the service charges`,
    );
  });

  // The case CodeRabbit raised on #480: extrapolating past 1 GiB lands low.
  it('quotes items over 1 GiB exactly instead of extrapolating', async () => {
    await onDemand(
      [2048, 4096, 2 ** 31, 2 ** 31],
      new OnDemandFunding({ topUpBufferMultiplier: 1 }),
    );

    assert.deepEqual(payment.priceRequests, [[1, 2 ** 30, 2 ** 31, 2 ** 31]]);
    const actualCost = [2048, 4096, 2 ** 31, 2 ** 31].reduce(
      (sum, bytes) => sum.plus(servicePrice(bytes)),
      new BigNumber(0),
    );
    assert.ok(toppedUpWinc().isGreaterThanOrEqualTo(actualCost));
  });

  // The service rounds each item up. Rounding only the folder total can land
  // up to one winc per item below the sum of those rounded prices.
  it('never prices a folder below the service across many item sizes', async () => {
    let seed = 7;
    const nextSize = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return 1200 + (seed % 5_000_000);
    };

    for (let run = 0; run < 300; run++) {
      payment = new FakePaymentService();
      const itemByteCounts = Array.from({ length: 2 + (run % 40) }, nextSize);
      const actualCost = itemByteCounts.reduce(
        (sum, bytes) => sum.plus(servicePrice(bytes)),
        new BigNumber(0),
      );

      await onDemand(
        itemByteCounts,
        new OnDemandFunding({ topUpBufferMultiplier: 1 }),
      );

      assert.ok(
        toppedUpWinc().isGreaterThanOrEqualTo(actualCost),
        `run ${run}: funded ${toppedUpWinc()}, service charges ${actualCost}`,
      );
    }
  });

  it('estimates a folder with two price requests, however many files it holds', async () => {
    await onDemand(Array.from({ length: 5000 }, () => 2048));

    assert.deepEqual(payment.priceRequests, [[1, 2 ** 30]]);
  });

  // #472: the message divided the top-up by the exponent (9 for solana) rather
  // than 10^9, and printed the ceiling in base units, so a top-up 2.7x over the
  // limit read as far under it.
  it('reports the ceiling in whole tokens', async () => {
    const bytes = 1024 * 1024; // costs ~13.6 SOL at this fake's rate
    const funding = new OnDemandFunding({
      topUpBufferMultiplier: 1,
      maxTokenAmount: 5_000_000_000, // 5 SOL, in lamports
    });

    await assert.rejects(onDemand([bytes], funding), (error: Error) => {
      assert.match(
        error.message,
        /^Top up token amount 13\.62\d* solana is greater than the maximum allowed amount of 5 solana$/,
      );
      return true;
    });
    assert.equal(payment.topUps.length, 0, 'nothing may be spent');
  });

  it('asks for no price and no top-up when nothing will be uploaded', async () => {
    const result = await onDemand([]);

    assert.equal(result, undefined);
    assert.deepEqual(payment.priceRequests, []);
    assert.equal(payment.topUps.length, 0);
  });
});

/** Also moves the balance: a top-up credits it and an upload spends it. */
class LedgerPaymentService extends FakePaymentService {
  async topUpWithTokens(args: {
    tokenAmount: string;
  }): Promise<TurboCryptoFundResponse> {
    this.balance = new BigNumber(this.balance)
      .plus(args.tokenAmount)
      .toFixed(0);
    return super.topUpWithTokens(args);
  }

  charge(dataItemByteCount: number) {
    const price = servicePrice(dataItemByteCount);
    if (price.isGreaterThan(this.balance)) {
      throw new FailedRequestError('Insufficient balance', 402);
    }
    this.balance = new BigNumber(this.balance).minus(price).toFixed(0);
  }
}

describe('on-demand funding for a folder', () => {
  let folderPath: string;
  let ledger: LedgerPaymentService;

  beforeEach(() => {
    folderPath = mkdtempSync(join(tmpdir(), 'turbo-on-demand-'));
    ledger = new LedgerPaymentService();
  });

  afterEach(() => {
    rmSync(folderPath, { recursive: true, force: true });
  });

  // Signs for real, so every data item has its true size, and spends from the
  // ledger the way the service does. Each item, the manifest included, still
  // runs its own on-demand check before it uploads.
  const uploadFolder = (
    params: Omit<TurboUploadFolderParams, 'folderPath'>,
  ) => {
    const service = new TurboAuthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'solana',
      logger: Logger.default,
      signer: new TurboNodeSigner({
        signer: new HexSolanaSigner(testSolWallet),
        token: 'solana',
      }),
      paymentService: ledger as never,
    });
    let uploads = 0;
    (
      service as unknown as {
        uploadSignedDataItem: (p: {
          dataItemSizeFactory: () => number;
        }) => Promise<TurboUploadDataItemResponse>;
      }
    ).uploadSignedDataItem = async ({ dataItemSizeFactory }) => {
      ledger.charge(dataItemSizeFactory());
      return {
        id: `item${uploads++}`.padEnd(43, 'x'),
      } as TurboUploadDataItemResponse;
    };
    return service.uploadFolder({
      folderPath,
      ...params,
    } as TurboUploadFolderParams);
  };

  const appTags = [
    { name: 'App-Name', value: 'Example-Site-Publisher' },
    { name: 'App-Version', value: '2.4.1' },
    { name: 'Description', value: 'A static site. '.repeat(20) },
  ];

  // Found in review of #480. The manifest spends the same balance, so a
  // top-up sized for the files alone left it short and it bought its own.
  it('funds the files and the manifest with one top-up', async () => {
    writeFileSync(join(folderPath, 'index.html'), 'x'.repeat(1024));

    const result = await uploadFolder({
      dataItemOpts: { tags: appTags },
      fundingMode: new OnDemandFunding({ topUpBufferMultiplier: 1 }),
    });

    assert.ok(result.manifestResponse, 'expected a manifest upload');
    assert.equal(ledger.topUps.length, 1);
  });

  // A long name appears twice in the manifest: once in its paths and once as
  // the index.
  it('funds a manifest with a long file name in the same top-up', async () => {
    writeFileSync(
      join(folderPath, 'n'.repeat(200) + '.html'),
      'x'.repeat(1024),
    );

    await uploadFolder({ fundingMode: new OnDemandFunding({}) });

    assert.equal(ledger.topUps.length, 1);
  });

  it('funds a folder of many files and its manifest in one top-up', async () => {
    for (let i = 0; i < 40; i++) {
      writeFileSync(
        join(folderPath, `page-${i}-${'p'.repeat(i * 3)}.html`),
        'x'.repeat(100 + i * 331),
      );
    }

    await uploadFolder({
      dataItemOpts: { tags: appTags },
      fundingMode: new OnDemandFunding({ topUpBufferMultiplier: 1 }),
    });

    assert.equal(ledger.topUps.length, 1);
  });

  it('prices only the files when the manifest is disabled', async () => {
    writeFileSync(join(folderPath, 'index.html'), 'x'.repeat(1024));

    const result = await uploadFolder({
      manifestOptions: { disableManifest: true },
      fundingMode: new OnDemandFunding({ topUpBufferMultiplier: 1 }),
    });

    assert.equal(result.manifestResponse, undefined);
    // One item, so the folder's estimate is a single exact quote.
    assert.deepEqual(ledger.priceRequests[0], [1024 + 1200]);
    assert.equal(ledger.topUps.length, 1);
  });
});
