"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbortError = exports.ProvidedInputError = exports.FailedRequestError = exports.UnauthenticatedRequestError = exports.BaseError = void 0;
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
class BaseError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
exports.BaseError = BaseError;
class UnauthenticatedRequestError extends BaseError {
    constructor() {
        super('Failed authentication. JWK is required.');
    }
}
exports.UnauthenticatedRequestError = UnauthenticatedRequestError;
class FailedRequestError extends BaseError {
    constructor(message, status) {
        super(`Failed request${status !== undefined ? ` (Status ${status})` : ''}: ${message}`);
        this.status = status;
    }
}
exports.FailedRequestError = FailedRequestError;
class ProvidedInputError extends BaseError {
    constructor(message) {
        super(message ?? `User has provided an invalid input`);
    }
}
exports.ProvidedInputError = ProvidedInputError;
class AbortError extends BaseError {
    constructor(message = 'Request was aborted') {
        super(message);
    }
}
exports.AbortError = AbortError;
