"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMemoryFolderIndex = createMemoryFolderIndex;
exports.createChainFolderIndex = createChainFolderIndex;
exports.composeFolderIndex = composeFolderIndex;
const base64_js_1 = require("../utils/base64.js");
const common_js_1 = require("../utils/common.js");
const errors_js_1 = require("../utils/errors.js");
const folderIndex_js_1 = require("../utils/folderIndex.js");
/**
 * The base64url address a gateway indexes an upload under.
 *
 * Deliberately refuses to guess. A gateway matches `owners:` on the base64url
 * sha-256 of the signer's public key, and a raw 32 byte ed25519 public key
 * base64urls to exactly 43 characters -- indistinguishable from that address.
 * Sniffing the shape of a bare string therefore has a silent failure mode that
 * costs real money: the unhashed key matches nothing, every file misses, and
 * the whole folder is re-uploaded with no error anywhere. So the caller says
 * which one they have, and `getPublicKey()` bytes are taken directly.
 */
function resolveOwnerAddress(owner) {
    const fromPublicKey = (publicKey) => {
        if (typeof publicKey === 'string' && !/^[a-zA-Z0-9_-]+$/.test(publicKey)) {
            throw new errors_js_1.ProvidedInputError('createChainFolderIndex owner.publicKey must be base64url, or the raw bytes from await turbo.signer.getPublicKey()');
        }
        const raw = typeof publicKey === 'string'
            ? (0, base64_js_1.fromB64Url)(publicKey)
            : Buffer.from(publicKey);
        // Declaring which one you have is not the same as having it. Anything gets
        // hashed to a well formed address that simply matches nothing, which is the
        // same silent full price re-upload the tagged union exists to prevent, one
        // level in. These are the key sizes this SDK's signers produce.
        if (!publicKeyByteLengths.has(raw.length)) {
            throw new errors_js_1.ProvidedInputError(`createChainFolderIndex owner.publicKey must be an ed25519 (32 byte), secp256k1 (65 byte) or RSA (512 byte) public key, got ${raw.length} bytes. Pass await turbo.signer.getPublicKey(), or use { address } if what you have is an owner address.`);
        }
        return (0, base64_js_1.ownerToAddress)((0, base64_js_1.toB64Url)(raw));
    };
    if (owner instanceof Uint8Array) {
        return fromPublicKey(owner);
    }
    if (owner !== null && typeof owner === 'object') {
        if (owner.publicKey !== undefined) {
            return fromPublicKey(owner.publicKey);
        }
        if (typeof owner.address === 'string') {
            if (!(0, common_js_1.isValidArweaveBase64URL)(owner.address)) {
                throw new errors_js_1.ProvidedInputError(`createChainFolderIndex owner.address must be a 43 character base64url address, got '${owner.address}'. A native address (an 0x... or a base58 Solana address) is not what a gateway indexes uploads under.`);
            }
            return owner.address;
        }
    }
    throw new errors_js_1.ProvidedInputError('createChainFolderIndex needs owner: await turbo.signer.getPublicKey(), or { publicKey } or { address }. ' +
        'A bare string is ambiguous -- a 32 byte ed25519 public key and an owner address are both 43 base64url characters -- ' +
        'and guessing wrong re-uploads the whole folder without an error.');
}
/**
 * What `getPublicKey()` returns across the supported signers: ed25519 for
 * Solana and ario, uncompressed secp256k1 for Ethereum, Base, Polygon and KYVE,
 * and a 4096 bit RSA modulus for Arweave.
 *
 * A 32 byte value declared as a `publicKey` is still taken at its word, since
 * an owner address is also 32 bytes and nothing can tell them apart -- that is
 * why the caller has to say which one they mean.
 */
const publicKeyByteLengths = new Set([32, 65, 512]);
function requirePositiveInteger(value, name, max) {
    const parsed = Number(value);
    // `1e21` is an integer to Number.isInteger and stringifies as "1e+21", which
    // is not a GraphQL Int. An upper bound settles both that and a nonsense page.
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
        throw new errors_js_1.ProvidedInputError(`createChainFolderIndex ${name} must be an integer between 1 and ${max}, got '${value}'`);
    }
    return parsed;
}
/**
 * One signal that aborts on whichever comes first, the caller giving up or the
 * request timing out. `AbortSignal.any` is not available on every supported
 * runtime, so this is wired by hand.
 */
