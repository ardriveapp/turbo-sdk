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
import { AxiosError, AxiosInstance, AxiosResponse, CanceledError } from 'axios';
import { IAxiosRetryConfig } from 'axios-retry';
import { Readable } from 'node:stream';

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
    return this.tryRequest<T>(
      () => this.axios.get<T>(endpoint, { headers, signal }),
      allowedStatuses,
    );
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
    return this.tryRequest(
      () => this.axios.post<T>(endpoint, data, { headers, signal }),
      allowedStatuses,
    );
  }

  private async tryRequest<T>(
    request: () => Promise<AxiosResponse<T, unknown>>,
    allowedStatuses: number[],
  ): Promise<T> {
    try {
      const { status, data, statusText } = await request();
      if (!allowedStatuses.includes(status)) {
        throw new FailedRequestError(
          // Return error message from server if available
          typeof data === 'string' ? data : statusText,
          status,
        );
      }
      return data;
    } catch (error) {
      if (error instanceof CanceledError) {
        throw error;
      }
      if (error instanceof AxiosError) {
        throw new FailedRequestError(error.code ?? error.message, error.status);
      }
      throw error;
    }
  }
}
