import { TurboFolderUploadEmitterEventArgs, TurboFolderUploadEventsAndPayloads } from '../types.js';
/**
 * Progress bar manager for folder uploads in CLI
 */
export declare class FolderUploadProgress {
    private multibar?;
    private folderBar?;
    private fileBar?;
    private readonly enabled;
    private readonly isTTY;
    private totalFiles;
    private totalBytes;
    /**
     * Event handlers that can be passed directly to uploadFolder
     */
    readonly events: Required<TurboFolderUploadEmitterEventArgs>;
    constructor(enabled?: boolean);
    /**
     * Handle file upload start event
     */
    onFileStart(event: TurboFolderUploadEventsAndPayloads['file-upload-start']): void;
    /**
     * Handle file upload progress event
     */
    onFileProgress(event: TurboFolderUploadEventsAndPayloads['file-upload-progress']): void;
    /**
     * Handle file upload complete event
     */
    onFileComplete(event: TurboFolderUploadEventsAndPayloads['file-upload-complete']): void;
    /**
     * Handle file upload error event
     */
    onFileError(event: TurboFolderUploadEventsAndPayloads['file-upload-error']): void;
    /**
     * Handle folder progress event
     */
    onFolderProgress(event: TurboFolderUploadEventsAndPayloads['folder-progress']): void;
    /**
     * Handle folder error event
     */
    onFolderError(error: TurboFolderUploadEventsAndPayloads['folder-error']): void;
    /**
     * Handle folder success event
     */
    onFolderSuccess(): void;
    /**
     * Stop and clean up progress bars
     */
    stop(): void;
}
/**
 * Progress bar manager for file uploads in CLI
 */
export declare class FileUploadProgress {
    private bar?;
    private readonly enabled;
    private readonly isTTY;
    private totalBytes;
    /**
     * Event handlers that can be passed directly to uploadFile
     */
    readonly events: {
        onProgress: (event: {
            totalBytes: number;
            processedBytes: number;
        }) => void;
        onSuccess: () => void;
        onError: (error: Error) => void;
    };
    constructor(enabled?: boolean);
    /**
     * Initialize progress bar with total size
     */
    start(totalBytes: number, fileName?: string): void;
    /**
     * Update progress
     */
    update(processedBytes: number): void;
    /**
     * Mark as complete
     */
    complete(): void;
    /**
     * Handle error
     */
    error(error: Error): void;
    /**
     * Stop progress bar
     */
    stop(): void;
}
//# sourceMappingURL=progress.d.ts.map