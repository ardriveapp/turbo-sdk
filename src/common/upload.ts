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
import { Readable } from 'node:stream';
import { pLimit } from 'plimit-lit';

import {
  ArweaveManifest,
  DataItemOptions,
  TokenType,
  TurboAbortSignal,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboDataItemSigner,
  TurboFileFactory,
  TurboLogger,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedUploadServiceConfiguration,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadDataItemResponse,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
} from '../types.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

export const developmentUploadServiceURL = 'https://upload.ardrive.dev';
export const defaultUploadServiceURL = 'https://upload.ardrive.io';

export class TurboUnauthenticatedUploadService
  implements TurboUnauthenticatedUploadServiceInterface
{
  protected httpService: TurboHTTPService;
  protected logger: TurboLogger;
  protected token: TokenType;

  constructor({
    url = defaultUploadServiceURL,
    retryConfig,
    logger = TurboWinstonLogger.default,
    token = 'arweave',
  }: TurboUnauthenticatedUploadServiceConfiguration) {
    this.token = token;
    this.logger = logger;
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
      logger: this.logger,
    });
  }

  async uploadSignedDataItem({
    dataItemStreamFactory,
    dataItemSizeFactory,
    signal,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    const fileSize = dataItemSizeFactory();
    this.logger.debug('Uploading signed data item...');
    // TODO: add p-limit constraint or replace with separate upload class
    return this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx/${this.token}`,
      signal,
      data: dataItemStreamFactory(),
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': `${fileSize}`,
      },
    });
  }
}

// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
export abstract class TurboAuthenticatedBaseUploadService
  extends TurboUnauthenticatedUploadService
  implements TurboAuthenticatedUploadServiceInterface
{
  protected signer: TurboDataItemSigner;

  constructor({
    url = defaultUploadServiceURL,
    retryConfig,
    signer,
    logger,
    token,
  }: TurboAuthenticatedUploadServiceConfiguration) {
    super({ url, retryConfig, logger, token });
    this.signer = signer;
  }

  async uploadFile({
    fileStreamFactory,
    fileSizeFactory,
    signal,
    dataItemOpts,
  }: TurboFileFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    const { dataItemStreamFactory, dataItemSizeFactory } =
      await this.signer.signDataItem({
        fileStreamFactory,
        fileSizeFactory,
        dataItemOpts,
      });
    const signedDataItem = dataItemStreamFactory();
    const fileSize = dataItemSizeFactory();
    this.logger.debug('Uploading signed data item...');
    // TODO: add p-limit constraint or replace with separate upload class
    return this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx/${this.token}`,
      signal,
      data: signedDataItem,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': `${fileSize}`,
      },
    });
  }

  protected async generateManifest({
    paths,
    indexFile,
    fallbackFile,
  }: {
    paths: Record<string, { id: string }>;
    indexFile?: string;
    fallbackFile?: string;
  }): Promise<ArweaveManifest> {
    const indexPath =
      // Use the user provided index file if it exists,
      indexFile !== undefined && paths[indexFile]?.id !== undefined
        ? indexFile
        : // Else use index.html if it exists,
        paths['index.html']?.id !== undefined
        ? 'index.html'
        : // Else use the first file in the paths object.
          Object.keys(paths)[0];

    const fallbackId =
      // Use the user provided fallback file if it exists,
      fallbackFile !== undefined && paths[fallbackFile]?.id !== undefined
        ? paths[fallbackFile].id
        : // Else use 404.html if it exists, else use the index path.
          paths['404.html']?.id ?? paths[indexPath].id;

    const manifest: ArweaveManifest = {
      manifest: 'arweave/paths',
      version: '0.2.0',
      index: { path: indexPath },
      paths,
      fallback: { id: fallbackId },
    };

    return manifest;
  }

  abstract getFiles(
    params: TurboUploadFolderParams,
  ): Promise<(File | string)[]>;
  abstract contentTypeFromFile(file: File | string): string;
  abstract getFileStreamForFile(file: string | File): Readable | ReadableStream;
  abstract getFileSize(file: string | File): number;
  abstract getRelativePath(
    file: string | File,
    params: TurboUploadFolderParams,
  ): string;
  abstract createManifestStream(
    manifestBuffer: Buffer,
  ): Readable | ReadableStream;

  private getContentType(
    file: string | File,
    dataItemOpts?: DataItemOptions,
  ): string {
    const userDefinedContentType = dataItemOpts?.tags?.find(
      (tag) => tag.name === 'Content-Type',
    )?.value;
    if (userDefinedContentType !== undefined) {
      return userDefinedContentType;
    }

    return this.contentTypeFromFile(file);
  }

  async uploadFolder(
    params: TurboUploadFolderParams,
  ): Promise<TurboUploadFolderResponse> {
    const {
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

    const uploadFile = async (file: string | File) => {
      const contentType = this.getContentType(file, dataItemOpts);

      const dataItemOptsWithContentType = {
        ...dataItemOpts,
        tags: [
          ...(dataItemOpts?.tags?.filter(
            (tag) => tag.name !== 'Content-Type',
          ) ?? []),
          { name: 'Content-Type', value: contentType },
        ],
      };

      try {
        const result = await this.uploadFile({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fileStreamFactory: () => this.getFileStreamForFile(file) as any,
          fileSizeFactory: () => this.getFileSize(file),
          signal,
          dataItemOpts: dataItemOptsWithContentType,
        });

        const relativePath = this.getRelativePath(file, params);
        paths[relativePath] = { id: result.id };
        response.fileResponses.push(result);
      } catch (error) {
        if (throwOnFailure) {
          throw error;
        }
        this.logger.error(`Error uploading file: ${file}`, error);
        errors.push(error);
      }
    };

    const files = await this.getFiles(params);
    const limit = pLimit(maxConcurrentUploads);

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

    const manifestResponse = await this.uploadFile({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileStreamFactory: () => this.createManifestStream(manifestBuffer) as any,
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
