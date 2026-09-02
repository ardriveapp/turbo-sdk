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
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { TurboFolderUploadIndex, TurboLogger } from '../types.js';
import {
  contentHashTagName,
  folderIndexKey,
  isValidFolderIndexKey,
} from '../utils/folderIndex.js';
import {
  composeFolderIndex,
  createChainFolderIndex,
  createMemoryFolderIndex,
} from './folderIndex.js';

const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const idA = 'idA'.padEnd(43, 'x');
const idB = 'idB'.padEnd(43, 'x');
const ownerAddress = 'owner'.padEnd(43, 'x');

/**
 * Independent of the SDK helper under test: base64url of the sha-256 of the
 * public key is what a gateway matches `owners:` on.
 */
const expectedAddress = (publicKey: Uint8Array) =>
  createHash('sha256')
    .update(Buffer.from(publicKey))
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const b64url = (bytes: Uint8Array) =>
  Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// A raw ed25519 public key -- Solana, and the ArNS/ario signers -- is 32 bytes,
// which base64urls to exactly 43 characters: the same shape as an owner
// address. Sniffing a bare string cannot tell them apart.
const ed25519PublicKey = Buffer.alloc(32, 7);
const secp256k1PublicKey = Buffer.alloc(65, 3);
const rsaPublicKey = Buffer.alloc(512, 5);

const tagsFor = (contentHash: string, contentType: string) => [
  { name: 'Content-Type', value: contentType },
  { name: contentHashTagName, value: contentHash },
];

const keyFor = (contentHash: string, contentType = 'text/css') =>
  folderIndexKey({ contentHash, tags: tagsFor(contentHash, contentType) });

const gatewayResponse = (edges: unknown[], hasNextPage = false) =>
  ({
    ok: true,
    json: async () => ({
      data: { transactions: { pageInfo: { hasNextPage }, edges } },
    }),
  }) as unknown as Response;

const collectingLogger = () => {
  const errors: string[] = [];
  const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: (message: string) => {
      errors.push(message);
    },
    setLogLevel: () => undefined,
    setLogFormat: () => undefined,
  } as unknown as TurboLogger;
  return { logger, errors };
};

const throwingLayer = (
  name: string,
  overrides: Partial<TurboFolderUploadIndex> = {},
): TurboFolderUploadIndex => ({
  name,
  get: () => {
    throw new Error(`${name} is down`);
  },
  set: () => {
    throw new Error(`${name} is down`);
  },
  resolve: async () => {
    throw new Error(`${name} is down`);
  },
  knownContentHashes: () => {
    throw new Error(`${name} is down`);
  },
  entries: () => {
    throw new Error(`${name} is down`);
  },
  ...overrides,
});

describe('folder index keys', () => {
  it('are a bytes digest and a tags digest, so tags cannot be swapped silently', async () => {
    const asCss = await keyFor(hashA, 'text/css');
    const asJs = await keyFor(hashA, 'text/javascript');

    assert.equal(isValidFolderIndexKey(asCss), true);
    assert.notEqual(asCss, asJs);
    // The bytes half is shared and stays readable, so a gateway sweep can
    // filter on the content hash tag.
    assert.equal(asCss.slice(0, 64), hashA);
    assert.equal(asJs.slice(0, 64), hashA);
  });

  it('do not depend on the order the tags are listed in', async () => {
    const forwards = await folderIndexKey({
      contentHash: hashA,
      tags: tagsFor(hashA, 'text/css'),
    });
    const backwards = await folderIndexKey({
      contentHash: hashA,
      tags: [...tagsFor(hashA, 'text/css')].reverse(),
    });
    assert.equal(forwards, backwards);
  });

  it('order tags by code unit, not by locale', async () => {
    // localeCompare is not a total order over distinct strings: an NFC and an
    // NFD spelling compare equal without being equal, so a sort that used it
    // could leave these two tag sets in different orders on two machines and
    // hash the same file differently.
    const nfc = 'caf\u00e9';
    const nfd = 'cafe\u0301';
    assert.notEqual(nfc, nfd);
    assert.equal(nfc.localeCompare(nfd), 0);

    const forwards = await folderIndexKey({
      contentHash: hashA,
      tags: [
        { name: 'a', value: nfc },
        { name: 'a', value: nfd },
      ],
    });
    const backwards = await folderIndexKey({
      contentHash: hashA,
      tags: [
        { name: 'a', value: nfd },
        { name: 'a', value: nfc },
      ],
    });
    assert.equal(forwards, backwards);
  });

  it('do not collide when a tag value contains the record delimiters', async () => {
    // A delimiter-joined encoding hashes these two tag sets identically, and a
    // collision is a wrong reuse -- the one thing the composite key exists to
    // rule out. Tag values are arbitrary bytes, so both of these are legal.
    const embedded = await folderIndexKey({
      contentHash: hashA,
      tags: [{ name: 'a', value: 'b\u0001c\u0000d' }],
    });
    const separate = await folderIndexKey({
      contentHash: hashA,
      tags: [
        { name: 'a', value: 'b' },
        { name: 'c', value: 'd' },
      ],
    });
    assert.notEqual(embedded, separate);
  });
});

