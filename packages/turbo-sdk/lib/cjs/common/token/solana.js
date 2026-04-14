"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaToken = exports.memoProgramId = exports.SOLToTokenAmount = exports.lamportToTokenAmount = void 0;
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
const web3_js_1 = require("@solana/web3.js");
const bignumber_js_1 = require("bignumber.js");
const bs58_1 = __importDefault(require("bs58"));
const common_js_1 = require("../../utils/common.js");
const common_js_2 = require("../../utils/common.js");
const logger_js_1 = require("../logger.js");
const lamportToTokenAmount = (winston) => winston;
exports.lamportToTokenAmount = lamportToTokenAmount;
const SOLToTokenAmount = (sol) => new bignumber_js_1.BigNumber(sol).times(1e9).valueOf();
exports.SOLToTokenAmount = SOLToTokenAmount;
exports.memoProgramId = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
class SolanaToken {
    constructor({ logger = logger_js_1.Logger.default, gatewayUrl = common_js_1.defaultProdGatewayUrls.solana, pollingOptions = {
        maxAttempts: 10,
        pollingIntervalMs: 2_500,
        initialBackoffMs: 500,
    }, } = {}) {
        this.logger = logger;
        this.gatewayUrl = gatewayUrl;
        this.connection = new web3_js_1.Connection(gatewayUrl, 'confirmed');
        this.pollingOptions = pollingOptions;
    }
    async createAndSubmitTx({ target, tokenAmount, signer, turboCreditDestinationAddress, }) {
        if (signer.signer instanceof arbundles_1.HexInjectedSolanaSigner) {
            const id = await signer.sendTransaction({
                amount: tokenAmount,
                target,
                gatewayUrl: this.gatewayUrl,
                turboCreditDestinationAddress,
            });
            return { target, id };
        }
        const publicKey = new web3_js_1.PublicKey(bs58_1.default.encode(Uint8Array.from(await signer.getPublicKey())));
        const tx = new web3_js_1.Transaction({
            feePayer: publicKey,
            ...(await this.connection.getLatestBlockhash()),
        });
        tx.add(web3_js_1.SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new web3_js_1.PublicKey(target),
            lamports: +new bignumber_js_1.BigNumber(tokenAmount),
        }));
        if (turboCreditDestinationAddress !== undefined) {
            tx.add(new web3_js_1.TransactionInstruction({
                programId: new web3_js_1.PublicKey(exports.memoProgramId),
                keys: [],
                data: Buffer.from('turboCreditDestinationAddress=' + turboCreditDestinationAddress),
            }));
        }
        const serializedTx = tx.serializeMessage();
        const signature = await signer.signData(Uint8Array.from(serializedTx));
        tx.addSignature(publicKey, Buffer.from(signature));
        const id = bs58_1.default.encode(signature);
        await this.submitTx(tx, id);
        return { id, target };
    }
    async submitTx(tx, id) {
        this.logger.debug('Submitting fund transaction...', { id });
        await this.connection.sendRawTransaction(tx.serialize(), {
            maxRetries: this.pollingOptions.maxAttempts,
        });
        if (tx.recentBlockhash === undefined ||
            tx.lastValidBlockHeight === undefined) {
            throw new Error('Failed to submit Transaction --  missing blockhash or lastValidBlockHeight from transaction creation. Solana Gateway Url:' +
                this.gatewayUrl);
        }
        await this.connection.confirmTransaction({
            signature: id,
            blockhash: tx.recentBlockhash,
            lastValidBlockHeight: tx.lastValidBlockHeight,
        }, 'finalized');
    }
    async pollTxAvailability({ txId }) {
        const { maxAttempts, pollingIntervalMs, initialBackoffMs } = this.pollingOptions;
        this.logger.debug('Polling for transaction...', {
            txId,
            pollingOptions: this.pollingOptions,
        });
        await (0, common_js_2.sleep)(initialBackoffMs);
        let attempts = 0;
        while (attempts < maxAttempts) {
            let status = undefined;
            attempts++;
            try {
                status = await this.connection.getSignatureStatus(txId);
            }
            catch (err) {
                // Continue retries when request errors
                this.logger.debug('Failed to poll for transaction...', { err });
            }
            if (status && status.value && status.value.err !== null) {
                throw new Error(`Transaction failed: ${status.value.err}`);
            }
            if (status && status.value && status.value.slot !== null) {
                return;
            }
            this.logger.debug('Transaction not found, polling...', {
                txId,
                attempts,
                maxAttempts,
                pollingIntervalMs,
            });
            await (0, common_js_2.sleep)(pollingIntervalMs);
        }
        throw new Error('Transaction not found after polling, transaction id: ' + txId);
    }
}
exports.SolanaToken = SolanaToken;
