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

import { TurboLogger } from '../types.js';
import { TurboHTTPService } from './http.js';

const silentLogger = {
  debug: () => undefined,
  info: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  setLogLevel: () => undefined,
  setLogFormat: () => undefined,
} as unknown as TurboLogger;

type Recorded = { url: string; init: RequestInit };

/**
 * Replaces the global fetch, which is what `wrapFetchWithPayment` is handed on
 * the paid path, so the request options the SDK builds can be inspected without
 * a network or a bundler. Answering 200 means the x402 wrapper passes the
 * response straight through rather than starting a payment.
 */
function recordFetch(): { calls: Recorded[]; restore: () => void } {
  const calls: Recorded[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ id: 'upload-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { calls, restore: () => void (globalThis.fetch = real) };
}

const headerOf = (init: RequestInit, name: string): string | undefined => {
  const h = init.headers as Record<string, string> | undefined;
  if (h === undefined) return undefined;
  const key = Object.keys(h).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  return key === undefined ? undefined : h[key];
};

describe('TurboHTTPService', () => {
  let restore: (() => void) | undefined;
  afterEach(() => {
    restore?.();
    restore = undefined;
  });

  const service = () =>
    new TurboHTTPService({
      url: 'https://upload.example',
      logger: silentLogger,
      retryConfig: {
        // At least one: withRetry loops `while (retries < maxRetries)`, so 0
        // never enters the body and reports "Max retries reached" immediately.
        retries: 1,
        retryDelay: () => 0,
        onRetry: () => undefined,
      },
    });

  describe('the x402-paid GET', () => {
    it('forbids caching of the paid create response', async () => {
      const { calls, restore: r } = recordFetch();
      restore = r;

      await service().get({
        endpoint: '/chunks/-1/-1',
        x402Options: {
          signer: {} as never,
          maxMUSDCAmount: 1000n,
        } as never,
      });

      assert.equal(calls.length, 1);
      // This GET settles a payment and returns the upload id it bought. A
      // cached or replayed copy would hand a second caller an upload someone
      // else paid for, so the request must forbid storing it.
      assert.equal(headerOf(calls[0].init, 'Cache-Control'), 'no-store');
    });

    it('keeps the caller headers it was given', async () => {
      const { calls, restore: r } = recordFetch();
      restore = r;

      await service().get({
        endpoint: '/chunks/-1/-1',
        headers: { 'x-custom': 'kept' },
        x402Options: {
          signer: {} as never,
          maxMUSDCAmount: 1000n,
        } as never,
      });

      assert.equal(headerOf(calls[0].init, 'x-custom'), 'kept');
      assert.equal(headerOf(calls[0].init, 'Cache-Control'), 'no-store');
    });
  });

  describe('the unpaid GET', () => {
    it('is left alone: nothing is bought, so nothing needs the header', async () => {
      const { calls, restore: r } = recordFetch();
      restore = r;

      await service().get({ endpoint: '/account/balance/arweave' });

      assert.equal(calls.length, 1);
      assert.equal(headerOf(calls[0].init, 'Cache-Control'), undefined);
    });
  });
});
