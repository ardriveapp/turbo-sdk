"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultProdAoConfigs = exports.defaultProdGatewayUrls = exports.tokenToDevAoConfigMap = exports.tokenToDevGatewayMap = void 0;
exports.sleep = sleep;
exports.isWeb = isWeb;
exports.createTurboSigner = createTurboSigner;
exports.signerFromKyvePrivateKey = signerFromKyvePrivateKey;
exports.signerFromKyveMnemonic = signerFromKyveMnemonic;
exports.isBlob = isBlob;
exports.isValidArweaveBase64URL = isValidArweaveBase64URL;
exports.isValidSolanaAddress = isValidSolanaAddress;
exports.isValidECDSAAddress = isValidECDSAAddress;
exports.isValidKyveAddress = isValidKyveAddress;
exports.isValidUserAddress = isValidUserAddress;
exports.isAnyValidUserAddress = isAnyValidUserAddress;
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
const bytes_1 = require("@ethersproject/bytes");
const signing_key_1 = require("@ethersproject/signing-key");
const web3_js_1 = require("@solana/web3.js");
const ethers_1 = require("ethers");
const types_js_1 = require("../types.js");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isWeb() {
    return typeof window !== 'undefined';
}
const ethTestnetRpc = 'https://sepolia.gateway.tenderly.co';
const baseTestnetRpc = 'https://sepolia.base.org';
const polygonTestnetRpc = 'https://rpc-amoy.polygon.technology';
const baseMainnetRpc = 'https://mainnet.base.org';
exports.tokenToDevGatewayMap = {
    arweave: 'https://arweave.net', // No arweave test net
    ario: 'https://arweave.net', // No arweave test net
    'base-ario': baseMainnetRpc, // No base-ario test net contract deployed
    solana: 'https://api.devnet.solana.com',
    ethereum: ethTestnetRpc,
    'base-eth': baseTestnetRpc,
    kyve: 'https://api.korellia.kyve.network',
    matic: polygonTestnetRpc,
    pol: polygonTestnetRpc,
    usdc: ethTestnetRpc,
    'base-usdc': baseTestnetRpc,
    'polygon-usdc': polygonTestnetRpc,
};
exports.tokenToDevAoConfigMap = {
    ario: {
        processId: 'agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA',
        cuUrl: 'https://cu.ardrive.io',
    },
};
exports.defaultProdGatewayUrls = {
    arweave: 'https://arweave.net',
    ario: 'https://arweave.net',
    'base-ario': baseMainnetRpc,
    solana: 'https://api.mainnet-beta.solana.com',
    ethereum: 'https://cloudflare-eth.com/',
    'base-eth': baseMainnetRpc,
    kyve: 'https://api.kyve.network/',
    matic: 'https://polygon-rpc.com/',
    pol: 'https://polygon-rpc.com/',
    usdc: 'https://cloudflare-eth.com/',
    'base-usdc': baseMainnetRpc,
    'polygon-usdc': 'https://polygon-rpc.com/',
};
exports.defaultProdAoConfigs = {
    ario: {
        processId: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE',
        cuUrl: 'https://cu.ardrive.io',
    },
};
function createTurboSigner({ signer: clientProvidedSigner, privateKey: clientProvidedPrivateKey, token = 'arweave', }) {
    if (clientProvidedSigner !== undefined) {
        if (clientProvidedSigner instanceof arbundles_1.InjectedEthereumSigner) {
            // Override the setPublicKey method to resolve a generic string to sign
            clientProvidedSigner.setPublicKey = async () => {
                const message = 'sign this message to connect to your account';
                const signedMsg = await clientProvidedSigner['signer'].signMessage(message);
                const hash = (0, ethers_1.hashMessage)(message);
                const recoveredKey = (0, signing_key_1.recoverPublicKey)((0, bytes_1.arrayify)(hash), signedMsg);
                clientProvidedSigner.publicKey = Buffer.from((0, bytes_1.arrayify)(recoveredKey));
            };
        }
        return clientProvidedSigner;
    }
    if (clientProvidedPrivateKey === undefined) {
        throw new Error('A privateKey or signer must be provided.');
    }
    switch (token) {
        case 'solana':
            return new arbundles_1.HexSolanaSigner(clientProvidedPrivateKey);
        case 'ethereum':
        case 'pol':
        case 'matic':
        case 'base-eth':
        case 'usdc':
        case 'base-usdc':
        case 'base-ario':
        case 'polygon-usdc':
            if (!(0, types_js_1.isEthPrivateKey)(clientProvidedPrivateKey)) {
                throw new Error('A valid Ethereum private key must be provided for EthereumSigner.');
            }
            return new arbundles_1.EthereumSigner(clientProvidedPrivateKey);
        case 'kyve':
            if (!(0, types_js_1.isKyvePrivateKey)(clientProvidedPrivateKey)) {
                throw new Error('A valid Kyve private key must be provided for KyveSigner.');
            }
            return signerFromKyvePrivateKey(clientProvidedPrivateKey);
        case 'arweave':
        case 'ario':
            if (!(0, types_js_1.isJWK)(clientProvidedPrivateKey)) {
                throw new Error('A JWK must be provided for ArweaveSigner.');
            }
            return new arbundles_1.ArweaveSigner(clientProvidedPrivateKey);
    }
}
function signerFromKyvePrivateKey(privateKey) {
    // TODO: Use KyveSigner when implemented for on chain native address support
    return new arbundles_1.EthereumSigner(privateKey);
}
async function signerFromKyveMnemonic(mnemonic) {
    const kyveWallet = await amino_1.Secp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: 'kyve',
    });
    const privateKey = (0, encoding_1.toHex)(crypto_1.Slip10.derivePath(crypto_1.Slip10Curve.Secp256k1, kyveWallet['seed'], (0, amino_1.makeCosmoshubPath)(0)).privkey);
    return signerFromKyvePrivateKey(privateKey);
}
function isBlob(val) {
    return typeof Blob !== 'undefined' && val instanceof Blob;
}
// check if it is a valid arweave base64url for a wallet public address, transaction id or smartweave contract
function isValidArweaveBase64URL(base64URL) {
    const base64URLRegex = new RegExp('^[a-zA-Z0-9_-]{43}$');
    return base64URLRegex.test(base64URL);
}
function isValidSolanaAddress(address) {
    try {
        return web3_js_1.PublicKey.isOnCurve(address);
    }
    catch {
        return false;
    }
}
function isValidECDSAAddress(address) {
    const ethAddressRegex = new RegExp('^0x[a-fA-F0-9]{40}$');
    return ethAddressRegex.test(address);
}
function isValidKyveAddress(address) {
    const kyveAddressRegex = new RegExp('^kyve[a-zA-Z0-9]{39}$');
    return kyveAddressRegex.test(address);
}
function isValidUserAddress(address, type) {
    switch (type) {
        case 'arweave':
        case 'ario':
            return isValidArweaveBase64URL(address);
        case 'solana':
            return isValidSolanaAddress(address);
        case 'ethereum':
        case 'base-eth':
        case 'matic':
        case 'pol':
        case 'base-usdc':
        case 'base-ario':
        case 'usdc':
        case 'polygon-usdc':
            return isValidECDSAAddress(address);
        case 'kyve':
            return isValidKyveAddress(address);
    }
}
function isAnyValidUserAddress(address) {
    for (const type of types_js_1.tokenTypes) {
        if (isValidUserAddress(address, type)) {
            return type;
        }
    }
    return false;
}
