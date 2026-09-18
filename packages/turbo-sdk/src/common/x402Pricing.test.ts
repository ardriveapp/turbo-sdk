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
import { afterEach, beforeEach, describe, it } from 'node:test';

import { testEthWallet } from '../../tests/helpers.js';
import { TurboFactory } from '../node/factory.js';
import {
  TurboX402DataItemPriceResponse,
  TurboX402RawDataPriceResponse,
} from '../types.js';
import { TurboHTTPService } from './http.js';
import { TurboUnauthenticatedUploadService } from './index.js';
import { Logger } from './logger.js';

describe('x402 price lookups', () => {
  const originalFetch = globalThis.fetch;
  let requestedUrls: string[];

  beforeEach(() => {
    requestedUrls = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(typeof input === 'string' ? input : input.toString());
      return new Response(JSON.stringify({ usdcAmount: '1234' }), {
        status: 200,
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
      logger: Logger.default,
    });

  it('prices a signed data item, defaulting to base mainnet', async () => {
    await service().getX402PriceForDataItem({ byteCount: 2048 });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data-item/usdc-base/2048',
    ]);
  });

  /*
    The route builds its token as `usdc-{network}`, NOT from the SDK's
    TokenType. `base-usdc` is accepted on mainnet only because the network
    there is literally `base`; a testnet caller must say so.
  */
  it('takes an explicit network for testnet', async () => {
    await service().getX402PriceForDataItem({
      byteCount: 2048,
      network: 'base-sepolia',
    });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data-item/usdc-base-sepolia/2048',
    ]);
  });

  it('prices raw data with no query when nothing optional is given', async () => {
    await service().getX402PriceForRawData({ byteCount: 4096 });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data/usdc-base/4096',
    ]);
  });

  it('passes tagCount and contentType, which change the estimated overhead', async () => {
    await service().getX402PriceForRawData({
      byteCount: 4096,
      network: 'base-sepolia',
      tagCount: 3,
      contentType: 'image/png',
    });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data/usdc-base-sepolia/4096?tags=3&contentType=image%2Fpng',
    ]);
  });

  it('omits either optional parameter independently', async () => {
    await service().getX402PriceForRawData({ byteCount: 10, tagCount: 2 });
    await service().getX402PriceForRawData({
      byteCount: 10,
      contentType: 'text/plain',
    });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data/usdc-base/10?tags=2',
      'https://upload.example.com/v1/price/x402/data/usdc-base/10?contentType=text%2Fplain',
    ]);
  });
});

/*
  The response types must match what the service sends. These bodies are the
  key sets production returned on 2026-09-16 (values replaced). The data-item
  route sends no `winstonCost`: typing it as present told callers they could
  read a field that is always undefined.
*/
describe('x402 price response shapes', () => {
  it('types a data-item price without winstonCost', () => {
    const body: TurboX402DataItemPriceResponse = {
      token: 'usdc-base',
      currency: 'usdc',
      network: 'base',
      byteCount: 1024,
      usdcAmount: '1',
      x402Version: 1,
      payment: {} as TurboX402DataItemPriceResponse['payment'],
    };
    // @ts-expect-error the data-item route never sends winstonCost
    assert.equal(body.winstonCost, undefined);
  });

  it('types a raw-data price with winstonCost', () => {
    const body: TurboX402RawDataPriceResponse = {
      token: 'usdc-base',
      currency: 'usdc',
      network: 'base',
      winstonCost: '1000',
      usdcAmount: '1',
      x402Version: 1,
      payment: {} as TurboX402RawDataPriceResponse['payment'],
      rawDataSize: 1024,
      userTagCount: 0,
      systemTagCount: 4,
      totalTagCount: 4,
      estimatedDataItemSize: 1700,
      overhead: 676,
    };
    assert.equal(body.winstonCost, '1000');
  });
});

