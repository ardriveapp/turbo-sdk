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
import { BigNumber } from 'bignumber.js';

import {
  ArNSBuyNameParams,
  ArNSExtendLeaseParams,
  ArNSIncreaseUndernameLimitParams,
  ArNSNameType,
  ArNSPaidByParams,
  ArNSPriceParams,
  ArNSPriceResponse,
  ArNSPurchaseParams,
  ArNSPurchaseResponse,
  ArNSPurchaseStatusResponse,
  ArNSUpgradeNameParams,
  Currency,
  GetCreditShareApprovalsResponse,
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
  TurboFiatEstimateForBytesResponse,
  TurboFiatToArResponse,
  TurboFundWithTokensParams,
  TurboInfoResponse,
  TurboLogger,
  TurboPaymentIntentParams,
  TurboPaymentIntentResponse,
  TurboPostBalanceResponse,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboSignedRequestHeaders,
  TurboSubmitFundTxResponse,
  TurboTokenPriceForBytesResponse,
  TurboUnauthenticatedPaymentServiceConfiguration,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboWincForFiatParams,
  TurboWincForFiatResponse,
  TurboWincForTokenParams,
  TurboWincForTokenResponse,
  UserAddress,
  arNSPurchaseIntents,
} from '../types.js';
import { isAnyValidUserAddress } from '../utils/common.js';
import {
  FailedRequestError,
  InsufficientCreditsError,
  ProvidedInputError,
} from '../utils/errors.js';
import { uuidV4 } from '../utils/uuid.js';
import { defaultRetryConfig } from './http.js';
import { TurboHTTPService } from './http.js';
import { Logger } from './logger.js';
import { exponentMap, tokenToBaseMap } from './token/index.js';

export const developmentPaymentServiceURL = 'https://payment.ardrive.dev';
export const defaultPaymentServiceURL = 'https://payment.ardrive.io';

