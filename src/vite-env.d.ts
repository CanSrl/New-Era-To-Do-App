/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Niş modül bayrağının derleme zamanında enjekte edilen hâli.
 *
 * `vite.config.ts` içindeki `define` bunu ham `true`/`false` ile değiştirir;
 * çalışma zamanında böyle bir değişken YOKTUR. Sabit olması şart: modülün
 * `VITE_NICHE_MODULE=false` derlemesinde paketten tamamen elenmesi buna bağlı.
 */
declare const __NICHE_MODULE__: boolean;

interface ImportMetaEnv {
  /** Supabase proje URL'i. Tanımlı değilse uygulama yalnızca yerel modda çalışır. */
  readonly VITE_SUPABASE_URL?: string;
  /** Supabase anon (public) anahtarı. RLS ile korunur, istemciye gömülmesi güvenlidir. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * `"true"` ise "GitHub ile devam et" butonu gösterilir. Yalnızca Supabase
   * projesinde GitHub sağlayıcısı etkinleştirildiyse açın.
   */
  readonly VITE_AUTH_GITHUB?: string;
  /**
   * Sentry DSN. Tanımlı değilse hata izleme tamamen kapalıdır ve Sentry
   * paketi tarayıcıya hiç indirilmez.
   */
  readonly VITE_SENTRY_DSN?: string;
  /**
   * `"true"` ise faturalama arayüzü açılır. Yalnızca LemonSqueezy sırları
   * Edge Function secrets'ta tanımlıysa açın.
   */
  readonly VITE_BILLING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
