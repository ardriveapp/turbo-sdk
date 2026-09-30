"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolanaUsdcToken = exports.DEVNET_SOLANA_USDC_MINT_ADDRESS = exports.SOLANA_USDC_MINT_ADDRESS = void 0;
const common_js_1 = require("../../utils/common.js");
const spl_js_1 = require("./spl.js");
/** Circle's USDC mints on Solana. Both are 6-decimal SPL Token mints. */
exports.SOLANA_USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
exports.DEVNET_SOLANA_USDC_MINT_ADDRESS = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_TOKEN_DECIMALS = 6;
/**
 * USDC (SPL) on Solana. Signed with the ordinary Solana signer — the payer's
 * USDC lives in an associated token account derived from the same keypair, so
 * no extra wallet or approval step is involved.
 */
class SolanaUsdcToken extends spl_js_1.SplToken {
    constructor({ gatewayUrl = common_js_1.defaultProdGatewayUrls['solana-usdc'], mintAddress, ...config } = {}) {
        super({
            ...config,
            gatewayUrl,
            tokenName: 'USDC',
            decimals: USDC_TOKEN_DECIMALS,
            mintAddress: mintAddress ??
                (gatewayUrl.includes('devnet')
                    ? exports.DEVNET_SOLANA_USDC_MINT_ADDRESS
                    : exports.SOLANA_USDC_MINT_ADDRESS),
        });
    }
}
exports.SolanaUsdcToken = SolanaUsdcToken;
