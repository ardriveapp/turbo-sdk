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
import {
  TokenType,
  TurboFactory,
  TurboUnauthenticatedConfiguration,
  TurboWallet,
  tokenToBaseMap,
} from '../node/index.js';
import { AddressOptions } from './types.js';
import { configFromOptions, optionalPrivateKeyFromOptions } from './utils.js';

export async function getBalance(options: AddressOptions) {
  const config = configFromOptions(options);

  if (options.address !== undefined) {
    const turbo = TurboFactory.unauthenticated(config);
    const { winc } = await turbo.getBalance(options.address);

    console.log(
      `Turbo Balance for Native Address "${options.address}"\nCredits: ${
        +winc / 1_000_000_000_000
      }`,
    );
    return;
  }

  const privateKey = await optionalPrivateKeyFromOptions(options);

  if (privateKey === undefined) {
    throw new Error(
      'Must provide an address (--address) or use a valid wallet',
    );
  }

  const turbo = TurboFactory.authenticated({
    ...config,
    privateKey,
  });

  const { winc } = await turbo.getBalance();
  console.log(
    `Turbo Balance for Wallet Address "${await turbo.signer.getNativeAddress()}"\nCredits: ${
      +winc / 1_000_000_000_000
    }`,
  );
}

export interface CryptoFundParams {
  token: TokenType;
  value: string;
  privateKey: TurboWallet;
  config: TurboUnauthenticatedConfiguration;
}
/** Fund the connected signer with crypto */
export async function cryptoFund({
  value,
  privateKey,
  token,
  config,
}: CryptoFundParams) {
  const authenticatedTurbo = TurboFactory.authenticated({
    ...config,
    privateKey: privateKey,
    token,
  });

  const result = await authenticatedTurbo.topUpWithTokens({
    tokenAmount: tokenToBaseMap[token](value),
  });

  console.log(
    'Sent crypto fund transaction: \n',
    JSON.stringify(result, null, 2),
  );
}
