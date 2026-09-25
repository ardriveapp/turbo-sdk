"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplToken = void 0;
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
const spl_token_1 = require("@solana/spl-token");
const web3_js_1 = require("@solana/web3.js");
const bignumber_js_1 = require("bignumber.js");
const bs58_1 = __importDefault(require("bs58"));
const common_js_1 = require("../../utils/common.js");
const logger_js_1 = require("../logger.js");
const solana_js_1 = require("./solana.js");
/**
 * Funding by an **SPL token transfer on Solana**: an idempotent
 * create-associated-token-account, a `transferChecked` to the recipient's ATA,
 * and an optional `turboCreditDestinationAddress=` memo when the credit should
 * land on a different Turbo account than the payer.
 *
 * This is the generic shape of what `ARIOToken` has always done — ARIO is an SPL
 * token — so a second SPL token (USDC) is a mint and a decimals value, not a
 * second implementation. The payment service verifies both with one class too
 * (`SolanaSplGateway`).
 *
 * Two constraints worth knowing before pointing this at a third token:
 *  - The associated token accounts are derived for the CLASSIC SPL Token
 *    program (Tokenkeg), which is what ARIO and USDC use. A Token-2022 mint
 *    derives a different ATA, so it would need its own program id threading
 *    through `getAssociatedTokenAddressSync`. It fails loudly on-chain rather
 *    than silently paying the wrong account.
 *  - `decimals` must match the mint's own. `transferChecked` carries the value
 *    and the chain rejects a mismatch, so a wrong value fails the transaction
 *    instead of transferring a wrong amount.
 */
class SplToken {
    constructor({ mintAddress, decimals, tokenName = 'SPL', gatewayUrl = common_js_1.defaultProdGatewayUrls.solana, logger = logger_js_1.Logger.default, pollingOptions = {
        maxAttempts: 10,
        pollingIntervalMs: 2_500,
        initialBackoffMs: 500,
    }, }) {
        this.gatewayUrl = gatewayUrl;
        this.connection = new web3_js_1.Connection(gatewayUrl, 'confirmed');
        this.pollingOptions = pollingOptions;
        this.logger = logger;
        this.mintAddress = mintAddress;
        this.decimals = decimals;
        this.tokenName = tokenName;
    }
    async createAndSubmitTx({ target, signer, tokenAmount, turboCreditDestinationAddress, }) {
        const ownerPublicKey = new web3_js_1.PublicKey(bs58_1.default.encode(Uint8Array.from(await signer.getPublicKey())));
        const recipient = new web3_js_1.PublicKey(target);
        const mint = new web3_js_1.PublicKey(this.mintAddress);
        const fromAta = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, ownerPublicKey);
        const toAta = (0, spl_token_1.getAssociatedTokenAddressSync)(mint, recipient);
        const tx = new web3_js_1.Transaction({
            feePayer: ownerPublicKey,
            ...(await this.connection.getLatestBlockhash()),
        });
        tx.add((0, spl_token_1.createAssociatedTokenAccountIdempotentInstruction)(ownerPublicKey, toAta, recipient, mint));
        tx.add((0, spl_token_1.createTransferCheckedInstruction)(fromAta, mint, toAta, ownerPublicKey, BigInt(new bignumber_js_1.BigNumber(tokenAmount).toFixed(0)), this.decimals));
        if (turboCreditDestinationAddress !== undefined) {
            tx.add(new web3_js_1.TransactionInstruction({
                programId: new web3_js_1.PublicKey(solana_js_1.memoProgramId),
                keys: [],
                data: Buffer.from('turboCreditDestinationAddress=' + turboCreditDestinationAddress),
            }));
        }
        const serializedTx = tx.serializeMessage();
        const signature = await signer.signData(Uint8Array.from(serializedTx));
        tx.addSignature(ownerPublicKey, Buffer.from(signature));
        const txId = bs58_1.default.encode(signature);
        await this.submitTx(tx, txId);
        this.logger.debug(`Submitted ${this.tokenName} SPL transfer transaction...`, {
            id: txId,
            target,
            tokenAmount,
            fromAta: fromAta.toBase58(),
            toAta: toAta.toBase58(),
            mint: mint.toBase58(),
        });
        return { id: txId, target, reward: '0' };
    }
    async submitTx(tx, id) {
        this.logger.debug(`Submitting ${this.tokenName} fund transaction...`, {
            id,
        });
        await this.connection.sendRawTransaction(tx.serialize(), {
            maxRetries: this.pollingOptions.maxAttempts,
        });
        if (tx.recentBlockhash === undefined ||
            tx.lastValidBlockHeight === undefined) {
            throw new Error('Failed to submit Transaction -- missing blockhash or lastValidBlockHeight from transaction creation. Solana Gateway Url:' +
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
        this.logger.debug(`Polling for ${this.tokenName} SPL transaction...`, {
            txId,
            pollingOptions: this.pollingOptions,
            gatewayUrl: this.gatewayUrl,
        });
        await (0, common_js_1.sleep)(initialBackoffMs);
        let attempts = 0;
        while (attempts < maxAttempts) {
            let status;
            attempts++;
            try {
                const statuses = await this.connection.getSignatureStatuses([txId], {
                    searchTransactionHistory: true,
                });
                status = {
                    context: statuses.context,
                    value: statuses.value[0],
                };
            }
            catch (err) {
                this.logger.debug(`Failed to poll ${this.tokenName} SPL transaction...`, { err });
            }
            if (status && status.value && status.value.err !== null) {
                throw new Error(`Transaction failed: ${status.value.err}`);
            }
            if (status && status.value && status.value.slot !== null) {
                this.logger.debug('Transaction found!', { txId, status });
                return;
            }
            this.logger.debug(`${this.tokenName} SPL transaction not found, polling...`, {
                txId,
                attempts,
                maxAttempts,
                pollingIntervalMs,
            });
            await (0, common_js_1.sleep)(pollingIntervalMs);
        }
        throw new Error('Transaction not found after polling, transaction id: ' + txId);
    }
}
exports.SplToken = SplToken;
