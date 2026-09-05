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
import {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  TurboFolderUploadIndex,
  TurboLogger,
  TurboUploadDataItemResponse,
  TurboUploadFileParams,
} from '../types.js';
import { contentHashTagName, folderIndexKey } from '../utils/folderIndex.js';
import {
  TurboAuthenticatedUploadService,
  composeFolderIndex,
  createChainFolderIndex,
  createFileFolderIndex,
  createMemoryFolderIndex,
} from './index.js';

const manifestContentType = 'application/x.arweave-manifest+json';

// Unique across every stub in the file, so an id from one run is never
// mistaken for an id from another.
let dataItemCounter = 0;

type RecordedUpload = {
  id: string;
  tags: { name: string; value: string }[];
  contentType: string | undefined;
  contentHash: string | undefined;
};

/**
 * A node upload service whose `uploadFile` never leaves the process. Every call
 * is recorded and answered with a deterministic data item id, which is all
 * `uploadFolder` needs to build a manifest.
 */
function stubbedUploadService({ failOn }: { failOn?: string } = {}) {
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

  const service = new TurboAuthenticatedUploadService({
    signer: {} as never,
    paymentService: {} as never,
    logger,
  });

  const uploads: RecordedUpload[] = [];
  const manifestUploads: RecordedUpload[] = [];

  const uploadFile = async (
    params: TurboUploadFileParams,
  ): Promise<TurboUploadDataItemResponse> => {
    const tags = params.dataItemOpts?.tags ?? [];
    if (
      failOn !== undefined &&
      tags.some(
        (tag) => tag.name === 'Content-Type' && tag.value.includes(failOn),
      )
    ) {
      throw new Error(`refused ${failOn}`);
    }
    const record: RecordedUpload = {
      id: `id${dataItemCounter++}`.padEnd(43, 'x'),
      tags,
      contentType: tags.find((tag) => tag.name === 'Content-Type')?.value,
      contentHash: tags.find((tag) => tag.name === contentHashTagName)?.value,
    };
    (record.contentType === manifestContentType
      ? manifestUploads
      : uploads
    ).push(record);
    return { id: record.id } as TurboUploadDataItemResponse;
  };

  (service as unknown as { uploadFile: typeof uploadFile }).uploadFile =
    uploadFile;

  return { service, uploads, manifestUploads, warnings };
}

