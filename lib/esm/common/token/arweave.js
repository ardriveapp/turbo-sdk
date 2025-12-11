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
import ArweaveModule from 'arweave';
import { BigNumber } from 'bignumber.js';
import { sha256B64Url, toB64Url } from '../../utils/base64.js';
import { sleep } from '../../utils/common.js';
import { Logger } from '../logger.js';
const ArweaveClass = 
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- Access the correct class constructor for Arweave
ArweaveModule.default?.default || ArweaveModule.default || ArweaveModule;
export class ArweaveToken {
    constructor({ gatewayUrl = 'https://arweave.net', arweave, logger = Logger.default, mintU = true, pollingOptions = {
        maxAttempts: 10,
        pollingIntervalMs: 3_000,
        initialBackoffMs: 7_000,
    }, } = {}) {
        const url = new URL(gatewayUrl);
        this.arweave =
            arweave ??
                new ArweaveClass({
                    host: url.hostname,
                    port: url.port,
                    protocol: url.protocol.replace(':', ''),
                });
        this.logger = logger;
        this.mintU = mintU;
        this.pollingOptions = pollingOptions;
    }
    async createAndSubmitTx({ feeMultiplier, target, tokenAmount, signer, turboCreditDestinationAddress, }) {
        const tx = await this.arweave.createTransaction({
            target,
            quantity: tokenAmount.toString(),
            data: '',
        });
        if (feeMultiplier !== 1) {
            tx.reward = BigNumber(tx.reward)
                .times(BigNumber(feeMultiplier))
                .toFixed(0, BigNumber.ROUND_UP);
        }
        if (this.mintU) {
            tx.addTag('App-Name', 'SmartWeaveAction');
            tx.addTag('App-Version', '0.3.0'); // cspell:disable
            tx.addTag('Contract', 'KTzTXT_ANmF84fWEKHzWURD1LWd9QaFR9yfYUwH2Lxw'); // cspell:enable
            tx.addTag('Input', JSON.stringify({ function: 'mint' }));
        }
        if (turboCreditDestinationAddress !== undefined) {
            tx.addTag('Turbo-Credit-Destination-Address', turboCreditDestinationAddress);
        }
        const publicKeyB64Url = toB64Url(await signer.getPublicKey());
        tx.setOwner(publicKeyB64Url);
        const dataToSign = await tx.getSignatureData();
        const signatureUint8Array = await signer.signData(dataToSign);
        const signatureBuffer = Buffer.from(signatureUint8Array);
        const id = sha256B64Url(signatureBuffer);
        tx.setSignature({
            id: id,
            owner: publicKeyB64Url,
            signature: toB64Url(signatureBuffer),
        });
        this.logger.debug('Submitting fund transaction...', { id });
        await this.submitTx(tx);
        return { id, target, reward: tx.reward };
    }
    async pollTxAvailability({ txId }) {
        const { maxAttempts, pollingIntervalMs, initialBackoffMs } = this.pollingOptions;
        this.logger.debug('Polling for transaction...', { txId });
        await sleep(initialBackoffMs);
        let attempts = 0;
        while (attempts < maxAttempts) {
            let transaction;
            attempts++;
            try {
                const gqlQuery = `
          query {
            transactions(ids: ["${txId}"]) {
              edges {
                node {
                  recipient
                  owner {
                    address
                  }
                  quantity {
                    winston
                  }
                }
              }
            }
          }
        `;
                const response = await this.arweave.api.post(`/graphql`, {
                    query: gqlQuery,
                });
                transaction = response?.data?.data?.transactions?.edges[0]?.node;
            }
            catch (err) {
                // Continue retries when request errors
                this.logger.debug('Failed to poll for transaction...', { err });
            }
            if (transaction) {
                return;
            }
            this.logger.debug('Transaction not found...', {
                txId,
                attempts,
                maxAttempts,
                pollingIntervalMs,
            });
            await sleep(pollingIntervalMs);
        }
        throw new Error('Transaction not found after polling, transaction id: ' + txId);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async submitTx(tx) {
        try {
            const response = await this.arweave.transactions.post(tx);
            if (response.status !== 200) {
                throw new Error('Failed to post transaction -- ' +
                    `Status ${response.status}, ${response.statusText}, ${response.data}`);
            }
            this.logger.debug('Successfully posted fund transaction...', { tx });
        }
        catch (err) {
            throw new Error(`Failed to post transaction -- ${err instanceof Error ? err.message : err}`);
        }
        this.logger.debug('Posted transaction...', { tx });
    }
}
export const WinstonToTokenAmount = (winston) => winston;
export const ARToTokenAmount = (ar) => new BigNumber(ar).times(1e12).valueOf();
