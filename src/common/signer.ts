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
import { Secp256k1 } from '@cosmjs/crypto';
import { toBase64 } from '@cosmjs/encoding';
import { EthereumSigner, HexSolanaSigner } from '@dha-team/arbundles';
import { Signer as ArbundleSigner } from '@dha-team/arbundles';
import { computePublicKey } from '@ethersproject/signing-key';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import bs58 from 'bs58';
import { randomBytes } from 'crypto';
import { Wallet as EthereumWallet, ethers, parseEther } from 'ethers';
import { computeAddress } from 'ethers';
import nacl from 'tweetnacl';
import { type EIP1193Provider, createWalletClient, custom, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { Signer as x402Signer } from 'x402-fetch';

import {
  FileStreamFactory,
  NativeAddress,
  SendTxWithSignerParams,
  TokenType,
  TurboDataItemSigner,
  TurboDataItemSignerParams,
  TurboFileFactory,
  TurboLogger,
  TurboSignedDataItemFactory,
  TurboSigner,
  WalletAdapter,
  isEthereumWalletAdapter,
  isSolanaWalletAdapter,
} from '../types.js';
import {
  fromB64Url,
  ownerToAddress as ownerToB64Address,
  toB64Url,
} from '../utils/base64.js';
import { Logger } from './logger.js';
import { ethDataFromTurboCreditDestinationAddress } from './token/ethereum.js';
import { memoProgramId } from './token/solana.js';

/**
 * Abstract class for signing TurboDataItems.
 */
export abstract class TurboDataItemAbstractSigner
  implements TurboDataItemSigner
{
  public signer: TurboSigner;
  public walletAdapter: WalletAdapter | undefined;

  protected logger: TurboLogger;
  protected token: TokenType;

  constructor({
    signer,
    logger = Logger.default,
    token,
    walletAdapter,
  }: TurboDataItemSignerParams) {
    this.logger = logger;
    this.signer = signer;
    this.token = token;
    this.walletAdapter = walletAdapter;
  }

  abstract signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
    emitter,
  }: TurboFileFactory<FileStreamFactory>): Promise<TurboSignedDataItemFactory>;

  private ownerToNativeAddress(owner: string, token: TokenType): NativeAddress {
    switch (token) {
      case 'solana':
        return bs58.encode(Uint8Array.from(fromB64Url(owner)));

      case 'ethereum':
      case 'matic':
      case 'pol':
      case 'base-eth':
      case 'usdc':
      case 'base-usdc':
      case 'polygon-usdc':
        return computeAddress(computePublicKey(fromB64Url(owner)));

      case 'kyve':
        return pubkeyToAddress(
          {
            type: 'tendermint/PubKeySecp256k1',
            value: toBase64(
              Secp256k1.compressPubkey(Uint8Array.from(fromB64Url(owner))),
            ),
          },
          'kyve',
        );

      case 'arweave':
      case 'ario':
        return ownerToB64Address(owner);
    }
  }

  public async generateSignedRequestHeaders() {
    const nonce = randomBytes(16).toString('hex');
    const buffer = Buffer.from(nonce);
    const signature = await this.signer.sign(Uint8Array.from(buffer));
    const publicKey = toB64Url(this.signer.publicKey);
    return {
      'x-public-key': publicKey,
      'x-nonce': nonce,
      'x-signature': toB64Url(Buffer.from(signature)),
    };
  }

  public async getPublicKey(): Promise<Buffer> {
    return this.signer.publicKey;
  }

  public async getNativeAddress(): Promise<NativeAddress> {
    return this.ownerToNativeAddress(
      toB64Url(await this.getPublicKey()),
      this.token,
    );
  }

  /** Let the signer handle sending tx for better compat with cross chain libraries/web wallets */
  public async sendTransaction({
    target,
    amount,
    gatewayUrl,
    turboCreditDestinationAddress,
  }: SendTxWithSignerParams): Promise<string> {
    if (this.walletAdapter) {
      if (isSolanaWalletAdapter(this.walletAdapter)) {
        const connection = new Connection(gatewayUrl, 'confirmed');

        const publicKey = new PublicKey(
          this.walletAdapter.publicKey.toString(),
        );
        const tx = new Transaction({
          feePayer: publicKey,
          ...(await connection.getLatestBlockhash()),
        });

        tx.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(target),
            lamports: +new BigNumber(amount),
          }),
        );

        if (turboCreditDestinationAddress !== undefined) {
          tx.add(
            new TransactionInstruction({
              programId: new PublicKey(memoProgramId),
              keys: [],
              data: Buffer.from(
                'turboCreditDestinationAddress=' +
                  turboCreditDestinationAddress,
              ),
            }),
          );
        }

        const signedTx = await this.walletAdapter.signTransaction(tx);
        const id = await connection.sendRawTransaction(signedTx.serialize());
        return id;
      }
      if (!isEthereumWalletAdapter(this.walletAdapter)) {
        throw new Error(
          'Unsupported wallet adapter -- must implement getSigner',
        );
      }
      const signer = this.walletAdapter.getSigner();
      if (signer.sendTransaction === undefined) {
        throw new Error(
          'Unsupported wallet adapter -- getSigner must return a signer with sendTransaction API for crypto funds transfer',
        );
      }

      const { hash } = await signer.sendTransaction({
        to: target,
        value: parseEther(amount.toFixed(18)),
        data: ethDataFromTurboCreditDestinationAddress(
          turboCreditDestinationAddress,
        ),
      });
      return hash;
    }

    if (!(this.signer instanceof EthereumSigner)) {
      throw new Error(
        'Only EthereumSigner is supported for sendTransaction API currently!',
      );
    }
    const keyAsStringFromUint8Array = Buffer.from(this.signer.key).toString(
      'hex',
    );

    const provider = new ethers.JsonRpcProvider(gatewayUrl);
    const ethWalletAndProvider = new EthereumWallet(
      keyAsStringFromUint8Array,
      provider,
    );

    const tx = await ethWalletAndProvider.sendTransaction({
      to: target,
      value: parseEther(amount.toFixed(18)),
      data: ethDataFromTurboCreditDestinationAddress(
        turboCreditDestinationAddress,
      ),
    });
    this.logger.debug('Sent transaction', { tx });

    return tx.hash;
  }

  public async signData(dataToSign: Uint8Array): Promise<Uint8Array> {
    if (this.signer instanceof HexSolanaSigner) {
      const privateKey = this.signer.key;
      const publicKey = Uint8Array.from(await this.getPublicKey());

      // Concatenate the private and public keys correctly
      const combinedKey = new Uint8Array(privateKey.length + publicKey.length);
      combinedKey.set(privateKey);
      combinedKey.set(publicKey, privateKey.length);

      const signature = nacl.sign.detached(dataToSign, combinedKey);
      return signature;
    }

    return this.signer.sign(dataToSign);
  }
}

export async function makeX402Signer(
  arbundlesSigner: ArbundleSigner,
): Promise<x402Signer> {
  // Node: our SDK uses EthereumSigner with a raw private key
  if (arbundlesSigner instanceof EthereumSigner) {
    return createWalletClient({
      account: privateKeyToAccount(
        ('0x' +
          Buffer.from(arbundlesSigner.key).toString('hex')) as `0x${string}`,
      ),
      chain: baseSepolia,
      transport: http(),
    }) as unknown as x402Signer;
  }

  // Browser: use injected wallet + selected account
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = (window as any).ethereum as EIP1193Provider;

    // ask wallet for an account
    const accounts = (await provider.request({
      method: 'eth_requestAccounts',
    })) as `0x${string}`[];

    if (accounts === undefined || accounts.length === 0) {
      throw new Error('No accounts returned from wallet');
    }

    const account = accounts[0];

    return createWalletClient({
      account,
      chain: baseSepolia,
      transport: custom(provider),
    }) as unknown as x402Signer;
  }

  throw new Error('Unable to construct x402 signer for x402 options');
}
