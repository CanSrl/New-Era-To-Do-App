import { defineConfig, devices } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Testler aynı origin'deki LocalStorage'ı paylaşır; tek işçi ile koşmak
  // testlerin birbirinin verisini görmesini engeller.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Uygulama dili tarayıcıdan algılanıyor ve Chromium varsayılanı en-US.
    // Sabitlenmezse testler İngilizce arayüzle karşılaşır. Dil değiştirme
    // akışı kategoriler/dil testinde ayrıca sınanıyor.
    locale: 'tr-TR',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
