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
export const supportedEvmSignerTokens = new Set([
    'ethereum',
    'base-eth',
    'matic',
    'pol',
    'polygon-usdc',
    'usdc',
    'base-usdc',
    'base-ario',
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
