import { Currency, GetCreditShareApprovalsResponse, TokenTools, TokenType, TurboAuthenticatedPaymentServiceConfiguration, TurboAuthenticatedPaymentServiceInterface, TurboBalanceResponse, TurboCheckoutSessionParams, TurboCheckoutSessionResponse, TurboCountriesResponse, TurboCryptoFundResponse, TurboCurrenciesResponse, TurboDataItemSigner, TurboFiatEstimateForBytesResponse, TurboFiatToArResponse, TurboFundWithTokensParams, TurboLogger, TurboPaymentIntentParams, TurboPaymentIntentResponse, TurboPriceResponse, TurboRatesResponse, TurboSignedRequestHeaders, TurboSubmitFundTxResponse, TurboTokenPriceForBytesResponse, TurboUnauthenticatedPaymentServiceConfiguration, TurboUnauthenticatedPaymentServiceInterface, TurboWincForFiatParams, TurboWincForFiatResponse, TurboWincForTokenParams, TurboWincForTokenResponse, UserAddress } from '../types.js';
import { TurboHTTPService } from './http.js';
export declare const developmentPaymentServiceURL = "https://payment.ardrive.dev";
export declare const defaultPaymentServiceURL = "https://payment.ardrive.io";
export declare class TurboUnauthenticatedPaymentService implements TurboUnauthenticatedPaymentServiceInterface {
    protected readonly httpService: TurboHTTPService;
    protected logger: TurboLogger;
    protected readonly token: TokenType;
    constructor({ url, logger, retryConfig, token, }: TurboUnauthenticatedPaymentServiceConfiguration);
    getBalance(address: string): Promise<TurboBalanceResponse>;
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
    getCreditShareApprovals({ userAddress, }: {
        userAddress?: string;
    }): Promise<GetCreditShareApprovalsResponse>;
    getWincForFiat({ amount, promoCodes, }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse>;
    createCheckoutSession(params: TurboCheckoutSessionParams): Promise<TurboCheckoutSessionResponse>;
    private getTargetWalletForFund;
    topUpWithTokens({ feeMultiplier, tokenAmount: tokenAmountV, turboCreditDestinationAddress, }: TurboFundWithTokensParams): Promise<TurboCryptoFundResponse>;
}
//# sourceMappingURL=payment.d.ts.map