"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredNameFromOptions = requiredNameFromOptions;
exports.positiveIntFromOption = positiveIntFromOption;
exports.typeFromOptions = typeFromOptions;
exports.actionFromOptions = actionFromOptions;
exports.paidByFromArNSOptions = paidByFromArNSOptions;
exports.arnsPriceParamsFromOptions = arnsPriceParamsFromOptions;
exports.arnsPrice = arnsPrice;
exports.arnsFiatQuote = arnsFiatQuote;
exports.buyArNSName = buyArNSName;
exports.extendArNSLease = extendArNSLease;
exports.increaseArNSUndernames = increaseArNSUndernames;
exports.upgradeArNSName = upgradeArNSName;
exports.arnsPurchaseStatus = arnsPurchaseStatus;
exports.arnsActionStatus = arnsActionStatus;
exports.transferArNSAnt = transferArNSAnt;
exports.setArNSRecord = setArNSRecord;
exports.removeArNSRecord = removeArNSRecord;
exports.addArNSController = addArNSController;
exports.removeArNSController = removeArNSController;
exports.transferArNSRecord = transferArNSRecord;
exports.setArNSRecordMetadata = setArNSRecordMetadata;
exports.removeArNSRecordMetadata = removeArNSRecordMetadata;
exports.arnsActionPrice = arnsActionPrice;
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
const arnsActions_js_1 = require("../../common/arnsActions.js");
const factory_js_1 = require("../../node/factory.js");
const types_js_1 = require("../../types.js");
const errors_js_1 = require("../../utils/errors.js");
const constants_js_1 = require("../constants.js");
const utils_js_1 = require("../utils.js");
/**
 * The ANT owner's Solana key.
 *
 * Deliberately separate from the wallet that pays: the payer holds Turbo
 * credits (and may be Arweave or Ethereum), while the owner holds the ANT and
 * must be Solana. The owner needs a key to SIGN with, not a funded account —
 * Turbo is the fee payer on every sponsored action.
 */
