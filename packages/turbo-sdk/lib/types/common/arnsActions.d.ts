import { ArNSOwnerSigner } from '../types.js';
/**
 * Canonical ACTION-BOUND message for the owner proof.
 *
 * MUST match the bundler's `buildArNSCustodyMessage` byte for byte
 * (newline-delimited) or every signature is rejected. The bundler rebuilds this
 * from the request and verifies the signature over `message + nonce`, so a
 * signature captured for one operation cannot authorize a different one, and
 * the nonce is consumed on use so the same one cannot be replayed (e.g. to
 * revert a record to an older value).
 */
export declare function buildArNSCustodyMessage(action: 'set-record' | 'remove-record', fields: string[]): string;
/**
 * The ANT owner's half of the envelope, in its own `x-owner-*` headers.
 *
 * Two signatures travel on a record action — the PAYER's signed request over
 * `"" + nonce`, and the OWNER's action-bound proof over `message + nonce` —
 * from two different keys, usually on two different chains. They cannot share
 * one header set: whichever verifier ran second would reject a signature that
 * was never meant for it.
 */
export declare function arNSOwnerProofHeaders(owner: ArNSOwnerSigner, message: string, nonce: string): Promise<Record<string, string>>;
/**
 * Build an {@link ArNSOwnerSigner} from a raw Solana secret key.
 *
 * For servers and tests. A browser wallet (Phantom, Solflare, or a console's
 * embedded wallet) should implement the interface directly against its own
 * `signTransaction` / `signMessage` rather than exposing a secret key.
 *
 * Note the owner needs a key to SIGN with, not a funded account: Turbo is the
 * fee payer on every sponsored action, so this wallet's SOL balance can stay
 * at zero for the entire life of the name.
 */
export declare function solanaOwnerSigner(secretKey: Uint8Array | string): ArNSOwnerSigner;
/**
 * Count the signature slots a prepared transaction still has empty.
 *
 * Turbo pre-signs as fee payer and leaves exactly one slot for the owner, so a
 * client can assert that before prompting a wallet — a cheap way to catch a
 * malformed or already-signed transaction before bothering the user.
 */
export declare function emptySignatureSlots(transactionBase64: string): number;
//# sourceMappingURL=arnsActions.d.ts.map