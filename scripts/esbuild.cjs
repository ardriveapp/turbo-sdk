"use-strict";

const esbuild = require("esbuild");
const { nodeBuiltIns } = require("esbuild-node-builtins");

esbuild
  .build({
    platform: "browser",
    entryPoints: [`lib-cjs/index.js`],
    // tsconfig: "tsconfig.cjs.json",
    target: ["chrome58", "firefox57", "safari11", "edge18", "es2020"],
    bundle: true,
    minify: true,
    plugins: [nodeBuiltIns()],
    external: ["stream/promises"],
  })
  .catch(() => process.exit(1));
