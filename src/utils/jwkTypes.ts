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
import { KeyObject, createPrivateKey, createPublicKey } from "crypto";

export interface JWKPublicInterface {
  kty: string;
  e: string;
  n: string;
}

export interface JWKInterface extends JWKPublicInterface {
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}

export function jwkInterfaceToPublicKey(jwk: JWKInterface): KeyObject {
  const publicKey = createPublicKey({
    key: {
      ...jwk,
      kty: "RSA",
    },
    format: "jwk",
  });

  return publicKey;
}

export function jwkInterfaceToPrivateKey(jwk: JWKInterface): KeyObject {
  const privateKey = createPrivateKey({
    key: {
      ...jwk,
      kty: "RSA",
    },
    format: "jwk",
  });

  return privateKey;
}
