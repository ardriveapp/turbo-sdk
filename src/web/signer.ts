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
  ArconnectSigner,
  ArweaveSigner,
  DataItem,
  EthereumSigner,
  HexSolanaSigner,
  InjectedEthereumSigner,
  createData,
} from '@dha-team/arbundles';

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
      (this.signer instanceof ArconnectSigner ||
        this.signer instanceof InjectedEthereumSigner)
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

    const fileStream = fileStreamFactory();

    // TODO: converts the readable stream to a buffer bc incrementally signing ReadableStreams is not trivial
    const buffer =
      fileStream instanceof Buffer
        ? fileStream
        : await readableStreamToBuffer({
            stream: fileStream,
            size: fileSizeFactory(),
          });

    let signedDataItem: DataItem;
    this.logger.debug('Signing data item...');
    if (this.signer instanceof ArconnectSigner) {
      this.logger.debug(
        'Arconnect signer detected, signing with Arconnect signData Item API...',
      );
      const sign = Buffer.from(
        await this.signer['signer'].signDataItem({
          data: Uint8Array.from(buffer),
          tags: dataItemOpts?.tags,
          target: dataItemOpts?.target,
          anchor: dataItemOpts?.anchor,
        }),
      );
      signedDataItem = new DataItem(sign);
    } else {
      signedDataItem = createData(
        Uint8Array.from(buffer),
        this.signer,
        dataItemOpts,
      );
      await signedDataItem.sign(this.signer);
    }
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
