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
import { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner, serializeTags, streamSigner, } from '@dha-team/arbundles';
import { Readable } from 'stream';
import { createStreamWithSigningEvents } from '../common/events.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import { fromB64Url } from '../utils/base64.js';
/**
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner };
/**
 * Node implementation of TurboDataItemSigner.
 */
export class TurboNodeSigner extends TurboDataItemAbstractSigner {
    constructor(p) {
        super(p);
    }
    async signDataItem({ fileStreamFactory, fileSizeFactory, dataItemOpts, emitter, }) {
        // TODO: replace with our own signer implementation
        this.logger.debug('Signing data item...');
        // TODO: we could just use tee or PassThrough rather than require a fileStreamFactory
        let [stream1, stream2] = [fileStreamFactory(), fileStreamFactory()];
        stream1 = stream1 instanceof Buffer ? Readable.from(stream1) : stream1;
        stream2 = stream2 instanceof Buffer ? Readable.from(stream2) : stream2;
        // If we have a signing emitter, wrap the stream with events
        const fileSize = fileSizeFactory();
        const { stream: streamWithSigningEvents, resume } = createStreamWithSigningEvents({
            data: stream1,
            dataSize: fileSize,
            emitter,
        });
        try {
            const signedDataItemPromise = streamSigner(streamWithSigningEvents, // TODO: use generics to avoid this cast
            stream2, this.signer, dataItemOpts);
            // resume the stream so bytes start flowing to the streamSigner
            resume();
            const signedDataItem = await signedDataItemPromise;
            this.logger.debug('Successfully signed data item...');
            const signedDataItemSize = this.calculateSignedDataHeadersSize({
                dataSize: fileSizeFactory(),
                dataItemOpts,
            });
            return {
                dataItemStreamFactory: () => signedDataItem,
                dataItemSizeFactory: () => signedDataItemSize,
            };
        }
        catch (error) {
            // TODO: create a SigningError class and throw that instead of the generic Error
            emitter?.emit('signing-error', error);
            throw error;
        }
    }
    // TODO: make dynamic that accepts anchor and target and tags to return the size of the headers + data
    // reference https://github.com/ArweaveTeam/arweave-standards/blob/master/ans/ANS-104.md#13-dataitem-format
    calculateSignedDataHeadersSize({ dataSize, dataItemOpts, }) {
        const { tags, anchor, target } = dataItemOpts ?? {};
        // ref: https://github.com/Irys-xyz/arbundles/blob/master/src/ar-data-create.ts#L18
        const _target = typeof target === 'string' ? fromB64Url(target) : null;
        const targetLength = 1 + (_target ? _target.byteLength : 0);
        const _anchor = typeof anchor === 'string' ? Buffer.from(anchor) : null;
        const anchorLength = 1 + (_anchor ? _anchor.byteLength : 0);
        const serializedTags = tags && tags.length > 0 ? serializeTags(tags) : null;
        const tagsLength = 16 + (serializedTags ? serializedTags.byteLength : 0);
        const ownerLength = this.signer.ownerLength;
        const signatureLength = this.signer.signatureLength;
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
}
