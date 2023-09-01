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
import { Readable } from 'stream';

import { JWKInterface } from '../types/arweave.js';
import { TurboDataItemSigner, TurboFileFactory } from '../types/turbo.js';
import { UnauthenticatedRequestError } from '../utils/errors.js';

export class TurboNodeDataItemSigner implements TurboDataItemSigner {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface | undefined; // TODO: break into separate classes

  constructor({ privateKey }: { privateKey?: JWKInterface } = {}) {
    this.privateKey = privateKey;
  }

  signDataItems({
    fileStreamGenerators,
  }: Omit<TurboFileFactory, 'fileStreamGenerators'> & {
    fileStreamGenerators: (() => Readable)[];
  }): Promise<Readable>[] {
    // TODO: break this into separate classes
    if (!this.privateKey) {
      throw new UnauthenticatedRequestError();
    }

    const signer = new ArweaveSigner(this.privateKey);

    // these are technically PassThrough's which are subclasses of streams
    const signedDataItemPromises = fileStreamGenerators.map(
      (fileStreamGenerators) => {
        const [stream1, stream2] = [
          fileStreamGenerators(),
          fileStreamGenerators(),
        ];
        // TODO: this will not work with BDIs as is, we may need to add an additional stream signer
        return streamSigner(stream1, stream2, signer);
      },
    );
    return signedDataItemPromises;
  }
}
