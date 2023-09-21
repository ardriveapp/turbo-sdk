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

const turbo = TurboFactory.unauthenticated({});
const rates = await turbo.getFiatRates();
```

#### Browser

```html
<script src="https://cdn.jsdelivr.net/npm/@ardrive/turbo-sdk"></script>
<script>
  const turbo = TurboFactory.unauthenticated({});
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

tsconfig's `tsconfig.json`:

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

const turbo = TurboFactory.unauthenticated({});
const rates = await turbo.getFiatRates();
```

#### ESM

Project's `package.json`:

```json
{
  "type": "module"
}
```

tsconfig's `tsconfig.json`:

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

const turbo = TurboFactory.unauthenticated({});
const rates = await turbo.getFiatRates();
```

### Typescript

The SDK provides TypeScript types. When you import the SDK in a TypeScript project:

```typescript
import Ardrive from '@ardrive/turbo-sdk/web';

// or '@ardrive/turbo-sdk/node' for Node.js projects
```

Types are exported from `./lib/types/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

## APIs

### TurboFactory

- `unauthenticated()` - Creates an instance of a client that accesses Turbo's unauthenticated services.

  ```typescript
  const turbo = TurboFactory.unauthenticated({});
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

- `getFiatToAR()` - Returns the current raw fiat to AR conversion rate for a specific currency as reported by third-party pricing oracles.

  ```typescript
  const fiatToAR = await turbo.getFiatToAR({ currency: 'USD' });
  ```

- `getFiatRates()` - Returns the current fiat rates for 1 GiB of data for supported currencies, including all top-up adjustments and fees.

  ```typescript
  const rates = await turbo.getFiatRates();
  ```

- `getWincForFiat({ amount, currency })` - Returns the current conversion rate for Winston Credits for the provided fiat currency and amount, including all top-up adjustments and fees.

  ```typescript
  const winc = await turbo.getWincForFiat({ amount: 100, currency: 'USD' });
  ```

- `getUploadCosts({ bytes })` - Returns the estimated cost in Winston Credits for the provided file sizes, including all upload adjustments and fees.

  ```typescript
  const costs = await turbo.getUploadCosts({ bytes: [1000, 2000] });
  ```

- `uploadSignedDataItem({ dataItemStreamFactory, signal })` - Uploads a signed data item. The provided dataItemStreamFactory should produce a NEW signed data item stream each time is it invoked.

  ```typescript
  const filePath = path.join(__dirname, './my-signed-data-item');
  const uploadResponse = await turbo.uploadSignedDataItem({
    dataItemStreamFactory: () => fs.createReadStream(filePath),
    signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  });
  ```

- `createCheckoutSession({ paymentAmount, currency, owner })` - Gets a Stripe checkout session for a Turbo Top Up

  ```typescript
  const { url, winc, paymentAmount, quotedPaymentAmount } =
    await turbo.createCheckoutSession({
      paymentAmount: 10_00, // 1000 cents = 10 USD
      currency: 'usd',
      owner: publicArweaveAddress,
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
  const balance = await turbo.getBalance();
  ```

- `uploadFile({ fileStreamFactory })` - Signs and uploads a raw file. The provided fileStreamFactory should produce a NEW file data stream each time is it invoked.

  ```typescript
  const filePath = path.join(__dirname, './my-unsigned-file.txt');
  const uploadResult = await turboAuthClient.uploadFile({
    fileStreamFactory: () => fs.createReadStream(filePath),
  });
  ```

## Contributions

If you encounter any issues or have feature requests, please file an issue on our GitHub repository. Contributions, pull requests, and feedback are both welcome and encouraged.

[package.json]: ./package.json
[examples]: ./examples
[TurboUnauthenticatedClient]: #turboUnauthenticatedClient
[TurboAuthenticatedClient]: #turboAuthenticatedClient
