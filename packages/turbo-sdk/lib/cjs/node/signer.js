"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboNodeSigner = exports.HexSolanaSigner = exports.EthereumSigner = exports.ArweaveSigner = exports.ArconnectSigner = void 0;
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
const arbundles_1 = require("@dha-team/arbundles");
Object.defineProperty(exports, "ArconnectSigner", { enumerable: true, get: function () { return arbundles_1.ArconnectSigner; } });
Object.defineProperty(exports, "ArweaveSigner", { enumerable: true, get: function () { return arbundles_1.ArweaveSigner; } });
Object.defineProperty(exports, "EthereumSigner", { enumerable: true, get: function () { return arbundles_1.EthereumSigner; } });
Object.defineProperty(exports, "HexSolanaSigner", { enumerable: true, get: function () { return arbundles_1.HexSolanaSigner; } });
const stream_1 = require("stream");
const events_js_1 = require("../common/events.js");
const signer_js_1 = require("../common/signer.js");
const base64_js_1 = require("../utils/base64.js");
/**
 * Node implementation of TurboDataItemSigner.
 */
class TurboNodeSigner extends signer_js_1.TurboDataItemAbstractSigner {
    constructor(p) {
        super(p);
    }
    async signDataItem({ fileStreamFactory, fileSizeFactory, dataItemOpts, emitter, }) {
        // TODO: replace with our own signer implementation
        this.logger.debug('Signing data item...');
        // TODO: we could just use tee or PassThrough rather than require a fileStreamFactory
        let [stream1, stream2] = [fileStreamFactory(), fileStreamFactory()];
        stream1 = stream1 instanceof Buffer ? stream_1.Readable.from(stream1) : stream1;
        stream2 = stream2 instanceof Buffer ? stream_1.Readable.from(stream2) : stream2;
        // If we have a signing emitter, wrap the stream with events
        const fileSize = fileSizeFactory();
        const { stream: streamWithSigningEvents, resume } = (0, events_js_1.createStreamWithSigningEvents)({
            data: stream1,
            dataSize: fileSize,
            emitter,
        });
        try {
            const signedDataItemPromise = (0, arbundles_1.streamSigner)(streamWithSigningEvents, // TODO: use generics to avoid this cast
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
        const _target = typeof target === 'string' ? (0, base64_js_1.fromB64Url)(target) : null;
        const targetLength = 1 + (_target ? _target.byteLength : 0);
        const _anchor = typeof anchor === 'string' ? Buffer.from(anchor) : null;
        const anchorLength = 1 + (_anchor ? _anchor.byteLength : 0);
        const serializedTags = tags && tags.length > 0 ? (0, arbundles_1.serializeTags)(tags) : null;
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
exports.TurboNodeSigner = TurboNodeSigner;
