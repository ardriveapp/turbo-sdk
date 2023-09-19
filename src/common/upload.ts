/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
  TurboAbortSignal,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboFileFactory,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUnauthenticatedUploadServiceInterfaceConfiguration,
  TurboUploadDataItemResponse,
  TurboWalletSigner,
} from '../types.js';
import { TurboHTTPService } from './http.js';

export class TurboUnauthenticatedUploadService
  implements TurboUnauthenticatedUploadServiceInterface
{
  protected httpService: TurboHTTPService;

  constructor({
    url = 'https://upload.ardrive.dev',
    retryConfig,
  }: TurboUnauthenticatedUploadServiceInterfaceConfiguration) {
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
    });
  }

  async uploadSignedDataItem({
    dataItemStreamFactory,
    signal,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    // TODO: add p-limit constraint or replace with separate upload class
    return this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx`,
      signal,
      data: dataItemStreamFactory(),
      headers: {
        'content-type': 'application/octet-stream',
      },
    });
  }
}

// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
export class TurboAuthenticatedUploadService
  extends TurboUnauthenticatedUploadService
  implements TurboAuthenticatedUploadServiceInterface
{
  protected signer: TurboWalletSigner;

  constructor({
    url = 'https://upload.ardrive.dev',
    retryConfig,
    signer,
  }: TurboAuthenticatedUploadServiceConfiguration) {
    super({ url, retryConfig });
    this.signer = signer;
  }

  async uploadFile({
    fileStreamFactory,
    signal,
  }: TurboFileFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse> {
    const signedDataItem = await this.signer.signDataItem({
      fileStreamFactory,
    });
    // TODO: add p-limit constraint or replace with separate upload class
    return this.httpService.post<TurboUploadDataItemResponse>({
      endpoint: `/tx`,
      signal,
      data: signedDataItem,
      headers: {
        'content-type': 'application/octet-stream',
      },
    });
  }
}
