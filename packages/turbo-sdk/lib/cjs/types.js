"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arNSFiatPurchaseMethods = exports.arNSActions = exports.arNSPurchaseIntents = exports.validChunkingModes = exports.isJWK = exports.isWebUploadFolderParams = exports.isNodeUploadFolderParams = exports.multipartFinalizedStatus = exports.multipartFailedStatus = exports.multipartPendingStatus = exports.X402Funding = exports.OnDemandFunding = exports.ExistingBalanceFunding = exports.supportedEvmSignerTokens = exports.tokenTypes = exports.fiatCurrencyTypes = void 0;
exports.isCurrency = isCurrency;
exports.isKyvePrivateKey = isKyvePrivateKey;
exports.isEthPrivateKey = isEthPrivateKey;
exports.isSolanaWalletAdapter = isSolanaWalletAdapter;
exports.isEthereumWalletAdapter = isEthereumWalletAdapter;
const bignumber_js_1 = require("bignumber.js");
exports.fiatCurrencyTypes = [
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
function isCurrency(currency) {
    return exports.fiatCurrencyTypes.includes(currency);
}
exports.tokenTypes = [
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
exports.supportedEvmSignerTokens = new Set([
    'ethereum',
    'base-eth',
    'matic',
    'pol',
    'polygon-usdc',
    'usdc',
    'base-usdc',
]);
class ExistingBalanceFunding {
}
exports.ExistingBalanceFunding = ExistingBalanceFunding;
class OnDemandFunding {
    constructor({ maxTokenAmount, topUpBufferMultiplier = 1.1, }) {
        if (maxTokenAmount !== undefined &&
            new bignumber_js_1.BigNumber(maxTokenAmount).isLessThan(0)) {
            throw new Error('maxTokenAmount must be non-negative');
        }
        this.maxTokenAmount =
            maxTokenAmount !== undefined ? new bignumber_js_1.BigNumber(maxTokenAmount) : undefined;
        if (topUpBufferMultiplier < 1) {
            throw new Error('topUpBufferMultiplier must be >= 1');
        }
        this.topUpBufferMultiplier = topUpBufferMultiplier;
    }
}
exports.OnDemandFunding = OnDemandFunding;
class X402Funding {
    constructor({ signer, maxMUSDCAmount, }) {
        this.signer = signer;
        this.maxMUSDCAmount =
            maxMUSDCAmount !== undefined ? new bignumber_js_1.BigNumber(maxMUSDCAmount) : undefined;
    }
}
exports.X402Funding = X402Funding;
exports.multipartPendingStatus = [
    'ASSEMBLING',
    'VALIDATING',
    'FINALIZING',
];
exports.multipartFailedStatus = [
    'UNDERFUNDED',
    'INVALID',
    'APPROVAL_FAILED',
    'REVOKE_FAILED',
];
exports.multipartFinalizedStatus = ['FINALIZED'];
const isNodeUploadFolderParams = (p) => p.folderPath !== undefined;
exports.isNodeUploadFolderParams = isNodeUploadFolderParams;
const isWebUploadFolderParams = (p) => p.files !== undefined;
exports.isWebUploadFolderParams = isWebUploadFolderParams;
function isKyvePrivateKey(wallet) {
    if (typeof wallet !== 'string')
        return false;
    // TODO: Hexadecimal regex
    return true;
}
function isEthPrivateKey(wallet) {
    if (typeof wallet !== 'string')
        return false;
    return wallet.startsWith('0x');
}
const isJWK = (wallet) => wallet.kty !== undefined;
exports.isJWK = isJWK;
function isSolanaWalletAdapter(walletAdapter) {
    return 'publicKey' in walletAdapter && 'signMessage' in walletAdapter;
}
function isEthereumWalletAdapter(walletAdapter) {
    return 'getSigner' in walletAdapter;
}
exports.validChunkingModes = ['force', 'disabled', 'auto'];
// ===== ArNS purchases paid with Turbo credits (via the bundler REST API) =====
exports.arNSPurchaseIntents = [
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
exports.arNSActions = [
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
exports.arNSFiatPurchaseMethods = [
    'payment-intent',
    'checkout-session',
];
