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
export declare const contentHashTagName = "File-SHA256";
/** True for a lowercase hex sha-256 digest of a file's bytes. */
export declare function isValidContentHash(hash: string | undefined): hash is string;
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
export declare function isValidFolderIndexKey(key: string | undefined): key is string;
/** The bytes half of a folder index key. */
export declare function contentHashFromFolderIndexKey(key: string): string;
/** The folder index key for a file with these bytes and these final tags. */
export declare function folderIndexKey({ contentHash, tags, }: {
    contentHash: string;
    tags: {
        name: string;
        value: string;
    }[];
}): Promise<string>;
//# sourceMappingURL=folderIndex.d.ts.map