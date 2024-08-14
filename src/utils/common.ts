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
import { ArweaveSigner, EthereumSigner, HexSolanaSigner } from 'arbundles';

import {
  TokenType,
  TurboSigner,
  TurboWallet,
  isEthPrivateKey,
  isJWK,
} from '../types.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWeb() {
  return typeof window !== 'undefined';
}

export function createTurboSigner({
  signer: clientProvidedSigner,
  privateKey: clientProvidedPrivateKey,
  token = 'arweave',
}: {
  signer?: TurboSigner;
  privateKey?: TurboWallet;
  token: TokenType;
}): TurboSigner {
  if (clientProvidedSigner !== undefined) {
    return clientProvidedSigner;
  }

  if (clientProvidedPrivateKey === undefined) {
    throw new Error('A privateKey or signer must be provided.');
  }

  if (token === 'solana') {
    // TODO: Add a type check for SOL private keys shape for detailed error message
    return new HexSolanaSigner(clientProvidedPrivateKey);
  } else if (token === 'ethereum') {
    if (!isEthPrivateKey(clientProvidedPrivateKey)) {
      throw new Error(
        'An Ethereum private key must be provided for EthereumSigner.',
      );
    }
    return new EthereumSigner(clientProvidedPrivateKey);
  } else {
    if (!isJWK(clientProvidedPrivateKey)) {
      throw new Error('A JWK must be provided for ArweaveSigner.');
    }
    return new ArweaveSigner(clientProvidedPrivateKey);
  }
}
