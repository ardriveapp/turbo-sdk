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
import { DataItem } from '@dha-team/arbundles';
import { program } from 'commander';
import { readFileSync, readdirSync } from 'fs';
import { version } from '../version.js';
import { fiatEstimate } from './commands/fiatEstimate.js';
import { balance, cryptoFund, price, topUp, uploadFile, uploadFolder, } from './commands/index.js';
import { listShares } from './commands/listShares.js';
import { revokeCredits } from './commands/revokeCredits.js';
import { shareCredits } from './commands/shareCredits.js';
import { tokenPrice } from './commands/tokenPrice.js';
import { x402UploadUnsignedFile } from './commands/x402UploadUnsignedData.js';
import { globalOptions, listSharesOptions, optionMap, revokeCreditsOptions, shareCreditsOptions, uploadFileOptions, uploadFolderOptions, walletOptions, } from './options.js';
import { applyOptions, runCommand } from './utils.js';
applyOptions(program
    .name('turbo')
    .version(version)
    .description('Turbo CLI')
    .helpCommand(true), globalOptions);
applyOptions(program.command('balance').description('Get balance of a Turbo address'), [optionMap.address, ...walletOptions]).action(async (_commandOptions, command) => {
    await runCommand(command, balance);
});
applyOptions(program.command('top-up').description('Top up a Turbo address with Fiat'), [...walletOptions, optionMap.address, optionMap.value, optionMap.currency]).action(async (_commandOptions, command) => {
    await runCommand(command, topUp);
});
applyOptions(program.command('crypto-fund').description('Top up a wallet with crypto'), [...walletOptions, optionMap.value, optionMap.txId, optionMap.address]).action(async (_commandOptions, command) => {
    await runCommand(command, cryptoFund);
});
applyOptions(program.command('upload-folder').description('Upload a folder using Turbo'), uploadFolderOptions).action(async (_commandOptions, command) => {
    await runCommand(command, uploadFolder);
});
applyOptions(program.command('upload-file').description('Upload a file using Turbo'), uploadFileOptions).action(async (_commandOptions, command) => {
    await runCommand(command, uploadFile);
});
applyOptions(program
    .command('x402-unsigned-upload')
    .description('Upload a file via Turbo using x402 protocol with unsigned data.'), uploadFileOptions).action(async (_commandOptions, command) => {
    await runCommand(command, x402UploadUnsignedFile);
});
applyOptions(program
    .command('price')
    .description('Get the current Credits estimate for byte, crypto, or fiat value'), [optionMap.value, optionMap.type, optionMap.currency]).action(async (_commandOptions, command) => {
    await runCommand(command, price);
});
applyOptions(program
    .command('token-price')
    .description('Get the current token price for provided byte count'), [optionMap.byteCount]).action(async (_commandOptions, command) => {
    await runCommand(command, tokenPrice);
});
applyOptions(program
    .command('fiat-estimate')
    .description('Get the current token price for provided byte count'), [optionMap.byteCount, optionMap.currency]).action(async (_commandOptions, command) => {
    await runCommand(command, fiatEstimate);
});
applyOptions(program
    .command('share-credits')
    .description('Create a Turbo credit share approval'), shareCreditsOptions).action(async (_commandOptions, command) => {
    await runCommand(command, shareCredits);
});
applyOptions(program
    .command('revoke-credits')
    .description('Revokes all Turbo credit share approvals for given address'), revokeCreditsOptions).action(async (_commandOptions, command) => {
    await runCommand(command, revokeCredits);
});
applyOptions(program
    .command('list-shares')
    .description('Lists all given or received Turbo credit share approvals for specified address or connected wallet'), listSharesOptions).action(async (_commandOptions, command) => {
    await runCommand(command, listShares);
});
applyOptions(program
    .command('inspect-data-items')
    .description('Lists all given or received Turbo credit share approvals for specified address or connected wallet'), [optionMap.folderPath]).action(async (_commandOptions, command) => {
    await runCommand(command, async (options) => {
        const folderPath = options.folderPath ?? './maybe-broke';
        // read directory /maybe-broken-data-items and check all files within to see if can read
        const dir = readdirSync(folderPath);
        const validDataItemStats = [];
        const invalidDataItemIds = [];
        for (const file of dir) {
            const data = readFileSync('./maybe-broke/' + file);
            try {
                const dataItem = new DataItem(data);
                const id = dataItem.id;
                console.log('id', id);
                const isValid = await dataItem.isValid().catch((e) => {
                    console.log('error', e);
                });
                if (!isValid) {
                    invalidDataItemIds.push(id);
                    continue;
                }
                const size = dataItem.getRaw().byteLength;
                const dataStart = dataItem.getStartOfData();
                validDataItemStats.push({
                    id,
                    size,
                    dataStart,
                    signatureType: dataItem.signatureType,
                });
            }
            catch (e) {
                console.log('error', e);
            }
        }
        console.log(JSON.stringify({
            validDataItemStats,
            invalidDataItemIds,
            validDataItemIds: validDataItemStats.map((item) => item.id),
        }, null, 2));
    });
});
if (process.argv[1].includes('bin/turbo') || // Running from global .bin
    process.argv[1].includes('cli/cli') // Running from source
) {
    program.parse(process.argv);
}
