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
import { Secp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/amino';
import { Slip10, Slip10Curve } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import {
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
} from '@dha-team/arbundles';

import {
  TokenType,
  TurboSigner,
  TurboWallet,
  isEthPrivateKey,
  isJWK,
  isKyvePrivateKey,
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
    case 'matic':
      if (!isEthPrivateKey(clientProvidedPrivateKey)) {
        throw new Error(
          'A valid Ethereum private key must be provided for EthereumSigner.',
        );
      }
      return new EthereumSigner(clientProvidedPrivateKey);
    case 'kyve':
      if (!isKyvePrivateKey(clientProvidedPrivateKey)) {
        throw new Error(
          'A valid Kyve private key must be provided for KyveSigner.',
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
