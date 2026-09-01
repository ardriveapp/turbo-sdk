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
import { BigNumber } from 'bignumber.js';
import { JsonRpcSigner } from 'ethers';
import { Readable } from 'node:stream';
import { Signer as x402Signer } from 'x402-fetch';

import { CurrencyMap } from './common/currency.js';
import { TurboEventEmitter } from './common/events.js';
import { RetryConfig } from './common/http.js';
import { JWKInterface } from './common/jwk.js';
import { ILogger, Logger } from './common/logger.js';

export type Base64String = string;
export type NativeAddress = string;

export type ByteCount = number;

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
  'usdc',
  'base-usdc',
  'polygon-usdc',
] as const;
export type TokenType = (typeof tokenTypes)[number];

export const supportedEvmSignerTokens = new Set([
  'ethereum',
  'base-eth',
  'matic',
  'pol',
  'polygon-usdc',
  'usdc',
  'base-usdc',
]);

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

export type TurboPaymentIntentParams = TurboWincForFiatParams & {
  owner: PublicArweaveAddress;
};

// @deprecated use TurboCheckoutSessionHostedParams or TurboCheckoutSessionEmbeddedParams instead
export type UiMode = 'embedded' | 'hosted';
export type TurboCheckoutSessionParams = TurboPaymentIntentParams &
  (TurboCheckoutSessionHostedParams | TurboCheckoutSessionEmbeddedParams);

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

