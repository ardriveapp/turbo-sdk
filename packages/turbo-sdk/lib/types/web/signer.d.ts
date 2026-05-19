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
import { ArconnectSigner, ArweaveSigner, DataItemCreateOptions, EthereumSigner, HexSolanaSigner, Signer } from '@dha-team/arbundles';
import { TurboEventEmitter } from '../common/events.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import { TurboDataItemSignerParams, TurboSignedDataItemFactory, TurboSignedRequestHeaders, WebTurboFileFactory } from '../types.js';
/**
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner };
/**
 * Web implementation of TurboDataItemSigner.
 */
export declare class TurboWebArweaveSigner extends TurboDataItemAbstractSigner {
    constructor(p: TurboDataItemSignerParams);
    private setPublicKey;
    getPublicKey(): Promise<Buffer>;
    signDataItem({ fileStreamFactory, fileSizeFactory, dataItemOpts, emitter, }: WebTurboFileFactory): Promise<TurboSignedDataItemFactory>;
    generateSignedRequestHeaders(): Promise<TurboSignedRequestHeaders>;
    signData(dataToSign: Uint8Array): Promise<Uint8Array>;
}
export declare const readableStreamToAsyncIterable: (stream: ReadableStream<Uint8Array>) => AsyncIterable<Buffer>;
export declare function streamSignerReadableStream({ streamFactory, signer, dataItemOpts, fileSize, emitter, }: {
    streamFactory: () => ReadableStream<Uint8Array>;
    signer: Signer;
    dataItemOpts?: DataItemCreateOptions;
    fileSize: number;
    emitter?: TurboEventEmitter;
}): Promise<{
    signedDataItemFactory: () => ReadableStream<Uint8Array>;
    signedDataItemSize: number;
}>;
export declare function isAsyncIterable(data: any): data is AsyncIterable<Uint8Array>;
//# sourceMappingURL=signer.d.ts.map