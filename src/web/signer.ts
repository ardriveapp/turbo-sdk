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
  concatBuffers,
  createData,
  stringToBuffer,
} from '@dha-team/arbundles';
import { createHash } from 'crypto';

import { TurboEventEmitter } from '../common/events.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import {
  TurboDataItemSignerParams,
  TurboSignedDataItemFactory,
  TurboSignedRequestHeaders,
  WebTurboFileFactory,
} from '../types.js';

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

    try {
      const fileStream = fileStreamFactory();

      // start with 0 progress
      emitter?.emit('signing-progress', {
        processedBytes: 0,
        totalBytes: fileSize,
      });
      this.logger.debug('Signing data item...');

      // Create the signature and header by processing the stream once
      const signedHeader = await this.createSignedHeader(
        {
          input: fileStream,
          signer: this.signer,
          fileSize,
          emitter,
        },
        dataItemOpts,
      );

      // emit completion event
      emitter?.emit('signing-success');

      this.logger.debug('Successfully signed data item...');
      return {
        // Return a factory that creates fresh signed streams by combining header with fresh data
        dataItemStreamFactory: () =>
          this.createSignedDataItemStream(signedHeader, fileStreamFactory()),
        dataItemSizeFactory: () => signedHeader.headerBytes.length + fileSize,
      };
    } catch (error) {
      // If we have a signing emitter, emit error
      // TODO: create a SigningError class and throw that instead of the generic Error
      emitter?.emit('signing-error', error);
      throw error;
    }
  }

  private async createSignedHeader(
    {
      input,
      signer,
      fileSize,
      emitter,
    }: {
      input: ReadableStream<Uint8Array> | Buffer;
      signer: Signer;
      fileSize: number;
      emitter?: TurboEventEmitter;
    },
    opts?: DataItemCreateOptions,
  ): Promise<{ headerBytes: Uint8Array }> {
    const header = createData('', signer, opts);

    const stream =
      input instanceof ReadableStream
        ? input
        : new ReadableStream({
            start(controller) {
              controller.enqueue(input);
              controller.close();
            },
          });

    const [s1, s2] = stream.tee();

    // Create a stream that emits signing progress
    let bytesProcessed = 0;
    const s1Reader = s1.getReader();
    const streamWithSigningEvents = new ReadableStream({
      async pull(controller) {
        const { done, value } = await s1Reader.read();
        if (done) {
          controller.close();
        } else {
          bytesProcessed += value.length;
          emitter?.emit('signing-progress', {
            totalBytes: fileSize,
            processedBytes: bytesProcessed,
          });
          controller.enqueue(value);
        }
      },
      cancel(reason) {
        emitter?.emit('signing-error', reason);
        s1Reader.cancel(reason);
      },
    });

    // Use the stream for hashing
    const parts: DeepHashChunk = [
      stringToBuffer('dataitem'),
      stringToBuffer('1'),
      stringToBuffer(header.signatureType.toString()),
      Uint8Array.from(header.rawOwner),
      Uint8Array.from(header.rawTarget),
      Uint8Array.from(header.rawAnchor),
      Uint8Array.from(header.rawTags),
      streamWithSigningEvents as unknown as DeepHashChunk,
    ];

    const hash = await deepHash(parts);
    const sigBytes = Buffer.from(await signer.sign(hash));
    header.setSignature(sigBytes);

    // Clean up s2 since we only needed it for the tee
    s2.getReader().cancel();

    return {
      headerBytes: Uint8Array.from(header.getRaw()),
    };
  }

  private createSignedDataItemStream(
    signedHeader: { headerBytes: Uint8Array },
    dataStream: ReadableStream | Buffer,
  ): ReadableStream {
    const stream =
      dataStream instanceof ReadableStream
        ? dataStream
        : new ReadableStream({
            start(controller) {
              controller.enqueue(dataStream);
              controller.close();
            },
          });

    const reader = stream.getReader();
    let headerSent = false;

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!headerSent) {
          controller.enqueue(signedHeader.headerBytes);
          headerSent = true;
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      },
      cancel() {
        reader.cancel();
      },
    });
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

