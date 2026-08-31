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
import { Readable } from 'node:stream';
import { createPaymentHeader, selectPaymentRequirements } from 'x402/client';
import { PaymentRequirementsSchema } from 'x402/types';

import {
  TurboHTTPServiceInterface,
  TurboLogger,
  TurboSignedRequestHeaders,
  X402RequestCredentials,
} from '../types.js';
import { sleep } from '../utils/common.js';
import { AbortError, FailedRequestError } from '../utils/errors.js';
import { readableToReadableStream } from '../utils/readableStream.js';
import { version } from '../version.js';

export interface RetryConfig {
  retryDelay: (retryCount: number) => number;
  retries: number;
  onRetry: (retryCount: number, error: unknown) => void;
}

export const defaultRetryConfig: (logger?: TurboLogger) => RetryConfig = (
  logger,
) => ({
  retryDelay: (retryCount) => Math.min(1000 * 2 ** (retryCount - 1), 30 * 1000),
  retries: 5,
  onRetry: (retryCount, error) => {
    logger?.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
  },
});

const defaultHeaders = {
  'x-turbo-source-version': version,
  'x-turbo-source-identifier': 'turbo-sdk',
};

export class TurboHTTPService implements TurboHTTPServiceInterface {
  protected baseURL: string;
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
    this.baseURL = url;
    this.retryConfig = retryConfig;
  }

  async get<T>({
    endpoint,
    signal,
    allowedStatuses = [200, 202],
    headers,
  }: {
    endpoint: `/${string}`;
    signal?: AbortSignal;
    allowedStatuses?: number[];
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
  }): Promise<T> {
    return this.withRetry<T>(
      () =>
        fetch(this.baseURL + endpoint, {
          method: 'GET',
          headers: { ...defaultHeaders, ...headers },
          signal,
        }),
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
    dataFactory,
  }: {
    endpoint: `/${string}`;
    signal?: AbortSignal;
    allowedStatuses?: number[];
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    data: Readable | Buffer | ReadableStream | Uint8Array;
    x402Options?: X402RequestCredentials;
    /**
     * Rebuilds the request body. Required for x402, which sends the request
     * twice — once unpaid to obtain the quote, once with the payment header —
     * and a stream cannot be sent twice.
     */
    dataFactory?: () => Readable | Buffer | ReadableStream | Uint8Array;
  }): Promise<T> {
    if (x402Options !== undefined) {
      return this.x402Post({
        endpoint,
        signal,
        allowedStatuses,
        headers,
        dataFactory: dataFactory ?? (() => data),
        x402Options,
      });
    }

    // Convert all data types to fetch-compatible body
    const { body, duplex } = await toFetchBody(data);

    // Use retry for Buffer/Uint8Array, tryRequest for streams
    const isReusableData = data instanceof Buffer || data instanceof Uint8Array;
    const requestFn = isReusableData
      ? this.withRetry.bind(this)
      : this.tryRequest.bind(this);

    return requestFn(
      () =>
        fetch(this.baseURL + endpoint, {
          method: 'POST',
          headers: { ...defaultHeaders, ...headers },
          body,
          signal,
          ...(duplex ? { duplex } : {}),
        }),
      allowedStatuses,
    );
  }

  private async tryRequest<T>(
    request: () => Promise<Response>,
    allowedStatuses: number[],
  ): Promise<T> {
    try {
      const response = await request();
      const { status, statusText } = response;

      if (!allowedStatuses.includes(status)) {
        const errorText = await response.text();
        throw new FailedRequestError(errorText || statusText, status);
      }

      // check the content-type header to see if json
      const contentType = response.headers.get('content-type');

      if (contentType !== null && contentType.includes('application/json')) {
        return response.json() as Promise<T>;
      }

      return response.text() as Promise<T>;
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        throw new AbortError('Request was aborted');
      }
      throw error;
    }
  }

  private async withRetry<T>(
    request: () => Promise<Response>,
    allowedStatuses: number[],
  ): Promise<T> {
    let attempt = 0;
    let lastError: FailedRequestError | undefined;

    while (attempt < this.retryConfig.retries) {
      try {
        const resp = await this.tryRequest<T>(request, allowedStatuses);
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

  /**
   * Perform the x402 challenge/response by hand rather than through
   * `wrapFetchWithPayment`.
   *
   * The wrapper re-issues the request by spreading the original `init`, body
   * included (x402-fetch `wrapFetchWithPayment`). A body is not reusable: a
   * `ReadableStream` has already been disturbed by the unpaid attempt, so the
   * paid retry throws `Response body object should not be disturbed or locked`
   * and the payment can never be made. Every streamed x402 upload fails this
   * way, which is every data item large enough for the SDK to stream. Buffered
   * bodies survive it but get transmitted twice.
   *
   * Rebuilding the body per attempt fixes that.
   *
   * The body is still sent twice, as it was before — the quote costs one
   * transmission. Cancelling the unpaid attempt once its 402 lands would avoid
   * that, but aborting a request whose body is still streaming surfaces as an
   * unhandled rejection from inside fetch, so it is left for a follow-up
   * alongside a body-less quote route.
   */
  private async x402Post<T>({
    endpoint,
    signal,
    allowedStatuses,
    headers,
    dataFactory,
    x402Options,
  }: {
    endpoint: `/${string}`;
    signal?: AbortSignal;
    allowedStatuses: number[];
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    dataFactory: () => Readable | Buffer | ReadableStream | Uint8Array;
    x402Options: X402RequestCredentials;
  }): Promise<T> {
    const x402Endpoint =
      '/x402/data-item/' + (x402Options.unsignedData ? 'unsigned' : 'signed');
    const url = this.baseURL + x402Endpoint;

    this.logger.debug('Using X402 options for POST request', {
      endpoint: x402Endpoint,
      requestedEndpoint: endpoint,
    });

    const send = async (paymentHeader?: string) => {
      const { body, duplex } = await toFetchBody(dataFactory());
      return fetch(url, {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          ...headers,
          ...(paymentHeader !== undefined
            ? {
                'X-PAYMENT': paymentHeader,
                'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
              }
            : {}),
        },
        body,
        signal,
        ...(duplex ? { duplex } : {}),
      });
    };

    return this.tryRequest(async () => {
      // 1. Unpaid attempt, purely to learn the price.
      const quoteRes = await send();

      if (quoteRes.status !== 402) {
        // Already acceptable (or a real error) — no payment needed.
        return quoteRes;
      }

      const { x402Version, accepts } = (await quoteRes.json()) as {
        x402Version: number;
        accepts: unknown[];
      };
      if (!Array.isArray(accepts) || accepts.length === 0) {
        throw new FailedRequestError(
          'x402 response did not include payment requirements',
          402,
        );
      }

      const requirements = accepts.map((a) =>
        PaymentRequirementsSchema.parse(a),
      );
      const selected = selectPaymentRequirements(
        requirements,
        undefined,
        'exact',
      );

      if (x402Options.maxMUSDCAmount !== undefined) {
        const max = BigInt(x402Options.maxMUSDCAmount.toString());
        if (BigInt(selected.maxAmountRequired) > max) {
          throw new FailedRequestError(
            `x402 payment of ${selected.maxAmountRequired} exceeds the maximum allowed ${max}`,
            402,
          );
        }
      }

      const paymentHeader = await createPaymentHeader(
        x402Options.signer,
        x402Version,
        selected,
      );

      // 2. Paid attempt, with a body built fresh for it.
      return send(paymentHeader);
    }, allowedStatuses);
  }
}

type FetchBodyInput =
  | ReadableStream<Uint8Array>
  | Readable
  | Buffer
  | Uint8Array;

const isBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined';

async function toFetchBody(
  data: FetchBodyInput,
): Promise<{ body: BodyInit; duplex?: 'half' }> {
  // Handle ReadableStream
  if (data instanceof ReadableStream) {
    if (isFirefoxOrSafari()) {
      // Convert stream to blob for Firefox/Safari
      const blob = await new Response(data).blob();
      return { body: blob };
    }

    // Chrome/Edge/Opera support streaming
    return { body: data, duplex: 'half' };
  }

  // Handle Node.js Readable
  if (data instanceof Readable) {
    const stream = readableToReadableStream(data);
    // recursively call toFetchBody to now hit the ReadableStream case
    return toFetchBody(stream);
  }

  // Handle Buffer or Uint8Array
  if (isBrowser) {
    return { body: new Blob([new Uint8Array(data)]) };
  }

  return { body: Uint8Array.from(data) };
}

function isFirefoxOrSafari(): boolean {
  if (!isBrowser) return false;
  const ua = navigator.userAgent;
  return (
    ua.includes('Firefox') ||
    (ua.includes('Safari') &&
      !ua.includes('Chrome') &&
      !ua.includes('Chromium'))
  );
}
