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
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddressSync, } from '@solana/spl-token';
import { Connection, PublicKey, Transaction, TransactionInstruction, } from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import bs58 from 'bs58';
import { defaultProdGatewayUrls, sleep } from '../../utils/common.js';
import { Logger } from '../logger.js';
import { memoProgramId } from './solana.js';
const ARIO_SPL_MINT_ADDRESS = 'DcNnMuFxwhgV4WY1HVSaSEgr92bv2b1vUvEKiNxWqHdF';
const DEVNET_ARIO_SPL_MINT_ADDRESS = '6vTw5CysRXQ4ybbHkDUiisHWVsBeMtUzYvJqs2iqHyaN';
const ARIO_TOKEN_DECIMALS = 6;
export class ARIOToken {
    constructor({ gatewayUrl = defaultProdGatewayUrls.solana, logger = Logger.default, pollingOptions = {
        maxAttempts: 10,
        pollingIntervalMs: 2_500,
        initialBackoffMs: 500,
    }, } = {}) {
        this.gatewayUrl = gatewayUrl;
        this.connection = new Connection(gatewayUrl, 'confirmed');
        this.pollingOptions = pollingOptions;
        this.logger = logger;
        if (gatewayUrl.includes('devnet')) {
            this.mintAddress = DEVNET_ARIO_SPL_MINT_ADDRESS;
        }
        else {
            this.mintAddress = ARIO_SPL_MINT_ADDRESS;
        }
    }
    async createAndSubmitTx({ target, signer, tokenAmount, turboCreditDestinationAddress, }) {
        const ownerPublicKey = new PublicKey(bs58.encode(Uint8Array.from(await signer.getPublicKey())));
        const recipient = new PublicKey(target);
        const mint = new PublicKey(this.mintAddress);
        const fromAta = getAssociatedTokenAddressSync(mint, ownerPublicKey);
        const toAta = getAssociatedTokenAddressSync(mint, recipient);
        const tx = new Transaction({
            feePayer: ownerPublicKey,
            ...(await this.connection.getLatestBlockhash()),
        });
        tx.add(createAssociatedTokenAccountIdempotentInstruction(ownerPublicKey, toAta, recipient, mint));
        tx.add(createTransferCheckedInstruction(fromAta, mint, toAta, ownerPublicKey, BigInt(new BigNumber(tokenAmount).toFixed(0)), ARIO_TOKEN_DECIMALS));
        if (turboCreditDestinationAddress !== undefined) {
            tx.add(new TransactionInstruction({
                programId: new PublicKey(memoProgramId),
                keys: [],
                data: Buffer.from('turboCreditDestinationAddress=' + turboCreditDestinationAddress),
            }));
        }
        const serializedTx = tx.serializeMessage();
        const signature = await signer.signData(Uint8Array.from(serializedTx));
        tx.addSignature(ownerPublicKey, Buffer.from(signature));
        const txId = bs58.encode(signature);
        await this.submitTx(tx, txId);
        this.logger.debug('Submitted ARIO SPL transfer transaction...', {
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
        this.logger.debug('Submitting ARIO fund transaction...', { id });
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
        this.logger.debug('Polling for ARIO SPL transaction...', {
            txId,
            pollingOptions: this.pollingOptions,
            gatewayUrl: this.gatewayUrl,
        });
        await sleep(initialBackoffMs);
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
                this.logger.debug('Failed to poll ARIO SPL transaction...', { err });
            }
            if (status && status.value && status.value.err !== null) {
                throw new Error(`Transaction failed: ${status.value.err}`);
            }
            if (status && status.value && status.value.slot !== null) {
                this.logger.debug('Transaction found!', { txId, status });
                return;
            }
            this.logger.debug('ARIO SPL transaction not found, polling...', {
                txId,
                attempts,
                maxAttempts,
                pollingIntervalMs,
            });
            await sleep(pollingIntervalMs);
        }
        throw new Error('Transaction not found after polling, transaction id: ' + txId);
    }
}
export const mARIOToTokenAmount = (mARIO) => mARIO;
export const ARIOToTokenAmount = (ario) => new BigNumber(ario).times(1e6).valueOf();
