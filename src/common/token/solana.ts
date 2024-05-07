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
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureStatus,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import bs58 from 'bs58';

import {
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
} from '../../types.js';
import { sleep } from '../../utils/common.js';
import { TurboWinstonLogger } from '../logger.js';

export const lamportToTokenAmount = (winston: BigNumber.Value) => winston;
export const SOLToTokenAmount = (sol: BigNumber.Value) =>
  new BigNumber(sol).times(1e9).valueOf();

export class SolanaToken implements TokenTools {
  protected logger: TurboLogger;
  protected connection: Connection;
  protected gatewayUrl: string;
  protected pollingOptions: TokenPollingOptions;

  constructor({
    logger = new TurboWinstonLogger(),
    gatewayUrl = 'https://api.mainnet-beta.solana.com',
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 5_000,
      initialBackoffMs: 7_000,
    },
  }: TokenConfig = {}) {
    this.logger = logger;

    this.gatewayUrl = gatewayUrl;
    this.connection = new Connection(gatewayUrl, 'confirmed');
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
    const publicKey = new PublicKey(bs58.encode(await signer.getPublicKey()));
    const tx = new Transaction({
      feePayer: publicKey,
      ...(await this.connection.getLatestBlockhash()),
    });

    tx.add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(target),
        lamports: +new BigNumber(tokenAmount),
      }),
    );

    const serializedTx = tx.serializeMessage();
    const signature = await signer.signData(serializedTx);

    tx.addSignature(publicKey, Buffer.from(signature));

    const id = bs58.encode(signature);
    await this.submitTx(tx, id);

    return { id, target };
  }

  private async submitTx(tx: Transaction, id: string): Promise<void> {
    this.logger.debug('Submitting fund transaction...', { id });

    await this.connection.sendRawTransaction(tx.serialize(), {
      maxRetries: this.pollingOptions.maxAttempts,
    });

    if (
      tx.recentBlockhash === undefined ||
      tx.lastValidBlockHeight === undefined
    ) {
      throw new Error(
        'Failed to submit Transaction --  missing blockhash or lastValidBlockHeight from transaction creation. Solana Gateway Url:' +
          this.gatewayUrl,
      );
    }

    await this.connection.confirmTransaction(
      {
        signature: id,
        blockhash: tx.recentBlockhash,
        lastValidBlockHeight: tx.lastValidBlockHeight,
      },
      'finalized',
    );
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
      let status: RpcResponseAndContext<SignatureStatus | null> | undefined =
        undefined;
      attempts++;

      try {
        status = await this.connection.getSignatureStatus(txId);
      } catch (err) {
        // Continue retries when request errors
        this.logger.debug('Failed to poll for transaction...', { err });
      }

      if (status && status.value && status.value.err !== null) {
        throw new Error(`Transaction failed: ${status.value.err}`);
      }

      if (status && status.value && status.value.slot !== null) {
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
