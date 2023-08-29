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
import { Readable } from 'stream';

import { TurboNodeDataItemSigner } from '../node/signer.js';
import { JWKInterface } from '../types/arweave.js';
import {
  TransactionId,
  TurboDataItemSigner,
  TurboPrivateUploadService,
  TurboPrivateUploadServiceConfiguration,
  TurboPublicUploadService,
  TurboPublicUploadServiceConfiguration,
  TurboUploadDataItemResponse,
  TurboUploadDataItemsResponse,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import { jwkToPublicArweaveAddress } from '../utils/base64.js';
import { UnauthenticatedRequestError } from '../utils/errors.js';

export class TurboUnauthenticatedUploadService
  implements TurboPublicUploadService
{
  protected axios: AxiosInstance;
  constructor({
    url = 'https://upload.ardrive.dev',
    retryConfig,
  }: TurboPublicUploadServiceConfiguration) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
  }

  // TODO: any public upload service APIS
}

export class TurboAuthenticatedUploadService
  implements TurboPrivateUploadService
{
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface | undefined;
  protected dataItemSigner: TurboDataItemSigner;

  constructor({
    url = 'https://upload.ardrive.dev',
    privateKey,
    dataItemSigner = new TurboNodeDataItemSigner({ privateKey }),
    retryConfig,
  }: TurboPrivateUploadServiceConfiguration) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
    this.privateKey = privateKey;
    this.dataItemSigner = dataItemSigner;
  }

  async uploadFiles({
    fileStreamGenerator,
    bundle = false, // TODO: add bundle param to allow for creating BDI of data items
  }: {
    fileStreamGenerator: (() => Readable)[];
    bundle?: boolean;
  }): Promise<TurboUploadDataItemsResponse> {
    if (!this.privateKey) {
      throw new UnauthenticatedRequestError();
    }

    const signedDataItemPromises = this.dataItemSigner.signDataItems({
      fileStreamGenerator,
      bundle,
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

    const dataItemResponses = await Promise.allSettled(uploadPromises);
    const postedDataItems = dataItemResponses.reduce(
      (
        postedDataItemsMap: Record<
          TransactionId,
          Omit<TurboUploadDataItemResponse, 'id'>
        >,
        dataItemResponse:
          | PromiseFulfilledResult<
              AxiosResponse<TurboUploadDataItemResponse, 'id'>
            >
          | PromiseRejectedResult,
      ) => {
        // NOTE: with validateStatus set to true on the axios config we could use Promise.all and remove this check
        if (dataItemResponse.status === 'rejected') {
          return postedDataItemsMap;
        }
        // handle the fulfilled response
        const { status, data } = dataItemResponse.value;
        if (![200, 202].includes(status)) {
          // TODO: add to failed data items array
          return postedDataItemsMap;
        }
        const { id, ...dataItemCache } = data;
        postedDataItemsMap[id] = dataItemCache;
        return postedDataItemsMap;
      },
      {},
    );

    return {
      ownerAddress: jwkToPublicArweaveAddress(this.privateKey),
      dataItems: postedDataItems,
    };
  }
}
