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
import { ArweaveSigner, EthereumSigner } from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { testEthWallet, testJwk } from '../../tests/helpers.js';
import { TurboHTTPService, x402UploadEndpoints } from './http.js';
// Via the barrel, not './upload.js': entering the upload -> index -> turbo ->
// upload cycle at upload.ts leaves `developmentUploadServiceURL` uninitialized.
import { TurboUnauthenticatedUploadService } from './index.js';
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

  // `uploadRawX402Data` names the route a second time, independently of the one
  // `x402Post` computes, and that copy is the live one when no signer is passed
  // (no signer -> no x402Options -> the plain POST path). It carried the same
  // retired path, so #440 reproduced through this function specifically.
  it('sends uploadRawX402Data to /v1/x402/upload/unsigned without a signer', async () => {
    const service = new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'base-usdc',
      logger: Logger.default,
    });

    await service.uploadRawX402Data({
      data: Buffer.from('hello'),
      tags: [{ name: 'Content-Type', value: 'text/plain' }],
    });

    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/x402/upload/unsigned',
    ]);
  });

  it('rejects uploadRawX402Data for tokens without x402 support', async () => {
    const service = new TurboUnauthenticatedUploadService({
      url: 'https://upload.example.com',
      token: 'arweave',
      logger: Logger.default,
    });

    await assert.rejects(
      () => service.uploadRawX402Data({ data: Buffer.from('hello') }),
      /x402 uploads are not supported for token: arweave/,
    );
    assert.deepEqual(requestedUrls, []);
  });
});

describe('makeX402Signer', () => {
  // Regression for #441: BOTH branches hardcoded `chain: baseSepolia` (84532)
  // while the deployed service settles on Base mainnet, so both are asserted.
  it('builds a wallet client on the chain the upload service settles on', async () => {
    const signer = (await makeX402Signer(
      new EthereumSigner(testEthWallet),
    )) as unknown as { chain?: { id: number } };

    assert.equal(signer.chain?.id, baseMainnetChainId);
  });

  describe('browser branch', () => {
    const account = '0x1234567890123456789012345678901234567890';
    let requests: string[];

    beforeEach(() => {
      requests = [];
      (globalThis as Record<string, unknown>).window = {
        document: {},
        ethereum: {
          request: async ({ method }: { method: string }) => {
            requests.push(method);
            if (method === 'eth_requestAccounts') return [account];
            return null;
          },
        },
      };
    });

    afterEach(() => {
      delete (globalThis as Record<string, unknown>).window;
    });

    it('also builds the injected-wallet client on Base mainnet', async () => {
      // A non-Ethereum arbundles signer falls through to the injected-wallet
      // branch, which is the path browser consumers take.
      const signer = (await makeX402Signer(
        new ArweaveSigner(testJwk),
      )) as unknown as {
        chain?: { id: number };
        account?: { address: string };
      };

      assert.equal(signer.chain?.id, baseMainnetChainId);
      assert.deepEqual(requests, ['eth_requestAccounts']);
    });

    it('throws when the wallet returns no accounts', async () => {
      (
        (globalThis as Record<string, unknown>).window as {
          ethereum: { request: () => Promise<unknown> };
        }
      ).ethereum.request = async () => [];

      await assert.rejects(
        () => makeX402Signer(new ArweaveSigner(testJwk)),
        /No accounts returned from wallet/,
      );
    });
  });
});