export type TurboPaymentIntentResponse = TurboWincForFiatResponse & {
  id: string;
  client_secret: string;
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

export type TurboFreeStatusResponse = {
  /**
   * Free-tier bytes this wallet can still upload for free, or `null` when the
   * wallet has an unlimited allowance (an exempt/partner wallet). `0` when the
   * free tier is disabled on the target Turbo deployment. Advisory — the
   * authoritative free/charge decision is made at upload time, and the value is
   * a wallet-side figure (a per-network cap may also apply). Deployment-wide
   * free-tier config lives on the service's `/info` endpoint.
   */
  bytesRemaining: number | null;
};

/** A single credited top-up settled with cryptocurrency. */
export type TurboCryptoPaymentHistoryItem = {
  type: 'crypto';
  /** ISO-8601 UTC timestamp of when the credits landed. */
  date: string;
  /** Winston Credits credited by this top-up. */
  wincCredited: string;
  tokenType: string;
  /** On-chain token amount paid, in the token's smallest unit. */
  tokenQuantity: string;
  /** USD value captured at credit time (historical; not a live quote). */
  usdEquivalent: string;
  /** On-chain sender address; empty string on rows predating the column. */
  senderAddress: string;
  transactionId: string;
  blockHeight: string;
};

/** A single credited top-up settled with fiat (e.g. a Stripe card payment). */
export type TurboFiatPaymentHistoryItem = {
  type: 'fiat';
  /** ISO-8601 UTC timestamp of when the receipt was recorded. */
  date: string;
  /** Winston Credits credited by this top-up. */
  wincCredited: string;
  paymentAmount: string;
  currencyType: string;
  paymentProvider: string;
  receiptId: string;
  giftMessage: string | null;
};

export type TurboPaymentHistoryItem =
  | TurboCryptoPaymentHistoryItem
  | TurboFiatPaymentHistoryItem;

export type TurboPaymentHistoryResponse = {
  /** One page of the signer's own top-ups, newest first. */
  payments: TurboPaymentHistoryItem[];
  /** True when more rows exist beyond this page (fetch again with `cursor`). */
  hasMore: boolean;
  /** Opaque cursor for the next page, or `null` on the last page. */
  cursor: string | null;
};

export type TurboPaymentHistoryParams = {
  /** Page size, 1-100 (default 50 on the service). */
  limit?: number;
  /** Opaque cursor from a prior response's `cursor` field. */
  cursor?: string;
};

/**
 * A single ArNS name returned by `getArNSNames`. `custodial: true` means Turbo
 * still holds/manages the underlying ANT on the caller's behalf (e.g. via the
 * ArNS-with-credits purchase flow) and Turbo's transfer/manage routes apply to
 * it; `custodial: false` means the name is self-custodied (or has already been
 * exited from custody) and is returned for historical/informational purposes
 * only.
 *
 * `intent`/`type`/`years`/`purchaseDate` describe the specific purchase
 * receipt Turbo selected for this name and are historical/informational, NOT
 * authoritative for the name's current on-chain state. `type`/`years` may be
 * absent -- omitted from the response entirely, not `null` -- when the
 * selected receipt is an action (e.g. Extend-Lease/Increase-Undername-Limit)
 * that doesn't carry them. `antId` may be an empty string if no receipt Turbo
 * has for this name ever carried one (e.g. the caller only ever extended a
 * name it doesn't own -- ArNS extend/upgrade/increase-undername actions have
 * no on-chain ownership check) -- guard for `antId === ''` before passing it
 * to `@ar.io/sdk`.
 *
 * To read a name's current records or lease/expiration state, use
 * `@ar.io/sdk` directly against the `antId` returned here.
 */
export type TurboArNSName = {
  name: string;
  antId: string;
  /**
   * The ArNS action recorded on the selected purchase receipt. Widened with
   * `(string & {})` so new intents added server-side don't require a
   * client-side type change, while still getting autocomplete for the known
   * values.
   */
  intent:
    | 'Buy-Name'
    | 'Buy-Record'
    | 'Extend-Lease'
    | 'Upgrade-Name'
    | 'Increase-Undername-Limit'
    | (string & Record<never, never>);
  type?: 'lease' | 'permabuy';
  years?: number;
  purchaseDate: string;
  custodial: boolean;
};

export type TurboArNSNamesResponse = {
  names: TurboArNSName[];
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
  // Receipt fields — always present in API responses but optional here
  // for backward compatibility with existing consumers/mocks.
  timestamp?: number;
  signature?: string;
  public?: string;
  version?: string;
  deadlineHeight?: number;
  createdApproval?: CreditShareApproval;
  revokedApprovals?: CreditShareApproval[];
  cryptoFundResult?: TurboCryptoFundResponse;
};

export type FundingOptions = {
  fundingMode?: X402Funding | OnDemandFunding | ExistingBalanceFunding; // TODO: SharedCreditsFunding helper (can be used with paidBy currently)
};

export class ExistingBalanceFunding {}
export class OnDemandFunding {
  public maxTokenAmount: BigNumber | undefined;
  public topUpBufferMultiplier: number;

  constructor({
    maxTokenAmount,
    topUpBufferMultiplier = 1.1,
  }: {
    topUpBufferMultiplier?: number;
    maxTokenAmount?: BigNumber.Value;
  }) {
    if (
      maxTokenAmount !== undefined &&
      new BigNumber(maxTokenAmount).isLessThan(0)
    ) {
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
  public signer: x402Signer | undefined;
  public maxMUSDCAmount: BigNumber | undefined;

  constructor({
    signer,
    maxMUSDCAmount,
  }: {
    /**
     * Optionally provide a custom signer for X402 funding.
     * One will be created from the provided Turbo signer if not provided.
     */
    signer?: x402Signer;
    maxMUSDCAmount?: BigNumber.Value;
  }) {
    this.signer = signer;
    this.maxMUSDCAmount =
      maxMUSDCAmount !== undefined ? new BigNumber(maxMUSDCAmount) : undefined;
  }
}

export const multipartPendingStatus = [
  'ASSEMBLING',
  'VALIDATING',
  'FINALIZING',
] as const;
export type PendingMultiPartStatus = (typeof multipartPendingStatus)[number];

export const multipartFailedStatus = [
  'UNDERFUNDED',
  'INVALID',
  'APPROVAL_FAILED',
  'REVOKE_FAILED',
] as const;
export type FailedMultiPartStatus = (typeof multipartFailedStatus)[number];

export const multipartFinalizedStatus = ['FINALIZED'] as const;
export type FinalizedMultiPartStatus =
  (typeof multipartFinalizedStatus)[number];

export type TurboMultiPartStatusResponse =
  | { status: PendingMultiPartStatus }
  | { status: FailedMultiPartStatus }
  | FinalizedStatusResponse;
type FinalizedStatusResponse = {
  status: 'FINALIZED';
  receipt: TurboUploadDataItemResponse;
};

/**
 * A map from a folder index key to a data item id, used by `uploadFolder` to
 * skip files that are already on Arweave.
 *
 * A key is `<sha-256 of the bytes>.<sha-256 of the tags>`. Both halves matter:
 * an empty `a.css` and an empty `b.js` have identical bytes but must not share
 * a data item, or one of them is served with the other's `Content-Type`. Keying
 * on the tags too means a reused item is always exactly the item this call
 * would otherwise have created. Treat keys as opaque.
 *
 * Implement this to back an index with any store. Ready made layers ship with
 * the SDK: `createMemoryFolderIndex`, `createChainFolderIndex`,
 * `createFileFolderIndex` (NodeJS only) and `composeFolderIndex`.
 *
 * An index is a cache. `uploadFolder` treats a read that throws as a miss and
 * carries on, so a layer is free to fail rather than degrade.
 */
export type TurboFolderUploadIndex = {
  /** Human readable name for the layer, used in debug logs. */
  name?: string;
  /** When true the layer is never written to. Defaults to false. */
  readOnly?: boolean;
  /**
   * The tag name this layer expects a file's content hash under.
   *
   * `uploadFolder` writes whatever the index declares here, so a layer that
   * reads a non-default tag is aligned with the uploader rather than silently
   * unable to match anything. Defaults to `File-SHA256`.
   */
  hashTagName?: string;
  /** The data item id previously uploaded for this key, if it is known. */
  get(key: string): Promise<string | undefined> | string | undefined;
  /** Record that `key` was uploaded as `id`. */
  set(key: string, id: string): Promise<void> | void;
  /**
   * Optional bulk lookup, so a layer backed by a network can answer in one
   * round trip instead of one request per file. `uploadFolder` calls `get` for
   * every key first and then `resolve` once with whatever is still unknown,
   * passing through the caller's `signal`.
   */
  resolve?(
    keys: string[],
    options?: { signal?: AbortSignal },
  ): Promise<Record<string, string>>;
  /**
   * Optional, diagnostics only. Of these content hashes -- the bytes half of a
   * key -- which does the layer hold under *some* tag set?
   *
   * A file whose bytes are already on Arweave but whose key is not is the exact
   * signature of a per file tag that changes between deploys, and it is the one
   * thing `uploadFolder` can say about a cost cliff that is otherwise silent.
   * Never consulted to decide what to upload.
   */
  knownContentHashes?(contentHashes: string[]): Promise<string[]> | string[];
  /** Optional snapshot of everything the layer currently knows. */
  entries?(): Promise<Record<string, string>> | Record<string, string>;
};

/**
 * Whose past uploads a chain folder index sweeps.
 *
 * Tagged rather than a bare string on purpose. A gateway indexes an upload
 * under the base64url sha-256 of the signer's public key, and a raw 32 byte
 * ed25519 public key base64urls to exactly 43 characters -- the same shape as
 * that address. There is no way to tell the two apart by inspection, and
 * guessing wrong means the sweep matches nothing and the whole folder is
 * re-uploaded at full price with no error at all.
 *
 * `await turbo.signer.getPublicKey()` is the one form every signer type can
 * produce, so it is passed directly.
 */
export type ChainFolderUploadIndexOwner =
  | Uint8Array
  | { publicKey: Uint8Array | string; address?: undefined }
  | { address: string; publicKey?: undefined };

export type ChainFolderUploadIndexParams = {
  /**
   * Whose past uploads to sweep. Pass `await turbo.signer.getPublicKey()`,
   * which works for every signer type, or tag what you have as
   * `{ publicKey }` or `{ address }`. A bare string is rejected: see
   * {@link ChainFolderUploadIndexOwner}.
   */
  owner: ChainFolderUploadIndexOwner;
  /** Optional `App-Name` tag value, to narrow the sweep to one application. */
  appName?: string;
  /** Gateway to query. Defaults to `https://arweave.net`. */
  gatewayUrl?: string;
  /**
   * Tag holding each file's content hash. Defaults to `File-SHA256`.
   *
   * `uploadFolder` writes this same tag when this index is passed to it, so the
   * sweep and the uploader cannot drift apart. Every layer in a
   * {@link composeFolderIndex} stack that declares one must agree.
   */
  hashTagName?: string;
  /** Maximum GraphQL pages to walk before giving up. Defaults to 20. */
  maxPages?: number;
  /** GraphQL page size. Defaults to 100. */
  pageSize?: number;
  /** Per request timeout in milliseconds. Defaults to 30_000. */
  timeoutMs?: number;
  /** Override the fetch implementation, e.g. in tests. */
  fetchImpl?: typeof fetch;
  /**
   * Optional logger. Used to report a sweep that ran out of pages before it ran
   * out of files, which otherwise costs money silently.
   */
  logger?: TurboLogger;
};

export type ComposeFolderUploadIndexParams = {
  /** Optional logger, used to report a layer that failed and was skipped. */
  logger?: TurboLogger;
};

export type FileFolderUploadIndexParams = {
  /** Path of the JSON file holding the index. Created if it does not exist. */
  filePath: string;
  /** Optional logger, used to report an unreadable index file. */
  logger?: TurboLogger;
};

/**
 * What an index-backed `uploadFolder` reused rather than paid for again.
 *
 * `uploadedFiles` counts data items that actually landed, so with
 * `throwOnFailure: false` the three counts do not have to sum to `totalFiles`
 * -- the difference is what failed.
 */
export type TurboFolderUploadIndexSummary = {
  /** Every file in the folder, uploaded, reused or failed. */
  totalFiles: number;
  totalBytes: number;
  /** Files that were paid for and landed. */
  uploadedFiles: number;
  uploadedBytes: number;
  /** Files served from the index, or duplicated within this folder. */
  reusedFiles: number;
  reusedBytes: number;
};

type UploadFolderParams = {
  dataItemOpts?: DataItemOptions;
  maxConcurrentUploads?: number;
  throwOnFailure?: boolean;

  /**
   * A folder index. When provided, every file is hashed and only the files
   * whose bytes and tags are not already on Arweave are signed, uploaded and
   * paid for. The manifest is assembled from the ids that were already known
   * plus the ids of whatever this run uploaded.
   *
   * Files uploaded with an index in place carry an extra `File-SHA256` tag.
   */
  folderIndex?: TurboFolderUploadIndex;

  /**
   * `dataItemOpts` for the manifest only. Defaults to `dataItemOpts`.
   *
   * The manifest is rewritten on every deploy, so it is where deploy varying
   * tags such as a commit sha belong. A per file tag that changes between
   * deploys changes every `folderIndex` key, and so re-uploads the whole
   * folder.
   */
  manifestDataItemOpts?: DataItemOptions;

  manifestOptions?: {
    disableManifest?: boolean;
    fallbackFile?: string;
    indexFile?: string;
  };
} & TurboAbortSignal &
  TurboChunkingParams &
  FundingOptions &
  TurboFolderUploadEmitterEvents;

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
  /**
   * One response per data item this call uploaded. With a `folderIndex` in
   * place, files that were reused have no response here -- they are in the
   * manifest and counted in `folderIndexSummary` instead.
   */
  fileResponses: TurboUploadDataItemResponse[];
  manifestResponse?: TurboUploadDataItemResponse;
  manifest?: ArweaveManifest;
  errors?: Error[];
  cryptoFundResult?: TurboCryptoFundResponse;
  /** Only present when `folderIndex` was provided. */
  folderIndexSummary?: TurboFolderUploadIndexSummary;
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
  recipient?: string;
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
  transactionSenderAddress?: UserAddress;
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
  // arbundles SignatureConfig value (e.g. ARWEAVE=1, ETHEREUM=3, SOLANA=4).
  // Lets the service select the correct signature-verification scheme;
  // without it the server cannot distinguish a non-Arweave signed request.
  // Optional on the type for backwards compatibility (so existing consumers
  // that construct this type directly keep compiling); `generateSignedRequestHeaders`
  // always populates it at runtime.
  'x-signature-type'?: string;
};

type TurboAuthConfiguration = {
  signer: TurboDataItemSigner; // TODO: make a class that implements various functions (sign, verify, etc.) and implement for various wallet types
};

type TurboServiceConfiguration = {
  url?: string;
  retryConfig?: RetryConfig;
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

export type TurboFolderUploadEventsAndPayloads = {
  'file-upload-start': {
    fileName: string;
    fileSize: number;
    fileIndex: number;
    totalFiles: number;
  };
  'file-upload-progress': {
    fileName: string;
    fileIndex: number;
    totalFiles: number;
    fileProcessedBytes: number;
    fileTotalBytes: number;
    step: 'signing' | 'upload';
  };
  'file-upload-complete': {
    fileName: string;
    fileIndex: number;
    totalFiles: number;
    id: string;
  };
  'file-upload-error': {
    fileName: string;
    fileIndex: number;
    totalFiles: number;
    error: Error;
  };
  'folder-progress': {
    processedFiles: number;
    totalFiles: number;
    processedBytes: number;
    totalBytes: number;
    currentPhase: 'files' | 'manifest';
  };
  'folder-error': Error;
  'folder-success': never[];
};

export type TurboFolderUploadEmitterEventArgs = {
  onFileStart?: (
    event: TurboFolderUploadEventsAndPayloads['file-upload-start'],
  ) => void;
  onFileProgress?: (
    event: TurboFolderUploadEventsAndPayloads['file-upload-progress'],
  ) => void;
  onFileComplete?: (
    event: TurboFolderUploadEventsAndPayloads['file-upload-complete'],
  ) => void;
  onFileError?: (
    event: TurboFolderUploadEventsAndPayloads['file-upload-error'],
  ) => void;
  onFolderProgress?: (
    event: TurboFolderUploadEventsAndPayloads['folder-progress'],
  ) => void;
  onFolderError?: (
    event: TurboFolderUploadEventsAndPayloads['folder-error'],
  ) => void;
  onFolderSuccess?: (
    event: TurboFolderUploadEventsAndPayloads['folder-success'],
  ) => void;
};

export type TurboFolderUploadEmitterEvents = {
  events?: TurboFolderUploadEmitterEventArgs;
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

export type TurboLogger = ILogger;

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
    toString: () => string;
    /** @deprecated -- fulfill toString() instead, this is here for umi-uploader backwards compatibility */
    toBuffer?: () => Buffer;
  };
  signMessage: (
    message: Uint8Array,
  ) => Promise<Uint8Array | { signature: Uint8Array }>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signTransaction: (transaction: any) => Promise<any>;
};

export type WalletAdapter = SolanaWalletAdapter | EthereumWalletAdapter;

export type EthereumWalletSigner = Pick<
  JsonRpcSigner,
  'signMessage' | 'sendTransaction' | 'provider'
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
  logger: Logger;
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

export const validChunkingModes = ['force', 'disabled', 'auto'] as const;
export type TurboChunkingMode = (typeof validChunkingModes)[number];

export type TurboChunkingParams = {
  /** Maximum size in bytes for each chunk. The last chunk must be smaller than this size. */
  chunkByteCount?: number;
  /** Number of chunks to send up concurrently */
  maxChunkConcurrency?: number;
  /** Chunking mode for uploads. 'auto' means chunking is enabled if the file is larger than 2 chunkByteCounts */
  chunkingMode?: TurboChunkingMode;
  /**
   * Maximum time in milliseconds to wait for the finalization of all chunks after the last chunk is uploaded.
   * If not specified, the SDK will use a default value of 1 minute per GiB.
   */
  maxFinalizeMs?: number;
};

export type TurboUploadFileWithStreamFactoryParams = TurboFileFactory &
  TurboAbortSignal &
  TurboUploadAndSigningEmitterEvents;
export type TurboUploadFileWithFileOrPathParams = {
  file: File | string;
  dataItemOpts?: DataItemOptions;
} & TurboAbortSignal &
  TurboUploadAndSigningEmitterEvents &
  TurboChunkingParams;

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
} & TurboChunkingParams &
  FundingOptions;

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
    endpoint: `/${string}`;
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
    retry,
  }: {
    endpoint: `/${string}`;
    signal?: AbortSignal;
    headers?: Partial<TurboSignedRequestHeaders> & Record<string, string>;
    allowedStatuses?: number[];
    data: Readable | ReadableStream | Buffer;
    // Set false for NON-IDEMPOTENT signed writes (e.g. ArNS purchase/custody):
    // the server treats the nonce as single-use, so an auto-retry after a slow
    // (but landed) write is rejected as "already exists"/"nonce used" and
    // surfaces a false failure. Callers poll status by nonce instead.
    retry?: boolean;
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
  turboCreditDestinationAddress?: UserAddress;
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
  generateSignedRequestHeaders(
    nonce?: string,
    additionalData?: string,
  ): Promise<TurboSignedRequestHeaders>;
  signData(dataToSign: Uint8Array): Promise<Uint8Array>;
  sendTransaction(p: SendTxWithSignerParams): Promise<string>;
  getPublicKey(): Promise<Buffer>;
  getNativeAddress(): Promise<string>;
  signer: TurboSigner;
  walletAdapter?: WalletAdapter;
}

