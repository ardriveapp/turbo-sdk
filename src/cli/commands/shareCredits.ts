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

import { ShareCreditsOptions } from '../types.js';
import { turboFromOptions } from '../utils.js';

export async function shareCredits(
  options: ShareCreditsOptions,
): Promise<void> {
  const {
    address: approvedAddress,
    value: creditAmount,
    expiresBySeconds,
  } = options;
  if (approvedAddress === undefined) {
    throw new Error(
      'Must provide an approved --address to create approval for',
    );
  }
  if (creditAmount === undefined) {
    throw new Error('Must provide a credit --value to create approval for');
  }

  const turbo = await turboFromOptions(options);

  const approvedWincAmount = new BigNumber(creditAmount)
    .shiftedBy(12)
    .toFixed(0);
  const result = await turbo.shareCredits({
    approvedAddress,
    approvedWincAmount,
    expiresBySeconds:
      expiresBySeconds !== undefined ? +expiresBySeconds : undefined,
  });

  console.log(
    JSON.stringify(
      { message: 'Created credit share approval!', ...result },
      null,
      2,
    ),
  );
}
