import { defaultProdGatewayUrls } from '../../utils/common.js';
import { SplToken } from './spl.js';
/** Circle's USDC mints on Solana. Both are 6-decimal SPL Token mints. */
export const SOLANA_USDC_MINT_ADDRESS = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DEVNET_SOLANA_USDC_MINT_ADDRESS = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_TOKEN_DECIMALS = 6;
/**
 * USDC (SPL) on Solana. Signed with the ordinary Solana signer — the payer's
 * USDC lives in an associated token account derived from the same keypair, so
 * no extra wallet or approval step is involved.
 */
export class SolanaUsdcToken extends SplToken {
    constructor({ gatewayUrl = defaultProdGatewayUrls['solana-usdc'], mintAddress, ...config } = {}) {
        super({
            ...config,
            gatewayUrl,
            tokenName: 'USDC',
            decimals: USDC_TOKEN_DECIMALS,
            mintAddress: mintAddress ??
                (gatewayUrl.includes('devnet')
                    ? DEVNET_SOLANA_USDC_MINT_ADDRESS
                    : SOLANA_USDC_MINT_ADDRESS),
        });
    }
}
