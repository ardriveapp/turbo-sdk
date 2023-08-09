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
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import axiosRetry from "axios-retry";

export interface CreateAxiosInstanceParams {
  config?: AxiosRequestConfig;
  retries?: number;
  retryDelay?: (retryNumber: number) => number;
}

export const createAxiosInstance = ({
  config = {},
  retries = 8,
  retryDelay = axiosRetry.exponentialDelay,
}: CreateAxiosInstanceParams): AxiosInstance => {
  const axiosInstance = axios.create(config);
  if (retries > 0) {
    axiosRetry(axiosInstance, {
      retries,
      retryDelay,
    });
  }
  return axiosInstance;
};
