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
import { Readable } from 'node:stream';
import { afterEach, describe, it } from 'node:test';
import { createWalletClient, http as viemHttp } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

import { TurboFactory } from '../node/factory.js';
import { X402Funding } from '../types.js';
import {
  FailedRequestError,
  X402PaymentOutcomeUnknownError,
} from '../utils/errors.js';

/*
  One uploadFile call must pay at most once.

  The real x402-fetch signs a new authorization, with a new nonce, every time
  it meets a 402. So if a paid request's answer is lost and uploadFile retries,
  each retry is a new payment the service can settle. These tests answer the
  paid request with a 503 or a network error, after the payment has gone out,
  and count the authorizations sent.
*/

const ETH_KEY = `0x${'01'.repeat(32)}` as const;
const payer = privateKeyToAccount(ETH_KEY).address;

const x402Signer = () =>
  createWalletClient({
    account: privateKeyToAccount(ETH_KEY),
    chain: baseSepolia,
    transport: viemHttp('https://rpc.invalid'),
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const paymentRequired = (resource: string) =>
  json(
    {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          network: 'base-sepolia',
          maxAmountRequired: '1000',
          resource,
          description: 'upload',
          mimeType: 'application/json',
          payTo: '0x0000000000000000000000000000000000000001',
          maxTimeoutSeconds: 60,
          asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
          extra: { name: 'USDC', version: '2' },
        },
      ],
      error: 'X-PAYMENT header is required',
    },
    402,
  );

type PaidOutcome =
  | '503'
  | 'network'
  | 'abortLike'
  | 'brokenBody'
  | '400'
  | 'ok';

/**
 * Stands in for the upload service. The paid route answers 402 until a request
 * carries X-PAYMENT, then answers with `paidOutcome`. Records every nonce.
 */
function stubService({
  paidRoute,
  paidOutcome,
  finalizeFailures = 0,
}: {
  paidRoute: string;
  paidOutcome: PaidOutcome;
  finalizeFailures?: number;
}) {
  const nonces: string[] = [];
  let finalizes = 0;
  const fetchStub = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(paidRoute)) {
      const payment = new Headers(init?.headers).get('X-PAYMENT');
      if (payment === null) {
        return paymentRequired(url);
      }
      nonces.push(
        JSON.parse(Buffer.from(payment, 'base64').toString('utf8')).payload
          .authorization.nonce,
      );
      if (paidOutcome === '503') {
        return new Response('Service Unavailable', { status: 503 });
      }
      if (paidOutcome === 'network') {
        throw new TypeError('fetch failed');
      }
      if (paidOutcome === 'abortLike') {
        // Not the caller's abort: the message merely says "aborted".
        throw new Error('read ECONNRESET: request aborted');
      }
      if (paidOutcome === 'brokenBody') {
        return new Response('{"id": "trunc', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (paidOutcome === '400') {
        return new Response('invalid data item', { status: 400 });
      }
      return json({
        id: 'paid-upload-1',
        chunkSize: 5 * 1024 * 1024,
        owner: payer,
        winc: '0',
      });
    }
    if (url.includes('/finalize')) {
      finalizes++;
      return finalizes <= finalizeFailures
        ? json({ error: 'transient' }, 500)
        : json({ id: 'data-item-id', winc: '0' });
    }
    if (url.includes('/status')) {
      return json({ status: 'FINALIZED', receipt: { id: 'data-item-id' } });
    }
    if (url.startsWith('https://upload.example.com/')) {
      return json({});
    }
    throw new Error(`unexpected request to ${url}`);
  }) as typeof fetch;
  return { fetchStub, nonces, finalizes: () => finalizes };
}

const upload = ({
  byteCount,
  chunkingMode,
  retries = 5,
}: {
  byteCount: number;
  chunkingMode?: 'force';
  retries?: number;
}) =>
  TurboFactory.authenticated({
    privateKey: ETH_KEY,
    token: 'base-usdc',
    uploadServiceConfig: {
      url: 'https://upload.example.com',
      retryConfig: {
        retries,
        retryDelay: () => 0,
        onRetry: () => undefined,
      },
    },
  }).uploadFile({
    fileStreamFactory: () => Readable.from(Buffer.alloc(byteCount, 1)),
    fileSizeFactory: () => byteCount,
    chunkingMode,
    fundingMode: new X402Funding({ signer: x402Signer() as never }),
  });

const chunkedCreate = '/chunks/base-usdc/-1/-1';
const singleRequest = '/x402/upload/signed';

