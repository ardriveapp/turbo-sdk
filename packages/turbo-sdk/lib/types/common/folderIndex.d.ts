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
import { ChainFolderUploadIndexParams, ComposeFolderUploadIndexParams, TurboFolderUploadIndex } from '../types.js';
/**
 * An in-memory folder index.
 *
 * On its own it only deduplicates identical files within a single
 * `uploadFolder` call, which `uploadFolder` already does. Its real use is as
 * the writable floor of a {@link composeFolderIndex} stack, or seeded from a
 * mapping the caller persisted itself.
 */
export declare function createMemoryFolderIndex(seed?: Record<string, string>): TurboFolderUploadIndex;
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
export declare function createChainFolderIndex({ owner, appName, gatewayUrl, hashTagName, maxPages, pageSize, timeoutMs, fetchImpl, logger, }: ChainFolderUploadIndexParams): TurboFolderUploadIndex;
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
export declare function composeFolderIndex(layers: (TurboFolderUploadIndex | undefined)[], { logger }?: ComposeFolderUploadIndexParams): TurboFolderUploadIndex;
//# sourceMappingURL=folderIndex.d.ts.map