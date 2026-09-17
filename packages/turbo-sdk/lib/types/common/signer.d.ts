import { Signer as ArbundleSigner } from '@dha-team/arbundles';
import { Signer as x402Signer } from 'x402-fetch';
import { FileStreamFactory, NativeAddress, SendTxWithSignerParams, TokenType, TurboDataItemSigner, TurboDataItemSignerParams, TurboFileFactory, TurboLogger, TurboSignedDataItemFactory, TurboSignedRequestHeaders, TurboSigner, WalletAdapter } from '../types.js';
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
    generateSignedRequestHeaders(nonce?: string, additionalData?: string): Promise<TurboSignedRequestHeaders>;
    getPublicKey(): Promise<Buffer>;
    getNativeAddress(): Promise<NativeAddress>;
    /** Let the signer handle sending tx for better compat with cross chain libraries/web wallets */
    sendTransaction({ target, amount, gatewayUrl, turboCreditDestinationAddress, }: SendTxWithSignerParams): Promise<string>;
    signData(dataToSign: Uint8Array): Promise<Uint8Array>;
}
/**
 * Builds the wallet client x402-fetch signs payment authorizations with.
 *
 * The chain matters because `wrapFetchWithPayment` maps `walletClient.chain.id`
 * to a network name and prefers the matching entry in the service's `accepts`
 * list. The upload service advertises Base mainnet (`base`), and x402 support
 * here is limited to `base-usdc`, so mainnet is the correct default. Callers
 * needing another network can supply their own signer via
 * `X402Funding({ signer })`.
 */
export declare function makeX402Signer(arbundlesSigner: ArbundleSigner): Promise<x402Signer>;
//# sourceMappingURL=signer.d.ts.map