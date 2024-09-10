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
import { exec } from 'node:child_process';

import {
  TokenType,
  TurboFactory,
  TurboUnauthenticatedConfiguration,
  TurboWallet,
  currencyMap,
  fiatCurrencyTypes,
  isCurrency,
  tokenToBaseMap,
} from '../node/index.js';
import { sleep } from '../utils/common.js';
import { version } from '../version.js';
import { AddressOptions, TopUpOptions, UploadFolderOptions } from './types.js';
import {
  addressOrPrivateKeyFromOptions,
  configFromOptions,
  getUploadFolderOptions,
  privateKeyFromOptions,
} from './utils.js';

export async function getBalance(options: AddressOptions) {
  const config = configFromOptions(options);

  const { address, privateKey } = await addressOrPrivateKeyFromOptions(options);

  if (address !== undefined) {
    const turbo = TurboFactory.unauthenticated(config);
    const { winc } = await turbo.getBalance(address);

    console.log(
      `Turbo Balance for Native Address "${address}"\nCredits: ${
        +winc / 1_000_000_000_000
      }`,
    );
    return;
  }

  if (privateKey === undefined) {
    throw new Error('Must provide an (--address) or use a valid wallet');
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

export function openUrl(url: string) {
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

const turboCliTags: { name: string; value: string }[] = [
  { name: 'App-Name', value: 'Turbo-CLI' },
  { name: 'App-Version', value: version },
  { name: 'App-Platform', value: process.platform },
];

export async function uploadFolder(
  options: UploadFolderOptions,
): Promise<void> {
  const privateKey = await privateKeyFromOptions(options);

  const turbo = TurboFactory.authenticated({
    ...configFromOptions(options),
    privateKey,
  });

  const {
    disableManifest,
    fallbackFile,
    folderPath,
    indexFile,
    maxConcurrentUploads,
  } = getUploadFolderOptions(options);

  const result = await turbo.uploadFolder({
    folderPath: folderPath,
    dataItemOpts: { tags: [...turboCliTags] }, // TODO: Inject user tags
    manifestOptions: {
      disableManifest,
      indexFile,
      fallbackFile,
    },
    maxConcurrentUploads,
  });

  console.log('Uploaded folder:', JSON.stringify(result, null, 2));
}
