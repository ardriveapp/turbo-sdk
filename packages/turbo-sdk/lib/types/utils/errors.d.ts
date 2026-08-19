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
export declare class BaseError extends Error {
    constructor(message: string);
}
export declare class UnauthenticatedRequestError extends BaseError {
    constructor();
}
export declare class FailedRequestError extends BaseError {
    status?: number;
    constructor(message: string, status?: number);
}
export declare class ProvidedInputError extends BaseError {
    constructor(message?: string);
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
export declare class InsufficientCreditsError extends BaseError {
    /** Always the HTTP status that produced this error. */
    readonly status = 402;
    constructor(message?: string);
}
export declare class AbortError extends BaseError {
    constructor(message?: string);
}
//# sourceMappingURL=errors.d.ts.map