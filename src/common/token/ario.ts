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
import { ArconnectSigner, DataItem, createData } from '@dha-team/arbundles';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import {
  dryrun,
  message,
  monitor,
  result,
  results,
  spawn,
  unmonitor,
} from '@permaweb/aoconnect';
import { BigNumber } from 'bignumber.js';
import { id } from 'ethers';

import {
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
  TurboSigner,
} from '../../types.js';
import { defaultProdAoConfigs, sleep } from '../../utils/common.js';
import { version } from '../../version.js';
import { TurboWinstonLogger } from '../logger.js';

export interface AoClient {
  result: typeof result;
  results: typeof results;
  message: typeof message;
  spawn: typeof spawn;
  monitor: typeof monitor;
  unmonitor: typeof unmonitor;
  dryrun: typeof dryrun;
}

type AoSigner = (args: {
  data: string | Buffer;
  tags?: { name: string; value: string }[];
  target?: string;
  anchor?: string;
}) => Promise<{ id: string; raw: ArrayBuffer }>;

function createAoSigner(signer: TurboSigner): AoSigner {
  if (!('publicKey' in signer)) {
    return createDataItemSigner(signer) as AoSigner;
  }

  const aoSigner = async ({ data, tags, target, anchor }) => {
    // ensure appropriate permissions are granted with injected signers.
    if (
      signer.publicKey === undefined &&
      'setPublicKey' in signer &&
      typeof signer.setPublicKey === 'function'
    ) {
      await signer.setPublicKey();
    }
    if (signer instanceof ArconnectSigner) {
      // Sign using Arconnect signDataItem API
      const signedDataItem = await signer['signer'].signDataItem({
        data,
        tags,
        target,
        anchor,
      });
      const dataItem = new DataItem(Buffer.from(signedDataItem));
      return {
        id: dataItem.id,
        raw: dataItem.getRaw(),
      };
    }

    const dataItem = createData(data ?? '', signer, { tags, target, anchor });
    await dataItem.sign(signer);
    const signedData = {
      id: dataItem.id,
      raw: dataItem.getRaw(),
    };
    return signedData;
  };

  // eslint-disable-next-line
  // @ts-ignore Buffer vs ArrayBuffer type mismatch
  return aoSigner;
}

export class ARIOToken implements TokenTools {
  protected logger: TurboLogger;

  private ao: AoClient;
  private processId: string;
  private pollingOptions: TokenPollingOptions;

  constructor({
    cuUrl = defaultProdAoConfigs.ario.cuUrl,
    logger = TurboWinstonLogger.default,
    pollingOptions = {
      initialBackoffMs: 500,
      pollingIntervalMs: 0, // no polling for ARIO process
      maxAttempts: 0, // no polling for ARIO process
    },
    processId = defaultProdAoConfigs.ario.processId,
  }: {
    cuUrl?: string;
    processId?: string;
    logger?: TurboLogger;
    pollingOptions?: TokenPollingOptions;
  } = {}) {
    this.ao = connect({
      CU_URL: cuUrl,
    });
    this.processId = processId;
    this.pollingOptions = pollingOptions;

    this.logger = logger;
  }

  public async createAndSubmitTx({
    target,
    signer: { signer },
    tokenAmount,
  }: TokenCreateTxParams): Promise<{
    id: string;
    target: string;
    reward: string;
  }> {
    const txId = await this.ao.message({
      signer: createAoSigner(signer),
      process: this.processId,
      tags: [
        {
          name: 'Action',
          value: 'Transfer',
        },
        {
          name: 'Recipient',
          value: target,
        },
        {
          name: 'Quantity',
          value: tokenAmount.toString(),
        },
        {
          name: 'Turbo-SDK',
          value: version,
        },
      ],
    });
    this.logger.debug('Submitting fund transaction...', { id });

    return { id: txId, target, reward: '0' };
  }

  public async pollForTxBeingAvailable(): Promise<void> {
    // AO finality should be instant -- but we'll wait initial backoff to
    // provide infra some time to crank without reading the whole result
    return sleep(this.pollingOptions.initialBackoffMs);
  }
}

export const mARIOToTokenAmount = (mARIO: BigNumber.Value) => mARIO;
export const ARIOToTokenAmount = (ario: BigNumber.Value) =>
  new BigNumber(ario).times(1e6).valueOf();
