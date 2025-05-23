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
import { AxiosError, CanceledError } from 'axios';
import { IAxiosRetryConfig } from 'axios-retry';
import { Readable } from 'node:stream';
import { pLimit } from 'plimit-lit';

import {
  ArweaveManifest,
  CreditShareApproval,
  DataItemOptions,
  TokenType,
  TurboAbortSignal,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboCreateCreditShareApprovalParams,
  TurboDataItemSigner,
  TurboFileFactory,
  TurboLogger,
  TurboRevokeCreditsParams,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedUploadServiceConfiguration,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadDataItemResponse,
  TurboUploadEmitterEvents,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
  UploadDataInput,
  WebFileStreamFactory,
} from '../types.js';
import { defaultRetryConfig } from '../utils/axiosClient.js';
import { isBlob, sleep } from '../utils/common.js';
import { FailedRequestError } from '../utils/errors.js';
import { UploadEmitter } from './events.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

export const creditSharingTagNames = {
  shareCredits: 'x-approve-payment',
  sharedWincAmount: 'x-amount',
  approvalExpiresBySeconds: 'x-expires-seconds',
  revokeCredits: 'x-delete-payment-approval',
};

export const developmentUploadServiceURL = 'https://upload.ardrive.dev';
export const defaultUploadServiceURL = 'https://upload.ardrive.io';