describe('uploadFile pays at most once when a paid answer is lost', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  for (const [name, paidRoute, chunkingMode] of [
    ['chunked create', chunkedCreate, 'force'],
    ['single signed request', singleRequest, undefined],
  ] as const) {
    for (const paidOutcome of ['503', 'network'] as const) {
      it(`${name}: sends one authorization after a ${paidOutcome} and says it might have settled`, async () => {
        const service = stubService({ paidRoute, paidOutcome });
        globalThis.fetch = service.fetchStub;

        const error = await upload({ byteCount: 1024, chunkingMode }).then(
          () => undefined,
          (e: unknown) => e,
        );

        assert.equal(service.nonces.length, 1, 'one paid request');
        assert.equal(new Set(service.nonces).size, 1, 'one distinct nonce');
        assert.ok(error instanceof X402PaymentOutcomeUnknownError);
        assert.match(error.message, /after 1 attempt\n/);
        assert.match(error.message, /might have settled/);
        assert.equal(error.payer, payer);
        assert.equal(error.network, 'base-sepolia');
        assert.equal(error.nonce, service.nonces[0]);
        if (paidOutcome === '503') {
          assert.equal(error.status, 503);
        }
      });
    }
  }

  it('treats an error that only says "aborted" as an unknown outcome', async () => {
    const service = stubService({
      paidRoute: singleRequest,
      paidOutcome: 'abortLike',
    });
    globalThis.fetch = service.fetchStub;

    const error = await upload({ byteCount: 1024 }).then(
      () => undefined,
      (e: unknown) => e,
    );

    assert.equal(service.nonces.length, 1, 'one paid request');
    assert.ok(error instanceof X402PaymentOutcomeUnknownError);
  });

  it('treats an unreadable body on a paid 200 as an unknown outcome', async () => {
    const service = stubService({
      paidRoute: singleRequest,
      paidOutcome: 'brokenBody',
    });
    globalThis.fetch = service.fetchStub;

    const error = await upload({ byteCount: 1024 }).then(
      () => undefined,
      (e: unknown) => e,
    );

    assert.equal(service.nonces.length, 1, 'one paid request');
    assert.ok(error instanceof X402PaymentOutcomeUnknownError);
    assert.equal(error.status, 200);
  });

  it('throws a 4xx after payment unchanged: the service answered', async () => {
    const service = stubService({
      paidRoute: singleRequest,
      paidOutcome: '400',
    });
    globalThis.fetch = service.fetchStub;

    const error = await upload({ byteCount: 1024 }).then(
      () => undefined,
      (e: unknown) => e,
    );

    assert.equal(service.nonces.length, 1, 'one paid request');
    assert.ok(error instanceof FailedRequestError);
    assert.ok(!(error instanceof X402PaymentOutcomeUnknownError));
    assert.equal(error.status, 400);
  });

  it('chunked: resumes without paying again when the upload id is known', async () => {
    // Finalize fails past the uploader's own retries, so uploadFile retries.
    const service = stubService({
      paidRoute: chunkedCreate,
      paidOutcome: 'ok',
      finalizeFailures: 5,
    });
    globalThis.fetch = service.fetchStub;

    const result = await upload({ byteCount: 1024, chunkingMode: 'force' });

    assert.equal(result.id, 'data-item-id');
    assert.ok(service.finalizes() > 5, 'the attempt was retried');
    assert.equal(service.nonces.length, 1, 'one paid request');
  });
});

describe('uploadFile attempt count', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const failingUpload = async (retries: number) => {
    let posts = 0;
    globalThis.fetch = (async () => {
      posts++;
      return new Response('down', { status: 503 });
    }) as typeof fetch;
    let error: Error | undefined;
    try {
      await TurboFactory.authenticated({
        privateKey: ETH_KEY,
        token: 'base-usdc',
        uploadServiceConfig: {
          url: 'https://upload.example.com',
          retryConfig: {
            retries,
            retryDelay: () => 0,
            onRetry: () => undefined,
          },
        },
      }).uploadFile({
        fileStreamFactory: () => Readable.from(Buffer.alloc(16, 1)),
        fileSizeFactory: () => 16,
      });
    } catch (e) {
      error = e;
    }
    return { posts, error };
  };

  it('reports the attempts it made', async () => {
    const { posts, error } = await failingUpload(3);
    assert.equal(posts, 3);
    assert.ok(error instanceof FailedRequestError);
    assert.match(error.message, /Failed to upload file after 3 attempts/);
  });

  it('makes one attempt with retries: 0', async () => {
    const { posts, error } = await failingUpload(0);
    assert.equal(posts, 1);
    assert.match(String(error?.message), /after 1 attempt\n/);
  });
});
