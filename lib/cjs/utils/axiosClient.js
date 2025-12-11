"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAxiosInstance = exports.defaultRetryConfig = exports.defaultRequestHeaders = void 0;
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
const axios_1 = __importDefault(require("axios"));
const logger_js_1 = require("../common/logger.js");
const version_js_1 = require("../version.js");
exports.defaultRequestHeaders = {
    'x-turbo-source-version': version_js_1.version,
    'x-turbo-source-identifier': 'turbo-sdk',
};
const defaultRetryConfig = (logger = logger_js_1.Logger.default) => ({
    retryDelay: (retryCount) => Math.min(1000 * 2 ** (retryCount - 1), 30 * 1000), // exponential backoff up to 30s
    retries: 5,
    onRetry: (retryCount, error) => {
        logger.debug(`Request failed, ${error}. Retry attempt #${retryCount}...`);
    },
});
exports.defaultRetryConfig = defaultRetryConfig;
const createAxiosInstance = ({ axiosConfig = {}, } = {}) => {
    const axiosInstance = axios_1.default.create({
        ...axiosConfig,
        headers: {
            ...axiosConfig.headers,
            ...exports.defaultRequestHeaders,
        },
        adapter: 'fetch',
        validateStatus: () => true, // don't throw on non-200 status codes
    });
    return axiosInstance;
};
exports.createAxiosInstance = createAxiosInstance;
