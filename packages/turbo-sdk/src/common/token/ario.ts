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
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  RpcResponseAndContext,
  SignatureStatus,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { BigNumber } from 'bignumber.js';
import bs58 from 'bs58';

import {
  AoProcessConfig,
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
} from '../../types.js';
import { defaultProdGatewayUrls, sleep } from '../../utils/common.js';
import { Logger } from '../logger.js';
import { memoProgramId } from './solana.js';

const ARIO_SPL_MINT_ADDRESS = 'REPLACE_ME';
const ARIO_TOKEN_DECIMALS = 6;

export class ARIOToken implements TokenTools {
  protected logger: TurboLogger;

  protected connection: Connection;
  protected gatewayUrl: string;
  private pollingOptions: TokenPollingOptions;

  constructor({
    gatewayUrl = defaultProdGatewayUrls.solana,
    logger = Logger.default,
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 2_500,
      initialBackoffMs: 500,
    },
  }: {
    gatewayUrl?: string;
    logger?: TurboLogger;
    pollingOptions?: TokenPollingOptions;
  } & Partial<AoProcessConfig> &
    TokenConfig = {}) {
    this.gatewayUrl = gatewayUrl;
    this.connection = new Connection(gatewayUrl, 'confirmed');
    this.pollingOptions = pollingOptions;

    this.logger = logger;
  }

  public async createAndSubmitTx({
    target,
    signer,
    tokenAmount,
    turboCreditDestinationAddress,
  }: TokenCreateTxParams): Promise<{
    id: string;
    target: string;
    reward: string;
  }> {
    const ownerPublicKey = new PublicKey(
      bs58.encode(Uint8Array.from(await signer.getPublicKey())),
    );
    const recipient = new PublicKey(target);
    const mint = new PublicKey(ARIO_SPL_MINT_ADDRESS);

    const fromAta = getAssociatedTokenAddressSync(mint, ownerPublicKey);
    const toAta = getAssociatedTokenAddressSync(mint, recipient);

    const tx = new Transaction({
      feePayer: ownerPublicKey,
      ...(await this.connection.getLatestBlockhash()),
    });

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        ownerPublicKey,
        toAta,
        recipient,
        mint,
      ),
    );

    tx.add(
      createTransferCheckedInstruction(
        fromAta,
        mint,
        toAta,
        ownerPublicKey,
        BigInt(new BigNumber(tokenAmount).toFixed(0)),
        ARIO_TOKEN_DECIMALS,
      ),
    );

    if (turboCreditDestinationAddress !== undefined) {
      tx.add(
        new TransactionInstruction({
          programId: new PublicKey(memoProgramId),
          keys: [],
          data: Buffer.from(
            'turboCreditDestinationAddress=' + turboCreditDestinationAddress,
          ),
        }),
      );
    }

    const serializedTx = tx.serializeMessage();
    const signature = await signer.signData(Uint8Array.from(serializedTx));
    tx.addSignature(ownerPublicKey, Buffer.from(signature));

    const txId = bs58.encode(signature);
    await this.submitTx(tx, txId);

    this.logger.debug('Submitted ARIO SPL transfer transaction...', {
      id: txId,
      target,
      tokenAmount,
      fromAta: fromAta.toBase58(),
      toAta: toAta.toBase58(),
      mint: mint.toBase58(),
    });

    return { id: txId, target, reward: '0' };
  }

  private async submitTx(tx: Transaction, id: string): Promise<void> {
    this.logger.debug('Submitting ARIO fund transaction...', { id });

    await this.connection.sendRawTransaction(tx.serialize(), {
      maxRetries: this.pollingOptions.maxAttempts,
    });

    if (
      tx.recentBlockhash === undefined ||
      tx.lastValidBlockHeight === undefined
    ) {
      throw new Error(
        'Failed to submit Transaction -- missing blockhash or lastValidBlockHeight from transaction creation. Solana Gateway Url:' +
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

  public async pollTxAvailability({ txId }: { txId: string }): Promise<void> {
    const { maxAttempts, pollingIntervalMs, initialBackoffMs } =
      this.pollingOptions;

    this.logger.debug('Polling for ARIO SPL transaction...', {
      txId,
      pollingOptions: this.pollingOptions,
    });

    await sleep(initialBackoffMs);

    let attempts = 0;
    while (attempts < maxAttempts) {
      let status: RpcResponseAndContext<SignatureStatus | null> | undefined;
      attempts++;

      try {
        status = await this.connection.getSignatureStatus(txId);
      } catch (err) {
        this.logger.debug('Failed to poll ARIO SPL transaction...', { err });
      }

      if (status && status.value && status.value.err !== null) {
        throw new Error(`Transaction failed: ${status.value.err}`);
      }

      if (status && status.value && status.value.slot !== null) {
        return;
      }

      this.logger.debug('ARIO SPL transaction not found, polling...', {
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

export const mARIOToTokenAmount = (mARIO: BigNumber.Value) => mARIO;
export const ARIOToTokenAmount = (ario: BigNumber.Value) =>
  new BigNumber(ario).times(1e6).valueOf();
