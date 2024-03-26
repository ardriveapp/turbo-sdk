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
import { randomBytes } from 'crypto';

import {
  ArweaveTx,
  FileStreamFactory,
  TurboDataItemSigner,
  TurboDataItemSignerParams,
  TurboFileFactory,
  TurboLogger,
  TurboSignedDataItemFactory,
  TurboSigner,
} from '../types.js';
import { sha256B64Url, toB64Url } from '../utils/base64.js';

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

  public async signTx<T extends ArweaveTx>(tx: T): Promise<T> {
    this.logger.debug('Signing  transaction...', {
      tx,
    });

    const publicKey = toB64Url(this.signer.publicKey);

    tx.setOwner(publicKey);

    const dataToSign = await tx.getSignatureData();
    const signatureBuffer = Buffer.from(await this.signer.sign(dataToSign));
    const id = sha256B64Url(signatureBuffer);

    tx.setSignature({
      id: id,
      owner: toB64Url(this.signer.publicKey),
      signature: toB64Url(signatureBuffer),
    });

    return tx;
  }
}
