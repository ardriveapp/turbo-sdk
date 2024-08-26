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
import { Secp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/amino';
import { Slip10, Slip10Curve } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
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

  switch (token) {
    case 'solana':
      return new HexSolanaSigner(clientProvidedPrivateKey);
    case 'ethereum':
      if (!isEthPrivateKey(clientProvidedPrivateKey)) {
        throw new Error(
          'An Ethereum private key must be provided for EthereumSigner.',
        );
      }
      return new EthereumSigner(clientProvidedPrivateKey);
    case 'kyve':
      if (!isEthPrivateKey(clientProvidedPrivateKey)) {
        throw new Error(
          'An valid private key must be provided for KyveSigner.',
        );
      }
      return signerFromKyvePrivateKey(clientProvidedPrivateKey);
    default:
      if (!isJWK(clientProvidedPrivateKey)) {
        throw new Error('A JWK must be provided for ArweaveSigner.');
      }
      return new ArweaveSigner(clientProvidedPrivateKey);
  }
}

export function signerFromKyvePrivateKey(privateKey: string): TurboSigner {
  // TODO: Use KyveSigner when implemented for on chain native address support
  return new EthereumSigner(privateKey);
}

export async function signerFromKyveMnemonic(
  mnemonic: string,
): Promise<TurboSigner> {
  const kyveWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'kyve',
  });

  const privateKey = toHex(
    Slip10.derivePath(
      Slip10Curve.Secp256k1,
      kyveWallet['seed'],
      makeCosmoshubPath(0),
    ).privkey,
  );

  return signerFromKyvePrivateKey(privateKey);
}
