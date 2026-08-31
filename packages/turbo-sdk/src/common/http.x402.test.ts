import { strict as assert } from 'node:assert';
import http from 'node:http';
import { Readable } from 'node:stream';
import { after, before, describe, it } from 'node:test';
import { createWalletClient, http as viemHttp } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';

import { X402RequestCredentials } from '../types.js';
import { TurboHTTPService } from './http.js';
import { Logger } from './logger.js';

/*
  Regression cover for the x402 paid retry.

  x402 sends the request twice: once unpaid to obtain the quote, once carrying
  the payment header. `wrapFetchWithPayment` re-issued the second by spreading
  the original `init`, body included — and a body is not reusable. A streamed
  body had already been disturbed by the unpaid attempt, so the paid attempt
  threw `Response body object should not be disturbed or locked` and the
  payment could never be made. Every streamed x402 upload failed this way.
*/

const account = privateKeyToAccount(
  // Throwaway key. Signing an EIP-3009 authorization is offline; no chain is touched.
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);
// x402's Signer expects a wallet client extended with public actions; this test
// only ever signs offline, so the read half is never exercised.
const signer = createWalletClient({
  account,
  chain: baseSepolia,
  transport: viemHttp('http://127.0.0.1:1'),
}) as unknown as X402RequestCredentials['signer'];

/** Bundler stand-in: 402 with requirements until an X-PAYMENT header arrives. */
function startServer() {
  const requests: { paid: boolean; bytes: number }[] = [];
  const server = http.createServer((req, res) => {
    const paid = req.headers['x-payment'] !== undefined;
    let bytes = 0;
    req.on('data', (c) => (bytes += c.length));
    const finish = () => requests.push({ paid, bytes });
    req.on('aborted', finish);
    req.on('end', () => {
      finish();
      if (!paid) {
        res.writeHead(402, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            x402Version: 1,
            accepts: [
              {
                scheme: 'exact',
                network: 'base-sepolia',
                maxAmountRequired: '1000',
                resource: 'http://localhost/v1/tx',
                description: 'test',
                mimeType: 'application/json',
                payTo: '0x0000000000000000000000000000000000000001',
                maxTimeoutSeconds: 300,
                asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                extra: { name: 'USDC', version: '2' },
              },
            ],
          }),
        );
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'ok' }));
      }
    });
  });
  return { server, requests };
}

describe('x402 upload payment', () => {
  const { server, requests } = startServer();
  let url: string;

  before(async () => {
    await new Promise<void>((r) => server.listen(0, r));
    const addr = server.address();
    url = `http://127.0.0.1:${
      typeof addr === 'object' && addr ? addr.port : 0
    }`;
  });
  after(() => server.close());

  it('pays for a STREAMED body, which previously threw on the retry', async () => {
    requests.length = 0;
    const svc = new TurboHTTPService({ url, logger: Logger.default } as never);
    const payload = Buffer.alloc(32 * 1024, 7);

    const res = await svc.post<{ id: string }>({
      endpoint: '/tx/base-usdc',
      data: Readable.from(payload),
      // A fresh stream per attempt is what makes the paid retry possible.
      dataFactory: () => Readable.from(payload),
      x402Options: { signer, maxMUSDCAmount: 100_000 },
    });

    assert.equal(res.id, 'ok');
    assert.equal(
      requests.length,
      2,
      'expected an unpaid quote then a paid send',
    );
    assert.equal(requests[0].paid, false);
    assert.equal(requests[1].paid, true);
  });

  it('refuses a quote above maxMUSDCAmount without paying', async () => {
    requests.length = 0;
    const svc = new TurboHTTPService({ url, logger: Logger.default } as never);
    await assert.rejects(
      svc.post({
        endpoint: '/tx/base-usdc',
        data: Buffer.alloc(16),
        dataFactory: () => Buffer.alloc(16),
        x402Options: { signer, maxMUSDCAmount: 1 }, // quote is 1000
      }),
      /exceeds the maximum allowed/,
    );
    assert.ok(
      requests.every((r) => !r.paid),
      'must not send a paid request when the quote is over the cap',
    );
  });
});
