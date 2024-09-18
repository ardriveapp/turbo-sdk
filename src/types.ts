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
  ArconnectSigner,
  ArweaveSigner,
  DataItemCreateOptions,
  EthereumSigner,
  HexSolanaSigner,
} from '@ar.io/arbundles';
import { IAxiosRetryConfig } from 'axios-retry';
import { BigNumber } from 'bignumber.js';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';

import { CurrencyMap } from './common/currency.js';
import { JWKInterface } from './common/jwk.js';

export type Base64String = string;
export type NativeAddress = string;

export type PublicArweaveAddress = Base64String;
export type TransactionId = Base64String;
export type UserAddress = string | PublicArweaveAddress;

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
] as const;
export type Currency = (typeof fiatCurrencyTypes)[number];
export function isCurrency(currency: string): currency is Currency {
  return fiatCurrencyTypes.includes(currency as Currency);
}

export type Country = 'United States' | 'United Kingdom' | 'Canada'; // TODO: add full list

export const tokenTypes = [
  'arweave',
  'solana',
  'ethereum',
  'kyve',
  'matic',
  'pol',
] as const;
export type TokenType = (typeof tokenTypes)[number];

export type Adjustment = {
  name: string;
  description: string;
  operatorMagnitude: number;
  operator: 'multiply' | 'add';
  adjustmentAmount: string;
};

export type CurrencyLimit = {
  minimumPaymentAmount: number;
  maximumPaymentAmount: number;
  suggestedPaymentAmount: number[];
  zeroDecimalCurrency: boolean;
};

export type TurboPriceResponse = {
  winc: string; // TODO: the service returns BigNumbers as strings
  adjustments: Adjustment[];
  fees: Adjustment[];
};

export type TurboWincForFiatResponse = TurboPriceResponse & {
  actualPaymentAmount: number;
  quotedPaymentAmount: number;
};

export type RawWincForTokenResponse = Omit<
  TurboPriceResponse,
  'adjustments'
> & {
  actualPaymentAmount: number;
};

export type TurboWincForTokenResponse = Omit<
  TurboPriceResponse,
  'adjustments'
> & {
  actualTokenAmount: string;
  equivalentWincTokenAmount: string;
};

export type TurboWincForFiatParams = {
  amount: CurrencyMap;
  nativeAddress?: NativeAddress;
  promoCodes?: string[];
};

export type TurboWincForTokenParams = {
  tokenAmount: BigNumber.Value;
};

export type UiMode = 'embedded' | 'hosted';
export type TurboCheckoutSessionParams = TurboWincForFiatParams & {
  owner: PublicArweaveAddress;
  uiMode?: UiMode;
};

export type TopUpRawResponse = {
  topUpQuote: {
    topUpQuoteId: string;
    destinationAddressType: string;
    paymentAmount: number;
    quotedPaymentAmount: number;
    winstonCreditAmount: string;
    destinationAddress: string;
    currencyType: Currency;
    quoteExpirationDate: string;
    paymentProvider: string;
    adjustments: Adjustment[];
  };
  paymentSession: {
    url: string | null;
    id: string;
    client_secret: string | null;
  };
  adjustments: Adjustment[];
  fees: Adjustment[];
};

export type TurboCheckoutSessionResponse = TurboWincForFiatResponse & {
  id: string;
  client_secret?: string;
  url?: string;
  /** @deprecated use duplicate actualPaymentAmount */
  paymentAmount: number;
};

export type TurboBalanceResponse = Omit<
  TurboPriceResponse,
  'adjustments' | 'fees'
>;

export type TurboFiatToArResponse = {
  currency: Currency;
  rate: number;
};
export type TurboRatesResponse = TurboPriceResponse &
  Record<'fiat', Record<Currency, number>>;
export type TurboCountriesResponse = Country[];
export type TurboCurrenciesResponse = {
  supportedCurrencies: Currency[];
  limits: Record<Currency, CurrencyLimit>;
};
export type TurboUploadDataItemResponse = {
  dataCaches: string[];
  fastFinalityIndexes: string[];
  id: TransactionId;
  owner: PublicArweaveAddress;
};

