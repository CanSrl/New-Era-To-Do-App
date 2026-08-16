import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dev-dist, supabase/.temp ve playwright çıktıları araçlar tarafından
  // üretilir (minify edilmiş paketler içerir); kaynak kodumuz değildir.
  globalIgnores(['dist', 'dev-dist', 'supabase/.temp', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Erişilebilirlik artık konvansiyon değil kapı: ihlal `npm run lint`i,
      // dolayısıyla CI'ı düşürür. Modaller Radix'ten geliyor (odak tuzağı ve
      // rol yönetimi orada), bu kural seti kendi yazdığımız işaretlemeyi
      // koruyor — ikon-only butonların erişilebilir adı, etiketsiz form
      // alanı, klavyeyle ulaşılamayan tıklama hedefi gibi.
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Yapılandırma dosyaları ve E2E testleri Node ortamında çalışır.
    files: ['*.config.ts', 'e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
