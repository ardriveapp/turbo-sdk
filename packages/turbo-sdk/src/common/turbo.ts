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
  ArNSActionResult,
  ArNSFiatPurchaseQuoteParams,
  ArNSFiatPurchaseQuoteResponse,
  ArNSNameType,
  ArNSOwnerSigner,
  ArNSPriceParams,
  ArNSPriceResponse,
  ArNSPurchaseStatusResponse,
  AuthenticatedArNSFiatPurchaseQuoteParams,
  CreditShareApproval,
  Currency,
  FundingOptions,
  GetCreditShareApprovalsResponse,
  NativeAddress,
  TokenType,
  TurboAbortSignal,
  TurboArNSNamesResponse,
  TurboAuthenticatedClientConfiguration,
  TurboAuthenticatedClientInterface,
  TurboAuthenticatedPaymentServiceInterface,
  TurboAuthenticatedUploadServiceInterface,
  TurboBalanceResponse,
  TurboCheckoutSessionParams,
  TurboCheckoutSessionResponse,
  TurboChunkingParams,
  TurboCountriesResponse,
  TurboCreateCreditShareApprovalParams,
  TurboCryptoFundResponse,
  TurboCurrenciesResponse,
  TurboDataItemSigner,
  TurboFiatEstimateForBytesResponse,
  TurboFiatToArResponse,
  TurboFreeStatusResponse,
  TurboFundWithTokensParams,
  TurboPaymentHistoryParams,
  TurboPaymentHistoryResponse,
  TurboPaymentIntentParams,
  TurboPaymentIntentResponse,
  TurboPriceResponse,
  TurboRatesResponse,
  TurboRevokeCreditsParams,
  TurboSignedDataItemFactory,
  TurboSubmitFundTxResponse,
  TurboTokenPriceForBytesResponse,
  TurboUnauthenticatedClientConfiguration,
  TurboUnauthenticatedClientInterface,
  TurboUnauthenticatedPaymentServiceInterface,
  TurboUnauthenticatedUploadServiceInterface,
  TurboUploadAndSigningEmitterEvents,
  TurboUploadDataItemResponse,
  TurboUploadEmitterEvents,
  TurboUploadFileParams,
  TurboUploadFileWithFileOrPathParams,
  TurboUploadFileWithStreamFactoryParams,
  TurboUploadFolderParams,
  TurboUploadFolderResponse,
  TurboWincForFiatParams,
  TurboWincForFiatResponse,
  TurboWincForTokenParams,
  TurboWincForTokenResponse,
  UploadDataInput,
  UploadDataType,
  UserAddress,
} from '../types.js';
import {
  TurboUnauthenticatedPaymentService,
  defaultPaymentServiceURL,
  developmentPaymentServiceURL,
} from './payment.js';
import {
  TurboUnauthenticatedUploadService,
  defaultUploadServiceURL,
  developmentUploadServiceURL,
} from './upload.js';

/**
 * Testing configuration.
 */
export const developmentTurboConfiguration = {
  paymentServiceConfig: {
    url: developmentPaymentServiceURL,
  },
  uploadServiceConfig: {
    url: developmentUploadServiceURL,
  },
};

/**
 * Production configuration.
 */
export const defaultTurboConfiguration = {
  paymentServiceConfig: {
    url: defaultPaymentServiceURL,
  },
  uploadServiceConfig: {
    url: defaultUploadServiceURL,
  },
};

