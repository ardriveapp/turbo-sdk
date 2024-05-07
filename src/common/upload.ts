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
    logger = new TurboWinstonLogger(),
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
export class TurboAuthenticatedUploadService
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
}
