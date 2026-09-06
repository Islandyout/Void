import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        classic: resolve(process.cwd(), 'index.html'),
        vx2: resolve(process.cwd(), 'vx2.html'),
      },
    },
  },
});
