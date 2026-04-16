"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TurboAuthenticatedBaseUploadService = exports.TurboUnauthenticatedUploadService = exports.defaultUploadServiceURL = exports.developmentUploadServiceURL = exports.creditSharingTagNames = void 0;
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
const plimit_lit_1 = require("plimit-lit");
const types_js_1 = require("../types.js");
const common_js_1 = require("../utils/common.js");
const errors_js_1 = require("../utils/errors.js");
const errors_js_2 = require("../utils/errors.js");
const chunked_js_1 = require("./chunked.js");
const events_js_1 = require("./events.js");
const http_js_1 = require("./http.js");
const http_js_2 = require("./http.js");
const index_js_1 = require("./index.js");
const logger_js_1 = require("./logger.js");
const signer_js_1 = require("./signer.js");
function isTurboUploadFileWithStreamFactoryParams(params) {
    return 'fileStreamFactory' in params;
}
function isTurboUploadFileWithFileOrPathParams(params) {
    return 'file' in params;
}
exports.creditSharingTagNames = {
    shareCredits: 'x-approve-payment',
    sharedWincAmount: 'x-amount',
    approvalExpiresBySeconds: 'x-expires-seconds',
    revokeCredits: 'x-delete-payment-approval',
};
exports.developmentUploadServiceURL = 'https://upload.ardrive.dev';
exports.defaultUploadServiceURL = 'https://upload.ardrive.io';
class TurboUnauthenticatedUploadService {
    constructor({ url = exports.defaultUploadServiceURL, logger = logger_js_1.Logger.default, retryConfig = (0, http_js_1.defaultRetryConfig)(logger), token = 'arweave', }) {
        this.x402EnabledTokens = ['base-usdc'];
        this.token = token;
        this.logger = logger;
        this.httpService = new http_js_2.TurboHTTPService({
            url: `${url}/v1`,
            retryConfig,
            logger: this.logger,
        });
        this.retryConfig = retryConfig;
    }
    async uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, dataItemOpts, signal, events = {}, x402Options, }) {
        const dataItemSize = dataItemSizeFactory();
        this.logger.debug('Uploading signed data item...');
        // create the tapped stream with events
        const emitter = new events_js_1.TurboEventEmitter(events);
        // create the stream with upload events
        const { stream: streamWithUploadEvents, resume } = (0, events_js_1.createStreamWithUploadEvents)({
            data: dataItemStreamFactory(),
            dataSize: dataItemSize,
            emitter,
        });
        const headers = {
            'content-type': 'application/octet-stream',
            'content-length': `${dataItemSize}`,
        };
        if (dataItemOpts !== undefined && dataItemOpts.paidBy !== undefined) {
            const paidBy = Array.isArray(dataItemOpts.paidBy)
                ? dataItemOpts.paidBy
                : [dataItemOpts.paidBy];
            // TODO: these should be comma separated values vs. an array of headers
            if (dataItemOpts.paidBy.length > 0) {
                headers['x-paid-by'] = paidBy;
            }
        }
        // setup the post request using the stream with upload events
        const postPromise = this.httpService.post({
            endpoint: `/tx/${this.token}`,
            signal,
            data: streamWithUploadEvents,
            headers,
            x402Options,
        });
        // resume the stream so events start flowing to the post
        resume();
        return postPromise;
    }
    async uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, signer, }) {
        if (!this.x402EnabledTokens.includes(this.token)) {
            throw new Error('x402 uploads are not supported for token: ' + this.token);
        }
        this.logger.debug('Uploading raw x402 data...', {
            maxMUSDCAmount: maxMUSDCAmount?.toString(),
        });
        let dataBuffer;
        if (Buffer.isBuffer(data)) {
            dataBuffer = data;
        }
        else if (typeof data === 'string' || data instanceof Uint8Array) {
            dataBuffer = Buffer.from(data);
        }
        else if ((0, common_js_1.isBlob)(data)) {
            dataBuffer = Buffer.from(await data.arrayBuffer());
        }
        else if (data instanceof ArrayBuffer) {
            dataBuffer = Buffer.from(data);
        }
        else {
            throw new TypeError('Invalid data type for x402 upload');
        }
        const x402Options = signer === undefined
            ? undefined
            : {
                signer: await (0, signer_js_1.makeX402Signer)(signer.signer),
                maxMUSDCAmount,
                unsignedData: true,
            };
        return this.httpService.post({
            data: dataBuffer,
            endpoint: '/x402/data-item/unsigned',
            signal,
            headers: tags !== undefined
                ? { 'x-data-item-tags': JSON.stringify(tags) }
                : undefined,
            x402Options,
        });
    }
}
exports.TurboUnauthenticatedUploadService = TurboUnauthenticatedUploadService;
// NOTE: to avoid redundancy, we use inheritance here - but generally prefer composition over inheritance
class TurboAuthenticatedBaseUploadService extends TurboUnauthenticatedUploadService {
    constructor({ url = exports.defaultUploadServiceURL, retryConfig, signer, logger, token, paymentService, }) {
        super({ url, retryConfig, logger, token });
        this.enabledOnDemandTokens = [
            'ario',
            'solana',
            'base-eth',
            'base-usdc',
            'base-ario',
        ];
        this.signer = signer;
        this.paymentService = paymentService;
    }
    /**
     * Signs and uploads raw data to the Turbo Upload Service.
     */
    upload({ data, dataItemOpts, signal, events, chunkByteCount, chunkingMode, maxChunkConcurrency, fundingMode, maxFinalizeMs, }) {
        // This function is intended to be usable in both Node and browser environments.
        if ((0, common_js_1.isBlob)(data)) {
            const streamFactory = () => data.stream();
            const sizeFactory = () => data.size;
            return this.uploadFile({
                fileStreamFactory: streamFactory,
                fileSizeFactory: sizeFactory,
                signal,
                dataItemOpts,
                events,
                chunkByteCount,
                chunkingMode,
                maxChunkConcurrency,
                fundingMode,
                maxFinalizeMs,
            });
        }
        const dataBuffer = (() => {
            if (Buffer.isBuffer(data))
                return data;
            // Need type narrowing to ensure the correct Buffer.from overload is used
            if (typeof data === 'string' || data instanceof Uint8Array) {
                return Buffer.from(data);
            }
            return Buffer.from(data); // Only other option is ArrayBuffer
        })();
        return this.uploadFile({
            fileStreamFactory: () => dataBuffer,
            fileSizeFactory: () => dataBuffer.byteLength,
            signal,
            dataItemOpts,
            events,
            chunkByteCount,
            chunkingMode,
            maxChunkConcurrency,
            fundingMode,
            maxFinalizeMs,
        });
    }
    resolveUploadFileConfig(params) {
        let fileStreamFactory;
        let fileSizeFactory;
        if (isTurboUploadFileWithStreamFactoryParams(params)) {
            fileStreamFactory = params.fileStreamFactory;
            fileSizeFactory = params.fileSizeFactory;
        }
        else if (isTurboUploadFileWithFileOrPathParams(params)) {
            const file = params.file;
            /**
             * this is pretty gross, but it's the only way to get the type inference to work without overhauling
             * the abstract method to accept a generic, which we would need to perform a check on anyways.
             */
            fileStreamFactory =
                file instanceof File
                    ? () => this.getFileStreamForFile(file)
                    : () => this.getFileStreamForFile(file);
            fileSizeFactory = () => this.getFileSize(params.file);
        }
        else {
            throw new TypeError('Invalid upload file params. Must be either TurboUploadFileWithStreamFactoryParams or TurboUploadFileWithFileOrPathParams');
        }
        return {
            fileStreamFactory,
            fileSizeFactory,
            ...params,
        };
    }
    async uploadFile(params) {
        const { signal, dataItemOpts, events, fileStreamFactory, fileSizeFactory, fundingMode = new types_js_1.ExistingBalanceFunding(), } = this.resolveUploadFileConfig(params);
        if (fundingMode instanceof types_js_1.X402Funding &&
            !this.x402EnabledTokens.includes(this.token)) {
            throw new Error('x402 uploads are not supported for token: ' + this.token);
        }
        if (params.chunkingMode === 'force' && fundingMode instanceof types_js_1.X402Funding) {
            throw new Error("Chunking mode 'force' is not supported when x402 is enabled");
        }
        this.logger.debug('Starting file upload', { params });
        let retries = 0;
        const maxRetries = this.retryConfig.retries ?? 3;
        const retryDelay = this.retryConfig.retryDelay ??
            ((retryNumber) => retryNumber * 1000);
        let lastError = undefined; // Store the last error for throwing
        let lastStatusCode = undefined; // Store the last status code for throwing
        const emitter = new events_js_1.TurboEventEmitter(events);
        // avoid duplicating signing on failures here - these errors will immediately be thrown
        let cryptoFundResult;
        // TODO: move the retry implementation to the http class, and avoid awaiting here. This will standardize the retry logic across all upload methods.
        while (retries < maxRetries) {
            if (signal?.aborted) {
                throw new errors_js_1.AbortError();
            }
            // TODO: create a SigningError class and throw that instead of the generic Error
            const { dataItemStreamFactory, dataItemSizeFactory } = await this.signer.signDataItem({
                fileStreamFactory,
                fileSizeFactory,
                dataItemOpts,
                emitter,
            });
            if (fundingMode instanceof types_js_1.OnDemandFunding &&
                cryptoFundResult === undefined) {
                const totalByteCount = dataItemSizeFactory();
                cryptoFundResult = await this.onDemand({
                    totalByteCount,
                    onDemandFunding: fundingMode,
                });
            }
            // Now that we have the signed data item, we can upload it using the uploadSignedDataItem method
            // which will create a new emitter with upload events. We await
            // this result due to the wrapped retry logic of this method.
            try {
                const { chunkByteCount, maxChunkConcurrency } = params;
                const chunkedUploader = new chunked_js_1.ChunkedUploader({
                    http: this.httpService,
                    token: this.token,
                    maxChunkConcurrency,
                    chunkByteCount,
                    logger: this.logger,
                    dataItemByteCount: dataItemSizeFactory(),
                    chunkingMode: params.chunkingMode,
                    maxFinalizeMs: params.maxFinalizeMs,
                });
                if (chunkedUploader.shouldUseChunkUploader &&
                    !(fundingMode instanceof types_js_1.X402Funding)) {
                    const response = await chunkedUploader.upload({
                        dataItemStreamFactory,
                        dataItemSizeFactory,
                        dataItemOpts,
                        signal,
                        events,
                    });
                    return { ...response, cryptoFundResult };
                }
                const x402Options = fundingMode instanceof types_js_1.X402Funding
                    ? {
                        signer: fundingMode.signer ??
                            (await (0, signer_js_1.makeX402Signer)(this.signer.signer)),
                        maxMUSDCAmount: fundingMode.maxMUSDCAmount,
                    }
                    : undefined;
                const response = await this.uploadSignedDataItem({
                    dataItemStreamFactory,
                    dataItemSizeFactory,
                    dataItemOpts,
                    signal,
                    events,
                    x402Options,
                });
                return { ...response, cryptoFundResult };
            }
            catch (error) {
                // Store the last encountered error and status for re-throwing after retries
                lastError = error;
                if (error instanceof errors_js_2.FailedRequestError) {
                    lastStatusCode = error.status;
                }
                else {
                    lastStatusCode = error.response?.status;
                }
                if (lastStatusCode !== undefined &&
                    lastStatusCode >= 400 &&
                    lastStatusCode < 500) {
                    // Don't retry client error codes
                    break;
                }
                this.logger.debug(`Upload failed on attempt ${retries + 1}/${maxRetries + 1}`, { message: error instanceof Error ? error.message : error }, error);
                retries++;
                const abortEventPromise = new Promise((resolve) => {
                    signal?.addEventListener('abort', () => {
                        resolve();
                    });
                });
                await Promise.race([(0, common_js_1.sleep)(retryDelay(retries)), abortEventPromise]);
            }
        }
        const msg = `Failed to upload file after ${retries + 1} attempts\n${lastError instanceof Error ? lastError.message : lastError}`;
        // After all retries, throw the last error for catching
        if (lastError instanceof errors_js_2.FailedRequestError) {
            lastError.message = msg;
            throw lastError;
        }
        throw new errors_js_2.FailedRequestError(msg, lastStatusCode);
    }
    async generateManifest({ paths, indexFile, fallbackFile, }) {
        const indexPath = 
        // Use the user provided index file if it exists,
        indexFile !== undefined && paths[indexFile]?.id !== undefined
            ? indexFile
            : // Else use index.html if it exists,
                paths['index.html']?.id !== undefined
                    ? 'index.html'
                    : // Else use the first file in the paths object.
                        Object.keys(paths)[0];
        const fallbackId = 
        // Use the user provided fallback file if it exists,
        fallbackFile !== undefined && paths[fallbackFile]?.id !== undefined
            ? paths[fallbackFile].id
            : // Else use 404.html if it exists, else use the index path.
                paths['404.html']?.id ?? paths[indexPath].id;
        const manifest = {
            manifest: 'arweave/paths',
            version: '0.2.0',
            index: { path: indexPath },
            paths,
            fallback: { id: fallbackId },
        };
        return manifest;
    }
    getContentType(file, dataItemOpts) {
        const userDefinedContentType = dataItemOpts?.tags?.find((tag) => tag.name === 'Content-Type')?.value;
        if (userDefinedContentType !== undefined) {
            return userDefinedContentType;
        }
        return this.contentTypeFromFile(file);
    }
    async uploadFolder(params) {
        this.logger.debug('Uploading folder...', { params });
        const { dataItemOpts, signal, manifestOptions = {}, maxConcurrentUploads = 1, throwOnFailure = true, maxChunkConcurrency, chunkByteCount, chunkingMode, fundingMode = new types_js_1.ExistingBalanceFunding(), maxFinalizeMs, events = {}, } = params;
        const { disableManifest, indexFile, fallbackFile } = manifestOptions;
        // Create event emitter from events parameter
        const emitter = new events_js_1.TurboEventEmitter(events);
        const paths = {};
        const response = {
            fileResponses: [],
        };
        const errors = [];
        // Get files and calculate total bytes upfront for progress tracking
        const files = await this.getFiles(params);
        const totalFiles = files.length;
        let totalBytes = 0;
        const fileSizes = new Map();
        files.forEach((file) => {
            const size = this.getFileSize(file);
            fileSizes.set(file, size);
            totalBytes += size;
        });
        // Track progress across all files
        let processedFiles = 0;
        let processedBytes = 0;
        const uploadFile = async (file, fileIndex) => {
            const fileName = this.getFileName(file);
            const fileSize = fileSizes.get(file) ?? 0;
            // Emit file-upload-start event
            emitter.emit('file-upload-start', {
                fileName,
                fileSize,
                fileIndex,
                totalFiles,
            });
            const contentType = this.getContentType(file, dataItemOpts);
            const dataItemOptsWithContentType = {
                ...dataItemOpts,
                tags: [
                    ...(dataItemOpts?.tags?.filter((tag) => tag.name !== 'Content-Type') ?? []),
                    { name: 'Content-Type', value: contentType },
                ],
            };
            try {
                const result = await this.uploadFile({
                    // TODO: can fix this type by passing a class generic and specifying in the node/web abstracts which stream type to use
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    fileStreamFactory: () => this.getFileStreamForFile(file),
                    fileSizeFactory: () => fileSize,
                    signal,
                    dataItemOpts: dataItemOptsWithContentType,
                    chunkByteCount,
                    maxChunkConcurrency,
                    chunkingMode,
                    events: {
                        onProgress: (event) => {
                            // Bridge individual file progress to folder events
                            emitter.emit('file-upload-progress', {
                                fileName,
                                fileIndex,
                                totalFiles,
                                fileProcessedBytes: event.processedBytes,
                                fileTotalBytes: event.totalBytes,
                                step: event.step,
                            });
                            // Update folder progress
                            const currentFileProgress = event.processedBytes;
                            emitter.emit('folder-progress', {
                                processedFiles,
                                totalFiles,
                                processedBytes: processedBytes + currentFileProgress,
                                totalBytes,
                                currentPhase: 'files',
                            });
                        },
                        onError: (error) => {
                            emitter.emit('file-upload-error', {
                                fileName,
                                fileIndex,
                                totalFiles,
                                error,
                            });
                        },
                    },
                    fundingMode,
                });
                const relativePath = this.getRelativePath(file, params);
                paths[relativePath] = { id: result.id };
                response.fileResponses.push(result);
                // Update processed counts after file completes
                processedFiles++;
                processedBytes += fileSize;
                // Emit file-upload-complete event
                emitter.emit('file-upload-complete', {
                    fileName,
                    fileIndex,
                    totalFiles,
                    id: result.id,
                });
                // Emit folder progress after file completes
                emitter.emit('folder-progress', {
                    processedFiles,
                    totalFiles,
                    processedBytes,
                    totalBytes,
                    currentPhase: 'files',
                });
            }
            catch (error) {
                emitter.emit('file-upload-error', {
                    fileName,
                    fileIndex,
                    totalFiles,
                    error,
                });
                if (throwOnFailure) {
                    emitter.emit('folder-error', error);
                    throw error;
                }
                this.logger.error(`Error uploading file: ${file}`, error);
                errors.push(error);
            }
        };
        const limit = (0, plimit_lit_1.pLimit)(maxConcurrentUploads);
        let cryptoFundResult;
        if (fundingMode instanceof types_js_1.OnDemandFunding) {
            const totalByteCount = files.reduce((acc, file) => {
                return acc + this.getFileSize(file) + 1200; // allow extra per file for ANS-104 headers
            }, 0);
            cryptoFundResult = await this.onDemand({
                totalByteCount,
                onDemandFunding: fundingMode,
            });
        }
        await Promise.all(files.map((file, index) => limit(() => uploadFile(file, index))));
        this.logger.debug('Finished uploading files', {
            numFiles: files.length,
            numErrors: errors.length,
            results: response.fileResponses,
        });
        if (errors.length > 0) {
            response.errors = errors;
        }
        if (disableManifest) {
            emitter.emit('folder-success');
            return response;
        }
        // Emit folder progress for manifest phase
        emitter.emit('folder-progress', {
            processedFiles,
            totalFiles,
            processedBytes,
            totalBytes,
            currentPhase: 'manifest',
        });
        const manifest = await this.generateManifest({
            paths,
            indexFile,
            fallbackFile,
        });
        const tagsWithManifestContentType = [
            ...(dataItemOpts?.tags?.filter((tag) => tag.name !== 'Content-Type') ??
                []),
            { name: 'Content-Type', value: 'application/x.arweave-manifest+json' },
        ];
        const manifestBuffer = Buffer.from(JSON.stringify(manifest));
        const manifestResponse = await this.uploadFile({
            // TODO: can fix this type by passing a class generic and specifying in the node/web abstracts which stream type to use
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            fileStreamFactory: () => this.createManifestStream(manifestBuffer),
            fileSizeFactory: () => manifestBuffer.byteLength,
            signal,
            dataItemOpts: { ...dataItemOpts, tags: tagsWithManifestContentType },
            chunkByteCount,
            maxChunkConcurrency,
            maxFinalizeMs,
            chunkingMode,
            fundingMode,
        });
        emitter.emit('folder-success');
        return {
            ...response,
            manifest,
            manifestResponse,
            cryptoFundResult,
        };
    }
    async shareCredits({ approvedAddress, approvedWincAmount, expiresBySeconds, }) {
        const dataItemOpts = {
            tags: [
                {
                    name: exports.creditSharingTagNames.shareCredits,
                    value: approvedAddress,
                },
                {
                    name: exports.creditSharingTagNames.sharedWincAmount,
                    value: approvedWincAmount.toString(),
                },
            ],
        };
        if (expiresBySeconds !== undefined) {
            dataItemOpts.tags.push({
                name: exports.creditSharingTagNames.approvalExpiresBySeconds,
                value: expiresBySeconds.toString(),
            });
        }
        const nonceData = Buffer.from(approvedAddress + approvedWincAmount + Date.now());
        const { createdApproval, ...uploadResponse } = await this.uploadFile({
            fileStreamFactory: () => nonceData,
            fileSizeFactory: () => nonceData.byteLength,
            dataItemOpts,
        });
        if (!createdApproval) {
            throw new Error('Failed to create credit share approval but upload has succeeded\n' +
                JSON.stringify(uploadResponse));
        }
        return createdApproval;
    }
    async revokeCredits({ revokedAddress, }) {
        const dataItemOpts = {
            tags: [
                {
                    name: exports.creditSharingTagNames.revokeCredits,
                    value: revokedAddress,
                },
            ],
        };
        const nonceData = Buffer.from(revokedAddress + Date.now());
        const { revokedApprovals, ...uploadResponse } = await this.uploadFile({
            fileStreamFactory: () => nonceData,
            fileSizeFactory: () => nonceData.byteLength,
            dataItemOpts,
        });
        if (!revokedApprovals) {
            throw new Error('Failed to revoke credit share approvals but upload has succeeded\n' +
                JSON.stringify(uploadResponse));
        }
        return revokedApprovals;
    }
    /**
     * Triggers an upload that will top-up the wallet with Credits for the amount before uploading.
     * First, it calculates the expected cost of the upload. Next, it checks the wallet for existing
     * balance. If the balance is insufficient, it will attempt the top-up with the wallet in the specified `token`
     * and await for the balance to be credited.
     * Note: Only `ario`, `solana`, and `base-eth` tokens are currently supported for on-demand uploads.
     */
    async onDemand({ totalByteCount, onDemandFunding, }) {
        const { maxTokenAmount, topUpBufferMultiplier } = onDemandFunding;
        const currentBalance = await this.paymentService.getBalance();
        const wincPriceForOneGiB = (await this.paymentService.getUploadCosts({
            bytes: [2 ** 30],
        }))[0].winc;
        const expectedWincPrice = new bignumber_js_1.BigNumber(wincPriceForOneGiB)
            .multipliedBy(totalByteCount)
            .dividedBy(2 ** 30)
            .toFixed(0, bignumber_js_1.BigNumber.ROUND_UP);
        if ((0, bignumber_js_1.BigNumber)(currentBalance.effectiveBalance).isGreaterThanOrEqualTo(expectedWincPrice)) {
            this.logger.debug('Sufficient balance for on demand upload', {
                currentBalance,
                expectedWincPrice,
            });
            return undefined;
        }
        this.logger.debug('Insufficient balance for on demand upload', {
            currentBalance,
            expectedWincPrice,
        });
        if (!this.enabledOnDemandTokens.includes(this.token)) {
            throw new Error(`On-demand uploads are not supported for token: ${this.token}`);
        }
        const topUpWincAmount = (0, bignumber_js_1.BigNumber)(expectedWincPrice)
            .minus(currentBalance.effectiveBalance)
            .multipliedBy(topUpBufferMultiplier) // add buffer to avoid underpayment
            .toFixed(0, bignumber_js_1.BigNumber.ROUND_UP);
        const wincPriceForOneToken = (await this.paymentService.getWincForToken({
            tokenAmount: index_js_1.tokenToBaseMap[this.token](1),
        })).winc;
        const topUpTokenAmount = new bignumber_js_1.BigNumber(topUpWincAmount)
            .dividedBy(wincPriceForOneToken)
            .multipliedBy(index_js_1.tokenToBaseMap[this.token](1))
            .toFixed(0, bignumber_js_1.BigNumber.ROUND_UP);
        if (maxTokenAmount !== undefined) {
            if (new bignumber_js_1.BigNumber(topUpTokenAmount).isGreaterThan(maxTokenAmount)) {
                throw new Error(`Top up token amount ${new bignumber_js_1.BigNumber(topUpTokenAmount).div(index_js_1.exponentMap[this.token])} is greater than the maximum allowed amount of ${maxTokenAmount}`);
            }
        }
        this.logger.debug(`Topping up wallet with ${topUpTokenAmount} ${this.token} for ${topUpWincAmount} winc`);
        const topUpResponse = await this.paymentService.topUpWithTokens({
            tokenAmount: topUpTokenAmount,
        });
        this.logger.debug('Top up transaction submitted', { topUpResponse });
        const pollingOptions = {
            pollIntervalMs: 3 * 1000, // poll every 3 seconds
            timeoutMs: 120 * 1000, // wait up to 2 minutes
        };
        let tries = 1;
        const maxTries = Math.ceil(pollingOptions.timeoutMs / pollingOptions.pollIntervalMs) - 1; // -1 because we already tried once with the initial request
        while (topUpResponse.status !== 'confirmed' && tries < maxTries) {
            this.logger.debug('Tx not yet confirmed, waiting to poll again', {
                tries,
                maxTries,
            });
            await (0, common_js_1.sleep)(pollingOptions.pollIntervalMs);
            tries++;
            try {
                const submitFundResult = await this.paymentService.submitFundTransaction({
                    txId: topUpResponse.id,
                });
                if (submitFundResult.status === 'confirmed') {
                    this.logger.debug('Top-up transaction confirmed and balance updated', { submitFundResult });
                    topUpResponse.status = 'confirmed';
                    break;
                }
            }
            catch (error) {
                this.logger.warn('Error fetching fund transaction during polling', {
                    message: error instanceof Error ? error.message : error,
                });
            }
        }
        if (tries >= maxTries) {
            this.logger.warn('Timed out waiting for fund tx to confirm after top-up. Will continue to attempt upload but it may fail if balance is insufficient.');
        }
        return topUpResponse;
    }
    async uploadRawX402Data({ data, tags, signal, maxMUSDCAmount, }) {
        return super.uploadRawX402Data({
            data,
            tags,
            signal,
            maxMUSDCAmount,
            signer: this.signer,
        });
    }
}
exports.TurboAuthenticatedBaseUploadService = TurboAuthenticatedBaseUploadService;