export async function streamSigner(
  {
    input,
    signer,
    fileSize,
    emitter,
  }: {
    input: ReadableStream<Uint8Array> | Buffer;
    signer: Signer;
    fileSize: number;
    emitter?: TurboEventEmitter;
  },
  opts?: DataItemCreateOptions,
): Promise<{ stream: ReadableStream<Uint8Array>; size: number }> {
  const header = createData('', signer, opts);

  const stream =
    input instanceof ReadableStream
      ? input
      : new ReadableStream({
          start(controller) {
            controller.enqueue(input);
            controller.close();
          },
        });

  const [s1, s2] = stream.tee(); // Clone the input stream
  // create a readable that emits signing events as bytes are pulled through using the first stream from .tee()
  let bytesProcessed = 0;
  const s1Reader = s1.getReader();
  const streamWithSigningEvents = new ReadableStream({
    async pull(controller) {
      const { done, value } = await s1Reader.read();
      if (done) {
        emitter?.emit('signing-success');
        controller.close();
      } else {
        bytesProcessed += value.length;
        emitter?.emit('signing-progress', {
          totalBytes: fileSize,
          processedBytes: bytesProcessed,
        });
        controller.enqueue(value);
      }
    },
    cancel(reason) {
      emitter?.emit('signing-error', reason);
      s1Reader.cancel(reason);
    },
  });

  // provide that ReadableStream with events to deep hash, so as it pulls bytes through events get emitted
  const parts: DeepHashChunk = [
    stringToBuffer('dataitem'),
    stringToBuffer('1'),
    stringToBuffer(header.signatureType.toString()),
    Uint8Array.from(header.rawOwner),
    Uint8Array.from(header.rawTarget),
    Uint8Array.from(header.rawAnchor),
    Uint8Array.from(header.rawTags),
    streamWithSigningEvents as unknown as DeepHashChunk,
  ];

  const hash = await deepHash(parts);
  const sigBytes = Buffer.from(await signer.sign(hash));
  header.setSignature(sigBytes);
  const headerBytes = header.getRaw();

  // Stream headerBytes first, then the rest of s2
  const reader = s2.getReader();

  const dataItemStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(Uint8Array.from(headerBytes));
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel();
    },
  });

  return { stream: dataItemStream, size: headerBytes.length + fileSize };
}

export async function deepHash(
  data: DeepHashChunk | AsyncIterable<Uint8Array>,
): Promise<Uint8Array> {
  if (
    typeof data[Symbol.asyncIterator as keyof AsyncIterable<Uint8Array>] ===
    'function'
  ) {
    const _data = data as AsyncIterable<Uint8Array>;

    const context = createHash('sha384');

    let bytesProcessed = 0;

    for await (const chunk of _data) {
      context.update(Uint8Array.from(chunk));
      bytesProcessed += chunk.byteLength;
    }

    const digest = context.digest(); // Call digest() once and store result

    const tag = concatBuffers([
      stringToBuffer('blob'),
      stringToBuffer(bytesProcessed.toString()),
    ]);

    const taggedHash = concatBuffers([
      new Uint8Array(await crypto.subtle.digest('SHA-384', tag)),
      new Uint8Array(digest), // Use the stored digest
    ]);

    return new Uint8Array(await crypto.subtle.digest('SHA-384', taggedHash));
  } else if (Array.isArray(data)) {
    const tag = concatBuffers([
      stringToBuffer('list'),
      stringToBuffer(data.length.toString()),
    ]);

    return await deepHashChunks(
      data,
      new Uint8Array(await crypto.subtle.digest('SHA-384', tag)),
    );
  }

  const _data = data as Uint8Array;

  const tag = concatBuffers([
    stringToBuffer('blob'),
    stringToBuffer(_data.byteLength.toString()),
  ]);

  const taggedHash = concatBuffers([
    await crypto.subtle.digest('SHA-384', tag),
    await crypto.subtle.digest('SHA-384', _data),
  ]);

  return new Uint8Array(await crypto.subtle.digest('SHA-384', taggedHash));
}

export async function deepHashChunks(
  chunks: DeepHashChunks,
  acc: Uint8Array,
): Promise<Uint8Array> {
  if (chunks.length < 1) {
    return acc;
  }

  const hashPair = concatBuffers([acc, await deepHash(chunks[0])]);
  const newAcc = new Uint8Array(
    await crypto.subtle.digest('SHA-384', hashPair),
  );

  return deepHashChunks(chunks.slice(1), newAcc);
}
