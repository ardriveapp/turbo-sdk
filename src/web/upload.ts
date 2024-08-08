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

    const limit = pLimit(maxConcurrentUploads);

    const uploadFile = async (file: File) => {
      const contentType = (() => {
        const userDefinedContentType = dataItemOpts?.tags?.find(
          (tag) => tag.name === 'Content-Type',
        )?.value;
        if (userDefinedContentType !== undefined) {
          return undefined;
        }
        file.type ?? 'application/octet-stream';
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fileStreamFactory: () => file.stream() as any,
          fileSizeFactory: () => file.size,
          signal,
          dataItemOpts: dataItemOptsWithContentType,
        });

        const relativePath = file.name ?? file.webkitRelativePath;
        paths[relativePath] = { id: result.id };
        response.fileResponses.push(result);
      } catch (error) {
        if (throwOnFailure) {
          throw error;
        }
        this.logger.error(`Error uploading file: ${file.name}`, error);
        errors.push(error);
      }
    };

    await Promise.all(files.map((file) => limit(() => uploadFile(file))));

    if (errors.length > 0) {
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
    const readableStreamFromManifest = () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(manifestBuffer);
          controller.close();
        },
      });
      return stream;
    };

    const manifestResponse = await this.uploadFile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileStreamFactory: () => readableStreamFromManifest() as any,
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
