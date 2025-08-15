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
    data: Readable | Buffer | ReadableStream | Uint8Array;
  }): Promise<T> {
    // Buffer and Readable → keep Axios (streams work fine there)
    if (!(data instanceof ReadableStream)) {
      return this.tryRequest(
        () => this.axios.post<T>(endpoint, data, { headers, signal }),
        allowedStatuses,
      );
    }

    // Browser ReadableStream → use fetch with progressive enhancement of duplex
    // Note: fetch does not support streams in Safari and Firefox, so we convert to Blob
    // and use the `duplex` option only in browsers that support it (Chrome, Edge, Opera).
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API#body
    const { body, duplex } = await toFetchBody(data);

    try {
      this.logger.debug('Posting data via fetch', { endpoint, headers });
      const res = await fetch(this.axios.defaults.baseURL + endpoint, {
        method: 'POST',
        headers,
        body,
        signal,
        ...(duplex ? { duplex } : {}), // Use duplex only where streams are working
      });

      if (!allowedStatuses.includes(res.status)) {
        const errorText = await res.text();
        throw new FailedRequestError(
          // Return error message from server if available
          errorText || res.statusText,
          res.status,
        );
      }
      return res.json() as Promise<T>;
    } catch (error) {
      if (error instanceof FailedRequestError) {
        throw error; // rethrow FailedRequestError
      }
      // Handle CanceledError specifically
      if (error.message.includes('The operation was aborted')) {
        throw new CanceledError();
      }

      // Log the error and throw a FailedRequestError
      this.logger.error('Error posting data', { endpoint, error });
      throw new FailedRequestError(
        error instanceof Error ? error.message : 'Unknown error',
        error.response?.status,
      );
    }
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
      if (
        error instanceof AxiosError &&
        error.code === AxiosError.ERR_CANCELED
      ) {
        throw new CanceledError();
      } else if (error instanceof AxiosError) {
        throw new FailedRequestError(error.code ?? error.message, error.status);
      }
      throw error;
    }
  }
}

async function toFetchBody(
  data: ReadableStream<Uint8Array>,
): Promise<{ body: BodyInit; duplex?: 'half' }> {
  if (
    !navigator.userAgent.includes('Firefox') &&
    !navigator.userAgent.includes('Safari')
  ) {
    return { body: data, duplex: 'half' }; // Chrome / Edge / Opera
  }
  // Firefox / Safari fallback: stream → Blob
  const blob = await new Response(data).blob();
  return { body: blob }; // browser sets length
}