describe('createMemoryFolderIndex', () => {
  it('round trips a key to a data item id', async () => {
    const key = await keyFor(hashA);
    const index = createMemoryFolderIndex();

    assert.equal(await index.get(key), undefined);
    await index.set(key, idA);
    assert.equal(await index.get(key), idA);
  });

  it('drops malformed seed entries rather than publishing a bad id', async () => {
    const key = await keyFor(hashA);
    const index = createMemoryFolderIndex({
      [key]: idA,
      // A bare content hash was the key format before tags were covered.
      [hashA]: idB,
      [await keyFor(hashB)]: 'not-an-id',
    });
    assert.deepEqual(await index.entries?.(), { [key]: idA });
  });

  it('reports bytes it holds under any tag set', async () => {
    const index = createMemoryFolderIndex({
      [await keyFor(hashA, 'text/css')]: idA,
    });
    assert.deepEqual(await index.knownContentHashes?.([hashA, hashB]), [hashA]);
  });
});

describe('composeFolderIndex', () => {
  it('falls through reads in order and returns the first hit', async () => {
    const key = await keyFor(hashA);
    const front = createMemoryFolderIndex();
    const back = createMemoryFolderIndex({ [key]: idA });

    assert.equal(await composeFolderIndex([front, back]).get(key), idA);
  });

  it('writes to every writable layer and skips read only ones', async () => {
    const key = await keyFor(hashA);
    const writable = createMemoryFolderIndex();
    const readOnly: TurboFolderUploadIndex = {
      name: 'readOnly',
      readOnly: true,
      get: () => undefined,
      set: () => {
        assert.fail('a read only layer must never be written to');
      },
    };

    await composeFolderIndex([writable, readOnly]).set(key, idA);
    assert.equal(await writable.get(key), idA);
  });

  it('caches ids recovered from a read only layer into the writable ones', async () => {
    const key = await keyFor(hashA);
    const writable = createMemoryFolderIndex();
    const readOnly: TurboFolderUploadIndex = {
      name: 'readOnly',
      readOnly: true,
      get: () => undefined,
      set: () => undefined,
      resolve: async () => ({ [key]: idA }),
    };

    const index = composeFolderIndex([writable, readOnly]);
    assert.deepEqual(await index.resolve?.([key]), { [key]: idA });
    assert.equal(await writable.get(key), idA);
  });

  it('consults a later layer when an earlier get throws', async () => {
    const key = await keyFor(hashA);
    const { logger, errors } = collectingLogger();

    const index = composeFolderIndex(
      [throwingLayer('broken'), createMemoryFolderIndex({ [key]: idA })],
      { logger },
    );

    assert.equal(await index.get(key), idA);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /broken failed to read/);
  });

  it('consults a later layer when an earlier resolve throws', async () => {
    const key = await keyFor(hashA);
    const { logger } = collectingLogger();

    const index = composeFolderIndex(
      [
        throwingLayer('broken'),
        {
          name: 'good',
          readOnly: true,
          get: () => undefined,
          set: () => undefined,
          resolve: async () => ({ [key]: idA }),
        },
      ],
      { logger },
    );

    assert.deepEqual(await index.resolve?.([key]), { [key]: idA });
  });

  it('still writes to a later layer when an earlier set throws', async () => {
    // A read only or full disk under the file layer must not discard ids the
    // run has already paid for, which the memory layer would have kept.
    const key = await keyFor(hashA);
    const memory = createMemoryFolderIndex();
    const { logger, errors } = collectingLogger();

    const index = composeFolderIndex([throwingLayer('full-disk'), memory], {
      logger,
    });
    await index.set(key, idA);

    assert.equal(await memory.get(key), idA);
    assert.match(errors[0], /full-disk failed to write/);
  });

  it('unions knownContentHashes across layers and skips a throwing one', async () => {
    const { logger } = collectingLogger();
    const index = composeFolderIndex(
      [
        throwingLayer('broken'),
        createMemoryFolderIndex({ [await keyFor(hashA)]: idA }),
      ],
      { logger },
    );
    assert.deepEqual(await index.knownContentHashes?.([hashA, hashB]), [hashA]);
  });
});

