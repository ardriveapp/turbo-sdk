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
  isTokenType,
  tokenToBaseMap,
} from '../node/index.js';

export async function getBalance(address: string, token: string) {
  if (!isTokenType(token)) {
    throw new Error('Invalid token type!');
  }

  const unauthenticatedTurbo = TurboFactory.unauthenticated({
    paymentServiceConfig: { token },
  });
  console.log('unauthenticatedTurbo', unauthenticatedTurbo);
  // const balance = await unauthenticatedTurbo.getBalance({
  //   owner: address,
  // });
  // TODO: Implement unauthenticated getBalance
  console.log('TODO: Get balance for', address);
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