function abortAfter(timeoutMs, signal) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    const onAbort = () => controller.abort(signal?.reason);
    if (signal !== undefined) {
        if (signal.aborted) {
            controller.abort(signal.reason);
        }
        else {
            signal.addEventListener('abort', onAbort, { once: true });
        }
    }
    return {
        signal: controller.signal,
        done: () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        },
    };
}
const contentHashesOf = (keys) => new Set([...keys].map(folderIndex_js_1.contentHashFromFolderIndexKey));
/**
 * An in-memory folder index.
 *
 * On its own it only deduplicates identical files within a single
 * `uploadFolder` call, which `uploadFolder` already does. Its real use is as
 * the writable floor of a {@link composeFolderIndex} stack, or seeded from a
 * mapping the caller persisted itself.
 */
function createMemoryFolderIndex(seed = {}) {
    const map = new Map(Object.entries(seed).filter(([key, id]) => (0, folderIndex_js_1.isValidFolderIndexKey)(key) && (0, common_js_1.isValidArweaveBase64URL)(id)));
    return {
        name: 'memory',
        get: (key) => map.get(key),
        set: (key, id) => {
            map.set(key, id);
        },
        knownContentHashes: (contentHashes) => {
            const known = contentHashesOf(map.keys());
            return contentHashes.filter((contentHash) => known.has(contentHash));
        },
        entries: () => Object.fromEntries(map),
    };
}
/**
 * Rebuilds a folder index by sweeping the uploader's own past uploads over a
 * gateway's GraphQL endpoint, filtering on the `File-SHA256` tag that
 * index-backed uploads always write.
 *
 * Read only, and the only layer that survives a fresh checkout on a machine
 * that has never deployed before -- a CI runner, most obviously.
 *
 * Known limitation: gateways index an upload minutes after it lands, so two
 * machines deploying the same new file at the same moment will each pay for it
 * once. The manifest is correct either way; only the bill is affected, and only
 * for genuinely new bytes.
 */
