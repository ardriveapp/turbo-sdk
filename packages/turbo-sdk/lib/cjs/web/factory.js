"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboFactory = void 0;
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
const factory_js_1 = require("../common/factory.js");
const common_js_1 = require("../utils/common.js");
const signer_js_1 = require("./signer.js");
const upload_js_1 = require("./upload.js");
class TurboFactory extends factory_js_1.TurboBaseFactory {
    getSigner({ providedPrivateKey, logger, providedSigner, providedWalletAdapter, token, }) {
        return new signer_js_1.TurboWebArweaveSigner({
            signer: (0, common_js_1.createTurboSigner)({
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
        return new upload_js_1.TurboAuthenticatedUploadService(config);
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
exports.TurboFactory = TurboFactory;