export class TurboUnauthenticatedClient
  implements TurboUnauthenticatedClientInterface
{
  protected paymentService: TurboUnauthenticatedPaymentServiceInterface;
  protected uploadService: TurboUnauthenticatedUploadServiceInterface;

  constructor({
    uploadService = new TurboUnauthenticatedUploadService({}),
    paymentService = new TurboUnauthenticatedPaymentService({}),
  }: TurboUnauthenticatedClientConfiguration) {
    this.paymentService = paymentService;
    this.uploadService = uploadService;
  }

  /**
   * Returns the supported fiat currency conversion rate for 1AR based on current market prices.
   */
  getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse> {
    return this.paymentService.getFiatToAR({ currency });
  }

  /**
   * Returns the latest conversion rates to purchase 1GiB of data for all supported currencies, including all adjustments and fees.
   *
   * Note: this does not take into account varying adjustments and promotions for different sizes of data. If you want to calculate the total
   * cost in 'winc' for a given number of bytes, use getUploadCosts.
   */
  getFiatRates(): Promise<TurboRatesResponse> {
    return this.paymentService.getFiatRates();
  }

  /**
   * Returns a comprehensive list of supported countries that can purchase credits through the Turbo Payment Service.
   */
  getSupportedCountries(): Promise<TurboCountriesResponse> {
    return this.paymentService.getSupportedCountries();
  }

  getBalance(address: NativeAddress): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance(address);
  }

  getFreeStatus(address: NativeAddress): Promise<TurboFreeStatusResponse> {
    return this.paymentService.getFreeStatus(address);
  }

  /**
   * Returns the price in 'winc' (and mARIO) to buy/extend/upgrade an ArNS name.
   */
  getArNSPriceForName(params: ArNSPriceParams): Promise<ArNSPriceResponse> {
    return this.paymentService.getArNSPriceForName(params);
  }

  /**
   * Returns the status of an ArNS purchase by its nonce.
   */
  getArNSPurchaseStatus(p: {
    nonce: string;
  }): Promise<ArNSPurchaseStatusResponse> {
    return this.paymentService.getArNSPurchaseStatus(p);
  }

  /**
   * Returns the ArNS names a wallet owns or controls via Turbo's custodial
   * ArNS-with-credits feature. `custodial: true` on a returned name means
   * Turbo still holds/manages its ANT (transfer/manage routes apply);
   * `custodial: false` means self-custody (or an already-completed exit) and
   * is informational only.
   *
   * To read a name's current records or lease/expiration state, use
   * `@ar.io/sdk` directly against the returned `antId`.
   */
  getArNSNames(address: NativeAddress): Promise<TurboArNSNamesResponse> {
    return this.paymentService.getArNSNames(address);
  }

  /**
   * Quote a fiat (Stripe) ArNS purchase — buy a name with a credit card in one
   * step, no Turbo Credits top-up in between. Complete the returned
   * `paymentSession` with Stripe, then poll {@link getArNSPurchaseStatus} using
   * `purchaseQuote.nonce`.
   *
   * Throws `FiatPaymentsDisabledError` when the service has Stripe switched off.
   */
  getArNSFiatPurchaseQuote(
    params: ArNSFiatPurchaseQuoteParams,
  ): Promise<ArNSFiatPurchaseQuoteResponse> {
    return this.paymentService.getArNSFiatPurchaseQuote(params);
  }

  /**
   * Returns a list of all supported fiat currencies.
   */
  getSupportedCurrencies(): Promise<TurboCurrenciesResponse> {
    return this.paymentService.getSupportedCurrencies();
  }

  /**
   * Determines the price in 'winc' to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
   */
  getUploadCosts({
    bytes,
  }: {
    bytes: number[];
  }): Promise<TurboPriceResponse[]> {
    return this.paymentService.getUploadCosts({ bytes });
  }

  /**
   * Determines the amount of 'winc' that would be returned for a given currency and amount, including all Turbo cost adjustments and fees.
   */
  getWincForFiat(
    params: TurboWincForFiatParams,
  ): Promise<TurboWincForFiatResponse> {
    return this.paymentService.getWincForFiat(params);
  }

  /**
   * Determines the amount of 'winc' that would be returned for a given token and amount, including all Turbo cost adjustments and fees.
   */
  getWincForToken(
    params: TurboWincForTokenParams,
  ): Promise<TurboWincForTokenResponse> {
    return this.paymentService.getWincForToken(params);
  }

  /**
   * Determines the fiat estimate for a given byte count in a specific currency, including all Turbo cost adjustments and fees.
   */
  getFiatEstimateForBytes({
    byteCount,
    currency,
  }: {
    byteCount: number;
    currency: Currency;
  }): Promise<TurboFiatEstimateForBytesResponse> {
    return this.paymentService.getFiatEstimateForBytes({
      byteCount,
      currency,
    });
  }

  /**
   * Determines the price in the instantiated token to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
   */
  getTokenPriceForBytes({
    byteCount,
  }: {
    byteCount: number;
  }): Promise<TurboTokenPriceForBytesResponse> {
    return this.paymentService.getTokenPriceForBytes({ byteCount });
  }

  /**
   * Uploads a signed data item to the Turbo Upload Service.
   */
  uploadSignedDataItem({
    dataItemStreamFactory,
    dataItemSizeFactory,
    signal,
    events,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal &
    TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadSignedDataItem({
      dataItemStreamFactory,
      dataItemSizeFactory,
      signal,
      events,
    });
  }

  /**
   * Creates a Turbo Checkout Session for a given amount and currency.
   */
  createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse> {
    return this.paymentService.createCheckoutSession(params);
  }

  /**
   * Returns the payment intent for a given amount and currency.
   * This is used to create a payment intent, gather payment method
   * on client side, and complete via Stripe SDK or API.
   */
  createPaymentIntent(
    params: TurboPaymentIntentParams,
  ): Promise<TurboPaymentIntentResponse> {
    return this.paymentService.createPaymentIntent(params);
  }

  /**
   * Submits a transaction ID to the Turbo Payment Service for processing.
   */
  submitFundTransaction(p: {
    txId: string;
  }): Promise<TurboSubmitFundTxResponse> {
    return this.paymentService.submitFundTransaction(p);
  }

  /**
   * Returns the connected target Turbo wallet addresses for all supported tokens.
   */
  async getTurboCryptoWallets(): Promise<Record<TokenType, string>> {
    const wallets = await this.paymentService.getTurboCryptoWallets();
    wallets.pol = wallets.matic;
    return wallets;
  }

  /**
   * Returns a list of all credit share approvals for the user.
   */
  getCreditShareApprovals(p: {
    userAddress: NativeAddress;
  }): Promise<GetCreditShareApprovalsResponse> {
    return this.paymentService.getCreditShareApprovals(p);
  }

  uploadRawX402Data({
    data,
    tags,
    signal,
    maxMUSDCAmount,
  }: {
    data: UploadDataType;
    signal?: AbortSignal;
    tags?: { name: string; value: string }[];
    maxMUSDCAmount?: BigNumber;
  }): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadRawX402Data({
      data,
      tags,
      signal,
      maxMUSDCAmount,
    });
  }
}

