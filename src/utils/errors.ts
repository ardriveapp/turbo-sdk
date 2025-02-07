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
  constructor(message: string, status?: number) {
    super(
      `Failed request:${status !== undefined ? ` ${status}:` : ''} ${message}`,
    );
  }
}

export class ProvidedInputError extends BaseError {
  constructor(message?: string) {
    super(message ?? `User has provided an invalid input`);
  }
}
