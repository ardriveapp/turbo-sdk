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
import { Readable } from 'node:stream';
import { wrapFetchWithPayment } from 'x402-fetch';

import {
  TurboHTTPServiceInterface,
  TurboLogger,
  TurboSignedRequestHeaders,
  X402RequestCredentials,
} from '../types.js';
import {
  RetryConfig,
  createAxiosInstance,
  defaultRetryConfig,
} from '../utils/axiosClient.js';
import { sleep } from '../utils/common.js';
import { FailedRequestError } from '../utils/errors.js';

export class TurboHTTPService implements TurboHTTPServiceInterface {
  protected axios: AxiosInstance;
  protected logger: TurboLogger;
  protected retryConfig: RetryConfig;

  constructor({
    url,
    logger,
    retryConfig = defaultRetryConfig(logger),
  }: {
    url: string;
    retryConfig: RetryConfig;
    logger: TurboLogger;
  }) {
    this.logger = logger;
    this.axios = createAxiosInstance({
      axiosConfig: {
        baseURL: url,
        maxRedirects: 0, // prevents backpressure issues when uploading larger streams via https
      },
      logger: this.logger,
    });
    this.retryConfig = retryConfig;
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
    return this.retryRequest<T>(
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
    x402Options,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    allowedStatuses?: number[];
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    data: Readable | Buffer | ReadableStream | Uint8Array;
    x402Options?: X402RequestCredentials;
  }): Promise<T> {
    // Buffer and Readable → keep Axios (streams work fine there)
    if (!(data instanceof ReadableStream) && x402Options === undefined) {
      if (data instanceof Readable) {
        return this.tryRequest(
          // Can't retry a Readable stream that has already been partially consumed
          () => this.axios.post<T>(endpoint, data, { headers, signal }),
          allowedStatuses,
        );
      }
      return this.retryRequest(
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
      let res: Response;
      // Handle 402 Payment Required with X402Options
      if (x402Options !== undefined) {
        this.logger.debug(
          'Handling 402 Payment Required with fetchWithPayment',
          {
            endpoint,
            x402Options,
          },
        );

        const maxMUSDCAmount =
          x402Options.maxMUSDCAmount !== undefined
            ? BigInt(x402Options.maxMUSDCAmount.toString())
            : undefined;
        const fetchWithPay = wrapFetchWithPayment(
          fetch,
          x402Options.signer,
          maxMUSDCAmount,
        );
        res = await fetchWithPay(
          this.axios.defaults.baseURL + '/x402/data-item/signed',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/octet-stream',
            },
            body,
          },
        );
      } else {
        this.logger.debug('Posting data via fetch', { endpoint, headers });
        res = await fetch(this.axios.defaults.baseURL + endpoint, {
          method: 'POST',
          headers,
          body,
          signal,
          ...(duplex ? { duplex } : {}), // Use duplex only where streams are working
        });
      }
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

  private async retryRequest<T>(
    request: () => Promise<AxiosResponse<T, unknown>>,
    allowedStatuses: number[],
  ): Promise<T> {
    let attempt = 0;
    let lastError: FailedRequestError | undefined;

    while (attempt < this.retryConfig.retries) {
      try {
        const resp = await this.tryRequest(request, allowedStatuses);
        return resp;
      } catch (error) {
        if (error instanceof FailedRequestError) {
          lastError = error;
          this.retryConfig.onRetry(attempt + 1, error);
          if (
            error.status !== undefined &&
            error.status >= 400 &&
            error.status < 500
          ) {
            // If it's a client error, we can stop retrying
            throw error;
          }

          await sleep(this.retryConfig.retryDelay(attempt + 1));
          attempt++;
        } else {
          throw error;
        }
      }
    }

    throw new FailedRequestError(
      'Max retries reached - ' + lastError?.message,
      lastError?.status,
    );
  }
}

async function toFetchBody(
  data: ReadableStream<Uint8Array> | Readable | Buffer | Uint8Array,
): Promise<{ body: BodyInit; duplex?: 'half' }> {
  if (!(data instanceof ReadableStream)) {
    // Node.js Readable / Buffer / Uint8Array → convert to ReadableStream
    const nodeStream = data instanceof Readable ? data : Readable.from(data); // Buffer or Uint8Array
    const webStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const chunk = nodeStream.read();
        if (chunk === null) {
          nodeStream.once('readable', () =>
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            controller.enqueue(nodeStream.read()!),
          );
        } else {
          controller.enqueue(chunk);
        }
      },
      cancel() {
        nodeStream.destroy();
      },
    });
    data = webStream;
  }

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
