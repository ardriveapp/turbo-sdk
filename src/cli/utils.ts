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
import bs58 from 'bs58';
import { Command } from 'commander';
import { readFileSync } from 'fs';

import {
  TokenType,
  TurboUnauthenticatedConfiguration,
  defaultTurboConfiguration,
  developmentTurboConfiguration,
  isTokenType,
  privateKeyFromKyveMnemonic,
} from '../node/index.js';

interface CommanderOption {
  alias: string;
  description: string;
  default?: string | boolean;
}

export const optionMap = {
  token: {
    alias: '-t, --token <type>',
    description: 'Token type for wallet or action',
    default: 'arweave',
  },
  currency: {
    alias: '-c, --currency <currency>',
    description: 'Currency type to top up with',
    default: 'usd',
  },
  address: {
    alias: '-a, --address <walletAddress>',
    description: 'Wallet address to use for action',
  },
  value: {
    alias: '-v, --value <value>',
    description: 'Value of fiat currency or crypto token for action',
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
];

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

export async function privateKeyFromOptions(
  {
    mnemonic,
    privateKey,
    walletFile,
  }: {
    walletFile: string | undefined;
    mnemonic: string | undefined;
    privateKey: string | undefined;
  },
  token: TokenType,
): Promise<string> {
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

  throw new Error('mnemonic or wallet file or private key is required');
}

const tokenToDevGatewayMap: Record<TokenType, string> = {
  arweave: 'https://arweave.net', // No arweave test net
  solana: 'https://api.devnet.solana.com',
  ethereum: 'https://ethereum-holesky-rpc.publicnode.com',
  kyve: 'https://api.korellia.kyve.network',
};

export function configFromOptions({
  gateway,
  dev,
  token,
}: {
  gateway: string | undefined;
  dev: boolean | undefined;
  token: TokenType;
}): TurboUnauthenticatedConfiguration {
  let config: TurboUnauthenticatedConfiguration = {};

  if (dev) {
    config = developmentTurboConfiguration;
    config.gatewayUrl = tokenToDevGatewayMap[token];
  } else {
    config = defaultTurboConfiguration;
  }

  // If gateway is provided, override the default or dev gateway
  if (gateway !== undefined) {
    config.gatewayUrl = gateway;
  }

  return config;
}
