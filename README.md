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

The SDK is provided in both CommonJS and ESM formats, and it's compatible with bundlers such as Webpack, Rollup, and ESbuild. Depending on your project's configuration, leverage the named exports provided by this SDK's [package.json]. Refer to the [examples] directory to see how to use the SDK in various environments.

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

The SDK comes with TypeScript typings. When you import the SDK in a TypeScript project:

```typescript
import Ardrive from '@ardrive/turbo-sdk/web';

// or '@ardrive/turbo-sdk/node' for Node.js projects
```

These typings are exported from `./lib/types/index.d.ts` and should be automatically recognized, offering benefits such as type-checking and autocompletion.

## APIs

### TurboFactory

- `unauthenticated()` - Creates an instance of the Turbo unauthenticated services.

  ```typescript
  const turbo = TurboFactory.unauthenticated({});
  ```

- `authenticated()` - Creates an instance that includes both the unauthenticated & authenticated services.

  ```typescript
  const jwk = await arweave.crypto.generateJWK();
  const turbo = TurboFactory.authenticated({ privateKey: jwk });
  ```

### TurboUnauthenticatedClient

- `getSupportedCurrencies()` - Returns the list of currencies supported by the Turbo Payment Service.

  ```typescript
  const currencies = await turbo.getSupportedCurrencies();
  ```

- `getSupportedCountries()` - Returns the list of countries supported by the Turbo Payment Service.

  ```typescript
  const countries = await turbo.getSupportedCountries();
  ```

- `getFiatToAR()` - Returns the current raw fiat to AR conversion rate for a specific currency

  ```typescript
  const fiatToAR = await turbo.getFiatToAR({ currency: 'USD' });
  ```

- `getFiatRates()` - Returns the current fiat rates for 1 GiB of data for supported currencies

  ```typescript
  const rates = await turbo.getFiatRates();
  ```

- `getWincForFiat({ amount, currency })` - Returns the current conversion rate for Winston Credits for the provided fiat currency and amount.

  ```typescript
  const winc = await turbo.getWincForFiat({ amount: 100, currency: 'USD' });
  ```

- `getUploadCosts({ bytes })` - Returns the estimated cost in Winston Credits for the provided file size.

  ```typescript
  const costs = await turbo.getUploadCosts({ bytes: [1000, 2000] });
  ```

- `uploadSignedDataItem({ dataItemStreamFactory, signal })` - Uploads a previously signed data item.
  ```typescript
  const uploadResponse = await turbo.uploadSignedDataItem({
    dataItemStreamFactory: myStreamFactory,
    signal: myAbortSignal,
  });
  ```

### TurboAuthenticatedClient

- `getBalance()` - Issues a signed request to get the credit balance of the user in Winston Credits.

  ```typescript
  const balance = await turbo.getBalance();
  ```

- `uploadFile({ fileStreamFactory })` - Signs and uploads a raw file.
  ```typescript
  const uploadResponse = await turbo.uploadFile({
    fileStreamFactory: myFileStreamFactory,
  });
  ```

## Contributions

If you encounter any issues or have feature requests, please file an issue on our GitHub repository. Contributions, pull requests, and feedback are both welcome and encouraged.

[package.json]: ./package.json
[examples]: ./examples
[TurboUnauthenticatedClient]: #turboUnauthenticatedClient
[TurboAuthenticatedClient]: #turboAuthenticatedClient
