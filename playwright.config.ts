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

    /*
     * Animasyonlar kapalı koşulur.
     *
     * Sebep somut: `ClientCard` proje listesini `height: 0 → auto` ile açıyor
     * ve testler o panelin İÇİNDEKİ butona, panel hâlâ büyürken tıklıyordu.
     * Playwright hareket eden hedefe tıklamayı reddeder ("element is not
     * stable") ve 30 saniye bekleyip düşer. Hızlı makinede animasyon yetişir,
     * yük altında yetişmez — testler bu yüzden rastgele kırılıyordu.
     *
     * Bu bir kaçamak değil: uygulama `prefers-reduced-motion` tercihine zaten
     * uyuyor (`useReducedMotion`), yani burada gerçek bir kullanıcı yolu
     * koşuluyor. Animasyonların kendisi davranış değil; kırılganlığı test
     * sinyalini bozuyordu.
     *
     * `contextOptions` altında: bu Playwright sürümünde `reducedMotion`
     * doğrudan `use` seviyesinde tiplenmemiş, tarayıcı bağlamı seçeneği
     * olarak veriliyor.
     */
    contextOptions: { reducedMotion: 'reduce' },
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