type UploadFolderParams = {
  dataItemOpts?: DataItemOptions;
  maxConcurrentUploads?: number;
  throwOnFailure?: boolean;
  manifestOptions?: {
    disableManifest?: boolean;
    fallbackFile?: string;
    indexFile?: string;
  };
} & TurboAbortSignal;

export type NodeUploadFolderParams = {
  folderPath: string;
} & UploadFolderParams;
export type WebUploadFolderParams = {
  files: File[];
} & UploadFolderParams;
export type TurboUploadFolderParams =
  | NodeUploadFolderParams
  | WebUploadFolderParams;
export const isNodeUploadFolderParams = (
  p: TurboUploadFolderParams,
): p is NodeUploadFolderParams =>
  (p as NodeUploadFolderParams).folderPath !== undefined;
export const isWebUploadFolderParams = (
  p: TurboUploadFolderParams,
): p is WebUploadFolderParams =>
  (p as WebUploadFolderParams).files !== undefined;

export type TurboUploadFolderResponse = {
  fileResponses: TurboUploadDataItemResponse[];
  manifestResponse?: TurboUploadDataItemResponse;
  manifest?: ArweaveManifest;
  errors?: Error[];
};

export type ArweaveManifest = {
  manifest: 'arweave/paths';
  version: '0.2.0';
  index: { path: string };
  paths: Record<string, { id: string }>;
  fallback?: { id: string };
};

export type TurboSubmitFundTxResponse = {
  id: string;
  quantity: string;
  owner: string;
  winc: string;
  token: string;
  status: 'pending' | 'confirmed' | 'failed';
  block?: number;
};

export type TurboCryptoFundResponse = TurboSubmitFundTxResponse & {
  target: string;
  reward?: string;
};

export type TurboInfoResponse = {
  version: string;
  gateway: string;
  freeUploadLimitBytes: number;
  addresses: Record<TokenType, string>;
};

export type PendingPaymentTransaction = {
  transactionId: string;
  tokenType: TokenType;
  transactionQuantity: string;
  winstonCreditAmount: string;
  destinationAddress: UserAddress;
  destinationAddressType: string;
};

export type FailedPaymentTransaction = PendingPaymentTransaction & {
  failedReason: string;
};

export type CreditedPaymentTransaction = PendingPaymentTransaction & {
  blockHeight: number;
};

export type TurboPostBalanceResponse =
  | {
      pendingTransaction: PendingPaymentTransaction & {
        adjustments?: Adjustment[];
      };
      message: string;
    }
  | {
      creditedTransaction: CreditedPaymentTransaction & {
        adjustments?: Adjustment[];
      };
      message: string;
    }
  | {
      failedTransaction: FailedPaymentTransaction & {
        adjustments?: Adjustment[];
      };
      message: string;
    };

export type ArweaveJWK = JWKInterface;

type Base58String = string;
export type SolSecretKey = Base58String;

type HexadecimalString = string;
export type EthPrivateKey = HexadecimalString;
export type KyvePrivateKey = HexadecimalString;

export function isKyvePrivateKey(
  wallet: TurboWallet,
): wallet is KyvePrivateKey {
  if (typeof wallet !== 'string') return false;

  // TODO: Hexadecimal regex
  return true;
}
export function isEthPrivateKey(wallet: TurboWallet): wallet is EthPrivateKey {
  if (typeof wallet !== 'string') return false;

  return wallet.startsWith('0x');
}

export type TurboWallet = ArweaveJWK | SolSecretKey | EthPrivateKey;

export const isJWK = (wallet: TurboWallet): wallet is ArweaveJWK =>
  (wallet as ArweaveJWK).kty !== undefined;

export type TurboSignedRequestHeaders = {
  'x-public-key': string;
  'x-nonce': string;
  'x-signature': string;
};

type TurboAuthConfiguration = {
  signer: TurboDataItemSigner; // TODO: make a class that implements various functions (sign, verify, etc.) and implement for various wallet types
};

