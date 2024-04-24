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
import Arweave from '@irys/arweave';
import { BigNumber } from 'bignumber.js';

import {
  BaseTx,
  TokenCreateTxParams,
  TokenTools,
  TurboLogger,
} from '../types.js';
import { sha256B64Url, toB64Url } from '../utils/base64.js';
import { sleep } from '../utils/common.js';
import { TurboWinstonLogger } from './logger.js';

type PollingOptions = {
  maxAttempts: number;
  pollingIntervalMs: number;
  initialBackoffMs: number;
};

export class ArweaveToken implements TokenTools {
  protected logger: TurboLogger;
  protected arweave: Arweave;
  protected mintU: boolean;
  protected pollingOptions: PollingOptions;

  constructor({
    arweave = Arweave.init({
      url: 'https://arweave.net',
    }),
    logger = new TurboWinstonLogger(),
    mintU = true,
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 3_000,
      initialBackoffMs: 7_000,
    },
  }: {
    arweave?: Arweave;
    logger?: TurboLogger;
    mintU?: boolean;
    pollingOptions?: PollingOptions;
  }) {
    this.arweave = arweave;
    this.logger = logger;
    this.mintU = mintU;
    this.pollingOptions = pollingOptions;
  }

  public async createSignedTx({
    feeMultiplier,
    target,
    tokenAmount,
    signer,
  }: TokenCreateTxParams): Promise<BaseTx> {
    const tx = await this.arweave.createTransaction({
      target,
      quantity: tokenAmount.toString(),
      data: '',
    });

    if (feeMultiplier !== 1) {
      tx.reward = BigNumber(tx.reward)
        .times(BigNumber(feeMultiplier))
        .toFixed(0, BigNumber.ROUND_UP);
    }

    if (this.mintU) {
      tx.addTag('App-Name', 'SmartWeaveAction');
      tx.addTag('App-Version', '0.3.0'); // cspell:disable
      tx.addTag('Contract', 'KTzTXT_ANmF84fWEKHzWURD1LWd9QaFR9yfYUwH2Lxw'); // cspell:enable
      tx.addTag('Input', JSON.stringify({ function: 'mint' }));
    }

    const publicKeyB64Url = toB64Url(await signer.getPublicKey());

    tx.setOwner(publicKeyB64Url);

    const dataToSign = await tx.getSignatureData();
    const signatureBuffer = Buffer.from(await signer.signData(dataToSign));
    const id = sha256B64Url(signatureBuffer);

    tx.setSignature({
      id: id,
      owner: publicKeyB64Url,
      signature: toB64Url(signatureBuffer),
    });

    return tx;
  }

  public async pollForTxBeingAvailable({
    txId,
  }: {
    txId: string;
  }): Promise<void> {
    const { maxAttempts, pollingIntervalMs, initialBackoffMs } =
      this.pollingOptions;

    this.logger.debug('Polling for transaction...', { txId });
    await sleep(initialBackoffMs);

    let attempts = 0;
    while (attempts < maxAttempts) {
      let transaction;
      attempts++;

      try {
        const response = await this.arweave.api.post('/graphql', {
          query: `
          query {
            transaction(id: "${txId}") {
              recipient
              owner {
                address
              }
              quantity {
                winston
              }
            }
          }
          `,
        });

        transaction = response?.data?.data?.transaction;
      } catch (err) {
        // Continue retries when request errors
        this.logger.debug('Failed to poll for transaction...', { err });
      }

      if (transaction) {
        return;
      }
      this.logger.debug('Transaction not found...', {
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

  public async submitTx({ tx }: { tx: BaseTx }): Promise<void> {
    try {
      const response = await this.arweave.transactions.post(tx);

      if (response.status !== 200) {
        throw new Error(
          'Failed to post transaction -- ' +
            `Status ${response.status}, ${response.statusText}`,
        );
      }
      this.logger.debug('Successfully posted fund transaction...', { tx });
    } catch (err) {
      throw new Error(
        `Failed to post transaction -- ${
          err instanceof Error ? err.message : err
        }`,
      );
    }

    this.logger.debug('Posted transaction...', { tx });
  }
}

export const WinstonToTokenAmount = (winston: BigNumber.Value) => winston;
export const ARToTokenAmount = (ar: BigNumber.Value) =>
  new BigNumber(ar).times(1e12).valueOf();