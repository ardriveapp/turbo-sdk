# @ardriveapp/turbo-sdk 🚀

Welcome to the `@ardrive/turbo-sdk`! This SDK provides functionality for interacting with the Turbo Upload and Payment Services and is available for both NodeJS and Web environments.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
  - [NodeJS Environments](#nodejs)
    - [CommonJS](#commonjs)
    - [ESM](#esm)
  - [Web Environments](#web)
    - [Bundlers (Webpack, Rollup, ESbuild, etc.)](#bundlers-webpack-rollup-esbuild-etc)
    - [Browser](#browser)
  - [Typescript](#typescript)
- [APIs](#apis)
  - [TurboFactory](#turbofactory)
  - [TurboUnauthenticatedClient](#turbounauthenticatedclient)
  - [TurboAuthenticatedClient](#turboauthenticatedclient)
- [Examples](./examples)
  - [CJS](./examples/cjs/index.js)
  - [ESM](./examples/esm/index.mjs)
  - [Web](./examples/web/index.html)
- [Developers](#developers)
  - [Requirements](#requirements)
  - [Setup & Build](#setup--build)
  - [Testing](#testing)
  - [Linting and Formatting](#linting--formatting)
  - [Architecture](#architecture)
- [Contributing](./CONTRIBUTING.md)

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
import { TurboFactory } from '@ardrive/turbo-sdk';

// load your JWK from a file or generate a new one
const jwk = fs.readFileSync('./my-jwk.json');
const address = arweave.wallets.jwkToAddress(jwk);
const turbo = TurboFactory.authenticated({ privateKey: jwk });

// get the wallet balance
const { winc: balance } = await turbo.getBalance();

// prep file for upload
const filePath = path.join(__dirname, './my-image.png');
const fileSize = fs.statSync(filePath).size;

// get the cost of uploading the file
const [{ winc: fileSizeCost }] = await turbo.getUploadCosts({
  bytes: [fileSize],
});

// check if balance greater than upload cost
if (balance < fileSizeCost) {
  const { url } = await turbo.createCheckoutSession({
    amount: fileSizeCost,
    owner: address,
    // add a promo code if you have one
  });
  // open the URL to top-up, continue when done
  open(url);
  return;
}

// upload the file
try {
  const { id, owner, dataCaches, fastFinalityIndexes } = await turbo.uploadFile(() => {
    fileStreamFactory => () => fs.createReadStream(filePath),
    fileSizeFactory => () => fileSize,
  });
  // upload complete!
  console.log('Successfully upload data item!', { id, owner, dataCaches, fastFinalityIndexes });
} catch (error) {
  // upload failed
  console.error('Failed to upload data item!', error);
} finally {
  const { winc: newBalance } = await turbo.getBalance();
  console.log('New balance:', newBalance);
}
```

## Usage

The SDK is provided in both CommonJS and ESM formats, and it's compatible with bundlers such as Webpack, Rollup, and ESbuild. Utilize the appropriate named exports provided by this SDK's [package.json] based on your project's configuration. Refer to the [examples] directory to see how to use the SDK in various environments.

### Web

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk';

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

Project's `package.json`:

```json
{
  "type": "commonjs" // or absent
}
```

Project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "moduleResolution": "Node",
    "skipLibCheck": true
  }
}
```

Usage:

```javascript
const { TurboFactory } = require('@ardrive/turbo-sdk');

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

#### ESM

Project's `package.json`:

```json
{
  "type": "module"
}
```

Project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "skipLibCheck": true
  }
}
```

#### Usage

Node:

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk/node';

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

Web:

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk/web';

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project:

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk/web';

// or '@ardrive/turbo-sdk/node' for Node.js projects
```

Types are exported from `./lib/types/[node/web]/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

## APIs

### TurboFactory

- `unauthenticated()` - Creates an instance of a client that accesses Turbo's unauthenticated services.

  ```typescript
  const turbo = TurboFactory.unauthenticated();
  ```

- `authenticated()` - Creates an instance of a client that accesses Turbo's authenticated and unauthenticated services.

  ```typescript
  const jwk = await arweave.crypto.generateJWK();
  const turbo = TurboFactory.authenticated({ privateKey: jwk });
  ```

### TurboUnauthenticatedClient

- `getSupportedCurrencies()` - Returns the list of currencies supported by the Turbo Payment Service for topping up a user balance of AR Credits (measured in Winston Credits, or winc).

  ```typescript
  const currencies = await turbo.getSupportedCurrencies();
  ```

- `getSupportedCountries()` - Returns the list of countries supported by the Turbo Payment Service's top up workflow.

  ```typescript
  const countries = await turbo.getSupportedCountries();
  ```

- `getFiatToAR({ currency })` - Returns the current raw fiat to AR conversion rate for a specific currency as reported by third-party pricing oracles.

  ```typescript
  const fiatToAR = await turbo.getFiatToAR({ currency: 'USD' });
  ```

- `getFiatRates()` - Returns the current fiat rates for 1 GiB of data for supported currencies, including all top-up adjustments and fees.

  ```typescript
  const rates = await turbo.getFiatRates();
  ```

- `getWincForFiat({ amount })` - Returns the current amount of Winston Credits including all adjustments for the provided fiat currency, amount. To leverage promo codes, see [TurboAuthenticatedClient].

  ```typescript
  const { winc, paymentAmount, quotedPaymentAmount, adjustments } =
    await turbo.getWincForFiat({
      amount: USD(100),
      // promo codes require an authenticated client
    });
  ```

- `getUploadCosts({ bytes })` - Returns the estimated cost in Winston Credits for the provided file sizes, including all upload adjustments and fees.

  ```typescript
  const [uploadCostForFile] = await turbo.getUploadCosts({ bytes: [1024] });
  const { winc, adjustments } = uploadCostForFile;
  ```

- `uploadSignedDataItem({ dataItemStreamFactory, dataItemSizeFactory, signal })` - Uploads a signed data item. The provided `dataItemStreamFactory` should produce a NEW signed data item stream each time is it invoked. The `dataItemSizeFactory` is a function that returns the size of the file. The `signal` is an optional [AbortSignal] that can be used to cancel the upload or timeout the request.

  ```typescript
  const filePath = path.join(__dirname, './my-signed-data-item');
  const dataItemSize = fs.statSync(filePath).size;
  const uploadResponse = await turbo.uploadSignedDataItem({
    dataItemStreamFactory: () => fs.createReadStream(filePath),
    dataItemSizeFactory: () => dataItemSize,
    signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  });
  ```

- `createCheckoutSession({ amount, owner })` - Creates a Stripe checkout session for a Turbo Top Up with the provided amount, currency, owner. The returned URL can be opened in the browser, all payments are processed by Stripe. To leverage promo codes, see [TurboAuthenticatedClient].

  ```typescript
  const { url, winc, paymentAmount, quotedPaymentAmount, adjustments } =
    await turbo.createCheckoutSession({
      amount: USD(10.0), // $10.00 USD
      owner: publicArweaveAddress,
      // promo codes require an authenticated client
    });

  // Open checkout session in a browser
  if (process.platform === 'darwin') {
    // macOS
    exec(`open ${url}`);
  } else if (process.platform === 'win32') {
    // Windows
    exec(`start "" "${url}"`, { shell: true });
  } else {
    // Linux/Unix
    open(url);
  }
  ```

### TurboAuthenticatedClient

- `getBalance()` - Issues a signed request to get the credit balance of a wallet measured in AR (measured in Winston Credits, or winc).

  ```typescript
  const { winc: balance } = await turbo.getBalance();
  ```

- `getWincForFiat({ amount, promoCodes })` - Returns the current amount of Winston Credits including all adjustments for the provided fiat currency, amount, and optional promo codes.

  ```typescript
  const { winc, paymentAmount, quotedPaymentAmount, adjustments } =
    await turbo.getWincForFiat({
      amount: USD(100),
      promoCodes: ['MY_PROMO_CODE'], // promo codes require an authenticated client
    });
  ```

- `createCheckoutSession({ amount, owner, promoCodes })` - Creates a Stripe checkout session for a Turbo Top Up with the provided amount, currency, owner, and optional promo codes. The returned URL can be opened in the browser, all payments are processed by Stripe. Promo codes require an authenticated client.

  ```typescript
  const { url, winc, paymentAmount, quotedPaymentAmount, adjustments } =
    await turbo.createCheckoutSession({
      amount: USD(10.0), // $10.00 USD
      owner: publicArweaveAddress,
      promoCodes: ['MY_PROMO_CODE'], // promo codes require an authenticated client
    });

  // Open checkout session in a browser
  if (process.platform === 'darwin') {
    // macOS
    exec(`open ${url}`);
  } else if (process.platform === 'win32') {
    // Windows
    exec(`start "" "${url}"`, { shell: true });
  } else {
    // Linux/Unix
    open(url);
  }
  ```

- `uploadFile({ fileStreamFactory, fileSizeFactory, signal })` - Signs and uploads a raw file. The provided `fileStreamFactory` should produce a NEW file data stream each time is it invoked. The `fileSizeFactory` is a function that returns the size of the file. The `signal` is an optional [AbortSignal] that can be used to cancel the upload or timeout the request.

  ```typescript
  const filePath = path.join(__dirname, './my-unsigned-file.txt');
  const fileSize = fs.stateSync(filePath).size;
  const uploadResult = await turbo.uploadFile({
    fileStreamFactory: () => fs.createReadStream(filePath),
    fileSizeFactory: () => fileSize,
    // no timeout or AbortSignal provided
  });
  ```

## Developers

### Requirements

- `nvm`
- `node` (>= 18)
- `yarn`

### Setup & Build

- `yarn install` - installs dependencies
- `yarn build` - builds web/node/bundled outputs

### Testing

- `yarn test` - runs integration tests
- `yarn example:web` - opens up the example web page
- `yarn example:cjs` - runs example CJS node script
- `yarn example:mjs` - runs example ESM node script

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
[TurboAuthenticatedClient]: #turboauthenticatedclient
[AbortSignal]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
[CONTRIBUTING.md]: ./CONTRIBUTING.md
