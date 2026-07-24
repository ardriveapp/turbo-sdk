import { ArNSBuyNameArgs, ArNSExtendLeaseParams, ArNSIncreaseUndernameLimitParams, ArNSPaidByParams, ArNSPriceParams, ArNSPriceResponse, ArNSPurchaseParams, ArNSPurchaseResponse, ArNSPurchaseStatusResponse, ArNSUpgradeNameParams, Currency, GetCreditShareApprovalsResponse, TokenTools, TokenType, TurboAuthenticatedPaymentServiceConfiguration, TurboAuthenticatedPaymentServiceInterface, TurboBalanceResponse, TurboCheckoutSessionParams, TurboCheckoutSessionResponse, TurboCountriesResponse, TurboCryptoFundResponse, TurboCurrenciesResponse, TurboDataItemSigner, TurboFiatEstimateForBytesResponse, TurboFiatToArResponse, TurboFreeStatusResponse, TurboFundWithTokensParams, TurboLogger, TurboPaymentHistoryParams, TurboPaymentHistoryResponse, TurboPaymentIntentParams, TurboPaymentIntentResponse, TurboPriceResponse, TurboRatesResponse, TurboSignedRequestHeaders, TurboSubmitFundTxResponse, TurboTokenPriceForBytesResponse, TurboUnauthenticatedPaymentServiceConfiguration, TurboUnauthenticatedPaymentServiceInterface, TurboWincForFiatParams, TurboWincForFiatResponse, TurboWincForTokenParams, TurboWincForTokenResponse, UserAddress } from '../types.js';
import { TurboHTTPService } from './http.js';
export declare const developmentPaymentServiceURL = "https://payment.ardrive.dev";
export declare const defaultPaymentServiceURL = "https://payment.ardrive.io";
export declare class TurboUnauthenticatedPaymentService implements TurboUnauthenticatedPaymentServiceInterface {
    protected readonly httpService: TurboHTTPService;
    protected logger: TurboLogger;
    protected readonly token: TokenType;
    private url;
    constructor({ url, logger, retryConfig, token, }: TurboUnauthenticatedPaymentServiceConfiguration);
    getBalance(address: string): Promise<TurboBalanceResponse>;
    getFreeStatus(address: string): Promise<TurboFreeStatusResponse>;
    getFiatRates(): Promise<TurboRatesResponse>;
    getFiatToAR({ currency, }: {
        currency: Currency;
    }): Promise<TurboFiatToArResponse>;
    getSupportedCountries(): Promise<TurboCountriesResponse>;
    getSupportedCurrencies(): Promise<TurboCurrenciesResponse>;
    getUploadCosts({ bytes, }: {
        bytes: number[];
    }): Promise<TurboPriceResponse[]>;
    getWincForFiat({ amount, promoCodes, nativeAddress, }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse>;
    getWincForToken({ tokenAmount, }: TurboWincForTokenParams): Promise<TurboWincForTokenResponse>;
    getArNSPriceForName(params: ArNSPriceParams): Promise<ArNSPriceResponse>;
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
    protected validateArNSPurchaseParams(params: ArNSPriceParams): void;
    getArNSPurchaseStatus({ nonce, }: {
        nonce: string;
    }): Promise<ArNSPurchaseStatusResponse>;
    protected buildArNSPurchaseQuery(input: ArNSPurchaseParams): string;
    protected appendPromoCodesToQuery(promoCodes: string[]): string;
    getTurboCryptoWallets(): Promise<Record<TokenType, string>>;
    protected getCheckout({ amount, owner, promoCodes, uiMode, ...callbackUrls }: TurboCheckoutSessionParams, type?: 'checkout-session' | 'payment-intent', headers?: TurboSignedRequestHeaders): Promise<TurboCheckoutSessionResponse>;
    createCheckoutSession(params: TurboCheckoutSessionParams): Promise<TurboCheckoutSessionResponse>;
    submitFundTransaction({ txId, }: {
        txId: string;
    }): Promise<TurboSubmitFundTxResponse>;
    getCreditShareApprovals({ userAddress, }: {
        userAddress: UserAddress;
    }): Promise<GetCreditShareApprovalsResponse>;
    getFiatEstimateForBytes({ byteCount, currency, }: {
        byteCount: number;
        currency: Currency;
    }): Promise<TurboFiatEstimateForBytesResponse>;
    getTokenPriceForBytes({ byteCount, }: {
        byteCount: number;
    }): Promise<TurboTokenPriceForBytesResponse>;
    createPaymentIntent(params: TurboPaymentIntentParams): Promise<TurboPaymentIntentResponse>;
}
export declare class TurboAuthenticatedPaymentService extends TurboUnauthenticatedPaymentService implements TurboAuthenticatedPaymentServiceInterface {
    protected readonly signer: TurboDataItemSigner;
    protected readonly tokenTools: TokenTools | undefined;
    constructor({ url, retryConfig, signer, logger, token, tokenTools, }: TurboAuthenticatedPaymentServiceConfiguration);
    getBalance(userAddress?: string): Promise<TurboBalanceResponse>;
    getFreeStatus(userAddress?: string): Promise<TurboFreeStatusResponse>;
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
    getPaymentHistory({ limit, cursor, }?: TurboPaymentHistoryParams): Promise<TurboPaymentHistoryResponse>;
    /**
     * Buy / extend / upgrade an ArNS name, paying with the signer's Turbo credit
     * balance. The bundler performs the on-chain ARIO purchase and debits credits;
     * a `402` (FailedRequestError.status === 402) indicates insufficient credits.
     */
    purchaseArNSName(params: ArNSPurchaseParams): Promise<ArNSPurchaseResponse>;
    buyArNSName(params: ArNSBuyNameArgs): Promise<ArNSPurchaseResponse>;
    extendArNSLease(params: Omit<ArNSExtendLeaseParams, 'intent'> & ArNSPaidByParams): Promise<ArNSPurchaseResponse>;
    increaseArNSUndernameLimit(params: Omit<ArNSIncreaseUndernameLimitParams, 'intent'> & ArNSPaidByParams): Promise<ArNSPurchaseResponse>;
    upgradeArNSName(params: Omit<ArNSUpgradeNameParams, 'intent'> & ArNSPaidByParams): Promise<ArNSPurchaseResponse>;
    private buildArNSCustodyMessage;
    /**
     * Self-custody exit: move a Turbo-custodied ANT to a Solana pubkey you control.
     * Authenticated with an action-bound, single-use signature.
     */
    transferArNSAnt({ antId, target, }: {
        antId: string;
        target: string;
    }): Promise<{
        antId: string;
        target: string;
        name?: string;
        messageId: string;
    }>;
    /** Set a resolution record on a custodied ANT (undername defaults to '@'). */
    setArNSRecord({ antId, undername, transactionId, ttlSeconds, }: {
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
    }>;
    /** Remove a resolution record (an undername) from a custodied ANT. */
    removeArNSRecord({ antId, undername, }: {
        antId: string;
        undername: string;
    }): Promise<{
        antId: string;
        undername: string;
        messageId: string;
    }>;
    getCreditShareApprovals({ userAddress, }: {
        userAddress?: string;
    }): Promise<GetCreditShareApprovalsResponse>;
    getWincForFiat({ amount, promoCodes, }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse>;
    createCheckoutSession(params: TurboCheckoutSessionParams): Promise<TurboCheckoutSessionResponse>;
    private getTargetWalletForFund;
    topUpWithTokens({ feeMultiplier, tokenAmount: tokenAmountV, turboCreditDestinationAddress, }: TurboFundWithTokensParams): Promise<TurboCryptoFundResponse>;
}
//# sourceMappingURL=payment.d.ts.map