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
import { readFileSync, statSync } from 'fs';
import { basename } from 'path';
import { TurboFactory } from '../../node/factory.js';
import { turboCliTags } from '../constants.js';
import { FileUploadProgress } from '../progress.js';
import { configFromOptions, getTagsFromOptions, optionalPrivateKeyFromOptions, } from '../utils.js';
export async function x402UploadUnsignedFile(options) {
    const { filePath } = options;
    if (filePath === undefined) {
        throw new Error('Must provide a --file-path to upload');
    }
    const privateKey = await optionalPrivateKeyFromOptions(options);
    if (options.debug) {
        TurboFactory.setLogLevel('debug');
    }
    if (options.quiet) {
        TurboFactory.setLogLevel('none');
    }
    const config = configFromOptions(options);
    const turbo = privateKey !== undefined
        ? TurboFactory.authenticated({
            ...config,
            privateKey,
        })
        : TurboFactory.unauthenticated(config);
    const customTags = getTagsFromOptions(options);
    const fileSize = statSync(filePath).size;
    const fileName = basename(filePath);
    const showProgress = options.showProgress;
    // Create progress tracker
    const progress = new FileUploadProgress(showProgress);
    progress.start(fileSize, fileName);
    try {
        const result = await turbo.uploadRawX402Data({
            data: readFileSync(filePath),
            tags: [...turboCliTags, ...customTags],
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
