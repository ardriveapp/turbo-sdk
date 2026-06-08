import { strict as assert } from 'node:assert';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { TurboHTTPService, defaultRetryConfig } from './http.js';
import { Logger } from './logger.js';

function makeService() {
  return new TurboHTTPService({
    url: 'https://example.com',
    retryConfig: defaultRetryConfig(Logger.default),
    logger: Logger.default,
  });
}

function makeReadableStream(content: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });
}

// NOTE: isBrowser is a module-level const evaluated at load time, so browser-path
// behavior (ReadableStream → Blob) cannot be simulated in Node.js unit tests.
// That path is exercised by the web integration tests (tests/turbo.web.test.ts).
describe('TurboHTTPService.post — toFetchBody (Node.js environment)', () => {
  let capturedInput: RequestInfo | URL | undefined;
  let capturedInit: RequestInit | undefined;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    capturedInput = undefined;
    capturedInit = undefined;
    originalFetch = globalThis.fetch;

    globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      capturedInput = input;
      capturedInit = init;
      return new Response(JSON.stringify({ id: 'test-id' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sends a ReadableStream body with duplex: "half" in Node.js environment', async () => {
    const service = makeService();
    const stream = makeReadableStream('hello world');

    await service.post({
      endpoint: '/tx/arweave',
      data: stream,
      headers: { 'content-type': 'application/octet-stream' },
    });

    assert.ok(capturedInit, 'fetch should have been called');
    assert.ok(
      capturedInit!.body instanceof ReadableStream,
      `Expected ReadableStream body in Node.js env, got: ${capturedInit!.body?.constructor?.name}`,
    );
    assert.equal(
      // @ts-ignore — duplex is not in standard RequestInit types but is set by the SDK
      capturedInit!.duplex,
      'half',
      'duplex should be "half" for Node.js streaming',
    );
  });

  it('sends a Uint8Array body for Buffer data in Node.js environment', async () => {
    const service = makeService();
    const buffer = Buffer.from('buffered content');

    await service.post({
      endpoint: '/tx/arweave',
      data: buffer,
      headers: { 'content-type': 'application/octet-stream' },
    });

    assert.ok(capturedInit, 'fetch should have been called');
    assert.ok(
      capturedInit!.body instanceof Uint8Array,
      `Expected Uint8Array body for Buffer in Node.js env, got: ${capturedInit!.body?.constructor?.name}`,
    );
  });

  it('posts to the correct URL', async () => {
    const service = makeService();
    const stream = makeReadableStream('data');

    await service.post({
      endpoint: '/tx/arweave',
      data: stream,
      headers: { 'content-type': 'application/octet-stream' },
    });

    assert.ok(
      String(capturedInput).endsWith('/tx/arweave'),
      `Expected URL to end with /tx/arweave, got: ${capturedInput}`,
    );
  });
});
