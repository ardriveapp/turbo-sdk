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
import { DataItem } from '@dha-team/arbundles';
import assert from 'node:assert';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { IncomingMessage, Server, createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { TurboLogger } from '../types.js';
import { TurboFactory } from './factory.js';
import {
  composeFolderIndex,
  createChainFolderIndex,
  createFileFolderIndex,
} from './index.js';

/**
 * The folder index tests in `upload.folderIndex.test.ts` stub `uploadFile`, so
 * they can prove what the planner decides but not the thing the whole design
 * rests on: that the tags a real signer writes onto a real data item are the
 * tags the chain sweep reconstructs a key from. A mismatch there is invisible
 * to a stub and costs a full re-upload on every deploy.
 *
 * So these go through `TurboFactory`, a real `ArweaveSigner`, real ANS-104
 * encoding and a real socket. The upload service is stood in for by a server
 * that parses every data item it is posted with the same arbundles build the
 * SDK signs with and checks the signature, and the gateway by one that answers
 * the exact GraphQL query `createChainFolderIndex` sends out of those records.
 * Nothing on the SDK side of the boundary is stubbed, and no container is
 * needed, so this runs anywhere `test:unit` runs.
 */

type Recorded = {
  id: string;
  ownerAddress: string;
  tags: { name: string; value: string }[];
  data: Buffer;
  signature: string;
};

const b64Url = (b: Buffer) =>
  b
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const fromB64Url = (s: string) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sha256Hex = (data: Buffer | string) =>
  createHash('sha256').update(data).digest('hex');

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

async function startServices() {
  const uploaded: Recorded[] = [];
  const rejected: string[] = [];

  const server: Server = createServer((req, res) => {
    void (async () => {
      const path = new URL(req.url ?? '/', 'http://localhost').pathname;
      const json = (code: number, body: unknown) => {
        res.writeHead(code, { 'content-type': 'application/json' });
        res.end(JSON.stringify(body));
      };

      try {
        if (req.method === 'POST' && path.includes('/tx/')) {
          const raw = await readBody(req);
          const item = new DataItem(raw);
          if (!(await item.isValid())) {
            rejected.push(item.id);
            return json(400, { error: 'invalid data item' });
          }
          const ownerAddress = b64Url(
            createHash('sha256').update(fromB64Url(item.owner)).digest(),
          );
          uploaded.push({
            id: item.id,
            ownerAddress,
            tags: item.tags.map((t) => ({ name: t.name, value: t.value })),
            data: Buffer.from(item.rawData),
            signature: Buffer.from(item.signature).toString('base64'),
          });
          return json(200, {
            id: item.id,
            owner: ownerAddress,
            winc: '0',
            dataCaches: ['e2e'],
            fastFinalityIndexes: [],
          });
        }

        if (req.method === 'POST' && path === '/graphql') {
          const body = JSON.parse((await readBody(req)).toString()) as {
            variables?: {
              owner?: string;
              hashes?: string[];
              after?: string | null;
            };
          };
          const owner = body.variables?.owner;
          const wanted = new Set(body.variables?.hashes ?? []);
          const after = body.variables?.after;
          // Newest first, matching the query's sort:HEIGHT_DESC.
          const matching = [...uploaded]
            .reverse()
            .filter(
              (r) =>
                r.ownerAddress === owner &&
                r.tags.some(
                  (t) => t.name === 'File-SHA256' && wanted.has(t.value),
                ),
            );
          const start =
            after === undefined || after === null
              ? 0
              : matching.findIndex((r) => r.id === after) + 1;
          const page = matching.slice(start, start + 100);
          return json(200, {
            data: {
              transactions: {
                pageInfo: { hasNextPage: start + 100 < matching.length },
                edges: page.map((r) => ({
                  cursor: r.id,
                  node: { id: r.id, tags: r.tags },
                })),
              },
            },
          });
        }

        if (path.endsWith('/balance')) {
          return json(200, {
            winc: '9999999999999',
            effectiveBalance: '9999999999999',
            controlledWinc: '9999999999999',
          });
        }
        return json(404, { error: 'not found', path });
      } catch (error) {
        return json(500, { error: `${(error as Error).message}` });
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port =
    typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    uploaded,
    rejected,
    manifests: () =>
      uploaded.filter((u) =>
        u.tags.some(
          (t) =>
            t.name === 'Content-Type' &&
            t.value === 'application/x.arweave-manifest+json',
        ),
      ),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function capturingLogger() {
  const warnings: string[] = [];
  const logger = {
    debug: () => undefined,
    info: () => undefined,
    error: () => undefined,
    warn: (message: string) => {
      warnings.push(message);
    },
    setLogLevel: () => undefined,
    setLogFormat: () => undefined,
  } as unknown as TurboLogger;
  return { logger, warnings };
}

const jwk = JSON.parse(
  readFileSync(
    join(
      process.cwd(),
      'tests/wallets/ByQEA5jhJvzlhfI4sFgB23kjGpxDK6OIE0i3sSnmTGU.json',
    ),
    'utf-8',
  ),
);

describe('uploadFolder with a folder index, over real signing and HTTP', () => {
  let services: Awaited<ReturnType<typeof startServices>>;
  let folder: string;

  const turboFor = () =>
    TurboFactory.authenticated({
      privateKey: jwk,
      uploadServiceConfig: { url: services.url },
      paymentServiceConfig: { url: services.url },
    });

  /**
   * `TurboFactory` builds every service with its own static logger and
   * overrides anything `uploadServiceConfig.logger` supplied, so the only way
   * to read what `uploadFolder` warned about is to swap the logger on the
   * service it actually holds.
   */
  const captureWarnings = (turbo: ReturnType<typeof turboFor>): string[] => {
    const { logger, warnings } = capturingLogger();
    (
      turbo as unknown as { uploadService: { logger: TurboLogger } }
    ).uploadService.logger = logger;
    return warnings;
  };

  const chainIndex = async (
    turbo: ReturnType<typeof turboFor>,
    logger?: TurboLogger,
  ): Promise<ReturnType<typeof createChainFolderIndex>> =>
    createChainFolderIndex({
      owner: await turbo.signer.getPublicKey(),
      gatewayUrl: services.url,
      ...(logger !== undefined ? { logger } : {}),
    });

  before(async () => {
    services = await startServices();
    folder = mkdtempSync(join(tmpdir(), 'folder-index-e2e-'));
    mkdirSync(join(folder, 'assets'), { recursive: true });
    writeFileSync(join(folder, 'index.html'), '<h1>one</h1>');
    writeFileSync(join(folder, 'assets/app.js'), 'console.log(1)');
    writeFileSync(join(folder, 'assets/app.css'), 'body{color:red}');
    // The a.css / b.js case, with real bytes: both empty, both hash the same.
    writeFileSync(join(folder, 'assets/empty.css'), '');
    writeFileSync(join(folder, 'assets/empty.js'), '');
  });

  after(async () => {
    await services.close();
    rmSync(folder, { recursive: true, force: true });
  });

  it('writes a File-SHA256 that matches the bytes a real signer signed', async () => {
    const turbo = turboFor();
    const folderIndex = composeFolderIndex([
      createFileFolderIndex({ filePath: join(folder, '.turbo/index.jsonl') }),
      await chainIndex(turbo),
    ]);

    const result = await turbo.uploadFolder({
      folderPath: folder,
      folderIndex,
    });

    assert.equal(result.folderIndexSummary?.totalFiles, 5);
    assert.equal(result.folderIndexSummary?.uploadedFiles, 5);
    assert.equal(result.folderIndexSummary?.reusedFiles, 0);
    assert.deepEqual(services.rejected, [], 'every data item must verify');

    const contents: Record<string, string> = {
      'index.html': '<h1>one</h1>',
      'assets/app.js': 'console.log(1)',
      'assets/app.css': 'body{color:red}',
      'assets/empty.css': '',
      'assets/empty.js': '',
    };
    for (const [path, content] of Object.entries(contents)) {
      const id = result.manifest?.paths[path]?.id;
      assert.ok(id !== undefined, `${path} is in the manifest`);
      const item = services.uploaded.find((u) => u.id === id);
      assert.ok(item !== undefined, `${path} was actually posted`);
      assert.equal(
        item.tags.find((t) => t.name === 'File-SHA256')?.value,
        sha256Hex(Buffer.from(content)),
        `${path} File-SHA256 matches its own bytes`,
      );
    }
  });

  it('does not let two empty files with different content types share an item', async () => {
    const manifest = services.manifests().slice(-1)[0];
    const paths = JSON.parse(manifest.data.toString()).paths;
    assert.notEqual(
      paths['assets/empty.css'].id,
      paths['assets/empty.js'].id,
      'identical bytes with different content types must not be deduplicated',
    );
  });

  it('reuses everything from the sweep alone on a fresh checkout', async () => {
    // Deleting the local index is the CI runner case: nothing cached, so the
    // gateway sweep is the only thing that can answer.
    rmSync(join(folder, '.turbo'), { recursive: true, force: true });
    const before = services.uploaded.length;

    const turbo = turboFor();
    const result = await turbo.uploadFolder({
      folderPath: folder,
      folderIndex: await chainIndex(turbo),
    });

    assert.equal(result.folderIndexSummary?.uploadedFiles, 0);
    assert.equal(result.folderIndexSummary?.reusedFiles, 5);
    assert.equal(result.fileResponses.length, 0);
    assert.equal(
      services.uploaded.length - before,
      1,
      'only the manifest is posted',
    );
  });

  it('produces byte identical manifest bytes, though not a stable data item id', async () => {
    const [first, second] = services.manifests().slice(-2);
    assert.ok(
      first.data.equals(second.data),
      'an unchanged folder must produce the same manifest bytes',
    );
    assert.deepEqual(first.tags, second.tags);
    // Same bytes, same tags. The id still moves, because an Arweave data item
    // is signed with RSA-PSS and the salt is random. Anything downstream that
    // needs to know whether a deploy changed has to compare the manifest bytes
    // or the paths, never the manifest id.
    assert.notEqual(first.signature, second.signature);
    assert.notEqual(first.id, second.id);
  });

  it('uploads exactly the one file whose bytes changed', async () => {
    writeFileSync(join(folder, 'assets/app.js'), 'console.log(2)');
    const before = services.uploaded.length;

    const turbo = turboFor();
    const result = await turbo.uploadFolder({
      folderPath: folder,
      folderIndex: await chainIndex(turbo),
    });

    assert.equal(result.folderIndexSummary?.uploadedFiles, 1);
    assert.equal(result.folderIndexSummary?.reusedFiles, 4);
    assert.equal(
      services.uploaded.length - before,
      2,
      'one file, one manifest',
    );
    assert.equal(
      services.uploaded[services.uploaded.length - 2].tags.find(
        (t) => t.name === 'File-SHA256',
      )?.value,
      sha256Hex(Buffer.from('console.log(2)')),
    );
  });

  it('re-uploads the folder and warns when a per file tag changes per deploy', async () => {
    const turbo = turboFor();
    const warnings = captureWarnings(turbo);

    const result = await turbo.uploadFolder({
      folderPath: folder,
      folderIndex: await chainIndex(turbo),
      dataItemOpts: { tags: [{ name: 'Git-Commit', value: 'deadbeef' }] },
    });

    assert.equal(result.folderIndexSummary?.uploadedFiles, 5);
    assert.equal(result.folderIndexSummary?.reusedFiles, 0);
    assert.ok(
      warnings.some((w) => w.includes('already on Arweave byte for byte')),
      `the cost cliff must be reported, got ${JSON.stringify(warnings)}`,
    );
  });

  it('reuses again once that tag moves to manifestDataItemOpts', async () => {
    const before = services.uploaded.length;
    const turbo = turboFor();

    const result = await turbo.uploadFolder({
      folderPath: folder,
      folderIndex: await chainIndex(turbo),
      manifestDataItemOpts: {
        tags: [{ name: 'Git-Commit', value: 'cafebabe' }],
      },
    });

    assert.equal(result.folderIndexSummary?.uploadedFiles, 0);
    assert.equal(result.folderIndexSummary?.reusedFiles, 5);
    assert.equal(services.uploaded.length - before, 1);
    assert.equal(
      services.uploaded[services.uploaded.length - 1].tags.find(
        (t) => t.name === 'Git-Commit',
      )?.value,
      'cafebabe',
    );
  });

  it('costs a re-upload rather than a failed deploy when the gateway is unreachable', async () => {
    const turbo = turboFor();
    const result = await turbo.uploadFolder({
      folderPath: folder,
      folderIndex: createChainFolderIndex({
        owner: await turbo.signer.getPublicKey(),
        gatewayUrl: 'http://127.0.0.1:1', // nothing listening
        timeoutMs: 2000,
      }),
    });

    assert.equal(result.folderIndexSummary?.uploadedFiles, 5);
    assert.ok(result.manifest?.paths['index.html']?.id !== undefined);
  });

  it('writes whichever hash tag the index reads, so a custom one still reuses', async () => {
    const custom = mkdtempSync(join(tmpdir(), 'folder-index-tag-'));
    writeFileSync(join(custom, 'index.html'), '<h1>tagged</h1>');
    writeFileSync(join(custom, 'app.js'), 'tagged');
    try {
      const run = async () => {
        const turbo = turboFor();
        return turbo.uploadFolder({
          folderPath: custom,
          folderIndex: createChainFolderIndex({
            owner: await turbo.signer.getPublicKey(),
            gatewayUrl: services.url,
            hashTagName: 'File-SHA256', // the default, spelled out
          }),
        });
      };
      await run();
      const second = await run();
      assert.equal(second.folderIndexSummary?.reusedFiles, 2);
    } finally {
      rmSync(custom, { recursive: true, force: true });
    }
  });
});

describe('folder index sweeps that run out of pages', () => {
  it('warns rather than silently re-uploading the shortfall', async () => {
    const { logger, warnings } = capturingLogger();
    const wanted = Array.from({ length: 250 }, (_, i) =>
      sha256Hex(`file-${i}`),
    );
    let pagesServed = 0;

    const index = createChainFolderIndex({
      owner: { address: 'a'.repeat(43) },
      pageSize: 10,
      maxPages: 5,
      logger,
      fetchImpl: (async () => {
        const start = pagesServed * 10;
        pagesServed++;
        return new Response(
          JSON.stringify({
            data: {
              transactions: {
                pageInfo: { hasNextPage: true },
                edges: wanted.slice(start, start + 10).map((hash, i) => ({
                  cursor: `cursor-${start + i}`,
                  node: {
                    id: `${start + i}`.padStart(43, 'i'),
                    tags: [
                      { name: 'Content-Type', value: 'text/plain' },
                      { name: 'File-SHA256', value: hash },
                    ],
                  },
                })),
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as unknown as typeof fetch,
    });

    const { folderIndexKey } = await import('../utils/folderIndex.js');
    const keys = await Promise.all(
      wanted.map((hash) =>
        folderIndexKey({
          contentHash: hash,
          tags: [
            { name: 'Content-Type', value: 'text/plain' },
            { name: 'File-SHA256', value: hash },
          ],
        }),
      ),
    );

    const found = await index.resolve?.(keys);

    assert.equal(pagesServed, 5, 'it stops at maxPages');
    assert.equal(Object.keys(found ?? {}).length, 50);
    assert.ok(
      warnings.some((w) => w.includes('stopped at its 5 page limit')),
      `giving up early must not be silent, got ${JSON.stringify(warnings)}`,
    );
  });
});

describe('composeFolderIndex with layers that disagree', () => {
  it('refuses a stack whose layers read different hash tags', () => {
    assert.throws(
      () =>
        composeFolderIndex([
          createChainFolderIndex({
            owner: { address: 'a'.repeat(43) },
            hashTagName: 'File-SHA256',
          }),
          createChainFolderIndex({
            owner: { address: 'b'.repeat(43) },
            hashTagName: 'Other-Hash',
          }),
        ]),
      /disagree about which tag holds/,
    );
  });
});