function createChainFolderIndex({ owner, appName, gatewayUrl = 'https://arweave.net', hashTagName = folderIndex_js_1.contentHashTagName, maxPages = 20, pageSize = 100, timeoutMs = 30_000, fetchImpl = fetch, logger, }) {
    const ownerAddress = resolveOwnerAddress(owner);
    const first = requirePositiveInteger(pageSize, 'pageSize', 1000);
    const pageLimit = requirePositiveInteger(maxPages, 'maxPages', 10_000);
    const requestTimeoutMs = requirePositiveInteger(timeoutMs, 'timeoutMs', 24 * 60 * 60 * 1000);
    const map = new Map();
    // Every content hash a sweep has actually seen on chain, whatever tags the
    // item carried. The bytes-only GraphQL filter hands this over for free, and
    // it is the only evidence anywhere that a file's content is already paid for
    // under a different tag set.
    const seenContentHashes = new Set();
    // Filtering on the hash tag itself keeps the sweep to items this run cares
    // about, so a long deployment history costs nothing to walk past.
    const tagFilter = appName !== undefined
        ? `tags:[{name:"App-Name",values:[${JSON.stringify(appName)}]},{name:${JSON.stringify(hashTagName)},values:$hashes}]`
        : `tags:[{name:${JSON.stringify(hashTagName)},values:$hashes}]`;
    const query = `query($owner:String!,$hashes:[String!]!,$after:String){
  transactions(owners:[$owner] ${tagFilter} sort:HEIGHT_DESC first:${first} after:$after){
    pageInfo{hasNextPage}
    edges{cursor node{id tags{name value}}}
  }
}`;
    return {
        name: `chain:${gatewayUrl}`,
        readOnly: true,
        // Declared so `uploadFolder` writes the tag this sweep filters on. Without
        // it a non-default `hashTagName` matches nothing, on every run, silently.
        hashTagName,
        get: (key) => map.get(key),
        set: () => undefined,
        knownContentHashes: (contentHashes) => contentHashes.filter((contentHash) => seenContentHashes.has(contentHash)),
        resolve: async (keys, options) => {
            const wanted = new Set(keys.filter(folderIndex_js_1.isValidFolderIndexKey));
            if (wanted.size === 0) {
                return {};
            }
            const hashes = [...contentHashesOf(wanted)];
            const found = {};
            let cursor = null;
            let pagesWalked = 0;
            let moreToWalk = false;
            for (let page = 0; page < pageLimit && Object.keys(found).length < wanted.size; page++) {
                pagesWalked++;
                const abort = abortAfter(requestTimeoutMs, options?.signal);
                let body;
                try {
                    const response = await fetchImpl(`${gatewayUrl}/graphql`, {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                            query,
                            variables: { owner: ownerAddress, hashes, after: cursor },
                        }),
                        signal: abort.signal,
                    });
                    if (!response.ok) {
                        throw new Error(`Failed to query ${gatewayUrl}/graphql for a folder index: ${response.status}`);
                    }
                    // Read inside the same guard. Headers arriving is not the request
                    // finishing: a gateway that flushes them and then stalls the body
                    // would hang here forever with the timer already cleared and the
                    // caller's abort listener already removed, and `uploadFolder` awaits
                    // this inline.
                    body = await response.json();
                }
                finally {
                    abort.done();
                }
                const transactions = body?.data?.transactions;
                // A gateway may answer with an error payload, a null field, or a shape
                // this code has never seen, and every node in a page it does return is
                // equally untrusted.
                if (!Array.isArray(transactions?.edges)) {
                    throw new Error(`Failed to query ${gatewayUrl}/graphql for a folder index: ${JSON.stringify(body?.errors ?? body)}`);
                }
                if (transactions.edges.length === 0) {
                    // `after` only advances from an edge, so a page with none would
                    // re-issue the identical query until maxPages ran out.
                    break;
                }
                for (const edge of transactions.edges) {
                    if (typeof edge?.cursor === 'string') {
                        cursor = edge.cursor;
                    }
                    const node = edge?.node;
                    const tags = node?.tags;
                    if (typeof node?.id !== 'string' || !Array.isArray(tags)) {
                        continue;
                    }
                    // Every element is untrusted, not just the one carrying the hash.
                    // `folderIndexKey` reads `.name`/`.value` off each tag unguarded, so
                    // one malformed entry would throw out of the key encoding and take
                    // the whole sweep, and the upload awaiting it, with it.
                    if (!tags.every((tag) => typeof tag?.name === 'string' && typeof tag?.value === 'string')) {
                        continue;
                    }
                    const contentHash = tags.find((tag) => tag?.name === hashTagName)
                        ?.value;
                    if (!(0, folderIndex_js_1.isValidContentHash)(contentHash)) {
                        continue;
                    }
                    // Seen on chain under whatever tags this item happens to carry. A
                    // key that does not match is still worth remembering as bytes that
                    // are already paid for.
                    seenContentHashes.add(contentHash);
                    // A node carries exactly the tags that were written, so the key can
                    // be recomputed and matched against the ones this run needs.
                    const key = await (0, folderIndex_js_1.folderIndexKey)({ contentHash, tags });
                    // Newest first, and every upload of these exact bytes and tags is
                    // equally valid, so the first sighting wins.
                    if (wanted.has(key) && found[key] === undefined) {
                        found[key] = node.id;
                        map.set(key, node.id);
                    }
                }
                if (transactions.pageInfo?.hasNextPage !== true) {
                    break;
                }
                moreToWalk = true;
            }
            // Running out of pages is not the same as running out of matches, and it
            // is the one outcome that costs money without looking like anything: the
            // unresolved files are re-uploaded at full price, on every deploy, and
            // the summary reports them as ordinary new files. `pageSize * maxPages`
            // caps how many items a sweep can ever see, so a folder larger than that
            // cannot resolve in full however many times it is run.
            const resolved = Object.keys(found).length;
            if (pagesWalked >= pageLimit && moreToWalk && resolved < wanted.size) {
                logger?.warn(`The folder index sweep of ${gatewayUrl} stopped at its ${pageLimit} page limit with ` +
                    `${wanted.size - resolved} of ${wanted.size} file(s) still unresolved, and the gateway ` +
                    'had more to give. Those files are about to be uploaded and paid for again even though ' +
                    `they may already be on Arweave. A sweep can see at most pageSize * maxPages items ` +
                    `(${first} * ${pageLimit} = ${first * pageLimit} here), so raise maxPages or pageSize, ` +
                    'or put a persistent local index in front of this one.');
            }
            return found;
        },
        entries: () => Object.fromEntries(map),
    };
}
/**
 * Layers folder indexes: reads fall through in order, writes go to every layer
 * that is not read only.
 *
 * The usual stack is a local cache in front of a chain index -- the cache
 * answers instantly on a developer machine, and the chain index is what a CI
 * runner with an empty working directory falls back to.
 *
 * A layer that throws is skipped, not propagated. That is the whole point of
 * stacking them: a full disk under the file layer must not stop the memory
 * layer from holding ids the run has already paid for, and an unreachable
 * gateway must not stop the local cache from answering.
 */
