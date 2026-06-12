"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboDataItemAbstractSigner = void 0;
exports.makeX402Signer = makeX402Signer;
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
const amino_1 = require("@cosmjs/amino");
const crypto_1 = require("@cosmjs/crypto");
const encoding_1 = require("@cosmjs/encoding");
const arbundles_1 = require("@dha-team/arbundles");
const signing_key_1 = require("@ethersproject/signing-key");
const web3_js_1 = require("@solana/web3.js");
const bignumber_js_1 = require("bignumber.js");
const bs58_1 = __importDefault(require("bs58"));
const crypto_2 = require("crypto");
const ethers_1 = require("ethers");
const ethers_2 = require("ethers");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const viem_1 = require("viem");
const accounts_1 = require("viem/accounts");
const chains_1 = require("viem/chains");
const types_js_1 = require("../types.js");
const base64_js_1 = require("../utils/base64.js");
const logger_js_1 = require("./logger.js");
const ethereum_js_1 = require("./token/ethereum.js");
const solana_js_1 = require("./token/solana.js");
/**
 * Abstract class for signing TurboDataItems.
 */
class TurboDataItemAbstractSigner {
    constructor({ signer, logger = logger_js_1.Logger.default, token, walletAdapter, }) {
        this.logger = logger;
        this.signer = signer;
        this.token = token;
        this.walletAdapter = walletAdapter;
    }
    ownerToNativeAddress(owner, token) {
        switch (token) {
            case 'solana':
                return bs58_1.default.encode(Uint8Array.from((0, base64_js_1.fromB64Url)(owner)));
            case 'ethereum':
            case 'matic':
            case 'pol':
            case 'base-eth':
            case 'usdc':
            case 'base-usdc':
            case 'base-ario':
            case 'polygon-usdc':
                return (0, ethers_2.computeAddress)((0, signing_key_1.computePublicKey)((0, base64_js_1.fromB64Url)(owner)));
            case 'kyve':
                return (0, amino_1.pubkeyToAddress)({
                    type: 'tendermint/PubKeySecp256k1',
                    value: (0, encoding_1.toBase64)(crypto_1.Secp256k1.compressPubkey(Uint8Array.from((0, base64_js_1.fromB64Url)(owner)))),
                }, 'kyve');
            case 'arweave':
            case 'ario':
                return (0, base64_js_1.ownerToAddress)(owner);
        }
    }
    async generateSignedRequestHeaders() {
        const nonce = (0, crypto_2.randomBytes)(16).toString('hex');
        const buffer = Buffer.from(nonce);
        const signature = await this.signer.sign(Uint8Array.from(buffer));
        const publicKey = (0, base64_js_1.toB64Url)(this.signer.publicKey);
        return {
            'x-public-key': publicKey,
            'x-nonce': nonce,
            'x-signature': (0, base64_js_1.toB64Url)(Buffer.from(signature)),
        };
    }
    async getPublicKey() {
        return this.signer.publicKey;
    }
    async getNativeAddress() {
        return this.ownerToNativeAddress((0, base64_js_1.toB64Url)(await this.getPublicKey()), this.token);
    }
    /** Let the signer handle sending tx for better compat with cross chain libraries/web wallets */
    async sendTransaction({ target, amount, gatewayUrl, turboCreditDestinationAddress, }) {
        if (this.walletAdapter) {
            if ((0, types_js_1.isSolanaWalletAdapter)(this.walletAdapter)) {
                const connection = new web3_js_1.Connection(gatewayUrl, 'confirmed');
                const publicKey = new web3_js_1.PublicKey(this.walletAdapter.publicKey.toString());
                const tx = new web3_js_1.Transaction({
                    feePayer: publicKey,
                    ...(await connection.getLatestBlockhash()),
                });
                tx.add(web3_js_1.SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new web3_js_1.PublicKey(target),
                    lamports: +new bignumber_js_1.BigNumber(amount),
                }));
                if (turboCreditDestinationAddress !== undefined) {
                    tx.add(new web3_js_1.TransactionInstruction({
                        programId: new web3_js_1.PublicKey(solana_js_1.memoProgramId),
                        keys: [],
                        data: Buffer.from('turboCreditDestinationAddress=' +
                            turboCreditDestinationAddress),
                    }));
                }
                const signedTx = await this.walletAdapter.signTransaction(tx);
                const id = await connection.sendRawTransaction(signedTx.serialize());
                return id;
            }
            if (!(0, types_js_1.isEthereumWalletAdapter)(this.walletAdapter)) {
                throw new Error('Unsupported wallet adapter -- must implement getSigner');
            }
            const signer = this.walletAdapter.getSigner();
            if (signer.sendTransaction === undefined) {
                throw new Error('Unsupported wallet adapter -- getSigner must return a signer with sendTransaction API for crypto funds transfer');
            }
            const { hash } = await signer.sendTransaction({
                to: target,
                value: (0, ethers_1.parseEther)(amount.toFixed(18)),
                data: (0, ethereum_js_1.ethDataFromTurboCreditDestinationAddress)(turboCreditDestinationAddress),
            });
            return hash;
        }
        if (!(this.signer instanceof arbundles_1.EthereumSigner)) {
            throw new Error('Only EthereumSigner is supported for sendTransaction API currently!');
        }
        const keyAsStringFromUint8Array = Buffer.from(this.signer.key).toString('hex');
        const provider = new ethers_1.ethers.JsonRpcProvider(gatewayUrl);
        const ethWalletAndProvider = new ethers_1.Wallet(keyAsStringFromUint8Array, provider);
        const tx = await ethWalletAndProvider.sendTransaction({
            to: target,
            value: (0, ethers_1.parseEther)(amount.toFixed(18)),
            data: (0, ethereum_js_1.ethDataFromTurboCreditDestinationAddress)(turboCreditDestinationAddress),
        });
        this.logger.debug('Sent transaction', { tx });
        return tx.hash;
    }
    async signData(dataToSign) {
        if (this.signer instanceof arbundles_1.HexSolanaSigner) {
            const privateKey = this.signer.key;
            const publicKey = Uint8Array.from(await this.getPublicKey());
            // Concatenate the private and public keys correctly
            const combinedKey = new Uint8Array(privateKey.length + publicKey.length);
            combinedKey.set(privateKey);
            combinedKey.set(publicKey, privateKey.length);
            const signature = tweetnacl_1.default.sign.detached(dataToSign, combinedKey);
            return signature;
        }
        return this.signer.sign(dataToSign);
    }
}
exports.TurboDataItemAbstractSigner = TurboDataItemAbstractSigner;
async function makeX402Signer(arbundlesSigner) {
    // Node: our SDK uses EthereumSigner with a raw private key
    if (arbundlesSigner instanceof arbundles_1.EthereumSigner) {
        return (0, viem_1.createWalletClient)({
            account: (0, accounts_1.privateKeyToAccount)(('0x' +
                Buffer.from(arbundlesSigner.key).toString('hex'))),
            chain: chains_1.baseSepolia,
            transport: (0, viem_1.http)(),
        });
    }
    // Browser: use injected wallet + selected account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof window !== 'undefined' && window.ethereum) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = window.ethereum;
        // ask wallet for an account
        const accounts = (await provider.request({
            method: 'eth_requestAccounts',
        }));
        if (accounts === undefined || accounts.length === 0) {
            throw new Error('No accounts returned from wallet');
        }
        const account = accounts[0];
        return (0, viem_1.createWalletClient)({
            account,
            chain: chains_1.baseSepolia,
            transport: (0, viem_1.custom)(provider),
        });
    }
    throw new Error('Unable to construct x402 signer for x402 options');
}
