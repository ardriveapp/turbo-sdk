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
    description:
      'Price type for the action. Can be a fiat currency or crypto token or bytes',
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
  value: {
    alias: '-v, --value <value>',
    description:
      'Value of fiat currency or crypto token for action. e.g: 10.50 for $10.50 USD or 0.0001 for 0.0001 AR',
  },
  walletFile: {
    alias: '-w, --wallet-file <filePath>',
    description:
      'Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array',
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
  dev: {
    alias: '--dev',
    description: 'Enable development endpoints',
    default: false,
  },
  debug: {
    // TODO: Implement
    alias: '--debug',
    description: 'Enable verbose logging',
    default: false,
  },
  quiet: {
    // TODO: Implement
    alias: '--quiet',
    description: 'Disable logging',
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
    description:
      'Fallback file to use in the manifest created for folder upload',
  },
  manifest: {
    alias: '--no-manifest',
    description: 'Disable manifest creation with --no-manifest',
    default: true,
  },
  maxConcurrency: {
    alias: '--max-concurrency <maxConcurrency>',
    description: 'Maximum number of concurrent uploads',
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
} as const;

export const walletOptions = [
  optionMap.walletFile,
  optionMap.mnemonic,
  optionMap.privateKey,
];

export const globalOptions = [
  optionMap.dev,
  optionMap.gateway,
  optionMap.debug,
  optionMap.quiet,
  optionMap.token,
  optionMap.skipConfirmation,
  optionMap.paymentUrl,
  optionMap.uploadUrl,
];

export const uploadFolderOptions = [
  ...walletOptions,
  optionMap.folderPath,
  optionMap.indexFile,
  optionMap.fallbackFile,
  optionMap.manifest,
  optionMap.maxConcurrency,
  optionMap.paidBy,
];

export const uploadFileOptions = [
  ...walletOptions,
  optionMap.filePath,
  optionMap.paidBy,
];

export const createApprovalOptions = [
  ...walletOptions,
  optionMap.value,
  optionMap.address,
  optionMap.expiresBySeconds,
];
