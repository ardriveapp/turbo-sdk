"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredNameFromOptions = requiredNameFromOptions;
exports.positiveIntFromOption = positiveIntFromOption;
exports.typeFromOptions = typeFromOptions;
exports.paidByFromArNSOptions = paidByFromArNSOptions;
exports.arnsPriceParamsFromOptions = arnsPriceParamsFromOptions;
exports.arnsPrice = arnsPrice;
exports.arnsFiatQuote = arnsFiatQuote;
exports.buyArNSName = buyArNSName;
exports.extendArNSLease = extendArNSLease;
exports.increaseArNSUndernames = increaseArNSUndernames;
exports.upgradeArNSName = upgradeArNSName;
exports.arnsPurchaseStatus = arnsPurchaseStatus;
exports.transferArNSAnt = transferArNSAnt;
exports.setArNSRecord = setArNSRecord;
exports.removeArNSRecord = removeArNSRecord;
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
const factory_js_1 = require("../../node/factory.js");
const errors_js_1 = require("../../utils/errors.js");
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils.js");
function requiredNameFromOptions(options) {
    if (options.name === undefined || options.name.length === 0) {
        throw new Error('Must provide an ArNS --name');
    }
    return options.name;
}
function positiveIntFromOption(value, flag) {
    if (value === undefined) {
        throw new Error(`Must provide ${flag}`);
    }
    const num = +value;
    if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
        throw new Error(`${flag} must be a positive integer`);
    }
    return num;
}
function typeFromOptions(value) {
    if (value !== 'lease' && value !== 'permabuy') {
        throw new Error("Must provide --type of 'lease' or 'permabuy'");
    }
    return value;
}
function paidByFromArNSOptions(paidBy) {
    return paidBy !== undefined && paidBy.length > 0 ? paidBy : undefined;
}
// A price quote depends only on the name (length), type, and years — NOT on the
// ANT the name will resolve to. The service ignores `processId` for pricing, but
// the SDK's Buy-Name validation still requires a non-empty one, so we substitute
// this obvious placeholder when the user omits `--process-id` from `arns-price`.
// (`buy-arns-name` still requires a real `--process-id`.)
const PRICING_PLACEHOLDER_PROCESS_ID = 'pricing-only-no-process-id';
/**
 * Infer the ArNS pricing intent from the provided flags:
 * - `--type` present            -> Buy-Name (lease needs --years; --process-id optional for pricing)
 * - `--increase-qty` present    -> Increase-Undername-Limit
 * - `--years` present (no type) -> Extend-Lease
 * - otherwise                   -> Upgrade-Name
 */
