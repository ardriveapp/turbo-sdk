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
  constructor(message: string) {
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
  public status?: number;
  constructor(message: string, status?: number) {
    super(
      `Failed request${
        status !== undefined ? ` (Status ${status})` : ''
      }: ${message}`,
    );
    this.status = status;
  }
}

export class ProvidedInputError extends BaseError {
  constructor(message?: string) {
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
  /** Always the HTTP status that produced this error. */
  public readonly status = 402;
  constructor(message?: string) {
    super(
      message ??
        'Insufficient Turbo credits to complete this purchase. Top up your balance and retry.',
    );
  }
}

/**
 * Raised when the payment service has fiat (Stripe) payments switched off, which
 * it signals with `503` and the body "Fiat (Stripe) ArNS payments are disabled".
 * This is a normal state in the testnet sandbox, not an outage.
 *
 * Distinguished from a generic `503` deliberately: the same status is also used
 * for internal errors (body "Internal Server Error: ..."), so status alone is
 * ambiguous. Recovery: fall back to the credit-paid path (`buyArNSName` and
 * friends), or surface fiat checkout as unavailable.
 */
export class FiatPaymentsDisabledError extends BaseError {
  /** Always the HTTP status that produced this error. */
  public readonly status = 503;
  constructor(message?: string) {
    super(
      message ??
        'Fiat (Stripe) payments are disabled on this payment service. Use the credit-paid purchase path instead.',
    );
  }
}

/**
 * Raised when an ArNS action's owner-signed transaction reaches `/sign` too
 * late. Solana accepts the transaction for only about 30 seconds after Turbo
 * builds it; signing again cannot help, because that transaction is dead.
 *
 * `creditsReleased` says whether the credits debited at creation are back:
 * - 409: the chain confirmed the bytes can never land. `true` when the
 *   service says "Your credits have been returned"; `false` means its
 *   immediate refund did not go through and the reconciler will refund.
 * - 400 `Action <nonce> expired …`: `true` for "expired and was refunded";
 *   `false` for the variant refused before submission, refunded
 *   automatically once the reservation (`expiresAt`, ~15 min) lapses.
 *
 * Extends {@link FailedRequestError}, so existing `status` checks still work.
 * Recovery: create a NEW action if the change is still wanted.
 */
export class ArNSActionExpiredError extends FailedRequestError {
  public readonly nonce: string;
  public readonly creditsReleased: boolean;
  public declare status: number;
  constructor(
    nonce: string,
    status: number,
    creditsReleased: boolean,
    /** The service's response body, or a `FailedRequestError` message. */
    message?: string,
  ) {
    super(
      message?.replace(/^Failed request \(Status \d+\): /, '') ??
        `ArNS action ${nonce} expired before its signed transaction was submitted.`,
      status,
    );
    this.nonce = nonce;
    this.creditsReleased = creditsReleased;
  }
}

export class AbortError extends BaseError {
  constructor(message = 'Request was aborted') {
    super(message);
  }
}