export class TurboUnauthenticatedPaymentService
  implements TurboUnauthenticatedPaymentServiceInterface
{
  protected readonly httpService: TurboHTTPService;
  protected logger: TurboLogger;
  protected readonly token: TokenType;
  private url: string;

  constructor({
    url = defaultPaymentServiceURL,
    logger = Logger.default,
    retryConfig = defaultRetryConfig(logger),
    token = 'arweave',
  }: TurboUnauthenticatedPaymentServiceConfiguration) {
    this.logger = logger;
    this.httpService = new TurboHTTPService({
      url: `${url}/v1`,
      retryConfig,
      logger: this.logger,
    });
    this.token = token;
    this.url = url;
  }

  public async getBalance(address: string): Promise<TurboBalanceResponse> {
    const balance = await this.httpService.get<TurboBalanceResponse>({
      endpoint: `/account/balance/${this.token}?address=${address}`,
      allowedStatuses: [200, 404],
    });

    return balance.winc
      ? balance
      : {
          winc: '0',
          controlledWinc: '0',
          effectiveBalance: '0',
          givenApprovals: [],
          receivedApprovals: [],
        };
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

  public async getArNSPriceForName(
    params: ArNSPriceParams,
  ): Promise<ArNSPriceResponse> {
    // `async` so a validation failure surfaces as a rejected promise (consistent
    // with `purchaseArNSName`) rather than a synchronous throw.
    this.validateArNSPurchaseParams(params);
    return this.httpService.get<ArNSPriceResponse>({
      endpoint: `/arns/price/${params.intent.toLowerCase()}/${
        params.name
      }${this.buildArNSPurchaseQuery(params)}`,
    });
  }

  /**
   * Fail fast (client-side) on malformed ArNS requests so JS callers that bypass
   * the compile-time intent unions get a clear `ProvidedInputError` instead of an
   * opaque service 4xx. Enforces the required fields per intent:
   *  - `Buy-Name`: `type` ('lease' | 'permabuy') + `processId`; leases also need `years`
   *  - `Extend-Lease`: positive `years`
   *  - `Increase-Undername-Limit`: positive `increaseQty`
   *  - `Upgrade-Name`: just `name`
   */
  protected validateArNSPurchaseParams(params: ArNSPriceParams): void {
    const p = params as {
      intent?: string;
      name?: string;
      type?: string;
      years?: number;
      increaseQty?: number;
      processId?: string;
    };
    if (!arNSPurchaseIntents.includes(p.intent as never)) {
      throw new ProvidedInputError(
        `Invalid ArNS intent '${
          p.intent
        }'. Expected one of: ${arNSPurchaseIntents.join(', ')}.`,
      );
    }
    if (typeof p.name !== 'string' || p.name.length === 0) {
      throw new ProvidedInputError('An ArNS `name` is required.');
    }
    const isPositiveNumber = (v: unknown): boolean =>
      typeof v === 'number' && Number.isFinite(v) && v > 0;
    switch (p.intent) {
      case 'Buy-Name':
        if (p.type !== 'lease' && p.type !== 'permabuy') {
          throw new ProvidedInputError(
            "Buy-Name requires a `type` of 'lease' or 'permabuy'.",
          );
        }
        if (typeof p.processId !== 'string' || p.processId.length === 0) {
          throw new ProvidedInputError(
            'Buy-Name requires a `processId` (the ANT the name resolves to).',
          );
        }
        if (p.type === 'lease' && !isPositiveNumber(p.years)) {
          throw new ProvidedInputError(
            'A lease `Buy-Name` requires a positive `years`.',
          );
        }
        break;
      case 'Extend-Lease':
        if (!isPositiveNumber(p.years)) {
          throw new ProvidedInputError(
            'Extend-Lease requires a positive `years`.',
          );
        }
        break;
      case 'Increase-Undername-Limit':
        if (!isPositiveNumber(p.increaseQty)) {
          throw new ProvidedInputError(
            'Increase-Undername-Limit requires a positive `increaseQty`.',
          );
        }
        break;
      case 'Upgrade-Name':
        break;
    }
  }

  public getArNSPurchaseStatus({
    nonce,
  }: {
    nonce: string;
  }): Promise<ArNSPurchaseStatusResponse> {
    return this.httpService.get<ArNSPurchaseStatusResponse>({
      endpoint: `/arns/purchase/${nonce}`,
    });
  }

  protected buildArNSPurchaseQuery(input: ArNSPurchaseParams): string {
    // The intent-specific union members each carry only their own fields; read
    // them through a single widened view rather than narrowing per intent.
    const { type, years, increaseQty, processId, paidBy } = input as {
      type?: ArNSNameType;
      years?: number;
      increaseQty?: number;
      processId?: string;
    } & ArNSPaidByParams;
    const params = new URLSearchParams();
    if (type !== undefined) params.set('type', type);
    if (years !== undefined) params.set('years', `${years}`);
    if (increaseQty !== undefined) params.set('increaseQty', `${increaseQty}`);
    if (processId !== undefined) params.set('processId', processId);
    if (paidBy !== undefined) {
      for (const payer of Array.isArray(paidBy) ? paidBy : [paidBy]) {
        params.append('paidBy', payer);
      }
    }
    const query = params.toString();
    return query.length > 0 ? `?${query}` : '';
  }

  protected appendPromoCodesToQuery(promoCodes: string[]): string {
    const promoCodesQuery = promoCodes.join(',');
    return promoCodesQuery ? `promoCode=${promoCodesQuery}` : '';
  }

  public async getTurboCryptoWallets(): Promise<Record<TokenType, string>> {
    const { addresses } = await this.httpService.get<TurboInfoResponse>({
      endpoint: '/info',
    });

    return addresses;
  }

  protected async getCheckout(
    {
      amount,
      owner,
      promoCodes = [],
      uiMode = 'hosted',
      ...callbackUrls
    }: TurboCheckoutSessionParams,
    type: 'checkout-session' | 'payment-intent' = 'checkout-session',
    headers?: TurboSignedRequestHeaders,
  ): Promise<TurboCheckoutSessionResponse> {
    const { amount: paymentAmount, type: currencyType } = amount;

    const queryParams = new URLSearchParams();
    queryParams.append('token', this.token);
    if (uiMode) {
      queryParams.append('uiMode', uiMode);
    }
    if (promoCodes.length > 0) {
      queryParams.append('promoCode', promoCodes.join(','));
    }
    if ('successUrl' in callbackUrls && callbackUrls.successUrl !== undefined) {
      queryParams.append('successUrl', callbackUrls.successUrl);
    }
    if ('cancelUrl' in callbackUrls && callbackUrls.cancelUrl !== undefined) {
      queryParams.append('cancelUrl', callbackUrls.cancelUrl);
    }
    if ('returnUrl' in callbackUrls && callbackUrls.returnUrl !== undefined) {
      queryParams.append('returnUrl', callbackUrls.returnUrl);
    }

    const endpoint: `/${string}` = `/top-up/${type}/${owner}/${currencyType}/${paymentAmount}?${queryParams.toString()}`;

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
    this.logger.debug('Submitting fund transaction to Turbo...', {
      txId,
      url: this.url,
    });

    const response = await this.httpService.post<TurboPostBalanceResponse>({
      endpoint: `/account/balance/${this.token}`,
      data: Buffer.from(JSON.stringify({ tx_id: txId })),
    });

    if ('creditedTransaction' in response) {
      return {
        id: response.creditedTransaction.transactionId,
        quantity: response.creditedTransaction.transactionQuantity,
        owner:
          response.creditedTransaction.transactionSenderAddress ??
          response.creditedTransaction.destinationAddress,
        winc: response.creditedTransaction.winstonCreditAmount,
        token: response.creditedTransaction.tokenType,
        status: 'confirmed',
        block: response.creditedTransaction.blockHeight,
        recipient: response.creditedTransaction.destinationAddress,
      };
    } else if ('pendingTransaction' in response) {
      return {
        id: response.pendingTransaction.transactionId,
        quantity: response.pendingTransaction.transactionQuantity,
        owner:
          response.pendingTransaction.transactionSenderAddress ??
          response.pendingTransaction.destinationAddress,
        winc: response.pendingTransaction.winstonCreditAmount,
        token: response.pendingTransaction.tokenType,
        status: 'pending',
        recipient: response.pendingTransaction.destinationAddress,
      };
    } else if ('failedTransaction' in response) {
      return {
        id: response.failedTransaction.transactionId,
        quantity: response.failedTransaction.transactionQuantity,
        owner:
          response.failedTransaction.transactionSenderAddress ??
          response.failedTransaction.destinationAddress,
        winc: response.failedTransaction.winstonCreditAmount,
        token: response.failedTransaction.tokenType,
        status: 'failed',
        recipient: response.failedTransaction.destinationAddress,
      };
    }
    throw new Error('Unknown response from payment service: ' + response);
  }

  public async getCreditShareApprovals({
    userAddress,
  }: {
    userAddress: UserAddress;
  }): Promise<GetCreditShareApprovalsResponse> {
    const response = await this.httpService.get<
      GetCreditShareApprovalsResponse | undefined
    >({
      endpoint: `/account/approvals/get?userAddress=${userAddress}`,
      allowedStatuses: [200, 404],
    });
    if (
      response?.givenApprovals === undefined &&
      response?.receivedApprovals === undefined
    ) {
      return {
        givenApprovals: [],
        receivedApprovals: [],
      };
    }
    return response;
  }

  public async getFiatEstimateForBytes({
    byteCount,
    currency,
  }: {
    byteCount: number;
    currency: Currency;
  }): Promise<TurboFiatEstimateForBytesResponse> {
    // Step 1: Get the estimated winc cost for the given byte count -- W
    const wincPriceForGivenBytes = await this.getUploadCosts({
      bytes: [byteCount],
    });

    // Step 2: Get the winc-to-fiat conversion rates for 1 GiB
    const { winc: wincPriceForOneGiB, fiat: fiatPricesForOneGiB } =
      await this.getFiatRates();

    // Step 3: Convert the WINC cost of the given bytes into fiat:
    //  (W / W1GiB) * Fiat1GiB = FiatCostForBytes
    const fiatPriceForGivenBytes = new BigNumber(wincPriceForGivenBytes[0].winc)
      .dividedBy(new BigNumber(wincPriceForOneGiB))
      .times(fiatPricesForOneGiB[currency]);

    // Step 4: Format and round up so the estimated cost is always enough to cover the upload
    const formattedFiatPrice =
      currency === 'jpy'
        ? +fiatPriceForGivenBytes.integerValue(BigNumber.ROUND_CEIL) // no decimals for JPY
        : +fiatPriceForGivenBytes.decimalPlaces(2, BigNumber.ROUND_CEIL); // 2 decimal precision

    return {
      byteCount,
      amount: formattedFiatPrice,
      currency,
      winc: wincPriceForGivenBytes[0].winc,
    };
  }

  public async getTokenPriceForBytes({
    byteCount,
  }: {
    byteCount: number;
  }): Promise<TurboTokenPriceForBytesResponse> {
    const wincPriceForOneToken = (
      await this.getWincForToken({
        tokenAmount: tokenToBaseMap[this.token](1),
      })
    ).winc;
    const wincPriceForOneGiB = (
      await this.getUploadCosts({
        bytes: [2 ** 30],
      })
    )[0].winc;

    const tokenPriceForOneGiB = new BigNumber(wincPriceForOneGiB).dividedBy(
      wincPriceForOneToken,
    );
    const tokenPriceForBytes = tokenPriceForOneGiB
      .dividedBy(2 ** 30)
      .times(byteCount)
      .toFixed(exponentMap[this.token]);

    return { byteCount, tokenPrice: tokenPriceForBytes, token: this.token };
  }

  public async createPaymentIntent(
    params: TurboPaymentIntentParams,
  ): Promise<TurboPaymentIntentResponse> {
    return this.getCheckout(
      params,
      'payment-intent',
    ) as Promise<TurboPaymentIntentResponse>;
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
    logger = Logger.default,
    token = 'arweave',
    tokenTools,
  }: TurboAuthenticatedPaymentServiceConfiguration) {
    super({ url, retryConfig, logger, token });
    this.signer = signer;
    this.tokenTools = tokenTools;
  }

  public async getBalance(userAddress?: string): Promise<TurboBalanceResponse> {
    userAddress ??= await this.signer.getNativeAddress();
    return super.getBalance(userAddress);
  }

  /**
   * Buy / extend / upgrade an ArNS name, paying with the signer's Turbo credit
   * balance. The bundler performs the on-chain ARIO purchase and debits credits;
   * a `402` (FailedRequestError.status === 402) indicates insufficient credits.
   */
  public async purchaseArNSName(
    params: ArNSPurchaseParams,
  ): Promise<ArNSPurchaseResponse> {
    this.validateArNSPurchaseParams(params);
    // The bundler requires the signed nonce to be a UUID; it also doubles as
    // the idempotency + status-lookup key (`getArNSPurchaseStatus`).
    const nonce = uuidV4();
    const headers = await this.signer.generateSignedRequestHeaders(nonce);
    let response: Omit<ArNSPurchaseResponse, 'nonce'>;
    try {
      response = await this.httpService.post<
        Omit<ArNSPurchaseResponse, 'nonce'>
      >({
        endpoint: `/arns/purchase/${params.intent.toLowerCase()}/${
          params.name
        }${this.buildArNSPurchaseQuery(params)}`,
        headers,
        // Params travel in the query string + signed headers; the service reads
        // no body, but the HTTP layer requires a `data` field.
        data: Buffer.from([]),
      });
    } catch (error) {
      // Surface a credit shortfall as a typed, catchable error so callers can
      // prompt a top-up. The `nonce` is the idempotency key: after topping up,
      // retry the same purchase (a fresh nonce is fine — the service dedupes by
      // the on-chain effect, and a captured nonce lets you poll status).
      if (error instanceof FailedRequestError && error.status === 402) {
        throw new InsufficientCreditsError(error.message);
      }
      throw error;
    }
    // Normalize both nonce fields to the one we signed so callers can poll with
    // either `response.nonce` or `response.purchaseReceipt.nonce`.
    return {
      ...response,
      nonce,
      purchaseReceipt: { ...response.purchaseReceipt, nonce },
    };
  }

  public buyArNSName(
    params: Omit<ArNSBuyNameParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse> {
    return this.purchaseArNSName({
      ...params,
      intent: 'Buy-Name',
    } as ArNSPurchaseParams);
  }

  public extendArNSLease(
    params: Omit<ArNSExtendLeaseParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse> {
    return this.purchaseArNSName({ ...params, intent: 'Extend-Lease' });
  }

  public increaseArNSUndernameLimit(
    params: Omit<ArNSIncreaseUndernameLimitParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse> {
    return this.purchaseArNSName({
      ...params,
      intent: 'Increase-Undername-Limit',
    });
  }

  public upgradeArNSName(
    params: Omit<ArNSUpgradeNameParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse> {
    return this.purchaseArNSName({ ...params, intent: 'Upgrade-Name' });
  }

  // ---- ArNS ANT custody: self-custody exit + manage records ----

  // Canonical ACTION-BOUND message. MUST match the bundler's
  // buildArNSCustodyMessage byte-for-byte (newline-delimited) or every signature
  // is rejected. The bundler reconstructs this from the request and verifies the
  // signature over `message + nonce`, so a captured signature can't be replayed
  // against a different operation/params.
  private buildArNSCustodyMessage(
    action: 'transfer' | 'set-record' | 'remove-record',
    fields: string[],
  ): string {
    return ['arns', action, ...fields].join('\n');
  }

  /**
   * Self-custody exit: move a Turbo-custodied ANT to a Solana pubkey you control.
   * Authenticated with an action-bound, single-use signature.
   */
  public async transferArNSAnt({
    antId,
    target,
  }: {
    antId: string;
    target: string;
  }): Promise<{
    antId: string;
    target: string;
    name?: string;
    messageId: string;
  }> {
    const nonce = uuidV4();
    const headers = await this.signer.generateSignedRequestHeaders(
      nonce,
      this.buildArNSCustodyMessage('transfer', [antId, target]),
    );
    return this.httpService.post({
      endpoint: `/arns/transfer/${antId}?target=${encodeURIComponent(target)}`,
      headers,
      data: Buffer.from([]),
    });
  }

  /** Set a resolution record on a custodied ANT (undername defaults to '@'). */
  public async setArNSRecord({
    antId,
    undername = '@',
    transactionId,
    ttlSeconds,
  }: {
    antId: string;
    undername?: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{
    antId: string;
    undername: string;
    transactionId: string;
    ttlSeconds: number;
    messageId: string;
  }> {
    const nonce = uuidV4();
    const headers = await this.signer.generateSignedRequestHeaders(
      nonce,
      this.buildArNSCustodyMessage('set-record', [
        antId,
        undername,
        transactionId,
        String(ttlSeconds),
      ]),
    );
    const query = `?undername=${encodeURIComponent(
      undername,
    )}&transactionId=${transactionId}&ttlSeconds=${ttlSeconds}`;
    return this.httpService.post({
      endpoint: `/arns/manage/${antId}/set-record${query}`,
      headers,
      data: Buffer.from([]),
    });
  }

  /** Remove a resolution record (an undername) from a custodied ANT. */
  public async removeArNSRecord({
    antId,
    undername,
  }: {
    antId: string;
    undername: string;
  }): Promise<{ antId: string; undername: string; messageId: string }> {
    const nonce = uuidV4();
    const headers = await this.signer.generateSignedRequestHeaders(
      nonce,
      this.buildArNSCustodyMessage('remove-record', [antId, undername]),
    );
    return this.httpService.post({
      endpoint: `/arns/manage/${antId}/remove-record?undername=${encodeURIComponent(
        undername,
      )}`,
      headers,
      data: Buffer.from([]),
    });
  }

  public async getCreditShareApprovals({
    userAddress,
  }: {
    userAddress?: string;
  }): Promise<GetCreditShareApprovalsResponse> {
    userAddress ??= await this.signer.getNativeAddress();
    return super.getCreditShareApprovals({ userAddress });
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
    turboCreditDestinationAddress,
  }: TurboFundWithTokensParams): Promise<TurboCryptoFundResponse> {
    if (!this.tokenTools) {
      throw new Error(`Token type not supported for crypto fund ${this.token}`);
    }

    if (turboCreditDestinationAddress !== undefined) {
      if (isAnyValidUserAddress(turboCreditDestinationAddress) === false) {
        throw new Error(
          `Invalid turboCreditDestinationAddress provided: ${turboCreditDestinationAddress}`,
        );
      }
    }

    const tokenAmount = new BigNumber(tokenAmountV);

    const target = await this.getTargetWalletForFund();
    this.logger.debug('Funding account...', {
      feeMultiplier,
      tokenAmount,
      target,
      token: this.token,
      turboCreditDestinationAddress,
    });

    const fundTx = await this.tokenTools.createAndSubmitTx({
      target,
      tokenAmount,
      feeMultiplier,
      signer: this.signer,
      turboCreditDestinationAddress,
    });

    const txId = fundTx.id;

    try {
      // Let transaction settle some time
      await this.tokenTools.pollTxAvailability({ txId });
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
