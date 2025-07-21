# Typescript React Example - Next.js

This example shows how to use the `@ardrive/turbo-sdk` within a Typescript/React project using [Next.js].

## Getting Started

1. Install the dependencies:

```bash
yarn
```

2. Start the development server:

```bash
yarn dev
```

3. Open your browser and navigate to `http://localhost:3000`. You should see the same UI as the Vite example.

## Polyfills

The `@ardrive/turbo-sdk` uses some modern browser features that may not be available in all browsers. To ensure compatibility, you may need to include some polyfills. This example uses webpack polyfills configuration to include the necessary polyfills.

The [tsconfig.json](./tsconfig.json) includes the following compiler options:

```json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "lib": ["dom", "dom.iterable", "es6"]
  }
}
```

The [next.config.js](./next.config.js) file includes the following polyfills required for the `@ardrive/turbo-sdk`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Only configure polyfills for client-side bundles
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer'),
        process: require.resolve('process/browser'),
        fs: false,
        net: false,
        tls: false,
      };

      // Provide global process and Buffer
      config.plugins.push(
        new config.webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
      );
    }

    return config;
  },
};

module.exports = nextConfig;
```

## Key Differences from Vite

This Next.js example differs from the Vite example in several ways:

1. **Configuration**: Uses `next.config.js` with webpack polyfills instead of `vite.config.js`
2. **Structure**: Uses Next.js App Router structure with `app/` directory
3. **Client Components**: Uses `'use client'` directive for components that use browser APIs
4. **Polyfills**: Uses webpack polyfills instead of vite-plugin-node-polyfills

## Polyfill Dependencies

The following polyfill packages are required for client-side usage:

- `crypto-browserify`: For crypto functionality
- `stream-browserify`: For stream functionality
- `buffer`: For Buffer support
- `process`: For process variable

If you are using a bundler other than Next.js, you may need to include the necessary polyfills in a similar way.

[Next.js]: https://nextjs.org/
