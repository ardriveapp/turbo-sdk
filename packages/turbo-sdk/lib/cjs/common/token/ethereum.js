"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthereumToken = exports.defaultEthereumPollingOptions = exports.ETHToTokenAmount = exports.weiToTokenAmount = void 0;
exports.ethDataFromTurboCreditDestinationAddress = ethDataFromTurboCreditDestinationAddress;
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
const bignumber_js_1 = require("bignumber.js");
const ethers_1 = require("ethers");
const common_js_1 = require("../../utils/common.js");
const logger_js_1 = require("../logger.js");
const weiToTokenAmount = (wei) => wei;
exports.weiToTokenAmount = weiToTokenAmount;
const ETHToTokenAmount = (eth) => new bignumber_js_1.BigNumber(eth).times(1e18).valueOf();
exports.ETHToTokenAmount = ETHToTokenAmount;
exports.defaultEthereumPollingOptions = {
    initialBackoffMs: 25_000,
    maxAttempts: 10,
    pollingIntervalMs: 1_500,
};
class EthereumToken {
    constructor({ logger = logger_js_1.Logger.default, gatewayUrl = common_js_1.defaultProdGatewayUrls.ethereum, pollingOptions = exports.defaultEthereumPollingOptions, } = {}) {
        this.logger = logger;
        this.gatewayUrl = gatewayUrl;
        this.pollingOptions = pollingOptions;
        this.rpcProvider = new ethers_1.ethers.JsonRpcProvider(gatewayUrl);
    }
    async createAndSubmitTx({ target, tokenAmount, signer, turboCreditDestinationAddress, }) {
        try {
            // convert wei to eth
            const eth = tokenAmount.shiftedBy(-18);
            const txId = await signer.sendTransaction({
                target,
                amount: eth,
                gatewayUrl: this.gatewayUrl,
                turboCreditDestinationAddress,
            });
            return {
                id: txId,
                target,
            };
        }
        catch (e) {
            this.logger.error('Error creating and submitting Ethereum tx', {
                error: e instanceof Error ? e.message : e,
                target,
                tokenAmount,
                rpcEndpoint: this.gatewayUrl,
            });
            throw e;
        }
    }
    async getTxAvailability(txId) {
        const tx = await this.rpcProvider.getTransaction(txId);
        if (tx) {
            this.logger.debug('Transaction is available on chain', { txId, tx });
            return true;
        }
        this.logger.debug('Transaction not yet available on chain', { txId });
        return false;
    }
    async pollTxAvailability({ txId }) {
        await new Promise((resolve) => setTimeout(resolve, this.pollingOptions.initialBackoffMs));
        let attempts = 0;
        while (attempts < this.pollingOptions.maxAttempts) {
            try {
                const txIsAvailable = await this.getTxAvailability(txId);
                if (txIsAvailable) {
                    return;
                }
            }
            catch (e) {
                this.logger.debug('Error polling for tx', { txId, e });
            }
            await new Promise((resolve) => setTimeout(resolve, this.pollingOptions.pollingIntervalMs));
            attempts++;
        }
        throw new Error(`Transaction ${txId} not found after polling!`);
    }
}
exports.EthereumToken = EthereumToken;
function ethDataFromTurboCreditDestinationAddress(turboCreditDestinationAddress) {
    if (turboCreditDestinationAddress !== undefined) {
        return (0, ethers_1.hexlify)((0, ethers_1.toUtf8Bytes)('turboCreditDestinationAddress=' + turboCreditDestinationAddress));
    }
    return undefined;
}
