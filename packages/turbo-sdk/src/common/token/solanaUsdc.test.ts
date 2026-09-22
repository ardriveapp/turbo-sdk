import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { defaultTokenMap, exponentMap, tokenToBaseMap } from '../token/index.js';
import {
  DEVNET_SOLANA_USDC_MINT_ADDRESS,
  SOLANA_USDC_MINT_ADDRESS,
  SolanaUsdcToken,
} from './solanaUsdc.js';

/** `mintAddress` is protected; read it the way the token is actually built. */
function mintOf(token: SolanaUsdcToken): string {
  return (token as unknown as { mintAddress: string }).mintAddress;
}

describe('SolanaUsdcToken', () => {
  it('uses the mainnet USDC mint by default', () => {
    assert.equal(mintOf(new SolanaUsdcToken()), SOLANA_USDC_MINT_ADDRESS);
  });

  it('uses the devnet USDC mint against a devnet RPC', () => {
    const token = new SolanaUsdcToken({
      gatewayUrl: 'https://api.devnet.solana.com',
    });
    assert.equal(mintOf(token), DEVNET_SOLANA_USDC_MINT_ADDRESS);
  });

  it('lets an explicit mint win over the URL heuristic', () => {
    // The case the heuristic gets wrong on its own: a paid devnet RPC whose
    // hostname does not contain "devnet".
    const token = new SolanaUsdcToken({
      gatewayUrl: 'https://green-polished-season.quiknode.pro/abc123/',
      mintAddress: DEVNET_SOLANA_USDC_MINT_ADDRESS,
    });
    assert.equal(mintOf(token), DEVNET_SOLANA_USDC_MINT_ADDRESS);
  });

  it('is registered in the token factory with 6 decimals', () => {
    const token = defaultTokenMap['solana-usdc']({});
    assert.ok(token instanceof SolanaUsdcToken);
    assert.equal(exponentMap['solana-usdc'], 6);
    // 1 USDC -> 1_000_000 base units
    assert.equal(tokenToBaseMap['solana-usdc'](1).toString(), '1000000');
  });
});
