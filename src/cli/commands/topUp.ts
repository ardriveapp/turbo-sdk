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
import { exec } from 'child_process';

import { currencyMap } from '../../common/currency.js';
import { TurboFactory } from '../../node/factory.js';
import { fiatCurrencyTypes, isCurrency } from '../../types.js';
import { sleep } from '../../utils/common.js';
import { TopUpOptions } from '../types.js';
import { addressOrPrivateKeyFromOptions, configFromOptions } from '../utils.js';

function openUrl(url: string) {
  if (process.platform === 'darwin') {
    // macOS
    exec(`open ${url}`);
  } else if (process.platform === 'win32') {
    // Windows
    exec(`start "" "${url}"`, { windowsHide: true });
  } else {
    // Linux/Unix
    open(url);
  }
}

export async function topUp(options: TopUpOptions) {
  const config = configFromOptions(options);

  const { address, privateKey } = await addressOrPrivateKeyFromOptions(options);

  const value = options.value;
  if (value === undefined) {
    throw new Error('Must provide a --value to top up');
  }

  const currency = (options.currency ?? 'usd').toLowerCase();

  if (!isCurrency(currency)) {
    throw new Error(
      `Invalid fiat currency type ${currency}!\nPlease use one of these:\n${JSON.stringify(
        fiatCurrencyTypes,
        null,
        2,
      )}`,
    );
  }

  // TODO: Pay in CLI prompts via --cli options

  const { url, paymentAmount, winc } = await (async () => {
    const amount = currencyMap[currency](+value);

    if (address !== undefined) {
      const turbo = TurboFactory.unauthenticated(config);
      return turbo.createCheckoutSession({
        amount,
        owner: address,
      });
    }

    if (privateKey === undefined) {
      throw new Error('Must provide a wallet to top up');
    }

    const turbo = TurboFactory.authenticated({
      ...config,
      privateKey,
    });
    return turbo.createCheckoutSession({
      amount,
      owner: await turbo.signer.getNativeAddress(),
    });
  })();

  if (url === undefined) {
    throw new Error('Failed to create checkout session');
  }

  console.log(
    'Got Checkout Session\n' + JSON.stringify({ url, paymentAmount, winc }),
  );
  console.log('Opening checkout session in browser...');
  await sleep(2000);

  openUrl(url);
}
