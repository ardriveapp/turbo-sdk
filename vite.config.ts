import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "Turbo",
      formats: ["es", "cjs", "umd"],
    },
    rollupOptions: {
      external: ["fs", /^node_modules/],
      output: {
        globals: {
          // add here any external dependency
        },
      },
    },
  },
  resolve: {
    alias: {
      crypto: "crypto-browserify",
    },
  },
});
