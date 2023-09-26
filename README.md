# @ardriveapp/turbo-sdk 🚀

Welcome to the `@ardrive/turbo-sdk`! This SDK provides functionality for interacting with the Turbo Upload and Payment Services and is available for both NodeJS and Web environments.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
  - [NodeJS Environments](#nodejs)
    - [CommonJS](#commonjs)
    - [ESM](#esm)
  - [Web Environments](#web)
    - [Bundlers (Webpack, Rollup, ESbuild, etc.)](#bundlers-webpack-rollup-esbuild-etc)
    - [Browser](#browser)
  - [Typescript](#typescript)
  - [Examples](./examples)
- [Contributions](#contributions)

## Installation

```shell
npm install @ardrive/turbo-sdk
```

or

```shell
yarn add @ardrive/turbo-sdk
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
<script src="https://cdn.jsdelivr.net/npm/@ardrive/turbo-sdk"></script>
<script>
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

Usage:

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk/node';

const turbo = TurboFactory.unauthenticated();
const rates = await turbo.getFiatRates();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project:

```typescript
import { TurboFactory } from '@ardrive/turbo-sdk/web';

// or '@ardrive/turbo-sdk/node' for Node.js projects
```

Types are exported from `./lib/types/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

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

- `getFiatToAR( { currency })` - Returns the current raw fiat to AR conversion rate for a specific currency as reported by third-party pricing oracles.

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

## Contributions

If you encounter any issues or have feature requests, please file an issue on our GitHub repository. Contributions, pull requests, and feedback are both welcome and encouraged.

[package.json]: ./package.json
[examples]: ./examples
[TurboUnauthenticatedClient]: #turboUnauthenticatedClient
[TurboAuthenticatedClient]: #turboAuthenticatedClient
[AbortSignal]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
