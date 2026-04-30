"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.x402UploadUnsignedFile = x402UploadUnsignedFile;
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
const fs_1 = require("fs");
const path_1 = require("path");
const factory_js_1 = require("../../node/factory.js");
const constants_js_1 = require("../constants.js");
const progress_js_1 = require("../progress.js");
const utils_js_1 = require("../utils.js");
async function x402UploadUnsignedFile(options) {
    const { filePath } = options;
    if (filePath === undefined) {
        throw new Error('Must provide a --file-path to upload');
    }
    const privateKey = await (0, utils_js_1.optionalPrivateKeyFromOptions)(options);
    if (options.debug) {
        factory_js_1.TurboFactory.setLogLevel('debug');
    }
    if (options.quiet) {
        factory_js_1.TurboFactory.setLogLevel('none');
    }
    const config = (0, utils_js_1.configFromOptions)(options);
    const turbo = privateKey !== undefined
        ? factory_js_1.TurboFactory.authenticated({
            ...config,
            privateKey,
        })
        : factory_js_1.TurboFactory.unauthenticated(config);
    const customTags = (0, utils_js_1.getTagsFromOptions)(options);
    const fileSize = (0, fs_1.statSync)(filePath).size;
    const fileName = (0, path_1.basename)(filePath);
    const showProgress = options.showProgress;
    // Create progress tracker
    const progress = new progress_js_1.FileUploadProgress(showProgress);
    progress.start(fileSize, fileName);
    try {
        const result = await turbo.uploadRawX402Data({
            data: (0, fs_1.readFileSync)(filePath),
            tags: [...constants_js_1.turboCliTags, ...customTags],
        });
        progress.stop();
        // Add newline before output only if progress was shown
        const prefix = showProgress ? '\n' : '';
        console.log(`${prefix}Uploaded file:`, JSON.stringify(result, null, 2));
    }
    catch (error) {
        progress.stop();
        throw error;
    }
}
