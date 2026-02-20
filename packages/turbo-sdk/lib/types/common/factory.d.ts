import { GetTurboSignerParams, TurboAuthenticatedConfiguration, TurboAuthenticatedUploadServiceConfiguration, TurboAuthenticatedUploadServiceInterface, TurboUnauthenticatedConfiguration } from '../types.js';
import { LogLevel, Logger } from './logger.js';
import { TurboAuthenticatedPaymentService } from './payment.js';
import { TurboDataItemAbstractSigner } from './signer.js';
import { TurboAuthenticatedClient, TurboUnauthenticatedClient } from './turbo.js';
export declare abstract class TurboBaseFactory {
    protected static logger: Logger;
    static setLogLevel(level: LogLevel): void;
    static unauthenticated({ paymentServiceConfig, uploadServiceConfig, token, }?: TurboUnauthenticatedConfiguration): TurboUnauthenticatedClient;
    protected abstract getSigner({ providedPrivateKey, providedSigner, providedWalletAdapter, logger, token, }: GetTurboSignerParams): TurboDataItemAbstractSigner;
    protected abstract getAuthenticatedUploadService(config: TurboAuthenticatedUploadServiceConfiguration & {
        paymentService: TurboAuthenticatedPaymentService;
    }): TurboAuthenticatedUploadServiceInterface;
    protected getAuthenticatedTurbo({ privateKey, signer: providedSigner, paymentServiceConfig, uploadServiceConfig, token, gatewayUrl, tokenMap, tokenTools, logger, walletAdapter, processId, cuUrl, }: TurboAuthenticatedConfiguration & {
        logger: Logger;
    }): TurboAuthenticatedClient;
    private signerFromAdapter;
}
//# sourceMappingURL=factory.d.ts.map