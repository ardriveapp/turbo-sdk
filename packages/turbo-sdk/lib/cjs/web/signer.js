"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readableStreamToAsyncIterable = exports.TurboWebArweaveSigner = exports.HexSolanaSigner = exports.EthereumSigner = exports.ArweaveSigner = exports.ArconnectSigner = void 0;
exports.streamSignerReadableStream = streamSignerReadableStream;
exports.isAsyncIterable = isAsyncIterable;
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
const signer_js_1 = require("../common/signer.js");
const readableStream_js_1 = require("../utils/readableStream.js");
/**
 * Web implementation of TurboDataItemSigner.
 */
class TurboWebArweaveSigner extends signer_js_1.TurboDataItemAbstractSigner {
    constructor(p) {
        super(p);
    }
    async setPublicKey() {
        // for arconnect, we need to make sure we have the public key before create data
        if (this.signer.publicKey === undefined &&
            (this.signer instanceof arbundles_1.ArconnectSigner ||
                this.signer instanceof arbundles_1.InjectedEthereumSigner)) {
            await this.signer.setPublicKey();
        }
    }
    async getPublicKey() {
        await this.setPublicKey();
        return super.getPublicKey();
    }
    async signDataItem({ fileStreamFactory, fileSizeFactory, dataItemOpts, emitter, }) {
        await this.setPublicKey();
        // Create signing emitter if events are provided
        const fileSize = fileSizeFactory();
        this.logger.debug('Signing data item...');
        const { signedDataItemFactory, signedDataItemSize } = await streamSignerReadableStream({
            streamFactory: (0, readableStream_js_1.createUint8ArrayReadableStreamFactory)({
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
    async generateSignedRequestHeaders() {
        await this.setPublicKey();
        return super.generateSignedRequestHeaders();
    }
    async signData(dataToSign) {
        await this.setPublicKey();
        return super.signData(dataToSign);
    }
}
exports.TurboWebArweaveSigner = TurboWebArweaveSigner;
const readableStreamToAsyncIterable = (stream) => ({
    async *[Symbol.asyncIterator]() {
        const reader = stream.getReader();
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                if (value !== undefined)
                    yield Buffer.from(value);
            }
        }
        finally {
            reader.releaseLock();
        }
    },
});
exports.readableStreamToAsyncIterable = readableStreamToAsyncIterable;
async function streamSignerReadableStream({ streamFactory, signer, dataItemOpts, fileSize, emitter, }) {
    try {
        const header = (0, arbundles_1.createData)('', signer, dataItemOpts);
        const headerSize = header.getRaw().byteLength;
        const totalDataItemSizeWithHeader = fileSize + headerSize;
        const [stream1, stream2] = streamFactory().tee();
        const reader1 = stream1.getReader();
        let bytesProcessed = 0;
        const eventingStream = new ReadableStream({
            start() {
                // technically this should be emitted after each DeepHashChunk be we cannot access that stage, so we emit it here instead
                bytesProcessed = headerSize;
                emitter?.emit('signing-progress', {
                    processedBytes: bytesProcessed,
                    totalBytes: totalDataItemSizeWithHeader,
                });
            },
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
        const asyncIterableReadableStream = (0, exports.readableStreamToAsyncIterable)(eventingStream);
        // provide that ReadableStream with events to deep hash, so as it pulls bytes through events get emitted
        const parts = [
            (0, arbundles_1.stringToBuffer)('dataitem'),
            (0, arbundles_1.stringToBuffer)('1'),
            (0, arbundles_1.stringToBuffer)(header.signatureType.toString()),
            Uint8Array.from(header.rawOwner),
            Uint8Array.from(header.rawTarget),
            Uint8Array.from(header.rawAnchor),
            Uint8Array.from(header.rawTags),
            asyncIterableReadableStream,
        ];
        const hash = await (0, arbundles_1.deepHash)(parts);
        const sigBytes = Buffer.from(await signer.sign(hash));
        emitter?.emit('signing-success');
        header.setSignature(sigBytes);
        const headerBytes = header.getRaw();
        const signedDataItemFactory = () => {
            const reader = stream2.getReader();
            return new ReadableStream({
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
                    }
                    catch (error) {
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
    }
    catch (error) {
        emitter?.emit('signing-error', error);
        throw error;
    }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAsyncIterable(data) {
    return (typeof data[Symbol.asyncIterator] ===
        'function');
}
