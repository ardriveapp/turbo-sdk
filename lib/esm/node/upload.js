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
import { createReadStream, promises, statSync } from 'fs';
import { lookup } from 'mime-types';
import { join } from 'path';
import { Readable } from 'stream';
import { TurboAuthenticatedBaseUploadService, defaultUploadServiceURL, } from '../common/upload.js';
import { isNodeUploadFolderParams, } from '../types.js';
export class TurboAuthenticatedUploadService extends TurboAuthenticatedBaseUploadService {
    constructor({ url = defaultUploadServiceURL, retryConfig, signer, logger, token, paymentService, }) {
        super({
            url,
            retryConfig,
            logger,
            token,
            signer,
            paymentService,
        });
    }
    async getAbsoluteFilePathsFromFolder(folderPath) {
        const absoluteFilePaths = [];
        // Walk the directory and add all file paths to the array
        const files = await promises.readdir(folderPath);
        for (const file of files) {
            if (file === '.DS_Store') {
                continue;
            }
            else if (file.includes('\\')) {
                throw Error('Files/Sub-folders with backslashes are not supported');
            }
            const absoluteFilePath = join(folderPath, file);
            const stat = await promises.stat(absoluteFilePath);
            if (stat.isDirectory()) {
                absoluteFilePaths.push(...(await this.getAbsoluteFilePathsFromFolder(absoluteFilePath)));
            }
            else {
                absoluteFilePaths.push(absoluteFilePath);
            }
        }
        return absoluteFilePaths;
    }
    getFiles(params) {
        if (!isNodeUploadFolderParams(params)) {
            throw new Error('folderPath is required for node uploadFolder');
        }
        return this.getAbsoluteFilePathsFromFolder(params.folderPath);
    }
    getFileStreamForFile(file) {
        return createReadStream(file);
    }
    getFileSize(file) {
        return statSync(file).size;
    }
    getFileName(file) {
        return file;
    }
    getRelativePath(file, params) {
        let folderPath = params.folderPath;
        // slice leading `./` if exists
        if (folderPath.startsWith('./')) {
            folderPath = folderPath.slice(2);
        }
        let relativePath = file.replace(join(folderPath + '/'), '');
        relativePath = relativePath.replace(/\\/g, '/'); // only needed for windows sub-folders
        return relativePath;
    }
    contentTypeFromFile(file) {
        const mimeType = lookup(file);
        return mimeType !== false ? mimeType : 'application/octet-stream';
    }
    createManifestStream(manifestBuffer) {
        return Readable.from(manifestBuffer);
    }
}
