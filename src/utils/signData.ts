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
import { stringToBuffer } from 'arweave/node/lib/utils.js';
import { Buffer } from 'buffer';
import { randomBytes } from 'crypto';

import { JWKInterface } from '../types/index.js';
import { TurboSignedRequestHeaders } from '../types/turbo.js';
import { toB64Url } from './base64.js';
import { isBrowser } from './browser.js';

// TODO: move these to a wallet signer class
export async function signData(
  jwk: JWKInterface,
  dataToSign: string,
): Promise<Uint8Array> {
  const buffer = stringToBuffer(dataToSign);
  if (isBrowser()) {
    const { default: arweave } = await import('arweave/web/index.js');
    return arweave.default.crypto.sign(jwk, buffer);
  } else {
    const { default: arweave } = await import('arweave/node/index.js');
    return arweave.crypto.sign(jwk, buffer);
  }
}

export async function signedRequestHeadersFromJwk(
  jwk: JWKInterface,
  nonce: string = randomBytes(16).toString('hex'),
  data = '',
): Promise<TurboSignedRequestHeaders> {
  const signature = await signData(jwk, data + nonce);

  return {
    'x-public-key': jwk.n,
    'x-nonce': nonce,
    'x-signature': toB64Url(Buffer.from(signature)),
  };
}
