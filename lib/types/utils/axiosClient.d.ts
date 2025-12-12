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
import { AxiosInstance, AxiosRequestConfig } from 'axios';
import { TurboLogger } from '../types.js';
export declare const defaultRequestHeaders: {
    'x-turbo-source-version': string;
    'x-turbo-source-identifier': string;
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
export declare const defaultRetryConfig: (logger?: TurboLogger) => RetryConfig;
export declare const createAxiosInstance: ({ axiosConfig, }?: AxiosInstanceParameters) => AxiosInstance;
//# sourceMappingURL=axiosClient.d.ts.map