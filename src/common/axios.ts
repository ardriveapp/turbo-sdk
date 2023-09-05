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
import { AxiosInstance, AxiosRequestHeaders } from 'axios';
import { Readable } from 'stream';

import { createAxiosInstance } from '../utils/axiosClient.js';
import { FailedRequestError } from '../utils/errors.js';

export class TurboHTTPService implements TurboHTTPService {
  protected axios: AxiosInstance;
  constructor({ url = 'https://payment.ardrive.dev', retryConfig }: any) {
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: `${url}/v1`,
      },
      retryConfig,
    });
  }
  async get<T>({
    url,
    headers,
  }: {
    url: string;
    headers?: Record<string, string>;
  }): Promise<T> {
    const { status, statusText, data } = await this.axios.get<T>(url, {
      headers,
    });

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return data;
  }

  async post<T>({
    url,
    headers,
    data,
  }: {
    url: string;
    headers: AxiosRequestHeaders;
    data: Readable | ReadableStream | Buffer;
  }): Promise<T> {
    const {
      status,
      statusText,
      data: response,
    } = await this.axios.post<T>(url, {
      headers,
      data,
    });

    if (status !== 200) {
      throw new FailedRequestError(status, statusText);
    }

    return response;
  }
}
