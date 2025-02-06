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
import axios, { AxiosInstance, AxiosRequestConfig, CanceledError } from 'axios';
import axiosRetry, { IAxiosRetryConfig } from 'axios-retry';

import { TurboWinstonLogger } from '../common/logger.js';
import { TurboLogger } from '../types.js';
import { version } from '../version.js';

export const defaultRequestHeaders = {
  'x-turbo-source-version': version,
  'x-turbo-source-identifier': 'turbo-sdk',
};

export interface AxiosInstanceParameters {
  axiosConfig?: Omit<AxiosRequestConfig, 'validateStatus'>;
  retryConfig?: IAxiosRetryConfig;
  logger?: TurboLogger;
}

export const defaultRetryConfig: (logger?: TurboLogger) => IAxiosRetryConfig = (
  logger = TurboWinstonLogger.default,
) => ({
  retryDelay: axiosRetry.exponentialDelay,
  retries: 5,
  retryCondition: (error) => {
    return (
      !(error instanceof CanceledError) &&
      axiosRetry.isIdempotentRequestError(error) &&
      axiosRetry.isNetworkError(error)
    );
  },
  onRetry: (retryCount, error) => {
    logger.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
  },
});

export const createAxiosInstance = ({
  logger = TurboWinstonLogger.default,
  axiosConfig = {},
  retryConfig = defaultRetryConfig(logger),
}: AxiosInstanceParameters = {}): AxiosInstance => {
  const axiosInstance = axios.create({
    ...axiosConfig,
    headers: {
      ...axiosConfig.headers,
      ...defaultRequestHeaders,
    },
    validateStatus: () => true, // don't throw on non-200 status codes
  });

  // eslint-disable-next-line
  if (retryConfig.retries && retryConfig.retries > 0) {
    axiosRetry(axiosInstance, retryConfig);
  }

  return axiosInstance;
};
