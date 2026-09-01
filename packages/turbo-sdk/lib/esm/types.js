import { BigNumber } from 'bignumber.js';
export const fiatCurrencyTypes = [
    'usd',
    'eur',
    'gbp',
    'cad',
    'aud',
    'jpy',
    'inr',
    'sgd',
    'hkd',
    'brl',
];
export function isCurrency(currency) {
    return fiatCurrencyTypes.includes(currency);
}
export const tokenTypes = [
    'arweave',
    'ario',
    'solana',
    'ethereum',
    'kyve',
    'matic',
    'pol',
    'base-eth',
    'usdc',
    'base-usdc',
    'polygon-usdc',
];
export const supportedEvmSignerTokens = new Set([
    'ethereum',
    'base-eth',
    'matic',
    'pol',
    'polygon-usdc',
    'usdc',
    'base-usdc',
]);
export class ExistingBalanceFunding {
}
export class OnDemandFunding {
    constructor({ maxTokenAmount, topUpBufferMultiplier = 1.1, }) {
        if (maxTokenAmount !== undefined &&
            new BigNumber(maxTokenAmount).isLessThan(0)) {
            throw new Error('maxTokenAmount must be non-negative');
        }
        this.maxTokenAmount =
            maxTokenAmount !== undefined ? new BigNumber(maxTokenAmount) : undefined;
        if (topUpBufferMultiplier < 1) {
            throw new Error('topUpBufferMultiplier must be >= 1');
        }
        this.topUpBufferMultiplier = topUpBufferMultiplier;
    }
}
export class X402Funding {
    constructor({ signer, maxMUSDCAmount, }) {
        this.signer = signer;
        this.maxMUSDCAmount =
            maxMUSDCAmount !== undefined ? new BigNumber(maxMUSDCAmount) : undefined;
    }
}
export const multipartPendingStatus = [
    'ASSEMBLING',
    'VALIDATING',
    'FINALIZING',
];
export const multipartFailedStatus = [
    'UNDERFUNDED',
    'INVALID',
    'APPROVAL_FAILED',
    'REVOKE_FAILED',
];
export const multipartFinalizedStatus = ['FINALIZED'];
export const isNodeUploadFolderParams = (p) => p.folderPath !== undefined;
export const isWebUploadFolderParams = (p) => p.files !== undefined;
export function isKyvePrivateKey(wallet) {
    if (typeof wallet !== 'string')
        return false;
    // TODO: Hexadecimal regex
    return true;
}
export function isEthPrivateKey(wallet) {
    if (typeof wallet !== 'string')
        return false;
    return wallet.startsWith('0x');
}
export const isJWK = (wallet) => wallet.kty !== undefined;
export function isSolanaWalletAdapter(walletAdapter) {
    return 'publicKey' in walletAdapter && 'signMessage' in walletAdapter;
}
export function isEthereumWalletAdapter(walletAdapter) {
    return 'getSigner' in walletAdapter;
}
export const validChunkingModes = ['force', 'disabled', 'auto'];
// ===== ArNS purchases paid with Turbo credits (via the bundler REST API) =====
export const arNSPurchaseIntents = [
    'Buy-Name',
    'Extend-Lease',
    'Increase-Undername-Limit',
    'Upgrade-Name',
];
// ===== ArNS actions (sponsored — the current bundler surface) =====
/**
 * The nine sponsored ArNS actions.
 *
 * Sponsorship covers these twelve and NOTHING else. Everything else in the
 * ArNS, ANT and core programs stays on the direct-signer path and costs the
 * user SOL — notably `BuyReturnedName` (auctions, deliberately excluded: the
 * premium is unbounded), `ClaimReservedName`, the primary-name flow (which
 * lives in the ario core program), release/reassign, and ANT-LEVEL metadata.
 * Note ANT-level metadata is distinct from RECORD-level metadata, which
 * `set-record-metadata` does sponsor.
 */
export const arNSActions = [
    'buy-name',
    'extend-lease',
    'upgrade-name',
    'increase-undername-limit',
    'set-record',
    'remove-record',
    'add-controller',
    'remove-controller',
    'transfer',
    // Record-scoped. Owner-or-controller on chain, so these follow set-record's
    // degrade-on-revoke shape rather than needing a signature every time.
    'set-record-metadata',
    'remove-record-metadata',
    'transfer-record',
];
// ===== ArNS purchases paid with fiat (Stripe) — no Turbo Credits in between ====
/**
 * Stripe integration mode for a fiat ArNS purchase quote.
 *
 * - `payment-intent` — returns a Stripe PaymentIntent. Confirm it client-side
 *   with `stripe.confirmCardPayment(paymentSession.client_secret, ...)`.
 * - `checkout-session` — returns a Stripe Checkout Session to redirect to
 *   (`uiMode: 'hosted'`) or embed (`uiMode: 'embedded'`).
 *
 * Widened with `string & Record<never, never>` so a method added service-side is
 * still callable without an SDK bump, while the known values keep autocomplete.
 * (`string & {}` is the usual idiom but trips the `ban-types` lint rule.)
 */
export const arNSFiatPurchaseMethods = [
    'payment-intent',
    'checkout-session',
];