type TurboServiceConfiguration = {
  url?: string;
  retryConfig?: IAxiosRetryConfig;
  logger?: TurboLogger;
  token?: TokenType;
};

export type TurboUnauthenticatedUploadServiceConfiguration =
  TurboServiceConfiguration;
export type TurboAuthenticatedUploadServiceConfiguration =
  TurboUnauthenticatedUploadServiceConfiguration & TurboAuthConfiguration;

export type TurboUnauthenticatedPaymentServiceConfiguration =
  TurboServiceConfiguration;
export type TurboAuthenticatedPaymentServiceConfiguration =
  TurboUnauthenticatedPaymentServiceConfiguration &
    TurboAuthConfiguration & {
      tokenTools?: TokenTools;
    };

export type TurboUnauthenticatedConfiguration = {
  paymentServiceConfig?: TurboUnauthenticatedPaymentServiceConfiguration;
  uploadServiceConfig?: TurboUnauthenticatedUploadServiceConfiguration;
  token?: TokenType;
  gatewayUrl?: string;
};

export interface TurboLogger {
  setLogLevel: (level: string) => void;
  setLogFormat: (logFormat: string) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export type DataItemOptions = DataItemCreateOptions;

// Supported signers - we will continue to add more
export type TurboSigner =
  | ArconnectSigner
  | ArweaveSigner
  | EthereumSigner
  | HexSolanaSigner;

export type TokenPollingOptions = {
  maxAttempts: number;
  pollingIntervalMs: number;
  initialBackoffMs: number;
};

export type TurboAuthenticatedConfiguration =
  TurboUnauthenticatedConfiguration & {
    privateKey?: TurboWallet;
    signer?: TurboSigner;
    /** @deprecated -- This parameter was added in release v1.5 for injecting an arweave TokenTool. Instead, the SDK now accepts `tokenTools` and/or `gatewayUrl` directly in the Factory constructor. This type will be removed in a v2 release */
    tokenMap?: TokenMap;
    tokenTools?: TokenTools;
  };

export type TurboUnauthenticatedClientConfiguration = {
  paymentService: TurboUnauthenticatedPaymentServiceInterface;
  uploadService: TurboUnauthenticatedUploadServiceInterface;
};

export type TurboAuthenticatedClientConfiguration = {
  paymentService: TurboAuthenticatedPaymentServiceInterface;
  uploadService: TurboAuthenticatedUploadServiceInterface;
  signer: TurboDataItemSigner;
};

export type FileStreamFactory =
  | (() => Readable)
  | WebFileStreamFactory
  | (() => Buffer);

export type WebFileStreamFactory = () => ReadableStream;

export type SignedDataStreamFactory = FileStreamFactory;
export type StreamSizeFactory = () => number;
export type TurboFileFactory<T = FileStreamFactory> = {
  fileStreamFactory: T; // TODO: allow multiple files
  fileSizeFactory: StreamSizeFactory;
  dataItemOpts?: DataItemOptions;

  // bundle?: boolean; // TODO: add bundling into BDIs
};

export type WebTurboFileFactory = TurboFileFactory<WebFileStreamFactory>;

export type TurboSignedDataItemFactory = {
  dataItemStreamFactory: SignedDataStreamFactory; // TODO: allow multiple data items
  dataItemSizeFactory: StreamSizeFactory;
};

export type TurboAbortSignal = {
  signal?: AbortSignal;
};

export interface TurboHTTPServiceInterface {
  get<T>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
  }: {
    endpoint: string;
    signal?: AbortSignal;
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    allowedStatuses?: number[];
  }): Promise<T>;
  post<T>({
    endpoint,
    signal,
    headers,
    allowedStatuses,
    data,
  }: {
    endpoint: string;
    signal: AbortSignal;
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    allowedStatuses?: number[];
    data: Readable | ReadableStream | Buffer;
  }): Promise<T>;
}

export type SendFundTxParams = {
  tokenAmount: BigNumber;
  target: string;
  feeMultiplier?: number | undefined;
};

export type SendTxWithSignerParams = {
  amount: BigNumber;
  target: string;

  gatewayUrl: string;
};

