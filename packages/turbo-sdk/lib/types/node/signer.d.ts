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
import { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner } from '@dha-team/arbundles';
import { Readable } from 'stream';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import { NodeFileStreamFactory, StreamSizeFactory, TurboDataItemSignerParams, TurboFileFactory } from '../types.js';
/**
 * Utility exports to avoid clients having to install arbundles
 */
export { ArconnectSigner, ArweaveSigner, EthereumSigner, HexSolanaSigner };
/**
 * Node implementation of TurboDataItemSigner.
 */
export declare class TurboNodeSigner extends TurboDataItemAbstractSigner {
    constructor(p: TurboDataItemSignerParams);
    signDataItem({ fileStreamFactory, fileSizeFactory, dataItemOpts, emitter, }: TurboFileFactory<NodeFileStreamFactory>): Promise<{
        dataItemStreamFactory: () => Readable;
        dataItemSizeFactory: StreamSizeFactory;
    }>;
    private calculateSignedDataHeadersSize;
}
//# sourceMappingURL=signer.d.ts.map