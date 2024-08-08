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
import { pLimit } from 'plimit-lit';

import {
  TurboAuthenticatedBaseUploadService,
  defaultUploadServiceURL,
} from '../common/upload.js';
import {
  TurboAuthenticatedUploadServiceConfiguration,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
  isNodeUploadFolderParams,
} from '../types.js';

export class TurboAuthenticatedNodeUploadService extends TurboAuthenticatedBaseUploadService {
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

  async uploadFolder(
    params: TurboUploadFolderParams,
  ): Promise<TurboUploadFolderResponse> {
    if (!isNodeUploadFolderParams(params)) {
      throw new Error('folderPath is required for node uploadFolder');
    }
    const {
      folderPath,
      dataItemOpts,
      signal,
      manifestOptions = {},
      maxConcurrentUploads = 5,
      throwOnFailure = true,
    } = params;

    const { disableManifest, indexFile, fallbackFile } = manifestOptions;

    const paths: Record<string, { id: string }> = {};
    const response: TurboUploadFolderResponse = {
      fileResponses: [],
    };
    const errors: Error[] = [];

    const absoluteFilePaths =
      await this.getAbsoluteFilePathsFromFolder(folderPath);

    const limit = pLimit(maxConcurrentUploads);

    const uploadFile = async (absoluteFilePath: string) => {
      const contentType = (() => {
        const userDefinedContentType = dataItemOpts?.tags?.find(
          (tag) => tag.name === 'Content-Type',
        )?.value;
        if (userDefinedContentType !== undefined) {
          return undefined;
        }
        const mimeType = lookup(absoluteFilePath);
        return mimeType !== false ? mimeType : 'application/octet-stream';
      })();

      const dataItemOptsWithContentType =
        contentType === undefined
          ? dataItemOpts
          : {
              ...dataItemOpts,
              tags: [
                ...(dataItemOpts?.tags ?? []),
                { name: 'Content-Type', value: contentType },
              ],
            };

      try {
        const result = await this.uploadFile({
          fileStreamFactory: () => createReadStream(absoluteFilePath),
          fileSizeFactory: () => statSync(absoluteFilePath).size,
          signal,
          dataItemOpts: dataItemOptsWithContentType,
        });
        response.fileResponses.push(result);
        const relativePath = absoluteFilePath.replace(folderPath + '/', '');
        paths[relativePath] = { id: result.id };
      } catch (error) {
        if (throwOnFailure) {
          throw error;
        }
        this.logger.error(`Error uploading file: ${absoluteFilePath}`, error);
        errors.push(error);
      }
    };

    await Promise.all(
      absoluteFilePaths.map((path) => limit(() => uploadFile(path))),
    );

    if (errors.length) {
      response.errors = errors;
    }

    if (disableManifest) {
      return response;
    }

    const manifest = await this.generateManifest({
      paths,
      indexFile,
      fallbackFile,
    });

    const tagsWithManifestContentType = [
      ...(dataItemOpts?.tags?.filter((tag) => tag.name !== 'Content-Type') ??
        []),
      { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
    ];
    const manifestBuffer = Buffer.from(JSON.stringify(manifest));
    const manifestResponse = await this.uploadFile({
      fileStreamFactory: () => Readable.from(manifestBuffer),
      fileSizeFactory: () => manifestBuffer.byteLength,
      signal,
      dataItemOpts: { ...dataItemOpts, tags: tagsWithManifestContentType },
    });

    return {
      ...response,
      manifest,
      manifestResponse,
    };
  }
}
