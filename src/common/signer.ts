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
import { ArconnectSigner, ArweaveSigner } from 'arbundles';
import { randomBytes } from 'crypto';

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
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner };

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
    return this.signer.sign(dataToSign);
  }
}
