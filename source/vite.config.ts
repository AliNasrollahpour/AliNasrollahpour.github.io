import { defineConfig } from 'vitest/config';

// base نسبی تا مسیر assetها روی GitHub Pages (زیرمسیرِ ریپو) درست بماند.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    // بازی داخل /fightforknowledge/ می‌نشیند، کنار اپ چت که assets/ خودش را دارد.
    // پس باندل‌ها در app/ و تصاویر در media/ می‌روند تا هیچ‌وقت روی هم نیفتند.
    assetsDir: 'app',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
  },
});
