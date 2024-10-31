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
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import { pLimit } from 'plimit-lit';

import {
  ArweaveManifest,
  DataItemOptions,
  DelegatedPaymentApproval,
  TokenType,
  TurboAbortSignal,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboCreateDelegatedPaymentApprovalParams,
  TurboDataItemSigner,
  TurboFileFactory,
  TurboLogger,
  TurboRevokeDelegatePaymentApprovalsParams,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedUploadServiceConfiguration,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadDataItemResponse,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
} from '../types.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

export const delegatedPaymentTagNames = {
  createDelegatedPaymentApproval: 'x-approve-payment',
  approvalAmount: 'x-amount',
  approvalExpiresBySeconds: 'x-expires-seconds',
  revokeDelegatePaymentApproval: 'x-delete-payment-approval',
};

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
    this.logger.debug('Uploading signed data item...');
    // TODO: add p-limit constraint or replace with separate upload class

    const headers = {
      'content-type': 'application/octet-stream',
      'content-length': `${dataItemSizeFactory()}`,
    };
    if (dataItemOpts !== undefined && dataItemOpts.paidBy !== undefined) {
      const paidBy = Array.isArray(dataItemOpts.paidBy)
        ? dataItemOpts.paidBy
        : [dataItemOpts.paidBy];

      if (dataItemOpts.paidBy.length > 0) {
        headers['x-paid-by'] = paidBy;
      }
    }

    return this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx/${this.token}`,
      signal,
      data: signedDataItem,
      headers,
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
    this.logger.debug('Uploading folder...', { params });

    const {
      dataItemOpts,
      signal,
      manifestOptions = {},
      maxConcurrentUploads = 1,
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

    this.logger.debug('Finished uploading files', {
      numFiles: files.length,
      numErrors: errors.length,
      results: response.fileResponses,
    });

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

  public async createDelegatedPaymentApproval({
    approvedAddress,
    approvedWincAmount,
    expiresBySeconds,
  }: TurboCreateDelegatedPaymentApprovalParams): Promise<DelegatedPaymentApproval> {
    const dataItemOpts = {
      tags: [
        {
          name: delegatedPaymentTagNames.createDelegatedPaymentApproval,
          value: approvedAddress,
        },
        {
          name: delegatedPaymentTagNames.approvalAmount,
          value: approvedWincAmount.toString(),
        },
      ],
    };
    if (expiresBySeconds !== undefined) {
      dataItemOpts.tags.push({
        name: delegatedPaymentTagNames.approvalExpiresBySeconds,
        value: expiresBySeconds.toString(),
      });
    }

    const nonceData = Buffer.from(
      approvedAddress + approvedWincAmount + Date.now(),
    );
    const { createdApproval, ...uploadResponse } = await this.uploadFile({
      fileStreamFactory: () => Readable.from(nonceData),
      fileSizeFactory: () => nonceData.byteLength,
      dataItemOpts,
    });
    if (!createdApproval) {
      throw new Error(
        'Failed to create delegated payment approval but upload has succeeded\n' +
          JSON.stringify(uploadResponse),
      );
    }
    return createdApproval;
  }

  public async revokeDelegatedPaymentApprovals({
    revokedAddress,
  }: TurboRevokeDelegatePaymentApprovalsParams): Promise<
    DelegatedPaymentApproval[]
  > {
    const dataItemOpts = {
      tags: [
        {
          name: delegatedPaymentTagNames.revokeDelegatePaymentApproval,
          value: revokedAddress,
        },
      ],
    };

    const nonceData = Buffer.from(revokedAddress + Date.now());
    const { revokedApprovals, ...uploadResponse } = await this.uploadFile({
      fileStreamFactory: () => Readable.from(nonceData),
      fileSizeFactory: () => nonceData.byteLength,
      dataItemOpts,
    });
    if (!revokedApprovals) {
      throw new Error(
        'Failed to revoke delegated payment approvals but upload has succeeded\n' +
          JSON.stringify(uploadResponse),
      );
    }
    return revokedApprovals;
  }
}
