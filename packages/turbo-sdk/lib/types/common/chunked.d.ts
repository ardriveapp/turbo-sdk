import { Readable } from 'stream';
import { ByteCount, TurboChunkingMode, TurboLogger, TurboUploadDataItemResponse, UploadSignedDataItemParams } from '../types.js';
import { TurboHTTPService } from './http.js';
export declare const defaultMaxChunkConcurrency = 5;
export declare const maxChunkByteCount: number;
export declare const minChunkByteCount: number;
export declare const defaultChunkByteCount: number;
/**
 * Performs a chunked upload by splitting the stream into fixed-size buffers,
 * uploading them in parallel, and emitting progress/error events.
 */
export declare class ChunkedUploader {
    private chunkByteCount;
    private readonly maxChunkConcurrency;
    private readonly maxFinalizeMs;
    private readonly http;
    private readonly token;
    private readonly logger;
    readonly shouldUseChunkUploader: boolean;
    private maxBacklogQueue;
    constructor({ http, token, maxChunkConcurrency, maxFinalizeMs, chunkByteCount, logger, chunkingMode, dataItemByteCount, }: {
        maxFinalizeMs?: number;
        http: TurboHTTPService;
        token: string;
        logger: TurboLogger;
        chunkByteCount?: number;
        maxChunkConcurrency?: number;
        chunkingMode?: TurboChunkingMode;
        dataItemByteCount: ByteCount;
    });
    private shouldChunkUpload;
    private assertChunkParams;
    /**
     * Initialize or resume an upload session, returning the upload ID.
     */
    private initUpload;
    upload({ dataItemSizeFactory, dataItemStreamFactory, dataItemOpts, signal, events, }: UploadSignedDataItemParams): Promise<TurboUploadDataItemResponse>;
    private toGiB;
    private finalizeUpload;
}
/**
 * Yield Buffers of up to `chunkByteCount`, coalescing whatever small pieces
 * the source produces into proper slices.
 */
export declare function splitIntoChunks(source: Readable | ReadableStream<Uint8Array>, chunkByteCount: number): AsyncGenerator<Buffer, void, unknown>;
export declare function splitReadableIntoChunks(source: Readable, chunkByteCount: number): AsyncGenerator<Buffer, void, unknown>;
export declare function splitReadableStreamIntoChunks(source: ReadableStream<Uint8Array>, chunkByteCount: number): AsyncGenerator<Buffer, void, unknown>;
//# sourceMappingURL=chunked.d.ts.map