import { Signer as ArbundleSigner } from '@dha-team/arbundles';
import { Signer as x402Signer } from 'x402-fetch';
import { FileStreamFactory, NativeAddress, SendTxWithSignerParams, TokenType, TurboDataItemSigner, TurboDataItemSignerParams, TurboFileFactory, TurboLogger, TurboSignedDataItemFactory, TurboSigner, WalletAdapter } from '../types.js';
/**
 * Abstract class for signing TurboDataItems.
 */
export declare abstract class TurboDataItemAbstractSigner implements TurboDataItemSigner {
    signer: TurboSigner;
    walletAdapter: WalletAdapter | undefined;
    protected logger: TurboLogger;
    protected token: TokenType;
    constructor({ signer, logger, token, walletAdapter, }: TurboDataItemSignerParams);
    abstract signDataItem({ fileStreamFactory, fileSizeFactory, dataItemOpts, emitter, }: TurboFileFactory<FileStreamFactory>): Promise<TurboSignedDataItemFactory>;
    private ownerToNativeAddress;
    generateSignedRequestHeaders(): Promise<{
        'x-public-key': string;
        'x-nonce': string;
        'x-signature': string;
    }>;
    getPublicKey(): Promise<Buffer>;
    getNativeAddress(): Promise<NativeAddress>;
    /** Let the signer handle sending tx for better compat with cross chain libraries/web wallets */
    sendTransaction({ target, amount, gatewayUrl, turboCreditDestinationAddress, }: SendTxWithSignerParams): Promise<string>;
    signData(dataToSign: Uint8Array): Promise<Uint8Array>;
}
export declare function makeX402Signer(arbundlesSigner: ArbundleSigner): Promise<x402Signer>;
//# sourceMappingURL=signer.d.ts.map