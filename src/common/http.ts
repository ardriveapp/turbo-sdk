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
import { RetryConfig } from 'retry-axios';
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';

import {
  TurboHTTPServiceInterface,
  TurboSignedRequestHeaders,
} from '../types/turbo.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import { FailedRequestError } from '../utils/errors.js';

export class TurboHTTPService implements TurboHTTPServiceInterface {
  protected axios: AxiosInstance;
  constructor({
    url,
    retryConfig,
  }: {
    url: string;
    retryConfig?: RetryConfig;
  }) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: url,
      },
      retryConfig,
    });
  }
  async get<T>({
    endpoint,
    signal,
    allowedStatuses = [200, 202],
    headers,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    allowedStatuses?: number[];
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
  }): Promise<T> {
    const { status, statusText, data } = await this.axios.get<T>(endpoint, {
      headers,
      signal,
    });

    if (!allowedStatuses.includes(status)) {
      throw new FailedRequestError(status, statusText);
    }

    return data;
  }

  async post<T>({
    endpoint,
    signal,
    allowedStatuses = [200, 202],
    headers,
    data,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    allowedStatuses?: number[];
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    data: Readable | Buffer | ReadableStream;
  }): Promise<T> {
    const {
      status,
      statusText,
      data: response,
    } = await this.axios.post<T>(endpoint, data, {
      headers,
      signal,
    });

    if (!allowedStatuses.includes(status)) {
      throw new FailedRequestError(status, statusText);
    }

    return response;
  }
}
