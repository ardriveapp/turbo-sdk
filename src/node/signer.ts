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
import { ArweaveSigner, streamSigner } from 'arbundles';
import Arweave from 'arweave/node/index.js';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

import { JWKInterface } from '../common/jwk.js';
import { StreamSizeFactory, TurboWalletSigner } from '../types.js';
import { toB64Url } from '../utils/base64.js';

export class TurboNodeArweaveSigner implements TurboWalletSigner {
  protected privateKey: JWKInterface;
  protected signer: ArweaveSigner; // TODO: replace with internal signer class

  // TODO: replace with internal signer class
  constructor({ privateKey }: { privateKey: JWKInterface }) {
    this.privateKey = privateKey;
    this.signer = new ArweaveSigner(this.privateKey);
  }

  async signDataItem({
    fileStreamFactory,
    fileSizeFactory,
  }: {
    fileStreamFactory: () => Readable;
    fileSizeFactory: StreamSizeFactory;
  }): Promise<{
    dataItemStreamFactory: () => Readable;
    dataItemSizeFactory: StreamSizeFactory;
  }> {
    // TODO: replace with our own signer implementation
    const [stream1, stream2] = [fileStreamFactory(), fileStreamFactory()];
    const signedDataItem = await streamSigner(stream1, stream2, this.signer);
    // TODO: support target, anchor, and tags
    const signedDataItemSize = this.calculateSignedDataHeadersSize({
      dataSize: fileSizeFactory(),
    });
    return {
      dataItemStreamFactory: () => signedDataItem,
      dataItemSizeFactory: () => signedDataItemSize,
    };
  }

  // NOTE: this might be better in a parent class or elsewhere - easy enough to leave in here now and does require specific environment version of crypto
  async generateSignedRequestHeaders() {
    const nonce = randomBytes(16).toString('hex');
    const buffer = Buffer.from(nonce);
    const signature = await Arweave.crypto.sign(this.privateKey, buffer);

    return {
      'x-public-key': this.privateKey.n,
      'x-nonce': nonce,
      'x-signature': toB64Url(Buffer.from(signature)),
    };
  }

  // TODO: make dynamic that accepts anchor and target and tags to return the size of the headers + data
  // reference https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md#13-dataitem-format
  private calculateSignedDataHeadersSize({ dataSize }: { dataSize: number }) {
    const anchor = 1; // + whatever they provide (max of 33)
    const target = 1; // + whatever they provide (max of 33)
    const tags = 0;
    const signatureLength = 512;
    const ownerLength = 512;
    const signatureTypeLength = 2;
    const numOfTagsLength = 8; // https://github.com/Bundlr-Network/arbundles/blob/master/src/tags.ts#L191-L198
    const numOfTagsBytesLength = 8;
    return [
      anchor,
      target,
      tags,
      signatureLength,
      ownerLength,
      signatureTypeLength,
      numOfTagsLength,
      numOfTagsBytesLength,
      dataSize,
    ].reduce((totalSize, currentSize) => (totalSize += currentSize));
  }
}
