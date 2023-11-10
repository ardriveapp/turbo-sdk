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
import { ArweaveSigner, createData } from 'arbundles';
import Arweave from 'arweave';
import { randomBytes } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import { JWKInterface } from '../common/jwk.js';
import { StreamSizeFactory, TurboLogger, TurboWalletSigner } from '../types.js';
import { toB64Url } from '../utils/base64.js';
import { readableStreamToBuffer } from '../utils/readableStream.js';

export class TurboWebArweaveSigner implements TurboWalletSigner {
  protected privateKey: JWKInterface;
  protected signer: ArweaveSigner; // TODO: replace with internal signer class
  protected logger: TurboLogger;
  constructor({
    privateKey,
    logger,
  }: {
    privateKey: JWKInterface;
    logger: TurboLogger;
  }) {
    this.privateKey = privateKey;
    this.logger = logger;
    this.signer = new ArweaveSigner(this.privateKey);
  }

  async signDataItem({
    fileStreamFactory,
    fileSizeFactory,
  }: {
    fileStreamFactory: () => ReadableStream;
    fileSizeFactory: StreamSizeFactory;
  }): Promise<{
    // TODO: axios only supports Readable's, Buffer's, or Blob's in request bodies, so we need to convert the ReadableStream to a Buffer
    dataItemStreamFactory: () => Buffer;
    dataItemSizeFactory: StreamSizeFactory;
  }> {
    // TODO: converts the readable stream to a buffer bc incrementally signing ReadableStreams is not trivial
    const buffer = await readableStreamToBuffer({
      stream: fileStreamFactory(),
      size: fileSizeFactory(),
    });
    this.logger.debug('Signing data item...');
    // TODO: support target, anchor and tags for upload
    const signedDataItem = createData(buffer, this.signer, {});
    await signedDataItem.sign(this.signer);
    this.logger.debug('Successfully signed data item...');
    return {
      // while this returns a Buffer - it needs to match our return type for uploading
      dataItemStreamFactory: () => signedDataItem.getRaw(),
      dataItemSizeFactory: () => signedDataItem.getRaw().length,
    };
  }

  // NOTE: this might be better in a parent class or elsewhere - easy enough to leave in here now and does require specific environment version of crypto
  async generateSignedRequestHeaders() {
    // a bit hacky - but arweave exports cause issues in tests vs. browser
    const arweave: Arweave = (Arweave as any).default ?? Arweave;
    const nonce = randomBytes(16).toString('hex');
    const buffer = Buffer.from(nonce);
    const signature = await arweave.crypto.sign(this.privateKey, buffer, {});

    return {
      'x-public-key': this.privateKey.n,
      'x-nonce': nonce,
      'x-signature': toB64Url(Buffer.from(signature)),
    };
  }
}