// ===== ArNS purchases paid with Turbo credits (via the bundler REST API) =====

export const arNSPurchaseIntents = [
  'Buy-Name',
  'Extend-Lease',
  'Increase-Undername-Limit',
  'Upgrade-Name',
] as const;
export type ArNSPurchaseIntent = (typeof arNSPurchaseIntents)[number];
export type ArNSNameType = 'lease' | 'permabuy';

// Intent-specific shapes so the required fields per intent are enforced at
// compile time rather than surfacing as runtime 4xxs from the service.
export type ArNSBuyNameLeaseParams = {
  intent: 'Buy-Name';
  name: string;
  type: 'lease';
  /** Lease duration in years */
  years: number;
  /**
   * ANT (Metaplex Core asset) the name resolves to. Optional: omit to have
   * Turbo custodially provision the ANT (Turbo spawns + owns it — Model A);
   * supply to point the name at a user-owned ANT (Model B).
   */
  processId?: string;
};
export type ArNSBuyNamePermabuyParams = {
  intent: 'Buy-Name';
  name: string;
  type: 'permabuy';
  /**
   * ANT (Metaplex Core asset) the name resolves to. Optional: omit to have
   * Turbo custodially provision the ANT (Turbo spawns + owns it — Model A);
   * supply to point the name at a user-owned ANT (Model B).
   */
  processId?: string;
};
export type ArNSBuyNameParams =
  | ArNSBuyNameLeaseParams
  | ArNSBuyNamePermabuyParams;
