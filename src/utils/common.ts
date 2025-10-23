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
  InjectedEthereumSigner,
} from '@dha-team/arbundles';
import { arrayify } from '@ethersproject/bytes';
import { recoverPublicKey } from '@ethersproject/signing-key';
import { PublicKey } from '@solana/web3.js';
import { hashMessage } from 'ethers';

import {
  TokenType,
  TurboSigner,
  TurboWallet,
  UserAddress,
  isEthPrivateKey,
  isJWK,
  isKyvePrivateKey,
  tokenTypes,
} from '../types.js';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWeb() {
  return typeof window !== 'undefined';
}

export const tokenToDevGatewayMap: Record<TokenType, string> = {
  arweave: 'https://arweave.net', // No arweave test net
  ario: 'https://arweave.net', // No arweave test net
  solana: 'https://api.devnet.solana.com',
  ethereum: 'https://ethereum-holesky-rpc.publicnode.com',
  'base-eth': 'https://sepolia.base.org',
  kyve: 'https://api.korellia.kyve.network',
  matic: 'https://rpc-amoy.polygon.technology',
  pol: 'https://rpc-amoy.polygon.technology',
};

export const tokenToDevAoConfigMap: {
  ario: { processId: string; cuUrl: string };
} = {
  ario: {
    processId: 'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
    cuUrl: 'https://cu.ardrive.io',
  },
};

export const defaultProdGatewayUrls: Record<TokenType, string> = {
  arweave: 'https://arweave.net',
  ario: 'https://arweave.net',
  solana: 'https://api.mainnet-beta.solana.com',
  ethereum: 'https://cloudflare-eth.com/',
  'base-eth': 'https://mainnet.base.org',
  kyve: 'https://api.kyve.network/',
  matic: 'https://polygon-rpc.com/',
  pol: 'https://polygon-rpc.com/',
};

export const defaultProdAoConfigs: {
  ario: { processId: string; cuUrl: string };
} = {
  ario: {
    processId: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE',
    cuUrl: 'https://cu.ardrive.io',
  },
};

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
    if (clientProvidedSigner instanceof InjectedEthereumSigner) {
      // Override the setPublicKey method to resolve a generic string to sign
      clientProvidedSigner.setPublicKey = async () => {
        const message = 'sign this message to connect to your account';
        const signedMsg =
          await clientProvidedSigner['signer'].signMessage(message);
        const hash = hashMessage(message);
        const recoveredKey = recoverPublicKey(arrayify(hash), signedMsg);
        clientProvidedSigner.publicKey = Buffer.from(arrayify(recoveredKey));
      };
    }
    return clientProvidedSigner;
  }

  if (clientProvidedPrivateKey === undefined) {
    throw new Error('A privateKey or signer must be provided.');
  }

  switch (token) {
    case 'solana':
      return new HexSolanaSigner(clientProvidedPrivateKey);
    case 'ethereum':
    case 'pol':
    case 'matic':
    case 'base-eth':
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
    case 'arweave':
    case 'ario':
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

export function isBlob(val: unknown): val is Blob {
  return typeof Blob !== 'undefined' && val instanceof Blob;
}

// check if it is a valid arweave base64url for a wallet public address, transaction id or smartweave contract
export function isValidArweaveBase64URL(base64URL: string) {
  const base64URLRegex = new RegExp('^[a-zA-Z0-9_-]{43}$');
  return base64URLRegex.test(base64URL);
}

export function isValidSolanaAddress(address: string) {
  try {
    return PublicKey.isOnCurve(address);
  } catch {
    return false;
  }
}

export function isValidECDSAAddress(address: string) {
  const ethAddressRegex = new RegExp('^0x[a-fA-F0-9]{40}$');
  return ethAddressRegex.test(address);
}

export function isValidKyveAddress(address: string) {
  const kyveAddressRegex = new RegExp('^kyve[a-zA-Z0-9]{39}$');
  return kyveAddressRegex.test(address);
}

export function isValidUserAddress(address: string, type: TokenType): boolean {
  switch (type) {
    case 'arweave':
    case 'ario':
      return isValidArweaveBase64URL(address);
    case 'solana':
      return isValidSolanaAddress(address);
    case 'ethereum':
    case 'base-eth':
    case 'matic':
    case 'pol':
      return isValidECDSAAddress(address);
    case 'kyve':
      return isValidKyveAddress(address);
  }
}

export function isAnyValidUserAddress(address: string): TokenType | false {
  for (const type of tokenTypes) {
    if (isValidUserAddress(address, type)) {
      return type;
    }
  }
  return false;
}
