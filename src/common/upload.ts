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
import { AxiosInstance, AxiosResponse } from 'axios';

import { TurboNodeDataItemSigner } from '../node/signer.js';
import { JWKInterface } from '../types/arweave.js';
import {
  TransactionId,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboDataItemSigner,
  TurboFileFactory,
  TurboSignedDataItemFactory,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUnauthenticatedUploadServiceInterfaceConfiguration,
  TurboUploadDataItemResponse,
  TurboUploadDataItemsResponse,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';

export class TurboUnauthenticatedUploadService
  implements TurboUnauthenticatedUploadServiceInterface
{
  protected axios: AxiosInstance;

  constructor({
    url = 'https://upload.ardrive.dev',
    retryConfig,
  }: TurboUnauthenticatedUploadServiceInterfaceConfiguration) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
  }

  async uploadSignedDataItems({
    dataItemGenerators,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemsResponse> {
    const signedDataItems = dataItemGenerators.map((dataItem) => dataItem());

    // TODO: add p-limit constraint
    const uploadPromises = signedDataItems.map((signedDataItem) => {
      return this.axios.post<TurboUploadDataItemResponse>(
        `/tx`,
        signedDataItem,
        {
          headers: {
            'content-type': 'application/octet-stream',
          },
        },
      );
    });

    // NOTE: our axios config (validateStatus) swallows errors, so failed data items will be ignored
    const dataItemResponses = await Promise.all(uploadPromises);
    const errors: { id: string; status: number; message: string }[] = [];
    const postedDataItems = dataItemResponses.reduce(
      (
        postedDataItemsMap: Record<
          TransactionId,
          Omit<TurboUploadDataItemResponse, 'id'>
        >,
        dataItemResponse: AxiosResponse<TurboUploadDataItemResponse, 'id'>,
      ) => {
        // handle the fulfilled response
        const { status, data, statusText } = dataItemResponse;
        if (![200, 202].includes(status)) {
          // TODO: add to failed data items array
          errors.push({
            id: data.id ?? 'unknown',

            status,
            message: statusText,
          });
          return postedDataItemsMap;
        }
        const { id, ...dataItemCache } = data;
        postedDataItemsMap[id] = dataItemCache;
        return postedDataItemsMap;
      },
      {},
    );

    return {
      dataItems: postedDataItems,
      errors,
    };
  }
}

export class TurboAuthenticatedUploadService
  implements TurboAuthenticatedUploadServiceInterface
{
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface | undefined;
  protected dataItemSigner: TurboDataItemSigner;

  constructor({
    url = 'https://upload.ardrive.dev',
    privateKey,
    dataItemSigner = new TurboNodeDataItemSigner({ privateKey }),
    retryConfig,
  }: TurboAuthenticatedUploadServiceConfiguration) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
    this.privateKey = privateKey;
    this.dataItemSigner = dataItemSigner;
  }

  async uploadSignedDataItems({
    dataItemGenerators,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemsResponse> {
    const signedDataItems = dataItemGenerators.map((dataItem) => dataItem());

    console.log('upload signed data items here');

    // TODO: add p-limit constraint
    const uploadPromises = signedDataItems.map((signedDataItem) => {
      return this.axios.post<TurboUploadDataItemResponse>(
        `/tx`,
        signedDataItem,
        {
          headers: {
            'content-type': 'application/octet-stream',
          },
        },
      );
    });

    // NOTE: our axios config (validateStatus) swallows errors, so failed data items will be ignored
    const dataItemResponses = await Promise.all(uploadPromises);
    const errors: { id: string; status: number; message: string }[] = [];
    const postedDataItems = dataItemResponses.reduce(
      (
        postedDataItemsMap: Record<
          TransactionId,
          Omit<TurboUploadDataItemResponse, 'id'>
        >,
        dataItemResponse: AxiosResponse<TurboUploadDataItemResponse, 'id'>,
      ) => {
        // handle the fulfilled response
        const { status, data, statusText } = dataItemResponse;
        if (![200, 202].includes(status)) {
          errors.push({
            id: data.id ?? 'unknown',

            status,
            message: statusText,
          });
          return postedDataItemsMap;
        }
        const { id, ...dataItemCache } = data;
        postedDataItemsMap[id] = dataItemCache;
        return postedDataItemsMap;
      },
      {},
    );

    return {
      dataItems: postedDataItems,
      errors,
    };
  }

  async uploadFiles({
    fileStreamGenerators,
  }: TurboFileFactory): Promise<TurboUploadDataItemsResponse> {
    const signedDataItemPromises = this.dataItemSigner.signDataItems({
      fileStreamGenerators,
    });

    // TODO: we probably don't want to Promise.all, do .allSettled and only return successful signed data items
    const signedDataItems = await Promise.all(signedDataItemPromises);

    // TODO: add p-limit constraint
    const uploadPromises = signedDataItems.map((signedDataItem) => {
      return this.axios.post<TurboUploadDataItemResponse>(
        `/tx`,
        signedDataItem,
        {
          headers: {
            'content-type': 'application/octet-stream',
          },
        },
      );
    });

    // NOTE: our axios config (validateStatus) swallows errors, so failed data items will be ignored
    const dataItemResponses = await Promise.all(uploadPromises);
    const errors: { id: string; status: number; message: string }[] = [];
    const postedDataItems = dataItemResponses.reduce(
      (
        postedDataItemsMap: Record<
          TransactionId,
          Omit<TurboUploadDataItemResponse, 'id'>
        >,
        dataItemResponse: AxiosResponse<TurboUploadDataItemResponse, 'id'>,
      ) => {
        // handle the fulfilled response
        const { status, data, statusText } = dataItemResponse;
        if (![200, 202].includes(status)) {
          // TODO: add to failed data items array
          errors.push({
            id: data.id ?? 'unknown',
            status,
            message: statusText,
          });
          return postedDataItemsMap;
        }
        const { id, ...dataItemCache } = data;
        postedDataItemsMap[id] = dataItemCache;
        return postedDataItemsMap;
      },
      {},
    );

    return {
      dataItems: postedDataItems,
      errors,
    };
  }
}
