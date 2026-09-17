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
/**
 * Internals shared by the folder index layers and by `uploadFolder`. Not part
 * of the package's public surface.
 */
/** Tag carrying the sha-256 of a file's own bytes, as lowercase hex. */
export const contentHashTagName = 'File-SHA256';
const contentHashRegex = /^[0-9a-f]{64}$/;
const folderIndexKeyRegex = /^[0-9a-f]{64}\.[0-9a-f]{64}$/;
/** True for a lowercase hex sha-256 digest of a file's bytes. */
export function isValidContentHash(hash) {
    return hash !== undefined && contentHashRegex.test(hash);
}
/**
 * A folder index key is `<sha-256 of the bytes>.<sha-256 of the tags>`.
 *
 * Both halves matter. Keying on the bytes alone would reuse an item whose tags
 * are not the ones the caller asked for: an empty `a.css` and an empty `b.js`
 * hash identically, and reusing one for the other would serve JavaScript as
 * `text/css`. Keying on the tags as well means a reused data item is always
 * exactly the data item this call would otherwise have created.
 *
 * The bytes half is kept in the clear so a layer that queries a gateway can
 * recover it and filter on the `File-SHA256` tag.
 */
export function isValidFolderIndexKey(key) {
    return key !== undefined && folderIndexKeyRegex.test(key);
}
/** The bytes half of a folder index key. */
export function contentHashFromFolderIndexKey(key) {
    return key.slice(0, 64);
}
async function sha256Hex(data) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Buffer.from(digest).toString('hex');
}
/**
 * Canonical encoding of a tag set: the same tags in a different order encode
 * identically, because two data items that differ only in tag order are the
 * same item as far as reuse goes.
 *
 * The sort compares code units rather than using `localeCompare`, which is not
 * a total order over distinct strings and depends on the host's ICU data --
 * NFC and NFD spellings of the same word compare equal without being equal, and
 * two locales disagree on where an accented letter sorts. Either would let one
 * tag set hash differently on two machines, which costs a reuse.
 *
 * The encoding has to be injective, not merely stable. An ANS-104 tag name and
 * value are arbitrary byte arrays, so a delimiter-joined string collides: with
 * a 0x00/0x01 join, a single tag whose value embeds both delimiters encodes
 * exactly like two separate tags. A collision here is a wrong reuse, which is
 * the one failure the composite key exists to make impossible. JSON escapes
 * the delimiters, so no value can forge a record boundary.
 */
function canonicalTags(tags) {
    const pairs = tags
        .map((tag) => [tag.name, tag.value])
        .sort(([aName, aValue], [bName, bValue]) => {
        const [a, b] = aName === bName ? [aValue, bValue] : [aName, bName];
        return a < b ? -1 : a > b ? 1 : 0;
    });
    return new TextEncoder().encode(JSON.stringify(pairs));
}
/** The folder index key for a file with these bytes and these final tags. */
export async function folderIndexKey({ contentHash, tags, }) {
    return `${contentHash}.${await sha256Hex(canonicalTags(tags))}`;
}
