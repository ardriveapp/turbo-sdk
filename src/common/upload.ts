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
import { AxiosInstance } from 'axios';

import {
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboFileFactory,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUnauthenticatedUploadServiceInterfaceConfiguration,
  TurboUploadDataItemResponse,
  TurboWalletSigner,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import { FailedRequestError } from '../utils/errors.js';

export class TurboUnauthenticatedUploadService
  implements TurboUnauthenticatedUploadServiceInterface
{
  protected axios: AxiosInstance;

  constructor({
    url = 'https://upload.ardrive.dev',
    retryConfig,
  }: TurboUnauthenticatedUploadServiceInterfaceConfiguration) {
    //  TODO: abstract to TurboHTTPRequestService class
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
  }

  async uploadSignedDataItem({
    dataItemStreamFactory,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemResponse> {
    // TODO: add p-limit constraint or replace with separate upload class
    const { status, data, statusText } =
      await this.axios.post<TurboUploadDataItemResponse>(
        `/tx`,
        dataItemStreamFactory(),
        {
          headers: {
            'content-type': 'application/octet-stream',
          },
        },
      );

    if (![202, 200].includes(status)) {
      throw new FailedRequestError(status, statusText);
    }
    return data;
  }
}

export class TurboAuthenticatedUploadService
  implements TurboAuthenticatedUploadServiceInterface
{
  protected axios: AxiosInstance;
  protected signer: TurboWalletSigner;

  constructor({
    url = 'https://upload.ardrive.dev',
    retryConfig,
    signer,
  }: TurboAuthenticatedUploadServiceConfiguration) {
    //  TODO: abstract to TurboHTTPRequestService class
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
    this.signer = signer;
  }

  async uploadSignedDataItem({
    dataItemStreamFactory,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemResponse> {
    // TODO: add p-limit constraint or replace with separate upload class
    const { status, data, statusText } =
      await this.axios.post<TurboUploadDataItemResponse>(
        `/tx`,
        dataItemStreamFactory(),
        {
          headers: {
            'content-type': 'application/octet-stream',
          },
        },
      );

    if (![202, 200].includes(status)) {
      throw new FailedRequestError(status, statusText);
    }
    return data;
  }

  async uploadFile({
    fileStreamFactory,
  }: TurboFileFactory): Promise<TurboUploadDataItemResponse> {
    const signedDataItem = await this.signer.signDataItem({
      fileStreamFactory,
    });
    // TODO: add p-limit constraint or replace with separate upload class
    const { status, data, statusText } =
      await this.axios.post<TurboUploadDataItemResponse>(
        `/tx`,
        signedDataItem,
        {
          headers: {
            'content-type': 'application/octet-stream',
          },
        },
      );

    if (![202, 200].includes(status)) {
      throw new FailedRequestError(status, statusText);
    }
    return data;
  }
}
