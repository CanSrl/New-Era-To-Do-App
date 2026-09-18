import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
// Uygulamayla AYNI ayrıştırıcı. Bayrağın anlamı ( ' FALSE ' kapatır, tanımsız
// açık bırakır ) tek yerde tanımlı olsun diye buradan import ediliyor;
// `src/config/features.ts` import edilemez, çünkü o modül gövdesinde
// `import.meta.env` okuyor ve bu dosya Node tarafında çalışıyor.
import { isEnabledByDefault } from './src/config/flag-parsing'

// https://vite.dev/config/
// Fonksiyon biçimi, `loadEnv`'in `mode`'a ihtiyaç duyması yüzünden: bayrağın
// değeri `.env`, `.env.production` ve kabuk değişkenlerinin hepsinden
// okunabilmeli (aşağıda `__NICHE_MODULE__`).
export default defineConfig(({ mode }) => {
  // `loadEnv` hem `.env*` dosyalarını hem de `VITE_` önekli process.env
  // değişkenlerini toplar; `import.meta.env`'in uygulamada gördüğü kümenin
  // aynısı. Doğrudan `process.env` okunsaydı `.env.local` içine
  // `VITE_NICHE_MODULE=false` yazan kullanıcı bayrağın çalışmadığını görürdü.
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // Varsayılan davranış 5173 doluyken sessizce bir sonraki porta kayar.
      // Local-first mimaride LocalStorage origin'e (host+port) bağlıdır; bir
      // önceki `npm run dev` süreci kapatılmadan yenisi başlatılırsa kullanıcı
      // fark etmeden iki ayrı depoda çalışır ve "görevim kayboldu" sanır.
      // strictPort, sessizce kaymak yerine açıkça hata vererek unutulmuş
      // süreci fark ettirir.
      strictPort: true,
    },
    define: {
      // Sentry'nin kullanılmayan alt sistemlerini paketten eler. İzleme
      // yapılandırması performans izini ve hata ayıklama günlüklerini zaten
      // kapatıyor (bkz. src/lib/monitoring.ts); bu bayraklar aynı kararı
      // derleme zamanında uygulayıp parçayı küçültür.
      __SENTRY_DEBUG__: false,
      __SENTRY_TRACING__: false,

      // Niş modül bayrağı HAM boolean olarak enjekte edilir.
      //
      // `features.nicheModule` eskiden `isEnabledByDefault(import.meta.env...)`
      // idi; Vite ortam değişkenini metin sabitine çeviriyor ama sonuç bir
      // fonksiyon çağrısından geçtiği için sabit olmuyordu ve modül
      // `VITE_NICHE_MODULE=false` derlemesinde bile paketten elenmiyordu
      // (ölçüldü: derleme aynı boyutta çıkıyordu). Burada değer Node tarafında
      // hesaplanıp düz `true`/`false` olarak yazılıyor, böylece bayrağa bağlı
      // dallar derleme zamanında katlanabiliyor.
      //
      __NICHE_MODULE__: isEnabledByDefault(env.VITE_NICHE_MODULE),
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
          /*
           * Yazı tipleri precache'e DAHİL.
           *
           * Workbox varsayılanı woff2'yi almaz; almasaydı çevrimdışı açılan
           * uygulama sistem yazı tipine düşerdi. Dört dosya var çünkü iki
           * aile (gövde + başlık) × iki alt küme (latin, Türkçe için
           * latin-ext); toplam ~180 KB ve hepsi Türkçe arayüzde gerçekten
           * kullanılıyor.
           */
          globPatterns: ['**/*.{js,wasm,css,html,woff2}'],
        },
        manifest: {
          name: 'Yapılacaklar Listesi',
          short_name: 'Yapılacaklar',
          description: 'Modern, hızlı ve çevrimdışı çalışabilen görev yöneticisi.',
          lang: 'tr',
          /*
           * Kurulu uygulama doğrudan uygulama kabuğunu açar.
           *
           * Tanımlanmazsa varsayılan `/` olur — kök adres pazarlama sayfası
           * olduğundan, ana ekranına ikon eklemiş kullanıcı her açılışta
           * görevlerini değil tanıtım sayfasını görürdü.
           */
          start_url: '/app',
          theme_color: '#0b0b12',
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
      }),
    ],
  }
})
