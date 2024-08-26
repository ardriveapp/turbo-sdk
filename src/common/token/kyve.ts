/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { KyveClient } from '@kyvejs/sdk';
import { AxiosResponse } from 'axios';
import { BigNumber } from 'bignumber.js';

import {
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
} from '../../types.js';
import { createAxiosInstance } from '../../utils/axiosClient.js';
import { sleep } from '../../utils/common.js';
import { TurboWinstonLogger } from '../logger.js';

type KyveTransferTx = {
  '@type': '/cosmos.bank.v1beta1.MsgSend';
  from_address: string;
  to_address: string;
  amount: { denom: 'ukyve'; amount: string }[];
};

type KyveTx = Record<string, unknown>;

type KyveResponseWithTxResponse = {
  tx_response: {
    code: number;
    height: string;
    tx: {
      '@type': '/cosmos.tx.v1beta1.Tx';
      body: {
        messages: [KyveTx | KyveTransferTx];
      };
    };
  };
};
type KyveBlockResponse = {
  block: {
    height: string;
  };
};
type KyveErrorResponse = {
  code: number;
  message: string;
};
type KyveApiResponse =
  | KyveResponseWithTxResponse
  | KyveErrorResponse
  | KyveBlockResponse;

function hasKyveTxResponse(
  response: KyveApiResponse,
): response is KyveResponseWithTxResponse {
  return (response as KyveResponseWithTxResponse).tx_response !== undefined;
}

export const ukyveToTokenAmount = (winston: BigNumber.Value) => winston;
export const KYVEToTokenAmount = (sol: BigNumber.Value) =>
  new BigNumber(sol).times(1e6).valueOf();

export class KyveToken implements TokenTools {
  protected logger: TurboLogger;
  protected gatewayUrl: string;
  protected pollingOptions: TokenPollingOptions;

  protected kyveClient: KyveClient;

  constructor({
    logger = TurboWinstonLogger.default,
    gatewayUrl = 'https://api.kyve.network/',
    pollingOptions = {
      maxAttempts: 5,
      pollingIntervalMs: 1_000,
      initialBackoffMs: 500,
    },
  }: TokenConfig) {
    this.logger = logger;

    this.gatewayUrl = gatewayUrl;
    this.pollingOptions = pollingOptions;
  }

  public async createAndSubmitTx({
    target,
    tokenAmount,
    signer,
  }: TokenCreateTxParams): Promise<{
    id: string;
    target: string;
  }> {
    const id = await signer.sendTransaction({
      amount: tokenAmount,
      target,
      gatewayUrl: this.gatewayUrl,
    });

    return { id, target };
  }

  public async pollForTxBeingAvailable({
    txId,
  }: {
    txId: string;
  }): Promise<void> {
    const { maxAttempts, pollingIntervalMs, initialBackoffMs } =
      this.pollingOptions;

    this.logger.debug('Polling for transaction...', {
      txId,
      pollingOptions: this.pollingOptions,
    });
    await sleep(initialBackoffMs);

    let attempts = 0;
    while (attempts < maxAttempts) {
      let res: AxiosResponse<KyveApiResponse> | undefined = undefined;
      attempts++;

      const axios = createAxiosInstance({
        axiosConfig: { baseURL: this.gatewayUrl },
      });

      try {
        res = await axios.get<KyveApiResponse>('cosmos/tx/v1beta1/txs/' + txId);
      } catch (err) {
        // Continue retries when request errors
        this.logger.debug('Failed to poll for transaction...', { err });
      }

      const data = res?.data;

      if (data !== undefined && hasKyveTxResponse(data)) {
        if (data.tx_response.code !== 0) {
          throw new Error(`Transaction failed: ${data.tx_response.code}`);
        }
        return;
      }

      this.logger.debug('Transaction not found, polling...', {
        txId,
        attempts,
        maxAttempts,
        pollingIntervalMs,
      });
      await sleep(pollingIntervalMs);
    }

    throw new Error(
      'Transaction not found after polling, transaction id: ' + txId,
    );
  }
}
