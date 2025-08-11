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
import { CanceledError } from 'axios';
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
  TurboUnauthenticatedUploadServiceConfiguration,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadAndSigningEmitterEvents,
  TurboUploadDataItemResponse,
  TurboUploadEmitterEvents,
  TurboUploadFileParams,
  TurboUploadFileWithFileOrPathParams,
  TurboUploadFileWithStreamFactoryParams,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
  UploadDataInput,
  UploadSignedDataItemParams,
} from '../types.js';
import { defaultRetryConfig } from '../utils/axiosClient.js';
import { isBlob, sleep } from '../utils/common.js';
import { FailedRequestError } from '../utils/errors.js';
import { ChunkedUploader } from './chunked.js';
import { TurboEventEmitter, createStreamWithUploadEvents } from './events.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

export type TurboUploadConfig = TurboFileFactory &
  TurboAbortSignal &
  TurboUploadEmitterEvents;

function isTurboUploadFileWithStreamFactoryParams(
  params: TurboUploadFileParams,
): params is TurboUploadFileWithStreamFactoryParams {
  return 'fileStreamFactory' in params;
}

function isTurboUploadFileWithFileOrPathParams(
  params: TurboUploadFileParams,
): params is TurboUploadFileWithFileOrPathParams {
  return 'file' in params;
}

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
      url: `${url}`, // `${url/v1}`, TODO: Enable /v1/chunks endpoints and re-add v1 to the URL
      retryConfig,
      logger: this.logger,
    });
    this.retryConfig = retryConfig;
  }

  async uploadSignedDataItem({
    dataItemStreamFactory,
    dataItemSizeFactory,
    dataItemOpts,
    signal,
    events = {},
  }: UploadSignedDataItemParams): Promise<TurboUploadDataItemResponse> {
    const dataItemSize = dataItemSizeFactory();
    this.logger.debug('Uploading signed data item...');

    // create the tapped stream with events
    const emitter = new TurboEventEmitter(events);

    // create the stream with upload events
    const { stream: streamWithUploadEvents, resume } =
      createStreamWithUploadEvents({
        data: dataItemStreamFactory(),
        dataSize: dataItemSize,
        emitter,
      });

    const headers = {
      'content-type': 'application/octet-stream',
      'content-length': `${dataItemSize}`,
    };

    if (dataItemOpts !== undefined && dataItemOpts.paidBy !== undefined) {
      const paidBy = Array.isArray(dataItemOpts.paidBy)
        ? dataItemOpts.paidBy
        : [dataItemOpts.paidBy];

      // TODO: these should be comma separated values vs. an array of headers
      if (dataItemOpts.paidBy.length > 0) {
        headers['x-paid-by'] = paidBy;
      }
    }

    // setup the post request using the stream with upload events
    const postPromise = this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx/${this.token}`,
      signal,
      data: streamWithUploadEvents,
      headers,
    });

    // resume the stream so events start flowing to the post
    resume();

    return postPromise;
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
    TurboUploadAndSigningEmitterEvents): Promise<TurboUploadDataItemResponse> {
    // This function is intended to be usable in both Node and browser environments.
    if (isBlob(data)) {
      const streamFactory = () => data.stream();
      const sizeFactory = () => data.size;
      return this.uploadFile({
        fileStreamFactory: streamFactory,
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

  public async uploadChunked(
    params: UploadSignedDataItemParams & {
      chunkSize?: number;
      batchSize?: number;
    },
  ): Promise<TurboUploadDataItemResponse> {
    const { batchSize, chunkSize, dataItemSizeFactory, events } = params;
    const totalBytes = dataItemSizeFactory();
    const uploader = new ChunkedUploader({
      http: this.httpService,
      token: this.token,
      batchSize,
      chunkSize,
      logger: this.logger,
    });
    if (events !== undefined) {
      if (events.onUploadProgress) {
        uploader.on(
          'chunkUpload',
          ({ totalUploaded }) =>
            events.onUploadProgress?.({
              processedBytes: totalUploaded,
              totalBytes,
            }),
        );
      }
      if (events.onUploadError) {
        uploader.on('chunkError', ({ res }) => events.onUploadError?.(res));
      }
    }

    return uploader.upload(params);
  }

  private resolveUploadFileConfig(
    params: TurboUploadFileParams,
  ): TurboUploadConfig {
    let fileStreamFactory: TurboFileFactory['fileStreamFactory'];
    let fileSizeFactory: () => number;
    if (isTurboUploadFileWithStreamFactoryParams(params)) {
      fileStreamFactory = params.fileStreamFactory;
      fileSizeFactory = params.fileSizeFactory;
    } else if (isTurboUploadFileWithFileOrPathParams(params)) {
      const file = params.file;
      /**
       * this is pretty gross, but it's the only way to get the type inference to work without overhauling
       * the abstract method to accept a generic, which we would need to perform a check on anyways.
       */
      fileStreamFactory =
        file instanceof File
          ? () => this.getFileStreamForFile(file) as ReadableStream
          : () => this.getFileStreamForFile(file) as Readable;
      fileSizeFactory = () => this.getFileSize(params.file);
    } else {
      throw new TypeError(
        'Invalid upload file params. Must be either TurboUploadFileWithStreamFactoryParams or TurboUploadFileWithFileOrPathParams',
      );
    }
    return {
      fileStreamFactory,
      fileSizeFactory,
      ...params,
    };
  }

  async uploadFile(
    params: TurboUploadFileParams,
  ): Promise<TurboUploadDataItemResponse> {
    const { signal, dataItemOpts, events, fileStreamFactory, fileSizeFactory } =
      this.resolveUploadFileConfig(params);

    const { chunkSize = 5 * 1024 * 1024, batchSize, forceChunking } = params;

    let retries = 0;
    const maxRetries = this.retryConfig.retries ?? 3;
    const retryDelay =
      this.retryConfig.retryDelay ??
      ((retryNumber: number) => retryNumber * 1000);
    let lastError: Error | undefined = undefined; // Store the last error for throwing
    let lastStatusCode: number | undefined = undefined; // Store the last status code for throwing
    const emitter = new TurboEventEmitter(events);
    // avoid duplicating signing on failures here - these errors will immediately be thrown
    // TODO: create a SigningError class and throw that instead of the generic Error
    const { dataItemStreamFactory, dataItemSizeFactory } =
      await this.signer.signDataItem({
        fileStreamFactory,
        fileSizeFactory,
        dataItemOpts,
        emitter,
      });

    // TODO: move the retry implementation to the http class, and avoid awaiting here. This will standardize the retry logic across all upload methods.

    const totalSize = dataItemSizeFactory();

    while (retries < maxRetries) {
      if (signal?.aborted) {
        throw new CanceledError();
      }

      // Now that we have the signed data item, we can upload it using the uploadSignedDataItem method
      // which will create a new emitter with upload events. We await
      // this result due to the wrapped retry logic of this method.
      try {
        const twoChunksOfData = chunkSize * 2;

        if (forceChunking || totalSize > twoChunksOfData) {
          const response = await this.uploadChunked({
            dataItemStreamFactory,
            dataItemSizeFactory,
            dataItemOpts,
            signal,
            events,
            batchSize,
            chunkSize,
          });
          return response;
        }
        const response = await this.uploadSignedDataItem({
          dataItemStreamFactory,
          dataItemSizeFactory,
          dataItemOpts,
          signal,
          events,
        });
        return response;
      } catch (error) {
        // Store the last encountered error and status for re-throwing after retries
        lastError = error;
        if (error instanceof FailedRequestError) {
          lastStatusCode = error.status;
        } else {
          lastStatusCode = error.response?.status;
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
   * TODO: create resolveUploadFolderConfig() function
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
      batchSize,
      chunkSize,
      forceChunking,
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
          // TODO: can fix this type by passing a class generic and specifying in the node/web abstracts which stream type to use
          fileStreamFactory: () =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.getFileStreamForFile(file) as any,
          fileSizeFactory: () => this.getFileSize(file),
          signal,
          dataItemOpts: dataItemOptsWithContentType,
          chunkSize,
          batchSize,
          forceChunking,
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
      // TODO: can fix this type by passing a class generic and specifying in the node/web abstracts which stream type to use
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fileStreamFactory: () => this.createManifestStream(manifestBuffer) as any,
      fileSizeFactory: () => manifestBuffer.byteLength,
      signal,
      dataItemOpts: { ...dataItemOpts, tags: tagsWithManifestContentType },
      chunkSize,
      batchSize,
      forceChunking,
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