export type ArNSExtendLeaseParams = {
  intent: 'Extend-Lease';
  name: string;
  years: number;
};
export type ArNSIncreaseUndernameLimitParams = {
  intent: 'Increase-Undername-Limit';
  name: string;
  increaseQty: number;
};
export type ArNSUpgradeNameParams = {
  intent: 'Upgrade-Name';
  name: string;
};

export type ArNSPriceParams =
  | ArNSBuyNameParams
  | ArNSExtendLeaseParams
  | ArNSIncreaseUndernameLimitParams
  | ArNSUpgradeNameParams;

/** Optional delegated payer address(es) whose credits cover a purchase */
export type ArNSPaidByParams = { paidBy?: UserAddress | UserAddress[] };

export type ArNSPriceResponse = {
  /** Price in Winston credits */
  winc: string;
  /** Equivalent price in mARIO */
  mARIO: string;
  [key: string]: unknown;
};

export type ArNSPurchaseParams = ArNSPriceParams & ArNSPaidByParams;

/**
 * Distributive `Omit` so a discriminated union keeps its per-branch fields.
 * The built-in `Omit<A | B, K>` collapses to only the keys common to every
 * member (dropping e.g. a lease's `years`); this maps over each member instead.
 */
export type DistributiveOmit<T, K extends keyof never> = T extends unknown
  ? Omit<T, K>
  : never;

