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
import { Readable } from 'node:stream';

import { JWKInterface } from '../types/arweave.js';
import { TurboDataItemSigner } from '../types/turbo.js';

export class TurboNodeDataItemSigner implements TurboDataItemSigner {
  protected axios: AxiosInstance;
  protected privateKey: JWKInterface;

  // TODO: replace with internal signer class
  constructor({ privateKey }: { privateKey: JWKInterface }) {
    this.privateKey = privateKey;
  }

  signDataItem({
    fileStreamFactory,
  }: {
    fileStreamFactory: () => Readable;
  }): Promise<Readable> {
    const signer = new ArweaveSigner(this.privateKey);
    const [stream1, stream2] = [fileStreamFactory(), fileStreamFactory()];
    return streamSigner(stream1, stream2, signer);
  }
}
