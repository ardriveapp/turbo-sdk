import { ArNSNameType, ArNSPriceParams, ArNSPriceResponse, ArNSPurchaseResponse, ArNSPurchaseStatusResponse } from '../../types.js';
import { ArNSPriceOptions, ArNSPurchaseOptions, ArNSPurchaseStatusOptions, RemoveArNSRecordOptions, SetArNSRecordOptions, TransferArNSAntOptions } from '../types.js';
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
        type: ArNSNameType;
        years?: number;
        processId?: string;
        paidBy?: string[];
    }): Promise<ArNSPurchaseResponse>;
    extendArNSLease(params: {
        name: string;
        years: number;
        paidBy?: string[];
    }): Promise<ArNSPurchaseResponse>;
    increaseArNSUndernameLimit(params: {
        name: string;
        increaseQty: number;
        paidBy?: string[];
    }): Promise<ArNSPurchaseResponse>;
    upgradeArNSName(params: {
        name: string;
        paidBy?: string[];
    }): Promise<ArNSPurchaseResponse>;
};
export type ArNSCustodyClient = {
    transferArNSAnt(params: {
        antId: string;
        target: string;
    }): Promise<{
        antId: string;
        target: string;
        name?: string;
        messageId: string;
    }>;
    setArNSRecord(params: {
        antId: string;
        undername?: string;
        transactionId: string;
        ttlSeconds: number;
    }): Promise<{
        antId: string;
        undername: string;
        transactionId: string;
        ttlSeconds: number;
        messageId: string;
    }>;
    removeArNSRecord(params: {
        antId: string;
        undername: string;
    }): Promise<{
        antId: string;
        undername: string;
        messageId: string;
    }>;
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
export declare function buyArNSName(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function extendArNSLease(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function increaseArNSUndernames(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function upgradeArNSName(options: ArNSPurchaseOptions, turbo?: ArNSPurchaseClient): Promise<void>;
export declare function arnsPurchaseStatus(options: ArNSPurchaseStatusOptions, turbo?: ArNSStatusClient): Promise<void>;
export declare function transferArNSAnt(options: TransferArNSAntOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function setArNSRecord(options: SetArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
export declare function removeArNSRecord(options: RemoveArNSRecordOptions, turbo?: ArNSCustodyClient): Promise<void>;
//# sourceMappingURL=arns.d.ts.map