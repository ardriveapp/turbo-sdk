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
import {
  SendTxWithSignerParams,
  TurboSignerInterface,
} from '@ardrive/turbo-sdk';
import { computePublicKey } from '@ethersproject/signing-key';
import {
  Wallet as EthereumWallet,
  JsonRpcProvider,
  SigningKey,
  computeAddress,
  decodeBase64,
  encodeBase64,
  getBytes,
  hashMessage,
  hexlify,
  parseEther,
  toUtf8Bytes,
} from 'ethers';

/**
 * Converts a Uint8Array to a base64url encoded string
 */
function toB64Url(data: Uint8Array): string {
  return encodeBase64(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converts a base64url encoded string to a Uint8Array
 */
function fromB64Url(input: string): Uint8Array {
  const paddingLength = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .concat('='.repeat(paddingLength));
  return decodeBase64(base64);
}

/**
 * Converts a Uint8Array to a hex string
 */
function uint8ArrayToHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Ethereum signature type for ANS-104 data items
 */
const ETHEREUM_SIGNATURE_TYPE = 3;

/**
 * Owner length for Ethereum signers (uncompressed public key without 0x04 prefix)
 */
const ETHEREUM_OWNER_LENGTH = 65;

/**
 * Signature length for Ethereum signers
 */
const ETHEREUM_SIGNATURE_LENGTH = 65;

/**
 * TurboEthereumSigner implements TurboSignerInterface for Ethereum-based chains.
 * Uses ethers.js for all cryptographic operations.
 */
export class TurboEthereumSigner implements TurboSignerInterface {
  private readonly privateKeyHex: string;
  private readonly signingKey: SigningKey;
  private readonly _publicKey: Uint8Array;

  constructor(privateKey: string | Uint8Array) {
    if (typeof privateKey === 'string') {
      this.privateKeyHex = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
    } else {
      this.privateKeyHex = uint8ArrayToHex(privateKey);
    }

    this.signingKey = new SigningKey('0x' + this.privateKeyHex);

    // Get uncompressed public key (65 bytes: 04 prefix + 32 bytes x + 32 bytes y)
    this._publicKey = getBytes(this.signingKey.publicKey);
  }

  /** The public key of the signer (65 bytes, uncompressed without 04 prefix) */
  get publicKey(): Uint8Array {
    return this._publicKey;
  }

  /** Length of the owner field in bytes */
  get ownerLength(): number {
    return ETHEREUM_OWNER_LENGTH;
  }

  /** Length of the signature in bytes */
  get signatureLength(): number {
    return ETHEREUM_SIGNATURE_LENGTH;
  }

  get signatureType(): number {
    return ETHEREUM_SIGNATURE_TYPE;
  }

  /** Sign the provided data using Ethereum's personal_sign style */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    const hash = hashMessage(message);
    const signature = this.signingKey.sign(hash);

    // Combine r, s, v into a single 65-byte signature
    const r = getBytes(signature.r);
    const s = getBytes(signature.s);
    const v = signature.v === 27 ? 0 : 1;

    const sig = new Uint8Array(65);
    sig.set(r, 0);
    sig.set(s, 32);
    sig[64] = v;

    return sig;
  }

  /** Get the native ethereum address for this signer */
  async getNativeAddress(): Promise<string> {
    const publicKeyB64 = toB64Url(this.publicKey);
    return this.ownerToEthereumAddress(publicKeyB64);
  }

  /** Send a transaction on an Ethereum-compatible chain */
  async sendTransaction({
    target,
    amount,
    gatewayUrl,
    data,
    turboCreditDestinationAddress, // TODO: remove this once the turbo-sdk just uses `data`
  }: SendTxWithSignerParams): Promise<string> {
    const provider = new JsonRpcProvider(gatewayUrl);
    const wallet = new EthereumWallet(this.privateKeyHex, provider);

    // Support both new `data` param and deprecated `turboCreditDestinationAddress`
    const txData =
      data !== undefined
        ? '0x' + uint8ArrayToHex(data)
        : this.encodeDestinationAddress(turboCreditDestinationAddress);

    const tx = await wallet.sendTransaction({
      to: target,
      value: parseEther(amount.toFixed(18)),
      data: txData,
    });

    return tx.hash;
  }

  /**
   * Encodes a turbo credit destination address into transaction data
   * @deprecated Use the `data` parameter in sendTransaction instead
   */
  private encodeDestinationAddress(
    turboCreditDestinationAddress: string | undefined,
  ): string | undefined {
    if (turboCreditDestinationAddress !== undefined) {
      return hexlify(
        toUtf8Bytes(
          'turboCreditDestinationAddress=' + turboCreditDestinationAddress,
        ),
      );
    }
    return undefined;
  }

  private ownerToEthereumAddress(owner: string): string {
    return computeAddress(computePublicKey(fromB64Url(owner)));
  }
}

/**
 * Creates a TurboEthereumSigner from a private key
 * @param privateKey - The private key as a hex string (with or without 0x prefix) or Uint8Array
 * @returns A TurboEthereumSigner instance implementing TurboSignerInterface
 */
export function createEthereumSigner(
  privateKey: string | Uint8Array,
): TurboEthereumSigner {
  return new TurboEthereumSigner(privateKey);
}
