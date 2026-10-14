import { Connection } from '@solana/web3.js';
import { AoProcessConfig, TokenConfig, TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger } from '../../types.js';
export declare class SplToken implements TokenTools {
    protected logger: TurboLogger;
    protected connection: Connection;
    protected gatewayUrl: string;
    protected pollingOptions: TokenPollingOptions;
    protected mintAddress: string;
    protected decimals: number;
    /** Token name, used in log messages only. */
    protected tokenName: string;
    constructor({ mintAddress, decimals, tokenName, gatewayUrl, logger, pollingOptions, }: {
        mintAddress: string;
        decimals: number;
        tokenName?: string;
        gatewayUrl?: string;
        logger?: TurboLogger;
        pollingOptions?: TokenPollingOptions;
    } & Partial<AoProcessConfig> & TokenConfig);
    createAndSubmitTx({ target, signer, tokenAmount, turboCreditDestinationAddress, }: TokenCreateTxParams): Promise<{
        id: string;
        target: string;
        reward: string;
    }>;
    /** Sign the message bytes directly: a private-key signer holds the key. */
    private signWithKey;
    /**
     * Have a browser wallet sign the transaction itself, as the SOL path does.
     *
     * A wallet signs through `signTransaction`, not `signMessage`: it refuses, or
     * cannot display, a serialized transaction handed to it as a message. It may
     * also add instructions of its own before signing (compute budget, guards),
     * so the transaction submitted is the one it returns, never ours with its
     * signature attached. Deserializing drops `lastValidBlockHeight`, so that is
     * carried over for confirmation.
     *
     * A wallet can also replace the blockhash. Our `lastValidBlockHeight` then
     * belongs to a different blockhash, and confirming against it can report a
     * landed transfer as expired, which invites a second payment. So fetch a
     * fresh height instead, plus a margin: the wallet's RPC or commitment can
     * run a few blocks ahead of ours. A height that is too high only waits
     * longer before giving up on a transaction that never lands; one that is
     * too low can report a late-landing transfer as expired.
     *
     * Ours is copied before signing, because a wallet can change the
     * transaction it was given and return that same object.
     */
    private signWithWallet;
    private submitTx;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
}
//# sourceMappingURL=spl.d.ts.map