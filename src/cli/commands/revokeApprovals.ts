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
import { RevokeApprovalsOptions } from '../types.js';
import { turboFromOptions } from '../utils.js';

export async function revokeApprovals(
  options: RevokeApprovalsOptions,
): Promise<void> {
  const { address: revokedAddress } = options;
  if (revokedAddress === undefined) {
    throw new Error(
      'Must provide an approved --address to revoke approvals for',
    );
  }

  const turbo = await turboFromOptions(options);

  const revokedApprovals = await turbo.revokeDelegatedPaymentApprovals({
    revokedAddress,
  });

  console.log(
    JSON.stringify(
      { message: 'Revoked delegated payment approvals!', revokedApprovals },
      null,
      2,
    ),
  );
}
