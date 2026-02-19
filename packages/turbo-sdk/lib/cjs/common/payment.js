"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboAuthenticatedPaymentService = exports.TurboUnauthenticatedPaymentService = exports.defaultPaymentServiceURL = exports.developmentPaymentServiceURL = void 0;
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
const bignumber_js_1 = require("bignumber.js");
const common_js_1 = require("../utils/common.js");
const http_js_1 = require("./http.js");
const http_js_2 = require("./http.js");
const logger_js_1 = require("./logger.js");
const index_js_1 = require("./token/index.js");
exports.developmentPaymentServiceURL = 'https://payment.ardrive.dev';
exports.defaultPaymentServiceURL = 'https://payment.ardrive.io';
class TurboUnauthenticatedPaymentService {
    constructor({ url = exports.defaultPaymentServiceURL, logger = logger_js_1.Logger.default, retryConfig = (0, http_js_1.defaultRetryConfig)(logger), token = 'arweave', }) {
        this.logger = logger;
        this.httpService = new http_js_2.TurboHTTPService({
            url: `${url}/v1`,
            retryConfig,
            logger: this.logger,
        });
        this.token = token;
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
        const fiatPriceForGivenBytes = new bignumber_js_1.BigNumber(wincPriceForGivenBytes[0].winc)
            .dividedBy(new bignumber_js_1.BigNumber(wincPriceForOneGiB))
            .times(fiatPricesForOneGiB[currency]);
        // Step 4: Format and round up so the estimated cost is always enough to cover the upload
        const formattedFiatPrice = currency === 'jpy'
            ? +fiatPriceForGivenBytes.integerValue(bignumber_js_1.BigNumber.ROUND_CEIL) // no decimals for JPY
            : +fiatPriceForGivenBytes.decimalPlaces(2, bignumber_js_1.BigNumber.ROUND_CEIL); // 2 decimal precision
        return {
            byteCount,
            amount: formattedFiatPrice,
            currency,
            winc: wincPriceForGivenBytes[0].winc,
        };
    }
    async getTokenPriceForBytes({ byteCount, }) {
        const wincPriceForOneToken = (await this.getWincForToken({
            tokenAmount: index_js_1.tokenToBaseMap[this.token](1),
        })).winc;
        const wincPriceForOneGiB = (await this.getUploadCosts({
            bytes: [2 ** 30],
        }))[0].winc;
        const tokenPriceForOneGiB = new bignumber_js_1.BigNumber(wincPriceForOneGiB).dividedBy(wincPriceForOneToken);
        const tokenPriceForBytes = tokenPriceForOneGiB
            .dividedBy(2 ** 30)
            .times(byteCount)
            .toFixed(index_js_1.exponentMap[this.token]);
        return { byteCount, tokenPrice: tokenPriceForBytes, token: this.token };
    }
    async createPaymentIntent(params) {
        return this.getCheckout(params, 'payment-intent');
    }
}
exports.TurboUnauthenticatedPaymentService = TurboUnauthenticatedPaymentService;
// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
class TurboAuthenticatedPaymentService extends TurboUnauthenticatedPaymentService {
    constructor({ url = exports.defaultPaymentServiceURL, retryConfig, signer, logger = logger_js_1.Logger.default, token = 'arweave', tokenTools, }) {
        super({ url, retryConfig, logger, token });
        this.signer = signer;
        this.tokenTools = tokenTools;
    }
    async getBalance(userAddress) {
        userAddress ??= await this.signer.getNativeAddress();
        return super.getBalance(userAddress);
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
            if ((0, common_js_1.isAnyValidUserAddress)(turboCreditDestinationAddress) === false) {
                throw new Error(`Invalid turboCreditDestinationAddress provided: ${turboCreditDestinationAddress}`);
            }
        }
        const tokenAmount = new bignumber_js_1.BigNumber(tokenAmountV);
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
exports.TurboAuthenticatedPaymentService = TurboAuthenticatedPaymentService;
