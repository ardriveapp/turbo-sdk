import { Readable } from 'stream';
import { ByteCount, TurboChunkingMode, TurboLogger, TurboUploadDataItemResponse, UploadSignedDataItemParams, X402RequestCredentials } from '../types.js';
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
    /**
     * The upload id of an x402 upload we have ALREADY PAID FOR.
     *
     * `uploadFile` retries a failed upload up to 6 times, and a retry re-enters
     * `upload()` on this same instance. Without this memo each retry opens a
     * NEW paid upload, so one 12 MiB upload whose finalization timed out billed
     * the customer five times over — observed, not theoretical. The payment is
     * bound to an upload id, so a retry must resume THAT upload, never buy
     * another. Deliberately not reset on failure: re-paying is never the right
     * recovery, and an upload that cannot be resumed is refunded server-side.
     */
    private paidUploadId;
    private readonly http;
    private readonly token;
    private readonly logger;
    readonly shouldUseChunkUploader: boolean;
    private maxBacklogQueue;
    private x402;
    private x402RefundIdentity;
    /**
     * The size declared at create. For x402 this is what gets PAID FOR, so it
     * must be the real serialized size — the service reconciles against the bytes
     * that actually arrive and penalises an under-declaration.
     */
    private dataItemByteCount;
    constructor({ http, token, maxChunkConcurrency, maxFinalizeMs, chunkByteCount, logger, chunkingMode, dataItemByteCount, x402, x402RefundIdentity, }: {
        maxFinalizeMs?: number;
        http: TurboHTTPService;
        token: string;
        logger: TurboLogger;
        chunkByteCount?: number;
        maxChunkConcurrency?: number;
        chunkingMode?: TurboChunkingMode;
        dataItemByteCount: ByteCount;
        /** Pay for this upload with x402 instead of Turbo Credits. */
        x402?: X402RequestCredentials;
        /**
         * The TURBO wallet credited if the upload delivers fewer bytes than were
         * paid for. Deliberately not derived from the x402 signer: the wallet that
         * PAYS in USDC and the wallet that receives Turbo Credits are allowed to
         * differ, and silently conflating them would send a refund to the wrong
         * place.
         */
        x402RefundIdentity?: {
            address: string;
            signatureType: number;
        };
    });
    private shouldChunkUpload;
    private assertChunkParams;
    /**
     * Initialize or resume an upload session, returning the upload ID.
     */
    /**
     * Open a multipart upload paid for with x402.
     *
     * The bundler settles the payment at CREATE, before accepting a single chunk
     * — so an unpaid upload never consumes storage. That is why the size is
     * declared here and the money moves here, not at finalize.
     *
     * The 402 handshake is delegated to `wrapFetchWithPayment`, the same
     * mechanism the single-shot x402 POST already uses, so the signer and the
     * spend cap behave identically on both paths.
     */
    private initPaidUpload;
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