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
import { Secp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/amino';
import { Slip10, Slip10Curve } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { GasPrice, SigningStargateClient, calculateFee, } from '@cosmjs/stargate';
import { EthereumSigner } from '@dha-team/arbundles';
import { BigNumber } from 'bignumber.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { sleep } from '../../utils/common.js';
import { Logger } from '../logger.js';
function hasKyveTxResponse(response) {
    return response.tx_response !== undefined;
}
export const ukyveToTokenAmount = (winston) => winston;
export const KYVEToTokenAmount = (sol) => new BigNumber(sol).times(1e6).valueOf();
export class KyveToken {
    constructor({ logger = Logger.default, gatewayUrl = defaultProdGatewayUrls.kyve, pollingOptions = {
        maxAttempts: 5,
        pollingIntervalMs: 1_000,
        initialBackoffMs: 500,
    }, }) {
        this.logger = logger;
        this.gatewayUrl = gatewayUrl;
        this.pollingOptions = pollingOptions;
    }
    async createAndSubmitTx({ target, tokenAmount, signer, }) {
        this.logger.debug('Creating and submitting transaction...', {
            target,
            tokenAmount,
            signer,
        });
        const chainId = this.gatewayUrl.includes('kaon')
            ? 'kaon-1'
            : this.gatewayUrl.includes('korellia')
                ? 'korellia-2'
                : 'kyve-1';
        const txHash = await this.sendTokens({
            chainId,
            privateKeyUint8Array: signer['signer'].key,
            recipientAddress: target,
            amount: tokenAmount.toString(),
        });
        return { id: txHash, target };
    }
    async pollTxAvailability({ txId }) {
        const { maxAttempts, pollingIntervalMs, initialBackoffMs } = this.pollingOptions;
        this.logger.debug('Polling for transaction...', {
            txId,
            pollingOptions: this.pollingOptions,
        });
        await sleep(initialBackoffMs);
        let attempts = 0;
        while (attempts < maxAttempts) {
            let data = undefined;
            attempts++;
            try {
                const res = await fetch(this.gatewayUrl + '/cosmos/tx/v1beta1/txs/' + txId);
                if (res.ok) {
                    data = await res.json();
                }
            }
            catch (err) {
                // Continue retries when request errors
                this.logger.debug('Failed to poll for transaction...', { err });
            }
            if (data !== undefined && hasKyveTxResponse(data)) {
                if (data.tx_response.code !== 0) {
                    throw new Error(`Transaction failed: ${data.tx_response.code}`);
                }
                return;
            }
            this.logger.debug('Transaction not found, polling...', {
                txId,
                attempts,
                maxAttempts,
                pollingIntervalMs,
            });
            await sleep(pollingIntervalMs);
        }
        throw new Error('Transaction not found after polling, transaction id: ' + txId);
    }
    // ref: https://github.com/KYVENetwork/kyvejs/blob/e6c68b007fb50ab026e60ea6eaadf37b7cf8c76f/common/sdk/src/clients/rpc-client/signing.ts#L109-L183
    async sendTokens({ chainId, privateKeyUint8Array, recipientAddress, amount, gasMultiplier = 1.5, }) {
        const config = SUPPORTED_CHAIN_CONFIGS[chainId];
        if (config === undefined) {
            throw new Error(`Unsupported chain ID: ${chainId}`);
        }
        const wallet = await DirectSecp256k1Wallet.fromKey(privateKeyUint8Array, 'kyve');
        const [account] = await wallet.getAccounts();
        const senderAddress = account.address;
        const gasPrice = GasPrice.fromString(`${config.gasPrice}${config.coinDenom}`);
        const client = await SigningStargateClient.connectWithSigner(config.rpc, wallet, { gasPrice });
        // Create MsgSend message
        const msg = {
            fromAddress: senderAddress,
            toAddress: recipientAddress,
            amount: [{ denom: config.coinDenom, amount }],
        };
        const encodedMsg = {
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: msg,
        };
        // Simulate gas usage
        const gasEstimate = await client.simulate(senderAddress, [encodedMsg], '');
        // Calculate fee with buffer
        const fee = calculateFee(Math.round(gasEstimate * gasMultiplier), GasPrice.fromString(`${config.gasPrice}${config.coinDenom}`));
        // Send the actual transaction
        const result = await client.sendTokens(senderAddress, recipientAddress, [{ denom: config.coinDenom, amount }], fee, '');
        return result.transactionHash;
    }
}
export function signerFromKyvePrivateKey(privateKey) {
    // TODO: Use KyveSigner when implemented for on chain native address support
    return new EthereumSigner(privateKey);
}
export async function privateKeyFromKyveMnemonic(mnemonic) {
    const kyveWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: 'kyve',
    });
    return toHex(Slip10.derivePath(Slip10Curve.Secp256k1, kyveWallet['seed'], makeCosmoshubPath(0)).privkey);
}
export async function signerFromKyveMnemonic(mnemonic) {
    const privateKey = await privateKeyFromKyveMnemonic(mnemonic);
    return signerFromKyvePrivateKey(privateKey);
}
// ref: https://github.com/KYVENetwork/kyvejs/blob/e6c68b007fb50ab026e60ea6eaadf37b7cf8c76f/common/sdk/src/constants.ts#L26-L89
export const SUPPORTED_CHAIN_CONFIGS = {
    'kyve-1': {
        chainId: 'kyve-1',
        chainName: 'KYVE',
        rpc: 'https://rpc.kyve.network',
        rest: 'https://api.kyve.network',
        coin: 'KYVE',
        coinDenom: 'ukyve',
        coinDecimals: 6,
        gasPrice: 62.5,
    },
    'kaon-1': {
        chainId: 'kaon-1',
        chainName: 'KYVE Kaon',
        rpc: 'https://rpc.kaon.kyve.network',
        rest: 'https://api.kaon.kyve.network',
        coin: 'KYVE',
        coinDenom: 'tkyve',
        coinDecimals: 6,
        gasPrice: 0.02,
    },
    'korellia-2': {
        chainId: 'korellia-2',
        chainName: 'KYVE Korellia',
        rpc: 'https://rpc.korellia.kyve.network',
        rest: 'https://api.korellia.kyve.network',
        coin: 'KYVE',
        coinDenom: 'tkyve',
        coinDecimals: 6,
        gasPrice: 62.5,
    },
    'kyve-beta': {
        chainId: 'kyve-beta',
        chainName: 'KYVE-Beta',
        rpc: 'https://rpc.beta.kyve.network',
        rest: 'https://api.beta.kyve.network',
        coin: 'KYVE',
        coinDenom: 'tkyve',
        coinDecimals: 6,
        gasPrice: 2,
    },
    'kyve-alpha': {
        chainId: 'kyve-alpha',
        chainName: 'KYVE Alpha',
        rpc: 'https://rpc.alpha.kyve.network',
        rest: 'https://api.alpha.kyve.network',
        coin: 'KYVE',
        coinDenom: 'tkyve',
        coinDecimals: 6,
        gasPrice: 2,
    },
    'kyve-local': {
        chainId: 'kyve-local',
        chainName: 'KYVE Local',
        rpc: 'http://0.0.0.0:26657',
        rest: 'http://0.0.0.0:1317',
        coin: 'KYVE',
        coinDenom: 'tkyve',
        coinDecimals: 6,
        gasPrice: 2,
    },
};
