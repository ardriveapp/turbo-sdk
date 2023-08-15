import { defineConfig } from "vite";
import nodeResolve from "@rollup/plugin-node-resolve";

export default defineConfig({
  build: {
    lib: {
      name: "Turbo",
      formats: ["es", "cjs"],
      entry: "src/node/index.ts",
    },
    rollupOptions: {
      output: [
        {
          dir: "lib/esm", // For ES Modules format (browser and modern JS)
          entryFileNames: "[name].es.mjs",
          plugins: [nodeResolve],
        },
        {
          dir: "lib/cjs", // For ES Modules format (browser and modern JS)
          entryFileNames: "[name].cjs.js",
          plugins: [nodeResolve],
        },
      ],
    },
  },
  resolve: {
    alias: {
      crypto: "crypto-browserify",
    },
  },
});