function arnsPriceParamsFromOptions(options) {
    const name = requiredNameFromOptions(options);
    if (options.type !== undefined) {
        const type = typeFromOptions(options.type);
        const processId = options.processId ?? PRICING_PLACEHOLDER_PROCESS_ID;
        if (type === 'lease') {
            return {
                intent: 'Buy-Name',
                name,
                type: 'lease',
                years: positiveIntFromOption(options.years, '--years'),
                processId,
            };
        }
        return {
            intent: 'Buy-Name',
            name,
            type: 'permabuy',
            processId,
        };
    }
    if (options.increaseQty !== undefined) {
        return {
            intent: 'Increase-Undername-Limit',
            name,
            increaseQty: positiveIntFromOption(options.increaseQty, '--increase-qty'),
        };
    }
    if (options.years !== undefined) {
        return {
            intent: 'Extend-Lease',
            name,
            years: positiveIntFromOption(options.years, '--years'),
        };
    }
    return { intent: 'Upgrade-Name', name };
}
function creditsFromWinc(winc) {
    return new bignumber_js_1.BigNumber(winc).dividedBy(constants_js_1.wincPerCredit).toFixed(12);
}
/** Rethrow a 402 as a clear, actionable "top up" message. */
async function withCreditErrorMapping(fn) {
    try {
        return await fn();
    }
    catch (error) {
        if (error instanceof errors_js_1.InsufficientCreditsError) {
            throw new Error('Insufficient Turbo credits to complete this ArNS purchase. ' +
                'Top up your balance (e.g. `turbo top-up` or `turbo crypto-fund`) and retry.');
        }
        throw error;
    }
}
function logPurchaseResult(action, result) {
    console.log(JSON.stringify({
        message: `${action} submitted!`,
        nonce: result.nonce,
        arioWriteId: result.arioWriteResult?.id,
        purchaseReceipt: result.purchaseReceipt,
    }, null, 2));
    console.log(`\nTrack this purchase with:\n  turbo arns-purchase-status --nonce ${result.nonce}`);
}
async function arnsPrice(options, turbo) {
    const params = arnsPriceParamsFromOptions(options);
    const client = turbo ?? factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
    const { winc, mARIO } = await client.getArNSPriceForName(params);
    console.log(JSON.stringify({
        name: params.name,
        intent: params.intent,
        winc,
        credits: creditsFromWinc(winc),
        mARIO,
    }, null, 2));
}
async function arnsFiatQuote(options, turbo) {
    const params = arnsPriceParamsFromOptions(options);
    const address = options.address;
    if (address === undefined) {
        throw new Error('A destination --address is required for a fiat ArNS quote.');
    }
    const client = turbo ?? factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
    try {
        const { purchaseQuote, paymentSession, adjustments, fees } = await client.getArNSFiatPurchaseQuote({
            ...params,
            address,
            currency: (options.currency ?? 'usd'),
            method: options.method,
            promoCodes: options.promoCode,
        });
        console.log(JSON.stringify({
            name: purchaseQuote.name,
            intent: purchaseQuote.intent,
            nonce: purchaseQuote.nonce,
            paymentAmount: purchaseQuote.paymentAmount,
            currency: purchaseQuote.currencyType,
            quoteExpirationDate: purchaseQuote.quoteExpirationDate,
            paymentSessionId: paymentSession.id,
            // Present for a payment intent / embedded checkout; a hosted
            // checkout session returns `url` instead.
            clientSecret: paymentSession.client_secret ?? undefined,
            checkoutUrl: paymentSession.url ?? undefined,
            adjustments,
            fees,
        }, null, 2));
    }
    catch (error) {
        if (error instanceof errors_js_1.FiatPaymentsDisabledError) {
            console.error('Fiat (Stripe) payments are disabled on this payment service. Use the credit-paid commands (buy-arns-name, extend-arns-lease, ...) instead.');
            throw error;
        }
        throw error;
    }
}
async function buyArNSName(options, turbo) {
    const name = requiredNameFromOptions(options);
    const type = typeFromOptions(options.type);
    const paidBy = paidByFromArNSOptions(options.paidBy);
    // `--process-id` is OPTIONAL: omit it to have Turbo custodially provision the
    // ANT (Turbo spawns + owns it — Model A); supply it to point the name at a
    // user-owned ANT (Model B). When omitted, no `processId` is sent.
    const processId = options.processId;
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(() => type === 'lease'
        ? client.buyArNSName({
            name,
            type: 'lease',
            years: positiveIntFromOption(options.years, '--years'),
            processId,
            paidBy,
        })
        : client.buyArNSName({ name, type: 'permabuy', processId, paidBy }));
    logPurchaseResult('ArNS name purchase', result);
}
async function extendArNSLease(options, turbo) {
    const name = requiredNameFromOptions(options);
    const years = positiveIntFromOption(options.years, '--years');
    const paidBy = paidByFromArNSOptions(options.paidBy);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(() => client.extendArNSLease({ name, years, paidBy }));
    logPurchaseResult('ArNS lease extension', result);
}
async function increaseArNSUndernames(options, turbo) {
    const name = requiredNameFromOptions(options);
    const increaseQty = positiveIntFromOption(options.increaseQty, '--increase-qty');
    const paidBy = paidByFromArNSOptions(options.paidBy);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(() => client.increaseArNSUndernameLimit({ name, increaseQty, paidBy }));
    logPurchaseResult('ArNS undername limit increase', result);
}
async function upgradeArNSName(options, turbo) {
    const name = requiredNameFromOptions(options);
    const paidBy = paidByFromArNSOptions(options.paidBy);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(() => client.upgradeArNSName({ name, paidBy }));
    logPurchaseResult('ArNS name upgrade (to permabuy)', result);
}
async function arnsPurchaseStatus(options, turbo) {
    if (options.nonce === undefined || options.nonce.length === 0) {
        throw new Error('Must provide a --nonce to look up purchase status');
    }
    const client = turbo ?? factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
    const status = await client.getArNSPurchaseStatus({ nonce: options.nonce });
    const state = status.failedDate !== undefined
        ? 'failed'
        : status.messageId
            ? 'success'
            : 'pending';
    console.log(JSON.stringify({ state, ...status }, null, 2));
}
async function transferArNSAnt(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to transfer');
    }
    if (options.target === undefined) {
        throw new Error('Must provide a --target address to transfer the ANT to');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await client.transferArNSAnt({
        antId: options.antId,
        target: options.target,
    });
    console.log(JSON.stringify({ message: 'ANT transfer submitted!', ...result }, null, 2));
}
async function setArNSRecord(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to set a record on');
    }
    if (options.transactionId === undefined) {
        throw new Error('Must provide a --transaction-id for the record');
    }
    const ttlSeconds = positiveIntFromOption(options.ttlSeconds, '--ttl-seconds');
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await client.setArNSRecord({
        antId: options.antId,
        undername: options.undername ?? '@',
        transactionId: options.transactionId,
        ttlSeconds,
    });
    console.log(JSON.stringify({ message: 'ArNS record set!', ...result }, null, 2));
}
async function removeArNSRecord(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to remove a record from');
    }
    if (options.undername === undefined || options.undername.length === 0) {
        throw new Error('Must provide an --undername to remove');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await client.removeArNSRecord({
        antId: options.antId,
        undername: options.undername,
    });
    console.log(JSON.stringify({ message: 'ArNS record removed!', ...result }, null, 2));
}
