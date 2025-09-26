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
import { ethers } from 'ethers';

import {
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
} from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { TurboWinstonLogger } from '../logger.js';

export const weiToTokenAmount = (wei: BigNumber.Value) => wei;
export const ETHToTokenAmount = (eth: BigNumber.Value) =>
  new BigNumber(eth).times(1e18).valueOf();

export class EthereumToken implements TokenTools {
  protected logger: TurboLogger;
  protected gatewayUrl: string;
  protected pollingOptions: TokenPollingOptions;

  protected rpcProvider: ethers.JsonRpcProvider;

  constructor({
    logger = TurboWinstonLogger.default,
    gatewayUrl = defaultProdGatewayUrls.ethereum,
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 4_000,
      initialBackoffMs: 10_000,
    },
  }: TokenConfig = {}) {
    this.logger = logger;
    this.gatewayUrl = gatewayUrl;
    this.pollingOptions = pollingOptions;

    this.rpcProvider = new ethers.JsonRpcProvider(gatewayUrl);
  }

  public async createAndSubmitTx({
    target,
    tokenAmount,
    signer,
  }: TokenCreateTxParams): Promise<{
    id: string;
    target: string;
  }> {
    // convert wei to eth
    const eth = tokenAmount.shiftedBy(-18);
    const txId = await signer.sendTransaction({
      target,
      amount: eth,
      gatewayUrl: this.gatewayUrl,
    });

    return {
      id: txId,
      target,
    };
  }

  public async pollTxAvailability({ txId }: { txId: string }): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.pollingOptions.initialBackoffMs),
    );

    let attempts = 0;
    while (attempts < this.pollingOptions.maxAttempts) {
      try {
        const tx = await this.rpcProvider.getTransaction(txId);

        if (tx) {
          this.logger.debug('Transaction found on chain', { txId, tx });
          return;
        }
      } catch (e) {
        this.logger.debug('Error polling for tx', { txId, e });
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.pollingOptions.pollingIntervalMs),
      );
      attempts++;
    }

    throw new Error('Transaction not found after polling!');
  }
}