describe('uploadFolder with a folder index', () => {
  let folderPath: string;

  beforeEach(() => {
    folderPath = mkdtempSync(join(tmpdir(), 'turbo-folder-index-'));
    writeFileSync(join(folderPath, 'index.html'), '<h1>one</h1>');
    writeFileSync(join(folderPath, 'app.js'), 'console.log(1);');
    writeFileSync(join(folderPath, 'style.css'), 'body{}');
  });

  afterEach(() => {
    rmSync(folderPath, { recursive: true, force: true });
  });

  /** Make one file's hash attempt fail, the way an unreadable file does. */
  function failHashFor(service: TurboAuthenticatedUploadService, name: string) {
    type Hasher = { computeContentHash: (f: string) => Promise<string> };
    const real = (service as unknown as Hasher).computeContentHash.bind(
      service,
    );
    (service as unknown as Hasher).computeContentHash = (file: string) =>
      file.endsWith(name) ? Promise.reject(new Error('EACCES')) : real(file);
  }

  it('uploads the rest when one file cannot be hashed', async () => {
    const { service, uploads } = stubbedUploadService();
    const folderIndex = createMemoryFolderIndex();
    failHashFor(service, 'app.js');

    const result = await service.uploadFolder({ folderPath, folderIndex });

    // Without an index this folder uploads all three and reports any failure
    // per file. Passing an index must not turn one unreadable file into a
    // rejected uploadFolder with no responses and no manifest.
    assert.equal(uploads.length, 3);
    assert.equal(result.fileResponses.length, 3);
    assert.deepEqual(Object.keys(result.manifest?.paths ?? {}).sort(), [
      'app.js',
      'index.html',
      'style.css',
    ]);
    // The unhashable file has no key, so it is never recorded as reusable.
    assert.equal(Object.keys((await folderIndex.entries?.()) ?? {}).length, 2);
  });

  it('uploads every unhashable file, not just the first', async () => {
    const { service, uploads } = stubbedUploadService();
    const folderIndex = createMemoryFolderIndex();
    failHashFor(service, '.js');
    writeFileSync(join(folderPath, 'other.js'), 'console.log(2);');

    const result = await service.uploadFolder({ folderPath, folderIndex });

    // Un-keyed files must not share a dedup slot. Claiming `undefined` once
    // would silently drop every unhashable file after the first.
    assert.equal(uploads.length, 4);
    assert.deepEqual(Object.keys(result.manifest?.paths ?? {}).sort(), [
      'app.js',
      'index.html',
      'other.js',
      'style.css',
    ]);
  });

  it('uploads every file on a first run and remembers each one', async () => {
    const { service, uploads } = stubbedUploadService();
    const folderIndex = createMemoryFolderIndex();

    const result = await service.uploadFolder({ folderPath, folderIndex });

    assert.equal(uploads.length, 3);
    assert.equal(result.fileResponses.length, 3);
    assert.deepEqual(result.folderIndexSummary, {
      totalFiles: 3,
      totalBytes: 33,
      uploadedFiles: 3,
      uploadedBytes: 33,
      reusedFiles: 0,
      reusedBytes: 0,
    });
    assert.deepEqual(Object.keys(result.manifest?.paths ?? {}).sort(), [
      'app.js',
      'index.html',
      'style.css',
    ]);
    assert.equal(Object.keys((await folderIndex.entries?.()) ?? {}).length, 3);
  });

  it('uploads nothing on an unchanged re-run and reuses every id', async () => {
    const folderIndex = createMemoryFolderIndex();

    const first = await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
    });

    const second = stubbedUploadService();
    const result = await second.service.uploadFolder({
      folderPath,
      folderIndex,
    });

    assert.equal(second.uploads.length, 0);
    assert.equal(result.fileResponses.length, 0);
    assert.deepEqual(result.folderIndexSummary, {
      totalFiles: 3,
      totalBytes: 33,
      uploadedFiles: 0,
      uploadedBytes: 0,
      reusedFiles: 3,
      reusedBytes: 33,
    });
    // Same ids, and byte identical manifest bytes.
    assert.deepEqual(result.manifest, first.manifest);
    assert.equal(
      JSON.stringify(result.manifest),
      JSON.stringify(first.manifest),
    );
  });

  it('uploads exactly the file that changed and keeps the rest', async () => {
    const folderIndex = createMemoryFolderIndex();

    const first = await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
    });

    writeFileSync(join(folderPath, 'app.js'), 'console.log(2);');

    const second = stubbedUploadService();
    const result = await second.service.uploadFolder({
      folderPath,
      folderIndex,
    });

    assert.equal(second.uploads.length, 1);
    assert.equal(result.folderIndexSummary?.uploadedFiles, 1);
    assert.equal(result.folderIndexSummary?.reusedFiles, 2);

    // The manifest is assembled from two remembered ids and one new one.
    const paths = result.manifest?.paths ?? {};
    const firstPaths = first.manifest?.paths ?? {};
    assert.equal(paths['app.js'].id, second.uploads[0].id);
    assert.notEqual(paths['app.js'].id, firstPaths['app.js'].id);
    assert.equal(paths['index.html'].id, firstPaths['index.html'].id);
    assert.equal(paths['style.css'].id, firstPaths['style.css'].id);
  });

  it('pays once for identical bytes that also share a content type', async () => {
    writeFileSync(join(folderPath, 'copy.css'), 'body{}');

    const { service, uploads } = stubbedUploadService();
    const result = await service.uploadFolder({
      folderPath,
      folderIndex: createMemoryFolderIndex(),
    });

    assert.equal(uploads.length, 3);
    assert.equal(result.folderIndexSummary?.totalFiles, 4);
    assert.equal(result.folderIndexSummary?.reusedFiles, 1);

    const paths = result.manifest?.paths ?? {};
    assert.equal(paths['copy.css'].id, paths['style.css'].id);
  });

  it('pays twice for identical bytes with different content types', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'turbo-folder-index-'));
    writeFileSync(join(empty, 'a.css'), '');
    writeFileSync(join(empty, 'b.js'), '');

    try {
      const { service, uploads } = stubbedUploadService();
      const result = await service.uploadFolder({
        folderPath: empty,
        folderIndex: createMemoryFolderIndex(),
      });

      // Byte identical, but a browser refuses to execute JavaScript served as
      // text/css, so these must not share a data item.
      assert.equal(uploads.length, 2);
      assert.equal(result.folderIndexSummary?.reusedFiles, 0);

      const paths = result.manifest?.paths ?? {};
      assert.notEqual(paths['a.css'].id, paths['b.js'].id);

      const byId = new Map(uploads.map((upload) => [upload.id, upload]));
      assert.equal(byId.get(paths['a.css'].id)?.contentType, 'text/css');
      assert.equal(
        byId.get(paths['b.js'].id)?.contentType,
        'application/javascript',
      );
      // Same bytes, so the same content hash tag on both.
      assert.equal(uploads[0].contentHash, uploads[1].contentHash);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('re-uploads when a dataItemOpts tag changes, rather than reusing stale tags', async () => {
    const folderIndex = createMemoryFolderIndex();

    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
      dataItemOpts: { tags: [{ name: 'App-Name', value: 'one' }] },
    });

    const sameTag = stubbedUploadService();
    await sameTag.service.uploadFolder({
      folderPath,
      folderIndex,
      dataItemOpts: { tags: [{ name: 'App-Name', value: 'one' }] },
    });
    assert.equal(sameTag.uploads.length, 0);

    const changedTag = stubbedUploadService();
    await changedTag.service.uploadFolder({
      folderPath,
      folderIndex,
      dataItemOpts: { tags: [{ name: 'App-Name', value: 'two' }] },
    });
    // A reused item would still say App-Name: one, so the key covers the tags
    // and these are paid for again.
    assert.equal(changedTag.uploads.length, 3);
    for (const upload of changedTag.uploads) {
      assert.ok(
        upload.tags.some(
          (tag) => tag.name === 'App-Name' && tag.value === 'two',
        ),
      );
    }
  });

  it('tags each file with its own content hash', async () => {
    const { service, uploads } = stubbedUploadService();

    await service.uploadFolder({
      folderPath,
      folderIndex: createMemoryFolderIndex(),
      dataItemOpts: { tags: [{ name: 'App-Name', value: 'my-app' }] },
    });

    for (const upload of uploads) {
      assert.match(upload.contentHash ?? '', /^[0-9a-f]{64}$/);
      assert.equal(
        upload.tags.filter((tag) => tag.name === contentHashTagName).length,
        1,
      );
      assert.ok(
        upload.tags.some(
          (tag) => tag.name === 'App-Name' && tag.value === 'my-app',
        ),
      );
    }
    // Distinct bytes, distinct hashes.
    assert.equal(new Set(uploads.map((upload) => upload.contentHash)).size, 3);
  });

  it('calls get for every key first, then resolve once for the leftovers', async () => {
    const gets: string[] = [];
    const resolveCalls: string[][] = [];
    const folderIndex: TurboFolderUploadIndex = {
      get: (key) => {
        gets.push(key);
        return undefined;
      },
      set: () => undefined,
      resolve: async (keys) => {
        resolveCalls.push(keys);
        return {};
      },
    };

    const { service } = stubbedUploadService();
    await service.uploadFolder({ folderPath, folderIndex });

    assert.equal(gets.length, 3);
    assert.equal(resolveCalls.length, 1);
    assert.deepEqual(resolveCalls[0], gets);
  });

  it('treats an index read that throws as a miss rather than a failed deploy', async () => {
    const folderIndex: TurboFolderUploadIndex = {
      get: () => {
        throw new Error('cache is down');
      },
      set: () => undefined,
      resolve: async () => {
        throw new Error('gateway 503');
      },
    };

    const { service, uploads } = stubbedUploadService();
    const result = await service.uploadFolder({ folderPath, folderIndex });

    assert.equal(uploads.length, 3);
    assert.equal(Object.keys(result.manifest?.paths ?? {}).length, 3);
    assert.equal(result.folderIndexSummary?.reusedFiles, 0);
  });

  it('does not fail an upload that has landed when the index write fails', async () => {
    const folderIndex: TurboFolderUploadIndex = {
      get: () => undefined,
      set: () => {
        throw new Error('disk is full');
      },
    };

    const { service, uploads } = stubbedUploadService();
    const result = await service.uploadFolder({ folderPath, folderIndex });

    assert.equal(uploads.length, 3);
    assert.equal(Object.keys(result.manifest?.paths ?? {}).length, 3);
  });

  it('warns when a file is already on Arweave byte for byte under other tags', async () => {
    const folderIndex = createMemoryFolderIndex();

    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
      dataItemOpts: { tags: [{ name: 'Build-Id', value: '1' }] },
    });

    const second = stubbedUploadService();
    await second.service.uploadFolder({
      folderPath,
      folderIndex,
      dataItemOpts: { tags: [{ name: 'Build-Id', value: '2' }] },
    });

    assert.equal(second.uploads.length, 3);
    assert.equal(second.warnings.length, 1);
    assert.match(second.warnings[0], /3 of the 3 file\(s\)/);
    assert.match(second.warnings[0], /under a different set of tags/);
    assert.match(second.warnings[0], /manifestDataItemOpts/);
  });

  it('warns for one drifted file among many that were reused', async () => {
    const folderIndex = createMemoryFolderIndex();

    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
    });

    // The same bytes for app.js under a tag set the index has not got, while
    // the other two files still hit exactly. A whole-run signal misses this.
    const drifted = await folderIndexKey({
      contentHash: 'f'.repeat(64),
      tags: [],
    });
    assert.ok(drifted.length > 0);

    const second = stubbedUploadService();
    await second.service.uploadFolder({
      folderPath,
      folderIndex: {
        get: (key) => folderIndex.get(key),
        set: (key, id) => folderIndex.set(key, id),
        // Pretend the bytes of every file are known, but claim not to know one
        // of the keys: that is exactly a single file whose tags moved.
        knownContentHashes: (contentHashes) => contentHashes,
      },
      dataItemOpts: { tags: [{ name: 'Build-Id', value: 'new' }] },
    });

    assert.equal(second.warnings.length, 1);
    assert.match(second.warnings[0], /3 of the 3 file\(s\)/);
  });

  it('warns on a chain only index, which is the CI case', async () => {
    // The chain layer filters GraphQL on File-SHA256 alone, so a sweep sees
    // every item with matching bytes whatever tags it carries. That is where
    // the signal comes from, and it works with nothing cached locally.
    const first = stubbedUploadService();
    await first.service.uploadFolder({
      folderPath,
      folderIndex: createMemoryFolderIndex(),
      dataItemOpts: { tags: [{ name: 'Build-Id', value: '1' }] },
    });

    const onChain = first.uploads.map((upload) => ({
      cursor: upload.id,
      node: { id: upload.id, tags: upload.tags },
    }));
    const fetchImpl = (async () => ({
      ok: true,
      json: async () => ({
        data: {
          transactions: { pageInfo: { hasNextPage: false }, edges: onChain },
        },
      }),
    })) as unknown as typeof fetch;

    const second = stubbedUploadService();
    await second.service.uploadFolder({
      folderPath,
      folderIndex: createChainFolderIndex({
        owner: { address: 'owner'.padEnd(43, 'x') },
        fetchImpl,
      }),
      dataItemOpts: { tags: [{ name: 'Build-Id', value: '2' }] },
    });

    assert.equal(second.uploads.length, 3);
    assert.equal(second.warnings.length, 1);
    assert.match(second.warnings[0], /already on Arweave byte for byte/);
  });

  it('does not warn when an existing index is pointed at a different folder', async () => {
    const folderIndex = createMemoryFolderIndex();

    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
    });

    const elsewhere = mkdtempSync(join(tmpdir(), 'turbo-folder-index-'));
    writeFileSync(join(elsewhere, 'other.html'), '<h1>unrelated</h1>');
    try {
      const second = stubbedUploadService();
      await second.service.uploadFolder({
        folderPath: elsewhere,
        folderIndex,
      });

      assert.equal(second.uploads.length, 1);
      assert.deepEqual(second.warnings, []);
    } finally {
      rmSync(elsewhere, { recursive: true, force: true });
    }
  });

  it('does not warn when the index could not be reached', async () => {
    // A swallowed read failure must not get blamed on dataItemOpts.
    const { service, uploads, warnings } = stubbedUploadService();

    await service.uploadFolder({
      folderPath,
      folderIndex: composeFolderIndex([
        createChainFolderIndex({
          owner: { address: 'owner'.padEnd(43, 'x') },
          fetchImpl: (async () => {
            throw new Error('gateway is unreachable');
          }) as unknown as typeof fetch,
        }),
      ]),
    });

    assert.equal(uploads.length, 3);
    assert.deepEqual(warnings, []);
  });

  it('does not warn on a first ever deploy, when the index is simply empty', async () => {
    const { service, uploads, warnings } = stubbedUploadService();

    await service.uploadFolder({
      folderPath,
      folderIndex: createMemoryFolderIndex(),
    });

    assert.equal(uploads.length, 3);
    assert.deepEqual(warnings, []);
  });

  it('does not warn when only the content of a file changed', async () => {
    const folderIndex = createMemoryFolderIndex();

    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex,
    });

    writeFileSync(join(folderPath, 'app.js'), 'console.log(2);');

    const second = stubbedUploadService();
    await second.service.uploadFolder({ folderPath, folderIndex });

    assert.equal(second.uploads.length, 1);
    assert.deepEqual(second.warnings, []);
  });

  it('stays quiet when the index cannot report what bytes it holds', async () => {
    const folderIndex: TurboFolderUploadIndex = {
      get: () => undefined,
      set: () => undefined,
    };

    const { service, uploads, warnings } = stubbedUploadService();
    await service.uploadFolder({ folderPath, folderIndex });

    assert.equal(uploads.length, 3);
    assert.deepEqual(warnings, []);
  });

  it('counts what landed, not what was planned, when an upload fails', async () => {
    const { service, uploads } = stubbedUploadService({ failOn: 'javascript' });

    const result = await service.uploadFolder({
      folderPath,
      folderIndex: createMemoryFolderIndex(),
      throwOnFailure: false,
    });

    assert.equal(uploads.length, 2);
    assert.equal(result.errors?.length, 1);
    assert.equal(result.folderIndexSummary?.totalFiles, 3);
    assert.equal(result.folderIndexSummary?.uploadedFiles, 2);
    assert.equal(result.folderIndexSummary?.uploadedBytes, 18);
    assert.equal(result.folderIndexSummary?.reusedFiles, 0);
    // app.js never landed, so it has no manifest entry.
    assert.deepEqual(Object.keys(result.manifest?.paths ?? {}).sort(), [
      'index.html',
      'style.css',
    ]);
  });

  it('accepts a deploy varying tag on manifestDataItemOpts', async () => {
    const { service, uploads, manifestUploads } = stubbedUploadService();

    await service.uploadFolder({
      folderPath,
      folderIndex: createMemoryFolderIndex(),
      manifestDataItemOpts: {
        tags: [{ name: 'Git-Commit', value: 'deadbeef' }],
      },
    });

    assert.equal(manifestUploads.length, 1);
    assert.ok(
      manifestUploads[0].tags.some(
        (tag) => tag.name === 'Git-Commit' && tag.value === 'deadbeef',
      ),
    );
    for (const upload of uploads) {
      assert.equal(
        upload.tags.some((tag) => tag.name === 'Git-Commit'),
        false,
      );
    }
  });
});

