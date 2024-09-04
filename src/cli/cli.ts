#!/usr/bin/env node

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
// eslint-disable-next-line header/header -- This is a CLI file
import { Command, program } from 'commander';

import { version } from '../version.js';
import { cryptoFund, getBalance, topUp } from './commands.js';
import { TopUpOptions } from './types.js';
import {
  applyOptions,
  configFromOptions,
  globalOptions,
  optionMap,
  privateKeyFromOptions,
  tokenFromOptions,
  valueFromOptions,
  walletOptions,
} from './utils.js';

applyOptions(
  program
    .name('turbo')
    .version(version)
    .description('Turbo CLI')
    .helpCommand(true),
  globalOptions,
);

function exitWithErrorLog(error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

applyOptions(
  program.command('balance').description('Get balance of a Turbo address'),
  [optionMap.address, optionMap.token, ...walletOptions],
).action(async (_commandOptions, command: Command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = command.optsWithGlobals();

  try {
    await getBalance(options);
    process.exit(0);
  } catch (error) {
    exitWithErrorLog(error);
  }
});

applyOptions(
  program.command('top-up').description('Top up a Turbo address with Fiat'),
  [...walletOptions, optionMap.address, optionMap.value, optionMap.currency],
).action(async (_commandOptions, command: Command) => {
  const options = command.optsWithGlobals<TopUpOptions>();
  try {
    await topUp(options);
    process.exit(0);
  } catch (error) {
    exitWithErrorLog(error);
  }
});

applyOptions(
  program.command('crypto-fund').description('Top up a wallet with crypto'),
  [...walletOptions, optionMap.value],
).action(async (_commandOptions, command: Command) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: any = command.optsWithGlobals();

  const token = tokenFromOptions(options);
  const value = valueFromOptions(options);

  const privateKey = await privateKeyFromOptions(options);

  const config = configFromOptions(options);

  try {
    await cryptoFund({ privateKey, value, token, config });
    process.exit(0);
  } catch (error) {
    exitWithErrorLog(error);
  }
});

applyOptions(
  program
    .command('upload-folder')
    .description('Upload a folder to a Turbo address')
    .argument('<folderPath>', 'Directory to upload'),
  [...walletOptions, optionMap.token],
).action((directory, options) => {
  console.log('upload-folder TODO', directory, options);
});

if (
  process.argv[1].includes('bin/turbo') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
