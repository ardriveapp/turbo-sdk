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
import { CreditShareApproval, Currency, FundingOptions, GetCreditShareApprovalsResponse, NativeAddress, TokenType, TurboAbortSignal, TurboAuthenticatedClientConfiguration, TurboAuthenticatedClientInterface, TurboAuthenticatedPaymentServiceInterface, TurboAuthenticatedUploadServiceInterface, TurboBalanceResponse, TurboCheckoutSessionParams, TurboCheckoutSessionResponse, TurboChunkingParams, TurboCountriesResponse, TurboCreateCreditShareApprovalParams, TurboCryptoFundResponse, TurboCurrenciesResponse, TurboDataItemSigner, TurboFiatEstimateForBytesResponse, TurboFiatToArResponse, TurboFundWithTokensParams, TurboPaymentIntentParams, TurboPaymentIntentResponse, TurboPriceResponse, TurboRatesResponse, TurboRevokeCreditsParams, TurboSignedDataItemFactory, TurboSubmitFundTxResponse, TurboTokenPriceForBytesResponse, TurboUnauthenticatedClientConfiguration, TurboUnauthenticatedClientInterface, TurboUnauthenticatedPaymentServiceInterface, TurboUnauthenticatedUploadServiceInterface, TurboUploadAndSigningEmitterEvents, TurboUploadDataItemResponse, TurboUploadEmitterEvents, TurboUploadFileWithFileOrPathParams, TurboUploadFileWithStreamFactoryParams, TurboUploadFolderParams, TurboUploadFolderResponse, TurboWincForFiatParams, TurboWincForFiatResponse, TurboWincForTokenParams, TurboWincForTokenResponse, UploadDataInput, UploadDataType } from '../types.js';
/**
 * Testing configuration.
 */
export declare const developmentTurboConfiguration: {
    paymentServiceConfig: {
        url: string;
    };
    uploadServiceConfig: {
        url: string;
    };
};
/**
 * Production configuration.
 */
