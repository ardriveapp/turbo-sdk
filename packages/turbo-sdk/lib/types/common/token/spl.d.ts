import { Connection } from '@solana/web3.js';
import { AoProcessConfig, TokenConfig, TokenCreateTxParams, TokenPollingOptions, TokenTools, TurboLogger } from '../../types.js';
/**
 * Funding by an **SPL token transfer on Solana**: an idempotent
 * create-associated-token-account, a `transferChecked` to the recipient's ATA,
 * and an optional `turboCreditDestinationAddress=` memo when the credit should
 * land on a different Turbo account than the payer.
 *
 * This is the generic shape of what `ARIOToken` has always done — ARIO is an SPL
 * token — so a second SPL token (USDC) is a mint and a decimals value, not a
 * second implementation. The payment service verifies both with one class too
 * (`SolanaSplGateway`).
 *
 * Two constraints worth knowing before pointing this at a third token:
 *  - The associated token accounts are derived for the CLASSIC SPL Token
 *    program (Tokenkeg), which is what ARIO and USDC use. A Token-2022 mint
 *    derives a different ATA, so it would need its own program id threading
 *    through `getAssociatedTokenAddressSync`. It fails loudly on-chain rather
 *    than silently paying the wrong account.
 *  - `decimals` must match the mint's own. `transferChecked` carries the value
 *    and the chain rejects a mismatch, so a wrong value fails the transaction
 *    instead of transferring a wrong amount.
 */
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
     */
    private signWithWallet;
    private submitTx;
    pollTxAvailability({ txId }: {
        txId: string;
    }): Promise<void>;
}
//# sourceMappingURL=spl.d.ts.map