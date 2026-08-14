import { defineConfig } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Sentry'nin kullanılmayan alt sistemlerini paketten eler. İzleme
    // yapılandırması performans izini ve hata ayıklama günlüklerini zaten
    // kapatıyor (bkz. src/lib/monitoring.ts); bu bayraklar aynı kararı
    // derleme zamanında uygulayıp parçayı küçültür.
    __SENTRY_DEBUG__: false,
    __SENTRY_TRACING__: false,
  },
  build: {
    rollupOptions: {
      output: {
        // Sentry parçasına sabit bir ad verilir ki service worker onu ada
        // göre hariç tutabilsin (aşağıya bakın).
        manualChunks: (id) => (id.includes('@sentry') ? 'sentry' : undefined),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        /*
         * Sentry parçası bilinçli olarak precache DIŞINDA.
         *
         * İzleme varsayılan olarak kapalı (VITE_SENTRY_DSN yok) ve o durumda
         * parça hiç istenmez — precache etmek her kullanıcıya asla
         * çalıştırılmayacak yüz kilobaytları indirtirdi. DSN tanımlıyken
         * parça normal ağ isteğiyle, çalışma anında alınır.
         */
        globIgnores: ['**/sentry-*.js'],
      },
      manifest: {
        name: 'Yapılacaklar Listesi',
        short_name: 'Yapılacaklar',
        description: 'Modern, hızlı ve çevrimdışı çalışabilen görev yöneticisi.',
        lang: 'tr',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
})