export class TurboUnauthenticatedUploadService
  implements TurboUnauthenticatedUploadServiceInterface
{
  protected httpService: TurboHTTPService;
  protected logger: TurboLogger;
  protected token: TokenType;
  protected retryConfig: IAxiosRetryConfig;
  constructor({
    url = defaultUploadServiceURL,
    logger = TurboWinstonLogger.default,
    retryConfig = defaultRetryConfig(logger),
    token = 'arweave',
  }: TurboUnauthenticatedUploadServiceConfiguration) {
    this.token = token;
    this.logger = logger;
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
      logger: this.logger,
    });
    this.retryConfig = retryConfig;
  }

  async uploadSignedDataItem({
    dataItemStreamFactory,
    dataItemSizeFactory,
    signal,
    events,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal &
    TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse> {
    const fileSize = dataItemSizeFactory();
    this.logger.debug('Uploading signed data item...');

    // create the tapped stream with events
    const streamWithEvents = new UploadEmitter(events).createEventingStream({
      data: dataItemStreamFactory(),
      dataSize: fileSize,
    });

    // TODO: add p-limit constraint or replace with separate upload class
    const result = await this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx/${this.token}`,
      signal,
      data: streamWithEvents,
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': `${fileSize}`,
      },
    });
    return result;
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

  /**
   * Signs and uploads raw data to the Turbo Upload Service.
   */
  upload({
    data,
    dataItemOpts,
    signal,
    events,
  }: UploadDataInput &
    TurboAbortSignal &
    TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse> {
    // This function is intended to be usable in both Node and browser environments.
    if (isBlob(data)) {
      const streamFactory = () => data.stream();
      const sizeFactory = () => data.size;
      return this.uploadFile({
        fileStreamFactory: streamFactory as WebFileStreamFactory,
        fileSizeFactory: sizeFactory,
        signal,
        dataItemOpts,
        events,
      });
    }

    const dataBuffer: Buffer = (() => {
      if (Buffer.isBuffer(data)) return data;
      // Need type narrowing to ensure the correct Buffer.from overload is used
      if (typeof data === 'string' || data instanceof Uint8Array) {
        return Buffer.from(data);
      }

      return Buffer.from(data); // Only other option is ArrayBuffer
    })();

    return this.uploadFile({
      fileStreamFactory: () => dataBuffer,
      fileSizeFactory: () => dataBuffer.byteLength,
      signal,
      dataItemOpts,
      events,
    });
  }

  async uploadFile({
    fileStreamFactory,
    fileSizeFactory,
    signal,
    dataItemOpts,
    events,
  }: TurboFileFactory &
    TurboAbortSignal &
    TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse> {
    let retries = 0;
    const maxRetries = this.retryConfig.retries ?? 3;
    const retryDelay =
      this.retryConfig.retryDelay ??
      ((retryNumber: number) => retryNumber * 1000);
    let lastError: Error | undefined = undefined; // Store the last error for throwing
    let lastStatusCode: number | undefined = undefined; // Store the last status code for throwing

    while (retries < maxRetries) {
      if (signal?.aborted) {
        throw new CanceledError();
      }

      const { dataItemStreamFactory, dataItemSizeFactory } =
        await this.signer.signDataItem({
          fileStreamFactory,
          fileSizeFactory,
          dataItemOpts,
        });

      try {
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

        const streamWithEvents = new UploadEmitter(events).createEventingStream(
          {
            data: dataItemStreamFactory(),
            dataSize: dataItemSizeFactory(),
          },
        );

        // wonder if we have repeated code here, could use the uploadSignedDataItem method
        const data = await this.httpService.post<TurboUploadDataItemResponse>({
          endpoint: `/tx/${this.token}`,
          signal,
          data: streamWithEvents,
          headers,
        });
        return data;
      } catch (error) {
        // Store the last encountered error and status for re-throwing after retries
        lastError = error;
        if (error instanceof AxiosError) {
          lastStatusCode = error.response?.status;
        } else if (error instanceof FailedRequestError) {
          lastStatusCode = error.status;
        }

        if (
          lastStatusCode !== undefined &&
          lastStatusCode >= 400 &&
          lastStatusCode < 500
        ) {
          // Don't retry client error codes
          break;
        }

        this.logger.debug(
          `Upload failed on attempt ${retries + 1}/${maxRetries + 1}`,
          { message: error instanceof Error ? error.message : error },
          error,
        );
        retries++;
        const abortEventPromise = new Promise<void>((resolve) => {
          signal?.addEventListener('abort', () => {
            resolve();
          });
        });
        await Promise.race([
          sleep(retryDelay(retries, error)),
          abortEventPromise,
        ]);
      }
    }

    const msg = `Failed to upload file after ${maxRetries + 1} attempts\n${
      lastError instanceof Error ? lastError.message : lastError
    }`;
    // After all retries, throw the last error for catching
    if (lastError instanceof FailedRequestError) {
      lastError.message = msg;
      throw lastError;
    }
    throw new FailedRequestError(msg, lastStatusCode);
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

  /**
   * TODO: add events to the uploadFolder method
   * could be a predicate with a resolveConfig() function, eg: events: ({...file ctx}) => ({
   *   onProgress: (progress) => {
   *     console.log('progress', progress);
   *   },
   * })
   */
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

  public async shareCredits({
    approvedAddress,
    approvedWincAmount,
    expiresBySeconds,
  }: TurboCreateCreditShareApprovalParams): Promise<CreditShareApproval> {
    const dataItemOpts = {
      tags: [
        {
          name: creditSharingTagNames.shareCredits,
          value: approvedAddress,
        },
        {
          name: creditSharingTagNames.sharedWincAmount,
          value: approvedWincAmount.toString(),
        },
      ],
    };
    if (expiresBySeconds !== undefined) {
      dataItemOpts.tags.push({
        name: creditSharingTagNames.approvalExpiresBySeconds,
        value: expiresBySeconds.toString(),
      });
    }

    const nonceData = Buffer.from(
      approvedAddress + approvedWincAmount + Date.now(),
    );
    const { createdApproval, ...uploadResponse } = await this.uploadFile({
      fileStreamFactory: () => nonceData,
      fileSizeFactory: () => nonceData.byteLength,
      dataItemOpts,
    });
    if (!createdApproval) {
      throw new Error(
        'Failed to create credit share approval but upload has succeeded\n' +
          JSON.stringify(uploadResponse),
      );
    }
    return createdApproval;
  }

  public async revokeCredits({
    revokedAddress,
  }: TurboRevokeCreditsParams): Promise<CreditShareApproval[]> {
    const dataItemOpts = {
      tags: [
        {
          name: creditSharingTagNames.revokeCredits,
          value: revokedAddress,
        },
      ],
    };

    const nonceData = Buffer.from(revokedAddress + Date.now());
    const { revokedApprovals, ...uploadResponse } = await this.uploadFile({
      fileStreamFactory: () => nonceData,
      fileSizeFactory: () => nonceData.byteLength,
      dataItemOpts,
    });
    if (!revokedApprovals) {
      throw new Error(
        'Failed to revoke credit share approvals but upload has succeeded\n' +
          JSON.stringify(uploadResponse),
      );
    }
    return revokedApprovals;
  }
}
