import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), 'index.html'),
        classic: resolve(process.cwd(), 'classic.html'),
        vx2: resolve(process.cwd(), 'vx2.html'),
      },
    },
  },
});
