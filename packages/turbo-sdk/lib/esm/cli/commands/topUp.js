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
import { exec } from 'child_process';
import { currencyMap } from '../../common/currency.js';
import { TurboFactory } from '../../node/factory.js';
import { sleep } from '../../utils/common.js';
import { addressOrPrivateKeyFromOptions, configFromOptions, currencyFromOptions, } from '../utils.js';
function openUrl(url) {
    if (process.platform === 'darwin') {
        // macOS
        exec(`open ${url}`);
    }
    else if (process.platform === 'win32') {
        // Windows
        exec(`start "" "${url}"`, { windowsHide: true });
    }
    else {
        // Linux/Unix
        open(url);
    }
}
export async function topUp(options) {
    const config = configFromOptions(options);
    const { address, privateKey } = await addressOrPrivateKeyFromOptions(options);
    const value = options.value;
    if (value === undefined) {
        throw new Error('Must provide a --value to top up');
    }
    const currency = currencyFromOptions(options) ?? 'usd';
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
    console.log('Got Checkout Session\n' + JSON.stringify({ url, paymentAmount, winc }));
    console.log('Opening checkout session in browser...');
    await sleep(2000);
    openUrl(url);
}
