/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  ArconnectSigner,
  ArweaveSigner,
  DataItemCreateOptions,
  EthereumSigner,
  HexSolanaSigner,
  InjectedEthereumSigner,
  Signer,
  createData,
  deepHash,
  stringToBuffer,
} from '@dha-team/arbundles';

import { TurboEventEmitter } from '../common/events.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import {
  TurboDataItemSignerParams,
  TurboSignedDataItemFactory,
  TurboSignedRequestHeaders,
  WebTurboFileFactory,
} from '../types.js';
import { createUint8ArrayReadableStreamFactory } from '../utils/readableStream.js';

/**
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner };

export type DeepHashChunk = Uint8Array | AsyncIterable<Buffer> | DeepHashChunks;
export type DeepHashChunks = DeepHashChunk[];

/**
 * Web implementation of TurboDataItemSigner.
 */
export class TurboWebArweaveSigner extends TurboDataItemAbstractSigner {
  constructor(p: TurboDataItemSignerParams) {
    super(p);
  }

  private async setPublicKey() {
    // for arconnect, we need to make sure we have the public key before create data
    if (
      this.signer.publicKey === undefined &&
      (this.signer instanceof ArconnectSigner ||
        this.signer instanceof InjectedEthereumSigner)
    ) {
      await this.signer.setPublicKey();
    }
  }

  public async getPublicKey(): Promise<Buffer> {
    await this.setPublicKey();
    return super.getPublicKey();
  }

  public async signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
    emitter,
  }: WebTurboFileFactory): Promise<TurboSignedDataItemFactory> {
    await this.setPublicKey();

    // Create signing emitter if events are provided
    const fileSize = fileSizeFactory();
    this.logger.debug('Signing data item...');

    const { signedDataItemFactory, signedDataItemSize } =
      await streamSignerReadableStream({
        streamFactory: createUint8ArrayReadableStreamFactory({
          data: fileStreamFactory(),
        }),
        signer: this.signer,
        dataItemOpts,
        fileSize,
        emitter,
      });

    this.logger.debug('Successfully signed data item...');
    return {
      dataItemStreamFactory: signedDataItemFactory,
      dataItemSizeFactory: () => signedDataItemSize,
    };
  }

  public async generateSignedRequestHeaders(): Promise<TurboSignedRequestHeaders> {
    await this.setPublicKey();
    return super.generateSignedRequestHeaders();
  }

  public async signData(dataToSign: Uint8Array): Promise<Uint8Array> {
    await this.setPublicKey();
    return super.signData(dataToSign);
  }
}

export const readableStreamToAsyncIterable = (
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<Buffer> => ({
  async *[Symbol.asyncIterator]() {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value !== undefined) yield Buffer.from(value);
      }
    } finally {
      reader.releaseLock();
    }
  },
});

export async function streamSignerReadableStream({
  streamFactory,
  signer,
  dataItemOpts,
  fileSize,
  emitter,
}: {
  streamFactory: () => ReadableStream<Uint8Array>;
  signer: Signer;
  dataItemOpts?: DataItemCreateOptions;
  fileSize: number;
  emitter?: TurboEventEmitter;
}): Promise<{
  signedDataItemFactory: () => ReadableStream<Uint8Array>;
  signedDataItemSize: number;
}> {
  try {
    const header = createData('', signer, dataItemOpts);

    const totalDataItemSizeWithHeader = fileSize + header.getRaw().byteLength;

    const [stream1, stream2] = streamFactory().tee();
    const reader1 = stream1.getReader();
    let bytesProcessed = 0;
    const eventingStream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader1.read();
        if (done) {
          controller.close();
          return;
        }
        bytesProcessed += value.byteLength;
        controller.enqueue(value);

        emitter?.emit('signing-progress', {
          processedBytes: bytesProcessed,
          totalBytes: totalDataItemSizeWithHeader,
        });
      },
      cancel() {
        reader1.cancel();
      },
    });

    // create a readable that emits signing events as bytes are pulled through using the first stream from .tee()
    const asyncIterableReadableStream =
      readableStreamToAsyncIterable(eventingStream);

    // provide that ReadableStream with events to deep hash, so as it pulls bytes through events get emitted
    const parts = [
      stringToBuffer('dataitem'),
      stringToBuffer('1'),
      stringToBuffer(header.signatureType.toString()),
      Uint8Array.from(header.rawOwner),
      Uint8Array.from(header.rawTarget),
      Uint8Array.from(header.rawAnchor),
      Uint8Array.from(header.rawTags),
      asyncIterableReadableStream,
    ];

    const hash = await deepHash(parts);
    const sigBytes = Buffer.from(await signer.sign(hash));
    emitter?.emit('signing-success');
    header.setSignature(sigBytes);
    const headerBytes = header.getRaw();

    const signedDataItemFactory = () => {
      const reader = stream2.getReader();

      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Uint8Array.from(headerBytes));
          bytesProcessed += headerBytes.byteLength;
        },
        async pull(controller) {
          try {
            const { done, value } = await reader.read();

            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
          } catch (error) {
            controller.error(error);
          }
        },
        cancel() {
          reader.cancel();
        },
      });
    };

    return {
      signedDataItemSize: totalDataItemSizeWithHeader,
      signedDataItemFactory,
    };
  } catch (error) {
    emitter?.emit('signing-error', error);
    throw error;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAsyncIterable(data: any): data is AsyncIterable<Uint8Array> {
  return (
    typeof data[Symbol.asyncIterator as keyof AsyncIterable<Uint8Array>] ===
    'function'
  );
}