describe('uploadFolder without a folder index', () => {
  let folderPath: string;

  beforeEach(() => {
    folderPath = mkdtempSync(join(tmpdir(), 'turbo-folder-index-'));
    writeFileSync(join(folderPath, 'index.html'), '<h1>one</h1>');
    writeFileSync(join(folderPath, 'style.css'), 'body{}');
    writeFileSync(join(folderPath, 'copy.css'), 'body{}');
  });

  afterEach(() => {
    rmSync(folderPath, { recursive: true, force: true });
  });

  it('sends exactly the tag set it sent before, File-SHA256 included', async () => {
    const { service, uploads } = stubbedUploadService();

    const callerTags = [
      { name: 'Git-Commit', value: 'deadbeef' },
      // A caller who was already computing their own hashes keeps their tag.
      { name: contentHashTagName, value: 'whatever-they-had' },
      { name: 'App-Name', value: 'my-app' },
    ];
    const result = await service.uploadFolder({
      folderPath,
      dataItemOpts: { tags: callerTags },
    });

    // Identical bytes are still uploaded twice, as they always were.
    assert.equal(uploads.length, 3);
    assert.equal(result.folderIndexSummary, undefined);

    const byId = new Map(uploads.map((upload) => [upload.id, upload]));
    const paths = result.manifest?.paths ?? {};
    assert.deepEqual(byId.get(paths['style.css'].id)?.tags, [
      { name: 'Git-Commit', value: 'deadbeef' },
      { name: contentHashTagName, value: 'whatever-they-had' },
      { name: 'App-Name', value: 'my-app' },
      { name: 'Content-Type', value: 'text/css' },
    ]);
    assert.deepEqual(byId.get(paths['index.html'].id)?.tags, [
      { name: 'Git-Commit', value: 'deadbeef' },
      { name: contentHashTagName, value: 'whatever-they-had' },
      { name: 'App-Name', value: 'my-app' },
      { name: 'Content-Type', value: 'text/html' },
    ]);
  });
});

