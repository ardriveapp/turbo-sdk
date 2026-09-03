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
import { EthereumSigner } from '@dha-team/arbundles';
import { Wallet as EthereumWallet, JsonRpcProvider, ethers } from 'ethers';
import { isEthereumWalletAdapter, } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { Logger } from '../logger.js';
import { EthereumToken, ethDataFromTurboCreditDestinationAddress, } from './ethereum.js';
export class ERC20Token extends EthereumToken {
    constructor({ tokenContractAddress, logger = Logger.default, gatewayUrl = defaultProdGatewayUrls.ethereum, pollingOptions, }) {
        super({ logger, gatewayUrl, pollingOptions });
        this.tokenContract = new ethers.Contract(tokenContractAddress, [
            'function decimals() view returns (uint8)',
            'function balanceOf(address) view returns (uint256)',
            'function transfer(address to, uint256 value) returns (bool)',
        ], this.rpcProvider);
    }
    async createAndSubmitTx({ target, tokenAmount, signer, turboCreditDestinationAddress, }) {
        try {
            let connected;
            let walletOrSigner;
            if (signer.signer instanceof EthereumSigner) {
                const provider = new JsonRpcProvider(this.gatewayUrl);
                // 🧩 CLI / Node path
                const keyHex = Buffer.from(signer.signer.key).toString('hex');
                walletOrSigner = new EthereumWallet(keyHex, provider);
                connected = this.tokenContract.connect(walletOrSigner);
            }
            else if (signer.walletAdapter !== undefined &&
                isEthereumWalletAdapter(signer.walletAdapter)) {
                walletOrSigner = signer.walletAdapter.getSigner();
                connected = this.tokenContract.connect(walletOrSigner);
            }
            else {
                throw new Error('Unsupported signer -- must be EthereumSigner or have a walletAdapter implementing getSigner');
            }
            // Encode transfer data
            const baseTransferData = connected.interface.encodeFunctionData('transfer', [target, tokenAmount.toString()]);
            let finalData = baseTransferData;
            // Append optional memo data with turbo credit destination address
            const memoData = ethDataFromTurboCreditDestinationAddress(turboCreditDestinationAddress);
            if (memoData !== undefined) {
                // remove the "0x" prefix and append
                finalData += memoData.slice(2);
            }
            const txRequest = {
                to: await connected.getAddress(),
                data: finalData,
            };
            this.logger.debug('Submitting ERC20 transfer', {
                target,
                tokenAmount: tokenAmount.toString(),
                rpcEndpoint: this.gatewayUrl,
                txRequest,
            });
            const tx = await walletOrSigner.sendTransaction(txRequest);
            this.logger.debug('ERC20 transfer submitted', {
                txHash: tx.hash,
                target,
                tx,
            });
            return { id: tx.hash, target };
        }
        catch (e) {
            this.logger.error('Error creating/submitting ERC20 tx', {
                error: e instanceof Error ? e.message : e,
                target,
                tokenAmount,
                rpcEndpoint: this.gatewayUrl,
            });
            throw e;
        }
    }
}
