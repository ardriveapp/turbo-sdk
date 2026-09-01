import { ArNSAction, ArNSActionCompleted, ArNSActionResult, ArNSFiatPurchaseQuoteParams, ArNSFiatPurchaseQuoteResponse, ArNSNameType, ArNSOwnerSigner, ArNSPriceParams, ArNSPriceResponse, ArNSPurchaseParams, ArNSPurchaseStatusResponse, AuthenticatedArNSFiatPurchaseQuoteParams, Currency, GetCreditShareApprovalsResponse, TokenTools, TokenType, TurboArNSNamesResponse, TurboAuthenticatedPaymentServiceConfiguration, TurboAuthenticatedPaymentServiceInterface, TurboBalanceResponse, TurboCheckoutSessionParams, TurboCheckoutSessionResponse, TurboCountriesResponse, TurboCryptoFundResponse, TurboCurrenciesResponse, TurboDataItemSigner, TurboFiatEstimateForBytesResponse, TurboFiatToArResponse, TurboFreeStatusResponse, TurboFundWithTokensParams, TurboLogger, TurboPaymentHistoryParams, TurboPaymentHistoryResponse, TurboPaymentIntentParams, TurboPaymentIntentResponse, TurboPriceResponse, TurboRatesResponse, TurboSignedRequestHeaders, TurboSubmitFundTxResponse, TurboTokenPriceForBytesResponse, TurboUnauthenticatedPaymentServiceConfiguration, TurboUnauthenticatedPaymentServiceInterface, TurboWincForFiatParams, TurboWincForFiatResponse, TurboWincForTokenParams, TurboWincForTokenResponse, UserAddress } from '../types.js';
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
    getArNSNames(address: string): Promise<TurboArNSNamesResponse>;
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
    getArNSFiatPurchaseQuote(params: ArNSFiatPurchaseQuoteParams): Promise<ArNSFiatPurchaseQuoteResponse>;
    /**
     * Query string for a fiat quote. Distinct from `buildArNSPurchaseQuery`
     * because this route takes `uiMode` + its paired URLs and has no `paidBy`
     * (fiat has no delegated payer), and because promo codes must be REPEATED
     * params here: the service reads them with `parseQueryParams`, which treats a
     * comma-joined string as one code rather than several.
     */
    protected buildArNSFiatQuoteQuery(params: ArNSFiatPurchaseQuoteParams, promoCodes: string[]): string;
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
    /**
     * Quote a fiat (Stripe) ArNS purchase. `address` defaults to this signer's
     * native address — the wallet that will own the name — so the common case
     * needs no address at all. Pass one explicitly to buy on another wallet's
     * behalf; the route takes the destination as a path param and requires no
     * signature, which is why it is available unauthenticated too.
     */
    getArNSFiatPurchaseQuote(params: AuthenticatedArNSFiatPurchaseQuoteParams): Promise<ArNSFiatPurchaseQuoteResponse>;
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
    /**
     * Create an action. Returns `completed` or `awaiting-signature`.
     *
     * Credits are debited HERE, not at `/sign`. Capture the returned `nonce`
     * before prompting for a signature: it is the idempotency key, and polling
     * it is how you resume. Never re-create an action to "retry" — that debits
     * a second time. An abandoned action is refunded automatically.
     */
    createArNSAction(action: ArNSAction, params?: Record<string, unknown>, ownerProof?: {
        owner: ArNSOwnerSigner;
        message: string;
    }): Promise<ArNSActionResult>;
    /**
     * Submit the owner-signed transaction for an `awaiting-signature` action.
     *
     * `signedTransaction` is the FULL serialized transaction, base64 — not just
     * the signature. Replaying a completed action returns `alreadyCompleted:
     * true` rather than buying twice, so this is safe to call again if a
     * response is lost.
     */
    signArNSAction(nonce: string, signedTransaction: string): Promise<ArNSActionCompleted>;
    /**
     * Status of an action by nonce. Open — no signature required — so it works
     * from a status page or callback handler that never holds the payer's key.
     *
     * Terminal success carries `messageId`; terminal failure carries
     * `failedDate`.
     */
    getArNSActionStatus(nonce: string): Promise<ArNSActionResult & {
        failedDate?: string;
    }>;
    /**
     * Run an action to a terminal state, signing if the server asks for it.
     *
     * This is the two-shape branch, once, in one place — so callers cannot
     * hardcode which actions need a signature and break when a customer
     * exercises ownership.
     */
    private completeArNSAction;
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
    buyArNSName({ name, owner, type, years, paidBy, onNonce, }: {
        name: string;
        owner: ArNSOwnerSigner;
        type?: ArNSNameType;
        years?: number;
        paidBy?: UserAddress | UserAddress[];
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /** Extend a lease. Permissionless on chain — no owner signature needed. */
    extendArNSLease({ name, years, paidBy, onNonce, }: {
        name: string;
        years: number;
        paidBy?: UserAddress | UserAddress[];
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /** Upgrade a lease to a permanent name. No owner signature needed. */
    upgradeArNSName({ name, paidBy, onNonce, }: {
        name: string;
        paidBy?: UserAddress | UserAddress[];
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /** Raise the undername limit. No owner signature needed. */
    increaseArNSUndernameLimit({ name, increaseQty, paidBy, onNonce, }: {
        name: string;
        increaseQty: number;
        paidBy?: UserAddress | UserAddress[];
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
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
    setArNSRecord({ antId, owner, transactionId, undername, ttlSeconds, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        transactionId: string;
        undername?: string;
        ttlSeconds?: number;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /** Remove a record (an undername). Costs credits, never SOL. */
    removeArNSRecord({ antId, owner, undername, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername: string;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
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
    setArNSRecordMetadata({ antId, owner, undername, displayName, recordLogo, recordDescription, recordKeywords, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername?: string;
        displayName?: string | null;
        recordLogo?: string | null;
        recordDescription?: string | null;
        recordKeywords?: string[] | null;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /** Clear a record's metadata. Costs credits, never SOL; same two-shape rules. */
    removeArNSRecordMetadata({ antId, owner, undername, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername: string;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /**
     * Hand ONE record to another address.
     *
     * Distinct from {@link transferArNSAnt}, which hands over the whole ANT and
     * every record on it. Confusing the two gives away far more than intended.
     */
    transferArNSRecord({ antId, owner, undername, target, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername: string;
        target: string;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /**
     * Grant controller rights on the ANT. Omit `target` for Turbo itself, which
     * is what makes `setArNSRecord` a single call.
     *
     * Owner-signed: changing an ANT's access control is an owner-only
     * instruction. Costs a small credit margin; Turbo funds the ACL page growth
     * in SOL.
     */
    addArNSController({ antId, owner, target, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        target?: string;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /**
     * Revoke controller rights — the escape hatch that keeps "Turbo is not a
     * custodian" honest.
     *
     * Always available, and needs nothing from Turbo but the fee. Costs a small
     * credit margin rather than SOL.
     * After revoking, `setArNSRecord` keeps working: it simply starts returning
     * `awaiting-signature` so the owner signs their own record writes.
     */
    removeArNSController({ antId, owner, target, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        target?: string;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /**
     * Hand the ANT to a new owner. Irreversible: after this lands, `owner` no
     * longer controls the name. Owner-signed, and sponsored like the rest.
     */
    transferArNSAnt({ antId, owner, target, onNonce, }: {
        antId: string;
        owner: ArNSOwnerSigner;
        target: string;
        onNonce?: (nonce: string) => void | Promise<void>;
    }): Promise<ArNSActionCompleted>;
    /**
     * Defaults to the signer's own address when `userAddress` is omitted
     * (`null`/`undefined`). Passing `''` does NOT trigger this default --
     * mirrors `getBalance`'s existing behavior above.
     */
    getArNSNames(userAddress?: string): Promise<TurboArNSNamesResponse>;
    getCreditShareApprovals({ userAddress, }: {
        userAddress?: string;
    }): Promise<GetCreditShareApprovalsResponse>;
    getWincForFiat({ amount, promoCodes, }: TurboWincForFiatParams): Promise<TurboWincForFiatResponse>;
    createCheckoutSession(params: TurboCheckoutSessionParams): Promise<TurboCheckoutSessionResponse>;
    private getTargetWalletForFund;
    topUpWithTokens({ feeMultiplier, tokenAmount: tokenAmountV, turboCreditDestinationAddress, }: TurboFundWithTokensParams): Promise<TurboCryptoFundResponse>;
}
//# sourceMappingURL=payment.d.ts.map