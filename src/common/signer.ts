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
import { KyveSDK } from '@kyvejs/sdk/dist/sdk.js';
import { EthereumSigner, HexSolanaSigner } from 'arbundles';
import { randomBytes } from 'crypto';
import { Wallet as EthereumWallet, ethers, parseEther } from 'ethers';
import { Buffer } from 'node:buffer';
import nacl from 'tweetnacl';

import {
  FileStreamFactory,
  SendTxWithSignerParams,
  TokenType,
  TurboDataItemSigner,
  TurboDataItemSignerParams,
  TurboFileFactory,
  TurboLogger,
  TurboSignedDataItemFactory,
  TurboSigner,
} from '../types.js';
import { toB64Url } from '../utils/base64.js';

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

  constructor({ signer, logger, token }: TurboDataItemSignerParams) {
    this.logger = logger;
    this.signer = signer;
    this.token = token;
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

  /** Let the signer handle sending tx for better compat with cross chain libraries/web wallets */
  public async sendTransaction({
    target,
    amount,
    gatewayUrl,
  }: SendTxWithSignerParams): Promise<string> {
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
