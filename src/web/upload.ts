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
import {
  TurboAuthenticatedBaseUploadService,
  defaultUploadServiceURL,
} from '../common/upload.js';
import {
  TurboAuthenticatedUploadServiceConfiguration,
  TurboUploadFolderParams,
  isWebUploadFolderParams,
} from '../types.js';

export class TurboAuthenticatedUploadService extends TurboAuthenticatedBaseUploadService {
  constructor({
    url = defaultUploadServiceURL,
    retryConfig,
    signer,
    logger,
    token,
  }: TurboAuthenticatedUploadServiceConfiguration) {
    super({ url, retryConfig, logger, token, signer });
  }

  getFiles(params: TurboUploadFolderParams): Promise<File[]> {
    if (!isWebUploadFolderParams(params)) {
      throw new Error('files are required for web uploadFolder');
    }
    return Promise.resolve(params.files);
  }

  getFileStreamForFile(file: File): ReadableStream {
    return file.stream() as ReadableStream;
  }

  getFileSize(file: File): number {
    return file.size;
  }

  getFileName(file: File): string {
    return file.name;
  }

  getRelativePath(file: File): string {
    return file.name || file.webkitRelativePath;
  }

  contentTypeFromFile(file: File): string {
    return file.type || 'application/octet-stream';
  }

  createManifestStream(manifestBuffer: Buffer): ReadableStream {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(manifestBuffer);
        controller.close();
      },
    });
    return stream;
  }
}
