import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const bundle = () => {
  console.log('Building web bundle esm.');
  const result = build({
    entryPoints: ['./src/web/index.ts'],
    bundle: true,
    minify: true,
    platform: 'browser',
    target: ['esnext'],
    format: 'esm',
    globalName: 'turbo',
    plugins: [
      polyfillNode({
        polyfills: {
          crypto: true,
          buffer: true,
          fs: true,
          'fs/promises': true,
        },
      }),
    ],
    // x402-fetch is an optional peer dependency pulling in wagmi, WalletConnect
    // and AppKit. Bundling it here would inline that whole tree into every web
    // build, x402 payments or not, since esbuild resolves a dynamic import()
    // with a static specifier same as a static import when bundling to a
    // single outfile. Externalizing keeps `import('x402-fetch')` a real
    // runtime import: a browser consumer who wants x402 payments installs the
    // package and resolves it via their own bundler or an import map, and one
    // who doesn't never pays for it.
    external: ['commander', 'cli-progress', 'x402-fetch'],
    tsconfig: './tsconfig.web.json',
    outfile: './bundles/web.bundle.min.js',
  })
    .catch((e) => {
      console.log(e);
      process.exit(1);
    })
    .then(() => {
      console.log('Successfully built web bundle.');
    });
};

bundle();

export { bundle };
