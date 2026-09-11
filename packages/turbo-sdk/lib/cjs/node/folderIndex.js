"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFileFolderIndex = createFileFolderIndex;
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
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_js_1 = require("../utils/common.js");
const folderIndex_js_1 = require("../utils/folderIndex.js");
const fileFolderIndexVersion = 2;
/**
 * A local record of folder index key to data item id, for uploads on a machine
 * that keeps its working directory between deploys.
 *
 * The file is an append-only log, one JSON record per line, compacted when it
 * is loaded. That shape falls out of two requirements pulling against each
 * other:
 *
 * - It has to be written after every single upload, not once at the end of the
 *   run. An upload that has been paid for but forgotten is money burnt, and a
 *   deploy killed part way through is the normal case rather than the
 *   exceptional one.
 * - Rewriting the whole file per upload is quadratic. A first deploy or a
 *   migration of a few thousand files spends minutes and gigabytes of writes on
 *   nothing but bookkeeping.
 *
 * Appending one line is constant work, and it is *more* crash safe than a
 * rewrite rather than less: a process killed mid write can only damage the last
 * line, which is dropped on load, where a torn rewrite loses every id in the
 * file. Compaction happens once per load, through a temp file and a rename, so
 * the readable file is never the partial one.
 *
 * Malformed records are dropped. A hand edited index must never be able to
 * publish a manifest pointing at nothing.
 */
function createFileFolderIndex({ filePath, logger, }) {
    const absolutePath = (0, node_path_1.resolve)(filePath);
    const tempPath = `${absolutePath}.tmp`;
    const map = new Map();
    const record = (key, id) => `${JSON.stringify({ k: key, i: id })}\n`;
    const header = `${JSON.stringify({ folderIndex: fileFolderIndexVersion })}\n`;
    /** Rewrites the log as one record per live entry, atomically. */
    const compact = () => {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(absolutePath), { recursive: true });
        const body = [...map]
            // Code units, not `localeCompare`, for the same reason the key encoding
            // avoids it: it is not a total order over distinct strings and depends on
            // the host's ICU data. Only the file's readability rides on this one, but
            // a sort that can call two distinct keys equal has no business here.
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, id]) => record(key, id))
            .join('');
        try {
            (0, node_fs_1.writeFileSync)(tempPath, `${header}${body}`);
            (0, node_fs_1.renameSync)(tempPath, absolutePath);
        }
        catch (error) {
            (0, node_fs_1.rmSync)(tempPath, { force: true });
            throw error;
        }
    };
    let lineCount = 0;
    if ((0, node_fs_1.existsSync)(absolutePath)) {
        let malformed = 0;
        // A line at a time, so a truncated tail costs one entry rather than all of
        // them.
        for (const line of (0, node_fs_1.readFileSync)(absolutePath, 'utf-8').split('\n')) {
            if (line.length === 0) {
                continue;
            }
            lineCount++;
            try {
                const parsed = JSON.parse(line);
                if (parsed?.folderIndex !== undefined) {
                    continue; // header
                }
                if ((0, folderIndex_js_1.isValidFolderIndexKey)(parsed?.k) &&
                    (0, common_js_1.isValidArweaveBase64URL)(parsed?.i)) {
                    map.set(parsed.k, parsed.i); // last write wins
                }
                else {
                    malformed++;
                }
            }
            catch {
                malformed++;
            }
        }
        if (malformed > 0) {
            logger?.warn(`Dropped ${malformed} unreadable record(s) from the folder index at ${absolutePath}`);
        }
        // Only worth rewriting when the log has actually accumulated slack.
        if (lineCount > map.size + 1) {
            try {
                compact();
            }
            catch (error) {
                logger?.warn(`Could not compact the folder index at ${absolutePath}`, error);
            }
        }
    }
    return {
        name: `file:${absolutePath}`,
        get: (key) => map.get(key),
        set: (key, id) => {
            map.set(key, id);
            (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(absolutePath), { recursive: true });
            if (!(0, node_fs_1.existsSync)(absolutePath)) {
                (0, node_fs_1.writeFileSync)(absolutePath, header);
            }
            (0, node_fs_1.appendFileSync)(absolutePath, record(key, id));
        },
        knownContentHashes: (contentHashes) => {
            const known = new Set([...map.keys()].map(folderIndex_js_1.contentHashFromFolderIndexKey));
            return contentHashes.filter((contentHash) => known.has(contentHash));
        },
        entries: () => Object.fromEntries(map),
    };
}