export class TurboAuthenticatedClient
  extends TurboUnauthenticatedClient
  implements TurboAuthenticatedClientInterface
{
  // override the parent classes for authenticated types
  protected paymentService: TurboAuthenticatedPaymentServiceInterface;
  protected uploadService: TurboAuthenticatedUploadServiceInterface;
  public signer: TurboDataItemSigner;

  constructor({
    paymentService,
    uploadService,
    signer,
  }: TurboAuthenticatedClientConfiguration) {
    super({ paymentService, uploadService });
    this.signer = signer;
  }

  /**
   * Returns the current balance of the user's wallet in 'winc'.
   */
  getBalance(userAddress?: NativeAddress): Promise<TurboBalanceResponse> {
    return this.paymentService.getBalance(userAddress);
  }

  /**
   * Returns how many free-tier bytes the wallet can still upload for free
   * (`bytesRemaining`), or `null` for an unlimited (exempt/partner) wallet.
   */
  getFreeStatus(userAddress?: NativeAddress): Promise<TurboFreeStatusResponse> {
    return this.paymentService.getFreeStatus(userAddress);
  }

  /**
   * Returns the signer's OWN completed top-up history (crypto + fiat), newest
   * first and keyset-paginated. Signature-required and self-scoped: it only ever
   * returns the signing wallet's rows. Pass `cursor` from a prior response's
   * `cursor` field (with `hasMore === true`) to fetch the next page.
   */
  getPaymentHistory(
    params?: TurboPaymentHistoryParams,
  ): Promise<TurboPaymentHistoryResponse> {
    return this.paymentService.getPaymentHistory(params);
  }

  // ===== ArNS actions (sponsored) =====
  //
  // Thin delegations. The two-shape branch and the owner-proof construction
  // live in the payment service; see its comments for why callers must branch
  // on `status` rather than on which action they asked for.

  /** Create an action. Debits credits HERE — capture the nonce before signing. */
  createArNSAction(
    action: ArNSAction,
    params?: Record<string, unknown>,
    ownerProof?: { owner: ArNSOwnerSigner; message: string },
  ): Promise<ArNSActionResult> {
    return this.paymentService.createArNSAction(action, params, ownerProof);
  }

  /** Submit the owner-signed transaction (FULL serialized tx, base64). */
  signArNSAction(
    nonce: string,
    signedTransaction: string,
  ): Promise<ArNSActionCompleted> {
    return this.paymentService.signArNSAction(nonce, signedTransaction);
  }

  /** Status by nonce — open, needs no signature. Use it to resume. */
  getArNSActionStatus(
    nonce: string,
  ): Promise<ArNSActionResult & { failedDate?: string }> {
    return this.paymentService.getArNSActionStatus(nonce);
  }

  /**
   * Quote a fiat (Stripe) ArNS purchase for this signer's wallet — a credit-card
   * buy in one step, with no Turbo Credits top-up in between. `address` defaults
   * to the signer's native address; pass one to buy on another wallet's behalf.
   *
   * Complete the returned `paymentSession` with Stripe, then poll
   * {@link getArNSPurchaseStatus} using `purchaseQuote.nonce`. Throws
   * `FiatPaymentsDisabledError` when the service has Stripe switched off.
   */
  getArNSFiatPurchaseQuote(
    params: AuthenticatedArNSFiatPurchaseQuoteParams,
  ): Promise<ArNSFiatPurchaseQuoteResponse> {
    return this.paymentService.getArNSFiatPurchaseQuote(params);
  }

  /**
   * Buy a name. The ANT is minted straight to `owner`; Turbo never holds it.
   * The only action that always needs the owner's signature — once, ever.
   */
  buyArNSName(params: {
    name: string;
    owner: ArNSOwnerSigner;
    type?: ArNSNameType;
    years?: number;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.buyArNSName(params);
  }

  /** Extend a lease. No owner signature needed. */
  extendArNSLease(params: {
    name: string;
    years: number;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.extendArNSLease(params);
  }

  /** Raise the undername limit. No owner signature needed. */
  increaseArNSUndernameLimit(params: {
    name: string;
    increaseQty: number;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.increaseArNSUndernameLimit(params);
  }

  /** Upgrade a lease to a permanent name. No owner signature needed. */
  upgradeArNSName(params: {
    name: string;
    paidBy?: UserAddress | UserAddress[];
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.upgradeArNSName(params);
  }

  /** Point a name (or undername) at data. Free; handles both shapes. */
  setArNSRecord(params: {
    antId: string;
    owner: ArNSOwnerSigner;
    transactionId: string;
    undername?: string;
    ttlSeconds?: number;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.setArNSRecord(params);
  }

  /** Remove a record. Free; handles both shapes. */
  removeArNSRecord(params: {
    antId: string;
    owner: ArNSOwnerSigner;
    undername: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.removeArNSRecord(params);
  }

  /** Grant controller rights — omit `target` for Turbo itself. Free. */
  addArNSController(params: {
    antId: string;
    owner: ArNSOwnerSigner;
    target?: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.addArNSController(params);
  }

  /** Revoke controller rights. Always available, always free. */
  removeArNSController(params: {
    antId: string;
    owner: ArNSOwnerSigner;
    target?: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.removeArNSController(params);
  }

  /** Hand the ANT to a new owner. Irreversible. Free. */
  transferArNSAnt(params: {
    antId: string;
    owner: ArNSOwnerSigner;
    target: string;
    onNonce?: (nonce: string) => void | Promise<void>;
  }): Promise<ArNSActionCompleted> {
    return this.paymentService.transferArNSAnt(params);
  }

  /**
   * Returns the ArNS names owned or controlled by the connected signer's
   * wallet (or the given `userAddress`) via Turbo's custodial
   * ArNS-with-credits feature.
   */
  getArNSNames(userAddress?: NativeAddress): Promise<TurboArNSNamesResponse> {
    return this.paymentService.getArNSNames(userAddress);
  }

  /**
   * Returns a list of all credit share approvals for the user.
   */
  getCreditShareApprovals(
    p: {
      userAddress?: NativeAddress;
    } = {},
  ): Promise<GetCreditShareApprovalsResponse> {
    return this.paymentService.getCreditShareApprovals(p);
  }

  /**
   * Signs and uploads raw data to the Turbo Upload Service.
   */
  upload({
    data,
    dataItemOpts,
    signal,
    events,
    chunkByteCount,
    chunkingMode,
    maxChunkConcurrency,
    maxFinalizeMs,
    fundingMode,
  }: UploadDataInput &
    TurboAbortSignal &
    TurboUploadAndSigningEmitterEvents &
    TurboChunkingParams &
    FundingOptions): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.upload({
      data,
      dataItemOpts,
      signal,
      events,
      chunkByteCount,
      chunkingMode,
      maxChunkConcurrency,
      fundingMode,
      maxFinalizeMs,
    });
  }

  /**
   * Signs and uploads raw file data to the Turbo Upload Service.
   *
   * @example using a file or path
   * ```ts
   * // web
   * // the file is the file object from the input event onChange for a file input
   * const selectedFile = e.target.files[0];
   * const response = await turbo.uploadFile({
   *   file: selectedFile,
   *   dataItemOpts: { tags: [{ name: 'Content-Type', value: 'text/plain' }] },
   *   events: {
   *     onUploadProgress: ({ totalBytes, processedBytes }) => {
   *       console.log(`Uploaded ${processedBytes} of ${totalBytes} bytes`);
   *     },
   *   },
   * });
   *
   * // node
   * const response = await turbo.uploadFile({
   *   file: 'test.txt',
   *   dataItemOpts: { tags: [{ name: 'Content-Type', value: 'text/plain' }] },
   * });
   * ```
   *
   * @example using a stream factory
   * ```ts
   * // web
   * const selectedFile = e.target.files[0];
   * const response = await turbo.uploadFile({
   *   fileStreamFactory: () => file.stream(),
   *   fileSizeFactory: () => file.size,
   *   dataItemOpts: { tags: [{ name: 'Content-Type', value: 'text/plain' }] },
   *   events: {
   *     onUploadProgress: ({ totalBytes, processedBytes }) => {
   *       console.log(`Uploaded ${processedBytes} of ${totalBytes} bytes`);
   *     },
   *   },
   * });
   *
   * // node
   * const response = await turbo.uploadFile({
   *   fileStreamFactory: () => fs.createReadStream('test.txt'),
   *   fileSizeFactory: () => fs.statSync('test.txt').size,
   *   dataItemOpts: { tags: [{ name: 'Content-Type', value: 'text/plain' }] },
   * });
   * ```
   */
  uploadFile({
    file,
    events,
    dataItemOpts,
    signal,
  }: TurboUploadFileWithFileOrPathParams): Promise<TurboUploadDataItemResponse>;
  uploadFile({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
    signal,
    events,
  }: TurboUploadFileWithStreamFactoryParams): Promise<TurboUploadDataItemResponse>;
  uploadFile(
    params: TurboUploadFileParams,
  ): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadFile(params);
  }
  uploadFolder(p: TurboUploadFolderParams): Promise<TurboUploadFolderResponse> {
    return this.uploadService.uploadFolder(p);
  }

  /**
   * Submits fund transaction to the token's blockchain then sends
   * the transaction ID to the Turbo Payment Service for processing.
   */
  topUpWithTokens(
    p: TurboFundWithTokensParams,
  ): Promise<TurboCryptoFundResponse> {
    return this.paymentService.topUpWithTokens(p);
  }

  /**
   * Creates a data item with tags that designate it as a credit share approval.
   * Signs the data item and sends it to the Turbo Upload Service, which will verify
   * the signature and forward the admin action towards the Turbo Payment Service.
   */
  shareCredits(
    p: TurboCreateCreditShareApprovalParams,
  ): Promise<CreditShareApproval> {
    return this.uploadService.shareCredits(p);
  }

  /**
   * Creates a data item with tags that designate it as a revoke action for credit
   * share approvals for target revokedAddress. Signs the data item and sends it to
   * the Turbo Upload Service, which will verify the signature and forward the admin
   * action towards the Turbo Payment Service.
   */
  revokeCredits(p: TurboRevokeCreditsParams): Promise<CreditShareApproval[]> {
    return this.uploadService.revokeCredits(p);
  }

  uploadRawX402Data({
    data,
    tags,
    signal,
    maxMUSDCAmount,
  }: {
    data: UploadDataType;
    signal?: AbortSignal;
    tags?: { name: string; value: string }[];
    maxMUSDCAmount?: BigNumber;
  }): Promise<TurboUploadDataItemResponse> {
    return this.uploadService.uploadRawX402Data({
      data,
      tags,
      signal,
      maxMUSDCAmount,
    });
  }
}
