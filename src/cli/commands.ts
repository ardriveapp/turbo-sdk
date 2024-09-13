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
import { createReadStream, statSync } from 'node:fs';
import prompts from 'prompts';

import {
  TurboFactory,
  currencyMap,
  fiatCurrencyTypes,
  isCurrency,
  isTokenType,
  tokenToBaseMap,
} from '../node/index.js';
import { sleep } from '../utils/common.js';
import { version } from '../version.js';
import {
  AddressOptions,
  CryptoFundOptions,
  PriceOptions,
  TopUpOptions,
  UploadFileOptions,
  UploadFolderOptions,
} from './types.js';
import {
  addressOrPrivateKeyFromOptions,
  configFromOptions,
  getUploadFolderOptions,
  tokenFromOptions,
  turboFromOptions,
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

/** Fund the connected signer with crypto */
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
  const turbo = await turboFromOptions(options);

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

export async function uploadFile(options: UploadFileOptions): Promise<void> {
  const { filePath } = options;
  if (filePath === undefined) {
    throw new Error('Must provide a --file-path to upload');
  }

  const turbo = await turboFromOptions(options);

  const fileSize = statSync(filePath).size;

  const result = await turbo.uploadFile({
    fileStreamFactory: () => createReadStream(filePath),
    fileSizeFactory: () => fileSize,
    dataItemOpts: { tags: [...turboCliTags] }, // TODO: Inject user tags
  });

  console.log('Uploaded file:', JSON.stringify(result, null, 2));
}

export async function getPrice(options: PriceOptions) {
  const value = options.value;
  console.log('value', value);
  if (value === undefined || !Number.isInteger(+value) || +value <= 0) {
    throw new Error('Must provide a positive number --value to get price');
  }

  const type = options.type ?? 'bytes';

  const winc = await (async () => {
    if (isTokenType(type)) {
      const turbo = TurboFactory.unauthenticated({
        ...configFromOptions(options),
        token: type,
      });
      return (
        await turbo.getWincForToken({
          tokenAmount: tokenToBaseMap[type](value),
        })
      ).winc;
    }

    const turbo = TurboFactory.unauthenticated(configFromOptions(options));
    if (type === 'bytes') {
      return (await turbo.getUploadCosts({ bytes: [+value] }))[0].winc;
    }

    if (isCurrency(type)) {
      return (
        await turbo.getWincForFiat({
          amount: currencyMap[type](+value),
        })
      ).winc;
    }

    throw new Error('Invalid price type!');
  })();

  console.log(
    `Current price estimate for ${value} ${type} is ~${(
      +winc / 1_000_000_000_000
    ).toFixed(12)} Credits`,
  );
}
