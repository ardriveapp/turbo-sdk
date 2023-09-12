# @ardriveapp/turbo-sdk 🚀

Welcome to the `@ardrive/turbo-sdk`! This SDK provides functionalities for interacting with the Turbo Upload and Payment Services. It is available in both NodeJS and Web environments.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage):

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

The SDK is available in both CommonJS and ESM formats and is compatible with bundlers such as Webpack, Rollup, and ESbuild.

### Web

#### Bundlers (Webpack, Rollup, ESbuild, etc.)

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk/web';

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

```javascript
const { TurboFactory } = require('@ardrive/turbo-sdk/node');

const turbo = TurboFactory.unauthenticated({});
const rates = await turbo.getFiatRates();
```

### ESM

```javascript
import { TurboFactory } from '@ardrive/turbo-sdk/node';

const turbo = TurboFactory.unauthenticated({});
const rates = await turbo.getFiatRates();
```

### Typescript

The SDK provides TypeScript typings. When you import the SDK in a TypeScript project:

```typescript
import Ardrive from '@ardrive/turbo-sdk/web';

// or '@ardrive/turbo-sdk/node' for Node.js projects
```

The provided typings (`./lib/types/index.d.ts`) will be automatically recognized, offering type checking and autocompletion benefits.

## APIs (WIP)

### TurboFactory

- `public()`
- `private()`

### TurboUnauthenticatedClient

- `getFiatRates()`
- `getFiatToAR()`
- `getSupportedCountries()`
- `getSupportedCurrencies()`
- `getWincForFiat()`
- `getUploadCosts()`
- `uploadSignedDataItem()`

### TurboAuthenticatedClient

- `getBalance()`
- `uploadFile()`

## Contributions

If you encounter any issues or have feature requests, please file an issue on our GitHub repository. Contributions, pull requests, and feedback are welcome and encouraged.
