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
import { EthereumSigner } from '@dha-team/arbundles';
import { BigNumber } from 'bignumber.js';
import { Wallet as EthereumWallet, JsonRpcProvider, ethers } from 'ethers';

import { TokenConfig, TokenCreateTxParams } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { TurboWinstonLogger } from '../logger.js';
import {
  EthereumToken,
  ethDataFromTurboCreditDestinationAddress,
} from './ethereum.js';

export type ERC20Contract = ethers.Contract & {
  decimals(): Promise<number>;
  balanceOf(addr: string): Promise<bigint>;
  transfer(
    to: string,
    value: string | number | bigint,
    opts?: unknown,
  ): Promise<ethers.TransactionResponse>;
};

export class ERC20Token extends EthereumToken {
  private tokenContract: ERC20Contract;

  constructor({
    tokenAddress,
    logger = TurboWinstonLogger.default,
    gatewayUrl = defaultProdGatewayUrls.ethereum,
    pollingOptions,
  }: TokenConfig & { tokenAddress: string }) {
    super({ logger, gatewayUrl, pollingOptions });
    this.tokenContract = new ethers.Contract(
      tokenAddress,
      [
        'function decimals() view returns (uint8)',
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address to, uint256 value) returns (bool)',
      ],
      this.rpcProvider,
    ) as ERC20Contract;
  }

  public async createAndSubmitTx({
    target,
    tokenAmount,
    signer,
    turboCreditDestinationAddress,
  }: TokenCreateTxParams): Promise<{ id: string; target: string }> {
    try {
      if (!(signer.signer instanceof EthereumSigner)) {
        throw new Error(
          'Only EthereumSigner is supported for ERC20 token transfers.',
        );
      }
      const keyAsStringFromUint8Array = Buffer.from(signer.signer.key).toString(
        'hex',
      );
      const provider = new JsonRpcProvider(this.gatewayUrl);
      const ethWalletAndProvider = new EthereumWallet(
        keyAsStringFromUint8Array,
        provider,
      );
      const connected = this.tokenContract.connect(
        ethWalletAndProvider,
      ) as ERC20Contract;

      const decimals = await connected.decimals();

      // Convert tokenAmount (which may already be BigNumber.js) to raw integer value
      const rawAmount = new BigNumber(tokenAmount)
        .shiftedBy(decimals)
        .toFixed(0);

      // Prepare transaction data (with optional memo)
      const memoData = ethDataFromTurboCreditDestinationAddress(
        turboCreditDestinationAddress,
      );

      const tx = await connected.transfer(target, rawAmount, {
        data: memoData, // optional memo data
      });

      this.logger.debug('ERC20 transfer submitted', {
        txHash: tx.hash,
        target,
      });

      return { id: tx.hash, target };
    } catch (e) {
      this.logger.error('Error creating/submitting ERC20 tx', {
        error: e instanceof Error ? e.message : e,
        target,
        tokenAmount,
        rpcEndpoint: this.gatewayUrl,
      });
      throw e;
    }
  }

  public async getTokenBalance(address: string): Promise<BigNumber> {
    const decimals = await this.tokenContract.decimals();
    const balance = await this.tokenContract.balanceOf(address);
    return new BigNumber(balance.toString()).shiftedBy(-decimals);
  }
}
