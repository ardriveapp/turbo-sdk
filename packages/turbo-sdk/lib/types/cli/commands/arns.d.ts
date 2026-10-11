import { ArNSAction, ArNSActionPriceResponse, ArNSFiatPurchaseQuoteParams, ArNSFiatPurchaseQuoteResponse, ArNSNameType, ArNSPriceParams, ArNSPriceResponse, ArNSPurchaseStatusResponse } from '../../types.js';
import { ArNSActionCompleted, ArNSActionResult, ArNSOwnerSigner } from '../../types.js';
import { AddArNSControllerOptions, ArNSActionPriceOptions, ArNSActionStatusOptions, ArNSFiatQuoteOptions, ArNSPriceOptions, ArNSPurchaseOptions, ArNSPurchaseStatusOptions, RemoveArNSControllerOptions, RemoveArNSRecordMetadataOptions, RemoveArNSRecordOptions, SetArNSRecordMetadataOptions, SetArNSRecordOptions, TransferArNSAntOptions, TransferArNSRecordOptions } from '../types.js';
export type ArNSPriceClient = {
    getArNSPriceForName(params: ArNSPriceParams): Promise<ArNSPriceResponse>;
};
export type ArNSStatusClient = {
    getArNSPurchaseStatus(p: {
        nonce: string;
    }): Promise<ArNSPurchaseStatusResponse>;
};
export type ArNSActionStatusClient = {
    getArNSActionStatus(nonce: string): Promise<ArNSActionResult & {
        failedDate?: string;
    }>;
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
    addArNSController(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        target?: string;
    }): Promise<ArNSActionCompleted>;
    removeArNSController(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        target?: string;
    }): Promise<ArNSActionCompleted>;
    setArNSRecordMetadata(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername?: string;
        displayName?: string | null;
        recordLogo?: string | null;
        recordDescription?: string | null;
        recordKeywords?: string[] | null;
    }): Promise<ArNSActionCompleted>;
    removeArNSRecordMetadata(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername: string;
    }): Promise<ArNSActionCompleted>;
    transferArNSRecord(params: {
        antId: string;
        owner: ArNSOwnerSigner;
        undername: string;
        target: string;
    }): Promise<ArNSActionCompleted>;
};
export type ArNSActionPriceClient = {
    getArNSActionPrice(action: ArNSAction): Promise<ArNSActionPriceResponse>;
};
export declare function requiredNameFromOptions(options: {
    name?: string;
}): string;
export declare function positiveIntFromOption(value: string | undefined, flag: string): number;
export declare function typeFromOptions(value: string | undefined): ArNSNameType;
/** Parses `--action` for `arns-action-price`, rejecting the four purchase actions. */
export declare function actionFromOptions(options: {
    action?: string;
}): ArNSAction;
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
/**
 * Status of a credit-paid ArNS action (buy, extend, upgrade, increase, and the
 * eight non-purchase actions). Distinct from `arns-purchase-status`, which
 * reads the `/arns/purchase/` namespace that fiat quotes land in.
 *
 * Authenticated because `getArNSActionStatus` lives on the authenticated
 * client, though the route itself needs no signature.
 */
export declare function arnsActionStatus(options: ArNSActionStatusOptions, turbo?: ArNSActionStatusClient): Promise<void>;
export declare function transferArNSAnt(options: TransferArNSAntOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function setArNSRecord(options: SetArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function removeArNSRecord(options: RemoveArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function addArNSController(options: AddArNSControllerOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function removeArNSController(options: RemoveArNSControllerOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function transferArNSRecord(options: TransferArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function setArNSRecordMetadata(options: SetArNSRecordMetadataOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function removeArNSRecordMetadata(options: RemoveArNSRecordMetadataOptions, turbo?: ArNSCustodyClient): Promise<void>;
/**
 * Preview what one of the eight non-purchase actions will debit, without
 * creating it.
 */
export declare function arnsActionPrice(options: ArNSActionPriceOptions, turbo?: ArNSActionPriceClient): Promise<void>;
//# sourceMappingURL=arns.d.ts.map