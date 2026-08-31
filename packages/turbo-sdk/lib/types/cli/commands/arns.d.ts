import { ArNSFiatPurchaseQuoteParams, ArNSFiatPurchaseQuoteResponse, ArNSNameType, ArNSPriceParams, ArNSPriceResponse, ArNSPurchaseStatusResponse } from '../../types.js';
import { ArNSActionCompleted, ArNSOwnerSigner } from '../../types.js';
import { ArNSFiatQuoteOptions, ArNSPriceOptions, ArNSPurchaseOptions, ArNSPurchaseStatusOptions, RemoveArNSRecordOptions, SetArNSRecordOptions, TransferArNSAntOptions } from '../types.js';
export type ArNSPriceClient = {
    getArNSPriceForName(params: ArNSPriceParams): Promise<ArNSPriceResponse>;
};
export type ArNSStatusClient = {
    getArNSPurchaseStatus(p: {
        nonce: string;
    }): Promise<ArNSPurchaseStatusResponse>;
};
export type ArNSPurchaseClient = {
    buyArNSName(params: {
        name: string;
        owner: ArNSOwnerSigner;
        type?: ArNSNameType;
        years?: number;
        paidBy?: string[];
    }): Promise<ArNSActionCompleted>;
    extendArNSLease(params: {
        name: string;
        years: number;
        paidBy?: string[];
    }): Promise<ArNSActionCompleted>;
    increaseArNSUndernameLimit(params: {
        name: string;
        increaseQty: number;
        paidBy?: string[];
    }): Promise<ArNSActionCompleted>;
    upgradeArNSName(params: {
        name: string;
        paidBy?: string[];
    }): Promise<ArNSActionCompleted>;
};
export type ArNSCustodyClient = {
    transferArNSAnt(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        target: string;
    }): Promise<ArNSActionCompleted>;
    setArNSRecord(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        transactionId: string;
        undername?: string;
        ttlSeconds?: number;
    }): Promise<ArNSActionCompleted>;
    removeArNSRecord(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername: string;
    }): Promise<ArNSActionCompleted>;
};
export declare function requiredNameFromOptions(options: {
    name?: string;
}): string;
export declare function positiveIntFromOption(value: string | undefined, flag: string): number;
export declare function typeFromOptions(value: string | undefined): ArNSNameType;
export declare function paidByFromArNSOptions(paidBy: string[] | undefined): string[] | undefined;
/**
 * Infer the ArNS pricing intent from the provided flags:
 * - `--type` present            -> Buy-Name (lease needs --years; --process-id optional for pricing)
 * - `--increase-qty` present    -> Increase-Undername-Limit
 * - `--years` present (no type) -> Extend-Lease
 * - otherwise                   -> Upgrade-Name
 */
export declare function arnsPriceParamsFromOptions(options: ArNSPriceOptions): ArNSPriceParams;
export declare function arnsPrice(options: ArNSPriceOptions, turbo?: ArNSPriceClient): Promise<void>;
/**
 * Fiat (Stripe) quote for an ArNS purchase. Read-only from the CLI's point of
 * view: it records a quote and returns a Stripe session to complete elsewhere,
 * so nothing is charged here.
 */
export type ArNSFiatQuoteClient = {
    getArNSFiatPurchaseQuote(params: ArNSFiatPurchaseQuoteParams): Promise<ArNSFiatPurchaseQuoteResponse>;
};
export declare function arnsFiatQuote(options: ArNSFiatQuoteOptions, turbo?: ArNSFiatQuoteClient): Promise<void>;
export declare function buyArNSName(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function extendArNSLease(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function increaseArNSUndernames(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function upgradeArNSName(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function arnsPurchaseStatus(options: ArNSPurchaseStatusOptions, turbo?: ArNSStatusClient): Promise<void>;
export declare function transferArNSAnt(options: TransferArNSAntOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function setArNSRecord(options: SetArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function removeArNSRecord(options: RemoveArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
//# sourceMappingURL=arns.d.ts.map