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
export const optionMap = {
    token: {
        alias: '-t, --token <type>',
        description: 'Crypto token type for wallet or action',
        default: 'arweave',
    },
    currency: {
        alias: '-c, --currency <currency>',
        description: 'Fiat currency type to use for the action',
        default: 'usd',
    },
    type: {
        alias: '--type <priceType>',
        description: 'Price type for the action. Can be a fiat currency or crypto token or bytes',
        default: 'bytes',
    },
    txId: {
        alias: '-i, --tx-id <txId>',
        description: 'Transaction ID or hash to use for action',
    },
    address: {
        alias: '-a, --address <nativeAddress>',
        description: 'Native address to use for action',
    },
    tags: {
        description: 'An array of additional tags for the write action, in "--tags name1 value1 name2 value2" format',
        alias: '--tags <tags...>',
        type: 'array',
    },
    value: {
        alias: '-v, --value <value>',
        description: 'Value of fiat currency or crypto token for action. e.g: 10.50 for $10.50 USD or 0.0001 for 0.0001 AR',
    },
    walletFile: {
        alias: '-w, --wallet-file <filePath>',
        description: 'Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array',
    },
    mnemonic: {
        alias: '-m, --mnemonic <phrase>',
        description: 'Mnemonic to use with the action',
    },
    privateKey: {
        alias: '-p, --private-key <key>',
        description: 'Private key to use with the action',
    },
    gateway: {
        alias: '-g, --gateway <url>',
        description: 'Set a custom crypto gateway URL',
        default: undefined,
    },
    uploadUrl: {
        alias: '--upload-url <url>',
        description: 'Set a custom upload service URL',
        default: undefined,
    },
    paymentUrl: {
        alias: '--payment-url <url>',
        description: 'Set a custom payment service URL',
        default: undefined,
    },
    processId: {
        alias: '--process-id <processId>',
        description: 'Set a custom target process ID for the action',
        default: undefined,
    },
    cuUrl: {
        alias: '--cu-url <cuUrl>',
        description: 'Set a custom CU URL for the action',
        default: undefined,
    },
    dev: {
        alias: '--dev',
        description: 'Enable Turbo development endpoints',
        default: false,
    },
    local: {
        alias: '--local',
        description: 'Enable local development endpoints',
        default: false,
    },
    debug: {
        alias: '--debug',
        description: 'Enable verbose logging',
        default: false,
    },
    quiet: {
        alias: '--quiet',
        description: 'Disable logging',
        default: false,
    },
    showProgress: {
        alias: '--show-progress',
        description: 'Display progress bars during upload operations',
        default: false,
    },
    skipConfirmation: {
        alias: '--skip-confirmation',
        description: 'Skip all confirmation prompts',
        default: false,
    },
    folderPath: {
        alias: '-f, --folder-path <folderPath>',
        description: 'Directory to upload',
    },
    filePath: {
        alias: '-f, --file-path <filePath>',
        description: 'File to upload',
    },
    indexFile: {
        alias: '--index-file <indexFile>',
        description: 'Index file to use in the manifest created for folder upload',
    },
    fallbackFile: {
        alias: '--fallback-file <fallbackFile>',
        description: 'Fallback file to use in the manifest created for folder upload',
    },
    manifest: {
        alias: '--no-manifest',
        description: 'Disable manifest creation with --no-manifest',
        default: true,
    },
    maxConcurrency: {
        alias: '--max-concurrency <maxConcurrency>',
        description: 'Maximum number of concurrent file uploads',
    },
    paidBy: {
        alias: '--paid-by <paidBy...>',
        description: 'Address to pay for the upload',
        type: 'array',
    },
    expiresBySeconds: {
        alias: '--expires-by-seconds <expiresBySeconds>',
        description: 'Expiration time in seconds',
    },
    ignoreApprovals: {
        alias: '--ignore-approvals',
        description: "Ignore all credit share approvals, only use signing wallet's balance",
        default: false,
    },
    useSignerBalanceFirst: {
        alias: '--use-signer-balance-first',
        description: 'Use the signer balance first before using credit share approvals',
        default: false,
    },
    byteCount: {
        alias: '--byte-count <byteCount>',
        description: 'Number of bytes to use for the action',
    },
    maxChunkConcurrency: {
        alias: '--max-chunk-concurrency <maxChunkConcurrency>',
        description: 'Maximum number of concurrent chunks to upload per file',
    },
    maxFinalizeMs: {
        alias: '--max-finalize-ms <maxFinalizeMs>',
        description: 'Maximum time in milliseconds to wait for the finalization of all chunks after the last chunk is uploaded. Defaults to 1 minute per GiB of the total file size.',
    },
    chunkByteCount: {
        alias: '--chunk-byte-count <chunkByteCount>',
        description: 'Size of each chunk in bytes',
    },
    chunkingMode: {
        alias: '--chunking-mode <chunkingMode>',
        description: 'Chunking mode to use for the upload. Can be "auto", "force" or "disabled". Defaults to "auto".',
        default: 'auto',
    },
    onDemand: {
        alias: '--on-demand',
        description: 'Enable on-demand crypto top-ups during upload if balance is insufficient',
        default: false,
    },
    x402: {
        alias: '--x402',
        description: 'Pay for the action using x402 funding (if available). Requires token `base-usdc`.',
        default: false,
    },
    topUpBufferMultiplier: {
        alias: '--top-up-buffer-multiplier <topUpBufferMultiplier>',
        description: 'Multiplier to apply to the estimated top-up amount to avoid underpayment during on-demand top-ups. Defaults to 1.1 (10% buffer).',
    },
    maxCryptoTopUpValue: {
        alias: '--max-crypto-top-up-value <maxCryptoTopUpValue>',
        description: 'Maximum crypto top-up value to use for the upload. Defaults to no limit.',
    },
};
export const walletOptions = [
    optionMap.walletFile,
    optionMap.mnemonic,
    optionMap.privateKey,
];
export const globalOptions = [
    optionMap.dev,
    optionMap.local,
    optionMap.gateway,
    optionMap.debug,
    optionMap.quiet,
    optionMap.token,
    optionMap.skipConfirmation,
    optionMap.paymentUrl,
    optionMap.uploadUrl,
];
const onDemandOptions = [
    optionMap.onDemand,
    optionMap.topUpBufferMultiplier,
    optionMap.maxCryptoTopUpValue,
    optionMap.x402,
];
export const uploadOptions = [
    ...walletOptions,
    optionMap.paidBy,
    optionMap.ignoreApprovals,
    optionMap.useSignerBalanceFirst,
    optionMap.tags,
    optionMap.maxChunkConcurrency,
    optionMap.maxFinalizeMs,
    optionMap.chunkByteCount,
    optionMap.chunkingMode,
    optionMap.showProgress,
    ...onDemandOptions,
];
export const uploadFolderOptions = [
    ...uploadOptions,
    optionMap.folderPath,
    optionMap.indexFile,
    optionMap.fallbackFile,
    optionMap.manifest,
    optionMap.maxConcurrency,
];
export const uploadFileOptions = [...uploadOptions, optionMap.filePath];
export const shareCreditsOptions = [
    ...walletOptions,
    optionMap.value,
    optionMap.address,
    optionMap.expiresBySeconds,
];
export const revokeCreditsOptions = [...walletOptions, optionMap.address];
export const listSharesOptions = revokeCreditsOptions;
