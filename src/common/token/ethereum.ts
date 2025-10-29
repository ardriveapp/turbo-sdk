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
import { ethers, hexlify, toUtf8Bytes } from 'ethers';

import {
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
  UserAddress,
} from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { TurboWinstonLogger } from '../logger.js';

export const weiToTokenAmount = (wei: BigNumber.Value) => wei;
export const ETHToTokenAmount = (eth: BigNumber.Value) =>
  new BigNumber(eth).times(1e18).valueOf();

export const defaultEthereumPollingOptions: TokenPollingOptions = {
  initialBackoffMs: 25_000,
  maxAttempts: 10,
  pollingIntervalMs: 4_000,
};

export class EthereumToken implements TokenTools {
  protected logger: TurboLogger;
  protected gatewayUrl: string;
  protected pollingOptions: TokenPollingOptions;

  protected rpcProvider: ethers.JsonRpcProvider;

  constructor({
    logger = TurboWinstonLogger.default,
    gatewayUrl = defaultProdGatewayUrls.ethereum,
    pollingOptions = defaultEthereumPollingOptions,
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
    turboCreditDestinationAddress,
  }: TokenCreateTxParams): Promise<{
    id: string;
    target: string;
  }> {
    try {
      // convert wei to eth
      const eth = tokenAmount.shiftedBy(-18);

      const txId = await signer.sendTransaction({
        target,
        amount: eth,
        gatewayUrl: this.gatewayUrl,
        turboCreditDestinationAddress,
      });

      return {
        id: txId,
        target,
      };
    } catch (e) {
      this.logger.error('Error creating and submitting Ethereum tx', {
        error: e instanceof Error ? e.message : e,
        target,
        tokenAmount,
        rpcEndpoint: this.gatewayUrl,
      });
      throw e;
    }
  }

  protected async getTxAvailability(txId: string): Promise<boolean> {
    const tx = await this.rpcProvider.getTransaction(txId);

    if (tx) {
      this.logger.debug('Transaction is available on chain', { txId, tx });
      return true;
    }
    this.logger.debug('Transaction not yet available on chain', { txId });
    return false;
  }

  public async pollTxAvailability({ txId }: { txId: string }): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, this.pollingOptions.initialBackoffMs),
    );

    let attempts = 0;
    while (attempts < this.pollingOptions.maxAttempts) {
      try {
        const txIsAvailable = await this.getTxAvailability(txId);

        if (txIsAvailable) {
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

    throw new Error(`Transaction ${txId} not found after polling!`);
  }
}

export function ethDataFromTurboCreditDestinationAddress(
  turboCreditDestinationAddress: UserAddress | undefined,
): string | undefined {
  if (turboCreditDestinationAddress !== undefined) {
    return hexlify(
      toUtf8Bytes(
        'turboCreditDestinationAddress=' + turboCreditDestinationAddress,
      ),
    );
  }
  return undefined;
}