function ownerFromOptions(options) {
    if (options.ownerKey === undefined || options.ownerKey === '') {
        throw new Error('Must provide --owner-key (a base58 Solana secret key) — it owns the ANT and signs for it. ' +
            'This is separate from the wallet paying in Turbo Credits.');
    }
    return (0, arnsActions_js_1.solanaOwnerSigner)(options.ownerKey);
}
/** The four ARIO-purchase actions are priced via `arnsPrice`, not this route. */
const ARNS_PURCHASE_ACTIONS = new Set([
    'buy-name',
    'extend-lease',
    'upgrade-name',
    'increase-undername-limit',
]);
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
/** Parses `--action` for `arns-action-price`, rejecting the four purchase actions. */
function actionFromOptions(options) {
    const { action } = options;
    if (action === undefined || action.length === 0) {
        throw new Error(`Must provide --action. One of: ${types_js_1.arNSActions.join(', ')}`);
    }
    if (!types_js_1.arNSActions.includes(action)) {
        throw new Error(`Invalid --action '${action}'. One of: ${types_js_1.arNSActions.join(', ')}`);
    }
    if (ARNS_PURCHASE_ACTIONS.has(action)) {
        throw new Error(`'${action}' is priced via \`turbo arns-price\`, not \`arns-action-price\` — ` +
            'it spends ARIO, not just the flat credits margin this route quotes.');
    }
    return action;
}
/** `null` clears the field (Set-Record-Metadata's tri-state), `undefined` leaves it unchanged. */
function metadataFieldFromOptions(value, clear, flag) {
    // Commander registers each value flag and its --clear-* partner separately, so
    // it accepts both. Silently letting the clear win would discard a value the
    // caller explicitly passed.
    if (clear && value !== undefined) {
        throw new Error(`Cannot pass both --${flag} and --clear-${flag}. Pass one: the value to set it, or the clear flag to unset it.`);
    }
    return clear ? null : value;
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
/**
 * Takes the promise rather than a thunk: wrapping the call in a closure would
 * discard the `undefined` narrowing each handler's guard clauses establish.
 */
async function withCreditErrorMapping(promise) {
    try {
        return await promise;
    }
    catch (error) {
        if (error instanceof errors_js_1.InsufficientCreditsError) {
            throw new Error('Insufficient Turbo credits to complete this ArNS action. ' +
                'Top up your balance (e.g. `turbo top-up` or `turbo crypto-fund`) and retry.');
        }
        throw error;
    }
}
function logPurchaseResult(action, result) {
    console.log(JSON.stringify({
        message: `${action} completed!`,
        nonce: result.nonce,
        antId: result.antId,
        // Solana transaction id of the on-chain write.
        messageId: result.messageId,
        ...(result.alreadyCompleted === true ? { alreadyCompleted: true } : {}),
    }, null, 2));
    // Credit-paid buys go through the actions API, so the nonce lives in the
    // action namespace. `arns-purchase-status` reads `/arns/purchase/`, a
    // separate namespace that answers "Purchase status not found" for this nonce.
    console.log(`\nTrack this with:\n  turbo arns-action-status --nonce ${result.nonce}`);
}
async function arnsPrice(options, turbo) {
    const params = arnsPriceParamsFromOptions(options);
    const client = turbo ?? factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
    const { winc, wincTotal, antSpawnSurchargeWinc, mARIO } = await client.getArNSPriceForName(params);
    // `wincTotal` is the figure to pay. `winc` is the name only and excludes the
    // ANT spawn surcharge, which for a Buy-Name can exceed the name's own price,
    // so printing it as the price under-quotes what `buy-arns-name` then debits.
    console.log(JSON.stringify({
        name: params.name,
        intent: params.intent,
        wincTotal,
        credits: creditsFromWinc(wincTotal),
        nameOnlyWinc: winc,
        antSpawnSurchargeWinc,
        mARIO,
    }, null, 2));
}
async function arnsFiatQuote(options, turbo) {
    const params = arnsPriceParamsFromOptions(options);
    // `arnsPriceParamsFromOptions` substitutes PRICING_PLACEHOLDER_PROCESS_ID for
    // an omitted Buy-Name `processId`, which is fine for a price lookup but NOT
    // here: a quote records a real purchase, and that placeholder is not a valid
    // ANT. Send `processId` only when the caller actually supplied one — omitting
    // it is what tells Turbo to custodially provision the ANT.
    if (options.processId === undefined) {
        delete params.processId;
    }
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
    // Every buy mints a fresh ANT straight to `--owner-key`; Turbo never holds
    // it, and there is no bring-your-own-ANT path any more.
    const owner = ownerFromOptions(options);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(type === 'lease'
        ? client.buyArNSName({
            name,
            owner,
            type: 'lease',
            years: positiveIntFromOption(options.years, '--years'),
            paidBy,
        })
        : client.buyArNSName({ name, owner, type: 'permabuy', paidBy }));
    logPurchaseResult('ArNS name purchase', result);
}
async function extendArNSLease(options, turbo) {
    const name = requiredNameFromOptions(options);
    const years = positiveIntFromOption(options.years, '--years');
    const paidBy = paidByFromArNSOptions(options.paidBy);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.extendArNSLease({ name, years, paidBy }));
    logPurchaseResult('ArNS lease extension', result);
}
async function increaseArNSUndernames(options, turbo) {
    const name = requiredNameFromOptions(options);
    const increaseQty = positiveIntFromOption(options.increaseQty, '--increase-qty');
    const paidBy = paidByFromArNSOptions(options.paidBy);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.increaseArNSUndernameLimit({ name, increaseQty, paidBy }));
    logPurchaseResult('ArNS undername limit increase', result);
}
async function upgradeArNSName(options, turbo) {
    const name = requiredNameFromOptions(options);
    const paidBy = paidByFromArNSOptions(options.paidBy);
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.upgradeArNSName({ name, paidBy }));
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
/**
 * Status of a credit-paid ArNS action (buy, extend, upgrade, increase, and the
 * eight non-purchase actions). Distinct from `arns-purchase-status`, which
 * reads the `/arns/purchase/` namespace that fiat quotes land in.
 *
 * Authenticated because `getArNSActionStatus` lives on the authenticated
 * client, though the route itself needs no signature.
 */
