/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { ethers } from 'ethers';

import {
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
} from '../types.js';
import { TurboWinstonLogger } from './logger.js';

export class EthereumToken implements TokenTools {
  protected logger: TurboLogger;
  protected gatewayUrl: string;
  protected pollingOptions: TokenPollingOptions;

  protected rpcProvider: ethers.JsonRpcProvider;

  constructor({
    logger = new TurboWinstonLogger(),
    gatewayUrl = 'https://cloudflare-eth.com/',
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 3_000,
      initialBackoffMs: 5_000,
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
      provider: this.rpcProvider,
    });

    return {
      id: txId,
      target,
    };
  }

  public async pollForTxBeingAvailable({
    txId,
  }: {
    txId: string;
  }): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.pollingOptions.initialBackoffMs),
    );

    let attempts = 0;
    while (attempts < this.pollingOptions.maxAttempts) {
      const tx = await this.rpcProvider.getTransaction(txId);

      if (tx) {
        return;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, this.pollingOptions.pollingIntervalMs),
      );
      attempts++;
    }

    throw new Error('Transaction not found');
  }
}
