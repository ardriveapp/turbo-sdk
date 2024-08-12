/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { ArweaveSigner, EthereumSigner, HexSolanaSigner } from 'arbundles/node';

import { TurboSigner, TurboWallet, isEthPrivateKey, isJWK } from '../types.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWeb() {
  return typeof window !== 'undefined';
}

export function createTurboSigner({
  signer,
  jwk,
  token = 'arweave',
}: {
  signer?: TurboSigner;
  jwk?: TurboWallet;
  token: string;
}): TurboSigner {
  if (signer !== undefined) {
    return signer;
  }

  if (jwk !== undefined) {
    if (token === 'solana') {
      return new HexSolanaSigner(jwk);
    } else if (token === 'ethereum') {
      if (!isEthPrivateKey(jwk)) {
        throw new Error(
          'An Ethereum private key must be provided for EthereumSigner.',
        );
      }
      return new EthereumSigner(jwk);
    } else {
      if (!isJWK(jwk)) {
        throw new Error('A JWK must be provided for ArweaveSigner.');
      }
      signer = new ArweaveSigner(jwk);
    }
  }

  throw new Error('A privateKey or signer must be provided.');
}
