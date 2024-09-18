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
import bs58 from 'bs58';
import { Command, OptionValues } from 'commander';
import { readFileSync, statSync } from 'fs';

import {
  TokenType,
  TurboAuthenticatedClient,
  TurboFactory,
  TurboUnauthenticatedConfiguration,
  defaultTurboConfiguration,
  developmentTurboConfiguration,
  isTokenType,
  privateKeyFromKyveMnemonic,
} from '../node/index.js';
import { NoWalletProvidedError } from './errors.js';
import {
  AddressOptions,
  GlobalOptions,
  UploadFolderOptions,
  WalletOptions,
} from './types.js';

export function exitWithErrorLog(error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

export async function runCommand<O extends OptionValues>(
  command: Command,
  action: (options: O) => Promise<void>,
) {
  const options = command.optsWithGlobals<O>();

  try {
    await action(options);
    process.exit(0);
  } catch (error) {
    exitWithErrorLog(error);
  }
}

interface CommanderOption {
  alias: string;
  description: string;
  default?: string | boolean;
}

export function applyOptions(
  command: Command,
  options: CommanderOption[],
): Command {
  [...options].forEach((option) => {
    command.option(option.alias, option.description, option.default);
  });
  return command;
}

export function tokenFromOptions(options: unknown): TokenType {
  const token = (options as { token: string }).token;
  if (token === undefined) {
    throw new Error('Token type required');
  }

  if (!isTokenType(token)) {
    throw new Error('Invalid token type');
  }
  return token;
}

export function valueFromOptions(options: unknown): string {
  const value = (options as { value: string }).value;
  if (value === undefined) {
    throw new Error('Value is required. Use --value <value>');
  }
  return value;
}

export function getFolderPathFromOptions(options: unknown): string {
  const folderPath = (options as { folderPath: string }).folderPath;
  if (folderPath === undefined) {
    throw new Error('Folder path is required. Use --folderPath <path>');
  }

  // Check if path exists and is a directory
  const stats = statSync(folderPath);
  if (!stats.isDirectory()) {
    throw new Error('Folder path is not a directory');
  }

  return folderPath;
}

export async function addressOrPrivateKeyFromOptions(
  options: AddressOptions,
): Promise<{
  address: string | undefined;
  privateKey: string | undefined;
}> {
  if (options.address !== undefined) {
    return { address: options.address, privateKey: undefined };
  }

  return {
    address: undefined,
    privateKey: await optionalPrivateKeyFromOptions(options),
  };
}

export async function optionalPrivateKeyFromOptions(options: WalletOptions) {
  try {
    const key = await privateKeyFromOptions(options);
    return key;
  } catch (error) {
    if (error instanceof NoWalletProvidedError) {
      return undefined;
    }
    throw error;
  }
}

export async function privateKeyFromOptions({
  mnemonic,
  privateKey,
  walletFile,
  token,
}: WalletOptions): Promise<string> {
  if (mnemonic !== undefined) {
    if (token === 'kyve') {
      return privateKeyFromKyveMnemonic(mnemonic);
    } else {
      // TODO: Implement other token types mnemonic to wallet
      throw new Error(
        'mnemonic provided but this token type mnemonic to wallet is not supported',
      );
    }
  } else if (walletFile !== undefined) {
    const wallet = JSON.parse(readFileSync(walletFile, 'utf-8'));

    return token === 'solana' ? bs58.encode(wallet) : wallet;
  } else if (privateKey !== undefined) {
    return privateKey;
  }
  // TODO: Get TURBO_WALLET_FILE, TURBO_MNEMONIC, TURBO_PRIVATE_KEY or similar from ENV variables
  // TODO: Add prompts for selecting wallet type and secure input

  throw new NoWalletProvidedError();
}

const tokenToDevGatewayMap: Record<TokenType, string> = {
  arweave: 'https://arweave.net', // No arweave test net
  solana: 'https://api.devnet.solana.com',
  ethereum: 'https://ethereum-holesky-rpc.publicnode.com',
  kyve: 'https://api.korellia.kyve.network',
  matic: 'https://rpc-amoy.polygon.technology',
  pol: 'https://rpc-amoy.polygon.technology',
};

export function configFromOptions(
  options: GlobalOptions,
): TurboUnauthenticatedConfiguration {
  let config: TurboUnauthenticatedConfiguration = {};

  const token = tokenFromOptions(options);

  if (options.dev) {
    config = developmentTurboConfiguration;
    config.gatewayUrl = tokenToDevGatewayMap[token];
  } else {
    config = defaultTurboConfiguration;
  }

  // If gateway is provided, override the default or dev gateway
  if (options.gateway !== undefined) {
    config.gatewayUrl = options.gateway;
  }
  config.token = token;

  return config;
}

export async function turboFromOptions(
  options: WalletOptions,
): Promise<TurboAuthenticatedClient> {
  const privateKey = await privateKeyFromOptions(options);

  return TurboFactory.authenticated({
    ...configFromOptions(options),
    privateKey,
  });
}

export function getUploadFolderOptions(options: UploadFolderOptions): {
  folderPath: string;
  indexFile: string | undefined;
  fallbackFile: string | undefined;
  disableManifest: boolean;
  maxConcurrentUploads: number;
} {
  if (options.folderPath === undefined) {
    throw new Error('--folder-path is required');
  }

  return {
    folderPath: options.folderPath,
    indexFile: options.indexFile,
    fallbackFile: options.fallbackFile,
    disableManifest: !options.manifest,
    maxConcurrentUploads: +(options.maxConcurrency ?? 1),
  };
}
