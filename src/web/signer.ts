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
import { AxiosInstance } from 'axios';

import { JWKInterface } from '../types/arweave.js';
import { TurboDataItemSigner } from '../types/turbo.js';
import { readableStreamToBuffer } from '../utils/readableStream.js';

export class TurboWebDataItemSigner implements TurboDataItemSigner {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface;

  constructor({ privateKey }: { privateKey: JWKInterface }) {
    this.privateKey = privateKey;
  }

  signDataItems({
    fileStreamGenerator,
    bundle = false,
  }: {
    fileStreamGenerator: (() => ReadableStream)[];
    bundle?: boolean;
  }): Promise<Buffer>[] {
    if (bundle) {
      throw new Error('Not implemented!');
    }

    const signer = new ArweaveSigner(this.privateKey);

    const signedDataItemPromises = fileStreamGenerator.map(
      async (streamGenerator: () => ReadableStream) => {
        // Convert the readable stream to a Blob
        const buffer = await readableStreamToBuffer({
          stream: streamGenerator(),
        });
        const arrayBuffer = Uint8Array.from(buffer);
        // convert the blob to a Uint8Array
        const dataItem = createData(arrayBuffer, signer);
        await dataItem.sign(signer);
        return dataItem.getRaw();
      },
    );

    return signedDataItemPromises;
  }
}
