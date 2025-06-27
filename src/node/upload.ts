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

import {
  TurboAuthenticatedBaseUploadService,
  defaultUploadServiceURL,
} from '../common/upload.js';
import {
  NodeUploadFolderParams,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboUploadFolderParams,
  isNodeUploadFolderParams,
} from '../types.js';

export class TurboAuthenticatedUploadService extends TurboAuthenticatedBaseUploadService {
  constructor({
    url = defaultUploadServiceURL,
    retryConfig,
    signer,
    logger,
    token,
  }: TurboAuthenticatedUploadServiceConfiguration) {
    super({
      url,
      retryConfig,
      logger,
      token,
      signer,
    });
  }

  private async getAbsoluteFilePathsFromFolder(
    folderPath: string,
  ): Promise<string[]> {
    const absoluteFilePaths: string[] = [];

    // Walk the directory and add all file paths to the array
    const files = await promises.readdir(folderPath);
    for (const file of files) {
      if (file === '.DS_Store') {
        continue;
      } else if (file.includes('\\')) {
        throw Error('Files/Sub-folders with backslashes are not supported');
      }
      const absoluteFilePath = join(folderPath, file);
      const stat = await promises.stat(absoluteFilePath);

      if (stat.isDirectory()) {
        absoluteFilePaths.push(
          ...(await this.getAbsoluteFilePathsFromFolder(absoluteFilePath)),
        );
      } else {
        absoluteFilePaths.push(absoluteFilePath);
      }
    }
    return absoluteFilePaths;
  }

  getFiles(params: TurboUploadFolderParams): Promise<string[]> {
    if (!isNodeUploadFolderParams(params)) {
      throw new Error('folderPath is required for node uploadFolder');
    }
    return this.getAbsoluteFilePathsFromFolder(params.folderPath);
  }

  getFileStreamForFile(file: string): Readable {
    return createReadStream(file);
  }

  getFileSize(file: string): number {
    return statSync(file).size;
  }

  getFileName(file: string): string {
    return file;
  }

  getRelativePath(file: string, params: TurboUploadFolderParams): string {
    let folderPath = (params as NodeUploadFolderParams).folderPath;

    // slice leading `./` if exists
    if (folderPath.startsWith('./')) {
      folderPath = folderPath.slice(2);
    }
    let relativePath = file.replace(join(folderPath + '/'), '');
    relativePath = relativePath.replace(/\\/g, '/'); // only needed for windows sub-folders
    return relativePath;
  }

  contentTypeFromFile(file: string): string {
    const mimeType = lookup(file);
    return mimeType !== false ? mimeType : 'application/octet-stream';
  }

  createManifestStream(manifestBuffer: Buffer): Readable {
    return Readable.from(manifestBuffer);
  }
}