describe('createFileFolderIndex', () => {
  let folderPath: string;
  let cachePath: string;
  let indexPath: string;

  const records = (path: string) =>
    readFileSync(path, 'utf-8')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));

  const entriesOnDisk = (path: string) =>
    Object.fromEntries(
      records(path)
        .filter((record) => record.k !== undefined)
        .map((record) => [record.k, record.i]),
    );

  beforeEach(() => {
    folderPath = mkdtempSync(join(tmpdir(), 'turbo-folder-index-'));
    // Outside the uploaded folder, or the index would upload itself.
    cachePath = mkdtempSync(join(tmpdir(), 'turbo-folder-cache-'));
    indexPath = join(cachePath, 'nested', 'turbo-index.jsonl');
    writeFileSync(join(folderPath, 'index.html'), '<h1>one</h1>');
    writeFileSync(join(folderPath, 'app.js'), 'console.log(1);');
  });

  afterEach(() => {
    rmSync(folderPath, { recursive: true, force: true });
    rmSync(cachePath, { recursive: true, force: true });
  });

  it('persists after every upload, so a killed run keeps what it paid for', async () => {
    const { service, uploads } = stubbedUploadService();

    await service.uploadFolder({
      folderPath,
      folderIndex: createFileFolderIndex({ filePath: indexPath }),
      manifestOptions: { disableManifest: true },
    });

    assert.deepEqual(
      Object.values(entriesOnDisk(indexPath)).sort(),
      uploads.map((upload) => upload.id).sort(),
    );
    assert.equal(records(indexPath)[0].folderIndex, 2);
    assert.equal(existsSync(`${indexPath}.tmp`), false);
  });

  it('appends rather than rewriting, so a bulk load is linear', () => {
    const folderIndex = createFileFolderIndex({ filePath: indexPath });

    // Rewriting the whole file per entry is quadratic: measured at 4,000
    // entries it was ~9.8s and ~1.4 GiB written, purely on bookkeeping, and it
    // is first deploys and migrations that pay it.
    const sizes: number[] = [];
    let prefix = '';
    for (let n = 0; n < 200; n++) {
      folderIndex.set(
        `${n.toString(16).padStart(64, '0')}.${'0'.repeat(64)}`,
        `id${n}`.padEnd(43, 'x'),
      );
      const contents = readFileSync(indexPath, 'utf-8');
      if (n === 0) {
        prefix = contents;
      } else {
        // Every earlier byte is untouched: this is an append, not a rewrite.
        assert.equal(contents.startsWith(prefix), true);
        prefix = contents;
      }
      sizes.push(contents.length);
    }

    // Each write costs one record, so total bytes are linear in entries.
    const perEntry = sizes[199] / 200;
    assert.ok(perEntry < 200, `expected ~1 record per entry, got ${perEntry}`);
    assert.equal(Object.keys(entriesOnDisk(indexPath)).length, 200);
  });

  it('survives a torn write, losing one record rather than all of them', async () => {
    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex: createFileFolderIndex({ filePath: indexPath }),
      manifestOptions: { disableManifest: true },
    });

    // A process killed mid write. A whole-file rewrite would leave nothing
    // loadable here; an append can only damage its last line.
    const contents = readFileSync(indexPath, 'utf-8');
    writeFileSync(
      indexPath,
      contents.slice(0, Math.floor(contents.length * 0.9)),
    );

    const folderIndex = createFileFolderIndex({ filePath: indexPath });
    const survivors = Object.keys((await folderIndex.entries?.()) ?? {});
    assert.equal(survivors.length, 1);
  });

  it('compacts a log that has accumulated repeats when it is loaded', async () => {
    const key = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
    const first = createFileFolderIndex({ filePath: indexPath });
    for (let n = 0; n < 5; n++) {
      first.set(key, `id${n}`.padEnd(43, 'x'));
    }
    assert.equal(records(indexPath).length, 6); // header + 5 appends

    const reloaded = createFileFolderIndex({ filePath: indexPath });
    // Last write wins, and the log is rewritten to one record.
    assert.equal(await reloaded.get(key), 'id4'.padEnd(43, 'x'));
    assert.equal(records(indexPath).length, 2);
    assert.equal(existsSync(`${indexPath}.tmp`), false);
  });

  it('is read back on the next run, so nothing is uploaded twice', async () => {
    await stubbedUploadService().service.uploadFolder({
      folderPath,
      folderIndex: createFileFolderIndex({ filePath: indexPath }),
    });

    const second = stubbedUploadService();
    const result = await second.service.uploadFolder({
      folderPath,
      folderIndex: createFileFolderIndex({ filePath: indexPath }),
    });

    assert.equal(second.uploads.length, 0);
    assert.equal(result.folderIndexSummary?.reusedFiles, 2);
  });

  it('drops malformed records rather than publishing a manifest pointing at nothing', async () => {
    const { service } = stubbedUploadService();
    await service.uploadFolder({
      folderPath,
      folderIndex: createFileFolderIndex({ filePath: indexPath }),
    });

    const onDisk = entriesOnDisk(indexPath);
    const [goodKey] = Object.keys(onDisk);
    const otherKey = `${'c'.repeat(64)}.${'d'.repeat(64)}`;
    appendFileSync(
      indexPath,
      [
        JSON.stringify({ k: otherKey, i: 'truncated-id' }),
        JSON.stringify({ k: 'not-a-key', i: 'idZ'.padEnd(43, 'x') }),
        '{ not json at all',
      ].join('\n') + '\n',
    );

    const folderIndex = createFileFolderIndex({ filePath: indexPath });
    // Neither malformed record is loadable...
    assert.equal(await folderIndex.get(otherKey), undefined);
    assert.equal(await folderIndex.get('not-a-key'), undefined);
    // ...and neither one destroys an id the run already paid for.
    assert.equal(await folderIndex.get(goodKey), onDisk[goodKey]);
  });

  it('rebuilds itself when nothing in the file is readable', async () => {
    const corruptPath = join(cachePath, 'corrupt-index.jsonl');
    writeFileSync(corruptPath, 'not json\nnor this\n');

    const folderIndex = createFileFolderIndex({ filePath: corruptPath });
    assert.deepEqual(await folderIndex.entries?.(), {});
  });

  it('reports bytes it holds under any tag set', async () => {
    const { service, uploads } = stubbedUploadService();
    await service.uploadFolder({
      folderPath,
      folderIndex: createFileFolderIndex({ filePath: indexPath }),
      manifestOptions: { disableManifest: true },
    });

    const folderIndex = createFileFolderIndex({ filePath: indexPath });
    const contentHashes = uploads.map((upload) => upload.contentHash as string);
    assert.deepEqual(
      (await folderIndex.knownContentHashes?.([
        ...contentHashes,
        'f'.repeat(64),
      ])) ?? [],
      contentHashes,
    );
  });
});
