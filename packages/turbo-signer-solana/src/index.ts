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
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import nacl from 'tweetnacl';

/**
 * Memo program ID for Solana
 */
export const memoProgramId = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/**
 * ED25519 signature type for ANS-104 data items
 */
export const SOLANA_SIGNATURE_TYPE = 2;

/**
 * Owner length for Solana signers (32 bytes public key)
 */
export const SOLANA_OWNER_LENGTH = 32;

/**
 * Signature length for Solana signers (64 bytes)
 */
export const SOLANA_SIGNATURE_LENGTH = 64;

/**
 * TurboSolanaSigner implements TurboSignerInterface for Solana.
 * Uses tweetnacl for cryptographic operations and @solana/web3.js for transactions.
 */
export class TurboSolanaSigner implements TurboSignerInterface {
  private readonly secretKey: Uint8Array;
  private readonly keypair: Keypair;
  private readonly _publicKey: Uint8Array;

  /**
   * Creates a new TurboSolanaSigner
   * @param privateKey - The private key as a base58 string or Uint8Array (64 bytes: 32 secret + 32 public)
   */
  constructor(privateKey: string | Uint8Array) {
    if (typeof privateKey === 'string') {
      // Base58 encoded secret key
      this.secretKey = bs58.decode(privateKey);
    } else {
      this.secretKey = privateKey;
    }

    // Solana uses 64-byte secret keys (32 secret + 32 public)
    if (this.secretKey.length === 64) {
      this.keypair = Keypair.fromSecretKey(this.secretKey);
    } else if (this.secretKey.length === 32) {
      // If only 32 bytes provided, generate the keypair from seed
      this.keypair = Keypair.fromSeed(this.secretKey);
    } else {
      throw new Error(
        `Invalid private key length: ${this.secretKey.length}. Expected 32 or 64 bytes.`,
      );
    }

    this._publicKey = this.keypair.publicKey.toBytes();
  }

  /** The public key of the signer (32 bytes) */
  get publicKey(): Uint8Array {
    return this._publicKey;
  }

  /** Length of the owner field in bytes */
  get ownerLength(): number {
    return SOLANA_OWNER_LENGTH;
  }

  /** Length of the signature in bytes */
  get signatureLength(): number {
    return SOLANA_SIGNATURE_LENGTH;
  }

  /** Sign the provided data using ED25519 */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    return nacl.sign.detached(message, this.keypair.secretKey);
  }

  /** Get the native Solana address (base58-encoded public key) */
  async getNativeAddress(): Promise<string> {
    return this.keypair.publicKey.toBase58();
  }

  /** Send a transaction on Solana */
  async sendTransaction({
    target,
    amount,
    gatewayUrl,
    data,
  }: SendTxWithSignerParams): Promise<string> {
    const connection = new Connection(gatewayUrl, 'confirmed');

    const tx = new Transaction({
      feePayer: this.keypair.publicKey,
      ...(await connection.getLatestBlockhash()),
    });

    // Add transfer instruction
    tx.add(
      SystemProgram.transfer({
        fromPubkey: this.keypair.publicKey,
        toPubkey: new PublicKey(target),
        lamports: BigInt(amount.toFixed(0)),
      }),
    );

    // Add memo instruction if data is provided
    if (data !== undefined) {
      tx.add(
        new TransactionInstruction({
          programId: new PublicKey(memoProgramId),
          keys: [],
          data: Buffer.from(data),
        }),
      );
    }

    // Sign and send transaction
    tx.sign(this.keypair);
    const signature = await connection.sendRawTransaction(tx.serialize());

    return signature;
  }
}

/**
 * Creates a TurboSolanaSigner from a private key
 * @param privateKey - The private key as a base58 string or Uint8Array
 * @returns A TurboSolanaSigner instance implementing TurboSignerInterface
 */
export function createSolanaSigner(
  privateKey: string | Uint8Array,
): TurboSolanaSigner {
  return new TurboSolanaSigner(privateKey);
}
