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
import {
  balance,
  cryptoFund,
  topUp,
  uploadFile,
  uploadFolder,
} from './commands/index.js';
import {
  globalOptions,
  optionMap,
  uploadFileOptions,
  uploadFolderOptions,
  walletOptions,
} from './options.js';
import { TopUpOptions, UploadFolderOptions } from './types.js';
import { applyOptions, runCommand } from './utils.js';

applyOptions(
  program
    .name('turbo')
    .version(version)
    .description('Turbo CLI')
    .helpCommand(true),
  globalOptions,
);

applyOptions(
  program.command('balance').description('Get balance of a Turbo address'),
  [optionMap.address, ...walletOptions],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, balance);
});

applyOptions(
  program.command('top-up').description('Top up a Turbo address with Fiat'),
  [...walletOptions, optionMap.address, optionMap.value, optionMap.currency],
).action(async (_commandOptions, command: Command) => {
  await runCommand<TopUpOptions>(command, topUp);
});

applyOptions(
  program.command('crypto-fund').description('Top up a wallet with crypto'),
  [...walletOptions, optionMap.value, optionMap.txId],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, cryptoFund);
});

applyOptions(
  program.command('upload-folder').description('Upload a folder using Turbo'),
  uploadFolderOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand<UploadFolderOptions>(command, uploadFolder);
});

applyOptions(
  program.command('upload-file').description('Upload a file using Turbo'),
  uploadFileOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, uploadFile);
});

if (
  process.argv[1].includes('bin/turbo') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
