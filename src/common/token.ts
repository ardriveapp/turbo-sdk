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
import Arweave from 'arweave';
import * as Transaction from 'arweave/node/lib/transaction.js';
import { BigNumber } from 'bignumber.js';

import { BaseToken, TurboDataItemSigner, TurboLogger } from '../types.js';
import { sha256B64Url, toB64Url } from '../utils/base64.js';

type PollingOptions = {
  maxAttempts: number;
  pollingIntervalMs: number;
  initialBackoffMs: number;
};

export class ArweaveToken implements BaseToken<Transaction.default> {
  protected logger: TurboLogger;
  protected arweave: Arweave;
  protected mintU: boolean;
  protected pollingOptions: PollingOptions;

  constructor({
    arweave,
    logger,
    mintU = true,
    pollingOptions = {
      maxAttempts: 30,
      pollingIntervalMs: 1_000,
      initialBackoffMs: 5_000,
    },
  }: {
    arweave: Arweave;
    logger: TurboLogger;
    mintU?: boolean;
    pollingOptions?: PollingOptions;
  }) {
    this.arweave = arweave;
    this.logger = logger;
    this.mintU = mintU;
    this.pollingOptions = pollingOptions;
  }

  public async createTx({
    feeMultiplier,
    target,
    tokenAmount,
  }: {
    target: string;
    tokenAmount: BigNumber;
    feeMultiplier: number;
  }): Promise<Transaction.default> {
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

    return tx;
  }

  public async signTx({
    tx,
    signer,
  }: {
    tx: Transaction.default;
    signer: TurboDataItemSigner;
  }): Promise<Transaction.default> {
    const publicKeyB64Url = toB64Url(await signer.getPublicKey());

    tx.setOwner(publicKeyB64Url);

    const dataToSign = await tx.getSignatureData();
    const signatureBuffer = Buffer.from(await signer.signTx(dataToSign));
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

    await new Promise((resolve) => setTimeout(resolve, initialBackoffMs));

    let attempts = 0;
    while (attempts < maxAttempts) {
      const response = await this.arweave.api
        .post('/graphql', {
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
        })
        .catch((err) => {
          // Continue retries when request errors
          this.logger.error('Failed to poll for transaction...', { err });
          return undefined;
        });

      const transaction = response?.data?.data?.transaction;

      if (transaction) {
        return;
      }
      attempts++;
      this.logger.debug('Transaction not found after polling...', {
        txId,
        attempts,
      });
      await new Promise((resolve) => setTimeout(resolve, pollingIntervalMs));
    }

    throw new Error(
      'Transaction not found after polling, transaction id: ' + txId,
    );
  }

  public async submitTx({ tx }: { tx: Transaction.default }): Promise<void> {
    const response = await this.arweave.transactions.post(tx).catch((err) => {
      this.logger.error('Failed to post transaction...', { err });
      return {
        status: 500,
        statusText:
          err instanceof Error ? err.message : 'Failed to post Arweave Tx!',
      };
    });

    if (response.status !== 200) {
      throw new Error(
        'Failed to post transaction -- ' +
          `Status ${response.status}, ${response.statusText}`,
      );
    }

    this.logger.debug('Posted transaction...', { tx });
  }
}
