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
     * Returns the status of an ArNS purchase by its nonce.
     */
    getArNSPurchaseStatus(p) {
        return this.paymentService.getArNSPurchaseStatus(p);
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
    /**
     * Buys, extends, or upgrades an ArNS name, paying with the signer's Turbo
     * credit balance. Poll {@link getArNSPurchaseStatus} with the returned nonce.
     */
    purchaseArNSName(params) {
        return this.paymentService.purchaseArNSName(params);
    }
    /** Buys a new ArNS name (lease or permabuy). */
    buyArNSName(params) {
        return this.paymentService.buyArNSName(params);
    }
    /** Extends the lease on an existing ArNS name. */
    extendArNSLease(params) {
        return this.paymentService.extendArNSLease(params);
    }
    /** Increases the undername limit on an existing ArNS name. */
    increaseArNSUndernameLimit(params) {
        return this.paymentService.increaseArNSUndernameLimit(params);
    }
    /** Upgrades an ArNS lease to a permabuy. */
    upgradeArNSName(params) {
        return this.paymentService.upgradeArNSName(params);
    }
    transferArNSAnt(params) {
        return this.paymentService.transferArNSAnt(params);
    }
    setArNSRecord(params) {
        return this.paymentService.setArNSRecord(params);
    }
    removeArNSRecord(params) {
        return this.paymentService.removeArNSRecord(params);
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