describe('createChainFolderIndex owner', () => {
  const fetchImpl = (async () =>
    gatewayResponse([])) as unknown as typeof fetch;

  const addressUsedBy = async (
    index: TurboFolderUploadIndex,
    requests: Record<string, unknown>[],
  ) => {
    await index.resolve?.([await keyFor(hashA)]);
    return (requests[0].variables as { owner: string }).owner;
  };

  const recordingFetch = () => {
    const requests: Record<string, unknown>[] = [];
    const impl = (async (_url: string, init: { body: string }) => {
      requests.push(JSON.parse(init.body));
      return gatewayResponse([]);
    }) as unknown as typeof fetch;
    return { impl, requests };
  };

  it('hashes a raw ed25519 public key rather than passing it through', async () => {
    // Regression: 32 bytes base64urls to exactly 43 characters, so a
    // character-count check treats an ed25519 key as an address, sends it
    // unhashed, matches nothing, and re-uploads the folder with no error.
    assert.equal(b64url(ed25519PublicKey).length, 43);

    const { impl, requests } = recordingFetch();
    const index = createChainFolderIndex({
      owner: ed25519PublicKey,
      fetchImpl: impl,
    });

    const used = await addressUsedBy(index, requests);
    assert.equal(used, expectedAddress(ed25519PublicKey));
    assert.notEqual(used, b64url(ed25519PublicKey));
  });

  it('hashes a secp256k1 and an RSA public key', async () => {
    for (const publicKey of [secp256k1PublicKey, rsaPublicKey]) {
      const { impl, requests } = recordingFetch();
      const index = createChainFolderIndex({
        owner: publicKey,
        fetchImpl: impl,
      });
      assert.equal(
        await addressUsedBy(index, requests),
        expectedAddress(publicKey),
      );
    }
  });

  it('hashes a base64url public key given under { publicKey }', async () => {
    const { impl, requests } = recordingFetch();
    const index = createChainFolderIndex({
      owner: { publicKey: b64url(ed25519PublicKey) },
      fetchImpl: impl,
    });
    assert.equal(
      await addressUsedBy(index, requests),
      expectedAddress(ed25519PublicKey),
    );
  });

  it('passes an { address } through untouched', async () => {
    const { impl, requests } = recordingFetch();
    const index = createChainFolderIndex({
      owner: { address: ownerAddress },
      fetchImpl: impl,
    });
    assert.equal(await addressUsedBy(index, requests), ownerAddress);
  });

  it('refuses a public key that is not one of the real key sizes', () => {
    // Declaring which one you have is not the same as having it. Every one of
    // these hashes to a well formed address that matches nothing, which is the
    // silent full price re-upload the union exists to prevent.
    for (const publicKey of [
      new Uint8Array(0),
      new Uint8Array(1),
      new Uint8Array(31),
      new Uint8Array(33),
      new Uint8Array(64),
    ]) {
      assert.throws(
        () => createChainFolderIndex({ owner: publicKey, fetchImpl }),
        /must be an ed25519 \(32 byte\), secp256k1 \(65 byte\) or RSA \(512 byte\) public key/,
        `${publicKey.length} bytes`,
      );
    }
    assert.throws(
      () => createChainFolderIndex({ owner: { publicKey: 'abc' }, fetchImpl }),
      /got 2 bytes/,
    );
    assert.throws(
      () => createChainFolderIndex({ owner: { publicKey: '!!!' }, fetchImpl }),
      /must be base64url/,
    );
  });

  it('refuses a bare string, which cannot be disambiguated', () => {
    assert.throws(
      () =>
        createChainFolderIndex({
          owner: b64url(ed25519PublicKey) as never,
          fetchImpl,
        }),
      /ambiguous/,
    );
  });

  it('rejects a native address given as an { address }', () => {
    assert.throws(
      () =>
        createChainFolderIndex({
          owner: { address: '0x20c1DF6f3310600c8396111EB5182af9213828Dc' },
          fetchImpl,
        }),
      /not what a gateway indexes/,
    );
  });
});

