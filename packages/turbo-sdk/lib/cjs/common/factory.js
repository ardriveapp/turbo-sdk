"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboBaseFactory = void 0;
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
const types_js_1 = require("../types.js");
const logger_js_1 = require("./logger.js");
const payment_js_1 = require("./payment.js");
const index_js_1 = require("./token/index.js");
const turbo_js_1 = require("./turbo.js");
const upload_js_1 = require("./upload.js");
class TurboBaseFactory {
    /* @deprecated - use Logger directly */
    static setLogLevel(level) {
        this.logger.setLogLevel(level);
    }
    static unauthenticated({ paymentServiceConfig = {}, uploadServiceConfig = {}, token, } = {}) {
        token = token === 'pol' ? 'matic' : token;
        token ??= 'arweave'; // default to arweave if token is not provided
        const paymentService = new payment_js_1.TurboUnauthenticatedPaymentService({
            ...paymentServiceConfig,
            logger: this.logger,
            token,
        });
        const uploadService = new upload_js_1.TurboUnauthenticatedUploadService({
            ...uploadServiceConfig,
            logger: this.logger,
            token,
        });
        return new turbo_js_1.TurboUnauthenticatedClient({
            uploadService,
            paymentService,
        });
    }
    getAuthenticatedTurbo({ privateKey, signer: providedSigner, paymentServiceConfig = {}, uploadServiceConfig = {}, token, gatewayUrl, tokenMap, tokenTools, logger, walletAdapter, processId, cuUrl, }) {
        token = token === 'pol' ? 'matic' : token;
        if (!token) {
            if (providedSigner) {
                // Derive token from signer if not provided
                switch (providedSigner.signatureType) {
                    case arbundles_1.SignatureConfig.ETHEREUM:
                    case arbundles_1.SignatureConfig.TYPEDETHEREUM:
                        token = 'ethereum';
                        break;
                    case arbundles_1.SignatureConfig.SOLANA:
                    case arbundles_1.SignatureConfig.ED25519:
                        token = 'solana';
                        break;
                    case arbundles_1.SignatureConfig.ARWEAVE:
                        token = 'arweave';
                        break;
                    case arbundles_1.SignatureConfig.KYVE:
                        token = 'kyve';
                        break;
                    default:
                        break;
                }
            }
        }
        token ??= 'arweave'; // default to arweave if token is not provided
        if (walletAdapter) {
            if ((0, types_js_1.isSolanaWalletAdapter)(walletAdapter)) {
                const signMessage = walletAdapter.signMessage.bind(walletAdapter);
                walletAdapter.signMessage = async (message) => {
                    const signed = await signMessage(message);
                    if ('signature' in signed) {
                        return signed.signature;
                    }
                    return signed;
                };
                if (!('toString' in walletAdapter.publicKey)) {
                    // Umi uploader compatibility
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    walletAdapter.publicKey.toString = function () {
                        return this.toBuffer().toString('base64');
                    };
                }
            }
            providedSigner = this.signerFromAdapter(walletAdapter, token);
        }
        const turboSigner = this.getSigner({
            providedSigner,
            providedPrivateKey: privateKey,
            token,
            logger,
            providedWalletAdapter: walletAdapter,
        });
        if (!tokenTools) {
            if (tokenMap && token === 'arweave') {
                tokenTools = tokenMap.arweave;
            }
            tokenTools = index_js_1.defaultTokenMap[token]?.({
                cuUrl,
                processId,
                gatewayUrl,
                logger,
            });
        }
        const paymentService = new payment_js_1.TurboAuthenticatedPaymentService({
            ...paymentServiceConfig,
            signer: turboSigner,
            logger,
            token,
            tokenTools,
        });
        const uploadService = this.getAuthenticatedUploadService({
            ...uploadServiceConfig,
            signer: turboSigner,
            logger,
            token,
            paymentService,
        });
        return new turbo_js_1.TurboAuthenticatedClient({
            uploadService,
            paymentService,
            signer: turboSigner,
        });
    }
    signerFromAdapter(walletAdapter, token) {
        if (token === 'solana') {
            if (!(0, types_js_1.isSolanaWalletAdapter)(walletAdapter)) {
                throw new Error('Unsupported wallet adapter -- must implement publicKey and signMessage');
            }
            return new arbundles_1.HexInjectedSolanaSigner(walletAdapter);
        }
        if (types_js_1.supportedEvmSignerTokens.has(token)) {
            if (!(0, types_js_1.isEthereumWalletAdapter)(walletAdapter)) {
                throw new Error('Unsupported wallet adapter -- must implement getSigner');
            }
            return new arbundles_1.InjectedEthereumSigner(walletAdapter);
        }
        throw new Error('Unsupported wallet adapter -- wallet adapter is currently only supported for Solana and Ethereum');
    }
}
exports.TurboBaseFactory = TurboBaseFactory;
TurboBaseFactory.logger = logger_js_1.Logger.default;
