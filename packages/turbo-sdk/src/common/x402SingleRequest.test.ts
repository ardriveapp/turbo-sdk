import { strict as assert } from 'node:assert';
import http from 'node:http';
import { Readable } from 'node:stream';
import { after, before, describe, it } from 'node:test';

import { X402RequestCredentials } from '../types.js';
import { TurboHTTPService } from './http.js';
import { Logger } from './logger.js';

/*
  The single-request x402 path — the one items under two chunks still take.

  It streamed its body, which broke it twice over: `content-length` is a
  forbidden fetch header, so a streamed body goes out chunked with no length
  and the service cannot price it; and the protocol's paid retry had a spent
  stream to replay. Buffering fixes both.
*/

const signer = {} as X402RequestCredentials['signer'];

describe('x402 request body', () => {
  const seen: { hasContentLength: boolean; chunked: boolean }[] = [];
  const server = http.createServer((req, res) => {
    seen.push({
      hasContentLength: req.headers['content-length'] !== undefined,
      chunked: req.headers['transfer-encoding'] === 'chunked',
    });
    req.on('data', () => undefined);
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'ok', winc: '0' }));
    });
  });
  let url: string;

  before(async () => {
    await new Promise<void>((r) => server.listen(0, r));
    const a = server.address();
    url = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
  });
  after(() => server.close());

  it('a streamed body carries no Content-Length — the service cannot price it', async () => {
    seen.length = 0;
    const svc = new TurboHTTPService({ url, logger: Logger.default } as never);
    await svc.post({
      endpoint: '/tx/arweave',
      data: Readable.from(Buffer.alloc(4096, 1)),
    });
    assert.equal(seen[0].chunked, true);
    assert.equal(seen[0].hasContentLength, false);
  });

  it('a buffered body declares Content-Length, which x402 pricing requires', async () => {
    seen.length = 0;
    const svc = new TurboHTTPService({ url, logger: Logger.default } as never);
    await svc.post({ endpoint: '/tx/base-usdc', data: Buffer.alloc(4096, 1) });
    assert.equal(seen[0].hasContentLength, true);
    assert.equal(seen[0].chunked, false);
  });
});

describe('x402 refuses cleartext', () => {
  it('rejects a non-HTTPS service URL before signing anything', async () => {
    const svc = new TurboHTTPService({
      url: 'http://upload.example.com',
      logger: Logger.default,
    } as never);

    // An x402 authorization is a bearer credential — whoever observes it can
    // submit it — so a cleartext URL must fail loudly rather than leak it.
    await assert.rejects(
      svc.post({
        endpoint: '/tx/base-usdc',
        data: Buffer.alloc(8),
        x402Options: { signer },
      }),
      /non-HTTPS/,
    );
    await assert.rejects(
      svc.get({ endpoint: '/chunks/base-usdc/-1/-1', x402Options: { signer } }),
      /non-HTTPS/,
    );
  });

  it('allows loopback, so local development still works', async () => {
    const svc = new TurboHTTPService({
      url: 'http://localhost:9999',
      logger: Logger.default,
    } as never);
    await assert.rejects(
      svc.get({ endpoint: '/chunks/base-usdc/-1/-1', x402Options: { signer } }),
      (e: Error) => !/non-HTTPS/.test(e.message),
    );
  });
});
