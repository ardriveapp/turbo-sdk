/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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

export class TurboAuthenticatedWebUploadService extends TurboAuthenticatedBaseUploadService {
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
    return file.stream();
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
