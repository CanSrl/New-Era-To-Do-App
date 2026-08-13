/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
