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
import { TurboBaseFactory } from '../common/factory.js';
import { createTurboSigner } from '../utils/common.js';
import { TurboWebArweaveSigner } from './signer.js';
import { TurboAuthenticatedUploadService } from './upload.js';
export class TurboFactory extends TurboBaseFactory {
    getSigner({ providedPrivateKey, logger, providedSigner, providedWalletAdapter, token, }) {
        return new TurboWebArweaveSigner({
            signer: createTurboSigner({
                signer: providedSigner,
                privateKey: providedPrivateKey,
                token,
            }),
            logger: logger,
            token,
            walletAdapter: providedWalletAdapter,
        });
    }
    getAuthenticatedUploadService(config) {
        // Import the TurboAuthenticatedUploadService class from the web upload module
        return new TurboAuthenticatedUploadService(config);
    }
    static authenticated({ privateKey, signer: providedSigner, paymentServiceConfig = {}, uploadServiceConfig = {}, token, gatewayUrl, tokenMap, tokenTools, walletAdapter, cuUrl, processId, }) {
        return new TurboFactory().getAuthenticatedTurbo({
            privateKey,
            signer: providedSigner,
            paymentServiceConfig,
            uploadServiceConfig,
            token,
            gatewayUrl,
            tokenMap,
            tokenTools,
            logger: this.logger,
            walletAdapter,
            cuUrl,
            processId,
        });
    }
}
