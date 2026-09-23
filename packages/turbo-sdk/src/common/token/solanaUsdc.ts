/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { TokenConfig } from '../../types.js';
import { defaultProdGatewayUrls } from '../../utils/common.js';
import { SplToken } from './spl.js';

/** Circle's USDC mints on Solana. Both are 6-decimal SPL Token mints. */
export const SOLANA_USDC_MINT_ADDRESS =
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const DEVNET_SOLANA_USDC_MINT_ADDRESS =
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const USDC_TOKEN_DECIMALS = 6;

export type SolanaUsdcTokenConfig = TokenConfig & {
  /**
   * The USDC mint to pay with. PREFER SETTING THIS EXPLICITLY when `gatewayUrl`
   * is a custom RPC: the default below infers the cluster from the URL, which
   * is only a heuristic — a paid devnet endpoint whose hostname doesn't contain
   * "devnet" would otherwise select the MAINNET mint, and the payment would
   * never be credited (it can't move mainnet value from a devnet wallet, but it
   * does fail confusingly).
   */
  mintAddress?: string;
};

/**
 * USDC (SPL) on Solana. Signed with the ordinary Solana signer — the payer's
 * USDC lives in an associated token account derived from the same keypair, so
 * no extra wallet or approval step is involved.
 */
export class SolanaUsdcToken extends SplToken {
  constructor({
    gatewayUrl = defaultProdGatewayUrls['solana-usdc'],
    mintAddress,
    ...config
  }: SolanaUsdcTokenConfig = {}) {
    super({
      ...config,
      gatewayUrl,
      tokenName: 'USDC',
      decimals: USDC_TOKEN_DECIMALS,
      mintAddress:
        mintAddress ??
        (gatewayUrl.includes('devnet')
          ? DEVNET_SOLANA_USDC_MINT_ADDRESS
          : SOLANA_USDC_MINT_ADDRESS),
    });
  }
}
