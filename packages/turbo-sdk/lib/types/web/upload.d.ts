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
import { TurboAuthenticatedBaseUploadService } from '../common/upload.js';
import { TurboAuthenticatedUploadServiceConfiguration, TurboUploadFolderParams } from '../types.js';
import { TurboAuthenticatedPaymentService } from './index.js';
export declare class TurboAuthenticatedUploadService extends TurboAuthenticatedBaseUploadService {
    constructor({ url, retryConfig, signer, logger, token, paymentService, }: TurboAuthenticatedUploadServiceConfiguration & {
        paymentService: TurboAuthenticatedPaymentService;
    });
    getFiles(params: TurboUploadFolderParams): Promise<File[]>;
    getFileStreamForFile(file: File): ReadableStream;
    getFileSize(file: File): number;
    getFileName(file: File): string;
    getRelativePath(file: File): string;
    contentTypeFromFile(file: File): string;
    createManifestStream(manifestBuffer: Buffer): ReadableStream;
}
//# sourceMappingURL=upload.d.ts.map