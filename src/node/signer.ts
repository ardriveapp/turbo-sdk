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
import { JWKInterface, serializeTags, streamSigner } from 'arbundles';
import Arweave from 'arweave';
import { BigNumber } from 'bignumber.js';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';

import {
  DataItemOptions,
  SendFundTxParams,
  StreamSizeFactory,
  TurboDataItemSigner,
  TurboDataItemSignerParams,
  TurboLogger,
  TurboSigner,
  TurboTx,
} from '../types.js';
import { fromB64Url, toB64Url } from '../utils/base64.js';

export class TurboNodeArweaveSigner implements TurboDataItemSigner {
  protected privateKey?: JWKInterface;
  protected signer: TurboSigner;
  protected logger: TurboLogger;
  protected arweave: Arweave;

  constructor({
    signer,
    logger,
    privateKey,
    gatewayUrl = 'https://arweave.net',
  }: TurboDataItemSignerParams) {
    this.logger = logger;
    this.signer = signer;
    this.privateKey = privateKey;
    this.arweave = Arweave.init({
      host: gatewayUrl,
      port: 443,
      protocol: 'https',
    });
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

  // NOTE: this might be better in a parent class or elsewhere - easy enough to leave in here now and does require specific environment version of crypto
  async generateSignedRequestHeaders() {
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

    // Arweave sig and owner length is 512 bytes
    const signatureLength = 512;
    const ownerLength = 512;
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

  async sendFundTx({
    tokenAmount,
    target,
    feeMultiplier = 1,
  }: SendFundTxParams): Promise<TurboTx> {
    this.logger.debug('Creating fund transaction...', {
      tokenAmount: tokenAmount.toString(),
      target,
      feeMultiplier,
    });

    const fundTx = await this.arweave.createTransaction(
      {
        target,
        quantity: tokenAmount.toString(),
      },
      this.privateKey,
    );

    if (feeMultiplier !== 1) {
      fundTx.reward = BigNumber(fundTx.reward)
        .times(new BigNumber(feeMultiplier))
        .toFixed(0, BigNumber.ROUND_UP);
    }

    await this.arweave.transactions.sign(fundTx, this.privateKey);
    const response = await this.arweave.transactions.post(fundTx);

    if (response.status !== 200) {
      throw new Error('Failed to post fund transaction');
    }

    this.logger.debug('Posted fund transaction...', { fundTx });
    return { transaction: fundTx, transactionId: fundTx.id };
  }
}
