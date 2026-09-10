import { strict as assert } from 'node:assert';
import http from 'node:http';
import { Readable } from 'node:stream';
import { after, before, describe, it } from 'node:test';

import { X402RequestCredentials } from '../types.js';
import { ChunkedUploader } from './chunked.js';
import { TurboHTTPService } from './http.js';
import { Logger } from './logger.js';

/*
  x402 upload behaviour, both shapes.

  Chunked pays at CREATE — a GET carrying `totalBytes` — so the payload is
  priced without being transmitted and settled before storage is consumed.
  The single-request path has to declare Content-Length, or the service cannot
  price it, issues no challenge, and stores the item unpaid.
*/

const signer = {} as X402RequestCredentials['signer'];

describe('chunked x402', () => {
  it('declares totalBytes, address and signatureType at CREATE', async () => {
    const seen: string[] = [];
    const http_ = {
      get: async ({ endpoint }: { endpoint: string }) => {
        seen.push(endpoint);
        return { id: 'upload-id', min: 1, max: 10, chunkSize: 5 * 1024 * 1024 };
      },
    } as unknown as TurboHTTPService;

    const uploader = new ChunkedUploader({
      http: http_,
      token: 'base-usdc',
      logger: Logger.default,
      dataItemByteCount: 12_582_912,
      x402: { options: { signer }, address: '0xabc', signatureType: 3 },
    });

    await (
      uploader as unknown as { initUpload(): Promise<string> }
    ).initUpload();

    assert.equal(seen.length, 1);
    const q = new URLSearchParams(seen[0].split('?')[1]);
    assert.equal(q.get('totalBytes'), '12582912');
    assert.equal(q.get('address'), '0xabc');
    assert.equal(q.get('signatureType'), '3');
  });

  it('omits those params entirely on the credit path', async () => {
    const seen: string[] = [];
    const http_ = {
      get: async ({ endpoint }: { endpoint: string }) => {
        seen.push(endpoint);
        return { id: 'upload-id', min: 1, max: 10, chunkSize: 5 * 1024 * 1024 };
      },
    } as unknown as TurboHTTPService;

    const uploader = new ChunkedUploader({
      http: http_,
      token: 'arweave',
      logger: Logger.default,
      dataItemByteCount: 12_582_912,
    });
    await (
      uploader as unknown as { initUpload(): Promise<string> }
    ).initUpload();

    const q = new URLSearchParams(seen[0].split('?')[1]);
    assert.equal(q.get('totalBytes'), null);
    assert.equal(q.get('address'), null);
  });

  it('is no longer disabled for x402 — large items chunk', () => {
    const uploader = new ChunkedUploader({
      http: {} as TurboHTTPService,
      token: 'base-usdc',
      logger: Logger.default,
      dataItemByteCount: 40 * 1024 * 1024,
      x402: { options: { signer }, address: '0xabc', signatureType: 3 },
    });
    assert.equal(uploader.shouldUseChunkUploader, true);
  });
});

describe('single-request x402 body', () => {
  const requests: { hasContentLength: boolean; chunked: boolean }[] = [];
  const server = http.createServer((req, res) => {
    requests.push({
      hasContentLength: req.headers['content-length'] !== undefined,
      chunked: req.headers['transfer-encoding'] === 'chunked',
    });
    let n = 0;
    req.on('data', (c) => (n += c.length));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'ok', winc: '0', receivedBytes: n }));
    });
  });
  let url: string;

  before(async () => {
    await new Promise<void>((r) => server.listen(0, r));
    const a = server.address();
    url = `http://127.0.0.1:${typeof a === 'object' && a ? a.port : 0}`;
  });
  after(() => server.close());

  it('sends a streamed body (no Content-Length) on the credit path', async () => {
    requests.length = 0;
    const svc = new TurboHTTPService({ url, logger: Logger.default } as never);
    await svc.post({
      endpoint: '/tx/arweave',
      data: Readable.from(Buffer.alloc(2048, 1)),
    });
    assert.equal(requests[0].chunked, true);
    assert.equal(requests[0].hasContentLength, false);
  });

  it('a Buffer body declares Content-Length, which x402 pricing requires', async () => {
    requests.length = 0;
    const svc = new TurboHTTPService({ url, logger: Logger.default } as never);
    await svc.post({ endpoint: '/tx/base-usdc', data: Buffer.alloc(2048, 1) });
    // Without this header the service cannot price the upload, never issues a
    // 402, and stores the item for free.
    assert.equal(requests[0].hasContentLength, true);
    assert.equal(requests[0].chunked, false);
  });
});
