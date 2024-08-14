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
  serializeTags,
  streamSigner,
} from 'arbundles';
import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';

import { TurboDataItemAbstractSigner } from '../common/signer.js';
import {
  DataItemOptions,
  StreamSizeFactory,
  TurboDataItemSignerParams,
} from '../types.js';
import { fromB64Url } from '../utils/base64.js';

/**
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner };

/**
 * Node implementation of TurboDataItemSigner.
 */
export class TurboNodeSigner extends TurboDataItemAbstractSigner {
  constructor(p: TurboDataItemSignerParams) {
    super(p);
  }

  async signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
  }: {
    fileStreamFactory: () => Readable;
    fileSizeFactory: StreamSizeFactory;
    dataItemOpts?: DataItemOptions;
  }): Promise<{
    dataItemStreamFactory: () => Readable;
    dataItemSizeFactory: StreamSizeFactory;
  }> {
    // TODO: replace with our own signer implementation
    this.logger.debug('Signing data item...');
    const [stream1, stream2] = [fileStreamFactory(), fileStreamFactory()];
    const signedDataItem = await streamSigner(
      stream1,
      stream2,
      this.signer,
      dataItemOpts,
    );
    this.logger.debug('Successfully signed data item...');

    // TODO: support target, anchor, and tags
    const signedDataItemSize = this.calculateSignedDataHeadersSize({
      dataSize: fileSizeFactory(),
      dataItemOpts,
    });
    return {
      dataItemStreamFactory: () => signedDataItem,
      dataItemSizeFactory: () => signedDataItemSize,
    };
  }

  // TODO: make dynamic that accepts anchor and target and tags to return the size of the headers + data
  // reference https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md#13-dataitem-format
  private calculateSignedDataHeadersSize({
    dataSize,
    dataItemOpts,
  }: {
    dataSize: number;
    dataItemOpts?: DataItemOptions;
  }) {
    const { tags, anchor, target } = dataItemOpts ?? {};

    // ref: https://github.com/Irys-xyz/arbundles/blob/master/src/ar-data-create.ts#L18

    const _target = typeof target === 'string' ? fromB64Url(target) : null;
    const targetLength = 1 + (_target ? _target.byteLength : 0);
    const _anchor = typeof anchor === 'string' ? Buffer.from(anchor) : null;
    const anchorLength = 1 + (_anchor ? _anchor.byteLength : 0);

    const serializedTags = tags && tags.length > 0 ? serializeTags(tags) : null;
    const tagsLength = 16 + (serializedTags ? serializedTags.byteLength : 0);

    const { ownerLength, signatureLength } = this.sigConfig;

    const signatureTypeLength = 2;

    return [
      anchorLength,
      targetLength,
      tagsLength,
      signatureLength,
      ownerLength,
      signatureTypeLength,
      dataSize,
    ].reduce((totalSize, currentSize) => (totalSize += currentSize));
  }
}