/** `buyArNSName` params: any Buy-Name variant minus the (implied) `intent`. */
export type ArNSBuyNameArgs = DistributiveOmit<ArNSBuyNameParams, 'intent'> &
  ArNSPaidByParams;

export type ArNSPurchaseReceipt = {
  name: string;
  intent: ArNSPurchaseIntent;
  type?: ArNSNameType;
  years?: number;
  increaseQty?: number;
  processId?: string;
  owner: UserAddress;
  /** UUID that identifies this purchase (also the status-lookup key) */
  nonce: string;
  wincQty: string;
  mARIOQty: string;
  usdArRate: number;
  usdArioRate: number;
  paidBy: UserAddress[];
  /** Solana transaction id of the on-chain ArNS write */
  messageId: string;
};

export type ArNSPurchaseResponse = {
  purchaseReceipt: ArNSPurchaseReceipt;
  arioWriteResult: { id: string };
  /** UUID nonce used for the purchase — poll `getArNSPurchaseStatus({ nonce })` with it */
  nonce: string;
};

export type ArNSPurchaseStatusResponse = ArNSPurchaseReceipt & {
  /** Present once the purchase has terminally failed */
  failedDate?: string;
};

// ===== ArNS purchases paid with fiat (Stripe) — no Turbo Credits in between ====

