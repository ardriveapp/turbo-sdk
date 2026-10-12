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
const upload_js_1 = require("../common/upload.js");
const types_js_1 = require("../types.js");
class TurboAuthenticatedUploadService extends upload_js_1.TurboAuthenticatedBaseUploadService {
    constructor({ url = upload_js_1.defaultUploadServiceURL, retryConfig, signer, logger, token, paymentService, }) {
        super({ url, retryConfig, logger, token, signer, paymentService });
    }
    getFiles(params) {
        if (!(0, types_js_1.isWebUploadFolderParams)(params)) {
            throw new Error('files are required for web uploadFolder');
        }
        return Promise.resolve(params.files);
    }
    getFileStreamForFile(file) {
        return file.stream();
    }
    getFileSize(file) {
        return file.size;
    }
    getFileName(file) {
        return file.name;
    }
    getRelativePath(file) {
        return file.name || file.webkitRelativePath;
    }
    contentTypeFromFile(file) {
        return file.type || 'application/octet-stream';
    }
    createManifestStream(manifestBuffer) {
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(manifestBuffer);
                controller.close();
            },
        });
        return stream;
    }
}
exports.TurboAuthenticatedUploadService = TurboAuthenticatedUploadService;
