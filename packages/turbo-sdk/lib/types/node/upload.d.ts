import { Readable } from 'stream';
import { TurboAuthenticatedBaseUploadService } from '../common/upload.js';
import { TurboAuthenticatedUploadServiceConfiguration, TurboUploadFolderParams } from '../types.js';
import { TurboAuthenticatedPaymentService } from './index.js';
export declare class TurboAuthenticatedUploadService extends TurboAuthenticatedBaseUploadService {
    constructor({ url, retryConfig, signer, logger, token, paymentService, }: TurboAuthenticatedUploadServiceConfiguration & {
        paymentService: TurboAuthenticatedPaymentService;
    });
    private getAbsoluteFilePathsFromFolder;
    getFiles(params: TurboUploadFolderParams): Promise<string[]>;
    getFileStreamForFile(file: string): Readable;
    getFileSize(file: string): number;
    getFileName(file: string): string;
    getRelativePath(file: string, params: TurboUploadFolderParams): string;
    contentTypeFromFile(file: string): string;
    createManifestStream(manifestBuffer: Buffer): Readable;
}
//# sourceMappingURL=upload.d.ts.map