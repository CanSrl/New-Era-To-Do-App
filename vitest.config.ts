import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Birim testleri: store mantığı ve saf yardımcı fonksiyonlar.
// Kullanıcı akışları Playwright (e2e/) tarafında test edilir.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // persist middleware localStorage'a ihtiyaç duyuyor.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // i18n dilini sabitler; bkz. src/test-setup.ts
    setupFiles: ['./src/test-setup.ts'],
    restoreMocks: true,
  },
})
