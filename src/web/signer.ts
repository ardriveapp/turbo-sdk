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
import {
  ArconnectSigner,
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
  createData,
} from '@ar.io/arbundles';

import { TurboDataItemAbstractSigner } from '../common/signer.js';
import {
  StreamSizeFactory,
  TurboDataItemSignerParams,
  TurboSignedRequestHeaders,
  WebTurboFileFactory,
} from '../types.js';
import { readableStreamToBuffer } from '../utils/readableStream.js';

/**
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner };

/**
 * Web implementation of TurboDataItemSigner.
 */
export class TurboWebArweaveSigner extends TurboDataItemAbstractSigner {
  constructor(p: TurboDataItemSignerParams) {
    super(p);
  }

  private async setPublicKey() {
    // for arconnect, we need to make sure we have the public key before create data
    if (
      this.signer.publicKey === undefined &&
      this.signer instanceof ArconnectSigner
    ) {
      await this.signer.setPublicKey();
    }
  }

  public async getPublicKey(): Promise<Buffer> {
    await this.setPublicKey();
    return super.getPublicKey();
  }

  public async signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
  }: WebTurboFileFactory): Promise<{
    // TODO: axios only supports Readable's, Buffer's, or Blob's in request bodies, so we need to convert the ReadableStream to a Buffer
    dataItemStreamFactory: () => Buffer;
    dataItemSizeFactory: StreamSizeFactory;
  }> {
    await this.setPublicKey();

    // TODO: converts the readable stream to a buffer bc incrementally signing ReadableStreams is not trivial
    const buffer = await readableStreamToBuffer({
      stream: fileStreamFactory(),
      size: fileSizeFactory(),
    });

    this.logger.debug('Signing data item...');
    const signedDataItem = createData(buffer, this.signer, dataItemOpts);
    await signedDataItem.sign(this.signer);
    this.logger.debug('Successfully signed data item...');
    return {
      // while this returns a Buffer - it needs to match our return type for uploading
      dataItemStreamFactory: () => signedDataItem.getRaw(),
      dataItemSizeFactory: () => signedDataItem.getRaw().length,
    };
  }

  public async generateSignedRequestHeaders(): Promise<TurboSignedRequestHeaders> {
    await this.setPublicKey();
    return super.generateSignedRequestHeaders();
  }

  public async signData(dataToSign: Uint8Array): Promise<Uint8Array> {
    await this.setPublicKey();
    return super.signData(dataToSign);
  }
}
