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
import { arNSPurchaseIntents, fiatCurrencyTypes, isCurrency, } from '../types.js';
import { isAnyValidUserAddress } from '../utils/common.js';
import { FailedRequestError, FiatPaymentsDisabledError, InsufficientCreditsError, ProvidedInputError, } from '../utils/errors.js';
import { uuidV4 } from '../utils/uuid.js';
import { defaultRetryConfig } from './http.js';
import { TurboHTTPService } from './http.js';
import { Logger } from './logger.js';
import { exponentMap, tokenToBaseMap } from './token/index.js';
export const developmentPaymentServiceURL = 'https://payment.ardrive.dev';
export const defaultPaymentServiceURL = 'https://payment.ardrive.io';
export class TurboUnauthenticatedPaymentService {
    constructor({ url = defaultPaymentServiceURL, logger = Logger.default, retryConfig = defaultRetryConfig(logger), token = 'arweave', }) {
        this.logger = logger;
        this.httpService = new TurboHTTPService({
            url: `${url}/v1`,
            retryConfig,
            logger: this.logger,
        });
        this.token = token;
        this.url = url;
    }
    async getBalance(address) {
        const balance = await this.httpService.get({
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
    async getFreeStatus(address) {
        const status = await this.httpService.get({
            endpoint: `/account/free?address=${address}`,
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
    getArNSNames(address) {
        return this.httpService.get({
            endpoint: `/arns/my-names/${encodeURIComponent(address)}`,
        });
    }
    getFiatRates() {
        return this.httpService.get({
            endpoint: '/rates',
        });
    }
    getFiatToAR({ currency, }) {
        return this.httpService.get({
            endpoint: `/rates/${currency}`,
        });
    }
    getSupportedCountries() {
        return this.httpService.get({
            endpoint: '/countries',
        });
    }
    getSupportedCurrencies() {
        return this.httpService.get({
            endpoint: '/currencies',
        });
    }
    async getUploadCosts({ bytes, }) {
        const fetchPricePromises = bytes.map((byteCount) => this.httpService.get({
            endpoint: `/price/bytes/${byteCount}`,
        }));
        const wincCostsForBytes = await Promise.all(fetchPricePromises);
        return wincCostsForBytes;
    }
    getWincForFiat({ amount, promoCodes = [], nativeAddress = 'placeholder', // For price checks we only check promo code eligibility, a placeholder can be used
     }) {
        return this.httpService.get({
            endpoint: `/price/${amount.type}/${amount.amount}?destinationAddress=${nativeAddress}&${this.appendPromoCodesToQuery(promoCodes)}`,
        });
    }
    async getWincForToken({ tokenAmount, }) {
        const { actualPaymentAmount, fees, winc } = await this.httpService.get({
            endpoint: `/price/${this.token}/${tokenAmount}`,
        });
        return {
            winc,
            fees,
            actualTokenAmount: tokenAmount.toString(),
            equivalentWincTokenAmount: actualPaymentAmount.toString(),
        };
    }
    async getArNSPriceForName(params) {
        // `async` so a validation failure surfaces as a rejected promise (consistent
        // with `purchaseArNSName`) rather than a synchronous throw.
        this.validateArNSPurchaseParams(params);
        return this.httpService.get({
            endpoint: `/arns/price/${params.intent.toLowerCase()}/${params.name}${this.buildArNSPurchaseQuery(params)}`,
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
    validateArNSPurchaseParams(params) {
        const p = params;
        if (!arNSPurchaseIntents.includes(p.intent)) {
            throw new ProvidedInputError(`Invalid ArNS intent '${p.intent}'. Expected one of: ${arNSPurchaseIntents.join(', ')}.`);
        }
        if (typeof p.name !== 'string' || p.name.length === 0) {
            throw new ProvidedInputError('An ArNS `name` is required.');
        }
        const isPositiveNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
        switch (p.intent) {
            case 'Buy-Name':
                if (p.type !== 'lease' && p.type !== 'permabuy') {
                    throw new ProvidedInputError("Buy-Name requires a `type` of 'lease' or 'permabuy'.");
                }
                // `processId` is optional for Buy-Name: omitting it drives the
                // bundler's custodial provisioning path (Turbo spawns + owns the ANT).
                // If supplied it must be a non-empty string (user-owned ANT).
                if (p.processId !== undefined &&
                    (typeof p.processId !== 'string' || p.processId.length === 0)) {
                    throw new ProvidedInputError('Buy-Name `processId`, when provided, must be a non-empty string (the ANT the name resolves to).');
                }
                if (p.type === 'lease' && !isPositiveNumber(p.years)) {
                    throw new ProvidedInputError('A lease `Buy-Name` requires a positive `years`.');
                }
                break;
            case 'Extend-Lease':
                if (!isPositiveNumber(p.years)) {
                    throw new ProvidedInputError('Extend-Lease requires a positive `years`.');
                }
                break;
            case 'Increase-Undername-Limit':
                if (!isPositiveNumber(p.increaseQty)) {
                    throw new ProvidedInputError('Increase-Undername-Limit requires a positive `increaseQty`.');
                }
                break;
            case 'Upgrade-Name':
                break;
        }
    }
    getArNSPurchaseStatus({ nonce, }) {
        return this.httpService.get({
            endpoint: `/arns/purchase/${nonce}`,
        });
    }
    buildArNSPurchaseQuery(input) {
        // The intent-specific union members each carry only their own fields; read
        // them through a single widened view rather than narrowing per intent.
        const { type, years, increaseQty, processId, paidBy } = input;
        const params = new URLSearchParams();
        if (type !== undefined)
            params.set('type', type);
        if (years !== undefined)
            params.set('years', `${years}`);
        if (increaseQty !== undefined)
            params.set('increaseQty', `${increaseQty}`);
        if (processId !== undefined)
            params.set('processId', processId);
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
    async getArNSFiatPurchaseQuote(params) {
        this.validateArNSPurchaseParams(params);
        const { address, currency, method = 'payment-intent', promoCodes = [], } = params;
        if (typeof address !== 'string' || address.length === 0) {
            throw new ProvidedInputError('A destination `address` is required for a fiat ArNS purchase quote.');
        }
        if (!isCurrency(currency)) {
            throw new ProvidedInputError(`Invalid currency '${currency}'. Supported: ${fiatCurrencyTypes.join(', ')}`);
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
            return await this.httpService.get({
                endpoint: `/arns/quote/${segments.join('/')}${query}`,
            });
        }
        catch (error) {
            // The service returns 503 both for "Stripe is disabled" and for internal
            // errors, so the body is what disambiguates them.
            if (error instanceof FailedRequestError &&
                error.status === 503 &&
                /Fiat \(Stripe\).*disabled/i.test(error.message)) {
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
    buildArNSFiatQuoteQuery(params, promoCodes) {
        const { type, years, increaseQty, processId } = params;
        const search = new URLSearchParams();
        if (type !== undefined)
            search.set('type', type);
        if (years !== undefined)
            search.set('years', `${years}`);
        if (increaseQty !== undefined)
            search.set('increaseQty', `${increaseQty}`);
        if (processId !== undefined)
            search.set('processId', processId);
        const uiMode = params.uiMode;
        if (uiMode !== undefined)
            search.set('uiMode', uiMode);
        if (uiMode === 'embedded') {
            const { returnUrl } = params;
            if (returnUrl !== undefined)
                search.set('returnUrl', returnUrl);
        }
        else {
            const { successUrl, cancelUrl } = params;
            if (successUrl !== undefined)
                search.set('successUrl', successUrl);
            if (cancelUrl !== undefined)
                search.set('cancelUrl', cancelUrl);
        }
        for (const code of promoCodes) {
            search.append('promoCode', code);
        }
        const query = search.toString();
        return query.length > 0 ? `?${query}` : '';
    }
    appendPromoCodesToQuery(promoCodes) {
        const promoCodesQuery = promoCodes.join(',');
        return promoCodesQuery ? `promoCode=${promoCodesQuery}` : '';
    }
    async getTurboCryptoWallets() {
        const { addresses } = await this.httpService.get({
            endpoint: '/info',
        });
        return addresses;
    }
    async getCheckout({ amount, owner, promoCodes = [], uiMode = 'hosted', ...callbackUrls }, type = 'checkout-session', headers) {
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
        const endpoint = `/top-up/${type}/${owner}/${currencyType}/${paymentAmount}?${queryParams.toString()}`;
        const { adjustments, paymentSession, topUpQuote, fees } = await this.httpService.get({
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
    createCheckoutSession(params) {
        return this.getCheckout(params);
    }
    async submitFundTransaction({ txId, }) {
        this.logger.debug('Submitting fund transaction to Turbo...', {
            txId,
            url: this.url,
        });
        const response = await this.httpService.post({
            endpoint: `/account/balance/${this.token}`,
            data: Buffer.from(JSON.stringify({ tx_id: txId })),
        });
        if ('creditedTransaction' in response) {
            return {
                id: response.creditedTransaction.transactionId,
                quantity: response.creditedTransaction.transactionQuantity,
                owner: response.creditedTransaction.transactionSenderAddress ??
                    response.creditedTransaction.destinationAddress,
                winc: response.creditedTransaction.winstonCreditAmount,
                token: response.creditedTransaction.tokenType,
                status: 'confirmed',
                block: response.creditedTransaction.blockHeight,
                recipient: response.creditedTransaction.destinationAddress,
            };
        }
        else if ('pendingTransaction' in response) {
            return {
                id: response.pendingTransaction.transactionId,
                quantity: response.pendingTransaction.transactionQuantity,
                owner: response.pendingTransaction.transactionSenderAddress ??
                    response.pendingTransaction.destinationAddress,
                winc: response.pendingTransaction.winstonCreditAmount,
                token: response.pendingTransaction.tokenType,
                status: 'pending',
                recipient: response.pendingTransaction.destinationAddress,
            };
        }
        else if ('failedTransaction' in response) {
            return {
                id: response.failedTransaction.transactionId,
                quantity: response.failedTransaction.transactionQuantity,
                owner: response.failedTransaction.transactionSenderAddress ??
                    response.failedTransaction.destinationAddress,
                winc: response.failedTransaction.winstonCreditAmount,
                token: response.failedTransaction.tokenType,
                status: 'failed',
                recipient: response.failedTransaction.destinationAddress,
            };
        }
        throw new Error('Unknown response from payment service: ' + response);
    }
    async getCreditShareApprovals({ userAddress, }) {
        const response = await this.httpService.get({
            endpoint: `/account/approvals/get?userAddress=${userAddress}`,
            allowedStatuses: [200, 404],
        });
        if (response?.givenApprovals === undefined &&
            response?.receivedApprovals === undefined) {
            return {
                givenApprovals: [],
                receivedApprovals: [],
            };
        }
        return response;
    }
    async getFiatEstimateForBytes({ byteCount, currency, }) {
        // Step 1: Get the estimated winc cost for the given byte count -- W
        const wincPriceForGivenBytes = await this.getUploadCosts({
            bytes: [byteCount],
        });
        // Step 2: Get the winc-to-fiat conversion rates for 1 GiB
        const { winc: wincPriceForOneGiB, fiat: fiatPricesForOneGiB } = await this.getFiatRates();
        // Step 3: Convert the WINC cost of the given bytes into fiat:
        //  (W / W1GiB) * Fiat1GiB = FiatCostForBytes
        const fiatPriceForGivenBytes = new BigNumber(wincPriceForGivenBytes[0].winc)
            .dividedBy(new BigNumber(wincPriceForOneGiB))
            .times(fiatPricesForOneGiB[currency]);
        // Step 4: Format and round up so the estimated cost is always enough to cover the upload
        const formattedFiatPrice = currency === 'jpy'
            ? +fiatPriceForGivenBytes.integerValue(BigNumber.ROUND_CEIL) // no decimals for JPY
            : +fiatPriceForGivenBytes.decimalPlaces(2, BigNumber.ROUND_CEIL); // 2 decimal precision
        return {
            byteCount,
            amount: formattedFiatPrice,
            currency,
            winc: wincPriceForGivenBytes[0].winc,
        };
    }
    async getTokenPriceForBytes({ byteCount, }) {
        const wincPriceForOneToken = (await this.getWincForToken({
            tokenAmount: tokenToBaseMap[this.token](1),
        })).winc;
        const wincPriceForOneGiB = (await this.getUploadCosts({
            bytes: [2 ** 30],
        }))[0].winc;
        const tokenPriceForOneGiB = new BigNumber(wincPriceForOneGiB).dividedBy(wincPriceForOneToken);
        const tokenPriceForBytes = tokenPriceForOneGiB
            .dividedBy(2 ** 30)
            .times(byteCount)
            .toFixed(exponentMap[this.token]);
        return { byteCount, tokenPrice: tokenPriceForBytes, token: this.token };
    }
    async createPaymentIntent(params) {
        return this.getCheckout(params, 'payment-intent');
    }
}
// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
export class TurboAuthenticatedPaymentService extends TurboUnauthenticatedPaymentService {
    constructor({ url = defaultPaymentServiceURL, retryConfig, signer, logger = Logger.default, token = 'arweave', tokenTools, }) {
        super({ url, retryConfig, logger, token });
        this.signer = signer;
        this.tokenTools = tokenTools;
    }
    async getBalance(userAddress) {
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
    async getArNSFiatPurchaseQuote(params) {
        const address = params.address ?? (await this.signer.getNativeAddress());
        return super.getArNSFiatPurchaseQuote({
            ...params,
            address,
        });
    }
    async getFreeStatus(userAddress) {
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
    async getPaymentHistory({ limit, cursor, } = {}) {
        const headers = await this.signer.generateSignedRequestHeaders();
        const query = new URLSearchParams();
        if (limit !== undefined) {
            query.set('limit', `${limit}`);
        }
        if (cursor !== undefined) {
            query.set('cursor', cursor);
        }
        const queryString = query.toString();
        return this.httpService.get({
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
    async purchaseArNSName(params) {
        this.validateArNSPurchaseParams(params);
        // The bundler requires the signed nonce to be a UUID; it also doubles as
        // the idempotency + status-lookup key (`getArNSPurchaseStatus`).
        const nonce = uuidV4();
        const headers = await this.signer.generateSignedRequestHeaders(nonce);
        let response;
        try {
            response = await this.httpService.post({
                endpoint: `/arns/purchase/${params.intent.toLowerCase()}/${params.name}${this.buildArNSPurchaseQuery(params)}`,
                headers,
                // Params travel in the query string + signed headers; the service reads
                // no body, but the HTTP layer requires a `data` field.
                data: Buffer.from([]),
                // Non-idempotent signed write: the nonce is single-use, so a retried
                // (but already-landed) purchase would 4xx as "already exists". Poll
                // status by nonce instead of retrying.
                retry: false,
            });
        }
        catch (error) {
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
    buyArNSName(params) {
        return this.purchaseArNSName({
            ...params,
            intent: 'Buy-Name',
        });
    }
    extendArNSLease(params) {
        return this.purchaseArNSName({ ...params, intent: 'Extend-Lease' });
    }
    increaseArNSUndernameLimit(params) {
        return this.purchaseArNSName({
            ...params,
            intent: 'Increase-Undername-Limit',
        });
    }
    upgradeArNSName(params) {
        return this.purchaseArNSName({ ...params, intent: 'Upgrade-Name' });
    }
    // ---- ArNS ANT custody: self-custody exit + manage records ----
    // Canonical ACTION-BOUND message. MUST match the bundler's
    // buildArNSCustodyMessage byte-for-byte (newline-delimited) or every signature
    // is rejected. The bundler reconstructs this from the request and verifies the
    // signature over `message + nonce`, so a captured signature can't be replayed
    // against a different operation/params.
    buildArNSCustodyMessage(action, fields) {
        return ['arns', action, ...fields].join('\n');
    }
    /**
     * Self-custody exit: move a Turbo-custodied ANT to a Solana pubkey you control.
     * Authenticated with an action-bound, single-use signature.
     */
    async transferArNSAnt({ antId, target, }) {
        const nonce = uuidV4();
        const headers = await this.signer.generateSignedRequestHeaders(nonce, this.buildArNSCustodyMessage('transfer', [antId, target]));
        return this.httpService.post({
            endpoint: `/arns/transfer/${antId}?target=${encodeURIComponent(target)}`,
            headers,
            data: Buffer.from([]),
            retry: false, // single-use action-bound nonce; don't re-POST on 5xx
        });
    }
    /** Set a resolution record on a custodied ANT (undername defaults to '@'). */
    async setArNSRecord({ antId, undername = '@', transactionId, ttlSeconds, }) {
        const nonce = uuidV4();
        const headers = await this.signer.generateSignedRequestHeaders(nonce, this.buildArNSCustodyMessage('set-record', [
            antId,
            undername,
            transactionId,
            String(ttlSeconds),
        ]));
        const query = `?undername=${encodeURIComponent(undername)}&transactionId=${transactionId}&ttlSeconds=${ttlSeconds}`;
        return this.httpService.post({
            endpoint: `/arns/manage/${antId}/set-record${query}`,
            headers,
            data: Buffer.from([]),
            retry: false, // single-use action-bound nonce; don't re-POST on 5xx
        });
    }
    /** Remove a resolution record (an undername) from a custodied ANT. */
    async removeArNSRecord({ antId, undername, }) {
        const nonce = uuidV4();
        const headers = await this.signer.generateSignedRequestHeaders(nonce, this.buildArNSCustodyMessage('remove-record', [antId, undername]));
        return this.httpService.post({
            endpoint: `/arns/manage/${antId}/remove-record?undername=${encodeURIComponent(undername)}`,
            headers,
            data: Buffer.from([]),
            retry: false, // single-use action-bound nonce; don't re-POST on 5xx
        });
    }
    /**
     * Defaults to the signer's own address when `userAddress` is omitted
     * (`null`/`undefined`). Passing `''` does NOT trigger this default --
     * mirrors `getBalance`'s existing behavior above.
     */
    async getArNSNames(userAddress) {
        userAddress ??= await this.signer.getNativeAddress();
        return super.getArNSNames(userAddress);
    }
    async getCreditShareApprovals({ userAddress, }) {
        userAddress ??= await this.signer.getNativeAddress();
        return super.getCreditShareApprovals({ userAddress });
    }
    async getWincForFiat({ amount, promoCodes = [], }) {
        return super.getWincForFiat({
            amount,
            promoCodes,
            nativeAddress: await this.signer.getNativeAddress(),
        });
    }
    async createCheckoutSession(params) {
        return this.getCheckout(params);
    }
    async getTargetWalletForFund() {
        const { addresses } = await this.httpService.get({
            endpoint: '/info',
        });
        const walletAddress = addresses[this.token];
        if (!walletAddress) {
            throw new Error(`No wallet address found for token type: ${this.token}`);
        }
        return walletAddress;
    }
    async topUpWithTokens({ feeMultiplier = 1, tokenAmount: tokenAmountV, turboCreditDestinationAddress, }) {
        if (!this.tokenTools) {
            throw new Error(`Token type not supported for crypto fund ${this.token}`);
        }
        if (turboCreditDestinationAddress !== undefined) {
            if (isAnyValidUserAddress(turboCreditDestinationAddress) === false) {
                throw new Error(`Invalid turboCreditDestinationAddress provided: ${turboCreditDestinationAddress}`);
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
        }
        catch (e) {
            this.logger.error(`Failed to poll for transaction being available from ${this.token} gateway... Attempting to submit fund tx to Turbo...`, e);
        }
        try {
            return {
                ...(await this.submitFundTransaction({ txId })),
                target: fundTx.target,
                reward: fundTx.reward,
            };
        }
        catch (e) {
            this.logger.debug('Failed to submit fund transaction...', e);
            throw Error(`Failed to submit fund transaction! Save this Transaction ID and try again with 'turbo.submitFundTransaction(id)': ${txId}`);
        }
    }
}
