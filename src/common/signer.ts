/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import {
  EthereumSigner,
  HexInjectedSolanaSigner,
  HexSolanaSigner,
} from 'arbundles';
import { randomBytes } from 'crypto';
import nacl from 'tweetnacl';

import {
  FileStreamFactory,
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

  constructor({ signer, logger }: TurboDataItemSignerParams) {
    this.logger = logger;
    this.signer = signer;
  }

  protected get sigConfig(): { ownerLength: number; signatureLength: number } {
    if (this.signer instanceof EthereumSigner) {
      return {
        signatureLength: 65,
        ownerLength: 65,
      };
    }
    if (this.signer instanceof HexSolanaSigner) {
      return {
        signatureLength: 64,
        ownerLength: 32,
      };
    }

    // base case, arweave/arconnect signer
    return {
      ownerLength: 512,
      signatureLength: 512,
    };
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