/**
 * Stripe integration mode for a fiat ArNS purchase quote.
 *
 * - `payment-intent` — returns a Stripe PaymentIntent. Confirm it client-side
 *   with `stripe.confirmCardPayment(paymentSession.client_secret, ...)`.
 * - `checkout-session` — returns a Stripe Checkout Session to redirect to
 *   (`uiMode: 'hosted'`) or embed (`uiMode: 'embedded'`).
 *
 * Widened with `string & Record<never, never>` so a method added service-side is
 * still callable without an SDK bump, while the known values keep autocomplete.
 * (`string & {}` is the usual idiom but trips the `ban-types` lint rule.)
 */
export const arNSFiatPurchaseMethods = [
  'payment-intent',
  'checkout-session',
] as const;
export type ArNSFiatPurchaseMethod =
  | (typeof arNSFiatPurchaseMethods)[number]
  | (string & Record<never, never>);

/**
 * Params for a fiat (Stripe) ArNS purchase quote.
 *
 * Intent-specific fields come from the same {@link ArNSPriceParams} union the
 * credit-paid methods use, and the `uiMode` split reuses the checkout-session
 * unions, so the hosted/embedded URL pairing is enforced at compile time the
 * same way it is for top-ups.
 *
 * Note: the service also accepts a `Buy-Record` intent that the SDK does not
 * model yet — {@link arNSPurchaseIntents} carries the other four.
 */