function composeFolderIndex(layers, { logger } = {}) {
    const stack = layers.filter((layer) => layer !== undefined);
    if (stack.length === 0) {
        return createMemoryFolderIndex();
    }
    const writableLayers = stack.filter((layer) => layer.readOnly !== true);
    // Every layer that cares which tag holds a content hash has to want the same
    // one, because `uploadFolder` writes exactly one tag per file. Two layers
    // disagreeing is not something a run can degrade around: whichever one loses
    // matches nothing, for ever, without an error.
    const declaredHashTagNames = [
        ...new Set(stack
            .map((layer) => layer.hashTagName)
            .filter((name) => name !== undefined)),
    ];
    if (declaredHashTagNames.length > 1) {
        throw new errors_js_1.ProvidedInputError(`composeFolderIndex layers disagree about which tag holds a file's content hash: ${declaredHashTagNames
            .map((name) => `'${name}'`)
            .join(', ')}. uploadFolder writes one tag per file, so every layer that declares one must declare the same one.`);
    }
    const failed = (layer, what, error) => logger?.error(`Folder index layer ${layer.name ?? 'anonymous'} failed to ${what}, skipping it`, error);
    const set = async (key, id) => {
        for (const layer of writableLayers) {
            try {
                await layer.set(key, id);
            }
            catch (error) {
                failed(layer, 'write', error);
            }
        }
    };
    return {
        name: `composed(${stack
            .map((layer) => layer.name ?? 'anonymous')
            .join(', ')})`,
        readOnly: writableLayers.length === 0,
        hashTagName: declaredHashTagNames[0],
        get: async (key) => {
            for (const layer of stack) {
                try {
                    const id = await layer.get(key);
                    if ((0, common_js_1.isValidArweaveBase64URL)(id ?? '')) {
                        return id;
                    }
                }
                catch (error) {
                    failed(layer, 'read', error);
                }
            }
            return undefined;
        },
        set,
        knownContentHashes: async (contentHashes) => {
            const known = new Set();
            for (const layer of stack) {
                try {
                    for (const contentHash of (await layer.knownContentHashes?.(contentHashes)) ?? []) {
                        known.add(contentHash);
                    }
                }
                catch (error) {
                    failed(layer, 'report known content hashes', error);
                }
            }
            return [...known];
        },
        resolve: async (keys, options) => {
            const found = {};
            let remaining = keys;
            for (const layer of stack) {
                if (remaining.length === 0) {
                    break;
                }
                if (layer.resolve === undefined) {
                    continue;
                }
                try {
                    const resolved = await layer.resolve(remaining, options);
                    for (const [key, id] of Object.entries(resolved)) {
                        if (!(0, common_js_1.isValidArweaveBase64URL)(id)) {
                            continue;
                        }
                        found[key] = id;
                    }
                    remaining = remaining.filter((key) => found[key] === undefined);
                }
                catch (error) {
                    failed(layer, 'resolve', error);
                }
            }
            // An id recovered from a read only layer is worth caching in the writable
            // ones so the next run can skip the network entirely.
            for (const [key, id] of Object.entries(found)) {
                await set(key, id);
            }
            return found;
        },
        entries: async () => {
            const entries = {};
            // Reverse so the front of the stack wins on conflict.
            for (const layer of [...stack].reverse()) {
                try {
                    Object.assign(entries, (await layer.entries?.()) ?? {});
                }
                catch (error) {
                    failed(layer, 'enumerate', error);
                }
            }
            return entries;
        },
    };
}
