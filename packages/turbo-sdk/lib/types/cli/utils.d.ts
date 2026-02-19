import { Command, OptionValues } from 'commander';
import { Currency, ExistingBalanceFunding, OnDemandFunding, TokenType, TurboAuthenticatedClient, TurboChunkingParams, TurboUnauthenticatedConfiguration } from '../node/index.js';
import { AddressOptions, GlobalOptions, TokenPriceOptions, UploadFolderOptions, UploadOptions, WalletOptions } from './types.js';
export declare function exitWithErrorLog(error: unknown): void;
export declare function runCommand<T extends OptionValues>(command: Command, action: (options: T) => Promise<void>): Promise<void>;
interface CommanderOption {
    alias: string;
    description: string;
    default?: string | boolean;
}
export declare function applyOptions(command: Command, options: CommanderOption[]): Command;
export declare function tokenFromOptions(options: unknown): TokenType;
export declare function valueFromOptions(options: unknown): string;
export declare function getFolderPathFromOptions(options: unknown): string;
export declare function addressOrPrivateKeyFromOptions(options: AddressOptions): Promise<{
    address: string | undefined;
    privateKey: string | undefined;
}>;
export declare function optionalPrivateKeyFromOptions(options: WalletOptions): Promise<string | undefined>;
export declare function privateKeyFromOptions({ mnemonic, privateKey, walletFile, token, }: WalletOptions): Promise<string>;
export declare function configFromOptions(options: GlobalOptions): TurboUnauthenticatedConfiguration;
export declare function turboFromOptions(options: WalletOptions): Promise<TurboAuthenticatedClient>;
export declare function paidByFromOptions({ paidBy: paidByCliInput, ignoreApprovals, useSignerBalanceFirst, }: UploadOptions, turbo: TurboAuthenticatedClient): Promise<string[] | undefined>;
export declare function getUploadFolderOptions(options: UploadFolderOptions): {
    folderPath: string;
    indexFile: string | undefined;
    fallbackFile: string | undefined;
    disableManifest: boolean;
    maxConcurrentUploads: number;
} & Partial<TurboChunkingParams>;
/**
 * Parse tags array from CLI input into Tag array
 * Accepts format: ["name1", "value1", "name2", "value2"]
 * @param tagsArr Array of alternating tag names and values
 * @returns Array of {name: string, value: string} objects
 */
export declare function parseTags(tagsArr?: string[]): {
    name: string;
    value: string;
}[];
export declare function getTagsFromOptions(options: UploadOptions): {
    name: string;
    value: string;
}[];
export declare function onDemandOptionsFromOptions(options: UploadOptions): {
    fundingMode: OnDemandFunding | ExistingBalanceFunding;
};
export declare function currencyFromOptions<T extends GlobalOptions & {
    currency?: string;
}>(options: T): Currency | undefined;
export declare function requiredByteCountFromOptions({ byteCount, }: TokenPriceOptions): number;
export declare function getChunkingOptions<O extends UploadOptions>(options: O): Partial<TurboChunkingParams>;
export {};
//# sourceMappingURL=utils.d.ts.map