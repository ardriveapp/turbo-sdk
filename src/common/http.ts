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
import { AxiosInstance } from 'axios';
import { IAxiosRetryConfig } from 'axios-retry';
import { Buffer } from 'node:buffer';
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';

import {
  TurboHTTPServiceInterface,
  TurboLogger,
  TurboSignedRequestHeaders,
} from '../types.js';
import { createAxiosInstance } from '../utils/axiosClient.js';
import { FailedRequestError } from '../utils/errors.js';

export class TurboHTTPService implements TurboHTTPServiceInterface {
  protected axios: AxiosInstance;
  protected logger: TurboLogger;

  constructor({
    url,
    retryConfig,
    logger,
  }: {
    url: string;
    retryConfig?: IAxiosRetryConfig;
    logger: TurboLogger;
  }) {
    this.logger = logger;
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: url,
        maxRedirects: 0, // prevents backpressure issues when uploading larger streams via https
        onUploadProgress: (progressEvent) => {
          this.logger.debug(`Uploading...`, {
            percent: Math.floor((progressEvent.progress ?? 0) * 100),
            loaded: `${progressEvent.loaded} bytes`,
            total: `${progressEvent.total} bytes`,
          });
          if (progressEvent.progress === 1) {
            this.logger.debug(`Upload complete!`);
          }
        },
      },
      retryConfig,
      logger: this.logger,
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
      throw new FailedRequestError(
        status,
        // Return error message from server if available
        typeof data === 'string' ? data : statusText,
      );
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
      throw new FailedRequestError(
        status,
        // Return error message from server if available
        typeof response === 'string' ? response : statusText,
      );
    }

    return response;
  }
}
