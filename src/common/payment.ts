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
import { BigNumber } from 'bignumber.js';

import {
  Currency,
  TopUpRawResponse,
  TurboAuthenticatedPaymentServiceConfiguration,
  TurboAuthenticatedPaymentServiceInterface,
  TurboBalanceResponse,
  TurboCheckoutSessionParams,
  TurboCheckoutSessionResponse,
  TurboCountriesResponse,
  TurboCryptoFundResponse,
  TurboCurrenciesResponse,
  TurboDataItemSigner,
  TurboFiatToArResponse,
  TurboInfoResponse,
  TurboLogger,
  TurboPostBalanceResponse,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboSignedRequestHeaders,
  TurboUnauthenticatedPaymentServiceConfiguration,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboWincForFiatParams,
  TurboWincForFiatResponse,
} from '../types.js';
import { TurboHTTPService } from './http.js';
import { TurboWinstonLogger } from './logger.js';

export const developmentPaymentServiceURL = 'https://payment.ardrive.dev';
export const defaultPaymentServiceURL = 'https://payment.ardrive.io';

export class TurboUnauthenticatedPaymentService
  implements TurboUnauthenticatedPaymentServiceInterface
{
  protected readonly httpService: TurboHTTPService;
  protected logger: TurboLogger;
  protected readonly token: string;

  constructor({
    url = defaultPaymentServiceURL,
    retryConfig,
    logger = new TurboWinstonLogger(),
    token = 'arweave',
  }: TurboUnauthenticatedPaymentServiceConfiguration) {
    this.logger = logger;
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
      logger: this.logger,
    });
    this.token = token;
  }

  public getFiatRates(): Promise<TurboRatesResponse> {
    return this.httpService.get<TurboRatesResponse>({
      endpoint: '/rates',
    });
  }

  public getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse> {
    return this.httpService.get<TurboFiatToArResponse>({
      endpoint: `/rates/${currency}`,
    });
  }

  public getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.httpService.get<TurboCountriesResponse>({
      endpoint: '/countries',
    });
  }

  public getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.httpService.get<TurboCurrenciesResponse>({
      endpoint: '/currencies',
    });
  }

  public async getUploadCosts({
    bytes,
  }: {
    bytes: number[];
  }): Promise<TurboPriceResponse[]> {
    const fetchPricePromises = bytes.map((byteCount: number) =>
      this.httpService.get<TurboPriceResponse>({
        endpoint: `/price/bytes/${byteCount}`,
      }),
    );
    const wincCostsForBytes: TurboPriceResponse[] =
      await Promise.all(fetchPricePromises);
    return wincCostsForBytes;
  }

  public getWincForFiat({
    amount,
  }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse> {
    const { amount: paymentAmount, type: currencyType } = amount;
    return this.httpService.get<TurboWincForFiatResponse>({
      endpoint: `/price/${currencyType}/${paymentAmount}`,
    });
  }

  protected appendPromoCodesToQuery(promoCodes: string[]): string {
    const promoCodesQuery = promoCodes.join(',');
    return promoCodesQuery ? `promoCode=${promoCodesQuery}` : '';
  }

  protected async getCheckout(
    {
      amount,
      owner,
      promoCodes = [],
      uiMode = 'hosted',
    }: TurboCheckoutSessionParams,
    headers?: TurboSignedRequestHeaders,
  ): Promise<TurboCheckoutSessionResponse> {
    const { amount: paymentAmount, type: currencyType } = amount;

    const endpoint = `/top-up/checkout-session/${owner}/${currencyType}/${paymentAmount}?uiMode=${uiMode}${
      promoCodes.length > 0
        ? `&${this.appendPromoCodesToQuery(promoCodes)}`
        : ''
    }`;

    const { adjustments, paymentSession, topUpQuote } =
      await this.httpService.get<TopUpRawResponse>({
        endpoint,
        headers,
      });

    return {
      winc: topUpQuote.winstonCreditAmount,
      adjustments,
      url: paymentSession.url ?? undefined,
      id: paymentSession.id,
      client_secret: paymentSession.client_secret ?? undefined,
      paymentAmount: topUpQuote.paymentAmount,
      quotedPaymentAmount: topUpQuote.quotedPaymentAmount,
    };
  }

  public createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse> {
    return this.getCheckout(params);
  }

  public async submitFundTransaction(
    tx_id: string,
  ): Promise<Omit<TurboCryptoFundResponse, 'target' | 'reward'>> {
    const response = await this.httpService.post<TurboPostBalanceResponse>({
      endpoint: `/account/balance/${this.token}`,
      data: Buffer.from(JSON.stringify({ tx_id })),
    });

    let transactionData;
    switch (true) {
      case 'creditedTransaction' in response:
        transactionData = {
          id: response.creditedTransaction.transactionId,
          quantity: response.creditedTransaction.transactionQuantity,
          owner: response.creditedTransaction.destinationAddress,
          winc: response.creditedTransaction.winstonCreditAmount,
          token: response.creditedTransaction.tokenType,
          status: 'confirmed',
          block: response.creditedTransaction.blockHeight,
        };
        break;
      case 'pendingTransaction' in response:
        transactionData = {
          id: response.pendingTransaction.transactionId,
          quantity: response.pendingTransaction.transactionQuantity,
          owner: response.pendingTransaction.destinationAddress,
          winc: response.pendingTransaction.winstonCreditAmount,
          token: response.pendingTransaction.tokenType,
          status: 'pending',
        };
        break;
      case 'failedTransaction' in response:
        transactionData = {
          id: response.failedTransaction.transactionId,
          quantity: response.failedTransaction.transactionQuantity,
          owner: response.failedTransaction.destinationAddress,
          winc: response.failedTransaction.winstonCreditAmount,
          token: response.failedTransaction.tokenType,
          status: 'failed',
        };
        break;
      default:
        throw new Error('Unknown response from payment service: ' + response);
    }

    return transactionData;
  }
}

// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
export class TurboAuthenticatedPaymentService
  extends TurboUnauthenticatedPaymentService
  implements TurboAuthenticatedPaymentServiceInterface
{
  protected readonly signer: TurboDataItemSigner;

  protected readonly arweave: Arweave;

  constructor({
    url = defaultPaymentServiceURL,
    retryConfig,
    signer,
    logger,
    token,
    gatewayUrl = 'https://arweave.net',
  }: TurboAuthenticatedPaymentServiceConfiguration) {
    super({ url, retryConfig, logger, token });
    this.signer = signer;

    const gatewayAsUrl = new URL(gatewayUrl);

    this.arweave = Arweave.init({
      host: gatewayAsUrl.hostname,
      port: gatewayAsUrl.port,
      protocol: gatewayAsUrl.protocol.replace(':', ''),
    });
  }

  public async getBalance(): Promise<TurboBalanceResponse> {
    const headers = await this.signer.generateSignedRequestHeaders();
    const balance = await this.httpService.get<TurboBalanceResponse>({
      endpoint: '/balance',
      headers,
      allowedStatuses: [200, 404],
    });

    // 404's don't return a balance, so default to 0
    return balance.winc ? balance : { winc: '0' };
  }

  public async getWincForFiat({
    amount,
    promoCodes = [],
  }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse> {
    return this.httpService.get<TurboWincForFiatResponse>({
      endpoint: `/price/${amount.type}/${
        amount.amount
      }?${this.appendPromoCodesToQuery(promoCodes)}`,
      headers: await this.signer.generateSignedRequestHeaders(),
    });
  }

  public async createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse> {
    return this.getCheckout(
      params,
      await this.signer.generateSignedRequestHeaders(),
    );
  }

  private async getTargetWalletForFund(): Promise<string> {
    const { addresses } = await this.httpService.get<TurboInfoResponse>({
      endpoint: '/info',
    });

    return addresses[this.token];
  }

  // TODO: token based backoff
  private async pollForTxBeingAvailableFromGateway(txId: string) {
    const maxAttempts = 30;
    const pollingIntervalMs = 1_000;
    const initialBackoffMs = 5_000;

    await new Promise((resolve) => setTimeout(resolve, initialBackoffMs));

    let attempts = 0;
    while (attempts < maxAttempts) {
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

      const transaction = response.data.data.transaction;

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

    throw new Error('Transaction not found after polling');
  }

  public async fund(
    tokenAmount: BigNumber.Value,
    feeMultiplier = 1,
  ): Promise<TurboCryptoFundResponse> {
    this.logger.debug('Funding account...');
    const bigNTokenAmount = new BigNumber(tokenAmount);

    const target = await this.getTargetWalletForFund();

    // TODO: token based tx creation
    const fundTx = await this.arweave.createTransaction({
      target,
      quantity: bigNTokenAmount.toString(),
      data: '',
    });

    if (feeMultiplier !== 1) {
      fundTx.reward = BigNumber(fundTx.reward)
        .times(new BigNumber(feeMultiplier))
        .toFixed(0, BigNumber.ROUND_UP);
    }

    const signedTx = await this.signer.signTx(fundTx);

    // TODO: token based tx posting
    const response = await this.arweave.transactions.post(signedTx);

    if (response.status !== 200) {
      throw new Error(
        'Failed to post fund transaction -- ' +
          `Status ${response.status}, ${response.statusText}`,
      );
    }

    this.logger.debug('Posted fund transaction...', { signedTx });

    const txId = signedTx.id;

    // Let transaction settle some time
    await this.pollForTxBeingAvailableFromGateway(txId);

    try {
      return {
        ...(await this.submitFundTransaction(signedTx.id)),
        target: signedTx.target,
        reward: signedTx.reward,
      };
    } catch (e) {
      this.logger.error('Failed to submit fund transaction...', { e });

      throw Error(
        `Failed to submit fund transaction! Save this Transaction ID and try again with 'turbo.submitFundTransaction(id)': ${txId}`,
      );
    }
  }
}
