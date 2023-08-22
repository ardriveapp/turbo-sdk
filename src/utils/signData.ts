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
import Arweave from 'arweave';
import { stringToBuffer } from 'arweave/node/lib/utils.js';
import { Buffer } from 'buffer';
import { randomBytes } from 'crypto';

import { JWKInterface } from '../types/index.js';
import { TurboRequestHeaders } from '../types/turbo.js';
import { toB64Url } from './base64.js';

export async function signData(
  jwk: JWKInterface,
  dataToSign: string,
): Promise<Uint8Array> {
  return Arweave.crypto.sign(jwk, stringToBuffer(dataToSign));
}

export async function signedRequestHeadersFromJwk(
  jwk: JWKInterface,
  nonce: string = randomBytes(16).toString('hex'),
  data = '',
): Promise<TurboRequestHeaders> {
  const signature = await signData(jwk, data + nonce);

  return {
    'x-public-key': jwk.n,
    'x-nonce': nonce,
    'x-signature': toB64Url(Buffer.from(signature)),
  };
}
