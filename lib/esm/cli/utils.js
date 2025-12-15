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
import bs58 from 'bs58';
import { readFileSync, statSync } from 'fs';
import { ExistingBalanceFunding, OnDemandFunding, TurboFactory, X402Funding, defaultTurboConfiguration, developmentTurboConfiguration, fiatCurrencyTypes, isCurrency, isTokenType, privateKeyFromKyveMnemonic, tokenToBaseMap, } from '../node/index.js';
import { defaultProdAoConfigs, tokenToDevAoConfigMap, tokenToDevGatewayMap, } from '../utils/common.js';
import { NoWalletProvidedError } from './errors.js';
export function exitWithErrorLog(error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
}
export async function runCommand(command, action) {
    const options = command.optsWithGlobals();
    try {
        await action(options);
        process.exit(0);
    }
    catch (error) {
        exitWithErrorLog(error);
    }
}
export function applyOptions(command, options) {
    [...options].forEach((option) => {
        command.option(option.alias, option.description, option.default);
    });
    return command;
}
export function tokenFromOptions(options) {
    const token = options.token;
    if (token === undefined) {
        throw new Error('Token type required');
    }
    if (!isTokenType(token)) {
        throw new Error('Invalid token type');
    }
    return token;
}
export function valueFromOptions(options) {
    const value = options.value;
    if (value === undefined) {
        throw new Error('Value is required. Use --value <value>');
    }
    return value;
}
export function getFolderPathFromOptions(options) {
    const folderPath = options.folderPath;
    if (folderPath === undefined) {
        throw new Error('Folder path is required. Use --folderPath <path>');
    }
    // Check if path exists and is a directory
    const stats = statSync(folderPath);
    if (!stats.isDirectory()) {
        throw new Error('Folder path is not a directory');
    }
    return folderPath;
}
export async function addressOrPrivateKeyFromOptions(options) {
    if (options.address !== undefined) {
        return { address: options.address, privateKey: undefined };
    }
    return {
        address: undefined,
        privateKey: await optionalPrivateKeyFromOptions(options),
    };
}
export async function optionalPrivateKeyFromOptions(options) {
    try {
        const key = await privateKeyFromOptions(options);
        return key;
    }
    catch (error) {
        if (error instanceof NoWalletProvidedError) {
            return undefined;
        }
        throw error;
    }
}
export async function privateKeyFromOptions({ mnemonic, privateKey, walletFile, token, }) {
    if (mnemonic !== undefined) {
        if (token === 'kyve') {
            return privateKeyFromKyveMnemonic(mnemonic);
        }
        else {
            // TODO: Implement other token types mnemonic to wallet
            throw new Error('mnemonic provided but this token type mnemonic to wallet is not supported');
        }
    }
    else if (walletFile !== undefined) {
        const wallet = JSON.parse(readFileSync(walletFile, 'utf-8'));
        return token === 'solana' ? bs58.encode(wallet) : wallet;
    }
    else if (privateKey !== undefined) {
        return privateKey;
    }
    // TODO: Get TURBO_WALLET_FILE, TURBO_MNEMONIC, TURBO_PRIVATE_KEY or similar from ENV variables
    // TODO: Add prompts for selecting wallet type and secure input
    throw new NoWalletProvidedError();
}
export function configFromOptions(options) {
    const token = tokenFromOptions(options);
    let paymentUrl = undefined;
    let uploadUrl = undefined;
    let gatewayUrl = undefined;
    let processId = undefined;
    let cuUrl = undefined;
    if (options.local && options.dev) {
        throw new Error('Cannot use both --local and --dev flags');
    }
    if (options.dev) {
        // Use development endpoints
        paymentUrl = developmentTurboConfiguration.paymentServiceConfig.url;
        uploadUrl = developmentTurboConfiguration.uploadServiceConfig.url;
        gatewayUrl = tokenToDevGatewayMap[token];
        if (options.token === 'ario') {
            processId = tokenToDevAoConfigMap[token].processId;
            cuUrl = tokenToDevAoConfigMap[token].cuUrl;
        }
    }
    else if (options.local) {
        // Use local endpoints
        paymentUrl = 'http://localhost:4000';
        uploadUrl = 'http://localhost:3000';
        gatewayUrl = 'http://localhost:1984';
    }
    else {
        // Use default endpoints
        paymentUrl = defaultTurboConfiguration.paymentServiceConfig.url;
        uploadUrl = defaultTurboConfiguration.uploadServiceConfig.url;
        if (options.token === 'ario') {
            processId = defaultProdAoConfigs[token].processId;
            cuUrl = defaultProdAoConfigs[token].cuUrl;
        }
    }
    // Override gateway, payment, and upload service default endpoints if provided
    if (options.gateway !== undefined) {
        gatewayUrl = options.gateway;
    }
    if (options.paymentUrl !== undefined) {
        paymentUrl = options.paymentUrl;
    }
    if (options.uploadUrl !== undefined) {
        uploadUrl = options.uploadUrl;
    }
    if (options.cuUrl !== undefined) {
        cuUrl = options.cuUrl;
    }
    if (options.processId !== undefined) {
        processId = options.processId;
    }
    const config = {
        paymentServiceConfig: { url: paymentUrl },
        uploadServiceConfig: { url: uploadUrl },
        gatewayUrl,
        token,
        processId,
        cuUrl,
    };
    return config;
}
export async function turboFromOptions(options) {
    const privateKey = await privateKeyFromOptions(options);
    if (options.debug) {
        TurboFactory.setLogLevel('debug');
    }
    if (options.quiet) {
        TurboFactory.setLogLevel('none');
    }
    return TurboFactory.authenticated({
        ...configFromOptions(options),
        privateKey,
    });
}
export async function paidByFromOptions({ paidBy: paidByCliInput, ignoreApprovals, useSignerBalanceFirst, }, turbo) {
    const paidBy = await (async () => {
        if (paidByCliInput !== undefined && paidByCliInput.length > 0) {
            return paidByCliInput;
        }
        if (ignoreApprovals) {
            return undefined;
        }
        const { receivedApprovals } = await turbo.getBalance();
        if (receivedApprovals !== undefined && receivedApprovals.length !== 0) {
            // get unique paying addresses from any received approvals
            return Array.from(new Set(receivedApprovals.map((approval) => approval.payingAddress)));
        }
        return undefined;
    })();
    if (paidBy !== undefined && useSignerBalanceFirst) {
        // Add the signer's address to the front of the paidBy array
        paidBy.unshift(await turbo.signer.getNativeAddress());
    }
    return paidBy;
}
export function getUploadFolderOptions(options) {
    if (options.folderPath === undefined) {
        throw new Error('--folder-path is required');
    }
    return {
        folderPath: options.folderPath,
        indexFile: options.indexFile,
        fallbackFile: options.fallbackFile,
        disableManifest: !options.manifest,
        maxConcurrentUploads: +(options.maxConcurrency ?? 1),
        ...getChunkingOptions(options),
    };
}
/**
 * Parse tags array from CLI input into Tag array
 * Accepts format: ["name1", "value1", "name2", "value2"]
 * @param tagsArr Array of alternating tag names and values
 * @returns Array of {name: string, value: string} objects
 */
