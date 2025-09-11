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
} from '../types.js';
import { TurboWinstonLogger } from './logger.js';
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
  protected static logger = TurboWinstonLogger.default;

  /* @deprecated - use TurboWinstonLogger directly */
  static setLogLevel(level: string) {
    this.logger.setLogLevel(level);
  }

  /* @deprecated - use TurboWinstonLogger directly */
  static setLogFormat(format: string) {
    this.logger.setLogFormat(format);
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
    config: TurboAuthenticatedUploadServiceConfiguration,
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
  }: TurboAuthenticatedConfiguration & { logger: TurboWinstonLogger }) {
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
      tokenTools = defaultTokenMap[token]?.({
        cuUrl,
        processId,
        gatewayUrl,
        logger,
      });
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

    if (token === 'ethereum' || token === 'base-eth') {
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
