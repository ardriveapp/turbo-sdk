"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboAuthenticatedUploadService = void 0;
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
const mime_types_1 = require("mime-types");
const path_1 = require("path");
const stream_1 = require("stream");
const upload_js_1 = require("../common/upload.js");
const types_js_1 = require("../types.js");
class TurboAuthenticatedUploadService extends upload_js_1.TurboAuthenticatedBaseUploadService {
    constructor({ url = upload_js_1.defaultUploadServiceURL, retryConfig, signer, logger, token, paymentService, }) {
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
        const files = await fs_1.promises.readdir(folderPath);
        for (const file of files) {
            if (file === '.DS_Store') {
                continue;
            }
            else if (file.includes('\\')) {
                throw Error('Files/Sub-folders with backslashes are not supported');
            }
            const absoluteFilePath = (0, path_1.join)(folderPath, file);
            const stat = await fs_1.promises.stat(absoluteFilePath);
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
        if (!(0, types_js_1.isNodeUploadFolderParams)(params)) {
            throw new Error('folderPath is required for node uploadFolder');
        }
        return this.getAbsoluteFilePathsFromFolder(params.folderPath);
    }
    getFileStreamForFile(file) {
        return (0, fs_1.createReadStream)(file);
    }
    getFileSize(file) {
        return (0, fs_1.statSync)(file).size;
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
        let relativePath = file.replace((0, path_1.join)(folderPath + '/'), '');
        relativePath = relativePath.replace(/\\/g, '/'); // only needed for windows sub-folders
        return relativePath;
    }
    contentTypeFromFile(file) {
        const mimeType = (0, mime_types_1.lookup)(file);
        return mimeType !== false ? mimeType : 'application/octet-stream';
    }
    createManifestStream(manifestBuffer) {
        return stream_1.Readable.from(manifestBuffer);
    }
}
exports.TurboAuthenticatedUploadService = TurboAuthenticatedUploadService;
