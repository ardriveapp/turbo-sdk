import path from "path";
import { defineConfig } from "vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  base: "./",
  plugins: [nodePolyfills({})],
  build: {
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "Turbo",
      // formats: ["es", "cjs", "umd", "iife"],
      fileName: (format) => `index.${format}.js`,
    },
    outDir: "lib",
    rollupOptions: {
      // Manually polyfill the 'stream' module with Promises
      external: ["stream"],
      output: {
        globals: {
          stream: "stream",
        },
      },
    },
  },
});