describe('x402 refuses cleartext', () => {
  const signer = {} as never;

  const httpService = (url: string) =>
    new TurboHTTPService({
      url,
      logger: Logger.default,
      retryConfig: {
        retries: 1,
        retryDelay: () => 0,
        onRetry: () => undefined,
      },
    });

  /*
    An x402 authorization is a bearer credential — whoever observes it can
    submit it — so a misconfigured cleartext URL must fail loudly rather than
    hand the credential to the network.
  */
  it('rejects a non-HTTPS URL on the POST path before signing', async () => {
    await assert.rejects(
      httpService('http://upload.example.com/v1').post({
        endpoint: '/tx/base-usdc',
        data: Buffer.from('hello'),
        x402Options: { signer },
      }),
      /non-HTTPS/,
    );
  });

  it('rejects a non-HTTPS URL on the GET path before signing', async () => {
    await assert.rejects(
      httpService('http://upload.example.com/v1').get({
        endpoint: '/chunks/base-usdc/-1/-1',
        x402Options: { signer },
      }),
      /non-HTTPS/,
    );
  });

  it('treats an unparseable URL as insecure rather than throwing', async () => {
    // isLoopback cannot parse it, so the guard must refuse rather than let a
    // malformed URL through on a technicality.
    await assert.rejects(
      httpService('not-a-url').post({
        endpoint: '/tx/base-usdc',
        data: Buffer.from('x'),
        x402Options: { signer },
      }),
      /non-HTTPS/,
    );
  });

  it('allows loopback, so local development still works', async () => {
    // Fails on connection, not on the cleartext guard.
    await assert.rejects(
      httpService('http://localhost:9/v1').get({
        endpoint: '/chunks/base-usdc/-1/-1',
        x402Options: { signer },
      }),
      (e: Error) => !/non-HTTPS/.test(e.message),
    );
  });

  /*
    An IPv6 hostname keeps its brackets: the hostname of `http://[::1]:9` is
    `[::1]`. Comparing it with a bare `::1` never matched, so IPv6 loopback
    was refused although the README lists it as exempt.
  */
  it('allows IPv6 loopback too', async () => {
    await assert.rejects(
      httpService('http://[::1]:9/v1').get({
        endpoint: '/chunks/base-usdc/-1/-1',
        x402Options: { signer },
      }),
      (e: Error) => !/non-HTTPS/.test(e.message),
    );
  });

  it('still refuses an IPv6 address that is not loopback', async () => {
    await assert.rejects(
      httpService('http://[2001:db8::1]/v1').get({
        endpoint: '/chunks/base-usdc/-1/-1',
        x402Options: { signer },
      }),
      /non-HTTPS/,
    );
  });
});

/*
  The clients delegate to the upload service. Covered separately because the
  delegation is where a wrong argument name or a dropped parameter would hide —
  the service tests above would still pass.
*/
describe('x402 price lookups through the clients', () => {
  const originalFetch = globalThis.fetch;
  let requestedUrls: string[];

  beforeEach(() => {
    requestedUrls = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      requestedUrls.push(typeof input === 'string' ? input : input.toString());
      return new Response(JSON.stringify({ usdcAmount: '1234' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reaches the routes from an unauthenticated client', async () => {
    const turbo = TurboFactory.unauthenticated({
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });
    await turbo.getX402PriceForDataItem({
      byteCount: 64,
      network: 'base-sepolia',
    });
    await turbo.getX402PriceForRawData({ byteCount: 64, tagCount: 1 });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data-item/usdc-base-sepolia/64',
      'https://upload.example.com/v1/price/x402/data/usdc-base/64?tags=1',
    ]);
  });

  it('reaches the routes from an authenticated client', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testEthWallet,
      token: 'base-usdc',
      uploadServiceConfig: { url: 'https://upload.example.com' },
    });
    await turbo.getX402PriceForDataItem({ byteCount: 128 });
    await turbo.getX402PriceForRawData({
      byteCount: 128,
      contentType: 'text/plain',
    });
    assert.deepEqual(requestedUrls, [
      'https://upload.example.com/v1/price/x402/data-item/usdc-base/128',
      'https://upload.example.com/v1/price/x402/data/usdc-base/128?contentType=text%2Fplain',
    ]);
  });
});
