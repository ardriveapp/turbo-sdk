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
  HexInjectedSolanaSigner,
  HexSolanaSigner,
  InjectedEthereumSigner,
} from '@dha-team/arbundles';
import { IAxiosRetryConfig } from 'axios-retry';
import { BigNumber } from 'bignumber.js';
import { JsonRpcSigner } from 'ethers';
import { Readable } from 'node:stream';

import { CurrencyMap } from './common/currency.js';
import { TurboEventEmitter } from './common/events.js';
import { JWKInterface } from './common/jwk.js';
import { TurboWinstonLogger } from './common/logger.js';

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
export function isCurrency(currency: unknown): currency is Currency {
  return fiatCurrencyTypes.includes(currency as Currency);
}

export type Country = 'United States' | 'United Kingdom' | 'Canada'; // TODO: add full list

export const tokenTypes = [
  'arweave',
  'ario',
  'solana',
  'ethereum',
  'kyve',
  'matic',
  'pol',
  'base-eth',
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
  suggestedPaymentAmounts: number[];
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

export type TurboTokenPriceForBytesResponse = {
  tokenPrice: string;
  byteCount: number;
  token: TokenType;
};

export type TurboFiatEstimateForBytesResponse = {
  byteCount: number;
  amount: number;
  winc: string;
  currency: Currency;
};

export type TurboWincForFiatParams = {
  amount: CurrencyMap;
  nativeAddress?: NativeAddress;
  promoCodes?: string[];
};

export type TurboWincForTokenParams = {
  tokenAmount: BigNumber.Value;
};

// @deprecated use TurboCheckoutSessionHostedParams or TurboCheckoutSessionEmbeddedParams instead
export type UiMode = 'embedded' | 'hosted';
export type TurboCheckoutSessionParams = TurboWincForFiatParams & {
  owner: PublicArweaveAddress;
} & (TurboCheckoutSessionHostedParams | TurboCheckoutSessionEmbeddedParams);

export type TurboCheckoutSessionHostedParams = {
  uiMode?: 'hosted';
  successUrl?: string;
  cancelUrl?: string;
};

export type TurboCheckoutSessionEmbeddedParams = {
  uiMode?: 'embedded';
  returnUrl?: string;
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

export interface CreditShareApproval {
  approvalDataItemId: TransactionId;
  approvedAddress: UserAddress;
  payingAddress: UserAddress;
  approvedWincAmount: string;
  usedWincAmount: string;
  creationDate: string;
  expirationDate: string | undefined;
}

export interface GetCreditShareApprovalsResponse {
  givenApprovals: CreditShareApproval[];
  receivedApprovals: CreditShareApproval[];
}

export type TurboBalanceResponse = {
  /**
   *  Amount of winc controlled by the user, that they could
   *  spend or share if all current approvals were revoked
   */
  controlledWinc: string;
  /**
   * Amount of winc that a user can currently spend or share
   */
  winc: string;
  /**
   * Amount of winc that a user can currently spend or share
   * plus the amount of remaining winc from received approvals
   */
  effectiveBalance: string;

  receivedApprovals: CreditShareApproval[];
  givenApprovals: CreditShareApproval[];
};

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
  winc: string;
  createdApproval?: CreditShareApproval;
  revokedApprovals?: CreditShareApproval[];
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

export type TurboCreateCreditShareApprovalParams = {
  approvedAddress: string;
  approvedWincAmount: BigNumber.Value;
  expiresBySeconds?: number;
};

export type TurboRevokeCreditsParams = {
  revokedAddress: string;
};

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

export type TurboUploadEventsAndPayloads = {
  'upload-progress': {
    totalBytes: number;
    processedBytes: number;
  };
  'upload-error': Error; // TODO: replace with FailedRequestError
  'upload-success': never[];
};

export type TurboSigningEventsAndPayloads = {
  'signing-progress': {
    totalBytes: number;
    processedBytes: number;
  };
  'signing-error': Error; // TODO: replace with SigningError
  'signing-success': never[];
};

export type TurboTotalEventsAndPayloads = {
  'overall-progress': {
    totalBytes: number;
    processedBytes: number;
    step: 'signing' | 'upload';
  };
  'overall-error': Error; // TODO: replace with union of FailedRequestError and SigningError
  'overall-success': never[];
};

export type TurboUploadEmitterEventArgs = {
  onUploadProgress?: (
    event: TurboUploadEventsAndPayloads['upload-progress'],
  ) => void;
  onUploadError?: (event: TurboUploadEventsAndPayloads['upload-error']) => void;
  onUploadSuccess?: (
    event: TurboUploadEventsAndPayloads['upload-success'],
  ) => void;
};

export type TurboSigningEmitterEventArgs = {
  onSigningProgress?: (
    event: TurboSigningEventsAndPayloads['signing-progress'],
  ) => void;
  onSigningError?: (
    event: TurboSigningEventsAndPayloads['signing-error'],
  ) => void;
  onSigningSuccess?: (
    event: TurboSigningEventsAndPayloads['signing-success'],
  ) => void;
};

export type TurboTotalEmitterEventArgs = {
  onProgress?: (event: TurboTotalEventsAndPayloads['overall-progress']) => void;
  onError?: (event: TurboTotalEventsAndPayloads['overall-error']) => void;
  onSuccess?: (event: TurboTotalEventsAndPayloads['overall-success']) => void;
};

export type TurboTotalEmitterEvents = {
  events?: TurboTotalEmitterEventArgs;
};

export type TurboUploadEmitterEvents = {
  events?: TurboUploadEmitterEventArgs;
};

export type TurboSigningEmitterEvents = {
  events?: TurboSigningEmitterEventArgs;
};
export type TurboUploadAndSigningEmitterEvents = TurboUploadEmitterEvents &
  TurboSigningEmitterEvents &
  TurboTotalEmitterEvents;

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
  processId?: string;
  cuUrl?: string;
};

export interface TurboLogger {
  setLogLevel: (level: string) => void;
  setLogFormat: (logFormat: string) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

export type DataItemOptions = DataItemCreateOptions & {
  paidBy?: UserAddress | UserAddress[];
};

// Supported signers - we will continue to add more
export type TurboSigner =
  | ArconnectSigner
  | ArweaveSigner
  | EthereumSigner
  | InjectedEthereumSigner
  | HexSolanaSigner
  | HexInjectedSolanaSigner;

export type TokenPollingOptions = {
  maxAttempts: number;
  pollingIntervalMs: number;
  initialBackoffMs: number;
};

export type TurboAuthenticatedConfiguration =
  TurboUnauthenticatedConfiguration & {
    privateKey?: TurboWallet;
    signer?: TurboSigner;
    walletAdapter?: SolanaWalletAdapter | EthereumWalletAdapter;
    /** @deprecated -- This parameter was added in release v1.5 for injecting an arweave TokenTool. Instead, the SDK now accepts `tokenTools` and/or `gatewayUrl` directly in the Factory constructor. This type will be removed in a v2 release */
    tokenMap?: TokenMap;
    tokenTools?: TokenTools;
  };

export type SolanaWalletAdapter = {
  publicKey: {
    toBuffer: () => Buffer;
  };
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
};

export type WalletAdapter = SolanaWalletAdapter | EthereumWalletAdapter;

export type EthereumWalletSigner = Pick<
  JsonRpcSigner,
  'signMessage' | 'sendTransaction'
>;

export type EthereumWalletAdapter = {
  getSigner: () => EthereumWalletSigner;
};

export function isSolanaWalletAdapter(
  walletAdapter: SolanaWalletAdapter | EthereumWalletAdapter,
): walletAdapter is SolanaWalletAdapter {
  return 'publicKey' in walletAdapter && 'signMessage' in walletAdapter;
}

export type GetTurboSignerParams = {
  providedSigner: TurboSigner | undefined;
  providedPrivateKey: TurboWallet | undefined;
  providedWalletAdapter: WalletAdapter | undefined;
  token: TokenType;
  logger: TurboWinstonLogger;
};

export function isEthereumWalletAdapter(
  walletAdapter: SolanaWalletAdapter | EthereumWalletAdapter,
): walletAdapter is EthereumWalletAdapter {
  return 'getSigner' in walletAdapter;
}

export type TurboUnauthenticatedClientConfiguration = {
  paymentService: TurboUnauthenticatedPaymentServiceInterface;
  uploadService: TurboUnauthenticatedUploadServiceInterface;
};

export type TurboAuthenticatedClientConfiguration = {
  paymentService: TurboAuthenticatedPaymentServiceInterface;
  uploadService: TurboAuthenticatedUploadServiceInterface;
  signer: TurboDataItemSigner;
};

export type UploadDataType = string | Uint8Array | ArrayBuffer | Buffer | Blob;

export type UploadDataInput = {
  data: UploadDataType;
  dataItemOpts?: DataItemOptions;
  signal?: AbortSignal;
};

export type TurboUploadFileWithStreamFactoryParams = TurboFileFactory &
  TurboAbortSignal &
  TurboUploadAndSigningEmitterEvents;
export type TurboUploadFileWithFileOrPathParams = {
  file: File | string;
  dataItemOpts?: DataItemOptions;
} & TurboAbortSignal &
  TurboUploadAndSigningEmitterEvents;

export type TurboUploadFileParams =
  | TurboUploadFileWithStreamFactoryParams
  | TurboUploadFileWithFileOrPathParams;

export type FileStreamFactory = WebFileStreamFactory | NodeFileStreamFactory;

export type WebFileStreamFactory = (() => ReadableStream) | (() => Buffer);

export type NodeFileStreamFactory = (() => Readable) | (() => Buffer);

export type SignedDataStreamFactory = FileStreamFactory;
export type StreamSizeFactory = () => number;
export type TurboFileFactory<T = FileStreamFactory> = {
  fileStreamFactory: T; // TODO: allow multiple files
  fileSizeFactory: StreamSizeFactory;
  dataItemOpts?: DataItemOptions;
  emitter?: TurboEventEmitter;
  // bundle?: boolean; // TODO: add bundling into BDIs
};

export type WebTurboFileFactory = TurboFileFactory<WebFileStreamFactory>;

export type TurboSignedDataItemFactory = {
  dataItemStreamFactory: SignedDataStreamFactory; // TODO: allow multiple data items
  dataItemSizeFactory: StreamSizeFactory;
  dataItemOpts?: DataItemOptions;
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
  walletAdapter?: WalletAdapter;
};

export interface TurboDataItemSigner {
  signDataItem({
    fileStreamFactory,
    fileSizeFactory,
    dataItemOpts,
    emitter,
  }: TurboFileFactory & {
    emitter?: TurboEventEmitter;
  }): Promise<TurboSignedDataItemFactory>;
  generateSignedRequestHeaders(): Promise<TurboSignedRequestHeaders>;
  signData(dataToSign: Uint8Array): Promise<Uint8Array>;
  sendTransaction(p: SendTxWithSignerParams): Promise<string>;
  getPublicKey(): Promise<Buffer>;
  getNativeAddress(): Promise<string>;
  signer: TurboSigner;
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
  getFiatEstimateForBytes({
    byteCount,
    currency,
  }: {
    byteCount: number;
    currency: Currency;
  }): Promise<TurboFiatEstimateForBytesResponse>;
  getTokenPriceForBytes({
    byteCount,
  }: {
    byteCount: number;
  }): Promise<TurboTokenPriceForBytesResponse>;
  getUploadCosts({ bytes }: { bytes: number[] }): Promise<TurboPriceResponse[]>;
  createCheckoutSession(
    params: TurboCheckoutSessionParams,
  ): Promise<TurboCheckoutSessionResponse>;
  submitFundTransaction(p: {
    txId: string;
  }): Promise<TurboSubmitFundTxResponse>;
  getCreditShareApprovals(p: {
    userAddress: UserAddress;
  }): Promise<GetCreditShareApprovalsResponse>;
}

export type TurboFundWithTokensParams = {
  /** Amount of token in the smallest unit value. e.g value in Winston for "arweave" token */
  tokenAmount: BigNumber.Value;
  feeMultiplier?: number | undefined;
};

export interface TurboAuthenticatedPaymentServiceInterface
  extends TurboUnauthenticatedPaymentServiceInterface {
  getBalance: (userAddress?: UserAddress) => Promise<TurboBalanceResponse>;

  getCreditShareApprovals(p: {
    userAddress?: UserAddress;
  }): Promise<GetCreditShareApprovalsResponse>;

  topUpWithTokens(
    p: TurboFundWithTokensParams,
  ): Promise<TurboCryptoFundResponse>;
}

export interface TurboUnauthenticatedUploadServiceInterface {
  uploadSignedDataItem({
    dataItemStreamFactory,
    dataItemSizeFactory,
    dataItemOpts,
    signal,
    events,
  }: TurboSignedDataItemFactory &
    TurboAbortSignal &
    TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse>;
}

export interface TurboAuthenticatedUploadServiceInterface
  extends TurboUnauthenticatedUploadServiceInterface {
  upload({
    data,
    events,
  }: UploadDataInput &
    TurboAbortSignal &
    TurboUploadEmitterEvents): Promise<TurboUploadDataItemResponse>;
  uploadFile(
    params: TurboUploadFileParams,
  ): Promise<TurboUploadDataItemResponse>;

  uploadFolder(p: TurboUploadFolderParams): Promise<TurboUploadFolderResponse>;

  shareCredits(
    p: TurboCreateCreditShareApprovalParams,
  ): Promise<CreditShareApproval>;

  revokeCredits(p: TurboRevokeCreditsParams): Promise<CreditShareApproval[]>;
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
  logger?: TurboLogger;
  gatewayUrl?: string;
  pollingOptions?: TokenPollingOptions;
};

export type AoProcessConfig = {
  logger?: TurboLogger;
  processId?: string;
  cuUrl?: string;
};

/** @deprecated -- This type was provided as a parameter in release v1.5 for injecting an arweave TokenTool. Instead, the SDK now accepts `tokenTools` and/or `gatewayUrl`  directly in the Factory constructor. This type will be removed in a v2 release  */
export type TokenMap = { arweave: TokenTools };

export type TokenFactory = Record<
  string,
  (config: TokenConfig | AoProcessConfig) => TokenTools
>;
