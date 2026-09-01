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
export declare const optionMap: {
    readonly token: {
        readonly alias: "-t, --token <type>";
        readonly description: "Crypto token type for wallet or action";
        readonly default: "arweave";
    };
    readonly currency: {
        readonly alias: "-c, --currency <currency>";
        readonly description: "Fiat currency type to use for the action";
        readonly default: "usd";
    };
    readonly type: {
        readonly alias: "--type <priceType>";
        readonly description: "Price type for the action. Can be a fiat currency or crypto token or bytes";
        readonly default: "bytes";
    };
    readonly txId: {
        readonly alias: "-i, --tx-id <txId>";
        readonly description: "Transaction ID or hash to use for action";
    };
    readonly address: {
        readonly alias: "-a, --address <nativeAddress>";
        readonly description: "Native address to use for action";
    };
    readonly tags: {
        readonly description: "An array of additional tags for the write action, in \"--tags name1 value1 name2 value2\" format";
        readonly alias: "--tags <tags...>";
        readonly type: "array";
    };
    readonly value: {
        readonly alias: "-v, --value <value>";
        readonly description: "Value of fiat currency or crypto token for action. e.g: 10.50 for $10.50 USD or 0.0001 for 0.0001 AR";
    };
    readonly walletFile: {
        readonly alias: "-w, --wallet-file <filePath>";
        readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
    };
    readonly mnemonic: {
        readonly alias: "-m, --mnemonic <phrase>";
        readonly description: "Mnemonic to use with the action";
    };
    readonly privateKey: {
        readonly alias: "-p, --private-key <key>";
        readonly description: "Private key to use with the action";
    };
    readonly gateway: {
        readonly alias: "-g, --gateway <url>";
        readonly description: "Set a custom crypto gateway URL";
        readonly default: undefined;
    };
    readonly uploadUrl: {
        readonly alias: "--upload-url <url>";
        readonly description: "Set a custom upload service URL";
        readonly default: undefined;
    };
    readonly paymentUrl: {
        readonly alias: "--payment-url <url>";
        readonly description: "Set a custom payment service URL";
        readonly default: undefined;
    };
    readonly dev: {
        readonly alias: "--dev";
        readonly description: "Enable Turbo development endpoints";
        readonly default: false;
    };
    readonly local: {
        readonly alias: "--local";
        readonly description: "Enable local development endpoints";
        readonly default: false;
    };
    readonly debug: {
        readonly alias: "--debug";
        readonly description: "Enable verbose logging";
        readonly default: false;
    };
    readonly quiet: {
        readonly alias: "--quiet";
        readonly description: "Disable logging";
        readonly default: false;
    };
    readonly showProgress: {
        readonly alias: "--show-progress";
        readonly description: "Display progress bars during upload operations";
        readonly default: false;
    };
    readonly skipConfirmation: {
        readonly alias: "--skip-confirmation";
        readonly description: "Skip all confirmation prompts";
        readonly default: false;
    };
    readonly folderPath: {
        readonly alias: "-f, --folder-path <folderPath>";
        readonly description: "Directory to upload";
    };
    readonly filePath: {
        readonly alias: "-f, --file-path <filePath>";
        readonly description: "File to upload";
    };
    readonly indexFile: {
        readonly alias: "--index-file <indexFile>";
        readonly description: "Index file to use in the manifest created for folder upload";
    };
    readonly fallbackFile: {
        readonly alias: "--fallback-file <fallbackFile>";
        readonly description: "Fallback file to use in the manifest created for folder upload";
    };
    readonly manifest: {
        readonly alias: "--no-manifest";
        readonly description: "Disable manifest creation with --no-manifest";
        readonly default: true;
    };
    readonly maxConcurrency: {
        readonly alias: "--max-concurrency <maxConcurrency>";
        readonly description: "Maximum number of concurrent file uploads";
    };
    readonly paidBy: {
        readonly alias: "--paid-by <paidBy...>";
        readonly description: "Address to pay for the upload";
        readonly type: "array";
    };
    readonly expiresBySeconds: {
        readonly alias: "--expires-by-seconds <expiresBySeconds>";
        readonly description: "Expiration time in seconds";
    };
    readonly ignoreApprovals: {
        readonly alias: "--ignore-approvals";
        readonly description: "Ignore all credit share approvals, only use signing wallet's balance";
        readonly default: false;
    };
    readonly useSignerBalanceFirst: {
        readonly alias: "--use-signer-balance-first";
        readonly description: "Use the signer balance first before using credit share approvals";
        readonly default: false;
    };
    readonly byteCount: {
        readonly alias: "--byte-count <byteCount>";
        readonly description: "Number of bytes to use for the action";
    };
    readonly maxChunkConcurrency: {
        readonly alias: "--max-chunk-concurrency <maxChunkConcurrency>";
        readonly description: "Maximum number of concurrent chunks to upload per file";
    };
    readonly maxFinalizeMs: {
        readonly alias: "--max-finalize-ms <maxFinalizeMs>";
        readonly description: "Maximum time in milliseconds to wait for the finalization of all chunks after the last chunk is uploaded. Defaults to 1 minute per GiB of the total file size.";
    };
    readonly chunkByteCount: {
        readonly alias: "--chunk-byte-count <chunkByteCount>";
        readonly description: "Size of each chunk in bytes";
    };
    readonly chunkingMode: {
        readonly alias: "--chunking-mode <chunkingMode>";
        readonly description: "Chunking mode to use for the upload. Can be \"auto\", \"force\" or \"disabled\". Defaults to \"auto\".";
        readonly default: "auto";
    };
    readonly onDemand: {
        readonly alias: "--on-demand";
        readonly description: "Enable on-demand crypto top-ups during upload if balance is insufficient";
        readonly default: false;
    };
    readonly x402: {
        readonly alias: "--x402";
        readonly description: "Pay for the action using x402 funding (if available). Requires token `base-usdc`.";
        readonly default: false;
    };
    readonly topUpBufferMultiplier: {
        readonly alias: "--top-up-buffer-multiplier <topUpBufferMultiplier>";
        readonly description: "Multiplier to apply to the estimated top-up amount to avoid underpayment during on-demand top-ups. Defaults to 1.1 (10% buffer).";
    };
    readonly maxCryptoTopUpValue: {
        readonly alias: "--max-crypto-top-up-value <maxCryptoTopUpValue>";
        readonly description: "Maximum crypto top-up value to use for the upload. Defaults to no limit.";
    };
    readonly arnsName: {
        readonly alias: "--name <name>";
        readonly description: "ArNS name to price, buy, or manage";
    };
    readonly arnsType: {
        readonly alias: "--type <type>";
        readonly description: "ArNS purchase type for Buy-Name: 'lease' or 'permabuy'";
    };
    readonly arnsYears: {
        readonly alias: "--years <years>";
        readonly description: "Lease duration in years (Buy-Name lease / Extend-Lease)";
    };
    readonly arnsIncreaseQty: {
        readonly alias: "--increase-qty <qty>";
        readonly description: "Number of additional undernames (Increase-Undername-Limit)";
    };
    readonly arnsOwnerKey: {
        readonly alias: "--owner-key <base58SolanaSecretKey>";
        readonly description: "Base58 Solana secret key that OWNS the ANT and signs for it. Separate from the wallet paying in Turbo Credits — the owner needs a key to sign with, not SOL: Turbo pays every fee and rent";
    };
    readonly arnsNonce: {
        readonly alias: "--nonce <nonce>";
        readonly description: "ArNS purchase nonce to look up the status for";
    };
    readonly arnsAntId: {
        readonly alias: "--ant-id <antId>";
        readonly description: "ANT (Metaplex Core asset) ID to transfer or manage";
    };
    readonly arnsTarget: {
        readonly alias: "--target <address>";
        readonly description: "Target Solana pubkey to transfer the ANT to";
    };
    readonly arnsUndername: {
        readonly alias: "--undername <undername>";
        readonly description: "ArNS undername record to set or remove (defaults to '@')";
    };
    readonly arnsTransactionId: {
        readonly alias: "--transaction-id <transactionId>";
        readonly description: "Arweave transaction ID the ArNS record resolves to";
    };
    readonly arnsTtlSeconds: {
        readonly alias: "--ttl-seconds <ttlSeconds>";
        readonly description: "TTL in seconds for the ArNS record";
    };
    readonly limit: {
        readonly alias: "--limit <limit>";
        readonly description: "Max number of payment-history rows to return (1-100, default 50)";
    };
    readonly cursor: {
        readonly alias: "--cursor <cursor>";
        readonly description: "Opaque pagination cursor from a prior payment-history response";
    };
};
export declare const walletOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
})[];
export declare const globalOptions: ({
    readonly alias: "-t, --token <type>";
    readonly description: "Crypto token type for wallet or action";
    readonly default: "arweave";
} | {
    readonly alias: "-g, --gateway <url>";
    readonly description: "Set a custom crypto gateway URL";
    readonly default: undefined;
} | {
    readonly alias: "--upload-url <url>";
    readonly description: "Set a custom upload service URL";
    readonly default: undefined;
} | {
    readonly alias: "--payment-url <url>";
    readonly description: "Set a custom payment service URL";
    readonly default: undefined;
} | {
    readonly alias: "--dev";
    readonly description: "Enable Turbo development endpoints";
    readonly default: false;
} | {
    readonly alias: "--local";
    readonly description: "Enable local development endpoints";
    readonly default: false;
} | {
    readonly alias: "--debug";
    readonly description: "Enable verbose logging";
    readonly default: false;
} | {
    readonly alias: "--quiet";
    readonly description: "Disable logging";
    readonly default: false;
} | {
    readonly alias: "--skip-confirmation";
    readonly description: "Skip all confirmation prompts";
    readonly default: false;
})[];
export declare const uploadOptions: ({
    readonly description: "An array of additional tags for the write action, in \"--tags name1 value1 name2 value2\" format";
    readonly alias: "--tags <tags...>";
    readonly type: "array";
} | {
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--show-progress";
    readonly description: "Display progress bars during upload operations";
    readonly default: false;
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--ignore-approvals";
    readonly description: "Ignore all credit share approvals, only use signing wallet's balance";
    readonly default: false;
} | {
    readonly alias: "--use-signer-balance-first";
    readonly description: "Use the signer balance first before using credit share approvals";
    readonly default: false;
} | {
    readonly alias: "--max-chunk-concurrency <maxChunkConcurrency>";
    readonly description: "Maximum number of concurrent chunks to upload per file";
} | {
    readonly alias: "--max-finalize-ms <maxFinalizeMs>";
    readonly description: "Maximum time in milliseconds to wait for the finalization of all chunks after the last chunk is uploaded. Defaults to 1 minute per GiB of the total file size.";
} | {
    readonly alias: "--chunk-byte-count <chunkByteCount>";
    readonly description: "Size of each chunk in bytes";
} | {
    readonly alias: "--chunking-mode <chunkingMode>";
    readonly description: "Chunking mode to use for the upload. Can be \"auto\", \"force\" or \"disabled\". Defaults to \"auto\".";
    readonly default: "auto";
} | {
    readonly alias: "--on-demand";
    readonly description: "Enable on-demand crypto top-ups during upload if balance is insufficient";
    readonly default: false;
} | {
    readonly alias: "--x402";
    readonly description: "Pay for the action using x402 funding (if available). Requires token `base-usdc`.";
    readonly default: false;
} | {
    readonly alias: "--top-up-buffer-multiplier <topUpBufferMultiplier>";
    readonly description: "Multiplier to apply to the estimated top-up amount to avoid underpayment during on-demand top-ups. Defaults to 1.1 (10% buffer).";
} | {
    readonly alias: "--max-crypto-top-up-value <maxCryptoTopUpValue>";
    readonly description: "Maximum crypto top-up value to use for the upload. Defaults to no limit.";
})[];
export declare const uploadFolderOptions: ({
    readonly description: "An array of additional tags for the write action, in \"--tags name1 value1 name2 value2\" format";
    readonly alias: "--tags <tags...>";
    readonly type: "array";
} | {
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--show-progress";
    readonly description: "Display progress bars during upload operations";
    readonly default: false;
} | {
    readonly alias: "-f, --folder-path <folderPath>";
    readonly description: "Directory to upload";
} | {
    readonly alias: "--index-file <indexFile>";
    readonly description: "Index file to use in the manifest created for folder upload";
} | {
    readonly alias: "--fallback-file <fallbackFile>";
    readonly description: "Fallback file to use in the manifest created for folder upload";
} | {
    readonly alias: "--no-manifest";
    readonly description: "Disable manifest creation with --no-manifest";
    readonly default: true;
} | {
    readonly alias: "--max-concurrency <maxConcurrency>";
    readonly description: "Maximum number of concurrent file uploads";
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--ignore-approvals";
    readonly description: "Ignore all credit share approvals, only use signing wallet's balance";
    readonly default: false;
} | {
    readonly alias: "--use-signer-balance-first";
    readonly description: "Use the signer balance first before using credit share approvals";
    readonly default: false;
} | {
    readonly alias: "--max-chunk-concurrency <maxChunkConcurrency>";
    readonly description: "Maximum number of concurrent chunks to upload per file";
} | {
    readonly alias: "--max-finalize-ms <maxFinalizeMs>";
    readonly description: "Maximum time in milliseconds to wait for the finalization of all chunks after the last chunk is uploaded. Defaults to 1 minute per GiB of the total file size.";
} | {
    readonly alias: "--chunk-byte-count <chunkByteCount>";
    readonly description: "Size of each chunk in bytes";
} | {
    readonly alias: "--chunking-mode <chunkingMode>";
    readonly description: "Chunking mode to use for the upload. Can be \"auto\", \"force\" or \"disabled\". Defaults to \"auto\".";
    readonly default: "auto";
} | {
    readonly alias: "--on-demand";
    readonly description: "Enable on-demand crypto top-ups during upload if balance is insufficient";
    readonly default: false;
} | {
    readonly alias: "--x402";
    readonly description: "Pay for the action using x402 funding (if available). Requires token `base-usdc`.";
    readonly default: false;
} | {
    readonly alias: "--top-up-buffer-multiplier <topUpBufferMultiplier>";
    readonly description: "Multiplier to apply to the estimated top-up amount to avoid underpayment during on-demand top-ups. Defaults to 1.1 (10% buffer).";
} | {
    readonly alias: "--max-crypto-top-up-value <maxCryptoTopUpValue>";
    readonly description: "Maximum crypto top-up value to use for the upload. Defaults to no limit.";
})[];
export declare const uploadFileOptions: ({
    readonly description: "An array of additional tags for the write action, in \"--tags name1 value1 name2 value2\" format";
    readonly alias: "--tags <tags...>";
    readonly type: "array";
} | {
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--show-progress";
    readonly description: "Display progress bars during upload operations";
    readonly default: false;
} | {
    readonly alias: "-f, --file-path <filePath>";
    readonly description: "File to upload";
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--ignore-approvals";
    readonly description: "Ignore all credit share approvals, only use signing wallet's balance";
    readonly default: false;
} | {
    readonly alias: "--use-signer-balance-first";
    readonly description: "Use the signer balance first before using credit share approvals";
    readonly default: false;
} | {
    readonly alias: "--max-chunk-concurrency <maxChunkConcurrency>";
    readonly description: "Maximum number of concurrent chunks to upload per file";
} | {
    readonly alias: "--max-finalize-ms <maxFinalizeMs>";
    readonly description: "Maximum time in milliseconds to wait for the finalization of all chunks after the last chunk is uploaded. Defaults to 1 minute per GiB of the total file size.";
} | {
    readonly alias: "--chunk-byte-count <chunkByteCount>";
    readonly description: "Size of each chunk in bytes";
} | {
    readonly alias: "--chunking-mode <chunkingMode>";
    readonly description: "Chunking mode to use for the upload. Can be \"auto\", \"force\" or \"disabled\". Defaults to \"auto\".";
    readonly default: "auto";
} | {
    readonly alias: "--on-demand";
    readonly description: "Enable on-demand crypto top-ups during upload if balance is insufficient";
    readonly default: false;
} | {
    readonly alias: "--x402";
    readonly description: "Pay for the action using x402 funding (if available). Requires token `base-usdc`.";
    readonly default: false;
} | {
    readonly alias: "--top-up-buffer-multiplier <topUpBufferMultiplier>";
    readonly description: "Multiplier to apply to the estimated top-up amount to avoid underpayment during on-demand top-ups. Defaults to 1.1 (10% buffer).";
} | {
    readonly alias: "--max-crypto-top-up-value <maxCryptoTopUpValue>";
    readonly description: "Maximum crypto top-up value to use for the upload. Defaults to no limit.";
})[];
export declare const shareCreditsOptions: ({
    readonly alias: "-a, --address <nativeAddress>";
    readonly description: "Native address to use for action";
} | {
    readonly alias: "-v, --value <value>";
    readonly description: "Value of fiat currency or crypto token for action. e.g: 10.50 for $10.50 USD or 0.0001 for 0.0001 AR";
} | {
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--expires-by-seconds <expiresBySeconds>";
    readonly description: "Expiration time in seconds";
})[];
export declare const revokeCreditsOptions: ({
    readonly alias: "-a, --address <nativeAddress>";
    readonly description: "Native address to use for action";
} | {
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
})[];
export declare const listSharesOptions: ({
    readonly alias: "-a, --address <nativeAddress>";
    readonly description: "Native address to use for action";
} | {
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
})[];
export declare const arnsPriceOptions: ({
    readonly alias: "--name <name>";
    readonly description: "ArNS name to price, buy, or manage";
} | {
    readonly alias: "--type <type>";
    readonly description: "ArNS purchase type for Buy-Name: 'lease' or 'permabuy'";
} | {
    readonly alias: "--years <years>";
    readonly description: "Lease duration in years (Buy-Name lease / Extend-Lease)";
} | {
    readonly alias: "--increase-qty <qty>";
    readonly description: "Number of additional undernames (Increase-Undername-Limit)";
})[];
export declare const arnsFiatQuoteOptions: ({
    readonly alias: "-c, --currency <currency>";
    readonly description: "Fiat currency type to use for the action";
    readonly default: "usd";
} | {
    readonly alias: "-a, --address <nativeAddress>";
    readonly description: "Native address to use for action";
} | {
    readonly alias: "--name <name>";
    readonly description: "ArNS name to price, buy, or manage";
} | {
    readonly alias: "--type <type>";
    readonly description: "ArNS purchase type for Buy-Name: 'lease' or 'permabuy'";
} | {
    readonly alias: "--years <years>";
    readonly description: "Lease duration in years (Buy-Name lease / Extend-Lease)";
} | {
    readonly alias: "--increase-qty <qty>";
    readonly description: "Number of additional undernames (Increase-Undername-Limit)";
} | {
    alias: string;
    description: string;
})[];
export declare const buyArNSNameOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--name <name>";
    readonly description: "ArNS name to price, buy, or manage";
} | {
    readonly alias: "--type <type>";
    readonly description: "ArNS purchase type for Buy-Name: 'lease' or 'permabuy'";
} | {
    readonly alias: "--years <years>";
    readonly description: "Lease duration in years (Buy-Name lease / Extend-Lease)";
} | {
    readonly alias: "--owner-key <base58SolanaSecretKey>";
    readonly description: "Base58 Solana secret key that OWNS the ANT and signs for it. Separate from the wallet paying in Turbo Credits — the owner needs a key to sign with, not SOL: Turbo pays every fee and rent";
})[];
export declare const extendArNSLeaseOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--name <name>";
    readonly description: "ArNS name to price, buy, or manage";
} | {
    readonly alias: "--years <years>";
    readonly description: "Lease duration in years (Buy-Name lease / Extend-Lease)";
})[];
export declare const increaseArNSUndernamesOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--name <name>";
    readonly description: "ArNS name to price, buy, or manage";
} | {
    readonly alias: "--increase-qty <qty>";
    readonly description: "Number of additional undernames (Increase-Undername-Limit)";
})[];
export declare const upgradeArNSNameOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--paid-by <paidBy...>";
    readonly description: "Address to pay for the upload";
    readonly type: "array";
} | {
    readonly alias: "--name <name>";
    readonly description: "ArNS name to price, buy, or manage";
})[];
export declare const arnsPurchaseStatusOptions: {
    readonly alias: "--nonce <nonce>";
    readonly description: "ArNS purchase nonce to look up the status for";
}[];
export declare const transferArNSAntOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--owner-key <base58SolanaSecretKey>";
    readonly description: "Base58 Solana secret key that OWNS the ANT and signs for it. Separate from the wallet paying in Turbo Credits — the owner needs a key to sign with, not SOL: Turbo pays every fee and rent";
} | {
    readonly alias: "--ant-id <antId>";
    readonly description: "ANT (Metaplex Core asset) ID to transfer or manage";
} | {
    readonly alias: "--target <address>";
    readonly description: "Target Solana pubkey to transfer the ANT to";
})[];
export declare const setArNSRecordOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--owner-key <base58SolanaSecretKey>";
    readonly description: "Base58 Solana secret key that OWNS the ANT and signs for it. Separate from the wallet paying in Turbo Credits — the owner needs a key to sign with, not SOL: Turbo pays every fee and rent";
} | {
    readonly alias: "--ant-id <antId>";
    readonly description: "ANT (Metaplex Core asset) ID to transfer or manage";
} | {
    readonly alias: "--undername <undername>";
    readonly description: "ArNS undername record to set or remove (defaults to '@')";
} | {
    readonly alias: "--transaction-id <transactionId>";
    readonly description: "Arweave transaction ID the ArNS record resolves to";
} | {
    readonly alias: "--ttl-seconds <ttlSeconds>";
    readonly description: "TTL in seconds for the ArNS record";
})[];
export declare const removeArNSRecordOptions: ({
    readonly alias: "-w, --wallet-file <filePath>";
    readonly description: "Wallet file to use with the action. Formats accepted: JWK.json, KYVE or ETH private key as a string, or SOL Secret Key as a Uint8Array";
} | {
    readonly alias: "-m, --mnemonic <phrase>";
    readonly description: "Mnemonic to use with the action";
} | {
    readonly alias: "-p, --private-key <key>";
    readonly description: "Private key to use with the action";
} | {
    readonly alias: "--owner-key <base58SolanaSecretKey>";
    readonly description: "Base58 Solana secret key that OWNS the ANT and signs for it. Separate from the wallet paying in Turbo Credits — the owner needs a key to sign with, not SOL: Turbo pays every fee and rent";
} | {
    readonly alias: "--ant-id <antId>";
    readonly description: "ANT (Metaplex Core asset) ID to transfer or manage";
} | {
    readonly alias: "--undername <undername>";
    readonly description: "ArNS undername record to set or remove (defaults to '@')";
})[];
//# sourceMappingURL=options.d.ts.map