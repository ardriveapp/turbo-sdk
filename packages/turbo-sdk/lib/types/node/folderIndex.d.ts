import { FileFolderUploadIndexParams, TurboFolderUploadIndex } from '../types.js';
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
export declare function createFileFolderIndex({ filePath, logger, }: FileFolderUploadIndexParams): TurboFolderUploadIndex;
//# sourceMappingURL=folderIndex.d.ts.map