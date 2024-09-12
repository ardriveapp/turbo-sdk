/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
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
];

export const uploadFolderOptions = [
  ...walletOptions,
  optionMap.folderPath,
  optionMap.indexFile,
  optionMap.fallbackFile,
  optionMap.manifest,
  optionMap.maxConcurrency,
];

export const uploadFileOptions = [...walletOptions, optionMap.filePath];