describe('createChainFolderIndex', () => {
  const fetchReturning = (
    ...responses: Response[]
  ): { fetchImpl: typeof fetch; requests: Record<string, unknown>[] } => {
    const requests: Record<string, unknown>[] = [];
    let call = 0;
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      requests.push(JSON.parse(init.body));
      return responses[Math.min(call++, responses.length - 1)];
    }) as unknown as typeof fetch;
    return { fetchImpl, requests };
  };

  const owner = { address: ownerAddress };

  it('resolves keys it can reconstruct from a past upload', async () => {
    const key = await keyFor(hashA, 'text/css');
    const otherKey = await keyFor(hashB, 'text/css');
    const { fetchImpl, requests } = fetchReturning(
      gatewayResponse([
        {
          cursor: 'cursor-1',
          node: { id: idA, tags: tagsFor(hashA, 'text/css') },
        },
      ]),
    );

    const index = createChainFolderIndex({ owner, fetchImpl });
    const resolved = await index.resolve?.([key, otherKey]);

    assert.deepEqual(resolved, { [key]: idA });
    assert.equal(await index.get(key), idA);
    assert.equal(requests.length, 1);
    // The query filters on the bytes half, which is all a gateway can index.
    assert.deepEqual((requests[0].variables as { hashes: string[] }).hashes, [
      hashA,
      hashB,
    ]);
  });

  it('does not resolve an item whose tags differ, but remembers its bytes', async () => {
    const wantedAsJs = await keyFor(hashA, 'text/javascript');
    const { fetchImpl } = fetchReturning(
      gatewayResponse([
        {
          cursor: 'cursor-1',
          node: { id: idA, tags: tagsFor(hashA, 'text/css') },
        },
      ]),
    );

    const index = createChainFolderIndex({ owner, fetchImpl });
    assert.deepEqual(await index.resolve?.([wantedAsJs]), {});
    // The bytes-only GraphQL filter hands this over for free, and it is the
    // whole basis of the stale-tag diagnostic.
    assert.deepEqual(await index.knownContentHashes?.([hashA, hashB]), [hashA]);
  });

  it('reports nothing known when the sweep never ran', async () => {
    const { fetchImpl } = fetchReturning(gatewayResponse([]));
    const index = createChainFolderIndex({ owner, fetchImpl });
    assert.deepEqual(await index.knownContentHashes?.([hashA]), []);
  });

  it('never writes, so an id it did not see stays unknown', async () => {
    const key = await keyFor(hashA);
    const { fetchImpl } = fetchReturning(gatewayResponse([]));

    const index = createChainFolderIndex({ owner, fetchImpl });
    await index.set(key, idA);
    assert.equal(await index.get(key), undefined);
    assert.deepEqual(await index.resolve?.([key]), {});
  });

  it('throws when the gateway rejects the query', async () => {
    const { fetchImpl } = fetchReturning({
      ok: false,
      status: 503,
    } as unknown as Response);

    const index = createChainFolderIndex({ owner, fetchImpl });
    await assert.rejects(
      async () => index.resolve?.([await keyFor(hashA)]),
      /503/,
    );
  });

  it('throws rather than crashing when the payload has no transactions', async () => {
    const { fetchImpl } = fetchReturning({
      ok: true,
      json: async () => ({ errors: [{ message: 'bad query' }] }),
    } as unknown as Response);

    const index = createChainFolderIndex({ owner, fetchImpl });
    await assert.rejects(
      async () => index.resolve?.([await keyFor(hashA)]),
      /bad query/,
    );
  });

  it('skips edges and nodes that are not the shape it expects', async () => {
    const key = await keyFor(hashA, 'text/css');
    const { fetchImpl } = fetchReturning(
      gatewayResponse([
        null,
        { cursor: 'c1' },
        { cursor: 'c2', node: { id: idB } },
        { cursor: 'c3', node: { id: idB, tags: null } },
        { cursor: 'c4', node: { id: idB, tags: [null, { name: 'X' }] } },
        { cursor: 'c5', node: { id: null, tags: tagsFor(hashA, 'text/css') } },
        { cursor: 'c6', node: { id: idA, tags: tagsFor(hashA, 'text/css') } },
      ]),
    );

    const index = createChainFolderIndex({ owner, fetchImpl });
    assert.deepEqual(await index.resolve?.([key]), { [key]: idA });
  });

  it('stops on an empty page rather than re-issuing the same query', async () => {
    const { fetchImpl, requests } = fetchReturning(gatewayResponse([], true));

    const index = createChainFolderIndex({ owner, fetchImpl });
    assert.deepEqual(await index.resolve?.([await keyFor(hashA)]), {});
    assert.equal(requests.length, 1);
  });

  it('aborts the sweep when the caller aborts the upload', async () => {
    const controller = new AbortController();
    const fetchImpl = (async (_url: string, init: { signal: AbortSignal }) => {
      controller.abort(new Error('caller gave up'));
      assert.equal(init.signal.aborted, true);
      throw init.signal.reason;
    }) as unknown as typeof fetch;

    const index = createChainFolderIndex({ owner, fetchImpl });
    await assert.rejects(
      async () =>
        index.resolve?.([await keyFor(hashA)], { signal: controller.signal }),
      /caller gave up/,
    );
  });

  it('times out a gateway that sends headers and then stalls the body', async () => {
    // Headers arriving is not the request finishing. If the guard is released
    // when fetch resolves, this hangs forever -- and uploadFolder awaits it
    // inline, so the whole upload hangs with it.
    const fetchImpl = (async (_url: string, init: { signal: AbortSignal }) => ({
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(init.signal.reason),
            { once: true },
          );
        }),
    })) as unknown as typeof fetch;

    const index = createChainFolderIndex({ owner, fetchImpl, timeoutMs: 50 });
    await assert.rejects(
      async () => index.resolve?.([await keyFor(hashA)]),
      /Timed out after 50ms/,
    );
  });

  it('aborts a stalled body when the caller aborts the upload', async () => {
    const controller = new AbortController();
    const fetchImpl = (async (_url: string, init: { signal: AbortSignal }) => ({
      ok: true,
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(init.signal.reason),
            { once: true },
          );
          setTimeout(() => controller.abort(new Error('caller gave up')), 5);
        }),
    })) as unknown as typeof fetch;

    const index = createChainFolderIndex({
      owner,
      fetchImpl,
      timeoutMs: 60_000,
    });
    await assert.rejects(
      async () =>
        index.resolve?.([await keyFor(hashA)], { signal: controller.signal }),
      /caller gave up/,
    );
  });

  it('rejects page sizes, page counts and timeouts that are not usable', () => {
    for (const params of [
      { pageSize: 0 },
      { pageSize: -1 },
      // Integer to Number.isInteger, but stringifies as "1e+21" and earns a 400.
      { pageSize: 1e21 },
      { pageSize: '100 first:1 x' as unknown as number },
      // Silently disabled the sweep altogether.
      { maxPages: 0 },
      { timeoutMs: 0 },
      { timeoutMs: -5 },
    ]) {
      assert.throws(
        () => createChainFolderIndex({ owner, ...params }),
        /must be an integer between/,
        JSON.stringify(params),
      );
    }
  });
});
