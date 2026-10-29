/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { BigNumber } from 'bignumber.js';
import prompts from 'prompts';
import { tokenToBaseMap } from '../../common/index.js';
import { TurboFactory } from '../../node/factory.js';
import { wincPerCredit } from '../constants.js';
import { configFromOptions, tokenFromOptions, turboFromOptions, } from '../utils.js';
export async function cryptoFund(options) {
    const value = options.value;
    const txId = options.txId;
    const address = options.address;
    if (txId !== undefined) {
        const turbo = TurboFactory.unauthenticated(configFromOptions(options));
        const result = await turbo.submitFundTransaction({ txId: txId });
        console.log('Submitted existing crypto fund transaction to payment service: \n', JSON.stringify(result, null, 2));
        return;
    }
    if (value === undefined) {
        throw new Error('Must provide a --value or --transaction-id for crypto-fund command');
    }
    const turbo = await turboFromOptions(options);
    const token = tokenFromOptions(options);
    const tokenAmount = tokenToBaseMap[token](value);
    if (!options.skipConfirmation) {
        const { winc } = await turbo.getWincForToken({ tokenAmount });
        const targetWallet = (await turbo.getTurboCryptoWallets())[token];
        const credits = BigNumber(winc).dividedBy(wincPerCredit).toFixed(12);
        const { confirm } = await prompts({
            type: 'confirm',
            name: 'confirm',
            message: `\nTransaction details:\n\n  Amount: ${value} ${token}\n  Target: ${targetWallet}\n  Est Credits to receive: ${credits}\n  Credit recipient: ${address ?? (await turbo.signer.getNativeAddress())}\n  Note: Network Dependent Gas Fees May Apply\n\nThis payment is non-refundable.  Proceed with transaction?`,
            initial: true,
        });
        if (!confirm) {
            console.log('Aborted crypto fund transaction');
            return;
        }
    }
    const result = await turbo.topUpWithTokens({
        tokenAmount,
        turboCreditDestinationAddress: address,
    });
    console.log('Sent crypto fund transaction: \n', JSON.stringify(result, null, 2));
}
