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
import { Command, program } from 'commander';
import { readFileSync, readdirSync } from 'fs';

import { version } from '../version.js';
import {
  addArNSController,
  arnsActionPrice,
  arnsFiatQuote,
  arnsPrice,
  arnsPurchaseStatus,
  buyArNSName,
  extendArNSLease,
  increaseArNSUndernames,
  removeArNSController,
  removeArNSRecord,
  removeArNSRecordMetadata,
  setArNSRecord,
  setArNSRecordMetadata,
  transferArNSAnt,
  transferArNSRecord,
  upgradeArNSName,
} from './commands/arns.js';
import { fiatEstimate } from './commands/fiatEstimate.js';
import {
  balance,
  cryptoFund,
  freeStatus,
  paymentHistory,
  price,
  topUp,
  uploadFile,
  uploadFolder,
} from './commands/index.js';
import { listShares } from './commands/listShares.js';
import { revokeCredits } from './commands/revokeCredits.js';
import { shareCredits } from './commands/shareCredits.js';
import { tokenPrice } from './commands/tokenPrice.js';
import { x402UploadUnsignedFile } from './commands/x402UploadUnsignedData.js';
import {
  addArNSControllerOptions,
  arnsActionPriceOptions,
  arnsFiatQuoteOptions,
  arnsPriceOptions,
  arnsPurchaseStatusOptions,
  buyArNSNameOptions,
  extendArNSLeaseOptions,
  globalOptions,
  increaseArNSUndernamesOptions,
  listSharesOptions,
  optionMap,
  removeArNSControllerOptions,
  removeArNSRecordMetadataOptions,
  removeArNSRecordOptions,
  revokeCreditsOptions,
  setArNSRecordMetadataOptions,
  setArNSRecordOptions,
  shareCreditsOptions,
  transferArNSAntOptions,
  transferArNSRecordOptions,
  upgradeArNSNameOptions,
  uploadFileOptions,
  uploadFolderOptions,
  walletOptions,
} from './options.js';
import {
  ArNSFiatQuoteOptions,
  TopUpOptions,
  UploadFolderOptions,
} from './types.js';
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
  program
    .command('free-status')
    .description(
      'Get the free-tier upload allowance remaining for a Turbo address',
    ),
  [optionMap.address, ...walletOptions],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, freeStatus);
});

applyOptions(
  program
    .command('payment-history')
    .description("Get the signing wallet's own top-up (payment) history"),
  [...walletOptions, optionMap.limit, optionMap.cursor],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, paymentHistory);
});

applyOptions(
  program.command('top-up').description('Top up a Turbo address with Fiat'),
  [...walletOptions, optionMap.address, optionMap.value, optionMap.currency],
).action(async (_commandOptions, command: Command) => {
  await runCommand<TopUpOptions>(command, topUp);
});

applyOptions(
  program.command('crypto-fund').description('Top up a wallet with crypto'),
  [...walletOptions, optionMap.value, optionMap.txId, optionMap.address],
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

applyOptions(
  program
    .command('x402-unsigned-upload')
    .description(
      'Upload a file via Turbo using x402 protocol with unsigned data.',
    ),
  uploadFileOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, x402UploadUnsignedFile);
});

applyOptions(
  program
    .command('price')
    .description(
      'Get the current Credits estimate for byte, crypto, or fiat value',
    ),
  [optionMap.value, optionMap.type, optionMap.currency],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, price);
});

applyOptions(
  program
    .command('token-price')
    .description('Get the current token price for provided byte count'),
  [optionMap.byteCount],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, tokenPrice);
});

applyOptions(
  program
    .command('fiat-estimate')
    .description('Get the current token price for provided byte count'),
  [optionMap.byteCount, optionMap.currency],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, fiatEstimate);
});

applyOptions(
  program
    .command('share-credits')
    .description('Create a Turbo credit share approval'),
  shareCreditsOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, shareCredits);
});

applyOptions(
  program
    .command('revoke-credits')
    .description('Revokes all Turbo credit share approvals for given address'),
  revokeCreditsOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, revokeCredits);
});

applyOptions(
  program
    .command('list-shares')
    .description(
      'Lists all given or received Turbo credit share approvals for specified address or connected wallet',
    ),
  listSharesOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, listShares);
});

applyOptions(
  program
    .command('arns-price')
    .description(
      'Get the Turbo Credit (winc + mARIO) price to buy, extend, increase undernames, or upgrade an ArNS name',
    ),
  arnsPriceOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, arnsPrice);
});