export type ArNSFiatPurchaseQuoteParams = ArNSPriceParams & {
  /** Fiat currency to charge in. */
  currency: Currency;
  /** Address that will own the name once the purchase settles. */
  address: UserAddress;
  /** Stripe integration mode. Defaults to `payment-intent`. */
  method?: ArNSFiatPurchaseMethod;
  /** Promo codes to apply. Sent as repeated `promoCode` query params. */
  promoCodes?: string[];
} & (TurboCheckoutSessionHostedParams | TurboCheckoutSessionEmbeddedParams);

/**
 * Authenticated variant: `address` defaults to the signer's native address.
 */
export type AuthenticatedArNSFiatPurchaseQuoteParams = DistributiveOmit<
  ArNSFiatPurchaseQuoteParams,
  'address'
> & { address?: UserAddress };

/**
 * The quote the service recorded for this purchase. `nonce` is the key to poll
 * `getArNSPurchaseStatus({ nonce })` with once the card payment confirms.
 *
 * Intent-dependent fields (`type`, `years`, `increaseQty`, `processId`) are
 * OMITTED by the service for intents that do not use them — they are absent
 * keys, not `null` — so each is optional here.
 */
export type ArNSFiatPurchaseQuote = {
  name: string;
  intent: ArNSPurchaseIntent;
  /** UUID identifying this purchase; the status-lookup key. */
  nonce: string;
  owner: UserAddress;
  /** Credit value of the purchase, in Winston credits. */
  wincQty: string;
  /** Verified against the live service: serialized as a NUMBER, unlike wincQty. */
  mARIOQty: number;
  /** Fiat amount to be charged, in the currency's smallest unit. */
  paymentAmount: number;
  /** Amount before adjustments, in the currency's smallest unit. */
  quotedPaymentAmount: number;
  currencyType: Currency;
  quoteExpirationDate: string;
  paymentProvider: string;
  /** Credits left over when the charge was raised to Stripe's minimum. */
  excessWincAmount?: string;
  /** ISO timestamp the quote was recorded. */
  quoteCreationDate: string;
  /**
   * Rates at quote time. Verified against the live service: serialized as
   * STRINGS, even though they are numeric server-side.
   */
  usdArRate?: string;
  usdArioRate?: string;
  type?: ArNSNameType;
  years?: number;
  increaseQty?: number;
  processId?: string;
  [key: string]: unknown;
};

/**
 * The Stripe object to complete payment with — a PaymentIntent or a Checkout
 * Session depending on `method`. Typed loosely on purpose: this is Stripe's
 * payload, passed through verbatim, and pinning it here would couple the SDK to
 * a Stripe API version.
 *
 * `client_secret` is present on a PaymentIntent and on an embedded Checkout
 * Session; a hosted Checkout Session exposes `url` instead.
 */
export type ArNSFiatPaymentSession = {
  id: string;
  client_secret?: string | null;
  url?: string | null;
  [key: string]: unknown;
};

export type ArNSFiatPurchaseQuoteResponse = {
  purchaseQuote: ArNSFiatPurchaseQuote;
  paymentSession: ArNSFiatPaymentSession;
  /** Promo/discount adjustments applied to the fiat amount. */
  adjustments: Adjustment[];
  /** Inclusive fees folded into the price. */
  fees: Adjustment[];
};

export interface TurboUnauthenticatedPaymentServiceInterface {
  getBalance: (address: string) => Promise<TurboBalanceResponse>;
  getFreeStatus: (address: string) => Promise<TurboFreeStatusResponse>;
  getArNSPriceForName(params: ArNSPriceParams): Promise<ArNSPriceResponse>;
  getArNSPurchaseStatus(p: {
    nonce: string;
  }): Promise<ArNSPurchaseStatusResponse>;
  /**
   * Returns the ArNS names a wallet owns or controls via Turbo's custodial
   * ArNS-with-credits feature. This is a read-only listing endpoint; it does
   * not require a signature. See `TurboArNSName` for field semantics. To
   * read a name's current records or lease/expiration state, use
   * `@ar.io/sdk` directly against the returned `antId`.
   */
  getArNSNames: (address: string) => Promise<TurboArNSNamesResponse>;
  /** Fiat (Stripe) ArNS purchase quote — no Turbo Credits top-up in between. */
  getArNSFiatPurchaseQuote(
    params: ArNSFiatPurchaseQuoteParams,
  ): Promise<ArNSFiatPurchaseQuoteResponse>;
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
  createPaymentIntent(
    params: TurboPaymentIntentParams,
  ): Promise<TurboPaymentIntentResponse>;
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
  turboCreditDestinationAddress?: UserAddress;
};

