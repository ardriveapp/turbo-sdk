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
import { randomBytes } from 'node:crypto';
import { ReadableStream } from 'node:stream/web';

import { JWKInterface } from '../types/arweave.js';
import { TurboWalletSigner } from '../types/turbo.js';
import { toB64Url } from '../utils/base64.js';
import { readableStreamToBuffer } from '../utils/readableStream.js';

export class TurboWebArweaveSigner implements TurboWalletSigner {
  protected signer: ArweaveSigner;
  protected privateKey: JWKInterface;

  constructor({ privateKey }: { privateKey: JWKInterface }) {
    this.signer = new ArweaveSigner(privateKey);
  }

  async signDataItem({
    fileStreamFactory,
  }: {
    fileStreamFactory: () => ReadableStream;
  }): Promise<Buffer> {
    // TODO: converts the readable stream to a buffer bc incrementally signing ReadableStreams is not trivial
    const buffer = await readableStreamToBuffer({
      stream: fileStreamFactory(),
    });
    const dataItem = createData(buffer, this.signer);
    await dataItem.sign(this.signer);
    return dataItem.getRaw();
  }

  async generateSignedRequestHeaders() {
    const { default: arweave } = await import('arweave/web/index.js');
    // TODO: we could move this to a class separate function
    const nonce = randomBytes(16).toString('hex');
    const buffer = Buffer.from(nonce);
    const signature = await arweave.default.crypto.sign(
      this.privateKey,
      buffer,
    );

    return {
      'x-public-key': this.privateKey.n,
      'x-nonce': nonce,
      'x-signature': toB64Url(Buffer.from(signature)),
    };
  }
}