export function parseTags(tagsArr) {
    if (!tagsArr || tagsArr.length === 0) {
        return [];
    }
    if (tagsArr.length % 2 !== 0) {
        throw new Error('Invalid tags format. Tags must be provided in pairs of name and value.');
    }
    const tags = [];
    const arr = [...tagsArr];
    while (arr.length) {
        const name = arr.shift();
        const value = arr.shift();
        if (name === undefined || value === undefined) {
            throw new Error('Invalid tag format. Each tag must have both a name and value.');
        }
        tags.push({ name, value });
    }
    return tags;
}
export function getTagsFromOptions(options) {
    return parseTags(options.tags);
}
export function onDemandOptionsFromOptions(options) {
    if (options.x402 && options.onDemand) {
        throw new Error('Cannot use both --x402 and --on-demand flags');
    }
    if (!options.onDemand && !options.x402) {
        return { fundingMode: new ExistingBalanceFunding() };
    }
    const value = options.maxCryptoTopUpValue;
    let maxTokenAmount = undefined;
    if (value !== undefined) {
        if (isNaN(+value) || +value <= 0) {
            throw new Error('maxTokenAmount must be a positive number');
        }
        const token = tokenFromOptions(options);
        maxTokenAmount = tokenToBaseMap[token](value).toString();
    }
    if (options.x402) {
        return {
            fundingMode: new X402Funding({ maxMUSDCAmount: maxTokenAmount }),
        };
    }
    if (options.topUpBufferMultiplier !== undefined &&
        (isNaN(options.topUpBufferMultiplier) || options.topUpBufferMultiplier < 1)) {
        throw new Error('topUpBufferMultiplier must be a number >= 1');
    }
    return {
        fundingMode: new OnDemandFunding({
            maxTokenAmount,
            topUpBufferMultiplier: options.topUpBufferMultiplier,
        }),
    };
}
export function currencyFromOptions(options) {
    const currency = options.currency?.toLowerCase();
    if (!isCurrency(currency)) {
        throw new Error(`Invalid fiat currency type ${currency}!\nPlease use one of these:\n${JSON.stringify(fiatCurrencyTypes, null, 2)}`);
    }
    return currency;
}
export function requiredByteCountFromOptions({ byteCount, }) {
    const byteCountValue = byteCount !== undefined ? +byteCount : undefined;
    if (byteCountValue === undefined ||
        isNaN(byteCountValue) ||
        !Number.isInteger(byteCountValue) ||
        byteCountValue <= 0) {
        throw new Error('Must provide a positive number for byte count.');
    }
    return byteCountValue;
}
export function getChunkingOptions(options) {
    return {
        chunkingMode: options.chunkingMode,
        chunkByteCount: options.chunkByteCount !== undefined
            ? +options.chunkByteCount
            : undefined,
        maxChunkConcurrency: options.maxChunkConcurrency !== undefined
            ? +options.maxChunkConcurrency
            : undefined,
        maxFinalizeMs: options.maxFinalizeMs !== undefined ? +options.maxFinalizeMs : undefined,
    };
}
