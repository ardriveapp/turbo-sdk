import { build } from 'esbuild';
import { polyfillNode } from 'esbuild-plugin-polyfill-node';

const bundle = () => {
  console.log('Building web bundle esm.');
  const result = build({
    entryPoints: ['./src/web/index.ts'],
    bundle: true,
    platform: 'browser',
    target: ['esnext'],
    format: 'esm',
    globalName: 'turbo',
    plugins: [
      polyfillNode({
        polyfills: {
          crypto: true,
        },
      }),
    ],
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
