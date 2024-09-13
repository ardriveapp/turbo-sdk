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
import prompts from 'prompts';

import { tokenToBaseMap } from '../../common/index.js';
import { TurboFactory } from '../../node/factory.js';
import { CryptoFundOptions } from '../types.js';
import {
  configFromOptions,
  tokenFromOptions,
  turboFromOptions,
} from '../utils.js';

export async function cryptoFund(options: CryptoFundOptions) {
  const value = options.value;
  const txId = options.txId;

  if (txId !== undefined) {
    const turbo = TurboFactory.unauthenticated(configFromOptions(options));
    const result = await turbo.submitFundTransaction({ txId: txId });

    console.log(
      'Submitted existing crypto fund transaction to payment service: \n',
      JSON.stringify(result, null, 2),
    );
    return;
  }

  if (value === undefined) {
    throw new Error(
      'Must provide a --value or --transaction-id for crypto-fund command',
    );
  }

  const turbo = await turboFromOptions(options);

  const token = tokenFromOptions(options);
  const tokenAmount = tokenToBaseMap[token](value);

  if (!options.skipConfirmation) {
    const { winc } = await turbo.getWincForToken({ tokenAmount });
    const targetWallet = (await turbo.getTurboCryptoWallets())[token];

    const credits = (+winc / 1_000_000_000_000).toFixed(12);

    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `\nTransaction details:\n\n  Amount: ${value} ${token}\n  Target: ${targetWallet}\n  Credits received: ${credits}\n  Credit recipient: ${await turbo.signer.getNativeAddress()}\n  Network fees: (Gas fees apply)\n\nThis payment is non-refundable.  Proceed with transaction?`,
      initial: true,
    });

    if (!confirm) {
      console.log('Aborted crypto fund transaction');
      return;
    }
  }

  const result = await turbo.topUpWithTokens({
    tokenAmount,
  });

  console.log(
    'Sent crypto fund transaction: \n',
    JSON.stringify(result, null, 2),
  );
}
