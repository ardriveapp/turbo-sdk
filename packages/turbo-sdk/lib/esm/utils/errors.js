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
export class BaseError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}
export class UnauthenticatedRequestError extends BaseError {
    constructor() {
        super('Failed authentication. JWK is required.');
    }
}
export class FailedRequestError extends BaseError {
    constructor(message, status) {
        super(`Failed request${status !== undefined ? ` (Status ${status})` : ''}: ${message}`);
        this.status = status;
    }
}
export class ProvidedInputError extends BaseError {
    constructor(message) {
        super(message ?? `User has provided an invalid input`);
    }
}
/**
 * Raised when a credit-paid operation (e.g. an ArNS purchase) is rejected by the
 * service because the paying wallet does not hold enough Turbo credits. Maps the
 * bundler's HTTP `402 Payment Required` response to a typed, catchable error so
 * callers can prompt a top-up without string-matching on messages.
 *
 * Recovery: top up the balance, then retry the SAME operation reusing the
 * captured `nonce` (the nonce is the idempotency key), or mint a fresh request.
 */
export class InsufficientCreditsError extends BaseError {
    constructor(message) {
        super(message ??
            'Insufficient Turbo credits to complete this purchase. Top up your balance and retry.');
        /** Always the HTTP status that produced this error. */
        this.status = 402;
    }
}
export class AbortError extends BaseError {
    constructor(message = 'Request was aborted') {
        super(message);
    }
}
