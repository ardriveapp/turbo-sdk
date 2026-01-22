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
import { pubkeyToAddress } from '@cosmjs/amino';
import { Secp256k1, sha256 } from '@cosmjs/crypto';
import { fromHex, toBase64 } from '@cosmjs/encoding';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import {
  GasPrice,
  SigningStargateClient,
  calculateFee,
} from '@cosmjs/stargate';
import {
  SendTxWithSignerParams,
  TurboSignerInterface,
} from '@ardrive/turbo-sdk';
import { SigningKey, getBytes } from 'ethers';

/**
 * Secp256k1 signature type for ANS-104 data items
 */
export const KYVE_SIGNATURE_TYPE = 3;

/**
 * Owner length for KYVE signers (uncompressed public key 65 bytes)
 */
export const KYVE_OWNER_LENGTH = 65;

/**
 * Signature length for KYVE signers (r + s + recovery, 65 bytes)
 */
export const KYVE_SIGNATURE_LENGTH = 65;

/**
 * Supported KYVE chain configurations
 * Reference: https://github.com/KYVENetwork/kyvejs/blob/e6c68b007fb50ab026e60ea6eaadf37b7cf8c76f/common/sdk/src/constants.ts
 */
export const SUPPORTED_CHAIN_CONFIGS = {
  'kyve-1': {
    chainId: 'kyve-1',
    chainName: 'KYVE',
    rpc: 'https://rpc.kyve.network',
    rest: 'https://api.kyve.network',
    coin: 'KYVE',
    coinDenom: 'ukyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'kaon-1': {
    chainId: 'kaon-1',
    chainName: 'KYVE Kaon',
    rpc: 'https://rpc.kaon.kyve.network',
    rest: 'https://api.kaon.kyve.network',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'korellia-2': {
    chainId: 'korellia-2',
    chainName: 'KYVE Korellia',
    rpc: 'https://rpc.korellia.kyve.network',
    rest: 'https://api.korellia.kyve.network',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
} as const;

export type KyveChainId = keyof typeof SUPPORTED_CHAIN_CONFIGS;

/**
 * Converts a hex string to Uint8Array
 */
function hexToUint8Array(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return fromHex(cleanHex);
}

/**
 * TurboKyveSigner implements TurboSignerInterface for KYVE.
 * Uses secp256k1 cryptography - ethers for key derivation, @cosmjs for transactions.
 */
export class TurboKyveSigner implements TurboSignerInterface {
  private readonly privateKeyBytes: Uint8Array;
  private readonly privateKeyHex: string;
  private readonly signingKey: SigningKey;
  private readonly _publicKey: Uint8Array;
  private readonly compressedPublicKey: Uint8Array;

  /**
   * Creates a new TurboKyveSigner
   * @param privateKey - The private key as a hex string (with or without 0x prefix) or Uint8Array (32 bytes)
   */
  constructor(privateKey: string | Uint8Array) {
    if (typeof privateKey === 'string') {
      this.privateKeyHex = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      this.privateKeyBytes = hexToUint8Array(privateKey);
    } else {
      this.privateKeyBytes = privateKey;
      this.privateKeyHex = Array.from(privateKey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }

    if (this.privateKeyBytes.length !== 32) {
      throw new Error(
        `Invalid private key length: ${this.privateKeyBytes.length}. Expected 32 bytes.`,
      );
    }

    // Use ethers SigningKey for synchronous public key derivation
    this.signingKey = new SigningKey('0x' + this.privateKeyHex);

    // Get uncompressed public key (65 bytes)
    this._publicKey = getBytes(this.signingKey.publicKey);

    // Get compressed public key for Cosmos address derivation
    this.compressedPublicKey = getBytes(this.signingKey.compressedPublicKey);
  }

  /** The public key of the signer (65 bytes, uncompressed) */
  get publicKey(): Uint8Array {
    return this._publicKey;
  }

  /** Length of the owner field in bytes */
  get ownerLength(): number {
    return KYVE_OWNER_LENGTH;
  }

  /** Length of the signature in bytes */
  get signatureLength(): number {
    return KYVE_SIGNATURE_LENGTH;
  }

  /**
   * Sign the provided data using secp256k1 with Ethereum-style message hashing.
   * This matches the behavior of EthereumSigner from arbundles for compatibility.
   */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    // Use Ethereum personal_sign style: hash the message with prefix
    const prefix = Buffer.from(
      `\x19Ethereum Signed Message:\n${message.length}`,
      'utf8',
    );
    const prefixedMessage = Buffer.concat([prefix, Buffer.from(message)]);
    const messageHash = sha256(prefixedMessage);

    // Sign with secp256k1
    const signature = await Secp256k1.createSignature(
      messageHash,
      this.privateKeyBytes,
    );

    // Combine r, s, v into 65-byte signature (matching Ethereum format)
    const r = signature.r(32);
    const s = signature.s(32);
    const v = signature.recovery;

    const sig = new Uint8Array(65);
    sig.set(r, 0);
    sig.set(s, 32);
    sig[64] = v;

    return sig;
  }

  /** Get the native KYVE address (bech32 with 'kyve' prefix) */
  async getNativeAddress(): Promise<string> {
    return pubkeyToAddress(
      {
        type: 'tendermint/PubKeySecp256k1',
        value: toBase64(this.compressedPublicKey),
      },
      'kyve',
    );
  }

  /**
   * Send a transaction on KYVE
   * @param params - Transaction parameters including target, amount, and gateway URL
   * @returns The transaction hash
   */
  async sendTransaction({
    target,
    amount,
    gatewayUrl,
    data,
  }: SendTxWithSignerParams): Promise<string> {
    // Determine chain ID from gateway URL
    const chainId = this.getChainIdFromGatewayUrl(gatewayUrl);
    const config = SUPPORTED_CHAIN_CONFIGS[chainId];

    if (!config) {
      throw new Error(`Unsupported gateway URL: ${gatewayUrl}`);
    }

    const wallet = await DirectSecp256k1Wallet.fromKey(
      this.privateKeyBytes,
      'kyve',
    );
    const [account] = await wallet.getAccounts();
    const senderAddress = account.address;
    const gasPrice = GasPrice.fromString(
      `${config.gasPrice}${config.coinDenom}`,
    );

    const client = await SigningStargateClient.connectWithSigner(
      config.rpc,
      wallet,
      { gasPrice },
    );

    // Create MsgSend message
    const tokenAmount = amount.toFixed(0);
    const msg = {
      fromAddress: senderAddress,
      toAddress: target,
      amount: [{ denom: config.coinDenom, amount: tokenAmount }],
    };

    const encodedMsg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: msg,
    };

    // Simulate gas usage
    const gasEstimate = await client.simulate(senderAddress, [encodedMsg], '');

    // Calculate fee with buffer
    const fee = calculateFee(
      Math.round(gasEstimate * 1.5),
      GasPrice.fromString(`${config.gasPrice}${config.coinDenom}`),
    );

    // Convert data to memo string if provided
    const memo = data ? new TextDecoder().decode(data) : '';

    // Send the actual transaction
    const result = await client.sendTokens(
      senderAddress,
      target,
      [{ denom: config.coinDenom, amount: tokenAmount }],
      fee,
      memo,
    );

    return result.transactionHash;
  }

  /**
   * Determines the chain ID from the gateway URL
   */
  private getChainIdFromGatewayUrl(gatewayUrl: string): KyveChainId {
    if (gatewayUrl.includes('kaon')) {
      return 'kaon-1';
    }
    if (gatewayUrl.includes('korellia')) {
      return 'korellia-2';
    }
    return 'kyve-1';
  }
}

/**
 * Creates a TurboKyveSigner from a private key
 * @param privateKey - The private key as a hex string (with or without 0x prefix) or Uint8Array
 * @returns A TurboKyveSigner instance implementing TurboSignerInterface
 */
export function createKyveSigner(
  privateKey: string | Uint8Array,
): TurboKyveSigner {
  return new TurboKyveSigner(privateKey);
}
