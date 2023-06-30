import esbuild from "esbuild";
import { nodeBuiltIns } from "esbuild-node-builtins";

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
    entryPoints: [`lib-esm/index.js`],
    target: ["chrome58", "firefox57", "safari11", "edge18"],
    bundle: true,
    minify: true,
    sourcemap: true,
    format: "esm",
    plugins: [nodeBuiltIns(), streamPolyfillPlugin],
    outfile: "lib-bundles/bundle.js",
    external: ["stream"],
  })
  .catch(() => process.exit(1));
