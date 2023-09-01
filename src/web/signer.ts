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
import { TurboDataItemSigner, TurboFileFactory } from '../types/turbo.js';
import { readableStreamToBuffer } from '../utils/readableStream.js';

export class TurboWebDataItemSigner implements TurboDataItemSigner {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface;

  constructor({ privateKey }: { privateKey: JWKInterface }) {
    this.privateKey = privateKey;
  }

  signDataItems({
    fileStreamGenerators,
  }: Omit<TurboFileFactory, 'fileStreamGenerators'> & {
    fileStreamGenerators: (() => ReadableStream)[];
  }): Promise<Buffer>[] {
    const signer = new ArweaveSigner(this.privateKey);

    const signedDataItemPromises = fileStreamGenerators.map(
      async (streamGenerator: () => ReadableStream) => {
        // Convert the readable stream to a buffer
        const buffer = await readableStreamToBuffer({
          stream: streamGenerator(),
        });
        const dataItem = createData(buffer, signer);
        await dataItem.sign(signer);
        return dataItem.getRaw();
      },
    );

    return signedDataItemPromises;
  }
}