export declare const defaultTurboConfiguration: {
    paymentServiceConfig: {
        url: string;
    };
    uploadServiceConfig: {
        url: string;
    };
};
export declare class TurboUnauthenticatedClient implements TurboUnauthenticatedClientInterface {
    protected paymentService: TurboUnauthenticatedPaymentServiceInterface;
    protected uploadService: TurboUnauthenticatedUploadServiceInterface;
    constructor({ uploadService, paymentService, }: TurboUnauthenticatedClientConfiguration);
    /**
     * Returns the supported fiat currency conversion rate for 1AR based on current market prices.
     */
    getFiatToAR({ currency, }: {
        currency: Currency;
    }): Promise<TurboFiatToArResponse>;
    /**
     * Returns the latest conversion rates to purchase 1GiB of data for all supported currencies, including all adjustments and fees.
     *
     * Note: this does not take into account varying adjustments and promotions for different sizes of data. If you want to calculate the total
     * cost in 'winc' for a given number of bytes, use getUploadCosts.
     */
    getFiatRates(): Promise<TurboRatesResponse>;
    /**
     * Returns a comprehensive list of supported countries that can purchase credits through the Turbo Payment Service.
     */
    getSupportedCountries(): Promise<TurboCountriesResponse>;
    getBalance(address: NativeAddress): Promise<TurboBalanceResponse>;
    /**
     * Returns a list of all supported fiat currencies.
     */
    getSupportedCurrencies(): Promise<TurboCurrenciesResponse>;
    /**
     * Determines the price in 'winc' to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
     */
    getUploadCosts({ bytes, }: {
        bytes: number[];
    }): Promise<TurboPriceResponse[]>;
    /**
     * Determines the amount of 'winc' that would be returned for a given currency and amount, including all Turbo cost adjustments and fees.
     */
    getWincForFiat(params: TurboWincForFiatParams): Promise<TurboWincForFiatResponse>;
    /**
     * Determines the amount of 'winc' that would be returned for a given token and amount, including all Turbo cost adjustments and fees.
     */
    getWincForToken(params: TurboWincForTokenParams): Promise<TurboWincForTokenResponse>;
    /**
     * Determines the fiat estimate for a given byte count in a specific currency, including all Turbo cost adjustments and fees.
     */
    getFiatEstimateForBytes({ byteCount, currency, }: {
        byteCount: number;
        currency: Currency;
    }): Promise<TurboFiatEstimateForBytesResponse>;
    /**
     * Determines the price in the instantiated token to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
     */
    getTokenPriceForBytes({ byteCount, }: {
        byteCount: number;
    }): Promise<TurboTokenPriceForBytesResponse>;
    /**
     * Uploads a signed data item to the Turbo Upload Service.
     */
    uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, signal, events, }: TurboSignedDataItemFactory & TurboAbortSignal & TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse>;
    /**
     * Creates a Turbo Checkout Session for a given amount and currency.
     */
    createCheckoutSession(params: TurboCheckoutSessionParams): Promise<TurboCheckoutSessionResponse>;
    /**
     * Returns the payment intent for a given amount and currency.
     * This is used to create a payment intent, gather payment method
     * on client side, and complete via Stripe SDK or API.
     */
    createPaymentIntent(params: TurboPaymentIntentParams): Promise<TurboPaymentIntentResponse>;
    /**
     * Submits a transaction ID to the Turbo Payment Service for processing.
     */
    submitFundTransaction(p: {
        txId: string;
    }): Promise<TurboSubmitFundTxResponse>;
    /**
     * Returns the connected target Turbo wallet addresses for all supported tokens.
     */
    getTurboCryptoWallets(): Promise<Record<TokenType, string>>;
    /**
     * Returns a list of all credit share approvals for the user.
     */
    getCreditShareApprovals(p: {
        userAddress: NativeAddress;
    }): Promise<GetCreditShareApprovalsResponse>;
    uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, }: {
        data: UploadDataType;
        signal?: AbortSignal;
        tags?: {
            name: string;
            value: string;
        }[];
        maxMUSDCAmount?: BigNumber;
    }): Promise<TurboUploadDataItemResponse>;
}
export declare class TurboAuthenticatedClient extends TurboUnauthenticatedClient implements TurboAuthenticatedClientInterface {
    protected paymentService: TurboAuthenticatedPaymentServiceInterface;
    protected uploadService: TurboAuthenticatedUploadServiceInterface;
    signer: TurboDataItemSigner;
    constructor({ paymentService, uploadService, signer, }: TurboAuthenticatedClientConfiguration);
    /**
     * Returns the current balance of the user's wallet in 'winc'.
     */
    getBalance(userAddress?: NativeAddress): Promise<TurboBalanceResponse>;
    /**
     * Returns a list of all credit share approvals for the user.
     */
    getCreditShareApprovals(p?: {
        userAddress?: NativeAddress;
    }): Promise<GetCreditShareApprovalsResponse>;
    /**
     * Signs and uploads raw data to the Turbo Upload Service.
     */
    upload({ data, dataItemOpts, signal, events, chunkByteCount, chunkingMode, maxChunkConcurrency, maxFinalizeMs, fundingMode, }: UploadDataInput & TurboAbortSignal & TurboUploadAndSigningEmitterEvents & TurboChunkingParams & FundingOptions): Promise<TurboUploadDataItemResponse>;
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
    uploadFile({ file, events, dataItemOpts, signal, }: TurboUploadFileWithFileOrPathParams): Promise<TurboUploadDataItemResponse>;
    uploadFile({ fileStreamFactory, fileSizeFactory, dataItemOpts, signal, events, }: TurboUploadFileWithStreamFactoryParams): Promise<TurboUploadDataItemResponse>;
    uploadFolder(p: TurboUploadFolderParams): Promise<TurboUploadFolderResponse>;
    /**
     * Submits fund transaction to the token's blockchain then sends
     * the transaction ID to the Turbo Payment Service for processing.
     */
    topUpWithTokens(p: TurboFundWithTokensParams): Promise<TurboCryptoFundResponse>;
    /**
     * Creates a data item with tags that designate it as a credit share approval.
     * Signs the data item and sends it to the Turbo Upload Service, which will verify
     * the signature and forward the admin action towards the Turbo Payment Service.
     */
    shareCredits(p: TurboCreateCreditShareApprovalParams): Promise<CreditShareApproval>;
    /**
     * Creates a data item with tags that designate it as a revoke action for credit
     * share approvals for target revokedAddress. Signs the data item and sends it to
     * the Turbo Upload Service, which will verify the signature and forward the admin
     * action towards the Turbo Payment Service.
     */
    revokeCredits(p: TurboRevokeCreditsParams): Promise<CreditShareApproval[]>;
    uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, }: {
        data: UploadDataType;
        signal?: AbortSignal;
        tags?: {
            name: string;
            value: string;
        }[];
        maxMUSDCAmount?: BigNumber;
    }): Promise<TurboUploadDataItemResponse>;
}
//# sourceMappingURL=turbo.d.ts.map