applyOptions(
  program
    .command('arns-fiat-quote')
    .description(
      'Quote an ArNS purchase paid by credit card (Stripe) - no credits needed',
    ),
  arnsFiatQuoteOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand<ArNSFiatQuoteOptions>(command, arnsFiatQuote);
});

applyOptions(
  program
    .command('buy-arns-name')
    .description('Buy an ArNS name (lease or permabuy) with Turbo Credits'),
  buyArNSNameOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, buyArNSName);
});

applyOptions(
  program
    .command('extend-arns-lease')
    .description('Extend an ArNS name lease with Turbo Credits'),
  extendArNSLeaseOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, extendArNSLease);
});

applyOptions(
  program
    .command('increase-arns-undernames')
    .description(
      'Increase the undername limit of an ArNS name with Turbo Credits',
    ),
  increaseArNSUndernamesOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, increaseArNSUndernames);
});

applyOptions(
  program
    .command('upgrade-arns-name')
    .description(
      'Upgrade an ArNS leased name to a permabuy with Turbo Credits',
    ),
  upgradeArNSNameOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, upgradeArNSName);
});

applyOptions(
  program
    .command('arns-purchase-status')
    .description('Get the status of an ArNS purchase by its nonce'),
  arnsPurchaseStatusOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, arnsPurchaseStatus);
});

applyOptions(
  program
    .command('transfer-arns-ant')
    .description(
      'Transfer a Turbo-custodied ANT to a Solana pubkey you control',
    ),
  transferArNSAntOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, transferArNSAnt);
});

applyOptions(
  program
    .command('set-arns-record')
    .description('Set a resolution record on a Turbo-custodied ANT'),
  setArNSRecordOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, setArNSRecord);
});

applyOptions(
  program
    .command('remove-arns-record')
    .description(
      'Remove a resolution record (undername) from a Turbo-custodied ANT',
    ),
  removeArNSRecordOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, removeArNSRecord);
});

applyOptions(
  program
    .command('add-arns-controller')
    .description('Grant controller rights on a Turbo-custodied ANT'),
  addArNSControllerOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, addArNSController);
});

applyOptions(
  program
    .command('remove-arns-controller')
    .description('Revoke controller rights on a Turbo-custodied ANT'),
  removeArNSControllerOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, removeArNSController);
});

applyOptions(
  program
    .command('transfer-arns-record')
    .description(
      'Transfer one record (undername) on a Turbo-custodied ANT to another address',
    ),
  transferArNSRecordOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, transferArNSRecord);
});

applyOptions(
  program
    .command('set-arns-record-metadata')
    .description(
      "Set a record's display name, logo, description, or keywords on a Turbo-custodied ANT",
    ),
  setArNSRecordMetadataOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, setArNSRecordMetadata);
});

applyOptions(
  program
    .command('remove-arns-record-metadata')
    .description("Clear a record's metadata on a Turbo-custodied ANT"),
  removeArNSRecordMetadataOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, removeArNSRecordMetadata);
});

applyOptions(
  program
    .command('arns-action-price')
    .description(
      'Preview the Turbo Credit price of a non-purchase ArNS action (set-record, remove-record, ' +
        'set-record-metadata, remove-record-metadata, transfer-record, add-controller, remove-controller, transfer)',
    ),
  arnsActionPriceOptions,
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, arnsActionPrice);
});

applyOptions(
  program
    .command('inspect-data-items')
    .description(
      'Lists all given or received Turbo credit share approvals for specified address or connected wallet',
    ),
  [optionMap.folderPath],
).action(async (_commandOptions, command: Command) => {
  await runCommand(command, async (options) => {
    const folderPath = options.folderPath ?? './maybe-broke';

    // read directory /maybe-broken-data-items and check all files within to see if can read
    const dir = readdirSync(folderPath);

    const validDataItemStats: {
      id: string;
      size: number;
      dataStart: number;
      signatureType: number;
    }[] = [];
    const invalidDataItemIds: string[] = [];

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
      } catch (e) {
        console.log('error', e);
      }
    }

    console.log(
      JSON.stringify(
        {
          validDataItemStats,
          invalidDataItemIds,
          validDataItemIds: validDataItemStats.map((item) => item.id),
        },
        null,
        2,
      ),
    );
  });
});

if (
  process.argv[1].includes('bin/turbo') || // Running from global .bin
  process.argv[1].includes('cli/cli') // Running from source
) {
  program.parse(process.argv);
}
