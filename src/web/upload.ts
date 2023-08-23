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
import { ArweaveSigner, createData } from 'arbundles';
import { AxiosInstance, AxiosResponse } from 'axios';

import { JWKInterface } from '../types/arweave.js';
import {
  TransactionId,
  TurboUploadDataItemResponse,
  TurboUploadDataItemsResponse,
  TurboUploadService,
  TurboUploadServiceConfiguration,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import { jwkToPublicArweaveAddress } from '../utils/base64.js';
import { UnauthenticatedRequestError } from '../utils/errors.js';
import { readableStreamToBuffer } from '../utils/readableStream.js';

export class TurboWebUploadService implements TurboUploadService {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface | undefined;

  constructor({
    url = 'https://upload.ardrive.dev',
    privateKey,
    retryConfig,
  }: TurboUploadServiceConfiguration) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
    this.privateKey = privateKey;
  }

  async uploadFiles({
    fileStreamGenerator,
    bundle = false,
  }: {
    fileStreamGenerator: (() => ReadableStream)[];
    bundle?: boolean;
  }): Promise<TurboUploadDataItemsResponse> {
    if (!this.privateKey) {
      throw new UnauthenticatedRequestError();
    }

    if (bundle) {
      console.log('Data items will be bundled.', fileStreamGenerator);
    }

    const signer = new ArweaveSigner(this.privateKey);

    const signedDataItemPromises = fileStreamGenerator.map(
      async (streamGenerator: () => ReadableStream) => {
        // Convert the readable stream to a Blob
        const buffer = await readableStreamToBuffer({
          stream: streamGenerator(),
        });
        const arrayBuffer = Uint8Array.from(buffer);
        // convert the blob to a Uint8Array
        const dataItem = createData(arrayBuffer, signer);
        await dataItem.sign(signer);
        return dataItem.getRaw();
      },
    );

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
