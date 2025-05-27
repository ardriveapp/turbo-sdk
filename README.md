# @ardriveapp/turbo-sdk 🚀

[![codecov](https://codecov.io/gh/ardriveapp/turbo-sdk/graph/badge.svg?token=CXS48HM8Y8)](https://codecov.io/gh/ardriveapp/turbo-sdk)

Welcome to the `@ardrive/turbo-sdk`! This SDK provides functionality for interacting with the Turbo Upload and Payment Services and is available for both NodeJS and Web environments.

## Table of Contents

<!-- toc -->

- [Table of Contents](#table-of-contents)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [Web](#web)
  - [NodeJS](#nodejs)
  - [Typescript](#typescript)
  - [Examples](#examples)
- [Events](#events)
- [Logging](#logging)
- [APIs](#apis)
  - [TurboFactory](#turbofactory)
  - [TurboUnauthenticatedClient](#turbounauthenticatedclient)
  - [TurboAuthenticatedClient](#turboauthenticatedclient)
- [CLI](#cli)
  - [Installation](#installation-1)
  - [Usage](#usage-1)
- [Turbo Credit Sharing](#turbo-credit-sharing)
- [Developers](#developers)
  - [Requirements](#requirements)
  - [Setup & Build](#setup--build)
  - [Testing](#testing)
  - [Linting & Formatting](#linting--formatting)
  - [Architecture](#architecture)

<!-- tocstop -->

## Installation

```shell
npm install @ardrive/turbo-sdk
```

or

```shell
yarn add @ardrive/turbo-sdk
```

## Quick Start

```typescript
import { ArweaveSigner, TurboFactory } from '@ardrive/turbo-sdk';
import Arweave from 'arweave';
import fs from 'fs';
import open from 'open';
import path from 'path';

async function uploadWithTurbo() {
  // load your JWK directly to authenticate
  const arweave = Arweave.init({});
  const jwk = JSON.parse(fs.readFileSync('./my-jwk.json', 'utf-8'));
  const address = await arweave.wallets.jwkToAddress(jwk);
  const turbo = TurboFactory.authenticated({ privateKey: jwk });

  // or provide your own signer
  // const signer = new ArweaveSigner(jwk);
  // const turbo = TurboFactory.authenticated({ signer });

  // get the wallet balance
  const { winc: balance } = await turbo.getBalance();

  // prep file for upload
  const filePath = path.join(__dirname, './my-image.png');
  const fileSize = fs.statSync(filePath).size;

  // get the cost of uploading the file
  const [{ winc: fileSizeCost }] = await turbo.getUploadCosts({
    bytes: [fileSize],
  });

  // check if balance greater than upload cost, and if in browser
  if (balance < fileSizeCost && window !== undefined) {
    const { url } = await turbo.createCheckoutSession({
      amount: fileSizeCost,
      owner: address,
      // add a promo code if you have one
    });

    // open the URL to top-up if in browser
    window.open(url, '_blank');
  } else {
    // otherwise, print the URL to the console
    console.log('Please top up your balance via the CLI before uploading', {
      balance,
      fileSizeCost,
    });
  }

  // create a callback for events you want to listen to
  const uploadProgressEvents = {
    onSigningProgress: ({ totalBytes, processedBytes }) => {
      console.log('Signing progress:', { totalBytes, processedBytes });
    },
    onSigningError: ({ error }) => {
      console.log('Signing error:', { error });
    },
    onSigningSuccess: () => {
      console.log('Signing success!');
    },
    onUploadProgress: ({ totalBytes, processedBytes }) => {
      console.log('Upload progress:', { totalBytes, processedBytes });
    },
    onUploadError: ({ error }) => {
      console.log('Upload error:', { error });
    },
    onUploadSuccess: () => {
      console.log('Upload success!');
    },
  };

  // upload the file
  try {
    const { id, owner, dataCaches, fastFinalityIndexes } =
      // Have data in memory already? Just use it!
      haveDataInMemory
        ? await turbo.upload({ data: 'The contents of my file!', events: uploadProgressEvents })
        : // Or perhaps you have a larger file that you don't want in memory? Stream it!
          await turbo.uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
            events: uploadProgressEvents);
    // upload complete!
    console.log('Successfully upload data item!', {
      id,
      owner,
      dataCaches,
      fastFinalityIndexes,
    });
  } catch (error) {
    // upload failed
    console.error('Failed to upload data item!', error);
  } finally {
    const { winc: newBalance } = await turbo.getBalance();
    console.log('New balance:', newBalance);
  }
}
```

## Usage

The SDK is provided in both CommonJS and ESM formats, and it's compatible with bundlers such as Webpack, Rollup, and ESbuild. Utilize the appropriately named exports provided by this SDK's [package.json] based on your project's configuration. Refer to the [examples] directory to see how to use the SDK in various environments.

### Web

> [!WARNING]
> Polyfills are not provided by default for bundled web projects (Vite, ESBuild, Webpack, Rollup, etc.) . Depending on your apps bundler configuration and plugins, you will need to provide polyfills for various imports including `crypto`, `process`, `fs` and `buffer`. Refer to your bundler's documentation for how to provide the necessary polyfills.

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk/web';

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

#### Browser

```html
<script type="module">
  import { TurboFactory } from 'https://unpkg.com/@ardrive/turbo-sdk';

  const turbo = TurboFactory.unauthenticated();
  const rates = await turbo.getFiatRates();
</script>
```

### NodeJS

#### CommonJS

Full example available in the [examples/typescript/cjs].

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk';

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

#### ESM

Full example available in the [examples/typescript/esm].

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk/node';

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project:

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk/<node/web>';
```

Types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

### Examples

Examples are available in the [examples] directory. To run examples:

- `yarn example:web` - opens up the example web page
- `yarn example:cjs` - runs example CJS node script
- `yarn example:esm` - runs example ESM node script

## APIs

### TurboFactory

#### `unauthenticated()`

Creates an instance of a client that accesses Turbo's unauthenticated services.

```typescript
const turbo = TurboFactory.unauthenticated();
```

#### `authenticated()`

Creates an instance of a client that accesses Turbo's authenticated and unauthenticated services. Requires either a signer, or private key to be provided.

##### Arweave JWK

```typescript
const jwk = await arweave.crypto.generateJWK();
const turbo = TurboFactory.authenticated({ privateKey: jwk });
```

##### ArweaveSigner

```typescript
const signer = new ArweaveSigner(jwk);
const turbo = TurboFactory.authenticated({ signer });
```

##### ArconnectSigner

```typescript
const signer = new ArconnectSigner(window.arweaveWallet);
const turbo = TurboFactory.authenticated({ signer });
```

##### EthereumSigner

```typescript
const signer = new EthereumSigner(privateKey);
const turbo = TurboFactory.authenticated({ signer });
```

##### Ethereum Private Key

```typescript
const turbo = TurboFactory.authenticated({
  privateKey: ethHexadecimalPrivateKey,
  token: 'ethereum',
});
```

##### POL (MATIC) Private Key

```typescript
const turbo = TurboFactory.authenticated({
  privateKey: ethHexadecimalPrivateKey,
  token: 'pol',
});
```

##### HexSolanaSigner

```typescript
const signer = new HexSolanaSigner(bs58.encode(secretKey));
const turbo = TurboFactory.authenticated({ signer });
```

##### Solana Secret Key

```typescript
const turbo = TurboFactory.authenticated({
  privateKey: bs58.encode(secretKey),
  token: 'solana',
});
```

##### KYVE Private Key

```typescript
const turbo = TurboFactory.authenticated({
  privateKey: kyveHexadecimalPrivateKey,
  token: 'kyve',
});
```

##### KYVE Mnemonic

```typescript
import { privateKeyFromKyveMnemonic } from '@ardrive/turbo-sdk';

const turbo = TurboFactory.authenticated({
  privateKey: privateKeyFromKyveMnemonic(mnemonic),
  token: 'kyve',
});
```

### TurboUnauthenticatedClient

#### `getSupportedCurrencies()`

Returns the list of currencies supported by the Turbo Payment Service for topping up a user balance of AR Credits (measured in Winston Credits, or winc).

```typescript
const currencies = await turbo.getSupportedCurrencies();
```

#### `getSupportedCountries()`

Returns the list of countries supported by the Turbo Payment Service's top up workflow.

```typescript
const countries = await turbo.getSupportedCountries();
```

#### `getFiatToAR({ currency })`

Returns the current raw fiat to AR conversion rate for a specific currency as reported by third-party pricing oracles.

```typescript
const fiatToAR = await turbo.getFiatToAR({ currency: 'USD' });
```

#### `getFiatRates()`

Returns the current fiat rates for 1 GiB of data for supported currencies, including all top-up adjustments and fees.

```typescript
const rates = await turbo.getFiatRates();
```

#### `getWincForFiat({ amount })`

Returns the current amount of Winston Credits including all adjustments for the provided fiat currency.

```typescript
const { winc, actualPaymentAmount, quotedPaymentAmount, adjustments } =
  await turbo.getWincForFiat({
    amount: USD(100),
  });
```

#### `getWincForToken({ tokenAmount })`

Returns the current amount of Winston Credits including all adjustments for the provided token amount.

```typescript
const { winc, actualTokenAmount, equivalentWincTokenAmount } =
  await turbo.getWincForToken({
    tokenAmount: WinstonToTokenAmount(100_000_000),
  });
```

#### `getTokenPriceForBytes({ byteCount })`

Get the current price from the Turbo Payment Service, denominated in the specified token, for uploading a specified number of bytes to Turbo.

```typescript
const turbo = TurboFactory.unauthenticated({ token: 'solana' });
const { tokenPrice } = await turbo.getTokenPriceForBytes({
  byteCount: 1024 * 1024 * 100,
});

console.log(tokenPrice); // Estimated SOL Price for 100 MiB
```

#### `getUploadCosts({ bytes })`

Returns the estimated cost in Winston Credits for the provided file sizes, including all upload adjustments and fees.

```typescript
const [uploadCostForFile] = await turbo.getUploadCosts({ bytes: [1024] });
const { winc, adjustments } = uploadCostForFile;
```

#### `uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, signal, events })`

Uploads a signed data item. The provided `dataItemStreamFactory` should produce a NEW signed data item stream each time is it invoked. The `dataItemSizeFactory` is a function that returns the size of the file. The `signal` is an optional [AbortSignal] that can be used to cancel the upload or timeout the request. The `events` is an optional object that can be used to listen to upload progress, errors, and success.

```typescript
const filePath = path.join(__dirname, './my-signed-data-item');
const dataItemSize = fs.statSync(filePath).size;
const uploadResponse = await turbo.uploadSignedDataItem({
  dataItemStreamFactory: () => fs.createReadStream(filePath),
  dataItemSizeFactory: () => dataItemSize,
  signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  events: {
    onUploadProgress: ({ totalBytes, processedBytes }) => {
      console.log('Upload progress:', { totalBytes, processedBytes });
    },
    onUploadError: ({ error }) => {
      console.log('Upload error:', { error });
    },
    onUploadSuccess: () => {
      console.log('Upload success!');
    },
  },
});
```

#### `createCheckoutSession({ amount, owner })`

Creates a Stripe checkout session for a Turbo Top Up with the provided amount, currency, owner. The returned URL can be opened in the browser, all payments are processed by Stripe. To leverage promo codes, see [TurboAuthenticatedClient].

##### Arweave (AR) Fiat Top Up

```typescript
const { url, winc, paymentAmount, quotedPaymentAmount, adjustments } =
  await turbo.createCheckoutSession({
    amount: USD(10.0), // $10.00 USD
    owner: publicArweaveAddress,
    // promo codes require an authenticated client
  });

// Open checkout session in a browser
window.open(url, '_blank');
```

##### Ethereum (ETH) Fiat Top Up

```typescript
const turbo = TurboFactory.unauthenticated({ token: 'ethereum' });

const { url, winc, paymentAmount } = await turbo.createCheckoutSession({
  amount: USD(10.0), // $10.00 USD
  owner: publicEthereumAddress,
});
```

##### Solana (SOL) Fiat Top Up

```typescript
const turbo = TurboFactory.unauthenticated({ token: 'solana' });

const { url, winc, paymentAmount } = await turbo.createCheckoutSession({
  amount: USD(10.0), // $10.00 USD
  owner: publicSolanaAddress,
});
```

##### Polygon (POL / MATIC) Fiat Top Up

```typescript
const turbo = TurboFactory.unauthenticated({ token: 'pol' });

const { url, winc, paymentAmount } = await turbo.createCheckoutSession({
  amount: USD(10.0), // $10.00 USD
  owner: publicPolygonAddress,
});
```

##### KYVE Fiat Top Up

```typescript
const turbo = TurboFactory.unauthenticated({ token: 'kyve' });

const { url, winc, paymentAmount } = await turbo.createCheckoutSession({
  amount: USD(10.0), // $10.00 USD
  owner: publicKyveAddress,
});
```

#### `submitFundTransaction({ txId })`

Submits the transaction ID of a funding transaction to Turbo Payment Service for top up processing. The `txId` is the transaction ID of the transaction to be submitted.

> [!NOTE]
> Use this API if you've already executed your token transfer to the Turbo wallet. Otherwise, consider using `topUpWithTokens` to execute a new token transfer to the Turbo wallet and submit its resulting transaction ID for top up processing all in one go

```typescript
const turbo = TurboFactory.unauthenticated(); // defaults to arweave token type
const { status, id, ...fundResult } = await turbo.submitFundTransaction({
  txId: 'my-valid-arweave-fund-transaction-id',
});
```

### TurboAuthenticatedClient

#### `getBalance()`

Issues a signed request to get the credit balance of a wallet measured in AR (measured in Winston Credits, or winc).

```typescript
const { winc: balance } = await turbo.getBalance();
```

#### `signer.getNativeAddress()`

Returns the [native address][docs/native-address] of the connected signer.

```typescript
const address = await turbo.signer.getNativeAddress();
```

#### `getWincForFiat({ amount, promoCodes })`

Returns the current amount of Winston Credits including all adjustments for the provided fiat currency, amount, and optional promo codes.

```typescript
const { winc, paymentAmount, quotedPaymentAmount, adjustments } =
  await turbo.getWincForFiat({
    amount: USD(100),
    promoCodes: ['MY_PROMO_CODE'], // promo codes require an authenticated client
  });
```

#### `createCheckoutSession({ amount, owner, promoCodes })`

Creates a Stripe checkout session for a Turbo Top Up with the provided amount, currency, owner, and optional promo codes. The returned URL can be opened in the browser, all payments are processed by Stripe. Promo codes require an authenticated client.

```typescript
const { url, winc, paymentAmount, quotedPaymentAmount, adjustments } =
  await turbo.createCheckoutSession({
    amount: USD(10.0), // $10.00 USD
    owner: publicArweaveAddress,
    promoCodes: ['MY_PROMO_CODE'], // promo codes require an authenticated client
  });

// open checkout session in a browser
window.open(url, '_blank');
```

#### `upload({ data, signal, dataItemOpts, events })`

The easiest way to upload data to Turbo. The `signal` is an optional [AbortSignal] that can be used to cancel the upload or timeout the request. `dataItemOpts` is an optional object that can be used to configure tags, target, and anchor for the data item upload.

```typescript
const uploadResult = await turbo.upload({
  data: 'The contents of my file!',
  signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  dataItemOpts: {
    // optional
  },
  events: {
    // optional
  },
});
```

#### `uploadFile({ fileStreamFactory, fileSizeFactory, signal, dataItemOpts, events })`

Signs and uploads a raw file. The provided `fileStreamFactory` should produce a NEW file data stream each time is it invoked. The `fileSizeFactory` is a function that returns the size of the file. The `signal` is an optional [AbortSignal] that can be used to cancel the upload or timeout the request. `dataItemOpts` is an optional object that can be used to configure tags, target, and anchor for the data item upload.

```typescript
const filePath = path.join(__dirname, './my-unsigned-file.txt');
const fileSize = fs.stateSync(filePath).size;
const uploadResult = await turbo.uploadFile({
  fileStreamFactory: () => fs.createReadStream(filePath),
  fileSizeFactory: () => fileSize,
  dataItemOpts: {
    // optional
    tags: [
      {
        name: 'Content-Type',
        value: 'text/plain',
      },
      {
        name: 'My-Custom-Tag',
        value: 'my-custom-value',
      },
    ],
    // no timeout or AbortSignal provided
  },
  events: {
    onUploadProgress: ({ totalBytes, processedBytes }) => {
      console.log('Upload progress:', { totalBytes, processedBytes });
    },
    onUploadError: ({ error }) => {
      console.log('Upload error:', { error });
    },
    onUploadSuccess: () => {
      console.log('Upload success!');
    },
    // add any other events you want to listen to (see `Events` section for more details)
  },
});
```

#### `uploadFolder({ folderPath, files, dataItemOpts, signal, maxConcurrentUploads, throwOnFailure, manifestOptions })`

Signs and uploads a folder of files. For NodeJS, the `folderPath` of the folder to upload is required. For the browser, an array of `files` is required. The `dataItemOpts` is an optional object that can be used to configure tags, target, and anchor for the data item upload. The `signal` is an optional [AbortSignal] that can be used to cancel the upload or timeout the request. The `maxConcurrentUploads` is an optional number that can be used to limit the number of concurrent uploads. The `throwOnFailure` is an optional boolean that can be used to throw an error if any upload fails. The `manifestOptions` is an optional object that can be used to configure the manifest file, including a custom index file, fallback file, or whether to disable manifests altogether. Manifests are enabled by default.

##### NodeJS Upload Folder

```typescript
const folderPath = path.join(__dirname, './my-folder');
const { manifest, fileResponses, manifestResponse } = await turbo.uploadFolder({
  folderPath,
  dataItemOpts: {
    // optional
    tags: [
      {
        // User defined content type will overwrite file content type
        name: 'Content-Type',
        value: 'text/plain',
      },
      {
        name: 'My-Custom-Tag',
        value: 'my-custom-value',
      },
    ],
    // no timeout or AbortSignal provided
  },
  manifestOptions: {
    // optional
    indexFile: 'custom-index.html',
    fallbackFile: 'custom-fallback.html',
    disableManifests: false,
  },
});
```

##### Browser Upload Folder

```html
<input type="file" id="folder" name="folder" webkitdirectory />
<script type="module">
  const folderInput = document.getElementById('folder');

  folderInput.addEventListener('change', async (event) => {
    const selectedFiles = folderInput.files;
    console.log('Folder selected:', selectedFiles);

    const { manifest, fileResponses, manifestResponse } =
      await turbo.uploadFolder({
        files: Array.from(selectedFiles).map((file) => file),
      });

    console.log(manifest, fileResponses, manifestResponse);
  });
</script>
```

#### `topUpWithTokens({ tokenAmount, feeMultiplier })`

Tops up the connected wallet with Credits by submitting a payment transaction for the token amount to the Turbo wallet and then submitting that transaction id to Turbo Payment Service for top up processing.

- The `tokenAmount` is the amount of tokens in the token type's smallest unit value (e.g: Winston for arweave token type) to fund the wallet with.
- The `feeMultiplier` (optional) is the multiplier to apply to the reward for the transaction to modify its chances of being mined. Credits will be added to the wallet balance after the transaction is confirmed on the given blockchain. Defaults to 1.0, meaning no multiplier.

##### Arweave (AR) Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'arweave' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: WinstonToTokenAmount(100_000_000), // 0.0001 AR
  feeMultiplier: 1.1, // 10% increase in reward for improved mining chances
});
```

##### AR.IO Network (ARIO) Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'ario' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: ARIOToTokenAmount(100), // 100 $ARIO
});
```

##### Ethereum (ETH) Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'ethereum' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: ETHToTokenAmount(0.00001), // 0.00001 ETH
});
```

##### Polygon (POL / MATIC) Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'pol' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: POLToTokenAmount(0.00001), // 0.00001 POL
});
```

##### Eth on Base Network Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'base-eth' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: ETHToTokenAmount(0.00001), // 0.00001 ETH bridged on Base Network
});
```

##### Solana (SOL) Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'solana' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: SOLToTokenAmount(0.00001), // 0.00001 SOL
});
```

##### KYVE Crypto Top Up

```typescript
const turbo = TurboFactory.authenticated({ signer, token: 'kyve' });

const { winc, status, id, ...fundResult } = await turbo.topUpWithTokens({
  tokenAmount: KYVEToTokenAmount(0.00001), // 0.00001 KYVE
});
```

#### `shareCredits({ approvedAddress, approvedWincAmount, expiresBySeconds })`

Shares credits from the connected wallet to the provided native address and approved winc amount. This action will create a signed data item for the approval

```typescript
const { approvalDataItemId, approvedWincAmount } = await turbo.shareCredits({
  approvedAddress: '2cor...VUa',
  approvedWincAmount: 0.08315565032,
  expiresBySeconds: 3600,
});
```

#### `revokeCredits({ approvedAddress })`

Revokes all credits shared from the connected wallet to the provided native address.

```typescript
const revokedApprovals = await turbo.revokeCredits({
  approvedAddress: '2cor...VUa',
});
```

#### `getCreditShareApprovals({ userAddress })`

Returns all given or received credit share approvals for the connected wallet or the provided native address.

```typescript
const { givenApprovals, receivedApprovals } =
  await turbo.getCreditShareApprovals({
    userAddress: '2cor...VUa',
  });
```

### Events

The SDK provides events for uploading and signing data. You can listen to these events by providing a callback function to the `events` parameter of the `upload` and `uploadFile` methods.

Supported events:

- `onSigningProgress` - emitted when the signing progress changes
- `onSigningError` - emitted when the signing fails
- `onSigningSuccess` - emitted when the signing succeeds
- `onUploadProgress` - emitted when the upload progress changes
- `onUploadError` - emitted when the upload fails
- `onUploadSuccess` - emitted when the upload succeeds

```typescript
const uploadResult = await turbo.upload({
  data: 'The contents of my file!',
  signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  dataItemOpts: {
    // optional
  },
  events: {
    onUploadProgress: ({ totalBytes, processedBytes }) => {
      console.log('Upload progress:', { totalBytes, processedBytes });
    },
    onUploadError: ({ error }) => {
      console.log('Upload error:', { error });
    },
    onUploadSuccess: () => {
      console.log('Upload success!');
    },
    onSigningProgress: ({ totalBytes, processedBytes }) => {
      console.log('Signing progress:', { totalBytes, processedBytes });
    },
    onSigningError: ({ error }) => {
      console.log('Signing error:', { error });
    },
    onSigningSuccess: () => {
      console.log('Signing success!');
    },
  },
});
```

## Logging

The SDK uses winston for logging. You can set the log level using the `setLogLevel` method.

```typescript
TurboFactory.setLogLevel('debug');
```

## CLI

<!-- markdownlint-disable MD024 -->

### Installation

Global installation:

```shell
npm install -g @ardrive/turbo-sdk
```

or

```shell
yarn global add @ardrive/turbo-sdk
```

or install locally as a dev dependency:

```shell
npm install --save-dev @ardrive/turbo-sdk
```

or

```shell
yarn add -D @ardrive/turbo-sdk
```

<!-- markdownlint-disable MD024 -->

### Usage

```shell
turbo --help
```

or from local installation:

```shell
yarn turbo --help
```

```shell
npx turbo --help
```

#### Options

Global options:

- `-V, --version` - output the version number
- `-h, --help` - display help for command
- `--dev` - Enable development endpoints (default: false)
- `-g, --gateway <url>` - Set a custom crypto gateway URL
- `--upload-url <url>` - Set a custom upload service URL
- `--payment-url <url>` - Set a custom payment service URL
- `--cu-url <url>` - Set a custom AO compute unit URL
- `--process-id <id>` - Set a custom target process ID for AO action
- `-t, --token <token>` - Token type for the command or connected wallet (default: "arweave")

Wallet options:

- `-w, --wallet-file <filePath>` - Wallet file to use with the action. Formats accepted: JWK.json, KYVE, ETH, or POL private key as a string, or SOL Secret Key as a Uint8Array
- `-m, --mnemonic <phrase>` - Mnemonic to use with the action (KYVE only)
- `-p, --private-key <key>` - Private key to use with the action

Upload options:

- `--paid-by <paidBy...>` - A list of native addresses to pay for the upload.
- `--ignore-approvals` - When no paid by is provided, the CLI will look for and use any received credit share approvals to pay for the upload. This flag will ignore any approvals and only use the connected wallet's balance for upload payment. Default: false
- `--use-signer-balance-first` - Use the connected wallet's balance before using any credit share approvals for the upload. Default: false

#### Commands

##### `balance`

Get the balance of a connected wallet or native address in Turbo Credits.

Command Options:

- `-a, --address <nativeAddress>` - Native address to get the balance of

e.g:

```shell
turbo balance --address 'crypto-wallet-public-native-address' --token solana
```

```shell
turbo balance --wallet-file '../path/to/my/wallet.json' --token arweave
```

##### `top-up`

Top up a connected wallet or native address with Turbo Credits using a supported fiat currency. This command will create a Stripe checkout session for the top-up amount and open the URL in the default browser.

Command Options:

- `-a, --address <nativeAddress>` - Native address to top up
- `-c, --currency <currency>` - Currency to top up with
- `-v, --value <value>` - Value of fiat currency for top up. e.g: 10.50 for $10.50 USD

e.g:

```shell
# Open Stripe hosted checkout session in browser to top up for 10.00 USD worth of Turbo Credits
turbo top-up --address 'crypto-wallet-public-native-address' --token ethereum --currency USD --value 10
```

##### `crypto-fund`

Fund a wallet with Turbo Credits by submitting a payment transaction for the crypto amount to the Turbo wallet and then submitting that transaction id to Turbo Payment Service for top up processing. Alternatively, submit a transaction ID of an existing funding transaction to Turbo Payment Service for top up processing.

Command Options:

- `-v, --value <value>` - Value of crypto token for fund. e.g: 0.0001 for 0.0001 KYVE
- `-i, --tx-id <txId>` - Transaction ID of an existing funding transaction

e.g:

```shell
turbo crypto-fund --value 0.0001 --token kyve --private-key 'b27...45c'
```

```shell
turbo crypto-fund --tx-id 'my-valid-arweave-fund-transaction-id' --token arweave
```

```shell
turbo crypto-fund --value 100 --token ario --wallet-file ../path/to/arweave/wallet/with/ario.json
```

```shell
# Use a custom AO process ID and compute unit:
turbo crypto-fund --value 100 --token ario --process-id agYcCFJtrMG6cqMuZfskIkFTGvUPddICmtQSBIoPdiA --cu-url https://cu.ao-testnet.xyz
```

##### `upload-folder`

Upload a folder of files and create and upload a manifest file for the folder upload to the Turbo Upload Service.

Command Options:

- `-f, --folder-path <folderPath>` - Path to the folder to upload
- `--index-file <indexFile>` - File to use for the "index" path in the resulting manifest
- `--fallback-file <fallbackFile>` - File to use for the "fallback" path in the resulting manifest
- `--no-manifest` - Disable manifest creation
- `--max-concurrency <maxConcurrency>` - Maximum number of concurrent uploads

e.g:

```shell
turbo upload-folder --folder-path '../path/to/my/folder' --token solana --wallet-file ../path/to/sol/sec/key.json
```

##### `upload-file`

Upload a file to the Turbo Upload Service.

Command Options:

- `-f, --file-path <filePath>` - Path to the file to upload

e.g:

```shell
turbo upload-file --file-path '../path/to/my/file.txt' --token ethereum --wallet-file ../path/to/eth/private/key.txt --paid-by '0x...first-payer-address' '0x...second-payer-address' '0x...third-payer-address' 'etc...'
```

##### `price`

Get the current credit price estimate from Turbo Payment Service for a given value and price type.

Command Options:

- `--value <value>` - Value to get the price for. e.g: 10.50 for $10.50 USD, 1024 for 1 KiB, 1.1 for 1.1 AR
- `--type <type>` - Type of price to get. e.g: 'bytes', 'arweave', 'usd', 'kyve'. Default: 'bytes'

e.g:

```shell
turbo price --value 10.50 --type usd
```

```shell
turbo price --value 1024 --type bytes
```

```shell
turbo price --value 1.1 --type arweave
```

##### `token-price`

Get the current price from the Turbo Payment Service, denominated in the specified token, for uploading a specified number of bytes to Turbo.

Command Options:

- `--byte-count <byteCount>` - Byte value to get the token price for

e.g:

```shell
turbo token-price --byte-count 102400 --token solana
```

##### `share-credits`

Shares credits from the connected wallet to the provided native address and approved winc amount.

Command Options:

- `-a, --address <nativeAddress>` - Native address to that will receive the Credits
- `-v, --value <value>` - Value of winc to share to the target address
- `-e, --expires-by-seconds <seconds>` - Expiry time in seconds for the credit share approval

e.g:

```shell
turbo share-credits --address 2cor...VUa --value 0.083155650320 --wallet-file ../path/to/my/wallet --expires-by-seconds 3600
```

##### `revoke-credits`

Revoke all credits shared from the connected wallet to the provided native address.

Command Options:

- `-a, --address <nativeAddress>` - Native address to revoke credit share approvals for

e.g:

```shell
turbo revoke-credits --wallet-file ../path/to/my/wallet
```

##### `list-shares`

List all given and received credit share approvals from the connected wallet or the provided native address.

Command Options:

- `-a, --address <nativeAddress>` - Native address to list credit share approvals for

e.g:

```shell
turbo list-shares --address 2cor...VUa --wallet-file ../path/to/my/wallet
```

## Turbo Credit Sharing

Users can share their purchased Credits with other users' wallets by creating Credit Share Approvals. These approvals are created by uploading a signed data item with tags indicating the recipient's wallet address, the amount of Credits to share, and an optional amount of seconds that the approval will expire in. The recipient can then use the shared Credits to pay for their own uploads to Turbo.

Shared Credits cannot be re-shared by the recipient to other recipients. Only the original owner of the Credits can share or revoke Credit Share Approvals. Credits that are shared to other wallets may not be used by the original owner of the Credits for sharing or uploading unless the Credit Share Approval is revoked or expired.

Approvals can be revoked at any time by similarly uploading a signed data item with tags indicating the recipient's wallet address. This will remove all approvals and prevent the recipient from using the shared Credits. All unused Credits from expired or revoked approvals are returned to the original owner of the Credits.

To use the shared Credits, recipient users must provide the wallet address of the user who shared the Credits with them in the `x-paid-by` HTTP header when uploading data. This tells Turbo services to look for and use Credit Share Approvals to pay for the upload before using the signer's balance.

For user convenience, during upload the Turbo CLI will use any available Credit Share Approvals found for the connected wallet before using the signing wallet's balance. To instead ignore all Credit shares and only use the signer's balance, use the `--ignore-approvals` flag. To use the signer's balance first before using Credit shares, use the `--use-signer-balance-first` flag. In contrast, the Turbo SDK layer does not provide this functionality and will only use approvals when `paidBy` is provided.

The Turbo SDK provides the following methods to manage Credit Share Approvals:

- `shareCredits`: Creates a Credit Share Approval for the specified wallet address and amount of Credits.
- `revokeCredits`: Revokes all Credit Share Approvals for the specified wallet address.
- `listShares`: Lists all Credit Share Approvals for the specified wallet address or connected wallet.
- `dataItemOpts: { ...opts, paidBy: string[] }`: Upload methods now accept 'paidBy', an array of wallet addresses that have provided credit share approvals to the user from which to pay, in the order provided and as necessary, for the upload.

The Turbo CLI provides the following commands to manage Credit Share Approvals:

- `share-credits`: Creates a Credit Share Approval for the specified wallet address and amount of Credits.
- `revoke-credits`: Revokes all Credit Share Approvals for the specified wallet address.
- `list-shares`: Lists all Credit Share Approvals for the specified wallet address or connected wallet.
- `paidBy: --paid-by <paidBy...>`: Upload commands now accept '--paid-by', an array of wallet addresses that have provided credit share approvals to the user from which to pay, in the order provided and as necessary, for the upload.
- `--ignore-approvals`: Ignore all Credit Share Approvals and only use the signer's balance.
- `--use-signer-balance-first`: Use the signer's balance first before using Credit Share Approvals.

## Developers

### Requirements

- `nvm`
- `node` (>= 18)
- `yarn`

### Setup & Build

- `yarn install` - installs dependencies
- `yarn build` - builds web/node/bundled outputs

### Testing

- `yarn test` - runs integration tests against dev environment (e.g. `https://payment.ardrive.dev` and `https://upload.ardrive.dev`)
- `yarn test:docker` - runs integration tests against locally running docker containers (recommended)
- `yarn example:web` - opens up the example web page
- `yarn example:cjs` - runs example CJS node script
- `yarn example:esm` - runs example ESM node script

### Linting & Formatting

- `yarn lint:check` - checks for linting errors
- `yarn lint:fix` - fixes linting errors
- `yarn format:check` - checks for formatting errors
- `yarn format:fix` - fixes formatting errors

### Architecture

- Code to interfaces.
- Prefer type safety over runtime safety.
- Prefer composition over inheritance.
- Prefer integration tests over unit tests.

For more information on how to contribute, please see [CONTRIBUTING.md].

[package.json]: ./package.json
[examples]: ./examples
[examples/typescript/cjs]: ./examples/typescript/cjs
[examples/typescript/esm]: ./examples/typescript/esm
[TurboAuthenticatedClient]: #turboauthenticatedclient
[AbortSignal]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
[CONTRIBUTING.md]: ./CONTRIBUTING.md
[docs/native-address]: https://docs.ar.io/glossary.html#native-address
