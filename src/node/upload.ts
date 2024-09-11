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
import { createReadStream, promises, statSync } from 'fs';
import { lookup } from 'mime-types';
import { Readable } from 'node:stream';
import { join } from 'path';

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
    super({ url, retryConfig, logger, token, signer });
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
    return file.replace(
      (params as NodeUploadFolderParams).folderPath + '/',
      '',
    );
  }

  contentTypeFromFile(file: string): string {
    const mimeType = lookup(file);
    return mimeType !== false ? mimeType : 'application/octet-stream';
  }

  createManifestStream(manifestBuffer: Buffer): Readable {
    return Readable.from(manifestBuffer);
  }
}
