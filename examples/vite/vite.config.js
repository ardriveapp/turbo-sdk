import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  base: '/',
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: {
      buffer: path.resolve(
        __dirname,
        'node_modules/vite-plugin-node-polyfills/shims/buffer',
      ),
      'buffer/': path.resolve(
        __dirname,
        'node_modules/vite-plugin-node-polyfills/shims/buffer',
      ),
    },
  },
});
