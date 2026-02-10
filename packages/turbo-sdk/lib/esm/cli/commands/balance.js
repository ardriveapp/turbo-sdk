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
import { TurboFactory } from '../../node/factory.js';
import { wincPerCredit } from '../constants.js';
import { addressOrPrivateKeyFromOptions, configFromOptions } from '../utils.js';
export async function balance(options) {
    const config = configFromOptions(options);
    const { address, privateKey } = await addressOrPrivateKeyFromOptions(options);
    const { effectiveBalance, nativeAddress, winc, controlledWinc } = await (async () => {
        if (address !== undefined) {
            return {
                ...(await TurboFactory.unauthenticated(config).getBalance(address)),
                nativeAddress: address,
            };
        }
        if (privateKey === undefined) {
            throw new Error('Must provide an (--address) or use a valid wallet');
        }
        const turbo = TurboFactory.authenticated({
            ...config,
            privateKey,
        });
        return {
            ...(await turbo.getBalance()),
            nativeAddress: await turbo.signer.getNativeAddress(),
        };
    })();
    console.log(`Turbo Balance for Native Address "${nativeAddress}"\nEffective Credits: ${+effectiveBalance / wincPerCredit}${winc === controlledWinc
        ? ''
        : `\nCredits Shared to Other Wallets: ${BigNumber(controlledWinc)
            .minus(winc)
            .div(wincPerCredit)}`}`);
}
