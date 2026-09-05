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
  ArNSAction,
  ArNSActionCompleted,
  ArNSActionPriceResponse,
  ArNSActionResult,
  ArNSFiatPurchaseQuoteParams,
  ArNSFiatPurchaseQuoteResponse,
  ArNSNameType,
  ArNSOwnerSigner,
  ArNSPaidByParams,
  ArNSPriceParams,
  ArNSPriceResponse,
  ArNSPurchaseParams,
  ArNSPurchaseStatusResponse,
  AuthenticatedArNSFiatPurchaseQuoteParams,
  Currency,
  GetCreditShareApprovalsResponse,
  RawWincForTokenResponse,
  TokenTools,
  TokenType,
  TopUpRawResponse,
  TurboArNSNamesResponse,
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
  TurboFreeStatusResponse,
  TurboFundWithTokensParams,
  TurboInfoResponse,
  TurboLogger,
  TurboPaymentHistoryParams,
  TurboPaymentHistoryResponse,
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
  fiatCurrencyTypes,
  isCurrency,
} from '../types.js';
import { isAnyValidUserAddress } from '../utils/common.js';
import {
  FailedRequestError,
  FiatPaymentsDisabledError,
  InsufficientCreditsError,
  ProvidedInputError,
} from '../utils/errors.js';
import { uuidV4 } from '../utils/uuid.js';
import {
  arNSKeywordsField,
  arNSMetadataField,
  arNSOwnerProofHeaders,
  buildArNSCustodyMessage,
} from './arnsActions.js';
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
      endpoint: `/account/balance/${this.token}?address=${encodeURIComponent(
        address,
      )}`,
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

  public async getFreeStatus(
    address: string,
  ): Promise<TurboFreeStatusResponse> {
    const status = await this.httpService.get<TurboFreeStatusResponse>({
      endpoint: `/account/free?address=${encodeURIComponent(address)}`,
      allowedStatuses: [200, 404],
    });
    // Normalize: preserve a legitimate `0` (free tier off) or `null` (unlimited),
    // and coerce a missing field (e.g. a 404 body) to `null`.
    return { bytesRemaining: status?.bytesRemaining ?? null };
  }

  /**
   * Returns the ArNS names a wallet owns or controls -- both custodial names
   * bought via Turbo's ArNS-with-credits feature (Turbo may spawn and hold
   * the ANT on the caller's behalf, depending on the buy) and self-custody
   * names, in one list. See `TurboArNSName` for field semantics, including
   * the `custodial` flag distinguishing the two.
   *
   * To read a name's current records or lease/expiration state, use
   * `@ar.io/sdk` directly against the returned `antId` -- it talks to the
   * chain directly and needs no round-trip through this SDK/backend.
   */
  public getArNSNames(address: string): Promise<TurboArNSNamesResponse> {
    return this.httpService.get<TurboArNSNamesResponse>({
      endpoint: `/arns/my-names/${encodeURIComponent(address)}`,
    });
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
    const price = await this.httpService.get<ArNSPriceResponse>({
      endpoint: `/arns/price/${params.intent.toLowerCase()}/${encodeURIComponent(
        params.name,
      )}${this.buildArNSPurchaseQuery(params)}`,
    });
    // Normalize the figure to charge into ONE field. `winc` is the name only
    // and excludes the ANT spawn surcharge — for a Buy-Name that surcharge can
    // exceed the name's own price, so a caller reading `winc` silently
    // under-quotes every purchase. Surfacing `wincTotal` makes the correct
    // field the obvious one.
    return {
      ...price,
      wincTotal: price.wincTotalWithAntSpawn ?? price.winc,
    };
  }

  /**
   * Preview the flat credits margin one of the eight non-purchase actions
   * (everything except Buy-Name/Extend-Lease/Upgrade-Name/
   * Increase-Undername-Limit) will debit, without creating it. Those four
   * purchase actions are priced by `getArNSPriceForName` instead — their
   * cost is dominated by the ARIO purchase, not this margin, so this route
   * rejects them.
   *
   * No signature required: this mirrors `getArNSPriceForName`'s read-only,
   * unauthenticated shape rather than `getArNSActionStatus`'s (which happens
   * to live on the authenticated client today despite needing no signature
   * either).
   */
  public async getArNSActionPrice(
    action: ArNSAction,
  ): Promise<ArNSActionPriceResponse> {
    return this.httpService.get<ArNSActionPriceResponse>({
      endpoint: `/arns/actions/${action}/price`,
    });
  }

  /**
   * Fail fast (client-side) on malformed ArNS requests so JS callers that bypass
   * the compile-time intent unions get a clear `ProvidedInputError` instead of an
   * opaque service 4xx. Enforces the required fields per intent:
   *  - `Buy-Name`: `type` ('lease' | 'permabuy'); leases also need `years`.
   *    `processId` is OPTIONAL — omit it to have the bundler custodially
   *    provision the ANT (Turbo owns it), supply it for a user-owned ANT.
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
        // `processId` is optional for Buy-Name: omitting it drives the
        // bundler's custodial provisioning path (Turbo spawns + owns the ANT).
        // If supplied it must be a non-empty string (user-owned ANT).
        if (
          p.processId !== undefined &&
          (typeof p.processId !== 'string' || p.processId.length === 0)
        ) {
          throw new ProvidedInputError(
            'Buy-Name `processId`, when provided, must be a non-empty string (the ANT the name resolves to).',
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
      endpoint: `/arns/purchase/${encodeURIComponent(nonce)}`,
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

  /**
   * Quote a fiat (Stripe) ArNS purchase — buy a name with a credit card in one
   * step, with no Turbo Credits top-up in between.
   *
   * Returns the recorded `purchaseQuote` (its `nonce` is what
   * `getArNSPurchaseStatus` polls) plus the Stripe `paymentSession` to complete
   * payment with. For `payment-intent`, confirm client-side with
   * `stripe.confirmCardPayment(paymentSession.client_secret, ...)`, then poll
   * the nonce until the purchase reports success or failure.
   *
   * Throws {@link FiatPaymentsDisabledError} when the service has Stripe turned
   * off (normal in the testnet sandbox) so callers can fall back to the
   * credit-paid path without string-matching a generic 503.
   */
  public async getArNSFiatPurchaseQuote(
    params: ArNSFiatPurchaseQuoteParams,
  ): Promise<ArNSFiatPurchaseQuoteResponse> {
    this.validateArNSPurchaseParams(params);

    const {
      address,
      currency,
      method = 'payment-intent',
      promoCodes = [],
    } = params;

    if (typeof address !== 'string' || address.length === 0) {
      throw new ProvidedInputError(
        'A destination `address` is required for a fiat ArNS purchase quote.',
      );
    }
    if (!isCurrency(currency)) {
      throw new ProvidedInputError(
        `Invalid currency '${currency}'. Supported: ${fiatCurrencyTypes.join(
          ', ',
        )}`,
      );
    }

    // Every interpolated segment is encoded. Five user-controlled values land in
    // the path here, and an unencoded one (e.g. a name or address containing
    // `../`) would silently retarget the request at another route.
    const segments = [
      method,
      address,
      currency,
      params.intent,
      params.name,
    ].map((segment) => encodeURIComponent(segment));

    const query = this.buildArNSFiatQuoteQuery(params, promoCodes);

    try {
      return await this.httpService.get<ArNSFiatPurchaseQuoteResponse>({
        endpoint: `/arns/quote/${segments.join('/')}${query}`,
      });
    } catch (error) {
      // The service returns 503 both for "Stripe is disabled" and for internal
      // errors, so the body is what disambiguates them.
      if (
        error instanceof FailedRequestError &&
        error.status === 503 &&
        /Fiat \(Stripe\).*disabled/i.test(error.message)
      ) {
        throw new FiatPaymentsDisabledError(error.message);
      }
      throw error;
    }
  }

  /**
   * Query string for a fiat quote. Distinct from `buildArNSPurchaseQuery`
   * because this route takes `uiMode` + its paired URLs and has no `paidBy`
   * (fiat has no delegated payer), and because promo codes must be REPEATED
   * params here: the service reads them with `parseQueryParams`, which treats a
   * comma-joined string as one code rather than several.
   */
  protected buildArNSFiatQuoteQuery(
    params: ArNSFiatPurchaseQuoteParams,
    promoCodes: string[],
  ): string {
    const { type, years, increaseQty, processId } = params as {
      type?: ArNSNameType;
      years?: number;
      increaseQty?: number;
      processId?: string;
    };
    const search = new URLSearchParams();
    if (type !== undefined) search.set('type', type);
    if (years !== undefined) search.set('years', `${years}`);
    if (increaseQty !== undefined) search.set('increaseQty', `${increaseQty}`);
    if (processId !== undefined) search.set('processId', processId);

    const uiMode = (params as { uiMode?: string }).uiMode;
    if (uiMode !== undefined) search.set('uiMode', uiMode);
    if (uiMode === 'embedded') {
      const { returnUrl } = params as { returnUrl?: string };
      if (returnUrl !== undefined) search.set('returnUrl', returnUrl);
    } else {
      const { successUrl, cancelUrl } = params as {
        successUrl?: string;
        cancelUrl?: string;
      };
      if (successUrl !== undefined) search.set('successUrl', successUrl);
      if (cancelUrl !== undefined) search.set('cancelUrl', cancelUrl);
    }

    for (const code of promoCodes) {
      search.append('promoCode', code);
    }

    const query = search.toString();
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
      endpoint: `/account/approvals/get?userAddress=${encodeURIComponent(
        userAddress,
      )}`,
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
   * Quote a fiat (Stripe) ArNS purchase. `address` defaults to this signer's
   * native address — the wallet that will own the name — so the common case
   * needs no address at all. Pass one explicitly to buy on another wallet's
   * behalf; the route takes the destination as a path param and requires no
   * signature, which is why it is available unauthenticated too.
   */
  public async getArNSFiatPurchaseQuote(
    params: AuthenticatedArNSFiatPurchaseQuoteParams,
  ): Promise<ArNSFiatPurchaseQuoteResponse> {
    const address = params.address ?? (await this.signer.getNativeAddress());
    return super.getArNSFiatPurchaseQuote({
      ...params,
      address,
    } as ArNSFiatPurchaseQuoteParams);
  }

  public async getFreeStatus(
    userAddress?: string,
  ): Promise<TurboFreeStatusResponse> {
    userAddress ??= await this.signer.getNativeAddress();
    return super.getFreeStatus(userAddress);
  }

  /**
   * The signer's OWN completed top-up history (crypto + fiat), merged newest
   * first and keyset-paginated. This is a SIGNED GET: unlike `getBalance` /
   * `getFreeStatus` (which name a wallet by `?address=`), payment history is
   * self-scoped and returns only the rows belonging to the signing wallet — the
   * service reads the address from the signature, never a query param.
   *
   * We sign the bare nonce (no action-binding of `limit`/`cursor`) to match the
   * service's `verifySignature` middleware; the pagination params ride in the
   * query string. Pass `cursor` from a prior response to fetch the next page.
   */
  public async getPaymentHistory({
    limit,
    cursor,
  }: TurboPaymentHistoryParams = {}): Promise<TurboPaymentHistoryResponse> {
    const headers = await this.signer.generateSignedRequestHeaders();
    const query = new URLSearchParams();
    if (limit !== undefined) {
      query.set('limit', `${limit}`);
    }
    if (cursor !== undefined) {
      query.set('cursor', cursor);
    }
    const queryString = query.toString();
    return this.httpService.get<TurboPaymentHistoryResponse>({
      endpoint: `/account/payments${queryString ? `?${queryString}` : ''}`,
      headers,
      allowedStatuses: [200],
    });
  }

  /**
   * Buy / extend / upgrade an ArNS name, paying with the signer's Turbo credit
   * balance. The bundler performs the on-chain ARIO purchase and debits credits;
   * a `402` (FailedRequestError.status === 402) indicates insufficient credits.
   */
  // ===== ArNS actions — the sponsored surface =====
  //
  // Every ArNS operation is an ACTION, and an action has exactly one of two
  // shapes, chosen by the SERVER rather than the caller: either Turbo already
  // holds the authority (`completed`), or the ANT owner must sign a transaction
  // Turbo has already fee-payer-signed (`awaiting-signature`).
  //
  // The shape is not stable per action, which is why callers must branch on
  // `status` and never on which action they asked for: `set-record` completes
  // alone while Turbo is a controller, and degrades to `awaiting-signature`
  // the moment the customer revokes Turbo.
  //
  // This replaced `/arns/purchase/{intent}/{name}`, `/arns/transfer/{antId}`
  // and `/arns/manage/*`, which were deleted along with Turbo-custodial ANTs.
  // Turbo now takes custody of nothing: every ANT is minted straight to the
  // customer.

  /**
   * Create an action. Returns `completed` or `awaiting-signature`.
   *
   * Credits are debited HERE, not at `/sign`. Capture the returned `nonce`
   * before prompting for a signature: it is the idempotency key, and polling
   * it is how you resume. Never re-create an action to "retry" — that debits
   * a second time. An abandoned action is refunded automatically.
   */
  public async createArNSAction(
    action: ArNSAction,
    params: Record<string, unknown> = {},
    ownerProof?: { owner: ArNSOwnerSigner; message: string },
  ): Promise<ArNSActionResult> {
    const nonce = uuidV4();
    const headers: Record<string, string> = {
      ...(await this.signer.generateSignedRequestHeaders(nonce)),
      'content-type': 'application/json',
    };

    // Record actions carry a SECOND signature, from the ANT owner's Solana key
    // over a different message. It travels in its own `x-owner-*` headers
    // because two signatures cannot share one header set.
    if (ownerProof !== undefined) {
      Object.assign(
        headers,
        await arNSOwnerProofHeaders(
          ownerProof.owner,
          ownerProof.message,
          uuidV4(),
        ),
      );
    }

    try {
      return await this.httpService.post<ArNSActionResult>({
        endpoint: `/arns/actions/${action}`,
        headers,
        data: Buffer.from(JSON.stringify(params)),
        // Non-idempotent signed write that has already debited. A blind retry
        // risks paying twice for one name; poll the nonce instead.
        retry: false,
      });
    } catch (error) {
      if (error instanceof FailedRequestError && error.status === 402) {
        throw new InsufficientCreditsError(error.message);
      }
      throw error;
    }
  }

  /**
   * Submit the owner-signed transaction for an `awaiting-signature` action.
   *
   * `signedTransaction` is the FULL serialized transaction, base64 — not just
   * the signature. Replaying a completed action returns `alreadyCompleted:
   * true` rather than buying twice, so this is safe to call again if a
   * response is lost.
   */
  public async signArNSAction(
    nonce: string,
    signedTransaction: string,
  ): Promise<ArNSActionCompleted> {
    return this.httpService.post<ArNSActionCompleted>({
      endpoint: `/arns/actions/${nonce}/sign`,
      headers: {
        ...(await this.signer.generateSignedRequestHeaders(uuidV4())),
        'content-type': 'application/json',
      },
      data: Buffer.from(JSON.stringify({ transaction: signedTransaction })),
      retry: false,
    });
  }

  /**
   * Status of an action by nonce. Open — no signature required — so it works
   * from a status page or callback handler that never holds the payer's key.
   *
   * Terminal success carries `messageId`; terminal failure carries
   * `failedDate`.
   */
  public async getArNSActionStatus(
    nonce: string,
  ): Promise<ArNSActionResult & { failedDate?: string }> {
    return this.httpService.get<ArNSActionResult & { failedDate?: string }>({
      endpoint: `/arns/actions/${nonce}`,
    });
  }

  /**
   * Run an action to a terminal state, signing if the server asks for it.
   *
   * This is the two-shape branch, once, in one place — so callers cannot
   * hardcode which actions need a signature and break when a customer
   * exercises ownership.
   */
  private async completeArNSAction(
    action: ArNSAction,
    params: Record<string, unknown>,
    owner: ArNSOwnerSigner | undefined,
    opts: { onNonce?: (nonce: string) => void | Promise<void> } = {},
    ownerProofMessage?: string,
  ): Promise<ArNSActionCompleted> {
    const created = await this.createArNSAction(
      action,
      params,
      owner !== undefined && ownerProofMessage !== undefined
        ? { owner, message: ownerProofMessage }
        : undefined,
    );

    // Fires before any wallet prompt: the action is already debited, so the
    // caller needs the nonce persisted even if the user walks away here.
    await opts.onNonce?.(created.nonce);

    if (created.status === 'completed') return created;

    if (owner === undefined) {
      throw new Error(
        `ArNS action "${action}" requires the ANT owner's signature, but no owner signer was provided. ` +
          `Pass \`owner\`, or drive createArNSAction/signArNSAction yourself. ` +
          `Nonce ${created.nonce} is already debited — poll it rather than re-creating.`,
      );
    }

    const signed = await owner.signTransaction(created.transaction);
    return this.signArNSAction(created.nonce, signed);
  }

  /**
   * Buy a name. The ANT is minted straight to `owner` — Turbo never holds it.
   *
   * This is the ONLY action that always needs the owner's signature:
   * `ario_ant::initialize` is the one instruction in the whole lifecycle that
   * requires the ANT owner's key. The customer signs once, here, and never
   * again unless they change controllers or transfer the name.
   *
   * The owner needs a Solana key to sign with, NOT a funded one — Turbo pays
   * every lamport of fee and rent.
   */
  public async buyArNSName({
    name,
    owner,
    type = 'lease',
    years,
    paidBy,
    onNonce,
  }: {
    name: string;
    owner: ArNSOwnerSigner;
    type?: ArNSNameType;
    years?: number;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'buy-name',
      {
        name,
        ownerAddress: await owner.getAddress(),
        type,
        ...(years !== undefined ? { years } : {}),
        ...(paidBy !== undefined ? { paidBy } : {}),
      },
      owner,
      { onNonce },
    );
  }

  /** Extend a lease. Permissionless on chain — no owner signature needed. */
  public async extendArNSLease({
    name,
    years,
    paidBy,
    onNonce,
  }: {
    name: string;
    years: number;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'extend-lease',
      { name, years, ...(paidBy !== undefined ? { paidBy } : {}) },
      undefined,
      { onNonce },
    );
  }

  /** Upgrade a lease to a permanent name. No owner signature needed. */
  public async upgradeArNSName({
    name,
    paidBy,
    onNonce,
  }: {
    name: string;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'upgrade-name',
      { name, ...(paidBy !== undefined ? { paidBy } : {}) },
      undefined,
      { onNonce },
    );
  }

  /** Raise the undername limit. No owner signature needed. */
  public async increaseArNSUndernameLimit({
    name,
    increaseQty,
    paidBy,
    onNonce,
  }: {
    name: string;
    increaseQty: number;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'increase-undername-limit',
      { name, increaseQty, ...(paidBy !== undefined ? { paidBy } : {}) },
      undefined,
      { onNonce },
    );
  }

  /**
   * Point a name (or undername) at an Arweave transaction.
   *
   * Costs a small credit margin — never SOL, which Turbo sponsors. Completes in one call while Turbo is
   * a controller of the ANT, and returns `awaiting-signature` once the customer
   * has revoked Turbo, at which point `owner` signs it themselves. Both paths
   * are handled here.
   *
   * The owner proof is required EITHER WAY: Turbo is directing its own
   * controller authority over an asset someone else owns, so nothing on chain
   * records the owner's consent and we demand it. It is a MESSAGE signature,
   * not a transaction — cheap and offline, but still a wallet prompt.
   */
  public async setArNSRecord({
    antId,
    owner,
    transactionId,
    undername = '@',
    ttlSeconds = 3600,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    transactionId: string;
    undername?: string;
    ttlSeconds?: number;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'set-record',
      {
        antId,
        ownerAddress: await owner.getAddress(),
        transactionId,
        undername,
        ttlSeconds,
      },
      owner,
      { onNonce },
      buildArNSCustodyMessage('set-record', [
        antId,
        undername,
        transactionId,
        String(ttlSeconds),
      ]),
    );
  }

  /** Remove a record (an undername). Costs credits, never SOL. */
  public async removeArNSRecord({
    antId,
    owner,
    undername,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'remove-record',
      { antId, ownerAddress: await owner.getAddress(), undername },
      owner,
      { onNonce },
      buildArNSCustodyMessage('remove-record', [antId, undername]),
    );
  }

  /**
   * Edit a RECORD's metadata — its display name, logo, description, keywords.
   *
   * Costs a small credit margin (never SOL), and is owner-or-controller on
   * chain, so it behaves exactly like
   * {@link setArNSRecord}: Turbo-alone while it is a controller, owner-signed
   * after a revoke.
   *
   * Fields are TRI-STATE. Omit one to leave it unchanged; pass `null` to clear
   * it. Those are bound distinctly by the owner proof, so "clear the
   * description" and "set it to empty" are different authorizations.
   *
   * Note this is RECORD metadata. ANT-level metadata (the ANT's own name,
   * ticker, description, keywords, logo) is NOT sponsored and stays on the
   * direct-signer path via `@ar.io/sdk`.
   */
  public async setArNSRecordMetadata({
    antId,
    owner,
    undername = '@',
    displayName,
    recordLogo,
    recordDescription,
    recordKeywords,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername?: string;
    displayName?: string | null;
    recordLogo?: string | null;
    recordDescription?: string | null;
    recordKeywords?: string[] | null;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'set-record-metadata',
      {
        antId,
        ownerAddress: await owner.getAddress(),
        undername,
        // Sent explicitly, including `null`, so the server sees the same
        // tri-state the proof was signed over.
        ...(displayName !== undefined ? { displayName } : {}),
        ...(recordLogo !== undefined ? { recordLogo } : {}),
        ...(recordDescription !== undefined ? { recordDescription } : {}),
        ...(recordKeywords !== undefined ? { recordKeywords } : {}),
      },
      owner,
      { onNonce },
      buildArNSCustodyMessage('set-record-metadata', [
        antId,
        undername,
        arNSMetadataField(displayName),
        arNSMetadataField(recordLogo),
        arNSMetadataField(recordDescription),
        arNSKeywordsField(recordKeywords),
      ]),
    );
  }

  /** Clear a record's metadata. Costs credits, never SOL; same two-shape rules. */
  public async removeArNSRecordMetadata({
    antId,
    owner,
    undername,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'remove-record-metadata',
      { antId, ownerAddress: await owner.getAddress(), undername },
      owner,
      { onNonce },
      buildArNSCustodyMessage('remove-record-metadata', [antId, undername]),
    );
  }

  /**
   * Hand ONE record to another address.
   *
   * Distinct from {@link transferArNSAnt}, which hands over the whole ANT and
   * every record on it. Confusing the two gives away far more than intended.
   */
  public async transferArNSRecord({
    antId,
    owner,
    undername,
    target,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername: string;
    target: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'transfer-record',
      { antId, ownerAddress: await owner.getAddress(), undername, target },
      owner,
      { onNonce },
      buildArNSCustodyMessage('transfer-record', [antId, undername, target]),
    );
  }

  /**
   * Grant controller rights on the ANT. Omit `target` for Turbo itself, which
   * is what makes `setArNSRecord` a single call.
   *
   * Owner-signed: changing an ANT's access control is an owner-only
   * instruction. Costs a small credit margin; Turbo funds the ACL page growth
   * in SOL.
   */
  public async addArNSController({
    antId,
    owner,
    target,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    target?: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'add-controller',
      {
        antId,
        ownerAddress: await owner.getAddress(),
        ...(target !== undefined ? { target } : {}),
      },
      owner,
      { onNonce },
    );
  }

  /**
   * Revoke controller rights — the escape hatch that keeps "Turbo is not a
   * custodian" honest.
   *
   * Always available, and needs nothing from Turbo but the fee. Costs a small
   * credit margin rather than SOL.
   * After revoking, `setArNSRecord` keeps working: it simply starts returning
   * `awaiting-signature` so the owner signs their own record writes.
   */
  public async removeArNSController({
    antId,
    owner,
    target,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    target?: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'remove-controller',
      {
        antId,
        ownerAddress: await owner.getAddress(),
        ...(target !== undefined ? { target } : {}),
      },
      owner,
      { onNonce },
    );
  }

  /**
   * Hand the ANT to a new owner. Irreversible: after this lands, `owner` no
   * longer controls the name. Owner-signed, and sponsored like the rest.
   */
  public async transferArNSAnt({
    antId,
    owner,
    target,
    onNonce,
  }: {
    antId: string;
    owner: ArNSOwnerSigner;
    target: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.completeArNSAction(
      'transfer',
      { antId, ownerAddress: await owner.getAddress(), target },
      owner,
      { onNonce },
    );
  }

  /**
   * Defaults to the signer's own address when `userAddress` is omitted
   * (`null`/`undefined`). Passing `''` does NOT trigger this default --
   * mirrors `getBalance`'s existing behavior above.
   */
  public async getArNSNames(
    userAddress?: string,
  ): Promise<TurboArNSNamesResponse> {
    userAddress ??= await this.signer.getNativeAddress();
    return super.getArNSNames(userAddress);
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
