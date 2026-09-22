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

/**
 * Funding by an **SPL token transfer on Solana**: an idempotent
 * create-associated-token-account, a `transferChecked` to the recipient's ATA,
 * and an optional `turboCreditDestinationAddress=` memo when the credit should
 * land on a different Turbo account than the payer.
 *
 * This is the generic shape of what `ARIOToken` has always done — ARIO is an SPL
 * token — so a second SPL token (USDC) is a mint and a decimals value, not a
 * second implementation. The payment service verifies both with one class too
 * (`SolanaSplGateway`).
 *
 * Two constraints worth knowing before pointing this at a third token:
 *  - The associated token accounts are derived for the CLASSIC SPL Token
 *    program (Tokenkeg), which is what ARIO and USDC use. A Token-2022 mint
 *    derives a different ATA, so it would need its own program id threading
 *    through `getAssociatedTokenAddressSync`. It fails loudly on-chain rather
 *    than silently paying the wrong account.
 *  - `decimals` must match the mint's own. `transferChecked` carries the value
 *    and the chain rejects a mismatch, so a wrong value fails the transaction
 *    instead of transferring a wrong amount.
 */
export class SplToken implements TokenTools {
  protected logger: TurboLogger;

  protected connection: Connection;
  protected gatewayUrl: string;
  protected pollingOptions: TokenPollingOptions;
  protected mintAddress: string;
  protected decimals: number;
  /** Token name, used in log messages only. */
  protected tokenName: string;

  constructor({
    mintAddress,
    decimals,
    tokenName = 'SPL',
    gatewayUrl = defaultProdGatewayUrls.solana,
    logger = Logger.default,
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 2_500,
      initialBackoffMs: 500,
    },
  }: {
    mintAddress: string;
    decimals: number;
    tokenName?: string;
    gatewayUrl?: string;
    logger?: TurboLogger;
    pollingOptions?: TokenPollingOptions;
  } & Partial<AoProcessConfig> &
    TokenConfig) {
    this.gatewayUrl = gatewayUrl;
    this.connection = new Connection(gatewayUrl, 'confirmed');
    this.pollingOptions = pollingOptions;
    this.logger = logger;
    this.mintAddress = mintAddress;
    this.decimals = decimals;
    this.tokenName = tokenName;
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
    const mint = new PublicKey(this.mintAddress);

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
        this.decimals,
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

    this.logger.debug(
      `Submitted ${this.tokenName} SPL transfer transaction...`,
      {
        id: txId,
        target,
        tokenAmount,
        fromAta: fromAta.toBase58(),
        toAta: toAta.toBase58(),
        mint: mint.toBase58(),
      },
    );

    return { id: txId, target, reward: '0' };
  }

  private async submitTx(tx: Transaction, id: string): Promise<void> {
    this.logger.debug(`Submitting ${this.tokenName} fund transaction...`, {
      id,
    });

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

    this.logger.debug(`Polling for ${this.tokenName} SPL transaction...`, {
      txId,
      pollingOptions: this.pollingOptions,
      gatewayUrl: this.gatewayUrl,
    });

    await sleep(initialBackoffMs);

    let attempts = 0;
    while (attempts < maxAttempts) {
      let status: RpcResponseAndContext<SignatureStatus | null> | undefined;
      attempts++;

      try {
        const statuses = await this.connection.getSignatureStatuses([txId], {
          searchTransactionHistory: true,
        });
        status = {
          context: statuses.context,
          value: statuses.value[0],
        };
      } catch (err) {
        this.logger.debug(
          `Failed to poll ${this.tokenName} SPL transaction...`,
          { err },
        );
      }

      if (status && status.value && status.value.err !== null) {
        throw new Error(`Transaction failed: ${status.value.err}`);
      }

      if (status && status.value && status.value.slot !== null) {
        this.logger.debug('Transaction found!', { txId, status });

        return;
      }

      this.logger.debug(
        `${this.tokenName} SPL transaction not found, polling...`,
        {
          txId,
          attempts,
          maxAttempts,
          pollingIntervalMs,
        },
      );

      await sleep(pollingIntervalMs);
    }

    throw new Error(
      'Transaction not found after polling, transaction id: ' + txId,
    );
  }
}
