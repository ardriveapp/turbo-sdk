import { TurboUnauthenticatedPaymentService, defaultPaymentServiceURL, developmentPaymentServiceURL, } from './payment.js';
import { TurboUnauthenticatedUploadService, defaultUploadServiceURL, developmentUploadServiceURL, } from './upload.js';
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
export class TurboUnauthenticatedClient {
    constructor({ uploadService = new TurboUnauthenticatedUploadService({}), paymentService = new TurboUnauthenticatedPaymentService({}), }) {
        this.paymentService = paymentService;
        this.uploadService = uploadService;
    }
    /**
     * Returns the supported fiat currency conversion rate for 1AR based on current market prices.
     */
    getFiatToAR({ currency, }) {
        return this.paymentService.getFiatToAR({ currency });
    }
    /**
     * Returns the latest conversion rates to purchase 1GiB of data for all supported currencies, including all adjustments and fees.
     *
     * Note: this does not take into account varying adjustments and promotions for different sizes of data. If you want to calculate the total
     * cost in 'winc' for a given number of bytes, use getUploadCosts.
     */
    getFiatRates() {
        return this.paymentService.getFiatRates();
    }
    /**
     * Returns a comprehensive list of supported countries that can purchase credits through the Turbo Payment Service.
     */
    getSupportedCountries() {
        return this.paymentService.getSupportedCountries();
    }
    getBalance(address) {
        return this.paymentService.getBalance(address);
    }
    getFreeStatus(address) {
        return this.paymentService.getFreeStatus(address);
    }
    /**
     * Returns the price in 'winc' (and mARIO) to buy/extend/upgrade an ArNS name.
     */
    getArNSPriceForName(params) {
        return this.paymentService.getArNSPriceForName(params);
    }
    /**
     * Previews what one of the eight non-purchase ArNS actions will debit,
     * without creating it. Use {@link getArNSPriceForName} for the four
     * ARIO-purchase actions instead.
     */
    getArNSActionPrice(action) {
        return this.paymentService.getArNSActionPrice(action);
    }
    /**
     * Returns the status of an ArNS purchase by its nonce.
     */
    getArNSPurchaseStatus(p) {
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
    getArNSNames(address) {
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
    getArNSFiatPurchaseQuote(params) {
        return this.paymentService.getArNSFiatPurchaseQuote(params);
    }
    /**
     * Returns a list of all supported fiat currencies.
     */
    getSupportedCurrencies() {
        return this.paymentService.getSupportedCurrencies();
    }
    /**
     * Determines the price in 'winc' to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
     */
    getUploadCosts({ bytes, }) {
        return this.paymentService.getUploadCosts({ bytes });
    }
    /**
     * Determines the amount of 'winc' that would be returned for a given currency and amount, including all Turbo cost adjustments and fees.
     */
    getWincForFiat(params) {
        return this.paymentService.getWincForFiat(params);
    }
    /**
     * Determines the amount of 'winc' that would be returned for a given token and amount, including all Turbo cost adjustments and fees.
     */
    getWincForToken(params) {
        return this.paymentService.getWincForToken(params);
    }
    /**
     * Determines the fiat estimate for a given byte count in a specific currency, including all Turbo cost adjustments and fees.
     */
    getFiatEstimateForBytes({ byteCount, currency, }) {
        return this.paymentService.getFiatEstimateForBytes({
            byteCount,
            currency,
        });
    }
    /**
     * Determines the price in the instantiated token to upload one data item of a specific size in bytes, including all Turbo cost adjustments and fees.
     */
    getTokenPriceForBytes({ byteCount, }) {
        return this.paymentService.getTokenPriceForBytes({ byteCount });
    }
    /**
     * Uploads a signed data item to the Turbo Upload Service.
     */
    uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, signal, events, }) {
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
    createCheckoutSession(params) {
        return this.paymentService.createCheckoutSession(params);
    }
    /**
     * Returns the payment intent for a given amount and currency.
     * This is used to create a payment intent, gather payment method
     * on client side, and complete via Stripe SDK or API.
     */
    createPaymentIntent(params) {
        return this.paymentService.createPaymentIntent(params);
    }
    /**
     * Submits a transaction ID to the Turbo Payment Service for processing.
     */
    submitFundTransaction(p) {
        return this.paymentService.submitFundTransaction(p);
    }
    /**
     * Returns the connected target Turbo wallet addresses for all supported tokens.
     */
    async getTurboCryptoWallets() {
        const wallets = await this.paymentService.getTurboCryptoWallets();
        wallets.pol = wallets.matic;
        return wallets;
    }
    /**
     * Returns a list of all credit share approvals for the user.
     */
    getCreditShareApprovals(p) {
        return this.paymentService.getCreditShareApprovals(p);
    }
    uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, }) {
        return this.uploadService.uploadRawX402Data({
            data,
            tags,
            signal,
            maxMUSDCAmount,
        });
    }
}
export class TurboAuthenticatedClient extends TurboUnauthenticatedClient {
    constructor({ paymentService, uploadService, signer, }) {
        super({ paymentService, uploadService });
        this.signer = signer;
    }
    /**
     * Returns the current balance of the user's wallet in 'winc'.
     */
    getBalance(userAddress) {
        return this.paymentService.getBalance(userAddress);
    }
    /**
     * Returns how many free-tier bytes the wallet can still upload for free
     * (`bytesRemaining`), or `null` for an unlimited (exempt/partner) wallet.
     */
    getFreeStatus(userAddress) {
        return this.paymentService.getFreeStatus(userAddress);
    }
    /**
     * Returns the signer's OWN completed top-up history (crypto + fiat), newest
     * first and keyset-paginated. Signature-required and self-scoped: it only ever
     * returns the signing wallet's rows. Pass `cursor` from a prior response's
     * `cursor` field (with `hasMore === true`) to fetch the next page.
     */
    getPaymentHistory(params) {
        return this.paymentService.getPaymentHistory(params);
    }
    // ===== ArNS actions (sponsored) =====
    //
    // Thin delegations. The two-shape branch and the owner-proof construction
    // live in the payment service; see its comments for why callers must branch
    // on `status` rather than on which action they asked for.
    /** Create an action. Debits credits HERE — capture the nonce before signing. */
    createArNSAction(action, params, ownerProof) {
        return this.paymentService.createArNSAction(action, params, ownerProof);
    }
    /** Submit the owner-signed transaction (FULL serialized tx, base64). */
    signArNSAction(nonce, signedTransaction) {
        return this.paymentService.signArNSAction(nonce, signedTransaction);
    }
    /** Status by nonce — open, needs no signature. Use it to resume. */
    getArNSActionStatus(nonce) {
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
    getArNSFiatPurchaseQuote(params) {
        return this.paymentService.getArNSFiatPurchaseQuote(params);
    }
    /**
     * Buy a name. The ANT is minted straight to `owner`; Turbo never holds it.
     * The only action that always needs the owner's signature — once, ever.
     */
    buyArNSName(params) {
        return this.paymentService.buyArNSName(params);
    }
    /** Extend a lease. No owner signature needed. */
    extendArNSLease(params) {
        return this.paymentService.extendArNSLease(params);
    }
    /** Raise the undername limit. No owner signature needed. */
    increaseArNSUndernameLimit(params) {
        return this.paymentService.increaseArNSUndernameLimit(params);
    }
    /** Upgrade a lease to a permanent name. No owner signature needed. */
    upgradeArNSName(params) {
        return this.paymentService.upgradeArNSName(params);
    }
    /** Point a name (or undername) at data. Free; handles both shapes. */
    setArNSRecord(params) {
        return this.paymentService.setArNSRecord(params);
    }
    /** Remove a record. Free; handles both shapes. */
    removeArNSRecord(params) {
        return this.paymentService.removeArNSRecord(params);
    }
    /** Grant controller rights — omit `target` for Turbo itself. Costs credits. */
    addArNSController(params) {
        return this.paymentService.addArNSController(params);
    }
    /** Revoke controller rights. Always available; costs credits, never SOL. */
    removeArNSController(params) {
        return this.paymentService.removeArNSController(params);
    }
    /**
     * Edit a RECORD's metadata (display name, logo, description, keywords).
     * Free; handles both shapes. Fields are tri-state — omit to leave unchanged,
     * pass `null` to clear.
     */
    setArNSRecordMetadata(params) {
        return this.paymentService.setArNSRecordMetadata(params);
    }
    /** Clear a record's metadata. Costs credits, never SOL; handles both shapes. */
    removeArNSRecordMetadata(params) {
        return this.paymentService.removeArNSRecordMetadata(params);
    }
    /** Hand ONE record over — not the whole ANT. Costs credits, never SOL. */
    transferArNSRecord(params) {
        return this.paymentService.transferArNSRecord(params);
    }
    /** Hand the ANT to a new owner. Irreversible. Costs credits, never SOL. */
    transferArNSAnt(params) {
        return this.paymentService.transferArNSAnt(params);
    }
    /**
     * Returns the ArNS names owned or controlled by the connected signer's
     * wallet (or the given `userAddress`) via Turbo's custodial
     * ArNS-with-credits feature.
     */
    getArNSNames(userAddress) {
        return this.paymentService.getArNSNames(userAddress);
    }
    /**
     * Returns a list of all credit share approvals for the user.
     */
    getCreditShareApprovals(p = {}) {
        return this.paymentService.getCreditShareApprovals(p);
    }
    /**
     * Signs and uploads raw data to the Turbo Upload Service.
     */
    upload({ data, dataItemOpts, signal, events, chunkByteCount, chunkingMode, maxChunkConcurrency, maxFinalizeMs, fundingMode, }) {
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
    uploadFile(params) {
        return this.uploadService.uploadFile(params);
    }
    uploadFolder(p) {
        return this.uploadService.uploadFolder(p);
    }
    /**
     * Submits fund transaction to the token's blockchain then sends
     * the transaction ID to the Turbo Payment Service for processing.
     */
    topUpWithTokens(p) {
        return this.paymentService.topUpWithTokens(p);
    }
    /**
     * Creates a data item with tags that designate it as a credit share approval.
     * Signs the data item and sends it to the Turbo Upload Service, which will verify
     * the signature and forward the admin action towards the Turbo Payment Service.
     */
    shareCredits(p) {
        return this.uploadService.shareCredits(p);
    }
    /**
     * Creates a data item with tags that designate it as a revoke action for credit
     * share approvals for target revokedAddress. Signs the data item and sends it to
     * the Turbo Upload Service, which will verify the signature and forward the admin
     * action towards the Turbo Payment Service.
     */
    revokeCredits(p) {
        return this.uploadService.revokeCredits(p);
    }
    uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, }) {
        return this.uploadService.uploadRawX402Data({
            data,
            tags,
            signal,
            maxMUSDCAmount,
        });
    }
}
