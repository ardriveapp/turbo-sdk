"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFolder = uploadFolder;
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
const constants_js_1 = require("../constants.js");
const progress_js_1 = require("../progress.js");
const utils_js_1 = require("../utils.js");
async function uploadFolder(options) {
    const turbo = await (0, utils_js_1.turboFromOptions)(options);
    const paidBy = await (0, utils_js_1.paidByFromOptions)(options, turbo);
    const showProgress = options.showProgress;
    const { disableManifest, fallbackFile, folderPath, indexFile, maxConcurrentUploads, chunkByteCount, chunkingMode, maxChunkConcurrency, maxFinalizeMs, } = (0, utils_js_1.getUploadFolderOptions)(options);
    const customTags = (0, utils_js_1.getTagsFromOptions)(options);
    // Create progress tracker
    const progress = new progress_js_1.FolderUploadProgress(showProgress);
    const result = await turbo.uploadFolder({
        folderPath: folderPath,
        dataItemOpts: { tags: [...constants_js_1.turboCliTags, ...customTags], paidBy },
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
        ...(0, utils_js_1.onDemandOptionsFromOptions)(options),
        events: progress.events,
    });
    progress.stop();
    // Add newline before output only if progress was shown
    const prefix = showProgress ? '\n' : '';
    console.log(`${prefix}Uploaded folder:`, JSON.stringify(result, null, 2));
}
