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
import { TurboFactory } from '../../node/factory.js';
import { AddressOptions } from '../types.js';
import { addressOrPrivateKeyFromOptions, configFromOptions } from '../utils.js';

export async function balance(options: AddressOptions) {
  const config = configFromOptions(options);
  const { address, privateKey } = await addressOrPrivateKeyFromOptions(options);

  const { winc, givenApprovals, receivedApprovals } = await (async () => {
    if (address !== undefined) {
      return TurboFactory.unauthenticated(config).getBalance(address);
    }
    if (privateKey !== undefined) {
      throw new Error('Must provide an (--address) or use a valid wallet');
    }
    return TurboFactory.authenticated({
      ...config,
      privateKey,
    }).getBalance();
  })();

  console.log(
    `Turbo Balance for Native Address "${address}"\nCredits: ${
      +winc / 1_000_000_000_000
    }${
      givenApprovals.length > 0
        ? `\nGiven Approvals:\n${JSON.stringify(givenApprovals, null, 2)}`
        : ''
    }${
      receivedApprovals.length > 0
        ? `\nReceived Approvals:\n${JSON.stringify(receivedApprovals, null, 2)}`
        : ''
    }`,
  );
}
