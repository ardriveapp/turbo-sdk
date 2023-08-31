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
import { AxiosInstance } from 'axios';
import crypto from 'crypto';
import jwkToPem from 'jwk-to-pem';
import { Readable } from 'stream';

import { JWKInterface } from '../types/arweave.js';
import {
  TurboDataItemSigner,
  TurboDataItemVerifier,
  TurboSignedDataItemFactory,
} from '../types/turbo.js';
import { UnauthenticatedRequestError } from '../utils/errors.js';

export class TurboNodeDataItemVerifier implements TurboDataItemVerifier {
  async verifySignedDataItems({
    dataItemGenerator,
    signature,
    publicKey,
  }: TurboSignedDataItemFactory): Promise<boolean> {
    const fullKey = {
      kty: 'RSA',
      e: 'AQAB',
      n: publicKey,
    };

    const pem = jwkToPem(fullKey);
    const verifiedDataItems: boolean[] = [];

    // TODO: do this in parallel
    for (const generateDataItem of dataItemGenerator) {
      const verify = crypto.createVerify('sha256');
      const signedDataItem = generateDataItem();
      signedDataItem.on('data', (chunk) => {
        verify.update(chunk);
      });
      signedDataItem.on('end', () => {
        const dataItemVerified = verify.verify(
          {
            key: pem,
            padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
          },
          signature,
        );
        verifiedDataItems.push(dataItemVerified);
      });
      signedDataItem.on('error', () => {
        verifiedDataItems.push(false);
      });
    }

    return verifiedDataItems.every((dataItem) => dataItem);
  }
}

export class TurboNodeDataItemSigner implements TurboDataItemSigner {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface | undefined; // TODO: break into separate classes

  constructor({ privateKey }: { privateKey?: JWKInterface } = {}) {
    this.privateKey = privateKey;
  }

  signDataItems({
    fileStreamGenerator,
    bundle = false, // TODO: add bundle param to allow for creating BDI of data items
  }: {
    fileStreamGenerator: (() => Readable)[];
    bundle?: boolean;
  }): Promise<Readable>[] {
    // TODO: break this into separate classes
    if (!this.privateKey) {
      throw new UnauthenticatedRequestError();
    }

    if (bundle) {
      throw new Error('Not implemented!');
    }

    const signer = new ArweaveSigner(this.privateKey);

    // these are technically PassThrough's which are subclasses of streams
    const signedDataItemPromises = fileStreamGenerator.map(
      (fileStreamGenerator) => {
        const [stream1, stream2] = [
          fileStreamGenerator(),
          fileStreamGenerator(),
        ];
        // TODO: this will not work with BDIs as is, we may need to add an additional stream signer
        return streamSigner(stream1, stream2, signer);
      },
    );
    return signedDataItemPromises;
  }
}
