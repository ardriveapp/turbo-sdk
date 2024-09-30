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
import { computePublicKey } from '@ethersproject/signing-key';
import { KyveSDK } from '@kyvejs/sdk/dist/sdk.js';
import bs58 from 'bs58';
import { randomBytes } from 'crypto';
import { Wallet as EthereumWallet, ethers, parseEther } from 'ethers';
import { computeAddress } from 'ethers';
import { Buffer } from 'node:buffer';
import nacl from 'tweetnacl';

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
} from '../types.js';
import {
  fromB64Url,
  ownerToAddress as ownerToB64Address,
  toB64Url,
} from '../utils/base64.js';
import { TurboWinstonLogger } from './logger.js';

/**
 * Abstract class for signing TurboDataItems.
 */
export abstract class TurboDataItemAbstractSigner
  implements TurboDataItemSigner
{
  abstract signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
  }: TurboFileFactory<FileStreamFactory>): Promise<TurboSignedDataItemFactory>;

  protected logger: TurboLogger;
  protected signer: TurboSigner;
  protected token: TokenType;
  protected walletAdapter: WalletAdapter | undefined;

  constructor({
    signer,
    logger = TurboWinstonLogger.default,
    token,
    walletAdapter,
  }: TurboDataItemSignerParams) {
    this.logger = logger;
    this.signer = signer;
    this.token = token;
    this.walletAdapter = walletAdapter;
  }

  private ownerToNativeAddress(owner: string, token: TokenType): NativeAddress {
    switch (token) {
      case 'solana':
        return bs58.encode(fromB64Url(owner));

      case 'ethereum':
      case 'matic':
      case 'pol':
        return computeAddress(computePublicKey(fromB64Url(owner)));

      case 'kyve':
        return pubkeyToAddress(
          {
            type: 'tendermint/PubKeySecp256k1',
            value: toBase64(Secp256k1.compressPubkey(fromB64Url(owner))),
          },
          'kyve',
        );

      case 'arweave':
      default:
        return ownerToB64Address(owner);
    }
  }

  public async generateSignedRequestHeaders() {
    const nonce = randomBytes(16).toString('hex');
    const buffer = Buffer.from(nonce);
    const signature = await this.signer.sign(buffer);
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
  }: SendTxWithSignerParams): Promise<string> {
    if (this.walletAdapter) {
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

    if (this.token === 'kyve') {
      const chainId = gatewayUrl.includes('kaon')
        ? 'kaon-1'
        : gatewayUrl.includes('korellia')
        ? 'korellia-2'
        : 'kyve-1';

      // TODO: KYVE Web wallet tx signing/sending
      const client = await new KyveSDK(chainId).fromPrivateKey(
        keyAsStringFromUint8Array,
      );

      const tx = await client.kyve.base.v1beta1.transfer(
        target,
        amount.toString(),
      );
      await tx.execute();

      return tx.txHash;
    }

    // TODO: ETH Web wallet tx signing/sending
    const provider = new ethers.JsonRpcProvider(gatewayUrl);
    const ethWalletAndProvider = new EthereumWallet(
      keyAsStringFromUint8Array,
      provider,
    );

    const tx = await ethWalletAndProvider.sendTransaction({
      to: target,
      value: parseEther(amount.toFixed(18)),
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
