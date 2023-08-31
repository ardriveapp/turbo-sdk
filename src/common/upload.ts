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

import {
  TurboNodeDataItemSigner,
  TurboNodeDataItemVerifier,
} from '../node/signer.js';
import { JWKInterface } from '../types/arweave.js';
import {
  TransactionId,
  TurboDataItemSigner,
  TurboPrivateUploadService,
  TurboPrivateUploadServiceConfiguration,
  TurboPublicUploadService,
  TurboPublicUploadServiceConfiguration,
  TurboSignedDataItemFactory,
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
  protected dataItemVerifier: TurboNodeDataItemVerifier;

  constructor({
    url = 'https://upload.ardrive.dev',
    dataItemVerifier = new TurboNodeDataItemVerifier(),
    retryConfig,
  }: TurboPublicUploadServiceConfiguration) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
    this.dataItemVerifier = dataItemVerifier;
  }

  // TODO: any public upload service APIS
  async uploadSignedDataItems({
    dataItemGenerator,
    signature,
    publicKey,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemsResponse> {
    const verified = await this.dataItemVerifier.verifySignedDataItems({
      dataItemGenerator,
      signature,
      publicKey,
    });
    if (!verified) {
      throw new Error('One or more data items failed signature validation');
    }

    // TODO: upload the files
    return {} as TurboUploadDataItemsResponse;
  }
}

export class TurboAuthenticatedUploadService
  implements TurboPrivateUploadService
{
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface | undefined;
  protected dataItemSigner: TurboDataItemSigner;
  protected dataItemVerifier: TurboNodeDataItemVerifier;

  constructor({
    url = 'https://upload.ardrive.dev',
    privateKey,
    dataItemSigner = new TurboNodeDataItemSigner({ privateKey }),
    dataItemVerifier = new TurboNodeDataItemVerifier(),
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
    this.dataItemVerifier = dataItemVerifier;
  }

  async uploadSignedDataItems({
    dataItemGenerator,
    signature,
    publicKey,
  }: TurboSignedDataItemFactory): Promise<TurboUploadDataItemsResponse> {
    const verified = await this.dataItemVerifier.verifySignedDataItems({
      dataItemGenerator,
      signature,
      publicKey,
    });
    if (!verified) {
      throw new Error('One or more data items failed signature validation');
    }

    const signedDataItems: Readable[] = dataItemGenerator.map((dataItem) =>
      dataItem(),
    );

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
    const postedDataItems = dataItemResponses.reduce(
      (
        postedDataItemsMap: Record<
          TransactionId,
          Omit<TurboUploadDataItemResponse, 'id'>
        >,
        dataItemResponse: AxiosResponse<TurboUploadDataItemResponse, 'id'>,
      ) => {
        // handle the fulfilled response
        const { status, data } = dataItemResponse;
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
      ownerAddress: publicKey,
      dataItems: postedDataItems,
    };
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

    // NOTE: our axios config (validateStatus) swallows errors, so failed data items will be ignored
    const dataItemResponses = await Promise.all(uploadPromises);
    const postedDataItems = dataItemResponses.reduce(
      (
        postedDataItemsMap: Record<
          TransactionId,
          Omit<TurboUploadDataItemResponse, 'id'>
        >,
        dataItemResponse: AxiosResponse<TurboUploadDataItemResponse, 'id'>,
      ) => {
        // handle the fulfilled response
        const { status, data } = dataItemResponse;
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
