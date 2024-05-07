/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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

export const createAxiosInstance = ({
  logger = new TurboWinstonLogger(),
  axiosConfig = {},
  retryConfig = {
    retryDelay: axiosRetry.exponentialDelay,
    retries: 3,
    retryCondition: (error) => {
      return (
        !(error instanceof CanceledError) &&
        axiosRetry.isNetworkOrIdempotentRequestError(error)
      );
    },
    onRetry: (retryCount, error) => {
      logger.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
    },
  },
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
