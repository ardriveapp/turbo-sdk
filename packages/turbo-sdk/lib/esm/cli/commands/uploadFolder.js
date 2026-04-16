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
import { turboCliTags } from '../constants.js';
import { FolderUploadProgress } from '../progress.js';
import { getTagsFromOptions, getUploadFolderOptions, onDemandOptionsFromOptions, paidByFromOptions, turboFromOptions, } from '../utils.js';
export async function uploadFolder(options) {
    const turbo = await turboFromOptions(options);
    const paidBy = await paidByFromOptions(options, turbo);
    const showProgress = options.showProgress;
    const { disableManifest, fallbackFile, folderPath, indexFile, maxConcurrentUploads, chunkByteCount, chunkingMode, maxChunkConcurrency, maxFinalizeMs, } = getUploadFolderOptions(options);
    const customTags = getTagsFromOptions(options);
    // Create progress tracker
    const progress = new FolderUploadProgress(showProgress);
    const result = await turbo.uploadFolder({
        folderPath: folderPath,
        dataItemOpts: { tags: [...turboCliTags, ...customTags], paidBy },
        manifestOptions: {
            disableManifest,
            indexFile,
            fallbackFile,
        },
        maxConcurrentUploads,
        chunkByteCount,
        chunkingMode,
        maxChunkConcurrency,
        maxFinalizeMs,
        ...onDemandOptionsFromOptions(options),
        events: progress.events,
    });
    progress.stop();
    // Add newline before output only if progress was shown
    const prefix = showProgress ? '\n' : '';
    console.log(`${prefix}Uploaded folder:`, JSON.stringify(result, null, 2));
}