export type TurboDataItemSignerParams = {
  logger?: TurboLogger;
  signer: TurboSigner;
  token: TokenType;
};

export interface TurboDataItemSigner {
  signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
  }: TurboFileFactory): Promise<TurboSignedDataItemFactory>;
  generateSignedRequestHeaders(): Promise<TurboSignedRequestHeaders>;
  signData(dataToSign: Uint8Array): Promise<Uint8Array>;
  sendTransaction(p: SendTxWithSignerParams): Promise<string>;
  getPublicKey(): Promise<Buffer>;
  getNativeAddress(): Promise<string>;
}

export interface TurboUnauthenticatedPaymentServiceInterface {
  getBalance: (address: string) => Promise<TurboBalanceResponse>;
  getSupportedCurrencies(): Promise<TurboCurrenciesResponse>;
  getSupportedCountries(): Promise<TurboCountriesResponse>;
  getTurboCryptoWallets(): Promise<Record<TokenType, string>>;
  getFiatToAR({
    currency,
  }: {
    currency: Currency;
  }): Promise<TurboFiatToArResponse>;
  getFiatRates(): Promise<TurboRatesResponse>;
  getWincForFiat(
    params: TurboWincForFiatParams,
  ): Promise<TurboWincForFiatResponse>;
  getWincForToken(
    params: TurboWincForTokenParams,
  ): Promise<TurboWincForTokenResponse>;
  getUploadCosts({ bytes }: { bytes: number[] }): Promise<TurboPriceResponse[]>;
  createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse>;
  submitFundTransaction(p: {
    txId: string;
  }): Promise<TurboSubmitFundTxResponse>;
}

export type TurboFundWithTokensParams = {
  /** Amount of token in the smallest unit value. e.g value in Winston for "arweave" token */
  tokenAmount: BigNumber.Value;
  feeMultiplier?: number | undefined;
};

export interface TurboAuthenticatedPaymentServiceInterface
  extends TurboUnauthenticatedPaymentServiceInterface {
  getBalance: (address?: string) => Promise<TurboBalanceResponse>;
  topUpWithTokens(
    p: TurboFundWithTokensParams,
  ): Promise<TurboCryptoFundResponse>;
}

export interface TurboUnauthenticatedUploadServiceInterface {
  uploadSignedDataItem({
    dataItemStreamFactory,
    signal,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal): Promise<TurboUploadDataItemResponse>;
}

export interface TurboAuthenticatedUploadServiceInterface
  extends TurboUnauthenticatedUploadServiceInterface {
  uploadFile({
    fileStreamFactory,
    fileSizeFactory,
  }: TurboFileFactory & TurboAbortSignal): Promise<TurboUploadDataItemResponse>;

  uploadFolder(p: TurboUploadFolderParams): Promise<TurboUploadFolderResponse>;
}

export interface TurboUnauthenticatedClientInterface
  extends TurboUnauthenticatedPaymentServiceInterface,
    TurboUnauthenticatedUploadServiceInterface {}
export interface TurboAuthenticatedClientInterface
  extends TurboAuthenticatedPaymentServiceInterface,
    TurboAuthenticatedUploadServiceInterface {}

export type TokenCreateTxParams = {
  target: string;
  tokenAmount: BigNumber;
  feeMultiplier: number;
  signer: TurboDataItemSigner;
};

export interface TokenTools {
  createAndSubmitTx: (p: TokenCreateTxParams) => Promise<{
    id: string;
    target: string;
    reward?: string;
  }>;
  pollForTxBeingAvailable: (p: { txId: string }) => Promise<void>;
}

export type TokenConfig = {
  gatewayUrl?: string;
  logger?: TurboLogger;
  pollingOptions?: TokenPollingOptions;
};

/** @deprecated -- This type was provided as a parameter in release v1.5 for injecting an arweave TokenTool. Instead, the SDK now accepts `tokenTools` and/or `gatewayUrl`  directly in the Factory constructor. This type will be removed in a v2 release  */
export type TokenMap = { arweave: TokenTools };

export type TokenFactory = Record<string, (config: TokenConfig) => TokenTools>;
