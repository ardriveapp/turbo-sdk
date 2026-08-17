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
import { TurboHTTPService, x402UploadEndpoints } from './http.js';
import { Logger } from './logger.js';
import { makeX402Signer } from './signer.js';

/**
 * Base mainnet. The upload service advertises `network: "base"` with USDC
 * `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, and x402-fetch picks the entry
 * in `accepts` matching the wallet client's chain id — so a signer on any other
 * chain either mis-selects or fails to match at all.
 */
const baseMainnetChainId = 8453;

describe('x402 upload endpoints', () => {
  const originalFetch = globalThis.fetch;
  let requestedUrls: string[];

  beforeEach(() => {
    requestedUrls = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(typeof input === 'string' ? input : input.toString());
      return new Response(JSON.stringify({ id: 'stub-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const httpService = () =>
    new TurboHTTPService({
      url: 'https://upload.example.com/v1',
      logger: Logger.default,
      retryConfig: {
        retries: 1,
        retryDelay: () => 0,
        onRetry: () => undefined,
      },
    });

  // Regression for #440: these posted to `/x402/data-item/*`, but the upload
  // service renamed the routes to `/x402/upload/*` and only kept a
  // `data-item/signed` alias — so every unsigned x402 upload 404ed.
  it('posts signed x402 uploads to /v1/x402/upload/signed', async () => {
    await httpService().post({
      endpoint: '/ignored-when-x402',
      data: Buffer.from('hello'),
      x402Options: { signer: {} as never, unsignedData: false },
    });

    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/x402/upload/signed',
    ]);
  });

  it('posts unsigned x402 uploads to /v1/x402/upload/unsigned', async () => {
    await httpService().post({
      endpoint: '/ignored-when-x402',
      data: Buffer.from('hello'),
      x402Options: { signer: {} as never, unsignedData: true },
    });

    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/x402/upload/unsigned',
    ]);
  });

  it('never references the retired /x402/data-item/* routes', () => {
    assert.equal(x402UploadEndpoints.signed, '/x402/upload/signed');
    assert.equal(x402UploadEndpoints.unsigned, '/x402/upload/unsigned');
  });
});

describe('makeX402Signer', () => {
  // Regression for #441: both branches hardcoded `chain: baseSepolia` (84532)
  // while the deployed service settles on Base mainnet.
  it('builds a wallet client on the chain the upload service settles on', async () => {
    const signer = (await makeX402Signer(
      new EthereumSigner(testEthWallet),
    )) as unknown as { chain?: { id: number } };

    assert.equal(signer.chain?.id, baseMainnetChainId);
  });
});
