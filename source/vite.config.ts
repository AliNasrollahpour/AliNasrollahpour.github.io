import { defineConfig } from 'vitest/config';

// base نسبی تا مسیر assetها روی GitHub Pages (زیرمسیرِ ریپو) درست بماند.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
  },
});