async function arnsActionStatus(options, turbo) {
    if (options.nonce === undefined || options.nonce.length === 0) {
        throw new Error('Must provide a --nonce to look up action status');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const status = await client.getArNSActionStatus(options.nonce);
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
    const result = await withCreditErrorMapping(client.transferArNSAnt({
        antId: options.antId,
        owner: ownerFromOptions(options),
        target: options.target,
    }));
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
    const result = await withCreditErrorMapping(client.setArNSRecord({
        antId: options.antId,
        owner: ownerFromOptions(options),
        undername: options.undername ?? '@',
        transactionId: options.transactionId,
        ttlSeconds,
    }));
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
    const result = await withCreditErrorMapping(client.removeArNSRecord({
        antId: options.antId,
        owner: ownerFromOptions(options),
        undername: options.undername,
    }));
    console.log(JSON.stringify({ message: 'ArNS record removed!', ...result }, null, 2));
}
async function addArNSController(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to add a controller to');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.addArNSController({
        antId: options.antId,
        owner: ownerFromOptions(options),
        target: options.target,
    }));
    console.log(JSON.stringify({ message: 'ArNS controller added!', ...result }, null, 2));
}
async function removeArNSController(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to remove a controller from');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.removeArNSController({
        antId: options.antId,
        owner: ownerFromOptions(options),
        target: options.target,
    }));
    console.log(JSON.stringify({ message: 'ArNS controller removed!', ...result }, null, 2));
}
async function transferArNSRecord(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id whose record to transfer');
    }
    if (options.undername === undefined || options.undername.length === 0) {
        throw new Error('Must provide an --undername to transfer');
    }
    if (options.target === undefined) {
        throw new Error('Must provide a --target address to transfer the record to');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.transferArNSRecord({
        antId: options.antId,
        owner: ownerFromOptions(options),
        undername: options.undername,
        target: options.target,
    }));
    console.log(JSON.stringify({ message: 'ArNS record transferred!', ...result }, null, 2));
}
async function setArNSRecordMetadata(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to set record metadata on');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.setArNSRecordMetadata({
        antId: options.antId,
        owner: ownerFromOptions(options),
        undername: options.undername ?? '@',
        displayName: metadataFieldFromOptions(options.displayName, options.clearDisplayName, 'display-name'),
        recordLogo: metadataFieldFromOptions(options.recordLogo, options.clearRecordLogo, 'record-logo'),
        recordDescription: metadataFieldFromOptions(options.recordDescription, options.clearRecordDescription, 'record-description'),
        recordKeywords: metadataFieldFromOptions(options.recordKeywords, options.clearRecordKeywords, 'record-keywords'),
    }));
    console.log(JSON.stringify({ message: 'ArNS record metadata set!', ...result }, null, 2));
}
async function removeArNSRecordMetadata(options, turbo) {
    if (options.antId === undefined) {
        throw new Error('Must provide an --ant-id to remove record metadata from');
    }
    if (options.undername === undefined || options.undername.length === 0) {
        throw new Error('Must provide an --undername');
    }
    const client = turbo ?? (await (0, utils_js_1.turboFromOptions)(options));
    const result = await withCreditErrorMapping(client.removeArNSRecordMetadata({
        antId: options.antId,
        owner: ownerFromOptions(options),
        undername: options.undername,
    }));
    console.log(JSON.stringify({ message: 'ArNS record metadata removed!', ...result }, null, 2));
}
/**
 * Preview what one of the eight non-purchase actions will debit, without
 * creating it.
 */
async function arnsActionPrice(options, turbo) {
    const action = actionFromOptions(options);
    const client = turbo ?? factory_js_1.TurboFactory.unauthenticated((0, utils_js_1.configFromOptions)(options));
    const { wincQty } = await client.getArNSActionPrice(action);
    console.log(JSON.stringify({ action, wincQty, credits: creditsFromWinc(wincQty) }, null, 2));
}
