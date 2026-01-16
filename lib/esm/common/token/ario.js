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
import { ArconnectSigner, DataItem, createData } from '@dha-team/arbundles';
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import { BigNumber } from 'bignumber.js';
import { defaultProdAoConfigs, sleep } from '../../utils/common.js';
import { version } from '../../version.js';
import { Logger } from '../logger.js';
export class ARIOToken {
    constructor({ cuUrl = defaultProdAoConfigs.ario.cuUrl, logger = Logger.default, pollingOptions = {
        initialBackoffMs: 500,
        pollingIntervalMs: 0, // no polling for ARIO process
        maxAttempts: 0, // no polling for ARIO process
    }, processId = defaultProdAoConfigs.ario.processId, } = {}) {
        this.ao = connect({
            CU_URL: cuUrl,
        });
        this.processId = processId;
        this.pollingOptions = pollingOptions;
        this.logger = logger;
    }
    async createAndSubmitTx({ target, signer: { signer }, tokenAmount, turboCreditDestinationAddress, }) {
        const tags = [
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
        ];
        if (turboCreditDestinationAddress !== undefined) {
            tags.push({
                name: 'Turbo-Credit-Destination-Address',
                value: turboCreditDestinationAddress,
            });
        }
        const txId = await this.ao.message({
            signer: createAoSigner(signer),
            process: this.processId,
            tags,
        });
        this.logger.debug('Submitted Transfer message to ARIO process...', {
            id: txId,
            target,
            tokenAmount,
            processId: this.processId,
            tags,
        });
        return { id: txId, target, reward: '0' };
    }
    async pollTxAvailability() {
        // AO finality should be instant -- but we'll wait initial backoff to
        // provide infra some time to crank without reading the whole result
        return sleep(this.pollingOptions.initialBackoffMs);
    }
}
export const mARIOToTokenAmount = (mARIO) => mARIO;
export const ARIOToTokenAmount = (ario) => new BigNumber(ario).times(1e6).valueOf();
function createAoSigner(signer) {
    if (!('publicKey' in signer)) {
        return createDataItemSigner(signer);
    }
    const aoSigner = async ({ data, tags, target, anchor }) => {
        // ensure appropriate permissions are granted with injected signers.
        if (signer.publicKey === undefined &&
            'setPublicKey' in signer &&
            typeof signer.setPublicKey === 'function') {
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
