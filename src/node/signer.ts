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
import { PassThrough, Readable } from 'stream';

import { JWKInterface } from '../types/arweave.js';
import { TurboDataItemSigner } from '../types/turbo.js';

export class TurboNodeDataItemSigner implements TurboDataItemSigner {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface;

  constructor({ privateKey }: { privateKey: JWKInterface }) {
    this.privateKey = privateKey;
  }

  signDataItems({
    fileStreamGenerator,
    bundle = false, // TODO: add bundle param to allow for creating BDI of data items
  }: {
    fileStreamGenerator: (() => Readable)[];
    bundle?: boolean;
  }): Promise<PassThrough>[] {
    if (bundle) {
      throw new Error('Not implemented!');
    }

    const signer = new ArweaveSigner(this.privateKey);

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
