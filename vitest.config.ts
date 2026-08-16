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
  /**
   * ⚠️ Bu dosya varken `vite.config.ts` testlerde HİÇ okunmaz — oradaki
   * `define` bloğu de dahil. Niş modül bayrağı orada ham boolean'a çevriliyor
   * (`__NICHE_MODULE__`); burada tekrarlanmazsa `features.ts` import edilir
   * edilmez "__NICHE_MODULE__ is not defined" ile düşer.
   *
   * Değer `true`: uygulamanın varsayılanı da o. Bayrağın KAPALI hâlini sınayan
   * testler modülü `vi.mock` ile taklit ediyor (`sync.test.ts`,
   * `task-mapping.test.ts`) — bu sabit onların önüne geçmez.
   */
  define: {
    __NICHE_MODULE__: true,
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
