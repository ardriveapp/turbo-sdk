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
import { pLimit } from 'plimit-lit';

import {
  TurboAuthenticatedBaseUploadService,
  defaultUploadServiceURL,
} from '../common/upload.js';
import {
  TurboAuthenticatedUploadServiceConfiguration,
  TurboUploadDataItemResponse,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
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

  async uploadFolder(
    params: TurboUploadFolderParams,
  ): Promise<TurboUploadFolderResponse> {
    if (!isWebUploadFolderParams(params)) {
      throw new Error('files are required for web uploadFolder');
    }
    const {
      files,
      indexFile,
      dataItemOpts,
      signal,
      maxConcurrentUploads = 5,
      throwOnFailure = true,
    } = params;

    const paths: Record<string, { id: string }> = {};
    const fileResponses: TurboUploadDataItemResponse[] = [];
    const errors: Error[] = [];

    const limit = pLimit(maxConcurrentUploads);

    const uploadFile = async (file: File) => {
      const contentType = file.type ?? 'application/octet-stream';

      try {
        const buffer = await file.arrayBuffer().then((b) => Buffer.from(b));
        const result = await this.uploadFile({
          fileStreamFactory: () => buffer,
          fileSizeFactory: () => file.size,
          signal,
          dataItemOpts: {
            ...dataItemOpts,
            tags: [
              ...(dataItemOpts?.tags ?? []),
              { name: 'Content-Type', value: contentType },
            ],
          },
        });

        const relativePath = file.name ?? file.webkitRelativePath;
        paths[relativePath] = { id: result.id };
        fileResponses.push(result);
      } catch (error) {
        if (throwOnFailure) {
          throw error;
        }
        this.logger.error(`Error uploading file: ${file.name}`);
        this.logger.error(error);
        errors.push(error);
      }
    };

    await Promise.all(files.map((file) => limit(() => uploadFile(file))));

    const manifestResult = await this.uploadManifest({
      dataItemOpts,
      paths,
      indexFile,
      signal,
    });

    return {
      fileResponses,
      ...manifestResult,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
