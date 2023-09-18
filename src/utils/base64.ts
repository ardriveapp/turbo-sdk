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
import { bufferTob64Url } from 'arweave/node/lib/utils.js';
import { createHash } from 'crypto';

import { JWKInterface } from '../common/jwk.js';
import { Base64String, PublicArweaveAddress } from '../types.js';

export const base64URLRegex = /^[a-zA-Z0-9_-]{43}$/;

export function jwkToPublicArweaveAddress(
  jwk: JWKInterface,
): PublicArweaveAddress {
  return ownerToAddress(jwk.n);
}

export function ownerToAddress(owner: Base64String): PublicArweaveAddress {
  return sha256B64Url(fromB64Url(owner));
}

export function fromB64Url(input: Base64String): Buffer {
  const paddingLength = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);

  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .concat('='.repeat(paddingLength));

  return Buffer.from(base64, 'base64');
}

export function toB64Url(buffer: Buffer): Base64String {
  return bufferTob64Url(buffer);
}

export function sha256B64Url(input: Buffer): Base64String {
  return toB64Url(createHash('sha256').update(input).digest());
}
