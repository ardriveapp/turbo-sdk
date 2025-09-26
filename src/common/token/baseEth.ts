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
import { TokenConfig } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { EthereumToken } from './ethereum.js';

export class BaseEthToken extends EthereumToken {
  constructor({
    logger,
    gatewayUrl = defaultProdGatewayUrls['base-eth'],
    pollingOptions = {
      initialBackoffMs: 2_500,
      maxAttempts: 10,
      pollingIntervalMs: 2_500,
    },
  }: TokenConfig = {}) {
    super({
      logger,
      gatewayUrl,
      pollingOptions,
    });
  }

  protected async getTxAvailability(txId: string): Promise<boolean> {
    const tx = await this.rpcProvider.getTransactionReceipt(txId);

    if (tx) {
      const confirmations = await tx.confirmations();
      if (confirmations >= 1) {
        this.logger.debug('Transaction is available on chain', {
          txId,
          tx,
          confirmations,
        });
        return true;
      }
    }
    this.logger.debug('Transaction not yet available on chain', { txId, tx });
    return false;
  }
}