export interface TurboAuthenticatedPaymentServiceInterface
  extends TurboUnauthenticatedPaymentServiceInterface {
  getBalance: (userAddress?: UserAddress) => Promise<TurboBalanceResponse>;
  /** `address` defaults to the signer's native address. */
  getArNSFiatPurchaseQuote(
    params: AuthenticatedArNSFiatPurchaseQuoteParams,
  ): Promise<ArNSFiatPurchaseQuoteResponse>;
  getFreeStatus: (
    userAddress?: UserAddress,
  ) => Promise<TurboFreeStatusResponse>;

  /**
   * The signer's OWN completed top-up history (crypto + fiat), newest first.
   * Signature-required and self-scoped — there is no by-address form.
   */
  getPaymentHistory(
    params?: TurboPaymentHistoryParams,
  ): Promise<TurboPaymentHistoryResponse>;

  getArNSNames: (userAddress?: UserAddress) => Promise<TurboArNSNamesResponse>;

  getCreditShareApprovals(p: {
    userAddress?: UserAddress;
  }): Promise<GetCreditShareApprovalsResponse>;

  topUpWithTokens(
    p: TurboFundWithTokensParams,
  ): Promise<TurboCryptoFundResponse>;

  /** Buy / extend / upgrade an ArNS name, debiting the signer's credit balance. */
  purchaseArNSName(params: ArNSPurchaseParams): Promise<ArNSPurchaseResponse>;
  buyArNSName(params: ArNSBuyNameArgs): Promise<ArNSPurchaseResponse>;
  extendArNSLease(
    params: Omit<ArNSExtendLeaseParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse>;
  increaseArNSUndernameLimit(
    params: Omit<ArNSIncreaseUndernameLimitParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse>;
  upgradeArNSName(
    params: Omit<ArNSUpgradeNameParams, 'intent'> & ArNSPaidByParams,
  ): Promise<ArNSPurchaseResponse>;
  transferArNSAnt(params: { antId: string; target: string }): Promise<{
    antId: string;
    target: string;
    name?: string;
    messageId: string;
  }>;
  setArNSRecord(params: {
    antId: string;
    undername?: string;
    transactionId: string;
    ttlSeconds: number;
  }): Promise<{
    antId: string;
    undername: string;
    transactionId: string;
    ttlSeconds: number;
    messageId: string;
  }>;
  removeArNSRecord(params: {
    antId: string;
    undername: string;
  }): Promise<{ antId: string; undername: string; messageId: string }>;
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

  uploadRawX402Data({
    data,
    tags,
    signal,
    maxMUSDCAmount,
  }: {
    data: UploadDataType;
    signal?: AbortSignal;
    tags?: { name: string; value: string }[];
    maxMUSDCAmount?: BigNumber;
  }): Promise<TurboUploadDataItemResponse>;
}

export interface TurboAuthenticatedUploadServiceInterface
  extends TurboUnauthenticatedUploadServiceInterface {
  upload({
    data,
    events,
  }: UploadDataInput &
    TurboAbortSignal &
    TurboUploadEmitterEvents &
    TurboChunkingParams &
    FundingOptions): Promise<TurboUploadDataItemResponse>;
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
  turboCreditDestinationAddress?: UserAddress;
};

export interface TokenTools {
  createAndSubmitTx: (p: TokenCreateTxParams) => Promise<{
    id: string;
    target: string;
    reward?: string;
  }>;

  pollTxAvailability: (p: { txId: string }) => Promise<void>;
}

export type TokenConfig = {
  logger?: TurboLogger;
  gatewayUrl?: string;
  pollingOptions?: TokenPollingOptions;
};

export type AoProcessConfig = {
  logger?: TurboLogger;
};

/** @deprecated -- This type was provided as a parameter in release v1.5 for injecting an arweave TokenTool. Instead, the SDK now accepts `tokenTools` and/or `gatewayUrl`  directly in the Factory constructor. This type will be removed in a v2 release  */
export type TokenMap = { arweave: TokenTools };

export type TokenFactory = Record<
  string,
  (config: TokenConfig | AoProcessConfig) => TokenTools
>;

export type X402RequestCredentials = {
  signer: x402Signer;
  maxMUSDCAmount?: BigNumber.Value;
  unsignedData?: boolean;
};

export type UploadSignedDataItemParams = TurboSignedDataItemFactory &
  TurboAbortSignal &
  TurboUploadEmitterEvents & {
    x402Options?: X402RequestCredentials;
  };
