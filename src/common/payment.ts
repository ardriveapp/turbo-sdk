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
import { BigNumber } from 'bignumber.js';
import { Buffer } from 'node:buffer';

import {
  Currency,
  RawWincForTokenResponse,
  TokenTools,
  TokenType,
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
  TurboFundWithTokensParams,
  TurboInfoResponse,
  TurboLogger,
  TurboPostBalanceResponse,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboSignedRequestHeaders,
  TurboSubmitFundTxResponse,
  TurboUnauthenticatedPaymentServiceConfiguration,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboWincForFiatParams,
  TurboWincForFiatResponse,
  TurboWincForTokenParams,
  TurboWincForTokenResponse,
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
  protected readonly token: TokenType;

  constructor({
    url = defaultPaymentServiceURL,
    retryConfig,
    logger = TurboWinstonLogger.default,
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

  public async getBalance(address: string): Promise<TurboBalanceResponse> {
    const balance = await this.httpService.get<TurboBalanceResponse>({
      endpoint: `/account/balance/${this.token}?address=${address}`,
      allowedStatuses: [200, 404],
    });

    return balance.winc ? balance : { winc: '0' };
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
    promoCodes = [],
    nativeAddress = 'placeholder', // For price checks we only check promo code eligibility, a placeholder can be used
  }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse> {
    return this.httpService.get<TurboWincForFiatResponse>({
      endpoint: `/price/${amount.type}/${
        amount.amount
      }?destinationAddress=${nativeAddress}&${this.appendPromoCodesToQuery(
        promoCodes,
      )}`,
    });
  }

  public async getWincForToken({
    tokenAmount,
  }: TurboWincForTokenParams): Promise<TurboWincForTokenResponse> {
    const { actualPaymentAmount, fees, winc } =
      await this.httpService.get<RawWincForTokenResponse>({
        endpoint: `/price/${this.token}/${tokenAmount}`,
      });

    return {
      winc,
      fees,
      actualTokenAmount: tokenAmount.toString(),
      equivalentWincTokenAmount: actualPaymentAmount.toString(),
    };
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
    }&token=${this.token}`;

    const { adjustments, paymentSession, topUpQuote, fees } =
      await this.httpService.get<TopUpRawResponse>({
        endpoint,
        headers,
      });

    return {
      winc: topUpQuote.winstonCreditAmount,
      adjustments,
      fees,
      url: paymentSession.url ?? undefined,
      id: paymentSession.id,
      client_secret: paymentSession.client_secret ?? undefined,
      /** @deprecated -- backfilled for backwards compatibility, use actualPaymentAmount */
      paymentAmount: topUpQuote.paymentAmount,
      actualPaymentAmount: topUpQuote.paymentAmount,
      quotedPaymentAmount: topUpQuote.quotedPaymentAmount,
    };
  }

  public createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse> {
    return this.getCheckout(params);
  }

  public async submitFundTransaction({
    txId,
  }: {
    txId: string;
  }): Promise<TurboSubmitFundTxResponse> {
    const response = await this.httpService.post<TurboPostBalanceResponse>({
      endpoint: `/account/balance/${this.token}`,
      data: Buffer.from(JSON.stringify({ tx_id: txId })),
    });

    if ('creditedTransaction' in response) {
      return {
        id: response.creditedTransaction.transactionId,
        quantity: response.creditedTransaction.transactionQuantity,
        owner: response.creditedTransaction.destinationAddress,
        winc: response.creditedTransaction.winstonCreditAmount,
        token: response.creditedTransaction.tokenType,
        status: 'confirmed',
        block: response.creditedTransaction.blockHeight,
      };
    } else if ('pendingTransaction' in response) {
      return {
        id: response.pendingTransaction.transactionId,
        quantity: response.pendingTransaction.transactionQuantity,
        owner: response.pendingTransaction.destinationAddress,
        winc: response.pendingTransaction.winstonCreditAmount,
        token: response.pendingTransaction.tokenType,
        status: 'pending',
      };
    } else if ('failedTransaction' in response) {
      return {
        id: response.failedTransaction.transactionId,
        quantity: response.failedTransaction.transactionQuantity,
        owner: response.failedTransaction.destinationAddress,
        winc: response.failedTransaction.winstonCreditAmount,
        token: response.failedTransaction.tokenType,
        status: 'failed',
      };
    }
    throw new Error('Unknown response from payment service: ' + response);
  }
}
// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
export class TurboAuthenticatedPaymentService
  extends TurboUnauthenticatedPaymentService
  implements TurboAuthenticatedPaymentServiceInterface
{
  protected readonly signer: TurboDataItemSigner;
  protected readonly tokenTools: TokenTools | undefined;

  constructor({
    url = defaultPaymentServiceURL,
    retryConfig,
    signer,
    logger = TurboWinstonLogger.default,
    token = 'arweave',
    tokenTools,
  }: TurboAuthenticatedPaymentServiceConfiguration) {
    super({ url, retryConfig, logger, token });
    this.signer = signer;
    this.tokenTools = tokenTools;
  }

  public async getBalance(address?: string): Promise<TurboBalanceResponse> {
    address ??= await this.signer.getNativeAddress();

    return super.getBalance(address);
  }

  public async getWincForFiat({
    amount,
    promoCodes = [],
  }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse> {
    return super.getWincForFiat({
      amount,
      promoCodes,
      nativeAddress: await this.signer.getNativeAddress(),
    });
  }

  public async createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse> {
    return this.getCheckout(params);
  }

  private async getTargetWalletForFund(): Promise<string> {
    const { addresses } = await this.httpService.get<TurboInfoResponse>({
      endpoint: '/info',
    });

    const walletAddress = addresses[this.token];
    if (!walletAddress) {
      throw new Error(`No wallet address found for token type: ${this.token}`);
    }
    return walletAddress;
  }

  public async topUpWithTokens({
    feeMultiplier = 1,
    tokenAmount: tokenAmountV,
  }: TurboFundWithTokensParams): Promise<TurboCryptoFundResponse> {
    if (!this.tokenTools) {
      throw new Error(`Token type not supported for crypto fund ${this.token}`);
    }

    const tokenAmount = new BigNumber(tokenAmountV);

    const target = await this.getTargetWalletForFund();
    this.logger.debug('Funding account...', {
      feeMultiplier,
      tokenAmount,
      target,
    });

    const fundTx = await this.tokenTools.createAndSubmitTx({
      target,
      tokenAmount,
      feeMultiplier,
      signer: this.signer,
    });

    const txId = fundTx.id;

    try {
      // Let transaction settle some time
      await this.tokenTools.pollForTxBeingAvailable({ txId });
    } catch (e) {
      this.logger.error(
        `Failed to poll for transaction being available from ${this.token} gateway... Attempting to submit fund tx to Turbo...`,
        e,
      );
    }

    try {
      return {
        ...(await this.submitFundTransaction({ txId })),
        target: fundTx.target,
        reward: fundTx.reward,
      };
    } catch (e) {
      this.logger.debug('Failed to submit fund transaction...', e);

      throw Error(
        `Failed to submit fund transaction! Save this Transaction ID and try again with 'turbo.submitFundTransaction(id)': ${txId}`,
      );
    }
  }
}
