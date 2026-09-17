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
import { EthereumSigner } from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { testEthWallet } from '../../tests/helpers.js';
import { TurboLogger } from '../types.js';
import { FailedRequestError } from '../utils/errors.js';
import { ChunkedUploader } from './chunked.js';
import { TurboHTTPService } from './http.js';
// Via the barrel, not './upload.js': entering the upload -> index -> turbo ->
// upload cycle at upload.ts leaves `developmentUploadServiceURL` uninitialized.
import { TurboUnauthenticatedUploadService } from './index.js';

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  setLogLevel: () => undefined,
  setLogFormat: () => undefined,
} as unknown as TurboLogger;

// The body ar-io-bundler's raw x402 route sends with its 201, once the
// payment has settled and the data item is stored.
const receipt = {
  id: 'raw-item-id',
  timestamp: 1789600000000,
  version: '0.2.0',
  deadlineHeight: 1900000,
  dataCaches: ['arweave.net'],
  fastFinalityIndexes: ['arweave.net'],
  winc: '1377000',
  public: 'service-public-key',
  signature: 'receipt-signature',
};
const settledBody = {
  id: 'raw-item-id',
  owner: 'raw-data-item-wallet',
  payer: '0x0000000000000000000000000000000000000001',
  dataCaches: ['arweave.net'],
  fastFinalityIndexes: ['arweave.net'],
  receipt,
  x402Payment: {
    paymentId: 'payment-id',
    transactionHash: '0xabc',
    network: 'base',
    mode: 'payg',
  },
};

describe('raw x402 upload response', () => {
  const originalFetch = globalThis.fetch;
  let status: number;
  let requests: number;

  beforeEach(() => {
    status = 201;
    requests = 0;
    globalThis.fetch = (async () => {
      requests++;
      return new Response(JSON.stringify(settledBody), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const service = () =>
    new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: silentLogger,
    });

  const assertReceipt = (result: Record<string, unknown>) => {
    assert.equal(result.id, 'raw-item-id');
    assert.equal(result.owner, 'raw-data-item-wallet');
    assert.equal(result.winc, '1377000');
    assert.equal(result.timestamp, 1789600000000);
    assert.equal(result.deadlineHeight, 1900000);
    assert.equal(result.signature, 'receipt-signature');
    assert.equal(result.public, 'service-public-key');
  };

  // The paid path: a settled upload must not be reported as a failure, or
  // the caller retries and pays again.
  it('accepts the 201 for a paid upload, and sends it once', async () => {
    const result = await service().uploadRawX402Data({
      data: Buffer.from('hello'),
      signer: { signer: new EthereumSigner(testEthWallet) } as never,
    });

    assertReceipt(result as unknown as Record<string, unknown>);
    assert.equal(requests, 1);
  });

  it('accepts the 201 without a signer', async () => {
    const result = await service().uploadRawX402Data({
      data: Buffer.from('hello'),
    });

    assertReceipt(result as unknown as Record<string, unknown>);
  });

  it('keeps the payment details the service returns', async () => {
    const result = (await service().uploadRawX402Data({
      data: Buffer.from('hello'),
    })) as unknown as typeof settledBody;

    assert.equal(result.payer, settledBody.payer);
    assert.deepEqual(result.x402Payment, settledBody.x402Payment);
    assert.deepEqual(result.receipt, receipt);
  });

  it('still rejects an error status', async () => {
    status = 400;

    await assert.rejects(
      service().uploadRawX402Data({ data: Buffer.from('hello') }),
      (error: FailedRequestError) => error.status === 400,
    );
  });
});

describe('chunked finalize response', () => {
  // Answers finalize the way the service does for an item it already holds
  // when it cannot sign a fresh receipt: 201. The real HTTP service throws for
  // any status the caller did not allow, so this does too.
  const httpAnsweringFinalizeWith = (finalizeStatus: number) =>
    ({
      post: async ({ allowedStatuses = [200, 202] }) => {
        if (!allowedStatuses.includes(finalizeStatus)) {
          throw new FailedRequestError('stored already', finalizeStatus);
        }
        return {};
      },
      get: async () => ({ status: 'FINALIZED', receipt }),
    }) as unknown as TurboHTTPService;

  const finalize = (http: TurboHTTPService) => {
    const uploader = new ChunkedUploader({
      http,
      token: 'arweave',
      logger: silentLogger,
      dataItemByteCount: 12 * 1024 * 1024,
      chunkingMode: 'force',
      maxFinalizeMs: 400,
    });
    return (
      uploader as unknown as {
        finalizeUpload: (id: string, bytes: number) => Promise<unknown>;
      }
    ).finalizeUpload('upload-id', 12 * 1024 * 1024);
  };

  it('treats a 201 from finalize as accepted and returns the receipt', async () => {
    assert.deepEqual(await finalize(httpAnsweringFinalizeWith(201)), receipt);
  });
});
