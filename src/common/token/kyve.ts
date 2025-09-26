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
import { Secp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/amino';
import { Slip10, Slip10Curve } from '@cosmjs/crypto';
import { toHex } from '@cosmjs/encoding';
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import {
  GasPrice,
  SigningStargateClient,
  calculateFee,
} from '@cosmjs/stargate';
import { EthereumSigner } from '@dha-team/arbundles';
import { AxiosResponse } from 'axios';
import { BigNumber } from 'bignumber.js';

import {
  TokenConfig,
  TokenCreateTxParams,
  TokenPollingOptions,
  TokenTools,
  TurboLogger,
  TurboSigner,
} from '../../types.js';
import { createAxiosInstance } from '../../utils/axiosClient.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
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

  constructor({
    logger = TurboWinstonLogger.default,
    gatewayUrl = defaultProdGatewayUrls.kyve,
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
    this.logger.debug('Creating and submitting transaction...', {
      target,
      tokenAmount,
      signer,
    });
    const chainId = this.gatewayUrl.includes('kaon')
      ? 'kaon-1'
      : this.gatewayUrl.includes('korellia')
      ? 'korellia-2'
      : 'kyve-1';

    const txHash = await this.sendTokens({
      chainId,
      privateKeyUint8Array: (signer['signer'] as EthereumSigner).key,
      recipientAddress: target,
      amount: tokenAmount.toString(),
    });

    return { id: txHash, target };
  }

  public async pollTxAvailability({ txId }: { txId: string }): Promise<void> {
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

  // ref: https://github.com/KYVENetwork/kyvejs/blob/e6c68b007fb50ab026e60ea6eaadf37b7cf8c76f/common/sdk/src/clients/rpc-client/signing.ts#L109-L183
  private async sendTokens({
    chainId,
    privateKeyUint8Array,
    recipientAddress,
    amount,
    gasMultiplier = 1.5,
  }: {
    chainId: keyof typeof SUPPORTED_CHAIN_CONFIGS;
    privateKeyUint8Array: Uint8Array;
    recipientAddress: string;
    amount: string; // base denom (e.g., "1000000" for 1 KYVE)
    gasMultiplier?: number;
  }): Promise<string> {
    const config = SUPPORTED_CHAIN_CONFIGS[chainId];
    if (config === undefined) {
      throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const wallet = await DirectSecp256k1Wallet.fromKey(
      privateKeyUint8Array,
      'kyve',
    );
    const [account] = await wallet.getAccounts();
    const senderAddress = account.address;
    const gasPrice = GasPrice.fromString(
      `${config.gasPrice}${config.coinDenom}`,
    );

    const client = await SigningStargateClient.connectWithSigner(
      config.rpc,
      wallet,
      { gasPrice },
    );

    // Create MsgSend message
    const msg = {
      fromAddress: senderAddress,
      toAddress: recipientAddress,
      amount: [{ denom: config.coinDenom, amount }],
    };

    const encodedMsg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: msg,
    };

    // Simulate gas usage
    const gasEstimate = await client.simulate(senderAddress, [encodedMsg], '');

    // Calculate fee with buffer
    const fee = calculateFee(
      Math.round(gasEstimate * gasMultiplier),
      GasPrice.fromString(`${config.gasPrice}${config.coinDenom}`),
    );

    // Send the actual transaction
    const result = await client.sendTokens(
      senderAddress,
      recipientAddress,
      [{ denom: config.coinDenom, amount }],
      fee,
      '',
    );

    return result.transactionHash;
  }
}

export function signerFromKyvePrivateKey(privateKey: string): TurboSigner {
  // TODO: Use KyveSigner when implemented for on chain native address support
  return new EthereumSigner(privateKey);
}

export async function privateKeyFromKyveMnemonic(
  mnemonic: string,
): Promise<string> {
  const kyveWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'kyve',
  });

  return toHex(
    Slip10.derivePath(
      Slip10Curve.Secp256k1,
      kyveWallet['seed'],
      makeCosmoshubPath(0),
    ).privkey,
  );
}

export async function signerFromKyveMnemonic(
  mnemonic: string,
): Promise<TurboSigner> {
  const privateKey = await privateKeyFromKyveMnemonic(mnemonic);

  return signerFromKyvePrivateKey(privateKey);
}

// ref: https://github.com/KYVENetwork/kyvejs/blob/e6c68b007fb50ab026e60ea6eaadf37b7cf8c76f/common/sdk/src/constants.ts#L26-L89
export const SUPPORTED_CHAIN_CONFIGS = {
  'kyve-1': {
    chainId: 'kyve-1',
    chainName: 'KYVE',
    rpc: 'https://rpc.kyve.network',
    rest: 'https://api.kyve.network',
    coin: 'KYVE',
    coinDenom: 'ukyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'kaon-1': {
    chainId: 'kaon-1',
    chainName: 'KYVE Kaon',
    rpc: 'https://rpc.kaon.kyve.network',
    rest: 'https://api.kaon.kyve.network',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'korellia-2': {
    chainId: 'korellia-2',
    chainName: 'KYVE Korellia',
    rpc: 'https://rpc.korellia.kyve.network',
    rest: 'https://api.korellia.kyve.network',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'kyve-beta': {
    chainId: 'kyve-beta',
    chainName: 'KYVE-Beta',
    rpc: 'https://rpc.beta.kyve.network',
    rest: 'https://api.beta.kyve.network',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'kyve-alpha': {
    chainId: 'kyve-alpha',
    chainName: 'KYVE Alpha',
    rpc: 'https://rpc.alpha.kyve.network',
    rest: 'https://api.alpha.kyve.network',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
  'kyve-local': {
    chainId: 'kyve-local',
    chainName: 'KYVE Local',
    rpc: 'http://0.0.0.0:26657',
    rest: 'http://0.0.0.0:1317',
    coin: 'KYVE',
    coinDenom: 'tkyve',
    coinDecimals: 6,
    gasPrice: 2,
  },
};
