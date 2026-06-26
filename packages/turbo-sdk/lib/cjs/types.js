"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validChunkingModes = exports.isJWK = exports.isWebUploadFolderParams = exports.isNodeUploadFolderParams = exports.multipartFinalizedStatus = exports.multipartFailedStatus = exports.multipartPendingStatus = exports.X402Funding = exports.OnDemandFunding = exports.ExistingBalanceFunding = exports.supportedEvmSignerTokens = exports.tokenTypes = exports.fiatCurrencyTypes = void 0;
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
    'base-ario',
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
    'base-ario',
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
