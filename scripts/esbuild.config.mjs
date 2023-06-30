import esbuild from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

const streamPolyfillPlugin = {
  name: "polyfill-stream",
  setup(build) {
    build.onResolve({ filter: /^stream\/promises$/ }, (args) => {
      return { path: args.path, external: true };
    });

    build.onLoad({ filter: /^stream\/promises$/ }, () => {
      return {
        contents: 'export default require("stream/promises");',
        resolveDir: "node_modules/stream-browserify",
      };
    });
  },
};

esbuild
  .build({
    platform: "browser",
    entryPoints: [`src/index.ts`],
    tsconfig: "tsconfig.esm.json",
    target: ["chrome58", "firefox57", "safari11", "edge18"],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: "iife",
    globalName: "Turbo",
    plugins: [
      polyfillNode({
        polyfills: { fs: true, crypto: true },
      }),
    ],
    outfile: "lib-bundles/bundle.js",
    external: ["stream/promises"],
    treeShaking: true,
  })
  .catch(() => process.exit(1));
