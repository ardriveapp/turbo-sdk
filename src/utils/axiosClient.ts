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
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

import { Logger } from '../common/logger.js';
import { TurboLogger } from '../types.js';
import { version } from '../version.js';

export const defaultRequestHeaders = {
  'x-turbo-source-version': version,
  'x-turbo-source-identifier': 'turbo-sdk',
};

export interface AxiosInstanceParameters {
  axiosConfig?: Omit<AxiosRequestConfig, 'validateStatus'>;
  retryConfig?: RetryConfig;
  logger?: TurboLogger;
}

export type RetryConfig = {
  retryDelay: (retryCount: number) => number;
  retries: number;
  onRetry: (retryCount: number, error: unknown) => void;
};

export const defaultRetryConfig: (logger?: TurboLogger) => RetryConfig = (
  logger = Logger.default,
) => ({
  retryDelay: (retryCount) => Math.min(1000 * 2 ** (retryCount - 1), 30 * 1000), // exponential backoff up to 30s
  retries: 5,
  onRetry: (retryCount, error) => {
    logger.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
  },
});

export const createAxiosInstance = ({
  axiosConfig = {},
}: AxiosInstanceParameters = {}): AxiosInstance => {
  const axiosInstance = axios.create({
    ...axiosConfig,
    headers: {
      ...axiosConfig.headers,
      ...defaultRequestHeaders,
    },
    adapter: 'fetch',
    validateStatus: () => true, // don't throw on non-200 status codes
  });

  return axiosInstance;
};
