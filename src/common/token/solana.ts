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
import { Buffer } from 'node:buffer';

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
    logger = TurboWinstonLogger.default,
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
