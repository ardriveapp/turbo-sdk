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
import {
  HexInjectedSolanaSigner,
  InjectedEthereumSigner,
  SignatureConfig,
} from '@dha-team/arbundles';

import {
  GetTurboSignerParams,
  TokenType,
  TurboAuthenticatedConfiguration,
  TurboAuthenticatedUploadServiceConfiguration,
  TurboAuthenticatedUploadServiceInterface,
  TurboUnauthenticatedConfiguration,
  WalletAdapter,
  isEthereumWalletAdapter,
  isSolanaWalletAdapter,
  supportedEvmSignerTokens,
} from '../types.js';
import { LogLevel, Logger } from './logger.js';
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';
import { TurboDataItemAbstractSigner } from './signer.js';
import { defaultTokenMap } from './token/index.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from './turbo.js';
import { TurboUnauthenticatedUploadService } from './upload.js';

export abstract class TurboBaseFactory {
  protected static logger = Logger.default;

  /* @deprecated - use Logger directly */
  static setLogLevel(level: LogLevel) {
    this.logger.setLogLevel(level);
  }

  static unauthenticated({
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    token,
  }: TurboUnauthenticatedConfiguration = {}) {
    token = token === 'pol' ? 'matic' : token;

    token ??= 'arweave'; // default to arweave if token is not provided

    const paymentService = new TurboUnauthenticatedPaymentService({
      ...paymentServiceConfig,
      logger: this.logger,
      token,
    });
    const uploadService = new TurboUnauthenticatedUploadService({
      ...uploadServiceConfig,
      logger: this.logger,
      token,
    });
    return new TurboUnauthenticatedClient({
      uploadService,
      paymentService,
    });
  }

  protected abstract getSigner({
    providedPrivateKey,
    providedSigner,
    providedWalletAdapter,
    logger,
    token,
  }: GetTurboSignerParams): TurboDataItemAbstractSigner;

  protected abstract getAuthenticatedUploadService(
    config: TurboAuthenticatedUploadServiceConfiguration & {
      paymentService: TurboAuthenticatedPaymentService;
    },
  ): TurboAuthenticatedUploadServiceInterface;

  protected getAuthenticatedTurbo({
    privateKey,
    signer: providedSigner,
    paymentServiceConfig = {},
    uploadServiceConfig = {},
    token,
    gatewayUrl,
    tokenMap,
    tokenTools,
    logger,
    walletAdapter,
    processId,
    cuUrl,
  }: TurboAuthenticatedConfiguration & { logger: Logger }) {
    token = token === 'pol' ? 'matic' : token;

    if (!token) {
      if (providedSigner) {
        // Derive token from signer if not provided
        switch (providedSigner.signatureType) {
          case SignatureConfig.ETHEREUM:
          case SignatureConfig.TYPEDETHEREUM:
            token = 'ethereum';
            break;

          case SignatureConfig.SOLANA:
          case SignatureConfig.ED25519:
            token = 'solana';
            break;

          case SignatureConfig.ARWEAVE:
            token = 'arweave';
            break;

          case SignatureConfig.KYVE:
            token = 'kyve';
            break;

          default:
            break;
        }
      }
    }
    token ??= 'arweave'; // default to arweave if token is not provided

    if (walletAdapter) {
      if (isSolanaWalletAdapter(walletAdapter)) {
        const signMessage = walletAdapter.signMessage.bind(walletAdapter);
        walletAdapter.signMessage = async (message: Uint8Array) => {
          const signed = await signMessage(message);
          if ('signature' in signed) {
            return signed.signature;
          }
          return signed;
        };

        if (!('toString' in walletAdapter.publicKey)) {
          // Umi uploader compatibility
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (walletAdapter.publicKey as any).toString = function () {
            return this.toBuffer().toString('base64');
          };
        }
      }

      providedSigner = this.signerFromAdapter(walletAdapter, token);
    }

    const turboSigner = this.getSigner({
      providedSigner,
      providedPrivateKey: privateKey,
      token,
      logger,
      providedWalletAdapter: walletAdapter,
    });

    if (!tokenTools) {
      if (tokenMap && token === 'arweave') {
        tokenTools = tokenMap.arweave;
      }
      console.log('gatewayUrl', gatewayUrl);
      tokenTools = defaultTokenMap[token]?.({
        cuUrl,
        processId,
        gatewayUrl,
        logger,
      });
      console.log('tokenTools', tokenTools);
    }

    const paymentService = new TurboAuthenticatedPaymentService({
      ...paymentServiceConfig,
      signer: turboSigner,
      logger,
      token,
      tokenTools,
    });
    const uploadService = this.getAuthenticatedUploadService({
      ...uploadServiceConfig,
      signer: turboSigner,
      logger,
      token,
      paymentService,
    });
    return new TurboAuthenticatedClient({
      uploadService,
      paymentService,
      signer: turboSigner,
    });
  }

  private signerFromAdapter(walletAdapter: WalletAdapter, token: TokenType) {
    if (token === 'solana') {
      if (!isSolanaWalletAdapter(walletAdapter)) {
        throw new Error(
          'Unsupported wallet adapter -- must implement publicKey and signMessage',
        );
      }
      return new HexInjectedSolanaSigner(walletAdapter);
    }

    if (supportedEvmSignerTokens.has(token)) {
      if (!isEthereumWalletAdapter(walletAdapter)) {
        throw new Error(
          'Unsupported wallet adapter -- must implement getSigner',
        );
      }
      return new InjectedEthereumSigner(walletAdapter);
    }

    throw new Error(
      'Unsupported wallet adapter -- wallet adapter is currently only supported for Solana and Ethereum',
    );
  }
}
