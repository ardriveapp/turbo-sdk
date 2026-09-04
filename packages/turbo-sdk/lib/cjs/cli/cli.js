#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
const arbundles_1 = require("@dha-team/arbundles");
const commander_1 = require("commander");
const fs_1 = require("fs");
const version_js_1 = require("../version.js");
const arns_js_1 = require("./commands/arns.js");
const fiatEstimate_js_1 = require("./commands/fiatEstimate.js");
const index_js_1 = require("./commands/index.js");
const listShares_js_1 = require("./commands/listShares.js");
const revokeCredits_js_1 = require("./commands/revokeCredits.js");
const shareCredits_js_1 = require("./commands/shareCredits.js");
const tokenPrice_js_1 = require("./commands/tokenPrice.js");
const x402UploadUnsignedData_js_1 = require("./commands/x402UploadUnsignedData.js");
const options_js_1 = require("./options.js");
const utils_js_1 = require("./utils.js");
(0, utils_js_1.applyOptions)(commander_1.program
    .name('turbo')
    .version(version_js_1.version)
    .description('Turbo CLI')
    .helpCommand(true), options_js_1.globalOptions);
(0, utils_js_1.applyOptions)(commander_1.program.command('balance').description('Get balance of a Turbo address'), [options_js_1.optionMap.address, ...options_js_1.walletOptions]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.balance);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('free-status')
    .description('Get the free-tier upload allowance remaining for a Turbo address'), [options_js_1.optionMap.address, ...options_js_1.walletOptions]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.freeStatus);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('payment-history')
    .description("Get the signing wallet's own top-up (payment) history"), [...options_js_1.walletOptions, options_js_1.optionMap.limit, options_js_1.optionMap.cursor]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.paymentHistory);
});
(0, utils_js_1.applyOptions)(commander_1.program.command('top-up').description('Top up a Turbo address with Fiat'), [...options_js_1.walletOptions, options_js_1.optionMap.address, options_js_1.optionMap.value, options_js_1.optionMap.currency]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.topUp);
});
(0, utils_js_1.applyOptions)(commander_1.program.command('crypto-fund').description('Top up a wallet with crypto'), [...options_js_1.walletOptions, options_js_1.optionMap.value, options_js_1.optionMap.txId, options_js_1.optionMap.address]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.cryptoFund);
});
(0, utils_js_1.applyOptions)(commander_1.program.command('upload-folder').description('Upload a folder using Turbo'), options_js_1.uploadFolderOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.uploadFolder);
});
(0, utils_js_1.applyOptions)(commander_1.program.command('upload-file').description('Upload a file using Turbo'), options_js_1.uploadFileOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.uploadFile);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('x402-unsigned-upload')
    .description('Upload a file via Turbo using x402 protocol with unsigned data.'), options_js_1.uploadFileOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, x402UploadUnsignedData_js_1.x402UploadUnsignedFile);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('price')
    .description('Get the current Credits estimate for byte, crypto, or fiat value'), [options_js_1.optionMap.value, options_js_1.optionMap.type, options_js_1.optionMap.currency]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, index_js_1.price);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('token-price')
    .description('Get the current token price for provided byte count'), [options_js_1.optionMap.byteCount]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, tokenPrice_js_1.tokenPrice);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('fiat-estimate')
    .description('Get the current token price for provided byte count'), [options_js_1.optionMap.byteCount, options_js_1.optionMap.currency]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, fiatEstimate_js_1.fiatEstimate);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('share-credits')
    .description('Create a Turbo credit share approval'), options_js_1.shareCreditsOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, shareCredits_js_1.shareCredits);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('revoke-credits')
    .description('Revokes all Turbo credit share approvals for given address'), options_js_1.revokeCreditsOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, revokeCredits_js_1.revokeCredits);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('list-shares')
    .description('Lists all given or received Turbo credit share approvals for specified address or connected wallet'), options_js_1.listSharesOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, listShares_js_1.listShares);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('arns-price')
    .description('Get the Turbo Credit (winc + mARIO) price to buy, extend, increase undernames, or upgrade an ArNS name'), options_js_1.arnsPriceOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.arnsPrice);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('arns-fiat-quote')
    .description('Quote an ArNS purchase paid by credit card (Stripe) - no credits needed'), options_js_1.arnsFiatQuoteOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.arnsFiatQuote);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('buy-arns-name')
    .description('Buy an ArNS name (lease or permabuy) with Turbo Credits'), options_js_1.buyArNSNameOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.buyArNSName);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('extend-arns-lease')
    .description('Extend an ArNS name lease with Turbo Credits'), options_js_1.extendArNSLeaseOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.extendArNSLease);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('increase-arns-undernames')
    .description('Increase the undername limit of an ArNS name with Turbo Credits'), options_js_1.increaseArNSUndernamesOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.increaseArNSUndernames);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('upgrade-arns-name')
    .description('Upgrade an ArNS leased name to a permabuy with Turbo Credits'), options_js_1.upgradeArNSNameOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.upgradeArNSName);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('arns-purchase-status')
    .description('Get the status of an ArNS purchase by its nonce'), options_js_1.arnsPurchaseStatusOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.arnsPurchaseStatus);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('transfer-arns-ant')
    .description('Transfer a Turbo-custodied ANT to a Solana pubkey you control'), options_js_1.transferArNSAntOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.transferArNSAnt);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('set-arns-record')
    .description('Set a resolution record on a Turbo-custodied ANT'), options_js_1.setArNSRecordOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.setArNSRecord);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('remove-arns-record')
    .description('Remove a resolution record (undername) from a Turbo-custodied ANT'), options_js_1.removeArNSRecordOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.removeArNSRecord);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('add-arns-controller')
    .description('Grant controller rights on a Turbo-custodied ANT'), options_js_1.addArNSControllerOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.addArNSController);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('remove-arns-controller')
    .description('Revoke controller rights on a Turbo-custodied ANT'), options_js_1.removeArNSControllerOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.removeArNSController);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('transfer-arns-record')
    .description('Transfer one record (undername) on a Turbo-custodied ANT to another address'), options_js_1.transferArNSRecordOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.transferArNSRecord);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('set-arns-record-metadata')
    .description("Set a record's display name, logo, description, or keywords on a Turbo-custodied ANT"), options_js_1.setArNSRecordMetadataOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.setArNSRecordMetadata);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('remove-arns-record-metadata')
    .description("Clear a record's metadata on a Turbo-custodied ANT"), options_js_1.removeArNSRecordMetadataOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.removeArNSRecordMetadata);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('arns-action-price')
    .description('Preview the Turbo Credit price of a non-purchase ArNS action (set-record, remove-record, ' +
    'set-record-metadata, remove-record-metadata, transfer-record, add-controller, remove-controller, transfer)'), options_js_1.arnsActionPriceOptions).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, arns_js_1.arnsActionPrice);
});
(0, utils_js_1.applyOptions)(commander_1.program
    .command('inspect-data-items')
    .description('Lists all given or received Turbo credit share approvals for specified address or connected wallet'), [options_js_1.optionMap.folderPath]).action(async (_commandOptions, command) => {
    await (0, utils_js_1.runCommand)(command, async (options) => {
        const folderPath = options.folderPath ?? './maybe-broke';
        // read directory /maybe-broken-data-items and check all files within to see if can read
        const dir = (0, fs_1.readdirSync)(folderPath);
        const validDataItemStats = [];
        const invalidDataItemIds = [];
        for (const file of dir) {
            const data = (0, fs_1.readFileSync)('./maybe-broke/' + file);
            try {
                const dataItem = new arbundles_1.DataItem(data);
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
    commander_1.program.parse(process.argv);
}
